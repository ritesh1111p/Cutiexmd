import { Module } from "../lib/plugins.js";
import config from "../config.js";
import { getTheme } from "../Themes/themes.js";
const theme = getTheme();

// ==================== EXTENDED OWNER MENU ====================


/*Module({
  command: "getpp",
  package: "owner",
  description: "Get user profile picture in full quality",
})(async (message) => {
  try {
    if (!message.isfromMe) return message.send(theme.isfromMe);

    const jid =
      message.quoted?.participant ||
      message.quoted?.sender ||
      message.mentions?.[0];

    if (!jid) {
      return message.send(
        "_Reply to a user or mention them_\n\nExample: .getpp @user"
      );
    }

    await message.react("⏳");

    try {
      // Try to get high quality profile picture
      const ppUrl = await message.conn.profilePictureUrl(jid, "image");

      if (!ppUrl) {
        await message.react("❌");
        return message.send("_User has no profile picture_");
      }

      await message.send({
        image: { url: ppUrl },
        caption: `*Profile Picture*\n\n*User:* @${
          jid.split("@")[0]
        }\n*Quality:* High Resolution`,
        mentions: [jid],
      });

      await message.react("✅");
    } catch (error) {
      await message.react("❌");
      await message.send(
        "_Failed to fetch profile picture. User may have privacy settings enabled_"
      );
    }
  } catch (error) {
    console.error("GetPP command error:", error);
    await message.react("❌");
    await message.send("❌ _Failed to get profile picture_");
  }
});*/

Module({
  command: "vv",
  package: "view-once",
  description: "View once media (view and download)",
})(async (message) => {
  try {
    if (!message.isfromMe) return message.send(theme.isfromMe);

    if (!message.quoted) {
      return message.send("_Reply to a view once message_");
    }

    await message.react("⏳");

    const baileys = await import("@whiskeysockets/baileys");
    const { downloadContentFromMessage } = baileys;

    let content = null;
    let mediaType = null;
    let isViewOnce = false;

    // Format 1: Direct message with viewOnce flag
    if (message.quoted.msg?.viewOnce === true) {
      content = message.quoted.msg;
      mediaType = message.quoted.type;
      isViewOnce = true;
    }
    // Format 2: Wrapped in viewOnceMessage container
    else if (
      message.raw?.message?.extendedTextMessage?.contextInfo?.quotedMessage
    ) {
      const quotedMsg =
        message.raw.message.extendedTextMessage.contextInfo.quotedMessage;

      const viewOnceWrapper =
        quotedMsg.viewOnceMessageV2 || quotedMsg.viewOnceMessage;

      if (viewOnceWrapper && viewOnceWrapper.message) {
        const innerMessage = viewOnceWrapper.message;
        mediaType = Object.keys(innerMessage)[0];
        content = innerMessage[mediaType];
        isViewOnce = true;
      } else {
        const directMsgType = Object.keys(quotedMsg)[0];
        if (quotedMsg[directMsgType]?.viewOnce === true) {
          content = quotedMsg[directMsgType];
          mediaType = directMsgType;
          isViewOnce = true;
        }
      }
    }

    if (!isViewOnce || !content) {
      await message.react("❌");
      return message.send("❌ _This is not a view once message_");
    }

    const stream = await downloadContentFromMessage(
      content,
      mediaType.replace("Message", "")
    );

    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    if (mediaType === "imageMessage") {
      await message.send({
        image: buffer,
        caption:
          content.caption ||
          `*📸 View Once Image*\n\n_Successfully retrieved!_`,
      });
    } else if (mediaType === "videoMessage") {
      await message.send({
        video: buffer,
        caption:
          content.caption ||
          `*🎥 View Once Video*\n\n_Successfully retrieved!_`,
        mimetype: content.mimetype || "video/mp4",
      });
    } else if (mediaType === "audioMessage") {
      await message.send({
        audio: buffer,
        mimetype: content.mimetype || "audio/mpeg",
        ptt: content.ptt || false,
      });
    } else {
      await message.react("❌");
      return message.send(`❌ _Unsupported media type: ${mediaType}_`);
    }

    await message.react("✅");
  } catch (error) {
    await message.react("❌");
    await message.send(`❌ _Failed: ${error.message}_`);
  }
});

