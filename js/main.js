// main.js (SHELL entry module): units swap, motion toggle, header, timeline dock and scroll progress,
// section cuts, reveals, counters, card tilt, edit bay, dialogs (brief, player, menu), toasts, module boot.
import { getMotion, setMotion, getUnits, setUnits, motionAllowed } from './state.js';

const root = document.documentElement;
root.classList.add('js');

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const on = (t, e, f, o) => t && t.addEventListener(e, f, o);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const raf = (f) => requestAnimationFrame(f);
const mq = (q) => window.matchMedia(q).matches;
const FRAMES = 10500; // the page is a 7-minute sequence at 25 fps

/* ---------- Units ---------- */
const unitText = (el) => (getUnits() === 'indian' ? el.dataset.indian : el.dataset.intl);
const finalText = (el) => (el.dataset.intl ? unitText(el) : el.dataset.final || el.textContent);

function fitStat(el) {
  const v = el.closest('.stat__value');
  if (v) v.style.setProperty('--len', String(Math.max(4, finalText(el).length)));
}
function applyUnits() {
  const u = getUnits();
  $$('[data-intl][data-indian]').forEach((el) => {
    if (!el.dataset.counting) el.textContent = u === 'indian' ? el.dataset.indian : el.dataset.intl;
  });
  $$('[data-count]').forEach(fitStat);
  $$('[data-units-set]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.unitsSet === u)));
}
$$('[data-units-set]').forEach((b) => on(b, 'click', () => setUnits(b.dataset.unitsSet)));
on(window, 'units:change', applyUnits);

/* ---------- Motion ---------- */
const MOTION_LABEL = { full: 'Full', calm: 'Calm', off: 'Off' };
const ORDER = ['full', 'calm', 'off'];
function applyMotion() {
  const m = getMotion();
  $$('[data-motion-label]').forEach((s) => { s.textContent = MOTION_LABEL[m]; });
  let stored = null;
  try { stored = localStorage.getItem('abi.motion'); } catch { /* storage blocked */ }
  const fromDevice = !stored && mq('(prefers-reduced-motion: reduce)');
  $$('[data-motion-note]').forEach((n) => { n.hidden = !fromDevice; });
}
$$('[data-motion-cycle]').forEach((b) => on(b, 'click', () => setMotion(ORDER[(ORDER.indexOf(getMotion()) + 1) % 3])));
on(window, 'motion:change', () => { applyMotion(); if (!motionAllowed()) finishAll(); });

/* ---------- Toast + clipboard ---------- */
const toastEl = $('#toast');
let toastT = 0, toastGen = 0;
function toast(msg) {
  if (!toastEl) return;
  // An open modal makes everything outside it inert, so host the toast inside it to keep it announced.
  const host = $('dialog[open]') || document.body;
  if (toastEl.parentElement !== host) host.append(toastEl);
  const pop = typeof toastEl.showPopover === 'function';
  const gen = ++toastGen;
  clearTimeout(toastT);
  if (pop) { try { toastEl.hidePopover(); } catch { /* not open */ } try { toastEl.showPopover(); } catch { /* unsupported */ } }
  toastEl.classList.remove('is-on');
  toastEl.textContent = msg;
  raf(() => raf(() => toastEl.classList.add('is-on')));
  toastT = setTimeout(() => {
    toastEl.classList.remove('is-on');
    if (pop) setTimeout(() => { if (gen === toastGen) { try { toastEl.hidePopover(); } catch { /* closed */ } } }, 360);
  }, 2200);
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;opacity:0';
    ($('dialog[open]') || document.body).append(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}
const briefLink = () => `${location.origin}${location.pathname}#brief`;
$$('[data-copy], [data-copy-link]').forEach((b) => on(b, 'click', async () => {
  const text = b.hasAttribute('data-copy-link') ? briefLink() : b.dataset.copy;
  toast((await copyText(text)) ? b.dataset.toast : text);
}));
$$('[data-print]').forEach((b) => on(b, 'click', () => window.print()));
const shareBtn = $('[data-share]');
if (shareBtn && navigator.share) {
  shareBtn.hidden = false;
  on(shareBtn, 'click', () => navigator.share({ title: 'Hire brief | Abirich Vaithiyalingam', url: briefLink() }).catch(() => {}));
}

/* ---------- Dialogs: shared behaviour ---------- */
$$('dialog').forEach((d) => {
  // Close on backdrop clicks only when the press also started on the backdrop (a text selection
  // that ends outside the panel must not close it).
  let downOnBackdrop = false;
  on(d, 'pointerdown', (e) => { downOnBackdrop = e.target === d; });
  on(d, 'click', (e) => { if (e.target === d && downOnBackdrop) d.close(); downOnBackdrop = false; });
  $$('[data-close]', d).forEach((b) => on(b, 'click', () => d.close()));
});

// Menu sheet
const menu = $('#menu');
const menuBtn = $('.menu-btn');
on(menuBtn, 'click', () => { menu.showModal(); menuBtn.setAttribute('aria-expanded', 'true'); });
on(menu, 'close', () => menuBtn.setAttribute('aria-expanded', 'false'));
$$('a[href^="#"]', menu).forEach((a) => on(a, 'click', () => menu.close()));

// Player
const player = $('#player');
const pFrame = $('#player-frame');
function openPlayer(b) {
  const { video, format, title } = b.dataset;
  const start = parseInt(b.dataset.start || '0', 10) || 0;
  const short = format === 'short';
  player.classList.toggle('player--short', short);
  pFrame.dataset.ratio = short ? '9x16' : '16x9';
  $('#player-title').textContent = `${title}, edited by Abirich`;
  const f = document.createElement('iframe');
  f.src = `https://www.youtube-nocookie.com/embed/${video}?start=${start}&autoplay=1&rel=0`;
  f.title = title;
  f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  f.allowFullscreen = true;
  f.referrerPolicy = 'strict-origin-when-cross-origin';
  pFrame.replaceChildren(f);
  $('#player-yt').href = short ? `https://www.youtube.com/shorts/${video}` : `https://www.youtube.com/watch?v=${video}${start ? `&t=${start}s` : ''}`;
  player.showModal();
}
$$('.edit__btn').forEach((b) => on(b, 'click', () => openPlayer(b)));
on(player, 'close', () => pFrame.replaceChildren());

// Hire brief
const brief = $('#brief');
const baseTitle = document.title;
function openBrief() {
  if (menu.open) { menu.close(); menuBtn.focus(); }   // so focus returns to the menu button when the brief closes
  if (player.open) player.close();
  if (!brief.open) brief.showModal();
  document.title = 'Hire brief | Abirich Vaithiyalingam';
  root.classList.add('brief-open');
  if (location.hash !== '#brief') history.replaceState(null, '', '#brief');
}
$$('[data-open-brief]').forEach((b) => on(b, 'click', openBrief));
on(brief, 'close', () => {
  document.title = baseTitle;
  root.classList.remove('brief-open');
  if (location.hash === '#brief') history.replaceState(null, '', location.pathname + location.search);
});
on(window, 'hashchange', () => { if (location.hash === '#brief') openBrief(); });

/* ---------- Edit bay filter ---------- */
const tracks = $$('#edits .track');
function setFilter(f) {
  $$('[data-filter-set]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filterSet === f)));
  tracks.forEach((t) => { t.hidden = f !== 'all' && t.dataset.format !== f; });
}
$$('[data-filter-set]').forEach((b) => on(b, 'click', () => setFilter(b.dataset.filterSet)));
$$('a[data-filter]').forEach((a) => on(a, 'click', () => setFilter(a.dataset.filter)));

/* ---------- Scroll engine: progress, timecode, dock ---------- */
const header = $('#site-header');
const dock = $('#seq-dock');
const sections = $$('main [data-chapter]');
const tcOut = $$('[data-tc-out]');
const dockChapter = $('#dock-chapter');
const ruler = $('#dock-ruler');
const timeline = $('#dock-timeline');
const clipsOl = $('#dock-clips');
const navLinks = $$('.nav a[data-nav]');
let chapters = [];
let maxScroll = 1, curIdx = -1, lastFrame = -1, lastPct = -1, ticking = false;

const tc = (f) => [Math.floor(f / 90000), Math.floor(f / 1500) % 60, Math.floor(f / 25) % 60, f % 25]
  .map((n) => String(n).padStart(2, '0')).join(':');

clipsOl.innerHTML = sections.map((s) => `<li class="clip${s.classList.contains('case') ? ' clip--case' : ''}"><a href="#${s.id}" title="${s.dataset.chapter}">${s.dataset.chapter}</a></li>`).join('');

function layout() {
  maxScroll = Math.max(1, root.scrollHeight - innerHeight);
  const off = innerHeight * 0.35;
  const tops = sections.map((el) => el.getBoundingClientRect().top + scrollY);
  chapters = sections.map((el, i) => ({ el, id: el.id, name: el.dataset.chapter, start: i ? clamp((tops[i] - off) / maxScroll) : 0 }));
  chapters.forEach((c, i) => { c.end = i < chapters.length - 1 ? chapters[i + 1].start : 1; });
  Array.from(clipsOl.children).forEach((li, i) => {
    const c = chapters[i];
    li.style.left = `${(c.start * 100).toFixed(3)}%`;
    li.style.width = `${Math.max(0, (c.end - c.start) * 100).toFixed(3)}%`;
  });
  chapters.forEach((c) => { const s = $('[data-tc]', c.el); if (s) s.textContent = tc(Math.round(c.start * FRAMES)); });
  update(true);
  drawWave();
}

// Dock waveform: redrawn on every layout so it follows resizes and rotations.
let chartsMod = null, waveW = 0;
function drawWave() {
  const wave = $('#dock-wave');
  if (!chartsMod || typeof chartsMod.drawWaveform !== 'function' || !wave) return;
  const w = wave.clientWidth;
  if (!w || w === waveW) return;
  waveW = w;
  Promise.resolve(chartsMod.drawWaveform(wave)).catch(console.error);
}

function setChapter(ch) {
  dockChapter.textContent = ch.name;
  Array.from(clipsOl.children).forEach((li, i) => li.classList.toggle('is-active', i === curIdx));
  navLinks.forEach((a) => {
    if (a.dataset.nav.split(' ').includes(ch.id)) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  });
}

function update(force) {
  const p = clamp(scrollY / maxScroll);
  // Only the header progress bar and the dock playhead read this; setting it on <html> would restyle the whole page each frame.
  const pv = p.toFixed(4);
  header.style.setProperty('--scroll-p', pv);
  if (dock) dock.style.setProperty('--scroll-p', pv);
  header.classList.toggle('is-scrolled', scrollY > 40);
  const frame = Math.round(p * FRAMES);
  if (frame !== lastFrame) { lastFrame = frame; const t = tc(frame); tcOut.forEach((n) => { n.textContent = t; }); }
  let idx = 0;
  for (let i = 0; i < chapters.length; i++) if (p >= chapters[i].start - 1e-6) idx = i;
  const ch = chapters[idx];
  if (!ch) return;
  if (idx !== curIdx || force === true) { curIdx = idx; setChapter(ch); }
  const pct = Math.round(p * 100);
  if (pct !== lastPct || force === true) {
    lastPct = pct;
    ruler.setAttribute('aria-valuenow', String(pct));
    ruler.setAttribute('aria-valuetext', `${ch.name}, ${pct}%`);
  }
  window.dispatchEvent(new CustomEvent('seq:progress', { detail: { p, chapter: ch.name } }));
}
on(window, 'scroll', () => {
  if (ticking) return;
  ticking = true;
  raf(() => { ticking = false; update(); });
}, { passive: true });

let layoutT = 0;
const layoutSoon = () => { clearTimeout(layoutT); layoutT = setTimeout(layout, 120); };
on(window, 'resize', layoutSoon);
on(window, 'load', layoutSoon);
if (window.ResizeObserver) new ResizeObserver(layoutSoon).observe(document.body);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutSoon);

// Scrubbing: drag anywhere on the timeline; a plain click on a clip follows its link.
const jump = (p) => window.scrollTo({ top: clamp(p) * maxScroll, behavior: 'instant' });
const scrubTo = (x) => { const r = timeline.getBoundingClientRect(); jump((x - r.left) / r.width); };
let drag = null, suppressClick = false;
on(timeline, 'pointerdown', (e) => {
  if (e.button !== 0) return;
  suppressClick = false;
  drag = { id: e.pointerId, x: e.clientX, active: !e.target.closest('a') };
  if (drag.active) { e.preventDefault(); timeline.setPointerCapture(e.pointerId); scrubTo(e.clientX); }
});
on(timeline, 'pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  if (!drag.active && Math.abs(e.clientX - drag.x) > 5) { drag.active = true; suppressClick = true; timeline.setPointerCapture(e.pointerId); }
  if (drag.active) scrubTo(e.clientX);
});
const endDrag = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
on(timeline, 'pointerup', endDrag);
on(timeline, 'pointercancel', endDrag);
on(timeline, 'click', (e) => { if (suppressClick) { e.preventDefault(); e.stopPropagation(); suppressClick = false; } }, true);
on(ruler, 'keydown', (e) => {
  const p = clamp(scrollY / maxScroll);
  const step = { ArrowRight: 0.02, ArrowUp: 0.02, ArrowLeft: -0.02, ArrowDown: -0.02, PageDown: 0.1, PageUp: -0.1 }[e.key];
  let np;
  if (step !== undefined) np = p + step;
  else if (e.key === 'Home') np = 0;
  else if (e.key === 'End') np = 1;
  else return;
  e.preventDefault();
  jump(np);
});

/* ---------- Section cuts, slates, reveals, counters ---------- */
function typeSlate(el) {
  const full = el.dataset.full || el.textContent;
  if (!motionAllowed()) { el.textContent = full; return; }
  let i = 0;
  const tick = () => {
    i += 1;
    el.textContent = full.slice(0, Math.ceil((full.length * i) / 8)) + (i < 8 ? '_' : '');
    if (i < 8) setTimeout(tick, 40); // 8 frames at 25 fps
  };
  tick();
}

function countUp(el) {
  const text = finalText(el);
  const m = text.match(/^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/);
  if (!m || !motionAllowed()) { el.textContent = text; return; }
  const [, pre, num, post] = m;
  const target = parseFloat(num.replace(/,/g, ''));
  const dec = (num.split('.')[1] || '').length;
  const dur = getMotion() === 'calm' ? 700 : 1500;
  const t0 = performance.now();
  el.dataset.counting = '1';
  const step = (now) => {
    if (!el.dataset.counting) return;
    const t = clamp((now - t0) / dur);
    const eased = t === 1 ? 1 : 1 - 2 ** (-10 * t);
    el.textContent = pre + (target * eased).toFixed(dec) + post;
    if (t < 1) raf(step);
    else { delete el.dataset.counting; el.textContent = finalText(el); }
  };
  raf(step);
}
const zeroOf = (text) => text.replace(/\d[\d,]*(?:\.(\d+))?/, (_, d) => (d ? `0.${'0'.repeat(d.length)}` : '0'));

function show(el) {
  if (!el.classList.contains('rv')) return;
  el.classList.add('rv-in');
  el.classList.remove('rv');
  setTimeout(() => el.classList.remove('rv-in'), 1300);
}
function finishAll() {
  $$('.rv').forEach((el) => el.classList.remove('rv'));
  $$('[data-count]').forEach((el) => { delete el.dataset.counting; el.textContent = finalText(el); });
  $$('[data-slate]').forEach((el) => { el.textContent = el.dataset.full || el.textContent; });
}

const io = (cb, rootMargin) => new IntersectionObserver((entries, obs) => entries.forEach((en) => cb(en, obs)), { rootMargin });
const secIO = io((en) => {
  const s = en.target;
  s.classList.toggle('in-view', en.isIntersecting);
  if (en.isIntersecting && !s.classList.contains('is-cut')) {
    s.classList.add('is-cut');
    const sl = $('[data-slate]', s);
    if (sl) typeSlate(sl);
  }
}, '0px 0px -18% 0px');
const revIO = io((en, obs) => { if (en.isIntersecting) { show(en.target); obs.unobserve(en.target); } }, '0px 0px -6% 0px');
const countIO = io((en, obs) => { if (en.isIntersecting) { countUp(en.target); obs.unobserve(en.target); } }, '0px 0px -10% 0px');

function initSequence() {
  const vh = innerHeight;
  const reveal = $$('[data-reveal]');
  const slates = $$('[data-slate]');
  const counts = $$('[data-count]');
  // Measure everything first, then write, so the page lays out once.
  const below = (el) => el.getBoundingClientRect().top > vh * 0.94;
  const rb = reveal.map(below), sb = slates.map(below), cb = counts.map(below);
  const moving = motionAllowed();
  slates.forEach((s, i) => { s.dataset.full = s.textContent; if (moving && sb[i]) s.textContent = ''; });
  counts.forEach((el, i) => {
    if (!el.dataset.intl) el.dataset.final = el.textContent;
    fitStat(el);
    if (moving && cb[i]) el.textContent = zeroOf(finalText(el));
    countIO.observe(el);
  });
  if (moving) {
    reveal.forEach((el, i) => {
      if (!rb[i]) return;
      const sibs = Array.from(el.parentNode.children).filter((c) => c.hasAttribute('data-reveal'));
      el.style.setProperty('--d', `${(sibs.indexOf(el) % 4) * 70}ms`);
      el.classList.add('rv');
      revIO.observe(el);
    });
  }
  $$('.section').forEach((s) => secIO.observe(s));
}

/* ---------- Card tilt (desktop, fine pointer, motion full) ---------- */
function initTilt() {
  const allowed = () => getMotion() === 'full' && innerWidth >= 1024 && mq('(hover: hover) and (pointer: fine)');
  $$('[data-tilt]').forEach((el) => {
    let pt = null, frame = 0;
    const paint = () => {
      frame = 0;
      if (!pt) return;
      const r = el.getBoundingClientRect();
      const x = clamp((pt.x - r.left) / r.width), y = clamp((pt.y - r.top) / r.height);
      el.style.setProperty('--rx', `${((x - 0.5) * 12).toFixed(2)}deg`);
      el.style.setProperty('--ry', `${((0.5 - y) * 12).toFixed(2)}deg`);
      el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    };
    on(el, 'pointerenter', (e) => { if (e.pointerType === 'mouse' && allowed()) el.classList.add('is-tilting'); });
    on(el, 'pointermove', (e) => {
      if (!el.classList.contains('is-tilting')) return;
      pt = { x: e.clientX, y: e.clientY };
      if (!frame) frame = raf(paint);
    });
    on(el, 'pointerleave', () => {
      pt = null;
      el.classList.remove('is-tilting');
      ['--rx', '--ry'].forEach((k) => el.style.removeProperty(k));
    });
  });
}

/* ---------- Boot ---------- */
applyUnits();
applyMotion();
initSequence();
initTilt();
layout();
if (location.hash === '#brief') openBrief();

const idle = window.requestIdleCallback || ((f) => setTimeout(f, 200));
import('./charts.js').then((m) => {
  chartsMod = m;
  m.initCharts();
  drawWave();
}).catch(console.error);
// Printing: show final counter values instead of mid-animation ones.
on(window, 'beforeprint', finishAll);
const bootHero = () => idle(() => import('./hero.js').then((m) => m.initHero()).catch(console.error));
if (document.readyState === 'complete') bootHero();
else window.addEventListener('load', bootHero, { once: true });
