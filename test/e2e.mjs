// Plays Pitch Dark in Chromium through the real page:  node test/e2e.mjs  (needs Playwright)
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(join(execSync('npm root -g').toString().trim(), 'playwright')); }
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let body;
  try { body = await readFile(join(root, path === '/' ? 'index.html' : path)); } catch { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'text/html' });
  res.end(body);
}).listen(0);
const base = `http://localhost:${server.address().port}/`;

const browser = await pw.chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const page = await ctx.newPage();
const problems = [];
page.on('pageerror', e => problems.push(e.message));
page.on('console', m => { if (m.type() === 'error') problems.push(m.text()); });
page.on('requestfailed', r => problems.push('failed: ' + r.url()));
page.on('request', r => { if (!r.url().startsWith(base)) problems.push('left the site: ' + r.url()); });

const pd = (fn, arg) => page.evaluate(fn, arg);
const game = (fn, arg) => page.evaluate(([f, a]) => new Function('g', 'a', `return (${f})(g, a)`)(window.__pitchDark.game, a), [fn.toString(), arg]);
const text = sel => page.locator(sel).innerText();

// Shine the light on a thing and hold it there until it's picked up (the mouse has no finger offset).
async function pickUp(id) {
  const at = await pd(i => window.__pitchDark.screenOf(i), id);
  await page.mouse.move(at.x - 30, at.y - 20);
  await page.mouse.move(at.x, at.y, { steps: 4 });
  await page.waitForFunction(i => window.__pitchDark.game.found.has(i), id, { timeout: 4000 });
}

// What a screen reader gets: the names in Chrome's accessibility tree.
async function screenReader() {
  const cdp = await ctx.newCDPSession(page);
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  await cdp.detach();
  return nodes.filter(n => !n.ignored && n.name && n.name.value).map(n => n.name.value);
}

// Records the mode, the room's light and whether a card is up, every frame, until the next recording starts.
const recordFrames = () => pd(() => {
  const frames = window.__frames = [];
  const t0 = performance.now();
  const rec = () => {
    if (window.__frames !== frames) return;
    frames.push({ t: (performance.now() - t0) / 1000, mode: window.__pitchDark.mode, light: window.__pitchDark.roomLight.level, card: !document.getElementById('sheet').classList.contains('hidden') });
    if (frames.length < 3000) requestAnimationFrame(rec);
  };
  requestAnimationFrame(rec);
});
// How long the game stayed in a mode (seconds), the brightest the room got meanwhile, and how long until a card came up.
const timeIn = m => pd(m => {
  const f = window.__frames.filter(x => x.mode === m);
  if (!f.length) return { secs: 0, light: 0, untilCard: null };
  const card = f.find(x => x.card);
  return { secs: f[f.length - 1].t - f[0].t, light: Math.max(...f.map(x => x.light)), untilCard: card ? card.t - f[0].t : null };
}, m);
// Sets the battery the moment a mode starts; it stays put once a room is done.
const chargeWhen = (m, charge) => pd(([m, c]) => {
  const w = () => { if (window.__pitchDark.mode === m) window.__pitchDark.game.charge = c; else requestAnimationFrame(w); };
  requestAnimationFrame(w);
}, [m, charge]);

await page.goto(base + '?seed=11');
await page.evaluate(() => document.fonts.ready);

// The title screen, with the light wandering over the first room.
assert.equal(await text('#sheetTitle'), 'Pitch Dark');
assert.equal(await pd(() => window.__pitchDark.mode), 'title');

// The top bar and the list are faded out on the title, and out of reach: no tabbing, no taps, nothing for a screen reader.
await page.keyboard.press('Tab');
assert.equal(await pd(() => document.activeElement.id), 'room');
assert.notEqual(await pd(() => getComputedStyle(document.activeElement).outlineStyle), 'none', 'the room shows no focus');
await page.keyboard.press('Tab');
assert.equal(await pd(() => document.activeElement.getAttribute('role')), 'radio', 'Tab stops on something hidden');
const soundAt = await page.locator('#soundBtn').boundingBox();
await page.touchscreen.tap(soundAt.x + soundAt.width / 2, soundAt.y + soundAt.height / 2);
assert.equal(await page.getAttribute('#soundBtn', 'aria-pressed'), 'true', 'a tap where the hidden sound button sits turned the sound off');
const heard = await screenReader();
const decoys = ['Sound', 'Battery', 'The hall closet', ...await game(g => g.shown().map(i => g.scene.items[i].name))];
assert.deepEqual(decoys.filter(d => heard.includes(d)), [], 'a screen reader hears the hidden top bar or list');

