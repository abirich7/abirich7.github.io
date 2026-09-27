// Hero enhancement. The hero is complete in HTML/CSS; this module only adds:
//  1. pointer parallax: writes --px/--py (-1..1, lerped) on #hero-stage; depths live in hero.css
//  2. offscreen pausing (.is-off on #hero) and tracker re-lock after the particle moment
//  3. "the audience assembles into the man": one raw-WebGL particle burst + reassembly
//     (tier high + motion full only, once per session, REPLAY button, 3 s safety reveal).
import { getMotion, getTier, motionAllowed, heavyMotionAllowed } from './state.js';

const FLAG = 'abi.heroAssembled';
const MASK = new URL('../assets/img/abirich-portrait-mask.png', import.meta.url).href;
const T_OUT = 0.5;      // burst out to the cloud (s)
const T_IN = 1.3;       // reassemble (s)
const SAFETY = 3000;    // photo is always revealed after this (ms)
const XFADE = 320;      // canvas out / photo in (ms)
const N_MAX = 26000;    // particles at 1440x900 and up
const SW = 300;         // sampling width (photo is sampled at 300 x 535)

let hero, stage, photo, maskImg, running = null, glBroken = false, inited = false;

export function initHero() {
  if (inited) return;
  hero = document.getElementById('hero');
  stage = document.getElementById('hero-stage');
  photo = document.getElementById('hero-photo');
  if (!hero || !stage || !photo) return;
  inited = true;
  stage.classList.add('is-enhanced');

  const view = { on: true };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      view.on = e.isIntersecting;
      hero.classList.toggle('is-off', !view.on);
      if (!view.on && running) running.stop(true);
    }).observe(hero);
  }
  parallax(view);

  addEventListener('motion:change', () => { if (running && !heavyMotionAllowed()) running.stop(true); });
  if (getTier() !== 'high' || !window.WebGLRenderingContext) return;
  replayButton();
  if (heavyMotionAllowed() && !seen() && inView() && !document.hidden) {
    ready().then(() => { if (heavyMotionAllowed() && inView()) assemble(); }).catch(() => {});
  }
}

const inView = () => scrollY < hero.offsetHeight * 0.4;

function seen() {
  try { return sessionStorage.getItem(FLAG) === '1'; } catch { return false; }
}

function ready() {
  const loaded = document.readyState === 'complete'
    ? Promise.resolve()
    : new Promise((r) => addEventListener('load', r, { once: true }));
  return loaded
    .then(() => (photo.decode ? photo.decode().catch(() => {}) : 0))
    .then(() => maskImg || new Promise((res, rej) => {
      const m = new Image();
      m.crossOrigin = 'anonymous';   // same request mode as the CSS mask fetch, so it is served from cache
      m.onload = () => res(maskImg = m);
      m.onerror = rej;
      m.src = MASK;
    }));
}

/* ---------- 1. Pointer parallax ---------- */
function parallax(view) {
  const mq = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 1024px)');
  let tx = 0, ty = 0, x = 0, y = 0, raf = 0;
  const put = () => {
    stage.style.setProperty('--px', x.toFixed(4));
    stage.style.setProperty('--py', y.toFixed(4));
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
    if (!view.on || !mq.matches || !motionAllowed() || e.pointerType === 'touch') return;
    const k = getMotion() === 'calm' ? 0.5 : 1;
    tx = (e.clientX / innerWidth * 2 - 1) * k;
    ty = (e.clientY / innerHeight * 2 - 1) * k;
    go();
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { tx = ty = 0; go(); });
  addEventListener('motion:change', () => {
    if (!motionAllowed()) { cancelAnimationFrame(raf); raf = 0; tx = ty = x = y = 0; put(); }
  });
}

/* ---------- 3. Replay affordance (high tier only) ---------- */
function replayButton() {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'hero__replay';
  b.setAttribute('aria-label', 'Replay the intro animation');
  b.innerHTML = 'REPLAY <span aria-hidden="true">↺</span>';
  const sync = () => { b.hidden = glBroken || !heavyMotionAllowed(); };
  b.addEventListener('click', () => {
    if (running || !heavyMotionAllowed()) return;
    ready().then(assemble).catch(() => {});
  });
  addEventListener('motion:change', sync);
  sync();
  stage.appendChild(b);
  b.sync = sync;
}

