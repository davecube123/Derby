import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLANETS, FEATHERS, FRIENDS, planetOfFeather, scoreFeather, verdict, rankFeathers, compare } from '../swerte/js/rules.js';

test('every feather color belongs to exactly one planet, and every planet has one', () => {
  const owners = Object.keys(FEATHERS).map((f) => Object.keys(PLANETS).filter((p) => PLANETS[p].feathers.includes(f)));
  assert.ok(owners.every((o) => o.length === 1));
  assert.ok(Object.values(PLANETS).every((p) => p.feathers.length > 0));
  assert.equal(planetOfFeather('red'), 'mars');
  assert.equal(planetOfFeather('nope'), null);
});

test('friendship table covers all planets and never lists a planet as both', () => {
  for (const [p, rel] of Object.entries(FRIENDS)) {
    assert.ok(PLANETS[p]);
    assert.ok(!rel.friends.some((x) => rel.enemies.includes(x)), p);
    assert.ok(!rel.friends.includes(p) && !rel.enemies.includes(p));
  }
});

test('scoring: hour ruler, day ruler and moon sign add up; enemies subtract', () => {
  // Tuesday (Mars day), hour of Mars, Moon in Aries (Mars): red gets 3 + 2 + 1.
  const ctx = { hourRuler: 'mars', dayRuler: 'mars', moonRuler: 'mars' };
  assert.deepEqual(scoreFeather('red', ctx).reasons.map((r) => r.key), ['hourRuler', 'dayRuler', 'moonSign']);
  assert.equal(scoreFeather('red', ctx).score, 6);
  assert.equal(scoreFeather('lemon', ctx).score, 1); // Sun is Mars's friend
  assert.equal(scoreFeather('bulik', ctx).score, -2); // Mercury is Mars's enemy
  assert.equal(scoreFeather('ginger', ctx).score, 0); // Venus neutral to Mars
  assert.equal(verdict(6), 'strong');
  assert.equal(verdict(1), 'favored');
  assert.equal(verdict(0), 'neutral');
  assert.equal(verdict(-2), 'notFavored');
  assert.equal(rankFeathers(ctx)[0].planet, 'mars');
});

test('compare needs a 2-point margin to favor a side', () => {
  const ctx = { hourRuler: 'saturn', dayRuler: 'sun', moonRuler: 'venus' };
  const r = compare('black', 'lemon', ctx); // black: 3 ; lemon: Sun is Saturn's enemy -2, +2 day ruler = 0
  assert.equal(r.mine.score, 3);
  assert.equal(r.theirs.score, 0);
  assert.equal(r.outcome, 'mine');
  assert.equal(compare('lemon', 'black', ctx).outcome, 'theirs');
  assert.equal(compare('red', 'darkred', ctx).outcome, 'even');
});
