// randomphotolink.js
import crypto from 'crypto';

const photoLinks = [
  "https://files.catbox.moe/39ppvc.jpg",
  "https://files.catbox.moe/p473t1.jpg" ];

// Better randomness using crypto.randomInt (no modulo bias)
function getRandomPhoto() {
  const index = crypto.randomInt(0, photoLinks.length);
  return photoLinks[index];
}

export { getRandomPhoto };