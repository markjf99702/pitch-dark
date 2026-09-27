// Pitch Dark: the page. Input, the frame loop, the list and the messages between rooms.

import { Game, LOW, MODES } from './game.js';
import { ROOMS } from './rooms.js';
import { centerOf } from './scene.js';
import { drawRoom, beam as drawBeam, beamAt } from './draw.js';
import { randomSeed } from './rng.js';
import * as sound from './sound.js';

const $ = (id) => document.getElementById(id);
const canvas = $('room');
const ctx = canvas.getContext('2d');
const roomCanvas = document.createElement('canvas');
const light = document.createElement('canvas');
const lctx = light.getContext('2d');
const LQ = 3; // CSS pixels per light-canvas pixel; the light is soft, so it can be coarse

const hud = $('hud');
const list = $('list');
const wants = $('wants');
const sheet = $('sheet');
const hint = $('hint');
const batteryEl = $('battery');

const params = new URLSearchParams(location.search);
const fixedSeed = params.has('seed') ? Number(params.get('seed')) >>> 0 : null;
const startRoom = Math.min(ROOMS.length - 1, Math.max(0, Number(params.get('room')) || 0));
let chosen = Object.hasOwn(MODES, params.get('mode') ?? '') ? params.get('mode') : readMode(); // the difficulty picked on the title screen
let titleBeam = MODES[chosen].beam; // the title screen's beam grows and shrinks to match
const coarse = matchMedia('(pointer: coarse)').matches;
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

let game = null;
let mode = 'title'; // title, play, reveal, cleared, dying, dead, won
let modeAt = 0; // time the mode started, in seconds
let now = 0;
let view = null;
let region = null;
let hidden = new Set();
let slots = [];
let hinted = false;
let lastPct = -1;

const pointer = { x: 0, y: 0, active: false, touch: false };
const beamPos = { x: innerWidth / 2, y: innerHeight / 2 };
const keys = new Set();
let keyLit = 0;
const roomLight = { level: 0, color: [255, 244, 225] };
const motes = Array.from({ length: 46 }, () => ({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.004, vy: (Math.random() - 0.3) * 0.004, r: 0.5 + Math.random() * 1.2, p: Math.random() * 6 }));

// --- Difficulty and best so far, one best for each difficulty ---

function readMode() {
  try { const m = localStorage.getItem('pitch-dark:mode'); return Object.hasOwn(MODES, m ?? '') ? m : 'medium'; } catch { return 'medium'; }
}
// Medium keeps the key from before there were difficulties, so earlier bests carry over.
const bestKey = (m) => (m === 'medium' ? 'pitch-dark:best' : `pitch-dark:best:${m}`);
function readBest(m) {
  try { return { found: 0, wins: 0, ...JSON.parse(localStorage.getItem(bestKey(m)) || '{}') }; } catch { return { found: 0, wins: 0 }; }
}
function saveBest(m, found, won) {
  const best = readBest(m);
  const beat = found > best.found;
  best.found = Math.max(best.found, found);
  if (won) best.wins++;
  try { localStorage.setItem(bestKey(m), JSON.stringify(best)); } catch { /* storage blocked */ }
  return { best, beat };
}
function bestLine(best, m) {
  if (!best.found) return '';
  const things = `${best.found} ${best.found === 1 ? 'thing' : 'things'}`;
  const wins = best.wins ? ` · Made it through the house ${best.wins === 1 ? 'once' : best.wins === 2 ? 'twice' : `${best.wins} times`}` : '';
  return `Best on ${MODES[m].name.toLowerCase()}: ${things}${wins}`;
}

// --- Layout ---

function measure() {
  const W = innerWidth;
  const H = innerHeight;
  const top = hud.getBoundingClientRect().bottom - 4;
  const bottom = list.querySelector('.list-head').getBoundingClientRect().top - 2;
  region = { x: 0, y: top, w: W, h: Math.max(200, bottom - top) };
  return { W, H };
}

function place() {
  const { W, H } = measure();
  const dpr = Math.min(2, devicePixelRatio || 1);
  const sc = game.scene;
  const s = Math.min(region.w / sc.w, region.h / sc.h);
  view = { W, H, dpr, s, ox: region.x + (region.w - sc.w * s) / 2, oy: region.y + (region.h - sc.h * s) / 2 };
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  light.width = Math.ceil(W / LQ);
  light.height = Math.ceil(H / LQ);
  lctx.fillStyle = '#000';
  lctx.fillRect(0, 0, light.width, light.height);
  redraw();
}

