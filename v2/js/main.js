// main.js (Version 2 SHELL entry module): units swap, motion toggle, nav state, reveals, counters,
// edit bay filter, dialogs (menu, hire brief, video player) with scroll lock, toast, clipboard, print,
// then boots the shared charts (../../js/charts.js) and the hero (./hero.js).
import { getMotion, setMotion, getUnits, setUnits, motionAllowed } from '../../js/state.js';

const root = document.documentElement;
root.classList.add('js');

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const on = (t, e, f, o) => t && t.addEventListener(e, f, o);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const raf = (f) => requestAnimationFrame(f);
const mq = (q) => window.matchMedia(q).matches;

/* ---------- Units ---------- */
const unitText = (el) => (getUnits() === 'indian' ? el.dataset.indian : el.dataset.intl);
const finalText = (el) => (el.dataset.intl ? unitText(el) : el.dataset.final || el.textContent);

// Big stat numbers scale to their tile width (see .stat__value in v2.css): --len is the character count.
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

/* ---------- Toast + clipboard + print ---------- */
const toastEl = $('#toast');
let toastT = 0, toastGen = 0;
function toast(msg) {
  if (!toastEl) return;
  // An open modal makes everything outside it inert, so host the toast inside it to keep it visible and announced.
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

/* ---------- Dialogs: shared behaviour + scroll lock ---------- */
// CSS locks the page with html:has(dialog[open]); the class is the fallback for browsers without :has().
const syncLock = () => root.classList.toggle('is-locked', $$('dialog').some((d) => d.open));
function openModal(d) {
  if (!d) return;
  if (!d.open) d.showModal();
  syncLock();
}
$$('dialog').forEach((d) => {
  // Close on backdrop clicks only when the press also started on the backdrop (a text selection
  // that ends outside the panel must not close it).
  let downOnBackdrop = false;
  on(d, 'pointerdown', (e) => { downOnBackdrop = e.target === d; });
  on(d, 'click', (e) => { if (e.target === d && downOnBackdrop) d.close(); downOnBackdrop = false; });
  $$('[data-close]', d).forEach((b) => on(b, 'click', () => d.close()));
  on(d, 'close', syncLock);
});

// Menu sheet (mobile and tablet)
const menu = $('#menu');
const menuBtn = $('.menu-btn');
on(menuBtn, 'click', () => { openModal(menu); menuBtn.setAttribute('aria-expanded', 'true'); });
on(menu, 'close', () => menuBtn && menuBtn.setAttribute('aria-expanded', 'false'));
$$('a[href^="#"]', menu).forEach((a) => on(a, 'click', () => menu.close()));

// Video player
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
  f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; // "fullscreen" here replaces the old allowfullscreen attribute
  f.referrerPolicy = 'strict-origin-when-cross-origin';
  pFrame.replaceChildren(f);
  $('#player-yt').href = short ? `https://www.youtube.com/shorts/${video}` : `https://www.youtube.com/watch?v=${video}${start ? `&t=${start}s` : ''}`;
  openModal(player);
}
$$('.edit__btn').forEach((b) => on(b, 'click', () => openPlayer(b)));
on(player, 'close', () => pFrame.replaceChildren());

