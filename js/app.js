import * as db from './db.js';
import * as G from './genetics.js';
import { SEX, STATUS, PRESET_LINES, FEATHER_COLORS, LEG_COLORS, COMBS, LOG_SUGGESTIONS } from './constants.js';
import { LOG_TYPES, todayStr, isDateStr, daysBetween, addDays, parseWeight, formatKg, keepProgress, weightSeries, latestWeight, dueItems } from './conditioning.js';
import { weightChart, bindCharts } from './chart.js';
import { APP_VERSION } from './version.js';
import { t, getLang, setLang, locale, LANGS } from './i18n.js';
import * as install from './install.js';

const state = {
  birds: new Map(),
  customLines: [],
  logs: new Map(),
  keeps: new Map(),
  filter: { q: '', sex: 'all', status: 'all' },
};

const view = document.getElementById('view');
const titleEl = document.getElementById('title');
const backEl = document.getElementById('back');

// ---------- helpers ----------

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const uid = () =>
  globalThis.crypto?.randomUUID ? crypto.randomUUID() : `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

const $ = (sel, root = view) => root.querySelector(sel);
const $$ = (sel, root = view) => [...root.querySelectorAll(sel)];

const sexLabel = (k) => (SEX[k] ? t(`sex.${k}`) : '');
const statusLabel = (k) => (STATUS[k] ? t(`status.${k}`) : '');

const displayName = (b) => b?.name || (b?.wingband && `WB ${b.wingband}`) || (b?.legband && `LB ${b.legband}`) || 'Unnamed';

function bandLabel(b) {
  const parts = [];
  if (b.wingband) parts.push(`WB ${b.wingband}`);
  if (b.legband) parts.push(`LB ${b.legband}`);
  return parts.join(' · ');
}

function ageLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) months -= 1;
  if (months < 0) return '';
  if (months < 1) return t('age.lt1');
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y && t('age.y', { n: y }), m && t('age.m', { n: m })].filter(Boolean).join(' ');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(d.getTime()) ? dateStr : d.toLocaleDateString(locale(), { year: 'numeric', month: 'short', day: 'numeric' });
}

const pct = (f) => `${(f * 100).toFixed(f > 0 && f < 0.1 ? 2 : 1).replace(/\.?0+$/, '')}%`;

/** Bloodline names stay as entered; only the "Unknown" bucket is translated. */
const lineName = (k) => (k === G.UNKNOWN ? t('ped.unknown') : k);
const shareText = (v) => (Math.abs(v - 1) < 1e-6 ? t('share.full') : G.formatShare(v));

// Common blood fractions, picked from a list so nobody has to type "/" on a phone keyboard.
const SHARE_OPTIONS = [1, 15 / 16, 7 / 8, 13 / 16, 3 / 4, 11 / 16, 5 / 8, 9 / 16, 1 / 2, 7 / 16, 3 / 8, 5 / 16, 1 / 4, 3 / 16, 1 / 8, 1 / 16, 1 / 32];

function compSummary(comp, max = 3) {
  const entries = G.sortedEntries(comp);
  if (!entries.length) return t('comp.none');
  const shown = entries.slice(0, max).map(([k, v]) => `${shareText(v)} ${lineName(k)}`);
  if (entries.length > max) shown.push('…');
  return shown.join(' · ');
}

function inbreedingText(f) {
  if (f < 1e-6) return t('inb.none');
  if (f <= 0.0625 + 1e-6) return t('inb.low');
  if (f <= 0.125 + 1e-6) return t('inb.moderate');
  if (f <= 0.25 + 1e-6) return t('inb.high');
  return t('inb.veryHigh');
}

const allLines = () => [...new Set([...PRESET_LINES, ...state.customLines])].sort((a, b) => a.localeCompare(b));
const pedigree = () => G.createPedigree(state.birds);
const offspringOf = (id) =>
  [...state.birds.values()].filter((b) => b.sireId === id || b.damId === id).sort(byHatchDesc);

function byHatchDesc(a, b) {
  return (b.hatchDate || '').localeCompare(a.hatchDate || '') || displayName(a).localeCompare(displayName(b));
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 2800);
}

function setHeader(title, backHref) {
  titleEl.textContent = title;
  document.title = title === 'Derby' ? 'Derby' : `${title} · Derby`;
  if (backHref) {
    backEl.hidden = false;
    backEl.href = backHref;
  } else {
    backEl.hidden = true;
  }
}

function setActiveNav(section) {
  for (const a of document.querySelectorAll('.tabbar a')) {
    a.classList.toggle('on', a.dataset.nav === section);
    if (a.dataset.nav === section) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

const sexBadge = (b) => (SEX[b.sex] ? `<span class="badge sex-${b.sex}">${esc(sexLabel(b.sex))}</span>` : '');
const statusBadge = (b) => (STATUS[b.status] ? `<span class="badge status">${esc(statusLabel(b.status))}</span>` : '');

function thumb(b, cls = 'thumb') {
  if (b.photo) return `<img class="${cls}" src="${esc(b.photo)}" alt="">`;
  return `<span class="${cls} placeholder" aria-hidden="true">${noPhotoSvg}</span>`;
}

const noPhotoSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>`;

// ---------- language ----------

/** Translate the static shell (tab labels, aria labels) and the language switch. */
function applyShellLanguage() {
  document.documentElement.lang = getLang() === 'tl' ? 'tl' : 'en';
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
  for (const btn of document.querySelectorAll('.lang button')) {
    const on = btn.dataset.lang === getLang();
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', on);
  }
}

function initLanguageSwitch() {
  const wrap = document.getElementById('lang');
  wrap.innerHTML = Object.entries(LANGS)
    .map(([code, label]) => `<button type="button" data-lang="${code}" lang="${code}">${label}</button>`)
    .join('');
  for (const btn of wrap.querySelectorAll('button')) {
    btn.onclick = () => {
      if (btn.dataset.lang === getLang()) return;
      setLang(btn.dataset.lang);
      applyShellLanguage();
      // Re-rendering a form would throw away what the user typed.
      const { parts } = parseHash();
      const onForm = (['bird', 'keep'].includes(parts[0]) && (parts[1] === 'new' || parts[2] === 'edit')) || parts[0] === 'log';
      if (onForm) toast(t('lang.deferred'));
      else route({ keepScroll: true });
    };
  }
  applyShellLanguage();
}

// ---------- routing ----------

function parseHash() {
  const raw = location.hash.slice(1) || '/';
  const [path, query = ''] = raw.split('?');
  return { parts: path.split('/').filter(Boolean), query: new URLSearchParams(query) };
}

function route(opts = {}) {
  const { parts, query } = parseHash();
  if (!opts.keepScroll) window.scrollTo(0, 0);
  const section = parts[0] || 'birds';
  const navOf = { bird: 'birds', backup: 'more', log: 'keep' };
  setActiveNav(navOf[section] || section);
  if (!parts.length) return renderList();
  if (parts[0] === 'bird') {
    if (parts[1] === 'new') return renderForm(null, query);
    const bird = state.birds.get(parts[1]);
    if (!bird) return renderNotFound();
    if (parts[2] === 'edit') return renderForm(bird, query);
    if (parts[2] === 'logs') return renderBirdLogs(bird);
    return renderDetail(bird);
  }
  if (parts[0] === 'keep') {
    if (!parts[1]) return renderKeepHome();
    if (parts[1] === 'new') return renderKeepForm(null, query);
    const keep = state.keeps.get(parts[1]);
    if (!keep) return renderNotFound(t('keep.notFound'));
    return parts[2] === 'edit' ? renderKeepForm(keep, query) : renderKeep(keep);
  }
  if (parts[0] === 'log') {
    if (parts[1] === 'new') return renderLogForm(null, query);
    const log = state.logs.get(parts[1]);
    if (!log) return renderNotFound(t('log.notFound'));
    return renderLogForm(log, query);
  }
  if (parts[0] === 'mating') return renderMating(query, opts.keepScroll);
  if (parts[0] === 'lines') return renderLines();
  if (parts[0] === 'more' || parts[0] === 'backup') return renderMore();
  return renderNotFound();
}

function renderNotFound(text = t('notFound.text')) {
  setHeader(t('notFound.title'), '#/');
  view.innerHTML = `<div class="card empty"><p>${esc(text)}</p><a class="btn" href="#/">${t('notFound.back')}</a></div>`;
}

// ---------- bird list ----------

