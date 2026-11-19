import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pairingCandidates, advisorPayload, ageMonths, MAX_CANDIDATES } from '../js/advisor.js';

const bird = (id, sex, extra = {}) => ({ id, name: id, sex, status: 'brood', sireId: null, damId: null, compositionMode: 'manual', composition: {}, ...extra });
const farm = () => new Map([
  ['S', bird('S', 'cock', { composition: { Sweater: 1 } })],
  ['K', bird('K', 'hen', { composition: { Kelso: 1 } })],
  ['D', bird('D', 'pullet', { sireId: 'S', damId: 'K', compositionMode: 'auto' })], // S's daughter
  ['H', bird('H', 'hen', { composition: { Hatch: 1 }, notes: 'Mother of two winners' })],
  ['X', bird('X', 'hen', { status: 'sold', composition: { Kelso: 1 } })],
  ['C', bird('C', 'stag', { composition: { Roundhead: 1 } })],
].map(([k, v]) => [k, v]));

test('candidates: opposite sex, live only, with chicks blood and inbreeding', () => {
  const list = pairingCandidates(farm(), 'S', 0.125);
  assert.deepEqual(list.map((c) => c.bird.id).sort(), ['D', 'H', 'K']);
  const daughter = list.find((c) => c.bird.id === 'D');
  assert.equal(daughter.offspring.inbreeding, 0.25);
  assert.equal(daughter.overLimit, true);
  assert.equal(list[list.length - 1].bird.id, 'D', 'over-limit pairings sort last');
  const hatch = list.find((c) => c.bird.id === 'H');
  assert.deepEqual(hatch.offspring.bloodline, ['1/2 Hatch', '1/2 Sweater']);
  assert.equal(hatch.sireId, 'S');
  assert.equal(hatch.damId, 'H');
});

test('works from the hen side too (she is the dam)', () => {
  const list = pairingCandidates(farm(), 'H', 0.125);
  assert.deepEqual(list.map((c) => c.bird.id).sort(), ['C', 'S']);
  assert.ok(list.every((c) => c.damId === 'H'));
});

test('payload: only listed fields, limits text, percent rounded, caps candidate count', () => {
  const byId = farm();
  for (let i = 0; i < 40; i++) byId.set(`h${i}`, bird(`h${i}`, 'hen', { composition: { Lemon: 1 } }));
  const p = advisorPayload(byId, 'S', { goal: 'nonsense', note: 'x'.repeat(900), rules: 'r', lang: 'tl', maxInbreeding: 0.125 }, new Date('2026-11-19'));
  assert.equal(p.goal, 'balanced');
  assert.equal(p.lang, 'tl');
  assert.equal(p.note.length, 500);
  assert.equal(p.candidates.length, MAX_CANDIDATES);
  assert.deepEqual(Object.keys(p.bird).sort(), ['ageMonths', 'bands', 'bloodline', 'breeder', 'color', 'id', 'name', 'notes', 'sex', 'status']);
  const small = advisorPayload(farm(), 'S', {}, new Date('2026-11-19'));
  assert.equal(small.candidates.find((c) => c.id === 'D').offspring.inbreedingPercent, 25);
});

test('age in months', () => {
  assert.equal(ageMonths('2025-11-19', new Date('2026-11-19T12:00:00')), 12);
  assert.equal(ageMonths('2025-11-20', new Date('2026-11-19T12:00:00')), 11);
  assert.equal(ageMonths('', new Date()), null);
});
