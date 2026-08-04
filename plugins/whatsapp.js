// filename: plugins/owner.js
import { Module } from "../lib/plugins.js";
import config from "../config.js";
import { getTheme } from "../Themes/themes.js";
// static baileys helpers (static import as requested)
import { jidNormalizedUser, areJidsSameUser } from "@whiskeysockets/baileys";

const theme = getTheme();

// Utility: normalize JID from number or existing jid
function normalizeJid(input) {
  if (!input) return null;
  // if input is already a jid-like string
  if (String(input).includes("@")) return jidNormalizedUser(String(input));
  // otherwise treat as phone number
  const number = String(input).replace(/[^0-9]/g, "");
  return number ? jidNormalizedUser(`${number}@s.whatsapp.net`) : null;
}

// Owner-only check uses message.isfromMe to keep compatibility with your serializer
// All responses are English only.

/////////////////////// USER MANAGEMENT ///////////////////////
Module({
  command: "block",
  package: "owner",
  description: "Block a user",
  usage: ".block <reply|tag|number>",
})(async (message, match) => {
  try {
    if (!message.isfromMe) return message.send(theme.isfromMe);
    // Resolve JID: reply > @mention > number in match
    let jid =
      message.quoted?.participant ||
      message.quoted?.participantAlt ||
      message.quoted?.sender ||
      (Array.isArray(message.mentions) && message.mentions[0]) ||
      (match ? normalizeJid(match.trim()) : null);

    if (!jid) {
      return message.send(
        "❌ Reply to a user, mention them, or provide number\n\nExample:\n• .block (reply)\n• .block @user\n• .block 917980046966"
      );
    }
    jid = jidNormalizedUser(jid);

    await message.react("⏳");
    await message.conn.updateBlockStatus(jid, "block");
    await message.react("✅");
    await message.send(
      `✅ User blocked\n\n@${jid.split("@")[0]} has been blocked.`,
      {
        mentions: [jid],
      }
    );
  } catch (err) {
    console.error("Block command error:", err);
    await message.react("❌");
    await message.send("❌ Failed to block user");
  }
});

Module({
  command: "unblock",
  package: "owner",
  description: "Unblock a user",
  usage: ".unblock <reply|tag|number>",
})(async (message, match) => {
  try {
    if (!message.isfromMe) return message.send(theme.isfromMe);
    let jid =
      message.quoted?.participant ||
      message.quoted?.participantAlt ||
      message.quoted?.sender ||
      (Array.isArray(message.mentions) && message.mentions[0]) ||
      (match ? normalizeJid(match.trim()) : null);

    if (!jid) {
      return message.send(
        "❌ Reply to a user, mention them, or provide number\n\nExample:\n• .unblock (reply)\n• .unblock @user\n• .unblock 917980046966"
      );
    }
    jid = jidNormalizedUser(jid);

    await message.react("⏳");
    await message.conn.updateBlockStatus(jid, "unblock");
    await message.react("✅");
    await message.send(
      `✅ User unblocked\n\n@${jid.split("@")[0]} has been unblocked.`,
      {
        mentions: [jid],
      }
    );
  } catch (err) {
    console.error("Unblock command error:", err);
    await message.react("❌");
    await message.send("❌ Failed to unblock user");
  }
});

Module({
  command: "blocklist",
  package: "owner",
  description: "Get list of blocked users",
})(async (message) => {
  try {
    if (!message.isfromMe) return message.send(theme.isfromMe);
    await message.react("⏳");
    const blockedUsers = (await message.conn.fetchBlocklist()) || [];
    if (!Array.isArray(blockedUsers) || blockedUsers.length === 0) {
      await message.react("ℹ️");
      return message.send("ℹ️ No blocked users");
    }

    let text = "╭━━━「 BLOCKED USERS 」━━━╮\n";
    const showCount = Math.min(blockedUsers.length, 50);
    for (let i = 0; i < showCount; i++) {
      text += `┃ ${i + 1}. @${String(blockedUsers[i]).split("@")[0]}\n`;
    }
    text += `╰━━━━━━━━━━━━━━━━━━━━╯\n\nTotal: ${blockedUsers.length}`;
    if (blockedUsers.length > 50) {
      text += `\n_Showing first 50 of ${blockedUsers.length}_`;
    }

    await message.react("✅");
    await message.send(text, { mentions: blockedUsers.slice(0, 50) });
  } catch (err) {
    console.error("Blocklist command error:", err);
    await message.react("❌");
    await message.send("❌ Failed to fetch blocklist");
  }
});

