// Derby Pro pairing advisor: everything that can be calculated exactly is done here,
// on the phone, with Derby's own genetics. The AI only ranks and explains.
import { createPedigree, crossCompositions, effectiveComposition, sortedEntries, formatShare } from './genetics.js';
import { SEX } from './constants.js';

export const MAX_CANDIDATES = 25;
export const GOALS = ['balanced', 'keepLine', 'outcross', 'battle'];
export const INBREEDING_LIMITS = [0.0625, 0.125, 0.25, 0.375];

const live = (b) => b.status !== 'sold' && b.status !== 'deceased';
const name = (b) => b?.name || (b?.wingband && `WB ${b.wingband}`) || (b?.legband && `LB ${b.legband}`) || 'Unnamed';
const bloodText = (comp) => sortedEntries(comp).slice(0, 6).map(([k, v]) => `${formatShare(v)} ${k}`);

export function ageMonths(hatchDate, today = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hatchDate || '')) return null;
  const [y, m, d] = hatchDate.split('-').map(Number);
  let months = (today.getFullYear() - y) * 12 + (today.getMonth() + 1 - m);
  if (today.getDate() < d) months -= 1;
  return months >= 0 ? months : null;
}

/** Birds that can be paired with `birdId`: live, opposite sex. Each with the chicks' blood and inbreeding. */
export function pairingCandidates(byId, birdId, maxInbreeding = 0.125) {
  const bird = byId.get(birdId);
  if (!bird || !SEX[bird.sex]) return [];
  const male = SEX[bird.sex].male;
  const ped = createPedigree(byId);
  const memo = new Map();
  const list = [...byId.values()]
    .filter((c) => c.id !== birdId && SEX[c.sex] && SEX[c.sex].male !== male && live(c))
    .map((c) => {
      const [sire, dam] = male ? [bird, c] : [c, bird];
      const comp = crossCompositions(effectiveComposition(byId, sire.id, memo), effectiveComposition(byId, dam.id, memo));
      const inbreeding = ped.kinship(sire.id, dam.id);
      const shared = ped.commonAncestors(sire.id, dam.id).slice(0, 4).map((x) => ({ name: name(byId.get(x.id)), sireSide: x.a, damSide: x.b }));
      return { bird: c, sireId: sire.id, damId: dam.id, offspring: { bloodline: bloodText(comp), inbreeding, shared }, overLimit: inbreeding > maxInbreeding + 1e-9 };
    });
  // Within the limit first, then least related; cap what is sent to the advisor.
  list.sort((a, b) => Number(a.overLimit) - Number(b.overLimit) || a.offspring.inbreeding - b.offspring.inbreeding || name(a.bird).localeCompare(name(b.bird)));
  return list.slice(0, MAX_CANDIDATES);
}

const describe = (byId, b, today) => ({
  id: b.id,
  name: name(b),
  sex: b.sex,
  bands: [b.wingband && `WB ${b.wingband}`, b.legband && `LB ${b.legband}`].filter(Boolean).join(' · '),
  ageMonths: ageMonths(b.hatchDate, today),
  status: b.status || '',
  bloodline: bloodText(effectiveComposition(byId, b.id)),
  color: b.color || '',
  breeder: b.breeder || '',
  notes: (b.notes || '').slice(0, 400),
});

/** The request sent to the Derby Pro server. Only these fields leave the phone. */
export function advisorPayload(byId, birdId, { goal = 'balanced', maxInbreeding = 0.125, note = '', rules = '', lang = 'en' } = {}, today = new Date()) {
  const bird = byId.get(birdId);
  const candidates = pairingCandidates(byId, birdId, maxInbreeding);
  return {
    lang: lang === 'tl' ? 'tl' : 'en',
    goal: GOALS.includes(goal) ? goal : 'balanced',
    maxInbreeding,
    note: String(note).slice(0, 500),
    rules: String(rules).slice(0, 3000),
    bird: describe(byId, bird, today),
    candidates: candidates.map((c) => ({
      ...describe(byId, c.bird, today),
      offspring: { bloodline: c.offspring.bloodline, inbreedingPercent: Math.round(c.offspring.inbreeding * 10000) / 100, sharedAncestors: c.offspring.shared },
      overLimit: c.overLimit,
    })),
  };
}
