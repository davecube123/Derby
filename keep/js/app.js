import * as db from './db.js';
import { SEX, STATUS, LOG_SUGGESTIONS } from './constants.js';
import { LOG_TYPES, todayStr, isDateStr, daysBetween, addDays, parseWeight, formatKg, keepProgress, weightSeries, latestWeight, dueItems } from './conditioning.js';
import { weightChart, bindCharts } from './chart.js';
import { derbyBirds, isDerbyFile } from './derby-import.js';
import { APP_VERSION } from './version.js';
import { t, getLang, setLang, locale, LANGS } from './i18n.js';
import * as install from './install.js';

const state = {
  birds: new Map(),
  logs: new Map(),
  keeps: new Map(),
  birdQuery: '',
  pendingImport: null, // { birds, logs, keeps } read from a Derby file, waiting for the user's pick
};

const view = document.getElementById('view');
const titleEl = document.getElementById('title');
const backEl = document.getElementById('back');

// ---------- helpers ----------

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const uid = () =>
  globalThis.crypto?.randomUUID ? crypto.randomUUID() : `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
const $ = (sel, root = view) => root.querySelector(sel);
const $$ = (sel, root = view) => [...root.querySelectorAll(sel)];
const str = (v, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');

const sexLabel = (k) => (SEX[k] ? t(`sex.${k}`) : '');
const displayName = (b) => b?.name || (b?.wingband && `WB ${b.wingband}`) || (b?.legband && `LB ${b.legband}`) || 'Unnamed';
function bandLabel(b) {
  return [b.wingband && `WB ${b.wingband}`, b.legband && `LB ${b.legband}`].filter(Boolean).join(' · ');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(d.getTime()) ? dateStr : d.toLocaleDateString(locale(), { year: 'numeric', month: 'short', day: 'numeric' });
}
function shortDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(d.getTime()) ? dateStr : d.toLocaleDateString(locale(), { month: 'short', day: 'numeric' });
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
  document.title = title === t('app.name') ? title : `${title} · Derby Keep`;
  backEl.hidden = !backHref;
  if (backHref) backEl.href = backHref;
}

function setActiveNav(section) {
  for (const a of document.querySelectorAll('.tabbar a')) {
    const on = a.dataset.nav === section;
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

const sexBadge = (b) => (SEX[b.sex] ? `<span class="badge sex-${b.sex}">${esc(sexLabel(b.sex))}</span>` : '');
const liveBird = (b) => b.status !== 'sold' && b.status !== 'deceased';
const logsArr = () => [...state.logs.values()];
const byLogDesc = (a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0);
const logsOf = (birdId) => logsArr().filter((l) => l.birdId === birdId).sort(byLogDesc);
const activeKeepOf = (birdId) => [...state.keeps.values()].find((k) => k.birdId === birdId && k.status === 'active');

let persistAsked = false;
function requestPersistence() {
  if (persistAsked) return;
  persistAsked = true;
  navigator.storage?.persist?.().catch(() => {});
}

function fail(msg) {
  const err = $('#form-error');
  err.textContent = msg;
  err.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ---------- keyboard-friendly forms ----------

const TEXT_FIELD = 'input:not([type=hidden]):not([type=file]):not([type=radio]):not([type=checkbox]):not([type=date]), textarea';

/** Keyboard Enter/Next moves to the next text field; the last one closes the keyboard. Saving is always the Save button. */
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

function trackKeyboard() {
  if (!window.matchMedia?.('(pointer: coarse)').matches) return;
  const isText = (el) => el?.matches?.(`${TEXT_FIELD}, select`);
  document.addEventListener('focusin', (e) => { if (isText(e.target)) document.body.classList.add('typing'); });
  document.addEventListener('focusout', () => {
    setTimeout(() => { if (!isText(document.activeElement)) document.body.classList.remove('typing'); }, 50);
  });
}

// ---------- language ----------

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
  wrap.innerHTML = Object.entries(LANGS).map(([code, label]) => `<button type="button" data-lang="${code}" lang="${code}">${label}</button>`).join('');
  for (const btn of wrap.querySelectorAll('button')) {
    btn.onclick = () => {
      if (btn.dataset.lang === getLang()) return;
      setLang(btn.dataset.lang);
      applyShellLanguage();
      const { parts } = parseHash();
      const onForm = parts[0] === 'log' || (['bird', 'keep'].includes(parts[0]) && (parts[1] === 'new' || parts[2] === 'edit'));
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
  const nav = { birds: 'birds', bird: 'birds', more: 'more', import: 'more' }[parts[0]] || 'today';
  setActiveNav(nav);
  if (!parts.length) return renderToday();
  if (parts[0] === 'birds') return renderBirds();
  if (parts[0] === 'bird') {
    if (parts[1] === 'new') return renderBirdForm(null);
    const b = state.birds.get(parts[1]);
    if (!b) return renderNotFound();
    return parts[2] === 'edit' ? renderBirdForm(b) : renderBird(b);
  }
  if (parts[0] === 'keep') {
    if (parts[1] === 'new') return renderKeepForm(null, query);
    const k = state.keeps.get(parts[1]);
    if (!k) return renderNotFound();
    return parts[2] === 'edit' ? renderKeepForm(k, query) : renderKeep(k);
  }
  if (parts[0] === 'log') {
    if (parts[1] === 'new') return renderLogForm(null, query);
    const l = state.logs.get(parts[1]);
    if (!l) return renderNotFound();
    return renderLogForm(l, query);
  }
  if (parts[0] === 'import') return renderImportPick();
  if (parts[0] === 'more') return renderMore();
  return renderNotFound();
}

function renderNotFound() {
  setHeader(t('notFound.title'), '#/');
  view.innerHTML = `<div class="card empty"><p>${t('notFound.text')}</p><a class="btn" href="#/">${t('notFound.back')}</a></div>`;
}

// ---------- shared bits ----------

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
  return weightChart(pts, { target, fmtDate: shortDate, label: t('keep.chartLabel', { name }), targetLabel: t('keep.targetLine', { kg: formatKg(target) }) });
}

const progressBar = (k, p) => (k.status === 'active' && p.fraction !== null
  ? `<div class="progress" role="presentation"><span style="width:${(p.fraction * 100).toFixed(1)}%"></span></div>` : '');

function keepCard(k) {
  const b = state.birds.get(k.birdId);
  const p = keepProgress(k);
  const w = latestWeight(logsArr(), k.birdId);
  const meta = [w && formatKg(w.kg), k.targetWeight && `${t('keep.target')} ${formatKg(k.targetWeight)}`, k.fightDate && formatDate(k.fightDate)].filter(Boolean).join(' · ');
  return `<li><a class="keep-card" href="#/keep/${esc(k.id)}">
    <div class="kc-top"><strong>${esc(displayName(b))}</strong><span class="muted small">${esc(k.name)}</span></div>
    <div class="kc-status">${esc(keepStatusText(k, p))}</div>
    ${progressBar(k, p)}
    ${meta ? `<div class="muted small">${esc(meta)}</div>` : ''}
  </a></li>`;
}

function dueLabel(days) {
  if (days < 0) return t('due.overdue', { n: -days });
  if (days === 0) return t('due.today');
  return t('due.in', { n: days });
}

function birdOptions(selectedId) {
  return [...state.birds.values()]
    .filter((x) => liveBird(x) || x.id === selectedId)
    .sort((x, y) => (SEX[y.sex]?.male ? 1 : 0) - (SEX[x.sex]?.male ? 1 : 0) || displayName(x).localeCompare(displayName(y)))
    .map((x) => `<option value="${esc(x.id)}"${x.id === selectedId ? ' selected' : ''}>${esc(displayName(x))}${SEX[x.sex] ? ` · ${esc(sexLabel(x.sex))}` : ''}</option>`)
    .join('');
}

// ---------- today (home) ----------

function renderToday() {
  setHeader(t('app.name'), null);
  if (!state.birds.size) {
    view.innerHTML = `
      ${install.bannerHTML()}
      <section class="card welcome">
        <img class="welcome-logo" src="../icons/logo.png" alt="Derby Keep logo">
        <h2>${t('welcome.title')}</h2>
        <p>${t('welcome.intro')}</p>
        <ol><li>${t('welcome.step1')}</li><li>${t('welcome.step2')}</li><li>${t('welcome.step3')}</li></ol>
        <a class="btn primary block" href="#/bird/new">${t('welcome.add')}</a>
        <a class="btn block" href="#/more">${t('welcome.import')}</a>
        <button class="btn block" id="sample">${t('welcome.sample')}</button>
        <p class="muted small">${t('welcome.privacy')}</p>
      </section>
      <p class="version-foot">Derby Keep v${APP_VERSION}</p>`;
    $('#sample').onclick = loadSampleData;
    install.bindBanner(view);
    return;
  }
  const keeps = [...state.keeps.values()].filter((k) => state.birds.has(k.birdId));
  const active = keeps.filter((k) => k.status === 'active').sort((a, b) => (a.fightDate || '9999').localeCompare(b.fightDate || '9999'));
  const done = keeps.filter((k) => k.status === 'done').sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 5);
  const due = dueItems(logsArr(), state.birds);
  const recent = logsArr().filter((l) => state.birds.has(l.birdId)).sort(byLogDesc).slice(0, 10);

  view.innerHTML = `
    ${install.bannerHTML()}
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
  install.bindBanner(view);
}

