// V2 hero motion (DESIGN_V2 section 5). The hero is complete in HTML/CSS; this module only adds:
//  loader exit (max ~1.4 s), entrance (.is-in + .is-anim on #hero), growth-track marker loop (~7 s a lap),
//  living portrait (.is-live), pointer parallax (--px/--py on #hero) and off-screen pausing (.is-off),
//  then (after load) the scroll-scrubbed photo sequence from the shared ../../js/seq.js.
// Motion level comes from html[data-motion] (state.js): off = static, calm = no parallax/breathing.
import { getMotion, motionAllowed } from '../../js/state.js';

const MIN_MS = 560;    // loader shows at least this long (since navigation start)
const MAX_MS = 740;    // ...and starts leaving by this point whatever is still loading (gone by ~1.4 s)
const LATE_MS = 2300;  // after this the CSS safety has revealed everything: skip the entrance
const LAP_MS = 7000;   // one lap of the growth track
const TRAIL = 14;      // trail length, in pathLength units (path is 100)
const LIVE_MS = 1750;  // entrance length before the marker starts and the portrait breathes
const SVGNS = 'http://www.w3.org/2000/svg';

let inited = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
const until = (t) => sleep(t - performance.now());

export function initHero() {
  if (inited) return;
  inited = true;
  const hero = document.getElementById('hero');
  const loader = document.getElementById('loader');
  if (!hero) { loader?.remove(); return; }

  const view = { on: true };
  const track = makeTrack(hero, view);
  const par = parallax(hero, view);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      view.on = e.isIntersecting;
      hero.classList.toggle('is-off', !view.on);
      track.sync();
      par.sync();
    }).observe(hero);
  }
  addEventListener('motion:change', () => { track.sync(); par.sync(); });
  sequence(hero);

  const begin = (skip) => {
    hero.classList.add('is-in');            // drops the CSS pre-state
    if (!skip) hero.classList.add('is-anim'); // plays the entrance choreography
    setTimeout(() => { hero.classList.add('is-live'); track.start(); }, skip ? 0 : LIVE_MS);
  };

  if (!motionAllowed() || performance.now() > LATE_MS) {
    loader?.remove();
    begin(true);
    return;
  }
  const photo = document.getElementById('hero-photo');
  Promise.race([Promise.all([imgReady(photo), until(MIN_MS)]), until(MAX_MS)])
    .then(() => {
      if (performance.now() > LATE_MS || !motionAllowed()) { loader?.remove(); begin(true); return; }
      return exitLoader(loader).then(() => begin(false));
    })
    .catch(() => { loader?.remove(); begin(true); });
}

// Scroll sequence (shared ../../js/seq.js): imported only after the page has loaded; any failure keeps the static photo.
function sequence(hero) {
  const go = () => import('../../js/seq.js').then((m) => m.initSequence({
    hero,
    pin: hero.closest('.hero-pin'),
    figure: hero.querySelector('.hero__figure'),
    photo: document.getElementById('hero-photo'),
    keepTop: hero.querySelector('.hero__label'),
    keepBottom: hero.querySelector('.hero__bottom'),
  })).catch(() => {});
  if (document.readyState === 'complete') go();
  else addEventListener('load', go, { once: true });
}

function imgReady(img) {
  if (!img) return Promise.resolve();
  const loaded = img.complete ? Promise.resolve() : new Promise((r) => {
    img.addEventListener('load', r, { once: true });
    img.addEventListener('error', r, { once: true });
  });
  return loaded.then(() => (img.decode ? img.decode().catch(() => {}) : 0));
}

// Let the yellow bar finish quickly, then wipe the loader away and drop it from the DOM.
function exitLoader(loader) {
  if (!loader) return Promise.resolve();
  const bar = loader.querySelector('.loader__bar span');
  const a = bar?.getAnimations ? bar.getAnimations()[0] : null;
  let filled = Promise.resolve();
  if (a && a.playState === 'running') {
    a.updatePlaybackRate ? a.updatePlaybackRate(6) : (a.playbackRate = 6);
    filled = Promise.race([a.finished, sleep(140)]);
  }
  return filled.catch(() => {}).then(() => {
    loader.classList.add('is-done');
    setTimeout(() => loader.remove(), 700);
  });
}

