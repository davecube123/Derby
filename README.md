# Derby

**Version 0.2.1** (shown in the app under More → About)

Bloodline and pedigree records for gamefowl breeders and cockers in the Philippines.
Derby is a mobile web app that installs on a phone like a normal app and keeps working without signal at the farm.

## What it does

- **Bird records**: name, wingband, legband, sex (cock, stag, hen, pullet), hatch date and age, status, feather color, leg color, comb, breeder or source, notes and a photo.
- **Bloodline**: enter the blood of foundation birds (e.g. ½ Sweater, ¼ Kelso, ¼ Hatch). For offspring, Derby calculates the blood from the sire and dam, down through every generation.
- **Pedigree**: three generations (parents, grandparents, great-grandparents). Tap any ancestor to open it. Each bird also lists its offspring.
- **Inbreeding %**: Wright's coefficient, calculated from every recorded ancestor (full siblings = 25%, half siblings = 12.5%, and so on).
- **Test mating**: pick a cock and a hen to see the offspring's bloodline, inbreeding % and shared ancestors before you breed them.
- **Bloodlines**: common Philippine lines are included. You can add your own and see how many birds carry each line.
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
| `js/constants.js` | Sexes, statuses, preset bloodlines, colors |
| `sw.js`, `manifest.webmanifest` | Offline support and install-to-home-screen |
| `tests/` | Node unit tests |
