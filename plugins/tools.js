import { Module } from "../lib/plugins.js";
// old personalDB removed
import config from "../config.js";
import { getTheme } from "../Themes/themes.js";
// <-- IMPORT YOUR DB INSTANCE HERE (adjust path if needed)
import { db } from "../lib/client.js";

const theme = getTheme();

// helper to resolve bot number safely
function resolveBotNumber(conn) {
  // Always return clean phone number (no @s.whatsapp.net, no :xx device suffix)
  // This must match sessionId used in client.js DB operations
  if (!conn) return null;
  const raw =
    conn.user?.id || // "919832962298:0@s.whatsapp.net"
    conn.id ||
    conn.user ||
    null;
  if (!raw) return null;
  return String(raw).split("@")[0].split(":")[0].replace(/[^0-9]/g, "") || null;
}

// 🔹 Auto Status Seen
Module({
  command: "autostatus",
  package: "owner",
  description: "Toggle auto view WhatsApp status",
})(async (message, match) => {
  if (!message.isfromMe) return message.send(theme.isfromMe);
  const botNumber = resolveBotNumber(message.conn);
  if (!botNumber) return message.send("❌ Bot number not found.");
  
  const input = match?.trim().toLowerCase();
  
  const key = "autostatus_seen"; // hot-key name used in handler
  
  if (input === "on" || input === "off") {
    await message.react("⏳");
    try {
      if (input === "on") db.setHot(botNumber, key, true);
      else db.delHot(botNumber, key);
      await message.react("✅");
      return await message.send(
        `✅ *Auto status view is now \`${input.toUpperCase()}\`*`
      );
    } catch (e) {
      await message.react("❌");
      return await message.send("❌ *Error updating auto status view*");
    }
  }
  
  const status = db.get(botNumber, key, false) === true;
  return await message.send(
    `⚙️ *Auto Status View*\n> Status: ${
      status ? "✅ ON" : "❌ OFF"
    }\n\nUse:\n• astatus on\n• astatus off`
  );
});

// 🔹 Auto Typing
Module({
  command: "autotyping",
  package: "owner",
  description: "Toggle auto typing in chats",
})(async (message, match) => {
  if (!message.isfromMe) return message.send(theme.isfromMe);
  const botNumber = resolveBotNumber(message.conn);
  if (!botNumber) return message.send("❌ Bot number not found.");
  
  const input = match?.trim().toLowerCase();
  const key = "autotyping";
  
  if (input === "on" || input === "off") {
    await message.react("⏳");
    try {
      if (input === "on") db.setHot(botNumber, key, true);
      else db.delHot(botNumber, key);
      await message.react("✅");
      return await message.send(
        `✅ *Auto typing is now \`${input.toUpperCase()}\`*`
      );
    } catch (e) {
      await message.react("❌");
      return await message.send("❌ *Error updating auto typing*");
    }
  }
  
  const status = db.get(botNumber, key, false) === true;
  return await message.send(
    `⚙️ *Auto Typing*\n> Status: ${
      status ? "✅ ON" : "❌ OFF"
    }\n\nUse:\n• autotyping on\n• autotyping off`
  );
});

// mode

Module({
  command: "mode",
  package: "owner",
  description: "Toggle bot mode (public / private)",
})(async (message, match) => {
  if (!message.isFromMe) return message.send(theme.isfromMe);

  const botNumber = resolveBotNumber(message.conn);
  if (!botNumber) return message.send("❌ Bot number not found.");

  const input = match?.trim().toLowerCase();
  const key = "mode"; // true = public, false = private

  if (input === "public" || input === "private") {
    await message.react("⏳");
    try {
      if (input === "public") {
        db.setHot(botNumber, key, true);
      } else {
        db.setHot(botNumber, key, false);
      }

      await message.react("✅");
      return message.send(`✅ *Bot mode set to* \`${input.toUpperCase()}\``);
    } catch (err) {
      await message.react("❌");
      return message.send("❌ *Failed to update bot mode*");
    }
  }

  const isPublic = db.get(botNumber, key, true) === true;

  return message.send(
    `⚙️ *Bot Mode*\n` +
      `> Status: ${isPublic ? "🌍 PUBLIC" : "🔒 PRIVATE"}\n\n` +
      `*Usage:*\n` +
      `• mode public\n` +
      `• mode private`
  );
});


// 🔹 Auto Recording
Module({
  command: "autorecord",
  package: "owner",
  description: "Toggle auto voice recording in chats",
})(async (message, match) => {
  if (!message.isfromMe) return message.send(theme.isfromMe);
  const botNumber = resolveBotNumber(message.conn);
  if (!botNumber) return message.send("❌ Bot number not found.");
  
  const input = match?.trim().toLowerCase();
  const key = "autorecord";
  
  if (input === "on" || input === "off") {
    await message.react("⏳");
    try {
      if (input === "on") db.setHot(botNumber, key, true);
      else db.delHot(botNumber, key);
      await message.react("✅");
      return await message.send(
        `✅ *Auto record is now \`${input.toUpperCase()}\`*`
      );
    } catch (e) {
      await message.react("❌");
      return await message.send("❌ *Error updating auto record*");
    }
  }
  
  const status = db.get(botNumber, key, false) === true;
  return await message.send(
    `🎤 *Auto Record*\n> Status: ${
      status ? "✅ ON" : "❌ OFF"
    }\n\nUse:\n• autorecord on\n• autorecord off`
  );
});

