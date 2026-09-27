// charts.js: bespoke SVG charts (BUILD_SPEC 5). Lazy render near the viewport, draw-in once visible,
// re-render on units:change / resize, one shared tooltip (pointer, touch, keys). No libraries.
import { getMotion } from './state.js';
import { fmtCompact, fmtAxis, fmtFull, fmtPct, fmtDate, fmtDuration, currentUnits } from './format.js';

const NS = 'http://www.w3.org/2000/svg';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HEAT = [1e5, 2e5, 3e5, 5e5];
const BK = [1e5, 5e5, 1e6, 3e6];
const LOW = 4;
const T_LOW = 'Fewer than 4 videos, so too few to be sure.';
const FMT = { S: 'Short', L: 'Long-form', A: 'AI visuals' };
const FMTS = { S: 'Shorts', L: 'Long-form', A: 'AI visuals' };
const F3 = ['S', 'L', 'A'];
const TOPLEG = { K1: 1, K2: 1 };

let dataP, D, tip, live, active, playIO;
const states = [];
const byMount = new WeakMap();

function load() {
  if (!dataP) {
    dataP = Promise.all(['yogic_insights', 'edited_videos'].map((n) =>
      fetch(new URL(`../data/${n}.json`, import.meta.url)).then((r) => {
        if (!r.ok) throw new Error(`${n}.json: HTTP ${r.status}`);
        return r.json();
      }))).then(([y, k]) => (D = { y, k }));
    dataP.catch(() => { dataP = null; });
  }
  return dataP;
}

/* formatting */
const U = () => currentUnits();
const cmp = (n, d = 3) => fmtCompact(n, U(), d);
const ax = (n) => fmtAxis(n, U());
const full = (n) => fmtFull(n, U());
const dec = (n, k) => (U() === 'intl' ? `${(n / 1e6).toFixed(k)}M` : cmp(n)); // keeps "13.0M", "0.62M"
const pad = (h) => String(h).padStart(2, '0');
const hh = (h) => `${pad(h)}:00`;
const blk = (b) => `${hh(b * 3)}-${hh(b * 3 + 3)}`;
const heat = (v) => HEAT.filter((t) => v >= t).length;
const r1 = (v) => Math.round(v * 10) / 10;
const px5 = (v) => Math.round(v) + 0.5;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const tw = (s, mono = 1) => String(s).length * (mono ? 7.55 : 7.1); // text width estimate, tuned to --cfs / --cfs-a in charts.css
const pth = (s) => s.replace(/-?\d+\.\d+/g, (m) => r1(+m));
const idxOf = (M, m) => M.findIndex((d) => d.m === m);
const sum = (a, f) => a.reduce((s, v) => s + f(v), 0);
const bLab = () => { const b = BK.map(ax); return [`Under ${b[0]}`, `${b[0]}-${b[1]}`, `${b[1]}-${b[2]}`, `${b[2]}-${b[3]}`, `${b[3]}+`]; };
const bCount = (vs) => { const c = [0, 0, 0, 0, 0]; vs.forEach((v) => c[BK.filter((b) => v >= b).length]++); return c; };
const vidTip = (n, m) => [['', String(n), n === 1 ? ' video' : ' videos'], ...(n ? [['a typical one got ', cmp(m), ' views']] : [])];

/* DOM + SVG */
function at(e, a) {
  for (const k in a) if (a[k] != null) e.setAttribute(k, typeof a[k] === 'number' ? r1(a[k]) : a[k]);
  return e;
}
function S(tag, a, p, txt) {
  const e = at(document.createElementNS(NS, tag), a || {});
  if (txt != null) e.textContent = txt;
  if (p) p.appendChild(e);
  return e;
}
function E(tag, cls, p, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  if (p) p.appendChild(e);
  return e;
}
const tog = (L, i) => L.forEach((e, j) => e && e.classList.toggle('is-on', j === i));
// parts: a string, or an array of strings / [text, class] runs
function T(p, x, y, parts, cls = 'c-a', anchor) {
  const t = S('text', { x, y, class: cls, 'text-anchor': anchor }, p);
  for (const q of typeof parts === 'string' ? [parts] : parts) {
    if (typeof q === 'string') t.append(q); else S('tspan', { class: q[1] }, t, q[0]);
  }
  return t;
}
function lines(p, x, y, arr, anchor) {
  const g = S('g', null, p);
  arr.forEach((parts, i) => T(g, x, y + i * 15, parts, 'c-a', anchor));
  return g;
}
function clip(t, max) { // ellipsis until it fits
  let s = t.textContent;
  try {
    while (s.length > 6 && t.getComputedTextLength() > max) { s = s.slice(0, -1); t.textContent = `${s.trimEnd()}…`; }
  } catch { /* not rendered */ }
  return t;
}
function hbar(x, y, w, h, rl = 0, rr = 4) { // horizontal bar / segment, radii per end
  w = Math.max(w, 0);
  rl = Math.min(rl, h / 2, w / 2); rr = Math.min(rr, h / 2, w / 2);
  const X = x + w, B = y + h;
  return pth(`M${x + rl},${y}H${X - rr}Q${X},${y} ${X},${y + rr}V${B - rr}Q${X},${B} ${X - rr},${B}H${x + rl}Q${x},${B} ${x},${B - rl}V${y + rl}Q${x},${y} ${x + rl},${y}Z`);
}
function vbar(x, y, w, h, r = 4) { // rounded data end, square baseline
  r = Math.min(r, w / 2, h);
  return pth(`M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`);
}
function glyph(p, f, x, y, r, cls = '') { // circle Short, square Long-form, diamond AI
  const c = `g-${f} ${cls}`, q = r * 1.25;
  if (f === 'S') return S('circle', { cx: x, cy: y, r, class: c }, p);
  if (f === 'L') return S('rect', { x: x - r * 0.9, y: y - r * 0.9, width: r * 1.8, height: r * 1.8, rx: 1.2, class: c }, p);
  return S('path', { d: pth(`M${x},${y - q}L${x + q},${y}L${x},${y + q}L${x - q},${y}Z`), class: c }, p);
}
function glyphEl(f) {
  const v = S('svg', { viewBox: '0 0 12 12', width: 12, height: 12, class: 'lg-g', 'aria-hidden': 'true' });
  glyph(v, f, 6, 6, 4.2);
  return v;
}
function size(c, h) { c.H = h; at(c.svg, { viewBox: `0 0 ${c.W} ${h}`, width: c.W, height: h }); }
function rowG(g, y, W, rh) {
  const rg = S('g', { class: 'c-rowg' }, g);
  S('rect', { x: 0, y: y + 1, width: W, height: rh - 2, rx: 6, class: 'c-row' }, rg);
  return rg;
}
const rowHit = (top, rh, n) => (px, py) => { const i = Math.floor((py - top) / rh); return py >= top && i < n ? i : -1; };