Module({
  command: "unblockall",
  package: "owner",
  description: "Unblock all blocked users",
})(async (message) => {
  try {
    if (!message.isfromMe) return message.send(theme.isfromMe);
    const blocklist = (await message.conn.fetchBlocklist()) || [];
    if (!Array.isArray(blocklist) || blocklist.length === 0) {
      return message.send("ℹ️ No blocked users");
    }

    await message.react("⏳");
    await message.send(`⏳ Unblocking ${blocklist.length} users...`);
    let unblocked = 0;
    let failed = 0;
    for (const jid of blocklist) {
      try {
        if (typeof message.conn.updateBlockStatus === "function") {
          await message.conn.updateBlockStatus(jid, "unblock");
        } else if (typeof message.unblockUser === "function") {
          await message.unblockUser(jid);
        }
        unblocked++;
        await new Promise((r) => setTimeout(r, 500));
      } catch (e) {
        failed++;
      }
    }
    await message.react("✅");
    await message.send(
      `✅ Unblock complete\n\n• Unblocked: ${unblocked}\n• Failed: ${failed}`
    );
  } catch (err) {
    console.error("UnblockAll command error:", err);
    await message.react("❌");
    await message.send("❌ Failed to unblock users");
  }
});

/////////////////////// PROFILE / NAME / BIO ///////////////////////
Module({
  command: "setpp",
  package: "owner",
  aliases: ["setdp", "setprofile", "pp", "gpp"],
  description: "Set bot profile picture",
  usage: ".setpp <reply to image | url>",
})(async (message, match) => {
  try {
    if (!message.isfromMe) return message.send(theme.isfromMe);
    let img = null;
    if (match && match.startsWith("http")) {
      // pass URL directly — Baileys handles download internally
      img = { url: match };
    } else if (message.type === "imageMessage") {
      img = await message.download();
    } else if (message.quoted?.type === "imageMessage") {
      img = await message.quoted.download();
    } else {
      return message.send("❌ Send image, reply to image, or provide URL");
    }

    await message.react("⏳");
    const botJid = jidNormalizedUser(message.conn.user?.id || "");
    await message.conn.updateProfilePicture(botJid, img);
    await message.react("✅");
    await message.send("✅ Profile picture updated");
  } catch (err) {
    console.error("SetPP command error:", err);
    await message.react("❌");
    await message.send("❌ Failed to update profile picture");
  }
});

Module({
  command: "removepp",
  package: "owner",
  aliases: ["removedp", "deletepp"],
  description: "Remove bot profile picture",
})(async (message) => {
  try {
    if (!message.isfromMe) return message.send(theme.isfromMe);
    await message.react("⏳");
    const botJid = jidNormalizedUser(message.conn.user?.id || "");
    if (typeof message.conn.removeProfilePicture === "function") {
      await message.conn.removeProfilePicture(botJid);
    } else {
      // Baileys doesn't support remove natively — inform user
      await message.react("❌");
      return message.send("❌ Your Baileys version does not support removing profile picture");
    }
    await message.react("✅");
    await message.send("✅ Profile picture removed");
  } catch (err) {
    console.error("RemovePP command error:", err);
    await message.react("❌");
    await message.send("❌ Failed to remove profile picture");
  }
});

