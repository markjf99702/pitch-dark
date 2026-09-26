// Drawing: the room as it would look with the lights on (drawn once per room into its own canvas),
// and the light that decides how much of it you actually see.

export const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';

// Draw the whole room, lit, into canvas. view: { W, H, ox, oy, s, dpr } places the scene on screen.
// hidden: ids of things already picked up.
export function drawRoom(canvas, scene, view, hidden = new Set()) {
  const { W, H, ox, oy, s, dpr } = view;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const { room, E } = scene;
  const floorY = oy + scene.floorLine * s;

  wall(ctx, room.wall, 0, 0, W, floorY, E * s);
  floor(ctx, room.floor, floorY, W, H, E * s);

  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(s, s);
  const items = scene.items.filter((it) => !hidden.has(it.id));
  const special = (it) => it.kind !== 'thing';
  const byLayer = (layer) => [...items.filter((it) => it.layer === layer && !special(it)), ...items.filter((it) => it.layer === layer && special(it))];

  shelving(ctx, scene, 'back');
  for (const it of byLayer(0)) thing(ctx, it);
  shelving(ctx, scene, 'shade');
  for (const d of scene.decor) {
    ctx.save();
    ctx.globalAlpha = d.alpha;
    ctx.translate(d.x, d.y);
    ctx.rotate((d.rot * Math.PI) / 180);
    ctx.font = `${d.size}px ${EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000';
    ctx.fillText(d.e, 0, 0);
    ctx.restore();
  }
  for (const it of byLayer(1)) thing(ctx, it);
  shelving(ctx, scene, 'front');
  for (const it of byLayer(2)) thing(ctx, it);
  ctx.restore();
}

const metrics = new Map();
function descentOf(ctx, e, size) {
  const key = e;
  if (!metrics.has(key)) {
    ctx.font = `100px ${EMOJI_FONT}`;
    const m = ctx.measureText(e);
    metrics.set(key, (m.actualBoundingBoxDescent || 0) / 100);
  }
  return metrics.get(key) * size;
}

function thing(ctx, it) {
  // A soft shadow where it touches the shelf.
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(it.x, it.bottom - it.size * 0.02, it.size * 0.4, it.size * 0.075, 0, 0, Math.PI * 2);
  ctx.fill();
  const lift = descentOf(ctx, it.e, it.size) + it.size * 0.02;
  ctx.save();
  ctx.translate(it.x, it.bottom);
  ctx.rotate((it.rot * Math.PI) / 180);
  ctx.font = `${it.size}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#000'; // colour emoji take their opacity from the fill
  ctx.fillText(it.e, 0, -lift);
  ctx.restore();
}

// The shelving unit, in three passes around the two rows of things.
function shelving(ctx, scene, pass) {
  const { shelves, posts, post, plank, top, w, room, E } = scene;
  const c = room.shelf;
  if (pass === 'back') {
    // The top of each shelf, seen from a little above.
    for (const sh of shelves) {
      ctx.fillStyle = c.top;
      ctx.fillRect(0, sh.y - plank * 0.75, w, plank * 0.87);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(0, sh.y - plank * 0.75, w, plank * 0.18);
    }
    return;
  }
  if (pass === 'shade') {
    // Darken the back row and the wall inside each compartment, most under the shelf above.
    let prev = top;
    for (const sh of shelves) {
      const y0 = prev;
      const y1 = sh.y + plank * 0.12;
      ctx.fillStyle = 'rgba(8,6,4,0.3)';
      ctx.fillRect(0, y0, w, y1 - y0);
      const g = ctx.createLinearGradient(0, y0, 0, y0 + (y1 - y0) * 0.5);
      g.addColorStop(0, 'rgba(0,0,0,0.5)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, y0, w, (y1 - y0) * 0.5);
      prev = sh.y + plank;
    }
    return;
  }
  // Front edges of the shelves, the uprights and the top.
  for (const sh of shelves) {
    ctx.fillStyle = c.face;
    ctx.fillRect(0, sh.y + plank * 0.12, w, plank * 0.88);
    ctx.fillStyle = c.edge;
    ctx.fillRect(0, sh.y + plank * 0.12, w, plank * 0.16);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, sh.y + plank * 0.9, w, plank * 0.1);
  }
  ctx.fillStyle = c.face;
  ctx.fillRect(0, top - plank, w, plank);
  ctx.fillStyle = c.edge;
  ctx.fillRect(0, top - plank * 0.25, w, plank * 0.25);
  const bottom = scene.floorStand;
  for (const x of posts) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x + post / 2, top, E * 0.12, bottom - top);
    ctx.fillStyle = c.face;
    ctx.fillRect(x - post / 2, top - plank, post, bottom - top + plank);
    ctx.fillStyle = c.edge;
    ctx.fillRect(x - post / 2, top - plank, post * 0.22, bottom - top + plank);
  }
}

