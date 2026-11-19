import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWeight, formatKg, daysBetween, addDays, keepProgress, weightSeries, latestWeight, dueItems } from '../keep/js/conditioning.js';

test('parseWeight reads kilos, commas and grams', () => {
  assert.equal(parseWeight('2.15'), 2.15);
  assert.equal(parseWeight('2,15'), 2.15);
  assert.equal(parseWeight('2150'), 2.15);
  assert.equal(parseWeight('2.1 kg'), 2.1);
  assert.equal(parseWeight('1980 g'), 1.98);
  assert.ok(Number.isNaN(parseWeight('')));
  assert.ok(Number.isNaN(parseWeight('abc')));
  assert.ok(Number.isNaN(parseWeight('0')));
});

test('formatKg', () => {
  assert.equal(formatKg(2.1), '2.10 kg');
  assert.equal(formatKg(2.155), '2.155 kg');
  assert.equal(formatKg(0), '');
  assert.equal(formatKg(2.16 - 2.1), '0.06 kg');
});

test('date math crosses months and years', () => {
  assert.equal(daysBetween('2026-01-30', '2026-02-02'), 3);
  assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1);
  assert.equal(addDays('2026-02-27', 3), '2026-03-02');
});

test('keep progress counts days to the derby', () => {
  const keep = { startDate: '2026-11-01', fightDate: '2026-11-21' };
  assert.deepEqual(keepProgress(keep, '2026-11-01'), { day: 1, total: 21, daysLeft: 20, phase: 'running', fraction: 1 / 21 });
  assert.equal(keepProgress(keep, '2026-11-21').phase, 'fightDay');
  assert.equal(keepProgress(keep, '2026-11-25').phase, 'past');
  assert.equal(keepProgress(keep, '2026-10-30').phase, 'notStarted');
  assert.equal(keepProgress({ startDate: '2026-11-01' }, '2026-11-05').total, null);
});

const logs = [
  { id: 'w2', birdId: 'a', type: 'weight', date: '2026-11-03', data: { weight: 2.2 } },
  { id: 'w1', birdId: 'a', type: 'weight', date: '2026-11-01', data: { weight: 2.3 } },
  { id: 'w3', birdId: 'b', type: 'weight', date: '2026-11-02', data: { weight: 1.9 } },
  { id: 'f1', birdId: 'a', type: 'feed', date: '2026-11-02', data: { feed: 'Corn' } },
];

test('weight series is per bird, oldest first, within a window', () => {
  assert.deepEqual(weightSeries(logs, 'a').map((p) => p.kg), [2.3, 2.2]);
  assert.deepEqual(weightSeries(logs, 'a', '2026-11-02').map((p) => p.id), ['w2']);
  assert.equal(latestWeight(logs, 'a').kg, 2.2);
  assert.equal(latestWeight(logs, 'zzz'), null);
});

test('due items: only latest dose counts, sold/deceased skipped, sorted', () => {
  const birds = new Map([
    ['a', { id: 'a', status: 'active' }],
    ['b', { id: 'b', status: 'sold' }],
    ['c', { id: 'c', status: 'brood' }],
  ]);
  const v = [
    { id: 1, birdId: 'a', type: 'vaccine', date: '2026-08-01', data: { product: 'Newcastle (NCD)', nextDue: '2026-11-10' } },
    { id: 2, birdId: 'a', type: 'vaccine', date: '2026-11-10', data: { product: 'newcastle (ncd)', nextDue: '2027-02-10' } },
    { id: 3, birdId: 'b', type: 'deworm', date: '2026-10-01', data: { product: 'Levamisole', nextDue: '2026-11-20' } },
    { id: 4, birdId: 'c', type: 'deworm', date: '2026-10-01', data: { product: 'Levamisole', nextDue: '2026-11-25' } },
    { id: 5, birdId: 'c', type: 'vaccine', date: '2026-09-01', data: { product: 'Fowl pox', nextDue: '2026-11-15' } },
    { id: 6, birdId: 'c', type: 'vaccine', date: '2026-09-01', data: { product: 'Fowl cholera', nextDue: '2027-03-01' } },
  ];
  const due = dueItems(v, birds, '2026-11-19', 14);
  assert.deepEqual(due.map((d) => [d.log.id, d.days]), [[5, -4], [4, 6]]);
});