Module({
  command: "setname",
  package: "owner",
  description: "Set bot display name",
  usage: ".setname <name>",
})(async (message, match) => {
  try {
    if (!message.isfromMe) return message.send(theme.isfromMe);
    if (!match || !match.trim()) {
      return message.send("❌ Provide new name\n\nExample: .setname MyBot");
    }
    if (match.length > 25)
      return message.send("❌ Name too long (max 25 characters)");
    await message.react("⏳");
    if (typeof message.conn.updateProfileName === "function") {
      await message.conn.updateProfileName(match.trim());
    }
    await message.react("✅");
    await message.send(`✅ Name updated\n\nNew name: ${match.trim()}`);
  } catch (err) {
    console.error("SetName command error:", err);
    await message.react("❌");
    await message.send("❌ Failed to update name");
  }
});

Module({
  command: "myname",
  package: "owner",
  description: "Get bot's current name",
})(async (message) => {
  try {
    if (!message.isfromMe) return message.send(theme.isfromMe);
    const botName =
      message.conn.user?.name ||
      message.conn.user?.verifiedName ||
      "Name not set";
    await message.send(`👤 My Current Name\n\n${botName}`);
  } catch (err) {
    console.error("MyName command error:", err);
    await message.send("❌ Failed to get my name");
  }
});

Module({
  command: "setbio",
  package: "owner",
  aliases: ["setstatus", "setabout", "bio", "about"],
  description: "Set bot status/bio",
  usage: ".setbio <text>",
})(async (message, match) => {
  try {
    if (!message.isfromMe) return message.send(theme.isfromMe);
    if (!match || !match.trim())
      return message.send("❌ Provide bio text\n\nExample: .setbio Hello");
    if (match.length > 139)
      return message.send("❌ Bio too long (max 139 characters)");
    await message.react("⏳");
    if (typeof message.conn.updateProfileStatus === "function") {
      await message.conn.updateProfileStatus(match.trim());
    }
    await message.react("✅");
    await message.send(`✅ Bio updated\n\n${match.trim()}`);
  } catch (err) {
    console.error("SetBio command error:", err);
    await message.react("❌");
    await message.send("❌ Failed to update bio");
  }
});

Module({
  command: "mystatus",
  package: "owner",
  aliases: ["mybio"],
  description: "Get bot's current status/bio",
})(async (message) => {
  try {
    if (!message.isfromMe) return message.send(theme.isfromMe);
    const myJid = jidNormalizedUser(message.conn.user?.id || "");
    const status = await message.conn.fetchStatus(myJid).catch(() => null);
    const bioText = status?.status || "_No status set_";
    const setDate = status?.setAt
      ? new Date(status.setAt).toLocaleDateString()
      : "Unknown";
    await message.send(`📝 My Status\n\n${bioText}\n\nSet on: ${setDate}`);
  } catch (err) {
    console.error("MyStatus command error:", err);
    await message.send("❌ Failed to get status");
  }
});

Module({
  command: "getbio",
  package: "owner",
  aliases: ["bio", "getstatus"],
  description: "Get bio/status of a user",
  usage: ".getbio <reply|tag>",
})(async (message) => {
  try {
    if (!message.isfromMe) return message.send(theme.isfromMe);
    const jid =
      message.quoted?.participant ||
      message.quoted?.participantAlt ||
      message.quoted?.sender ||
      message.mentions?.[0] ||
      message.sender;
    await message.react("⏳");
    const status = await message.conn.fetchStatus(jid).catch(() => null);
    await message.react("✅");
    const bioText = status?.status || "_No bio set_";
    const setDate = status?.setAt
      ? new Date(status.setAt).toLocaleDateString()
      : "Unknown";
    await message.send(
      `╭━━━「 USER BIO 」━━━╮\n┃\n┃ 👤 User: @${
        jid.split("@")[0]
      }\n┃\n┃ 📝 Bio:\n┃ ${bioText}\n┃\n┃ 📅 Set on: ${setDate}\n┃\n╰━━━━━━━━━━━━━━━━━━╯`,
      { mentions: [jid] }
    );
  } catch (err) {
    console.error("GetBio command error:", err);
    await message.react("❌");
    await message.send("❌ Failed to fetch bio");
  }
});

