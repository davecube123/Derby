import { planetaryHours, hourAt, moonPhase, moonSign, dateIn, CHALDEAN } from './astro.js';
import { PLANETS, FEATHERS, FRIENDS, rankFeathers, scoreFeather, verdict, compare } from './rules.js';
import { CITIES, PH_OFFSET, PH_TZ } from './places.js';
import { APP_VERSION } from './version.js';
import { t, getLang, setLang, locale, LANGS } from './i18n.js';
import * as install from './install.js';

// Settings are per-device conveniences, so localStorage is enough (no records are kept).
const PLACE_KEY = 'derbyswerte.place';
const LAST_VERSION_KEY = 'derbyswerte.lastVersion';

const view = document.getElementById('view');
const titleEl = document.getElementById('title');
const backEl = document.getElementById('back');

const state = {
  place: loadPlace(),
  plan: { date: '', color: '' },
  match: { mine: '', theirs: '', date: '', time: '' },
};

// ---------- helpers ----------

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const $ = (sel, root = view) => root.querySelector(sel);
const $$ = (sel, root = view) => [...root.querySelectorAll(sel)];

function loadPlace() {
  try {
    const p = JSON.parse(localStorage.getItem(PLACE_KEY));
    if (p && Number.isFinite(p.lat) && Number.isFinite(p.lon) && Number.isFinite(p.offset)) return p;
  } catch { /* none saved */ }
  return { ...CITIES[0], offset: PH_OFFSET, tz: PH_TZ };
}
function savePlace(p) {
  state.place = p;
  try { localStorage.setItem(PLACE_KEY, JSON.stringify(p)); } catch { /* storage blocked */ }
}

const placeName = () => (state.place.mine ? t('loc.mine') : state.place.name);
const P = (planet) => `${PLANETS[planet].glyph} ${t(`planet.${planet}`)}`;
const fmtTime = (d) => d.toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit', ...(state.place.tz ? { timeZone: state.place.tz } : {}) });
const pad = (n) => String(n).padStart(2, '0');
const dateStr = ({ y, m, d }) => `${y}-${pad(m)}-${pad(d)}`;
const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return { y, m, d }; };
const todayLocal = () => dateIn(new Date(), state.place.offset);
const weekdayName = ({ y, m, d }) => new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString(locale(), { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
const MOON_EMOJI = { new: '🌑', waxingCrescent: '🌒', firstQuarter: '🌓', waxingGibbous: '🌔', full: '🌕', waningGibbous: '🌖', lastQuarter: '🌗', waningCrescent: '🌘' };

function feather(f, extra = '') {
  return `<span class="feather"${extra}><span class="swatch" style="background:${FEATHERS[f]}" aria-hidden="true"></span>${esc(t(`feather.${f}`))}</span>`;
}
const verdictBadge = (v) => `<span class="verdict v-${v}">${v === 'notFavored' ? '✕ ' : v === 'strong' ? '★ ' : ''}${esc(t(`v.${v}`))}</span>`;

function ctxAt(instant) {
  const { day, hour } = hourAt(instant, state.place.lat, state.place.lon, state.place.offset);
  const moon = moonSign(instant);
  return { day, hour, moon, phase: moonPhase(instant), ctx: { hourRuler: hour.ruler, dayRuler: day.dayRuler, moonRuler: moon.ruler } };
}

function setHeader(title, backHref) {
  titleEl.textContent = title;
  document.title = title === t('app.name') ? title : `${title} · Derby Swerte`;
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

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 2800);
}

const guideNote = () => `<p class="guide-note">${t('note.guide')}</p>`;

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
      route({ keepScroll: true }); // no typed input to lose: every screen re-renders from saved choices
    };
  }
  applyShellLanguage();
}

// ---------- routing ----------

let ticker = null;

