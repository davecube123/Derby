// Derby Keep: English / Tagalog text. Same rules as Derby's i18n.js:
// strings with {placeholders} or functions for plurals; callers escape user data.

const LANG_KEY = 'derby.lang'; // shared with Derby so both apps open in the same language
export const LANGS = { en: 'EN', tl: 'TL' };

const plural = (n, one, many) => (n === 1 ? one : many);

const en = {
  'app.name': 'Derby Keep',
  'nav.today': 'Today', 'nav.birds': 'Birds', 'nav.more': 'More',
  'common.back': 'Back', 'lang.name': 'English', 'lang.deferred': 'Language will change when you leave this form.',
  'notFound.title': 'Not found', 'notFound.text': 'That page was not found. It may have been deleted.', 'notFound.back': 'Back to today',

  'sex.cock': 'Cock', 'sex.stag': 'Stag', 'sex.hen': 'Hen', 'sex.pullet': 'Pullet',
  'status.active': 'Active', 'status.sold': 'Sold', 'status.deceased': 'Deceased',

  'welcome.title': 'Welcome to Derby Keep',
  'welcome.intro': 'Daily conditioning for your fighting cocks: keeps, weights, feeding, exercise, sparring, vitamins, vaccines and health.',
  'welcome.step1': 'Add your birds, or bring them in from a <strong>Derby</strong> file.',
  'welcome.step2': 'Start a <strong>keep</strong> with the derby date and target weight.',
  'welcome.step3': 'Log every day. Derby Keep counts the days and tracks the weight against the target.',
  'welcome.add': 'Add a bird', 'welcome.import': 'Import birds from Derby', 'welcome.sample': 'Try it with sample data',
  'welcome.privacy': 'Your records stay on this phone. Use More → Backup to save a copy.',

  'type.weight': 'Weight', 'type.feed': 'Feeding', 'type.exercise': 'Exercise', 'type.sparring': 'Sparring',
  'type.vitamins': 'Vitamins', 'type.vaccine': 'Vaccine', 'type.deworm': 'Deworming', 'type.health': 'Health',

  'today.title': 'Today', 'keep.active': 'Active keeps',
  'keep.noneActive': 'No active keep. Start one when you prepare a bird for a derby.',
  'keep.start': 'Start a keep', 'keep.due': 'Vaccines & deworming due', 'keep.noneDue': 'Nothing due in the next 2 weeks.',
  'keep.recent': 'Recent logs', 'keep.noLogs': 'No logs yet. Tap + to log weight, feeding, exercise or health.',
  'keep.addLog': 'Add log', 'keep.pastTitle': 'Finished keeps',
  'due.overdue': (v) => `Overdue ${v.n} ${plural(v.n, 'day', 'days')}`, 'due.today': 'Due today',
  'due.in': (v) => `In ${v.n} ${plural(v.n, 'day', 'days')}`,
  'keep.day': 'Day {day} of {total}', 'keep.dayOnly': 'Day {day}',
  'keep.left': (v) => `${v.n} ${plural(v.n, 'day', 'days')} to the derby`, 'keep.fightDay': 'Derby day!',
  'keep.past': 'Derby date has passed', 'keep.notStarted': 'Starts {date}', 'keep.done': 'Finished',
  'keep.weightNow': 'Current weight', 'keep.target': 'Target',
  'keep.diffOver': '{kg} over target', 'keep.diffUnder': '{kg} under target', 'keep.onTarget': 'On target',
  'keep.weightChart': 'Weight', 'keep.chartNeed': 'Log at least 2 weights to see the chart.',
  'keep.chartLabel': 'Weight chart for {name}', 'keep.targetLine': 'Target {kg}',
  'keep.logsInKeep': 'Logs during this keep', 'keep.logWeight': '+ Weight', 'keep.noLogsInKeep': 'Nothing logged during this keep yet.',
  'keep.finish': 'Finish keep', 'keep.reopen': 'Reopen keep', 'keep.delete': 'Delete keep',
  'keep.deleteConfirm': 'Delete this keep? Its logs stay with the bird.', 'keep.deleted': 'Keep deleted',
  'keep.finished': 'Keep finished', 'keep.reopened': 'Keep reopened', 'keep.saved': 'Keep saved',
  'keep.new': 'New keep', 'keep.edit': 'Edit keep', 'keep.defaultName': 'Derby keep',
  'kf.bird': 'Bird', 'kf.choose': 'Choose…', 'kf.name': 'Keep name', 'kf.namePh': 'e.g. 5-cock derby, Dec 14',
  'kf.start': 'Start date', 'kf.fight': 'Derby / fight date', 'kf.target': 'Target weight (kg)', 'kf.targetPh': 'e.g. 2.10',
  'kf.errBird': 'Choose the bird.', 'kf.errStart': 'Set the start date.',
  'kf.errFight': 'The derby date must be on or after the start date.', 'kf.errTarget': 'Target weight should be like 2.10 (kg).',

  'log.new': 'Add log', 'log.edit': 'Edit log', 'log.type': 'What are you logging?',
  'lf.date': 'Date', 'lf.weight': 'Weight (kg)', 'lf.weightPh': 'e.g. 2.15 or 2150 g', 'lf.feed': 'Feed', 'lf.amount': 'Amount',
  'lf.amountPh': 'e.g. 80 g, 2 scoops', 'lf.activity': 'Activity', 'lf.minutes': 'Minutes', 'lf.partner': 'Sparring partner',
  'lf.rating': 'Performance (1–5)', 'lf.product': 'Product', 'lf.dose': 'Dose', 'lf.nextDue': 'Next dose due',
  'lf.issue': 'Problem / sign', 'lf.treatment': 'Treatment', 'lf.notes': 'Notes',
  'log.errBird': 'Choose the bird.', 'log.errType': 'Choose what you are logging.', 'log.errDate': 'Set the date.',
  'log.errWeight': 'Enter the weight like 2.15 (kg) or 2150 (grams).', 'log.errRequired': 'Fill in: {field}',
  'log.saved': 'Log saved', 'log.deleted': 'Log deleted', 'log.deleteConfirm': 'Delete this log?',
  'log.min': '{n} min', 'log.next': 'next {date}', 'log.vs': 'vs {name}',

  'birds.title': 'Birds', 'birds.search': 'Search name, band, bloodline…', 'birds.searchAria': 'Search birds',
  'birds.count': (v) => `${v.n} ${plural(v.n, 'bird', 'birds')}`, 'birds.none': 'No birds match.', 'birds.add': 'Add bird',
  'birds.empty': 'No birds yet. Add one, or import them from a Derby file under More.',
  'bird.latestWeight': 'Latest weight', 'bird.keep': 'Keep', 'bird.startKeep': 'Start keep', 'bird.allLogs': 'Logs',
  'bird.edit': 'Edit bird', 'bird.delete': 'Delete bird', 'bird.noLogs': 'Nothing logged yet.',
  'bird.filterAll': 'All types', 'bird.filterAria': 'Filter by type', 'bird.filterEmpty': 'No logs of this type yet.',
  'bird.deleteConfirm': (v) => `Delete ${v.name}? Its ${v.n} ${plural(v.n, 'log', 'logs')} and keeps will also be deleted.`,
  'bird.deleted': 'Bird deleted', 'bird.fromDerby': 'From Derby',
  'bf.add': 'Add bird', 'bf.edit': 'Edit {name}', 'bf.name': 'Name', 'bf.namePh': 'e.g. Red Sweater #12',
  'bf.wingband': 'Wingband', 'bf.legband': 'Legband', 'bf.sex': 'Sex', 'bf.status': 'Status',
  'bf.bloodline': 'Bloodline', 'bf.bloodlinePh': 'e.g. ½ Sweater · ½ Kelso', 'bf.notes': 'Notes',
  'bf.errIdentity': 'Give the bird a name, wingband or legband.', 'bf.errSex': 'Choose the sex.',
  'bf.saved': 'Bird saved',

  'btn.save': 'Save', 'btn.cancel': 'Cancel', 'btn.delete': 'Delete',

  'more.title': 'More', 'install.title': 'Install app', 'install.done': '✓ Derby Keep is installed on this device.',
  'install.hint': 'Add Derby Keep to your home screen so it opens like a normal app and works without signal.',
  'install.ios': 'How to install on iPhone', 'install.btn': 'Install Derby Keep',
  'derby.title': 'Derby app', 'derby.text': 'Bloodlines, pedigrees and test matings are in the Derby app.',
  'derby.open': 'Open Derby',
  'import.title': 'Import birds from Derby',
  'import.text': 'In Derby, save a backup (More → Backup) or share a bird\'s pedigree, then open that file here. You pick which birds to bring in.',
  'import.open': 'Open Derby file…', 'import.pickTitle': 'Pick birds to import',
  'import.pickHint': 'Cocks and stags are ticked. Birds you already have are updated.',
  'import.selected': (v) => `Import ${v.n} ${plural(v.n, 'bird', 'birds')}`, 'import.cancel': 'Cancel',
  'import.done': (v) => `Imported ${v.birds} ${plural(v.birds, 'bird', 'birds')}, ${v.logs} ${plural(v.logs, 'log', 'logs')}, ${v.keeps} ${plural(v.keeps, 'keep', 'keeps')}`,
  'import.bad': 'That file is not a Derby or Derby Keep backup', 'import.none': 'No birds in that file.',
  'backup.title': 'Backup',
  'backup.text': (v) => `${v.birds} ${plural(v.birds, 'bird', 'birds')} and ${v.logs} ${plural(v.logs, 'log', 'logs')} saved on this phone. Nothing is uploaded, so make a backup regularly.`,
  'backup.save': 'Save backup file', 'restore.title': 'Restore backup',
  'restore.text': 'Open a Derby Keep backup. Records you already have are only replaced if the file\'s copy is newer.',
  'restore.open': 'Open backup…',
  'danger.title': 'Danger zone', 'danger.wipe': 'Delete all Derby Keep data on this phone',
  'wipe.none': 'Nothing to delete', 'wipe.confirm': 'Delete all birds, keeps and logs in Derby Keep on this phone? Save a backup first if you may need them.',
  'wipe.type': 'Type DELETE to confirm', 'wipe.cancelled': 'Nothing was deleted', 'wipe.done': 'All Derby Keep data deleted',
  'file.saved': 'Saved {f}',
  'about.title': 'About', 'about.app': 'App', 'about.appName': 'Derby Keep: conditioning & health',
  'about.version': 'Version', 'about.lang': 'Language',
  'toast.updated': 'Derby Keep updated to v{v}', 'toast.sample': 'Sample data added. Delete it any time.',
  'storage.error': 'Derby Keep could not open its storage. Private/incognito browsing may block it.',

  'banner.title': 'Install Derby Keep', 'banner.text': 'Add it to your home screen. Works offline.',
  'banner.btn': 'Install', 'banner.close': 'Hide install banner',
  'sheet.ios': 'Install on iPhone / iPad', 'sheet.android': 'Install on Android',
  'sheet.sub': 'Free. Works offline. No app store needed.', 'sheet.ok': 'Got it',
  'ios.step1': 'Tap the <b>Share</b> button {icon} {where}.', 'ios.whereSafari': 'at the bottom of Safari',
  'ios.whereOther': 'in the address bar (top right)',
  'ios.step2': 'Scroll down and tap <b>Add to Home Screen</b> {icon}.',
  'ios.step3': 'Tap <b>Add</b> (top right). Derby Keep now opens from your home screen like any app.',
  'ios.note': 'If you don\'t see “Add to Home Screen”, open this page in Safari and try again.',
  'and.step1': 'Tap the browser menu {icon} (top right in Chrome).',
  'and.step2': 'Tap <b>Install app</b> or <b>Add to Home screen</b>.',
  'and.step3': 'Tap <b>Install</b>. Derby Keep now opens from your home screen like any app.',
};