function renderList() {
  setHeader('Derby', null);
  const f = state.filter;

  if (!state.birds.size) {
    view.innerHTML = `
      ${install.bannerHTML()}
      <section class="card welcome">
        <img class="welcome-logo" src="icons/logo.png" alt="Derby logo">
        <h2>${t('welcome.title')}</h2>
        <p>${t('welcome.intro')}</p>
        <ol>
          <li>${t('welcome.step1')}</li>
          <li>${t('welcome.step2')}</li>
          <li>${t('welcome.step3')}</li>
        </ol>
        <a class="btn primary block" href="#/bird/new">${t('welcome.add')}</a>
        <button class="btn block" id="sample">${t('welcome.sample')}</button>
        <p class="muted small">${t('welcome.privacy')}</p>
      </section>
      <p class="version-foot">Derby v${APP_VERSION}</p>`;
    $('#sample').onclick = loadSampleData;
    install.bindBanner(view);
    return;
  }

  view.innerHTML = `
    ${install.bannerHTML()}
    <div class="toolbar">
      <input type="search" id="q" enterkeyhint="search" placeholder="${esc(t('list.search'))}" value="${esc(f.q)}" aria-label="${esc(t('list.searchAria'))}" autocomplete="off">
      <div class="chips" role="group" aria-label="${esc(t('list.sexAria'))}">
        ${['all', ...Object.keys(SEX)].map((s) => `<button type="button" class="chip${f.sex === s ? ' on' : ''}" data-sex="${s}" aria-pressed="${f.sex === s}">${esc(s === 'all' ? t('list.all') : sexLabel(s))}</button>`).join('')}
      </div>
      <select id="status" aria-label="${esc(t('list.statusAria'))}">
        <option value="all">${t('list.allStatuses')}</option>
        ${Object.keys(STATUS).map((k) => `<option value="${k}"${f.status === k ? ' selected' : ''}>${esc(statusLabel(k))}</option>`).join('')}
      </select>
    </div>
    <p class="count muted" id="count"></p>
    <ul class="bird-list" id="list"></ul>
    <a class="fab" href="#/bird/new" aria-label="${esc(t('list.add'))}">+</a>`;

  const draw = () => {
    const memo = new Map();
    const q = f.q.trim().toLowerCase();
    const items = [...state.birds.values()]
      .filter((b) => f.sex === 'all' || b.sex === f.sex)
      .filter((b) => f.status === 'all' || b.status === f.status)
      .filter((b) => {
        if (!q) return true;
        const comp = G.effectiveComposition(state.birds, b.id, memo);
        const hay = [b.name, b.wingband, b.legband, b.breeder, b.color, b.notes, ...Object.keys(comp)].join(' ').toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    $('#count').textContent = t('list.count', { n: items.length, total: state.birds.size });
    $('#list').innerHTML = items.length
      ? items.map((b) => birdCard(b, memo)).join('')
      : `<li class="card empty"><p>${t('list.none')}</p></li>`;
  };

  install.bindBanner(view);
  $('#q').oninput = (e) => { f.q = e.target.value; draw(); };
  $('#q').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } };
  $('#status').onchange = (e) => { f.status = e.target.value; draw(); };
  for (const chip of $$('.chip')) {
    chip.onclick = () => {
      f.sex = chip.dataset.sex;
      for (const c of $$('.chip')) {
        c.classList.toggle('on', c === chip);
        c.setAttribute('aria-pressed', c === chip);
      }
      draw();
    };
  }
  draw();
}

function birdCard(b, memo = new Map()) {
  const comp = G.effectiveComposition(state.birds, b.id, memo);
  const sub = [bandLabel(b), ageLabel(b.hatchDate)].filter(Boolean).join(' · ');
  return `<li><a class="bird-card" href="#/bird/${esc(b.id)}">
    ${thumb(b)}
    <div class="bc-main">
      <div class="bc-top"><strong>${esc(displayName(b))}</strong>${sexBadge(b)}</div>
      ${sub ? `<div class="bc-sub muted">${esc(sub)}</div>` : ''}
      <div class="bc-lines">${esc(compSummary(comp))}</div>
    </div>
  </a></li>`;
}

// ---------- bird detail ----------

