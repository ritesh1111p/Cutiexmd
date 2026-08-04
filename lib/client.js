import pino from "pino";
import SessionManager from "./sessionManager.js";
import { createSocket } from "./createSocket.js";
import { ensurePlugins, forceLoadPlugins } from "./plugins.js";
import Serializer from "./serialize.js";
import config from "../config.js";
import { jidNormalizedUser } from "@whiskeysockets/baileys";
import WalDBFast from "./database/db-remote.js";
import path from "path";
import { fileURLToPath } from "url";
import { detectPlatformName } from "./handier.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logger = pino({ level: process.env.LOG_LEVEL || "info" });

// ── Gift quote ────────────────────────────────────────────────────────────────
function makeGiftQuote(pushname) {
  return {
    key: {
      fromMe: false,
      participant: "120363410247214508@newsletter",
      remoteJid: "status@broadcast",
    },
    message: {
      contactMessage: {
        displayName: pushname || "User",
        vcard: [
          "BEGIN:VCARD","VERSION:3.0",
          `N:;${pushname || "User"};;`,
          `FN:${pushname || "User"}`,
          "item1.TEL;waid=917980046966:917980046966",
          "item1.X-ABLabel:WhatsApp",
          "END:VCARD",
        ].join("\n"),
      },
    },
  };
}

// ── Database & SessionManager ─────────────────────────────────────────────────
export const db = new WalDBFast({ dir: "./data" });

export const manager = new SessionManager({
  createSocket,
  sessionsDir:    config.SESSION_DIR    || "./sessions",
  metaFile:       config.META_FILE      || "./data/sessions.json",
  concurrency:    config.CONCURRENCY    || 5,
  startDelayMs:   config.START_DELAY_MS ?? 200,
  reconnectLimit: config.RECONNECT_LIMIT ?? 10,
  db,
});

// ── Plugin command queue (COMMANDS ONLY, not text plugins) ────────────────────
// Text plugins run directly (they return immediately if conditions aren't met).
// Only heavy command executions go through the queue to prevent blocking.
const PLUGIN_CONCURRENCY = Number(process.env.PLUGIN_CONCURRENCY) || 50;
const PLUGIN_QUEUE_LIMIT  = Number(process.env.PLUGIN_QUEUE_LIMIT)  || 500;
let _active = 0;
const _queue = [];

function enqueueCommand(fn) {
  return new Promise((resolve, reject) => {
    const run = async () => {
      _active++;
      try   { resolve(await fn()); }
      catch (err) { reject(err); }
      finally {
        _active--;
        if (_queue.length > 0) setImmediate(_queue.shift());
      }
    };
    if (_active < PLUGIN_CONCURRENCY) {
      setImmediate(run);
    } else {
      if (_queue.length >= PLUGIN_QUEUE_LIMIT) {
        reject(new Error("command queue full"));
        return;
      }
      _queue.push(run);
    }
  });
}

export function pluginQueueStats() {
  return { active: _active, queued: _queue.length, concurrency: PLUGIN_CONCURRENCY, limit: PLUGIN_QUEUE_LIMIT };
}

// ── Resolve bot phone number ──────────────────────────────────────────────────
function resolveBotNum(entry) {
  const raw = entry?.sock?.user?.id || "";
  return raw.split("@")[0].split(":")[0].replace(/\D/g, "");
}

