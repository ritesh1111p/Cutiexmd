import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { CookieJar } from "tough-cookie";
import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
wrapper(axios);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration (env override possible)
const COOKIES_FILE =
  process.env.COOKIES_FILE || path.join(__dirname, "..", "cookies.txt");
const CACHE_DIR = process.env.CACHE_DIR || path.join(__dirname, "..", "cache");
const CACHE_MIN_SIZE = parseInt(process.env.CACHE_MIN_SIZE || "40", 10);
const CACHE_PREFETCH_BATCH = parseInt(
  process.env.CACHE_PREFETCH_BATCH || "80",
  10
);
const RECENT_MAX = parseInt(process.env.RECENT_MAX || "300", 10);
const CACHE_TTL_MS = parseInt(
  process.env.CACHE_TTL_MS || String(1000 * 60 * 60 * 24),
  10
);
const CACHE_MAX_ITEMS = parseInt(process.env.CACHE_MAX_ITEMS || "1000", 10);

const BASE = "https://www.instagram.com";
const DEFAULT_UA =
  process.env.UA ||
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";
const MOBILE_UA =
  process.env.MOBILE_UA ||
  "Instagram 219.0.0.12.117 Android (30/11; 420dpi; 1080x2340; samsung; SM-G981B; qcom; en_US)";
const DEFAULT_X_IG_APP_ID = process.env.X_IG_APP_ID || "1217981644879628";

const MAX_SESSIONS = parseInt(process.env.MAX_SESSIONS || "8", 10);
const MAX_ATTEMPTS = parseInt(process.env.MAX_ATTEMPTS || "20", 10);
const PAGINATION_DELAY_MS = parseInt(
  process.env.PAGINATION_DELAY_MS || "250",
  10
);
const FALLBACK_PAGES = parseInt(process.env.FALLBACK_PAGES || "20", 10);
const MAX_PUPPETEER_SCROLLS = parseInt(
  process.env.MAX_PUPPETEER_SCROLLS || "40",
  10
);
const PER_SESSION_PAGES = parseInt(process.env.PER_SESSION_PAGES || "4", 10);

function ensureDir(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}
ensureDir(CACHE_DIR);

function readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}
function writeJson(filePath, obj) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf8");
  } catch (e) {}
}

// Cookie parser
function parseNetscapeCookies(cookieFileContent) {
  const lines = cookieFileContent.split(/\r?\n/);
  const cookies = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const parts = t.split(/\t/);
    if (parts.length >= 7) {
      const [domain, flag, pathVal, secure, expires, name, value] = parts;
      cookies.push({
        domain: domain || "",
        path: pathVal || "/",
        name: name || "",
        value: value || "",
        secure:
          String(secure).toLowerCase() === "true" ||
          String(secure) === "TRUE" ||
          String(secure) === "1",
      });
    }
  }
  return cookies;
}

function buildAxiosInstanceFromCookies(cookies) {
  const jar = new CookieJar();
  for (const c of cookies) {
    const cookieStr = `${c.name}=${c.value}; Domain=${c.domain}; Path=${
      c.path || "/"
    }`;
    try {
      jar.setCookieSync(cookieStr, BASE, { ignoreError: true });
      jar.setCookieSync(cookieStr, "https://www.instagram.com", {
        ignoreError: true,
      });
    } catch (e) {}
  }
  return axios.create({
    baseURL: BASE,
    timeout: 30000,
    jar,
    withCredentials: true,
    headers: {
      "User-Agent": DEFAULT_UA,
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://www.instagram.com/",
      "X-IG-App-ID": DEFAULT_X_IG_APP_ID,
    },
    maxRedirects: 5,
  });
}

