// Conditioning / keep logic. Pure functions (no DOM) so they can be unit tested.
// Dates are local calendar days as "YYYY-MM-DD" strings.

/**
 * Log types and their fields. Field kinds:
 *  weight  - decimal kilos (grams accepted and converted)
 *  text    - free text, optional suggestion list (see constants.js)
 *  number  - whole number
 *  date    - calendar date
 *  rating  - 1..5 picked from buttons (no keyboard)
 */
export const LOG_TYPES = {
  weight: [{ k: 'weight', kind: 'weight', required: true }],
  feed: [{ k: 'feed', kind: 'text', list: 'feeds', required: true }, { k: 'amount', kind: 'text' }],
  exercise: [{ k: 'activity', kind: 'text', list: 'activities', required: true }, { k: 'minutes', kind: 'number' }],
  sparring: [{ k: 'partner', kind: 'text' }, { k: 'minutes', kind: 'number' }, { k: 'rating', kind: 'rating' }],
  vitamins: [{ k: 'product', kind: 'text', list: 'vitamins', required: true }, { k: 'dose', kind: 'text' }],
  vaccine: [{ k: 'product', kind: 'text', list: 'vaccines', required: true }, { k: 'nextDue', kind: 'date' }],
  deworm: [{ k: 'product', kind: 'text', list: 'dewormers', required: true }, { k: 'nextDue', kind: 'date' }],
  health: [{ k: 'issue', kind: 'text', required: true }, { k: 'treatment', kind: 'text' }],
};

const pad = (n) => String(n).padStart(2, '0');

export function toDateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const todayStr = () => toDateStr(new Date());

export const isDateStr = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Whole days from a to b (b - a). Uses UTC to avoid daylight-saving drift. */
export function daysBetween(a, b) {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 864e5);
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/**
 * Read a weight typed on a phone. "2.15", "2,15" -> 2.15 kg.
 * Values over 20 are taken as grams ("2150" -> 2.15 kg). Returns NaN if unreadable.
 */
export function parseWeight(input) {
  const s = String(input ?? '').trim().toLowerCase().replace(',', '.').replace(/\s*(kg|kilos?|g|grams?)$/, '');
  if (!/^\d*\.?\d+$/.test(s)) return NaN;
  let v = Number(s);
  if (v > 20) v /= 1000;
  return v > 0 && v <= 20 ? Math.round(v * 1000) / 1000 : NaN;
}

export function formatKg(kg) {
  if (!(kg > 0)) return '';
  const twoDecimals = Math.abs(kg * 100 - Math.round(kg * 100)) < 1e-6;
  return `${kg.toFixed(twoDecimals ? 2 : 3)} kg`;
}

/** Day counter for a keep (conditioning program before a derby). */
export function keepProgress(keep, today = todayStr()) {
  const day = daysBetween(keep.startDate, today) + 1;
  const total = keep.fightDate ? daysBetween(keep.startDate, keep.fightDate) + 1 : null;
  const daysLeft = keep.fightDate ? daysBetween(today, keep.fightDate) : null;
  let phase = 'running';
  if (day < 1) phase = 'notStarted';
  else if (daysLeft === 0) phase = 'fightDay';
  else if (daysLeft !== null && daysLeft < 0) phase = 'past';
  const fraction = total ? Math.min(1, Math.max(0, day / total)) : null;
  return { day, total, daysLeft, phase, fraction };
}

/** Weight points for a bird, oldest first, optionally limited to a date window. */
export function weightSeries(logs, birdId, from = null, to = null) {
  return logs
    .filter((l) => l.birdId === birdId && l.type === 'weight' && l.data?.weight > 0)
    .filter((l) => (!from || l.date >= from) && (!to || l.date <= to))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0))
    .map((l) => ({ date: l.date, kg: l.data.weight, id: l.id }));
}

export function latestWeight(logs, birdId) {
  const s = weightSeries(logs, birdId);
  return s.length ? s[s.length - 1] : null;
}

/**
 * Vaccines and dewormings coming due (or overdue) within `windowDays`.
 * Only the latest dose per bird + type + product counts, so giving the next
 * dose clears the reminder. Birds that are sold or deceased are skipped.
 */
export function dueItems(logs, birdsById, today = todayStr(), windowDays = 14) {
  const latest = new Map();
  for (const l of logs) {
    if ((l.type !== 'vaccine' && l.type !== 'deworm') || !l.data) continue;
    const key = `${l.birdId}|${l.type}|${String(l.data.product || '').trim().toLowerCase()}`;
    const cur = latest.get(key);
    if (!cur || l.date > cur.date || (l.date === cur.date && (l.createdAt || 0) > (cur.createdAt || 0))) latest.set(key, l);
  }
  const out = [];
  for (const l of latest.values()) {
    const bird = birdsById.get(l.birdId);
    if (!bird || bird.status === 'sold' || bird.status === 'deceased') continue;
    if (!isDateStr(l.data.nextDue)) continue;
    const days = daysBetween(today, l.data.nextDue);
    if (days <= windowDays) out.push({ log: l, bird, days });
  }
  return out.sort((a, b) => a.days - b.days);
}
