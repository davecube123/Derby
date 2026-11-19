import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_VERSION } from '../swerte/js/version.js';
import { DICTS } from '../swerte/js/i18n.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('Derby Swerte version matches in manifest and service worker', () => {
  assert.match(APP_VERSION, /^\d+\.\d+\.\d+$/);
  assert.equal(JSON.parse(read('swerte/manifest.webmanifest')).version, APP_VERSION);
  assert.match(read('swerte/sw.js'), new RegExp(`const VERSION = '${APP_VERSION.replace(/\./g, '\\.')}'`));
});

test('Derby Swerte service worker caches every module and only cleans its own caches', () => {
  const sw = read('swerte/sw.js');
  for (const f of ['app', 'astro', 'rules', 'places', 'i18n', 'install', 'version']) assert.ok(sw.includes(`./js/${f}.js`), f);
  assert.ok(sw.includes("k.startsWith('derby-swerte-')"));
});

test('Derby Swerte: English and Tagalog have the same keys and placeholders', () => {
  const en = Object.keys(DICTS.en).sort();
  const tl = Object.keys(DICTS.tl).sort();
  assert.deepEqual(en.filter((k) => !tl.includes(k)), [], 'missing in Tagalog');
  assert.deepEqual(tl.filter((k) => !en.includes(k)), [], 'missing in English');
  for (const [k, v] of Object.entries(DICTS.en)) {
    if (typeof v !== 'string') continue;
    const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    assert.deepEqual(vars(DICTS.tl[k]), vars(v), k);
  }
});

test('Derby Swerte: every text key used exists, including planets, phases, signs, feathers and reasons', async () => {
  const { PLANETS, FEATHERS } = await import('../swerte/js/rules.js');
  const { MOON_PHASES, SIGNS } = await import('../swerte/js/astro.js');
  const src = ['swerte/js/app.js', 'swerte/js/install.js', 'swerte/index.html'].map(read).join('\n');
  const used = new Set([...src.matchAll(/\bt\('([\w.]+)'/g), ...src.matchAll(/data-i18n(?:-aria)?="([\w.]+)"/g)].map((m) => m[1]));
  for (const p of Object.keys(PLANETS)) used.add(`planet.${p}`).add(`pcolor.${PLANETS[p].color}`);
  for (const f of Object.keys(FEATHERS)) used.add(`feather.${f}`);
  for (const ph of MOON_PHASES) used.add(`phase.${ph}`);
  for (const s of SIGNS) used.add(`sign.${s}`);
  for (const v of ['strong', 'favored', 'neutral', 'notFavored']) used.add(`v.${v}`);
  for (const r of ['hourRuler', 'hourFriend', 'hourEnemy', 'dayRuler', 'moonSign']) used.add(`reason.${r}`);
  assert.deepEqual([...used].filter((k) => !(k in DICTS.en)), []);
});
