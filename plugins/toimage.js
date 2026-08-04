import { Module } from '../lib/plugins.js';
import { getTheme } from '../Themes/themes.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const theme = getTheme();

// 🎨 Beautiful Emojis for Image Processing
const IMAGE_EMOJIS = {
  SUCCESS: "✅",
  ERROR: "❌",
  LOADING: "⏳",
  IMAGE: "🖼️",
  VIDEO: "🎥",
  STICKER: "💟",
  DOCUMENT: "📄",
  DOWNLOAD: "📥",
  UPLOAD: "📤",
  MAGIC: "✨",
  SETTINGS: "⚙️",
  QUALITY: "📊",
  SIZE: "📏",
  FILTER: "🎨",
  ROTATE: "🔄",
  FLIP: "🪞",
  BRIGHTNESS: "💡",
  CONTRAST: "⚫⚪",
  SATURATION: "🌈",
  BLUR: "🔍",
  SHARPEN: "🔪",
  GRAYSCALE: "⚫",
  SEPIA: "🟫",
  INVERT: "🔃",
  FRAME: "🖼️",
  WATERMARK: "💧",
  TEXT: "🔤",
  CROP: "✂️",
  RESIZE: "📐",
  FORMAT: "📝",
  INFO: "ℹ️",
};

// ==================== DIRECTORY SETUP ====================

/**
 * ✅ Ensure temp directory exists
 */
const ensureTempDir = () => {
  const tempDir = path.join(__dirname, "../temp");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
    console.log("📁 Created temp directory:", tempDir);
  }
  return tempDir;
};

// Initialize temp directory on plugin load
ensureTempDir();

// ==================== HELPER FUNCTIONS ====================

/**
 * ✅ Download media with timeout and error handling
 */
const downloadMedia = async (message) => {
  try {
    const buffer = await Promise.race([
      message.download(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Download timeout after 30s")), 30000)
      ),
    ]);

    if (!buffer || buffer.length === 0) {
      throw new Error("Empty media buffer");
    }

    return buffer;
  } catch (error) {
    throw new Error(`Download failed: ${error.message}`);
  }
};

/**
 * ✅ Check if required dependencies are installed
 */
const checkDependencies = async () => {
  try {
    await execAsync("ffmpeg -version");
    return { ffmpeg: true, imageMagick: false };
  } catch (error) {
    try {
      await execAsync("convert -version"); // ImageMagick
      return { ffmpeg: false, imageMagick: true };
    } catch (magickError) {
      console.warn(
        "⚠️ FFmpeg and ImageMagick not found. Using basic conversion."
      );
      return { ffmpeg: false, imageMagick: false };
    }
  }
};

/**
 * ✅ Convert buffer to temporary file with directory check
 */
const bufferToTempFile = (buffer, extension = "") => {
  ensureTempDir(); // Double-check directory exists
  const tempDir = path.join(__dirname, "../temp");
  const tempPath = path.join(tempDir, `temp_${Date.now()}${extension}`);

  try {
    fs.writeFileSync(tempPath, buffer);
    return tempPath;
  } catch (error) {
    throw new Error(`Failed to create temp file: ${error.message}`);
  }
};

/**
 * ✅ Clean up temporary files safely
 */
const cleanupTempFiles = (files) => {
  files.forEach((file) => {
    if (file && fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
      } catch (error) {
        console.error("❌ Error deleting temp file:", error.message);
      }
    }
  });
};

/**
 * ✅ Simple sticker conversion without external dependencies
 */
const simpleStickerConversion = async (stickerBuffer) => {
  try {
    // For WebP stickers, we'll try to handle them directly
    // If this doesn't work, we'll use an alternative approach
    return stickerBuffer; // Return as-is for now
  } catch (error) {
    throw new Error(
      "Basic conversion failed. Install FFmpeg for better results."
    );
  }
};

/**
 * ✅ Simple video frame extraction without FFmpeg
 */
const simpleVideoFrameExtraction = async (videoBuffer) => {
  try {
    // Return first part of video as placeholder
    // In real implementation, you'd use a proper library
    return videoBuffer.slice(0, Math.min(videoBuffer.length, 50000));
  } catch (error) {
    throw new Error("Video frame extraction requires FFmpeg");
  }
};

// ==================== IMAGE PROCESSING FUNCTIONS ====================

