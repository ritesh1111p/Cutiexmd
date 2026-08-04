import { Module } from "../lib/plugins.js";

Module({
  command: "ping",
  package: "mics",
  description: "Replies with the bot latency",
})(async (message) => {
  const start = Date.now();
  // Contact-style quote
  let gift = {
    key: {
      fromMe: false,
      participant: `0@s.whatsapp.net`,
      remoteJid: "status@broadcast",
    },
    message: {
      contactMessage: {
        displayName: "© MooN-X • OWNER",
        vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;a,;;;\nFN:'DEMON'\nitem1.TEL;waid=${
          message.conn.user.id.split("@")[0]
        }:${
          message.conn.user.id.split("@")[0]
        }\nitem1.X-ABLabel:Ponsel\nEND:VCARD`,
      },
    },
  };
  const emojis = [
    "⛅",
    "👻",
    "⛄",
    "👀",
    "🪁",
    "🪃",
    "🎳",
    "🎀",
    "🌸",
    "🍥",
    "🎀",
    "🍓",
    "🍡",
    "💗",
    "🦋",
    "💫",
    "💀",
    "☁️",
    "🌨️",
    "🌧️",
    "🌦️",
    "🌥️",
    "⛅",
    "🪹",
    "⚡",
    "🌟",
    "☁️",
    "🎐",
    "🏖️",
    "🎐",
    "🪺",
    "🌊",
    "🐚",
    "🪸",
    "🍒",
    "🍇",
    "🍉",
    "🌻",
    "🎢",
    "🚀",
    "🍫",
    "💎",
    "🌋",
    "🏔️",
    "⛰️",
    "🌙",
    "🪐",
    "🌲",
    "🍃",
    "🍂",
    "🍁",
    "🪵",
    "🍄",
    "🌿",
    "🐞",
    "🐍",
    "🕊️",
    "🎃",
    "🏟️",
    "🎡",
    "🥂",
    "🗿",
    "⛩️",
  ];
const emoji = emojis[Math.floor(Math.random() * emojis.length)];
await message.react(emoji);

// 🔥 Step 1: Send Pining
await message.conn.sendMessage(
  message.from,
  {
    text: `*╰┉⋗ 𖥂 𝕻𝖎𝖓𝖌🦋🎀*`,
    contextInfo: {
      mentionedJid: [message.sender],
    },
  },
  { quoted: gift }
);

// 🔥 Small delay (optional smooth feel)
await new Promise((resolve) => setTimeout(resolve, 200));

// 🔥 Step 2: Calculate latency
const latency = Date.now() - start;

// 🔥 Step 3: Send Pong
await message.conn.sendMessage(
  message.from,
  {
    text: `> *╰➤ 𝕻๏፝֟𝖓𝖌 ${latency} 𝖒𝖘°🧿🎀 𓂃‹𝟹*`,
    contextInfo: {
      mentionedJid: [message.sender],
      forwardingScore: 5,
      isForwarded: false,
    },
  },
  { quoted: gift }
);
});
