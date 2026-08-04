import { Module } from '../lib/plugins.js'

Module({
  command: 'fb',
  package: 'downloader',
  description: 'Download Facebook videos'
})(async (message, match) => {

  if (!match) {
    return message.send('*ᴘʀᴏᴠɪᴅᴇ ᴀ ꜰᴀᴄᴇʙᴏᴏᴋ `ᴜʀʟ`*')
  }

  if (
    !match.includes('facebook.com') &&
    !match.includes('fb.watch')
  ) {
    return message.send('*ɪɴᴠᴀʟɪᴅ ꜰᴀᴄᴇʙᴏᴏᴋ `ᴜʀʟ`*')
  }

  try {

    const SABIR7718 = `https://social-media-downloader-api-s7.onrender.com/sylove?url=${encodeURIComponent(match)}`

    const S7HaTeSY = await fetch(SABIR7718)
    const HaTe = await S7HaTeSY.json()

    console.log(HaTe)

    if (!HaTe || !HaTe.video_url) {
      return message.send('*ɴᴏ ᴅᴏᴡɴʟᴏᴀᴅᴀʙʟᴇ ᴠɪᴅᴇᴏ `ꜰᴏᴜɴᴅ`*')
    }

    await message.send({
      video: {
        url: HaTe.video_url
      },
      caption: '> *𝚳𝚯𝚯𝚴-𝚾 𝚾𝐃*'
    })

  } catch (SYHaTe) {

    console.error(SYHaTe)

    return message.send('*ᴅᴏᴡɴʟᴏᴀᴅ `ꜰᴀɪʟᴇᴅ`*')
  }
})