function wall(ctx, c, x, y, w, h, E) {
  ctx.fillStyle = c.base;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = c.line;
  ctx.strokeStyle = c.line;
  switch (c.style) {
    case 'stripes': {
      const step = E * 0.7;
      for (let sx = 0; sx < w; sx += step * 2) ctx.fillRect(sx, y, step, h);
      break;
    }
    case 'dots': {
      const step = E * 0.9;
      for (let row = 0, sy = step / 2; sy < h; sy += step, row++) {
        for (let sx = (row % 2) * step / 2; sx < w; sx += step) {
          ctx.beginPath();
          ctx.arc(sx, sy, E * 0.09, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case 'tiles': {
      const step = E * 0.95;
      ctx.lineWidth = Math.max(1, E * 0.05);
      for (let sx = 0; sx < w; sx += step) line(ctx, sx, y, sx, h);
      for (let sy = 0; sy < h; sy += step) line(ctx, x, sy, w, sy);
      break;
    }
    case 'pegboard': {
      const step = E * 0.5;
      for (let sy = step / 2; sy < h; sy += step) {
        for (let sx = step / 2; sx < w; sx += step) {
          ctx.beginPath();
          ctx.arc(sx, sy, E * 0.06, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case 'panels': {
      const step = E * 1.3;
      ctx.lineWidth = Math.max(1, E * 0.06);
      for (let sx = step; sx < w; sx += step) line(ctx, sx, y, sx, h);
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      for (let sx = 0; sx < w; sx += step) ctx.fillRect(sx + E * 0.1, y, step * 0.3, h);
      break;
    }
    case 'planks': {
      const step = E * 0.62;
      ctx.lineWidth = Math.max(1, E * 0.05);
      let row = 0;
      for (let sy = step; sy < h; sy += step, row++) {
        line(ctx, x, sy, w, sy);
        for (let sx = (row % 3) * E * 1.4; sx < w; sx += E * 4.2) line(ctx, sx, sy - step, sx, sy);
      }
      break;
    }
    default: {
      // Plain plaster: a faint mottle.
      let seed = 7;
      const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      ctx.globalAlpha = 0.35;
      for (let i = 0; i < (w * h) / (E * E) * 3; i++) {
        const s = E * (0.2 + r() * 0.6);
        ctx.fillRect(r() * w, r() * h, s, s * 0.6);
      }
      ctx.globalAlpha = 1;
    }
  }
}

function floor(ctx, c, y0, W, H, E) {
  const h = H - y0;
  if (h <= 0) return;
  ctx.fillStyle = c.base;
  ctx.fillRect(0, y0, W, h);
  ctx.strokeStyle = c.line;
  ctx.fillStyle = c.line;
  ctx.lineWidth = Math.max(1, E * 0.05);
  const vx = W / 2;
  // Lines running away from you, meeting somewhere behind the wall.
  const converge = (step) => {
    for (let x = vx % step - step * 20; x < W + step * 20; x += step) line(ctx, vx + (x - vx) * 0.55, y0, x, H);
  };
  if (c.style === 'boards') {
    converge(E * 1.1);
  } else if (c.style === 'tiles' || c.style === 'checks') {
    converge(E * 1.3);
    for (let t = 0.12; t < 1; t += t * 0.9 + 0.1) line(ctx, 0, y0 + h * t, W, y0 + h * t);
  } else if (c.style === 'rug') {
    converge(E * 1.1);
    ctx.fillStyle = c.line;
    ctx.fillRect(W * 0.08, y0 + h * 0.3, W * 0.84, h);
    ctx.fillStyle = c.base;
    ctx.fillRect(W * 0.1, y0 + h * 0.42, W * 0.8, h);
  } else if (c.style === 'concrete') {
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.ellipse((W * (i * 0.37 + 0.1)) % W, y0 + h * (0.4 + (i % 3) * 0.2), E * 1.4, E * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // Dark where the floor meets the wall, and a skirting board.
  const g = ctx.createLinearGradient(0, y0, 0, y0 + h * 0.6);
  g.addColorStop(0, 'rgba(0,0,0,0.45)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, W, h);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, y0 - E * 0.2, W, E * 0.2);
}

function line(ctx, x0, y0, x1, y1) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

// --- Light ---

// A flashlight beam on the light canvas. x, y, r in light-canvas pixels.
// warm: 1 for a fresh battery, 0 for a failing one. power: brightness, 0 to 1.
// Drawn with 'lighten', so it tops up whatever light is already there rather than adding to it.
export function beam(lctx, x, y, r, warm, power) {
  const R = Math.round(255 * power);
  const G = Math.round((178 + 62 * warm) * power);
  const B = Math.round((105 + 105 * warm) * power);
  const col = (a) => `rgba(${R},${G},${B},${a})`;
  lctx.globalCompositeOperation = 'lighten';
  const spill = lctx.createRadialGradient(x, y, r * 0.8, x, y, r * 1.7);
  spill.addColorStop(0, col(0.08));
  spill.addColorStop(1, col(0));
  lctx.fillStyle = spill;
  lctx.fillRect(x - r * 1.8, y - r * 1.8, r * 3.6, r * 3.6);
  const g = lctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col(1));
  g.addColorStop(0.3, col(0.96));
  g.addColorStop(0.55, col(0.8));
  g.addColorStop(0.66, col(0.86));
  g.addColorStop(0.8, col(0.45));
  g.addColorStop(0.93, col(0.14));
  g.addColorStop(1, col(0));
  lctx.fillStyle = g;
  lctx.fillRect(x - r, y - r, r * 2, r * 2);
  lctx.globalCompositeOperation = 'source-over';
}

// How bright the beam is at a point, 0 to 1, for dust and rings.
export function beamAt(bx, by, r, x, y) {
  const d = Math.hypot(x - bx, y - by) / r;
  if (d >= 1) return 0;
  return d < 0.55 ? 1 : 1 - (d - 0.55) / 0.45;
}
