import { Module } from "../lib/plugins.js";
import fetch from "node-fetch";

Module({
  command: "gemini",
  package: "ai",
  description: "Chat with gemini",
})(async (message, match) => {
  if (!match) return message.send("*ʀᴀ ᴍᴜᴊʜᴇ ǫᴜᴇsᴛɪᴏɴ ᴋᴀʀᴏ!*");

  try {
    const sent = await message.send("*sᴏᴄʜᴛᴀ ʜᴜɴ (ᴛʜɪɴᴋɪɴɢ)...*");
    const res = await fetch(
      `https://api.privatezia.biz.id/api/ai/luminai?query=${encodeURIComponent(
        match
      )}`
    );
    const data = await res.json();

    if (!data.status) {
      return await message.send(
        "*ʀᴇꜱᴘᴏɴꜱᴇ ꜰᴀɪʟᴇᴅ ᴛʀʏ `ᴀɢᴀɪɴ`*",
        { edit: sent.key }
      );
    }

    const answer = data.data;
    await message.send(answer, { edit: sent.key });
  } catch (error) {
    console.error("[gemini ERROR]:", error.message);
    await message.send("*ᴀɴ ᴇʀʀᴏʀ ᴏᴄᴄᴜʀʀᴇᴅ ᴛʀʏ ᴀɢᴀɪɴ `ʟᴀᴛᴇʀ`*");
  }
});

Module({
  command: "gpt",
  package: "ai",
  description: "Chat with AI",
})(async (message, match) => {
  if (!match) {
    return message.send("*ʀᴀ ᴍᴜᴊʜᴇ ǫᴜᴇsᴛɪᴏɴ ᴋᴀʀᴏ!*");
  }

  const sent = await message.send("*sᴏᴄʜᴛᴀ ʜᴜɴ [ᴛʜɪɴᴋɪɴɢ]*");

  try {
    const model = "gemini-2.5-flash-lite";

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=AIzaSyAC7uOqqhfu959c1QyP0LHRgGAqbiLPYFw`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: match }],
            },
          ],
        }),
      }
    );

    const data = await res.json();

    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reply) {
      return message.send(
        "*❌ Failed to get response. Try again.*",
        { edit: sent.key }
      );
    }

    await message.send(reply, { edit: sent.key });

  } catch (error) {
    console.error("[GPT ERROR]:", error);

    await message.send(
      "*❌ Error occurred. Try again later.*",
      { edit: sent.key }
    );
  }
});