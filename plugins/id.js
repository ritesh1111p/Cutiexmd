import { Module } from "../lib/plugins.js";

Module({
  command: "checkid",
  aliases: ["cekid", "getid", "id"],
  description: "Get WhatsApp Group or Channel ID from invite link",
})(async (message, match) => {
  try {
    if (!match) {
      return message.send(
        "*ᴡʜᴀᴛꜱᴀᴘᴘ ɢʀᴏᴜᴘ ʟɪɴᴋ / ᴄʜᴀɴɴᴇʟ ʟɪɴᴋ* \n\n*ᴇxᴀᴍᴘʟᴇ:*\n.checkid https://chat.whatsapp.com/xxxx"
      );
    }

    await message.react("⌛");

    // Extract WhatsApp link
    const linkMatch = match.match(
      /https?:\/\/(chat\.whatsapp\.com|whatsapp\.com\/channel)\/[^\s]+/i
    );

    if (!linkMatch) {
      await message.react("❌");
      return message.send("*ꜱᴇɴᴅ ᴠᴀʟɪᴅ ᴡʜᴀᴛꜱᴀᴘᴘ ɢʀᴏᴜᴘ / ᴄʜᴀɴɴᴇʟ ʟɪɴᴋ*");
    }

    const link = linkMatch[0];
    const url = new URL(link);

    // ================= GROUP =================
    if (url.hostname === "chat.whatsapp.com") {
      const code = url.pathname.replace("/", "");
      const res = await message.client.groupGetInviteInfo(code);
      const id = res.id;

      await message.react("✅");
      return message.send(`
*ɢʀᴏᴜᴘ ʟɪɴᴋ ᴀɴᴀʟʏꜱɪꜱ*

*ʟɪɴᴋ:* ${link}
*ɢʀᴏᴜᴘ ɪᴅ:*
\`${id}\`

*ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍᴏᴏɴ x xᴅ*
`.trim());
    }

    // ================= CHANNEL =================
    if (url.pathname.startsWith("/channel/")) {
      const code = url.pathname.split("/channel/")[1];
      const res = await message.client.newsletterMetadata(
        "invite",
        code,
        "GUEST"
      );
      const id = res.id;

      await message.react("✅");
      return message.send(`
*ᴄʜᴀɴɴᴇʟ ʟɪɴᴋ ᴀɴᴀʟʏꜱɪꜱ*

*ʟɪɴᴋ:* ${link}
*ᴄʜᴀɴɴᴇʟ ɪᴅ:*
\`${id}\`

*ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴍᴏᴏɴ x xᴅ*
`.trim());
    }

    await message.react("❌");
    message.send("❌ Unsupported WhatsApp link");

  } catch (err) {
    console.error("[CHECKID ERROR]", err);
    await message.react("❌");
    message.send("*ʟɪɴᴋ ɪɴᴠᴀʟɪᴅ ᴏʀ `ᴇxᴘɪʀᴇᴅ`*");
  }
});
