import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DICTS, t, setLang } from '../js/i18n.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('English and Tagalog have exactly the same keys', () => {
  const en = Object.keys(DICTS.en).sort();
  const tl = Object.keys(DICTS.tl).sort();
  assert.deepEqual(en.filter((k) => !tl.includes(k)), [], 'missing in Tagalog');
  assert.deepEqual(tl.filter((k) => !en.includes(k)), [], 'missing in English');
});

test('every key used in the code exists', () => {
  const src = ['js/app.js', 'js/install.js'].map(read).join('\n') + read('index.html');
  const used = new Set([...src.matchAll(/\bt\('([\w.]+)'/g), ...src.matchAll(/data-i18n(?:-aria)?="([\w.]+)"/g)].map((m) => m[1]));
  for (const prefix of ['sex', 'status', 'gen', 'type', 'lf']) for (const k of Object.keys(DICTS.en)) if (k.startsWith(`${prefix}.`)) used.add(k);
  const missing = [...used].filter((k) => !(k in DICTS.en));
  assert.deepEqual(missing, []);
});

test('placeholders match between languages', () => {
  for (const [k, v] of Object.entries(DICTS.en)) {
    if (typeof v !== 'string') continue;
    const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    assert.deepEqual(vars(DICTS.tl[k]), vars(v), k);
  }
});

test('t() fills placeholders and plurals in both languages', () => {
  setLang('en');
  assert.equal(t('list.count', { n: 2, total: 5 }), '2 of 5 birds');
  assert.equal(t('lines.count', { n: 1 }), '1 bird');
  setLang('tl');
  assert.equal(t('list.count', { n: 2, total: 5 }), '2 sa 5 na manok');
  assert.equal(t('sex.pullet'), 'Dumalaga');
  setLang('en');
});
