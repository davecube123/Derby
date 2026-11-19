// "Install app" prompt for Android/desktop Chrome (native prompt) and
// step-by-step instructions for iPhone/iPad and other browsers.
import { t } from './i18n.js';

const DISMISS_KEY = 'derby.installDismissedAt';
const DISMISS_DAYS = 7;
let deferredPrompt = null;
const listeners = new Set();

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  listeners.forEach((fn) => fn());
});
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  listeners.forEach((fn) => fn());
});

export const onInstallChange = (fn) => listeners.add(fn);

export function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function isIOS() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

const isIOSSafari = () => isIOS() && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(navigator.userAgent);

export function bannerDismissed() {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY));
    return t && Date.now() - t < DISMISS_DAYS * 864e5;
  } catch {
    return false;
  }
}

export function dismissBanner() {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* storage blocked */ }
}

export const shouldShowBanner = () => !isStandalone() && !bannerDismissed();

const shareIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1"/></svg>`;
const plusIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/></svg>`;
const dotsIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>`;

function steps() {
  if (isIOS()) {
    const where = isIOSSafari() ? t('ios.whereSafari') : t('ios.whereOther');
    return {
      title: t('sheet.ios'),
      items: [
        t('ios.step1', { icon: `<span class="kbd">${shareIcon}</span>`, where }),
        t('ios.step2', { icon: `<span class="kbd">${plusIcon}</span>` }),
        t('ios.step3'),
      ],
      note: isIOSSafari() ? '' : t('ios.note'),
    };
  }
  return {
    title: t('sheet.android'),
    items: [
      t('and.step1', { icon: `<span class="kbd">${dotsIcon}</span>` }),
      t('and.step2'),
      t('and.step3'),
    ],
    note: '',
  };
}

/** Use the native prompt when the browser offers one, otherwise show the steps sheet. */
export async function startInstall() {
  if (deferredPrompt) {
    const p = deferredPrompt;
    deferredPrompt = null;
    p.prompt();
    const { outcome } = await p.userChoice.catch(() => ({ outcome: 'dismissed' }));
    listeners.forEach((fn) => fn());
    if (outcome === 'accepted') return;
  }
  openSheet();
}

function openSheet() {
  const s = steps();
  const sheet = document.getElementById('sheet');
  sheet.innerHTML = `
    <div class="sheet-backdrop" data-close></div>
    <div class="sheet-panel" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <div class="sheet-head">
        <img src="icons/logo.png" alt="" width="44" height="44">
        <div><h2 id="sheet-title">${s.title}</h2><p class="muted small">${t('sheet.sub')}</p></div>
      </div>
      <ol class="steps">${s.items.map((t) => `<li><span>${t}</span></li>`).join('')}</ol>
      ${s.note ? `<p class="muted small">${s.note}</p>` : ''}
      <button class="btn primary block" data-close>${t('sheet.ok')}</button>
    </div>`;
  sheet.hidden = false;
  document.body.classList.add('no-scroll');
  const close = () => {
    sheet.hidden = true;
    sheet.innerHTML = '';
    document.body.classList.remove('no-scroll');
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => e.key === 'Escape' && close();
  document.addEventListener('keydown', onKey);
  sheet.querySelectorAll('[data-close]').forEach((el) => (el.onclick = close));
  sheet.querySelector('button').focus();
}

/** Banner markup for the top of the bird list. Wire it with bindBanner(). */
export function bannerHTML() {
  if (!shouldShowBanner()) return '';
  return `<div class="install-banner" id="install-banner">
    <img src="icons/logo.png" alt="" width="40" height="40">
    <div class="ib-text"><strong>${t('banner.title')}</strong><span>${t('banner.text')}</span></div>
    <button class="btn primary small" id="ib-install">${t('banner.btn')}</button>
    <button class="icon-btn" id="ib-close" aria-label="${t('banner.close')}">×</button>
  </div>`;
}

export function bindBanner(root) {
  const el = root.querySelector('#install-banner');
  if (!el) return;
  el.querySelector('#ib-install').onclick = startInstall;
  el.querySelector('#ib-close').onclick = () => { dismissBanner(); el.remove(); };
}