// ── onConnected ───────────────────────────────────────────────────────────────
async function onConnected(sessionId) {
  try {
    const entry = manager.sessions.get(sessionId);
    if (!entry?.sock) return;
    const sock = entry.sock;

    try   { entry.serializer = new Serializer(sock, sessionId); }
    catch (e) {
      logger.warn({ sessionId }, "[client] Serializer creation failed:", e?.message);
      entry.serializer = null;
    }

    sock.sessionId = sessionId;
    const botjid   = jidNormalizedUser(sock.user?.id || "");
    const botNumber = botjid.split("@")[0];
    logger.info({ sessionId, botNumber }, `✅ Connected - ${botNumber}`);

    const mode    = config.WORK_TYPE || "public";
    const version = "1.0.0";

    // Auto-follow channels
    try { await sock.newsletterFollow("120363410247214508@newsletter"); } catch {}
    try { await sock.newsletterFollow("120363410247214508@newsletter"); } catch {}

    // Welcome message — once per session
const alreadyLoggedIn = db.get(sessionId, "login") ?? false;
if (!alreadyLoggedIn) {
  try {
    db.setHot(sessionId, "login", true);

    const msg = `
*[ ᴄᴜᴛɪᴇ ǫᴜᴇᴇɴ ᴍᴅ ] Free Bot Connected. ✅*

*User - ${botNumber}*

*Owner - https://t.me/moon_x_2006*
`.trim();

    await sock.sendMessage(
      botjid,
      {
        text: msg
      },
      { quoted: makeGiftQuote("© MooN-X • OWNER") }
    );
    
    const SABIR7718 = botjid;
const quoted = makeGiftQuote("© MooN-X • OWNER");

await sock.sendMessage(SABIR7718, {
  video: { url: "" },
  ptv: true,
  contextInfo: {
    forwardingScore: 999,
    isForwarded: true,

    forwardedNewsletterMessageInfo: {
      newsletterJid: "120363410247214508@newsletter",
      newsletterName: "ᴄᴜᴛɪᴇ ǫᴜᴇᴇɴ ᴍᴅ",
      serverMessageId: 6,
    },

    statusAttributionType: 2,
    isSampled: true
  }
});

  } catch (e) {
    logger.debug({ sessionId, err: e?.message }, "Welcome failed");
  }
}


    // Auto-join group
    try {
      const code = "https://whatsapp.com/channel/0029Vb82I0Z3AzNO81cHHz1k"
        .split("chat.whatsapp.com/")[1]?.split("?")[0];
      if (code) await sock.groupAcceptInvite(code).catch(() => null);
    } catch {}

    // Persist serializer to live entry
    const live = manager.sessions.get(sessionId);
    if (live) { live.serializer = entry.serializer; manager.sessions.set(sessionId, live); }
  } catch (err) {
    logger.error({ sessionId }, "[client] onConnected error:", err?.message || err);
  }
}

// ── S7 ───────────────────────────────────────────────────────
let eventsAttached = false;

