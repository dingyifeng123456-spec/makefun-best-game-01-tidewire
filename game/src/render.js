import { COLORS, GRID, H, SIDE, W } from './config.js';
import { tileConnections } from './tiles.js';
import { getTile } from './state.js';

const DIRS = [
  { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 },
];

export function draw(state, ctx) {
  ctx.clearRect(0, 0, W, H);
  drawBackground(ctx, state);
  if (state.status === 'title') drawTitle(ctx, state);
  else drawBoard(ctx, state);
}

function drawBackground(ctx, state) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, COLORS.bg1);
  g.addColorStop(1, COLORS.bg0);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = '#88b7b0';
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    const y = 110 + i * 66;
    for (let x = 0; x <= W; x += 40) {
      const yy = y + Math.sin((x + i * 55 + (state.turnsUsed || 0) * 6) * 0.02) * 7;
      if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < 70; i++) ctx.fillRect((i * 131) % W, (i * 73) % 150, 2, 2);
}

function drawLighthouse(ctx, x, y, scale, beam = false, lit = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#08131d';
  ctx.beginPath();
  ctx.moveTo(-70, 40); ctx.quadraticCurveTo(0, 10, 70, 40); ctx.lineTo(70, 70); ctx.lineTo(-70, 70); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f4efe2';
  ctx.beginPath();
  ctx.moveTo(-22, 35); ctx.lineTo(22, 35); ctx.lineTo(16, -95); ctx.lineTo(-16, -95); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ff6f61';
  ctx.fillRect(-20, -10, 40, 16);
  ctx.fillRect(-18, -50, 36, 14);
  ctx.fillStyle = '#2b4354';
  ctx.fillRect(-24, -105, 48, 12);
  ctx.fillStyle = '#f8f3e8';
  ctx.fillRect(-14, -128, 28, 23);
  ctx.fillStyle = '#10283b';
  ctx.beginPath(); ctx.moveTo(-18, -128); ctx.lineTo(0, -150); ctx.lineTo(18, -128); ctx.closePath(); ctx.fill();
  ctx.fillStyle = lit ? '#fff4bf' : '#8ac9c0';
  ctx.fillRect(-8, -122, 16, 12);
  if (beam) {
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#67f0e4';
    ctx.beginPath(); ctx.moveTo(8, -116); ctx.lineTo(250, -170); ctx.lineTo(250, -62); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = '#9ffaf0';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(8, -116); ctx.lineTo(240, -116); ctx.stroke();
  }
  ctx.restore();
}

function drawTitle(ctx) {
  drawLighthouse(ctx, 170, 520, 1.15, true, true);
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#5ed8cf';
  ctx.fillRect(350, 120, 720, 520);
  ctx.restore();
  rounded(ctx, 430, 115, 640, 520, 22, 'rgba(11, 34, 51, 0.86)', 'rgba(255,255,255,0.1)');
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 72px Georgia, serif';
  ctx.fillText('TIDEWIRE', 750, 205);
  ctx.font = 'italic 30px Georgia, serif';
  ctx.fillStyle = COLORS.pathOn;
  ctx.fillText('Storm Charts for a Dark Coast', 750, 252);
  ctx.font = '24px Georgia, serif';
  ctx.fillStyle = COLORS.text;
  ctx.fillText('Reconnect the rescue beacons before the storm wins.', 750, 318);

  ctx.textAlign = 'left';
  ctx.font = '20px Georgia, serif';
  ctx.fillStyle = COLORS.muted;
  const bullets = [
    'Rotate switchgear to route live pulses.',
    'Splitters feed every branch; keep load at 1.',
    'One storage cell can absorb a single surge.',
    'Three hand-built scenarios, quick retry, no audio until input.',
  ];
  bullets.forEach((line, i) => ctx.fillText(`• ${line}`, 500, 372 + i * 38));

  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.accent;
  ctx.font = 'bold 32px Georgia, serif';
  ctx.fillText('Press Enter or Click to Start', 750, 540);
  ctx.fillStyle = COLORS.muted;
  ctx.font = '18px Georgia, serif';
  const controls = 'Arrows: select  •  Space/Click: rotate  •  Q: rotate back  •  S: place storage  •  E: release  •  N: retry  •  M: mute';
  wrapTextCenter(ctx, controls, 750, 582, 560, 24);
}

