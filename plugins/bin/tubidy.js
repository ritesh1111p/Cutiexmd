// FIX: ESM-compatible rewrite — original was obfuscated CJS
import axios from 'axios';
import * as cheerio from 'cheerio';

const baseURL = 'https://tubidy.cool';

const fixUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('http')) return url;
  return baseURL + url;
};

async function searchTubidy(query) {
  const { data } = await axios.get(baseURL + '/search.php?q=' + encodeURIComponent(query));
  const $ = cheerio.load(data);
  return $('.list-container .media').map((i, el) => ({
    title: $(el).find('.media-body a').first().text().trim(),
    duration: $(el).find('.mb-text').last().text().replace('Duration: ', '').trim(),
    thumbnail: fixUrl($(el).find('.media-left img').attr('src')),
    link: fixUrl($(el).find('.media-body a').first().attr('href')),
  })).get();
}

async function fetchDownload(url) {
  const { data } = await axios.get(fixUrl(url));
  const $ = cheerio.load(data);
  return $('#donwload_box .list-group-item.big a').map((i, el) => ({
    type: $(el).text().trim().split(' ')[0].toLowerCase(),
    size: $(el).find('.mb-text').text().trim() || 'Unknown',
    link: fixUrl($(el).attr('href')),
  })).get().filter((item, idx, arr) =>
    arr.findIndex(x => x.link === item.link && !item.link.includes('send')) === idx
  );
}

async function getDetail(url) {
  const { data } = await axios.get(fixUrl(url));
  const $ = cheerio.load(data);
  const title = $('.video-title-selected').text().replace(/\n/g, ' ').trim() || 'No Title';
  const duration = $('.video-search-footer li').text().replace(/[()]/g, '').trim() || '0:00';
  const thumbnail = fixUrl($('.donwload-box .text-center img').attr('src'));
  const links = $('.video-search-footer li a').map((i, el) => fixUrl($(el).attr('href'))).get();
  const media = [];
  for (const lnk of links) {
    const dl = await fetchDownload(lnk);
    if (dl) media.push(...dl);
  }
  return {
    title, duration, thumbnail,
    media: media.filter((item, idx, arr) =>
      arr.findIndex(x => x.link === item.link && !item.link.includes('send')) === idx
    ),
  };
}

export { searchTubidy, getDetail };