// Hire brief (deep link: #brief)
const brief = $('#brief');
const baseTitle = document.title;
function openBrief() {
  if (menu.open) { menu.close(); if (menuBtn) menuBtn.focus(); } // so focus returns to the menu button when the brief closes
  if (player.open) player.close();
  openModal(brief);
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
const lanes = $$('#edits .lane');
function setFilter(f) {
  $$('[data-filter-set]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filterSet === f)));
  lanes.forEach((t) => { t.hidden = f !== 'all' && t.dataset.format !== f; });
}
$$('[data-filter-set]').forEach((b) => on(b, 'click', () => setFilter(b.dataset.filterSet)));
$$('a[data-filter]').forEach((a) => on(a, 'click', () => setFilter(a.dataset.filter)));

/* ---------- Nav: solid after scroll, current section ---------- */
const nav = $('#nav');
let navTick = false;
const paintNav = () => { navTick = false; if (nav) nav.classList.toggle('is-scrolled', scrollY > 24); };
on(window, 'scroll', () => { if (!navTick) { navTick = true; raf(paintNav); } }, { passive: true });
paintNav();

const navLinks = $$('.nav__links a[data-nav]');
function setCurrent(id) {
  navLinks.forEach((a) => {
    if (a.dataset.nav.split(' ').includes(id)) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  });
}
if ('IntersectionObserver' in window) {
  // The chart grids sit inside the case sections: entering one marks "Growth"; leaving it hands the mark back to the
  // section around it if the trigger line (45-50% down the screen) is still inside that section.
  const navIO = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) { setCurrent(en.target.id); return; }
    if (!en.target.classList.contains('chart-grid')) return;
    const s = en.target.closest('section[id]');
    const r = s && s.getBoundingClientRect();
    const line = innerHeight * 0.475;
    if (r && r.top < line && r.bottom > line) setCurrent(s.id);
  }), { rootMargin: '-45% 0px -50% 0px' });
  $$('main > section[id], main > .hero-pin > section[id], main .chart-grid[id]').forEach((s) => navIO.observe(s));
}

/* ---------- Reveals + counters ---------- */
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
}

function initReveals() {
  const counts = $$('[data-count]');
  counts.forEach((el) => { if (!el.dataset.intl) el.dataset.final = el.textContent; fitStat(el); });
  if (!('IntersectionObserver' in window)) return;
  const vh = innerHeight;
  const reveal = $$('[data-reveal]');
  // Measure everything first, then write, so the page lays out once.
  const below = (el) => el.getBoundingClientRect().top > vh * 0.94;
  const rb = reveal.map(below), cb = counts.map(below);
  const moving = motionAllowed();
  const io = (cb2, rootMargin) => new IntersectionObserver((entries, obs) => entries.forEach((en) => cb2(en, obs)), { rootMargin });
  const revIO = io((en, obs) => { if (en.isIntersecting) { show(en.target); obs.unobserve(en.target); } }, '0px 0px -6% 0px');
  const countIO = io((en, obs) => { if (en.isIntersecting) { countUp(en.target); obs.unobserve(en.target); } }, '0px 0px -10% 0px');
  counts.forEach((el, i) => {
    if (moving && cb[i]) el.textContent = zeroOf(finalText(el));
    countIO.observe(el);
  });
  if (!moving) return;
  reveal.forEach((el, i) => {
    if (!rb[i]) return;
    const sibs = Array.from(el.parentNode.children).filter((c) => c.hasAttribute('data-reveal'));
    el.style.setProperty('--d', `${(sibs.indexOf(el) % 4) * 80}ms`);
    el.classList.add('rv');
    revIO.observe(el);
  });
  // Safety net: if an observer callback is missed (fast jumps, odd browsers), show what is on screen once scrolling settles.
  let settleT = 0;
  on(window, 'scroll', () => {
    clearTimeout(settleT);
    settleT = setTimeout(() => {
      const h = innerHeight;
      $$('.rv').forEach((el) => { const r = el.getBoundingClientRect(); if (r.top < h && r.bottom > 0) show(el); });
    }, 220);
  }, { passive: true });
}

/* ---------- Boot ---------- */
applyUnits();
applyMotion();
initReveals();
if (location.hash === '#brief') openBrief();
on(window, 'beforeprint', finishAll); // print final counter values, not mid-animation ones

import('../../js/charts.js').then((m) => m.initCharts()).catch((e) => console.error('charts:', e));

// The hero owns the loader and its entrance. If its module cannot load, drop the loader so the page is usable.
function heroFallback() {
  root.classList.add('hero-failed');
  const l = $('#loader');
  if (l) l.remove();
}
import('./hero.js')
  .then((m) => { if (typeof m.initHero === 'function') m.initHero(); else heroFallback(); })
  .catch((e) => { heroFallback(); console.warn('hero:', e && e.message ? e.message : e); });