// Switch on: the first room, with three things on the list.
await page.click('#sheetBtn');
assert.equal(await pd(() => window.__pitchDark.mode), 'play');
assert.equal(await text('#roomName'), 'The hall closet');
assert.equal(await text('#roomNo'), 'Room 1 of 7');
assert.equal(await text('#spares'), '2 spare batteries');
const shown = await game(g => g.shown());
assert.equal(shown.length, 3);
const names = await page.locator('#wants .want .n').allInnerTexts();
assert.deepEqual(names, await game((g, ids) => ids.map(i => g.scene.items[i].name), shown));
assert.ok(await page.locator('#hint').isVisible(), 'the first room explains the controls');
assert.equal(await pd(() => document.getElementById('hud').inert || document.getElementById('list').inert), false, 'the top bar and the list come back once the game starts');

// With the light off, the battery doesn't drain.
await page.waitForTimeout(600);
assert.equal(await game(g => g.charge), 1);

// Pick up the second thing on the list. It's crossed off, and the next thing on the list takes its place.
await pickUp(shown[1]);
assert.equal(await game(g => g.foundTotal), 1);
assert.ok(await game(g => g.charge) < 1, 'the light uses the battery');
await page.waitForFunction(id => document.querySelector(`#wants [data-id="${id}"]`) === null, shown[1], { timeout: 3000 });
const fourth = await game(g => g.scene.list[3]);
await page.waitForSelector(`#wants .want:nth-child(2)[data-id="${fourth}"]`, { timeout: 3000 });
assert.ok(await page.locator('#hint').isHidden(), 'the controls hint goes once something is found');

// Moving the mouse off the page switches the light off.
await page.mouse.move(195, 422);
await page.dispatchEvent('#room', 'pointerleave', { pointerType: 'mouse' });
const before = await game(g => g.charge);
await page.waitForTimeout(500);
assert.equal(await game(g => g.charge), before);

// A spare battery tops up the flashlight.
await game(g => { g.charge = 0.3; });
const battery = await game(g => g.scene.batteries[0]);
await pickUp(battery);
assert.ok(await game(g => g.charge) > 0.65);
assert.equal(await game(g => g.foundTotal), 1, 'a battery is not on the list');
assert.equal(await text('#spares'), '1 spare battery');
await page.waitForFunction(() => document.querySelector('#batteryPct').textContent !== '30%');

// Find the rest: lightning shows the room, then on to the next one.
while ((await game(g => g.shown())).length > 1) await pickUp((await game(g => g.shown()))[0]);
await recordFrames();
await chargeWhen('reveal', 0.554);
await pickUp((await game(g => g.shown()))[0]);
await page.waitForFunction(() => window.__pitchDark.mode === 'cleared', null, { timeout: 4000 });
const lightning = await timeIn('reveal');
assert.ok(lightning.secs > 1 && lightning.light > 0.9, `the lightning flashes before the card comes up: ${JSON.stringify(lightning)}`);
assert.equal(await text('#sheetTitle'), 'Got everything in the hall closet');
assert.equal(await text('#sheetBody'), '56% battery left. Next is the pantry.', 'the card says what the top bar says (55.4% rounds up)');
assert.equal(await text('#batteryPct'), '56%');
await page.click('#sheetBtn');
assert.equal(await pd(() => window.__pitchDark.mode), 'play');
assert.equal(await text('#roomName'), 'The pantry');
assert.equal(await text('#roomNo'), 'Room 2 of 7');
assert.equal(await text('#spares'), '1 spare battery');
assert.equal(await page.locator('#wants .want:not(.empty)').count(), 3);

