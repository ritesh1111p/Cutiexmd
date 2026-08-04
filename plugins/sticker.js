import { Module } from '../lib/plugins.js';
import sticker from '../lib/sticker.js';
import config from '../config.js';

Module({
  command: 'take',
  package: 'media',
  description: 'Change sticker packname and author'
})(async (message, match) => {
  let mediaa = message.quoted || message;
  if (mediaa.type !== 'stickerMessage') return await message.send('_Reply to a sticker_');
  const packname = match;
  if (!match) return await message.send('_use: .take my name_');
  const media = await mediaa.download();
  const buffer = await sticker.addExif(media, {
    packname,
  });

  await message.send({ sticker: buffer });
});

Module({
  command: 'sticker',
  package: 'media',
  description: 'Convert stk'
})(async (message) => {
  let mediaa = message.quoted || message;
  if (!/image|video|gif/.test(mediaa.type)) {
  return await message.send('_Reply to an image or video_'); }
  const media = await mediaa.download();
  const buffer = await sticker.toSticker(mediaa.type, media, {
  packname: config.packname,
  author: config.author
  });
  await message.send({ sticker: buffer });
});

Module({
  command: 's',
  package: 'media',
  description: 'Convert stk'
})(async (message) => {
  let mediaa = message.quoted || message;
  if (!/image|video|gif/.test(mediaa.type)) {
  return await message.send('_Reply to an image or video_'); }
  const media = await mediaa.download();
  const buffer = await sticker.toSticker(mediaa.type, media, {
  packname: config.packname,
  author: config.author
  });
  await message.send({ sticker: buffer });
});
Module({
  command: 'vs',
  package: 'media',
  description: 'Convert stk'
})(async (message) => {
  let mediaa = message.quoted || message;
  if (!/image|video|gif/.test(mediaa.type)) {
  return await message.send('_Reply to an image or video_'); }
  const media = await mediaa.download();
  const buffer = await sticker.toSticker(mediaa.type, media, {
  packname: config.packname,
  author: config.author
  });
  await message.send({ sticker: buffer });
});