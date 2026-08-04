// plugins/welcome-goodbye.js
import { Module } from "../lib/plugins.js";
import { db } from "../lib/client.js";
import { WELCOME_TEXTS, GOODBYE_TEXTS, pickRandom } from "./bin/text.js";
import axios from "axios";
import { jidNormalizedUser } from "@whiskeysockets/baileys";

const DEFAULT_GOODBYE = pickRandom(GOODBYE_TEXTS);
const DEFAULT_WELCOME = pickRandom(WELCOME_TEXTS);

/* ---------------- helpers ---------------- */
function toBool(v) {
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;
  if (typeof v === "string")
    return ["true", "1", "yes", "on"].includes(v.toLowerCase());
  return Boolean(v);
}

function buildText(template = "", replacements = {}) {
  let text = template || "";
  const wantsPp = text.includes("&pp");
  text = text.replace(/&pp/g, "").trim();
  text = text.replace(/&mention/g, replacements.mentionText || "");
  text = text.replace(/&name/g, replacements.name || "");
  text = text.replace(/&size/g, String(replacements.size ?? ""));
  return { text, wantsPp };
}

async function fetchProfileBuffer(conn, jid) {
  try {
    const getUrl =
      typeof conn.profilePictureUrl === "function"
        ? () => conn.profilePictureUrl(jid, "image").catch(() => null)
        : () => Promise.resolve(null);
    const url = await getUrl();
    if (!url) return null;
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 20000,
    });
    return Buffer.from(res.data);
  } catch (e) {
    console.error(
      "[welcome-goodbye] fetchProfileBuffer error:",
      e?.message || e
    );
    return null;
  }
}

async function sendWelcomeMsg(
  conn,
  groupJid,
  text,
  mentions = [],
  imgBuffer = null
) {
  try {
    if (imgBuffer) {
      await conn.sendMessage(groupJid, {
        image: imgBuffer,
        caption: text,
        mentions,
      });
    } else {
      await conn.sendMessage(groupJid, { text, mentions });
    }
  } catch (err) {
    console.error(
      "[welcome-goodbye] sendWelcomeMsg primary error:",
      err?.message || err
    );
    // fallback without mentions
    try {
      if (imgBuffer)
        await conn.sendMessage(groupJid, { image: imgBuffer, caption: text });
      else await conn.sendMessage(groupJid, { text });
    } catch (e) {
      console.error(
        "[welcome-goodbye] sendWelcomeMsg fallback error:",
        e?.message || e
      );
    }
  }
}

/* ---------------- COMMANDS ---------------- */
/*
  Usage (must be sent inside the group):
    .welcome on / off
    .goodbye on / off
    .adminmsg on / off   ← promote/demote message toggle
*/

Module({
  command: "welcome",
  package: "group",
  description:
    "Turn per-group welcome ON or OFF (must be used inside the group).",
})(async (message, match) => {
  // require group context
  const groupJid =
    message.from ||
    message.chat ||
    message.key?.remoteJid ||
    (message.isGroup ? message.isGroup : null);
  if (!groupJid || !groupJid.includes("@g.us")) {
    return await message.send?.(
      "❌ Use this command inside the group to toggle welcome messages."
    );
  }

  // only on/off supported. ignore custom message
  const raw = (match || "").trim().toLowerCase();
  if (!raw) {
    // read current
    const botNumber =
      (message.conn?.user?.id && String(message.conn.user.id).split(":")[0]) ||
      "bot";
    const key = `group:${groupJid}:welcome`;
    const cfg = await db.getAsync(botNumber, key, null);
    const status = cfg && typeof cfg === "object" ? toBool(cfg.status) : false;
    return await message.send(
      `Welcome is ${status ? "✅ ON" : "❌ OFF"} for this group.`
    );
  }

  if (raw !== "on" && raw !== "off") {
    return await message.send?.("❌ Invalid option. Use `on` or `off`.");
  }

  const botNumber =
    (message.conn?.user?.id && String(message.conn.user.id).split(":")[0]) ||
    "bot";
  const key = `group:${groupJid}:welcome`;
  const cfg = { status: raw === "on" };
  await db.set(botNumber, key, cfg);
  await message.react?.("✅");
  return await message.send(
    cfg.status
      ? "✅ Welcome ENABLED for this group"
      : "❌ Welcome DISABLED for this group"
  );
});