function redraw() { drawRoom(roomCanvas, game.scene, view, hidden); }

const toScreen = (p) => ({ x: view.ox + p.x * view.s, y: view.oy + p.y * view.s });
const toScene = (p) => ({ x: (p.x - view.ox) / view.s, y: (p.y - view.oy) / view.s });
const beamRadius = () => {
  const fade = game && mode !== 'title' ? Math.min(1, game.charge / LOW) : 1;
  const size = mode === 'title' ? titleBeam : game.mode.beam;
  return game.scene.beam * view.s * size * (0.72 + 0.28 * fade);
};

function newRoom(index) {
  hidden = new Set();
  measure();
  game.startRoom(index, region);
  place();
  roomLight.level = 0;
  lctx.fillStyle = '#000';
  lctx.fillRect(0, 0, light.width, light.height);
  $('roomName').textContent = game.room.name;
  showSpares();
  slots = game.shown();
  renderList(true);
}

function showSpares() {
  const left = game.scene.batteries.filter((id) => !game.found.has(id)).length;
  $('roomNo').textContent = `Room ${game.roomIndex + 1} of ${game.roomCount}`;
  $('spares').textContent = left ? `${left} spare ${left === 1 ? 'battery' : 'batteries'}` : 'No spares left';
}

// --- The list ---

function renderList(fresh = false) {
  const want = slots.length ? slots : [null, null, null];
  wants.replaceChildren(...[0, 1, 2].map((i) => {
    const id = want[i] ?? null;
    const li = document.createElement('li');
    li.className = 'want';
    if (id == null) {
      li.classList.add('empty');
      li.innerHTML = '<span class="e">·</span><span class="n">·</span>';
      return li;
    }
    const it = game.scene.items[id];
    li.dataset.id = id;
    const e = document.createElement('span');
    e.className = 'e';
    e.textContent = it.e;
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = it.name;
    li.append(e, n);
    if (fresh) li.classList.add('arriving');
    return li;
  }));
  const more = game && game.scene ? game.waiting() : 0;
  $('more').textContent = more ? `${more} more after these` : '';
}

function crossOff(id) {
  const li = wants.querySelector(`[data-id="${id}"]`);
  if (!li) return;
  li.classList.add('got');
  const i = slots.indexOf(id);
  setTimeout(() => {
    if (!game.scene.items[id] || game.state !== 'playing') return;
    li.classList.add('leaving');
    setTimeout(() => {
      if (game.state !== 'playing') return;
      const shown = game.shown();
      const next = shown.find((x) => !slots.includes(x));
      slots[i] = next ?? null;
      const fresh = renderSlot(i);
      if (fresh) fresh.classList.add('arriving');
      const more = game.waiting();
      $('more').textContent = more ? `${more} more after these` : shown.length === 1 ? 'Last one' : 'Last ones';
    }, 300);
  }, 650);
}

function renderSlot(i) {
  const old = wants.children[i];
  const id = slots[i];
  const li = document.createElement('li');
  li.className = 'want';
  if (id == null) {
    li.classList.add('empty');
    li.innerHTML = '<span class="e">·</span><span class="n">·</span>';
  } else {
    const it = game.scene.items[id];
    li.dataset.id = id;
    li.innerHTML = '<span class="e"></span><span class="n"></span>';
    li.firstChild.textContent = it.e;
    li.lastChild.textContent = it.name;
  }
  old.replaceWith(li);
  return id == null ? null : li;
}

function fly(item, to) {
  if (!to) return;
  const c = toScreen(centerOf(item));
  const size = item.size * view.s;
  const el = document.createElement('span');
  el.className = 'flyer';
  el.textContent = item.e;
  el.style.fontSize = `${size}px`;
  el.style.transform = `translate(${c.x - size / 2}px, ${c.y - size / 2}px)`;
  document.body.append(el);
  const r = to.getBoundingClientRect();
  const scale = 30 / size;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.transform = `translate(${r.left + r.width / 2 - size / 2}px, ${r.top + r.height / 2 - size / 2}px) scale(${scale})`;
    el.style.opacity = '0.1';
  }));
  setTimeout(() => el.remove(), 700);
}

// --- Messages ---

