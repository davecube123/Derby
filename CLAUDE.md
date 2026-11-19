# Project rules

This repo holds two mobile web apps for gamefowl breeders and cockers in the Philippines:
- **Derby** (repo root): bloodlines, pedigrees, test matings, bloodline list.
- **Derby Keep** (`keep/`): conditioning keeps and daily logs (weight, feeding, exercise, sparring, vitamins, vaccines, deworming, health). The owner's friends asked for it to be **separate from Derby**, so keep conditioning features out of Derby.
- **Derby Swerte** (`swerte/`): fight-day astrology. It uses planetary days and hours, moon phase and moon sign, all calculated, plus the traditional planet colors mapped to feather colors. It always presents results as guidance, not prediction; keep that note on every screen. The planet → feather mapping is the app's own choice and is shown in How it works. Change it only in `swerte/js/rules.js`.

- **Derby Pro** (beta, inside Derby + `pro-server/`): an AI pairing advisor. Derby calculates candidates, the chicks' blood and inbreeding on the phone (`js/advisor.js`). `pro-server/` (Node, Anthropic SDK, `claude-opus-5-5`) holds the API key, checks requests, asks Claude for a structured ranking, and always forces "avoid" over the farm's inbreeding limit (`pro-server/advisor.js`). The API key must never go into any app file. AI features are the only part that needs internet; everything else stays offline-first.

The apps share `css/styles.css`, `js/genetics.js`, `icons/` and the language setting, and nothing else. Each has its own data, version, service worker, manifest and install prompt. Each service worker deletes only its own caches: Derby's only `derby-<version>`, Derby Keep's `derby-keep-*`, Derby Swerte's `derby-swerte-*`. Birds move from Derby to Derby Keep through Derby's backup or Share pedigree file.
The owner's standing principles below apply to **every app built here, now and in the future**.

## Every app must have
1. **A version number.** For Derby it is defined in `js/version.js` and repeated in `package.json`, `manifest.webmanifest` and `sw.js`. For Derby Keep it is in `keep/js/version.js`, `keep/manifest.webmanifest` and `keep/sw.js`. Tests check that they match. Derby Swerte follows the same pattern under `swerte/`. Show it to users (on the More → About screen). Bump it on every release: patch for fixes, minor for features.
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
- Any new JS file must be added to the `ASSETS` list in that app's `sw.js` so the app keeps working offline.
- The site is published from `main` via GitHub Pages: Derby at https://davecube123.github.io/Derby/ and Derby Keep at https://davecube123.github.io/Derby/keep/, Derby Swerte at https://davecube123.github.io/Derby/swerte/