Module({
  command: "getname",
  package: "owner",
  description: "Get username of mentioned user",
  usage: ".getname <reply|tag>",
})(async (message) => {
  try {
    if (!message.isfromMe) return message.send(theme.isfromMe);
    const jid =
      message.quoted?.participant ||
      message.quoted?.participantAlt ||
      message.quoted?.sender ||
      message.mentions?.[0];
    if (!jid) return message.send("❌ Reply to or mention a user");
    let groupName = null;
    if (message.isGroup) {
      await message.loadGroupInfo();
      const participant = (message.groupParticipants || []).find((p) =>
        areJidsSameUser(p.id, jid)
      );
      groupName = participant?.notify || participant?.name || null;
    }
    const name = groupName || jid.split("@")[0];
    await message.send(
      `╭━━━「 USERNAME INFO 」━━━╮\n┃\n┃ 👤 User: @${
        jid.split("@")[0]
      }\n┃ 📝 Name: ${name}\n┃ 📍 Source: ${
        groupName ? "Group" : "Number"
      }\n┃\n╰━━━━━━━━━━━━━━━━━━╯`,
      { mentions: [jid] }
    );
  } catch (err) {
    console.error("GetName command error:", err);
    await message.send("❌ Failed to get username");
  }
});

/////////////////////// BROADCAST & MESSAGING ///////////////////////
Module({
  command: "broadcast",
  package: "owner",
  aliases: ["bc"],
  description: "Broadcast message to all chats",
  usage: ".broadcast <message>",
})(async (message, match) => {
  try {
    if (!message.isfromMe) return message.send(theme.isfromMe);
    if (!match)
      return message.send(
        "❌ Provide broadcast message\n\nExample: .broadcast Important announcement!"
      );
    await message.react("⏳");
    const chats = await message.conn.groupFetchAllParticipating();
    const groups = Object.values(chats || {});
    await message.send(
      `📢 Broadcasting...\n\nSending to ${groups.length} group(s)`
    );
    let sent = 0;
    let failed = 0;
    for (const group of groups) {
      try {
        await message.conn.sendMessage(group.id, {
          text: `📢 BROADCAST MESSAGE\n\n${match}`,
        });
        sent++;
        await new Promise((r) => setTimeout(r, 1000));
      } catch (e) {
        failed++;
        console.error(`Failed to send to ${group.id}:`, e);
      }
    }
    await message.react("✅");
    await message.send(
      `✅ Broadcast Complete!\n\n• Total: ${groups.length}\n• Sent: ${sent}\n• Failed: ${failed}`
    );
  } catch (err) {
    console.error("Broadcast command error:", err);
    await message.react("❌");
    await message.send("❌ Failed to broadcast message");
  }
});

Module({
  command: "forward",
  package: "owner",
  description: "Forward quoted message to a chat",
  usage: ".forward <number>",
})(async (message, match) => {
  try {
    if (!message.isfromMe) return message.send(theme.isfromMe);
    if (!message.quoted)
      return message.send("❌ Reply to a message to forward");
    if (!match)
      return message.send(
        "❌ Provide target number\n\nExample: .forward 1234567890"
      );

    const number = match.replace(/[^0-9]/g, "");
    if (!number) return message.send("❌ Invalid number");
    const targetJid = jidNormalizedUser(`${number}@s.whatsapp.net`);
    await message.react("⏳");

    // Use raw WAMessage for forward
    const rawMsg = message.quoted?.raw ?? message.quoted;
    if (!rawMsg) return message.send("❌ Could not read quoted message");

    // Baileys 7: forward via copyNMessageList or direct relay
    try {
      // preferred: built-in forward
      await message.conn.sendMessage(targetJid, {
        forward: rawMsg,
        force: true,
      });
    } catch {
      // fallback: relay the message content directly
      const qt = message.quoted?.type || "";
      const body = message.quoted?.body;
      if (body) {
        await message.conn.sendMessage(targetJid, { text: body });
      } else if (qt && qt !== "conversation") {
        try {
          const buf = await message.quoted.download();
          const mime = message.quoted.msg?.mimetype || "";
          const mediaKey = qt.replace("Message", "");
          await message.conn.sendMessage(targetJid, {
            [mediaKey]: buf,
            mimetype: mime,
          });
        } catch (e2) {
          throw new Error("Forward fallback failed: " + e2.message);
        }
      }
    }

    await message.react("✅");
    await message.send(`✅ Message forwarded to @${number}`, {
      mentions: [targetJid],
    });
  } catch (err) {
    console.error("Forward command error:", err);
    await message.react("❌");
    await message.send("❌ Failed to forward message");
  }
});

