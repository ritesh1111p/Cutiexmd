import { Module } from '../lib/plugins.js';
import axios from 'axios';
import FormData from 'form-data';

// mime helper
const mimeExtMap = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
  'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg',
  'video/mp4': 'mp4', 'video/quicktime': 'mov',
  'application/pdf': 'pdf', 'text/plain': 'txt',
  'image/svg+xml': 'svg',
};
const mime = { extension: (type) => mimeExtMap[type?.split(';')[0].trim()] || 'bin' };

Module({
  command: "url",
  package: "converter",
  description: "Upload media to URL",
})(async (message) => {

  try {
    const quoted = message.quoted || message;

    // detect message type safely
    const msgType = quoted.type || Object.keys(quoted.message || {})[0];

    if (!msgType) {
      return message.send("_Reply to media_");
    }

    const supported = [
      "imageMessage",
      "videoMessage",
      "audioMessage",
      "documentMessage",
      "stickerMessage",
    ];

    if (!supported.includes(msgType)) {
      return message.send("❌ Unsupported media");
    }

    await message.react("⏳");

    // safe download
    const buffer = await quoted.download().catch(() => null);
    if (!buffer) throw new Error("Download failed");

    if (buffer.length > 200 * 1024 * 1024) {
      return message.send("❌ File too large (Max 200MB)");
    }

    // mime detection (also checks message.content for direct/non-reply usage)
    const mimeType =
      quoted.mimetype ||
      quoted.msg?.mimetype ||
      quoted.content?.mimetype ||
      "";

    const ext = mime.extension(mimeType);
    const fileName = `file_${Date.now()}.${ext}`;

    let mediaUrl;
    let lastErr;

    // ================= UPLOAD CHAIN =================
    // NOTE: Catbox now heavily filters/purges uploads coming from datacenter
    // /VPS IPs (policy change effective July 2026), which is exactly the kind
    // of IP most hosting panels (OptikLink, Railway, etc.) use. So Catbox is
    // no longer reliable as the sole/primary host — we now try several hosts
    // in order and only fail if all of them fail.

    // 1) Catbox (kept first — still works fine on residential/some VPS IPs)
    if (!mediaUrl) {
      try {
        const form = new FormData();
        form.append("reqtype", "fileupload");
        form.append("fileToUpload", buffer, fileName);

        const res = await axios.post("https://catbox.moe/user/api.php", form, {
          headers: form.getHeaders(),
          timeout: 30000,
        });

        if (res.data && typeof res.data === "string" && !res.data.startsWith("Error") && res.data.startsWith("http")) {
          mediaUrl = res.data.trim();
        } else {
          throw new Error(res.data || "Catbox rejected the upload");
        }
      } catch (err) {
        lastErr = err;
      }
    }

    // 2) 0x0.st (works fine from datacenter/VPS IPs, any file type)
    if (!mediaUrl) {
      try {
        const form = new FormData();
        form.append("file", buffer, fileName);

        const res = await axios.post("https://0x0.st", form, {
          headers: { ...form.getHeaders(), "User-Agent": "Mozilla/5.0" },
          timeout: 30000,
        });

        if (res.data && typeof res.data === "string" && res.data.trim().startsWith("http")) {
          mediaUrl = res.data.trim();
        } else {
          throw new Error("0x0.st rejected the upload");
        }
      } catch (err) {
        lastErr = err;
      }
    }

    // 3) uguu.se (fallback, any file type, files auto-expire after some hours)
    if (!mediaUrl) {
      try {
        const form = new FormData();
        form.append("files[]", buffer, fileName);

        const res = await axios.post("https://uguu.se/upload", form, {
          headers: form.getHeaders(),
          timeout: 30000,
        });

        const url = res.data?.files?.[0]?.url;
        if (url) {
          mediaUrl = url;
        } else {
          throw new Error("uguu.se rejected the upload");
        }
      } catch (err) {
        lastErr = err;
      }
    }

    // 4) Telegraph — image-only, last resort
    if (!mediaUrl && mimeType.startsWith("image/")) {
      try {
        const form = new FormData();
        form.append("file", buffer, fileName);

        const res = await axios.post("https://telegra.ph/upload", form, {
          headers: form.getHeaders(),
          timeout: 30000,
        });

        if (res.data && res.data[0]?.src) {
          mediaUrl = "https://telegra.ph" + res.data[0].src;
        } else {
          throw new Error("Telegraph rejected the upload");
        }
      } catch (err) {
        lastErr = err;
      }
    }

    if (!mediaUrl) {
      throw new Error(
        (lastErr && lastErr.message) || "All upload hosts failed"
      );
    }

    // ================= TYPE FORMAT =================

    let mediaType = "File";
    if (msgType === "imageMessage") mediaType = "Image";
    else if (msgType === "videoMessage") mediaType = "Video";
    else if (msgType === "audioMessage") mediaType = "Audio";
    else if (msgType === "documentMessage") mediaType = "Document";
    else if (msgType === "stickerMessage") mediaType = "Sticker";

    const styleMap = {
      Audio: "Aᴜᴅɪᴏ",
      Video: "Vɪᴅᴇᴏ",
      Image: "Iᴍᴀɢᴇ",
      Document: "Dᴏᴄᴜᴍᴇɴᴛ",
      Sticker: "Sᴛɪᴄᴋᴇʀ",
      File: "Fɪʟᴇ"
    };

    const styledType = styleMap[mediaType] || "Fɪʟᴇ";

    // ================= RESPONSE =================

    const msg = `
╭━━━「 *𝐔ᴘʟᴏᴀᴅ 𝐒ᴜᴄsᴇss* 」━━━┈⊷
┃
┃ ✅ *${styledType} Uᴘʟᴏᴀᴅᴇᴅ*
┃
┃ 🔗 *𝐔ʀʟ*
┃ ${mediaUrl}
┃
╰━━━━━━━━━━━━━━━━━━━┈⊷`.trim();

    await message.send(msg);
    await message.react("✅");

  } catch (err) {
    console.error(err);
    await message.react("❌");
    await message.send(`❌ Upload Failed\n\n_${err.message}_`);
  }
});