function showSheet({ kicker = '', title, body, button, small = '', onGo, alt = null, titleScreen = false }) {
  $('sheetKicker').textContent = kicker;
  $('sheetTitle').textContent = title;
  $('sheetBody').textContent = body;
  $('sheetBtn').textContent = button;
  $('sheetSmall').textContent = small;
  $('modes').hidden = !titleScreen;
  $('modeNote').hidden = !titleScreen;
  $('sheetAlt').hidden = !alt;
  if (alt) $('sheetAlt').textContent = alt.label;
  sheet.classList.toggle('title-screen', titleScreen);
  sheet.classList.remove('hidden');
  sheet.inert = false;
  list.classList.add('off');
  sheetGo = onGo;
  sheetAlt = alt && alt.onGo;
}
let sheetGo = null;
let sheetAlt = null;
function hideSheet() {
  sheet.classList.add('hidden');
  sheet.inert = true; // faded out, so no tabbing to its buttons
  sheetGo = null;
  sheetAlt = null;
}
$('sheetBtn').addEventListener('click', () => { sound.wake(); if (sheetGo) sheetGo(); });
// Enter on a footer link should follow the link, not switch on the flashlight.
document.querySelector('.jd-foot').addEventListener('keydown', (e) => e.stopPropagation());
$('sheetAlt').addEventListener('click', () => { sound.wake(); if (sheetAlt) sheetAlt(); });

// The difficulty picker on the title screen.
const modeButtons = [...$('modes').querySelectorAll('[data-mode]')];
function renderModes() {
  for (const b of modeButtons) {
    const on = b.dataset.mode === chosen;
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
  }
  $('modeNote').textContent = MODES[chosen].note;
  if (mode === 'title') $('sheetSmall').textContent = bestLine(readBest(chosen), chosen);
}
function choose(m) {
  chosen = m;
  try { localStorage.setItem('pitch-dark:mode', m); } catch { /* storage blocked */ }
  renderModes();
}
$('modes').addEventListener('click', (e) => {
  const b = e.target.closest('[data-mode]');
  if (b) choose(b.dataset.mode);
});
$('modes').addEventListener('keydown', (e) => {
  const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
  if (!step) return;
  e.preventDefault();
  const i = (modeButtons.findIndex((b) => b.dataset.mode === chosen) + step + modeButtons.length) % modeButtons.length;
  choose(modeButtons[i].dataset.mode);
  modeButtons[i].focus();
});

function setMode(m) { mode = m; modeAt = now; }

function roomsWord(n) { return `${n} ${n === 1 ? 'room' : 'rooms'}`; }
const lower = (name) => name.replace(/^The /, 'the ');

// --- Starting and moving on ---

function showTitle() {
  game = new Game(fixedSeed ?? randomSeed());
  hud.style.opacity = '0';
  newRoom(startRoom);
  setMode('title');
  showSheet({
    title: 'Pitch Dark',
    body: 'The power’s out. Find the things on the list by flashlight before the battery runs down. Spare batteries are hidden in the clutter.',
    button: 'Switch on the flashlight',
    small: bestLine(readBest(chosen), chosen),
    onGo: begin,
    titleScreen: true,
  });
  renderModes();
}

function begin() {
  game = new Game(fixedSeed ?? randomSeed(), chosen);
  hud.style.opacity = '1';
  hideSheet();
  newRoom(startRoom);
  list.classList.remove('off');
  pointer.active = false;
  setMode('play');
  if (!hinted) showHint();
  sound.click();
}

function nextRoom() {
  hideSheet();
  newRoom(game.roomIndex + 1);
  list.classList.remove('off');
  pointer.active = pointer.active && !pointer.touch;
  setMode('play');
}

function showHint() {
  hint.hidden = false;
  hint.classList.remove('gone');
  hint.innerHTML = coarse
    ? 'Touch and drag to shine the flashlight.<br>Hold it on something from the list to pick it up.'
    : 'Move the mouse to shine the flashlight.<br>Hold it on something from the list to pick it up.';
}

function dropHint() {
  if (hint.hidden) return;
  hinted = true;
  hint.classList.add('gone');
  setTimeout(() => { hint.hidden = true; }, 700);
}

function onEvent(ev) {
  if (!ev) return;
  if (ev.type === 'dying') {
    setMode('dying');
    sound.dying();
    return;
  }
  const item = game.scene.items[ev.id];
  hidden.add(ev.id);
  redraw();
  if (ev.type === 'battery') {
    sound.battery();
    showSpares();
    fly(item, batteryEl);
    setTimeout(() => {
      batteryEl.classList.remove('charged');
      void batteryEl.offsetWidth;
      batteryEl.classList.add('charged');
    }, 560);
    return;
  }
  sound.found();
  if (navigator.vibrate) navigator.vibrate(12);
  const li = wants.querySelector(`[data-id="${ev.id}"]`);
  fly(item, li);
  dropHint();
  if (ev.type === 'found') { crossOff(ev.id); return; }
  if (li) setTimeout(() => li.classList.add('got'), 560);
  $('more').textContent = '';
  if (ev.type === 'cleared') setMode('reveal');
  if (ev.type === 'won') setMode('won');
}