// ---------- birds ----------

function renderBirds() {
  setHeader(t('birds.title'), null);
  view.innerHTML = `
    <div class="toolbar">
      <input type="search" id="q" enterkeyhint="search" placeholder="${esc(t('birds.search'))}" value="${esc(state.birdQuery)}" aria-label="${esc(t('birds.searchAria'))}" autocomplete="off">
    </div>
    <p class="count muted" id="count"></p>
    <ul class="bird-list" id="list"></ul>
    <a class="fab" href="#/bird/new" aria-label="${esc(t('birds.add'))}">+</a>`;
  const draw = () => {
    const q = state.birdQuery.trim().toLowerCase();
    const items = [...state.birds.values()]
      .filter((b) => !q || [b.name, b.wingband, b.legband, b.bloodline, b.notes].join(' ').toLowerCase().includes(q))
      .sort((a, b) => (activeKeepOf(b.id) ? 1 : 0) - (activeKeepOf(a.id) ? 1 : 0) || (liveBird(b) ? 1 : 0) - (liveBird(a) ? 1 : 0) || displayName(a).localeCompare(displayName(b)));
    $('#count').textContent = t('birds.count', { n: items.length });
    $('#list').innerHTML = items.length ? items.map(birdCard).join('')
      : `<li class="card empty"><p>${state.birds.size ? t('birds.none') : t('birds.empty')}</p></li>`;
  };
  $('#q').oninput = (e) => { state.birdQuery = e.target.value; draw(); };
  $('#q').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } };
  draw();
}

