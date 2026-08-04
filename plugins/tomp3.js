import { Module } from '../lib/plugins.js';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import path from 'path';
import os from 'os';

ffmpeg.setFfmpegPath(ffmpegPath);

Module({
  command: "tomp3",
  description: "Convert video/audio to MP3",
  package: "tools",
})(async (message) => {
  if (!message.quoted) return message.send("_Reply to a video or audio file_");
  const mime = message.quoted?.mimetype || message.quoted?.msg?.mimetype || "";
  if (!/video|audio/.test(mime)) return message.send("_Reply to a valid video/audio file_");

  await message.react("⏳");

  const buffer = await message.quoted.download();
  const inFile = path.join(os.tmpdir(), `in_${Date.now()}.mp4`);
  const outFile = path.join(os.tmpdir(), `out_${Date.now()}.mp3`);

  fs.writeFileSync(inFile, buffer);

  try {
    await new Promise((resolve, reject) => {
      ffmpeg(inFile)
        .noVideo()
        .audioChannels(2)
        .audioBitrate("128k")
        .audioFrequency(44100)
        .format("mp3")
        .on("error", reject)
        .on("end", resolve)
        .save(outFile);
    });

    const mp3Buffer = fs.readFileSync(outFile);
    await message.send({ audio: mp3Buffer, mimetype: "audio/mpeg" });
    await message.react("✅");
  } finally {
    try { fs.unlinkSync(inFile); } catch {}
    try { fs.unlinkSync(outFile); } catch {}
  }
});
