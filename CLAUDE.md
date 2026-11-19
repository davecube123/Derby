# Project rules

Derby is a mobile web app for gamefowl breeders and cockers in the Philippines.

## Every app built in this repository must have
1. **A version number.** It is defined once in `js/version.js` (`APP_VERSION`) and repeated in `package.json`, `manifest.webmanifest` and `sw.js` (`tests/version.test.js` checks they match). Show it to users (on the More → About screen). Bump it on every release: patch for fixes, minor for features.
2. **A clear install prompt, including on iPhone.** Use the native `beforeinstallprompt` prompt on Android/Chrome, and step-by-step "Share → Add to Home Screen" instructions on iOS (Safari has no install API). Show a dismissible banner on the main screen plus a permanent "Install" entry. Hide both when the app is already installed (standalone mode). Include an `apple-touch-icon` PNG.

## Design
- Masculine, simple and organized: charcoal/steel with a blood-red accent, squared corners (≈6px), bold uppercase section labels, and grouped lists with dividers instead of loose floating cards. No pastel colors, playful fonts or soft shadows.
- Mobile first: test at phone width (Pixel 7 and iPhone SE) with no horizontal scrolling. Support light and dark mode.

## Workflow
- `npm test` runs the unit tests; `npm start` serves the app locally.
- Any new JS file must be added to the `ASSETS` list in `sw.js` so the app keeps working offline.
