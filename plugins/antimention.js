// plugins/antimention.js
// Anti Group Story Mention — auto-deletes the "story mention" notification
// that WhatsApp posts in a group when someone mentions the group in their
// Status/Story.
import { Module } from "../lib/plugins.js";
import { db } from "../lib/client.js";

const DEBUG = true;
const debug = (...args) => DEBUG && console.debug("[antimention]", ...args);

function getBotNumberFromConn(conn) {
  const id = conn?.user?.id || conn?.user?.jid || conn?.user || null;
  if (!id) return "unknown";
  return String(id).split("@")[0];
}

function enabledKeyFor(groupJid) {
  return `antimention:${groupJid}:enabled`;
}

// Detect a "group story/status mention" message across possible shapes.
function isGroupStatusMention(message) {
  try {
    if (message?.type === "groupStatusMentionMessage") return true;
    const raw = message?.raw?.message || message?.mek?.message;
    if (raw?.groupStatusMentionMessage) return true;
  } catch {
    /* ignore */
  }
  return false;
}

// ---------- Command handler ----------
Module({
  command: "antimention",
  package: "owner",
  description:
    "Enable/disable auto-delete of group story-mention notifications.",
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
        `⚙️ AntiMention for this group\n• Status: ${
          isEnabled ? "✅ ON" : "❌ OFF"
        }\n\nUsage:\n• .antimention on\n• .antimention off\n\nWhen ON, any "story mention" notification posted in this group will be automatically deleted.`
      );
    }

    if (raw === "on") {
      const already = db.get(botNumber, enabledKey, false) === true;
      if (already)
        return message.send("ℹ️ AntiMention is already *ON* for this group.");
      db.setHot(botNumber, enabledKey, true);
      return message.send(
        "✅ AntiMention has been *ENABLED*. Story mentions in this group will now be auto-deleted.\n\n⚠️ Make sure the bot is a *group admin*, otherwise deletion will fail."
      );
    }

    if (raw === "off") {
      const currently = db.get(botNumber, enabledKey, false) === true;
      if (!currently)
        return message.send("ℹ️ AntiMention is already *OFF* for this group.");
      db.setHot(botNumber, enabledKey, false);
      return message.send("✅ AntiMention has been *DISABLED* for this group.");
    }

    return message.send("Usage:\n.antimention on\n.antimention off");
  } catch (err) {
    console.error("[antimention][command] error", err);
    return message.send("❌ An error occurred while processing the command.");
  }
});

// ---------- Enforcement handler ----------
Module({
  on: "text",
  package: "group",
  description: "Auto-delete group story-mention notifications",
})(async (message) => {
  try {
    if (!message || !message.isGroup) return;

    if (!isGroupStatusMention(message)) return;
    debug("group story mention detected in", message.from);

    const botNumber = getBotNumberFromConn(message.conn);
    const groupJid = message.from;
    const enabledKey = enabledKeyFor(groupJid);

    const enabled = (() => {
      try {
        return db.get(botNumber, enabledKey, false) === true;
      } catch (e) {
        console.error("[antimention] db.get failed", e);
        return false;
      }
    })();
    if (!enabled) return;

    try {
      await message.loadGroupInfo?.();
    } catch (e) {
      debug("loadGroupInfo failed", e?.message || e);
    }

    if (!message.isBotAdmin) {
      debug("bot not admin -> cannot delete story mention");
      return;
    }

    try {
      await message.conn.sendMessage(message.from, { delete: message.key });
      debug("deleted story mention message in", groupJid);
    } catch (e) {
      console.error("[antimention] failed to delete story mention", e?.message || e);
    }
  } catch (error) {
    console.error("[antimention] enforcement error:", error);
  }
});