/* legends and notes: HTML outside the role=img mount */
function legend(c, items, cls = '') {
  const row = E('div', `lg-row ${cls}`, c.lg);
  for (const it of items) {
    const s = E('span', 'lg', row);
    if (it.g) s.append(glyphEl(it.g)); else if (it.k) E('i', `lg-k ${it.k}`, s);
    if (it.t) s.append(it.t);
    if (it.v) E('b', null, s, it.v);
  }
}
function heatKey(c, lead) {
  const b = HEAT.map(ax);
  legend(c, [{ t: lead }, ...[`Under ${b[0]}`, `${b[0]}-${b[1]}`, `${b[1]}-${b[2]}`, `${b[2]}-${b[3]}`, `${b[3]}+`].map((t, i) => ({ k: `h${i}`, t }))], 'lg-heat');
}
function notes(c, list) { // small screens: numbered badges on the plot, text here
  const ol = E('ol', 'chart__notes', c.lg);
  list.forEach(([a, b, sep = ' · '], i) => {
    const li = E('li', null, ol);
    E('span', 'n', li, i + 1);
    E('b', null, li, a);
    li.append(`${sep}${b}`);
  });
}
function badge(p, x, y, n) {
  const g = S('g', { class: 'c-badge o-c' }, p);
  S('circle', { cx: x, cy: y, r: 8 }, g);
  S('text', { x, y: y + 3.5, 'text-anchor': 'middle' }, g, n);
  return g;
}
function yAxis(g, ticks, y, x0, x1, fmt) {
  for (const v of ticks) {
    const yy = px5(y(v));
    S('line', { x1: x0, x2: x1, y1: yy, y2: yy, class: v ? 'c-grid' : 'c-base' }, g);
    T(g, x0 - 8, yy + 3.5, fmt(v), 'c-t', 'end');
  }
}
function years(g, M, x, yb) {
  M.forEach((d, i) => {
    const xx = px5(x(i)), jan = d.m.endsWith('-01');
    S('line', { x1: xx, x2: xx, y1: yb, y2: yb + (jan || !i ? 6 : 3), class: 'c-tick' }, g);
    if (!i || jan) T(g, xx, yb + 18, d.m.slice(0, 4), 'c-t', i ? 'middle' : 'start');
  });
}

/* motion: full = draw-ins, calm = short fades, off = static. Held paused until visible. */
function an(c, el, kf, dur = 700, delay = 0, ease = 'cubic-bezier(.16,1,.3,1)') {
  if (c.A === 'off' || !el.animate) return;
  if (c.A === 'calm') { kf = [{ opacity: 0 }, { opacity: 1 }]; dur = 420; delay = Math.min(delay, 900) * 0.25; ease = 'ease-out'; }
  const a = el.animate(kf, { duration: dur, delay, easing: ease, fill: 'backwards' });
  if (c.st.hold) { a.pause(); c.st.anims.push(a); }
}
const INOUT = 'cubic-bezier(.65,0,.35,1)';
const fade = (c, el, delay = 0, dur = 600) => an(c, el, [{ opacity: 0 }, { opacity: 1 }], dur, delay, 'ease-out');
const pop = (c, el, delay = 0) => an(c, el, [{ opacity: 0, transform: 'scale(0.2)' }, { opacity: 1, transform: 'none' }], 520, delay);
const grow = (c, el, axis, delay = 0, dur = 800) => an(c, el, [{ transform: `scale${axis}(0)` }, { transform: 'none' }], dur, delay);
function stroke(c, el, delay = 0, dur = 1200) {
  if (c.A !== 'full') return fade(c, el, delay);
  const L = el.getTotalLength(), da = `${L} ${L}`;
  if (L) an(c, el, [{ strokeDasharray: da, strokeDashoffset: L }, { strokeDasharray: da, strokeDashoffset: 0 }], dur, delay, INOUT);
}

/* geometry */
function mono(pts) { // monotone cubic (Fritsch-Butland): smooth, never overshoots
  const n = pts.length, dx = [], m = [], t = [], segs = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i]; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) {
    t[i] = m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], h = dx[i] / 3;
    const s = [x0, y0, x0 + h, y0 + t[i] * h, x1 - h, y1 - t[i + 1] * h, x1, y1];
    segs.push(s);
    d += `C${s.slice(2).join(',')}`;
  }
  return { d: pth(d), segs };
}
function bez(s, u) {
  const v = 1 - u, f = (a, b, c, d) => v * v * v * a + 3 * v * v * u * b + 3 * v * u * u * c + u * u * u * d;
  return [f(s[0], s[2], s[4], s[6]), f(s[1], s[3], s[5], s[7])];
}
function cross(s, Y) { // where a monotone segment crosses pixel height Y
  let lo = 0, hi = 1;
  for (let k = 0; k < 28; k++) {
    const mid = (lo + hi) / 2;
    if ((bez(s, mid)[1] > Y) === (s[7] < s[1])) lo = mid; else hi = mid;
  }
  return bez(s, (lo + hi) / 2);
}
const edits = (K) => [...K.shortForm.map((v) => ({ ...v, f: 'S' })), ...K.longForm.map((v) => ({ ...v, f: 'L' })), ...K.aiVisuals.map((v) => ({ ...v, f: 'A' }))];

/* ================= charts ================= */
const R = {};

/* Y1 cumulative views: monotone line + area, milestone pins */
R.Y1 = (c) => {
  const M = c.y.months, n = M.length, { W, cp, svg } = c;
  const m = { l: cp ? 36 : 50, r: cp ? 12 : 24, t: cp ? 26 : 52, b: 30 };
  size(c, cp ? 280 : 400);
  const base = c.H - m.b, pw = W - m.l - m.r;
  const x = (i) => m.l + (i / (n - 1)) * pw, y = (v) => base - (v / 1e8) * (base - m.t);
  const cum = M.map((d) => d.cumulativeUniqueViews), total = cum[n - 1];
  const gr = S('linearGradient', { id: 'y1-fill', x1: 0, x2: 0, y1: 0, y2: 1 }, S('defs', null, svg));
  S('stop', { offset: 0, class: 'st-a' }, gr);
  S('stop', { offset: 1, class: 'st-b' }, gr);
  const g = S('g', null, svg);
  // Mar to Dec 2020 band
  const i0 = idxOf(M, '2020-03'), i1 = idxOf(M, '2020-12');
  const pct = Math.round((sum(M.slice(i0, i1 + 1), (d) => d.uniqueViews) / total) * 100);
  const bx0 = x(i0 - 1), bx1 = x(i1);
  fade(c, S('rect', { x: bx0, y: m.t, width: bx1 - bx0, height: base - m.t, class: 'c-band' }, g), 200, 900);
  yAxis(g, [0, 25e6, 50e6, 75e6, 1e8], y, m.l, W - m.r, ax);
  years(g, M, x, base);
  const { d, segs } = mono(cum.map((v, i) => [x(i), y(v)]));
  const area = S('path', { d: `${d}L${r1(x(n - 1))},${base}L${r1(x(0))},${base}Z`, fill: 'url(#y1-fill)' }, g);
  stroke(c, S('path', { d, class: 'c-glow' }, g), 0, 1400);
  stroke(c, S('path', { d, class: 'c-line' }, g), 0, 1400);
  an(c, area, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }], 1400, 0, INOUT);
  const nl = [];
  [1e7, 2.5e7, 5e7, 7.5e7].forEach((mk) => {
    const i = cum.findIndex((v) => v >= mk);
    if (i < 1) return;
    const [px, py] = cross(segs[i - 1], y(mk)), pg = S('g', null, g), when = fmtDate(M[i].m), what = `passes ${cmp(mk)}`;
    S('circle', { cx: px, cy: py, r: 4.5, class: 'c-pin' }, pg);
    if (cp) { badge(pg, px - 15, py - 12, nl.length + 1); nl.push([when, what]); } else {
      S('line', { x1: px - 5, x2: px - 11, y1: py - 3, y2: py - 7, class: 'c-lead' }, pg);
      T(pg, px - 13, py - 8, [[when, 'c-m'], ' · ', [what, 'c-s']], 'c-a', 'end');
    }
    fade(c, pg, 1400 * ((px - m.l) / pw) + 100, 400);
  });
  const bt = [`${pct}% of all views`, 'came from videos posted from Mar to Dec 2020.'];
  if (!cp && tw(bt[1], 0) < bx1 - bx0 - 16) fade(c, lines(g, bx0 + 10, m.t - 26, [[[bt[0], 'c-s']], bt[1]]), 600);
  else { fade(c, badge(g, bx0 + 12, m.t + 14, nl.length + 1), 600); nl.push([bt[0], bt[1], ' ']); }
  const ex = x(n - 1), ey = y(total), end = S('g', null, g);
  S('circle', { cx: ex, cy: ey, r: 4.5, class: 'c-pin' }, end);
  T(end, ex - 2, ey - 14, [[fmtDate(M[n - 1].m), 'c-m'], ' · ', [U() === 'intl' ? fmtCompact(total, 'intl', 4) : cmp(total), 'c-s']], 'c-a', 'end');
  fade(c, end, 1350);
  if (nl.length) notes(c, nl);
  const xh = S('g', { class: 'c-xh' }, svg), xl = S('line', { y1: m.t, y2: base }, xh), xd = S('circle', { r: 5 }, xh);
  return {
    pts: M.map((q, i) => ({
      x: x(i), y: y(cum[i]),
      tip: { h: fmtDate(q.m), r: [['total so far ', cmp(cum[i], cum[i] >= 1e7 ? 4 : 3)], ['this month ', cmp(q.uniqueViews)], ['', String(q.uniquePosts), ' different posts (', String(q.posts), ' counting repeat posts)']] },
    })),
    hit: (px) => (px < m.l - 24 || px > W - m.r + 24 ? -1 : clamp(Math.round(((px - m.l) / pw) * (n - 1)), 0, n - 1)),
    mark: (i) => {
      xh.classList.toggle('is-on', i >= 0);
      if (i >= 0) { at(xl, { x1: x(i), x2: x(i) }); at(xd, { cx: x(i), cy: y(cum[i]) }); }
    },
    def: 0,
  };
};