function drawBoard(ctx, state) {
  drawHud(ctx, state);
  drawGrid(ctx, state);
  drawSideboard(ctx, state);
  if (state.status === 'win' || state.status === 'complete' || state.status === 'fail') drawOverlay(ctx, state);
}

function drawHud(ctx, state) {
  rounded(ctx, 54, 28, 1092, 124, 16, 'rgba(10, 31, 47, 0.72)', 'rgba(255,255,255,0.08)');
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 34px Georgia, serif';
  ctx.fillText('TIDEWIRE', 74, 72);
  ctx.font = '20px Georgia, serif';
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(`Scenario ${state.levelIndex + 1}/3: ${state.level.name}`, 74, 102);
  wrapText(ctx, state.level.goal, 74, 130, 760, 22, 2);

  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.text;
  ctx.font = '22px Georgia, serif';
  ctx.fillText(`Turns ${state.turnsUsed}/${state.level.maxTurns}`, W - 74, 72);
  const storageText = !state.level.storageAvailable ? 'Storage: n/a' : state.storageArmed ? 'Storage: armed' : state.storageUsed ? 'Storage: used' : 'Storage: ready';
  ctx.fillStyle = state.level.storageAvailable ? COLORS.pathStore : COLORS.muted;
  ctx.fillText(storageText, W - 74, 102);
  ctx.fillStyle = COLORS.muted;
  ctx.font = '18px Georgia, serif';
  ctx.fillText('Mission: power every beacon safely', W - 74, 130);
}

function drawGrid(ctx, state) {
  const gx = GRID.x, gy = GRID.y, cell = GRID.cell, gap = GRID.gap;
  for (let y = 0; y < GRID.rows; y++) {
    for (let x = 0; x < GRID.cols; x++) {
      const px = gx + x * (cell + gap), py = gy + y * (cell + gap);
      rounded(ctx, px, py, cell, cell, 14, 'rgba(9, 30, 45, 0.9)', 'rgba(160,210,205,0.12)');
    }
  }
  drawEndpoints(ctx, state);
  for (let y = 0; y < GRID.rows; y++) for (let x = 0; x < GRID.cols; x++) {
    const t = getTile(state, x, y); if (t) drawTile(ctx, t);
  }
  drawFlow(ctx, state);
  const sel = state.selected;
  const spx = gx + sel.x * (cell + gap), spy = gy + sel.y * (cell + gap);
  ctx.save();
  ctx.strokeStyle = COLORS.focus; ctx.lineWidth = 4;
  roundedStroke(ctx, spx - 4, spy - 4, cell + 8, cell + 8, 16);
  ctx.restore();
}

function cellCenter(x, y) {
  return { cx: GRID.x + x * (GRID.cell + GRID.gap) + GRID.cell / 2, cy: GRID.y + y * (GRID.cell + GRID.gap) + GRID.cell / 2 };
}