/* ---------- 3. The particle moment ---------- */
const VS = `
attribute vec2 aT; attribute vec4 aC; attribute vec4 aS;
uniform vec2 uR; uniform vec2 uO; uniform float uA; uniform float uB; uniform float uD; uniform float uT;
varying vec4 vC;
void main() {
  float k = clamp((uB - aS.w) / .55, 0., 1.);
  float o = uA * pow(1. - k, 3.);
  float r = fract(aS.w * 97.13 + aT.x * .013);
  float l = dot(aC.rgb, vec3(.299, .587, .114));
  vec3 p = mix(vec3(aT, (.5 - l) * 90. * min(o * 5., 1.)), aS.xyz, o);
  float a = o * .85, c = cos(a), s = sin(a);
  float qx = p.x - uO.x;
  p.x = uO.x + qx * c - p.z * s;
  p.z = qx * s + p.z * c;
  float w = 1100. / max(1100. + p.z, 420.);
  vec2 q = uO + (p.xy - uO) * w;
  gl_Position = vec4(q.x / uR.x * 2. - 1., 1. - q.y / uR.y * 2., 0., 1.);
  gl_PointSize = max(1., uD * w * (1. + o * (r * 1.5 - .25)));
  vec3 cc = r > .55 ? vec3(1., .48, .18) : vec3(.95, .93, .89);
  float tw = .6 + .4 * sin(uT * 5. + r * 40.);
  vC = vec4(mix(aC.rgb, cc, min(o * 1.4, 1.)), mix(aC.a, (.35 + .5 * r) * tw, o));
}`;
const FS = `
precision mediump float;
varying vec4 vC;
void main() {
  float a = vC.a * smoothstep(.5, .12, length(gl_PointCoord - .5));
  gl_FragColor = vec4(vC.rgb * a, a);
}`;

function assemble() {
  if (running || !heavyMotionAllowed() || !photo.naturalWidth) return;
  try { sessionStorage.setItem(FLAG, '1'); } catch { /* storage blocked: may replay next visit */ }

  let cv = stage.querySelector('.hero__gl');
  if (!cv) {
    cv = document.createElement('canvas');
    cv.className = 'hero__gl';
    cv.setAttribute('aria-hidden', 'true');
    stage.insertBefore(cv, stage.querySelector('.hero__figure'));
  }
  let gl = null, raf = 0, t0 = 0, safety = 0, kick = 0, done = false;
  const stop = (instant) => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    clearTimeout(safety);
    clearTimeout(kick);
    removeEventListener('resize', onResize);
    stage.classList.remove('is-assembling', 'is-gl');   // photo fades back in, canvas fades out
    stage.classList.add('is-relock');                   // trackers lock on again
    setTimeout(() => {
      try { gl && gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* already gone */ }
      cv.remove();
      running = null;
    }, instant ? 0 : XFADE + 80);
  };
  const onResize = () => stop(true);
  running = { stop };
  addEventListener('resize', onResize);

  try {
    const hr = cv.getBoundingClientRect();
    const pr = photo.getBoundingClientRect();
    if (!hr.width || !hr.height || !pr.width) throw new Error('no box');
    const dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.round(hr.width * dpr);
    cv.height = Math.round(hr.height * dpr);
    const opts = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' };
    gl = cv.getContext('webgl2', opts) || cv.getContext('webgl', opts);
    if (!gl) { glBroken = true; stage.querySelector('.hero__replay')?.sync(); throw new Error('no webgl'); }
    cv.addEventListener('webglcontextlost', () => stop(true), { once: true });

    const P = sample(hr, pr, dpr);
    const prog = program(gl);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, P.data, gl.STATIC_DRAW);
    [['aT', 2, 0], ['aC', 4, 2], ['aS', 4, 6]].forEach(([name, size, off]) => {
      const loc = gl.getAttribLocation(prog, name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 40, off * 4);
    });
    const U = (n) => gl.getUniformLocation(prog, n);
    const uA = U('uA'), uB = U('uB'), uT = U('uT');
    gl.uniform2f(U('uR'), hr.width, hr.height);
    gl.uniform2f(U('uO'), P.cx, P.cy);
    gl.uniform1f(U('uD'), P.dot);
    gl.viewport(0, 0, cv.width, cv.height);
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const frame = (now) => {
      if (done) return;
      if (!t0) {
        t0 = now;
        stage.classList.add('is-gl', 'is-assembling');   // added right before the first frame
        safety = setTimeout(() => stop(false), SAFETY);
      }
      const t = (now - t0) / 1000;
      const a = Math.min(t / T_OUT, 1);
      const b = Math.min(Math.max((t - T_OUT) / T_IN, 0), 1);
      gl.uniform1f(uA, 1 - (1 - a) ** 3);
      gl.uniform1f(uB, b);
      gl.uniform1f(uT, t);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.POINTS, 0, P.n);
      if (b >= 1) { stop(false); return; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    kick = setTimeout(() => { if (!t0) stop(true); }, 1500);   // no frame (hidden tab): give up cleanly
  } catch (err) {
    stop(true);
  }
}

