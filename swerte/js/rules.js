// Derby Swerte rules: planet colors → feather colors, planet friendships, and scoring.
// Pure (no DOM), unit tested. The app shows these tables in "How it works" so users can check them.

/** Traditional planet colors and the feather colors Derby Swerte maps to them. */
export const PLANETS = {
  sun: { glyph: '☉', color: 'gold', feathers: ['lemon', 'pumpkin'] },
  moon: { glyph: '☽', color: 'white', feathers: ['white', 'talisain', 'grey'] },
  mars: { glyph: '♂', color: 'red', feathers: ['red', 'darkred', 'brownred'] },
  mercury: { glyph: '☿', color: 'mixed', feathers: ['bulik', 'spangled'] },
  jupiter: { glyph: '♃', color: 'blue', feathers: ['blue'] },
  venus: { glyph: '♀', color: 'copper', feathers: ['ginger', 'lightred'] },
  saturn: { glyph: '♄', color: 'black', feathers: ['black'] },
};

/** Feather colors with a swatch for the picker (identity is always also given by the name). */
export const FEATHERS = {
  lemon: '#e3cf5f', pumpkin: '#d98a2f', white: '#f3f2ec', talisain: '#d9d2bd', grey: '#8f959b',
  red: '#c0392b', darkred: '#7a1d17', brownred: '#6e3b24', ginger: '#b8652a', lightred: '#de6b55',
  bulik: 'repeating-linear-gradient(45deg,#e8e4da 0 4px,#2b2b2b 4px 8px)',
  spangled: 'radial-gradient(circle at 30% 30%,#e8e4da 2px,transparent 3px) 0 0/8px 8px,#7a1d17',
  blue: '#58738f', black: '#141414',
};

export const planetOfFeather = (feather) => Object.keys(PLANETS).find((p) => PLANETS[p].feathers.includes(feather)) || null;

/** Classical natural friendships (Naisargika Maitri): how each planet regards the others. */
export const FRIENDS = {
  sun: { friends: ['moon', 'mars', 'jupiter'], enemies: ['venus', 'saturn'] },
  moon: { friends: ['sun', 'mercury'], enemies: [] },
  mars: { friends: ['sun', 'moon', 'jupiter'], enemies: ['mercury'] },
  mercury: { friends: ['sun', 'venus'], enemies: ['moon'] },
  jupiter: { friends: ['sun', 'moon', 'mars'], enemies: ['mercury', 'venus'] },
  venus: { friends: ['mercury', 'saturn'], enemies: ['sun', 'moon'] },
  saturn: { friends: ['mercury', 'venus'], enemies: ['sun', 'moon', 'mars'] },
};

export const POINTS = { hourRuler: 3, hourFriend: 1, hourEnemy: -2, dayRuler: 2, moonSign: 1 };

/**
 * Score a feather color at a moment.
 * @param ctx { hourRuler, dayRuler, moonRuler } planets in force
 * @returns { score, planet, reasons: [{ key, points, planet }] }
 */
export function scoreFeather(feather, ctx) {
  const p = planetOfFeather(feather);
  const reasons = [];
  if (!p) return { score: 0, planet: null, reasons };
  if (p === ctx.hourRuler) reasons.push({ key: 'hourRuler', points: POINTS.hourRuler, planet: p });
  else if (FRIENDS[ctx.hourRuler].friends.includes(p)) reasons.push({ key: 'hourFriend', points: POINTS.hourFriend, planet: ctx.hourRuler });
  else if (FRIENDS[ctx.hourRuler].enemies.includes(p)) reasons.push({ key: 'hourEnemy', points: POINTS.hourEnemy, planet: ctx.hourRuler });
  if (p === ctx.dayRuler) reasons.push({ key: 'dayRuler', points: POINTS.dayRuler, planet: p });
  if (p === ctx.moonRuler) reasons.push({ key: 'moonSign', points: POINTS.moonSign, planet: p });
  return { score: reasons.reduce((a, r) => a + r.points, 0), planet: p, reasons };
}

/** strong ≥ 3, favored 1–2, neutral 0, notFavored < 0 */
export function verdict(score) {
  if (score >= 3) return 'strong';
  if (score >= 1) return 'favored';
  if (score === 0) return 'neutral';
  return 'notFavored';
}

/** All feather colors ranked for a moment, best first. */
export function rankFeathers(ctx) {
  return Object.keys(FEATHERS)
    .map((f) => ({ feather: f, ...scoreFeather(f, ctx) }))
    .sort((a, b) => b.score - a.score);
}

/** Compare two cocks' colors at a moment. margin ≥ 2 favors one side; otherwise even. */
export function compare(mine, theirs, ctx) {
  const a = scoreFeather(mine, ctx);
  const b = scoreFeather(theirs, ctx);
  const margin = a.score - b.score;
  const outcome = margin >= 2 ? 'mine' : margin <= -2 ? 'theirs' : 'even';
  return { mine: a, theirs: b, margin, outcome };
}
