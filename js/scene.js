// Lays out one room: a wall of shelves with things crowded along them and more on the floor.
// Pure data, no drawing, so it can be tested without a browser. draw.js turns it into pixels.

import { BATTERY, lookalikeOf } from './rooms.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// region: { w, h } in CSS pixels, the part of the screen the room fills.
export function buildScene(room, diff, region, rand) {
  const { w, h } = region;
  const base = clamp(Math.sqrt(w * h) / 12.5, 32, 62);
  const E = Math.max(32, base * diff.scale); // the size of an ordinary thing
  const plank = E * 0.24;
  const post = E * 0.3;
  const top = E * 0.35;

  // The floor runs along the bottom. Shelves fill the wall above it, leaving room for the tall things on the floor.
  const floorLine = h - E * 1.05; // where the wall meets the floor
  const floorStand = h - E * 0.32; // where things on the floor stand
  const shelfBottom = floorStand - E * 1.75;
  const pitchWanted = E * 1.72;
  const count = Math.max(2, Math.floor((shelfBottom - top) / pitchWanted));
  const pitch = (shelfBottom - top) / count;
  const shelves = [];
  for (let k = 1; k <= count; k++) shelves.push({ y: top + pitch * k, thick: plank });

  const unitCount = Math.max(1, Math.round(w / (E * 8.5)));
  const posts = [];
  for (let i = 0; i <= unitCount; i++) posts.push(post / 2 + (i * (w - post)) / unitCount);

  const items = [];
  const add = (item) => { item.id = items.length; items.push(item); return item; };
  const tilt = () => (rand.chance(0.8) ? rand.range(-7, 7) : rand.range(-16, 16));

  // Fill every compartment, back row first, then the front row with gaps so the back row shows through.
  for (let s = 0; s < shelves.length; s++) {
    const y = shelves[s].y;
    for (let u = 0; u < unitCount; u++) {
      const x0 = posts[u] + post / 2 + E * 0.12;
      const x1 = posts[u + 1] - post / 2 - E * 0.12;
      let x = x0 + rand.range(0, E * 0.3);
      for (;;) {
        const size = E * rand.range(0.75, 0.92);
        if (x + size > x1) break;
        add({ layer: 0, shelf: s, x: x + size / 2, bottom: y - plank * 0.55, size, rot: tilt() });
        x += size * (1 + rand.range(-0.12, 0.3) / diff.density);
      }
      x = x0 + rand.range(0, E * 0.6);
      for (;;) {
        const size = E * rand.range(0.86, 1.18);
        if (x + size > x1) break;
        add({ layer: 1, shelf: s, x: x + size / 2, bottom: y + plank * 0.08, size, rot: tilt() });
        x += size * (1 + rand.range(0.1, 0.85) / diff.density);
      }
    }
  }
  // The floor: bigger things, across the whole width.
  {
    let x = rand.range(0, E * 0.5);
    for (;;) {
      const size = E * rand.range(1.12, 1.45);
      if (x + size > w - E * 0.1) break;
      add({ layer: 2, shelf: -1, x: x + size / 2, bottom: floorStand + rand.range(-0.08, 0.1) * E, size, rot: rand.range(-5, 5) });
      x += size * (1 + rand.range(0.15, 0.9) / diff.density);
    }
  }

  // Choose the list. Never two look-alikes on the same list.
  const candidates = rand.shuffle(room.things.filter((t) => !(t[2] || '').includes('decor')));
  const targets = [];
  for (const t of candidates) {
    if (targets.length >= diff.targets) break;
    if (targets.some((o) => lookalikeOf(o[0]).includes(t[0]))) continue;
    targets.push(t);
  }
  const targetEmoji = new Set(targets.map((t) => t[0]));
  const banned = new Set(targetEmoji);
  if (!diff.lookalikes) for (const t of targets) for (const l of lookalikeOf(t[0])) banned.add(l);
  const filler = room.things.filter((t) => !banned.has(t[0]));
  const big = filler.filter((t) => (t[2] || '').includes('big'));

  // Dress every slot with something from the room, avoiding the same thing twice in a row.
  let last = null;
  for (const it of items) {
    let t = it.layer === 2 && big.length && rand.chance(0.7) ? rand.pick(big) : rand.pick(filler);
    if (last && t[0] === last[0]) t = rand.pick(filler);
    it.e = t[0];
    it.name = t[1];
    it.kind = 'thing';
    last = t;
  }

  // Put the list things and the batteries in, spread out across the room.
  const specials = [];
  const centerOf = (it) => ({ x: it.x, y: it.bottom - it.size / 2 });
  const place = (thing, kind, tucked) => {
    const layer = tucked ? 0 : 1;
    let pool = items.filter((it) => it.kind === 'thing' && (it.layer === layer || (!tucked && it.layer === 2 && (thing[2] || '').includes('big'))));
    if (!pool.length) pool = items.filter((it) => it.kind === 'thing');
    let best = null;
    let bestScore = -1;
    for (let i = 0; i < 10; i++) {
      const it = rand.pick(pool);
      const c = centerOf(it);
      const near = specials.length ? Math.min(...specials.map((o) => Math.hypot(o.x - c.x, o.y - c.y))) : 1e9;
      const score = Math.min(near, E * 6) + rand.range(0, E);
      if (score > bestScore) { best = it; bestScore = score; }
    }
    best.e = thing[0];
    best.name = thing[1];
    best.kind = kind;
    best.rot = rand.range(-6, 6);
    if (best.layer === 0) {
      best.size = Math.max(best.size, E * 0.84);
      // Leave a gap in the front row so at least half of a tucked thing shows.
      for (const f of items) {
        if (f.layer !== 1 || f.shelf !== best.shelf || f.kind !== 'thing') continue;
        const overlap = Math.min(f.x + f.size / 2, best.x + best.size / 2) - Math.max(f.x - f.size / 2, best.x - best.size / 2);
        if (overlap > best.size * 0.45) f.gone = true;
      }
    } else {
      best.size = Math.max(best.size, E * (best.layer === 2 ? 1.1 : 0.95));
    }
    specials.push(centerOf(best));
    return best;
  };

  const list = [];
  for (const t of targets) list.push(place(t, 'target', rand.chance(diff.tucked)).id);
  const batteries = [];
  for (let i = 0; i < diff.batteries; i++) batteries.push(place(BATTERY, 'battery', rand.chance(diff.tucked)).id);

  // Take out the front-row things moved aside for tucked ones, and renumber.
  const kept = items.filter((it) => !it.gone);
  const remap = new Map(kept.map((it, i) => [it.id, i]));
  kept.forEach((it, i) => { it.id = i; });

  const decor = [];
  if (room.webs) {
    for (let s = 0; s < shelves.length; s++) {
      for (let u = 0; u < unitCount; u++) {
        if (!rand.chance(0.45)) continue;
        const left = rand.chance(0.5);
        const x = left ? posts[u] + post / 2 + E * 0.42 : posts[u + 1] - post / 2 - E * 0.42;
        const y = (s === 0 ? top : shelves[s - 1].y + plank) + E * 0.4;
        decor.push({ e: '🕸️', x, y, size: E * 0.9, rot: left ? 0 : 90, alpha: 0.5 });
      }
    }
  }

  return {
    room,
    w, h, E,
    beam: base * 1.9,
    top, shelves, posts, post, plank, floorLine, floorStand,
    items: kept,
    list: list.map((id) => remap.get(id)),
    batteries: batteries.map((id) => remap.get(id)),
    decor,
  };
}

// The middle of a thing, for aiming at it.
export function centerOf(item) {
  return { x: item.x, y: item.bottom - item.size * 0.5 };
}
