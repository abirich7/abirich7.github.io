// Global UI state shared by every module: motion level, number units, device tier.
// State lives on <html> data attributes; changes are announced as window CustomEvents.
//   html[data-motion]  "full" | "calm" | "off"      event "motion:change" {detail:{motion}}
//   html[data-units]   "intl" | "indian"            event "units:change"  {detail:{units}}
//   html[data-tier]    "high" | "mid" | "low"       (set once on load, read-only)

const root = document.documentElement;

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, value); } catch { /* storage blocked: state still works for this visit */ }
}

const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

export function getMotion() { return root.dataset.motion || 'full'; }
export function getUnits() { return root.dataset.units === 'indian' ? 'indian' : 'intl'; }
export function getTier() { return root.dataset.tier || 'mid'; }

export function setMotion(motion, persist = true) {
  if (!['full', 'calm', 'off'].includes(motion)) return;
  root.dataset.motion = motion;
  if (persist) write('abi.motion', motion);
  window.dispatchEvent(new CustomEvent('motion:change', { detail: { motion } }));
}

export function setUnits(units, persist = true) {
  if (!['intl', 'indian'].includes(units)) return;
  root.dataset.units = units;
  if (persist) write('abi.units', units);
  window.dispatchEvent(new CustomEvent('units:change', { detail: { units } }));
}

function detectTier() {
  const saveData = navigator.connection && navigator.connection.saveData;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  const small = window.matchMedia('(max-width: 767px)').matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  if (saveData || cores <= 4 || mem <= 2) return 'low';
  if (small || coarse || mem <= 4) return 'mid';
  return 'high';
}

// Initialise synchronously so first paint already has the right attributes.
root.dataset.tier = detectTier();
root.dataset.units = read('abi.units') === 'indian' ? 'indian' : 'intl';
const storedMotion = read('abi.motion');
root.dataset.motion = storedMotion && ['full', 'calm', 'off'].includes(storedMotion)
  ? storedMotion
  : (reduceQuery.matches ? 'off' : 'full');

reduceQuery.addEventListener?.('change', (e) => {
  if (!read('abi.motion')) setMotion(e.matches ? 'off' : 'full', false);
});

/** True when decorative animation should run at all. */
export function motionAllowed() { return getMotion() !== 'off'; }
/** True when heavy/continuous effects (WebGL, parallax loops) should run. */
export function heavyMotionAllowed() { return getMotion() === 'full' && getTier() !== 'low'; }
