// plugins/antilink.js
import { Module } from "../lib/plugins.js";
import { db } from "../lib/client.js";

const DEBUG = true;
const debug = (...args) => DEBUG && console.debug("[antilink]", ...args);

// regex (unchanged from your version)
const LINK_REGEX =
  /(?:https?:\/\/[^\s]+)|(?:chat\.whatsapp\.com\/[A-Za-z0-9_-]+)|(?:wa\.me\/[0-9]+)|(?:t\.me\/[A-Za-z0-9_\-]+)|(?:telegram\.me\/[A-Za-z0-9_\-]+)|(?:discord\.gg\/[A-Za-z0-9_\-]+)|(?:bit\.ly\/[A-Za-z0-9_\-]+)|(?:tinyurl\.com\/[A-Za-z0-9_\-]+)|\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|gg|xyz|me|app|online|site|link)\b/gi;

// Utility: safely get the bot JID/number from message.conn (works across different libs)
function getBotNumberFromConn(conn) {
  // many libraries use conn.user?.id like '12345@s.whatsapp.net'
  const id = conn?.user?.id || conn?.user?.jid || conn?.user || null;
  if (!id) return "unknown";
  return String(id).split("@")[0];
}

// Helper to form DB keys (so we don't mix group/session)
function enabledKeyFor(groupJid) {
  return `antilink:${groupJid}:enabled`;
}
function modeKeyFor(groupJid) {
  return `antilink:${groupJid}:mode`;
}

// ---------- Command handler ----------
Module({
  command: "antilink",
  package: "owner",
  description:
    "Enable/disable anti-link for this group or set mode (kick/null/warn). Default mode: kick",
})(async (message, match) => {
  try {
    // owner-only guard (normalize property name)
    if (!(message.isFromMe || message.isfromMe)) {
      return message.send("_Only bot owner can use this command._");
    }
    if (!message.isGroup)
      return message.send("❌ This command works only in groups.");
    await message.loadGroupInfo?.();

    const botNumber = getBotNumberFromConn(message.conn);
    const groupJid = message.from;
    const raw = (match || "").trim().toLowerCase();

    const enabledKey = enabledKeyFor(groupJid);
    const modeKey = modeKeyFor(groupJid);

    // Show status
    if (!raw) {
      const isEnabled = db.get(botNumber, enabledKey, false) === true;
      const mode = String(
        db.get(botNumber, modeKey, "kick") || "kick"
      ).toLowerCase();
      return message.send(
        `⚙️ AntiLink for this group\n• Status: ${
          isEnabled ? "✅ ON" : "❌ OFF"
        }\n• Mode: ${mode.toUpperCase()}\n\nUsage:\n• .antilink on\n• .antilink off\n• .antilink kick\n• .antilink delete\n• .antilink null\n• .antilink warn`
      );
    }

    // ON
    if (raw === "on") {
      const already = db.get(botNumber, enabledKey, false) === true;
      if (already)
        return message.send(`ℹ️ AntiLink is already *ON* for this group.`);
      db.setHot(botNumber, enabledKey, true);
      let hasMode = db.get(botNumber, modeKey, null);
      if (hasMode === null || typeof hasMode === "undefined") {
        hasMode = "kick";
        db.setHot(botNumber, modeKey, hasMode);
      }
      return message.send(
        `✅ AntiLink has been *ENABLED* for this group. Default action: *${hasMode.toUpperCase()}*`
      );
    }

    // OFF
    if (raw === "off") {
      const currently = db.get(botNumber, enabledKey, false) === true;
      if (!currently)
        return message.send("ℹ️ AntiLink is already *OFF* for this group.");
      db.setHot(botNumber, enabledKey, false);
      return message.send("✅ AntiLink has been *DISABLED* for this group.");
    }

    // Set mode
    if (
      raw === "kick" ||
      raw === "null" ||
      raw === "warn" ||
      raw === "delete" ||
      raw === "remove"
    ) {
      const normalized = raw === "remove" ? "kick" : raw; // 'remove' -> 'kick' behavior
      db.setHot(botNumber, modeKey, normalized);
      // if mode is set but feature is off, enable it automatically (convenience)
      const isEnabled = db.get(botNumber, enabledKey, false) === true;
      if (!isEnabled) {
        db.setHot(botNumber, enabledKey, true);
        return message.send(
          `✅ AntiLink mode set to *${normalized.toUpperCase()}* and AntiLink has been automatically *ENABLED* for this group.`
        );
      }
      return message.send(
        `✅ AntiLink mode updated to *${normalized.toUpperCase()}* for this group.`
      );
    }

    // unknown arg
    return message.send(
      "Usage:\n.antilink on\n.antilink off\n.antilink kick\n.antilink null\n.antilink warn"
    );
  } catch (err) {
    console.error("[antilink][command] error", err);
    return message.send("❌ An error occurred while processing the command.");
  }
});

