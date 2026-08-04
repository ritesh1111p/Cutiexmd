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

const API_TIMEOUT_MS = 30_000;
const DIRECT_TIMEOUT_MS = 45_000;

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function getBufferWithHeaders(url) {
  const response = await axios({
    method: "GET",
    url,
    responseType: "arraybuffer",
    timeout: 60_000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://www.youtube.com/",
    },
  });
  return Buffer.from(response.data);
}

// ── API 1: newapi (proven working, used in csong.js) ─────────────────────────
async function apiNewApi(video) {
  const apiUrl = "https://newapi-536w.onrender.com/api/song?url=" + encodeURIComponent(video.url);
  const { data } = await axios.get(apiUrl, { timeout: API_TIMEOUT_MS });
  if (!data || !data.status || !data.result?.audio) throw new Error("newapi: invalid response");
  const buffer = await getBufferWithHeaders(data.result.audio);
  return { buffer, title: data.result.title || video.title };
}

// ── API 2: izumiiiiiiii (proven working, used in bin/ytmp3.js) ───────────────
async function apiIzumi(video) {
  const apiUrl =
    "https://izumiiiiiiii.dpdns.org/downloader/youtube-play?query=" +
    encodeURIComponent(video.url);
  const { data } = await axios.get(apiUrl, { timeout: API_TIMEOUT_MS });
  if (!data || !data.status || !data.result?.download) throw new Error("izumi: invalid response");
  const buffer = await getBufferWithHeaders(data.result.download);
  return { buffer, title: data.result.title || video.title };
}

// ── API 3: rabbitapi (legacy fallback) ────────────────────────────────────────
async function apiRabbit(video) {
  const apiUrl = "https://rabbitapi.nett.to/api/song?url=" + encodeURIComponent(video.url);
  const { data } = await axios.get(apiUrl, {
    timeout: API_TIMEOUT_MS,
    headers: { Accept: "application/json" },
  });
  if (!data || !data.success || !data.result) throw new Error("rabbit: invalid response");
  const audioUrl = data.result.audio || data.result.mp3 || data.result.url || data.result.download;
  if (!audioUrl) throw new Error("rabbit: no audio url");
  const buffer = await getBufferWithHeaders(audioUrl);
  return { buffer, title: data.result.title || video.title };
}

// ── Final fallback: direct ytdl + ffmpeg extraction ───────────────────────────
function downloadViaYtdl(video) {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(
      os.tmpdir(),
      `song_${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`
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

async function apiYtdl(video) {
  const tmpFile = await withTimeout(downloadViaYtdl(video), DIRECT_TIMEOUT_MS, "Direct extraction");
  try {
    const buffer = await fs.readFile(tmpFile);
    return { buffer, title: video.title };
  } finally {
    fs.remove(tmpFile).catch(() => {});
  }
}

const SOURCES = [
  { name: "newapi", run: apiNewApi },
  { name: "izumi", run: apiIzumi },
  { name: "rabbit", run: apiRabbit },
  { name: "ytdl", run: apiYtdl },
];

Module({
  command: "song",
  package: "youtube",
  description: "Direct Audio Song",
})(async (message, match) => {
  try {
    if (!match) {
      return message.send("*Eɴᴛᴇʀ Sᴏɴɢ Nᴀᴍᴇ*\n\n`*.song Tum Hi Ho*`");
    }

    await message.react("🎧");

    console.log("[SONG] Searching:", match);
    const search = await yts(match);
    if (!search.videos || search.videos.length === 0) {
      return message.send("❌ Song not found");
    }

    const video = search.videos[0];
    console.log("[SONG] Found:", video.title, video.url);

    let lastErr = null;
    for (const source of SOURCES) {
      try {
        console.log(`[SONG] Trying source: ${source.name}`);
        const { buffer, title } = await withTimeout(
          source.run(video),
          API_TIMEOUT_MS + 10_000,
          source.name
        );

        if (!buffer || buffer.length < 10_000) {
          throw new Error(`${source.name}: buffer too small (${buffer?.length || 0} bytes)`);
        }

        console.log(`[SONG] ${source.name} OK, size:`, buffer.length);

        await message.send({
          audio: buffer,
          mimetype: "audio/mpeg",
          fileName: `${title || video.title}.mp3`,
        });

        await message.react("✅");
        return;
      } catch (err) {
        lastErr = err;
        console.error(`[SONG] ${source.name} failed:`, err?.message || err);
      }
    }

    throw lastErr || new Error("All sources failed");
  } catch (err) {
    console.error("[SONG ERROR]", err?.message || err);
    if (err.code === "ECONNABORTED" || /timed out/i.test(err?.message || "")) {
      return message.send("⏳ Server timeout, try again later");
    }
    return message.send("⚠️ Song download failed (all sources tried)");
  }
});