// Let the battery run out: it flickers and dies, and the moonlight shows where the list things were.
await pickUp((await game(g => g.shown()))[0]);
// Light off for longer than the flicker lasts, so the room has been going too long for a skipped flicker to pass.
await page.dispatchEvent('#room', 'pointerleave', { pointerType: 'mouse' });
await page.waitForTimeout(1700);
await recordFrames();
await game(g => { g.charge = 0.004; });
const at = await pd(() => ({ x: innerWidth / 2, y: innerHeight / 2 }));
await page.mouse.move(at.x, at.y);
await page.mouse.move(at.x + 20, at.y + 10, { steps: 3 });
await page.waitForFunction(() => window.__pitchDark.mode === 'dead', null, { timeout: 5000 });
assert.ok((await timeIn('dying')).secs > 1.2, 'the flashlight flickers out before it dies');
await page.waitForFunction(() => !document.querySelector('#sheet').classList.contains('hidden'), null, { timeout: 5000 });
assert.equal(await text('#sheetKicker'), 'THE FLASHLIGHT DIED');
assert.equal(await text('#sheetTitle'), 'Stuck in the pantry');
assert.match(await text('#sheetBody'), /^You found 5 things in 2 rooms\./);
assert.equal(await game(g => g.missed().length), 4);
assert.match(await text('#sheetBody'), /Still on this room’s list, circled: (\S+ ){3}\S+$/u);
assert.equal(await pd(() => JSON.parse(localStorage.getItem('pitch-dark:best')).found), 5);
assert.equal(await pd(() => localStorage.getItem('pitch-dark:run')), null, 'a run that ended can still be carried on');

// The card can cover some of the circled things, so a tap on the room fades it away to look around, and another tap
// brings it back. Enter brings it back too, rather than starting again from behind it.
{
  assert.equal(await text('#sheetPeek'), 'Tap the room to look around.');
  const faded = (on, why) => page.waitForFunction(on => document.getElementById('sheet').classList.contains('hidden') === on, on, { timeout: 3000 }).catch(() => assert.fail(why));
  const above = (await page.locator('#sheet').boundingBox()).y / 2;
  await page.touchscreen.tap(195, above);
  await faded(true, 'a tap on the room leaves the card up');
  assert.ok(await pd(() => document.getElementById('sheet').inert), 'the faded card can still be tabbed to');
  await page.touchscreen.tap(195, above);
  await faded(false, 'a second tap leaves the card faded');
  assert.equal(await pd(() => document.getElementById('sheet').inert), false);
  await page.touchscreen.tap(195, above);
  await faded(true, 'a third tap leaves the card up');
  await page.keyboard.press('Enter');
  await faded(false, 'Enter leaves the card faded');
  assert.equal(await pd(() => window.__pitchDark.mode), 'dead', 'Enter started a new game from behind the faded card');
}

// Try again: back to the first room with a full battery.
await page.click('#sheetBtn');
assert.equal(await text('#roomName'), 'The hall closet');
assert.equal(await game(g => g.charge), 1);
assert.equal(await game(g => g.foundTotal), 0);

// Nothing overlaps badly: the list sits below the room and the top bar above it.
const box = sel => page.locator(sel).boundingBox();
const hudBox = await box('#hud');
const headBox = await box('.list-head');
const lowest = await game(g => Math.max(...g.scene.items.map(i => i.bottom)));
const v = await pd(() => window.__pitchDark.view);
assert.ok(v.oy + lowest * v.s <= headBox.y + 2, 'things on the floor run under the list');
const highest = await game(g => Math.min(...g.scene.items.map(i => i.bottom - i.size)));
assert.ok(v.oy + highest * v.s >= hudBox.y + hudBox.height - 12, 'things on the top shelf run under the top bar');

// A room number that isn't whole still opens a room.
await page.goto(base + '?seed=12&room=1.5');
await page.waitForFunction(() => window.__pitchDark.game?.scene, null, { timeout: 5000 });
await page.click('#sheetBtn');
assert.equal(await text('#roomNo'), 'Room 2 of 7');

// The last room: find everything and the power comes back.
await page.goto(base + '?seed=12&room=6');
await page.click('#sheetBtn');
assert.equal(await text('#roomName'), 'The attic');
while ((await game(g => g.shown())).length > 1) await pickUp((await game(g => g.shown()))[0]);
await recordFrames();
await chargeWhen('won', 0.554);
await pickUp((await game(g => g.shown()))[0]);
await page.waitForFunction(() => document.querySelector('#sheetTitle').textContent === 'The power’s back', null, { timeout: 5000 });
assert.ok((await timeIn('won')).untilCard > 1, 'the lights come back on before the card comes up');
assert.equal(await text('#sheetBody'), 'You found all 6 things with 56% battery left.');
assert.equal(await text('#batteryPct'), '56%');
assert.equal(await pd(() => JSON.parse(localStorage.getItem('pitch-dark:best')).wins), 1);
assert.equal(await pd(() => localStorage.getItem('pitch-dark:run')), null, 'a run that was won can still be carried on');