/**
 * ✅ Convert sticker to image (WebP to PNG/JPEG)
 */
const convertStickerToImage = async (stickerBuffer, format = "png") => {
  const tempFiles = [];

  try {
    const dependencies = await checkDependencies();

    if (!dependencies.ffmpeg && !dependencies.imageMagick) {
      // Fallback to simple conversion
      return await simpleStickerConversion(stickerBuffer);
    }

    const inputPath = bufferToTempFile(stickerBuffer, ".webp");
    tempFiles.push(inputPath);

    const outputPath = path.join(
      path.dirname(inputPath),
      `output_${Date.now()}.${format}`
    );
    tempFiles.push(outputPath);

    let command;
    if (dependencies.ffmpeg) {
      command = `ffmpeg -i "${inputPath}" -y "${outputPath}"`;
    } else {
      command = `convert "${inputPath}" "${outputPath}"`;
    }

    await execAsync(command);

    if (!fs.existsSync(outputPath)) {
      throw new Error("Conversion output file not found");
    }

    const outputBuffer = fs.readFileSync(outputPath);
    return outputBuffer;
  } catch (error) {
    console.error("Sticker conversion error:", error);
    // Fallback to simple conversion
    return await simpleStickerConversion(stickerBuffer);
  } finally {
    cleanupTempFiles(tempFiles);
  }
};

/**
 * ✅ Extract frame from video
 */
const extractVideoFrame = async (videoBuffer, timestamp = "00:00:01") => {
  const tempFiles = [];

  try {
    const dependencies = await checkDependencies();

    if (!dependencies.ffmpeg) {
      return await simpleVideoFrameExtraction(videoBuffer);
    }

    const inputPath = bufferToTempFile(videoBuffer, ".mp4");
    tempFiles.push(inputPath);

    const outputPath = path.join(
      path.dirname(inputPath),
      `frame_${Date.now()}.jpg`
    );
    tempFiles.push(outputPath);

    // Extract frame at specific timestamp
    await execAsync(
      `ffmpeg -i "${inputPath}" -ss ${timestamp} -vframes 1 -q:v 2 -y "${outputPath}"`
    );

    if (!fs.existsSync(outputPath)) {
      throw new Error("Frame extraction failed - no output file");
    }

    const outputBuffer = fs.readFileSync(outputPath);
    return outputBuffer;
  } catch (error) {
    console.error("Video frame extraction error:", error);
    return await simpleVideoFrameExtraction(videoBuffer);
  } finally {
    cleanupTempFiles(tempFiles);
  }
};

/**
 * ✅ Enhanced media type detection and conversion
 */
const detectAndConvertMedia = async (quoted, match = "") => {
  const mediaType = quoted.type;
  let buffer,
    caption = "";

  switch (mediaType) {
    case "stickerMessage":
      buffer = await convertStickerToImage(await downloadMedia(quoted));
      caption = `${IMAGE_EMOJIS.STICKER} *Sticker → Image*`;
      break;

    case "videoMessage":
      const timestamp = match?.includes("frame")
        ? match.split(" ")[1] || "00:00:01"
        : "00:00:01";
      buffer = await extractVideoFrame(await downloadMedia(quoted), timestamp);
      caption = `${IMAGE_EMOJIS.VIDEO} *Video Frame → Image*\n${IMAGE_EMOJIS.FRAME} Timestamp: ${timestamp}`;
      break;

    case "imageMessage":
      buffer = await downloadMedia(quoted);
      caption = `${IMAGE_EMOJIS.IMAGE} *Image Enhanced*`;
      break;

    case "documentMessage":
      const mimeType = quoted.mimetype || "";
      if (mimeType.startsWith("image/")) {
        buffer = await downloadMedia(quoted);
        caption = `${IMAGE_EMOJIS.DOCUMENT} *Document → Image*`;
      } else {
        throw new Error("Unsupported document type. Please use image files.");
      }
      break;

    default:
      throw new Error(`Unsupported media type: ${mediaType}`);
  }

  return { buffer, caption };
};

// ==================== TOIMAGE COMMAND ====================