function renderDetail(b) {
  setHeader(displayName(b), '#/');
  const ped = pedigree();
  const comp = G.effectiveComposition(state.birds, b.id);
  const f = ped.inbreeding(b.id);
  const kids = offspringOf(b.id);
  const male = SEX[b.sex]?.male;
  const age = ageLabel(b.hatchDate);
  const facts = [
    [t('f.hatched'), b.hatchDate ? `${formatDate(b.hatchDate)}${age ? ` (${age})` : ''}` : ''],
    [t('f.wingband'), b.wingband],
    [t('f.legband'), b.legband],
    [t('f.color'), b.color],
    [t('f.legColor'), b.legColor],
    [t('f.comb'), b.comb],
    [t('f.breeder'), b.breeder],
  ].filter(([, v]) => v);

  view.innerHTML = `
    <section class="hero">
      ${b.photo ? `<img class="hero-photo" src="${esc(b.photo)}" alt="${esc(t('photo.of', { name: displayName(b) }))}">` : `<div class="hero-photo placeholder" aria-hidden="true">${noPhotoSvg}</div>`}
      <div>
        <h2>${esc(displayName(b))}</h2>
        <div class="badges">${sexBadge(b)}${statusBadge(b)}</div>
        ${bandLabel(b) ? `<p class="muted">${esc(bandLabel(b))}</p>` : ''}
      </div>
    </section>

    <section class="card">
      <h3>${t('sec.bloodline')}</h3>
      ${compBars(comp)}
      <p class="muted small">${b.compositionMode === 'auto' ? t('comp.auto') : t('comp.manual')}</p>
    </section>

    <section class="card">
      <h3>${t('sec.inbreeding')}</h3>
      <p class="big">${pct(f)} <span class="muted small">${esc(inbreedingText(f))}</span></p>
      <p class="muted small">${t('inb.note')}</p>
    </section>

    <section class="card">
      <h3>${t('sec.pedigree')}</h3>
      ${pedigreeGrid(b.id, ped)}
    </section>

    ${conditioningSection(b)}

    ${facts.length ? `<section class="card"><h3>${t('sec.details')}</h3><dl class="facts">${facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></section>` : ''}

    ${b.notes ? `<section class="card"><h3>${t('sec.notes')}</h3><p class="notes">${esc(b.notes)}</p></section>` : ''}

    <section class="card">
      <div class="row-between"><h3>${t('sec.offspring', { n: kids.length })}</h3>
        ${SEX[b.sex] ? `<a class="btn small" href="#/bird/new?${male ? 'sire' : 'dam'}=${encodeURIComponent(b.id)}">${t('off.add')}</a>` : ''}
      </div>
      ${kids.length ? `<ul class="bird-list compact">${kids.map((k) => birdCard(k)).join('')}</ul>` : `<p class="muted">${t('off.none')}</p>`}
    </section>

    <div class="actions">
      <a class="btn primary" href="#/bird/${esc(b.id)}/edit">${t('btn.edit')}</a>
      <a class="btn" href="#/mating?${male ? 'sire' : 'dam'}=${encodeURIComponent(b.id)}">${t('btn.testMating')}</a>
      <button class="btn" id="share">${t('btn.share')}</button>
      <button class="btn danger" id="delete">${t('btn.delete')}</button>
    </div>`;

  $('#share').onclick = () => shareBird(b);
  $('#delete').onclick = () => deleteBirdFlow(b, kids);
}

function compBars(comp) {
  const entries = G.sortedEntries(comp);
  if (!entries.length) return `<p class="muted">${t('comp.empty')}</p>`;
  return `<ul class="bars">${entries
    .map(([k, v]) => `<li class="${k === G.UNKNOWN ? 'unknown' : ''}">
      <div class="bar-label"><span>${esc(lineName(k))}</span><span>${shareText(v)} <span class="muted">· ${pct(v)}</span></span></div>
      <div class="bar"><span style="width:${(v * 100).toFixed(2)}%"></span></div></li>`)
    .join('')}</ul>`;
}

function pedigreeGrid(id, ped) {
  const gens = ped.ancestorsByGeneration(id, 3);
  const titles = [t('ped.parents'), t('ped.grand'), t('ped.great')];
  let cells = '';
  gens.forEach((ids, g) => {
    const span = 8 / ids.length;
    ids.forEach((aid, i) => {
      const role = i % 2 === 0 ? 'sire' : 'dam';
      const a = aid ? state.birds.get(aid) : null;
      const style = `grid-column:${g + 1};grid-row:${i * span + 1} / span ${span}`;
      const label = g === 0 ? t(role === 'sire' ? 'ped.sire' : 'ped.dam') : '';
      if (!a) {
        cells += `<div class="pcell ${role} unknown" style="${style}">${label ? `<small>${label}</small>` : ''}<span>${t('ped.unknown')}</span></div>`;
      } else {
        const comp = G.effectiveComposition(state.birds, a.id);
        cells += `<a class="pcell ${role}" style="${style}" href="#/bird/${esc(a.id)}">
          ${label ? `<small>${label}</small>` : ''}
          <strong>${esc(displayName(a))}</strong>
          ${g < 2 ? `<span class="muted">${esc(compSummary(comp, 2))}</span>` : ''}
        </a>`;
      }
    });
  });
  return `<div class="pedigree-scroll"><div class="pedigree-head">${titles.map((x) => `<span>${x}</span>`).join('')}</div><div class="pedigree">${cells}</div></div>`;
}

async function deleteBirdFlow(b, kids) {
  const birdLogs = logsOf(b.id);
  const birdKeeps = [...state.keeps.values()].filter((k) => k.birdId === b.id);
  let extra = kids.length ? `\n\n${t('del.kids', { n: kids.length })}` : '';
  if (birdLogs.length || birdKeeps.length) extra += `\n\n${t('del.logs', { n: birdLogs.length })}`;
  if (!confirm(`${t('del.confirm', { name: displayName(b) })}${extra}`)) return;
  const now = Date.now();
  const changed = [];
  for (const k of kids) {
    const copy = { ...k, updatedAt: now };
    // Keep the child's blood as it was by freezing it to a manual composition.
    if (copy.compositionMode === 'auto') {
      copy.composition = G.effectiveComposition(state.birds, k.id);
      copy.compositionMode = 'manual';
    }
    if (copy.sireId === b.id) copy.sireId = null;
    if (copy.damId === b.id) copy.damId = null;
    changed.push(copy);
  }
  await db.putBirds(changed);
  await db.deleteBird(b.id);
  await db.deleteLogs(birdLogs.map((l) => l.id));
  await db.deleteKeeps(birdKeeps.map((k) => k.id));
  for (const c of changed) state.birds.set(c.id, c);
  state.birds.delete(b.id);
  for (const l of birdLogs) state.logs.delete(l.id);
  for (const k of birdKeeps) state.keeps.delete(k.id);
  toast(t('del.done'));
  location.hash = '#/';
}

// ---------- add / edit form ----------

function renderForm(existing, query) {
  const isNew = !existing;
  const b = existing
    ? { ...existing }
    : {
        id: uid(),
        sex: query.get('sex') || '',
        status: 'growing',
        sireId: query.get('sire') || null,
        damId: query.get('dam') || null,
        composition: {},
        compositionMode: query.get('sire') || query.get('dam') ? 'auto' : 'manual',
      };
  setHeader(isNew ? t('form.add') : t('form.edit', { name: displayName(b) }), isNew ? '#/' : `#/bird/${b.id}`);

  const ped = pedigree();
  // A bird cannot be its own parent, nor can one of its descendants.
  const eligible = (x) => x.id !== b.id && !(existing && ped.isAncestor(b.id, x.id));
  const all = [...state.birds.values()].sort((x, y) => displayName(x).localeCompare(displayName(y)));
  const males = all.filter((x) => SEX[x.sex]?.male && eligible(x));
  const females = all.filter((x) => SEX[x.sex] && !SEX[x.sex].male && eligible(x));
  const opt = (x, sel) => `<option value="${esc(x.id)}"${x.id === sel ? ' selected' : ''}>${esc(displayName(x))}${bandLabel(x) && x.name ? ` (${esc(bandLabel(x))})` : ''}</option>`;
  const datalist = (id, items) => `<datalist id="${id}">${items.map((i) => `<option value="${esc(i)}">`).join('')}</datalist>`;
  const manualRows = G.sortedEntries(b.composition).filter(([k]) => k !== G.UNKNOWN);

  view.innerHTML = `
    <form id="bird-form" class="form" novalidate>
      <section class="card">
        <div class="photo-pick">
          <div id="photo-preview">${thumb(b, 'photo-thumb')}</div>
          <div>
            <label class="btn small" for="photo">${b.photo ? t('photo.change') : t('photo.add')}</label>
            <input type="file" id="photo" accept="image/*" hidden>
            <button type="button" class="btn small link" id="photo-remove"${b.photo ? '' : ' hidden'}>${t('photo.remove')}</button>
          </div>
        </div>
        <label>${t('f.name')} <input name="name" value="${esc(b.name)}" placeholder="${esc(t('f.namePh'))}" autocomplete="off" autocapitalize="words" enterkeyhint="next"></label>
        <div class="two">
          <label>${t('f.wingband')} <input name="wingband" value="${esc(b.wingband)}" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="next"></label>
          <label>${t('f.legband')} <input name="legband" value="${esc(b.legband)}" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="next"></label>
        </div>
        <fieldset class="seg">
          <legend>${t('f.sex')}</legend>
          ${Object.keys(SEX).map((k) => `<label><input type="radio" name="sex" value="${k}"${b.sex === k ? ' checked' : ''}><span>${esc(sexLabel(k))}</span></label>`).join('')}
        </fieldset>
        <div class="two">
          <label>${t('f.hatchDate')} <input type="date" name="hatchDate" value="${esc(b.hatchDate)}"></label>
          <label>${t('f.status')} <select name="status">${Object.keys(STATUS).map((k) => `<option value="${k}"${b.status === k ? ' selected' : ''}>${esc(statusLabel(k))}</option>`).join('')}</select></label>
        </div>
      </section>

      <section class="card">
        <h3>${t('sec.parents')}</h3>
        <label>${t('f.sire')}
          <select name="sireId"><option value="">${t('f.parentUnknown')}</option>${males.map((x) => opt(x, b.sireId)).join('')}</select>
        </label>
        <label>${t('f.dam')}
          <select name="damId"><option value="">${t('f.parentUnknown')}</option>${females.map((x) => opt(x, b.damId)).join('')}</select>
        </label>
        <p class="muted small">${t('f.parentHint')}</p>
      </section>

      <section class="card">
        <h3>${t('sec.bloodline')}</h3>
        <fieldset class="seg">
          <legend class="sr-only">${t('comp.how')}</legend>
          <label><input type="radio" name="compositionMode" value="auto"${b.compositionMode === 'auto' ? ' checked' : ''}><span>${t('comp.modeAuto')}</span></label>
          <label><input type="radio" name="compositionMode" value="manual"${b.compositionMode !== 'auto' ? ' checked' : ''}><span>${t('comp.modeManual')}</span></label>
        </fieldset>
        <div id="comp-auto"></div>
        <div id="comp-manual">
          <p class="muted small">${t('comp.manualHint')}</p>
          <div id="comp-rows"></div>
          <button type="button" class="btn small" id="add-line">${t('comp.addLine')}</button>
          <p id="comp-total" class="small"></p>
        </div>
      </section>

      <section class="card">
        <h3>${t('sec.details')}</h3>
        <div class="two">
          <label>${t('f.color')} <input name="color" list="dl-colors" value="${esc(b.color)}" autocomplete="off" autocapitalize="words" enterkeyhint="next"></label>
          <label>${t('f.legColor')} <input name="legColor" list="dl-legs" value="${esc(b.legColor)}" autocomplete="off" autocapitalize="words" enterkeyhint="next"></label>
        </div>
        <label>${t('f.comb')} <input name="comb" list="dl-combs" value="${esc(b.comb)}" autocomplete="off" autocapitalize="words" enterkeyhint="next"></label>
        <label>${t('f.breeder')} <input name="breeder" value="${esc(b.breeder)}" placeholder="${esc(t('f.breederPh'))}" autocomplete="off" autocapitalize="words" enterkeyhint="next"></label>
        <label>${t('f.notes')} <textarea name="notes" rows="4" autocapitalize="sentences" placeholder="${esc(t('f.notesPh'))}">${esc(b.notes)}</textarea></label>
      </section>

      ${datalist('dl-lines', allLines())}${datalist('dl-colors', FEATHER_COLORS)}${datalist('dl-legs', LEG_COLORS)}${datalist('dl-combs', COMBS)}
      <p id="form-error" class="error" role="alert"></p>
      <div class="actions sticky">
        <a class="btn" href="${isNew ? '#/' : `#/bird/${esc(b.id)}`}">${t('btn.cancel')}</a>
        <button class="btn primary" type="submit">${isNew ? t('btn.save') : t('btn.saveChanges')}</button>
      </div>
    </form>`;

  const form = $('#bird-form');
  let photo = b.photo || null;

  // Photo
  $('#photo').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      photo = await resizeImage(file, 640);
      $('#photo-preview').innerHTML = `<img class="photo-thumb" src="${esc(photo)}" alt="">`;
      $('#photo-remove').hidden = false;
    } catch {
      toast(t('photo.error'));
    }
  };
  $('#photo-remove').onclick = () => {
    photo = null;
    $('#photo-preview').innerHTML = thumb({}, 'photo-thumb');
    $('#photo-remove').hidden = true;
  };

  // Bloodline editor
  const rowsEl = $('#comp-rows');
  const addRow = (line = '', share = null) => {
    const row = document.createElement('div');
    row.className = 'comp-row';
    const opts = [...SHARE_OPTIONS];
    if (share && !opts.some((o) => Math.abs(o - share) < 1e-9)) opts.push(share);
    opts.sort((x, y) => y - x);
    row.innerHTML = `<input class="line-name" list="dl-lines" placeholder="${esc(t('comp.linePh'))}" value="${esc(line)}" aria-label="${esc(t('comp.lineAria'))}" autocomplete="off" autocapitalize="words" enterkeyhint="done">
      <select class="line-share" aria-label="${esc(t('comp.shareAria'))}">
        <option value="">${t('comp.pickShare')}</option>
        ${opts.map((o) => `<option value="${o}"${share && Math.abs(o - share) < 1e-9 ? ' selected' : ''}>${shareText(o)}</option>`).join('')}
      </select>
      <button type="button" class="icon-btn" aria-label="${esc(t('comp.removeAria'))}">×</button>`;
    row.querySelector('button').onclick = () => { row.remove(); updateTotal(); };
    row.querySelector('.line-name').oninput = updateTotal;
    row.querySelector('.line-share').onchange = updateTotal;
    rowsEl.append(row);
    return row;
  };
  const readRows = () => {
    const comp = {};
    let bad = false;
    for (const row of $$('.comp-row', rowsEl)) {
      const name = row.querySelector('.line-name').value.trim();
      const raw = row.querySelector('.line-share').value.trim();
      if (!name && !raw) continue;
      const v = Number(raw);
      if (!name || !(v > 0) || v > 1) { bad = true; continue; }
      comp[name] = (comp[name] || 0) + v;
    }
    return { comp, bad };
  };
  const updateTotal = () => {
    const { comp, bad } = readRows();
    const total = Object.values(comp).reduce((a, v) => a + v, 0);
    const el = $('#comp-total');
    el.className = 'small';
    if (bad) { el.textContent = t('comp.badRow'); el.classList.add('error'); }
    else if (total > 1 + 1e-6) { el.textContent = t('comp.over', { p: pct(total) }); el.classList.add('error'); }
    else if (total > 0 && total < 1 - 1e-6) { el.textContent = t('comp.partial', { p: pct(total), rest: G.formatShare(1 - total) }); el.classList.add('muted'); }
    else el.textContent = total ? t('comp.full') : '';
  };
  manualRows.forEach(([k, v]) => addRow(k, v));
  if (!manualRows.length) addRow();
  $('#add-line').onclick = () => addRow().querySelector('.line-name').focus();
  enableKeyboardFlow(form);
  updateTotal();

  const updateMode = () => {
    const mode = form.compositionMode.value;
    $('#comp-manual').hidden = mode === 'auto';
    $('#comp-auto').hidden = mode !== 'auto';
    if (mode === 'auto') {
      const s = form.sireId.value || null;
      const d = form.damId.value || null;
      if (!s && !d) {
        $('#comp-auto').innerHTML = `<p class="muted">${t('comp.pickParents')}</p>`;
      } else {
        const memo = new Map();
        const comp = G.crossCompositions(
          s ? G.effectiveComposition(state.birds, s, memo) : null,
          d ? G.effectiveComposition(state.birds, d, memo) : null,
        );
        $('#comp-auto').innerHTML = compBars(comp);
      }
    }
  };
  for (const r of form.compositionMode) r.onchange = updateMode;
  form.sireId.onchange = updateMode;
  form.damId.onchange = updateMode;
  updateMode();

  form.onsubmit = async (e) => {
    e.preventDefault();
    const err = $('#form-error');
    err.textContent = '';
    const val = (n) => form[n].value.trim();
    const mode = form.compositionMode.value;
    const sex = form.sex.value;
    if (!val('name') && !val('wingband') && !val('legband')) return fail(t('err.identity'));
    if (!sex) return fail(t('err.sex'));
    let composition = {};
    if (mode === 'manual') {
      const { comp, bad } = readRows();
      if (bad) return fail(t('err.rows'));
      if (Object.values(comp).reduce((a, v) => a + v, 0) > 1 + 1e-6) return fail(t('err.over'));
      composition = G.cleanComposition(comp);
    } else if (existing) {
      composition = existing.composition || {};
    }
    const sireId = val('sireId') || null;
    const damId = val('damId') || null;
    if (mode === 'auto' && !sireId && !damId) return fail(t('err.noParents'));

    const now = Date.now();
    const record = {
      id: b.id,
      name: val('name'),
      wingband: val('wingband'),
      legband: val('legband'),
      sex,
      hatchDate: val('hatchDate'),
      status: val('status'),
      sireId,
      damId,
      compositionMode: mode,
      composition,
      color: val('color'),
      legColor: val('legColor'),
      comb: val('comb'),
      breeder: val('breeder'),
      notes: form.notes.value.trim(),
      photo,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    try {
      await db.putBird(record);
    } catch {
      return fail(t('err.save'));
    }
    state.birds.set(record.id, record);
    requestPersistence();
    toast(isNew ? t('saved.new') : t('saved.edit'));
    location.hash = `#/bird/${record.id}`;

    function fail(msg) {
      err.textContent = msg;
      err.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };
}

/**
 * Phone-keyboard friendly forms: the keyboard's Enter/Next key moves to the
 * next text field instead of submitting, and the last one closes the keyboard.
 * Saving is always an explicit tap on the Save button.
 */
const TEXT_FIELD = 'input:not([type=hidden]):not([type=file]):not([type=radio]):not([type=checkbox]):not([type=date]), textarea';

function enableKeyboardFlow(form) {
  form.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing || !e.target.matches('input') || !e.target.matches(TEXT_FIELD)) return;
    e.preventDefault();
    const fields = [...form.querySelectorAll(TEXT_FIELD)].filter((el) => !el.disabled && el.offsetParent !== null);
    const next = fields[fields.indexOf(e.target) + 1];
    if (next && e.target.getAttribute('enterkeyhint') !== 'done') next.focus();
    else e.target.blur();
  });
}