/////////////////////// GROUP MANAGEMENT ///////////////////////
Module({
  command: "join",
  package: "owner",
  description: "Join group via invite link",
  usage: ".join <invite link>",
})(async (message, match) => {
  try {
    if (!message.isfromMe) return message.send(theme.isfromMe);
    if (!match)
      return message.send(
        "❌ Provide WhatsApp group invite link\n\nExample:\n.join https://chat.whatsapp.com/xxxxx"
      );
    const inviteCode = match.match(
      /chat.whatsapp.com\/([0-9A-Za-z]{20,24})/i
    )?.[1];
    if (!inviteCode) return message.send("❌ Invalid invite link format");
    await message.react("⏳");
    const info = await message.conn.groupGetInviteInfo(inviteCode);
    await message.send(
      `╭━━━「 GROUP INFO 」━━━╮\n┃\n┃ Name: ${info.subject}\n┃ Members: ${
        info.size
      }\n┃ Created: ${new Date(
        info.creation * 1000
      ).toLocaleDateString()}\n┃\n╰━━━━━━━━━━━━━━━━━━╯\n\nJoining group...`
    );
    await message.conn.groupAcceptInvite(inviteCode);
    await message.react("✅");
    await message.send("✅ Successfully joined the group!");
  } catch (err) {
    console.error("Join command error:", err);
    await message.react("❌");
    await message.send(
      "❌ Failed to join group\n\nPossible reasons:\n• Invalid or expired link\n• Already in group\n• Group is full"
    );
  }
});

Module({
  command: "leaveall",
  package: "owner",
  description: "Leave all groups except specified",
  usage: ".leaveall <exception1,exception2>",
})(async (message, match) => {
  try {
    if (!message.isfromMe) return message.send(theme.isfromMe);
    const chats = await message.conn.groupFetchAllParticipating();
    const groups = Object.values(chats || {});
    if (groups.length === 0) return message.send("ℹ️ Bot is not in any groups");
    const exceptions = match ? match.split(",").map((e) => e.trim()) : [];
    let left = 0;
    let kept = 0;
    await message.send(
      `⚠️ Leaving Groups...\n\nTotal: ${groups.length} groups\nExceptions: ${exceptions.length}`
    );
    for (const group of groups) {
      try {
        const isException = exceptions.some(
          (e) =>
            group.subject?.toLowerCase().includes(e.toLowerCase()) ||
            group.id.includes(e)
        );
        if (isException) {
          kept++;
          continue;
        }
        if (typeof message.conn.groupLeave === "function") {
          await message.conn.groupLeave(group.id);
          left++;
          await new Promise((r) => setTimeout(r, 1000));
        }
      } catch (e) {
        console.error(`Failed to leave group ${group.id}:`, e);
      }
    }
    await message.send(
      `✅ Leave All Complete\n\n• Left: ${left} groups\n• Kept: ${kept} groups`
    );
  } catch (err) {
    console.error("LeaveAll command error:", err);
    await message.send("❌ Failed to leave groups");
  }
});

