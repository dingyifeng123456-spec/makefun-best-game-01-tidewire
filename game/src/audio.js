let ctx = null;
let enabled = true;

export function ensureAudio() {
  if (!enabled) return null;
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function toggleMute() {
  enabled = !enabled;
  return enabled;
}

export function isMuted() { return !enabled; }

function beep(freq = 440, dur = 0.08, type = 'sine', gain = 0.04, when = 0) {
  const c = ensureAudio();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g); g.connect(c.destination);
  const t = c.currentTime + when;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur);
}

export function playRotate() { beep(520, 0.05, 'triangle', 0.03); }
export function playPlace() { beep(360, 0.07, 'square', 0.025); beep(540, 0.08, 'square', 0.02, 0.05); }
export function playRelease() { beep(620, 0.09, 'sawtooth', 0.02); beep(420, 0.12, 'sine', 0.03, 0.06); }
export function playFail() { beep(220, 0.18, 'sawtooth', 0.03); beep(160, 0.22, 'triangle', 0.03, 0.12); }
export function playWin() { beep(520, 0.08, 'triangle', 0.03); beep(660, 0.1, 'triangle', 0.03, 0.08); beep(820, 0.14, 'sine', 0.03, 0.18); }