function buildIosInstanceFromCookies(cookies) {
  const jar = new CookieJar();
  for (const c of cookies) {
    const cookieStr = `${c.name}=${c.value}; Domain=${c.domain}; Path=${
      c.path || "/"
    }`;
    try {
      jar.setCookieSync(cookieStr, "https://i.instagram.com", {
        ignoreError: true,
      });
      jar.setCookieSync(cookieStr, "https://www.instagram.com", {
        ignoreError: true,
      });
    } catch (e) {}
  }
  return axios.create({
    baseURL: "https://i.instagram.com",
    timeout: 30000,
    jar,
    withCredentials: true,
    headers: {
      "User-Agent": MOBILE_UA,
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://www.instagram.com/",
      "X-IG-App-ID": DEFAULT_X_IG_APP_ID,
    },
    maxRedirects: 5,
  });
}

// utility helpers
function ensureAbsoluteUrl(u) {
  if (!u) return null;
  try {
    if (u.startsWith("//")) return "https:" + u;
    if (/^https?:\/\//i.test(u)) return u;
    if (/^[^\/]+\.[a-z]{2,}/i.test(u)) return "https://" + u;
    if (u.startsWith("/")) return "https://www.instagram.com" + u;
    return "https://" + u;
  } catch (e) {
    return u;
  }
}
function normalizeUrlStripQuery(u) {
  try {
    const o = new URL(u);
    return o.origin + o.pathname;
  } catch (e) {
    return String(u).split("?")[0];
  }
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; --i) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function chooseBestVideoUrl(media) {
  if (!media) return null;
  const pickFromCandidates = (candidates) => {
    if (!Array.isArray(candidates) || candidates.length === 0) return null;
    candidates.sort((a, b) => {
      const ab = (b.bitrate || b.width || 0) - (a.bitrate || a.width || 0);
      if (ab !== 0) return ab;
      return 0;
    });
    for (const best of candidates) {
      if (!best) continue;
      if (best.url) return ensureAbsoluteUrl(best.url);
      if (best.src) return ensureAbsoluteUrl(best.src);
      const key = Object.keys(best).find((k) => /url|src/i.test(k));
      if (key && best[key]) return ensureAbsoluteUrl(best[key]);
    }
    return null;
  };
  try {
    const videoVersions =
      media.video_versions || media.video_versions2 || media.video_versions_v2;
    const v = pickFromCandidates(videoVersions);
    if (v) return v;
    if (media.original) {
      const v2 = pickFromCandidates(media.original.video_versions || []);
      if (v2) return v2;
    }
    const candidates = [];
    if (Array.isArray(media.carousel_media)) {
      for (const ch of media.carousel_media) {
        const c = chooseBestVideoUrl(ch);
        if (c) candidates.push(c);
      }
      if (candidates.length) return candidates[0];
    }
    const plain =
      media.video_url ||
      media.media_url ||
      media.display_url ||
      (media.image_versions2 &&
        media.image_versions2.candidates &&
        media.image_versions2.candidates[0] &&
        media.image_versions2.candidates[0].url) ||
      null;
    if (plain && String(plain).includes(".mp4"))
      return ensureAbsoluteUrl(plain);
  } catch (e) {}
  return null;
}

// i.instagram fallback
async function fetchTagSections(instanceI, tag, maxPages = FALLBACK_PAGES) {
  const collected = [];
  try {
    for (let page = 1; page <= maxPages; ++page) {
      const body = {
        include_persistent: 0,
        surface: "grid",
        tab: "recent",
        page,
      };
      const resp = await instanceI
        .post(`/api/v1/tags/${encodeURIComponent(tag)}/sections/`, body, {
          headers: {
            "X-Requested-With": "XMLHttpRequest",
            "Content-Type": "application/json",
          },
          validateStatus: (s) => s < 500,
        })
        .catch((e) => ({ error: e, status: e?.response?.status }));
      if (!resp || resp.error) break;
      const data = resp.data || {};
      const sections = data.sections || data.items || [];
      let any = false;
      for (const sec of sections) {
        const items =
          (sec.layout_content && sec.layout_content.medias) ||
          sec.medias ||
          sec.items ||
          [];
        for (const it of items) {
          if (it && it.media) {
            collected.push(it.media);
            any = true;
          }
        }
      }
      if (!any) break;
      await new Promise((r) => setTimeout(r, PAGINATION_DELAY_MS));
    }
  } catch (e) {}
  return collected;
}

async function fetchTopSerp(
  instance,
  tag,
  { searchSessionId, rank_token, next_max_id } = {}
) {
  const sid = searchSessionId || uuidv4();
  const params = new URLSearchParams();
  params.append("enable_metadata", "true");
  params.append("query", `#${tag}`);
  if (sid) params.append("search_session_id", sid);
  if (rank_token) params.append("rank_token", rank_token);
  if (next_max_id) params.append("next_max_id", next_max_id);
  const url = `/api/v1/fbsearch/web/top_serp/?${params.toString()}`;
  try {
    return await instance.get(url, {
      headers: { "X-Requested-With": "XMLHttpRequest" },
      validateStatus: (s) => s < 500,
    });
  } catch (e) {
    return null;
  }
}

async function puppeteerScrapeTag(
  tag,
  desiredCount = 20,
  maxScrolls = MAX_PUPPETEER_SCROLLS
) {
  if (String(process.env.USE_PUPPETEER || "false").toLowerCase() !== "true")
    return [];
  let puppeteer;
  try {
    puppeteer = await import("puppeteer");
  } catch (e) {
    return [];
  }
  const pp = puppeteer.default || puppeteer;
  let cookieObjects = [];
  try {
    if (fs.existsSync(COOKIES_FILE)) {
      const raw = fs.readFileSync(COOKIES_FILE, "utf8");
      const cookies = parseNetscapeCookies(raw);
      cookieObjects = cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain.replace(/^\./, ""),
        path: c.path || "/",
        httpOnly: false,
        secure: !!c.secure,
      }));
    }
  } catch (e) {}
  const browser = await pp.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setUserAgent(MOBILE_UA);
  if (cookieObjects.length) {
    try {
      await page.setCookie(...cookieObjects);
    } catch (e) {}
  }
  const url = `https://www.instagram.com/explore/tags/${encodeURIComponent(
    tag
  )}/`;
  await page
    .goto(url, { waitUntil: "networkidle2", timeout: 60000 })
    .catch(() => {});
  await page.waitForTimeout(1500);

  const found = new Map();
  let scrolls = 0;
  while (found.size < desiredCount && scrolls < maxScrolls) {
    const items = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll("article video").forEach((v) => {
        if (v.src)
          out.push({
            type: "video",
            url: v.src,
            id: v.closest("a") ? v.closest("a").href : null,
          });
      });
      document.querySelectorAll("article a").forEach((a) => {
        if (a.href) out.push({ type: "link", url: a.href, id: a.href });
      });
      return out;
    });
    for (const it of items) {
      const key = it.url || it.id;
      if (!found.has(key)) found.set(key, it.url || it.id);
    }
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight * 1.5);
    });
    await page.waitForTimeout(1200 + Math.floor(Math.random() * 800));
    scrolls++;
  }

  const results = [];
  for (const v of found.values()) {
    if (String(v).includes(".mp4")) results.push(v);
    else if (String(v).includes("/p/")) {
      try {
        const postPage = await browser.newPage();
        await postPage.setUserAgent(MOBILE_UA);
        await postPage
          .goto(v, { waitUntil: "networkidle2", timeout: 30000 })
          .catch(() => {});
        const vid = await postPage.evaluate(() => {
          const vidEl = document.querySelector("article video");
          return vidEl ? vidEl.src : null;
        });
        await postPage.close();
        if (vid) results.push(vid);
      } catch (e) {}
    }
    if (results.length >= desiredCount) break;
  }

  await browser.close();
  return results;
}