function resizeImage(file, max) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}

// ---------- test mating ----------

function renderMating(query, keepPicks = false) {
  setHeader(t('mating.title'), null);
  const all = [...state.birds.values()].sort((x, y) => displayName(x).localeCompare(displayName(y)));
  const males = all.filter((x) => SEX[x.sex]?.male);
  const females = all.filter((x) => SEX[x.sex] && !SEX[x.sex].male);
  const opt = (x, sel) => `<option value="${esc(x.id)}"${x.id === sel ? ' selected' : ''}>${esc(displayName(x))}</option>`;
  // After a language switch, keep the pair the user already picked.
  const sireSel = (keepPicks && $('#m-sire')?.value) || query.get('sire');
  const damSel = (keepPicks && $('#m-dam')?.value) || query.get('dam');

  view.innerHTML = `
    <section class="card form">
      <p class="muted">${t('mating.intro')}</p>
      <label>${t('mating.sire')}
        <select id="m-sire"><option value="">${t('mating.choose')}</option>${males.map((x) => opt(x, sireSel)).join('')}</select>
      </label>
      <label>${t('mating.dam')}
        <select id="m-dam"><option value="">${t('mating.choose')}</option>${females.map((x) => opt(x, damSel)).join('')}</select>
      </label>
      ${!males.length || !females.length ? `<p class="muted small">${t('mating.need')}</p>` : ''}
    </section>
    <div id="m-result"></div>`;

  const gen = (n) => (n <= 3 ? t(`gen.${n}`) : t('gen.n', { n: n - 2 }));
  const draw = () => {
    const s = $('#m-sire').value;
    const d = $('#m-dam').value;
    const out = $('#m-result');
    if (!s || !d) { out.innerHTML = ''; return; }
    const ped = pedigree();
    const memo = new Map();
    const comp = G.crossCompositions(G.effectiveComposition(state.birds, s, memo), G.effectiveComposition(state.birds, d, memo));
    const f = ped.kinship(s, d);
    const common = ped.commonAncestors(s, d);
    out.innerHTML = `
      <section class="card">
        <h3>${t('mating.blood')}</h3>
        ${compBars(comp)}
      </section>
      <section class="card">
        <h3>${t('mating.inb')}</h3>
        <p class="big">${pct(f)} <span class="muted small">${esc(inbreedingText(f))}</span></p>
        ${common.length
          ? `<p class="small">${t('mating.shared')}</p><ul class="plain">${common.slice(0, 8).map((c) => {
              const a = state.birds.get(c.id);
              const rel = `${c.a === 0 ? t('rel.isSire') : t('rel.sireOf', { g: gen(c.a) })}, ${c.b === 0 ? t('rel.isDam') : t('rel.damOf', { g: gen(c.b) })}`;
              return `<li><a href="#/bird/${esc(c.id)}">${esc(displayName(a))}</a> <span class="muted small">${esc(rel)}</span></li>`;
            }).join('')}</ul>`
          : `<p class="muted small">${t('mating.noShared')}</p>`}
      </section>
      <div class="actions"><a class="btn primary" style="grid-column:1/-1" href="#/bird/new?sire=${encodeURIComponent(s)}&dam=${encodeURIComponent(d)}">${t('mating.record')}</a></div>`;
  };
  $('#m-sire').onchange = draw;
  $('#m-dam').onchange = draw;
  draw();
}

// ---------- bloodlines ----------

function renderLines() {
  setHeader(t('lines.title'), null);
  const memo = new Map();
  const counts = new Map();
  for (const b of state.birds.values()) {
    for (const k of Object.keys(G.effectiveComposition(state.birds, b.id, memo))) {
      if (k !== G.UNKNOWN) counts.set(k, (counts.get(k) || 0) + 1);
    }
  }
  const names = [...new Set([...allLines(), ...counts.keys()])].sort(
    (a, b) => (counts.get(b) || 0) - (counts.get(a) || 0) || a.localeCompare(b),
  );

  view.innerHTML = `
    <section class="card">
      <form id="line-form" class="inline-form">
        <input id="line-name" autocapitalize="words" enterkeyhint="done" placeholder="${esc(t('lines.addPh'))}" aria-label="${esc(t('lines.addAria'))}" autocomplete="off">
        <button class="btn primary" type="submit">${t('lines.add')}</button>
      </form>
      <p class="muted small">${t('lines.hint')}</p>
    </section>
    <ul class="line-list">
      ${names.map((n) => {
        const custom = state.customLines.includes(n);
        const c = counts.get(n) || 0;
        return `<li>
          <button type="button" class="line-item" data-line="${esc(n)}"><span>${esc(n)}${custom ? ` <span class="badge">${t('lines.yours')}</span>` : ''}</span><span class="muted">${t('lines.count', { n: c })}</span></button>
          ${custom ? `<button type="button" class="icon-btn" data-remove="${esc(n)}" aria-label="${esc(t('lines.remove', { name: n }))}">×</button>` : ''}
        </li>`;
      }).join('')}
    </ul>`;

  $('#line-form').onsubmit = async (e) => {
    e.preventDefault();
    const name = $('#line-name').value.trim();
    if (!name) return;
    if (allLines().some((l) => l.toLowerCase() === name.toLowerCase())) return toast(t('lines.exists'));
    state.customLines.push(name);
    await db.setMeta('customLines', state.customLines);
    toast(t('lines.added', { name }));
    renderLines();
  };
  for (const btn of $$('[data-line]')) {
    btn.onclick = () => {
      state.filter = { q: btn.dataset.line, sex: 'all', status: 'all' };
      location.hash = '#/';
    };
  }
  for (const btn of $$('[data-remove]')) {
    btn.onclick = async () => {
      state.customLines = state.customLines.filter((l) => l !== btn.dataset.remove);
      await db.setMeta('customLines', state.customLines);
      renderLines();
    };
  }
}

// ---------- conditioning & keep ----------

const logsArr = () => [...state.logs.values()];
const byLogDesc = (a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0);
const logsOf = (birdId) => logsArr().filter((l) => l.birdId === birdId).sort(byLogDesc);
const activeKeepOf = (birdId) => [...state.keeps.values()].find((k) => k.birdId === birdId && k.status === 'active');

function shortDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(d.getTime()) ? dateStr : d.toLocaleDateString(locale(), { month: 'short', day: 'numeric' });
}

function logSummary(l) {
  const d = l.data || {};
  const parts = {
    weight: [formatKg(d.weight)],
    feed: [d.feed, d.amount],
    exercise: [d.activity, d.minutes && t('log.min', { n: d.minutes })],
    sparring: [d.partner && t('log.vs', { name: d.partner }), d.minutes && t('log.min', { n: d.minutes }), d.rating && `${d.rating}/5`],
    vitamins: [d.product, d.dose],
    vaccine: [d.product, d.nextDue && t('log.next', { date: formatDate(d.nextDue) })],
    deworm: [d.product, d.nextDue && t('log.next', { date: formatDate(d.nextDue) })],
    health: [d.issue, d.treatment],
  }[l.type] || [];
  return parts.filter(Boolean).join(' · ');
}

function logRow(l, showBird = false) {
  const bird = state.birds.get(l.birdId);
  return `<li><a class="log-row" href="#/log/${esc(l.id)}/edit">
    <span class="log-date">${esc(shortDate(l.date))}</span>
    <span class="log-main">
      <span class="log-head"><span class="log-type">${esc(t(`type.${l.type}`))}</span>${showBird && bird ? `<strong>${esc(displayName(bird))}</strong>` : ''}</span>
      <span class="log-sum">${esc(logSummary(l))}</span>
      ${l.notes ? `<span class="log-notes muted">${esc(l.notes)}</span>` : ''}
    </span>
  </a></li>`;
}

/** [headline, detail] for a keep, e.g. ["Day 11 of 22", "11 days to the derby"]. */
function keepStatusParts(k, p = keepProgress(k)) {
  if (k.status === 'done') return [t('keep.done'), ''];
  if (p.phase === 'notStarted') return [t('keep.notStarted', { date: formatDate(k.startDate) }), ''];
  if (p.phase === 'fightDay') return [t('keep.fightDay'), ''];
  if (p.phase === 'past') return [t('keep.past'), ''];
  return p.total ? [t('keep.day', { day: p.day, total: p.total }), t('keep.left', { n: p.daysLeft })] : [t('keep.dayOnly', { day: p.day }), ''];
}

const keepStatusText = (k, p) => keepStatusParts(k, p).filter(Boolean).join(' · ');

function weightDiffText(current, target) {
  if (!(current > 0) || !(target > 0)) return '';
  const d = current - target;
  if (Math.abs(d) < 0.005) return t('keep.onTarget');
  return t(d > 0 ? 'keep.diffOver' : 'keep.diffUnder', { kg: formatKg(Math.abs(d)) });
}

function chartBlock(birdId, from, to, target, name) {
  const pts = weightSeries(logsArr(), birdId, from, to);
  if (pts.length < 2) return `<p class="muted small">${t('keep.chartNeed')}</p>`;
  return weightChart(pts, {
    target, fmtDate: shortDate, label: t('keep.chartLabel', { name }), targetLabel: t('keep.targetLine', { kg: formatKg(target) }),
  });
}

function keepCard(k) {
  const b = state.birds.get(k.birdId);
  const p = keepProgress(k);
  const w = latestWeight(logsArr(), k.birdId);
  const meta = [w && formatKg(w.kg), k.targetWeight && `${t('keep.target')} ${formatKg(k.targetWeight)}`, k.fightDate && formatDate(k.fightDate)].filter(Boolean).join(' · ');
  return `<li><a class="keep-card" href="#/keep/${esc(k.id)}">
    <div class="kc-top"><strong>${esc(displayName(b))}</strong><span class="muted small">${esc(k.name)}</span></div>
    <div class="kc-status">${esc(keepStatusText(k, p))}</div>
    ${k.status === 'active' && p.fraction !== null ? `<div class="progress" role="presentation"><span style="width:${(p.fraction * 100).toFixed(1)}%"></span></div>` : ''}
    ${meta ? `<div class="muted small">${esc(meta)}</div>` : ''}
  </a></li>`;
}

function dueLabel(days) {
  if (days < 0) return t('due.overdue', { n: -days });
  if (days === 0) return t('due.today');
  return t('due.in', { n: days });
}

function renderKeepHome() {
  setHeader(t('keep.title'), null);
  const keeps = [...state.keeps.values()].filter((k) => state.birds.has(k.birdId));
  const active = keeps.filter((k) => k.status === 'active').sort((a, b) => (a.fightDate || '9999').localeCompare(b.fightDate || '9999'));
  const done = keeps.filter((k) => k.status === 'done').sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 5);
  const due = dueItems(logsArr(), state.birds);
  const recent = logsArr().filter((l) => state.birds.has(l.birdId)).sort(byLogDesc).slice(0, 10);

  view.innerHTML = `
    <section class="card">
      <div class="row-between"><h3>${t('keep.active')}</h3><a class="btn small" href="#/keep/new">${t('keep.start')}</a></div>
      ${active.length ? `<ul class="keep-list">${active.map(keepCard).join('')}</ul>` : `<p class="muted">${t('keep.noneActive')}</p>`}
    </section>
    <section class="card">
      <h3>${t('keep.due')}</h3>
      ${due.length
        ? `<ul class="due-list">${due.map(({ log, bird, days }) => `<li><a class="due-row${days < 0 ? ' overdue' : ''}" href="#/log/new?bird=${encodeURIComponent(bird.id)}&type=${log.type}&product=${encodeURIComponent(log.data.product || '')}">
            <span class="due-when">${esc(dueLabel(days))}</span>
            <span><strong>${esc(displayName(bird))}</strong> · ${esc(t(`type.${log.type}`))}: ${esc(log.data.product || '')}</span></a></li>`).join('')}</ul>`
        : `<p class="muted small">${t('keep.noneDue')}</p>`}
    </section>
    <section class="card">
      <h3>${t('keep.recent')}</h3>
      ${recent.length ? `<ul class="log-list">${recent.map((l) => logRow(l, true)).join('')}</ul>` : `<p class="muted small">${t('keep.noLogs')}</p>`}
    </section>
    ${done.length ? `<section class="card"><h3>${t('keep.pastTitle')}</h3><ul class="keep-list">${done.map(keepCard).join('')}</ul></section>` : ''}
    <a class="fab" href="#/log/new" aria-label="${esc(t('keep.addLog'))}">+</a>`;
}

function renderKeep(k) {
  const b = state.birds.get(k.birdId);
  if (!b) return renderNotFound();
  setHeader(k.name || t('keep.defaultName'), '#/keep');
  const p = keepProgress(k);
  const w = latestWeight(logsArr(), b.id);
  const logs = logsOf(b.id).filter((l) => l.date >= k.startDate && (!k.fightDate || l.date <= k.fightDate));
  const diff = weightDiffText(w?.kg, k.targetWeight);

  view.innerHTML = `
    <section class="hero">
      ${thumb(b, 'hero-photo')}
      <div>
        <h2><a class="plain-link" href="#/bird/${esc(b.id)}">${esc(displayName(b))}</a></h2>
        <div class="badges">${sexBadge(b)}</div>
        <p class="muted">${esc(formatDate(k.startDate))}${k.fightDate ? ` → ${esc(formatDate(k.fightDate))}` : ''}</p>
      </div>
    </section>
    <section class="card">
      <p class="big">${esc(keepStatusParts(k, p)[0])}</p>
      ${keepStatusParts(k, p)[1] ? `<p class="keep-sub">${esc(keepStatusParts(k, p)[1])}</p>` : ''}
      ${k.status === 'active' && p.fraction !== null ? `<div class="progress"><span style="width:${(p.fraction * 100).toFixed(1)}%"></span></div>` : ''}
      ${k.notes ? `<p class="notes muted small">${esc(k.notes)}</p>` : ''}
    </section>
    <section class="card">
      <h3>${t('keep.weightChart')}</h3>
      <div class="stats">
        <div><span>${t('keep.weightNow')}</span><strong>${w ? esc(formatKg(w.kg)) : '—'}</strong></div>
        <div><span>${t('keep.target')}</span><strong>${k.targetWeight ? esc(formatKg(k.targetWeight)) : '—'}</strong></div>
      </div>
      ${diff ? `<p class="small diff">${esc(diff)}</p>` : ''}
      ${chartBlock(b.id, k.startDate, k.fightDate || null, k.targetWeight, displayName(b))}
    </section>
    <section class="card">
      <div class="row-between"><h3>${t('keep.logsInKeep')}</h3>
        <a class="btn small" href="#/log/new?bird=${encodeURIComponent(b.id)}&type=weight&keep=${encodeURIComponent(k.id)}">${t('keep.logWeight')}</a></div>
      ${logs.length ? `<ul class="log-list">${logs.map((l) => logRow(l)).join('')}</ul>` : `<p class="muted small">${t('keep.noLogsInKeep')}</p>`}
    </section>
    <div class="actions">
      <a class="btn primary" href="#/log/new?bird=${encodeURIComponent(b.id)}&keep=${encodeURIComponent(k.id)}">${t('keep.addLog')}</a>
      <a class="btn" href="#/keep/${esc(k.id)}/edit">${t('keep.edit')}</a>
      <button class="btn" id="keep-toggle">${k.status === 'active' ? t('keep.finish') : t('keep.reopen')}</button>
      <button class="btn danger" id="keep-delete">${t('keep.delete')}</button>
    </div>`;
  bindCharts(view);

  $('#keep-toggle').onclick = async () => {
    const next = { ...k, status: k.status === 'active' ? 'done' : 'active', updatedAt: Date.now() };
    await db.putKeep(next);
    state.keeps.set(next.id, next);
    toast(next.status === 'done' ? t('keep.finished') : t('keep.reopened'));
    renderKeep(next);
  };
  $('#keep-delete').onclick = async () => {
    if (!confirm(t('keep.deleteConfirm'))) return;
    await db.deleteKeeps([k.id]);
    state.keeps.delete(k.id);
    toast(t('keep.deleted'));
    location.hash = '#/keep';
  };
}

