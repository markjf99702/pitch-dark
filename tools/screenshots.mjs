// Renders the README screenshots (docs/*.png) and the link preview (og.png):  node tools/screenshots.mjs
// The house comes from ?seed and Math.random is seeded, so the same pictures come out every time.
// Needs Playwright, and upng-js from `npm install` to save them with a 256-colour palette.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(join(execSync('npm root -g').toString().trim(), 'playwright')); }
const UPNG = require('upng-js');
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
async function save(page, path) {
  const img = UPNG.decode(await page.screenshot());
  await writeFile(join(root, path), Buffer.from(UPNG.encode(UPNG.toRGBA8(img), img.width, img.height, 256)));
}
await mkdir(join(root, 'docs'), { recursive: true });

async function open(viewport, deviceScaleFactor, query) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    let a = 4; // mulberry32
    Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  });
  await page.goto(base + query);
  await page.evaluate(() => document.fonts.ready);
  await page.click('#sheetBtn');
  return page;
}

const shown = page => page.evaluate(() => window.__pitchDark.game.shown());
const spot = (page, id) => page.evaluate(i => window.__pitchDark.screenOf(i), id);
async function pickUp(page, id) {
  const p = await spot(page, id);
  await page.mouse.move(p.x, p.y, { steps: 3 });
  await page.waitForFunction(i => window.__pitchDark.game.found.has(i), id);
}

// Searching the garage: the light resting on something from the list.
{
  const page = await open({ width: 390, height: 844 }, 2, '?seed=31&room=4');
  const ids = await shown(page);
  await pickUp(page, ids[1]);
  await page.waitForTimeout(1400);
  // Aim at whichever list thing sits nearest the middle of the screen.
  const middle = await page.evaluate(() => ({ x: innerWidth / 2, y: innerHeight * 0.45 }));
  const options = await shown(page);
  const far = await Promise.all(options.map(async id => { const p = await spot(page, id); return Math.hypot(p.x - middle.x, p.y - middle.y); }));
  const next = options[far.indexOf(Math.min(...far))];
  const p = await spot(page, next);
  await page.mouse.move(p.x - 70, p.y + 30);
  await page.mouse.move(p.x, p.y, { steps: 6 });
  await page.waitForFunction(() => (window.__pitchDark.game.aim?.t || 0) > 0.3);
  await save(page, 'docs/phone-search.png');
  await page.context().close();
}

// The kids' room, lit by lightning after the last thing on its list.
{
  const page = await open({ width: 390, height: 844 }, 2, '?seed=32&room=2');
  for (let ids = await shown(page); ids.length; ids = await shown(page)) await pickUp(page, ids[0]);
  await page.waitForFunction(() => window.__pitchDark.mode === 'cleared');
  await page.mouse.move(5, 5);
  await page.waitForTimeout(900);
  await save(page, 'docs/phone-lightning.png');
  await page.context().close();
}

// The attic in moonlight after the battery gives out, with the things that were left circled.
{
  const page = await open({ width: 390, height: 844 }, 2, '?seed=33&room=6');
  await pickUp(page, (await shown(page))[0]);
  await pickUp(page, (await shown(page))[0]);
  await page.evaluate(() => { window.__pitchDark.game.charge = 0.002; });
  await page.mouse.move(200, 400, { steps: 3 });
  await page.waitForFunction(() => window.__pitchDark.mode === 'dead');
  await page.waitForTimeout(3600);
  await save(page, 'docs/phone-moonlight.png');
  await page.context().close();
}

// Link preview, 1200 x 630: the game itself, the name over the dark side and the light on a shelf.
{
  const page = await open({ width: 1200, height: 630 }, 1, '?seed=34&room=1');
  await page.evaluate(() => {
    for (const id of ['hud', 'list', 'hint']) document.getElementById(id).style.visibility = 'hidden';
    const card = document.createElement('div');
    card.innerHTML = '<h1>Pitch Dark</h1><p>The power’s out. Find what’s on the list by flashlight before the battery dies.</p>';
    card.style.cssText = 'position:fixed;left:72px;top:50%;transform:translateY(-50%);width:430px;z-index:9;color:#efe7d6;font-family:"Bricolage Grotesque",sans-serif';
    card.querySelector('h1').style.cssText = 'margin:0 0 18px;font-size:104px;font-weight:800;line-height:.95;letter-spacing:-.035em;text-shadow:0 0 50px rgba(255,219,143,.28)';
    card.querySelector('p').style.cssText = 'margin:0;font-size:29px;line-height:1.3;color:#b8ae9c';
    document.body.append(card);
  });
  await page.evaluate(() => { window.__pitchDark.game.scene.beam *= 1.5; });
  await page.mouse.move(830, 330);
  await page.mouse.move(860, 318, { steps: 8 });
  await page.waitForTimeout(700);
  await save(page, 'og.png');
  await page.context().close();
}

await browser.close();
server.close();
console.log('screenshots written');
