import express from "express";
import OpenAI from "openai";
import axios from "axios";
const { Telegraf } = require("telegraf");
// const { Pool } = require("pg");

require("dotenv").config();

const app = express();
const port = 3000;
const model = "gpt-4o-mini";

app.use(express.json());

const bot = new Telegraf(process.env.BOT_ID);

// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   ssl: {
//     rejectUnauthorized: false,
//   },
// });

bot.start((ctx: any) =>
  ctx.reply("Hey " + ctx.from.first_name + ", Cheered to have you here!")
);

// bot.command("linkedinOauth", async (ctx: any) => {
//   const authUrl =
//     "https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=78gkle5txhe6u2&redirect_uri=http://localhost:3000&scope=openid+profile+w_member_social+email";
//   ctx.reply(`Please authenticate with LinkedIn using this link: ${authUrl}`);
// });

// app.get("/", async (req, res) => {
//   const authorizationCode = req.query.code;

//   try {
//     const response = await axios.post(
//       "https://www.linkedin.com/oauth/v2/accessToken",
//       null,
//       {
//         params: {
//           grant_type: "authorization_code",
//           code: authorizationCode,
//           client_id: "78gkle5txhe6u2",
//           client_secret: "WPL_AP1.zLN3tPVlNbWf0Ggs./L9n2g==",
//           redirect_uri: "http://localhost:3000",
//         },
//         headers: {
//           "Content-Type": "application/x-www-form-urlencoded",
//         },
//       }
//     );

//     const accessToken = response.data.access_token;

//     console.log(accessToken);

//     // await pool.query("INSERT INTO tokens (access_token) VALUES ($1)", [
//     //   accessToken,
//     // ]);

//     res.send("Access token stored successfully");
//   } catch (error) {
//     console.error("Error:", error);
//     res.status(500).send("An error occurred");
//   }
// });

bot.command("createPost", async (ctx: any) => {
  ctx.reply(
    "Please provide the topic, context, and thoughts for the post in the following format:\nTopic: <topic>\nContext: <context>\nThoughts: <thoughts>"
  );

  bot.on("text", async (ctx: any) => {
    const message = ctx.message.text;
    const [topic, context, thoughts] = message
      .split("\n")
      .map((line: string) => line.split(": ")[1]);

    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: "user",
            content: `Topic: ${topic}\n\nContext: ${context}\n\nThoughts/Findings: ${thoughts}`,
          },
        ],
      });

      const linkedinPost = completion.choices[0].message.content;
      ctx.reply(
        `Here is your LinkedIn post:\n\n${linkedinPost}\n\nDo you want to post it? (yes/no)`
      );

      bot.on("text", async (ctx: any) => {
        if (ctx.message.text.toLowerCase() === "yes") {
          // const result = await pool.query(
          //   "SELECT access_token FROM tokens ORDER BY id DESC LIMIT 1"
          // );
          // const accessToken = result.rows[0].access_token;

          await postToLinkedIn("", linkedinPost as string);
          ctx.reply("Successfully posted to LinkedIn");
        } else {
          ctx.reply("Post not published");
        }
      });
    } catch (error) {
      console.error("Error:", error);
      ctx.reply("An error occurred while creating the post");
    }
  });
});

bot.command("correctGrammar", async (ctx: any) => {
  ctx.reply(
    "Please provide the sentence you want to correct and the desired tone in the following format:\nSentence: <your sentence>\nTone: <desired tone>"
  );

  bot.on("text", async (ctx: any) => {
    const message = ctx.message.text;
    const [sentence, tone] = message
      .split("\n")
      .map((line: string) => line.split(": ")[1]);

    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: "user",
            content: `Correct this sentence: "${sentence}" in a ${tone} tone.`,
          },
        ],
      });

      const correctedSentence = completion.choices[0].message.content;
      ctx.reply(`Here is your corrected sentence:\n\n${correctedSentence}`);
    } catch (error) {
      console.error("Error:", error);
      ctx.reply("An error occurred while correcting the sentence");
    }
  });
});

// bot.command("fetchComments", async (ctx: any) => {
//   ctx.reply("Please provide the URL or ID of the LinkedIn post:");

//   bot.on("text", async (ctx: any) => {
//     const postUrlOrId = ctx.message.text;