// --- Input ---

function aim(e) {
  pointer.touch = e.pointerType !== 'mouse';
  pointer.x = e.clientX;
  pointer.y = e.clientY - (pointer.touch && game ? Math.min(90, beamRadius() * 0.95) : 0);
}

canvas.addEventListener('pointerdown', (e) => {
  sound.wake();
  aim(e);
  if (mode !== 'play') return;
  if (pointer.touch) {
    beamPos.x = pointer.x;
    beamPos.y = pointer.y;
    sound.click();
  }
  pointer.active = true;
  try { canvas.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
});
canvas.addEventListener('pointermove', (e) => {
  aim(e);
  if (e.pointerType === 'mouse' && mode === 'play') pointer.active = true;
});
const release = (e) => {
  if (e.pointerType === 'mouse') return;
  if (pointer.active && mode === 'play') sound.click(true);
  pointer.active = false;
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') pointer.active = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && sheetGo && document.activeElement?.tagName !== 'BUTTON') {
    e.preventDefault();
    sound.wake();
    sheetGo();
    return;
  }
  if (!e.key.startsWith('Arrow') || mode !== 'play') return;
  e.preventDefault();
  if (!keys.size && !pointer.active) { pointer.x = beamPos.x; pointer.y = beamPos.y; }
  keys.add(e.key);
});
addEventListener('keyup', (e) => keys.delete(e.key));
addEventListener('blur', () => { keys.clear(); pointer.active = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden) { pointer.active = false; keys.clear(); } });

$('soundBtn').addEventListener('click', () => {
  sound.wake();
  sound.setSound(!sound.soundOn());
  $('soundBtn').setAttribute('aria-pressed', String(sound.soundOn()));
});
$('soundBtn').setAttribute('aria-pressed', String(sound.soundOn()));

let resizeTimer = 0;
addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (game && game.scene) place(); }, 120);
});

// --- The frame ---

// Keyframes [time, level], eased between.
function track(frames, t) {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    if (t <= frames[i][0]) {
      const [t0, a] = frames[i - 1];
      const [t1, b] = frames[i];
      return a + (b - a) * ((t - t0) / (t1 - t0));
    }
  }
  return frames[frames.length - 1][1];
}
const LIGHTNING = [[0, 0], [0.04, 1], [0.1, 0.08], [0.18, 0.9], [0.26, 0.25], [0.42, 1], [1.4, 0.64]];
const POWER_BACK = [[0, 0], [0.06, 0.8], [0.12, 0], [0.5, 0], [0.54, 0.9], [0.6, 0.15], [0.7, 1]];
const DYING = [[0, 1], [0.1, 0.2], [0.18, 0.9], [0.3, 0.1], [0.5, 0.7], [0.56, 0], [0.8, 0.5], [0.85, 0], [1.1, 0.25], [1.14, 0], [1.6, 0]];