Module({
  command: "listgc",
  package: "owner",
  aliases: ["grouplist"],
  description: "List all group chats",
})(async (message) => {
  try {
    if (!message.isfromMe) return message.send(theme.isfromMe);
    const chats = await message.conn.groupFetchAllParticipating();
    const groups = Object.values(chats || {});
    if (groups.length === 0) return message.send("ℹ️ Bot is not in any groups");
    let text = "╭━━━「 GROUP LIST 」━━━╮\n┃\n";
    const showCount = Math.min(groups.length, 50);
    for (let i = 0; i < showCount; i++) {
      const group = groups[i];
      text += `┃ ${i + 1}. ${group.subject}\n┃    ID: ${
        String(group.id).split("@")[0]
      }\n┃    Members: ${group.participants?.length || "N/A"}\n┃\n`;
    }
    text += "╰━━━━━━━━━━━━━━━━━━╯\n\nTotal: " + groups.length;
    if (groups.length > 50)
      text += `\n\n_Showing first 50 of ${groups.length} groups_`;
    await message.send(text);
  } catch (err) {
    console.error("ListGC command error:", err);
    await message.send("❌ Failed to list groups");
  }
});

/////////////////////// UTILITY ///////////////////////
Module({
  command: "save",
  package: "owner",
  description: "Save quoted message (3 fallback system)",
})(async (message) => {
  try {
    if (!message.isfromMe)
      return message.send("❌ Only owner");

    if (!message.quoted)
      return message.send("❌ Reply to a message");

    const client = message.conn;
    const myJid = jidNormalizedUser(client.user.id);

    const quoted = message.quoted;
    const msg = quoted.message;
    const type = quoted.type;

    let saved = false;

    // 🥇 1️⃣ forwardMessage (custom / fast)
    try {
      if (client.forwardMessage) {
        await client.forwardMessage(myJid, msg);
        saved = true;
      }
    } catch (e) {
      console.log("forwardMessage failed");
    }

    // 🥈 2️⃣ copyNForward (official best)
    if (!saved) {
      try {
        await client.copyNForward(myJid, msg);
        saved = true;
      } catch (e) {
        console.log("copyNForward failed");
      }
    }

    // 🥉 3️⃣ buffer fallback (ultimate)
    if (!saved) {
      try {
        // TEXT
        if (
          !type ||
          type === "conversation" ||
          type === "extendedTextMessage"
        ) {
          await client.sendMessage(myJid, {
            text: quoted.body || "",
          });
          saved = true;
        } else {
          const buffer = await quoted.download();

          if (!buffer) throw "Download failed";

          const mimetype =
            quoted.mimetype || quoted.msg?.mimetype;

          let data = {};

          if (type === "imageMessage") {
            data = {
              image: buffer,
              caption: quoted.caption || "",
            };
          } else if (type === "videoMessage") {
            data = {
              video: buffer,
              caption: quoted.caption || "",
            };
          } else if (type === "audioMessage") {
            data = {
              audio: buffer,
              mimetype: mimetype || "audio/mpeg",
              ptt: quoted.ptt || false,
            };
          } else if (type === "documentMessage") {
            data = {
              document: buffer,
              mimetype:
                mimetype || "application/octet-stream",
              fileName:
                quoted.fileName || `saved_${Date.now()}`,
            };
          } else if (type === "stickerMessage") {
            data = {
              sticker: buffer,
            };
          } else {
            data = {
              text: quoted.body || "Unsupported message",
            };
          }

          await client.sendMessage(myJid, data);
          saved = true;
        }
      } catch (e) {
        console.log("Buffer fallback failed");
      }
    }

    // ❌ সব fail
    if (!saved) {
      return message.send("❌ Failed to save message");
    }

    await message.react("✅");
    await message.send("✅ Saved successfully");

  } catch (err) {
    console.error("Save command error:", err);
    await message.send("❌ Error saving message");
  }
});
// 
Module({
  command: "quoted",
  package: "owner",
  aliases: ["q"],
  description: "Get quoted message info",
  usage: ".quoted <reply to message>",
})(async (message) => {
  try {
    if (!message.isfromMe) return message.send(theme.isfromMe);
    if (!message.quoted) return message.send("❌ Reply to a message");
    const q = message.quoted;
    const sender =
      q.participant || q.participantAlt || q.sender || message.sender;
    const info = `╭━━━「 QUOTED INFO 」━━━╮
┃
┃ Type: ${q.type}
┃ From: @${String(sender).split("@")[0]}
┃ Message ID: ${q.id}
┃ Timestamp: ${new Date(q.key?.timestamp || Date.now()).toLocaleString()}
${q.body ? `┃\n┃ Message:\n┃ ${q.body}` : ""}
┃
╰━━━━━━━━━━━━━━━━━━╯`;
    await message.send(info, { mentions: [sender] });
  } catch (err) {
    console.error("Quoted command error:", err);
    await message.send("❌ Failed to get quoted info");
  }
});

