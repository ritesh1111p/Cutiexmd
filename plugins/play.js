import axios from "axios";
import yts from "yt-search";
import ytdl from "@distube/ytdl-core";
import ffmpegPath from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs-extra";
import os from "os";
import path from "path";
import { Module } from "../lib/plugins.js";

ffmpeg.setFfmpegPath(ffmpegPath);

const DIRECT_TIMEOUT_MS = 45_000;
const API_TIMEOUT_MS = 60_000;

// ── small helper: race a promise against a timeout ────────────────────────────
function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// ── Method 1: Direct extraction (no third-party API, more reliable) ──────────
function downloadViaYtdl(video) {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(
      os.tmpdir(),
      `play_${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`
    );

    let stream;
    try {
      stream = ytdl(video.url, {
        filter: "audioonly",
        quality: "highestaudio",
        highWaterMark: 1 << 25,
      });
    } catch (e) {
      return reject(e);
    }

    let settled = false;
    const done = (err) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve(tmpFile);
    };

    stream.on("error", (e) => done(e));

    const command = ffmpeg(stream)
      .audioBitrate(128)
      .format("mp3")
      .on("error", (e) => {
        try { command.kill("SIGKILL"); } catch (_) {}
        done(e);
      })
      .on("end", () => done())
      .save(tmpFile);
  });
}

// ── Method 2: Fallback third-party API ────────────────────────────────────────
async function downloadViaApi(video) {
  const apiUrl = `https://rabbitapi.nett.to/api/song?url=${encodeURIComponent(
    video.url
  )}`;

  const response = await axios.get(apiUrl, {
    timeout: API_TIMEOUT_MS,
    headers: { Accept: "application/json" },
  });

  const data = response.data;

  if (!data || !data.success || !data.result) {
    throw new Error("API response invalid");
  }

  const audioUrl =
    data.result.audio ||
    data.result.mp3 ||
    data.result.url ||
    data.result.download;

  if (!audioUrl) {
    throw new Error("Audio URL not found in API response");
  }

  return { audioUrl, title: data.result.title };
}

Module({
  command: "play",
  package: "youtube",
  description: "Play song from YouTube",
})(async (message, match) => {
  let tmpFile = null;

  try {
    // ❌ No Query
    if (!match) {
      return message.send(
        "*Eɴᴛᴇʀ Sᴏɴɢ Nᴀᴍᴇ*\n\n`*.play Tum Hi Ho*`"
      );
    }

    await message.react("🔍");

    // 🔎 Search YouTube
    console.log("[PLAY] Searching:", match);
    const search = await yts(match);

    if (!search.videos || search.videos.length === 0) {
      return message.send("❌ Song not found");
    }

    const video = search.videos[0];
    console.log("[PLAY] Found:", video.title, video.url);

    // 📝 Search Message
    const caption = `
🔍 _*🌷🎧ꜱᴇᴀʀᴄʜɪɴɢ ʙʏ ᴍᴏᴏɴ x xᴅ :*_

_*${
  video.title.length > 60
    ? video.title.slice(0, 60) + "..."
    : video.title
}*_
`.trim();

    await message.send({
      text: caption,
      contextInfo: {
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: "120363423513489896@newsletter",
          newsletterName: "𝚳𝚯𝚯𝚴-𝚾 𝚾𝐃",
          serverMessageId: 6,
        },
      },
    });

    // ── Try direct extraction first ──────────────────────────────────────────
    try {
      console.log("[PLAY] Trying direct extraction...");
      tmpFile = await withTimeout(
        downloadViaYtdl(video),
        DIRECT_TIMEOUT_MS,
        "Direct extraction"
      );

      const buffer = await fs.readFile(tmpFile);
      console.log("[PLAY] Direct extraction OK, size:", buffer.length);

      await message.send({
        audio: buffer,
        mimetype: "audio/mpeg",
        fileName: `${video.title}.mp3`,
        contextInfo: {
          externalAdReply: {
            title: video.title,
            body: "*Powered By  𝚳𝚯𝚯𝚴-𝚾 𝚾𝐃*",
            mediaType: 2,
            thumbnailUrl: video.thumbnail,
            sourceUrl: video.url,
            renderLargerThumbnail: true,
            showAdAttribution: true,
          },
        },
      });

      await message.react("🎧");
      return;
    } catch (directErr) {
      console.error("[PLAY] Direct extraction failed:", directErr?.message || directErr);
    } finally {
      if (tmpFile) {
        fs.remove(tmpFile).catch(() => {});
      }
    }

    // ── Fallback: third-party API ────────────────────────────────────────────
    console.log("[PLAY] Trying API fallback...");
    const { audioUrl, title } = await withTimeout(
      downloadViaApi(video),
      API_TIMEOUT_MS + 5000,
      "API fallback"
    );
    console.log("[PLAY] API fallback OK");

    await message.send({
      audio: { url: audioUrl },
      mimetype: "audio/mpeg",
      fileName: `${title || video.title}.mp3`,
      contextInfo: {
        externalAdReply: {
          title: title || video.title,
          body: "*Powered By  𝚳𝚯𝚯𝚴-𝚾 𝚾𝐃*",
          mediaType: 2,
          thumbnailUrl: video.thumbnail,
          sourceUrl: video.url,
          renderLargerThumbnail: true,
          showAdAttribution: true,
        },
      },
    });

    await message.react("🎧");

  } catch (err) {
    console.error("[PLAY ERROR]", err?.message || err);

    if (err.response) {
      console.log("[PLAY ERROR] API response data:", err.response.data);
    }

    if (err.code === "ECONNABORTED" || /timed out/i.test(err?.message || "")) {
      return message.send("⏳ Server timeout, try again later");
    }

    return message.send("⚠️ Play failed (both direct & API methods failed)");
  }
});