// Difficulty: picked on the title screen, remembered, and each has its own best.
{
  await page.goto(base + '?seed=15');
  await page.evaluate(() => document.fonts.ready);
  const checked = () => page.locator('#modes [aria-checked="true"]').innerText();
  assert.ok(await page.locator('#modes').isVisible(), 'the title screen offers a difficulty');
  assert.equal(await checked(), 'Medium');
  await page.click('#modes [data-mode="hard"]');
  assert.equal(await checked(), 'Hard');
  assert.match(await text('#modeNote'), /^A narrower beam and 60 seconds of light per battery\./);
  await page.focus('#modes [data-mode="hard"]');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await checked(), 'Medium', 'arrow keys move along the picker');
  assert.equal(await pd(() => window.__pitchDark.mode), 'title', 'choosing with the keyboard does not start the game');
  await page.keyboard.press('ArrowRight');
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await checked(), 'Hard', 'the choice is remembered');
  await page.click('#sheetBtn');
  assert.equal(await game(g => g.modeName), 'hard');
  assert.ok(await pd(() => document.getElementById('sheet').inert), 'the title card and its picker go once the game starts');
  const hardBeam = await game(g => g.mode.beam);
  assert.ok(hardBeam < 1);
  await pickUp((await game(g => g.shown()))[0]);
  await game(g => { g.charge = 0.004; });
  await page.mouse.move(100, 300, { steps: 3 });
  await page.waitForFunction(() => !document.querySelector('#sheet').classList.contains('hidden') && window.__pitchDark.mode === 'dead', null, { timeout: 6000 });
  assert.equal(await text('#sheetSmall'), 'That’s your best yet on hard.');
  assert.equal(await pd(() => JSON.parse(localStorage.getItem('pitch-dark:best:hard')).found), 1);
  assert.equal(await pd(() => JSON.parse(localStorage.getItem('pitch-dark:best')).found), 6, 'medium keeps its own best (6 from the attic win)');
  await page.click('#sheetAlt');
  assert.equal(await pd(() => window.__pitchDark.mode), 'title');
  assert.ok(await page.locator('#modes').isVisible());
  assert.equal(await text('#sheetSmall'), 'Best on hard: 1 thing');
  await page.click('#modes [data-mode="easy"]');
  assert.equal(await text('#sheetSmall'), '', 'no best yet on easy');
  await page.click('#sheetBtn');
  assert.equal(await game(g => g.modeName), 'easy');
  assert.equal(await text('#spares'), '3 spare batteries', 'easy hides one more spare');
  await page.evaluate(() => localStorage.setItem('pitch-dark:mode', 'medium'));
}

// Right after a find, the next thing on the list can't be picked up until the list shows it.
{
  await page.goto(base + '?seed=8&room=4');
  await page.click('#sheetBtn');
  const [first] = await game(g => g.shown());
  const fourth = await game(g => g.scene.list[3]);
  await pickUp(first);
  const spot = await pd(i => window.__pitchDark.screenOf(i), fourth);
  await page.mouse.move(spot.x, spot.y, { steps: 2 });
  const listed = await page.waitForFunction(i => window.__pitchDark.game.found.has(i) && (document.querySelector(`#wants [data-id="${i}"]`) ? 'on the list' : 'not on the list yet'), fourth, { polling: 'raf', timeout: 6000 });
  assert.equal(await listed.jsonValue(), 'on the list', 'the next thing was picked up before the list showed it');
}

// The same seed builds the same house. A room is laid out to fit between the top bar and the list, so it mustn't depend on
// what the list says when the room before is cleared (a long name takes two lines), and the title shows the room you play.
{
  const room = () => game(g => ({ h: g.scene.h, things: g.scene.items.map(i => i.e).join('') }));
  const pantry = async (words) => {
    await page.goto(base + '?seed=19&mode=medium');
    await page.waitForFunction(() => window.__pitchDark?.mode === 'title');
    const title = await room();
    await page.click('#sheetBtn');
    assert.deepEqual(await room(), title, 'the title shows a different room from the one you play');
    while ((await game(g => g.shown())).length) await pickUp((await game(g => g.shown()))[0]);
    await page.waitForFunction(() => window.__pitchDark.mode === 'cleared' && !document.getElementById('sheet').classList.contains('hidden'), null, { timeout: 5000 });
    const listHeight = await page.evaluate(w => {
      for (const n of document.querySelectorAll('#wants .n')) n.textContent = w;
      return document.getElementById('list').getBoundingClientRect().height;
    }, words);
    await page.click('#sheetBtn');
    return { listHeight, room: await room() };
  };
  const short = await pantry('Cap');
  const long = await pantry('Long-neck dinosaur');
  assert.ok(long.listHeight > short.listHeight, 'a long name on the list takes one line');
  assert.deepEqual(long.room, short.room, 'the pantry depends on what the list said when the closet was cleared');
}