//     try {
//       // Fetch comments from LinkedIn post
//       // const accessToken =
//       //   "AQUXwps4ahxKyxgnns-BDyUCaju3WnPE_KqKzzVZ3K7WLoMvet0HRVrOOBpRUB3bGcPElenUlaJYSJshu2COLihxQvRIcVV3q2y3iwYQMxumJexbubHiVNxbiGcz2wa0qfIbwq7qKv6XY5VLXh8I96yWWwsdz2JXFShBVu_-hdFIr0FhQW2AT14-tNqWN7CbXBoMTGRBJ9hyu-5m9GTF1b5dbmF3CNipm87cT1jdVUJQrDeV8ZPQwBCtdQGlRhVbNzpy93qL5sdRH2aL3Oqx2CUHxinF9HvgZD9cBwLisgVKtjS069rG9xFerY4Z3AK_gzEFl6pLkr0R1mp4EPTjgSBTVrnldQ";
//       // const response = await axios.get(
//       //   `https://api.linkedin.com/v2/comments?q=parent&parent=${postUrlOrId}`,
//       //   {
//       //     headers: {
//       //       Authorization: `Bearer ${accessToken}`,
//       //       "Content-Type": "application/json",
//       //     },
//       //   }
//       // );

//       // const comments = response.data.elements;
//       // let commentsText = "Here are the comments:\n\n";
//       // comments.forEach((comment: any, index: number) => {
//       //   commentsText += `${index + 1}. ${comment.message.text}\n`;
//       // });

//       ctx.reply(
//         // commentsText +
//         "\nPlease choose the number of the comment you want to reply to:"
//       );

//       bot.on("text", async (ctx: any) => {
//         // const commentIndex = parseInt(ctx.message.text) - 1;
//         // const selectedComment = comments[commentIndex];
//         const selectedComment = `Junior devs gon' rise, adapt all the AI spice. Future? Bright but gotta ignite new skills that thrill.`;

//         ctx.reply("Generating a reply to the selected comment...");

//         try {
//           const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
//           const completion = await openai.chat.completions.create({
//             model: model,
//             messages: [
//               {
//                 role: "system",
//                 content:
//                   "You are an AI assistant tasked with creating LinkedIn replies. The user is a software developer and tech enthusiast who wants to reply to a comment in a casual, friendly, and engaging tone. The replies should be informative and written in an approachable way.",
//               },
//               {
//                 role: "user",
//                 content: `Post: ${postUrlOrId}\n\nComment: ${selectedComment}`,
//               },
//             ],
//           });

//           const reply = completion.choices[0].message.content;
//           ctx.reply(
//             `Here is your reply:\n\n${reply}\n\nDo you want to post it? (yes/no)`
//           );

//           bot.on("text", async (ctx: any) => {
//             if (ctx.message.text.toLowerCase() === "yes") {
//               await postReplyToLinkedIn(
//                 "AQUXwps4ahxKyxgnns-BDyUCaju3WnPE_KqKzzVZ3K7WLoMvet0HRVrOOBpRUB3bGcPElenUlaJYSJshu2COLihxQvRIcVV3q2y3iwYQMxumJexbubHiVNxbiGcz2wa0qfIbwq7qKv6XY5VLXh8I96yWWwsdz2JXFShBVu_-hdFIr0FhQW2AT14-tNqWN7CbXBoMTGRBJ9hyu-5m9GTF1b5dbmF3CNipm87cT1jdVUJQrDeV8ZPQwBCtdQGlRhVbNzpy93qL5sdRH2aL3Oqx2CUHxinF9HvgZD9cBwLisgVKtjS069rG9xFerY4Z3AK_gzEFl6pLkr0R1mp4EPTjgSBTVrnldQ",
//                 selectedComment.id,
//                 reply as string
//               );
//               ctx.reply("Successfully replied to the comment on LinkedIn");
//             } else {
//               ctx.reply("Reply not posted");
//             }
//           });
//         } catch (error) {
//           console.error("Error:", error);
//           ctx.reply("An error occurred while generating the reply");
//         }
//       });
//     } catch (error) {
//       console.error("Error:", error);
//       ctx.reply("An error occurred while fetching comments");
//     }
//   });
// });

bot.launch();

async function postToLinkedIn(
  accessToken: string,
  content: string
): Promise<void> {
  try {
    const post = {
      author: "urn:li:person:nV3c6R38at",
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

async function postReplyToLinkedIn(
  accessToken: string,
  commentId: string,
  content: string
): Promise<void> {
  try {
    const reply = {
      message: {
        text: content,
      },
    };

    const response = await axios.post(
      `https://api.linkedin.com/v2/comments/${commentId}/replies`,
      reply,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("Successfully replied to LinkedIn comment:", response.data);
  } catch (error) {
    console.error("Error replying to LinkedIn comment:", error);
    throw error;
  }
}

app.post("/linkedin", async (req, res) => {
  const { accessToken, content } = req.body;
  await postToLinkedIn(accessToken, content);
  res.send({ message: "Successfully posted to LinkedIn" });
});

app.get("/check", (req, res) => {
  res.send({ message: "Successfully posted to LinkedIn" });
});

app.get("/", (req, res) => {
  res.send("<h1>Hello World</h1>");
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
