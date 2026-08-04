// plugins/antidelete.js
import { Module } from "../lib/plugins.js";
import { db } from "../lib/client.js";

function getBotNum(conn) {
  const raw = conn?.user?.id || "";
  return raw.split("@")[0].split(":")[0].replace(/\D/g, "") || null;
}

Module({
  command: "antidelete",
  package: "owner",
  aliases: ["antidel"],
  description: "Recover deleted messages. Modes: on | off | p | chat | jid:<jid>",
})(async (message, match) => {
  if (!(message.isFromMe || message.isfromMe))
    return message.send("_Only bot owner can use this._");

  const botNum = getBotNum(message.conn);
  if (!botNum) return message.send("❌ Bot number not found.");

  const input = (match || "").trim().toLowerCase();
  const rawInput = (match || "").trim(); // original case for JID
  const key = "antidelete";

  // ── OFF ──────────────────────────────────────────────────────────────────────
  if (input === "off") {
    await message.react("⏳");
    db.delHot(botNum, key);
    await message.react("✅");
    return message.send(
      `🗑️ *AntiDelete* is now \`OFF\`\n\n` +
      `❌ Deleted messages will no longer be recovered.`
    );
  }

  // ── ON / CHAT ─────────────────────────────────────────────────────────────────
  if (input === "on" || input === "chat") {
    await message.react("⏳");
    db.setHot(botNum, key, "chat");
    await message.react("✅");
    return message.send(
      `🗑️ *AntiDelete* is now \`CHAT\`\n\n` +
      `✅ Deleted messages will appear in the *same chat*.`
    );
  }

  // ── P (PRIVATE INBOX) ─────────────────────────────────────────────────────────
  if (input === "p") {
    await message.react("⏳");
    db.setHot(botNum, key, "p");
    await message.react("✅");
    return message.send(
      `🗑️ *AntiDelete* is now \`PRIVATE\`\n\n` +
      `✅ Deleted messages will be sent to *your inbox*.`
    );
  }

  // ── JID (CUSTOM NUMBER / GROUP / NEWSLETTER) ──────────────────────────────────
  if (input.startsWith("jid:")) {
    const targetJid = rawInput.slice(4).trim(); // preserve original case

    if (!targetJid) {
      return message.send(
        `❌ JID দাও।\n\n*Examples:*\n` +
        `• \`.antidelete jid:8801XXXXXXXX@s.whatsapp.net\` — Personal chat\n` +
        `• \`.antidelete jid:120363XXXXXX@g.us\` — Group\n` +
        `• \`.antidelete jid:120363XXXXXX@newsletter\` — Newsletter\n\n` +
        `💡 শুধু number দিলে auto @s.whatsapp.net add হবে।`
      );
    }

    // Auto-fix: only number given → add @s.whatsapp.net
    let finalJid = targetJid;
    if (!finalJid.includes("@")) {
      finalJid = `${finalJid}@s.whatsapp.net`;
    }

    // Validate JID suffix
    const validSuffixes = ["@s.whatsapp.net", "@g.us", "@newsletter"];
    const isValid = validSuffixes.some(s => finalJid.endsWith(s));
    if (!isValid) {
      return message.send(
        `❌ Invalid JID format.\n\n` +
        `Valid suffixes:\n` +
        `• \`@s.whatsapp.net\` — Personal\n` +
        `• \`@g.us\` — Group\n` +
        `• \`@newsletter\` — Newsletter`
      );
    }

    await message.react("⏳");
    db.setHot(botNum, key, `jid:${finalJid}`);
    await message.react("✅");

    const typeLabel = finalJid.endsWith("@g.us")
      ? "👥 Group"
      : finalJid.endsWith("@newsletter")
      ? "📢 Newsletter"
      : "👤 Personal";

    return message.send(
      `🗑️ *AntiDelete* is now \`JID\`\n\n` +
      `✅ Deleted messages will be sent to:\n` +
      `${typeLabel}: \`${finalJid}\``
    );
  }

  // ── STATUS CHECK ──────────────────────────────────────────────────────────────
  const current = db.get(botNum, key, false);

  let statusText  = "❌ OFF";
  let modeDesc    = "";

  if (current === "chat") {
    statusText = "✅ ON — Same Chat";
    modeDesc   = "Deleted messages appear in the same chat.";
  } else if (current === "p") {
    statusText = "✅ ON — Private Inbox";
    modeDesc   = "Deleted messages sent to your inbox.";
  } else if (typeof current === "string" && current.startsWith("jid:")) {
    const jidVal   = current.slice(4);
    const typeLabel = jidVal.endsWith("@g.us")
      ? "👥 Group"
      : jidVal.endsWith("@newsletter")
      ? "📢 Newsletter"
      : "👤 Personal";
    statusText = `✅ ON — Custom JID`;
    modeDesc   = `Deleted messages sent to ${typeLabel}: \`${jidVal}\``;
  }

  return message.send(
    `🗑️ *AntiDelete*\n` +
    `> Status: ${statusText}\n` +
    `${modeDesc ? `> ${modeDesc}\n` : ""}` +
    `\n*Usage:*\n` +
    `• \`.antidelete on\` — same chat\n` +
    `• \`.antidelete chat\` — same chat\n` +
    `• \`.antidelete p\` — your inbox\n` +
    `• \`.antidelete jid:8801XXXXXXXX\` — personal number\n` +
    `• \`.antidelete jid:120363XXXXXX@g.us\` — group\n` +
    `• \`.antidelete jid:120363XXXXXX@newsletter\` — newsletter\n` +
    `• \`.antidelete off\` — disable`
  );
});