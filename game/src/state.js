import { GRID } from './config.js';
import { LEVELS } from './levels.js';
import { connects, rotateTile, tileConnections } from './tiles.js';

const DIRS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

function key(x, y) { return `${x},${y}`; }

export function createInitialState(levelIndex = 0, shot = null) {
  const level = LEVELS[levelIndex];
  const tiles = new Map();
  for (const t of level.tiles) {
    tiles.set(key(t.x, t.y), {
      x: t.x, y: t.y, type: t.type, rot: t.rot || 0, fixed: !!t.fixed,
      load: 0, powered: false, charged: false, released: false, banked: false,
    });
  }
  const state = {
    levelIndex, level, tiles, turnsUsed: 0,
    selected: { x: 0, y: levelIndex === 1 ? 2 : 1 },
    status: 'title', message: level.briefing, failReason: '',
    storagePending: level.storageAvailable, storageUsed: false, storageArmed: false,
    shot, sim: null,
  };
  state.selected = findFirstSelectable(state) || { x: 0, y: 0 };
  recompute(state);
  if (shot === 'play') state.status = 'play';
  else if (shot === 'win') { autoSolve(state); state.status = state.levelIndex === LEVELS.length - 1 ? 'complete' : 'win'; }
  else if (shot === 'fail') { forceFail(state); }
  return state;
}

export function inBounds(x, y) { return x >= 0 && x < GRID.cols && y >= 0 && y < GRID.rows; }
export function getTile(state, x, y) { return state.tiles.get(key(x, y)) || null; }

export function findFirstSelectable(state) {
  for (let y = 0; y < GRID.rows; y++) for (let x = 0; x < GRID.cols; x++) {
    const t = getTile(state, x, y);
    if (t && !t.fixed) return { x, y };
  }
  return null;
}

export function moveSelection(state, dx, dy) {
  let { x, y } = state.selected;
  for (let i = 0; i < GRID.cols + GRID.rows; i++) {
    x = (x + dx + GRID.cols) % GRID.cols;
    y = (y + dy + GRID.rows) % GRID.rows;
    if (getTile(state, x, y)) { state.selected = { x, y }; return true; }
  }
  return false;
}

export function selectTile(state, x, y) {
  if (getTile(state, x, y)) { state.selected = { x, y }; return true; }
  return false;
}

export function rotateSelected(state, dir = 1) {
  if (state.status !== 'play') return false;
  const tile = getTile(state, state.selected.x, state.selected.y);
  if (!tile || tile.fixed) { state.message = tile ? 'Anchored hardware cannot rotate.' : 'Select a tile to rotate.'; return false; }
  if (dir === -1) { rotateTile(tile); rotateTile(tile); rotateTile(tile); } else rotateTile(tile);
  state.turnsUsed += 1;
  recompute(state);
  return true;
}

export function placeStorage(state) {
  if (state.status !== 'play') return false;
  if (!state.level.storageAvailable || state.storageUsed || state.storageArmed) {
    state.message = state.storageArmed ? 'Storage already armed on the grid.' : 'No storage cell available on this scenario.';
    return false;
  }
  const { x, y } = state.selected;
  const existing = getTile(state, x, y);
  if (existing && existing.fixed) { state.message = 'Storage cannot replace anchored hardware.'; return false; }
  state.tiles.set(key(x, y), { x, y, type: 'storage', rot: 0, fixed: false, load: 0, powered: false, charged: false, released: false, banked: false });
  state.storageUsed = true; state.storageArmed = true; state.turnsUsed += 1;
  recompute(state);
  state.message = 'Storage placed. It absorbs 1 surge on a live route; press E to release if needed.';
  return true;
}

export function releaseStorage(state) {
  if (state.status !== 'play') return false;
  let storage = null;
  for (const t of state.tiles.values()) if (t.type === 'storage') storage = t;
  if (!storage) { state.message = 'Place the storage cell before releasing it.'; return false; }
  if (storage.released) { state.message = 'Storage already released.'; return false; }
  storage.released = true; state.storageArmed = false; state.turnsUsed += 1;
  recompute(state);
  state.message = storage.banked ? 'Stored surge released into the active route.' : 'Storage released with no banked surge.';
  return true;
}

export function startPlay(state) {
  const fresh = createInitialState(state.levelIndex);
  Object.assign(state, fresh, { status: 'play', message: state.level.hint });
  recompute(state);
}
export function retry(state) { startPlay(state); }
export function nextLevel(state) {
  const idx = Math.min(LEVELS.length - 1, state.levelIndex + 1);
  const fresh = createInitialState(idx);
  Object.assign(state, fresh, { status: 'play', message: LEVELS[idx].hint });
}

