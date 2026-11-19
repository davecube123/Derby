import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_VERSION } from '../js/version.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('version is semver', () => assert.match(APP_VERSION, /^\d+\.\d+\.\d+$/));
test('package.json version matches', () => assert.equal(JSON.parse(read('package.json')).version, APP_VERSION));
test('manifest version matches', () => assert.equal(JSON.parse(read('manifest.webmanifest')).version, APP_VERSION));
test('service worker version matches', () => assert.match(read('sw.js'), new RegExp(`const VERSION = '${APP_VERSION.replace(/\./g, '\\.')}'`)));
test('service worker caches every js file', () => {
  const sw = read('sw.js');
  for (const f of ['app', 'db', 'genetics', 'constants', 'version', 'install', 'i18n', 'conditioning', 'chart']) assert.ok(sw.includes(`./js/${f}.js`), f);
});