function route(opts = {}) {
  const page = (location.hash.slice(1) || '/').split('/').filter(Boolean)[0] || 'today';
  if (!opts.keepScroll) window.scrollTo(0, 0);
  clearInterval(ticker);
  setActiveNav(page);
  if (page === 'plan') return renderPlan();
  if (page === 'match') return renderMatch();
  if (page === 'more') return renderMore();
  renderToday();
  ticker = setInterval(() => { if (!document.hidden) renderToday(); }, 60_000);
}

// ---------- today ----------

function renderToday() {
  setHeader(t('app.name'), null);
  const now = new Date();
  const { day, hour, moon, phase, ctx } = ctxAt(now);
  const ranked = rankFeathers(ctx);
  const best = ranked.filter((r) => r.score > 0);
  const avoid = ranked.filter((r) => r.score < 0);
  const upcoming = day.hours.filter((h) => h.start > now).slice(0, 4);
  const nextDay = upcoming.length < 4 ? planetaryHours(dateIn(day.nextSunrise, state.place.offset), state.place.lat, state.place.lon).hours.slice(0, 4 - upcoming.length) : [];

  view.innerHTML = `
    ${install.bannerHTML()}
    <section class="card now-card">
      <h3>${t('today.now')}</h3>
      <p class="big">${esc(t('today.hourOf', { planet: P(hour.ruler) }))}</p>
      <p class="keep-sub">${esc(t('today.until', { from: fmtTime(hour.start), to: fmtTime(hour.end) }))}</p>
      <dl class="facts">
        <dt>${t('today.day')}</dt><dd>${esc(t('today.dayOf', { planet: P(day.dayRuler) }))}</dd>
        <dt>${t('today.moon')}</dt><dd>${MOON_EMOJI[phase.name]} ${esc(t('today.moonIn', { phase: t(`phase.${phase.name}`), sign: t(`sign.${moon.sign}`) }))}</dd>
        <dt>☀</dt><dd>${esc(t('today.sunTimes', { rise: fmtTime(day.sunrise), set: fmtTime(day.sunset) }))}</dd>
      </dl>
      <p class="muted small">${esc(t('today.where', { place: placeName() }))} · <a href="#/more">${t('loc.title')}</a></p>
    </section>
    <section class="card">
      <h3>${t('today.best')}</h3>
      ${best.length ? `<ul class="score-list">${best.map(scoreRow).join('')}</ul>` : `<p class="muted">${t('none')}</p>`}
    </section>
    <section class="card">
      <h3>${t('today.avoid')}</h3>
      ${avoid.length ? `<ul class="score-list">${avoid.map(scoreRow).join('')}</ul>` : `<p class="muted">${t('none')}</p>`}
    </section>
    <section class="card">
      <h3>${t('today.next')}</h3>
      <ul class="hour-list">${[...upcoming, ...nextDay].map((h) => hourRow(h, null)).join('')}</ul>
    </section>
    <div class="actions">
      <a class="btn primary" href="#/plan">${t('today.plan')}</a>
      <a class="btn" href="#/match">${t('today.match')}</a>
    </div>
    ${guideNote()}`;
  install.bindBanner(view);
}

function scoreRow(r) {
  return `<li class="score-row">${feather(r.feather)}${verdictBadge(verdict(r.score))}</li>`;
}

/** One planetary hour: time range, ruling planet, and either its top colors or the verdict for a chosen color. */
function hourRow(h, color) {
  const moon = moonSign(new Date((h.start.getTime() + h.end.getTime()) / 2));
  const { day } = hourAt(h.start, state.place.lat, state.place.lon, state.place.offset);
  const ctx = { hourRuler: h.ruler, dayRuler: day.dayRuler, moonRuler: moon.ruler };
  const right = color
    ? verdictBadge(verdict(scoreFeather(color, ctx).score))
    : `<span class="hr-colors">${rankFeathers(ctx).filter((r) => r.score >= 3).slice(0, 3).map((r) => feather(r.feather)).join('')}</span>`;
  return `<li class="hour-row${h.night ? ' night' : ''}">
    <span class="hr-time">${esc(fmtTime(h.start))}<span class="muted">–${esc(fmtTime(h.end))}</span></span>
    <span class="hr-planet">${esc(P(h.ruler))}</span>
    ${right}
  </li>`;
}

