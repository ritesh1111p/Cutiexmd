import axios from "axios";
import yts from "yt-search";
import fs from "fs";
import path from "path";
import { getBuffer } from "../../lib/handier.js";
import { fetchJson } from "i-nrl";

async function songCommand(Aliconn, searchQuery, message) {
  try {
    let downloadUrl;
    let dataa;
    let buffer;

    const getBufferWithHeaders = async (url) => {
      try {
        const response = await axios({
          method: "GET",
          url: url,
          responseType: "arraybuffer",
          timeout: 60000,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            Accept: "*/*",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            Connection: "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "audio",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "cross-site",
            Referer: "https://www.youtube.com/",
          },
        });
        return Buffer.from(response.data);
      } catch (error) {
        console.error(`Failed to fetch buffer from ${url}:`, error.message);
        throw error;
      }
    };

    if (searchQuery.startsWith("https://youtu")) {
      try {
        const down = await fetchJson(
          `https://izumiiiiiiii.dpdns.org/downloader/youtube-play?query=${encodeURIComponent(searchQuery)}`
        );
        if (!down.status || !down.result) throw new Error("Invalid API response");
        dataa = { title: down.result.title, thumbnail: down.result.thumbnail };
        downloadUrl = down.result.download;
      } catch (err) {
        console.error("Failed to get video info:", err);
        return message.send("❌ Unable to fetch video information. Please try again later.");
      }

      try {
        buffer = await getBufferWithHeaders(downloadUrl);
      } catch {
        try {
          buffer = await getBuffer(downloadUrl);
        } catch {
          return message.send("❌ Failed to download the audio file.");
        }
      }

      await Aliconn.sendMessage(
        message.from,
        {
          audio: buffer,
          mimetype: "audio/mpeg",
          contextInfo: {
            externalAdReply: {
              title: dataa.title,
              body: "ᴘσωєʀє∂ ву 𝖐𝚊𝚒𝚜𝖊𝖓 𝙼ԃ",
              mediaType: 1,
              sourceUrl: "https://youtube.com",
              thumbnailUrl: dataa.thumbnail,
            },
          },
        },
        { quoted: message.raw }
      );
      return;
    }

    const search = await yts(searchQuery);
    if (!search.videos || search.videos.length === 0) {
      return message.send("❌ No results found for your search query.");
    }
    const datas = search.videos[0];
    const videoUrl = datas.url;

    try {
      const down = await fetchJson(
        `https://izumiiiiiiii.dpdns.org/downloader/youtube-play?query=${encodeURIComponent(videoUrl)}`
      );
      if (!down.status || !down.result) throw new Error("Invalid API response");
      downloadUrl = down.result.download;

      try {
        buffer = await getBufferWithHeaders(downloadUrl);
      } catch {
        try {
          buffer = await getBuffer(downloadUrl);
        } catch {
          throw new Error("Failed to download audio buffer");
        }
      }
    } catch (err) {
      console.error("Download method failed:", err.message);
      return message.send("❌ Download failed. The video might be restricted or temporarily unavailable.");
    }

    await Aliconn.sendMessage(
      message.from,
      {
        audio: buffer,
        mimetype: "audio/mpeg",
        contextInfo: {
          externalAdReply: {
            title: `${datas.title}`,
            body: "ᴘσωєʀє∂ ву 𝖐𝚊𝚒𝚜𝖊𝖓 𝙼ԃ",
            mediaType: 1,
            sourceUrl: "https://youtube.com",
            thumbnailUrl: datas.thumbnail,
          },
        },
      },
      { quoted: message.raw }
    );
  } catch (err) {
    console.error("Main Error:", err);
    message.send(`❌ Error: ${err.message || "Unknown error occurred"}`);
  }
}

export default songCommand;