let last = 0;
function frame(ms) {
  const t = ms / 1000;
  const dt = Math.min(0.05, last ? t - last : 0.016);
  last = t;
  now = t;
  const since = now - modeAt;

  // Where the light is pointing.
  let lit = false;
  if (mode === 'title') {
    titleBeam += (MODES[chosen].beam - titleBeam) * (1 - Math.exp(-dt * 6));
    const { W } = view;
    pointer.x = W / 2 + W * 0.34 * Math.sin(t * 0.33);
    pointer.y = region.y + region.h * (0.5 + 0.36 * Math.sin(t * 0.51 + 1.3));
    lit = true;
  } else if (keys.size) {
    const v = 420 * dt;
    if (keys.has('ArrowLeft')) pointer.x -= v;
    if (keys.has('ArrowRight')) pointer.x += v;
    if (keys.has('ArrowUp')) pointer.y -= v;
    if (keys.has('ArrowDown')) pointer.y += v;
    pointer.x = Math.max(0, Math.min(view.W, pointer.x));
    pointer.y = Math.max(0, Math.min(view.H, pointer.y));
    keyLit = 1.5;
  }
  keyLit = Math.max(0, keyLit - dt);
  if (mode !== 'title') lit = (pointer.active || keyLit > 0) && ['play', 'reveal', 'cleared', 'won'].includes(mode);
  const follow = 1 - Math.exp(-dt * (mode === 'title' ? 60 : 28));
  beamPos.x += (pointer.x - beamPos.x) * follow;
  beamPos.y += (pointer.y - beamPos.y) * follow;

  // The rules.
  const r = beamRadius();
  if (mode === 'play') {
    if (lit) { if (!hint.hidden) hint.classList.add('gone'); } else if (!hint.hidden && !hinted) hint.classList.remove('gone');
    const b = toScene(beamPos);
    onEvent(game.tick(dt, lit, { x: b.x, y: b.y, r: r / view.s }));
  }

  // How bright the flashlight is.
  let power = 1;
  let warm = 1;
  if (game && mode !== 'title') {
    const low = game.charge / LOW;
    warm = Math.min(1, low);
    power = 0.55 + 0.45 * Math.min(1, low);
    if (low < 1 && !calm) {
      const n = Math.sin(t * 31) * Math.sin(t * 7.3) * Math.sin(t * 2.1);
      if (n > 0.55 - (1 - low) * 0.4) power *= 0.35 + Math.random() * 0.4;
    }
  }
  if (mode === 'dying') {
    power = 0.5 * track(DYING, since);
    warm = 0;
    lit = true;
    if (since > 1.6) {
      game.die();
      setMode('dead');
      const { best, beat } = saveBest(game.modeName, game.foundTotal, false);
      setTimeout(() => {
        if (mode !== 'dead') return;
        showSheet({
          kicker: 'The flashlight died',
          title: `Stuck in ${lower(game.room.name)}`,
          body: `You found ${game.foundTotal} ${game.foundTotal === 1 ? 'thing' : 'things'} in ${roomsWord(game.roomsVisited)}. Still on this room’s list, circled: ${game.missed().map((id) => game.scene.items[id].e).join(' ')}`,
          button: 'Try again',
          small: beat && best.found > 0 ? `That’s your best yet on ${game.mode.name.toLowerCase()}.` : bestLine(best, game.modeName),
          onGo: begin,
          alt: { label: 'Change difficulty', onGo: showTitle },
        });
      }, 1600);
    }
  }
  if (mode === 'dead') lit = false;

  // The room's own light: lightning after a room, moonlight after the battery, the power at the end.
  if (mode === 'reveal') {
    roomLight.color = [205, 220, 255];
    roomLight.level = track(LIGHTNING, since);
    if (since > 0.3 && since - dt <= 0.3) sound.thunder();
    if (since > 1.3) {
      setMode('cleared');
      const next = ROOMS[game.roomIndex + 1];
      showSheet({
        kicker: `Room ${game.roomIndex + 1} of ${game.roomCount}`,
        title: `Got everything in ${lower(game.room.name)}`,
        body: `${Math.round(game.charge * 100)}% battery left. Next is ${lower(next.name)}.`,
        button: `Go to ${lower(next.name)}`,
        onGo: nextRoom,
      });
    }
  } else if (mode === 'won') {
    roomLight.color = [255, 244, 226];
    roomLight.level = track(POWER_BACK, since);
    if (since > 0.5 && since - dt <= 0.5) sound.lightsOn();
    if (since > 1.4 && !sheetGo) {
      const { best } = saveBest(game.modeName, game.foundTotal, true);
      showSheet({
        kicker: `Room ${game.roomCount} of ${game.roomCount}`,
        title: 'The power’s back',
        body: `You found all ${game.foundTotal} things with ${Math.round(game.charge * 100)}% battery left.`,
        button: 'Play again',
        small: bestLine(best, game.modeName),
        onGo: begin,
        alt: { label: 'Change difficulty', onGo: showTitle },
      });
    }
  } else if (mode === 'dead') {
    roomLight.color = [120, 150, 215];
    roomLight.level = Math.max(0, Math.min(0.55, (since - 0.5) / 2.5 * 0.55));
  } else if (mode !== 'cleared') {
    roomLight.level = window.__pitchDark.showAll ? 1 : 0;
  }

  render(lit, r, power, warm, since, dt);
  updateBattery();
  requestAnimationFrame(frame);
}