Module({
  command: "jid",
  package: "owner",
  description: "Get JID of user or group",
  usage: ".jid <reply|tag>",
})(async (message) => {
  try {
    if (!message.isfromMe) return message.send(theme.isfromMe);
    const jid =
      message.quoted?.participant ||
      message.quoted?.participantAlt ||
      message.quoted?.sender ||
      message.mentions?.[0] ||
      message.from;
    await message.send(`📋 JID Information\n\n\`\`\`${jid}\`\`\``);
  } catch (err) {
    console.error("JID command error:", err);
    await message.send("❌ Failed to get JID");
  }
});

/////////////////////// NEW: getpp / whois / delme / clearall ///////////////////////

Module({
  command: "getpp",
  package: "owner",
  description: "Get profile picture of a user (reply/tag/number)",
  usage: ".getpp <reply|tag|number>",
})(async (message, match) => {
  try {
    if (!message.isfromMe) return message.send(theme.isfromMe);
    const target =
      message.quoted?.participant ||
      message.quoted?.participantAlt ||
      message.quoted?.sender ||
      message.mentions?.[0] ||
      (match ? normalizeJid(match) : null) ||
      message.sender;
    if (!target) return message.send("❌ Provide a user (reply/tag/number)");
    await message.react("⏳");
    const url = await message.conn
      .profilePictureUrl(target, "image")
      .catch(() => null);
    if (!url) {
      await message.react("ℹ️");
      return message.send(
        `ℹ️ No profile picture found for @${String(target).split("@")[0]}`,
        { mentions: [target] }
      );
    }
    await message.conn.sendMessage(message.from, {
      image: { url: url },
      caption: `📷 Profile picture of @${String(target).split("@")[0]}`,
      mentions: [target],
    });
    await message.react("✅");
  } catch (err) {
    console.error("getpp error:", err);
    await message.react("❌");
    await message.send("❌ Failed to get profile picture");
  }
});

Module({
  command: "whois",
  package: "owner",
  description: "Get basic info about a user",
  usage: ".whois <reply|tag|number>",
})(async (message, match) => {
  try {
    if (!message.isfromMe) return message.send(theme.isfromMe);
    const target =
      message.quoted?.participant ||
      message.quoted?.participantAlt ||
      message.quoted?.sender ||
      message.mentions?.[0] ||
      (match ? normalizeJid(match) : null) ||
      message.sender;
    if (!target) return message.send("❌ Provide a user (reply/tag/number)");
    await message.react("⏳");
    const status = await message.conn.fetchStatus(target).catch(() => null);
    const ppUrl = await message.conn
      .profilePictureUrl(target, "image")
      .catch(() => null);
    let roleText = "Member";
    if (message.isGroup) {
      await message.loadGroupInfo();
      const isAdmin = (message.groupAdmins || []).some((a) =>
        String(a).includes(String(target))
      );
      roleText = isAdmin ? "Group Admin" : "Member";
    }
    const out = [
      `👤 WHOIS: @${String(target).split("@")[0]}`,
      `• Name: ${String(target).split("@")[0]}`,
      `• Role: ${roleText}`,
      `• Bio: ${status?.status || "_No bio set_"}`,
      `• Profile: ${ppUrl ? "Available" : "Not found"}`,
    ].join("\n");
    await message.react("✅");

    if (ppUrl) {
      await message.conn.sendMessage(message.from, {
        image: { url: ppUrl },
        caption: out,
        mentions: [target],
      });
    } else {
      await message.send(out, { mentions: [target] });
    }
  } catch (err) {
    console.error("Whois error:", err);
    await message.react("❌");
    await message.send("❌ Failed to fetch user info");
  }
});

