export const W = 1200;
export const H = 750;
export const GRID = { x: 70, y: 170, cols: 6, rows: 4, cell: 110, gap: 14 };
export const SIDE = { x: 860, y: 170, w: 270, h: 536 };
export const MAX_TURNS = 28;
export const MAX_OVERLOAD = 3;

export const COLORS = {
  bg0: '#081625',
  bg1: '#0d2740',
  panel: '#10263a',
  panel2: '#143450',
  line: '#6fa6a1',
  pathOff: '#31596b',
  pathOn: '#47d6cf',
  pathHot: '#ff7f66',
  pathStore: '#ffd88a',
  text: '#f6f0df',
  muted: '#b9c8c3',
  accent: '#ff6f61',
  source: '#8df7d6',
  receiverOff: '#38566c',
  receiverOn: '#ffe9b0',
  grid: 'rgba(170, 215, 210, 0.18)',
  focus: '#ffe9b0',
};

export const DIRS = [
  { x: 0, y: -1, name: 'N', opp: 2 },
  { x: 1, y: 0, name: 'E', opp: 3 },
  { x: 0, y: 1, name: 'S', opp: 0 },
  { x: -1, y: 0, name: 'W', opp: 1 },
];