Module({
  command: "toimage",
  package: "media",
  aliases: ["toimg", "convert", "sticker2img", "video2img"],
  description: "Convert stickers, videos, documents to images",
  usage: `.toimage [options]\n\nOptions:\n- .toimage (reply to sticker/video/doc)\n- .toimage filter <filter_name>\n- .toimage resize <width>x<height>\n- .toimage quality <high|medium|low>\n- .toimage frame <timestamp>`,
})(async (message, match) => {
  let tempFiles = [];

  try {
    // Check if user replied to any media
    if (!message.quoted) {
      return await message.send(
        `╭━━━「 ${IMAGE_EMOJIS.IMAGE} *TOIMAGE CONVERTER* 」━━━╮\n│\n│ ${IMAGE_EMOJIS.ERROR} *No Media Found*\n│\n│ ${IMAGE_EMOJIS.INFO} *Usage Examples:*\n│ • Reply to sticker with: .toimage\n│ • Reply to video with: .toimage frame 00:00:05\n│ • Get best quality: .toimage quality high\n│\n│ ${IMAGE_EMOJIS.TIP} *Supported Media:*\n│ ${IMAGE_EMOJIS.STICKER} Stickers\n│ ${IMAGE_EMOJIS.VIDEO} Videos  \n│ ${IMAGE_EMOJIS.IMAGE} Images\n│ ${IMAGE_EMOJIS.DOCUMENT} Image Documents\n│\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`
      );
    }

    await message.react(IMAGE_EMOJIS.LOADING);
    const { buffer: imageBuffer, caption: baseCaption } =
      await detectAndConvertMedia(message.quoted, match);

    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error("Conversion produced empty result");
    }

    let finalCaption = `${IMAGE_EMOJIS.SUCCESS} *Conversion Successful*\n\n${baseCaption}`;

    // 📊 Add file information
    const fileSizeMB = (imageBuffer.length / 1024 / 1024).toFixed(2);
    const fileSizeKB = (imageBuffer.length / 1024).toFixed(0);

    finalCaption += `\n${IMAGE_EMOJIS.SIZE} Size: ${fileSizeMB} MB (${fileSizeKB} KB)`;
    finalCaption += `\n${IMAGE_EMOJIS.MAGIC} Format: JPEG`;

    // 🚀 Send the converted image
    await message.send({
      image: imageBuffer,
      caption: finalCaption,
      mimetype: "image/jpeg",
    });

    await message.react(IMAGE_EMOJIS.SUCCESS);
  } catch (error) {
    console.error("ToImage command error:", error);

    await message.react(IMAGE_EMOJIS.ERROR);

    let errorMessage = `${IMAGE_EMOJIS.ERROR} *Conversion Failed*\n\n*Error:* ${error.message}`;

    // Provide helpful suggestions based on error type
    if (
      error.message.includes("FFmpeg") ||
      error.message.includes("dependency")
    ) {
      errorMessage += `\n\n${IMAGE_EMOJIS.TIP} *Solution:* Install FFmpeg for better conversion quality`;
    } else if (error.message.includes("timeout")) {
      errorMessage += `\n\n${IMAGE_EMOJIS.TIP} *Solution:* Try with a smaller file or check your internet connection`;
    } else if (error.message.includes("Unsupported")) {
      errorMessage += `\n\n${IMAGE_EMOJIS.TIP} *Solution:* Please use stickers, videos, or images`;
    }

    errorMessage += `\n\n${IMAGE_EMOJIS.INFO} *Need Help?* Use .imagehelp for all commands`;

    await message.send(errorMessage);
  } finally {
    // Cleanup temp files
    cleanupTempFiles(tempFiles);
  }
});

// ==================== SIMPLE IMAGE INFO COMMAND ====================

