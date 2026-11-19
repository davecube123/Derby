import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_VERSION } from '../keep/js/version.js';
import { DICTS } from '../keep/js/i18n.js';
import { derbyBirds, bloodlineText, isDerbyFile } from '../keep/js/derby-import.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('Derby Keep version matches in manifest and service worker', () => {
  assert.match(APP_VERSION, /^\d+\.\d+\.\d+$/);
  assert.equal(JSON.parse(read('keep/manifest.webmanifest')).version, APP_VERSION);
  assert.match(read('keep/sw.js'), new RegExp(`const VERSION = '${APP_VERSION.replace(/\./g, '\\.')}'`));
});

test('Derby Keep service worker caches every module it imports', () => {
  const sw = read('keep/sw.js');
  const files = ['app', 'db', 'i18n', 'install', 'version', 'constants', 'conditioning', 'chart', 'derby-import'];
  for (const f of files) assert.ok(sw.includes(`./js/${f}.js`), f);
  assert.ok(sw.includes('../js/genetics.js'));
});

test('Derby service worker does not delete Derby Keep caches', () => {
  assert.match(read('sw.js'), /!k\.startsWith\('derby-keep-'\)/);
});

test('Derby Keep: English and Tagalog have the same keys and placeholders', () => {
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

test('Derby Keep: every text key used in the code exists', () => {
  const src = ['keep/js/app.js', 'keep/js/install.js', 'keep/index.html'].map(read).join('\n');
  const used = new Set([...src.matchAll(/\bt\('([\w.]+)'/g), ...src.matchAll(/data-i18n(?:-aria)?="([\w.]+)"/g)].map((m) => m[1]));
  for (const prefix of ['sex', 'status', 'type', 'lf']) for (const k of Object.keys(DICTS.en)) if (k.startsWith(`${prefix}.`)) used.add(k);
  assert.deepEqual([...used].filter((k) => !(k in DICTS.en)), []);
});

test('Derby file import: bloodline from parents, cocks and stags preselected', () => {
  const file = {
    app: 'derby',
    birds: [
      { id: 's', name: 'Sire', sex: 'cock', status: 'brood', compositionMode: 'manual', composition: { Sweater: 1 } },
      { id: 'd', name: 'Dam', sex: 'hen', status: 'brood', compositionMode: 'manual', composition: { Kelso: 1 } },
      { id: 'x', name: 'Stag', sex: 'stag', status: 'growing', sireId: 's', damId: 'd', compositionMode: 'auto', composition: {} },
      { id: 'y', name: 'Old', sex: 'cock', status: 'sold', compositionMode: 'manual', composition: {} },
      { name: 'no id' },
    ],
  };
  assert.equal(isDerbyFile(file), true);
  assert.equal(isDerbyFile({ app: 'derby-keep', birds: [] }), false);
  const birds = Object.fromEntries(derbyBirds(file).map((b) => [b.id, b]));
  assert.equal(Object.keys(birds).length, 4);
  assert.equal(birds.x.bloodline, '1/2 Kelso · 1/2 Sweater');
  assert.equal(birds.s.bloodline, 'Full Sweater');
  assert.equal(birds.x.status, 'active');
  assert.equal(birds.y.status, 'sold');
  assert.deepEqual(['s', 'd', 'x', 'y'].map((id) => birds[id].preselect), [true, false, true, false]);
  assert.equal(bloodlineText({}), '');
});