function birdOptions(selectedId, filter = () => true) {
  return [...state.birds.values()]
    .filter((x) => filter(x) || x.id === selectedId)
    .sort((x, y) => (SEX[y.sex]?.male ? 1 : 0) - (SEX[x.sex]?.male ? 1 : 0) || displayName(x).localeCompare(displayName(y)))
    .map((x) => `<option value="${esc(x.id)}"${x.id === selectedId ? ' selected' : ''}>${esc(displayName(x))}${SEX[x.sex] ? ` · ${esc(sexLabel(x.sex))}` : ''}</option>`)
    .join('');
}

const liveBird = (x) => x.status !== 'sold' && x.status !== 'deceased';

function renderKeepForm(existing, query) {
  const isNew = !existing;
  const k = existing ? { ...existing } : {
    id: uid(), birdId: query.get('bird') || '', name: t('keep.defaultName'), startDate: todayStr(),
    fightDate: '', targetWeight: null, status: 'active', notes: '',
  };
  setHeader(isNew ? t('keep.new') : t('keep.edit'), isNew ? '#/keep' : `#/keep/${k.id}`);
  view.innerHTML = `
    <form id="keep-form" class="form" novalidate>
      <section class="card">
        <label>${t('kf.bird')}
          <select name="birdId"><option value="">${t('kf.choose')}</option>${birdOptions(k.birdId, liveBird)}</select>
        </label>
        <label>${t('kf.name')} <input name="name" value="${esc(k.name)}" placeholder="${esc(t('kf.namePh'))}" autocomplete="off" autocapitalize="sentences" enterkeyhint="next"></label>
        <div class="two">
          <label>${t('kf.start')} <input type="date" name="startDate" value="${esc(k.startDate)}"></label>
          <label>${t('kf.fight')} <input type="date" name="fightDate" value="${esc(k.fightDate)}"></label>
        </div>
        <label>${t('kf.target')} <input name="targetWeight" inputmode="decimal" value="${k.targetWeight ? k.targetWeight.toFixed(2) : ''}" placeholder="${esc(t('kf.targetPh'))}" autocomplete="off" enterkeyhint="next"></label>
        <label>${t('f.notes')} <textarea name="notes" rows="3" autocapitalize="sentences">${esc(k.notes)}</textarea></label>
      </section>
      <p id="form-error" class="error" role="alert"></p>
      <div class="actions sticky">
        <a class="btn" href="${isNew ? '#/keep' : `#/keep/${esc(k.id)}`}">${t('btn.cancel')}</a>
        <button class="btn primary" type="submit">${t('btn.save')}</button>
      </div>
    </form>`;
  const form = $('#keep-form');
  enableKeyboardFlow(form);
  form.onsubmit = async (e) => {
    e.preventDefault();
    const err = $('#form-error');
    const fail = (msg) => { err.textContent = msg; err.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
    const birdId = form.birdId.value;
    const startDate = form.startDate.value;
    const fightDate = form.fightDate.value;
    const rawTarget = form.targetWeight.value.trim();
    const targetWeight = rawTarget ? parseWeight(rawTarget) : null;
    if (!birdId) return fail(t('kf.errBird'));
    if (!isDateStr(startDate)) return fail(t('kf.errStart'));
    if (fightDate && daysBetween(startDate, fightDate) < 0) return fail(t('kf.errFight'));
    if (rawTarget && Number.isNaN(targetWeight)) return fail(t('kf.errTarget'));
    const now = Date.now();
    const record = {
      ...k, birdId, startDate, fightDate: isDateStr(fightDate) ? fightDate : '', targetWeight,
      name: form.name.value.trim() || t('keep.defaultName'), notes: form.notes.value.trim(),
      createdAt: existing?.createdAt || now, updatedAt: now,
    };
    await db.putKeep(record);
    state.keeps.set(record.id, record);
    toast(t('keep.saved'));
    location.hash = `#/keep/${record.id}`;
  };
}