function drawEndpoints(ctx, state) {
  for (const s of state.level.sources) {
    const edge = edgePoint(s.x, s.y);
    ctx.fillStyle = COLORS.source;
    ctx.beginPath(); ctx.arc(edge.x, edge.y, 18, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#0a1c29'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#0d2533'; ctx.font = 'bold 14px Georgia, serif'; ctx.textAlign = 'center';
    ctx.fillText(s.cap > 1 ? `${s.id}${s.cap}` : s.id, edge.x, edge.y + 5);
  }
  const simReceivers = state.sim ? state.sim.receivers : new Map();
  for (const r of state.level.receivers) {
    const edge = edgePoint(r.x, r.y);
    const info = simReceivers.get(r.id);
    const lit = info && info.load >= r.need && info.load <= r.need;
    const overload = info && info.load > r.need;
    drawLighthouseIcon(ctx, edge.x, edge.y, lit, overload);
    ctx.fillStyle = overload ? COLORS.pathHot : lit ? '#102436' : COLORS.text;
    ctx.font = 'bold 12px Georgia, serif'; ctx.textAlign = 'center';
    ctx.fillText(r.id, edge.x, edge.y + 28);
  }
}

function drawLighthouseIcon(ctx, x, y, lit, overload) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = overload ? COLORS.pathHot : lit ? COLORS.receiverOn : '#3d5d70';
  ctx.beginPath(); ctx.moveTo(-10, 14); ctx.lineTo(10, 14); ctx.lineTo(7, -12); ctx.lineTo(-7, -12); ctx.closePath(); ctx.fill();
  ctx.fillStyle = overload ? '#5b130d' : lit ? '#26495c' : '#203645';
  ctx.fillRect(-8, -2, 16, 4);
  ctx.fillStyle = '#152735'; ctx.fillRect(-11, -16, 22, 5);
  ctx.fillStyle = overload ? '#ffd0c8' : lit ? '#fff4bf' : '#88aab8';
  ctx.fillRect(-5, -23, 10, 7);
  ctx.fillStyle = '#152735';
  ctx.beginPath(); ctx.moveTo(-8, -23); ctx.lineTo(0, -30); ctx.lineTo(8, -23); ctx.closePath(); ctx.fill();
  if (lit && !overload) {
    ctx.strokeStyle = 'rgba(103,240,228,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(5, -19); ctx.lineTo(26, -19); ctx.stroke();
  }
  ctx.restore();
}

function edgePoint(x, y) {
  const b = { x: GRID.x, y: GRID.y, w: GRID.cols * (GRID.cell + GRID.gap) - GRID.gap, h: GRID.rows * (GRID.cell + GRID.gap) - GRID.gap };
  if (x === -1) return { x: b.x - 24, y: GRID.y + y * (GRID.cell + GRID.gap) + GRID.cell / 2 };
  if (x === GRID.cols) return { x: b.x + b.w + 24, y: GRID.y + y * (GRID.cell + GRID.gap) + GRID.cell / 2 };
  if (y === -1) return { x: GRID.x + x * (GRID.cell + GRID.gap) + GRID.cell / 2, y: b.y - 24 };
  if (y === GRID.rows) return { x: GRID.x + x * (GRID.cell + GRID.gap) + GRID.cell / 2, y: b.y + b.h + 24 };
  return cellCenter(x, y);
}

function drawTile(ctx, t) {
  const { cx, cy } = cellCenter(t.x, t.y);
  const size = GRID.cell - 18;
  const conns = tileConnections(t);
  const hot = t.load > 1;
  const on = t.powered;
  const base = t.fixed ? '#18394d' : '#0f2b3f';
  rounded(ctx, cx - size / 2, cy - size / 2, size, size, 12, base, hot ? COLORS.pathHot : on ? 'rgba(71,214,207,0.55)' : 'rgba(255,255,255,0.08)');

  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineCap = 'round';
  for (const d of conns) {
    const v = DIRS[d];
    ctx.strokeStyle = hot ? COLORS.pathHot : on ? COLORS.pathOn : 'rgba(75,110,128,0.65)';
    ctx.lineWidth = hot || on ? 12 : 9;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(v.x * (size / 2 - 7), v.y * (size / 2 - 7));
    ctx.stroke();
  }
  ctx.fillStyle = hot ? COLORS.pathHot : on ? COLORS.pathOn : '#294a5e';
  ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 13px Georgia, serif';
  ctx.textAlign = 'center';
  let label = t.type === 'straight' ? 'I' : t.type === 'corner' ? 'L' : t.type === 'splitT' ? 'T' : 'S';
  if (t.type === 'storage') label = t.released ? 'R' : t.charged ? 'C' : 'B';
  ctx.fillText(label, 0, 4);
  if (t.fixed) { ctx.fillStyle = COLORS.muted; ctx.font = '11px Georgia, serif'; ctx.fillText('FIXED', 0, 26); }
  ctx.restore();
}