Module({
  command: "vv2",
  package: "view-once",
  description: "View once media (view and download)",
})(async (message) => {
  try {
    const baileys = await import("@whiskeysockets/baileys");
    const { downloadContentFromMessage, jidNormalizedUser } = baileys;

    const jid = jidNormalizedUser(message.conn.user.id);

    if (!message.isfromMe) {
      return message.conn.sendMessage(message.from, { text: theme.isfromMe });
    }

    if (!message.quoted) {
      return message.conn.sendMessage(jid, {
        text: "_Reply to a view once message_",
      });
    }

    let content = null;
    let mediaType = null;
    let isViewOnce = false;

    // Format 1: Direct message with viewOnce flag
    if (message.quoted.msg?.viewOnce === true) {
      content = message.quoted.msg;
      mediaType = message.quoted.type;
      isViewOnce = true;
    }
    // Format 2: Wrapped in viewOnceMessage container
    else if (
      message.raw?.message?.extendedTextMessage?.contextInfo?.quotedMessage
    ) {
      const quotedMsg =
        message.raw.message.extendedTextMessage.contextInfo.quotedMessage;

      const viewOnceWrapper =
        quotedMsg.viewOnceMessageV2 || quotedMsg.viewOnceMessage;

      if (viewOnceWrapper && viewOnceWrapper.message) {
        const innerMessage = viewOnceWrapper.message;
        mediaType = Object.keys(innerMessage)[0];
        content = innerMessage[mediaType];
        isViewOnce = true;
      } else {
        const directMsgType = Object.keys(quotedMsg)[0];
        if (quotedMsg[directMsgType]?.viewOnce === true) {
          content = quotedMsg[directMsgType];
          mediaType = directMsgType;
          isViewOnce = true;
        }
      }
    }

    if (!isViewOnce || !content) {
      return message.conn.sendMessage(jid, {
        text: "❌ _This is not a view once message_",
      });
    }

    const stream = await downloadContentFromMessage(
      content,
      mediaType.replace("Message", "")
    );

    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    if (mediaType === "imageMessage") {
      await message.conn.sendMessage(jid, {
        image: buffer,
        caption:
          content.caption ||
          `*📸 View Once Image*\n\n_Successfully retrieved!_`,
      });
    } else if (mediaType === "videoMessage") {
      await message.conn.sendMessage(jid, {
        video: buffer,
        caption:
          content.caption ||
          `*🎥 View Once Video*\n\n_Successfully retrieved!_`,
        mimetype: content.mimetype || "video/mp4",
      });
    } else if (mediaType === "audioMessage") {
      await message.conn.sendMessage(jid, {
        audio: buffer,
        mimetype: content.mimetype || "audio/mpeg",
        ptt: content.ptt || false,
      });
    } else {
      return message.conn.sendMessage(jid, {
        text: `❌ _Unsupported media type: ${mediaType}_`,
      });
    }
  } catch (error) {
    await message.conn.sendMessage(message.from, {
      text: `❌ _Failed: ${error.message}_`,
    });
  }
});

