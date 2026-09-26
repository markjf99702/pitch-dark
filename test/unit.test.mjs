// The rules and the room layouts, without a browser:  node --test test/unit.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOMS, DIFFICULTY, LOOKALIKES, lookalikeOf } from '../js/rooms.js';
import { buildScene, centerOf } from '../js/scene.js';
import { Game, MODES, LIST_SHOWN } from '../js/game.js';

const { drain: DRAIN, boost: BATTERY_BOOST, dwell: DWELL } = MODES.medium;
import { rng } from '../js/rng.js';

const SIZES = [{ w: 390, h: 640 }, { w: 1280, h: 620 }, { w: 820, h: 1000 }, { w: 320, h: 460 }];

test('every room has enough to fill its shelves and its list', () => {
  assert.equal(ROOMS.length, DIFFICULTY.length);
  for (const room of ROOMS) {
    const emoji = room.things.map((t) => t[0]);
    assert.equal(new Set(emoji).size, emoji.length, `${room.id} lists something twice`);
    assert.ok(emoji.length >= 30, `${room.id} has only ${emoji.length} things`);
    assert.ok(!emoji.includes('🔋'), `${room.id} has a battery among its things`);
    for (const [e, name] of room.things) assert.ok(e && name && name.length <= 20, `${room.id}: ${e} ${name}`);
  }
  for (const pair of LOOKALIKES) assert.equal(pair.length, 2);
});

test('rooms lay out with a fair list, wherever and however often they are built', () => {
  for (let seed = 1; seed <= 25; seed++) {
    for (const size of SIZES) {
      ROOMS.forEach((room, i) => {
        const diff = DIFFICULTY[i];
        const sc = buildScene(room, diff, size, rng(seed * 100 + i));
        const where = `${room.id} seed ${seed} at ${size.w}x${size.h}`;
        assert.equal(sc.list.length, diff.targets, where);
        assert.equal(sc.batteries.length, diff.batteries, where);
        sc.items.forEach((it, n) => assert.equal(it.id, n, `${where}: ids are positions`));
        // Each list thing is on the shelves exactly once, and never next to its own look-alike on the list.
        const listed = sc.list.map((id) => sc.items[id]);
        for (const it of listed) {
          assert.equal(it.kind, 'target', where);
          assert.equal(sc.items.filter((o) => o.e === it.e).length, 1, `${where}: ${it.e} appears more than once`);
          for (const other of listed) assert.ok(!lookalikeOf(it.e).includes(other.e), `${where}: ${it.e} and ${other.e} both on the list`);
          if (!diff.lookalikes) for (const l of lookalikeOf(it.e)) assert.ok(!sc.items.some((o) => o.e === l), `${where}: look-alike ${l} of ${it.e} in an easy room`);
        }
        for (const id of sc.batteries) assert.equal(sc.items[id].e, '🔋', where);
        assert.equal(sc.items.filter((o) => o.e === '🔋').length, diff.batteries, where);
        // Everything is inside the room and big enough to see.
        for (const it of sc.items) {
          const c = centerOf(it);
          assert.ok(c.x > 0 && c.x < sc.w && c.y > 0 && c.y < sc.h, `${where}: ${it.e} is outside the room`);
          assert.ok(it.size >= 24, `${where}: ${it.e} is tiny`);
        }
        // A thing tucked at the back of a shelf keeps a gap in front of it.
        for (const it of [...listed, ...sc.batteries.map((id) => sc.items[id])]) {
          if (it.layer !== 0) continue;
          for (const f of sc.items) {
            if (f.layer !== 1 || f.shelf !== it.shelf || f.kind !== 'thing') continue;
            const overlap = Math.min(f.x + f.size / 2, it.x + it.size / 2) - Math.max(f.x - f.size / 2, it.x - it.size / 2);
            assert.ok(overlap <= it.size * 0.45, `${where}: ${it.e} is hidden behind ${f.e}`);
          }
        }
      });
    }
  }
});

test('the same seed builds the same house', () => {
  const a = new Game(42).startRoom(3, SIZES[0]);
  const b = new Game(42).startRoom(3, SIZES[0]);
  assert.deepEqual(a.items.map((i) => i.e), b.items.map((i) => i.e));
  const c = new Game(43).startRoom(3, SIZES[0]);
  assert.notDeepEqual(a.items.map((i) => i.e), c.items.map((i) => i.e));
});

function aimAt(game, id) {
  const c = centerOf(game.scene.items[id]);
  return { x: c.x, y: c.y, r: game.scene.beam };
}

test('the battery drains only while the light is on', () => {
  const g = new Game(1);
  g.startRoom(0, SIZES[0]);
  g.tick(1, false, null);
  assert.equal(g.charge, 1);
  g.tick(1, true, { x: -999, y: -999, r: 10 });
  assert.ok(Math.abs(g.charge - (1 - DRAIN)) < 1e-9);
});

test('holding the light on a list thing picks it up, and the list moves along', () => {
  const g = new Game(5);
  g.startRoom(1, SIZES[0]);
  const shown = g.shown();
  assert.equal(shown.length, LIST_SHOWN);
  const id = shown[1];
  assert.equal(g.tick(DWELL * 0.5, true, aimAt(g, id)), null);
  const ev = g.tick(DWELL * 0.6, true, aimAt(g, id));
  assert.deepEqual(ev, { type: 'found', id });
  assert.equal(g.foundTotal, 1);
  assert.ok(!g.shown().includes(id));
  assert.equal(g.shown().length, LIST_SHOWN);
  assert.ok(g.shown().includes(g.scene.list[LIST_SHOWN]), 'the next thing on the list shows up');
});

