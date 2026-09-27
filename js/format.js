// Number formatting shared by main.js and charts.js.
// units: "intl" (1.18M, 87.46M, 1.44B) or "indian" (11.8 lakh, 8.75 crore, 144 crore).

const trim = (s) => s.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');

function sig(n, digits, keepZeros = false) {
  // Keep `digits` significant figures but never fewer than 0 decimals.
  // Headline figures keep significant trailing zeros (1.10M); axis ticks drop them (13M, not 13.0M).
  if (n === 0) return '0';
  const d = Math.max(0, digits - 1 - Math.floor(Math.log10(Math.abs(n))));
  const s = n.toFixed(d);
  // Round values (10.0, 1.00) always drop their decimals; otherwise keepZeros preserves "1.10".
  return keepZeros && !/\.0+$/.test(s) ? s : trim(s);
}

/** Compact headline form, e.g. 1181776 -> "1.18M" or "11.8 lakh". */
export function fmtCompact(n, units = currentUnits(), digits = 3) {
  const a = Math.abs(n);
  if (units === 'indian') {
    if (a >= 1e7) return `${sig(n / 1e7, digits, true)} crore`;
    if (a >= 1e5) return `${sig(n / 1e5, digits, true)} lakh`;
    if (a >= 1e3) return `${sig(n / 1e3, digits, true)}K`;
    return String(Math.round(n));
  }
  if (a >= 1e9) return `${sig(n / 1e9, digits, true)}B`;
  if (a >= 1e6) return `${sig(n / 1e6, digits, true)}M`;
  if (a >= 1e3) return `${sig(n / 1e3, digits, true)}K`;
  return String(Math.round(n));
}

/** Short axis form, e.g. 13173367 -> "13M" or "1.3 cr". */
export function fmtAxis(n, units = currentUnits()) {
  const a = Math.abs(n);
  if (units === 'indian') {
    if (a >= 1e7) return `${sig(n / 1e7, 2)} cr`;
    if (a >= 1e5) return `${sig(n / 1e5, 2)} L`;
    if (a >= 1e3) return `${sig(n / 1e3, 2)}K`;
    return String(Math.round(n));
  }
  if (a >= 1e9) return `${sig(n / 1e9, 2)}B`;
  if (a >= 1e6) return `${sig(n / 1e6, 2)}M`;
  if (a >= 1e3) return `${sig(n / 1e3, 2)}K`;
  return String(Math.round(n));
}

/** Full digits with the right grouping, e.g. 1181776 -> "1,181,776" or "11,81,776". */
export function fmtFull(n, units = currentUnits()) {
  return new Intl.NumberFormat(units === 'indian' ? 'en-IN' : 'en-US').format(Math.round(n));
}

/** Percent with one decimal, e.g. 0.0412 -> "4.1%". */
export function fmtPct(x, decimals = 1) {
  return `${(x * 100).toFixed(decimals)}%`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2020-04" -> "Apr 2020"; "2020-06-09" -> "9 Jun 2020". */
export function fmtDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return d ? `${d} ${MONTHS[m - 1]} ${y}` : `${MONTHS[m - 1]} ${y}`;
}

/** Seconds -> "m:ss". */
export function fmtDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export function currentUnits() {
  return document.documentElement.dataset.units === 'indian' ? 'indian' : 'intl';
}
