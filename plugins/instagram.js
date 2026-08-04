import { Module } from '../lib/plugins.js'

Module({
  command: 'insta',
  package: 'downloader',
  description: 'Download Instagram photo/video'
})(async (message, match) => {

  if (!match) {
    return message.send('*ᴘʟᴇᴀꜱᴇ ᴘʀᴏᴠɪᴅᴇ ᴀɴ ɪɴꜱᴛᴀɢʀᴀᴍ `ʟɪɴᴋ`*')
  }

  try {

    const SABIR7718 = `https://social-media-downloader-api-s7.onrender.com/sylove?url=${encodeURIComponent(match)}`

    const S7HaTeSY = await fetch(SABIR7718)
    const HaTe = await S7HaTeSY.json()

    console.log(HaTe)

    if (!HaTe || !HaTe.video_url) {
      return message.send('*ɴᴏ ᴍᴇᴅɪᴀ ꜰᴏᴜɴᴅ ᴏʀ ᴀᴘɪ `ᴇʀʀᴏʀ`*')
    }

    return message.send({
      video: {
        url: HaTe.video_url
      },
      caption: '> *𝚳𝚯𝚯𝚴-𝚾 𝚾𝐃*'
    })

  } catch (SYHaTe) {
    console.error(SYHaTe)

    return message.send('*ᴇʀʀᴏʀ `ᴏᴄᴄᴜʀʀᴇᴅ`*')
  }
})