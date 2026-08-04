import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db = null;
export function loadTheme() {
  const name = process.env.THEME || config.THEME;
  const file = path.join(__dirname, `${name}.json`);
  if (!fs.existsSync(file)) throw new Error(`not found: ${file}`);
  db = JSON.parse(fs.readFileSync(file, 'utf-8'));
  return db;
}

export function getTheme() {
  if (!db) loadTheme();
  return db;
}
