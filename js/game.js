// The rules: the battery, the list, and getting from room to room. No drawing and no DOM here.

import { ROOMS, DIFFICULTY } from './rooms.js';
import { buildScene, centerOf } from './scene.js';
import { rng } from './rng.js';

export const DRAIN = 1 / 85; // share of a full battery used per second with the light on
export const BATTERY_BOOST = 0.4; // what a spare battery adds
export const LIST_SHOWN = 3; // how many list things you can see at once
export const DWELL = 0.55; // seconds the light has to rest on a thing to pick it up
export const LOW = 0.2; // when the beam starts to fail

export class Game {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.roomIndex = 0;
    this.charge = 1;
    this.foundTotal = 0;
    this.state = 'ready'; // ready, playing, dying, cleared, dead, won
    this.scene = null;
    this.found = new Set();
    this.aim = null; // { id, t } the thing the light is resting on
    this.firstRoom = null;
  }

  // Rooms walked into so far in this game.
  get roomsVisited() { return this.roomIndex - (this.firstRoom ?? this.roomIndex) + 1; }

  get room() { return ROOMS[this.roomIndex]; }
  get roomCount() { return ROOMS.length; }
  get lastRoom() { return this.roomIndex === ROOMS.length - 1; }
  get totalTargets() { return DIFFICULTY.reduce((n, d) => n + d.targets, 0); }

  startRoom(index, region) {
    this.roomIndex = index;
    if (this.firstRoom == null) this.firstRoom = index;
    const rand = rng((this.seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0);
    this.scene = buildScene(ROOMS[index], DIFFICULTY[index], region, rand);
    this.found = new Set();
    this.aim = null;
    this.state = 'playing';
    return this.scene;
  }

  // The list things you can see right now, in list order.
  shown() {
    return this.scene.list.filter((id) => !this.found.has(id)).slice(0, LIST_SHOWN);
  }

  // How many list things are left after the shown ones.
  waiting() {
    return Math.max(0, this.scene.list.length - this.found.size - this.shown().length);
  }

  // Things that can be picked up right now: shown list things and spare batteries.
  pickable() {
    const ids = this.shown();
    for (const id of this.scene.batteries) if (!this.found.has(id)) ids.push(id);
    return ids;
  }

  // Advance time. lit: whether the flashlight is on. beam: { x, y, r } in scene coordinates.
  // Returns an event when something happens: { type: 'found' | 'battery' | 'cleared' | 'won' | 'dying', id }.
  tick(dt, lit, beam) {
    if (this.state !== 'playing') return null;
    if (!lit) { this.decayAim(dt); return null; }
    this.charge = Math.max(0, this.charge - dt * DRAIN);
    if (this.charge <= 0) {
      this.state = 'dying';
      this.aim = null;
      return { type: 'dying' };
    }
    const id = this.under(beam);
    if (id == null) { this.decayAim(dt); return null; }
    if (!this.aim || this.aim.id !== id) this.aim = { id, t: 0 };
    this.aim.t += dt;
    if (this.aim.t >= DWELL) return this.collect(id);
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
      this.charge = Math.min(1, this.charge + BATTERY_BOOST);
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
