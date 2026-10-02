// Scroll-scrubbed hero sequence, shared by v1 (js/hero.js) and v2 (v2/js/hero.js).
// Scrolling down plays "hands out of the pockets, arms fold, soft smile"; scrolling up plays it back.
// The static photo stays the LCP image and is what shows at scroll 0. A <canvas class="hero__seq"> sits exactly
// over the photo box (same CSS mask and transforms, set in each version's hero.css) and fades in once the user scrolls.
//  - The hero is pinned on every screen size (.hero-pin.is-pinned: sticky hero + a runway after it: ~85svh on desktop,
//    ~65svh below 1024px) and the runway maps to the frames. Without a .hero-pin wrapper it falls back to free scroll,
//    where the action completes before the face reaches the fixed header.
//  - Frame set: desktop (720px) from 1024px wide, mobile (600px) below. --seq-p (0..1) on the canvas lets the CSS lower
//    the bottom fade as the arms fold, so the folded arms stay visible at the end.
//  - Frames load after window.load + idle, coarse to fine (0, last, middle, then the gaps); the nearest loaded frame draws.
//  - Off when html[data-motion=off] (live via motion:change), on Save-Data, or if frames fail to load. No-JS: nothing.
import { motionAllowed } from './state.js';

const BASE = new URL('../assets/seq/', import.meta.url);
const DESK = 1024;       // desktop frame set from this width
const SHOW = 0.02;       // canvas fades in above this progress
const HOLD_A = 0.03;     // frame 0 holds for the first 3% (the crossfade happens on it)...
const HOLD_B = 0.06;     // ...and the last frame for the final 6%
const HEAD = 0.075;      // top of the hair, as a fraction of the photo height (same in every frame)
const PARALLEL = 4;      // concurrent frame requests
const PLAY_MS = { pin: 380, free: 700 };    // fastest full play: pinned scrubs fast, free scroll plays a touch calmer
const EASE_K = { pin: 0.3, free: 0.2 };     // lerp of the shown frame toward the target (per 60 Hz frame)

let started = false;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const idle = (f) => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 1500 }) : setTimeout(f, 250));
const afterLoad = (f) => (document.readyState === 'complete' ? f() : addEventListener('load', f, { once: true }));
// Layout offset of el inside anc (ignores transforms such as parallax, breathing or entrance animations).
function offsetIn(el, anc) {
  let y = 0;
  while (el && el !== anc) { y += el.offsetTop; el = el.offsetParent; }
  return y;
}

/**
 * @param {object} o
 * @param {HTMLElement} o.hero    section#hero
 * @param {HTMLElement} o.figure  .hero__figure (the canvas is added inside it, after the photo)
 * @param {HTMLImageElement} o.photo  img#hero-photo
 * @param {HTMLElement} [o.pin]   .hero-pin wrapper around the hero (desktop runway); no pin = no desktop pinning
 * @param {HTMLElement} [o.keepTop]     first hero text block (the name): never pinned under the header
 * @param {HTMLElement} [o.keepBottom]  last hero text block: kept on screen while pinned when the hero allows it
 * @param {() => boolean} [o.hold] true while something else owns the photo (v1 particle intro): frame loading waits
 */