// Cache helpers
function tagSafeName(tag) {
  return tag.replace(/[^a-z0-9_\-]/gi, "_").toLowerCase();
}
function cacheFileForTag(tag) {
  return path.join(CACHE_DIR, `${tagSafeName(tag)}.json`);
}
function recentFileForTag(tag) {
  return path.join(CACHE_DIR, `${tagSafeName(tag)}.recent.json`);
}

function loadTagCache(tag) {
  const file = cacheFileForTag(tag);
  const data = readJson(file);
  if (!data || !Array.isArray(data.items)) return { items: [], updated_at: 0 };
  const now = Date.now();
  const items = data.items.filter((it) => !it.ts || now - it.ts < CACHE_TTL_MS);
  return { items, updated_at: data.updated_at || 0 };
}
function saveTagCache(tag, items) {
  const file = cacheFileForTag(tag);
  writeJson(file, { items, updated_at: Date.now() });
}
function loadRecentSet(tag) {
  const file = recentFileForTag(tag);
  const data = readJson(file);
  if (!data || !Array.isArray(data.recent)) return [];
  return data.recent;
}
function saveRecentSet(tag, arr) {
  const file = recentFileForTag(tag);
  writeJson(file, { recent: arr.slice(0, RECENT_MAX) });
}

function pickFromCache(tag, n, recentSet) {
  const cache = loadTagCache(tag).items || [];
  const pool = shuffle(cache.slice());
  const picked = [];
  const pickedIds = new Set();
  const remaining = [];
  for (const it of pool) {
    const id = it.id || it.url;
    if (!id) continue;
    if (picked.length < n && !recentSet.has(id)) {
      picked.push({ id, url: it.url });
      pickedIds.add(id);
    } else {
      remaining.push(it);
    }
  }
  if (picked.length < n) {
    for (const it of remaining) {
      if (picked.length >= n) break;
      const id = it.id || it.url;
      if (id && !pickedIds.has(id)) {
        picked.push({ id, url: it.url });
        pickedIds.add(id);
      }
    }
  }
  return { picked, remainingCache: cache };
}

