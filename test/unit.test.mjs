// The rules and the room layouts, without a browser:  node --test test/unit.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOMS, DIFFICULTY, LOOKALIKES, lookalikeOf } from '../js/rooms.js';
import { buildScene, centerOf } from '../js/scene.js';
import { Game, MODES, LIST_SHOWN, cleanRun } from '../js/game.js';

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
  const onShelves = new Set(ROOMS.flatMap((room) => room.things.map((t) => t[0])));
  for (const pair of LOOKALIKES) {
    assert.equal(pair.length, 2);
    for (const e of pair) assert.ok(onShelves.has(e), `look-alike ${e} isn't spelled as it is on the shelves`);
  }
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
        // A thing tucked at the back of a shelf keeps at least half its width clear of the front row.
        for (const it of [...listed, ...sc.batteries.map((id) => sc.items[id])]) {
          if (it.layer !== 0) continue;
          const a = it.x - it.size / 2;
          const b = it.x + it.size / 2;
          const spans = sc.items.filter((f) => f.layer === 1 && f.shelf === it.shelf).map((f) => [Math.max(a, f.x - f.size / 2), Math.min(b, f.x + f.size / 2)]);
          let covered = 0;
          let end = a;
          for (const [l, r] of spans.filter(([l, r]) => r > l).sort((p, q) => p[0] - q[0])) {
            if (r > end) { covered += r - Math.max(l, end); end = r; }
          }
          assert.ok(covered <= it.size * 0.5 + 1e-9, `${where}: ${it.e} is ${Math.round((100 * covered) / it.size)}% hidden behind the front row`);
        }
      });
    }
  }
});

test('a big screen is no harder to search than a phone', () => {
  // The battery lasts the same seconds everywhere, so the beam has to light the same share of the room, with no more
  // things to look through, however big the screen. The room keeps the screen's shape so the page can draw it to fill it.
  const look = (room, size) => {
    let share = 0;
    let things = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const sc = buildScene(ROOMS[room], DIFFICULTY[room], size, rng(seed * 100 + room));
      assert.ok(Math.abs(sc.w / sc.h - size.w / size.h) < 1e-9, `${size.w}x${size.h}: the room is not the screen's shape`);
      share += (Math.PI * sc.beam ** 2) / (sc.w * sc.h) / 10;
      things += sc.items.length / 10;
    }
    return { share, things };
  };
  for (const room of [0, 3, 6]) {
    const phone = look(room, { w: 390, h: 647 });
    for (const size of [{ w: 820, h: 1010 }, { w: 1280, h: 630 }, { w: 1920, h: 910 }, { w: 2560, h: 1270 }, { w: 3840, h: 1950 }]) {
      const it = look(room, size);
      const where = `${ROOMS[room].id} at ${size.w}x${size.h}`;
      assert.ok(Math.abs(it.share / phone.share - 1) < 0.01, `${where}: the beam lights ${(it.share * 100).toFixed(1)}% of the room, ${(phone.share * 100).toFixed(1)}% on a phone`);
      assert.ok(it.things <= phone.things * 1.15, `${where}: ${it.things.toFixed(0)} things to search, ${phone.things.toFixed(0)} on a phone`);
    }
  }
});