// With reduced motion the lightning lights the room in one go, the list doesn't slide, and the flashlight fades out without flickering.
{
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(base + '?seed=16');
  await page.click('#sheetBtn');
  while ((await game(g => g.shown())).length > 1) await pickUp((await game(g => g.shown()))[0]);
  await recordFrames();
  await pickUp((await game(g => g.shown()))[0]);
  await page.waitForFunction(() => window.__pitchDark.mode === 'cleared', null, { timeout: 4000 });
  const light = await pd(() => window.__frames.filter(f => f.mode === 'reveal').map(f => f.light));
  const peak = light.indexOf(Math.max(...light));
  assert.ok(light.length > 20 && light.every((v, i) => !i || (i <= peak ? v >= light[i - 1] : v <= light[i - 1])), `the lightning flickers with reduced motion: ${light.map(v => v.toFixed(2))}`);
  assert.equal(await pd(() => { const li = document.querySelector('#wants .want'); li.classList.add('arriving'); return getComputedStyle(li).animationName; }), 'none', 'a new list thing slides in with reduced motion');
  await page.click('#sheetBtn');
  await page.mouse.move(195, 420);
  await page.mouse.move(205, 430, { steps: 3 });
  // How bright the room is under the beam, frame by frame, while the flashlight dies.
  await pd(() => {
    const room = document.getElementById('room').getContext('2d');
    window.__glow = [];
    const rec = () => {
      if (window.__pitchDark.mode === 'dying') {
        const { x, y } = window.__pitchDark.beamPos;
        const d = window.__pitchDark.view.dpr;
        const px = room.getImageData(Math.round(x * d) - 40, Math.round(y * d) - 40, 80, 80).data;
        let sum = 0;
        for (let i = 0; i < px.length; i += 4) sum += px[i] + px[i + 1] + px[i + 2];
        window.__glow.push(sum / (px.length / 4) / 3);
      }
      if (window.__pitchDark.mode !== 'dead') requestAnimationFrame(rec);
    };
    requestAnimationFrame(rec);
  });
  await game(g => { g.charge = 0.003; });
  await page.waitForFunction(() => window.__pitchDark.mode === 'dead', null, { timeout: 6000 });
  const glow = await pd(() => window.__glow);
  const backUp = Math.max(...glow.map((v, i) => v - Math.min(...glow.slice(0, i + 1))));
  assert.ok(glow.length > 20 && backUp < 3, `the flashlight flickers as it dies with reduced motion (it came back up by ${backUp.toFixed(1)})`);
  await page.emulateMedia({ reducedMotion: null });
}

// Fits a phone: nothing scrolls sideways.
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'the page scrolls sideways on a phone');

// Turning the phone mid-room lays the room out again for the new shape, as big as a room built that way, with the same
// list, what's been found still found and the spares that are left. The list's places follow the things to where they are.
{
  await page.goto(base + '?seed=13');
  await page.click('#sheetBtn');
  const look = () => pd(() => {
    const { game: g, view: v } = window.__pitchDark;
    const name = id => g.scene.items[id].name;
    return {
      s: v.s,
      list: g.scene.list.map(name),
      found: g.scene.list.filter(id => g.found.has(id)).map(name),
      spares: g.scene.batteries.filter(id => !g.found.has(id)).length,
      shown: g.shown().map(name),
      places: [...document.querySelectorAll('#wants .want')].map(li => (li.dataset.id ? name(+li.dataset.id) : null)),
      foundTotal: g.foundTotal,
    };
  });
  const turn = async (width, height) => {
    await page.setViewportSize({ width, height });
    await page.waitForFunction(w => window.__pitchDark.view.W === w, width, { timeout: 3000 });
  };
  // The list has caught up when its places show what the rules show (a found thing's place takes a moment to fill).
  const listFilled = () => page.waitForFunction(() => {
    const ids = list => JSON.stringify(list.sort((a, b) => a - b));
    const places = [...document.querySelectorAll('#wants .want')].filter(li => li.dataset.id).map(li => +li.dataset.id);
    return ids(places) === ids(window.__pitchDark.game.shown());
  }, null, { timeout: 3000 });
  await pickUp((await game(g => g.shown()))[0]);
  await game(g => { g.charge = 0.5; });
  await pickUp(await game(g => g.scene.batteries[0]));
  await listFilled();
  const before = await look();
  await turn(844, 390);
  const after = await look();
  assert.ok(after.s > 0.95, `turning the phone shrinks the room to ${after.s.toFixed(2)} of its size`);
  assert.deepEqual({ ...after, s: 1 }, { ...before, s: 1 }, 'turning the phone changes the list, what was found or the spares');
  // Turned back halfway through crossing a thing off, the list still moves along, and the light finds things where they are.
  await pickUp((await game(g => g.shown()))[0]);
  await turn(390, 844);
  await listFilled();
  assert.ok((await look()).s > 0.95);
  await pickUp((await game(g => g.shown()))[0]);
  assert.equal(await game(g => g.foundTotal), 3);
}