Module({
  command: "goodbye",
  package: "group",
  description:
    "Turn per-group goodbye ON or OFF (must be used inside the group).",
})(async (message, match) => {
  const groupJid =
    message.from ||
    message.chat ||
    message.key?.remoteJid ||
    (message.isGroup ? message.isGroup : null);
  if (!groupJid || !groupJid.includes("@g.us")) {
    return await message.send?.(
      "❌ Use this command inside the group to toggle goodbye messages."
    );
  }

  const raw = (match || "").trim().toLowerCase();
  if (!raw) {
    const botNumber =
      (message.conn?.user?.id && String(message.conn.user.id).split(":")[0]) ||
      "bot";
    const key = `group:${groupJid}:goodbye`;
    const cfg = await db.getAsync(botNumber, key, null);
    const status = cfg && typeof cfg === "object" ? toBool(cfg.status) : false;
    return await message.send(
      `Goodbye is ${status ? "✅ ON" : "❌ OFF"} for this group.`
    );
  }

  if (raw !== "on" && raw !== "off") {
    return await message.send?.("❌ Invalid option. Use `on` or `off`.");
  }

  const botNumber =
    (message.conn?.user?.id && String(message.conn.user.id).split(":")[0]) ||
    "bot";
  const key = `group:${groupJid}:goodbye`;
  const cfg = { status: raw === "on" };
  await db.set(botNumber, key, cfg);
  await message.react?.("✅");
  return await message.send(
    cfg.status
      ? "✅ Goodbye ENABLED for this group"
      : "❌ Goodbye DISABLED for this group"
  );
});

/* ── Promote/Demote message toggle ── */
/*
  .pdm on    → promote/demote message চালু
  .pdm off   → promote/demote message বন্ধ
  .pdm       → current status দেখাবে

  Permission: শুধু Bot Owner অথবা Group Admin ব্যবহার করতে পারবে।
*/
Module({
  command: "pdm",
  package: "group",
  description:
    "Turn per-group promote/demote message ON or OFF. Only bot owner or group admin can use this.",
})(async (message, match) => {
  // ── Group check ──
  if (!message.isGroup) {
    await message.send("_This command is only for groups_");
    return false;
  }

  // ── Permission: Bot Owner (isfromMe) OR Group Admin ──
  if (!message.isAdmin && !message.isfromMe) {
    await message.send("_This command requires admin privileges_");
    return false;
  }

  const groupJid =
    message.from ||
    message.chat ||
    message.key?.remoteJid;

  const raw = (match || "").trim().toLowerCase();
  const botNumber =
    (message.conn?.user?.id && String(message.conn.user.id).split(":")[0]) ||
    "bot";
  const key = `group:${groupJid}:pdm`;

  // ── No argument → show current status ──
  if (!raw) {
    const cfg = await db.getAsync(botNumber, key, null);
    const status = cfg && typeof cfg === "object" ? toBool(cfg.status) : false;
    return await message.send(
      `Promote/Demote message is ${status ? "✅ ON" : "❌ OFF"} for this group.`
    );
  }

  if (raw !== "on" && raw !== "off") {
    return await message.send?.("❌ Invalid option. Use `.pdm on` or `.pdm off`.");
  }

  const cfg = { status: raw === "on" };
  await db.set(botNumber, key, cfg);
  await message.react?.("✅");
  return await message.send(
    cfg.status
      ? "✅ Promote/Demote message *ENABLED* for this group"
      : "❌ Promote/Demote message *DISABLED* for this group"
  );
});

