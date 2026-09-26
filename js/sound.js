// A few small sounds made on the spot with Web Audio: the switch, a pick-up, the lights.

let ctx = null;
let on = true;
try { on = localStorage.getItem('pitch-dark:sound') !== 'off'; } catch { /* storage blocked */ }

export function soundOn() { return on; }

export function setSound(value) {
  on = value;
  try { localStorage.setItem('pitch-dark:sound', value ? 'on' : 'off'); } catch { /* storage blocked */ }
}

// Browsers only allow sound after a tap or click, so call this from one.
export function wake() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
}

function ready() { return on && ctx && ctx.state === 'running'; }

function noise(duration) {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  return src;
}

function envelope(peak, attack, release, at) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + release);
  g.connect(ctx.destination);
  return g;
}

// The flashlight's switch.
export function click(soft = false) {
  if (!ready()) return;
  const t = ctx.currentTime;
  const src = noise(0.04);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = soft ? 2400 : 3200;
  f.Q.value = 2;
  src.connect(f).connect(envelope(soft ? 0.12 : 0.25, 0.001, 0.03, t));
  src.start(t);
}

function tone(freq, at, dur, peak, type = 'sine') {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  o.connect(envelope(peak, 0.008, dur, at));
  o.start(at);
  o.stop(at + dur + 0.05);
}

// Picked something off the list.
export function found() {
  if (!ready()) return;
  const t = ctx.currentTime;
  tone(784, t, 0.35, 0.12, 'triangle');
  tone(1175, t + 0.08, 0.5, 0.1, 'triangle');
}

// A spare battery.
export function battery() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(880, t + 0.25);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 1400;
  o.connect(f).connect(envelope(0.07, 0.01, 0.3, t));
  o.start(t);
  o.stop(t + 0.4);
}

// The room lights coming on: a relay's clunk and a fluorescent tube's hum.
export function lightsOn() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const src = noise(0.12);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 500;
  src.connect(f).connect(envelope(0.5, 0.002, 0.12, t));
  src.start(t);
  const hum = ctx.createOscillator();
  hum.type = 'sawtooth';
  hum.frequency.value = 120;
  const hf = ctx.createBiquadFilter();
  hf.type = 'lowpass';
  hf.frequency.value = 400;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.025, t + 0.3);
  g.gain.linearRampToValueAtTime(0, t + 1.6);
  hum.connect(hf).connect(g).connect(ctx.destination);
  hum.start(t);
  hum.stop(t + 1.7);
}

// The battery giving out.
export function dying() {
  if (!ready()) return;
  const t = ctx.currentTime;
  tone(330, t, 0.5, 0.06, 'triangle');
  tone(247, t + 0.35, 0.9, 0.06, 'triangle');
}

// Thunder, after the lightning that shows you a room you've finished.
export function thunder() {
  if (!ready()) return;
  const t = ctx.currentTime;
  const src = noise(3);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(900, t);
  f.frequency.exponentialRampToValueAtTime(120, t + 1.2);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.35, t + 0.05);
  g.gain.linearRampToValueAtTime(0.18, t + 0.4);
  g.gain.linearRampToValueAtTime(0.26, t + 0.8);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t);
}