// ---------- fight day planner ----------

function featherOptions(selected, emptyLabel) {
  return `<option value="">${esc(emptyLabel)}</option>${Object.keys(FEATHERS).map((f) => `<option value="${f}"${f === selected ? ' selected' : ''}>${esc(t(`feather.${f}`))}</option>`).join('')}`;
}

function renderPlan() {
  setHeader(t('plan.title'), null);
  const s = state.plan;
  if (!s.date) s.date = dateStr(todayLocal());
  view.innerHTML = `
    <section class="card form">
      <div class="two">
        <label>${t('plan.date')} <input type="date" id="p-date" value="${esc(s.date)}"></label>
        <label>${t('plan.myColor')} <select id="p-color">${featherOptions(s.color, t('plan.any'))}</select></label>
      </div>
      <p class="muted small">${esc(t('today.where', { place: placeName() }))} · <a href="#/more">${t('loc.title')}</a></p>
    </section>
    <div id="p-out"></div>
    ${guideNote()}`;
  const draw = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date)) return;
    const day = planetaryHours(parseDate(s.date), state.place.lat, state.place.lon);
    const noon = new Date((day.sunrise.getTime() + day.sunset.getTime()) / 2);
    const phase = moonPhase(noon);
    const moon = moonSign(noon);
    let best = '';
    if (s.color) {
      const scored = day.hours
        .map((h) => ({ h, score: scoreFeather(s.color, { hourRuler: h.ruler, dayRuler: day.dayRuler, moonRuler: moonSign(h.start).ruler }).score }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score || a.h.start - b.h.start)
        .slice(0, 4)
        .sort((a, b) => a.h.start - b.h.start);
      best = `<section class="card"><h3>${esc(t('plan.bestFor', { color: t(`feather.${s.color}`) }))}</h3>
        ${scored.length ? `<ul class="hour-list">${scored.map((x) => hourRow(x.h, s.color)).join('')}</ul>` : `<p class="muted">${t('plan.noBest')}</p>`}</section>`;
    }
    $('#p-out').innerHTML = `
      <section class="card">
        <p class="big">${esc(t('plan.summary', { weekday: weekdayName(day.date), planet: P(day.dayRuler) }))}</p>
        <p class="keep-sub">${MOON_EMOJI[phase.name]} ${esc(t('plan.moon', { phase: t(`phase.${phase.name}`), sign: t(`sign.${moon.sign}`) }))}</p>
        <p class="muted small">${esc(t('today.sunTimes', { rise: fmtTime(day.sunrise), set: fmtTime(day.sunset) }))}</p>
      </section>
      ${best}
      <section class="card"><h3>${t('plan.day')}</h3><ul class="hour-list">${day.hours.slice(0, 12).map((h) => hourRow(h, s.color || null)).join('')}</ul></section>
      <section class="card"><h3>${t('plan.night')}</h3><ul class="hour-list">${day.hours.slice(12).map((h) => hourRow(h, s.color || null)).join('')}</ul></section>`;
  };
  $('#p-date').onchange = (e) => { s.date = e.target.value; draw(); };
  $('#p-color').onchange = (e) => { s.color = e.target.value; draw(); };
  draw();
}

// ---------- match ----------

function colorGrid(name, selected) {
  return `<div class="color-grid" role="radiogroup">${Object.keys(FEATHERS).map((f) => `<label>
    <input type="radio" name="${name}" value="${f}"${f === selected ? ' checked' : ''}>
    <span>${feather(f)}</span></label>`).join('')}</div>`;
}

