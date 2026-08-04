import { Module } from '../lib/plugins.js';

Module({
  command: "pair",
  package: "main",
  description: "Instruct user to pair via Telegram Bot with fixed image",
})(async (message, match) => {
  try {
    const _cmd_st = `*ʜᴇʏ* 

*ᴘᴀɪʀ ʏᴏᴜʀ ɴᴜᴍʙᴇʀ ᴠɪᴀ ᴛᴇʟᴇɢʀᴀᴍ ʙᴏᴛ.* 

*ʙᴏᴛ ʟɪɴᴋ -  https://t.me/cutie_mdbot*

*Owner - https://t.me/moon_x_2006*`.trim();

    const opts = {
      image: { url: "https://files.catbox.moe/p473t1.jpg" },
      caption: _cmd_st,
      mimetype: "image/jpeg",
      contextInfo: {
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: "1120363410247214508@newsletter",
          newsletterName: "ᴄᴜᴛɪᴇ - ǫᴜᴇᴇɴ ᴍᴅ",
          serverMessageId: 6,
        },
      },
    };

    await message.conn.sendMessage(message.from, opts);
  } catch (err) {
    console.error("❌ Pair command error:", err);
    await message.conn.sendMessage(message.from, {
      text: `❌ Error: ${err?.message || err}`,
    });
  }
});