/* Y2 monthly views (bars) and posts per month (line): two aligned panels on one time axis,
   instead of a dual-axis chart, so neither scale implies the other. */
R.Y2 = (c) => {
  const M = c.y.months, n = M.length, { W, cp, svg } = c;
  const m = { l: cp ? 36 : 50, r: cp ? 10 : 24, b: 30 };
  size(c, cp ? 350 : 440);
  const pw = W - m.l - m.r, bw = pw / n, cx = (i) => m.l + bw * (i + 0.5), w = Math.min(24, bw * 0.62);
  const t1 = 32, p1 = t1 + (cp ? 72 : 96), t2 = p1 + 46, base = c.H - m.b;
  const yp = (v) => p1 - (v / 24) * (p1 - t1), yv = (v) => base - (v / 15e6) * (base - t2);
  const g = S('g', null, svg);
  S('line', { x1: m.l, x2: m.l + 16, y1: t1 - 16, y2: t1 - 16, class: 'c-pline' }, g);
  S('circle', { cx: m.l + 8, cy: t1 - 16, r: 3, class: 'c-pdot' }, g);
  T(g, m.l + 24, t1 - 12, 'Line: posts per month (with repeats)', 'c-t c-t2');
  S('rect', { x: m.l + 1, y: t2 - 23, width: 12, height: 12, rx: 2, class: 'c-bar' }, g);
  T(g, m.l + 24, t2 - 13, 'Bars: views per month (no repeats)', 'c-t c-t2');
  yAxis(g, [0, 10, 20], yp, m.l, W - m.r, String);
  yAxis(g, [0, 5e6, 1e7, 15e6], yv, m.l, W - m.r, ax);
  years(g, M, cx, base);
  const bars = M.map((d, i) => {
    if (!d.uniqueViews) return null;
    const b = S('path', { d: vbar(cx(i) - w / 2, yv(d.uniqueViews), w, base - yv(d.uniqueViews)), class: 'c-bar o-b' }, g);
    grow(c, b, 'Y', i * 22, 700);
    return b;
  });
  const pp = M.map((d, i) => [cx(i), yp(d.posts)]);
  stroke(c, S('path', { d: pth(`M${pp.map((p) => p.join(',')).join('L')}`), class: 'c-pline' }, g), 300, 1200);
  const dots = pp.map(([px, py], i) => {
    const e = S('circle', { cx: px, cy: py, r: cp ? 2.6 : 3.4, class: 'c-pdot o-c' }, g);
    pop(c, e, 400 + i * 30);
    return e;
  });
  const A = [], iM = idxOf(M, '2020-03'), iN = idxOf(M, '2020-11'), i21 = idxOf(M, '2021-01');
  let ip = iM - 1;
  while (ip > 0 && !M[ip].posts) ip--;
  const pk = M.reduce((a, d, i) => (d.uniqueViews > M[a].uniqueViews ? i : a), 0), P = M[pk], N = M[iN];
  A.push({ x: cx(iM) - (cp ? 0 : bw), y: yp(M[iM].posts), s: -1, l: [fmtDate(M[iM].m), `posts jump from ${M[ip].posts} to ${M[iM].posts} a month`] });
  A.push({ x: cx(pk) - w / 2, y: yv(P.uniqueViews), s: -1, l: [`${fmtDate(P.m)}${P.m === '2020-04' ? ' (lockdown)' : ''}`, `${P.posts} posts, ${dec(P.uniqueViews, 1)} views, the best month`] });
  A.push({ x: cx(iN) + w / 2, y: yv(N.uniqueViews), s: 1, l: [fmtDate(N.m), `${N.posts} posts, ${dec(N.uniqueViews, 1)} views`] });
  if (Math.max(...M.slice(i21).map((d) => d.uniqueViews)) < 3e6) {
    const y3 = yv(3e6), xa = cx(i21) - bw / 2;
    fade(c, S('line', { x1: xa, x2: cx(n - 1) + bw / 2, y1: y3, y2: y3, class: 'c-ref' }, g), 1300);
    A.push({ x: xa, y: y3, s: 0, l: ['2021', `fewer posts, views fall below ${cmp(3e6)} a month`] });
  }
  A.forEach((a, k) => fade(c, cp
    ? badge(g, a.s < 0 ? a.x - 12 : a.x + (a.s ? 12 : 10), a.y - (a.s ? 12 : 14), k + 1)
    : lines(g, a.s < 0 ? a.x - 10 : a.x + (a.s ? 10 : 2), a.s ? a.y + 4 : a.y - 22, [[[a.l[0], 'c-s']], a.l[1]], a.s < 0 ? 'end' : 'start'), 1100 + k * 150));
  if (cp) notes(c, A.map((a) => a.l));
  const xh = S('line', { y1: t1, y2: base, class: 'c-xh' }, svg);
  return {
    pts: M.map((d, i) => ({ x: cx(i), y: d.uniqueViews ? yv(d.uniqueViews) : yp(d.posts), tip: { h: fmtDate(d.m), r: [['', cmp(d.uniqueViews), ' views'], ['', String(d.posts), ' posts (', String(d.uniquePosts), ' different)']] } })),
    hit: (px) => (px < m.l - 10 || px > W - m.r + 10 ? -1 : clamp(Math.floor((px - m.l) / bw), 0, n - 1)),
    mark: (i) => {
      xh.classList.toggle('is-on', i >= 0);
      tog(bars, i); tog(dots, i);
      if (i >= 0) at(xh, { x1: cx(i), x2: cx(i) });
    },
    def: 0,
  };
};

