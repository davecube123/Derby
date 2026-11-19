import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRequest, finalizeAdvice, mockAdvice, buildUserContent, ADVICE_SCHEMA, SYSTEM_PROMPT } from '../pro-server/advisor.js';
import { advisorPayload } from '../js/advisor.js';

const bird = (id, sex, extra = {}) => ({ id, name: id, sex, status: 'brood', sireId: null, damId: null, compositionMode: 'manual', composition: {}, ...extra });
const byId = new Map([
  ['S', bird('S', 'cock', { composition: { Sweater: 1 } })],
  ['K', bird('K', 'hen', { composition: { Kelso: 1 } })],
  ['D', bird('D', 'pullet', { sireId: 'S', damId: 'K', compositionMode: 'auto' })],
  ['H', bird('H', 'hen', { composition: { Hatch: 1 } })],
]);
const payload = () => advisorPayload(byId, 'S', { goal: 'battle', rules: '- Max 12.5% inbreeding', lang: 'en', maxInbreeding: 0.125 }, new Date('2026-11-19'));

test('the payload the app builds passes the server checks', () => {
  assert.equal(validateRequest(payload()), null);
});

test('server rejects bad or oversized requests', () => {
  const p = payload();
  assert.match(validateRequest({ ...p, lang: 'fr' }), /lang/);
  assert.match(validateRequest({ ...p, rules: 'x'.repeat(3001) }), /rules/);
  assert.match(validateRequest({ ...p, candidates: [] }), /candidates/);
  assert.match(validateRequest({ ...p, candidates: [p.candidates[0], p.candidates[0]] }), /duplicated/);
  assert.match(validateRequest({ ...p, bird: { ...p.bird, sex: 'dragon' } }), /sex/);
  assert.match(validateRequest(null), /JSON object/);
});

test('finalize forces "avoid" over the inbreeding limit, drops unknown ids, fills missing ones, sorts', () => {
  const p = payload();
  const raw = {
    summary: 'ok', advice: 'a',
    recommendations: [
      { candidateId: 'D', verdict: 'recommended', fit: 99, reasons: ['Linebreed to fix the line'], cautions: [] },
      { candidateId: 'ZZZ', verdict: 'recommended', fit: 100, reasons: [], cautions: [] },
      { candidateId: 'H', verdict: 'recommended', fit: 150, reasons: ['Good cross'], cautions: [] },
      { candidateId: 'H', verdict: 'avoid', fit: 1, reasons: [], cautions: [] },
    ],
  };
  const out = finalizeAdvice(raw, p);
  assert.deepEqual(out.recommendations.map((r) => [r.candidateId, r.verdict]), [['H', 'recommended'], ['K', 'possible'], ['D', 'avoid']]);
  assert.equal(out.recommendations[0].fit, 100);
  const d = out.recommendations.find((r) => r.candidateId === 'D');
  assert.ok(d.fit <= 20);
  assert.match(d.cautions[0], /inbreeding limit \(25%\)/);
});

test('practice mode answers every candidate and keeps the guard', () => {
  const out = mockAdvice(payload());
  assert.equal(out.recommendations.length, 3);
  assert.equal(out.recommendations.find((r) => r.candidateId === 'D').verdict, 'avoid');
});

test('the breeder data goes in the user turn as data; the system prompt stays fixed for caching', () => {
  const content = buildUserContent(payload());
  assert.match(content, /<request>/);
  assert.match(content, /Max 12.5% inbreeding/);
  assert.ok(!SYSTEM_PROMPT.includes('Max 12.5%'));
  assert.equal(ADVICE_SCHEMA.additionalProperties, false);
  assert.deepEqual(ADVICE_SCHEMA.required, ['summary', 'recommendations', 'advice']);
});
