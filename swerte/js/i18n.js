// Derby Swerte: English / Tagalog text. Same conventions as Derby's i18n.js.

const LANG_KEY = 'derby.lang'; // shared with Derby and Derby Keep
export const LANGS = { en: 'EN', tl: 'TL' };

const en = {
  'app.name': 'Derby Swerte',
  'nav.today': 'Today', 'nav.plan': 'Fight day', 'nav.match': 'Match', 'nav.more': 'More',
  'common.back': 'Back', 'lang.name': 'English', 'none': 'None',
  'note.guide': 'Traditional astrology for guidance only. It does not predict results: always judge the bird, its condition and the match yourself.',

  'planet.sun': 'Sun', 'planet.moon': 'Moon', 'planet.mars': 'Mars', 'planet.mercury': 'Mercury',
  'planet.jupiter': 'Jupiter', 'planet.venus': 'Venus', 'planet.saturn': 'Saturn',
  'pcolor.gold': 'gold / yellow', 'pcolor.white': 'white / silver', 'pcolor.red': 'red', 'pcolor.mixed': 'mixed / spotted',
  'pcolor.blue': 'blue', 'pcolor.copper': 'copper', 'pcolor.black': 'black',
  'phase.new': 'New moon', 'phase.waxingCrescent': 'Waxing crescent', 'phase.firstQuarter': 'First quarter',
  'phase.waxingGibbous': 'Waxing gibbous', 'phase.full': 'Full moon', 'phase.waningGibbous': 'Waning gibbous',
  'phase.lastQuarter': 'Last quarter', 'phase.waningCrescent': 'Waning crescent',
  'sign.aries': 'Aries', 'sign.taurus': 'Taurus', 'sign.gemini': 'Gemini', 'sign.cancer': 'Cancer', 'sign.leo': 'Leo',
  'sign.virgo': 'Virgo', 'sign.libra': 'Libra', 'sign.scorpio': 'Scorpio', 'sign.sagittarius': 'Sagittarius',
  'sign.capricorn': 'Capricorn', 'sign.aquarius': 'Aquarius', 'sign.pisces': 'Pisces',
  'feather.lemon': 'Lemon', 'feather.pumpkin': 'Pumpkin', 'feather.white': 'White', 'feather.talisain': 'Talisain',
  'feather.grey': 'Grey', 'feather.red': 'Red', 'feather.darkred': 'Dark Red', 'feather.brownred': 'Brown Red',
  'feather.ginger': 'Ginger', 'feather.lightred': 'Light Red', 'feather.bulik': 'Bulik', 'feather.spangled': 'Spangled',
  'feather.blue': 'Blue', 'feather.black': 'Black',
  'v.strong': 'Strong', 'v.favored': 'Favored', 'v.neutral': 'Neutral', 'v.notFavored': 'Not favored',
  'reason.hourRuler': 'Its planet, {planet}, rules this hour', 'reason.hourFriend': '{planet}, ruler of the hour, is its friend',
  'reason.hourEnemy': '{planet}, ruler of the hour, is its enemy', 'reason.dayRuler': 'Its planet, {planet}, rules the day',
  'reason.moonSign': 'The Moon is in a sign ruled by {planet}', 'reason.none': 'No planet in force favors or opposes it',

  'today.day': 'Planet of the day', 'today.now': 'Right now', 'today.hourOf': 'Hour of {planet}', 'today.until': '{from} – {to}',
  'today.dayOf': 'Day of {planet}', 'today.moon': 'Moon', 'today.moonIn': '{phase} in {sign}',
  'today.sunTimes': 'Sunrise {rise} · Sunset {set}', 'today.best': 'Favored colors now', 'today.avoid': 'Not favored now',
  'today.next': 'Coming hours', 'today.plan': 'Plan a fight day', 'today.match': 'Check a match', 'today.where': 'Location: {place}',

  'plan.title': 'Fight day', 'plan.date': 'Fight date', 'plan.myColor': 'Your cock’s color (optional)', 'plan.any': 'Any color',
  'plan.summary': '{weekday}: day of {planet}', 'plan.moon': 'Moon: {phase} in {sign}',
  'plan.day': 'Day hours (sunrise to sunset)', 'plan.night': 'Night hours (sunset to sunrise)',
  'plan.bestFor': 'Best hours for {color}', 'plan.noBest': 'No favored hours for this color on this day.', 'plan.top': 'Top colors',

  'match.title': 'Match', 'match.mine': 'Your cock’s color', 'match.theirs': 'Opponent’s color',
  'match.date': 'Fight date', 'match.time': 'Fight time', 'match.pick': 'Pick both colors to see the match.',
  'match.mineWins': 'Your cock is favored', 'match.theirsWins': 'Opponent is favored', 'match.even': 'Even match',
  'match.margin': (v) => `${v.n} point${v.n === 1 ? '' : 's'} difference`, 'match.at': 'Hour of {planet} · {from} – {to}',
  'match.points': (v) => `${v.n > 0 ? '+' : ''}${v.n} point${Math.abs(v.n) === 1 ? '' : 's'}`,
  'match.better': 'Better hours for your cock that day', 'match.noBetter': 'No hour that day gives your cock a clear edge.',

  'more.title': 'More', 'loc.title': 'Location', 'loc.hint': 'Sunrise, sunset and the planetary hours depend on where the fight is.',
  'loc.city': 'City', 'loc.useMine': 'Use my location', 'loc.mine': 'My location', 'loc.denied': 'Could not get your location.',
  'loc.saved': 'Location: {name}',
  'how.title': 'How it works',
  'how.hours': 'Each day and each night is split into 12 planetary hours, from sunrise to sunset and from sunset to the next sunrise. The first hour belongs to the planet of the day (Sunday Sun, Monday Moon, Tuesday Mars, Wednesday Mercury, Thursday Jupiter, Friday Venus, Saturday Saturn). The next hours follow the order Saturn, Jupiter, Mars, Sun, Venus, Mercury, Moon.',
  'how.points': 'A color scores +3 if its planet rules the hour, +1 if it is a friend of the hour’s planet, −2 if it is an enemy, +2 if its planet rules the day, and +1 if the Moon is in a sign its planet rules. 3 or more is Strong, 1–2 Favored, 0 Neutral, below 0 Not favored. A match needs a 2-point difference to favor one side.',
  'how.colors': 'Planet colors and feather colors', 'how.mapNote': 'The planet colors are traditional. Matching them to feather colors is Derby Swerte’s own choice.',
  'how.friends': 'Friends and enemies of each planet', 'how.friendsLbl': 'Friends', 'how.enemiesLbl': 'Enemies',
  'apps.title': 'Other apps', 'apps.derby': 'Derby: bloodlines and pedigrees', 'apps.keep': 'Derby Keep: conditioning and health',
  'install.title': 'Install app', 'install.done': '✓ Derby Swerte is installed on this device.',
  'install.hint': 'Add Derby Swerte to your home screen so it opens like a normal app and works without signal.',
  'install.ios': 'How to install on iPhone', 'install.btn': 'Install Derby Swerte',
  'about.title': 'About', 'about.app': 'App', 'about.appName': 'Derby Swerte: fight-day astrology', 'about.version': 'Version',
  'about.lang': 'Language', 'toast.updated': 'Derby Swerte updated to v{v}',

  'banner.title': 'Install Derby Swerte', 'banner.text': 'Add it to your home screen. Works offline.',
  'banner.btn': 'Install', 'banner.close': 'Hide install banner',
  'sheet.ios': 'Install on iPhone / iPad', 'sheet.android': 'Install on Android',
  'sheet.sub': 'Free. Works offline. No app store needed.', 'sheet.ok': 'Got it',
  'ios.step1': 'Tap the <b>Share</b> button {icon} {where}.', 'ios.whereSafari': 'at the bottom of Safari',
  'ios.whereOther': 'in the address bar (top right)',
  'ios.step2': 'Scroll down and tap <b>Add to Home Screen</b> {icon}.',
  'ios.step3': 'Tap <b>Add</b> (top right). Derby Swerte now opens from your home screen like any app.',
  'ios.note': 'If you don\'t see “Add to Home Screen”, open this page in Safari and try again.',
  'and.step1': 'Tap the browser menu {icon} (top right in Chrome).',
  'and.step2': 'Tap <b>Install app</b> or <b>Add to Home screen</b>.',
  'and.step3': 'Tap <b>Install</b>. Derby Swerte now opens from your home screen like any app.',
};