function mergeIntoCache(tag, fetched) {
  const current = loadTagCache(tag).items || [];
  const existingIds = new Set(current.map((i) => i.id || i.url));
  const now = Date.now();
  for (const f of fetched) {
    if (!f || !f.url) continue;
    const id = f.id || normalizeUrlStripQuery(f.url);
    if (!id || existingIds.has(id)) continue;
    current.push({ id, url: ensureAbsoluteUrl(f.url), ts: now });
    existingIds.add(id);
  }
  const trimmed =
    current.length > CACHE_MAX_ITEMS
      ? current.slice(-CACHE_MAX_ITEMS)
      : current;
  saveTagCache(tag, trimmed);
}

async function refillCacheFromSources(
  tag,
  instance,
  instanceI,
  cookies,
  targetCount
) {
  const fetched = [];
  const seen = new Set();
  let sessionsFetched = 0;
  let attempts = 0;

  function ingestMediaObjLocal(m) {
    if (!m) return;
    const candidates = [];
    const direct = chooseBestVideoUrl(m);
    if (direct) candidates.push(direct);
    if (Array.isArray(m.items))
      for (const it of m.items) {
        const c = chooseBestVideoUrl(it);
        if (c) candidates.push(c);
      }
    if (Array.isArray(m.carousel_media))
      for (const ch of m.carousel_media) {
        const c = chooseBestVideoUrl(ch);
        if (c) candidates.push(c);
      }
    if (
      m.original &&
      Array.isArray(m.original.edge_sidecar_to_children?.edges)
    ) {
      for (const e of m.original.edge_sidecar_to_children.edges) {
        const node = e.node;
        const c = chooseBestVideoUrl(node);
        if (c) candidates.push(c);
      }
    }
    const baseId = m.pk || m.id || m.fbid;
    for (const url of candidates) {
      if (!url) continue;
      const id = baseId ? String(baseId) : normalizeUrlStripQuery(url);
      if (!seen.has(id)) {
        seen.add(id);
        fetched.push({ id, url: ensureAbsoluteUrl(url) });
      }
    }
  }

  while (
    fetched.length < targetCount &&
    attempts < MAX_ATTEMPTS &&
    sessionsFetched < MAX_SESSIONS
  ) {
    attempts++;
    const sessionId = uuidv4();
    const rankToken = uuidv4();
    sessionsFetched++;
    let sessionPages = 0;
    let nextMax = null;
    while (
      fetched.length < targetCount &&
      sessionPages < PER_SESSION_PAGES * 2
    ) {
      sessionPages++;
      let resp;
      try {
        resp = await fetchTopSerp(instance, tag, {
          searchSessionId: sessionId,
          rank_token: rankToken,
          next_max_id: nextMax,
        });
      } catch (e) {
        resp = null;
      }
      if (!resp || resp.status !== 200 || !resp.data) break;
      const sections =
        resp.data.media_grid?.sections ||
        resp.data.sections ||
        resp.data.items ||
        [];
      let got = 0;
      for (const sec of sections) {
        const items =
          (sec.layout_content && sec.layout_content.medias) ||
          sec.medias ||
          sec.items ||
          [];
        for (const it of items) {
          const m = it && (it.media || it);
          if (!m) continue;
          ingestMediaObjLocal(m);
          got++;
        }
      }
      if (Array.isArray(resp.data.edge_hashtag_to_media?.edges)) {
        for (const edge of resp.data.edge_hashtag_to_media.edges) {
          if (edge.node) ingestMediaObjLocal(edge.node);
        }
      }
      nextMax =
        resp.data.next_max_id ||
        resp.data.media_grid?.next_max_id ||
        resp.data.next_page_info?.end_cursor ||
        resp.data.page_info?.end_cursor ||
        null;
      if (!got) break;
      await new Promise((r) => setTimeout(r, PAGINATION_DELAY_MS));
    }
  }

  if (fetched.length < targetCount) {
    try {
      const more = await fetchTagSections(
        instanceI,
        tag,
        Math.ceil(FALLBACK_PAGES / 2)
      );
      for (const m of more) {
        const direct = chooseBestVideoUrl(m);
        if (direct) {
          const id =
            m.pk || m.id || m.fbid
              ? String(m.pk || m.id || m.fbid)
              : normalizeUrlStripQuery(direct);
          if (!seen.has(id)) {
            seen.add(id);
            fetched.push({ id, url: ensureAbsoluteUrl(direct) });
          }
        }
        if (fetched.length >= targetCount) break;
      }
    } catch (e) {}
  }

  if (
    fetched.length < targetCount &&
    String(process.env.USE_PUPPETEER || "false").toLowerCase() === "true"
  ) {
    try {
      const scraped = await puppeteerScrapeTag(
        tag,
        Math.max(targetCount - fetched.length, 20),
        MAX_PUPPETEER_SCROLLS
      );
      for (const s of scraped) {
        const id = normalizeUrlStripQuery(s);
        if (!seen.has(id)) {
          seen.add(id);
          fetched.push({ id, url: ensureAbsoluteUrl(s) });
        }
        if (fetched.length >= targetCount) break;
      }
    } catch (e) {}
  }

  mergeIntoCache(tag, fetched);
  return fetched;
}

