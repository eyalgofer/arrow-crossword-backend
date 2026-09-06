export const MAX_GRID_SIZE = 18;
export const MIN_GRID_SIZE = 8;

export interface GridSize {
  rows: number;
  cols: number;
}

/**
 * Preferred Hebrew sizes — denser, larger boards (closer to real תשחץ).
 * Image-clue puzzles should use the 13–15 band.
 */
export const HEBREW_GRID_SIZE_MIX: GridSize[] = [
  { rows: 12, cols: 12 },
  { rows: 13, cols: 12 },
  { rows: 12, cols: 13 },
  { rows: 13, cols: 13 },
  { rows: 14, cols: 12 },
  { rows: 12, cols: 14 },
  { rows: 14, cols: 13 },
  { rows: 13, cols: 14 },
  { rows: 15, cols: 13 },
  { rows: 13, cols: 15 },
  { rows: 15, cols: 15 },
];

export function mixSizes(count: number, mix: GridSize[] = HEBREW_GRID_SIZE_MIX): GridSize[] {
  return Array.from({ length: count }, (_, i) => mix[i % mix.length]);
}

export function clampGridSize(n: number): number {
  return Math.max(MIN_GRID_SIZE, Math.min(MAX_GRID_SIZE, Math.round(n)));
}

/** Try the requested size, then shrink toward MIN if the generator cannot fill it. */
export function sizeFallbackChain(rows: number, cols: number): GridSize[] {
  const chain: GridSize[] = [];
  const seen = new Set<string>();
  const add = (r: number, c: number) => {
    const size = { rows: clampGridSize(r), cols: clampGridSize(c) };
    const key = `${size.rows}x${size.cols}`;
    if (!seen.has(key)) {
      seen.add(key);
      chain.push(size);
    }
  };

  let r = rows;
  let c = cols;
  add(r, c);
  while (r > MIN_GRID_SIZE || c > MIN_GRID_SIZE) {
    if (r >= c && r > MIN_GRID_SIZE) r -= 1;
    else if (c > MIN_GRID_SIZE) c -= 1;
    else r -= 1;
    add(r, c);
  }
  add(MIN_GRID_SIZE, MIN_GRID_SIZE);
  return chain;
}
