# Project rules

Derby is a mobile web app for gamefowl breeders and cockers in the Philippines.
The owner's standing principles below apply to **every app built here, now and in the future**.

## Every app must have
1. **A version number.** It is defined once in `js/version.js` (`APP_VERSION`) and repeated in `package.json`, `manifest.webmanifest` and `sw.js` (`tests/version.test.js` checks they match). Show it to users (on the More → About screen). Bump it on every release: patch for fixes, minor for features.
2. **A clear install prompt, including on iPhone.** Use the native `beforeinstallprompt` prompt on Android/Chrome, and step-by-step "Share → Add to Home Screen" instructions on iOS (Safari has no install API). Show a dismissible banner on the main screen plus a permanent "Install" entry. Hide both when the app is already installed (standalone mode). Include an `apple-touch-icon` PNG.
3. **An English / Tagalog switch** (EN | TL) that is always visible in the app bar. All user-facing text goes through `t('key')` in `js/i18n.js`, with both languages filled in; `tests/i18n.test.js` fails if a key is missing in either language. Use plain Tagalog that breeders use (tandang, inahin, dumalaga, stag, pang-breed), and keep bloodline names (Sweater, Kelso…) and phone-menu words (Share, Add to Home Screen) as they are.
4. **The owner's rooster logo** (`icons/logo.png` and the generated icon sizes) for app icons and branding.

## Design principles
- **Masculine:** charcoal/steel with a blood-red accent, squared corners (≈6px), bold uppercase section labels. No pastel colors, playful fonts or soft shadows.
- **Simple:** one clear action per screen, plain words, nothing decorative.
  - **Easy to fill in with the phone keyboard open.** For every input, set the right keyboard (`inputmode`, `autocapitalize`) and set `enterkeyhint` to next/done/search. The keyboard's Enter key moves to the next field and never submits the form by accident (`enableKeyboardFlow`). While typing, hide the tab bar and floating buttons so the field and the Save button stay visible. Offer pick-lists instead of typing awkward characters (e.g. blood fractions like 3/8). Keep `interactive-widget=resizes-content` in the viewport meta.
- **Organized:** grouped lists with dividers instead of loose floating cards, consistent section order, and labels above fields.
- **Mobile first:** test at phone width (Pixel 7 and iPhone SE) in both languages, with no horizontal scrolling. Support light and dark mode.

## Workflow
- `npm test` runs the unit tests; `npm start` serves the app locally.
- Any new JS file must be added to the `ASSETS` list in `sw.js` so the app keeps working offline.
- The site is published from `main` via GitHub Pages: https://davecube123.github.io/Derby/