function birdCard(b) {
  const w = latestWeight(logsArr(), b.id);
  const k = activeKeepOf(b.id);
  const sub = [bandLabel(b), w && formatKg(w.kg)].filter(Boolean).join(' · ');
  return `<li><a class="bird-card" href="#/bird/${esc(b.id)}">
    <div class="bc-main">
      <div class="bc-top"><strong>${esc(displayName(b))}</strong>${sexBadge(b)}</div>
      ${sub ? `<div class="bc-sub muted">${esc(sub)}</div>` : ''}
      ${k ? `<div class="bc-keep">${esc(keepStatusText(k))}</div>` : b.bloodline ? `<div class="bc-lines">${esc(b.bloodline)}</div>` : ''}
    </div>
  </a></li>`;
}

function renderBird(b) {
  setHeader(displayName(b), '#/birds');
  const all = logsOf(b.id);
  const w = latestWeight(logsArr(), b.id);
  const k = activeKeepOf(b.id);
  let filter = 'all';
  view.innerHTML = `
    <section class="hero">
      <div>
        <h2>${esc(displayName(b))}</h2>
        <div class="badges">${sexBadge(b)}${b.status !== 'active' ? `<span class="badge">${esc(t(`status.${b.status}`))}</span>` : ''}${b.source === 'derby' ? `<span class="badge">${t('bird.fromDerby')}</span>` : ''}</div>
        ${bandLabel(b) ? `<p class="muted">${esc(bandLabel(b))}</p>` : ''}
        ${b.bloodline ? `<p class="bc-lines">${esc(b.bloodline)}</p>` : ''}
      </div>
    </section>
    <section class="card">
      <div class="stats">
        <div><span>${t('bird.latestWeight')}</span><strong>${w ? esc(formatKg(w.kg)) : '—'}</strong>${w ? `<span class="muted small">${esc(shortDate(w.date))}</span>` : ''}</div>
        <div><span>${t('bird.keep')}</span>${k ? `<a class="plain-link" href="#/keep/${esc(k.id)}"><strong>${esc(k.name)}</strong></a><span class="muted small">${esc(keepStatusText(k))}</span>` : `<a class="btn small" href="#/keep/new?bird=${encodeURIComponent(b.id)}">${t('bird.startKeep')}</a>`}</div>
      </div>
    </section>
    <section class="card">
      <h3>${t('keep.weightChart')}</h3>
      ${chartBlock(b.id, null, null, k?.targetWeight, displayName(b))}
    </section>
    <section class="card">
      <div class="row-between"><h3>${t('bird.allLogs')}</h3>
        <select id="type-filter" class="compact-select" aria-label="${esc(t('bird.filterAria'))}">
          <option value="all">${t('bird.filterAll')}</option>
          ${Object.keys(LOG_TYPES).map((x) => `<option value="${x}">${esc(t(`type.${x}`))}</option>`).join('')}
        </select>
      </div>
      <ul class="log-list" id="log-list"></ul>
    </section>
    ${b.notes ? `<section class="card"><h3>${t('bf.notes')}</h3><p class="notes">${esc(b.notes)}</p></section>` : ''}
    <div class="actions">
      <a class="btn primary" href="#/log/new?bird=${encodeURIComponent(b.id)}">${t('keep.addLog')}</a>
      <a class="btn" href="#/bird/${esc(b.id)}/edit">${t('bird.edit')}</a>
      <button class="btn danger" id="delete">${t('bird.delete')}</button>
    </div>
    <a class="fab" href="#/log/new?bird=${encodeURIComponent(b.id)}" aria-label="${esc(t('keep.addLog'))}">+</a>`;
  bindCharts(view);
  const draw = () => {
    const list = filter === 'all' ? all : all.filter((l) => l.type === filter);
    $('#log-list').innerHTML = list.length ? list.map((l) => logRow(l)).join('')
      : `<li class="empty-row muted">${filter === 'all' ? t('bird.noLogs') : t('bird.filterEmpty')}</li>`;
  };
  $('#type-filter').onchange = (e) => { filter = e.target.value; draw(); };
  draw();
  $('#delete').onclick = async () => {
    if (!confirm(t('bird.deleteConfirm', { name: displayName(b), n: all.length }))) return;
    const keeps = [...state.keeps.values()].filter((k2) => k2.birdId === b.id);
    await db.logs.remove(all.map((l) => l.id));
    await db.keeps.remove(keeps.map((k2) => k2.id));
    await db.birds.remove([b.id]);
    for (const l of all) state.logs.delete(l.id);
    for (const k2 of keeps) state.keeps.delete(k2.id);
    state.birds.delete(b.id);
    toast(t('bird.deleted'));
    location.hash = '#/birds';
  };
}