test('a room laid out again for a turned phone keeps its list, its finds and its spares', () => {
  const upright = { w: 390, h: 640 };
  const sideways = { w: 800, h: 250 };
  const emoji = (sc, ids) => ids.map((id) => sc.items[id].e);
  const where = (sc) => sc.items.map((i) => [i.e, i.x, i.bottom, i.size]);
  const g = new Game(5);
  g.startRoom(2, upright);
  const before = g.scene;
  const thing = g.shown()[1];
  g.collect(thing);
  g.listed = new Set(g.shown());
  g.charge = 0.3;
  const spare = before.batteries[0];
  g.collect(spare);
  const shown = emoji(before, g.shown());
  const { charge, foundTotal } = g;

  const map = g.relayout(sideways);
  const sc = g.scene;
  assert.ok(Math.abs(sc.w / sc.h - sideways.w / sideways.h) < 1e-9, 'the room is not laid out for the new shape');
  assert.deepEqual(emoji(sc, sc.list), emoji(before, before.list), 'the list changed');
  assert.deepEqual(emoji(sc, g.shown()), shown, 'the list shows different things');
  assert.deepEqual([...g.found].sort(), [map.get(thing), map.get(spare)].sort(), 'what was found is not what is found');
  assert.equal(sc.items[map.get(thing)].e, before.items[thing].e);
  assert.equal(sc.items[map.get(spare)].e, '🔋');
  assert.deepEqual([...g.listed].sort(), g.shown().sort(), 'the page and the rules show different things');
  assert.deepEqual([g.charge, g.foundTotal, g.state], [charge, foundTotal, 'playing']);
  for (const id of sc.list) assert.equal(sc.items.filter((o) => o.e === sc.items[id].e).length, 1, `${sc.items[id].e} is on the shelves more than once`);

  // Turned back, it's the room it was, with the same things found.
  g.state = 'dead';
  const back = g.relayout(upright);
  assert.deepEqual(where(g.scene), where(before), 'turning back builds a different room');
  assert.deepEqual([...g.found].sort(), [thing, spare].sort());
  assert.equal(back.get(map.get(thing)), thing);
  assert.equal(g.state, 'dead', 'laying out again brings the flashlight back');
});

test('a saved run carries on where it was, read back through storage', () => {
  const size = { w: 390, h: 640 };
  const emoji = (sc, ids) => ids.map((id) => sc.items[id].e);
  const g = new Game(77, 'hard');
  g.startRoom(1, size);
  g.collect(g.shown()[0]);
  g.startRoom(3, size); // walked on to the bathroom
  g.foundTotal = 9;
  const thing = g.shown()[2];
  g.collect(thing);
  g.charge = 0.2;
  const spare = g.scene.batteries[0];
  g.collect(spare);
  g.charge = 0.37;
  const run = cleanRun(JSON.parse(JSON.stringify(g.snapshot())));
  assert.deepEqual(run, g.snapshot(), 'the run changes on its way through storage');

  const back = Game.resume(run);
  back.startRoom(run.room, size, run);
  assert.deepEqual([back.modeName, back.roomIndex, back.charge, back.foundTotal, back.roomsVisited], ['hard', 3, 0.37, 10, 3]);
  assert.deepEqual(back.scene.items.map((i) => [i.e, i.x, i.bottom]), g.scene.items.map((i) => [i.e, i.x, i.bottom]), 'the same screen builds a different room');
  assert.deepEqual([...back.found].sort(), [thing, spare].sort());
  // On a screen of another shape, the same list, finds and spares.
  const other = Game.resume(run);
  other.startRoom(run.room, { w: 800, h: 250 }, run);
  assert.deepEqual(emoji(other.scene, other.scene.list), emoji(g.scene, g.scene.list));
  assert.deepEqual(emoji(other.scene, other.shown()), emoji(g.scene, g.shown()));
  assert.deepEqual(emoji(other.scene, [...other.found]).sort(), [g.scene.items[thing].e, '🔋'].sort());

  // A cleared room carries on at the start of the next; a run that's over has nothing to carry on.
  while (g.shown().length) g.collect(g.shown()[0]);
  assert.deepEqual(cleanRun(g.snapshot()), { ...run, room: 4, foundTotal: g.foundTotal, list: [], found: [], spares: [] });
  g.startRoom(6, size);
  while (g.shown().length) g.collect(g.shown()[0]);
  assert.equal(g.state, 'won');
  assert.equal(g.snapshot(), null);
  const dead = new Game(3);
  dead.startRoom(0, size);
  dead.charge = 0.001;
  dead.tick(1, true, null);
  assert.equal(dead.snapshot(), null);
});

