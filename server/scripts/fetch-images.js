// Usage (from /server):
//   $env:CONTACT_EMAIL = "you@example.com"
//   node scripts/fetch-images.js            # fetch anything missing
//   node scripts/fetch-images.js --force    # re-fetch everything
//   node scripts/fetch-images.js davido tems  # only these ids
//
// Only images that exist on Wikimedia Commons under a free license are accepted.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CELEBRITIES } from '../data/celebrities.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(here, '../../client/public/celebs');
const MAP_FILE = path.resolve(here, '../data/celebrity-images.json');
const UA = `WhoBeThis/1.0 (${process.env.CONTACT_EMAIL || 'contact: set CONTACT_EMAIL'})`;
const FREE = /^(CC BY|CC0|Public domain|PD)/i;

// Wikipedia article titles that differ from the display name (edit freely)
const WIKI_TITLE = {
  rema: 'Rema (singer)',
  flavour: "Flavour N'abania",
  bovi: 'Bovi Ugboma',
  'ay-makun': 'AY (comedian)',
  'banky-w': 'Banky W.',
  'tonto-dikeh': 'Tonto Dikeh',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = (html = '') => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

async function api(base, params) {
  const url = `${base}?${new URLSearchParams({ format: 'json', ...params })}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchOne(c) {
  const title = WIKI_TITLE[c.id] ?? c.name;

  // 1) Which image is the article's lead picture?
  const wp = await api('https://en.wikipedia.org/w/api.php', {
    action: 'query', titles: title, prop: 'pageimages', piprop: 'name', redirects: '1',
  });
  const file = Object.values(wp.query?.pages ?? {})[0]?.pageimage;
  if (!file) throw new Error(`no article/lead image for "${title}"`);

  // 2) Is it on Commons, and is the license free?
  const cm = await api('https://commons.wikimedia.org/w/api.php', {
    action: 'query', titles: `File:${file}`, prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '400',
  });
  const info = Object.values(cm.query?.pages ?? {})[0]?.imageinfo?.[0];
  if (!info) throw new Error('lead image is not on Commons (likely non-free)');
  const meta = info.extmetadata ?? {};
  const license = meta.LicenseShortName?.value ?? '';
  if (!FREE.test(license)) throw new Error(`license not accepted: "${license || 'unknown'}"`);

  // 3) Download a 400px version locally (no hotlinking)
  const ext = path.extname(new URL(info.thumburl).pathname).toLowerCase() || '.jpg';
  const res = await fetch(info.thumburl, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`download failed (HTTP ${res.status})`);
  await fs.writeFile(path.join(OUT_DIR, `${c.id}${ext}`), Buffer.from(await res.arrayBuffer()));

  return {
    file: `/celebs/${c.id}${ext}`,
    credit: {
      author: strip(meta.Artist?.value) || 'Unknown',
      license,
      licenseUrl: meta.LicenseUrl?.value ?? null,
      source: info.descriptionurl,
    },
  };
}

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.filter((a) => !a.startsWith('--'));

await fs.mkdir(OUT_DIR, { recursive: true });
let map = {};
try { map = JSON.parse(await fs.readFile(MAP_FILE, 'utf8')); } catch { /* first run */ }

const failed = [];
for (const c of CELEBRITIES) {
  if (only.length && !only.includes(c.id)) continue;
  if (map[c.id] && !force) continue;
  try {
    map[c.id] = await fetchOne(c);
    console.log(`OK    ${c.name} (${map[c.id].credit.license})`);
  } catch (err) {
    failed.push(c.name);
    console.log(`SKIP  ${c.name}: ${err.message}`);
  }
  await sleep(500); // be polite to Wikimedia
}

await fs.writeFile(MAP_FILE, JSON.stringify(map, null, 2));
console.log(`\n${Object.keys(map).length} photos on file. ${failed.length} without a photo.`);
if (failed.length) console.log('Missing:', failed.join(', '));
console.log('IMPORTANT: open client/public/celebs and check every image shows the right person.');