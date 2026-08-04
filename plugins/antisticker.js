// plugins/antisticker.js
// Anti Sticker — auto-deletes any sticker posted in a group when enabled.
import { Module } from "../lib/plugins.js";
import { db } from "../lib/client.js";

const DEBUG = true;
const debug = (...args) => DEBUG && console.debug("[antisticker]", ...args);

function getBotNumberFromConn(conn) {
  const id = conn?.user?.id || conn?.user?.jid || conn?.user || null;
  if (!id) return "unknown";
  return String(id).split("@")[0];
}

function enabledKeyFor(groupJid) {
  return `antisticker:${groupJid}:enabled`;
}

function isStickerMessage(message) {
  try {
    if (message?.type === "stickerMessage") return true;
    const raw = message?.raw?.message || message?.mek?.message;
    if (raw?.stickerMessage) return true;
  } catch {
    /* ignore */
  }
  return false;
}

// ---------- Command handler ----------
Module({
  command: "antisticker",
  package: "owner",
  description: "Enable/disable auto-delete of stickers posted in this group.",
})(async (message, match) => {
  try {
    if (!(message.isFromMe || message.isfromMe)) {
      return message.send("_Only bot owner can use this command._");
    }
    if (!message.isGroup) {
      return message.send("❌ This command works only in groups.");
    }
    await message.loadGroupInfo?.();

    const botNumber = getBotNumberFromConn(message.conn);
    const groupJid = message.from;
    const raw = (match || "").trim().toLowerCase();
    const enabledKey = enabledKeyFor(groupJid);

    if (!raw) {
      const isEnabled = db.get(botNumber, enabledKey, false) === true;
      return message.send(
        `⚙️ AntiSticker for this group\n• Status: ${
          isEnabled ? "✅ ON" : "❌ OFF"
        }\n\nUsage:\n• .antisticker on\n• .antisticker off\n\nWhen ON, any sticker posted in this group will be automatically deleted.`
      );
    }

    if (raw === "on") {
      const already = db.get(botNumber, enabledKey, false) === true;
      if (already)
        return message.send("ℹ️ AntiSticker is already *ON* for this group.");
      db.setHot(botNumber, enabledKey, true);
      return message.send(
        "✅ AntiSticker has been *ENABLED*. Stickers in this group will now be auto-deleted.\n\n⚠️ Make sure the bot is a *group admin*, otherwise deletion will fail."
      );
    }

    if (raw === "off") {
      const currently = db.get(botNumber, enabledKey, false) === true;
      if (!currently)
        return message.send("ℹ️ AntiSticker is already *OFF* for this group.");
      db.setHot(botNumber, enabledKey, false);
      return message.send("✅ AntiSticker has been *DISABLED* for this group.");
    }

    return message.send("Usage:\n.antisticker on\n.antisticker off");
  } catch (err) {
    console.error("[antisticker][command] error", err);
    return message.send("❌ An error occurred while processing the command.");
  }
});

// ---------- Enforcement handler ----------
Module({
  on: "text",
  package: "group",
  description: "Auto-delete stickers posted in group",
})(async (message) => {
  try {
    if (!message || !message.isGroup) return;
    if (!isStickerMessage(message)) return;
    debug("sticker detected in", message.from);

    const botNumber = getBotNumberFromConn(message.conn);
    const groupJid = message.from;
    const enabledKey = enabledKeyFor(groupJid);

    const enabled = (() => {
      try {
        return db.get(botNumber, enabledKey, false) === true;
      } catch (e) {
        console.error("[antisticker] db.get failed", e);
        return false;
      }
    })();
    if (!enabled) return;

    try {
      await message.loadGroupInfo?.();
    } catch (e) {
      debug("loadGroupInfo failed", e?.message || e);
    }

    // don't delete admins'/owner's/bot's own stickers
    if (message.isAdmin || message.isFromMe || message.isfromMe) {
      debug("sender is admin/owner/bot -> ignoring");
      return;
    }

    if (!message.isBotAdmin) {
      debug("bot not admin -> cannot delete sticker");
      return;
    }

    try {
      await message.conn.sendMessage(message.from, { delete: message.key });
      debug("deleted sticker message in", groupJid);
    } catch (e) {
      console.error("[antisticker] failed to delete sticker", e?.message || e);
    }
  } catch (error) {
    console.error("[antisticker] enforcement error:", error);
  }
});