test('a damaged or hand-edited saved run never breaks the game', () => {
  const good = { seed: 5, mode: 'medium', room: 2, firstRoom: 0, charge: 0.5, foundTotal: 7, list: [], found: [], spares: [] };
  const g = new Game(5);
  g.startRoom(2, { w: 390, h: 640 });
  const list = g.scene.list.map((id) => g.scene.items[id].e);
  for (const bad of [null, 7, '{}', [], { ...good, seed: '5' }, { ...good, mode: 'insane' }, { ...good, mode: 'constructor' }, { ...good, room: 7 },
    { ...good, room: 1.5 }, { ...good, room: '2' }, { ...good, charge: 0 }, { ...good, charge: 1.5 }, { ...good, charge: '0.5' }, { ...good, charge: NaN }]) {
    assert.equal(cleanRun(bad), null, JSON.stringify(bad));
  }
  assert.deepEqual(cleanRun({ ...good, firstRoom: 4, foundTotal: -2 }), { ...good, firstRoom: 2, foundTotal: 0 });
  assert.deepEqual(cleanRun({ ...good, foundTotal: 1e9 }), { ...good, foundTotal: 0 });
  assert.deepEqual(cleanRun({ ...good, seed: 2 ** 32 + 5 }), good);
  // A list this room couldn't have starts the room afresh; places that aren't there are dropped.
  for (const wrong of [list.slice(1), [...list.slice(1), list[1]], [...list.slice(1), '🦄'], 'abc', null]) {
    assert.deepEqual(cleanRun({ ...good, list: wrong, found: [0], spares: [0] }), good, JSON.stringify(wrong));
  }
  assert.deepEqual(cleanRun({ ...good, list, found: [1, 1, 9, -1, 0.5, '2'], spares: [0, 1, 3] }), { ...good, list, found: [1], spares: [0] });
  // Everything found: on to the next room, or nothing to carry on after the attic.
  assert.deepEqual(cleanRun({ ...good, list, found: [0, 1, 2, 3, 4] }), { ...good, room: 3 });
  const attic = new Game(5);
  attic.startRoom(6, { w: 390, h: 640 });
  assert.equal(cleanRun({ ...good, room: 6, list: attic.scene.list.map((id) => attic.scene.items[id].e), found: [0, 1, 2, 3, 4, 5] }), null);
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

test('the next list thing waits until the page shows it', () => {
  const g = new Game(5);
  g.startRoom(1, SIZES[0]);
  g.listed = new Set(g.shown()); // what the page's list shows
  g.collect(g.shown()[0]);
  const next = g.scene.list[LIST_SHOWN];
  assert.ok(g.shown().includes(next), 'the rules move the list along at once');
  assert.equal(g.tick(DWELL * 2, true, aimAt(g, next)), null, 'but the list still shows the thing just found');
  assert.equal(g.collect(next), null);
  g.listed = new Set(g.shown()); // the page fills the place
  assert.deepEqual(g.collect(next), { type: 'found', id: next });
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

test('a spare stays on the shelf until at least half of it would count', () => {
  for (const [name, { boost }] of Object.entries(MODES)) {
    const g = new Game(12, name);
    g.startRoom(0, SIZES[0]);
    const id = g.scene.batteries[0];
    for (const charge of [1, 1 - boost / 2 + 0.001]) {
      g.charge = charge;
      assert.notEqual(g.under(aimAt(g, id)), id, `${name}: the light finds a spare at ${charge}`);
      assert.equal(g.collect(id), null, `${name}: a spare is spent at ${charge}`);
      assert.equal(g.charge, charge);
    }
    assert.equal(g.scene.batteries.filter((b) => !g.found.has(b)).length, g.scene.batteries.length, 'the spares are all still there');
    g.charge = 1 - boost / 2;
    assert.equal(g.under(aimAt(g, id)), id);
    assert.deepEqual(g.collect(id), { type: 'battery', id });
    assert.ok(Math.abs(g.charge - 1) < 1e-9, `${name}: the spare didn't fill the battery`);
  }
});

test('the list counts what waits after the shown things, whatever spares were picked up', () => {
  const g = new Game(12);
  g.startRoom(5, SIZES[0]);
  const waiting = DIFFICULTY[5].targets - LIST_SHOWN;
  assert.equal(g.waiting(), waiting);
  g.charge = 0.3;
  g.collect(g.scene.batteries[0]);
  assert.equal(g.waiting(), waiting, 'a spare picked up counts as a list thing found');
  g.collect(g.shown()[0]);
  assert.equal(g.waiting(), waiting - 1);
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

test('the README names every script', async () => {
  const { readFile, readdir } = await import('node:fs/promises');
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  const scripts = [...(await readdir(new URL('../js/', import.meta.url))).map((f) => `js/${f}`), 'carry.js'];
  for (const f of scripts) assert.ok(readme.includes(`\`${f}\``), `README.md doesn't mention ${f}`);
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
