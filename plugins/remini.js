// filename: plugins/remini.js
import { Module } from "../lib/plugins.js";
import { getTheme } from "../Themes/themes.js";
import axios from "axios";
import FormData from "form-data";

const theme = getTheme();

/**
 * ihancer wrapper
 * buffer: Buffer
 * opts: { method: 1..4, size: "low"|"medium"|"high" }
 */
async function ihancer(buffer, { method = 1, size = "high" } = {}) {
  const availableSizes = ["low", "medium", "high"];
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error("Image buffer is required");
  }
  if (method < 1 || method > 4) throw new Error("Available methods: 1,2,3,4");
  if (!availableSizes.includes(size)) {
    throw new Error(`Available sizes: ${availableSizes.join(", ")}`);
  }

  const form = new FormData();
  form.append("method", String(method));
  form.append("is_pro_version", "false");
  form.append("is_enhancing_more", "false");
  form.append("max_image_size", size);
  form.append("file", buffer, `${Date.now()}.jpg`);

  const res = await axios.post("https://ihancer.com/api/enhance", form, {
    headers: {
      ...form.getHeaders(),
      "accept-encoding": "gzip",
      host: "ihancer.com",
      "user-agent": "Dart/3.5 (dart:io)",
    },
    responseType: "arraybuffer",
    timeout: 60000,
  });

  return Buffer.from(res.data);
}

/**
 * Try a few ways to obtain a media buffer from the message shape used by your bot.
 */
async function getMediaBuffer(message, match) {
  // 1) If user provided URL as argument
  if (match && typeof match === "string" && match.startsWith("http")) {
    try {
      const r = await axios.get(match, {
        responseType: "arraybuffer",
        timeout: 30000,
      });
      return Buffer.from(r.data);
    } catch (e) {
      // fallthrough to other attempts
    }
  }

  // 2) If message itself is an image (direct)
  try {
    if (
      message.type === "imageMessage" &&
      typeof message.download === "function"
    ) {
      const b = await message.download();
      if (Buffer.isBuffer(b)) return b;
    }
  } catch (e) {}

  // 3) Quoted media
  try {
    if (message.quoted) {
      if (typeof message.quoted.download === "function") {
        const b2 = await message.quoted.download();
        if (Buffer.isBuffer(b2)) return b2;
      }
      // some serializers place media in quoted.msg or quoted.msg.url
      const q = message.quoted.msg || message.quoted;
      if (q && q.url) {
        const r = await axios.get(q.url, {
          responseType: "arraybuffer",
          timeout: 30000,
        });
        return Buffer.from(r.data);
      }
      if (q && q.buffer && Buffer.isBuffer(q.buffer)) return q.buffer;
      if (q && q.data && Buffer.isBuffer(q.data)) return q.data;
    }
  } catch (e) {}

  // 4) last-resort: message.msg.url
  try {
    const m = message.msg || message;
    if (m && m.url) {
      const r = await axios.get(m.url, {
        responseType: "arraybuffer",
        timeout: 30000,
      });
      return Buffer.from(r.data);
    }
  } catch (e) {}

  return null;
}

/**
 * Safe send helper: prefer message.conn.sendMessage, then message.send, then fallback.
 */
async function safeSendImage(message, targetJid, buffer, caption = "") {
  try {
    if (message.conn && typeof message.conn.sendMessage === "function") {
      return await message.conn.sendMessage(targetJid, {
        image: buffer,
        caption,
      });
    }
    if (typeof message.send === "function") {
      return await message.send({ image: buffer, caption });
    }
    // generic fallback if sendFromUrl-like exists (some bots)
    if (typeof message.sendFromBuffer === "function") {
      return await message.sendFromBuffer(buffer, { caption });
    }
    throw new Error("No supported send API available");
  } catch (e) {
    throw e;
  }
}

/*
Module registration — matches your owner.js style and message helpers
Usage:
 .remini            (reply to image)
 .remini <url>      (direct image URL)
 optionally you may add method and size: .remini <url> 2 high
*/
Module({
  command: "remini",
  package: "media",
  description: "Enhance image quality using AI",
  usage: ".remini <reply to image | url> [method] [size]",
})(async (message, match) => {
  try {
    if (!message.isfromMe) return message.send(theme.isfromMe);

    // parse optional args: allow ".remini <url> 2 high" or ".remini 2 high" when replying
    let method = 1;
    let size = "high";
    let urlOrArg = match && typeof match === "string" ? match.trim() : "";

    // if args provided like "2 high" when replying to image
    if (
      urlOrArg &&
      !urlOrArg.startsWith("http") &&
      urlOrArg.split(" ").length >= 1
    ) {
      const parts = urlOrArg.split(/\s+/);
      // try parse numeric method
      if (parts[0] && /^[1-4]$/.test(parts[0])) method = Number(parts[0]);
      if (parts[1] && /^(low|medium|high)$/i.test(parts[1]))
        size = parts[1].toLowerCase();
    } else if (urlOrArg && urlOrArg.startsWith("http")) {
      // if url includes trailing args, split
      const parts = urlOrArg.split(/\s+/);
      urlOrArg = parts[0];
      if (parts[1] && /^[1-4]$/.test(parts[1])) method = Number(parts[1]);
      if (parts[2] && /^(low|medium|high)$/i.test(parts[2]))
        size = parts[2].toLowerCase();
    }

    await message.react("⏳");

    const mediaBuffer = await getMediaBuffer(message, urlOrArg);
    if (!mediaBuffer) {
      await message.react("ℹ️");
      return message.send(
        "📸 Please reply to an image (JPEG/PNG/WEBP) or provide an image URL.\n\nExample:\n• Reply to an image with .remini\n• .remini https://example.com/pic.jpg\nYou can optionally pass method and size: `.remini 2 high`"
      );
    }

    await message.send(
      "🔄 *Enhancing image quality...*\n⏱️ This may take a few moments"
    );

    // Try primary
    try {
      const enhanced = await ihancer(mediaBuffer, { method, size });
      const target =
        message.from ||
        (message.chat && message.chat.id) ||
        message.key?.remoteJid;
      await safeSendImage(
        message,
        target,
        enhanced,
        "✨ *Image Enhanced Successfully!*"
      );
      await message.react("✅");
      return;
    } catch (primaryErr) {
      console.error("ihancer primary error:", primaryErr);
      // fallback method attempt
      try {
        const fallback = await ihancer(mediaBuffer, {
          method: method === 1 ? 2 : 1,
          size: size === "high" ? "medium" : "high",
        });
        const target =
          message.from ||
          (message.chat && message.chat.id) ||
          message.key?.remoteJid;
        await safeSendImage(
          message,
          target,
          fallback,
          "✨ *Image Enhanced Successfully!* (Fallback)"
        );
        await message.react("✅");
        return;
      } catch (fallbackErr) {
        console.error("ihancer fallback error:", fallbackErr);
        await message.react("❌");
        return message.send(
          "❌ *Error:* All enhancement methods failed. Please try again later."
        );
      }
    }
  } catch (err) {
    console.error("Remini plugin error:", err);
    try {
      await message.react("❌");
    } catch (_) {}
    return message.send(
      `❌ *Error:* ${err?.message || "Failed to enhance image."}`
    );
  }
});
