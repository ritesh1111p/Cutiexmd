
import os from "os";
import { Module } from "../lib/plugins.js";
import config from "../config.js";
Module({
  command: "alive",
  package: "general",
  description: "Check if bot is alive",
})(async (message) => {
  try {
    const hostname = os.hostname();
    // Indian Time
    const time = new Date().toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour12: false, // 24-hour format
    });

    const ramUsedMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    const caption = `
*- Yᴏᴜʀ ᴄᴜᴛɪᴇ ǫᴜᴇᴇɴ ᴍᴅ ʙᴏᴛ ɪꜱ ᴀʟɪᴠᴇ. 🎀* 

  *[ᴛɪᴍᴇ]: ${time}*

  *[Hᴏꜱᴛ]: Nᴀꜱᴀ Qᴜᴀɴᴛᴜᴍ Cᴏᴍᴘᴜᴛᴇʀ*

  *[Rᴀᴍ ᴜꜱᴀɢᴇ]: ${ramUsedMB} ᴍʙ*

  *[Rᴜɴᴛɪᴍᴇ]: ${hours}h ${minutes}m*

  *[Dᴇᴠ]: https://t.me/moon_x_2006*

     *- Hᴀᴠᴇ ᴀ sᴇxʏ ᴅᴀʏ. 💋*
    `.trim();

    const opts = {
      image: { url: "https://files.catbox.moe/rzga9x.jpg" },
      caption: caption,
      mimetype: "image/jpeg",
      contextInfo: {
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: "120363410247214508@newsletter",
          newsletterName: "ᴄᴜᴛɪᴇ - ǫᴜᴇᴇɴ ᴍᴅ",
          serverMessageId: 6,
        },
      },
    };

    await message.conn.sendMessage(message.from, opts);
  } catch (err) {
    console.error("*❌ ᴀʟɪᴠᴇ ᴄᴏᴍᴍᴀɴᴅ ᴇʀʀᴏʀ*", err);
    await message.conn.sendMessage(message.from, {
      text: `❌ Error: ${err?.message || err}`,
    });
  }
});

Module({
  command: "download",
  package: "general",
  description: "Universal social media downloader",
})(async (message, { args }) => {
  try {
    const url = args.join(" ").trim();

    if (!url) {
      return await message.conn.sendMessage(message.from, {
        text: "❌ Send a valid link\nExample: .download <url>"
      });
    }

    const api = `https://social-media-downloader-api-s7.onrender.com/sylove?url=${encodeURIComponent(url)}`;

    const res = await fetch(api);
    const data = await res.json();

    if (!data || data.status !== "success") {
      return await message.conn.sendMessage(message.from, {
        text: "❌ Download failed or unsupported platform."
      });
    }

    const media = data.video_url?.[0] || data.audio_url?.[0];

    if (!media) {
      return await message.conn.sendMessage(message.from, {
        text: "❌ No downloadable media found."
      });
    }

    const caption = `
╭─「 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃 𝐒𝐔𝐂𝐂𝐄𝐒𝐒 」─╮
│ Platform : ${data.platform || "Unknown"}
│ User     : ${data.post_info?.owner_username || "Unknown"}
╰──────────────────────╯

${data.post_info?.caption || ""}
    `.trim();

    // detect video or audio (basic)
    const isVideo = media.includes(".mp4");

    await message.conn.sendMessage(message.from, {
      [isVideo ? "video" : "document"]: { url: media },
      caption
    });

  } catch (err) {
    console.error("download error:", err);
    await message.conn.sendMessage(message.from, {
      text: `❌ Error: ${err?.message || err}`
    });
  }
});