import express from "express";
import mongoose from "mongoose";
import OpenAI from "openai";
import axios from "axios";
const { Telegraf, Markup } = require("telegraf");

require("dotenv").config();

const app = express();
const port = 3000;
const model = "gpt-4o-mini";

app.use(express.json());

const bot = new Telegraf(process.env.BOT_ID);

// Connect to MongoDB with Mongoose
const mongoURI = process.env.MONGODB_URI;
mongoose
  .connect(mongoURI as string)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Failed to connect to MongoDB", err));

// Define a Mongoose schema and model for LinkedIn tokens
const TokenSchema = new mongoose.Schema({
  chatId: { type: String, required: true, unique: true },
  accessToken: { type: String, required: true },
  userInfo: { type: String, required: true },
  userIntests: { type: String, required: true },
});

const Token = mongoose.model("Token", TokenSchema);

bot.start((ctx: any) => {
  const commandsDescription = `
  Here are the commands you can use:

  1. /start - Welcomes you to the bot and provides a friendly greeting.
  2. /userProfile - Prompts you to provide your personal information and interests, which are saved for future use.
  3. /linkedinOauth - Initiates the LinkedIn OAuth authentication process, allowing the bot to access your LinkedIn account.
  4. /createPost - Asks for details to create a LinkedIn post, generates the post using OpenAI, and gives you the option to post it.

  Feel free to use any of these commands!
  `;

  ctx.reply(
    "Hey " +
      ctx.from.first_name +
      ", Cheered to have you here!\n\n" +
      commandsDescription
  );
});

bot.command("linkedinOauth", async (ctx: any) => {
  const redirectUri = `${process.env.ORIGIN}/auth/linkedin/callback?chat_id=${ctx.from.id}`;
  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${process.env.CLIENT_ID}&redirect_uri=${redirectUri}&scope=openid+profile+w_member_social+email`;
  ctx.reply(`Please authenticate with LinkedIn using this link: ${authUrl}`);
});

app.get("/auth/linkedin/callback", async (req, res) => {
  const { code, chat_id } = req.query;

  try {
    const response = await axios.post(
      "https://www.linkedin.com/oauth/v2/accessToken",
      null,
      {
        params: {
          grant_type: "authorization_code",
          code: code,
          client_id: process.env.CLIENT_ID,
          client_secret: process.env.CLIENT_SECRET,
          redirect_uri: `${process.env.ORIGIN}/auth/linkedin/callback?chat_id=${chat_id}`,
        },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const accessToken = response.data.access_token;

    const existingToken = await Token.findOne({ chatId: chat_id });
    if (existingToken) {
      existingToken.accessToken = accessToken;
      await existingToken.save();
    } else {
      const newToken = new Token({ chatId: chat_id, accessToken });
      await newToken.save();
    }

    res.send("Yey!! Your linkedin got connected successfully.");
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("An error occurred");
  }
});

const userStates: any = {};

bot.command("userProfile", async (ctx: any) => {
  userStates[ctx.from.id] = "userProfile"; // Set the user state to 'userProfile'

  ctx.reply(
    "Please provide who you are and your interests in the following format:\nI am: <info>\nInterests: <interest>"
  );
});

bot.command("createPost", async (ctx: any) => {
  userStates[ctx.from.id] = "createPost"; // Set the user state to 'createPost'

  ctx.reply(
    "Please provide the topic, context, and thoughts for the post in the following format:\nTopic: <topic>\nContext: <context>\nThoughts: <thoughts>"
  );
});

bot.on("text", async (ctx: any) => {
  const userId = ctx.from.id;
  const message = ctx.message.text;

  if (!userStates[userId]) return; // If no state is set, return and do nothing.

  const currentState = userStates[userId];

  if (currentState === "userProfile") {
    const [userInfo, userIntests] = message
      .split("\n")
      .map((line: string) => line.split(": ")[1]);

    // Save userInfo and userIntests to the Token collection
    const existingToken = await Token.findOne({ chatId: userId });
    if (existingToken) {
      existingToken.userInfo = userInfo;
      existingToken.userIntests = userIntests;
      await existingToken.save();
    } else {
      const newToken = new Token({
        chatId: userId,
        userInfo: userInfo,
        userIntests: userIntests,
      });
      await newToken.save();
    }

    ctx.reply("Your profile information has been saved successfully.");
    delete userStates[userId]; // Clear the state after processing
  }

  if (currentState === "createPost") {
    const lines = message.split("\n");

    if (lines.length < 3) {
      ctx.reply(
        "Please provide the details in the correct format:\nTopic: <topic>\nContext: <context>\nThoughts: <thoughts>"
      );
      return;
    }

    const [topic, context, thoughts] = message
      .split("\n")
      .map((line: string) => line.split(": ")[1]);

    try {
      // Fetch userInfo and userIntests from the Token collection
      const token = await Token.findOne({ chatId: userId });
      if (!token) {
        ctx.reply(
          "No profile information found. Please provide your profile first."
        );
        return;
      }

      const userInfo = token.userInfo;
      const userIntests = token.userIntests;

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: "system",
            content: `You are an AI assistant tasked with creating engaging LinkedIn posts. The user is a ${userInfo} and ${userIntests} seeking to increase their brand impression on LinkedIn. Create posts based on the topic, context, and thoughts they provide. Ensure the posts are informative, slightly enthusiastic, and of optimal length for LinkedIn engagement.`,
          },
          {
            role: "user",
            content: `Topic: ${topic}\n\nContext: ${context}\n\nThoughts/Findings: ${thoughts}`,
          },
        ],
      });

      const linkedinPost = completion.choices[0].message.content as string;
      // Send the post with inline buttons for Yes/No
      ctx.reply(
        `Here is your LinkedIn post:\n\n${linkedinPost}\n\nDo you want to post it?`,
        Markup.inlineKeyboard([
          Markup.button.callback("Yes", "post_yes"),
          Markup.button.callback("No", "post_no"),
        ])
      );

      bot.action("post_yes", async (ctx: any) => {
        const token = await Token.findOne({ chatId: userId });

        if (token) {
          const author = await getUserProfile(token.accessToken);
          await postToLinkedIn(token.accessToken, linkedinPost, author);
          ctx.reply("Successfully posted to LinkedIn");
        } else {
          ctx.reply(
            "No LinkedIn access token found. Please authenticate first."
          );
        }
      });

      bot.action("post_no", async (ctx: any) => {
        ctx.reply("Post not published");
      });
    } catch (error) {
      ctx.reply("An error occurred while creating the post");
    }
    delete userStates[userId]; // Clear the state after processing
  }
});

bot.launch();

async function postToLinkedIn(
  accessToken: string,
  content: string,
  author: string
): Promise<void> {
  try {
    const post = {
      author: author,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: {
            text: content,
          },
          shareMediaCategory: "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    };

    const response = await axios.post(
      "https://api.linkedin.com/v2/ugcPosts",
      post,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
        },
      }
    );
    console.log("Successfully posted to LinkedIn:", response.data);
  } catch (error) {
    console.error("Error posting to LinkedIn:", error);
    throw error;
  }
}
async function getUserProfile(accessToken: string): Promise<string> {
  try {
    const response = await axios.get("https://api.linkedin.com/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // Extract the user's LinkedIn ID (URN)
    const personId = response.data.sub;
    return `urn:li:person:${personId}`;
  } catch (error) {
    console.error("Error fetching LinkedIn profile:", error);
    throw error;
  }
}

app.get("/check", (req, res) => {
  res.send({ message: "Successfully posted to LinkedIn" });
});

app.listen(port, () => {
  console.log(`Server is running on ${port} PORT`);
});
