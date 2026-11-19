// Pure pedigree / bloodline math. No DOM access, so it can be unit tested in Node.
// `byId` is always a Map of bird id -> bird record.

export const UNKNOWN = 'Unknown';
const EPS = 1e-9;

const getBird = (byId, id) => (id ? byId.get(id) || null : null);

export function hasComposition(comp) {
  return !!comp && Object.values(comp).some((v) => v > EPS);
}

/** Merge duplicate lines, drop empty rows, and fill any remainder with "Unknown". */
export function cleanComposition(comp) {
  const out = {};
  let total = 0;
  for (const [rawKey, v] of Object.entries(comp || {})) {
    const key = String(rawKey).trim();
    if (!key || !(v > EPS)) continue;
    out[key] = (out[key] || 0) + v;
    total += v;
  }
  if (total > EPS && total < 1 - EPS) out[UNKNOWN] = (out[UNKNOWN] || 0) + (1 - total);
  return out;
}

/** Offspring blood = half of each parent. A missing parent counts as "Unknown". */
export function crossCompositions(sireComp, damComp) {
  const out = {};
  for (const comp of [sireComp, damComp]) {
    const src = hasComposition(comp) ? comp : { [UNKNOWN]: 1 };
    for (const [k, v] of Object.entries(src)) out[k] = (out[k] || 0) + v / 2;
  }
  return out;
}

/**
 * The bloodline of a bird. Birds in "auto" mode are calculated from their
 * recorded parents; "manual" birds (foundation stock) use what was entered.
 */
export function effectiveComposition(byId, id, memo = new Map(), visiting = new Set()) {
  const bird = getBird(byId, id);
  if (!bird) return {};
  if (memo.has(id)) return memo.get(id);
  let result = null;
  if (bird.compositionMode === 'auto' && !visiting.has(id)) {
    visiting.add(id);
    const sire = getBird(byId, bird.sireId);
    const dam = getBird(byId, bird.damId);
    if (sire || dam) {
      result = crossCompositions(
        sire ? effectiveComposition(byId, sire.id, memo, visiting) : null,
        dam ? effectiveComposition(byId, dam.id, memo, visiting) : null,
      );
    }
    visiting.delete(id);
  }
  if (!result) result = hasComposition(bird.composition) ? { ...bird.composition } : {};
  memo.set(id, result);
  return result;
}

/** Entries sorted largest share first, "Unknown" always last. */
export function sortedEntries(comp) {
  return Object.entries(comp || {})
    .filter(([, v]) => v > EPS)
    .sort(([ka, a], [kb, b]) => {
      if (ka === UNKNOWN) return 1;
      if (kb === UNKNOWN) return -1;
      return b - a || ka.localeCompare(kb);
    });
}

/** 0.5 -> "1/2", 0.375 -> "3/8", 1 -> "Full", odd values -> percent. */
export function formatShare(x) {
  if (Math.abs(x - 1) < 1e-6) return 'Full';
  for (let d = 2; d <= 256; d *= 2) {
    const n = x * d;
    if (Math.abs(n - Math.round(n)) < 1e-6) return `${Math.round(n)}/${d}`;
  }
  return `${(x * 100).toFixed(1).replace(/\.0$/, '')}%`;
}

/** Accepts "1/2", "50%", "0.5", "50". Returns NaN when it can't be read. */
export function parseShare(input) {
  const s = String(input ?? '').trim().replace(',', '.');
  if (!s) return NaN;
  let m = s.match(/^(\d+(?:\.\d+)?)\s*%$/);
  if (m) return Number(m[1]) / 100;
  m = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (m) return Number(m[2]) ? Number(m[1]) / Number(m[2]) : NaN;
  if (/^\d*\.?\d+$/.test(s)) {
    const v = Number(s);
    return v <= 1 ? v : v / 100;
  }
  if (/^(full|pure)$/i.test(s)) return 1;
  return NaN;
}

/** Pedigree helpers (kinship, inbreeding, ancestry) with memoisation. */
export function createPedigree(byId) {
  const depthMemo = new Map();
  const kinMemo = new Map();
  const fMemo = new Map();
  const has = (id) => !!(id && byId.has(id));

  function parents(id) {
    const b = byId.get(id);
    return [has(b.sireId) ? b.sireId : null, has(b.damId) ? b.damId : null];
  }

  // Generations of recorded ancestry above this bird. A bird can never be an
  // ancestor of a bird with an equal or smaller depth.
  function depth(id) {
    if (depthMemo.has(id)) return depthMemo.get(id);
    depthMemo.set(id, 0); // cycle guard
    const [s, d] = parents(id);
    const v = s || d ? 1 + Math.max(s ? depth(s) : 0, d ? depth(d) : 0) : 0;
    depthMemo.set(id, v);
    return v;
  }

  /** Wright's coefficient of inbreeding (0..1). */
  function inbreeding(id) {
    if (!has(id)) return 0;
    if (fMemo.has(id)) return fMemo.get(id);
    fMemo.set(id, 0);
    const [s, d] = parents(id);
    const v = s && d ? kinship(s, d) : 0;
    fMemo.set(id, v);
    return v;
  }

  /** Coefficient of kinship: inbreeding of a hypothetical offspring of a x b. */
  function kinship(a, b) {
    if (!has(a) || !has(b)) return 0;
    if (a === b) return (1 + inbreeding(a)) / 2;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (kinMemo.has(key)) return kinMemo.get(key);
    kinMemo.set(key, 0);
    let x = a;
    let y = b;
    if (depth(x) < depth(y)) [x, y] = [y, x];
    const [s, d] = parents(x);
    const v = (kinship(s, y) + kinship(d, y)) / 2;
    kinMemo.set(key, v);
    return v;
  }

  /** [[sire, dam], [ss, sd, ds, dd], ...] with null for unknown slots. */
  function ancestorsByGeneration(id, generations) {
    const out = [];
    let current = [id];
    for (let g = 0; g < generations; g++) {
      const next = [];
      for (const cid of current) {
        if (cid && has(cid)) next.push(...parents(cid));
        else next.push(null, null);
      }
      out.push(next);
      current = next;
    }
    return out;
  }

  /** Map of ancestor id -> closest generation distance (1 = parent). */
  function ancestorDistances(id) {
    const dist = new Map();
    const queue = [[id, 0]];
    while (queue.length) {
      const [cid, n] = queue.shift();
      if (!has(cid)) continue;
      for (const p of parents(cid)) {
        if (p && !dist.has(p) && p !== id) {
          dist.set(p, n + 1);
          queue.push([p, n + 1]);
        }
      }
    }
    return dist;
  }

  function isAncestor(ancestorId, id) {
    return ancestorDistances(id).has(ancestorId);
  }

  /** Birds appearing in both pedigrees (a bird counts as its own ancestor at distance 0). */
  function commonAncestors(a, b) {
    if (!has(a) || !has(b)) return [];
    const da = ancestorDistances(a);
    da.set(a, 0);
    const db = ancestorDistances(b);
    db.set(b, 0);
    const out = [];
    for (const [id, n] of da) if (db.has(id)) out.push({ id, a: n, b: db.get(id) });
    return out.sort((x, y) => x.a + x.b - (y.a + y.b));
  }

  return { inbreeding, kinship, depth, ancestorsByGeneration, ancestorDistances, isAncestor, commonAncestors };
}
