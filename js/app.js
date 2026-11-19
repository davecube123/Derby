import * as db from './db.js';
import * as G from './genetics.js';
import { SEX, STATUS, PRESET_LINES, FEATHER_COLORS, LEG_COLORS, COMBS } from './constants.js';
import { APP_VERSION } from './version.js';
import { t, getLang, setLang, locale, LANGS } from './i18n.js';
import * as install from './install.js';

const state = {
  birds: new Map(),
  customLines: [],
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
      const onForm = parts[0] === 'bird' && (parts[1] === 'new' || parts[2] === 'edit');
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
  setActiveNav(section === 'bird' ? 'birds' : section === 'backup' ? 'more' : section);
  if (!parts.length) return renderList();
  if (parts[0] === 'bird') {
    if (parts[1] === 'new') return renderForm(null, query);
    const bird = state.birds.get(parts[1]);
    if (!bird) return renderNotFound();
    if (parts[2] === 'edit') return renderForm(bird, query);
    return renderDetail(bird);
  }
  if (parts[0] === 'mating') return renderMating(query, opts.keepScroll);
  if (parts[0] === 'lines') return renderLines();
  if (parts[0] === 'more' || parts[0] === 'backup') return renderMore();
  return renderNotFound();
}

function renderNotFound() {
  setHeader(t('notFound.title'), '#/');
  view.innerHTML = `<div class="card empty"><p>${t('notFound.text')}</p><a class="btn" href="#/">${t('notFound.back')}</a></div>`;
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
  const extra = kids.length ? `\n\n${t('del.kids', { n: kids.length })}` : '';
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
  for (const c of changed) state.birds.set(c.id, c);
  state.birds.delete(b.id);
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
    deliverJson(buildExport([...state.birds.values()]), `derby-backup-${stamp}.json`, 'Derby backup');
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
    state.birds.clear();
    toast(t('wipe.done'));
    location.hash = '#/';
  };
}

function buildExport(birds) {
  return { app: 'derby', version: 1, appVersion: APP_VERSION, exportedAt: new Date().toISOString(), birds, customLines: state.customLines };
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
