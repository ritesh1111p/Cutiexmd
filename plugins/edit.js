import { Module } from "../lib/plugins.js"; // ensure ../lib/plugins.js is ESM-exporting Module
import { getRandomVideo } from "./bin/ig-edit/edit.js";

Module({
  command: "edit",
  package: "downloader",
  description: "Send edited video: .edit eren | .edit gojo",
})(async (message, match) => {
  try {
    if (!match) {
      return await message.send("Usage: .edit gojo");
    }
    const arg = match.trim().toLowerCase().replace(/\s+/g, "") + "edit";
    await message.react("⏬");
    const url = await getRandomVideo(arg);
    if (!url) {
      return await message.send(
        `No video found for "${match}". Try again later.`
      );
    }

    const caption = `Here you go — edit: ${match}`;
    await message.send({ video: { url }, caption });
    await message.react("📽️");
  } catch (err) {
    console.error("plugin edit error:", err && err.stack ? err.stack : err);
    try {
      await message.send(
        "❌ Failed to fetch/send video: " +
          (err && err.message ? err.message : String(err))
      );
    } catch (e) {}
  }
});