export function initSequence(o = {}) {
  const { hero, figure, photo, pin = null, keepTop = null, keepBottom = null, hold = () => false } = o;
  if (started || !hero || !figure || !photo || typeof fetch !== 'function') return;
  const conn = navigator.connection;
  if (conn && conn.saveData) return;
  const cv = document.createElement('canvas');
  const ctx = cv.getContext && cv.getContext('2d');
  if (!ctx) return;
  started = true;
  cv.className = 'hero__seq';
  cv.setAttribute('aria-hidden', 'true');

  const root = document.documentElement;
  const view = { on: true };
  let manifest = null, set = null, mode = '', setName = '', frames = [], n = 0, gen = 0, fails = 0;
  let loading = false, ready = false, dead = false, engaged = false, pinned = false, shown = false;
  let pinTop = null, pinStart = 0, runway = 0, base = 0, span = 1;
  let cur = 0, target = 0, drawn = -1, dirty = true, raf = 0, last = 0;

  const modeNow = () => (pin ? 'pin' : 'free');
  const setKey = () => (innerWidth >= DESK ? 'desktop' : 'mobile');

  /* ---------- Loading ---------- */
  function start() {
    if (loading || dead) return;
    loading = true;
    let waited = 0;
    const go = () => {
      if (hold() && waited < 3500) { waited += 250; setTimeout(go, 250); return; }   // let the particle intro finish first
      fetch(new URL('seq.json', BASE))
        .then((r) => { if (!r.ok) throw new Error('manifest'); return r.json(); })
        .then((m) => {
          if (!m || !m.desktop || !m.mobile) throw new Error('manifest');
          manifest = m;
          mode = modeNow();
          setName = setKey();
          loadSet();
        })
        .catch(abort);
    };
    afterLoad(() => idle(go));
  }

  // 0, last, middle, then midpoints breadth first (coarse to fine).
  function order(count) {
    const out = [0, count - 1];
    const q = [[0, count - 1]];
    while (q.length) {
      const [a, b] = q.shift();
      if (b - a < 2) continue;
      const m = (a + b) >> 1;
      out.push(m);
      q.push([a, m], [m, b]);
    }
    return out;
  }

  const urlFor = (i) => new URL(`${set.dir}/${set.pattern.replace('{nnn}', String(i).padStart(3, '0'))}`, BASE).href;

  function decode(url) {
    return fetch(url).then((r) => {
      if (!r.ok) throw new Error(`frame ${r.status}`);
      return r.blob();
    }).then((blob) => {
      if (window.createImageBitmap) return createImageBitmap(blob).catch(() => viaImg(url));
      return viaImg(url);
    });
  }
  function viaImg(url) {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    return img.decode().then(() => img);
  }

  function loadSet() {
    const g = ++gen;
    frames.forEach((f) => f && f.close && f.close());
    set = manifest[setName] || manifest.mobile;
    n = Math.max(2, set.count | 0);
    frames = new Array(n).fill(null);
    fails = 0;
    ready = false;
    drawn = -1;
    const q = order(n);
    let active = 0;
    const pump = () => {
      while (active < PARALLEL && q.length) {
        const i = q.shift();
        active++;
        decode(urlFor(i)).catch(() => decode(urlFor(i)))   // one retry
          .then((bmp) => {
            if (g !== gen || dead) { if (bmp.close) bmp.close(); return; }
            frames[i] = bmp;
            onFrame(i);
          }, () => {
            if (g !== gen || dead) return;
            fails++;
            if (i === 0 || i === n - 1 || fails > 3) abort();   // fails badly: keep the static photo
          })
          .finally(() => { active--; if (g === gen && !dead) pump(); });
      }
    };
    pump();
  }

  function onFrame(i) {
    if (!ready && frames[0] && frames[n - 1]) {
      ready = true;
      if (!cv.isConnected) photo.after(cv);
      size();
      tryEngage();
    } else if (engaged && Math.abs(i - Math.round(cur)) < 8) {
      dirty = true;   // a nearer frame arrived: redraw
      kick();
    }
  }

  function abort() {
    if (dead) return;
    dead = true;
    gen++;
    disengage();
    frames.forEach((f) => f && f.close && f.close());
    frames = [];
    cv.remove();
  }

  /* ---------- Geometry ---------- */
  function measure() {
    const cs = getComputedStyle(root);
    const headerH = parseFloat(cs.getPropertyValue('--header-h')) || 64;
    const dockH = parseFloat(cs.getPropertyValue('--dock-h')) || 0;
    const vh = innerHeight;
    const top0 = (pin || hero).getBoundingClientRect().top + scrollY;   // the wrapper is never sticky
    const ph = photo.offsetHeight;
    const headTop = offsetIn(photo, hero) + ph * HEAD;   // relative to the hero top
    const margin = 8 + ph * 0.015;                       // + room for v2's breathing (scale 1.012 from the bottom)
    if (mode === 'pin') {
      // Sticky top: 0 when the hero fits. If it is taller, lift it so the last text block shows, but never so far
      // that the first block (the name) or the head slides under the header: those win when not everything fits.
      const bottom = keepBottom ? offsetIn(keepBottom, hero) + keepBottom.offsetHeight : hero.offsetHeight;
      const topRoom = Math.min(keepTop ? offsetIn(keepTop, hero) - headerH - 4 : Infinity, headTop - headerH - margin);
      const t = Math.round(Math.max(Math.min(0, vh - dockH - bottom), Math.min(0, -topRoom)));
      if (t !== pinTop) { pinTop = t; pin.style.setProperty('--pin-top', `${t}px`); }
      pinStart = top0 - t;
      runway = pinned ? Math.max(1, pin.offsetHeight - hero.offsetHeight) : 0;
      base = pinStart;
      span = Math.max(1, runway);
    } else {
      // No pin: the last frame is reached before the head reaches the fixed header.
      base = top0;
      span = clamp(headTop - headerH - margin, 40, vh * 0.6);
    }
  }

  function size() {
    const w = photo.offsetWidth, h = photo.offsetHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const s = cv.style;
    s.left = `${photo.offsetLeft}px`;
    s.top = `${photo.offsetTop}px`;
    s.width = `${w}px`;
    s.height = `${h}px`;
    const bw = Math.round(w * dpr), bh = Math.round(h * dpr);
    if (cv.width !== bw || cv.height !== bh) {
      cv.width = bw;
      cv.height = bh;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      dirty = true;
    }
  }

  const progress = () => clamp((scrollY - base) / span);
  function frameFor(p) {
    const t = clamp((p - HOLD_A) / (1 - HOLD_A - HOLD_B));
    const s = t * t * (3 - 2 * t);          // smoothstep, blended with linear so the middle keeps moving
    return (t * 0.4 + s * 0.6) * (n - 1);
  }

  /* ---------- Pin ---------- */
  // Adding or removing the runway never moves what is on screen: above the pin start nothing changes; past the pin we
  // shift the scroll by the runway; inside it (unpin only) we land on the pin start, which looks the same as pinned.
  function setPinned(on) {
    if (!pin || pinned === on) return;
    const y = scrollY, oldRun = runway, oldStart = pinStart, oa = root.style.overflowAnchor;
    root.style.overflowAnchor = 'none';   // we correct the scroll ourselves
    pin.classList.toggle('is-pinned', on);
    pinned = on;
    measure();
    let ny = y;
    if (on && y > pinStart + 1) ny = y + runway;
    else if (!on && y > oldStart + 1) ny = y >= oldStart + oldRun ? y - oldRun : oldStart;
    if (ny !== y) {
      const sb = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';   // jump, even with html { scroll-behavior: smooth }
      window.scrollTo(0, ny);
      root.style.scrollBehavior = sb;
    }
    requestAnimationFrame(() => requestAnimationFrame(() => { root.style.overflowAnchor = oa; }));
  }

  /* ---------- Engage / disengage ---------- */
  const heroGone = () => scrollY >= hero.getBoundingClientRect().top + scrollY + hero.offsetHeight;
  // Only switch on when it cannot change what is on screen: at the very top (frame 0 = the photo) or with the hero
  // scrolled away. If the visitor is part-way down the hero, wait for one of the two.
  function tryEngage() {
    if (!ready || dead || engaged || !motionAllowed()) return;
    measure();
    if (mode === 'pin') {
      if (scrollY > pinStart + 1 && !heroGone()) return;
      setPinned(true);
    } else if (progress() > SHOW && !heroGone()) {
      return;
    }
    engaged = true;
    cur = target = frameFor(progress());
    dirty = true;
    update();
  }

  function disengage() {
    engaged = false;
    cancelAnimationFrame(raf);
    raf = 0;
    setShown(false);
    if (pinned) setPinned(false);
  }

  function setShown(on) {
    if (shown === on) return;
    shown = on;
    if (on) { draw(true); syncAnims(); }
    figure.classList.toggle('is-seq', on);
  }

  // v2 "breathing": the canvas runs the same CSS animation as the photo; align its clock so the two never drift.
  function syncAnims() {
    if (!cv.getAnimations || !photo.getAnimations) return;
    const pa = photo.getAnimations();
    cv.getAnimations().forEach((a) => {
      const m = pa.find((b) => b.animationName && b.animationName === a.animationName);
      if (m && m.currentTime != null) a.currentTime = m.currentTime;
    });
  }

  /* ---------- Frame loop ---------- */
  function update() {
    if (dead) return;
    if (!engaged) { tryEngage(); return; }
    const p = progress();
    target = frameFor(p);
    const show = p > SHOW;
    if (!view.on) { cur = target; dirty = true; }           // off screen: jump, draw when it is back
    else if (!show) { cur = target; draw(false); }          // fading out: settle on frame 0 (= the photo) at once
    setShown(show);
    if (show && view.on) kick();
  }

  function kick() { if (!raf && engaged) { last = 0; raf = requestAnimationFrame(tick); } }

  function tick(now) {
    raf = 0;
    if (!engaged) return;
    const dt = last ? Math.min(64, now - last) : 16.7;
    last = now;
    const d = target - cur;
    if (Math.abs(d) <= 0.5) cur = target;
    else {
      const k = 1 - (1 - EASE_K[mode]) ** (dt / 16.7);
      const max = ((n - 1) * dt) / PLAY_MS[mode];
      cur += Math.sign(d) * Math.min(Math.abs(d * k), max);
    }
    draw(false);
    if (cur !== target && view.on && !document.hidden) raf = requestAnimationFrame(tick);
  }

  function nearest(i) {
    if (frames[i]) return i;
    for (let d = 1; d < n; d++) {
      if (i - d >= 0 && frames[i - d]) return i - d;
      if (i + d < n && frames[i + d]) return i + d;
    }
    return -1;
  }

  function draw(force) {
    const j = nearest(clamp(Math.round(cur), 0, n - 1));
    if (j < 0 || (!force && !dirty && j === drawn)) return;
    if (!cv.width) size();
    if (!cv.width) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(frames[j], 0, 0, cv.width, cv.height);   // frames share the photo box: stretch to it
    drawn = j;
    dirty = false;
    cv.dataset.frame = String(j);
    cv.style.setProperty('--seq-p', (j / (n - 1)).toFixed(3));   // CSS lowers the bottom fade as the arms fold
  }

  /* ---------- Events ---------- */
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking || dead) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; update(); });
  }, { passive: true });

  let rsT = 0;
  addEventListener('resize', () => {
    clearTimeout(rsT);
    rsT = setTimeout(() => {
      if (dead || !manifest) return;
      if (setKey() !== setName) {         // crossed 1024px (rotation, big resize): other frame set
        disengage();
        setName = setKey();
        loadSet();
        return;
      }
      size();
      measure();
      dirty = true;
      update();
    }, 150);
  });
  if (window.ResizeObserver) new ResizeObserver(() => { if (ready && !dead) { size(); draw(true); } }).observe(photo);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      view.on = e.isIntersecting;
      if (!view.on) { cancelAnimationFrame(raf); raf = 0; } else update();
    }).observe(hero);
  }

  addEventListener('motion:change', () => {
    if (dead) return;
    if (!motionAllowed()) { disengage(); return; }   // static photo, runway removed
    if (!manifest) start(); else tryEngage();
  });
  cv.addEventListener('animationstart', syncAnims);

  if (motionAllowed()) start();   // motion off: nothing loads until it is switched back on
}
