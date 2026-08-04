import { Module } from "../lib/plugins.js";
import fetch from 'node-fetch';

Module({
    command: 'tiktok',
    package: 'downloader',
    aliases: ['tt', 'tk'],
    description: 'Download TikTok videos without watermark'
})(async (message, match) => {
    const url = match && match.trim() ? match.trim() : null;

    if (!url || !/https?:\/\/(?:www\.|vt\.|vm\.)?tiktok\.com\/[^\s]+/i.test(url)) {
        return message.send('*ᴘʀᴏᴠɪᴅᴇ ᴀ ᴠᴀʟɪᴅ ᴛɪᴋᴛᴏᴋ `ᴜʀʟ`*');
    }

    await message.react('⏳');

    try {
        const apiUrl = `https://social-media-downloader-api-s7.onrender.com/sylove?url=${encodeURIComponent(url)}`;
        const response = await fetch(apiUrl);
        const res = await response.json();

        if (res.status !== 'success' || !res.video_url) {
            await message.react('❌');
            return message.send('*ꜰᴀɪʟᴇᴅ ᴛᴏ ꜰᴇᴛᴄʜ ᴠɪᴅᴇᴏ, ᴛʀʏ ᴀɢᴀɪɴ ʟᴀᴛᴇʀ*');
        }

        const title = res.title || 'No Title';
        const author = res.author?.nickname || res.author?.username || 'Unknown';
        const likes = res.statistics?.likes || 0;
        const shares = res.statistics?.shares || 0;

        const caption = `> *𝚳𝚯𝚯𝚴-𝚾 𝚾𝐃*`;

        await message.send({
            video: { url: res.video_url },
            caption: caption,
            contextInfo: {
                externalAdReply: {
                    title: "𝚳𝚯𝚯𝚴-𝚾 𝚾𝐃 𝑻𝑰𝑲𝑻𝑶𝑲 𝑫𝑳",
                    body: `ᴘᴏᴡᴇʀᴇᴅ ʙʏ sᴀʏᴀɴ`,
                    mediaType: 1,
                    thumbnailUrl: "https://ibb.co/WYNWBMx",
                    sourceUrl: url,
                    renderLargerThumbnail: false
                }
            }
        });

        await message.react('✅');

    } catch (err) {
        console.error('TikTok DL error:', err);
        await message.react('❌');
        await message.send('*ᴇʀʀᴏʀ*');
    }
});