// On a phone on its side, the shelves keep clear of the notch, like the top bar and the list.
{
  const sideways = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const side = await sideways.newPage();
  const cdp = await sideways.newCDPSession(side);
  const notch = await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 47, bottom: 21, right: 47 } }).then(() => true, () => false);
  if (notch) {
    await side.goto(base + '?seed=4&room=3');
    await side.click('#sheetBtn');
    const edges = await side.evaluate(() => {
      const g = window.__pitchDark.game, v = window.__pitchDark.view;
      return { left: Math.min(...g.scene.items.map(i => v.ox + (i.x - i.size / 2) * v.s)), right: Math.max(...g.scene.items.map(i => v.ox + (i.x + i.size / 2) * v.s)), width: innerWidth };
    });
    assert.ok(edges.left >= 47 && edges.right <= edges.width - 47, `things on the shelves run under the notch: ${JSON.stringify(edges)}`);
  } else console.log('(skipped the notch check: this Chromium cannot fake safe-area insets)');
  await sideways.close();
}

// On a phone on its side the list is the smaller one, each thing beside its name, however wide the phone is.
{
  const sizes = {};
  for (const [width, height] of [[640, 360], [844, 390]]) {
    const sideways = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const side = await sideways.newPage();
    await side.goto(base + '?seed=4');
    await side.waitForFunction(() => window.__pitchDark?.mode === 'title');
    await side.click('#sheetBtn');
    sizes[width] = await side.evaluate(() => [...document.querySelector('#wants .want:not(.empty)').children].map(e => getComputedStyle(e).fontSize).join(' '));
    await sideways.close();
  }
  assert.equal(sizes[844], sizes[640], `the list is drawn at ${sizes[844]} on a phone on its side 844 px wide, ${sizes[640]} at 640 px`);
}

// The title card fits a phone on its side, down to 568x320, even with a run to carry on, a best and easy's longer note.
for (const [width, height] of [[568, 320], [640, 360], [844, 390]]) {
  const sideways = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const side = await sideways.newPage();
  await side.addInitScript(() => {
    localStorage.setItem('pitch-dark:mode', 'easy');
    localStorage.setItem('pitch-dark:best:easy', '{"found":12,"wins":2}');
    localStorage.setItem('pitch-dark:run', '{"seed":22,"mode":"hard","room":1,"firstRoom":0,"charge":0.4,"foundTotal":5}');
  });
  await side.goto(base + '?seed=5');
  await side.waitForFunction(() => window.__pitchDark?.mode === 'title');
  await side.evaluate(() => document.fonts.ready);
  const card = await side.evaluate(() => {
    const sheet = document.getElementById('sheet');
    const b = sheet.getBoundingClientRect();
    return { top: Math.round(b.top), bottom: Math.round(b.bottom), scrolls: sheet.scrollHeight > sheet.clientHeight + 1, alt: document.getElementById('sheetAlt').textContent, small: document.getElementById('sheetSmall').textContent };
  });
  assert.equal(card.alt, 'Carry on in the pantry on hard');
  assert.ok(card.small, 'no best on the title');
  assert.ok(card.top >= 0 && card.bottom <= height && !card.scrolls, `the title card runs off a ${width}x${height} screen: ${JSON.stringify(card)}`);
  await sideways.close();
}

