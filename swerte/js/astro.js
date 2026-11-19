// Astronomy for Derby Swerte: sunrise/sunset, planetary days and hours, moon phase and moon sign.
// Pure functions (no DOM), unit tested. Times are JavaScript Date objects (absolute instants).

const RAD = Math.PI / 180;
const sin = (d) => Math.sin(d * RAD);
const cos = (d) => Math.cos(d * RAD);
const norm = (d) => ((d % 360) + 360) % 360;
const toJD = (ms) => ms / 864e5 + 2440587.5;
const fromJD = (jd) => new Date((jd - 2440587.5) * 864e5);

/** The seven classical planets in Chaldean order (slowest to fastest), which sets the order of planetary hours. */
export const CHALDEAN = ['saturn', 'jupiter', 'mars', 'sun', 'venus', 'mercury', 'moon'];

/** Ruler of each weekday, Sunday first (Sunday = Sun, Monday = Moon, Tuesday = Mars …). */
export const DAY_RULERS = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn'];

/**
 * Sunrise and sunset for a calendar date at a place (sunrise equation, ~1 minute accuracy in the tropics).
 * @param {{y:number,m:number,d:number}} date  calendar date (m = 1..12)
 * @param {number} lat  degrees north
 * @param {number} lon  degrees east
 */
export function sunTimes({ y, m, d }, lat, lon) {
  const noonJD = toJD(Date.UTC(y, m - 1, d, 12));
  const n = Math.round(noonJD - 2451545.0 + 0.0008);
  const jStar = n - lon / 360;
  const M = norm(357.5291 + 0.98560028 * jStar);
  const C = 1.9148 * sin(M) + 0.02 * sin(2 * M) + 0.0003 * sin(3 * M);
  const lambda = norm(M + C + 180 + 102.9372);
  const transit = 2451545.0 + jStar + 0.0053 * sin(M) - 0.0069 * sin(2 * lambda);
  const decl = Math.asin(sin(lambda) * sin(23.4397)) / RAD;
  const cosW = (sin(-0.833) - sin(lat) * sin(decl)) / (cos(lat) * cos(decl));
  const w = Math.acos(Math.max(-1, Math.min(1, cosW))) / RAD;
  return { sunrise: fromJD(transit - w / 360), sunset: fromJD(transit + w / 360) };
}

/** Calendar date {y,m,d} of an instant in a fixed UTC offset (hours). */
export function dateIn(instant, offsetHours) {
  const t = new Date(instant.getTime() + offsetHours * 36e5);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

export function addDay({ y, m, d }, n) {
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

export const weekday = ({ y, m, d }) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();

/**
 * The 24 planetary hours of a planetary day, which runs from sunrise on `date` to sunrise the next day.
 * Hours 0–11 split sunrise→sunset, 12–23 split sunset→next sunrise. Hour 0 belongs to the day's ruler,
 * then rulers follow the Chaldean order.
 */
export function planetaryHours(date, lat, lon) {
  const { sunrise, sunset } = sunTimes(date, lat, lon);
  const next = sunTimes(addDay(date, 1), lat, lon).sunrise;
  const dayRuler = DAY_RULERS[weekday(date)];
  const start = CHALDEAN.indexOf(dayRuler);
  const dayLen = (sunset - sunrise) / 12;
  const nightLen = (next - sunset) / 12;
  const hours = [];
  for (let i = 0; i < 24; i++) {
    const from = i < 12 ? sunrise.getTime() + i * dayLen : sunset.getTime() + (i - 12) * nightLen;
    const len = i < 12 ? dayLen : nightLen;
    hours.push({ index: i, night: i >= 12, ruler: CHALDEAN[(start + i) % 7], start: new Date(from), end: new Date(from + len) });
  }
  return { date, dayRuler, sunrise, sunset, nextSunrise: next, hours };
}

/**
 * The planetary day and hour in force at an instant. Before sunrise, the night hours of the
 * previous planetary day are still running.
 */
export function hourAt(instant, lat, lon, offsetHours) {
  let date = dateIn(instant, offsetHours);
  let day = planetaryHours(date, lat, lon);
  if (instant < day.sunrise) {
    date = addDay(date, -1);
    day = planetaryHours(date, lat, lon);
  }
  const hour = day.hours.find((h) => instant >= h.start && instant < h.end) || day.hours[23];
  return { day, hour };
}

// ---- Moon ----

const SYNODIC = 29.530588853;
export const MOON_PHASES = ['new', 'waxingCrescent', 'firstQuarter', 'waxingGibbous', 'full', 'waningGibbous', 'lastQuarter', 'waningCrescent'];

/** Moon age in days since new moon, illumination 0..1 and phase name. */
export function moonPhase(instant) {
  const jd = toJD(instant.getTime());
  // Mean new moon reference (2000-01-06 18:14 UTC) plus the main periodic correction.
  const d = jd - 2451545.0;
  const elong = norm(297.8501921 + 12.19074912 * d); // Moon–Sun elongation (mean)
  const Mm = norm(134.9633964 + 13.06499295 * d);
  const Ms = norm(357.5291092 + 0.98560028 * d);
  const trueElong = norm(elong + 6.289 * sin(Mm) - 1.914 * sin(Ms) + 1.274 * sin(2 * elong - Mm) + 0.658 * sin(2 * elong) - 0.186 * sin(Ms));
  const age = (trueElong / 360) * SYNODIC;
  const illumination = (1 - cos(trueElong)) / 2;
  const name = MOON_PHASES[Math.floor(((trueElong + 22.5) % 360) / 45)];
  return { age, illumination, name, waxing: trueElong < 180, elongation: trueElong };
}

export const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];

/** Traditional ruling planet of each sign. */
export const SIGN_RULERS = {
  aries: 'mars', taurus: 'venus', gemini: 'mercury', cancer: 'moon', leo: 'sun', virgo: 'mercury',
  libra: 'venus', scorpio: 'mars', sagittarius: 'jupiter', capricorn: 'saturn', aquarius: 'saturn', pisces: 'jupiter',
};

/** Moon's tropical ecliptic longitude (low-precision series, ~0.3°) and sign. */
export function moonSign(instant) {
  const d = toJD(instant.getTime()) - 2451545.0;
  const L = 218.316 + 13.176396 * d;
  const Mm = 134.963 + 13.064993 * d;
  const D = 297.85 + 12.190749 * d;
  const Ms = 357.529 + 0.98560028 * d;
  const F = 93.272 + 13.22935 * d;
  const lon = norm(L + 6.289 * sin(Mm) + 1.274 * sin(2 * D - Mm) + 0.658 * sin(2 * D) + 0.214 * sin(2 * Mm)
    - 0.186 * sin(Ms) - 0.114 * sin(2 * F));
  const sign = SIGNS[Math.floor(lon / 30)];
  return { longitude: lon, sign, degree: lon % 30, ruler: SIGN_RULERS[sign] };
}
