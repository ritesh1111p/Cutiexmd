// plugins/antibot.js

import { Module } from "../lib/plugins.js";
import { db } from "../lib/client.js";

const DEBUG = true;

const debug = (...args) =>
  DEBUG && console.debug("[antibot]", ...args);

// ======================
// HELPERS
// ======================

function getBotNumberFromConn(conn) {
  const id =
    conn?.user?.id ||
    conn?.user?.jid ||
    conn?.user ||
    null;

  if (!id) return "unknown";

  return String(id).split("@")[0];
}

function enabledKeyFor(groupJid) {
  return `antibot:${groupJid}:enabled`;
}

function modeKeyFor(groupJid) {
  return `antibot:${groupJid}:mode`;
}

function warnKeyFor(groupJid, userJid) {
  return `antibot:${groupJid}:warn:${userJid}`;
}

// ======================
// COMMAND HANDLER
// ======================

Module({
  command: "antibot",
  package: "group",
  description: "Enable/Disable AntiBot system",
})(async (message, match) => {

  try {

    // OWNER ONLY
    if (!(message.isFromMe || message.isfromMe)) {
      return message.send(
        "_Only bot owner can use this command._"
      );
    }

    // GROUP ONLY
    if (!message.isGroup) {
      return message.send(
        "❌ This command only works in groups."
      );
    }

    await message.loadGroupInfo?.();

    const botNumber =
      getBotNumberFromConn(
        message.conn
      );

    const groupJid =
      message.from;

    const raw =
      (match || "")
        .trim()
        .toLowerCase();

    const enabledKey =
      enabledKeyFor(groupJid);

    const modeKey =
      modeKeyFor(groupJid);

    // ======================
    // STATUS
    // ======================

    if (!raw) {

      const enabled =
        db.get(
          botNumber,
          enabledKey,
          false
        ) === true;

      const mode = String(
        db.get(
          botNumber,
          modeKey,
          "kick"
        ) || "kick"
      ).toUpperCase();

      return message.send(
`🤖 ANTIBOT SETTINGS

• Status : ${enabled ? "✅ ON" : "❌ OFF"}
• Mode   : ${mode}

Usage:
.antibot on
.antibot off
.antibot kick
.antibot warn
.antibot delete
.antibot null`
      );
    }

    // ======================
    // ENABLE
    // ======================

    if (raw === "on") {

      const already =
        db.get(
          botNumber,
          enabledKey,
          false
        ) === true;

      if (already) {
        return message.send(
          "ℹ️ AntiBot already enabled."
        );
      }

      db.setHot(
        botNumber,
        enabledKey,
        true
      );

      let mode =
        db.get(
          botNumber,
          modeKey,
          null
        );

      if (!mode) {

        mode = "kick";

        db.setHot(
          botNumber,
          modeKey,
          mode
        );
      }

      return message.send(
`✅ AntiBot enabled

⚙️ Mode: ${mode.toUpperCase()}`
      );
    }

    // ======================
    // DISABLE
    // ======================

    if (raw === "off") {

      const enabled =
        db.get(
          botNumber,
          enabledKey,
          false
        ) === true;

      if (!enabled) {
        return message.send(
          "ℹ️ AntiBot already disabled."
        );
      }

      db.setHot(
        botNumber,
        enabledKey,
        false
      );

      return message.send(
        "✅ AntiBot disabled."
      );
    }

    // ======================
    // MODES
    // ======================

    if (
      raw === "kick" ||
      raw === "warn" ||
      raw === "delete" ||
      raw === "null" ||
      raw === "remove"
    ) {

      const normalized =
        raw === "remove"
          ? "kick"
          : raw;

      db.setHot(
        botNumber,
        modeKey,
        normalized
      );

      const enabled =
        db.get(
          botNumber,
          enabledKey,
          false
        ) === true;

      if (!enabled) {

        db.setHot(
          botNumber,
          enabledKey,
          true
        );
      }

      return message.send(
`✅ AntiBot has been enabled

⚙️ Mode: ${normalized.toUpperCase()}`
      );
    }

    // ======================
    // INVALID
    // ======================

    return message.send(
`Usage:
.antibot on
.antibot off
.antibot kick
.antibot warn
.antibot delete
.antibot null`
    );

  } catch (err) {

    console.error(
      "[antibot][command]",
      err
    );

    return message.send(
      "❌ Error while processing command."
    );
  }
});