function render(lit, r, power, warm, since, dt) {
  const { W, H, dpr } = view;
  // The light: last frame's fades out fast (your eyes hold the afterglow a moment), the beam and room light go on top.
  const fade = 1 - Math.exp(-dt / 0.09);
  lctx.globalCompositeOperation = 'source-over';
  lctx.fillStyle = `rgba(0,0,0,${fade})`;
  lctx.fillRect(0, 0, light.width, light.height);
  lctx.globalCompositeOperation = 'lighten';
  if (roomLight.level > 0.002) {
    const [cr, cg, cb] = roomLight.color;
    const k = roomLight.level;
    lctx.fillStyle = `rgb(${Math.round(cr * k)},${Math.round(cg * k)},${Math.round(cb * k)})`;
    lctx.fillRect(0, 0, light.width, light.height);
  }
  if (lit && power > 0.01) drawBeam(lctx, beamPos.x / LQ, beamPos.y / LQ, r / LQ, warm, power);
  lctx.globalCompositeOperation = 'source-over';

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(roomCanvas, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(light, 0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'source-over';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (lit && power > 0.05) {
    // A little haze and dust in the beam.
    ctx.globalCompositeOperation = 'lighter';
    const haze = ctx.createRadialGradient(beamPos.x, beamPos.y, 0, beamPos.x, beamPos.y, r * 1.1);
    haze.addColorStop(0, `rgba(255,230,190,${0.07 * power})`);
    haze.addColorStop(1, 'rgba(255,230,190,0)');
    ctx.fillStyle = haze;
    ctx.fillRect(beamPos.x - r * 1.2, beamPos.y - r * 1.2, r * 2.4, r * 2.4);
    for (const m of motes) {
      m.x = (m.x + m.vx * dt + 1) % 1;
      m.y = (m.y + m.vy * dt + 1) % 1;
      const x = m.x * W;
      const y = m.y * H;
      const a = beamAt(beamPos.x, beamPos.y, r, x, y) * power * (0.35 + 0.3 * Math.sin(now * 1.7 + m.p));
      if (a <= 0.02) continue;
      ctx.fillStyle = `rgba(255,240,215,${a})`;
      ctx.beginPath();
      ctx.arc(x, y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // The ring that fills while the light rests on something.
  if (game && game.aim && mode === 'play') {
    const it = game.scene.items[game.aim.id];
    const c = toScreen(centerOf(it));
    const rr = it.size * view.s * 0.64;
    const p = Math.min(1, game.aim.t / game.mode.dwell);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,219,143,0.25)';
    ctx.beginPath();
    ctx.arc(c.x, c.y, rr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,225,160,0.95)';
    ctx.beginPath();
    ctx.arc(c.x, c.y, rr, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
    ctx.stroke();
  }
  highlightAim();

  // After the battery dies: where the list things were.
  if (mode === 'dead' && since > 1) {
    const a = Math.min(1, (since - 1) / 0.8);
    for (const id of game.missed()) {
      const it = game.scene.items[id];
      const c = toScreen(centerOf(it));
      const rr = it.size * view.s * (0.72 + 0.06 * Math.sin(now * 4));
      ctx.lineWidth = 3;
      ctx.strokeStyle = `rgba(255,219,143,${0.9 * a})`;
      ctx.beginPath();
      ctx.arc(c.x, c.y, rr, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

let aimed = null;
function highlightAim() {
  const id = game && game.aim && mode === 'play' ? game.aim.id : null;
  if (id === aimed) return;
  aimed = id;
  for (const li of wants.children) li.classList.toggle('aiming', id != null && li.dataset.id === String(id));
}

function updateBattery() {
  if (!game) return;
  const pct = Math.ceil(game.charge * 100);
  if (pct === lastPct) return;
  lastPct = pct;
  $('batteryPct').textContent = `${pct}%`;
  $('batteryFill').style.transform = `scaleX(${Math.max(0, game.charge)})`;
  batteryEl.setAttribute('aria-valuenow', String(pct));
  batteryEl.classList.toggle('low', game.charge < 0.25 && pct > 0);
  batteryEl.classList.toggle('critical', game.charge < 0.12 && pct > 0);
  batteryEl.classList.toggle('empty', pct === 0);
}

// --- Go ---

// Hooks for the tests and the screenshot tool.
window.__pitchDark = {
  get game() { return game; },
  get mode() { return mode; },
  get view() { return view; },
  roomLight,
  pointer,
  beamPos,
  toScreen,
  begin,
  screenOf(id) { return toScreen(centerOf(game.scene.items[id])); },
};

document.fonts.ready.then(() => {
  showTitle();
  requestAnimationFrame(frame);
});

const inFrame = (() => { try { return window.self !== window.top; } catch { return true; } })();
if ('serviceWorker' in navigator && !inFrame && location.protocol.startsWith('http')) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