// On a big screen the room is laid out no bigger than a laptop's and drawn larger to fill the screen, so the beam lights as
// much of it as on a phone, and the light still picks things up where they're drawn.
{
  const wide = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const big = await wide.newPage();
  big.on('pageerror', e => problems.push(e.message));
  big.on('console', m => { if (m.type() === 'error') problems.push(m.text()); });
  await big.goto(base + '?seed=18&room=2');
  await big.click('#sheetBtn');
  const look = await big.evaluate(() => {
    const pd = window.__pitchDark, sc = pd.game.scene, v = pd.view;
    return { s: v.s, area: sc.w * sc.h, left: v.ox, right: v.ox + sc.w * v.s, width: innerWidth };
  });
  assert.ok(look.area <= 775 * 775 + 1 && look.s > 1.5, `the room is laid out at the screen's size: ${JSON.stringify(look)}`);
  assert.ok(Math.abs(look.left) < 1 && Math.abs(look.right - look.width) < 1, `the room doesn't fill the screen: ${JSON.stringify(look)}`);
  const [first] = await big.evaluate(() => window.__pitchDark.game.shown());
  const at = await big.evaluate(i => window.__pitchDark.screenOf(i), first);
  await big.mouse.move(at.x - 40, at.y - 30);
  await big.mouse.move(at.x, at.y, { steps: 4 });
  await big.waitForFunction(i => window.__pitchDark.game.found.has(i), first, { timeout: 4000 });
  await wide.close();
}

// The page starts as the title, so nothing moves when the script arrives; with JavaScript off it only says it's needed.
{
  const early = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const first = await early.newPage();
  let release;
  const held = new Promise(r => { release = r; });
  await first.route('**/js/app.js', async route => { await held; await route.continue(); });
  await first.goto(base + '?seed=3', { waitUntil: 'commit' });
  await first.waitForSelector('#sheet', { state: 'attached' });
  await first.evaluate(() => document.fonts.ready);
  const look = () => first.evaluate(() => ({ title: document.getElementById('sheet').classList.contains('title-screen'), top: Math.round(document.getElementById('sheet').getBoundingClientRect().top), hud: getComputedStyle(document.getElementById('hud')).opacity, list: getComputedStyle(document.getElementById('list')).opacity }));
  const before = await look();
  assert.deepEqual({ ...before, top: 0 }, { title: true, top: 0, hud: '0', list: '0' }, 'before the script runs, the page is not the title');
  release();
  await first.waitForFunction(() => window.__pitchDark?.mode === 'title');
  await first.waitForTimeout(700);
  assert.ok(Math.abs((await look()).top - before.top) < 20, 'the title card moves when the script arrives');
  await early.close();

  const off = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
  const nojs = await off.newPage();
  await nojs.goto(base);
  assert.ok(await nojs.locator('.noscript').isVisible());
  for (const sel of ['#sheet', '#hud', '#list']) assert.ok(await nojs.locator(sel).isHidden(), `${sel} shows with JavaScript off`);
  await off.close();
}

// On a touchscreen the light shines a little above your finger, so the finger doesn't hide what it lights.
{
  await page.goto(base + '?seed=14');
  await page.click('#sheetBtn');
  const cdp = await ctx.newCDPSession(page);
  const target = (await game(g => g.shown()))[0];
  const spot = await pd(i => window.__pitchDark.screenOf(i), target);
  const lift = await pd(() => Math.min(90, window.__pitchDark.game.scene.beam * window.__pitchDark.view.s * 0.95));
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await touch('touchStart', spot.x, spot.y + lift + 30);
  await touch('touchMove', spot.x, spot.y + lift + 10);
  await touch('touchMove', spot.x, spot.y + lift);
  await page.waitForFunction(i => window.__pitchDark.game.found.has(i), target, { timeout: 4000 });
  const beam = await pd(() => ({ ...window.__pitchDark.beamPos }));
  assert.ok(Math.abs(beam.y - spot.y) < 12, 'the beam sits above the finger');
  await touch('touchEnd');
  const held = await game(g => g.charge);
  await page.waitForTimeout(400);
  assert.equal(await game(g => g.charge), held, 'lifting the finger switches the light off');
}

// A damaged best in storage reads back as whole numbers, never as odd text, and is saved back in the usual shape.
{
  for (const [stored, shown] of [
    ['{"found":5,"wins":"x"}', 'Best on medium: 5 things'],
    ['{"found":"12","wins":"2"}', 'Best on medium: 12 things · Made it through the house twice'],
    ['{"found":1e400}', ''],
    ['{"found":-3,"wins":2.7}', ''],
    ['"7"', ''],
  ]) {
    await page.evaluate(v => localStorage.setItem('pitch-dark:best', v), stored);
    await page.goto(base + '?seed=17&mode=medium');
    await page.waitForFunction(() => window.__pitchDark?.mode === 'title');
    assert.equal(await text('#sheetSmall'), shown, `the best stored as ${stored}`);
  }
  await page.evaluate(() => localStorage.removeItem('pitch-dark:run')); // no run left from before to count toward it
  await page.click('#sheetBtn');
  await game(g => { g.charge = 0.003; });
  await page.mouse.move(150, 400);
  await page.mouse.move(170, 410, { steps: 3 });
  await page.waitForFunction(() => window.__pitchDark.mode === 'dead', null, { timeout: 6000 });
  assert.equal(await pd(() => localStorage.getItem('pitch-dark:best')), '{"found":0,"wins":0}');
  await page.evaluate(() => localStorage.removeItem('pitch-dark:best'));
}

