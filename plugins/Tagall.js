import { Module } from "../lib/plugins.js";
import { getTheme } from "../Themes/themes.js";
const theme = getTheme();
Module({
  command: "tagall",
  package: "group",
  description: "Tag all group members with custom style",
})(async (m, text) => {
  if (!m.isGroup) return m.send(theme.isGroup);
  await m.loadGroupInfo();
  try {
    const conn = m.conn;
    const from = m.from;
    const groupMetadata = await conn.groupMetadata(from);
    const participants = groupMetadata.participants;
    const groupName = groupMetadata.subject || "Unknown Group";
    let totalMembers = participants ? participants.length : 0;
    if (totalMembers === 0)
      return m.sendreply("❌ No members found in this group.");
    const msgText = text?.trim() || "*ᴀᴛᴛᴇɴᴛɪᴏɴ ᴇᴠᴇʀʏᴏɴᴇ*";
    const emojis = [
      "⚡",
      "✨",
      "🎖️",
      "💎",
      "🔱",
      "💗",
      "❤‍🩹",
      "👻",
      "🌟",
      "🪄",
      "🎋",
      "🪼",
      "🍿",
      "👀",
      "👑",
      "🦋",
      "🐋",
      "🌻",
      "🌸",
      "🔥",
      "🍉",
      "🍧",
      "🍨",
      "🍦",
      "🧃",
      "🪀",
      "🎾",
      "🪇",
      "🎲",
      "🎡",
      "🧸",
      "🎀",
      "🎈",
      "🩵",
      "♥️",
      "🚩",
      "🏳️‍🌈",
      "🏖️",
      "🔪",
      "🎏",
      "🫐",
      "🍓",
      "💋",
      "🍄",
      "🎐",
      "🍇",
      "🐍",
      "🪻",
      "🪸",
      "💀",
    ];
    const getEmoji = () => emojis[Math.floor(Math.random() * emojis.length)];
    // Separate admins and non-admins
    const admins = participants.filter(
      (p) => p.admin === "admin" || p.admin === "superadmin"
    );
    const others = participants.filter((p) => !admins.includes(p));
    let tagText = `*▢ ɢʀᴏᴜᴘ : ${groupName}*\n*▢ ᴍᴇᴍʙᴇʀꜱ : ${totalMembers}*\n*▢ ᴍᴇꜱꜱᴀɢᴇ : ${msgText}*\n\n╭┈─[  *ʜɪ ᴀʟʟ ꜰʀɪᴇɴᴅꜱ* ]┈❍\n`;
 
    for (const p of others) {
      tagText += `│${getEmoji()} ᩧ𝆺ྀི𝅥 @${p.id.split("@")[0]}\n`;
    }
    tagText += `╰────────────❍`;
    const mentions = participants.map((p) => p.id);
    await conn.sendMessage(
      from,
      {
        text: tagText,
        mentions,
      },
      { quoted: m.raw }
    );
  } catch (err) {
    console.error("tagall error:", err);
    m.sendreply("❌ An error occurred while tagging members.");
  }
});

Module({
  command: "admin",
  package: "group",
  description: "Tag all group admins",
})(async (m, text) => {
  await m.loadGroupInfo(m.from);
  if (!m.isGroup) return m.send(theme.isGroup);

  try {
    const conn = m.conn;
    const from = m.from;
    const groupMetadata = await conn.groupMetadata(from);
    const participants = groupMetadata.participants;
    const groupName = groupMetadata.subject || "Unknown Group";

    // Filter only admins and super admins
    const admins = participants.filter(
      (p) => p.admin === "admin" || p.admin === "superadmin"
    );
    const totalAdmins = admins.length;

    if (totalAdmins === 0) {
      return await m.sendReply("❌ No admins found in this group.");
    }

    const msgText = text?.trim() || "*ᴀᴛᴛᴇɴᴛɪᴏɴ ᴀᴅᴍɪɴꜱ*";

    const emojis = [
      "⚡",
      "✨",
      "🎖️",
      "💎",
      "🔱",
      "💗",
      "❤‍🩹",
      "👻",
      "🌟",
      "🪄",
      "🎋",
      "🪼",
      "🍿",
      "👀",
      "👑",
      "🦋",
      "🐋",
      "🌻",
      "🌸",
      "🔥",
      "🍉",
      "🍧",
      "🍨",
      "🍦",
      "🧃",
      "�",
      "🎾",
      "🪇",
      "🎲",
      "🎡",
      "🧸",
      "🎀",
      "🎈",
      "🩵",
      "♥️",
      "🚩",
      "🏳️‍🌈",
      "🏖️",
      "🔪",
      "🎏",
      "🫐",
      "🍓",
      "💋",
      "🍄",
      "🎐",
      "🍇",
      "🐍",
      "🪻",
      "🪸",
      "💀",
    ];

    const getEmoji = () => emojis[Math.floor(Math.random() * emojis.length)];

    let tagText = `*▢ ɢʀᴏᴜᴘ : ${groupName}*\n*▢ ᴀᴅᴍɪɴꜱ : ${totalAdmins}*\n*▢ ᴍᴇꜱꜱᴀɢᴇ : ${msgText}*\n\n╭┈─[ *ʜᴇʟʟᴏ ᴀʟʟ ᴀᴅᴍɪɴꜱ*  ]┈❍\n`;

    for (const admin of admins) {
      const role = admin.admin === "superadmin" ? "🌟" : "👮";
      tagText += `│${getEmoji()} @${admin.id.split("@")[0]}\n`;
    }

    tagText += "╰────────────❍";

    const mentions = admins.map((a) => a.id);

    await conn.sendMessage(
      from,
      {
        text: tagText,
        mentions,
      },
      { quoted: m.raw }
    );
  } catch (err) {
    console.error("admin tag error:", err);
    await m.sendReply("❌ An error occurred while tagging admins.");
  }
});

Module({
  command: "rtag",
  package: "group",
  description: "Tag random members",
})(async (m, text) => {
  if (!m.isGroup) return m.send(theme.isGroup);

  await m.loadGroupInfo();

  try {
    const count = parseInt(text) || 5;
    const participants = m.groupParticipants;

    // Shuffle and pick random members
    const shuffled = participants.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(count, participants.length));

    let tagText = `🎲 *Random ${count} Members*\n\n`;
    const mentions = [];

    for (const p of selected) {
      tagText += `✨ @${p.id.split("@")[0]}\n`;
      mentions.push(p.id);
    }

    await m.send({ text: tagText, mentions });
  } catch (err) {
    await m.reply("❌ Error: " + err.message);
  }
});

Module({
  command: "hidetag",
  package: "group",
  description: "Tag all without showing names",
})(async (m, text) => {
  if (!m.isGroup) return m.send(theme.isGroup);

  await m.loadGroupInfo();

  if (!m.isAdmin && !m.isFromMe) return m.send(theme.isAdmin);

  try {
    const message = text || "*- ʜᴇʏ 🙂*";
    const mentions = m.groupParticipants.map((p) => p.id);

    await m.send({ text: message, mentions });
    await m.react("👻");
  } catch (err) {
    await m.reply("❌ Error: " + err.message);
  }
});