/* Y4 24-hour dial, vectorscope-style: spoke ~ sqrt(videos), dot = median views */
R.Y4 = (c) => {
  const B = c.y.byHourIST, { W, cp, svg, st } = c;
  const Dm = Math.min(W, 460), R0 = Dm / 2 - (cp ? 26 : 32), r0 = R0 * 0.3, cx = W / 2, cy = Dm / 2;
  size(c, Dm + 46);
  const maxC = Math.max(...B.map((b) => b.count)), total = sum(B, (b) => b.count);
  const rr = (v) => r0 + (R0 - r0) * Math.sqrt(v / maxC);
  const ang = (h) => (h / 24) * Math.PI * 2 - Math.PI / 2;
  const pt = (h, r) => [cx + Math.cos(ang(h)) * r, cy + Math.sin(ang(h)) * r];
  const seg = (h, a, b, cls) => { const [x1, y1] = pt(h, a), [x2, y2] = pt(h, b); return S('line', { x1, y1, x2, y2, class: cls }, g); };
  const P2 = (h, r) => pt(h, r).map(r1).join(',');
  const sector = (h) => { const R2 = r1(R0 + 2), q = r1(r0); return `M${P2(h - 0.5, r0)}L${P2(h - 0.5, R2)}A${R2},${R2} 0 0 1 ${P2(h + 0.5, R2)}L${P2(h + 0.5, r0)}A${q},${q} 0 0 0 ${P2(h - 0.5, r0)}Z`; };
  const g = S('g', null, svg), wedge = S('path', { class: 'c-wedge' }, g);
  S('circle', { cx, cy, r: R0, class: 'c-ring' }, g);
  [5, 10, 20].forEach((v) => {
    S('circle', { cx, cy, r: rr(v), class: 'c-ring2' }, g);
    const [lx, ly] = pt(1.5, rr(v));
    T(g, lx + 3, ly + 3, String(v), 'c-t c-t3');
  });
  S('circle', { cx, cy, r: r0, class: 'c-ring' }, g);
  for (let h = 0; h < 24; h++) {
    seg(h, R0, R0 + (h % 3 ? 3 : 6), 'c-tick');
    if (!(h % 3)) { const [lx, ly] = pt(h, R0 + 17); T(g, lx, ly + 4, pad(h), 'c-t', 'middle'); }
  }
  // "skin-tone line": best median among well-sampled hours
  const best = B.filter((b) => b.count >= LOW).reduce((a, b) => (b.medianViews > a.medianViews ? b : a));
  const bh = best.hourIST, sn = Math.sin(ang(bh)), L = sn > 0.3 ? (Dm + 6 - cy) / sn : R0 + 20;
  const skin = seg(bh, r0, L, 'c-skin');
  const l1 = `${hh(bh)} IST · ${best.count} videos · typical ${cmp(best.medianViews)}`;
  const lx = clamp(pt(bh, L)[0], tw(l1, 0) / 2 + 4, W - tw(l1, 0) / 2 - 4);
  const sl = lines(g, lx, Dm + 22, [[[l1, 'c-s']], `${(best.medianViews / c.y.medianViewsUnique).toFixed(1)}x the page's typical video`], 'middle');
  const spokes = [], heads = [];
  B.forEach((b) => {
    const h = b.hourIST, low = b.count < LOW;
    if (!b.count) { seg(h, r0, r0 + 4, 'c-zero'); return; }
    spokes[h] = seg(h, r0, rr(b.count), `c-spoke${low ? ' is-low' : ''}`);
    const [x2, y2] = pt(h, rr(b.count));
    heads[h] = S('circle', { cx: x2, cy: y2, r: cp ? 4 : 5, class: `c-hd h${heat(b.medianViews)}${low ? ' is-low' : ''} o-c` }, g);
    stroke(c, spokes[h], h * 34, 600); pop(c, heads[h], h * 34 + 380);
  });
  stroke(c, skin, 950, 700); fade(c, sl, 1300);
  const ct = S('g', null, g);
  T(ct, cx, cy + 5, String(total), 'c-big', 'middle');
  T(ct, cx, cy + 22, 'videos', 'c-t', 'middle');
  fade(c, ct, 200);
  const hand = S('g', { class: 'c-hand' }, g), hl = S('line', null, hand), hc = S('circle', { r: 2.5 }, hand);
  legend(c, [{ k: 'lg-spoke', t: 'Line length: videos per hour' }, { k: 'lg-low', t: 'Too few: under 4 videos' }]);
  heatKey(c, 'Dot: views of a typical video');
  B.filter((b) => b.count && b.count < LOW && b.medianViews > c.y.medianViewsUnique).forEach((b) =>
    E('p', 'chart__note', c.lg, `${hh(b.hourIST)} · a typical video got ${cmp(b.medianViews)}, but there are only ${b.count} videos. Too few to be sure.`));
  const lp = E('p', 'chart__live', c.lg);
  const tick = () => { // live hand: now, in IST
    const d = new Date(), mins = (d.getUTCHours() * 60 + d.getUTCMinutes() + 330) % 1440, hr = mins / 60, b = B[Math.floor(hr)];
    const [x1, y1] = pt(hr, r0), [x2, y2] = pt(hr, R0 + 8);
    at(hl, { x1, y1, x2, y2 }); at(hc, { cx: x2, cy: y2 });
    lp.textContent = `It's ${pad(Math.floor(hr))}:${pad(mins % 60)} IST.${b.count ? ` ${b.count} of my videos went out in this hour. A typical one got ${cmp(b.medianViews)} views.${b.count < LOW ? ` ${T_LOW}` : ''}` : ''}`;
  };
  tick();
  st.timer = setInterval(tick, 30000);
  return {
    pts: B.map((b) => {
      const [px, py] = pt(b.hourIST, b.count ? rr(b.count) : r0);
      return { x: px, y: py, tip: { h: `${hh(b.hourIST)} IST`, r: vidTip(b.count, b.medianViews), n: b.count && b.count < LOW ? T_LOW : null } };
    }),
    hit: (px, py) => {
      const dx = px - cx, dy = py - cy, d = Math.hypot(dx, dy);
      if (d < r0 * 0.5 || d > R0 + 28) return -1;
      return Math.round(((Math.atan2(dy, dx) + Math.PI * 2.5) % (Math.PI * 2)) / (Math.PI / 12)) % 24;
    },
    mark: (i) => { wedge.setAttribute('d', i >= 0 ? sector(i) : ''); tog(spokes, i); tog(heads, i); },
    def: bh,
    wrap: true,
  };
};

