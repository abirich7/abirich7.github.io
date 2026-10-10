// Motion level and device tier for the animated hero (js/hero.js, js/seq.js).
//   html[data-motion] "full" | "off"   follows prefers-reduced-motion; changes fire window "motion:change"
//   html[data-tier]   "high" | "mid" | "low"   set once on load
const root = document.documentElement;
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

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

root.dataset.tier = detectTier();
root.dataset.motion = reduce.matches ? 'off' : 'full';
reduce.addEventListener?.('change', (e) => {
  root.dataset.motion = e.matches ? 'off' : 'full';
  window.dispatchEvent(new CustomEvent('motion:change', { detail: { motion: root.dataset.motion } }));
});

export function getMotion() { return root.dataset.motion || 'full'; }
export function getTier() { return root.dataset.tier || 'mid'; }
/** Decorative animation allowed at all. */
export function motionAllowed() { return getMotion() !== 'off'; }
/** Heavy effects (WebGL intro, pointer parallax) allowed. */
export function heavyMotionAllowed() { return getMotion() === 'full' && getTier() !== 'low'; }