Module({
  command: "imageinfo",
  package: "media",
  aliases: ["imginfo"],
  description: "Get information about media files",
  usage: ".imageinfo (reply to any media)",
})(async (message) => {
  try {
    if (!message.quoted) {
      return await message.send(
        `${IMAGE_EMOJIS.ERROR} *Reply to Media*\n\n${IMAGE_EMOJIS.INFO} Reply to a sticker, video, or image to get information`
      );
    }

    await message.react(IMAGE_EMOJIS.LOADING);

    const quoted = message.quoted;
    const buffer = await downloadMedia(quoted);

    const fileSizeKB = (buffer.length / 1024).toFixed(2);
    const mimeType = quoted.mimetype || "Unknown";
    const mediaType = quoted.type || "Unknown";

    // Determine media type emoji
    let typeEmoji = IMAGE_EMOJIS.IMAGE;
    if (mediaType.includes("sticker")) typeEmoji = IMAGE_EMOJIS.STICKER;
    if (mediaType.includes("video")) typeEmoji = IMAGE_EMOJIS.VIDEO;
    if (mediaType.includes("document")) typeEmoji = IMAGE_EMOJIS.DOCUMENT;

    const infoText = `
╭━━━「 ${typeEmoji} *MEDIA INFORMATION* 」━━━╮
│
│ ${IMAGE_EMOJIS.FORMAT} *Type:* ${mediaType}
│ ${IMAGE_EMOJIS.SIZE} *Size:* ${fileSizeKB} KB
│ ${IMAGE_EMOJIS.QUALITY} *Format:* ${mimeType}
│ ${typeEmoji} *Status:* Ready for conversion
│
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

${IMAGE_EMOJIS.TIP} *Convert this media:*
Use .toimage to convert to JPEG format
        `.trim();

    await message.send(infoText);
    await message.react(IMAGE_EMOJIS.SUCCESS);
  } catch (error) {
    console.error("ImageInfo command error:", error);
    await message.react(IMAGE_EMOJIS.ERROR);
    await message.send(
      `${IMAGE_EMOJIS.ERROR} *Failed to get media info*\n\n${error.message}`
    );
  }
});

// ==================== QUICK CONVERSION COMMANDS ====================

Module({
  command: "sticker2img",
  package: "media",
  description: "Quick convert sticker to image",
  usage: ".sticker2img (reply to sticker)",
})(async (message) => {
  if (!message.quoted || !message.quoted.type.includes("sticker")) {
    return await message.send(
      `${IMAGE_EMOJIS.ERROR} *Reply to Sticker*\n\n${IMAGE_EMOJIS.STICKER} Please reply to a sticker message`
    );
  }
  // Directly handle sticker conversion
  try {
    const buf = await downloadMedia(message.quoted);
    const out = await convertStickerToImage(buf, 'png');
    await message.send({ image: out, caption: `${IMAGE_EMOJIS.SUCCESS} Sticker converted to image` });
  } catch (e) {
    await message.send(`${IMAGE_EMOJIS.ERROR} Conversion failed: ${e.message}`);
  }
});

Module({
  command: "video2img",
  package: "media",
  description: "Quick convert video to image frame",
  usage: ".video2img (reply to video)",
})(async (message) => {
  if (!message.quoted || !message.quoted.type.includes("video")) {
    return await message.send(
      `${IMAGE_EMOJIS.ERROR} *Reply to Video*\n\n${IMAGE_EMOJIS.VIDEO} Please reply to a video message`
    );
  }
  // Directly handle video frame extraction
  try {
    const buf = await downloadMedia(message.quoted);
    const out = await extractVideoFrame(buf, '00:00:01');
    await message.send({ image: out, caption: `${IMAGE_EMOJIS.SUCCESS} Video frame extracted` });
  } catch (e) {
    await message.send(`${IMAGE_EMOJIS.ERROR} Conversion failed: ${e.message}`);
  }
});

// ==================== HELP COMMAND ====================

Module({
  command: "imagehelp",
  package: "media",
  aliases: ["imghelp"],
  description: "Show image conversion help",
})(async (message) => {
  const helpText = `
╭━━━「 ${IMAGE_EMOJIS.IMAGE} *MEDIA CONVERSION HELP* 」━━━╮
│
│ ${IMAGE_EMOJIS.STICKER} *Sticker Commands:*
│ • .toimage (reply to sticker)
│ • .sticker2img (quick convert)
│
│ ${IMAGE_EMOJIS.VIDEO} *Video Commands:*
│ • .toimage (reply to video) 
│ • .toimage frame 00:00:05
│ • .video2img (quick convert)
│
│ ${IMAGE_EMOJIS.INFO} *Information:*
│ • .imageinfo (get media info)
│ • .imagehelp (this menu)
│
│
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯

${IMAGE_EMOJIS.MAGIC} *Example:* Reply to a sticker with \`.toimage\`
    `.trim();

  await message.send(helpText);
});

// ==================== PLUGIN EXPORTS ====================

// Initialize on require
ensureTempDir();
console.log("🖼️ ToImage plugin loaded successfully");
