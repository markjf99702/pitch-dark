// The rules: the battery, the list, and getting from room to room. No drawing and no DOM here.

import { ROOMS, DIFFICULTY } from './rooms.js';
import { buildScene, centerOf } from './scene.js';
import { rng } from './rng.js';

export const LIST_SHOWN = 3; // how many list things you can see at once
export const LOW = 0.2; // when the beam starts to fail

// How forgiving the flashlight is.
//   drain  share of a full battery used per second with the light on
//   boost  what a spare battery adds
//   beam   how wide the beam is (1 = normal)
//   dwell  seconds the light has to rest on a thing to pick it up
//   spares extra spare batteries hidden in every room
export const MODES = {
  easy: { name: 'Easy', drain: 1 / 130, boost: 0.5, beam: 1.22, dwell: 0.45, spares: 1,
    note: 'A wider beam and 130 seconds of light per battery. Spares add half a battery, and every room hides one more.' },
  medium: { name: 'Medium', drain: 1 / 85, boost: 0.4, beam: 1, dwell: 0.55, spares: 0,
    note: '85 seconds of light per battery, and spares add 40%.' },
  hard: { name: 'Hard', drain: 1 / 60, boost: 0.3, beam: 0.8, dwell: 0.7, spares: 0,
    note: 'A narrower beam and 60 seconds of light per battery. Spares add 30%, and picking things up takes longer.' },
};

export class Game {
  constructor(seed, mode = 'medium') {
    this.seed = seed >>> 0;
    this.modeName = Object.hasOwn(MODES, mode) ? mode : 'medium';
    this.mode = MODES[this.modeName];
    this.roomIndex = 0;
    this.charge = 1;
    this.foundTotal = 0;
    this.state = 'ready'; // ready, playing, dying, cleared, dead, won
    this.scene = null;
    this.found = new Set();
    this.aim = null; // { id, t } the thing the light is resting on
    this.listed = null; // the list things the page is showing, if it says (a found one's place takes a moment to fill)
    this.firstRoom = null;
  }

  // Rooms walked into so far in this game.
  get roomsVisited() { return this.roomIndex - (this.firstRoom ?? this.roomIndex) + 1; }

  get room() { return ROOMS[this.roomIndex]; }
  get roomCount() { return ROOMS.length; }
  get lastRoom() { return this.roomIndex === ROOMS.length - 1; }
  get totalTargets() { return DIFFICULTY.reduce((n, d) => n + d.targets, 0); }

  // Lays out a room for a part of the screen, from the seed. progress (from progress()) lays it out with the list it had,
  // with what had been found still found and the spares picked up still gone.
  startRoom(index, region, progress = null) {
    this.roomIndex = index;
    if (this.firstRoom == null) this.firstRoom = index;
    const room = ROOMS[index];
    const rand = rng((this.seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0);
    const diff = { ...DIFFICULTY[index], batteries: DIFFICULTY[index].batteries + this.mode.spares };
    const list = progress && progress.list.length ? progress.list.map((e) => room.things.find((t) => t[0] === e)) : null;
    const sc = buildScene(room, diff, region, rand, list);
    this.scene = sc;
    const found = list ? [...progress.found.map((i) => sc.list[i]), ...progress.spares.map((i) => sc.batteries[i])] : [];
    this.found = new Set(found.filter((id) => id != null));
    this.aim = null;
    this.listed = null;
    this.state = 'playing';
    return sc;
  }

  // What's been done in this room, in terms that hold however it's laid out: its list (emoji, in order), which of the
  // list have been found and which spares picked up (by their places in each).
  progress() {
    const sc = this.scene;
    const done = (ids) => ids.flatMap((id, i) => (this.found.has(id) ? [i] : []));
    return { list: sc.list.map((id) => sc.items[id].e), found: done(sc.list), spares: done(sc.batteries) };
  }

  // Lays the room out again for a new part of the screen (the phone turned), keeping its list, what's been found and the
  // spares left. Things move, so they get new ids: returns a map from the old ids of the list things and spares to the new.
  relayout(region) {
    const before = this.scene;
    const { state, listed } = this;
    this.startRoom(this.roomIndex, region, this.progress());
    this.state = state;
    const map = new Map([...before.list.map((id, i) => [id, this.scene.list[i]]), ...before.batteries.map((id, i) => [id, this.scene.batteries[i]])]);
    if (listed) this.listed = new Set([...listed].map((id) => (map.has(id) ? map.get(id) : id)));
    return map;
  }

  // The list things you can see right now, in list order.
  shown() {
    return this.scene.list.filter((id) => !this.found.has(id)).slice(0, LIST_SHOWN);
  }

  // How many list things are left after the shown ones.
  waiting() {
    return Math.max(0, this.scene.list.length - this.found.size - this.shown().length);
  }

  // Things that can be picked up right now: shown list things that are on the page's list, and spare batteries once the
  // battery has room for at least half of one. Until then a spare stays on the shelf for later instead of going to waste.
  pickable() {
    const ids = this.shown().filter((id) => !this.listed || this.listed.has(id));
    if (this.charge <= 1 - this.mode.boost / 2) for (const id of this.scene.batteries) if (!this.found.has(id)) ids.push(id);
    return ids;
  }

  // Advance time. lit: whether the flashlight is on. beam: { x, y, r } in scene coordinates.
  // Returns an event when something happens: { type: 'found' | 'battery' | 'cleared' | 'won' | 'dying', id }.
  tick(dt, lit, beam) {
    if (this.state !== 'playing') return null;
    if (!lit) { this.decayAim(dt); return null; }
    this.charge = Math.max(0, this.charge - dt * this.mode.drain);
    if (this.charge <= 0) {
      this.state = 'dying';
      this.aim = null;
      return { type: 'dying' };
    }
    const id = this.under(beam);
    if (id == null) { this.decayAim(dt); return null; }
    if (!this.aim || this.aim.id !== id) this.aim = { id, t: 0 };
    this.aim.t += dt;
    if (this.aim.t >= this.mode.dwell) return this.collect(id);
    return null;
  }

  decayAim(dt) {
    if (!this.aim) return;
    this.aim.t -= dt * 2.5;
    if (this.aim.t <= 0) this.aim = null;
  }

  // The pickable thing nearest the middle of the beam, if it's close enough.
  under(beam) {
    if (!beam) return null;
    let best = null;
    let bestD = Infinity;
    for (const id of this.pickable()) {
      const it = this.scene.items[id];
      const c = centerOf(it);
      const d = Math.hypot(c.x - beam.x, c.y - beam.y);
      const reach = Math.max(beam.r * 0.4, it.size * 0.55);
      if (d < reach && d < bestD) { best = id; bestD = d; }
    }
    return best;
  }

  collect(id) {
    if (this.state !== 'playing' || this.found.has(id) || !this.pickable().includes(id)) return null;
    this.found.add(id);
    this.aim = null;
    const item = this.scene.items[id];
    if (item.kind === 'battery') {
      this.charge = Math.min(1, this.charge + this.mode.boost);
      return { type: 'battery', id };
    }
    this.foundTotal++;
    const left = this.scene.list.some((i) => !this.found.has(i));
    if (!left) {
      this.state = this.lastRoom ? 'won' : 'cleared';
      return { type: this.state, id };
    }
    return { type: 'found', id };
  }

  // Called once the flicker at the end has played out.
  die() {
    if (this.state === 'dying') this.state = 'dead';
  }

  // List things still on the shelves, for showing where they were.
  missed() {
    return this.scene.list.filter((id) => !this.found.has(id));
  }
}
