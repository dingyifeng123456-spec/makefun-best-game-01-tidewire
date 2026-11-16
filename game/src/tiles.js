export function rotateDirs(dirs, rot) {
  return dirs.map((d) => (d + rot) % 4);
}

export function baseConnections(type) {
  switch (type) {
    case 'straight':
      return [0, 2];
    case 'corner':
      return [0, 1];
    case 'splitT':
      return [0, 1, 2];
    case 'storage':
      return [0, 2];
    case 'source':
    case 'receiver':
      return [1];
    default:
      return [];
  }
}

export function tileConnections(tile) {
  return rotateDirs(baseConnections(tile.type), ((tile.rot || 0) % 4 + 4) % 4);
}

export function connects(tile, dir) {
  return tileConnections(tile).includes(((dir % 4) + 4) % 4);
}

export function tileName(type) {
  if (type === 'straight') return 'Straight relay';
  if (type === 'corner') return 'Corner relay';
  if (type === 'splitT') return 'Splitter';
  if (type === 'storage') return 'Storage cell';
  return 'Relay';
}

export function rotateTile(tile) {
  if (tile.fixed) return false;
  tile.rot = ((tile.rot || 0) + 1) % 4;
  return true;
}