function drawFlow(ctx, state) {
  const sim = state.sim; if (!sim) return;
  ctx.save();
  for (const e of sim.flowEdges) {
    if (e.x1 == null) continue;
    const p1 = pointFor(e.x1, e.y1, e.x2, e.y2);
    const p2 = pointFor(e.x2, e.y2, e.x1, e.y1);
    if (!p1 || !p2) continue;
    const hot = e.amount > 1;
    ctx.strokeStyle = hot ? 'rgba(255,127,102,0.95)' : 'rgba(150,255,245,0.95)';
    ctx.lineWidth = hot ? 5 : 3.5;
    ctx.shadowColor = hot ? COLORS.pathHot : COLORS.pathOn;
    ctx.shadowBlur = hot ? 14 : 10;
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
  }
  ctx.restore();
}

function pointFor(x, y, tx, ty) {
  if (x >= 0 && x < GRID.cols && y >= 0 && y < GRID.rows) {
    const c = cellCenter(x, y);
    const dx = Math.sign(tx - x), dy = Math.sign(ty - y);
    return { x: c.cx + dx * (GRID.cell / 2 - 12), y: c.cy + dy * (GRID.cell / 2 - 12) };
  }
  if (x === -1) return { x: GRID.x - 24, y: GRID.y + y * (GRID.cell + GRID.gap) + GRID.cell / 2 };
  if (x === GRID.cols) return { x: GRID.x + GRID.cols * (GRID.cell + GRID.gap) - GRID.gap + 24, y: GRID.y + y * (GRID.cell + GRID.gap) + GRID.cell / 2 };
  if (y === -1) return { x: GRID.x + x * (GRID.cell + GRID.gap) + GRID.cell / 2, y: GRID.y - 24 };
  if (y === GRID.rows) return { x: GRID.x + x * (GRID.cell + GRID.gap) + GRID.cell / 2, y: GRID.y + GRID.rows * (GRID.cell + GRID.gap) - GRID.gap + 24 };
  return null;
}

function drawSideboard(ctx, state) {
  rounded(ctx, SIDE.x, SIDE.y, SIDE.w, SIDE.h, 18, 'rgba(12, 34, 50, 0.94)', 'rgba(255,255,255,0.09)');
  ctx.save();
  ctx.beginPath(); ctx.rect(SIDE.x + 8, SIDE.y + 8, SIDE.w - 16, SIDE.h - 16); ctx.clip();
  ctx.fillStyle = COLORS.text; ctx.textAlign = 'left';
  ctx.font = 'bold 24px Georgia, serif';
  ctx.fillText('Mission Panel', SIDE.x + 20, SIDE.y + 36);

  ctx.font = '16px Georgia, serif'; ctx.fillStyle = COLORS.muted;
  let y = wrapText(ctx, state.level.briefing, SIDE.x + 20, SIDE.y + 64, SIDE.w - 40, 21, 3) + 6;

  y = sectionTitle(ctx, 'Beacons', SIDE.x + 20, y);
  ctx.font = '15px Georgia, serif';
  const simReceivers = state.sim ? state.sim.receivers : new Map();
  for (const r of state.level.receivers) {
    const info = simReceivers.get(r.id);
    const lit = info && info.load >= r.need && info.load <= r.need;
    const overload = info && info.load > r.need;
    ctx.fillStyle = overload ? COLORS.pathHot : lit ? COLORS.pathOn : COLORS.muted;
    const status = overload ? `OVERLOAD ${info.load}` : lit ? 'LIT' : `waiting ${info ? info.load : 0}/${r.need}`;
    y = wrapText(ctx, `${r.id} ${r.label}: ${status}`, SIDE.x + 20, y, SIDE.w - 40, 20, 2) + 2;
  }
  y += 4;
  y = sectionTitle(ctx, 'Relay Report', SIDE.x + 20, y);
  ctx.font = '15px Georgia, serif';
  ctx.fillStyle = state.status === 'fail' ? COLORS.pathHot : COLORS.text;
  y = wrapText(ctx, state.message || state.level.hint, SIDE.x + 20, y, SIDE.w - 40, 20, 4) + 4;

  y = sectionTitle(ctx, 'Controls', SIDE.x + 20, y);
  ctx.font = '14px Georgia, serif'; ctx.fillStyle = COLORS.muted;
  const controls = [
    'Arrows: move selection',
    'Space / Click: rotate selected',
    'Q: rotate back',
    'S: place storage',
    'E: release storage',
    'N: retry scenario',
    'M: mute audio',
  ];
  for (const c of controls) y = wrapText(ctx, c, SIDE.x + 20, y, SIDE.w - 40, 19, 1) + 1;
  ctx.restore();
}