Module({
  command: "del",
  package: "owner",
  aliases: ["delete"],
  description: "Delete a quoted message (bot owner)",
  usage: ".del (reply to message)",
})(async (message) => {
  try {
    if (!message.isfromMe) return message.send(theme.isfromMe);
    if (!message.quoted) return message.send("❌ Reply to a message to delete");
    try {
      await message.send({ delete: message.quoted.key });
      await message.react("✅");
      await message.send("✅ Message deleted");
    } catch (e) {
      console.warn("del send failed, trying fallback:", e?.message || e);
      try {
        await message.conn.sendMessage(message.from, {
          delete: message.quoted.key,
        });
        await message.react("✅");
        await message.send("✅ Message deleted (fallback)");
      } catch (err2) {
        console.error("del fallback error:", err2);
        await message.react("❌");
        await message.send("❌ Failed to delete message");
      }
    }
  } catch (err) {
    console.error("Del command fatal:", err);
    await message.send("❌ Error");
  }
});

Module({
  command: "delme",
  package: "owner",
  description:
    "Delete your quoted message (owner tries to remove the quoted message)",
  usage: ".delme (reply to your message)",
})(async (message) => {
  try {
    if (!message.isfromMe) return message.send(theme.isfromMe);
    if (!message.quoted) return message.send("❌ Reply to your message");
    try {
      await message.send({ delete: message.quoted.key });
      await message.react("✅");
      await message.send("✅ Deleted the quoted message (if permitted)");
    } catch (err) {
      console.error("delme error:", err);
      await message.react("❌");
      await message.send(
        "❌ Failed to delete quoted message (permission may be denied)"
      );
    }
  } catch (err) {
    console.error("DelMe fatal:", err);
    await message.send("❌ Error");
  }
});



Module({
  command: "fullpp",
  package: "owner",
  aliases: ["setdp", "setprofile", "pp", "gpp"],
  description: "Set bot profile picture",
  usage: ".setpp <reply to image | url>",
})(async (message, match) => {
  try {
    if (!message.isfromMe) return message.send(theme.isfromMe);

    let media;

    // ✅ URL case
    if (match && match.startsWith("http")) {
      const axios = require("axios");
      const res = await axios.get(match, {
        responseType: "arraybuffer",
      });
      media = Buffer.from(res.data);
    }

    // ✅ Direct image
    else if (message.type === "imageMessage") {
      media = await message.conn.downloadMediaMessage(message);
    }

    // ✅ Reply image
    else if (message.quoted?.type === "imageMessage") {
      media = await message.conn.downloadMediaMessage(message.quoted);
    }

    else {
      return message.send("❌ Send image, reply to image, or provide URL");
    }

    if (!media) return message.send("❌ Image not found");

    await message.react("⏳");

    // 🔥 EXACTLY YOUR REQUIRED LINE
    await message.conn.updateProfilePicture(
      message.conn.user.id,
      media
    );

    await message.react("✅");
    await message.send("✅ Profile picture updated");

  } catch (err) {
    console.error("SetPP command error:", err);
    await message.react("❌");
    await message.send("❌ Failed to update profile picture");
  }
});