function renderMatch() {
  setHeader(t('match.title'), null);
  const s = state.match;
  if (!s.date) {
    const now = new Date(Date.now() + state.place.offset * 36e5);
    s.date = dateStr(todayLocal());
    s.time = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;
  }
  view.innerHTML = `
    <section class="card form">
      <fieldset><legend>${t('match.mine')}</legend>${colorGrid('mine', s.mine)}</fieldset>
      <fieldset><legend>${t('match.theirs')}</legend>${colorGrid('theirs', s.theirs)}</fieldset>
      <div class="two">
        <label>${t('match.date')} <input type="date" id="m-date" value="${esc(s.date)}"></label>
        <label>${t('match.time')} <input type="time" id="m-time" value="${esc(s.time)}"></label>
      </div>
    </section>
    <div id="m-out" aria-live="polite"></div>
    ${guideNote()}`;

  const draw = () => {
    const out = $('#m-out');
    if (!s.mine || !s.theirs) { out.innerHTML = `<p class="muted center">${t('match.pick')}</p>`; return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date) || !/^\d{2}:\d{2}/.test(s.time)) return;
    const { y, m, d } = parseDate(s.date);
    const [hh, mm] = s.time.split(':').map(Number);
    const instant = new Date(Date.UTC(y, m - 1, d, hh, mm) - state.place.offset * 36e5);
    const { day, hour, ctx } = ctxAt(instant);
    const r = compare(s.mine, s.theirs, ctx);
    const head = { mine: t('match.mineWins'), theirs: t('match.theirsWins'), even: t('match.even') }[r.outcome];
    const reasons = (side) => (side.reasons.length
      ? side.reasons.map((x) => `<li><span class="pts ${x.points > 0 ? 'up' : 'down'}">${x.points > 0 ? '+' : ''}${x.points}</span> ${esc(t(`reason.${x.key}`, { planet: t(`planet.${x.planet}`) }))}</li>`).join('')
      : `<li class="muted">${t('reason.none')}</li>`);
    // Other hours of the same planetary day where your color has the clearer edge.
    const better = day.hours
      .filter((h) => h !== hour)
      .map((h) => ({ h, c: compare(s.mine, s.theirs, { hourRuler: h.ruler, dayRuler: day.dayRuler, moonRuler: moonSign(h.start).ruler }) }))
      .filter((x) => x.c.outcome === 'mine' && x.c.margin > r.margin)
      .sort((a, b) => b.c.margin - a.c.margin || a.h.start - b.h.start)
      .slice(0, 3)
      .sort((a, b) => a.h.start - b.h.start);
    out.innerHTML = `
      <section class="card result result-${r.outcome}">
        <p class="big">${esc(head)}</p>
        <p class="keep-sub">${esc(t('match.margin', { n: Math.abs(r.margin) }))} · ${esc(t('match.at', { planet: P(hour.ruler), from: fmtTime(hour.start), to: fmtTime(hour.end) }))}</p>
        <div class="vs">
          <div><span class="label">${t('match.mine')}</span>${feather(s.mine)}<strong>${esc(t('match.points', { n: r.mine.score }))}</strong>${verdictBadge(verdict(r.mine.score))}<ul class="reasons">${reasons(r.mine)}</ul></div>
          <div><span class="label">${t('match.theirs')}</span>${feather(s.theirs)}<strong>${esc(t('match.points', { n: r.theirs.score }))}</strong>${verdictBadge(verdict(r.theirs.score))}<ul class="reasons">${reasons(r.theirs)}</ul></div>
        </div>
      </section>
      <section class="card">
        <h3>${t('match.better')}</h3>
        ${better.length ? `<ul class="hour-list">${better.map((x) => `<li class="hour-row"><span class="hr-time">${esc(fmtTime(x.h.start))}<span class="muted">–${esc(fmtTime(x.h.end))}</span></span><span class="hr-planet">${esc(P(x.h.ruler))}</span><span class="verdict v-strong">${esc(t('match.points', { n: x.c.margin }))}</span></li>`).join('')}</ul>` : `<p class="muted">${t('match.noBetter')}</p>`}
      </section>`;
  };
  for (const r of $$('input[name=mine]')) r.onchange = () => { s.mine = r.value; draw(); };
  for (const r of $$('input[name=theirs]')) r.onchange = () => { s.theirs = r.value; draw(); };
  $('#m-date').onchange = (e) => { s.date = e.target.value; draw(); };
  $('#m-time').onchange = (e) => { s.time = e.target.value; draw(); };
  draw();
}