function renderLogForm(existing, query) {
  const isNew = !existing;
  const l = existing ? { ...existing, data: { ...existing.data } } : {
    id: uid(), birdId: query.get('bird') || '', type: LOG_TYPES[query.get('type')] ? query.get('type') : '',
    date: todayStr(), data: {}, notes: '',
  };
  if (isNew && query.get('product')) l.data.product = query.get('product');
  const back = query.get('keep') && state.keeps.has(query.get('keep')) ? `#/keep/${query.get('keep')}`
    : l.birdId && state.birds.has(l.birdId) ? `#/bird/${l.birdId}/logs` : '#/keep';
  setHeader(isNew ? t('log.new') : t('log.edit'), back);

  const datalists = Object.entries(LOG_SUGGESTIONS)
    .map(([id, items]) => `<datalist id="dl-${id}">${items.map((i) => `<option value="${esc(i)}">`).join('')}</datalist>`).join('');

  view.innerHTML = `
    <form id="log-form" class="form" novalidate>
      <section class="card">
        <label>${t('kf.bird')}
          <select name="birdId"><option value="">${t('kf.choose')}</option>${birdOptions(l.birdId, liveBird)}</select>
        </label>
        <fieldset class="type-grid">
          <legend>${t('log.type')}</legend>
          ${Object.keys(LOG_TYPES).map((k) => `<label><input type="radio" name="type" value="${k}"${l.type === k ? ' checked' : ''}><span>${esc(t(`type.${k}`))}</span></label>`).join('')}
        </fieldset>
        <label>${t('lf.date')} <input type="date" name="date" value="${esc(l.date)}"></label>
      </section>
      <section class="card" id="type-fields"></section>
      <section class="card">
        <label>${t('lf.notes')} <textarea name="notes" rows="3" autocapitalize="sentences">${esc(l.notes)}</textarea></label>
      </section>
      ${datalists}
      <p id="form-error" class="error" role="alert"></p>
      <div class="actions sticky">
        <a class="btn" href="${esc(back)}">${t('btn.cancel')}</a>
        <button class="btn primary" type="submit">${t('btn.save')}</button>
      </div>
      ${existing ? `<div class="actions"><button type="button" class="btn danger" id="log-delete">${t('btn.delete')}</button></div>` : ''}
    </form>`;

  const form = $('#log-form');
  const box = $('#type-fields');
  const fieldName = (f) => `f-${f.k}`;

  // Keep what was typed when the user switches type.
  const readInto = (data) => {
    for (const el of $$('[data-field]', box)) {
      if (el.type === 'radio') { if (el.checked) data[el.dataset.field] = el.value; } else data[el.dataset.field] = el.value;
    }
  };

  const drawFields = (focusFirst) => {
    const type = form.type.value;
    box.hidden = !type;
    if (!type) return;
    const fields = LOG_TYPES[type];
    box.innerHTML = fields.map((f, i) => {
      const v = l.data[f.k] ?? '';
      const hint = i === fields.length - 1 ? 'done' : 'next';
      const label = t(`lf.${f.k}`);
      if (f.kind === 'rating') {
        return `<fieldset class="seg"><legend>${label}</legend>${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="${fieldName(f)}" data-field="${f.k}" value="${n}"${String(v) === String(n) ? ' checked' : ''}><span>${n}</span></label>`).join('')}</fieldset>`;
      }
      if (f.kind === 'date') return `<label>${label} <input type="date" name="${fieldName(f)}" data-field="${f.k}" value="${esc(v)}"></label>`;
      if (f.kind === 'weight') {
        const shown = typeof v === 'number' ? formatKg(v).replace(' kg', '') : v;
        return `<label>${label} <input name="${fieldName(f)}" data-field="${f.k}" inputmode="decimal" enterkeyhint="${hint}" placeholder="${esc(t('lf.weightPh'))}" value="${esc(shown)}" autocomplete="off"></label>`;
      }
      if (f.kind === 'number') return `<label>${label} <input name="${fieldName(f)}" data-field="${f.k}" inputmode="numeric" pattern="[0-9]*" enterkeyhint="${hint}" value="${esc(v)}" autocomplete="off"></label>`;
      const ph = f.k === 'amount' ? ` placeholder="${esc(t('lf.amountPh'))}"` : '';
      return `<label>${label} <input name="${fieldName(f)}" data-field="${f.k}"${f.list ? ` list="dl-${f.list}"` : ''}${ph} autocapitalize="sentences" enterkeyhint="${hint}" value="${esc(v)}" autocomplete="off"></label>`;
    }).join('');
    if (focusFirst) box.querySelector('input:not([type=date]):not([type=radio])')?.focus();
  };

  for (const r of form.type) r.onchange = () => { readInto(l.data); drawFields(true); };
  drawFields(false);
  enableKeyboardFlow(form);

  $('#log-delete')?.addEventListener('click', async () => {
    if (!confirm(t('log.deleteConfirm'))) return;
    await db.deleteLogs([l.id]);
    state.logs.delete(l.id);
    toast(t('log.deleted'));
    location.hash = back;
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    const err = $('#form-error');
    const fail = (msg) => { err.textContent = msg; err.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
    const birdId = form.birdId.value;
    const type = form.type.value;
    const date = form.date.value;
    if (!birdId) return fail(t('log.errBird'));
    if (!type) return fail(t('log.errType'));
    if (!isDateStr(date)) return fail(t('log.errDate'));
    const raw = {};
    readInto(raw);
    const data = {};
    for (const f of LOG_TYPES[type]) {
      const v = String(raw[f.k] ?? '').trim();
      if (f.kind === 'weight') {
        const kg = parseWeight(v);
        if (Number.isNaN(kg)) return fail(t('log.errWeight'));
        data[f.k] = kg;
      } else if (f.kind === 'number' || f.kind === 'rating') {
        if (v) data[f.k] = Math.max(0, Math.round(Number(v))) || null;
      } else if (v) {
        data[f.k] = v;
      }
      if (f.required && !data[f.k]) return fail(t('log.errRequired', { field: t(`lf.${f.k}`) }));
    }
    const now = Date.now();
    const record = {
      id: l.id, birdId, type, date, data, notes: form.notes.value.trim(),
      createdAt: existing?.createdAt || now, updatedAt: now,
    };
    await db.putLog(record);
    state.logs.set(record.id, record);
    requestPersistence();
    toast(t('log.saved'));
    // After a new log, go where the user came from; the bird's log page otherwise.
    location.hash = query.get('keep') && state.keeps.has(query.get('keep')) ? `#/keep/${query.get('keep')}` : `#/bird/${birdId}/logs`;
  };
}

function renderBirdLogs(b) {
  setHeader(t('logs.title', { name: displayName(b) }), `#/bird/${b.id}`);
  const all = logsOf(b.id);
  const w = latestWeight(logsArr(), b.id);
  const k = activeKeepOf(b.id);
  let filter = 'all';

  view.innerHTML = `
    <section class="card">
      <div class="stats">
        <div><span>${t('cond.latestWeight')}</span><strong>${w ? esc(formatKg(w.kg)) : '—'}</strong>${w ? `<span class="muted small">${esc(shortDate(w.date))}</span>` : ''}</div>
        <div><span>${t('nav.keep')}</span>${k ? `<a class="plain-link" href="#/keep/${esc(k.id)}"><strong>${esc(k.name)}</strong></a><span class="muted small">${esc(keepStatusText(k))}</span>` : `<a class="btn small" href="#/keep/new?bird=${encodeURIComponent(b.id)}">${t('cond.startKeep')}</a>`}</div>
      </div>
    </section>
    <section class="card">
      <h3>${t('keep.weightChart')}</h3>
      ${chartBlock(b.id, null, null, k?.targetWeight, displayName(b))}
    </section>
    <section class="card">
      <div class="row-between"><h3>${t('cond.allLogs')}</h3>
        <select id="type-filter" class="compact-select" aria-label="${esc(t('logs.filterAria'))}">
          <option value="all">${t('logs.filterAll')}</option>
          ${Object.keys(LOG_TYPES).map((x) => `<option value="${x}">${esc(t(`type.${x}`))}</option>`).join('')}
        </select>
      </div>
      <ul class="log-list" id="log-list"></ul>
    </section>
    <a class="fab" href="#/log/new?bird=${encodeURIComponent(b.id)}" aria-label="${esc(t('keep.addLog'))}">+</a>`;
  bindCharts(view);
  const draw = () => {
    const list = filter === 'all' ? all : all.filter((l) => l.type === filter);
    $('#log-list').innerHTML = list.length ? list.map((l) => logRow(l)).join('') : `<li class="empty-row muted">${filter === 'all' ? t('cond.none') : t('logs.empty')}</li>`;
  };
  $('#type-filter').onchange = (e) => { filter = e.target.value; draw(); };
  draw();
}

function conditioningSection(b) {
  const w = latestWeight(logsArr(), b.id);
  const k = activeKeepOf(b.id);
  const recent = logsOf(b.id).slice(0, 3);
  return `<section class="card">
    <div class="row-between"><h3>${t('sec.conditioning')}</h3>
      <a class="btn small" href="#/log/new?bird=${encodeURIComponent(b.id)}">${t('cond.addLog')}</a></div>
    ${w ? `<p class="cond-line"><span class="muted">${t('cond.latestWeight')}</span> <strong>${esc(formatKg(w.kg))}</strong> <span class="muted small">${esc(shortDate(w.date))}</span></p>` : ''}
    ${k ? `<p class="cond-line"><a class="plain-link" href="#/keep/${esc(k.id)}"><strong>${esc(t('cond.inKeep', { name: k.name }))}</strong></a> <span class="muted small">${esc(keepStatusText(k))}</span></p>` : ''}
    ${recent.length ? `<ul class="log-list">${recent.map((l) => logRow(l)).join('')}</ul>` : `<p class="muted">${t('cond.none')}</p>`}
    <div class="btn-row">
      <a class="btn small" href="#/bird/${esc(b.id)}/logs">${t('cond.allLogs')}</a>
      ${!k ? `<a class="btn small" href="#/keep/new?bird=${encodeURIComponent(b.id)}">${t('cond.startKeep')}</a>` : ''}
    </div>
  </section>`;
}

const LOG_FIELD_KINDS = Object.fromEntries(Object.entries(LOG_TYPES).map(([k, fields]) => [k, Object.fromEntries(fields.map((f) => [f.k, f.kind]))]));

function sanitizeLog(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || typeof raw.birdId !== 'string') return null;
  if (!LOG_TYPES[raw.type] || !isDateStr(raw.date)) return null;
  const data = {};
  for (const [k, kind] of Object.entries(LOG_FIELD_KINDS[raw.type])) {
    const v = raw.data?.[k];
    if (kind === 'weight' && typeof v === 'number' && v > 0 && v <= 20) data[k] = v;
    else if ((kind === 'number' || kind === 'rating') && Number.isFinite(v) && v >= 0) data[k] = Math.round(kind === 'rating' ? Math.min(5, v) : v);
    else if (kind === 'date' && isDateStr(v)) data[k] = v;
    else if (kind === 'text' && typeof v === 'string' && v) data[k] = v.slice(0, 120);
  }
  return {
    id: str(raw.id, 80), birdId: str(raw.birdId, 80), type: raw.type, date: raw.date, data, notes: str(raw.notes, 2000),
    createdAt: Number(raw.createdAt) || Date.now(), updatedAt: Number(raw.updatedAt) || Date.now(),
  };
}

function sanitizeKeep(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || typeof raw.birdId !== 'string' || !isDateStr(raw.startDate)) return null;
  return {
    id: str(raw.id, 80), birdId: str(raw.birdId, 80), name: str(raw.name, 80) || 'Derby keep', startDate: raw.startDate,
    fightDate: isDateStr(raw.fightDate) ? raw.fightDate : '',
    targetWeight: typeof raw.targetWeight === 'number' && raw.targetWeight > 0 && raw.targetWeight <= 20 ? raw.targetWeight : null,
    status: raw.status === 'done' ? 'done' : 'active', notes: str(raw.notes, 2000),
    createdAt: Number(raw.createdAt) || Date.now(), updatedAt: Number(raw.updatedAt) || Date.now(),
  };
}

/** Merge records by id, keeping whichever copy is newer. */
function mergeNewer(map, records) {
  const out = [];
  for (const r of records) {
    if (!r) continue;
    const cur = map.get(r.id);
    if (!cur || r.updatedAt > (cur.updatedAt || 0)) out.push(r);
  }
  return out;
}

// ---------- more: install, backup & sharing, about ----------

function renderMore() {
  setHeader(t('more.title'), null);
  const installed = install.isStandalone();
  view.innerHTML = `
    <section class="card">
      <h3>${t('install.title')}</h3>
      ${installed
        ? `<p class="ok">${t('install.done')}</p>`
        : `<p class="muted small">${t('install.hint')}</p>
           <button class="btn primary block" id="install">${install.isIOS() ? t('install.ios') : t('install.btn')}</button>`}
    </section>
    <section class="card">
      <h3>${t('backup.title')}</h3>
      <p>${t('backup.text', { n: state.birds.size })}</p>
      <button class="btn primary block" id="export">${t('backup.save')}</button>
    </section>
    <section class="card">
      <h3>${t('restore.title')}</h3>
      <p class="muted small">${t('restore.text')}</p>
      <label class="btn block" for="import">${t('restore.open')}</label>
      <input type="file" id="import" accept=".json,application/json" hidden>
    </section>
    <section class="card">
      <h3>${t('share.title')}</h3>
      <p class="muted small">${t('share.text')}</p>
    </section>
    <section class="card">
      <h3>${t('danger.title')}</h3>
      <button class="btn danger block" id="wipe">${t('danger.wipe')}</button>
    </section>
    <section class="card about">
      <h3>${t('about.title')}</h3>
      <dl class="facts">
        <dt>${t('about.app')}</dt><dd>${t('about.appName')}</dd>
        <dt>${t('about.version')}</dt><dd id="app-version">v${APP_VERSION}</dd>
        <dt>${t('about.lang')}</dt><dd>${t('lang.name')}</dd>
        <dt>${t('about.birds')}</dt><dd>${state.birds.size}</dd>
      </dl>
    </section>`;

  $('#install')?.addEventListener('click', install.startInstall);
  $('#export').onclick = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    deliverJson(buildExport([...state.birds.values()], logsArr(), [...state.keeps.values()]), `derby-backup-${stamp}.json`, 'Derby backup');
  };
  $('#import').onchange = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const r = await importData(data);
      toast(t('import.done', { a: r.added, u: r.updated, s: r.skipped }));
      renderMore();
    } catch {
      toast(t('import.bad'));
    }
  };
  $('#wipe').onclick = async () => {
    if (!state.birds.size) return toast(t('wipe.none'));
    if (!confirm(t('wipe.confirm', { n: state.birds.size }))) return;
    if (prompt(t('wipe.type')) !== 'DELETE') return toast(t('wipe.cancelled'));
    await db.clearBirds();
    await db.clearLogs();
    await db.clearKeeps();
    state.birds.clear();
    state.logs.clear();
    state.keeps.clear();
    toast(t('wipe.done'));
    location.hash = '#/';
  };
}

