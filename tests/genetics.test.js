import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPedigree,
  crossCompositions,
  effectiveComposition,
  formatShare,
  parseShare,
  cleanComposition,
  UNKNOWN,
} from '../js/genetics.js';

const bird = (id, sireId = null, damId = null, extra = {}) => ({ id, sireId, damId, ...extra });
const mapOf = (...birds) => new Map(birds.map((b) => [b.id, b]));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('unrelated parents give zero inbreeding', () => {
  const p = createPedigree(mapOf(bird('s'), bird('d'), bird('x', 's', 'd')));
  close(p.inbreeding('x'), 0);
});

test('full-sibling mating gives 25%', () => {
  const p = createPedigree(
    mapOf(bird('s'), bird('d'), bird('b1', 's', 'd'), bird('b2', 's', 'd'), bird('x', 'b1', 'b2')),
  );
  close(p.inbreeding('x'), 0.25);
});

test('half-sibling mating gives 12.5%', () => {
  const p = createPedigree(
    mapOf(bird('s'), bird('d1'), bird('d2'), bird('b1', 's', 'd1'), bird('b2', 's', 'd2'), bird('x', 'b1', 'b2')),
  );
  close(p.inbreeding('x'), 0.125);
});

test('father x daughter gives 25%', () => {
  const p = createPedigree(mapOf(bird('s'), bird('d'), bird('dau', 's', 'd'), bird('x', 's', 'dau')));
  close(p.inbreeding('x'), 0.25);
});

test('first cousins give 6.25%', () => {
  const p = createPedigree(
    mapOf(
      bird('gs'), bird('gd'), bird('m1'), bird('m2'),
      bird('a', 'gs', 'gd'), bird('b', 'gs', 'gd'),
      bird('c1', 'a', 'm1'), bird('c2', 'm2', 'b'),
      bird('x', 'c1', 'c2'),
    ),
  );
  close(p.inbreeding('x'), 0.0625);
});

test('two generations of full-sib mating gives 37.5%', () => {
  const p = createPedigree(
    mapOf(
      bird('s'), bird('d'),
      bird('a', 's', 'd'), bird('b', 's', 'd'),
      bird('c', 'a', 'b'), bird('e', 'a', 'b'),
      bird('x', 'c', 'e'),
    ),
  );
  close(p.inbreeding('x'), 0.375);
});

test('ancestors by generation fills unknowns with null', () => {
  const p = createPedigree(mapOf(bird('s'), bird('x', 's', null)));
  assert.deepEqual(p.ancestorsByGeneration('x', 2), [['s', null], [null, null, null, null]]);
  assert.equal(p.isAncestor('s', 'x'), true);
  assert.equal(p.isAncestor('x', 's'), false);
});

test('bloodline of offspring is half of each parent', () => {
  const byId = mapOf(
    bird('s', null, null, { compositionMode: 'manual', composition: { Sweater: 1 } }),
    bird('d', null, null, { compositionMode: 'manual', composition: { Kelso: 0.5, Hatch: 0.5 } }),
    bird('x', 's', 'd', { compositionMode: 'auto' }),
    bird('y', 'x', null, { compositionMode: 'auto' }),
  );
  assert.deepEqual(effectiveComposition(byId, 'x'), { Sweater: 0.5, Kelso: 0.25, Hatch: 0.25 });
  assert.deepEqual(effectiveComposition(byId, 'y'), { Sweater: 0.25, Kelso: 0.125, Hatch: 0.125, [UNKNOWN]: 0.5 });
});

test('crossing with no data gives all unknown', () => {
  assert.deepEqual(crossCompositions(null, null), { [UNKNOWN]: 1 });
});

test('share formatting and parsing', () => {
  assert.equal(formatShare(1), 'Full');
  assert.equal(formatShare(0.5), '1/2');
  assert.equal(formatShare(0.375), '3/8');
  assert.equal(formatShare(1 / 3), '33.3%');
  close(parseShare('1/2'), 0.5);
  close(parseShare('25%'), 0.25);
  close(parseShare('0.75'), 0.75);
  close(parseShare('50'), 0.5);
  assert.ok(Number.isNaN(parseShare('abc')));
});

test('cleanComposition merges duplicates and fills unknown', () => {
  assert.deepEqual(cleanComposition({ Sweater: 0.25, ' Sweater ': 0.25, '': 0.1 }), { Sweater: 0.5, [UNKNOWN]: 0.5 });
});
