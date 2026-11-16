// Tidewire renderer — my own implementation, written from the public interface
// (main.js calls draw(state, ctx); state.js owns the rules; config.js owns layout).
// Everything on screen is procedural Canvas 2D: a night-chart sea, switchgear tiles
// with live pipes, generator / beacon nodes at the board edges, a HUD side panel,
// and title / win / fail / complete overlays. No images, no network.
import { GRID, SIDE, W, H, COLORS, DIRS } from './config.js';
import { tileConnections, tileName } from './tiles.js';

// ---------------------------------------------------------------- helpers

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Deterministic star field, fixed at module load so the sky never flickers.
const STARS = (() => {
  let s = 20261116;
  const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  const out = [];
  for (let i = 0; i < 90; i++) {
    out.push({ x: rnd() * W, y: rnd() * 150, r: 0.6 + rnd() * 1.5, a: 0.25 + rnd() * 0.6 });
  }
  return out;
})();

// ---------------------------------------------------------------- geometry

// Centre of a board position. Sources / receivers sit just outside the grid
// (x = -1 left, x = cols right, y = -1 above, y = rows below); tiles use the
// same helper so flow edges line up through tile centres.
function nodeCenter(x, y) {
  let cx;
  if (x < 0) cx = GRID.x - 30;
  else if (x >= GRID.cols) cx = GRID.x + GRID.cols * GRID.cell + (GRID.cols - 1) * GRID.gap + 30;
  else cx = GRID.x + x * (GRID.cell + GRID.gap) + GRID.cell / 2;
  let cy;
  if (y < 0) cy = GRID.y - 30;
  else if (y >= GRID.rows) cy = GRID.y + GRID.rows * GRID.cell + (GRID.rows - 1) * GRID.gap + 30;
  else cy = GRID.y + y * (GRID.cell + GRID.gap) + GRID.cell / 2;
  return { x: cx, y: cy };
}

function cellRect(x, y) {
  return {
    x: GRID.x + x * (GRID.cell + GRID.gap),
    y: GRID.y + y * (GRID.cell + GRID.gap),
    w: GRID.cell,
    h: GRID.cell,
  };
}

function pipeColor(tile) {
  // A storage cell is built to hold 2; only a load past 2 overheats it.
  // Any other lit tile overheats past 1.
  if (tile.type === 'storage') {
    if (tile.load > 2) return COLORS.pathHot;
    if (!tile.powered) return COLORS.pathOff;
    return tile.charged ? COLORS.pathStore : COLORS.pathOn;
  }
  if (tile.load > 1) return COLORS.pathHot;
  if (!tile.powered) return COLORS.pathOff;
  return COLORS.pathOn;
}

function receiverState(state, recv) {
  const sim = state.sim;
  if (sim && sim.receivers) {
    const hit = sim.receivers.get(recv.id);
    if (hit) return hit;
  }
  return { load: 0, powered: false };
}

function tileAt(state, x, y) {
  return state.tiles.get(`${x},${y}`) || null;
}

// ---------------------------------------------------------------- backdrop