/* Y3 weekday x 3-hour heatmap (IST): shade = median views, number = videos posted or median */
R.Y3 = (c) => {
  const { W, cp, svg, st } = c, mode = st.v.mode || 'n', HM = c.y.heatmapIST;
  if (!st.ctl) {
    st.ctl = at(E('div', 'chart__controls'), { role: 'group', 'aria-label': 'Numbers in the grid' });
    [['n', 'Videos posted'], ['m', 'Typical views']].forEach(([v, t]) => {
      const b = E('button', null, st.ctl, t);
      b.type = 'button'; b.dataset.v = v;
      b.addEventListener('click', () => { st.v.mode = v; draw(st, false); });
    });
    st.mount.before(st.ctl);
  }
  for (const b of st.ctl.children) b.setAttribute('aria-pressed', String(b.dataset.v === mode));
  const days = [1, 2, 3, 4, 5, 6, 0], rot = cp, nr = rot ? 8 : 7, nc = rot ? 7 : 8;
  const lw = rot ? 46 : 40, th = 24, gap = 2;
  const cw = (W - lw - gap * (nc - 1)) / nc, ch = rot ? clamp(cw * 0.8, 30, 40) : clamp(cw * 0.58, 34, 48);
  size(c, th + nr * (ch + gap));
  const g = S('g', null, svg);
  const pat = S('pattern', { id: 'y3-hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, S('defs', null, svg));
  S('line', { x1: 0, y1: 0, x2: 0, y2: 6, class: 'c-hatch' }, pat);
  const dn = days.map((d) => DAYS[d]), bn = [0, 1, 2, 3, 4, 5, 6, 7].map((b) => `${pad(b * 3)}-${pad(b * 3 + 3)}`);
  (rot ? dn : bn).forEach((t, j) => T(g, lw + j * (cw + gap) + cw / 2, th - 9, t, 'c-t', 'middle'));
  (rot ? bn : dn).forEach((t, i) => T(g, 0, th + i * (ch + gap) + ch / 2 + 4, t, 'c-t'));
  const top = HM.filter((q) => q.count >= LOW).reduce((a, q) => (q.count > a.count ? q : a));
  const pts = [], cells = [];
  let def = 0;
  for (let i = 0; i < nr; i++) {
    for (let j = 0; j < nc; j++) {
      const d = rot ? days[j] : days[i], b = rot ? i : j, q = HM.find((z) => z.dow === d && z.block === b);
      const x = lw + j * (cw + gap), y = th + i * (ch + gap), low = q.count > 0 && q.count < LOW, hv = heat(q.medianViews);
      const cg = S('g', { class: 'o-c' }, g), box = { x, y, width: cw, height: ch, rx: 4 };
      cells.push(S('rect', { ...box, class: `c-cell ${q.count ? `h${hv}` : 'h-e'}${low ? ' is-low' : ''}` }, cg));
      if (low) S('rect', { ...box, fill: 'url(#y3-hatch)' }, cg);
      if (q.count) T(cg, x + cw / 2, y + ch / 2 + 4, mode === 'n' ? String(q.count) : ax(q.medianViews), `c-cn${hv >= 3 && !low ? ' ink' : ''}${low ? ' is-low' : ''}`, 'middle');
      if (q === top) { S('rect', { x: x - 1.5, y: y - 1.5, width: cw + 3, height: ch + 3, rx: 5, class: 'c-ann' }, cg); def = pts.length; }
      an(c, cg, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], 480, (i + j) * 28);
      pts.push({ x: x + cw / 2, y: y + ch / 2, tip: { h: `${DAYS[d]} ${blk(b)} IST`, r: vidTip(q.count, q.medianViews), n: low ? T_LOW : null } });
    }
  }
  heatKey(c, 'Colour: views of a typical video');
  legend(c, [
    { t: mode === 'n' ? 'Number: videos posted' : 'Number: views of a typical video' },
    { k: 'lg-hatch', t: 'Striped: fewer than 4 videos' },
    { k: 'lg-ann', t: `${DAYS[top.dow]} ${blk(top.block)} · ${top.count} videos · typical ${cmp(top.medianViews)}` },
  ]);
  return {
    pts,
    hit: (px, py) => {
      const j = Math.floor((px - lw) / (cw + gap)), i = Math.floor((py - th) / (ch + gap));
      return px < lw || j >= nc || i < 0 || i >= nr ? -1 : i * nc + j;
    },
    mark: (k) => tog(cells, k),
    step: (k, key) => (key === 'ArrowDown' ? k + nc : key === 'ArrowUp' ? k - nc : null),
    def,
  };
};

/* Y5 one dot per unique video on a log axis (beeswarm), buckets, median */
R.Y5 = (c) => {
  const { W, cp, svg } = c, med = c.y.medianViewsUnique;
  const P = c.y.posts.filter((p) => p.unique).map((p) => ({ d: p.date, v: p.views })).sort((a, b) => a.v - b.v), N = P.length;
  const r = cp ? 3.1 : clamp(W / 230, 4.3, 5.8), sep = r * 2 + 1.2, ml = 12, mr = 12;
  const lo = Math.log10(P[0].v * 0.8), hi = Math.log10(P[N - 1].v * 1.18);
  const x = (v) => ml + ((Math.log10(v) - lo) / (hi - lo)) * (W - ml - mr);
  let ext = r;
  const placed = [];
  for (const p of P) {
    p.x = x(p.v);
    const near = placed.filter((q) => p.x - q.x < sep), cand = [0];
    for (const q of near) { const h = Math.sqrt(sep * sep - (p.x - q.x) ** 2); cand.push(q.y + h, q.y - h); }
    cand.sort((a, b) => Math.abs(a) - Math.abs(b));
    p.y = cand.find((yy) => near.every((q) => (p.x - q.x) ** 2 + (q.y - yy) ** 2 >= sep * sep - 0.01));
    ext = Math.max(ext, Math.abs(p.y) + r);
    placed.push(p);
  }
  const cnt = bCount(P.map((p) => p.v)), edges = [ml, ...BK.map(x), W - mr], blab = bLab();
  const fit = blab.every((t, i) => tw(`${t}: ${cnt[i]}`) + 10 < edges[i + 1] - edges[i]);
  const rowC = 70, cy = rowC + 12 + ext, ya = px5(cy + ext + 10);
  size(c, ya + (fit ? 50 : 26));
  const g = S('g', null, svg);
  BK.forEach((b) => { const xx = px5(x(b)); S('line', { x1: xx, x2: xx, y1: cy - ext, y2: ya, class: 'c-grid' }, g); });
  S('line', { x1: ml, x2: W - mr, y1: ya, y2: ya, class: 'c-base' }, g);
  [1e4, ...BK].forEach((b) => {
    const xx = x(b);
    if (xx < ml) return;
    S('line', { x1: xx, x2: xx, y1: ya, y2: ya + 5, class: 'c-tick' }, g);
    T(g, xx, ya + 17, ax(b), 'c-t', 'middle');
  });
  const br = (xa, yy, parts, delay) => {
    const bg = S('g', null, g);
    S('path', { d: pth(`M${xa},${yy + 5}V${yy}H${W - mr}V${yy + 5}`), class: 'c-brk' }, bg);
    T(bg, xa + 6, yy - 6, parts);
    fade(c, bg, delay);
  };
  br(x(1e5), 22, [[`${N - cnt[0]} of ${N}`, 'c-s'], ` passed ${cmp(1e5)}`], 900);
  br(x(1e6), 46, [[String(cnt[3] + cnt[4]), 'c-s'], ` passed ${cmp(1e6)}`], 1050);
  const xm = x(med), mg = S('g', null, g);
  const mline = S('line', { x1: xm, x2: xm, y1: rowC + 6, y2: ya, class: 'c-med' }, mg);
  T(mg, xm, rowC, [['Typical video: ', 'c-m'], [cmp(med), 'c-s']], 'c-a', 'middle');
  const dots = P.map((p, i) => {
    const e = S('circle', { cx: p.x, cy: cy + p.y, r, class: `c-bee${p.v >= 1e6 ? ' is-hit' : ''} o-c` }, g);
    pop(c, e, i * 6);
    return e;
  });
  stroke(c, mline, 700, 600); fade(c, mg, 700);
  if (fit) blab.forEach((t, i) => T(g, (edges[i] + edges[i + 1]) / 2, ya + 40, [`${t}: `, [String(cnt[i]), 'c-s']], 'c-t c-t2', 'middle'));
  else legend(c, blab.map((t, i) => ({ t: `${t}: `, v: String(cnt[i]) })), 'lg-buckets');
  const ring = S('circle', { r: r + 3.5, class: 'c-focus' }, svg);
  return {
    pts: P.map((p) => ({ x: p.x, y: cy + p.y, tip: { h: fmtDate(p.d), r: [['', cmp(p.v), ' views']] } })),
    hit: (px, py) => {
      let bi = -1, bd = 18 * 18;
      P.forEach((p, i) => { const dd = (p.x - px) ** 2 + (cy + p.y - py) ** 2; if (dd < bd) { bd = dd; bi = i; } });
      return bi;
    },
    mark: (i) => {
      tog(dots, i);
      ring.classList.toggle('is-on', i >= 0);
      if (i >= 0) at(ring, { cx: P[i].x, cy: cy + P[i].y });
    },
    def: N - 1,
  };
};

/* Y6 top 10 videos; click / Enter opens the Facebook post */
R.Y6 = (c) => {
  const L = c.y.top10, { W, cp, svg, st } = c, n = L.length;
  const rk = 26, lab = Math.max(...L.map((d) => tw(`Video · ${fmtDate(d.date)}`))) + 14, vw = Math.max(...L.map((d) => tw(cmp(d.views)))) + 12;
  const sk = W - rk - lab - vw < 150, rh = sk ? 42 : cp ? 34 : 38, bh = cp ? 12 : 14, top = 28; // sk: label above bar
  size(c, top + n * rh);
  const x0 = sk ? rk : rk + lab, x1 = sk ? W - 4 : W - vw, max = L[0].views, xs = (v) => x0 + (v / max) * (x1 - x0);
  const g = S('g', null, svg), step = x1 - x0 < 300 ? 2e6 : 1e6;
  for (let v = step; v <= max; v += step) {
    const xx = px5(xs(v));
    S('line', { x1: xx, x2: xx, y1: top - 6, y2: c.H, class: 'c-grid' }, g);
    T(g, xx, top - 12, ax(v), 'c-t', 'middle');
  }
  if (!sk) S('line', { x1: px5(x0), x2: px5(x0), y1: top - 6, y2: c.H, class: 'c-base' }, g);
  const rows = L.map((d, i) => {
    const y = top + i * rh, cy = y + rh / 2, ty = sk ? y + 16 : cy + 4, rg = rowG(g, y, W, rh);
    T(rg, 0, ty, pad(i + 1), 'c-t');
    T(rg, rk, ty, [['Video', 'c-m'], ` · ${fmtDate(d.date)}`], 'c-t c-t2');
    grow(c, S('path', { d: hbar(x0, sk ? y + 23 : cy - bh / 2, xs(d.views) - x0, bh), class: 'c-bar o-l' }, rg), 'X', 120 + i * 60);
    fade(c, T(rg, W, ty, cmp(d.views), 'c-v', 'end'), 500 + i * 60);
    return rg;
  });
  return {
    pts: L.map((d, i) => ({ x: xs(d.views), y: top + i * rh + rh / 2, tip: { h: `#${i + 1} · ${fmtDate(d.date)}`, r: [['', cmp(d.views), ' views']], n: 'Open on Facebook (you may need to log in)' } })),
    hit: rowHit(top, rh, n),
    mark: (i) => { tog(rows, i); st.mount.style.cursor = i >= 0 ? 'pointer' : ''; },
    act: (i) => { if (/^https:\/\/www\.facebook\.com\//.test(L[i].link)) window.open(L[i].link, '_blank', 'noopener'); },
    def: 0,
  };
};

/* K1 views per edit, coloured and shaped by format, format mix above */
R.K1 = (c) => {
  const { W, svg } = c, V = edits(c.k).sort((a, b) => b.views - a.views), n = V.length, tot = {};
  F3.forEach((f) => { tot[f] = sum(V.filter((v) => v.f === f), (v) => v.views); });
  const all = tot.S + tot.L + tot.A, stack = W < 860;
  legend(c, F3.map((f) => ({ g: f, t: `${FMTS[f]} `, v: dec(tot[f], 2) })));
  const rh = stack ? 46 : 32, bh = stack ? 10 : 14, top = 58;
  size(c, top + n * rh + 4);
  const g = S('g', null, svg);
  let mx = 0;
  F3.forEach((f, k) => {
    const w = (tot[f] / all) * (W - 4);
    grow(c, S('path', { d: hbar(mx, 4, w, 10, k ? 0 : 4, k === 2 ? 4 : 0), class: `g-${f} o-l` }, g), 'X', k * 140, 600);
    mx += w + 2;
  });
  const lab = stack ? 0 : clamp(W * 0.34, 330, 360), x0 = stack ? 20 : lab + 10, x1 = W - (stack ? 52 : 64);
  const xs = (v) => x0 + (v / V[0].views) * (x1 - x0), x1m = px5(xs(1e6));
  S('line', { x1: x1m, x2: x1m, y1: top - 10, y2: c.H, class: 'c-ref' }, g);
  T(g, x1m - 6, top - 14, cmp(1e6), 'c-t', 'end');
  T(g, x1m + 6, top - 14, `${V.filter((v) => v.views >= 1e6).length} edits past ${cmp(1e6)}`, 'c-a');
  const rows = V.map((v, i) => {
    const y = top + i * rh, rg = rowG(g, y, W, rh), part = v.f === 'L' && v.start > 0;
    const ty = stack ? y + 15 : y + rh / 2 + 4, by = stack ? y + 23 : y + (rh - bh) / 2;
    glyph(rg, v.f, 8, ty - 4, 4.2, 'c-head');
    // partial edits: section cut after the value if it fits, else on the title line
    const cred = stack ? v.credit.replace(/^Edited /, '') : v.credit, val = cmp(v.views);
    const atTip = part && xs(v.views) + 6 + tw(`${val} · ${cred}`) <= W;
    const credW = part && !atTip ? T(rg, W, ty, cred, 'c-t', 'end').getComputedTextLength() + 10 : 0;
    clip(T(rg, 20, ty, v.title, 'c-lab'), (stack ? W - 20 : lab - 20) - credW);
    grow(c, S('path', { d: hbar(x0, by, xs(v.views) - x0, bh), class: `c-bar g-${v.f} o-l` }, rg), 'X', 300 + i * 55);
    fade(c, T(rg, xs(v.views) + 6, by + bh / 2 + 4, [[val, i ? 'c-v' : 'c-s'], ...(atTip ? [[` · ${cred}`, 'c-m']] : [])], 'c-v'), 700 + i * 55);
    return rg;
  });
  return {
    pts: V.map((v, i) => ({ x: xs(v.views), y: top + i * rh + rh / 2, tip: { h: v.title, r: [[`${FMT[v.f]} · ${fmtDuration(v.seconds)}`], ['', cmp(v.views), ' views'], [v.credit]] } })),
    hit: rowHit(top, rh, n),
    mark: (i) => tog(rows, i),
    def: 0,
  };
};

/* K2 likes per view per edit (lollipops) with pooled format averages */
const pooled = (V, f) => { const s = V.filter((v) => v.f === f); return [sum(s, (v) => v.likes), sum(s, (v) => v.views)]; };
R.K2 = (c) => {
  const { W, svg } = c, avg = {};
  const V = edits(c.k).map((v) => ({ ...v, p: v.likes / v.views })).sort((a, b) => b.p - a.p), n = V.length;
  F3.forEach((f) => { const [l, w] = pooled(V, f); avg[f] = l / w; });
  legend(c, F3.map((f) => ({ g: f, t: FMT[f] })));
  const stack = W < 640, rh = stack ? 40 : 28, top = 54;
  size(c, top + n * rh + 28);
  const lab = stack ? 0 : clamp(W * 0.44, 250, 330), x0 = stack ? 4 : lab + 8, x1 = W - 44;
  const xs = (p) => x0 + (p / 0.045) * (x1 - x0), yb = top + n * rh, g = S('g', null, svg);
  [0, 0.01, 0.02, 0.03, 0.04].forEach((p) => {
    const xx = px5(xs(p));
    S('line', { x1: xx, x2: xx, y1: top - 4, y2: yb, class: p ? 'c-grid' : 'c-base' }, g);
    T(g, xx, yb + 18, fmtPct(p, 0), 'c-t', 'middle');
  });
  [...F3].sort((a, b) => avg[a] - avg[b]).forEach((f, j) => {
    const xx = xs(avg[f]), yy = 12 + j * 14, t = `${FMTS[f]} average ${fmtPct(avg[f])}`, right = xx + 14 + tw(t, 0) > W, rg = S('g', null, g);
    S('line', { x1: xx, x2: xx, y1: yy + 4, y2: yb, class: `c-avg s-${f}` }, rg);
    glyph(rg, f, right ? xx - 6 : xx + 6, yy - 4, 3.2);
    T(rg, right ? xx - 13 : xx + 13, yy, t, 'c-a', right ? 'end' : 'start');
    fade(c, rg, 900 + j * 120);
  });
  const rows = V.map((v, i) => {
    const y = top + i * rh, rg = rowG(g, y, W, rh), cy = stack ? y + 28 : y + rh / 2, hx = xs(v.p);
    clip(T(rg, stack ? 4 : 0, stack ? y + 14 : cy + 4, v.title, 'c-lab'), stack ? W - 8 : lab - 12);
    stroke(c, S('line', { x1: x0, x2: hx, y1: cy, y2: cy, class: 'c-stem' }, rg), 200 + i * 50, 600);
    pop(c, glyph(rg, v.f, hx, cy, 4.6, 'c-head o-c'), 650 + i * 50);
    if (!i) fade(c, T(rg, hx + 10, cy + 4, [[fmtPct(v.p), 'c-s']], 'c-a'), 1100);
    return rg;
  });
  return {
    pts: V.map((v, i) => ({ x: xs(v.p), y: top + i * rh + (stack ? 28 : rh / 2), tip: { h: v.title, r: [[FMT[v.f]], ['', full(v.likes), ' likes ÷ ', full(v.views), ' views = ', fmtPct(v.p)], [v.credit]] } })),
    hit: rowHit(top, rh, n),
    mark: (i) => tog(rows, i),
    def: 0,
  };
};

/* accessible data tables */
const medCell = (q) => (q.count ? full(q.medianViews) + (q.count < LOW ? ' (too few videos)' : '') : '0');
const TB = {
  Y1: ({ y }) => [[['Month', 'Total views so far', 'Views this month', 'Different posts', 'Posts with repeats'], y.months.map((d) => [fmtDate(d.m), full(d.cumulativeUniqueViews), full(d.uniqueViews), d.uniquePosts, d.posts])]],
  Y2: ({ y }) => [[['Month', 'Views (no repeats)', 'Posts (with repeats)', 'Different posts'], y.months.map((d) => [fmtDate(d.m), full(d.uniqueViews), d.posts, d.uniquePosts])]],
  Y4: ({ y }) => [[['Hour (IST)', 'Videos', 'Views of a typical video'], y.byHourIST.map((b) => [hh(b.hourIST), b.count, medCell(b)])]],
  Y3: ({ y }) => [[['Day', 'Block (IST)', 'Videos', 'Views of a typical video'], [1, 2, 3, 4, 5, 6, 0].flatMap((d) => y.heatmapIST.filter((q) => q.dow === d).sort((a, b) => a.block - b.block).map((q) => [DAYS[d], blk(q.block), q.count, medCell(q)]))]],
  Y5: ({ y }) => {
    const P = y.posts.filter((p) => p.unique).sort((a, b) => b.views - a.views), cnt = bCount(P.map((p) => p.views));
    return [[['Views', 'Videos'], bLab().map((t, i) => [t, cnt[i]])], [['Rank', 'Date', 'Views'], P.map((p, i) => [i + 1, fmtDate(p.date), full(p.views)]), 'Every dot is one video.']];
  },
  Y6: ({ y }) => [[['Rank', 'Date', 'Views', 'Link'], y.top10.map((d, i) => [i + 1, fmtDate(d.date), full(d.views), { a: d.link, t: 'Open on Facebook' }])]],
  K1: ({ k }) => [[['Title', 'Format', 'Length', 'Views', 'Credit'], edits(k).sort((a, b) => b.views - a.views).map((v) => [v.title, FMT[v.f], fmtDuration(v.seconds), full(v.views), v.credit])]],
  K2: ({ k }) => {
    const V = edits(k).sort((a, b) => b.likes / b.views - a.likes / a.views);
    const rows = V.map((v) => [v.title, FMT[v.f], full(v.likes), full(v.views), fmtPct(v.likes / v.views)]);
    F3.forEach((f) => { const [l, w] = pooled(V, f); rows.push([`${FMTS[f]} average`, FMT[f], full(l), full(w), fmtPct(l / w)]); });
    return [[['Title', 'Format', 'Likes', 'Views', 'Likes per view'], rows]];
  },
};
const isNum = (v) => typeof v === 'number' || /^[\d,.]+%?( \(|$)/.test(v);
function fillTable(st) {
  const box = st.fig.querySelector('.chart__table');
  if (!box) return;
  const title = (st.fig.querySelector('.chart__title') || {}).textContent || st.key;
  box.replaceChildren();
  for (const [head, rows, cap] of TB[st.key](D)) {
    const t = E('table', null, box), nc = head.map((_, j) => rows.length > 0 && isNum(rows[0][j]));
    E('caption', cap ? 'is-shown' : null, t, cap || title.trim());
    const tr = E('tr', null, E('thead', null, t));
    head.forEach((h, j) => { E('th', nc[j] ? 'n' : null, tr, h).scope = 'col'; });
    const tb = E('tbody', null, t);
    for (const r of rows) {
      const row = E('tr', null, tb);
      r.forEach((v, j) => {
        const td = E(j ? 'td' : 'th', nc[j] ? 'n' : null, row);
        if (!j) td.scope = 'row';
        if (v && v.a) {
          const a = E('a', null, td, v.t);
          a.href = v.a; a.target = '_blank'; a.rel = 'noopener';
          td.append(' (you may need to log in)');
        } else td.textContent = String(v);
      });
    }
  }
}

/* shared tooltip + interaction */
const tipText = (t) => [t.h, ...t.r.map((r) => r.join('')), t.n].filter(Boolean).join(' · ');
function place(st, cx, cy) {
  const p = st.api.pts[st.idx];
  if (cx == null) { const r = st.svg.getBoundingClientRect(); cx = r.left + p.x; cy = r.top + p.y; }
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let x = cx + 16, y = cy + 16;
  if (x + w > innerWidth - 8) x = Math.max(8, cx - w - 16);
  if (y + h > innerHeight - 8) y = Math.max(8, cy - h - 16);
  tip.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
}
function show(st, i, cx, cy, kb) {
  const p = st.api && st.api.pts[i];
  if (!p) return;
  if (active && active !== st) hide(active);
  active = st; st.idx = i; st.kb = !!kb;
  st.api.mark(i);
  tip.replaceChildren();
  E('div', 'chart-tip__h', tip, p.tip.h);
  for (const r of p.tip.r) {
    const d = E('div', 'chart-tip__r', tip);
    r.forEach((s, j) => { if (j % 2) E('b', null, d, s); else if (s) d.append(s); }); // odd runs = values
  }
  if (p.tip.n) E('div', 'chart-tip__n', tip, p.tip.n);
  if (kb) E('div', 'chart-tip__k', tip, 'Use ← and → to move');
  tip.hidden = false;
  place(st, cx, cy);
  if (kb) live.textContent = tipText(p.tip);
}
function hide(st) {
  if (!st) return;
  if (active === st) { tip.hidden = true; active = null; }
  if (st.api) st.api.mark(-1);
  st.kb = false;
}
function bind(st) {
  const m = st.mount, on = (t, f) => m.addEventListener(t, f);
  m.tabIndex = 0;
  const hitAt = (e) => {
    if (!st.api || !st.svg) return -1;
    const r = st.svg.getBoundingClientRect();
    return st.api.hit(e.clientX - r.left, e.clientY - r.top);
  };
  const showAt = (e) => { const i = hitAt(e); if (i >= 0) show(st, i, e.clientX, e.clientY); else if (!st.kb) hide(st); };
  on('pointermove', showAt);
  on('pointerleave', (e) => { if (e.pointerType === 'mouse' && !st.kb) hide(st); });
  on('pointerdown', (e) => {
    st.ptype = e.pointerType;
    st.prev = active === st && !tip.hidden ? st.idx : -1;
    if (e.pointerType !== 'mouse') showAt(e);
  });
  on('click', (e) => { // touch: first tap shows, second tap on the same mark opens
    const i = hitAt(e);
    if (st.api && st.api.act && i >= 0 && (st.ptype === 'mouse' || st.prev === i)) st.api.act(i);
  });
  on('focus', () => { if (st.api && m.matches(':focus-visible')) show(st, st.idx ?? st.api.def ?? 0, null, null, true); });
  on('blur', () => { if (st.kb) hide(st); });
  on('keydown', (e) => {
    const api = st.api;
    if (!api) return;
    const n = api.pts.length, k = e.key, i = st.idx ?? api.def ?? 0;
    if (k === 'Escape') { hide(st); return; }
    if ((k === 'Enter' || k === ' ') && api.act && active === st) { e.preventDefault(); api.act(i); return; }
    const s = api.step ? api.step(i, k) : null;
    let j = s != null ? s : k === 'ArrowRight' || k === 'ArrowDown' ? i + 1 : k === 'ArrowLeft' || k === 'ArrowUp' ? i - 1 : k === 'Home' ? 0 : k === 'End' ? n - 1 : null;
    if (j == null) return;
    e.preventDefault();
    if (active !== st) j = i; // first press shows the current point
    if (j < 0 || j >= n) j = api.wrap ? (j + n) % n : i;
    show(st, j, null, null, true);
  });
}

/* lifecycle */
function draw(st, animate) {
  const W = Math.floor(st.mount.clientWidth);
  if (!W) return;
  clearInterval(st.timer);
  st.anims.forEach((a) => a.cancel());
  st.anims = [];
  if (active === st) hide(st);
  const svg = S('svg', { class: 'chart__svg', 'aria-hidden': 'true', focusable: 'false' });
  st.mount.replaceChildren(svg);
  st.lg.replaceChildren();
  st.svg = svg; st.W = W;
  st.api = R[st.key]({ svg, W, cp: W < 560, y: D.y, k: D.k, A: animate ? getMotion() : 'off', lg: st.lg, st });
  st.mount.classList.add('is-ready');
  fillTable(st);
}
function start(fig) {
  const key = String(fig.dataset.chart || '').toUpperCase(), mount = fig.querySelector('.chart__mount');
  if (!R[key] || !mount || byMount.has(mount)) return;
  const st = { fig, key, mount, v: {}, anims: [], hold: true, idx: null, lg: E('div', 'chart__legend') };
  byMount.set(mount, st);
  if (TOPLEG[key]) mount.before(st.lg); else mount.after(st.lg);
  const wait = setTimeout(() => { if (!st.api) mount.replaceChildren(E('p', 'chart__loading', null, 'Loading the data')); }, 400);
  load().then(() => {
    clearTimeout(wait);
    states.push(st);
    bind(st);
    draw(st, getMotion() !== 'off');
    const det = fig.querySelector('.chart__data'), sm = det && det.querySelector('summary');
    if (sm) det.addEventListener('toggle', () => { sm.textContent = det.open ? 'Hide data' : 'View data'; });
    playIO.observe(mount);
    let t;
    new ResizeObserver(() => {
      clearTimeout(t);
      t = setTimeout(() => { if (Math.floor(mount.clientWidth) !== st.W) draw(st, false); }, 140);
    }).observe(mount);
  }).catch((e) => {
    clearTimeout(wait);
    mount.replaceChildren();
    byMount.delete(mount);
    console.error('charts:', e);
  });
}

export function initCharts() {
  if (tip) return;
  const figs = document.querySelectorAll('figure.chart[data-chart]');
  if (!figs.length) return;
  tip = at(E('div', 'chart-tip', document.body), { 'aria-hidden': 'true' });
  tip.hidden = true;
  live = at(E('div', 'chart-live', document.body), { 'aria-live': 'polite' });
  const release = (st) => {
    if (!st.hold) return;
    playIO.unobserve(st.mount);
    st.hold = false;
    st.anims.forEach((a) => a.play());
    st.anims = [];
  };
  playIO = new IntersectionObserver((es) => es.forEach((e) => {
    const st = e.isIntersecting && byMount.get(e.target);
    if (st) release(st);
  }), { threshold: 0.2 });
  // Safety net: if an observer callback is late or missed, a held chart would stay blank, so also check on scroll.
  let chk = 0;
  const check = () => {
    chk = 0;
    const vh = innerHeight;
    states.forEach((st) => {
      if (!st.hold) return;
      const r = st.mount.getBoundingClientRect();
      if (r.top < vh * 0.85 && r.bottom > vh * 0.15) release(st);
    });
  };
  addEventListener('scroll', () => { if (!chk && states.some((st) => st.hold)) chk = requestAnimationFrame(check); }, { passive: true });
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { io.unobserve(e.target); start(e.target); }
  }), { rootMargin: '200px 0px' });
  figs.forEach((f) => io.observe(f));
  // Render every chart soon after load so the page height is final and in-page links land where they should.
  // Draw-in animations stay held until each chart is actually on screen (playIO).
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 300));
  idle(() => figs.forEach(start), { timeout: 2500 });
  const settle = () => states.forEach((st) => {
    st.anims.forEach((a) => a.finish && a.finish());
    st.anims = [];
    st.hold = false;
  });
  addEventListener('motion:change', () => { if (getMotion() === 'off') { settle(); states.forEach((st) => draw(st, false)); } });
  addEventListener('beforeprint', settle);
  addEventListener('units:change', () => states.forEach((st) => draw(st, false)));
  document.addEventListener('pointerdown', (e) => { if (active && !active.mount.contains(e.target)) hide(active); }, true);
  addEventListener('scroll', () => { if (!active) return; if (active.kb) place(active); else hide(active); }, { passive: true });
}

/* Decorative mirrored waveform of monthly views for the dock; colour = the canvas's CSS color */
export async function drawWaveform(canvas) {
  if (!canvas) return;
  const { y } = await load();
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1), v = y.months.map((d) => d.uniqueViews), max = Math.max(...v), bw = w / v.length;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  const g = canvas.getContext('2d');
  g.scale(dpr, dpr);
  g.fillStyle = getComputedStyle(canvas).color;
  v.forEach((n, i) => {
    const a = Math.max(0.75, Math.sqrt(n / max) * (h / 2 - 1));
    g.globalAlpha = 0.3 + 0.7 * (n / max);
    g.fillRect(i * bw + bw * 0.2, h / 2 - a, Math.max(1, bw * 0.6), a * 2);
  });
}