const tl = {
  'app.name': 'Derby Swerte',
  'nav.today': 'Ngayon', 'nav.plan': 'Araw ng laban', 'nav.match': 'Tapatan', 'nav.more': 'Iba pa',
  'common.back': 'Bumalik', 'lang.name': 'Tagalog', 'none': 'Wala',
  'note.guide': 'Tradisyonal na astrolohiya, gabay lang. Hindi nito hinuhulaan ang resulta: ikaw pa rin ang huhusga sa manok, sa kondisyon nito at sa tapatan.',

  'planet.sun': 'Araw', 'planet.moon': 'Buwan', 'planet.mars': 'Marte', 'planet.mercury': 'Merkuryo',
  'planet.jupiter': 'Hupiter', 'planet.venus': 'Benus', 'planet.saturn': 'Saturno',
  'pcolor.gold': 'ginto / dilaw', 'pcolor.white': 'puti / pilak', 'pcolor.red': 'pula', 'pcolor.mixed': 'halo / batik',
  'pcolor.blue': 'asul', 'pcolor.copper': 'tanso', 'pcolor.black': 'itim',
  'phase.new': 'Bagong buwan', 'phase.waxingCrescent': 'Lumalaking gasuklay', 'phase.firstQuarter': 'Unang kwarter',
  'phase.waxingGibbous': 'Lumalaking buwan', 'phase.full': 'Kabilugan ng buwan', 'phase.waningGibbous': 'Lumiliit na buwan',
  'phase.lastQuarter': 'Huling kwarter', 'phase.waningCrescent': 'Lumiliit na gasuklay',
  'sign.aries': 'Aries', 'sign.taurus': 'Taurus', 'sign.gemini': 'Gemini', 'sign.cancer': 'Cancer', 'sign.leo': 'Leo',
  'sign.virgo': 'Virgo', 'sign.libra': 'Libra', 'sign.scorpio': 'Scorpio', 'sign.sagittarius': 'Sagittarius',
  'sign.capricorn': 'Capricorn', 'sign.aquarius': 'Aquarius', 'sign.pisces': 'Pisces',
  'feather.lemon': 'Lemon', 'feather.pumpkin': 'Pumpkin', 'feather.white': 'Puti', 'feather.talisain': 'Talisain',
  'feather.grey': 'Abuhin', 'feather.red': 'Pula', 'feather.darkred': 'Dark Red', 'feather.brownred': 'Brown Red',
  'feather.ginger': 'Ginger', 'feather.lightred': 'Light Red', 'feather.bulik': 'Bulik', 'feather.spangled': 'Batik-batik',
  'feather.blue': 'Blue', 'feather.black': 'Itim',
  'v.strong': 'Malakas', 'v.favored': 'Paborable', 'v.neutral': 'Neutral', 'v.notFavored': 'Hindi paborable',
  'reason.hourRuler': 'Ang planeta nito, {planet}, ang may-ari ng oras na ito', 'reason.hourFriend': 'Kaibigan nito si {planet}, may-ari ng oras',
  'reason.hourEnemy': 'Kaaway nito si {planet}, may-ari ng oras', 'reason.dayRuler': 'Ang planeta nito, {planet}, ang may-ari ng araw',
  'reason.moonSign': 'Nasa sign na pag-aari ni {planet} ang Buwan', 'reason.none': 'Walang planetang pumapabor o kumokontra',

  'today.day': 'Planeta ng araw', 'today.now': 'Ngayon mismo', 'today.hourOf': 'Oras ni {planet}', 'today.until': '{from} – {to}',
  'today.dayOf': 'Araw ni {planet}', 'today.moon': 'Buwan', 'today.moonIn': '{phase} sa {sign}',
  'today.sunTimes': 'Pagsikat {rise} · Paglubog {set}', 'today.best': 'Paborableng kulay ngayon', 'today.avoid': 'Hindi paborable ngayon',
  'today.next': 'Mga susunod na oras', 'today.plan': 'Planuhin ang araw ng laban', 'today.match': 'Tingnan ang tapatan', 'today.where': 'Lugar: {place}',

  'plan.title': 'Araw ng laban', 'plan.date': 'Petsa ng laban', 'plan.myColor': 'Kulay ng manok mo (opsyonal)', 'plan.any': 'Kahit anong kulay',
  'plan.summary': '{weekday}: araw ni {planet}', 'plan.moon': 'Buwan: {phase} sa {sign}',
  'plan.day': 'Mga oras sa araw (pagsikat hanggang paglubog)', 'plan.night': 'Mga oras sa gabi (paglubog hanggang pagsikat)',
  'plan.bestFor': 'Pinakamagandang oras para sa {color}', 'plan.noBest': 'Walang paborableng oras para sa kulay na ito sa araw na ito.', 'plan.top': 'Nangungunang kulay',

  'match.title': 'Tapatan', 'match.mine': 'Kulay ng manok mo', 'match.theirs': 'Kulay ng kalaban',
  'match.date': 'Petsa ng laban', 'match.time': 'Oras ng laban', 'match.pick': 'Pumili ng dalawang kulay para makita ang tapatan.',
  'match.mineWins': 'Paborable ang manok mo', 'match.theirsWins': 'Paborable ang kalaban', 'match.even': 'Patas ang tapatan',
  'match.margin': (v) => `${v.n} puntos na agwat`, 'match.at': 'Oras ni {planet} · {from} – {to}',
  'match.points': (v) => `${v.n > 0 ? '+' : ''}${v.n} puntos`,
  'match.better': 'Mas magandang oras para sa manok mo sa araw na iyon', 'match.noBetter': 'Walang oras sa araw na iyon na malinaw na pabor sa manok mo.',

  'more.title': 'Iba pa', 'loc.title': 'Lugar', 'loc.hint': 'Nakadepende sa lugar ng laban ang pagsikat, paglubog at ang mga oras ng planeta.',
  'loc.city': 'Lungsod', 'loc.useMine': 'Gamitin ang lokasyon ko', 'loc.mine': 'Lokasyon ko', 'loc.denied': 'Hindi makuha ang lokasyon mo.',
  'loc.saved': 'Lugar: {name}',
  'how.title': 'Paano ito gumagana',
  'how.hours': 'Hinahati ang bawat araw at bawat gabi sa 12 oras ng planeta, mula pagsikat hanggang paglubog at mula paglubog hanggang sa susunod na pagsikat. Ang unang oras ay sa planeta ng araw (Linggo Araw, Lunes Buwan, Martes Marte, Miyerkules Merkuryo, Huwebes Hupiter, Biyernes Benus, Sabado Saturno). Ang mga kasunod na oras ay sumusunod sa ayos na Saturno, Hupiter, Marte, Araw, Benus, Merkuryo, Buwan.',
  'how.points': 'Ang kulay ay may +3 kung ang planeta nito ang may-ari ng oras, +1 kung kaibigan ng planeta ng oras, −2 kung kaaway, +2 kung ang planeta nito ang may-ari ng araw, at +1 kung nasa sign na pag-aari ng planeta nito ang Buwan. 3 pataas ay Malakas, 1–2 Paborable, 0 Neutral, mas mababa sa 0 Hindi paborable. Kailangan ng 2 puntos na agwat para pumabor sa isang panig ang tapatan.',
  'how.colors': 'Kulay ng planeta at kulay ng balahibo', 'how.mapNote': 'Tradisyonal ang kulay ng mga planeta. Ang pagtutugma nito sa kulay ng balahibo ay sariling pili ng Derby Swerte.',
  'how.friends': 'Mga kaibigan at kaaway ng bawat planeta', 'how.friendsLbl': 'Kaibigan', 'how.enemiesLbl': 'Kaaway',
  'apps.title': 'Iba pang app', 'apps.derby': 'Derby: bloodline at pedigree', 'apps.keep': 'Derby Keep: kondisyon at kalusugan',
  'install.title': 'I-install ang app', 'install.done': '✓ Naka-install na ang Derby Swerte sa device na ito.',
  'install.hint': 'Idagdag ang Derby Swerte sa home screen para bumukas ito na parang karaniwang app at gumana kahit walang signal.',
  'install.ios': 'Paano i-install sa iPhone', 'install.btn': 'I-install ang Derby Swerte',
  'about.title': 'Tungkol sa app', 'about.app': 'App', 'about.appName': 'Derby Swerte: astrolohiya para sa araw ng laban', 'about.version': 'Bersyon',
  'about.lang': 'Wika', 'toast.updated': 'Na-update ang Derby Swerte sa v{v}',

  'banner.title': 'I-install ang Derby Swerte', 'banner.text': 'Idagdag sa home screen. Gumagana kahit offline.',
  'banner.btn': 'I-install', 'banner.close': 'Itago ang install banner',
  'sheet.ios': 'I-install sa iPhone / iPad', 'sheet.android': 'I-install sa Android',
  'sheet.sub': 'Libre. Gumagana offline. Hindi kailangan ng app store.', 'sheet.ok': 'Sige',
  'ios.step1': 'Pindutin ang <b>Share</b> button {icon} {where}.', 'ios.whereSafari': 'sa ibaba ng Safari',
  'ios.whereOther': 'sa address bar (kanang itaas)',
  'ios.step2': 'Mag-scroll pababa at pindutin ang <b>Add to Home Screen</b> {icon}.',
  'ios.step3': 'Pindutin ang <b>Add</b> (kanang itaas). Bubuksan na ang Derby Swerte mula sa home screen na parang karaniwang app.',
  'ios.note': 'Kung walang “Add to Home Screen”, buksan ang page na ito sa Safari at subukan ulit.',
  'and.step1': 'Pindutin ang menu ng browser {icon} (kanang itaas sa Chrome).',
  'and.step2': 'Pindutin ang <b>Install app</b> o <b>Add to Home screen</b>.',
  'and.step3': 'Pindutin ang <b>Install</b>. Bubuksan na ang Derby Swerte mula sa home screen na parang karaniwang app.',
};

export const DICTS = { en, tl };

function detect() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && DICTS[saved]) return saved;
  } catch { /* storage blocked */ }
  const nav = (globalThis.navigator?.languages || [globalThis.navigator?.language || 'en']).join(',').toLowerCase();
  return /(^|,)(fil|tl)\b/.test(nav) ? 'tl' : 'en';
}

let current = globalThis.localStorage ? detect() : 'en';

export const getLang = () => current;

export function setLang(lang) {
  if (!DICTS[lang]) return;
  current = lang;
  try { localStorage.setItem(LANG_KEY, lang); } catch { /* storage blocked */ }
}

export const locale = () => (current === 'tl' ? 'fil-PH' : 'en-PH');

export function t(key, vars = {}) {
  const v = DICTS[current][key] ?? en[key];
  if (v === undefined) return key;
  if (typeof v === 'function') return v(vars);
  return v.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}