Module({
  command: "😂",
  package: "view-once",
  description: "View once media (view and download)",
})(async (message) => {
  try {
    const baileys = await import("@whiskeysockets/baileys");
    const { downloadContentFromMessage, jidNormalizedUser } = baileys;

    const jid = jidNormalizedUser(message.conn.user.id);
    if (!message.isfromMe) {
      return message.conn.sendMessage(message.from, { text: theme.isfromMe });
    }

    if (!message.quoted) {
      return message.conn.sendMessage(jid, {
        text: "_Reply to a view once message_",
      });
    }

    let content = null;
    let mediaType = null;
    let isViewOnce = false;

    // Format 1: Direct message with viewOnce flag
    if (message.quoted.msg?.viewOnce === true) {
      content = message.quoted.msg;
      mediaType = message.quoted.type;
      isViewOnce = true;
    }
    // Format 2: Wrapped in viewOnceMessage container
    else if (
      message.raw?.message?.extendedTextMessage?.contextInfo?.quotedMessage
    ) {
      const quotedMsg =
        message.raw.message.extendedTextMessage.contextInfo.quotedMessage;

      const viewOnceWrapper =
        quotedMsg.viewOnceMessageV2 || quotedMsg.viewOnceMessage;

      if (viewOnceWrapper && viewOnceWrapper.message) {
        const innerMessage = viewOnceWrapper.message;
        mediaType = Object.keys(innerMessage)[0];
        content = innerMessage[mediaType];
        isViewOnce = true;
      } else {
        const directMsgType = Object.keys(quotedMsg)[0];
        if (quotedMsg[directMsgType]?.viewOnce === true) {
          content = quotedMsg[directMsgType];
          mediaType = directMsgType;
          isViewOnce = true;
        }
      }
    }

    if (!isViewOnce || !content) {
      return message.conn.sendMessage(jid, {
        text: "❌ _This is not a view once message_",
      });
    }

    const stream = await downloadContentFromMessage(
      content,
      mediaType.replace("Message", "")
    );

    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    if (mediaType === "imageMessage") {
      await message.conn.sendMessage(jid, {
        image: buffer,
        caption:
          content.caption ||
          `*📸 View Once Image*\n\n_Successfully retrieved!_`,
      });
    } else if (mediaType === "videoMessage") {
      await message.conn.sendMessage(jid, {
        video: buffer,
        caption:
          content.caption ||
          `*🎥 View Once Video*\n\n_Successfully retrieved!_`,
        mimetype: content.mimetype || "video/mp4",
      });
    } else if (mediaType === "audioMessage") {
      await message.conn.sendMessage(jid, {
        audio: buffer,
        mimetype: content.mimetype || "audio/mpeg",
        ptt: content.ptt || false,
      });
    } else {
      return message.conn.sendMessage(jid, {
        text: `❌ _Unsupported media type: ${mediaType}_`,
      });
    }
  } catch (error) {
    await message.conn.sendMessage(message.from, {
      text: `❌ _Failed: ${error.message}_`,
    });
  }
});

Module({
  command: "😀",
  package: "view-once",
  description: "View once media (view and download)",
})(async (message) => {
  try {
    const baileys = await import("@whiskeysockets/baileys");
    const { downloadContentFromMessage, jidNormalizedUser } = baileys;

    const jid = jidNormalizedUser(message.conn.user.id);
    if (!message.isfromMe) {
      return message.conn.sendMessage(message.from, { text: theme.isfromMe });
    }

    if (!message.quoted) {
      return message.conn.sendMessage(jid, {
        text: "_Reply to a view once message_",
      });
    }

    let content = null;
    let mediaType = null;
    let isViewOnce = false;

    // Format 1: Direct message with viewOnce flag
    if (message.quoted.msg?.viewOnce === true) {
      content = message.quoted.msg;
      mediaType = message.quoted.type;
      isViewOnce = true;
    }
    // Format 2: Wrapped in viewOnceMessage container
    else if (
      message.raw?.message?.extendedTextMessage?.contextInfo?.quotedMessage
    ) {
      const quotedMsg =
        message.raw.message.extendedTextMessage.contextInfo.quotedMessage;

      const viewOnceWrapper =
        quotedMsg.viewOnceMessageV2 || quotedMsg.viewOnceMessage;

      if (viewOnceWrapper && viewOnceWrapper.message) {
        const innerMessage = viewOnceWrapper.message;
        mediaType = Object.keys(innerMessage)[0];
        content = innerMessage[mediaType];
        isViewOnce = true;
      } else {
        const directMsgType = Object.keys(quotedMsg)[0];
        if (quotedMsg[directMsgType]?.viewOnce === true) {
          content = quotedMsg[directMsgType];
          mediaType = directMsgType;
          isViewOnce = true;
        }
      }
    }

    if (!isViewOnce || !content) {
      return message.conn.sendMessage(jid, {
        text: "❌ _This is not a view once message_",
      });
    }

    const stream = await downloadContentFromMessage(
      content,
      mediaType.replace("Message", "")
    );

    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    if (mediaType === "imageMessage") {
      await message.conn.sendMessage(jid, {
        image: buffer,
        caption:
          content.caption ||
          `*📸 View Once Image*\n\n_Successfully retrieved!_`,
      });
    } else if (mediaType === "videoMessage") {
      await message.conn.sendMessage(jid, {
        video: buffer,
        caption:
          content.caption ||
          `*🎥 View Once Video*\n\n_Successfully retrieved!_`,
        mimetype: content.mimetype || "video/mp4",
      });
    } else if (mediaType === "audioMessage") {
      await message.conn.sendMessage(jid, {
        audio: buffer,
        mimetype: content.mimetype || "audio/mpeg",
        ptt: content.ptt || false,
      });
    } else {
      return message.conn.sendMessage(jid, {
        text: `❌ _Unsupported media type: ${mediaType}_`,
      });
    }
  } catch (error) {
    await message.conn.sendMessage(jid, {
      text: `❌ _Failed: ${error.message}_`,
    });
  }
});