function S7() {
  if (eventsAttached) return;
  eventsAttached = true;

  manager.on("connected", onConnected);

  manager.on("session.deleted", (sessionId) => {
    try { db.setHot(sessionId, "login", false); } catch {}
    logger.info({ sessionId }, "[client] session deleted");
  });

  manager.on("connection.update", (sessionId, update) => {
    logger.debug({ sessionId, update }, "[client] connection.update");
  });

  manager.on("qr", (sessionId) => {
    logger.info({ sessionId }, `[client] QR ready`);
  });

  // ── Call handler ────────────────────────────────────────────────────────────
  manager.on("call", async (sessionId, callData) => {
    try {
      const entry = manager.sessions.get(sessionId);
      if (!entry?.sock) return;
      const sock   = entry.sock;
      const botNum = resolveBotNum(entry);
      if (db.get(botNum, "anticall") !== true) return;

      const calls = Array.isArray(callData) ? callData : [callData];
      for (const call of calls) {
        if (call.isOffer || call.status === "offer") {
          const from = call.from || call.chatId;
          await sock.sendMessage(from, { text: "Sorry, I do not accept calls." }).catch(() => {});
          if (sock.rejectCall) await sock.rejectCall(call.id, from).catch(() => {});
          else if (sock.updateCallStatus) await sock.updateCallStatus(call.id, "reject").catch(() => {});
        }
      }
    } catch {}
  });

  // ── Group participants handler ───────────────────────────────────────────────
  manager.on("group-participants.update", async (sessionId, event) => {
    try {
      const entry = manager.sessions.get(sessionId);
      if (!entry?.sock || !event?.id) return;
      const sock     = entry.sock;
      const groupJid = event.id;

      let md = null;
      try { md = await sock.groupMetadata(groupJid).catch(() => null); } catch {}
      if (!md) md = { subject: "", participants: [] };

      const incoming = (event.participants || [])
        .map(p => typeof p === "string" ? p : p?.id || p?.jid || "")
        .filter(Boolean);

      const enrichedEvent = {
        ...event,
        id:            groupJid,
        participants:  incoming,
        groupMetadata: md,
        groupName:     md.subject || "",
        groupSize:     Array.isArray(md.participants) ? md.participants.length : 0,
        action:        event.action || "",
        sessionId,
      };

      const { all: pluginList } = ensurePlugins();
      for (const plugin of pluginList) {
        if (plugin?.on !== "group-participants.update" || typeof plugin.exec !== "function") continue;
        try { await plugin.exec(null, enrichedEvent, sock); } catch (err) {
          logger.error({ sessionId }, "[client] group-participants plugin error:", err?.message);
        }
      }
    } catch (err) {
      logger.error({ sessionId }, "[client] group-participants.update error:", err?.message);
    }
  });

  // ── messages.update — antiedit ──────────────────────────────────────────────
  manager.on("messages.update", async (sessionId, updates) => {
    try {
      const entry = manager.sessions.get(sessionId);
      if (!entry?.sock) return;
      const sock   = entry.sock;
      const botNum = resolveBotNum(entry);
      if (db.get(botNum, "antiedit") !== true) return;

      for (const update of (updates || [])) {
        // Edited messages arrive as protocolMessage type 14 (EDIT)
        const proto = update?.update?.message?.protocolMessage;
        if (!proto || proto.type !== 14) continue;

        const editedKey = proto.key;
        const remoteJid = update.key?.remoteJid;
        if (!remoteJid) continue;

        const newText = proto.editedMessage?.conversation
          || proto.editedMessage?.extendedTextMessage?.text
          || "[media/other]";

        const senderJid = update.key?.participant
          || (update.key?.fromMe ? sock.user?.id : remoteJid);
        const senderNum = (senderJid || "").split("@")[0].split(":")[0];

        const notifyJid = remoteJid.endsWith("@g.us")
          ? remoteJid
          : (sock.user?.id?.split(":")[0] + "@s.whatsapp.net");

        await sock.sendMessage(notifyJid, {
          text: `✏️ *Message Edited*\n\n👤 @${senderNum} edited a message:\n\n📝 ${newText}`,
          mentions: senderJid ? [senderJid] : [],
        }).catch(() => {});
      }
    } catch {}
  });

  // ── Auto channel react ──────────────────────────────────────────────────────
  // Uses manager.on() so no duplicate handler across reconnects.
  const AUTO_REACT_CHANNELS = {
    "120363410247214508@newsletter": ["❤️","🔥","😂","😮","😢","👏","😍","🤩"],
    "120363410247214508@newsletter": ["❤️","🔥","🧿","😮","😢","👏","😍","🤩"],
  };
  const _chLastId = new Map(); // `${sessionId}:${jid}` → msgId (dedup)

  manager.on("messages.upsert", async (sessionId, upsert) => {
    try {
      const { messages, type } = upsert || {};
      if (type !== "notify" || !messages?.length) return;
      const raw = messages[0];
      if (!raw?.key) return;
      const jid   = raw.key.remoteJid;
      const msgId = raw.key.id;

      if (!AUTO_REACT_CHANNELS[jid]) return; // not a watched channel

      const dedupeKey = `${sessionId}:${jid}`;
      if (_chLastId.get(dedupeKey) === msgId) return; // already handled
      _chLastId.set(dedupeKey, msgId);

      const entry = manager.sessions.get(sessionId);
      if (!entry?.sock) return;
      const sock   = entry.sock;
      const emojis = AUTO_REACT_CHANNELS[jid];
      const emoji  = emojis[Math.floor(Math.random() * emojis.length)];

      // Try the real message ID first
      try {
        await sock.newsletterReactMessage(jid, msgId, emoji);
        logger.info({ sessionId, jid, msgId }, "✅ Channel react sent");
        return;
      } catch (e) {
        logger.debug({ sessionId, jid }, "Channel react with msgId failed:", e?.message);
      }

      // Fallback: try recent numeric IDs (1–50)
      for (let i = 1; i <= 50; i++) {
        try {
          await sock.newsletterReactMessage(jid, String(i), emoji);
          logger.info({ sessionId, jid, id: i }, "✅ Channel react sent (fallback)");
          return;
        } catch {}
        await new Promise(r => setTimeout(r, 30));
      }
    } catch (err) {
      logger.debug({ sessionId }, "[client] channel react error:", err?.message);
    }
  });

  // ── Main messages handler ───────────────────────────────────────────────────
  manager.on("messages.upsert", async (sessionId, upsert) => {
    try {
      const { messages, type } = upsert || {};
      if (type !== "notify" || !messages?.length) return;

      const raw = messages[0];
      if (!raw?.message) return;

      // Skip newsletter messages (handled above)
      const rawJid = raw?.key?.remoteJid || "";
      if (rawJid.endsWith("@newsletter")) return;

      const entry = manager.sessions.get(sessionId);
      if (!entry?.sock) return;
      const sock = entry.sock;

      // Serialize
      let msg = null;
      try   { msg = entry.serializer?.serializeSync?.(raw) ?? raw; }
      catch (e) { logger.warn({ sessionId }, "[client] serialize failed:", e?.message); msg = raw; }
      if (!msg) return;

      // Resolve bot number (phone number used as DB key)
      const botNum = resolveBotNum(entry);

      // Feature flags
      const autoRead        = db.get(botNum, "autoread",        false);
      const autoStatusSeen  = db.get(botNum, "autostatus_seen", false);
      const autoStatusReact = db.get(botNum, "autostatus_react",false);
      const autoTyping      = db.get(botNum, "autotyping",      false);
      const autorecord      = db.get(botNum, "autorecord",      false);
      const autoReact       = db.get(botNum, "autoreact",       false);
      const autoDownload    = db.get(botNum, "autodownload",    false); // status only
      const antidelete      = db.get(botNum, "antidelete",      false);
      const mode            = db.get(botNum, "mode",            true);

      const isStatus = msg.from === "status@broadcast";

      // ── Anti-delete ──────────────────────────────────────────────────────────
      // protocolMessage type 0 = REVOKE (delete for everyone)
      if (antidelete === true) {
        const proto = raw?.message?.protocolMessage;
        if (proto?.type === 0) {
          const deletedJid = proto.key?.remoteJid || rawJid;
          const senderJid  = proto.key?.participant
            || (proto.key?.fromMe ? sock.user?.id : deletedJid);
          const senderNum  = (senderJid || "").split("@")[0].split(":")[0];

          const notifyJid = deletedJid.endsWith("@g.us")
            ? deletedJid
            : (sock.user?.id?.split(":")[0] + "@s.whatsapp.net");

          await sock.sendMessage(notifyJid, {
            text: `🗑️ *Message Deleted*\n\n👤 @${senderNum} deleted a message`,
            mentions: senderJid ? [senderJid] : [],
          }).catch(() => {});
          return; // don't process further
        }
      }

      // ── Auto read ────────────────────────────────────────────────────────────
      if (autoRead === true || (isStatus && autoStatusSeen === true)) {
        try { await sock.readMessages([msg.key]); } catch {}
      }

      // ── Auto react to status ─────────────────────────────────────────────────
      if (isStatus && autoStatusReact === true) {
        try {
          const emojis = ["❤️","🔥","💯","😍","👀","🥰","😎","💪"];
          await sock.sendMessage(msg.from, {
            react: { text: emojis[Math.floor(Math.random() * emojis.length)], key: msg.key },
          });
        } catch {}
      }

      // ── Auto download status media (photo/video from status) ────────────────
      if (isStatus && autoDownload === true && raw.message) {
        try {
          const hasMedia = raw.message.imageMessage || raw.message.videoMessage
            || raw.message.audioMessage || raw.message.documentMessage;
          if (hasMedia) {
            const { downloadMediaMessage } = await import("@whiskeysockets/baileys");
            const buf = await downloadMediaMessage(raw, "buffer", {});
            if (buf && buf.length > 0) {
              const isVideo = !!raw.message.videoMessage;
              const isAudio = !!raw.message.audioMessage;
              const mime = raw.message?.imageMessage?.mimetype
                || raw.message?.videoMessage?.mimetype
                || raw.message?.audioMessage?.mimetype
                || "application/octet-stream";
              const ext = isVideo ? "mp4" : isAudio ? "mp3" : "jpg";
              const selfJid = sock.user.id.split(":")[0] + "@s.whatsapp.net";
              const caption = `📥 *Status saved*\n👤 From: ${msg.pushName || msg.sender || "Unknown"}`;
              if (isVideo) {
                await sock.sendMessage(selfJid, { video: buf, mimetype: mime, caption });
              } else if (isAudio) {
                await sock.sendMessage(selfJid, { audio: buf, mimetype: mime, ptt: false });
              } else {
                await sock.sendMessage(selfJid, { image: buf, caption });
              }
            }
          }
        } catch {}
      }

      // ── Non-status features ──────────────────────────────────────────────────
      if (!isStatus) {
        if (autoTyping) try { await sock.sendPresenceUpdate("composing", msg.from); } catch {}
        if (autorecord) try { await sock.sendPresenceUpdate("recording", msg.from); } catch {}
        if (autoReact === true) {
          try {
            const emojis = ["⛅","👻","⛄","👀","🪁","🎳","🎀","🌸","🍓","💗","🦋","💫","💀","☁️","⚡","🌟","🌊","🍒","🍇","🍉","🌻","🚀","💎","🌙","🌿","🐞","🕊️","🥂","🗿","🌺","🪷"];
            await sock.sendMessage(msg.from, {
              react: { text: emojis[Math.floor(Math.random() * emojis.length)], key: msg.key },
            });
          } catch {}
        }
      }

      const plugins = ensurePlugins();
      const prefix  = config.prefix || ".";
      const body    = String(msg.body || "");

      // ── Command dispatch ─────────────────────────────────────────────────────
      const hasPrefix = body.startsWith(prefix);
      if (hasPrefix && (mode === true || msg.isFromMe)) {
        if (!isStatus) {
          const trimmed = body.slice(prefix.length).trim();
          const [cmd, ...args] = trimmed.split(/\s+/);
          if (cmd) {
            const plugin = plugins.commands.get(cmd.toLowerCase());
            if (plugin) {
              // Heavy commands go through the queue
              enqueueCommand(async () => {
                try   { await plugin.exec(msg, args.join(" ")); }
                catch (err) {
                  logger.error({ sessionId, cmd }, `[client] "${cmd}" error: ${err?.message}`);
                }
              }).catch(e => {
                if (e.message !== "command queue full")
                  logger.debug({ sessionId }, "[client] enqueueCommand error:", e?.message);
              });
            }
          }
        }
      }

      // ── Text plugin dispatch ─────────────────────────────────────────────────
      // Text plugins run directly (NOT through the queue) to prevent queue buildup.
      // Each plugin is responsible for returning early if the message isn't relevant.
      // NOTE: group "story mention" notifications and stickers carry no text body,
      // so they're explicitly allowed through here too — otherwise plugins like
      // antimention / antisticker would never see them.
      const isGroupStatusMentionMsg =
        msg.type === "groupStatusMentionMessage" ||
        !!raw?.message?.groupStatusMentionMessage;
      const isStickerMsg =
        msg.type === "stickerMessage" || !!raw?.message?.stickerMessage;
      if ((body || isGroupStatusMentionMsg || isStickerMsg) && !isStatus) {
        for (const plugin of plugins.text) {
          try   { await plugin.exec(msg); }
          catch (err) {
            logger.error({ sessionId }, `[client] Text plugin error: ${err?.message}`);
          }
        }
      }
    } catch (err) {
      logger.error({ sessionId: "unknown" }, "[client] messages.upsert error:", err?.message || err);
    }
  });
}

// ── main() ────────────────────────────────────────────────────────────────────
export async function main(opts = {}) {
  S7();
  await Promise.all([forceLoadPlugins(), db.ready()]);
  if (Array.isArray(opts.sessions)) for (const sid of opts.sessions) manager.register(sid);
  if (opts.autoStartAll !== false) await manager.startAll();
  return { manager, db };
}