// ---------- Enforcement handler ----------
Module({
  on: "text",
  package: "group",
  description: "Enforce anti-link policy in groups",
})(async (message) => {
  try {
    if (!message || !message.isGroup) return;
    const body = (message.body || "").toString();
    if (!body) return;

    const botNumber = getBotNumberFromConn(message.conn);
    const groupJid = message.from;

    const enabledKey = enabledKeyFor(groupJid);
    const modeKey = modeKeyFor(groupJid);

    // Strict boolean check: require enabled === true
    const enabled = (() => {
      try {
        return db.get(botNumber, enabledKey, false) === true;
      } catch (e) {
        console.error("[antilink] db.get failed", e);
        return false;
      }
    })();
    debug("enabled=", enabled);
    if (!enabled) return; // feature disabled -> do nothing

    // check roles & protections
    try {
      await message.loadGroupInfo?.();
    } catch (e) {
      debug("loadGroupInfo failed", e?.message || e);
    }

    const botIsAdmin = !!message.isBotAdmin;
    const senderIsAdmin = !!message.isAdmin;
    const senderIsOwnerOrFromMe = !!(message.isFromMe || message.isfromMe);

    if (!botIsAdmin) {
      debug("bot not admin -> cannot enforce");
      return;
    }
    if (senderIsAdmin || senderIsOwnerOrFromMe) {
      debug("sender is admin/owner/bot -> ignoring");
      return;
    }

    const matches = body.match(LINK_REGEX);
    if (!matches || matches.length === 0) return;
    debug("links detected", matches);

    // determine mode
    let mode = "kick";
    try {
      mode = String(db.get(botNumber, modeKey, "kick") || "kick").toLowerCase();
    } catch (e) {
      debug("error reading mode, defaulting to kick", e?.message || e);
      mode = "kick";
    }
    debug("mode=", mode);

    // Delete the offending message
    try {
      await message.conn.sendMessage(message.from, { delete: message.key }).catch(() => {});
    } catch (e) {
      debug("delete attempt threw", e?.message || e);
    }

    const senderJid =
      message.sender || message.key?.participant || message.key?.from || null;
    const senderNum = senderJid ? String(senderJid).split("@")[0] : "unknown";

    // Delete mode: already deleted above, just notify
    if (mode === "delete") {
      try {
        await message.send?.(`⚠️ Link removed from @${senderNum}`, { mentions: senderJid ? [senderJid] : [] });
      } catch {}
      return;
    }

    // Null / remove_link: notify only
    if (mode === "null" || mode === "remove_link") {
      try {
        await message.send?.(`⚠️ Link removed from @${senderNum}`, {
          mentions: senderJid ? [senderJid] : [],
        });
        debug("notified group about removal (mode=null)");
      } catch (e) {
        debug("notify failed", e?.message || e);
      }
      return;
    }

    if (mode === "warn") {
      try {
        await message.send?.(
          `⚠️ @${senderNum}, posting links is not allowed here. This is a warning.`,
          { mentions: senderJid ? [senderJid] : [] }
        );
        debug("warned user", senderNum);
      } catch (e) {
        debug("warn failed", e?.message || e);
      }
      return;
    }

    // kick/remove
    if (mode === "kick" || mode === "remove") {
      try {
        await message.send?.(
          `🚫 @${senderNum} posted a prohibited link and will be removed from the group.`,
          { mentions: senderJid ? [senderJid] : [] }
        );
      } catch (e) {
        debug("notice failed", e?.message || e);
      }

      // short delay so the notice is delivered before removal
      await new Promise((r) => setTimeout(r, 600));

      try {
        if (typeof message.removeParticipant === "function") {
          await message.removeParticipant([senderJid]);
          debug("removeParticipant succeeded for", senderJid);
        } else if (
          message.conn &&
          typeof message.conn.groupParticipantsUpdate === "function"
        ) {
          await message.conn.groupParticipantsUpdate(
            message.from,
            [senderJid],
            "remove"
          );
          debug("groupParticipantsUpdate succeeded for", senderJid);
        } else {
          throw new Error("no supported remove function");
        }
      } catch (err) {
        console.error("[antilink] failed to remove participant", err);
        try {
          await message.send?.(
            `❌ Failed to remove @${senderNum}. Please remove them manually.`,
            { mentions: senderJid ? [senderJid] : [] }
          );
        } catch (e) {
          debug("notify admin manual removal failed", e?.message || e);
        }
      }
      return;
    }

    debug("unknown mode (no action)", mode);
  } catch (error) {
    console.error("[antilink] enforcement error:", error);
  }
});
