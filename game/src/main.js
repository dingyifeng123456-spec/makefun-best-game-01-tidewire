import { GRID, W, H } from './config.js';
import { draw } from './render.js';
import { ensureAudio, playFail, playPlace, playRelease, playRotate, playWin, toggleMute } from './audio.js';
import {
  createInitialState,
  getTile,
  moveSelection,
  nextLevel,
  placeStorage,
  releaseStorage,
  retry,
  rotateSelected,
  selectTile,
  startPlay,
} from './state.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const ui = document.getElementById('ui');

let state = createInitialState(0);
let lastStatus = state.status;

function announce(msg) { ui.textContent = msg; }

function screenPos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
}

function gridAt(x, y) {
  const gx = x - GRID.x, gy = y - GRID.y;
  const spanX = GRID.cell + GRID.gap, spanY = GRID.cell + GRID.gap;
  if (gx < 0 || gy < 0) return null;
  const cx = Math.floor(gx / spanX), cy = Math.floor(gy / spanY);
  if (cx < 0 || cy < 0 || cx >= GRID.cols || cy >= GRID.rows) return null;
  const lx = gx - cx * spanX, ly = gy - cy * spanY;
  if (lx > GRID.cell || ly > GRID.cell) return null;
  return { x: cx, y: cy };
}

function handleActionKey(key) {
  if (key === 'm') {
    const on = toggleMute();
    state.message = on ? 'Audio enabled.' : 'Audio muted.';
    announce(state.message);
    return;
  }
  if (state.status === 'title') {
    if (key === 'Enter' || key === ' ') { ensureAudio(); startPlay(state); announce('Game started.'); }
    return;
  }
  if (state.status === 'win') {
    if (key === 'Enter' || key === ' ') { ensureAudio(); nextLevel(state); announce('Next scenario.'); }
    return;
  }
  if (state.status === 'complete') {
    if (key === 'Enter' || key === ' ') { ensureAudio(); state = createInitialState(0); startPlay(state); announce('Restarting from first scenario.'); }
    return;
  }
  if (state.status === 'fail') {
    if (key === 'n' || key === 'Enter' || key === ' ') { ensureAudio(); retry(state); announce('Retrying scenario.'); }
    return;
  }

  let acted = false;
  if (key === 'ArrowUp') acted = moveSelection(state, 0, -1);
  else if (key === 'ArrowDown') acted = moveSelection(state, 0, 1);
  else if (key === 'ArrowLeft') acted = moveSelection(state, -1, 0);
  else if (key === 'ArrowRight') acted = moveSelection(state, 1, 0);
  else if (key === ' ' || key === 'Enter') { acted = rotateSelected(state, 1); if (acted) playRotate(); }
  else if (key === 'q') { acted = rotateSelected(state, -1); if (acted) playRotate(); }
  else if (key === 's') { acted = placeStorage(state); if (acted) playPlace(); }
  else if (key === 'e') { acted = releaseStorage(state); if (acted) playRelease(); }
  else if (key === 'n') { retry(state); acted = true; }
  if (acted) announce(state.message);
}

window.addEventListener('keydown', (e) => {
  const k = e.key;
  const lower = k.length === 1 ? k.toLowerCase() : k;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(k)) e.preventDefault();
  if (state.status === 'play' && ['s', 'e', 'n', 'q', 'm'].includes(lower)) e.preventDefault();
  handleActionKey(lower);
  checkStatusSound();
  render();
});

canvas.addEventListener('pointerdown', (e) => {
  canvas.focus();
  const p = screenPos(e);
  if (state.status === 'title') { ensureAudio(); startPlay(state); checkStatusSound(); render(); return; }
  if (state.status === 'win') { ensureAudio(); nextLevel(state); checkStatusSound(); render(); return; }
  if (state.status === 'complete') { ensureAudio(); state = createInitialState(0); startPlay(state); checkStatusSound(); render(); return; }
  if (state.status === 'fail') { ensureAudio(); retry(state); checkStatusSound(); render(); return; }
  ensureAudio();
  const g = gridAt(p.x, p.y);
  if (g && getTile(state, g.x, g.y)) {
    selectTile(state, g.x, g.y);
    const acted = rotateSelected(state, 1);
    if (acted) playRotate();
    announce(state.message);
    checkStatusSound();
    render();
  }
});

function checkStatusSound() {
  if (state.status !== lastStatus) {
    if (state.status === 'fail') playFail();
    if (state.status === 'win' || state.status === 'complete') playWin();
    lastStatus = state.status;
  }
}

function render() { draw(state, ctx); }

render();
announce(state.message);

window.__tidewire = { get state() { return structuredClone(state); } };
