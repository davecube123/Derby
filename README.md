# Derby

**Version 0.5.1** (shown in the app under More → About)

Bloodline and pedigree records for gamefowl breeders and cockers in the Philippines.
Derby is a mobile web app that installs on a phone like a normal app and keeps working without signal at the farm.

## What it does

- **Bird records**: name, wingband, legband, sex (cock, stag, hen, pullet), hatch date and age, status, feather color, leg color, comb, breeder or source, notes and a photo.
- **Bloodline**: enter the blood of foundation birds (e.g. ½ Sweater, ¼ Kelso, ¼ Hatch). For offspring, Derby calculates the blood from the sire and dam, down through every generation.
- **Pedigree**: three generations (parents, grandparents, great-grandparents). Tap any ancestor to open it. Each bird also lists its offspring.
- **Inbreeding %**: Wright's coefficient, calculated from every recorded ancestor (full siblings = 25%, half siblings = 12.5%, and so on).
- **Test mating**: pick a cock and a hen to see the offspring's bloodline, inbreeding % and shared ancestors before you breed them.
- **Bloodlines**: common Philippine lines are included. You can add your own and see how many birds carry each line.
- **Derby Keep** (separate app, see below) handles conditioning and health; Derby links to it under More.
- **English / Tagalog** switch in the top bar.
- **Install prompt**: a banner and a More → Install entry. Android uses the browser's install prompt; iPhone shows step-by-step Share → Add to Home Screen instructions.
- **Backup and sharing** (More tab): save a backup file, restore it, or share one bird's pedigree with a friend over Messenger, Viber or email. Your friend imports it into their own Derby.

## Privacy

All records stay on the phone that entered them (in the browser's IndexedDB storage). Nothing is uploaded to a server. Make backups regularly, because clearing browser data deletes the records.

## Running it locally

No build step is needed. Serve the folder:

```sh
npm start        # serves on http://localhost:8080
npm test         # runs the bloodline / inbreeding unit tests
```

## Putting it online for friends

Any static host works. With GitHub Pages: merge into `main`, then go to **Settings → Pages → Deploy from a branch → `main` / `(root)`**. The app is served at https://davecube123.github.io/Derby/.
Friends open the link on their phone and use **Add to Home Screen** (Chrome: menu ⋮ → Install app; iPhone Safari: Share → Add to Home Screen).

## Project layout

| Path | Purpose |
| --- | --- |
| `index.html`, `css/styles.css` | App shell and styles (light and dark mode) |
| `js/app.js` | Screens, routing, forms, import/export |
| `js/genetics.js` | Bloodline and inbreeding math (pure functions, unit tested) |
| `js/db.js` | On-device storage (IndexedDB) |
| `js/version.js` | App version (keep in sync with `package.json`, `manifest.webmanifest`, `sw.js`) |
| `js/install.js` | Install banner and Android/iPhone install instructions |
| `js/i18n.js` | English and Tagalog text |
| `js/constants.js` | Sexes, statuses, preset bloodlines, colors |
| `sw.js`, `manifest.webmanifest` | Offline support and install-to-home-screen |
| `tests/` | Node unit tests |

## Derby Keep (`keep/`)

**Version 0.1.0.** A separate app for daily conditioning, at https://davecube123.github.io/Derby/keep/. It installs with its own icon, has its own data and has no pedigrees.

- **Today:** active keeps (day count to the derby, weight against the target), vaccines and deworming due or overdue (tap to log the next dose), and recent logs.
- **Birds:** a simple list (name, bands, sex, bloodline). You can add birds by hand or import them from a Derby backup or Share pedigree file, picking which ones (cocks and stags are ticked).
- **Keeps:** a derby date and target weight, plus a weight chart with the target line.
- **Logs:** weight (kg or grams), feeding, exercise, sparring (1–5), vitamins, vaccine, deworming and health.
- **Shared with Derby:** the design (`css/styles.css`), the bloodline math (`js/genetics.js`) for imports, the rooster logo, and the language setting.

| Path | Purpose |
| --- | --- |
| `keep/index.html`, `keep/css/keep.css` | App shell and keep-specific styles |
| `keep/js/app.js` | Screens, forms, import/export |
| `keep/js/conditioning.js` | Log types, weights, day counts, due reminders (unit tested) |
| `keep/js/chart.js` | Weight chart (SVG) with tap/hover tooltip |
| `keep/js/derby-import.js` | Reads Derby files into Derby Keep birds (unit tested) |
| `keep/js/db.js` | Its own on-device database (`derby-keep`) |
| `keep/js/i18n.js`, `keep/js/install.js`, `keep/js/version.js` | Text, install prompt, version |
| `keep/sw.js`, `keep/manifest.webmanifest` | Offline support and install, scoped to `/keep/` |

## Derby Swerte (`swerte/`)

**Version 0.1.0.** Fight-day astrology, at https://davecube123.github.io/Derby/swerte/. It is for guidance only and the app says so on every screen.

- **Today:** the planetary hour in force now, the planet of the day, moon phase and sign, sunrise and sunset, colors that are favored or not favored now, and the coming hours.
- **Fight day:** all 24 planetary hours for a date. Pick your cock's color to see its verdict each hour and its best hours.
- **Match:** your cock's color against the opponent's at a date and time, with the points and reasons for each side, plus better hours that day.
- **More:** location (20 Philippine cities or the phone's GPS), how it works (the full planet → feather color table and the friendship table), install, and links to Derby and Derby Keep.

The rules are set out in `swerte/js/rules.js` and the astronomy in `swerte/js/astro.js`. Both are unit tested against published sunrise and sunset times and known moon phases and signs. The app has no database: the only things saved are the chosen city and language, in the browser.
