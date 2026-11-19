import * as db from './db.js';
import * as G from './genetics.js';
import { SEX, STATUS, PRESET_LINES, FEATHER_COLORS, LEG_COLORS, COMBS } from './constants.js';
import { APP_VERSION } from './version.js';
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
  if (months < 1) return 'under 1 mo';
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y && `${y} yr`, m && `${m} mo`].filter(Boolean).join(' ');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(d.getTime()) ? dateStr : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const pct = (f) => `${(f * 100).toFixed(f > 0 && f < 0.1 ? 2 : 1).replace(/\.?0+$/, '')}%`;

function compSummary(comp, max = 3) {
  const entries = G.sortedEntries(comp);
  if (!entries.length) return 'Bloodline not recorded';
  const shown = entries.slice(0, max).map(([k, v]) => `${G.formatShare(v)} ${k}`);
  if (entries.length > max) shown.push('…');
  return shown.join(' · ');
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

const sexBadge = (b) => (SEX[b.sex] ? `<span class="badge sex-${b.sex}">${SEX[b.sex].label}</span>` : '');
const statusBadge = (b) => (STATUS[b.status] ? `<span class="badge status">${STATUS[b.status]}</span>` : '');

function thumb(b, cls = 'thumb') {
  if (b.photo) return `<img class="${cls}" src="${esc(b.photo)}" alt="">`;
  return `<span class="${cls} placeholder" aria-hidden="true">${noPhotoSvg}</span>`;
}

const noPhotoSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>`;

// ---------- routing ----------

function parseHash() {
  const raw = location.hash.slice(1) || '/';
  const [path, query = ''] = raw.split('?');
  return { parts: path.split('/').filter(Boolean), query: new URLSearchParams(query) };
}

function route() {
  const { parts, query } = parseHash();
  window.scrollTo(0, 0);
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
  if (parts[0] === 'mating') return renderMating(query);
  if (parts[0] === 'lines') return renderLines();
  if (parts[0] === 'more' || parts[0] === 'backup') return renderMore();
  return renderNotFound();
}

function renderNotFound() {
  setHeader('Not found', '#/');
  view.innerHTML = `<div class="card empty"><p>That bird was not found. It may have been deleted.</p><a class="btn" href="#/">Back to birds</a></div>`;
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
        <h2>Welcome to Derby</h2>
        <p>Keep the bloodline and pedigree of every cock, stag, hen and pullet on your farm.</p>
        <ol>
          <li>Start with your <strong>brood stock</strong> and enter their bloodlines (e.g. ½ Sweater, ½ Kelso).</li>
          <li>Add their offspring and pick the sire and dam. Derby works out the blood automatically.</li>
          <li>Use <strong>Mating</strong> to check bloodline and inbreeding before you breed a pair.</li>
        </ol>
        <a class="btn primary block" href="#/bird/new">Add your first bird</a>
        <button class="btn block" id="sample">Try it with sample birds</button>
        <p class="muted small">Your records stay on this phone. Use More → Backup to save a copy or share birds with friends.</p>
      </section>
      <p class="version-foot">Derby v${APP_VERSION}</p>`;
    $('#sample').onclick = loadSampleData;
    install.bindBanner(view);
    return;
  }

  view.innerHTML = `
    ${install.bannerHTML()}
    <div class="toolbar">
      <input type="search" id="q" placeholder="Search name, band, line, breeder…" value="${esc(f.q)}" aria-label="Search birds" autocomplete="off">
      <div class="chips" role="group" aria-label="Filter by sex">
        ${['all', ...Object.keys(SEX)].map((s) => `<button type="button" class="chip${f.sex === s ? ' on' : ''}" data-sex="${s}" aria-pressed="${f.sex === s}">${s === 'all' ? 'All' : SEX[s].label}</button>`).join('')}
      </div>
      <select id="status" aria-label="Filter by status">
        <option value="all">All statuses</option>
        ${Object.entries(STATUS).map(([k, v]) => `<option value="${k}"${f.status === k ? ' selected' : ''}>${v}</option>`).join('')}
      </select>
    </div>
    <p class="count muted" id="count"></p>
    <ul class="bird-list" id="list"></ul>
    <a class="fab" href="#/bird/new" aria-label="Add bird">+</a>`;

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
    $('#count').textContent = `${items.length} of ${state.birds.size} birds`;
    $('#list').innerHTML = items.length
      ? items.map((b) => birdCard(b, memo)).join('')
      : `<li class="card empty"><p>No birds match.</p></li>`;
  };

  install.bindBanner(view);
  $('#q').oninput = (e) => { f.q = e.target.value; draw(); };
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
  const facts = [
    ['Hatched', b.hatchDate ? `${formatDate(b.hatchDate)}${ageLabel(b.hatchDate) ? ` (${ageLabel(b.hatchDate)})` : ''}` : ''],
    ['Wingband', b.wingband],
    ['Legband', b.legband],
    ['Feather color', b.color],
    ['Leg color', b.legColor],
    ['Comb', b.comb],
    ['Breeder / source', b.breeder],
  ].filter(([, v]) => v);

  view.innerHTML = `
    <section class="hero">
      ${b.photo ? `<img class="hero-photo" src="${esc(b.photo)}" alt="Photo of ${esc(displayName(b))}">` : `<div class="hero-photo placeholder" aria-hidden="true">${noPhotoSvg}</div>`}
      <div>
        <h2>${esc(displayName(b))}</h2>
        <div class="badges">${sexBadge(b)}${statusBadge(b)}</div>
        ${bandLabel(b) ? `<p class="muted">${esc(bandLabel(b))}</p>` : ''}
      </div>
    </section>

    <section class="card">
      <h3>Bloodline</h3>
      ${compBars(comp)}
      <p class="muted small">${b.compositionMode === 'auto' ? 'Calculated from sire and dam.' : 'Entered manually (foundation bird).'}</p>
    </section>

    <section class="card">
      <h3>Inbreeding</h3>
      <p class="big">${pct(f)} <span class="muted small">${esc(G.inbreedingLabel(f))}</span></p>
      <p class="muted small">Based on the ancestors recorded in Derby. Missing ancestors count as unrelated.</p>
    </section>

    <section class="card">
      <h3>Pedigree</h3>
      ${pedigreeGrid(b.id, ped)}
    </section>

    ${facts.length ? `<section class="card"><h3>Details</h3><dl class="facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl></section>` : ''}

    ${b.notes ? `<section class="card"><h3>Notes</h3><p class="notes">${esc(b.notes)}</p></section>` : ''}

    <section class="card">
      <div class="row-between"><h3>Offspring (${kids.length})</h3>
        ${SEX[b.sex] ? `<a class="btn small" href="#/bird/new?${male ? 'sire' : 'dam'}=${encodeURIComponent(b.id)}">+ Add offspring</a>` : ''}
      </div>
      ${kids.length ? `<ul class="bird-list compact">${kids.map((k) => birdCard(k)).join('')}</ul>` : '<p class="muted">No offspring recorded.</p>'}
    </section>

    <div class="actions">
      <a class="btn primary" href="#/bird/${esc(b.id)}/edit">Edit</a>
      <a class="btn" href="#/mating?${male ? 'sire' : 'dam'}=${encodeURIComponent(b.id)}">Test mating</a>
      <button class="btn" id="share">Share pedigree</button>
      <button class="btn danger" id="delete">Delete</button>
    </div>`;

  $('#share').onclick = () => shareBird(b);
  $('#delete').onclick = () => deleteBirdFlow(b, kids);
}

function compBars(comp) {
  const entries = G.sortedEntries(comp);
  if (!entries.length) return '<p class="muted">Not recorded yet. Edit this bird to add its bloodline.</p>';
  return `<ul class="bars">${entries
    .map(([k, v]) => `<li class="${k === G.UNKNOWN ? 'unknown' : ''}">
      <div class="bar-label"><span>${esc(k)}</span><span>${G.formatShare(v)} <span class="muted">· ${pct(v)}</span></span></div>
      <div class="bar"><span style="width:${(v * 100).toFixed(2)}%"></span></div></li>`)
    .join('')}</ul>`;
}

function pedigreeGrid(id, ped) {
  const gens = ped.ancestorsByGeneration(id, 3);
  const titles = ['Parents', 'Grandparents', 'Great-grandparents'];
  let cells = '';
  gens.forEach((ids, g) => {
    const span = 8 / ids.length;
    ids.forEach((aid, i) => {
      const role = i % 2 === 0 ? 'sire' : 'dam';
      const a = aid ? state.birds.get(aid) : null;
      const style = `grid-column:${g + 1};grid-row:${i * span + 1} / span ${span}`;
      const label = g === 0 ? (role === 'sire' ? 'Sire' : 'Dam') : '';
      if (!a) {
        cells += `<div class="pcell ${role} unknown" style="${style}">${label ? `<small>${label}</small>` : ''}<span>Unknown</span></div>`;
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
  return `<div class="pedigree-scroll"><div class="pedigree-head">${titles.map((t) => `<span>${t}</span>`).join('')}</div><div class="pedigree">${cells}</div></div>`;
}

async function deleteBirdFlow(b, kids) {
  const extra = kids.length ? `\n\n${kids.length} offspring will keep their records but lose this parent link.` : '';
  if (!confirm(`Delete ${displayName(b)}? This cannot be undone.${extra}`)) return;
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
  toast('Bird deleted');
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
  setHeader(isNew ? 'Add bird' : `Edit ${displayName(b)}`, isNew ? '#/' : `#/bird/${b.id}`);

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
            <label class="btn small" for="photo">${b.photo ? 'Change photo' : 'Add photo'}</label>
            <input type="file" id="photo" accept="image/*" hidden>
            <button type="button" class="btn small link" id="photo-remove"${b.photo ? '' : ' hidden'}>Remove</button>
          </div>
        </div>
        <label>Name <input name="name" value="${esc(b.name)}" placeholder="e.g. Red Sweater #12" autocomplete="off"></label>
        <div class="two">
          <label>Wingband <input name="wingband" value="${esc(b.wingband)}" autocomplete="off"></label>
          <label>Legband <input name="legband" value="${esc(b.legband)}" autocomplete="off"></label>
        </div>
        <fieldset class="seg">
          <legend>Sex</legend>
          ${Object.entries(SEX).map(([k, v]) => `<label><input type="radio" name="sex" value="${k}"${b.sex === k ? ' checked' : ''}><span>${v.label}</span></label>`).join('')}
        </fieldset>
        <div class="two">
          <label>Hatch date <input type="date" name="hatchDate" value="${esc(b.hatchDate)}"></label>
          <label>Status <select name="status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}"${b.status === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        </div>
      </section>

      <section class="card">
        <h3>Parents</h3>
        <label>Sire (father)
          <select name="sireId"><option value="">Unknown / not recorded</option>${males.map((x) => opt(x, b.sireId)).join('')}</select>
        </label>
        <label>Dam (mother)
          <select name="damId"><option value="">Unknown / not recorded</option>${females.map((x) => opt(x, b.damId)).join('')}</select>
        </label>
        <p class="muted small">Parent not listed? Add it first as a bird (use status “Reference only” if you don't own it).</p>
      </section>

      <section class="card">
        <h3>Bloodline</h3>
        <fieldset class="seg">
          <legend class="sr-only">How to set bloodline</legend>
          <label><input type="radio" name="compositionMode" value="auto"${b.compositionMode === 'auto' ? ' checked' : ''}><span>From parents</span></label>
          <label><input type="radio" name="compositionMode" value="manual"${b.compositionMode !== 'auto' ? ' checked' : ''}><span>Enter manually</span></label>
        </fieldset>
        <div id="comp-auto"></div>
        <div id="comp-manual">
          <p class="muted small">For foundation birds. Enter shares like <b>1/2</b>, <b>3/8</b> or <b>25%</b>. Anything left over is counted as Unknown.</p>
          <div id="comp-rows"></div>
          <button type="button" class="btn small" id="add-line">+ Add line</button>
          <p id="comp-total" class="small"></p>
        </div>
      </section>

      <section class="card">
        <h3>Details</h3>
        <div class="two">
          <label>Feather color <input name="color" list="dl-colors" value="${esc(b.color)}" autocomplete="off"></label>
          <label>Leg color <input name="legColor" list="dl-legs" value="${esc(b.legColor)}" autocomplete="off"></label>
        </div>
        <label>Comb <input name="comb" list="dl-combs" value="${esc(b.comb)}" autocomplete="off"></label>
        <label>Breeder / source <input name="breeder" value="${esc(b.breeder)}" placeholder="Farm or breeder name" autocomplete="off"></label>
        <label>Notes <textarea name="notes" rows="4" placeholder="Fighting style, temperament, awards…">${esc(b.notes)}</textarea></label>
      </section>

      ${datalist('dl-lines', allLines())}${datalist('dl-colors', FEATHER_COLORS)}${datalist('dl-legs', LEG_COLORS)}${datalist('dl-combs', COMBS)}
      <p id="form-error" class="error" role="alert"></p>
      <div class="actions sticky">
        <a class="btn" href="${isNew ? '#/' : `#/bird/${esc(b.id)}`}">Cancel</a>
        <button class="btn primary" type="submit">${isNew ? 'Save bird' : 'Save changes'}</button>
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
      toast('Could not read that photo');
    }
  };
  $('#photo-remove').onclick = () => {
    photo = null;
    $('#photo-preview').innerHTML = thumb({}, 'photo-thumb');
    $('#photo-remove').hidden = true;
  };

  // Bloodline editor
  const rowsEl = $('#comp-rows');
  const addRow = (line = '', share = '') => {
    const row = document.createElement('div');
    row.className = 'comp-row';
    row.innerHTML = `<input class="line-name" list="dl-lines" placeholder="Bloodline" value="${esc(line)}" aria-label="Bloodline name" autocomplete="off">
      <input class="line-share" inputmode="decimal" placeholder="1/2" value="${esc(share)}" aria-label="Share">
      <button type="button" class="icon-btn" aria-label="Remove line">×</button>`;
    row.querySelector('button').onclick = () => { row.remove(); updateTotal(); };
    row.querySelectorAll('input').forEach((i) => (i.oninput = updateTotal));
    rowsEl.append(row);
  };
  const readRows = () => {
    const comp = {};
    let bad = false;
    for (const row of $$('.comp-row', rowsEl)) {
      const name = row.querySelector('.line-name').value.trim();
      const raw = row.querySelector('.line-share').value.trim();
      if (!name && !raw) continue;
      const v = G.parseShare(raw);
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
    if (bad) { el.textContent = 'Check each row has a line name and a share like 1/2 or 25%.'; el.classList.add('error'); }
    else if (total > 1 + 1e-6) { el.textContent = `Total is ${pct(total)}, more than 100%.`; el.classList.add('error'); }
    else if (total > 0 && total < 1 - 1e-6) { el.textContent = `Total ${pct(total)} · ${G.formatShare(1 - total)} will be Unknown`; el.classList.add('muted'); }
    else el.textContent = total ? 'Total 100% ✓' : '';
  };
  manualRows.forEach(([k, v]) => addRow(k, G.formatShare(v) === 'Full' ? '1' : G.formatShare(v)));
  if (!manualRows.length) addRow();
  $('#add-line').onclick = () => addRow();
  updateTotal();

  const updateMode = () => {
    const mode = form.compositionMode.value;
    $('#comp-manual').hidden = mode === 'auto';
    $('#comp-auto').hidden = mode !== 'auto';
    if (mode === 'auto') {
      const s = form.sireId.value || null;
      const d = form.damId.value || null;
      if (!s && !d) {
        $('#comp-auto').innerHTML = '<p class="muted">Choose a sire and/or dam above to calculate the bloodline.</p>';
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
    if (!val('name') && !val('wingband') && !val('legband')) return fail('Give the bird a name, wingband or legband.');
    if (!sex) return fail('Choose the sex (cock, stag, hen or pullet).');
    let composition = {};
    if (mode === 'manual') {
      const { comp, bad } = readRows();
      if (bad) return fail('Fix the bloodline rows: each needs a line name and a share like 1/2.');
      if (Object.values(comp).reduce((a, v) => a + v, 0) > 1 + 1e-6) return fail('Bloodline shares add up to more than 100%.');
      composition = G.cleanComposition(comp);
    } else if (existing) {
      composition = existing.composition || {};
    }
    const sireId = val('sireId') || null;
    const damId = val('damId') || null;
    if (mode === 'auto' && !sireId && !damId) return fail('Pick a sire or dam, or switch bloodline to “Enter manually”.');

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
      return fail('Could not save. Your phone may be out of storage.');
    }
    state.birds.set(record.id, record);
    requestPersistence();
    toast(isNew ? 'Bird saved' : 'Changes saved');
    location.hash = `#/bird/${record.id}`;

    function fail(msg) {
      err.textContent = msg;
      err.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };
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

function renderMating(query) {
  setHeader('Test mating', null);
  const all = [...state.birds.values()].sort((x, y) => displayName(x).localeCompare(displayName(y)));
  const males = all.filter((x) => SEX[x.sex]?.male);
  const females = all.filter((x) => SEX[x.sex] && !SEX[x.sex].male);
  const opt = (x, sel) => `<option value="${esc(x.id)}"${x.id === sel ? ' selected' : ''}>${esc(displayName(x))}</option>`;
  const sireSel = query.get('sire');
  const damSel = query.get('dam');

  view.innerHTML = `
    <section class="card">
      <p class="muted">Pick a pair to see what their offspring's bloodline and inbreeding would be before you breed them.</p>
      <label>Sire (cock or stag)
        <select id="m-sire"><option value="">Choose…</option>${males.map((x) => opt(x, sireSel)).join('')}</select>
      </label>
      <label>Dam (hen or pullet)
        <select id="m-dam"><option value="">Choose…</option>${females.map((x) => opt(x, damSel)).join('')}</select>
      </label>
      ${!males.length || !females.length ? '<p class="muted small">Add at least one male and one female bird to use this.</p>' : ''}
    </section>
    <div id="m-result"></div>`;

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
    const gen = (n) => (n === 1 ? 'parent' : n === 2 ? 'grandparent' : n === 3 ? 'great-grandparent' : `${n - 2}× great-grandparent`);
    out.innerHTML = `
      <section class="card">
        <h3>Offspring bloodline</h3>
        ${compBars(comp)}
      </section>
      <section class="card">
        <h3>Offspring inbreeding</h3>
        <p class="big">${pct(f)} <span class="muted small">${esc(G.inbreedingLabel(f))}</span></p>
        ${common.length
          ? `<p class="small">Shared ancestors:</p><ul class="plain">${common.slice(0, 8).map((c) => {
              const a = state.birds.get(c.id);
              return `<li><a href="#/bird/${esc(c.id)}">${esc(displayName(a))}</a> <span class="muted small">${c.a === 0 ? 'is the sire' : `sire's ${gen(c.a)}`}, ${c.b === 0 ? 'is the dam' : `dam's ${gen(c.b)}`}</span></li>`;
            }).join('')}</ul>`
          : '<p class="muted small">No shared ancestors recorded. This is an outcross as far as Derby knows.</p>'}
      </section>
      <div class="actions"><a class="btn primary" href="#/bird/new?sire=${encodeURIComponent(s)}&dam=${encodeURIComponent(d)}">Record a chick from this pair</a></div>`;
  };
  $('#m-sire').onchange = draw;
  $('#m-dam').onchange = draw;
  draw();
}

// ---------- bloodlines ----------

function renderLines() {
  setHeader('Bloodlines', null);
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
        <input id="line-name" placeholder="Add your own bloodline" aria-label="New bloodline name" autocomplete="off">
        <button class="btn primary" type="submit">Add</button>
      </form>
      <p class="muted small">These appear as suggestions when you enter a bird's bloodline. Tap a line to see birds carrying it.</p>
    </section>
    <ul class="line-list">
      ${names.map((n) => {
        const custom = state.customLines.includes(n);
        const c = counts.get(n) || 0;
        return `<li>
          <button type="button" class="line-item" data-line="${esc(n)}"><span>${esc(n)}${custom ? ' <span class="badge">yours</span>' : ''}</span><span class="muted">${c} bird${c === 1 ? '' : 's'}</span></button>
          ${custom ? `<button type="button" class="icon-btn" data-remove="${esc(n)}" aria-label="Remove ${esc(n)}">×</button>` : ''}
        </li>`;
      }).join('')}
    </ul>`;

  $('#line-form').onsubmit = async (e) => {
    e.preventDefault();
    const name = $('#line-name').value.trim();
    if (!name) return;
    if (allLines().some((l) => l.toLowerCase() === name.toLowerCase())) return toast('That line is already listed');
    state.customLines.push(name);
    await db.setMeta('customLines', state.customLines);
    toast(`${name} added`);
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

// ---------- backup & sharing ----------

function renderMore() {
  setHeader('More', null);
  const installed = install.isStandalone();
  view.innerHTML = `
    <section class="card">
      <h3>Install app</h3>
      ${installed
        ? '<p class="ok">✓ Derby is installed on this device.</p>'
        : `<p class="muted small">Add Derby to your home screen so it opens like a normal app and works without signal.</p>
           <button class="btn primary block" id="install">${install.isIOS() ? 'How to install on iPhone' : 'Install Derby'}</button>`}
    </section>
    <section class="card">
      <h3>Backup</h3>
      <p>${state.birds.size} bird${state.birds.size === 1 ? '' : 's'} saved on this phone. Records are not uploaded anywhere, so make a backup regularly. If you lose your phone or clear the browser, records without a backup are gone.</p>
      <button class="btn primary block" id="export">Save backup file</button>
    </section>
    <section class="card">
      <h3>Restore or import</h3>
      <p class="muted small">Open a Derby backup, or a pedigree a friend shared with you. Birds you already have are only replaced if the file's copy is newer.</p>
      <label class="btn block" for="import">Open file…</label>
      <input type="file" id="import" accept=".json,application/json" hidden>
    </section>
    <section class="card">
      <h3>Sharing birds with friends</h3>
      <p class="muted small">Open a bird and tap <b>Share pedigree</b>. Derby sends that bird and all its recorded ancestors as a file (by Messenger, Viber, email…). Your friend opens it here under <b>Open file</b>.</p>
    </section>
    <section class="card">
      <h3>Danger zone</h3>
      <button class="btn danger block" id="wipe">Delete all birds on this phone</button>
    </section>
    <section class="card about">
      <h3>About</h3>
      <dl class="facts">
        <dt>App</dt><dd>Derby: gamefowl pedigree</dd>
        <dt>Version</dt><dd id="app-version">v${APP_VERSION}</dd>
        <dt>Birds</dt><dd>${state.birds.size}</dd>
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
      toast(`Imported: ${r.added} new, ${r.updated} updated, ${r.skipped} unchanged`);
      renderMore();
    } catch (err) {
      toast(err.message || 'That file is not a Derby backup');
    }
  };
  $('#wipe').onclick = async () => {
    if (!state.birds.size) return toast('No birds to delete');
    if (!confirm(`Delete all ${state.birds.size} birds from this phone? Save a backup first if you may need them.`)) return;
    if (prompt('Type DELETE to confirm') !== 'DELETE') return toast('Nothing was deleted');
    await db.clearBirds();
    state.birds.clear();
    toast('All birds deleted');
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
  toast(`Saved ${filename}`);
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
  if (!data || data.app !== 'derby' || !Array.isArray(data.birds)) throw new Error('That file is not a Derby backup');
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
  toast('Sample birds added. Delete them any time.');
  renderList();
}

// ---------- startup ----------

let persistAsked = false;
function requestPersistence() {
  if (persistAsked) return;
  persistAsked = true;
  navigator.storage?.persist?.().catch(() => {});
}

async function init() {
  try {
    const birds = await db.getAllBirds();
    for (const b of birds) state.birds.set(b.id, b);
    state.customLines = (await db.getMeta('customLines')) || [];
  } catch {
    view.innerHTML = '<div class="card empty"><p>Derby could not open its storage. Private/incognito browsing may block it.</p></div>';
    return;
  }
  window.addEventListener('hashchange', route);
  route();
  install.onInstallChange(() => { if (parseHash().parts[0] === 'more') renderMore(); });
  try {
    const last = await db.getMeta('lastVersion');
    if (last && last !== APP_VERSION) toast(`Derby updated to v${APP_VERSION}`);
    if (last !== APP_VERSION) await db.setMeta('lastVersion', APP_VERSION);
  } catch { /* non-critical */ }
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

init();