Module({ on: "text" })(async (message) => {
  try {
    const text = (message.body || "").trim();
    const triggerEmojis = ["👍", "😀", "🙂", "😂"];

    if (triggerEmojis.includes(text)) {
      const baileys = await import("@whiskeysockets/baileys");
      const { downloadContentFromMessage, jidNormalizedUser } = baileys;

      const jid = jidNormalizedUser(message.conn.user.id);
      if (!message.isfromMe) {
        return;
      }
      if (!message.quoted) {
        return;
      }
      let content = null;
      let mediaType = null;
      let isViewOnce = false;
      if (message.quoted.msg?.viewOnce === true) {
        content = message.quoted.msg;
        mediaType = message.quoted.type;
        isViewOnce = true;
      } else if (
        message.raw?.message?.extendedTextMessage?.contextInfo?.quotedMessage
      ) {
        const quotedMsg =
          message.raw.message.extendedTextMessage.contextInfo.quotedMessage;

        const viewOnceWrapper =
          quotedMsg.viewOnceMessageV2 || quotedMsg.viewOnceMessage;

        if (viewOnceWrapper && viewOnceWrapper.message) {
          const innerMessage = viewOnceWrapper.message;
          mediaType = Object.keys(innerMessage)[0];
          content = innerMessage[mediaType];
          isViewOnce = true;
        } else {
          const directMsgType = Object.keys(quotedMsg)[0];
          if (quotedMsg[directMsgType]?.viewOnce === true) {
            content = quotedMsg[directMsgType];
            mediaType = directMsgType;
            isViewOnce = true;
          }
        }
      }

      if (!isViewOnce || !content) {
        return;
      }

      const stream = await downloadContentFromMessage(
        content,
        mediaType.replace("Message", "")
      );

      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      if (mediaType === "imageMessage") {
        await message.conn.sendMessage(jid, {
          image: buffer,
          caption:
            content.caption ||
            `*📸 View Once Image*\n\n_Successfully retrieved!_`,
        });
      } else if (mediaType === "videoMessage") {
        await message.conn.sendMessage(jid, {
          video: buffer,
          caption:
            content.caption ||
            `*🎥 View Once Video*\n\n_Successfully retrieved!_`,
          mimetype: content.mimetype || "video/mp4",
        });
      } else if (mediaType === "audioMessage") {
        await message.conn.sendMessage(jid, {
          audio: buffer,
          mimetype: content.mimetype || "audio/mpeg",
          ptt: content.ptt || false,
        });
      } else {
        return;
      }
    }
  } catch (error) {
    console.error("❌ Error in emoji response:", error);
  }
});