const tl = {
  'app.name': 'Derby Keep',
  'nav.today': 'Ngayon', 'nav.birds': 'Manok', 'nav.more': 'Iba pa',
  'common.back': 'Bumalik', 'lang.name': 'Tagalog', 'lang.deferred': 'Magbabago ang wika paglabas mo sa form na ito.',
  'notFound.title': 'Hindi makita', 'notFound.text': 'Hindi makita ang page na iyan. Baka nabura na.', 'notFound.back': 'Bumalik sa ngayon',

  'sex.cock': 'Tandang', 'sex.stag': 'Stag', 'sex.hen': 'Inahin', 'sex.pullet': 'Dumalaga',
  'status.active': 'Aktibo', 'status.sold': 'Naibenta', 'status.deceased': 'Patay na',

  'welcome.title': 'Maligayang pagdating sa Derby Keep',
  'welcome.intro': 'Araw-araw na kondisyon ng iyong mga panabong: keep, timbang, pakain, ehersisyo, sparring, bitamina, bakuna at kalusugan.',
  'welcome.step1': 'Idagdag ang iyong mga manok, o kunin sila mula sa <strong>Derby</strong> file.',
  'welcome.step2': 'Magsimula ng <strong>keep</strong> na may petsa ng derby at target na timbang.',
  'welcome.step3': 'Mag-log araw-araw. Ang Derby Keep ang bibilang ng araw at magbabantay ng timbang laban sa target.',
  'welcome.add': 'Magdagdag ng manok', 'welcome.import': 'Kunin ang manok mula sa Derby', 'welcome.sample': 'Subukan gamit ang sample',
  'welcome.privacy': 'Nasa phone mo lang ang iyong records. Pumunta sa Iba pa → Backup para mag-save ng kopya.',

  'type.weight': 'Timbang', 'type.feed': 'Pakain', 'type.exercise': 'Ehersisyo', 'type.sparring': 'Sparring',
  'type.vitamins': 'Bitamina', 'type.vaccine': 'Bakuna', 'type.deworm': 'Purga', 'type.health': 'Kalusugan',

  'today.title': 'Ngayon', 'keep.active': 'Mga aktibong keep',
  'keep.noneActive': 'Walang aktibong keep. Magsimula kapag inihahanda mo ang manok para sa derby.',
  'keep.start': 'Bagong keep', 'keep.due': 'Bakuna at purga na malapit na', 'keep.noneDue': 'Walang kailangan sa susunod na 2 linggo.',
  'keep.recent': 'Mga bagong log', 'keep.noLogs': 'Wala pang log. Pindutin ang + para mag-log ng timbang, pakain, ehersisyo o kalusugan.',
  'keep.addLog': 'Mag-log', 'keep.pastTitle': 'Mga natapos na keep',
  'due.overdue': (v) => `Lampas na ng ${v.n} araw`, 'due.today': 'Ngayong araw',
  'due.in': (v) => `Sa loob ng ${v.n} araw`,
  'keep.day': 'Araw {day} ng {total}', 'keep.dayOnly': 'Araw {day}',
  'keep.left': (v) => `${v.n} araw bago ang derby`, 'keep.fightDay': 'Araw na ng derby!',
  'keep.past': 'Lumipas na ang petsa ng derby', 'keep.notStarted': 'Magsisimula sa {date}', 'keep.done': 'Tapos na',
  'keep.weightNow': 'Kasalukuyang timbang', 'keep.target': 'Target',
  'keep.diffOver': '{kg} lampas sa target', 'keep.diffUnder': '{kg} kulang sa target', 'keep.onTarget': 'Tama sa target',
  'keep.weightChart': 'Timbang', 'keep.chartNeed': 'Mag-log ng kahit 2 timbang para makita ang chart.',
  'keep.chartLabel': 'Chart ng timbang ni {name}', 'keep.targetLine': 'Target {kg}',
  'keep.logsInKeep': 'Mga log sa keep na ito', 'keep.logWeight': '+ Timbang', 'keep.noLogsInKeep': 'Wala pang log sa keep na ito.',
  'keep.finish': 'Tapusin', 'keep.reopen': 'Buksan ulit', 'keep.delete': 'Burahin ang keep',
  'keep.deleteConfirm': 'Burahin ang keep na ito? Mananatili ang mga log sa manok.', 'keep.deleted': 'Nabura ang keep',
  'keep.finished': 'Natapos ang keep', 'keep.reopened': 'Binuksan ulit ang keep', 'keep.saved': 'Na-save ang keep',
  'keep.new': 'Bagong keep', 'keep.edit': 'I-edit ang keep', 'keep.defaultName': 'Derby keep',
  'kf.bird': 'Manok', 'kf.choose': 'Pumili…', 'kf.name': 'Pangalan ng keep', 'kf.namePh': 'hal. 5-cock derby, Dis 14',
  'kf.start': 'Simula', 'kf.fight': 'Petsa ng derby / laban', 'kf.target': 'Target na timbang (kg)', 'kf.targetPh': 'hal. 2.10',
  'kf.errBird': 'Piliin ang manok.', 'kf.errStart': 'Ilagay ang petsa ng simula.',
  'kf.errFight': 'Dapat kapareho o pagkatapos ng simula ang petsa ng derby.', 'kf.errTarget': 'Dapat gaya ng 2.10 (kg) ang target na timbang.',

  'log.new': 'Mag-log', 'log.edit': 'I-edit ang log', 'log.type': 'Ano ang ilo-log mo?',
  'lf.date': 'Petsa', 'lf.weight': 'Timbang (kg)', 'lf.weightPh': 'hal. 2.15 o 2150 g', 'lf.feed': 'Pakain', 'lf.amount': 'Dami',
  'lf.amountPh': 'hal. 80 g, 2 takal', 'lf.activity': 'Ehersisyo', 'lf.minutes': 'Minuto', 'lf.partner': 'Kalaban sa sparring',
  'lf.rating': 'Galing (1–5)', 'lf.product': 'Produkto', 'lf.dose': 'Dosis', 'lf.nextDue': 'Susunod na dosis',
  'lf.issue': 'Problema / sintomas', 'lf.treatment': 'Lunas / gamot', 'lf.notes': 'Tala',
  'log.errBird': 'Piliin ang manok.', 'log.errType': 'Piliin kung ano ang ilo-log.', 'log.errDate': 'Ilagay ang petsa.',
  'log.errWeight': 'Ilagay ang timbang gaya ng 2.15 (kg) o 2150 (gramo).', 'log.errRequired': 'Punan ang: {field}',
  'log.saved': 'Na-save ang log', 'log.deleted': 'Nabura ang log', 'log.deleteConfirm': 'Burahin ang log na ito?',
  'log.min': '{n} min', 'log.next': 'susunod: {date}', 'log.vs': 'kalaban: {name}',

  'birds.title': 'Mga manok', 'birds.search': 'Hanapin: pangalan, band, bloodline…', 'birds.searchAria': 'Hanapin ang manok',
  'birds.count': (v) => `${v.n} manok`, 'birds.none': 'Walang tugmang manok.', 'birds.add': 'Magdagdag ng manok',
  'birds.empty': 'Wala pang manok. Magdagdag, o kunin sila mula sa Derby file sa Iba pa.',
  'bird.latestWeight': 'Huling timbang', 'bird.keep': 'Keep', 'bird.startKeep': 'Mag-keep', 'bird.allLogs': 'Mga log',
  'bird.edit': 'I-edit ang manok', 'bird.delete': 'Burahin ang manok', 'bird.noLogs': 'Wala pang naitala.',
  'bird.filterAll': 'Lahat ng uri', 'bird.filterAria': 'Salain ayon sa uri', 'bird.filterEmpty': 'Wala pang log na ganitong uri.',
  'bird.deleteConfirm': (v) => `Burahin si ${v.name}? Mabubura rin ang ${v.n} log at mga keep nito.`,
  'bird.deleted': 'Nabura ang manok', 'bird.fromDerby': 'Mula sa Derby',
  'bf.add': 'Magdagdag ng manok', 'bf.edit': 'I-edit si {name}', 'bf.name': 'Pangalan', 'bf.namePh': 'hal. Red Sweater #12',
  'bf.wingband': 'Wingband', 'bf.legband': 'Legband', 'bf.sex': 'Kasarian', 'bf.status': 'Status',
  'bf.bloodline': 'Bloodline', 'bf.bloodlinePh': 'hal. ½ Sweater · ½ Kelso', 'bf.notes': 'Tala',
  'bf.errIdentity': 'Lagyan ng pangalan, wingband o legband ang manok.', 'bf.errSex': 'Piliin ang kasarian.',
  'bf.saved': 'Na-save ang manok',

  'btn.save': 'I-save', 'btn.cancel': 'Kanselahin', 'btn.delete': 'Burahin',

  'more.title': 'Iba pa', 'install.title': 'I-install ang app', 'install.done': '✓ Naka-install na ang Derby Keep sa device na ito.',
  'install.hint': 'Idagdag ang Derby Keep sa home screen para bumukas ito na parang karaniwang app at gumana kahit walang signal.',
  'install.ios': 'Paano i-install sa iPhone', 'install.btn': 'I-install ang Derby Keep',
  'derby.title': 'Derby app', 'derby.text': 'Nasa Derby app ang bloodline, pedigree at pagsubok ng pares.',
  'derby.open': 'Buksan ang Derby',
  'import.title': 'Kunin ang manok mula sa Derby',
  'import.text': 'Sa Derby, mag-save ng backup (Iba pa → Backup) o ibahagi ang pedigree ng manok, saka buksan ang file dito. Ikaw ang pipili kung aling manok ang kukunin.',
  'import.open': 'Buksan ang Derby file…', 'import.pickTitle': 'Piliin ang manok na kukunin',
  'import.pickHint': 'Naka-tsek ang mga tandang at stag. Ia-update ang mga manok na mayroon ka na.',
  'import.selected': (v) => `Kunin ang ${v.n} manok`, 'import.cancel': 'Kanselahin',
  'import.done': (v) => `Nakuha: ${v.birds} manok, ${v.logs} log, ${v.keeps} keep`,
  'import.bad': 'Hindi Derby o Derby Keep backup ang file na iyan', 'import.none': 'Walang manok sa file na iyan.',
  'backup.title': 'Backup',
  'backup.text': (v) => `${v.birds} manok at ${v.logs} log ang naka-save sa phone na ito. Walang ina-upload, kaya mag-backup palagi.`,
  'backup.save': 'I-save ang backup file', 'restore.title': 'Ibalik ang backup',
  'restore.text': 'Buksan ang Derby Keep backup. Papalitan lang ang record na mayroon ka na kung mas bago ang nasa file.',
  'restore.open': 'Buksan ang backup…',
  'danger.title': 'Mag-ingat', 'danger.wipe': 'Burahin lahat ng Derby Keep data sa phone na ito',
  'wipe.none': 'Walang buburahin', 'wipe.confirm': 'Burahin lahat ng manok, keep at log sa Derby Keep sa phone na ito? Mag-backup muna kung kakailanganin mo pa.',
  'wipe.type': 'I-type ang DELETE para kumpirmahin', 'wipe.cancelled': 'Walang nabura', 'wipe.done': 'Nabura lahat ng Derby Keep data',
  'file.saved': 'Na-save ang {f}',
  'about.title': 'Tungkol sa app', 'about.app': 'App', 'about.appName': 'Derby Keep: kondisyon at kalusugan',
  'about.version': 'Bersyon', 'about.lang': 'Wika',
  'toast.updated': 'Na-update ang Derby Keep sa v{v}', 'toast.sample': 'Naidagdag ang sample. Puwede itong burahin anumang oras.',
  'storage.error': 'Hindi mabuksan ng Derby Keep ang storage. Baka hinaharangan ito ng private/incognito browsing.',

  'banner.title': 'I-install ang Derby Keep', 'banner.text': 'Idagdag sa home screen. Gumagana kahit offline.',
  'banner.btn': 'I-install', 'banner.close': 'Itago ang install banner',
  'sheet.ios': 'I-install sa iPhone / iPad', 'sheet.android': 'I-install sa Android',
  'sheet.sub': 'Libre. Gumagana offline. Hindi kailangan ng app store.', 'sheet.ok': 'Sige',
  'ios.step1': 'Pindutin ang <b>Share</b> button {icon} {where}.', 'ios.whereSafari': 'sa ibaba ng Safari',
  'ios.whereOther': 'sa address bar (kanang itaas)',
  'ios.step2': 'Mag-scroll pababa at pindutin ang <b>Add to Home Screen</b> {icon}.',
  'ios.step3': 'Pindutin ang <b>Add</b> (kanang itaas). Bubuksan na ang Derby Keep mula sa home screen na parang karaniwang app.',
  'ios.note': 'Kung walang “Add to Home Screen”, buksan ang page na ito sa Safari at subukan ulit.',
  'and.step1': 'Pindutin ang menu ng browser {icon} (kanang itaas sa Chrome).',
  'and.step2': 'Pindutin ang <b>Install app</b> o <b>Add to Home screen</b>.',
  'and.step3': 'Pindutin ang <b>Install</b>. Bubuksan na ang Derby Keep mula sa home screen na parang karaniwang app.',
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