/* ---------------- EVENT: group-participants.update ---------------- */
Module({ on: "group-participants.update" })(async (_msg, event, conn) => {
  try {
    if (
      !event ||
      !event.id ||
      !event.action ||
      !Array.isArray(event.participants)
    )
      return;
    const groupJid = event.id;
    const groupName =
      event.groupName ||
      (event.groupMetadata && event.groupMetadata.subject) ||
      "";
    const groupSize =
      typeof event.groupSize === "number"
        ? event.groupSize
        : event.groupMetadata && Array.isArray(event.groupMetadata.participants)
        ? event.groupMetadata.participants.length
        : event.groupMetadata && event.groupMetadata.participants
        ? event.groupMetadata.participants.length
        : 0;

    // compute botNumber same as commands
    const botNumber =
      (conn?.user?.id && String(conn.user.id).split(":")[0]) || "bot";
    const action = String(event.action).toLowerCase();
    const botJidFull = jidNormalizedUser(conn?.user?.id);

    for (const p of event.participants) {
      const participantJid = jidNormalizedUser(
        typeof p === "string" ? p : p.id || p.jid || ""
      );
      if (!participantJid) continue;
      if (botJidFull && participantJid === botJidFull) continue; // skip bot itself

      // WELCOME (add/invite/join)
      if (action === "add" || action === "invite" || action === "joined") {
        const key = `group:${groupJid}:welcome`;
        const cfgRaw = await db.getAsync(botNumber, key, null);
        const enabled =
          cfgRaw && typeof cfgRaw === "object" ? toBool(cfgRaw.status) : false;
        if (!enabled) continue;

        const mentionText = `@${participantJid.split("@")[0]}`;
        const replacements = { mentionText, name: groupName, size: groupSize };
        const { text, wantsPp } = buildText(DEFAULT_WELCOME, replacements);

        let imgBuf = null;
        if (wantsPp) imgBuf = await fetchProfileBuffer(conn, participantJid);

        try {
          await sendWelcomeMsg(conn, groupJid, text, [participantJid], imgBuf);
        } catch (e) {
          console.error(
            "[welcome-goodbye] error sending welcome:",
            e?.message || e
          );
        }
      }

      // GOODBYE (remove/leave/left/kicked)
      if (
        action === "remove" ||
        action === "leave" ||
        action === "left" ||
        action === "kicked"
      ) {
        const key = `group:${groupJid}:goodbye`;
        const cfgRaw = await db.getAsync(botNumber, key, null);
        const enabled =
          cfgRaw && typeof cfgRaw === "object" ? toBool(cfgRaw.status) : false;
        if (!enabled) continue;

        const mentionText = `@${participantJid.split("@")[0]}`;
        const replacements = { mentionText, name: groupName, size: groupSize };
        const { text, wantsPp } = buildText(DEFAULT_GOODBYE, replacements);

        let imgBuf = null;
        if (wantsPp) imgBuf = await fetchProfileBuffer(conn, participantJid);

        try {
          await sendWelcomeMsg(conn, groupJid, text, [participantJid], imgBuf);
        } catch (e) {
          console.error(
            "[welcome-goodbye] error sending goodbye:",
            e?.message || e
          );
        }
      }

      // PROMOTE / DEMOTE — respects .pdm on/off
      if (action === "promote" || action === "demote") {
        // ── check if pdm is enabled ──
        const adminKey = `group:${groupJid}:pdm`;
        const adminCfgRaw = await db.getAsync(botNumber, adminKey, null);
        const adminEnabled =
          adminCfgRaw && typeof adminCfgRaw === "object"
            ? toBool(adminCfgRaw.status)
            : false;
        if (!adminEnabled) continue; // skip if turned off

        const owner = botJidFull || null;
        const ownerMention = owner
          ? `@${owner.split("@")[0]}`
          : conn.user?.id
          ? `@${String(conn.user.id).split(":")[0]}`
          : "Owner";
        const actor = event.actor || event.author || event.by || null;
        const actorText = actor ? `@${actor.split("@")[0]}` : "Admin";
        const targetText = `@${participantJid.split("@")[0]}`;
        const actionText = action === "promote" ? "promoted" : "demoted";
        const sendText = `╭─〔 *🎉 Admin Event* 〕\n├─ ${actorText} has ${actionText} ${targetText}\n├─ Group: ${groupName}\n╰─➤ Powered by ${ownerMention}`;
        try {
          const mentions = [actor, participantJid, botJidFull].filter(Boolean);
          if (owner) mentions.push(owner);
          await conn.sendMessage(groupJid, { text: sendText, mentions });
        } catch (e) {
          console.error(
            "[welcome-goodbye] promote/demote send error:",
            e?.message || e
          );
          try {
            await conn.sendMessage(groupJid, { text: sendText });
          } catch (_) {}
        }
      }
    }
  } catch (err) {
    console.error(
      "[welcome-goodbye] event handler error:",
      err?.message || err
    );
  }
});