function renderBirdForm(existing) {
  const isNew = !existing;
  const b = existing ? { ...existing } : { id: uid(), name: '', wingband: '', legband: '', sex: '', status: 'active', bloodline: '', notes: '', source: '' };
  setHeader(isNew ? t('bf.add') : t('bf.edit', { name: displayName(b) }), isNew ? '#/birds' : `#/bird/${b.id}`);
  view.innerHTML = `
    <form id="bird-form" class="form" novalidate>
      <section class="card">
        <label>${t('bf.name')} <input name="name" value="${esc(b.name)}" placeholder="${esc(t('bf.namePh'))}" autocomplete="off" autocapitalize="words" enterkeyhint="next"></label>
        <div class="two">
          <label>${t('bf.wingband')} <input name="wingband" value="${esc(b.wingband)}" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="next"></label>
          <label>${t('bf.legband')} <input name="legband" value="${esc(b.legband)}" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="next"></label>
        </div>
        <fieldset class="seg"><legend>${t('bf.sex')}</legend>
          ${Object.keys(SEX).map((k) => `<label><input type="radio" name="sex" value="${k}"${b.sex === k ? ' checked' : ''}><span>${esc(sexLabel(k))}</span></label>`).join('')}
        </fieldset>
        <fieldset class="seg"><legend>${t('bf.status')}</legend>
          ${STATUS.map((k) => `<label><input type="radio" name="status" value="${k}"${b.status === k ? ' checked' : ''}><span>${esc(t(`status.${k}`))}</span></label>`).join('')}
        </fieldset>
        <label>${t('bf.bloodline')} <input name="bloodline" value="${esc(b.bloodline)}" placeholder="${esc(t('bf.bloodlinePh'))}" autocomplete="off" autocapitalize="words" enterkeyhint="next"></label>
        <label>${t('bf.notes')} <textarea name="notes" rows="3" autocapitalize="sentences">${esc(b.notes)}</textarea></label>
      </section>
      <p id="form-error" class="error" role="alert"></p>
      <div class="actions sticky">
        <a class="btn" href="${isNew ? '#/birds' : `#/bird/${esc(b.id)}`}">${t('btn.cancel')}</a>
        <button class="btn primary" type="submit">${t('btn.save')}</button>
      </div>
    </form>`;
  const form = $('#bird-form');
  enableKeyboardFlow(form);
  form.onsubmit = async (e) => {
    e.preventDefault();
    const val = (n) => form[n].value.trim();
    if (!val('name') && !val('wingband') && !val('legband')) return fail(t('bf.errIdentity'));
    if (!form.sex.value) return fail(t('bf.errSex'));
    const now = Date.now();
    const record = {
      ...b, name: val('name'), wingband: val('wingband'), legband: val('legband'), sex: form.sex.value,
      status: form.status.value || 'active', bloodline: val('bloodline'), notes: form.notes.value.trim(),
      createdAt: existing?.createdAt || now, updatedAt: now,
    };
    await db.birds.put(record);
    state.birds.set(record.id, record);
    requestPersistence();
    toast(t('bf.saved'));
    location.hash = `#/bird/${record.id}`;
  };
}