function buildExport(birds, logs = [], keeps = []) {
  return { app: 'derby', version: 2, appVersion: APP_VERSION, exportedAt: new Date().toISOString(), birds, logs, keeps, customLines: state.customLines };
}

async function deliverJson(data, filename, title) {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const file = new File([blob], filename, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(t('file.saved', { f: filename }));
}

function shareBird(b) {
  const ped = pedigree();
  const ids = [b.id, ...ped.ancestorDistances(b.id).keys()];
  const birds = ids.map((id) => state.birds.get(id));
  const safe = displayName(b).replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'bird';
  deliverJson(buildExport(birds), `derby-${safe}-pedigree.json`, `${displayName(b)} pedigree`);
}

const str = (v, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');

function sanitizeBird(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null;
  const composition = {};
  if (raw.composition && typeof raw.composition === 'object') {
    for (const [k, v] of Object.entries(raw.composition)) {
      if (typeof v === 'number' && v > 0 && v <= 1) composition[str(k, 60)] = v;
    }
  }
  return {
    id: str(raw.id, 80),
    name: str(raw.name),
    wingband: str(raw.wingband, 40),
    legband: str(raw.legband, 40),
    sex: SEX[raw.sex] ? raw.sex : '',
    hatchDate: /^\d{4}-\d{2}-\d{2}$/.test(raw.hatchDate) ? raw.hatchDate : '',
    status: STATUS[raw.status] ? raw.status : 'reference',
    sireId: typeof raw.sireId === 'string' ? raw.sireId : null,
    damId: typeof raw.damId === 'string' ? raw.damId : null,
    compositionMode: raw.compositionMode === 'auto' ? 'auto' : 'manual',
    composition,
    color: str(raw.color, 60),
    legColor: str(raw.legColor, 60),
    comb: str(raw.comb, 60),
    breeder: str(raw.breeder),
    notes: str(raw.notes, 5000),
    photo: typeof raw.photo === 'string' && raw.photo.startsWith('data:image/') ? raw.photo : null,
    createdAt: Number(raw.createdAt) || Date.now(),
    updatedAt: Number(raw.updatedAt) || Date.now(),
  };
}

async function importData(data) {
  if (!data || data.app !== 'derby' || !Array.isArray(data.birds)) throw new Error('not a Derby backup');
  let added = 0;
  let updated = 0;
  let skipped = 0;
  const toSave = [];
  for (const raw of data.birds) {
    const b = sanitizeBird(raw);
    if (!b) continue;
    const cur = state.birds.get(b.id);
    if (!cur) added++;
    else if (b.updatedAt > (cur.updatedAt || 0)) updated++;
    else { skipped++; continue; }
    toSave.push(b);
  }
  await db.putBirds(toSave);
  for (const b of toSave) state.birds.set(b.id, b);
  if (Array.isArray(data.customLines)) {
    const merged = [...new Set([...state.customLines, ...data.customLines.filter((l) => typeof l === 'string').map((l) => l.slice(0, 60))])];
    if (merged.length !== state.customLines.length) {
      state.customLines = merged;
      await db.setMeta('customLines', merged);
    }
  }
  const logs = mergeNewer(state.logs, (Array.isArray(data.logs) ? data.logs : []).map(sanitizeLog));
  const keeps = mergeNewer(state.keeps, (Array.isArray(data.keeps) ? data.keeps : []).map(sanitizeKeep));
  await db.putLogs(logs);
  await db.putKeeps(keeps);
  for (const l of logs) state.logs.set(l.id, l);
  for (const k of keeps) state.keeps.set(k.id, k);
  requestPersistence();
  return { added, updated, skipped };
}

// ---------- sample data ----------

async function loadSampleData() {
  const now = Date.now();
  const mk = (id, name, sex, extra) => ({
    id: `sample-${id}`, name, sex, wingband: '', legband: '', hatchDate: '', status: 'brood',
    sireId: null, damId: null, compositionMode: 'manual', composition: {}, color: '', legColor: '',
    comb: '', breeder: 'Sample farm', notes: '', photo: null, createdAt: now, updatedAt: now, ...extra,
  });
  const birds = [
    mk('s1', 'Sample Sweater Cock', 'cock', { composition: { Sweater: 1 }, color: 'Lemon', legColor: 'Yellow', comb: 'Straight (single)', wingband: '101', hatchDate: '2022-01-15' }),
    mk('k1', 'Sample Kelso Hen', 'hen', { composition: { Kelso: 1 }, color: 'Red', legColor: 'Yellow', comb: 'Pea', wingband: '102', hatchDate: '2022-03-02' }),
    mk('h1', 'Sample Hatch Hen', 'hen', { composition: { Hatch: 0.75, Kelso: 0.25 }, color: 'Dark Red', legColor: 'Yellow', comb: 'Straight (single)', wingband: '103', hatchDate: '2022-02-10' }),
    mk('a1', 'Sweater-Kelso Stag', 'stag', { sireId: 'sample-s1', damId: 'sample-k1', compositionMode: 'auto', status: 'active', wingband: '201', legband: '17', hatchDate: '2025-02-20' }),
    mk('a2', 'Sweater-Kelso Pullet', 'pullet', { sireId: 'sample-s1', damId: 'sample-k1', compositionMode: 'auto', status: 'growing', wingband: '202', hatchDate: '2025-02-20' }),
    mk('a3', 'Sweater-Hatch Pullet', 'pullet', { sireId: 'sample-s1', damId: 'sample-h1', compositionMode: 'auto', status: 'growing', wingband: '203', hatchDate: '2025-04-05' }),
  ];
  await db.putBirds(birds);
  for (const b of birds) state.birds.set(b.id, b);

  // A sample keep with a few weeks of logs so the Keep tab has something to show.
  const today = todayStr();
  const day = (n) => addDays(today, n);
  const keep = { id: 'sample-keep', birdId: 'sample-a1', name: 'Derby keep', startDate: day(-10), fightDate: day(11), targetWeight: 2.1, status: 'active', notes: '', createdAt: now, updatedAt: now };
  let n = 0;
  const log = (birdId, type, date, data, notes = '') => ({ id: `sample-log-${++n}`, birdId, type, date, data, notes, createdAt: now + n, updatedAt: now + n });
  const logs = [
    ...[[-10, 2.32], [-8, 2.28], [-6, 2.25], [-4, 2.21], [-2, 2.19], [0, 2.16]].map(([d, kg]) => log('sample-a1', 'weight', day(d), { weight: kg })),
    log('sample-a1', 'feed', today, { feed: 'Conditioning pellets', amount: '80 g' }),
    log('sample-a1', 'exercise', day(-1), { activity: 'Running pen', minutes: 20 }),
    log('sample-a1', 'sparring', day(-3), { partner: 'Sweater-Kelso Pullet', minutes: 3, rating: 4 }, 'Good timing, strong breaks'),
    log('sample-a1', 'vitamins', day(-5), { product: 'B-complex', dose: '1 tablet' }),
    log('sample-a1', 'vaccine', day(-80), { product: 'Newcastle (NCD)', nextDue: day(5) }),
    log('sample-k1', 'deworm', day(-92), { product: 'Levamisole', nextDue: day(-2) }),
  ];
  await db.putKeep(keep);
  await db.putLogs(logs);
  state.keeps.set(keep.id, keep);
  for (const l of logs) state.logs.set(l.id, l);
  toast(t('toast.sample'));
  renderList();
}

// ---------- startup ----------

let persistAsked = false;
function requestPersistence() {
  if (persistAsked) return;
  persistAsked = true;
  navigator.storage?.persist?.().catch(() => {});
}

function trackKeyboard() {
  if (!window.matchMedia?.('(pointer: coarse)').matches) return;
  const isText = (el) => el?.matches?.(`${TEXT_FIELD}, select`);
  document.addEventListener('focusin', (e) => { if (isText(e.target)) document.body.classList.add('typing'); });
  document.addEventListener('focusout', () => {
    setTimeout(() => { if (!isText(document.activeElement)) document.body.classList.remove('typing'); }, 50);
  });
}

async function init() {
  initLanguageSwitch();
  trackKeyboard();
  try {
    const birds = await db.getAllBirds();
    for (const b of birds) state.birds.set(b.id, b);
    state.customLines = (await db.getMeta('customLines')) || [];
    for (const l of await db.getAllLogs()) state.logs.set(l.id, l);
    for (const k of await db.getAllKeeps()) state.keeps.set(k.id, k);
  } catch {
    view.innerHTML = `<div class="card empty"><p>${t('storage.error')}</p></div>`;
    return;
  }
  window.addEventListener('hashchange', () => route());
  route();
  install.onInstallChange(() => { if (parseHash().parts[0] === 'more') renderMore(); });
  try {
    const last = await db.getMeta('lastVersion');
    if (last && last !== APP_VERSION) toast(t('toast.updated', { v: APP_VERSION }));
    if (last !== APP_VERSION) await db.setMeta('lastVersion', APP_VERSION);
  } catch { /* non-critical */ }
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

init();
