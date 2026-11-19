// "Install app" prompt for Android/desktop Chrome (native prompt) and
// step-by-step instructions for iPhone/iPad and other browsers.

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
    const where = isIOSSafari() ? 'at the bottom of Safari' : 'in the address bar (top right)';
    return {
      title: 'Install on iPhone / iPad',
      items: [
        `Tap the <b>Share</b> button <span class="kbd">${shareIcon}</span> ${where}.`,
        `Scroll down and tap <b>Add to Home Screen</b> <span class="kbd">${plusIcon}</span>.`,
        'Tap <b>Add</b> (top right). Derby now opens from your home screen like any app.',
      ],
      note: isIOSSafari() ? '' : 'If you don\'t see “Add to Home Screen”, open this page in Safari and try again.',
    };
  }
  return {
    title: 'Install on Android',
    items: [
      `Tap the browser menu <span class="kbd">${dotsIcon}</span> (top right in Chrome).`,
      'Tap <b>Install app</b> or <b>Add to Home screen</b>.',
      'Tap <b>Install</b>. Derby now opens from your home screen like any app.',
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
        <img src="icons/icon.svg" alt="" width="44" height="44">
        <div><h2 id="sheet-title">${s.title}</h2><p class="muted small">Free. Works offline. No app store needed.</p></div>
      </div>
      <ol class="steps">${s.items.map((t) => `<li><span>${t}</span></li>`).join('')}</ol>
      ${s.note ? `<p class="muted small">${s.note}</p>` : ''}
      <button class="btn primary block" data-close>Got it</button>
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
    <img src="icons/icon.svg" alt="" width="40" height="40">
    <div class="ib-text"><strong>Install Derby</strong><span>Add it to your home screen. Works offline.</span></div>
    <button class="btn primary small" id="ib-install">Install</button>
    <button class="icon-btn" id="ib-close" aria-label="Hide install banner">×</button>
  </div>`;
}

export function bindBanner(root) {
  const el = root.querySelector('#install-banner');
  if (!el) return;
  el.querySelector('#ib-install').onclick = startInstall;
  el.querySelector('#ib-close').onclick = () => { dismissBanner(); el.remove(); };
}