// ---------- keeps ----------

function renderKeep(k) {
  const b = state.birds.get(k.birdId);
  if (!b) return renderNotFound();
  setHeader(k.name || t('keep.defaultName'), '#/');
  const p = keepProgress(k);
  const [headline, detail] = keepStatusParts(k, p);
  const w = latestWeight(logsArr(), b.id);
  const logs = logsOf(b.id).filter((l) => l.date >= k.startDate && (!k.fightDate || l.date <= k.fightDate));
  const diff = weightDiffText(w?.kg, k.targetWeight);
  view.innerHTML = `
    <section class="hero">
      <div>
        <h2><a class="plain-link" href="#/bird/${esc(b.id)}"><strong>${esc(displayName(b))}</strong></a></h2>
        <div class="badges">${sexBadge(b)}</div>
        <p class="muted">${esc(formatDate(k.startDate))}${k.fightDate ? ` → ${esc(formatDate(k.fightDate))}` : ''}</p>
      </div>
    </section>
    <section class="card">
      <p class="big">${esc(headline)}</p>
      ${detail ? `<p class="keep-sub">${esc(detail)}</p>` : ''}
      ${progressBar(k, p)}
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
    await db.keeps.put(next);
    state.keeps.set(next.id, next);
    toast(next.status === 'done' ? t('keep.finished') : t('keep.reopened'));
    renderKeep(next);
  };
  $('#keep-delete').onclick = async () => {
    if (!confirm(t('keep.deleteConfirm'))) return;
    await db.keeps.remove([k.id]);
    state.keeps.delete(k.id);
    toast(t('keep.deleted'));
    location.hash = '#/';
  };
}

function renderKeepForm(existing, query) {
  const isNew = !existing;
  const k = existing ? { ...existing } : {
    id: uid(), birdId: query.get('bird') || '', name: t('keep.defaultName'), startDate: todayStr(),
    fightDate: '', targetWeight: null, status: 'active', notes: '',
  };
  setHeader(isNew ? t('keep.new') : t('keep.edit'), isNew ? '#/' : `#/keep/${k.id}`);
  view.innerHTML = `
    <form id="keep-form" class="form" novalidate>
      <section class="card">
        <label>${t('kf.bird')} <select name="birdId"><option value="">${t('kf.choose')}</option>${birdOptions(k.birdId)}</select></label>
        <label>${t('kf.name')} <input name="name" value="${esc(k.name)}" placeholder="${esc(t('kf.namePh'))}" autocomplete="off" autocapitalize="sentences" enterkeyhint="next"></label>
        <div class="two">
          <label>${t('kf.start')} <input type="date" name="startDate" value="${esc(k.startDate)}"></label>
          <label>${t('kf.fight')} <input type="date" name="fightDate" value="${esc(k.fightDate)}"></label>
        </div>
        <label>${t('kf.target')} <input name="targetWeight" inputmode="decimal" value="${k.targetWeight ? esc(formatKg(k.targetWeight).replace(' kg', '')) : ''}" placeholder="${esc(t('kf.targetPh'))}" autocomplete="off" enterkeyhint="next"></label>
        <label>${t('lf.notes')} <textarea name="notes" rows="3" autocapitalize="sentences">${esc(k.notes)}</textarea></label>
      </section>
      <p id="form-error" class="error" role="alert"></p>
      <div class="actions sticky">
        <a class="btn" href="${isNew ? '#/' : `#/keep/${esc(k.id)}`}">${t('btn.cancel')}</a>
        <button class="btn primary" type="submit">${t('btn.save')}</button>
      </div>
    </form>`;
  const form = $('#keep-form');
  enableKeyboardFlow(form);
  form.onsubmit = async (e) => {
    e.preventDefault();
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
    await db.keeps.put(record);
    state.keeps.set(record.id, record);
    requestPersistence();
    toast(t('keep.saved'));
    location.hash = `#/keep/${record.id}`;
  };
}

// ---------- logs ----------

