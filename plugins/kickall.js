// plugins/kickall.mjs
import { Module } from "../lib/plugins.js";

/**
 * Try to obtain group metadata from common properties/methods.
 * Returns null if not available.
 */
async function getGroupMetadata(message) {
  // If message already has metadata (some frameworks populate it)
  if (message.groupMetadata) return message.groupMetadata;

  // Try connection-level API: conn.groupMetadata(jid)
  try {
    if (typeof message.conn?.groupMetadata === "function") {
      const md = await message.conn.groupMetadata(message.from);
      if (md) return md;
    }
  } catch (e) {}

  // Try connection-level alternate API: conn.groupFetchAll()
  try {
    if (typeof message.conn?.groupFetchAll === "function") {
      const all = await message.conn.groupFetchAll();
      if (all) {
        // some libs return an object keyed by jid
        const found = Object.values(all).find(
          (g) => g?.id === message.from || g?.jid === message.from
        );
        if (found) return found;
      }
    }
  } catch (e) {}

  // As a last resort, if message.loadGroupInfo exists, call it and re-check
  try {
    if (typeof message.loadGroupInfo === "function") {
      await message.loadGroupInfo();
      if (message.groupMetadata) return message.groupMetadata;
    }
  } catch (e) {}

  return null;
}

/** Normalize participants to objects: { id, admin } */
function normalizeParticipants(md) {
  const raw = md?.participants || md?.participantsMap || [];
  // raw may be array or object; convert to array of entries
  const arr = Array.isArray(raw) ? raw : Object.values(raw || {});
  return arr
    .map((p) => {
      if (!p) return null;
      const id =
        p?.id ??
        p?.jid ??
        p?.participant ??
        (typeof p === "string" ? p : undefined);
      const admin =
        !!p?.admin || // boolean/admin flag
        !!p?.isAdmin ||
        p?.role === "admin" ||
        p?.admin === "superadmin";
      return id ? { id, admin } : null;
    })
    .filter(Boolean);
}

/** Helper to call the group's participants update API */
async function removeParticipants(message, jidList) {
  // preferred: message.conn.groupParticipantsUpdate
  if (typeof message.conn?.groupParticipantsUpdate === "function") {
    return message.conn.groupParticipantsUpdate(
      message.from,
      jidList,
      "remove"
    );
  }
  // fallback: message.client.groupParticipantsUpdate
  if (typeof message.client?.groupParticipantsUpdate === "function") {
    return message.client.groupParticipantsUpdate(
      message.from,
      jidList,
      "remove"
    );
  }
  // No supported API found
  throw new Error("No groupParticipantsUpdate method found on conn/client");
}

Module({
  command: "kickall",
  package: "group",
  description: "Kick all non-admin users at once (no safety confirmation)",
})(async (message) => {
  // ensure we have group info in message object if possible
  try {
    if (typeof message.loadGroupInfo === "function")
      await message.loadGroupInfo();
  } catch (e) {
    // ignore
  }

  if (!message.isGroup) return message.send("*ɢʀᴏᴜᴘ `ᴏɴʟʏ`*");
  if (!message.isAdmin && !message.isFromMe)
    return message.send("*ᴀᴅᴍɪɴ `ᴏɴʟʏ`*");
  if (!message.isBotAdmin) return message.send("*ʙᴏᴛ ᴍᴜꜱᴛ ʙᴇ `ᴀᴅᴍɪɴ`*");

  const md = await getGroupMetadata(message);
  if (!md) return message.send("❌ No participants found");

  const participants = normalizeParticipants(md);
  if (!participants.length) return message.send("❌ No participants found");

  // Try to detect the bot JID from connection info to avoid removing self
  const possibleBotIds = new Set(
    [
      message.conn?.user?.id,
      message.conn?.user?.jid,
      message.conn?.user?.lid, // keep original field if present
      message.client?.user?.id,
      message.client?.user?.jid,
    ].filter(Boolean)
  );

  // Build targets: non-admins, excluding bot JIDs
  const targets = participants
    .filter((p) => !p.admin)
    .map((p) => p.id)
    .filter((jid) => jid && !possibleBotIds.has(jid));

  if (!targets.length) return message.send("✅ No non-admin users");

  try {
    await removeParticipants(message, targets);
    // We don't cache here (cache removed) — just report result
    await message.send(`*✅ ᴋɪᴄᴋᴇᴅ ᴜꜱᴇʀ*  ${targets.length} *ɪɴ ᴏɴᴇ ᴀᴄᴛɪᴏɴ*`);
  } catch (err) {
    console.error("[kickall] Error while kicking participants:", err);
    return message.send(
      "*ꜰᴀɪʟᴇᴅ ᴛᴏ ᴋɪᴄᴋ `ᴜꜱᴇʀ`*"
    );
  }
});