/* ---------- Growth track: red marker + short trail looping the circuit ---------- */
function makeTrack(hero, view) {
  const svg = hero.querySelector('.track');
  const path = svg?.querySelector('.track__path');
  const dot = svg?.querySelector('.track__marker');
  const glow = svg?.querySelector('.track__glow');
  const noop = { start() {}, sync() {} };
  if (!path || !dot || typeof path.getTotalLength !== 'function') return noop;

  let len = 0;
  try { len = path.getTotalLength(); } catch { return noop; }
  if (!len) return noop;

  const home = [dot.getAttribute('cx'), dot.getAttribute('cy')];
  // Start the loop where the static marker sits, so it never jumps.
  let homePos = 0, best = Infinity;
  for (let i = 0; i < 200; i++) {
    const p = path.getPointAtLength((i / 200) * len);
    const d = (p.x - home[0]) ** 2 + (p.y - home[1]) ** 2;
    if (d < best) { best = d; homePos = i / 200; }
  }

  const trail = document.createElementNS(SVGNS, 'path');
  trail.setAttribute('class', 'track__trail');
  trail.setAttribute('d', path.getAttribute('d'));
  trail.setAttribute('pathLength', '100');

  let started = false, raf = 0, last = 0, pos = homePos;
  const put = (x, y) => {
    dot.setAttribute('cx', x);
    dot.setAttribute('cy', y);
    if (glow) { glow.setAttribute('cx', x); glow.setAttribute('cy', y); }
  };
  const draw = () => {
    const p = path.getPointAtLength(pos * len);
    put(p.x.toFixed(2), p.y.toFixed(2));
    trail.style.strokeDashoffset = (TRAIL - pos * 100).toFixed(2);
  };
  const frame = (now) => {
    const dt = last ? Math.min(64, now - last) : 0;   // clamp: no jump after a hidden tab
    last = now;
    pos = (pos + dt / LAP_MS) % 1;
    draw();
    raf = requestAnimationFrame(frame);
  };
  const sync = () => {
    if (started && view.on && motionAllowed()) {
      if (!raf) {
        if (!trail.isConnected) { path.after(trail); draw(); }
        last = 0;
        raf = requestAnimationFrame(frame);
      }
      return;
    }
    cancelAnimationFrame(raf);
    raf = 0;
    if (!motionAllowed()) { trail.remove(); pos = homePos; put(home[0], home[1]); }
  };
  return { start() { started = true; sync(); }, sync };
}

/* ---------- Pointer parallax (desktop, full motion): photo 6px, mega 14px, track 10px in CSS ---------- */
function parallax(hero, view) {
  const mq = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 1024px)');
  let tx = 0, ty = 0, x = 0, y = 0, raf = 0;
  const ok = () => view.on && mq.matches && getMotion() === 'full';
  const put = () => {
    hero.style.setProperty('--px', x.toFixed(4));
    hero.style.setProperty('--py', y.toFixed(4));
  };
  const tick = () => {
    x += (tx - x) * 0.08;
    y += (ty - y) * 0.08;
    const settled = Math.abs(tx - x) + Math.abs(ty - y) < 0.001;
    if (settled) { x = tx; y = ty; }
    put();
    raf = settled ? 0 : requestAnimationFrame(tick);
  };
  const go = () => { if (!raf) raf = requestAnimationFrame(tick); };
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || !ok()) return;
    tx = (e.clientX / innerWidth) * 2 - 1;
    ty = (e.clientY / innerHeight) * 2 - 1;
    go();
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { tx = ty = 0; go(); });
  return {
    sync() {
      if (getMotion() === 'full' && mq.matches) { if (!view.on) { cancelAnimationFrame(raf); raf = 0; } return; }
      cancelAnimationFrame(raf);
      raf = 0;
      tx = ty = x = y = 0;
      hero.style.removeProperty('--px');
      hero.style.removeProperty('--py');
    },
  };
}
