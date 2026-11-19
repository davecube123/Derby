import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sunTimes, planetaryHours, hourAt, moonPhase, moonSign, DAY_RULERS, CHALDEAN } from '../swerte/js/astro.js';

const MANILA = [14.5995, 120.9842];
const manilaClock = (date) => {
  const t = new Date(date.getTime() + 8 * 36e5);
  return t.getUTCHours() * 60 + t.getUTCMinutes();
};
const near = (actual, expected, tol, msg) => assert.ok(Math.abs(actual - expected) <= tol, `${msg}: ${actual} vs ${expected}`);

test('Manila sunrise and sunset match published times (±6 min)', () => {
  // June solstice 2026: about 05:27 / 18:27. December solstice 2026: about 06:16 / 17:31.
  const jun = sunTimes({ y: 2026, m: 6, d: 21 }, ...MANILA);
  near(manilaClock(jun.sunrise), 5 * 60 + 27, 6, 'June sunrise');
  near(manilaClock(jun.sunset), 18 * 60 + 27, 6, 'June sunset');
  const dec = sunTimes({ y: 2026, m: 12, d: 21 }, ...MANILA);
  near(manilaClock(dec.sunrise), 6 * 60 + 16, 6, 'Dec sunrise');
  near(manilaClock(dec.sunset), 17 * 60 + 31, 6, 'Dec sunset');
});

test('planetary hours: day ruler first, Chaldean order, next day lines up', () => {
  const sun = planetaryHours({ y: 2026, m: 11, d: 22 }, ...MANILA); // a Sunday
  assert.equal(sun.dayRuler, 'sun');
  assert.deepEqual(sun.hours.slice(0, 8).map((h) => h.ruler), ['sun', 'venus', 'mercury', 'moon', 'saturn', 'jupiter', 'mars', 'sun']);
  // The hour after the 24th belongs to Monday's ruler, the Moon.
  assert.equal(CHALDEAN[(CHALDEAN.indexOf(sun.hours[23].ruler) + 1) % 7], 'moon');
  assert.equal(sun.hours.length, 24);
  assert.equal(sun.hours[0].start.getTime(), sun.sunrise.getTime());
  assert.equal(sun.hours[12].start.getTime(), sun.sunset.getTime());
  near(sun.hours[23].end.getTime(), sun.nextSunrise.getTime(), 1, 'last hour ends at next sunrise');
  assert.deepEqual(DAY_RULERS, ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn']);
});

test('before sunrise the previous planetary day is still running', () => {
  // 2026-11-23 04:00 Manila (Monday, before sunrise) belongs to Sunday's night hours.
  const { day, hour } = hourAt(new Date('2026-11-22T20:00:00Z'), ...MANILA, 8);
  assert.equal(day.dayRuler, 'sun');
  assert.ok(hour.night);
  const noon = hourAt(new Date('2026-11-23T04:00:00Z'), ...MANILA, 8); // Monday 12:00 Manila
  assert.equal(noon.day.dayRuler, 'moon');
  assert.ok(!noon.hour.night);
});

test('moon phase at known new and full moons', () => {
  assert.equal(moonPhase(new Date('2024-01-11T11:57:00Z')).name, 'new');
  const full = moonPhase(new Date('2024-01-25T17:54:00Z'));
  assert.equal(full.name, 'full');
  assert.ok(full.illumination > 0.99);
  assert.equal(moonPhase(new Date('2024-01-18T03:53:00Z')).name, 'firstQuarter');
  assert.ok(moonPhase(new Date('2024-01-15T00:00:00Z')).waxing);
});

test('moon sign at known positions', () => {
  // Full moon 2024-01-25 was at about 5° Leo; 2024-03-25 full moon at about 5° Libra.
  const a = moonSign(new Date('2024-01-25T17:54:00Z'));
  assert.equal(a.sign, 'leo');
  near(a.degree, 5.2, 1, 'Leo degree');
  assert.equal(a.ruler, 'sun');
  assert.equal(moonSign(new Date('2024-03-25T07:00:00Z')).sign, 'libra');
});