export function recompute(state) {
  for (const t of state.tiles.values()) {
    t.load = 0; t.powered = false;
    if (t.type === 'storage' && !t.released) t.charged = false;
  }
  const receivers = new Map(state.level.receivers.map((r) => [r.id, { ...r, load: 0, powered: false }]));
  const flowEdges = [];
  const seenSteps = new Set();
  const queue = [];
  for (const src of state.level.sources) {
    queue.push({ x: src.x + DIRS[src.dir].x, y: src.y + DIRS[src.dir].y, fromDir: (src.dir + 2) % 4, amount: src.cap });
  }
  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi];
    const stepKey = `${cur.x},${cur.y},${cur.fromDir},${cur.amount}`;
    if (seenSteps.has(stepKey)) continue;
    seenSteps.add(stepKey);
    if (!inBounds(cur.x, cur.y)) {
      const r = state.level.receivers.find((rr) => rr.x === cur.x && rr.y === cur.y && rr.dir === cur.fromDir);
      if (r) {
        const rr = receivers.get(r.id); rr.load += cur.amount; rr.powered = true;
        flowEdges.push({ x1: r.x - DIRS[r.dir].x, y1: r.y - DIRS[r.dir].y, x2: r.x, y2: r.y, amount: cur.amount });
      }
      continue;
    }
    const tile = getTile(state, cur.x, cur.y);
    if (!tile || !connects(tile, cur.fromDir)) continue;
    tile.powered = true; tile.load += cur.amount;
    const outs = tileConnections(tile).filter((d) => d !== cur.fromDir);
    let outAmount = cur.amount;
    if (tile.type === 'storage') {
      if (!tile.released && cur.amount > 1) { tile.charged = true; tile.banked = true; outAmount = cur.amount - 1; }
      else if (tile.released && tile.banked) { outAmount = cur.amount + 1; tile.charged = false; tile.banked = false; }
    }
    for (const outDir of outs) {
      queue.push({ x: tile.x + DIRS[outDir].x, y: tile.y + DIRS[outDir].y, fromDir: (outDir + 2) % 4, amount: outAmount });
      flowEdges.push({ x1: tile.x, y1: tile.y, x2: tile.x + DIRS[outDir].x, y2: tile.y + DIRS[outDir].y, amount: outAmount });
    }
  }

  let failReason = '';
  for (const t of state.tiles.values()) {
    if (t.type === 'storage') {
      if (!t.released && t.load > 2) { failReason = `Storage at (${t.x + 1},${t.y + 1}) overwhelmed (load ${t.load}).`; break; }
      if (t.released && t.load > 1) { failReason = `Storage overload at (${t.x + 1},${t.y + 1}) after release.`; break; }
    } else if (t.load > 1) {
      failReason = `Overload at ${t.type} (${t.x + 1},${t.y + 1}), load ${t.load}. Keep branches separate.`; break;
    }
  }
  if (!failReason) for (const r of receivers.values()) if (r.load > r.need) { failReason = `${r.label} overloaded (load ${r.load}).`; break; }
  if (!failReason && state.turnsUsed > state.level.maxTurns) failReason = `Turn limit exceeded (${state.turnsUsed}/${state.level.maxTurns}).`;

  const allLit = Array.from(receivers.values()).every((r) => r.load >= r.need && r.load <= r.need);
  const result = failReason ? 'fail' : allLit ? 'win' : 'play';
  state.sim = { receivers, flowEdges, result, failReason };

  if (state.status === 'play') {
    if (result === 'win') {
      state.status = state.levelIndex === LEVELS.length - 1 ? 'complete' : 'win';
      state.message = state.levelIndex === LEVELS.length - 1 ? 'All rescue beacons restored across the coast.' : 'Beacon chain restored. Advance to the next sector.';
    } else if (result === 'fail') {
      state.status = 'fail'; state.failReason = failReason; state.message = failReason;
    } else {
      const unmet = Array.from(receivers.values()).filter((r) => r.load < r.need).map((r) => r.label);
      state.failReason = ''; state.message = unmet.length ? `Unlit: ${unmet.join(', ')}.` : state.level.goal;
    }
  }
  return state.sim;
}

export function autoSolve(state) {
  const idx = state.levelIndex;
  if (idx === 0) {
    setRots(state, [[0,1,1],[1,1,1],[2,1,1],[3,1,1],[4,1,1],[5,1,1]]);
  } else if (idx === 1) {
    setRots(state, [[0,2,1],[1,2,2],[1,1,0],[1,0,1],[2,0,3],[1,3,0],[2,3,1],[3,3,1],[4,3,2]]);
  } else {
    selectTile(state, 0, 1);
    placeStorage(state);
    setRots(state, [[0,1,1],[1,1,1],[2,1,1],[3,1,1],[4,1,1],[5,1,1],[0,3,1],[1,3,3],[1,2,1],[2,2,1],[3,2,2],[3,3,0],[4,3,1],[5,3,1]]);
  }
  recompute(state);
}

function setRots(state, entries) { for (const [x, y, rot] of entries) { const t = getTile(state, x, y); if (t) t.rot = rot; } }

export function forceFail(state) {
  if (state.levelIndex === 0) {
    setRots(state, [[0,1,1],[1,1,1],[2,1,1],[3,1,1],[4,1,1],[5,1,0]]);
    state.turnsUsed = state.level.maxTurns + 1;
  } else if (state.levelIndex === 1) {
    setRots(state, [[0,2,1],[1,2,0],[1,1,0],[1,0,1],[2,0,3],[1,3,0],[2,3,1],[3,3,1],[4,3,2]]);
    state.turnsUsed = state.level.maxTurns + 1;
  } else {
    setRots(state, [[0,1,1],[1,1,1],[2,1,1],[3,1,1],[4,1,1],[5,1,1],[0,3,1],[1,3,3],[1,2,1],[2,2,1],[3,2,2],[3,3,0],[4,3,1],[5,3,1]]);
    state.turnsUsed = state.level.maxTurns + 1;
  }
  recompute(state);
}

export function solutionForLevel(levelIndex) {
  if (levelIndex === 0) return { rots: [[0,1,1],[1,1,1],[2,1,1],[3,1,1],[4,1,1],[5,1,1]] };
  if (levelIndex === 1) return { rots: [[0,2,1],[1,2,2],[1,1,0],[1,0,1],[2,0,3],[1,3,0],[2,3,1],[3,3,1],[4,3,2]] };
  return {
    rots: [[0,1,1],[1,1,1],[2,1,1],[3,1,1],[4,1,1],[5,1,1],[0,3,1],[1,3,3],[1,2,1],[2,2,1],[3,2,2],[3,3,0],[4,3,1],[5,3,1]],
    storage: [0,1],
  };
}