// Public functions
async function _readCookies() {
  if (!fs.existsSync(COOKIES_FILE))
    throw new Error(`cookies file missing at ${COOKIES_FILE}`);
  const raw = fs.readFileSync(COOKIES_FILE, "utf8");
  return parseNetscapeCookies(raw);
}

export async function getRandomVideos(tag, count = 1) {
  if (!tag) throw new Error("tag required");
  if (count < 1) count = 1;
  if (count > 24) count = 24;

  const cookies = await _readCookies();
  const instance = buildAxiosInstanceFromCookies(cookies);
  const instanceI = buildIosInstanceFromCookies(cookies);

  const csrfC = cookies.find((c) =>
    [
      "csrftoken",
      "csrf_token",
      "csrfmiddlewaretoken",
      "CSRFToken",
      "csrf",
    ].includes(c.name)
  );
  if (csrfC && csrfC.value) {
    instance.defaults.headers["X-CSRFToken"] = csrfC.value;
    instanceI.defaults.headers["X-CSRFToken"] = csrfC.value;
  }

  const recentArr = loadRecentSet(tag);
  const recentSet = new Set(recentArr || []);
  let { picked } = pickFromCache(tag, count, recentSet);

  const cacheState = loadTagCache(tag);
  if (picked.length < count || cacheState.items.length < CACHE_MIN_SIZE) {
    await refillCacheFromSources(
      tag,
      instance,
      instanceI,
      cookies,
      CACHE_PREFETCH_BATCH
    );
  }

  if (picked.length < count) {
    picked = pickFromCache(tag, count, recentSet).picked;
  }

  if (picked.length < count) {
    const liveFetched = await refillCacheFromSources(
      tag,
      instance,
      instanceI,
      cookies,
      Math.max(count - picked.length, 20)
    );
    const pickedIds = new Set(picked.map((p) => p.id));
    for (const f of liveFetched) {
      if (!pickedIds.has(f.id)) {
        picked.push({ id: f.id, url: f.url });
        pickedIds.add(f.id);
      }
      if (picked.length >= count) break;
    }
  }

  if (picked.length < count) {
    const allCache = loadTagCache(tag).items || [];
    const pickedIds = new Set(picked.map((p) => p.id));
    for (const it of allCache) {
      const id = it.id || it.url;
      if (id && !pickedIds.has(id)) {
        picked.push({ id, url: it.url });
        pickedIds.add(id);
      }
      if (picked.length >= count) break;
    }
  }

  if (picked.length === 0) {
    try {
      const resp = await fetchTopSerp(instance, tag, {
        searchSessionId: uuidv4(),
      });
      if (resp && resp.data) {
        const sections =
          resp.data.media_grid?.sections ||
          resp.data.sections ||
          resp.data.items ||
          [];
        const found = [];
        for (const sec of sections) {
          const items =
            (sec.layout_content && sec.layout_content.medias) ||
            sec.medias ||
            sec.items ||
            [];
          for (const it of items) {
            const m = it && (it.media || it);
            if (!m) continue;
            const url = chooseBestVideoUrl(m);
            if (url)
              found.push({
                id: m.pk || m.id || m.fbid || normalizeUrlStripQuery(url),
                url: ensureAbsoluteUrl(url),
              });
          }
        }
        if (found.length) {
          mergeIntoCache(tag, found);
          const pickedIds = new Set();
          for (const f of found) {
            if (!pickedIds.has(f.id)) {
              picked.push({ id: f.id, url: f.url });
              pickedIds.add(f.id);
            }
            if (picked.length >= count) break;
          }
        }
      }
    } catch (e) {}
  }

  const urls = (picked || [])
    .map((p) => p.url)
    .filter(Boolean)
    .slice(0, count);

  // update recent
  const newRecent = loadRecentSet(tag) || [];
  for (const p of picked) {
    const id = p.id || normalizeUrlStripQuery(p.url);
    if (id) newRecent.unshift(id);
  }
  const deduped = [];
  const seen = new Set();
  for (const id of newRecent) {
    if (!seen.has(id)) {
      seen.add(id);
      deduped.push(id);
    }
    if (deduped.length >= RECENT_MAX) break;
  }
  saveRecentSet(tag, deduped);

  return urls;
}

export async function getRandomVideo(tag) {
  const arr = await getRandomVideos(tag, 1);
  return arr && arr.length ? arr[0] : null;
}
