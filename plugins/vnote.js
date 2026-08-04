import { Module } from '../lib/plugins.js'
import fs from 'fs'
import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import os from 'os'

Module({
  command: "vnote",
  description: "Convert replied audio/video to voice note",
  package: "tools"
})(async (message) => {

  if (!message.quoted)
    return message.send("*ʀᴇᴘʟʏ ᴛᴏ ᴀɴ ᴠɪᴅᴇᴏ ᴏʀ `ᴀᴜᴅɪᴏ`*")

  const mime = message.quoted.msg.mimetype || ''
  if (!/audio|video/.test(mime))
    return message.send("*ᴏɴʟʏ ᴀᴜᴅɪᴏ ᴏʀ ᴠɪᴅᴇᴏ ꜱᴜᴘᴘᴏʀᴛᴇᴅ*")

  const buffer = await message.quoted.download()

  const tmpFile = (buf, ext) => {
    const p = path.join(os.tmpdir(), `vnote-${Date.now()}.${ext}`)
    fs.writeFileSync(p, buf)
    return p
  }

  const convertToPTT = async (buf) => {
    const input = tmpFile(buf, 'mp4')
    const output = tmpFile(Buffer.alloc(0), 'ogg')

    await new Promise((resolve, reject) => {
      ffmpeg(input)
        .audioCodec('libopus')
        .audioBitrate('48k')
        .noVideo()
        .format('ogg')
        .on('error', reject)
        .on('end', resolve)
        .save(output)
    })

    const voice = fs.readFileSync(output)
    fs.unlinkSync(input)
    fs.unlinkSync(output)
    return voice
  }

  try {
    const voiceNote = await convertToPTT(buffer)
    await message.send({
      audio: voiceNote,
      mimetype: "audio/ogg; codecs=opus",
      ptt: true
    })
  } catch (e) {
    console.error(e)
    message.send("*ᴠᴏɪᴄᴇ ɴᴏᴛᴇ ꜰᴀɪʟᴇᴅ*")
  }
})
