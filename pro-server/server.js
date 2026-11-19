// Derby Pro server: one endpoint, POST /api/pairing, that asks Claude to rank mates.
// The Claude API key lives only here, never in the Derby app.
//
// Environment:
//   ANTHROPIC_API_KEY  Claude API key (or any credential the SDK can find)
//   ACCESS_CODES       comma-separated codes the app must send (required)
//   ALLOWED_ORIGINS    comma-separated sites allowed to call (default: GitHub Pages + localhost)
//   PORT               default 8787
//   MOCK=1             practice mode: no AI call, ranks by inbreeding
//   HOURLY_LIMIT       questions per access code per hour (default 20)
import http from 'node:http';
import Anthropic from '@anthropic-ai/sdk';
import { MODEL, SYSTEM_PROMPT, ADVICE_SCHEMA, validateRequest, buildUserContent, finalizeAdvice, mockAdvice } from './advisor.js';

const PORT = Number(process.env.PORT) || 8787;
const MOCK = process.env.MOCK === '1';
const CODES = new Set((process.env.ACCESS_CODES || '').split(',').map((s) => s.trim()).filter(Boolean));
const ORIGINS = new Set((process.env.ALLOWED_ORIGINS || 'https://davecube123.github.io,http://localhost:8080').split(',').map((s) => s.trim()));
const HOURLY_LIMIT = Number(process.env.HOURLY_LIMIT) || 20;
const MAX_BODY = 200_000;

if (!CODES.size) {
  console.error('Set ACCESS_CODES (comma-separated) so only your users can spend your AI credit.');
  process.exit(1);
}

if (!MOCK && !process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
  console.warn('No ANTHROPIC_API_KEY set: AI requests will fail. Set it, or run with MOCK=1 for practice mode.');
}

const client = MOCK ? null : new Anthropic();

// Simple per-code hourly limit (in memory; resets when the server restarts).
const usage = new Map();
function allow(code) {
  const now = Date.now();
  const recent = (usage.get(code) || []).filter((t) => now - t < 3600_000);
  if (recent.length >= HOURLY_LIMIT) { usage.set(code, recent); return false; }
  recent.push(now);
  usage.set(code, recent);
  return true;
}

function send(res, status, body, origin) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  if (origin && ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers.Vary = 'Origin';
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error('Request is too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null')); } catch { reject(Object.assign(new Error('Request is not valid JSON'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

async function askClaude(payload) {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default', // if Claude Opus 5.5 declines, Anthropic retries on its recommended fallback model
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: ADVICE_SCHEMA } },
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: buildUserContent(payload) }],
  });
  if (response.stop_reason === 'refusal') {
    throw Object.assign(new Error('The advisor declined this request'), { status: 422, code: 'refused' });
  }
  if (response.stop_reason === 'max_tokens') {
    throw Object.assign(new Error('The answer was cut off; try with fewer birds'), { status: 502, code: 'truncated' });
  }
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  let raw;
  try { raw = JSON.parse(text); } catch { throw Object.assign(new Error('The advisor answer could not be read'), { status: 502, code: 'bad_answer' }); }
  console.log(`pairing ok · model ${response.model} · in ${response.usage.input_tokens} (cached ${response.usage.cache_read_input_tokens ?? 0}) · out ${response.usage.output_tokens}`);
  return { advice: finalizeAdvice(raw, payload), model: response.model };
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (req.method === 'OPTIONS') {
    const headers = { 'Access-Control-Allow-Methods': 'POST, GET', 'Access-Control-Allow-Headers': 'Content-Type, X-Access-Code', 'Access-Control-Max-Age': '600' };
    if (origin && ORIGINS.has(origin)) { headers['Access-Control-Allow-Origin'] = origin; headers.Vary = 'Origin'; }
    res.writeHead(204, headers);
    return res.end();
  }
  const url = new URL(req.url, 'http://x');
  if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { ok: true, mode: MOCK ? 'practice' : 'ai', model: MOCK ? null : MODEL }, origin);
  if (req.method !== 'POST' || url.pathname !== '/api/pairing') return send(res, 404, { error: 'Not found' }, origin);

  const code = String(req.headers['x-access-code'] || '');
  if (!CODES.has(code)) return send(res, 401, { error: 'Access code not accepted', code: 'auth' }, origin);
  if (!allow(code)) return send(res, 429, { error: 'Hourly limit reached', code: 'limit' }, origin);

  try {
    const payload = await readJson(req);
    const problem = validateRequest(payload);
    if (problem) return send(res, 400, { error: problem, code: 'invalid' }, origin);
    if (MOCK) return send(res, 200, { advice: mockAdvice(payload), model: 'practice', practice: true }, origin);
    const result = await askClaude(payload);
    return send(res, 200, { ...result, practice: false }, origin);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) { console.error('Claude API key rejected'); return send(res, 503, { error: 'Server AI key is not working', code: 'server' }, origin); }
    if (err instanceof Anthropic.RateLimitError) return send(res, 503, { error: 'AI is busy, try again shortly', code: 'busy' }, origin);
    if (err instanceof Anthropic.APIError) { console.error(`Claude API error ${err.status}: ${err.message}`); return send(res, 502, { error: 'AI request failed', code: 'server' }, origin); }
    if (err.status) return send(res, err.status, { error: err.message, code: err.code || 'invalid' }, origin);
    console.error(err);
    return send(res, 500, { error: 'Server error', code: 'server' }, origin);
  }
});

server.listen(PORT, () => console.log(`Derby Pro server on :${PORT} (${MOCK ? 'practice mode, no AI' : `AI: ${MODEL}`})`));