function program(gl) {
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  gl.useProgram(p);
  return p;
}

// Sample the photo where the mask is opaque, on a jittered grid, mapped onto the on-screen photo box.
// Per point (10 floats): target x,y (css px in canvas space), r,g,b,a, cloud x,y,z, delay.
function sample(hr, pr, dpr) {
  const SH = Math.round(SW * photo.naturalHeight / photo.naturalWidth);
  const c = document.createElement('canvas');
  c.width = SW;
  c.height = SH;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(photo, 0, 0, SW, SH);
  const px = g.getImageData(0, 0, SW, SH).data;
  g.clearRect(0, 0, SW, SH);
  g.drawImage(maskImg, 0, 0, SW, SH);
  const mk = g.getImageData(0, 0, SW, SH).data;

  const cs = getComputedStyle(photo);
  const fa = parseFloat(cs.getPropertyValue('--fade-a')) || 0.6;
  const fb = parseFloat(cs.getPropertyValue('--fig-cut')) || 0.82;
  const kx = pr.width / SW, ky = pr.height / SH;
  const ox = pr.left - hr.left, oy = pr.top - hr.top;
  const y0 = Math.max(0, Math.floor(-oy / ky));
  const y1 = Math.min(Math.ceil(SH * fb), Math.ceil((hr.height - oy) / ky), SH);
  let area = 0;
  for (let y = y0; y < y1; y++) for (let i = y * SW * 4 + 3, e = i + SW * 4; i < e; i += 4) if (mk[i] > 128) area++;
  if (!area) throw new Error('empty mask');

  const N = Math.round(N_MAX * Math.min(1, Math.max(0.45, innerWidth * innerHeight / 1296000)));
  const step = Math.max(1, Math.sqrt(area / N));
  const cap = Math.ceil(N * 1.3) + 64;
  const data = new Float32Array(cap * 10);
  const cx = ox + pr.width / 2, cy = oy + pr.height * 0.36;
  const reach = Math.max(hr.width, hr.height) * 0.55;
  let n = 0;
  for (let gy = y0; gy < y1; gy += step) {
    for (let gx = 0; gx < SW; gx += step) {
      const x = gx + Math.random() * step, y = gy + Math.random() * step;
      if (x >= SW || y >= y1 || n >= cap) continue;
      const i = ((y | 0) * SW + (x | 0)) * 4;
      if (mk[i + 3] <= 128) continue;
      const f = y / SH;
      const alpha = f <= fa ? 1 : Math.max(0, 1 - (f - fa) / (fb - fa));
      if (alpha < 0.03) continue;
      const tx = ox + x * kx, ty = oy + y * ky;
      const ang = Math.atan2(ty - cy, tx - cx) + (Math.random() - 0.5) * 2.2;
      const r = reach * (0.25 + 0.9 * Math.random() ** 0.6);
      const o = n++ * 10;
      data[o] = tx;
      data[o + 1] = ty;
      data[o + 2] = px[i] / 255;
      data[o + 3] = px[i + 1] / 255;
      data[o + 4] = px[i + 2] / 255;
      data[o + 5] = alpha;
      data[o + 6] = cx + Math.cos(ang) * r;
      data[o + 7] = cy + Math.sin(ang) * r * 0.8;
      data[o + 8] = -380 + Math.random() * 1500;
      data[o + 9] = 0.45 * (0.55 * Math.random() + 0.45 * (y - y0) / (y1 - y0));
    }
  }
  const dot = Math.min(2.6, Math.max(1.6, step * kx * 0.85)) * dpr;
  return { data: data.subarray(0, n * 10), n, cx, cy, dot };
}
