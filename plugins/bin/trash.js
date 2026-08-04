// FIX: ESM-compatible wrapper — original was obfuscated CJS
import axios from 'axios';
import qs from 'qs';

const YouTubeDL = async (query) => {
  const stringified = qs.stringify({ query, vt: 'home' });
  const headers = {
    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'accept': '*/*',
    'x-requested-with': 'XMLHttpRequest',
  };
  const searchRes = await axios.post(
    'https://ssvid.net/api/ajax/search',
    stringified,
    { headers }
  );
  if (searchRes.data.status !== 'ok') throw new Error('Failed to fetch video');
  const { vid, links } = searchRes.data;
  const k = links?.mp3?.mp3128?.k;
  if (!k) throw new Error('No mp3 download link found');
  const convertBody = qs.stringify({ vid, k });
  const convertRes = await axios.post(
    'https://ssvid.net/api/ajax/convert',
    convertBody,
    { headers }
  );
  return { title: searchRes.data.title, url: convertRes.data.dlink };
};

export { YouTubeDL };