function sectionTitle(ctx, text, x, y) {
  ctx.fillStyle = COLORS.text; ctx.font = 'bold 18px Georgia, serif';
  ctx.fillText(text, x, y);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x + 230, y + 6); ctx.stroke();
  return y + 26;
}

function drawOverlay(ctx, state) {
  ctx.save();
  ctx.fillStyle = 'rgba(4, 14, 22, 0.66)'; ctx.fillRect(0, 0, W, H);
  const title = state.status === 'fail' ? 'ROUTE FAILED' : state.status === 'complete' ? 'COAST RESTORED' : 'BEACON RESTORED';
  const accent = state.status === 'fail' ? COLORS.pathHot : COLORS.pathOn;
  rounded(ctx, 250, 175, 700, 340, 18, 'rgba(12, 34, 50, 0.96)', accent);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent; ctx.font = 'bold 48px Georgia, serif'; ctx.fillText(title, W / 2, 262);
  ctx.fillStyle = COLORS.text; ctx.font = '24px Georgia, serif';
  wrapTextCenter(ctx, state.message, W / 2, 318, 580, 30, 4);
  ctx.fillStyle = COLORS.muted; ctx.font = '20px Georgia, serif';
  const prompt = state.status === 'fail' ? 'Press N or Click to Retry' : state.status === 'complete' ? 'Press Enter or Click to Replay' : 'Press Enter or Click for Next Sector';
  ctx.fillText(prompt, W / 2, 470);
  ctx.restore();
}

function rounded(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}
function roundedStroke(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.stroke();
}

function wrapText(ctx, text, x, y, maxW, lh, maxLines = 99) {
  const words = String(text).split(/\s+/).filter(Boolean);
  let line = '';
  let lines = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y); y += lh; line = w; lines++;
      if (lines >= maxLines - 1 && i < words.length - 1) {
        let rest = line;
        while (ctx.measureText(rest + '…').width > maxW && rest.length > 1) rest = rest.slice(0, -1);
        ctx.fillText(rest + '…', x, y); return y + lh;
      }
    } else line = test;
  }
  if (line && lines < maxLines) { ctx.fillText(line, x, y); y += lh; }
  return y;
}

function wrapTextCenter(ctx, text, cx, y, maxW, lh, maxLines = 99) {
  const words = String(text).split(/\s+/).filter(Boolean);
  let line = '';
  let lines = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, cx, y); y += lh; line = w; lines++;
      if (lines >= maxLines - 1 && i < words.length - 1) {
        let rest = line;
        while (ctx.measureText(rest + '…').width > maxW && rest.length > 1) rest = rest.slice(0, -1);
        ctx.fillText(rest + '…', cx, y); return y + lh;
      }
    } else line = test;
  }
  if (line && lines < maxLines) { ctx.fillText(line, cx, y); y += lh; }
  return y;
}