function renderLogForm(existing, query) {
  const isNew = !existing;
  const l = existing ? { ...existing, data: { ...existing.data } } : {
    id: uid(), birdId: query.get('bird') || '', type: LOG_TYPES[query.get('type')] ? query.get('type') : '',
    date: todayStr(), data: {}, notes: '',
  };
  if (isNew && query.get('product')) l.data.product = query.get('product');
  const keepId = query.get('keep') && state.keeps.has(query.get('keep')) ? query.get('keep') : null;
  const back = keepId ? `#/keep/${keepId}` : l.birdId && state.birds.has(l.birdId) ? `#/bird/${l.birdId}` : '#/';
  setHeader(isNew ? t('log.new') : t('log.edit'), back);
  const datalists = Object.entries(LOG_SUGGESTIONS)
    .map(([id, items]) => `<datalist id="dl-${id}">${items.map((i) => `<option value="${esc(i)}">`).join('')}</datalist>`).join('');

  view.innerHTML = `
    <form id="log-form" class="form" novalidate>
      <section class="card">
        <label>${t('kf.bird')} <select name="birdId"><option value="">${t('kf.choose')}</option>${birdOptions(l.birdId)}</select></label>
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
      const name = `f-${f.k}`;
      if (f.kind === 'rating') {
        return `<fieldset class="seg"><legend>${label}</legend>${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="${name}" data-field="${f.k}" value="${n}"${String(v) === String(n) ? ' checked' : ''}><span>${n}</span></label>`).join('')}</fieldset>`;
      }
      if (f.kind === 'date') return `<label>${label} <input type="date" name="${name}" data-field="${f.k}" value="${esc(v)}"></label>`;
      if (f.kind === 'weight') {
        const shown = typeof v === 'number' ? formatKg(v).replace(' kg', '') : v;
        return `<label>${label} <input name="${name}" data-field="${f.k}" inputmode="decimal" enterkeyhint="${hint}" placeholder="${esc(t('lf.weightPh'))}" value="${esc(shown)}" autocomplete="off"></label>`;
      }
      if (f.kind === 'number') return `<label>${label} <input name="${name}" data-field="${f.k}" inputmode="numeric" pattern="[0-9]*" enterkeyhint="${hint}" value="${esc(v)}" autocomplete="off"></label>`;
      const ph = f.k === 'amount' ? ` placeholder="${esc(t('lf.amountPh'))}"` : '';
      return `<label>${label} <input name="${name}" data-field="${f.k}"${f.list ? ` list="dl-${f.list}"` : ''}${ph} autocapitalize="sentences" enterkeyhint="${hint}" value="${esc(v)}" autocomplete="off"></label>`;
    }).join('');
    if (focusFirst) box.querySelector('input:not([type=date]):not([type=radio])')?.focus();
  };
  for (const r of form.type) r.onchange = () => { readInto(l.data); drawFields(true); };
  drawFields(false);
  enableKeyboardFlow(form);

  $('#log-delete')?.addEventListener('click', async () => {
    if (!confirm(t('log.deleteConfirm'))) return;
    await db.logs.remove([l.id]);
    state.logs.delete(l.id);
    toast(t('log.deleted'));
    location.hash = back;
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
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
    const record = { id: l.id, birdId, type, date, data, notes: form.notes.value.trim(), createdAt: existing?.createdAt || now, updatedAt: now };
    await db.logs.put(record);
    state.logs.set(record.id, record);
    requestPersistence();
    toast(t('log.saved'));
    location.hash = keepId ? `#/keep/${keepId}` : `#/bird/${birdId}`;
  };
}

// ---------- more: install, Derby import, backup, about ----------