// A reload mid-run keeps the run. The title offers to carry on in the room it was in, with its list, what had been found,
// the spares left and the battery as it was when the page went away, even on a screen of another shape. A run that isn't
// carried on still counts toward the best, and one that ends counts at once, even if the page reloads as the light dies.
{
  const look = () => pd(() => {
    const g = window.__pitchDark.game;
    const name = id => g.scene.items[id].name;
    return { mode: g.modeName, room: g.roomIndex, list: g.scene.list.map(name), found: g.scene.list.filter(id => g.found.has(id)).map(name), spares: g.scene.batteries.filter(id => !g.found.has(id)).length, foundTotal: g.foundTotal, charge: g.charge };
  });
  const reload = async () => {
    await page.reload();
    await page.waitForFunction(() => window.__pitchDark?.mode === 'title');
  };
  await page.goto(base + '?seed=22&room=1');
  await page.click('#sheetBtn');
  await pickUp((await game(g => g.shown()))[1]);
  await game(g => { g.charge = 0.5; });
  await pickUp(await game(g => g.scene.batteries[0]));
  await page.dispatchEvent('#room', 'pointerleave', { pointerType: 'mouse' });
  await game(g => { g.charge = 0.42; }); // the light was on a while after the last find
  const before = await look();
  await reload();
  assert.equal(await text('#sheetAlt'), 'Carry on in the pantry');
  await page.click('#sheetAlt');
  assert.equal(await pd(() => window.__pitchDark.mode), 'play');
  assert.deepEqual(await look(), before, 'the run carried on differently');
  assert.equal(await text('#roomName'), 'The pantry');
  assert.equal(await text('#spares'), 'No spares left');
  assert.equal(await text('#batteryPct'), '42%');
  assert.deepEqual(await page.locator('#wants .want .n').allInnerTexts(), (await look()).list.filter(n => !before.found.includes(n)).slice(0, 3));

  await page.setViewportSize({ width: 844, height: 390 });
  await reload();
  await page.click('#sheetAlt');
  assert.deepEqual(await look(), before, 'the run carried on differently on a phone on its side');
  assert.ok(await pd(() => window.__pitchDark.view.s) > 0.95);
  await page.setViewportSize({ width: 390, height: 844 });

  await reload();
  assert.equal(await pd(() => localStorage.getItem('pitch-dark:best')), null);
  await page.click('#sheetBtn');
  assert.equal(await pd(() => JSON.parse(localStorage.getItem('pitch-dark:best')).found), 1, 'a run left behind did not count toward the best');
  assert.equal(await game(g => g.foundTotal), 0);

  await pickUp((await game(g => g.shown()))[0]);
  await pickUp((await game(g => g.shown()))[0]);
  await game(g => { g.charge = 0.003; });
  await page.mouse.move(150, 400, { steps: 2 });
  await page.waitForFunction(() => window.__pitchDark.mode === 'dying', null, { timeout: 5000 });
  await reload();
  assert.ok(await page.locator('#sheetAlt').isHidden(), 'the title offers to carry on a run whose flashlight died');
  assert.equal(await pd(() => JSON.parse(localStorage.getItem('pitch-dark:best')).found), 2, 'a reload as the light died lost the run');
  await page.evaluate(() => localStorage.removeItem('pitch-dark:best'));
}

// Works offline once it has been opened.
await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 10000 }).catch(() => {});
await ctx.setOffline(true);
await page.reload();
assert.equal(await page.title(), 'Pitch Dark', 'the page did not load offline');
await page.waitForFunction(() => window.__pitchDark?.mode === 'title', null, { timeout: 5000 });
await ctx.setOffline(false);

assert.deepEqual(problems.filter(p => !p.startsWith('failed:')), [], 'problems while using it');
await browser.close();
server.close();
console.log('all good');
