import os from "os";
import {
    Module
} from "../lib/plugins.js";
import config from "../config.js";

const readMore = String.fromCharCode(8206).repeat(4001);

function SABIR7718(secs) {
    const pad = (s) => s.toString().padStart(2, "0");
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    return `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
}

Module({
    command: "menu",
    package: "general",
    description: "Show simple menu header",
})(async (message) => {
    try {
        await message.react("💋");

        const time = new Date().toLocaleTimeString("en-IN", {
            timeZone: "Asia/Kolkata",
        });

        const userName = message.pushName || "User";

        const usedGB = ((os.totalmem() - os.freemem()) / 1073741824).toFixed(2);
        const totGB = (os.totalmem() / 1073741824).toFixed(2);
        const ram = `${usedGB} / ${totGB} GB`;

        const S7 = `
   *╰≻【 ᴄᴜᴛɪᴇ ǫᴜᴇᴇɴ ᴍᴅ 】≺╯︎*
╔─┉┉┉┉┉┉┉┉┉┉┉┉┉┉┉┉┉┉┉─⋗
│ *𝐔ѕᴇʀ*    : ${userName}
│ *𝐏ʀᴇғɪx*  : ${config.prefix}
│ *𝐑ᴜɴ*     : ${SABIR7718(process.uptime())}
│ *𝐌ᴏᴅᴇ*    : Public
│ *𝐎ᴡɴᴇʀ*   : 𝚳𝚯𝚯𝚴-𝚾 𝚾𝐃
│ *𝐑ᴀᴍ*     : ${ram}
│ *𝐓ɪᴍᴇ*    : ${time}
│ *𝐏ᴀɪʀ* : https://t.me/cutie_mdbot
╚─┉┉┉┉┉┉┉┉┉┉┉┉┉┉┉┉┉┉┉─⋗

${readMore}
‎
‎👑 『 𝗢𝗪𝗡𝗘𝗥 』
‎╭───────────────≻
‎│ 💖 .owner
‎│ 🟢 .alive
‎│ 💍 .pair
‎│ ⏱️ .uptime
‎│ 🔒 .private
‎│ 🌍 .public
‎│ ⚙️ .prefix
‎╰───────────────≻
‎
‎👤 『 𝗣𝗥𝗢𝗙𝗜𝗟𝗘 』
‎╭───────────────≻
‎│ 🖼️ .getpp
‎│ 📷 .setpp
‎│ 🎥 .vv
‎│ 🎬 .vv2
‎│ 🧸 .sticker
‎│ 📝 .getbio
‎│ ✏️ .setbio
‎│ 😂 .emoji
‎│ 😄 .emoji2
‎│ 🚫 .block
‎╰───────────────≻
‎
‎👥 『 𝗚𝗥𝗢𝗨𝗣 』
‎╭───────────────≻
‎│ 📢 .hidetag
‎│ 🏷️ .tag
‎│ 👥 .tagall
‎│ ❌ .kick
‎│ 💥 .kickall
‎│ ⬆️ .promote
‎│ ⬇️ .demote
‎│ 👋 .welcome
‎│ 💌 .goodbye
‎│ 🔗 .antilink
‎│ 🚫 .antibot
‎│ 🧸 .antisticker
‎│ 🚷 .antimention
‎│ 🗑️ .delete
‎│ 🔓 .open
‎│ 🔒 .close
‎│ ♻️ .resetlink
‎│ 📊 .gstatus
‎╰───────────────≻
‎
‎⚡ 『 𝗔𝗨𝗧𝗢 』
‎╭───────────────≻
‎│ 👀 .autoseen
‎│ 💖 .autoreact
‎│ ⌨️ .autotyping
‎│ 🎙️ .autorecording
‎│ 📵 .anticall
‎│ 📖 .statusseen
‎╰───────────────≻
‎
‎🎵 『 𝗠𝗘𝗗𝗜𝗔 』
‎╭───────────────≻
‎│ ▶️ .play
‎│ 🎶 .song
‎│ 🎥 .video
‎│ 📘 .fb
‎│ 📸 .insta
‎│ 🎵 .tiktok
‎│ 📺 .ytmp4
‎│ 📌 .pinterest
‎╰───────────────≻
‎
‎🤖 『 𝗔𝗜 • 𝗧𝗢𝗢𝗟𝗦 』
‎╭───────────────≻
‎│ 💬 .gpt
‎│ 📡 .ping
‎╰───────────────≻
‎
‎✨ 『 𝗘𝗫𝗧𝗥𝗔 』
‎╭───────────────≻
‎│ 📦 .apk
‎│ 💥 .spam
‎│ 💻 .github
‎│ 🖼️ .image
‎│ 🧸 .sticker
‎│ 😀 .emojimix
‎│ 🎤 .vnote
‎│ 💾 .save
‎│ 🎉 .funmenu
‎│ 👥 .gmenu
‎│ 🎞️ .xvideo
‎│ 👑 .admin
‎│ 🎼 .lyrics
‎│ 🌍 .trt
‎│ 🌦️ .weather
‎│ 🆔 .checkid
‎│ 🗑️ .delete
‎│ 📢 .broadcast
‎│ 📂 .git
‎╰───────────────≻
‎

> *© MooN X • OWNER*
 
`;

        await message.conn.sendMessage(message.from, {
            image: {
                url: "https://files.catbox.moe/27rdgg.png"
            },
            caption: S7,
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
        });

    } catch (err) {
        console.error("❌ Menu error:", err);
        await message.conn.sendMessage(message.from, {
            S7: `❌ Error: ${err?.message || err}`,
        });
    }
});