// 🔹 Auto React to Messages
Module({
  command: "autoreact",
  package: "owner",
  description: "Toggle auto react to messages",
})(async (message, match) => {
  if (!message.isfromMe) return message.send(theme.isfromMe);
  const botNumber = resolveBotNumber(message.conn);
  if (!botNumber) return message.send("❌ Bot number not found.");
  
  const input = match?.trim().toLowerCase();
  const key = "autoreact";
  
  if (input === "on" || input === "off") {
    await message.react("⏳");
    try {
      if (input === "on") db.setHot(botNumber, key, true);
      else db.delHot(botNumber, key);
      await message.react("✅");
      return await message.send(
        `✅ *AutoReact is now \`${input.toUpperCase()}\`*`
      );
    } catch (e) {
      await message.react("❌");
      return await message.send("❌ *Error updating AutoReact*");
    }
  }
  
  const status = db.get(botNumber, key, false) === true;
  return await message.send(
    `⚙️ *AutoReact*\n> Status: ${
      status ? "✅ ON" : "❌ OFF"
    }\n\nUse:\n• autoreact on\n• autoreact off`
  );
});

// 🔹 Anti Call
Module({
  command: "anticall",
  package: "owner",
  description: "Block users who call the bot",
})(async (message, match) => {
  if (!message.isfromMe) return message.send(theme.isfromMe);
  const botNumber = resolveBotNumber(message.conn);
  if (!botNumber) return message.send("❌ Bot number not found.");
  
  const input = match?.trim().toLowerCase();
  const key = "anticall";
  
  if (input === "on" || input === "off") {
    await message.react("⏳");
    try {
      if (input === "on") db.setHot(botNumber, key, true);
      else db.delHot(botNumber, key);
      await message.react("✅");
      return await message.send(
        `✅ *AntiCall is now \`${input.toUpperCase()}\`*`
      );
    } catch (e) {
      await message.react("❌");
      return await message.send("❌ *Error updating AntiCall*");
    }
  }
  
  const status = db.get(botNumber, key, false) === true;
  return await message.send(
    `⚙️ *AntiCall*\n> Status: ${
      status ? "✅ ON" : "❌ OFF"
    }\n\nUse:\n• anticall on\n• anticall off`
  );
});

// 🔹 Auto Read
Module({
  command: "autoread",
  package: "owner",
  description: "Toggle auto read messages",
})(async (message, match) => {
  if (!message.isfromMe) return message.send(theme.isfromMe);
  const botNumber = resolveBotNumber(message.conn);
  if (!botNumber) return message.send("❌ Bot number not found.");
  
  const input = match?.trim().toLowerCase();
  const key = "autoread";
  
  if (input === "on" || input === "off") {
    await message.react("⏳");
    try {
      if (input === "on") db.setHot(botNumber, key, true);
      else db.delHot(botNumber, key);
      await message.react("✅");
      return await message.send(
        `✅ *AutoRead is now \`${input.toUpperCase()}\`*`
      );
    } catch (e) {
      await message.react("❌");
      return await message.send("❌ *Error updating AutoRead*");
    }
  }
  
  const status = db.get(botNumber, key, false) === true;
  return await message.send(
    `⚙️ *AutoRead*\n> Status: ${
      status ? "✅ ON" : "❌ OFF"
    }\n\nUse:\n• autoread on\n• autoread off`
  );
});
/*
// 🔹 Save Status
Module({
  command: "savestatus",
  package: "owner",
  description: "Toggle auto save viewed statuses",
})(async (message, match) => {
  if (!message.isfromMe) return message.send(theme.isfromMe);
  const botNumber = resolveBotNumber(message.conn);
  if (!botNumber) return message.send("❌ Bot number not found.");

  const input = match?.trim().toLowerCase();
  const key = "save_status";

  if (input === "on" || input === "off") {
    await message.react("⏳");
    try {
      if (input === "on") db.setHot(botNumber, key, true);
      else db.delHot(botNumber, key);
      await message.react("✅");
      return await message.send(
        `✅ *AutoSave Status is now \`${input.toUpperCase()}\`*`
      );
    } catch (e) {
      await message.react("❌");
      return await message.send("❌ *Error updating AutoSave Status*");
    }
  }

  const status = db.get(botNumber, key, false) === true;
  return await message.send(
    `⚙️ *AutoSave Status*\n> Status: ${
      status ? "✅ ON" : "❌ OFF"
    }\n\nUse:\n• savestatus on\n• savestatus off`
  );
});
*/

// 🔹 Auto Status React
Module({
  command: "autostatusreact",
  package: "owner",
  aliases: ["statusreact"],
  description: "Toggle auto react to WhatsApp status",
})(async (message, match) => {
  if (!message.isfromMe) return message.send(theme.isfromMe);
  const botNumber = resolveBotNumber(message.conn);
  if (!botNumber) return message.send("❌ Bot number not found.");

  const input = match?.trim().toLowerCase();
  const key = "autostatus_react";

  if (input === "on" || input === "off") {
    await message.react("⏳");
    try {
      if (input === "on") db.setHot(botNumber, key, true);
      else db.delHot(botNumber, key);
      await message.react("✅");
      return await message.send(
        `✅ *Auto Status React is now \`${input.toUpperCase()}\`*`
      );
    } catch (e) {
      await message.react("❌");
      return await message.send("❌ *Error updating Auto Status React*");
    }
  }

  const status = db.get(botNumber, key, false) === true;
  return await message.send(
    `⚙️ *Auto Status React*\n> Status: ${
      status ? "✅ ON" : "❌ OFF"
    }\n\nUse:\n• autostatusreact on\n• autostatusreact off`
  );
});