// ======================
// ENFORCEMENT SYSTEM
// ======================

Module({
  on: "text",
  package: "group",
  description:
    "AntiBot protection system",
})(async (message) => {

  try {

    // ======================
    // BASIC CHECK
    // ======================

    if (!message || !message.isGroup) return;

    const body =
      (message.body || "").toString();

    if (!body) return;

    const botNumber =
      getBotNumberFromConn(
        message.conn
      );

    const groupJid =
      message.from;

    const enabledKey =
      enabledKeyFor(groupJid);

    const modeKey =
      modeKeyFor(groupJid);

    // ======================
    // ENABLE CHECK
    // ======================

    const enabled =
      db.get(
        botNumber,
        enabledKey,
        false
      ) === true;

    if (!enabled) return;

    // ======================
    // LOAD GROUP INFO
    // ======================

    try {
      await message.loadGroupInfo?.();
    } catch {}

    const botIsAdmin =
      !!message.isBotAdmin;

    const senderIsAdmin =
      !!message.isAdmin;

    const senderIsOwner =
      !!(
        message.isFromMe ||
        message.isfromMe
      );

    // ======================
    // ADMIN CHECK
    // ======================

    if (!botIsAdmin) {
      debug("Bot is not admin");
      return;
    }

    // Ignore admins/owner
    if (
      senderIsAdmin ||
      senderIsOwner
    ) {
      debug("Admin/Owner ignored");
      return;
    }

    // ======================
    // DETECT BOT
    // ======================

    const msgId =
      message.key?.id || "";

    const sender =
      message.sender ||
      message.key?.participant ||
      "";

    const isBot =
      msgId.startsWith("BAE5") ||
      msgId.startsWith("3EB0");

    if (!isBot) return;

    // ======================
    // READ MODE
    // ======================

    let mode = "kick";

    try {

      mode = String(
        db.get(
          botNumber,
          modeKey,
          "kick"
        ) || "kick"
      ).toLowerCase();

    } catch {}

    // ======================
    // DETECT LOG
    // ======================

    console.log(`
╭━━━〔 ANTIBOT DETECTED 〕━━━⬣
┃ 👤 Sender : ${sender}
┃ 🆔 MsgID  : ${msgId}
┃ ⚙️ Mode   : ${mode}
╰━━━━━━━━━━━━━━━━━━⬣
`);

    // ======================
    // DELETE MESSAGE
    // ======================

    try {

      if (
        message.client &&
        typeof message.client.sendMessage ===
        "function"
      ) {

        await message.client.sendMessage(
          message.from,
          {
            delete: message.key
          }
        );

      } else if (
        message.conn &&
        typeof message.conn.sendMessage ===
        "function"
      ) {

        await message.conn.sendMessage(
          message.from,
          {
            delete: message.key
          }
        );
      }

    } catch (e) {

      debug(
        "Delete failed",
        e?.message
      );
    }

    const senderNum =
      sender.split("@")[0];

    // ======================
    // DELETE MODE (SILENT)
    // ======================

    if (mode === "delete") {

      console.log(`
╭━━━〔 ANTIBOT DELETE SUCCESS 〕━━━⬣
┃ 👤 User : ${sender}
╰━━━━━━━━━━━━━━━━━━━━━━⬣
`);

      return;
    }

    // ======================
    // NULL MODE (SILENT)
    // ======================

    if (mode === "null") {

      console.log(`
╭━━━〔 ANTIBOT NULL DETECT 〕━━━⬣
┃ 👤 User : ${sender}
╰━━━━━━━━━━━━━━━━━━━━⬣
`);

      return;
    }

    // ======================
    // WARN MODE
    // ======================

    if (mode === "warn") {

      const warnKey =
        warnKeyFor(groupJid, sender);

      let warns = 0;

      try {

        warns = Number(
          db.get(
            botNumber,
            warnKey,
            0
          )
        ) || 0;

      } catch {}

      warns += 1;

      // SAVE WARN
      db.setHot(
        botNumber,
        warnKey,
        warns
      );

      // WARN LOG
      console.log(`
╭━━━〔 ANTIBOT WARN 〕━━━⬣
┃ 👤 User  : ${sender}
┃ ⚠️ Warns : ${warns}/3
╰━━━━━━━━━━━━━━━━━━⬣
`);

      // ======================
      // AUTO REMOVE
      // ======================

      if (warns >= 3) {

        await new Promise((r) =>
          setTimeout(r, 800)
        );

        try {

          if (
            typeof message.removeParticipant ===
            "function"
          ) {

            await message.removeParticipant([
              sender
            ]);

          } else if (
            message.client &&
            typeof message.client
              .groupParticipantsUpdate ===
              "function"
          ) {

            await message.client
              .groupParticipantsUpdate(
                message.from,
                [sender],
                "remove"
              );

          } else if (
            message.conn &&
            typeof message.conn
              .groupParticipantsUpdate ===
              "function"
          ) {

            await message.conn
              .groupParticipantsUpdate(
                message.from,
                [sender],
                "remove"
              );
          }

          // RESET WARN
          db.setHot(
            botNumber,
            warnKey,
            0
          );

          console.log(`
╭━━━〔 ANTIBOT AUTO KICK 〕━━━⬣
┃ 👤 User : ${sender}
┃ ⚠️ Warns: ${warns}/3
╰━━━━━━━━━━━━━━━━━━━━⬣
`);

        } catch (err) {

          console.error(`
╭━━━〔 ANTIBOT WARN REMOVE FAILED 〕━━━⬣
┃ 👤 User : ${sender}
┃ ❌ Error: ${err.message}
╰━━━━━━━━━━━━━━━━━━━━━━━━⬣
`);
        }

        return;
      }

      // WARNING MESSAGE

      try {

        await message.send(
`⚠️ AntiBot Detected

👤 User: @${senderNum}
📌 Warn: ${warns}/3`,
          {
            mentions: [sender]
          }
        );

      } catch {}

      return;
    }

    // ======================
    // KICK MODE (SILENT)
    // ======================

    if (
      mode === "kick" ||
      mode === "remove"
    ) {

      await new Promise((r) =>
        setTimeout(r, 800)
      );

      try {

        if (
          typeof message.removeParticipant ===
          "function"
        ) {

          await message.removeParticipant([
            sender
          ]);

        } else if (
          message.client &&
          typeof message.client
            .groupParticipantsUpdate ===
            "function"
        ) {

          await message.client
            .groupParticipantsUpdate(
              message.from,
              [sender],
              "remove"
            );

        } else if (
          message.conn &&
          typeof message.conn
            .groupParticipantsUpdate ===
            "function"
        ) {

          await message.conn
            .groupParticipantsUpdate(
              message.from,
              [sender],
              "remove"
            );
        }

        console.log(`
╭━━━〔 ANTIBOT KICK SUCCESS 〕━━━⬣
┃ 👤 User : ${sender}
╰━━━━━━━━━━━━━━━━━━━━⬣
`);

      } catch (err) {

        console.error(`
╭━━━〔 ANTIBOT REMOVE FAILED 〕━━━⬣
┃ 👤 User : ${sender}
┃ ❌ Error : ${err.message}
╰━━━━━━━━━━━━━━━━━━━━━━⬣
`);
      }

      return;
    }

  } catch (error) {

    console.error(
      "[antibot] enforcement error:",
      error
    );
  }
});