test('things that are not on the list yet cannot be picked up', () => {
  const g = new Game(5);
  g.startRoom(2, SIZES[0]);
  const later = g.scene.list[g.scene.list.length - 1];
  assert.ok(!g.shown().includes(later));
  assert.equal(g.tick(DWELL * 2, true, aimAt(g, later)), null);
  assert.equal(g.collect(later), null);
});

test('a spare battery tops the flashlight up, but not past full', () => {
  const g = new Game(9);
  g.startRoom(0, SIZES[0]);
  g.charge = 0.3;
  const id = g.scene.batteries[0];
  assert.deepEqual(g.collect(id), { type: 'battery', id });
  assert.ok(Math.abs(g.charge - (0.3 + BATTERY_BOOST)) < 1e-9);
  g.collect(g.scene.batteries[1]);
  assert.equal(g.charge, 1);
  assert.equal(g.foundTotal, 0, 'batteries are not list things');
});

test('finding the whole list clears the room, and the last room wins', () => {
  const g = new Game(3);
  g.startRoom(0, SIZES[0]);
  let ev;
  while (g.shown().length) ev = g.collect(g.shown()[0]);
  assert.equal(ev.type, 'cleared');
  assert.equal(g.state, 'cleared');
  assert.equal(g.foundTotal, DIFFICULTY[0].targets);
  g.startRoom(ROOMS.length - 1, SIZES[0]);
  while (g.shown().length) ev = g.collect(g.shown()[0]);
  assert.equal(ev.type, 'won');
});

test('running out of battery ends the game and shows what was missed', () => {
  const g = new Game(3);
  g.startRoom(4, SIZES[0]);
  g.collect(g.shown()[0]);
  g.charge = 0.001;
  assert.deepEqual(g.tick(0.5, true, null), { type: 'dying' });
  assert.equal(g.state, 'dying');
  assert.equal(g.tick(1, true, null), null, 'nothing happens while it dies');
  g.die();
  assert.equal(g.state, 'dead');
  assert.equal(g.missed().length, DIFFICULTY[4].targets - 1);
});

test('the offline copy includes every file the game needs', async () => {
  const { readFile, readdir } = await import('node:fs/promises');
  const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  const listed = new Set([...sw.matchAll(/'([^']+\.(?:js|css|woff2|png|svg|webmanifest|html))'/g)].map((m) => m[1]));
  const needed = [
    ...(await readdir(new URL('../js/', import.meta.url))).map((f) => `js/${f}`),
    ...(await readdir(new URL('../css/', import.meta.url))).map((f) => `css/${f}`),
    ...(await readdir(new URL('../fonts/', import.meta.url))).filter((f) => f.endsWith('.woff2')).map((f) => `fonts/${f}`),
    'index.html', 'icon.svg', 'manifest.webmanifest',
  ];
  for (const f of needed) assert.ok(listed.has(f), `sw.js doesn't keep ${f}`);
});

test('easy, medium and hard change the battery, the beam and the spares', () => {
  const { easy, medium, hard } = MODES;
  assert.ok(easy.drain < medium.drain && medium.drain < hard.drain, 'the battery lasts longest on easy');
  assert.ok(easy.boost > medium.boost && medium.boost > hard.boost, 'spares give most on easy');
  assert.ok(easy.beam > medium.beam && medium.beam > hard.beam, 'the beam is widest on easy');
  assert.ok(easy.dwell < medium.dwell && medium.dwell < hard.dwell, 'picking up is quickest on easy');
  // What the title screen says about each one is what it does.
  for (const m of Object.values(MODES)) assert.ok(m.note.includes(`${Math.round(1 / m.drain)} seconds of light`) || m.note.startsWith(`${Math.round(1 / m.drain)} seconds`), m.name);
  assert.match(easy.note, /Spares add half a battery/);
  assert.match(medium.note, new RegExp(`spares add ${Math.round(medium.boost * 100)}%`));
  assert.match(hard.note, new RegExp(`Spares add ${Math.round(hard.boost * 100)}%`));

  const played = (mode) => {
    const g = new Game(8, mode);
    g.startRoom(1, SIZES[0]);
    g.tick(10, true, { x: -999, y: -999, r: 10 });
    const used = 1 - g.charge;
    g.charge = 0.2;
    g.collect(g.scene.batteries[0]);
    return { used, boosted: g.charge - 0.2, spares: g.scene.batteries.length };
  };
  const e = played('easy');
  const m = played('medium');
  const h = played('hard');
  assert.ok(e.used < m.used && m.used < h.used);
  assert.ok(Math.abs(m.used - 10 * medium.drain) < 1e-9);
  assert.ok(e.boosted > m.boosted && m.boosted > h.boosted);
  assert.equal(e.spares, DIFFICULTY[1].batteries + 1, 'easy hides one more spare');
  assert.equal(m.spares, DIFFICULTY[1].batteries);
  assert.equal(h.spares, DIFFICULTY[1].batteries);
  assert.equal(new Game(1, 'nonsense').modeName, 'medium');
  assert.equal(new Game(1, 'constructor').modeName, 'medium');
});

test('picking up takes longer on hard', () => {
  const g = new Game(5, 'hard');
  g.startRoom(1, SIZES[0]);
  const id = g.shown()[0];
  assert.equal(g.tick(MODES.medium.dwell + 0.05, true, aimAt(g, id)), null);
  assert.equal(g.tick(MODES.hard.dwell - MODES.medium.dwell, true, aimAt(g, id)).type, 'found');
});