function renderMore() {
  setHeader(t('more.title'), null);
  const installed = install.isStandalone();
  view.innerHTML = `
    <section class="card">
      <h3>${t('install.title')}</h3>
      ${installed ? `<p class="ok">${t('install.done')}</p>`
        : `<p class="muted small">${t('install.hint')}</p><button class="btn primary block" id="install">${install.isIOS() ? t('install.ios') : t('install.btn')}</button>`}
    </section>
    <section class="card">
      <h3>${t('import.title')}</h3>
      <p class="muted small">${t('import.text')}</p>
      <label class="btn primary block" for="derby-file">${t('import.open')}</label>
      <input type="file" id="derby-file" accept=".json,application/json" hidden>
    </section>
    <section class="card">
      <h3>${t('backup.title')}</h3>
      <p>${t('backup.text', { birds: state.birds.size, logs: state.logs.size })}</p>
      <button class="btn block" id="export">${t('backup.save')}</button>
    </section>
    <section class="card">
      <h3>${t('restore.title')}</h3>
      <p class="muted small">${t('restore.text')}</p>
      <label class="btn block" for="restore">${t('restore.open')}</label>
      <input type="file" id="restore" accept=".json,application/json" hidden>
    </section>
    <section class="card">
      <h3>${t('derby.title')}</h3>
      <p class="muted small">${t('derby.text')}</p>
      <a class="btn block" href="../">${t('derby.open')}</a>
    </section>
    <section class="card">
      <h3>${t('danger.title')}</h3>
      <button class="btn danger block" id="wipe">${t('danger.wipe')}</button>
    </section>
    <section class="card">
      <h3>${t('about.title')}</h3>
      <dl class="facts">
        <dt>${t('about.app')}</dt><dd>${t('about.appName')}</dd>
        <dt>${t('about.version')}</dt><dd id="app-version">v${APP_VERSION}</dd>
        <dt>${t('about.lang')}</dt><dd>${t('lang.name')}</dd>
      </dl>
    </section>`;

  $('#install')?.addEventListener('click', install.startInstall);
  const readFile = async (input) => {
    const file = input.files[0];
    input.value = '';
    if (!file) return null;
    try { return JSON.parse(await file.text()); } catch { toast(t('import.bad')); return null; }
  };
  // Either file picker accepts either kind of file, so nobody has to guess which button to use.
  const handleFile = async (data) => {
    if (!data) return;
    if (isDerbyFile(data)) {
      const birds = derbyBirds(data);
      if (!birds.length) return toast(t('import.none'));
      state.pendingImport = { birds, logs: data.logs || [], keeps: data.keeps || [] };
      location.hash = '#/import';
    } else if (data.app === 'derby-keep') {
      const r = await importRecords(data.birds || [], data.logs || [], data.keeps || []);
      toast(t('import.done', r));
      renderMore();
    } else {
      toast(t('import.bad'));
    }
  };
  $('#derby-file').onchange = async (e) => handleFile(await readFile(e.target));
  $('#restore').onchange = async (e) => handleFile(await readFile(e.target));
  $('#export').onclick = () => {
    const data = { app: 'derby-keep', version: 1, appVersion: APP_VERSION, exportedAt: new Date().toISOString(), birds: [...state.birds.values()], logs: logsArr(), keeps: [...state.keeps.values()] };
    deliverJson(data, `derby-keep-backup-${todayStr()}.json`);
  };
  $('#wipe').onclick = async () => {
    if (!state.birds.size && !state.logs.size) return toast(t('wipe.none'));
    if (!confirm(t('wipe.confirm'))) return;
    if (prompt(t('wipe.type')) !== 'DELETE') return toast(t('wipe.cancelled'));
    await Promise.all([db.birds.clear(), db.logs.clear(), db.keeps.clear()]);
    state.birds.clear(); state.logs.clear(); state.keeps.clear();
    toast(t('wipe.done'));
    location.hash = '#/';
  };
}

function renderImportPick() {
  const pending = state.pendingImport;
  if (!pending) { location.replace('#/more'); return; }
  setHeader(t('import.pickTitle'), '#/more');
  const birds = [...pending.birds].sort((a, b) => Number(b.preselect) - Number(a.preselect) || displayName(a).localeCompare(displayName(b)));
  view.innerHTML = `
    <section class="card">
      <p class="muted small">${t('import.pickHint')}</p>
      <ul class="pick-list">
        ${birds.map((b) => `<li><label class="pick">
          <input type="checkbox" value="${esc(b.id)}"${b.preselect ? ' checked' : ''}>
          <span class="pick-main"><span class="bc-top"><strong>${esc(displayName(b))}</strong>${sexBadge(b)}</span>
            <span class="muted small">${esc([bandLabel(b), b.bloodline].filter(Boolean).join(' · '))}</span></span>
        </label></li>`).join('')}
      </ul>
    </section>
    <div class="actions sticky">
      <a class="btn" href="#/more" id="pick-cancel">${t('import.cancel')}</a>
      <button class="btn primary" id="pick-go"></button>
    </div>`;
  const update = () => { $('#pick-go').textContent = t('import.selected', { n: $$('.pick input:checked').length }); };
  for (const cb of $$('.pick input')) cb.onchange = update;
  update();
  $('#pick-cancel').onclick = () => { state.pendingImport = null; };
  $('#pick-go').onclick = async () => {
    const ids = new Set($$('.pick input:checked').map((cb) => cb.value));
    if (!ids.size) return;
    const chosen = pending.birds.filter((b) => ids.has(b.id)).map(({ preselect, ...b }) => {
      const cur = state.birds.get(b.id);
      return cur ? { ...cur, ...b, notes: cur.notes, createdAt: cur.createdAt } : b;
    });
    // Logs and keeps from an older Derby backup come along for the chosen birds.
    const r = await importRecords(chosen, pending.logs.filter((l) => ids.has(l?.birdId)), pending.keeps.filter((k) => ids.has(k?.birdId)), true);
    state.pendingImport = null;
    toast(t('import.done', r));
    location.hash = '#/birds';
  };
}

// ---------- import / export ----------

const LOG_FIELD_KINDS = Object.fromEntries(Object.entries(LOG_TYPES).map(([k, fields]) => [k, Object.fromEntries(fields.map((f) => [f.k, f.kind]))]));