function drawBackground(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, COLORS.bg0);
  g.addColorStop(0.55, COLORS.bg1);
  g.addColorStop(1, '#071120');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  for (const s of STARS) {
    ctx.globalAlpha = s.a;
    ctx.fillStyle = '#cfe8e2';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Slow swell lines across the top of the chart, purely decorative.
  ctx.strokeStyle = 'rgba(111, 166, 161, 0.20)';
  ctx.lineWidth = 2;
  for (let row = 0; row < 3; row++) {
    ctx.beginPath();
    for (let x = 0; x <= W; x += 24) {
      const y = 118 + row * 16 + Math.sin((x + row * 140) / 190) * 5;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function drawHeader(state, ctx) {
  ctx.fillStyle = COLORS.text;
  ctx.font = '700 40px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('TIDEWIRE', 70, 62);
  const titleW = ctx.measureText('TIDEWIRE').width;

  ctx.fillStyle = COLORS.muted;
  ctx.font = 'italic 17px Georgia, serif';
  ctx.fillText('a storm-night signal-routing puzzle', 70 + titleW + 16, 60);

  // Scenario pill, top right.
  const label = `SCENARIO ${state.levelIndex + 1} / 3 — ${state.level.name.toUpperCase()}`;
  ctx.font = '700 15px Georgia, serif';
  const tw = ctx.measureText(label).width;
  const px = W - 70 - tw - 28;
  rr(ctx, px, 26, tw + 28, 34, 17);
  ctx.fillStyle = COLORS.panel2;
  ctx.fill();
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = COLORS.receiverOn;
  ctx.fillText(label, px + 14, 49);

  // Thin rule under the header.
  ctx.strokeStyle = 'rgba(111, 166, 161, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(70, 84);
  ctx.lineTo(W - 70, 84);
  ctx.stroke();

  ctx.fillStyle = COLORS.muted;
  ctx.font = '15px Georgia, serif';
  ctx.fillText(state.level.goal, 70, 112);
}

// ---------------------------------------------------------------- board

function drawTile(ctx, tile, isSelected, canPlay) {
  const r = cellRect(tile.x, tile.y);
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const color = pipeColor(tile);

  // Cell body.
  rr(ctx, r.x, r.y, r.w, r.h, 12);
  ctx.fillStyle = tile.powered ? '#16405e' : COLORS.panel;
  ctx.fill();
  ctx.strokeStyle = tile.powered ? color : COLORS.grid;
  ctx.lineWidth = tile.powered ? 2 : 1;
  ctx.stroke();

  // Pipes: one arm per connection, centre to the cell edge.
  ctx.strokeStyle = color;
  ctx.lineWidth = 11;
  ctx.lineCap = 'round';
  for (const d of tileConnections(tile)) {
    const v = DIRS[d];
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + v.x * (GRID.cell / 2 - 4), cy + v.y * (GRID.cell / 2 - 4));
    ctx.stroke();
  }

  // Hub at the centre.
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.fillStyle = '#0d2740';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  if (tile.type === 'storage') {
    // Battery body with a charge bar; amber while holding a surge.
    const bw = 46;
    const bh = 24;
    rr(ctx, cx - bw / 2, cy - bh / 2, bw, bh, 5);
    ctx.fillStyle = tile.charged ? COLORS.pathStore : '#274b5e';
    ctx.fill();
    ctx.strokeStyle = COLORS.text;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#0d2740';
    ctx.fillRect(cx + bw / 2, cy - 5, 5, 10);
    if (tile.charged) {
      ctx.fillStyle = '#0d2740';
      ctx.fillRect(cx - bw / 2 + 5, cy - bh / 2 + 5, bw - 16, bh - 10);
    }
    if (tile.released) {
      ctx.strokeStyle = COLORS.pathStore;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 16, cy + 26);
      ctx.lineTo(cx + 16, cy + 26);
      ctx.stroke();
    }
  }

  if (tile.fixed) {
    // Bolt heads in the corners mark anchored hardware that cannot rotate.
    ctx.fillStyle = COLORS.muted;
    for (const [bx, by] of [[8, 8], [r.w - 8, 8], [8, r.h - 8], [r.w - 8, r.h - 8]]) {
      ctx.beginPath();
      ctx.arc(r.x + bx, r.y + by, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Load badge: red and loud only past the tile's real limit (2 for storage, 1 else).
  if (tile.load > 0) {
    const hot = tile.type === 'storage' ? tile.load > 2 : tile.load > 1;
    ctx.beginPath();
    ctx.arc(r.x + r.w - 16, r.y + 16, 13, 0, Math.PI * 2);
    ctx.fillStyle = hot ? COLORS.pathHot : COLORS.pathOn;
    ctx.fill();
    ctx.fillStyle = '#081625';
    ctx.font = '700 15px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(tile.load), r.x + r.w - 16, r.y + 17);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // Type caption along the bottom edge of the cell.
  ctx.fillStyle = 'rgba(185, 200, 195, 0.85)';
  ctx.font = '10px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(tileName(tile.type).toUpperCase(), cx, r.y + r.h - 9);
  ctx.textAlign = 'left';

  if (isSelected && canPlay) {
    rr(ctx, r.x - 4, r.y - 4, r.w + 8, r.h + 8, 15);
    ctx.strokeStyle = COLORS.focus;
    ctx.lineWidth = 3;
    ctx.stroke();
    // Corner ticks so the selection reads even on a lit tile.
    ctx.strokeStyle = COLORS.focus;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    const t = 14;
    const corners = [
      [r.x - 4, r.y - 4, 1, 1], [r.x + r.w + 4, r.y - 4, -1, 1],
      [r.x - 4, r.y + r.h + 4, 1, -1], [r.x + r.w + 4, r.y + r.h + 4, -1, -1],
    ];
    for (const [x0, y0, sx, sy] of corners) {
      ctx.beginPath();
      ctx.moveTo(x0 + sx * t, y0);
      ctx.lineTo(x0, y0);
      ctx.lineTo(x0, y0 + sy * t);
      ctx.stroke();
    }
  }
}

function drawEmptyCells(ctx, state) {
  for (let y = 0; y < GRID.rows; y++) {
    for (let x = 0; x < GRID.cols; x++) {
      if (tileAt(state, x, y)) continue;
      const r = cellRect(x, y);
      rr(ctx, r.x, r.y, r.w, r.h, 12);
      ctx.strokeStyle = 'rgba(170, 215, 210, 0.10)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(170, 215, 210, 0.35)';
      ctx.beginPath();
      ctx.arc(r.x + r.w / 2, r.y + r.h / 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawFlow(ctx, state) {
  const sim = state.sim;
  if (!sim || !sim.flowEdges || sim.flowEdges.length === 0) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.setLineDash([12, 16]);
  ctx.lineDashOffset = -(Date.now() / 45) % 28;
  for (const e of sim.flowEdges) {
    const a = nodeCenter(e.x1, e.y1);
    const b = nodeCenter(e.x2, e.y2);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = e.amount > 1 ? COLORS.pathHot : COLORS.pathOn;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 5;
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- nodes

function drawSource(ctx, state, src) {
  const c = nodeCenter(src.x, src.y);
  const out = tileAt(state, src.x + DIRS[src.dir].x, src.y + DIRS[src.dir].y);
  const live = !!(out && out.powered);

  if (live) {
    ctx.save();
    ctx.shadowColor = COLORS.source;
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 24, 0, Math.PI * 2);
    ctx.fillStyle = '#123f31';
    ctx.fill();
    ctx.restore();
  } else {
    ctx.beginPath();
    ctx.arc(c.x, c.y, 24, 0, Math.PI * 2);
    ctx.fillStyle = '#123f31';
    ctx.fill();
  }
  ctx.strokeStyle = live ? COLORS.source : COLORS.line;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = live ? COLORS.source : COLORS.text;
  ctx.font = '700 20px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(src.id, c.x, c.y + 1);

  // Capacity pips under the node.
  ctx.fillStyle = COLORS.muted;
  ctx.font = '11px Georgia, serif';
  ctx.fillText(`GEN · ${src.cap}`, c.x, c.y + 38);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Arrow showing which way the feed enters the board.
  const v = DIRS[src.dir];
  const ax = c.x + v.x * 34;
  const ay = c.y + v.y * 34;
  ctx.fillStyle = live ? COLORS.source : COLORS.muted;
  ctx.beginPath();
  ctx.moveTo(ax + v.x * 10, ay + v.y * 10);
  ctx.lineTo(ax - v.y * 6 - v.x * 4, ay - v.x * 6 - v.y * 4);
  ctx.lineTo(ax + v.y * 6 - v.x * 4, ay + v.x * 6 - v.y * 4);
  ctx.closePath();
  ctx.fill();
}

function drawReceiver(ctx, state, recv) {
  const c = nodeCenter(recv.x, recv.y);
  const rs = receiverState(state, recv);
  const lit = rs.load >= recv.need && rs.load > 0;

  if (lit) {
    ctx.save();
    ctx.shadowColor = COLORS.receiverOn;
    ctx.shadowBlur = 26;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 24, 0, Math.PI * 2);
    ctx.fillStyle = '#4a3a1c';
    ctx.fill();
    ctx.restore();
    // Light rays from a lit beacon.
    ctx.strokeStyle = 'rgba(255, 233, 176, 0.55)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (const ang of [-0.6, 0, 0.6]) {
      const dx = Math.cos(ang - Math.PI / 2);
      const dy = Math.sin(ang - Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(c.x + dx * 28, c.y + dy * 28);
      ctx.lineTo(c.x + dx * 46, c.y + dy * 46);
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.arc(c.x, c.y, 24, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.receiverOff;
    ctx.fill();
  }
  ctx.strokeStyle = lit ? COLORS.receiverOn : COLORS.line;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Little lighthouse tower inside the node.
  ctx.fillStyle = lit ? '#ffe9b0' : '#8fa8b5';
  ctx.beginPath();
  ctx.moveTo(c.x - 7, c.y + 10);
  ctx.lineTo(c.x - 4, c.y - 8);
  ctx.lineTo(c.x + 4, c.y - 8);
  ctx.lineTo(c.x + 7, c.y + 10);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(c.x, c.y - 11, 5, 0, Math.PI * 2);
  ctx.fill();

  // Labels stay out of the tiles and the header goal line:
  //  - top-edge beacons: name + load stacked left of the node, above the board;
  //  - right-edge beacons: stacked under the node, clear of the tile captions;
  //  - bottom-edge beacons: centred under the node (the message bar is narrow).
  ctx.textBaseline = 'middle';
  if (recv.y < 0) {
    ctx.textAlign = 'right';
    ctx.fillStyle = lit ? COLORS.receiverOn : COLORS.text;
    ctx.font = '700 13px Georgia, serif';
    ctx.fillText(recv.label, c.x - 34, c.y - 3);
    ctx.fillStyle = lit ? COLORS.receiverOn : COLORS.muted;
    ctx.font = '12px Georgia, serif';
    ctx.fillText(`${clamp(rs.load, 0, 99)}/${recv.need}`, c.x - 34, c.y + 13);
  } else if (recv.x >= GRID.cols) {
    ctx.textAlign = 'right';
    ctx.fillStyle = lit ? COLORS.receiverOn : COLORS.text;
    ctx.font = '700 13px Georgia, serif';
    ctx.fillText(recv.label, 852, c.y + 62);
    ctx.fillStyle = lit ? COLORS.receiverOn : COLORS.muted;
    ctx.font = '12px Georgia, serif';
    ctx.fillText(`${clamp(rs.load, 0, 99)}/${recv.need}`, 852, c.y + 78);
  } else {
    const labelY = c.y + 40;
    ctx.textAlign = 'center';
    ctx.fillStyle = lit ? COLORS.receiverOn : COLORS.text;
    ctx.font = '700 13px Georgia, serif';
    ctx.fillText(recv.label, c.x, labelY);
    ctx.fillStyle = lit ? COLORS.receiverOn : COLORS.muted;
    ctx.font = '12px Georgia, serif';
    ctx.fillText(`${clamp(rs.load, 0, 99)}/${recv.need}`, c.x, labelY + 16);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function drawBoard(state, ctx) {
  // Board plate.
  rr(ctx, GRID.x - 24, GRID.y - 24, GRID.cols * GRID.cell + (GRID.cols - 1) * GRID.gap + 48,
    GRID.rows * GRID.cell + (GRID.rows - 1) * GRID.gap + 48, 18);
  ctx.fillStyle = 'rgba(16, 38, 58, 0.55)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(111, 166, 161, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  drawEmptyCells(ctx, state);
  const canPlay = state.status === 'play';
  for (const tile of state.tiles.values()) {
    const isSelected = state.selected && state.selected.x === tile.x && state.selected.y === tile.y;
    drawTile(ctx, tile, isSelected, canPlay);
  }
  drawFlow(ctx, state);
  for (const src of state.level.sources) drawSource(ctx, state, src);
  for (const recv of state.level.receivers) drawReceiver(ctx, state, recv);
}

// ---------------------------------------------------------------- side panel

function sectionTitle(ctx, text, x, y) {
  ctx.fillStyle = COLORS.line;
  ctx.font = '700 13px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
  ctx.strokeStyle = 'rgba(111, 166, 161, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + 7);
  ctx.lineTo(x + SIDE.w - 40, y + 7);
  ctx.stroke();
}

function drawSidePanel(state, ctx) {
  rr(ctx, SIDE.x, SIDE.y, SIDE.w, SIDE.h, 16);
  ctx.fillStyle = COLORS.panel;
  ctx.fill();
  ctx.strokeStyle = 'rgba(111, 166, 161, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const x = SIDE.x + 20;
  const inner = SIDE.w - 40;
  let y = SIDE.y + 30;

  sectionTitle(ctx, 'SCENARIO', x, y);
  y += 30;
  ctx.fillStyle = COLORS.text;
  ctx.font = '700 24px Georgia, serif';
  ctx.fillText(state.level.name, x, y);
  y += 12;
  ctx.fillStyle = COLORS.muted;
  ctx.font = '14px Georgia, serif';
  for (const line of wrapText(ctx, state.level.briefing, inner)) {
    y += 19;
    ctx.fillText(line, x, y);
  }

  y += 28;
  sectionTitle(ctx, 'BEACONS', x, y);
  y += 28;
  for (const recv of state.level.receivers) {
    const rs = receiverState(state, recv);
    const lit = rs.load >= recv.need && rs.load > 0;
    ctx.beginPath();
    ctx.arc(x + 8, y - 5, 7, 0, Math.PI * 2);
    ctx.fillStyle = lit ? COLORS.receiverOn : COLORS.receiverOff;
    ctx.fill();
    ctx.strokeStyle = lit ? COLORS.receiverOn : COLORS.line;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = lit ? COLORS.text : COLORS.muted;
    ctx.font = '15px Georgia, serif';
    ctx.fillText(recv.label, x + 24, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = lit ? COLORS.receiverOn : COLORS.muted;
    ctx.fillText(`${clamp(rs.load, 0, 99)}/${recv.need}`, x + inner, y);
    ctx.textAlign = 'left';
    y += 26;
  }

  y += 10;
  sectionTitle(ctx, 'TURNS', x, y);
  y += 28;
  ctx.fillStyle = COLORS.text;
  ctx.font = '700 18px Georgia, serif';
  ctx.fillText(`${state.turnsUsed} / ${state.level.maxTurns}`, x, y);
  const barX = x + 92;
  const barW = inner - 92;
  rr(ctx, barX, y - 13, barW, 10, 5);
  ctx.fillStyle = '#0a1c2c';
  ctx.fill();
  const frac = clamp(state.turnsUsed / state.level.maxTurns, 0, 1);
  if (frac > 0) {
    rr(ctx, barX, y - 13, Math.max(10, barW * frac), 10, 5);
    ctx.fillStyle = frac >= 1 ? COLORS.pathHot : COLORS.pathOn;
    ctx.fill();
  }

  if (state.level.storageAvailable) {
    y += 34;
    sectionTitle(ctx, 'STORAGE', x, y);
    y += 26;
    let storageTile = null;
    for (const t of state.tiles.values()) if (t.type === 'storage') storageTile = t;
    let status;
    if (!storageTile) status = state.storageUsed ? 'Released — spent.' : 'Ready — press S on a tile to place.';
    else if (storageTile.released) status = 'Released — surge fed back to the route.';
    else if (storageTile.charged) status = 'Charged — holding 1 surge. Press E to release.';
    else status = 'Armed on the grid — waiting for a surge.';
    ctx.fillStyle = storageTile && storageTile.charged ? COLORS.pathStore : COLORS.muted;
    ctx.font = '14px Georgia, serif';
    for (const line of wrapText(ctx, status, inner)) {
      ctx.fillText(line, x, y);
      y += 19;
    }
    y -= 19;
  }

  y += 34;
  sectionTitle(ctx, 'CONTROLS', x, y);
  y += 24;
  ctx.fillStyle = COLORS.muted;
  ctx.font = '13.5px Georgia, serif';
  const controls = [
    'Arrows — move selection',
    'Space / Click — rotate tile',
    'Q — rotate counter-clockwise',
    'S — place storage · E — release',
    'N — retry · M — mute · Enter — go',
  ];
  for (const line of controls) {
    ctx.fillText(line, x, y);
    y += 20;
  }

  // Hint pinned near the bottom of the panel.
  ctx.fillStyle = COLORS.muted;
  ctx.font = 'italic 13.5px Georgia, serif';
  const hintY = SIDE.y + SIDE.h - 18;
  const hintLines = wrapText(ctx, state.level.hint, inner);
  hintLines.forEach((line, i) => {
    ctx.fillText(line, x, hintY - (hintLines.length - 1 - i) * 18);
  });
}

function drawMessage(state, ctx) {
  ctx.fillStyle = COLORS.text;
  ctx.font = '16px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // Kept narrow (x <= ~540) so it never runs under a bottom-edge beacon label.
  const lines = wrapText(ctx, `» ${state.message}`, 470);
  lines.forEach((line, i) => {
    ctx.fillText(line, 70, 722 + i * 20);
  });
}

// ---------------------------------------------------------------- overlays

function overlayPanel(ctx, title, titleColor, lines, prompt) {
  ctx.fillStyle = 'rgba(4, 12, 20, 0.74)';
  ctx.fillRect(0, 0, W, H);

  const pw = 720;
  const ph = 150 + lines.length * 26 + 74;
  const px = (W - pw) / 2;
  const py = (H - ph) / 2;
  rr(ctx, px, py, pw, ph, 20);
  ctx.fillStyle = COLORS.panel;
  ctx.fill();
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = titleColor;
  ctx.font = '700 46px Georgia, "Times New Roman", serif';
  ctx.fillText(title, W / 2, py + 74);

  ctx.fillStyle = COLORS.text;
  ctx.font = '17px Georgia, serif';
  let y = py + 116;
  for (const line of lines) {
    ctx.fillText(line, W / 2, y);
    y += 26;
  }

  ctx.fillStyle = COLORS.receiverOn;
  ctx.font = '700 16px Georgia, serif';
  ctx.fillText(prompt, W / 2, py + ph - 28);
  ctx.textAlign = 'left';
}

function drawOverlay(state, ctx) {
  if (state.status === 'title') {
    const lines = wrapTextIn(ctx, state.level.briefing, 620);
    overlayPanel(ctx, 'TIDEWIRE', COLORS.text, [
      ...lines,
      '',
      'Rotate the switchgear so the live pulse reaches every beacon.',
      'Keep every lit relay at load 1 — overloads sink the circuit.',
    ], 'Press Enter or click to begin');
    return;
  }
  if (state.status === 'win') {
    overlayPanel(ctx, 'BEACON RESTORED', COLORS.receiverOn, [
      `${state.level.name} is lit again.`,
      'The next sector of coast is still dark.',
    ], 'Press Enter for the next scenario');
    return;
  }
  if (state.status === 'fail') {
    overlayPanel(ctx, 'SIGNAL LOST', COLORS.pathHot, [
      state.failReason || state.message,
      `Turns used: ${state.turnsUsed} / ${state.level.maxTurns}.`,
    ], 'Press N or Enter to retry');
    return;
  }
  if (state.status === 'complete') {
    overlayPanel(ctx, 'COAST RESTORED', COLORS.receiverOn, [
      'All three rescue beacons shine again across the coast.',
      'Harbor, pier, jetty, cliff and cove — every light is home.',
    ], 'Press Enter to play again from the first scenario');
  }
}

function wrapTextIn(ctx, text, maxWidth) {
  ctx.font = '17px Georgia, serif';
  return wrapText(ctx, text, maxWidth);
}

// ---------------------------------------------------------------- entry

export function draw(state, ctx) {
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  drawBackground(ctx);
  drawHeader(state, ctx);
  drawBoard(state, ctx);
  drawSidePanel(state, ctx);
  drawMessage(state, ctx);
  if (state.status !== 'play') drawOverlay(state, ctx);
  ctx.restore();
}
