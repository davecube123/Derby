// Turn a Derby backup / pedigree file into Derby Keep birds. Pure (no DOM), unit tested.
import { effectiveComposition, sortedEntries, formatShare } from '../../js/genetics.js';

const SEXES = ['cock', 'stag', 'hen', 'pullet'];
const str = (v, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');

/** "1/2 Sweater · 1/4 Kelso · 1/4 Hatch" from a Derby composition. */
export function bloodlineText(comp, max = 4) {
  const entries = sortedEntries(comp);
  if (!entries.length) return '';
  const shown = entries.slice(0, max).map(([k, v]) => `${formatShare(v)} ${k}`);
  if (entries.length > max) shown.push('…');
  return shown.join(' · ');
}

export const isDerbyFile = (data) => !!data && data.app === 'derby' && Array.isArray(data.birds);

/**
 * Birds from a Derby file, ready for Derby Keep. Bloodlines are worked out
 * with Derby's own math (so "auto" birds get their blood from the parents in
 * the same file). `preselect` is true for live cocks and stags.
 */
export function derbyBirds(data) {
  if (!isDerbyFile(data)) return [];
  const valid = data.birds.filter((b) => b && typeof b.id === 'string' && b.id);
  const byId = new Map(valid.map((b) => [b.id, b]));
  const memo = new Map();
  return valid.map((b) => {
    const sex = SEXES.includes(b.sex) ? b.sex : '';
    const status = b.status === 'sold' || b.status === 'deceased' ? b.status : 'active';
    return {
      id: str(b.id, 80),
      name: str(b.name),
      wingband: str(b.wingband, 40),
      legband: str(b.legband, 40),
      sex,
      status,
      bloodline: bloodlineText(effectiveComposition(byId, b.id, memo)),
      notes: '',
      source: 'derby',
      createdAt: Number(b.createdAt) || Date.now(),
      updatedAt: Date.now(),
      preselect: (sex === 'cock' || sex === 'stag') && status === 'active',
    };
  });
}