function sanitizeBird(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null;
  return {
    id: str(raw.id, 80), name: str(raw.name), wingband: str(raw.wingband, 40), legband: str(raw.legband, 40),
    sex: SEX[raw.sex] ? raw.sex : '', status: STATUS.includes(raw.status) ? raw.status : 'active',
    bloodline: str(raw.bloodline, 200), notes: str(raw.notes, 5000), source: raw.source === 'derby' ? 'derby' : '',
    createdAt: Number(raw.createdAt) || Date.now(), updatedAt: Number(raw.updatedAt) || Date.now(),
  };
}

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

/** Save records, keeping whichever copy is newer. `forceBirds` always writes the birds (a fresh Derby pick). */
async function importRecords(birds, logs, keeps, forceBirds = false) {
  const newer = (map, list) => list.filter(Boolean).filter((r) => !map.has(r.id) || r.updatedAt > (map.get(r.id).updatedAt || 0));
  const b = forceBirds ? birds.map(sanitizeBird).filter(Boolean) : newer(state.birds, birds.map(sanitizeBird));
  const l = newer(state.logs, logs.map(sanitizeLog));
  const k = newer(state.keeps, keeps.map(sanitizeKeep));
  await db.birds.putMany(b);
  await db.logs.putMany(l);
  await db.keeps.putMany(k);
  for (const x of b) state.birds.set(x.id, x);
  for (const x of l) state.logs.set(x.id, x);
  for (const x of k) state.keeps.set(x.id, x);
  requestPersistence();
  return { birds: b.length, logs: l.length, keeps: k.length };
}

async function deliverJson(data, filename) {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const file = new File([blob], filename, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Derby Keep backup' }); return; } catch (err) { if (err.name === 'AbortError') return; }
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

// ---------- sample data ----------

async function loadSampleData() {
  const now = Date.now();
  const today = todayStr();
  const day = (n) => addDays(today, n);
  const bird = (id, name, sex, extra) => ({ id: `sample-${id}`, name, sex, wingband: '', legband: '', status: 'active', bloodline: '', notes: '', source: '', createdAt: now, updatedAt: now, ...extra });
  const birds = [
    bird('a1', 'Sweater-Kelso Stag', 'stag', { wingband: '201', legband: '17', bloodline: '1/2 Kelso · 1/2 Sweater' }),
    bird('a2', 'Red Hatch Cock', 'cock', { wingband: '118', bloodline: '3/4 Hatch · 1/4 Kelso' }),
    bird('k1', 'Kelso Hen', 'hen', { wingband: '102', bloodline: 'Full Kelso' }),
  ];
  let n = 0;
  const log = (birdId, type, date, data, notes = '') => ({ id: `sample-log-${++n}`, birdId, type, date, data, notes, createdAt: now + n, updatedAt: now + n });
  const logs = [
    ...[[-10, 2.32], [-8, 2.28], [-6, 2.25], [-4, 2.21], [-2, 2.19], [0, 2.16]].map(([d, kg]) => log('sample-a1', 'weight', day(d), { weight: kg })),
    log('sample-a1', 'feed', today, { feed: 'Conditioning pellets', amount: '80 g' }),
    log('sample-a1', 'exercise', day(-1), { activity: 'Running pen', minutes: 20 }),
    log('sample-a1', 'sparring', day(-3), { partner: 'Red Hatch Cock', minutes: 3, rating: 4 }, 'Good timing, strong breaks'),
    log('sample-a1', 'vitamins', day(-5), { product: 'B-complex', dose: '1 tablet' }),
    log('sample-a1', 'vaccine', day(-80), { product: 'Newcastle (NCD)', nextDue: day(5) }),
    log('sample-a2', 'weight', day(-1), { weight: 2.25 }),
    log('sample-k1', 'deworm', day(-92), { product: 'Levamisole', nextDue: day(-2) }),
  ];
  const keeps = [{ id: 'sample-keep', birdId: 'sample-a1', name: 'Derby keep', startDate: day(-10), fightDate: day(11), targetWeight: 2.1, status: 'active', notes: '', createdAt: now, updatedAt: now }];
  await db.birds.putMany(birds);
  await db.logs.putMany(logs);
  await db.keeps.putMany(keeps);
  for (const x of birds) state.birds.set(x.id, x);
  for (const x of logs) state.logs.set(x.id, x);
  for (const x of keeps) state.keeps.set(x.id, x);
  toast(t('toast.sample'));
  renderToday();
}

// ---------- startup ----------

async function init() {
  initLanguageSwitch();
  trackKeyboard();
  try {
    for (const b of await db.birds.all()) state.birds.set(b.id, b);
    for (const l of await db.logs.all()) state.logs.set(l.id, l);
    for (const k of await db.keeps.all()) state.keeps.set(k.id, k);
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