// ---------- more ----------

function renderMore() {
  setHeader(t('more.title'), null);
  const installed = install.isStandalone();
  const p = state.place;
  view.innerHTML = `
    <section class="card form">
      <h3>${t('loc.title')}</h3>
      <p class="muted small">${t('loc.hint')}</p>
      <label>${t('loc.city')}
        <select id="city">
          ${p.mine ? `<option value="mine" selected>${esc(t('loc.mine'))} (${p.lat.toFixed(2)}, ${p.lon.toFixed(2)})</option>` : ''}
          ${CITIES.map((c, i) => `<option value="${i}"${!p.mine && c.name === p.name ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}
        </select>
      </label>
      <button class="btn block" id="geo" type="button">📍 ${t('loc.useMine')}</button>
    </section>
    <section class="card">
      <h3>${t('how.title')}</h3>
      <p class="small">${t('how.hours')}</p>
      <p class="small">${t('how.points')}</p>
      <h4 class="sub-h">${t('how.colors')}</h4>
      <ul class="planet-table">${CHALDEAN.map((pl) => `<li><strong>${esc(P(pl))}</strong><span class="muted small">${esc(t(`pcolor.${PLANETS[pl].color}`))}</span><span class="pt-feathers">${PLANETS[pl].feathers.map((f) => feather(f)).join('')}</span></li>`).join('')}</ul>
      <p class="muted small">${t('how.mapNote')}</p>
      <h4 class="sub-h">${t('how.friends')}</h4>
      <ul class="planet-table">${CHALDEAN.map((pl) => `<li><strong>${esc(P(pl))}</strong>
        <span class="small">${t('how.friendsLbl')}: ${FRIENDS[pl].friends.map((x) => esc(t(`planet.${x}`))).join(', ') || '—'}</span>
        <span class="small">${t('how.enemiesLbl')}: ${FRIENDS[pl].enemies.map((x) => esc(t(`planet.${x}`))).join(', ') || '—'}</span></li>`).join('')}</ul>
      ${guideNote()}
    </section>
    <section class="card">
      <h3>${t('install.title')}</h3>
      ${installed ? `<p class="ok">${t('install.done')}</p>`
        : `<p class="muted small">${t('install.hint')}</p><button class="btn primary block" id="install">${install.isIOS() ? t('install.ios') : t('install.btn')}</button>`}
    </section>
    <section class="card">
      <h3>${t('apps.title')}</h3>
      <a class="btn block" href="../">${t('apps.derby')}</a>
      <a class="btn block" href="../keep/">${t('apps.keep')}</a>
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
  $('#city').onchange = (e) => {
    if (e.target.value === 'mine') return;
    const c = CITIES[Number(e.target.value)];
    savePlace({ ...c, offset: PH_OFFSET, tz: PH_TZ });
    toast(t('loc.saved', { name: c.name }));
    renderMore();
  };
  $('#geo').onclick = () => {
    if (!navigator.geolocation) return toast(t('loc.denied'));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        savePlace({ name: '', mine: true, lat: pos.coords.latitude, lon: pos.coords.longitude, offset: -new Date().getTimezoneOffset() / 60, tz: null });
        toast(t('loc.saved', { name: t('loc.mine') }));
        renderMore();
      },
      () => toast(t('loc.denied')),
      { timeout: 10000, maximumAge: 600000 },
    );
  };
}

// ---------- startup ----------

function init() {
  initLanguageSwitch();
  window.addEventListener('hashchange', () => route());
  route();
  install.onInstallChange(() => { if (location.hash.startsWith('#/more')) renderMore(); });
  try {
    const last = localStorage.getItem(LAST_VERSION_KEY);
    if (last && last !== APP_VERSION) toast(t('toast.updated', { v: APP_VERSION }));
    localStorage.setItem(LAST_VERSION_KEY, APP_VERSION);
  } catch { /* storage blocked */ }
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

init();
