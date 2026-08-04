import { Module } from '../lib/plugins.js';

Module({
  command: "owner",
  package: "tools",
  description: "Owner Contact"
})(async (message) => {

  const ownerNumber = "917980046966";
  const ownerName = "চন্দ্রবিন্দুর চাঁদ";

  const vcard = `BEGIN:VCARD
VERSION:3.0
FN:${ownerName}
TEL;type=CELL;type=VOICE;waid=${ownerNumber}:${ownerNumber}
END:VCARD`;

  await message.send({
    contacts: {
      displayName: ownerName,
      contacts: [{ vcard }]
    }
  });

});