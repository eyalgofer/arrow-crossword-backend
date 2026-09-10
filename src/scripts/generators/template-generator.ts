import { Direction, Difficulty, GridTemplate, ClueSlot } from '../core/types';
import { validateSlotsBoundaries } from './validation-utils';

/**
 * Arrow Crossword Template Generator
 * Based on Jakob Engel’s BSc thesis “Generating Swedish-style Crossword Puzzle Masks
 * using Evolutionary Algorithms” (2009).
 * Reference: https://jakobengel.github.io/pdf/JakobEngelBsc.pdf
 *
 * Swedish / Hebrew arrow crosswords: clue-in-cell, arrows show direction (→↓↘↙⤵⤴),
 * high letter intersection. A definition cell may hold two arrows (one horizontal
 * + one vertical) so two words share one blocked square — the usual newspaper packing.
 * Six definition types (Figure 2.2) map to across, down, right-down, left-down,
 * down-across, up-across. Memetic algorithm (Ch. 4) with fitness from coverage,
 * word length, clustering, dead ends (Ch. 3.2).
 */

// ============================================================================
// Types (matching thesis definitions - Chapter 2.1)
// ============================================================================

/**
 * Field types in the mask (from thesis Figure 2.2):
 * 0: Letter field
 * 1: Definition field - arrow points RIGHT (→) - horizontal word
 * 2: Definition field - arrow points DOWN (↓) - vertical word
 * 3: Definition field - arrow points RIGHT-DOWN diagonal (↘) - vertical word starting below-right
 * 4: Definition field - arrow points LEFT-DOWN diagonal (↙) - vertical word starting below-left  
 * 5: Definition field - arrow points RIGHT from bottom (↗→) - horizontal word
 * 6: Definition field - arrow points RIGHT from top (↘→) - horizontal word
 * #: Cut-out field (blocked)
 *
 * A definition cell may encode two arrows, e.g. "12" for → and ↓ in the same square.
 * Per thesis: Types 1, 5, 6 define HORIZONTAL words
 *            Types 2, 3, 4 define VERTICAL words
 */
type ArrowType = '1' | '2' | '3' | '4' | '5' | '6';
type FieldType = '0' | ArrowType | '#';
/** Letter, cutout, one arrow, or two sorted arrows ("12", "25", …). */
type CellValue = string;

interface Mask {
  rows: number;
  cols: number;
  grid: CellValue[][];
  fitness?: number;
  validityPenalty?: number;
  qualityPenalty?: number;
  potentialRating?: number;
  localPenalties?: Map<string, number>;
}

interface GeneratorConfig {
  rows: number;
  cols: number;
  populationSize: number;        // n in thesis
  weakBreakCondition: number;    // bw in thesis (default 2000)
  strongBreakCondition: number;  // bs in thesis (default 10000)
  similarityThreshold: number;   // δ in thesis (default 0.1)
  cutoutCells?: Array<{ row: number; col: number }>;
  /** Definition cells that must stay fixed (e.g. image-clue exits). */
  lockedCells?: Array<{ row: number; col: number; type: FieldType }>;
  /** Image exits + letter corridors that repair must not rewrite. */
  protectedCells?: Array<{ row: number; col: number; type: FieldType }>;
  /** Prefer →↓ only so large boards stay fully packed without invalid Engel slots. */
  simpleArrows?: boolean;
  maxSlotLength?: number;
  minPopulation?: number;       // floor so n never drops below this (avoids collapse)
  maxIterations?: number;      // cap iterations (default 100)
  quiet?: boolean;             // suppress per-iteration logs when true
  /** How many random crossover lines to sample per pair (thesis: 50). */
  crossoverSamples?: number;
  // Fitness weights from thesis Chapter 3.2
  weights: {
    // Coverage penalties (Chapter 3.2.1)
    uncoveredField: number;           // Type 1: completely uncovered
    singleCoveredEnclosed: number;    // Type 2: covered once, enclosed
    singleCoveredOpen: number;        // Type 3: covered once, not enclosed
    doubleCoveredSameDirection: number; // Type 4: covered >1 in same direction
    // Word length penalties (Chapter 3.2.2, Table 3.1)
    wordLength: Record<number, number>;
    longWordIntersectionMultiplier: number; // For words > 6 letters intersecting
    // Clustering penalties (Chapter 3.2.3, Table 3.2)
    clusterPenalty: (size: number, maxExtension: number, touchesBorder: boolean) => number;
    // Invalid definition penalty (Chapter 3.2.4)
    invalidDefinition: number;
    // Dead end penalty (Chapter 3.2.5)
    deadEnd: number;
  };
}

// ============================================================================
// Default Configuration (from thesis Chapter 3.2)
// ============================================================================

const DEFAULT_CONFIG: Partial<GeneratorConfig> = {
  populationSize: 15,           // n = 15 from thesis Chapter 4.3
  weakBreakCondition: 2000,     // bw = 2000 from thesis Chapter 4.3
  strongBreakCondition: 10000,  // bs = 10000 from thesis Chapter 4.3
  similarityThreshold: 0.1,     // δ = 0.1 from thesis Chapter 4.3
  weights: {
    // Table 3.1 and Chapter 3.2.1
    uncoveredField: 1500,
    singleCoveredEnclosed: 75,
    singleCoveredOpen: 200,
    doubleCoveredSameDirection: 600,
    // Table 3.1 - Word length penalties
    // Length 2 is rejected until the pool has enough 2-letter answers to fill them.
    wordLength: {
      0: 1800,
      1: 1500,
      2: 1800,
      3: 100,
      4: 10,
      5: 0,
      6: 0,
      7: 30,
      8: 50,
      9: 150,
      10: 250,
      11: 400,
      12: 550,
      13: 750,
      14: 1000,
      15: 1300
    },
    longWordIntersectionMultiplier: 1, // Product of lengths for words > 6
    // Table 3.2 - Cluster penalties (simplified function based on table)
    clusterPenalty: (size: number, maxExtension: number, touchesBorder: boolean): number => {
      // Base penalties from Table 3.2
      const basePenalties: Record<number, Record<number, number>> = {
        1: { 1: 0 },
        2: { 2: 150 },
        3: { 2: 288, 3: 320 },
        4: { 2: 542, 3: 603, 4: 670 },
        5: { 3: 794, 4: 882, 5: 980 },
        6: { 4: 1053, 6: 1300 },
        7: { 5: 1620, 7: 2000 }
      };
      
      let penalty: number;
      if (size <= 7 && basePenalties[size] && basePenalties[size][maxExtension]) {
        penalty = basePenalties[size][maxExtension];
      } else if (size <= 7 && basePenalties[size]) {
        // Find closest extension
        const extensions = Object.keys(basePenalties[size]).map(Number);
        const closest = extensions.reduce((a, b) => 
          Math.abs(b - maxExtension) < Math.abs(a - maxExtension) ? b : a
        );
        penalty = basePenalties[size][closest];
      } else {
        // Extrapolate for larger clusters
        penalty = 2000 + (size - 7) * 500;
      }
      
      // Per thesis: "definition fields at the left or top border of the mask 
      // are only counted half"
      return touchesBorder ? penalty * 0.5 : penalty;
    },
    invalidDefinition: 2000,
    deadEnd: 400
  }
};

// ============================================================================
// Direction Utilities (from thesis Chapter 2.1)
// ============================================================================

/**
 * Get the direction vector for each definition field type
 * From thesis Figure 2.2:
 * Types 1, 5, 6 → HORIZONTAL words (move right along row)
 * Types 2, 3, 4 → VERTICAL words (move down along column)
 */
function getWordDirection(fieldType: FieldType): { dr: number; dc: number } | null {
  switch (fieldType) {
    case '1': return { dr: 0, dc: 1 };   // Right →
    case '2': return { dr: 1, dc: 0 };   // Down ↓
    case '3': return { dr: 1, dc: 0 };   // Vertical word (starts at specific position)
    case '4': return { dr: 1, dc: 0 };   // Vertical word (starts at specific position)
    case '5': return { dr: 0, dc: 1 };   // Horizontal word
    case '6': return { dr: 0, dc: 1 };   // Horizontal word
    default: return null;
  }
}

/**
 * Get starting position offset for word based on definition field type.
 * Aligned with direction-utils / puzzle: right-down and left-down start in the cell
 * beside the clue (right or left), then go down.
 */
function getWordStartOffset(fieldType: FieldType): { dr: number; dc: number } | null {
  switch (fieldType) {
    case '1': return { dr: 0, dc: 1 };   // Word starts directly to the right
    case '2': return { dr: 1, dc: 0 };   // Word starts directly below
    case '3': return { dr: 0, dc: 1 };   // Right-down: vertical, starts in cell to the RIGHT of clue, then down
    case '4': return { dr: 0, dc: -1 };  // Left-down: vertical, starts in cell to the LEFT of clue, then down
    case '5': return { dr: 1, dc: 0 };   // Word starts below, then goes right (from bottom of def field)
    case '6': return { dr: -1, dc: 0 };  // Up-across: word starts directly above clue (r-1,c), then goes right
    default: return null;
  }
}

/**
 * Check if definition field type creates horizontal word
 * Per thesis: "Words defined by a definition field of type 1,5 or 6 are called horizontal words"
 */
function isHorizontalWord(fieldType: FieldType): boolean {
  return fieldType === '1' || fieldType === '5' || fieldType === '6';
}

/**
 * Check if definition field type creates vertical word
 * Per thesis: "words defined by a definition field of type 2,3 or 4 are called vertical words"
 */
function isVerticalWord(fieldType: FieldType): boolean {
  return fieldType === '2' || fieldType === '3' || fieldType === '4';
}

/**
 * Maps internal field types to output Direction type
 * Per thesis Figure 2.2: 1→, 2↓, 3↘, 4↙, 5⤵(horizontal from below), 6⤴(horizontal from above)
 */
function fieldTypeToDirection(fieldType: FieldType): Direction | null {
  switch (fieldType) {
    case '1': return 'across';      // → horizontal
    case '2': return 'down';       // ↓ vertical
    case '3': return 'right-down'; // ↘ vertical, starts down-right
    case '4': return 'left-down';  // ↙ vertical, starts down-left
    case '5': return 'down-across';// ⤵ horizontal from bottom
    case '6': return 'up-across';  // ⤴ horizontal from top
    default: return null;
  }
}

function isArrowType(ch: string): ch is ArrowType {
  return ch === '1' || ch === '2' || ch === '3' || ch === '4' || ch === '5' || ch === '6';
}

/** Individual arrows in a cell ("12" → ['1','2']). */
function arrowTypesIn(cell: string): ArrowType[] {
  if (!cell || cell === '0' || cell === '#') return [];
  const seen = new Set<ArrowType>();
  const out: ArrowType[] = [];
  for (const ch of cell) {
    if (!isArrowType(ch) || seen.has(ch)) continue;
    seen.add(ch);
    out.push(ch);
  }
  return out;
}

function encodeArrows(types: ArrowType[]): CellValue {
  const unique = [...new Set(types.filter(isArrowType))].sort();
  return unique.length === 0 ? '0' : unique.slice(0, 2).join('');
}

function isDefinitionField(cell: string): boolean {
  return arrowTypesIn(cell).length > 0;
}

function isLetterField(cell: string): boolean {
  return cell === '0';
}

function isBlockedField(cell: string): boolean {
  return cell !== '0';
}

// ============================================================================
// Mask Operations
// ============================================================================

function createEmptyMask(rows: number, cols: number): Mask {
  const grid: CellValue[][] = [];
  for (let r = 0; r < rows; r++) {
    grid.push(new Array(cols).fill('0'));
  }
  return { rows, cols, grid };
}

function cloneMask(mask: Mask): Mask {
  return {
    rows: mask.rows,
    cols: mask.cols,
    grid: mask.grid.map(row => [...row]),
    fitness: mask.fitness,
    validityPenalty: mask.validityPenalty,
    qualityPenalty: mask.qualityPenalty,
    potentialRating: mask.potentialRating
  };
}

function isValidCoord(mask: Mask, row: number, col: number): boolean {
  return row >= 0 && row < mask.rows && col >= 0 && col < mask.cols;
}

function getField(mask: Mask, row: number, col: number): CellValue | null {
  if (!isValidCoord(mask, row, col)) return null;
  return mask.grid[row][col];
}

function setField(mask: Mask, row: number, col: number, fieldType: CellValue): void {
  if (isValidCoord(mask, row, col)) {
    mask.grid[row][col] = fieldType;
  }
}

function lockedKeySet(config: GeneratorConfig): Set<string> {
  const keys = new Set<string>();
  for (const cell of config.lockedCells ?? []) {
    keys.add(`${cell.row},${cell.col}`);
  }
  return keys;
}

/** Re-apply locked definition cells, then image cutouts so holes always win. */
function applyFixedCells(mask: Mask, config: GeneratorConfig): void {
  if (config.lockedCells) {
    for (const { row, col, type } of config.lockedCells) {
      setField(mask, row, col, type);
    }
  }
  if (config.cutoutCells) {
    for (const { row, col } of config.cutoutCells) {
      setField(mask, row, col, '#');
    }
  }
}

// ============================================================================
// Word Detection (from thesis Chapter 2.1)
// ============================================================================

interface WordInfo {
  definitionRow: number;
  definitionCol: number;
  definitionType: FieldType;
  startRow: number;
  startCol: number;
  length: number;
  direction: { dr: number; dc: number };
  letters: Array<{ row: number; col: number }>;
  isHorizontal: boolean;
}

/**
 * Find all words defined by definition fields in the mask
 * Per thesis: "The word starts at a field dependent on the type of its definition field, 
 * and continues along the corresponding row or column, until either the end of the grid 
 * is reached, or the next field is not a letter field."
 */
function findAllWords(mask: Mask): WordInfo[] {
  const words: WordInfo[] = [];

  for (let r = 0; r < mask.rows; r++) {
    for (let c = 0; c < mask.cols; c++) {
      const arrows = arrowTypesIn(mask.grid[r][c]);
      for (const fieldType of arrows) {
      const startOffset = getWordStartOffset(fieldType);
      const dir = getWordDirection(fieldType);
      if (!startOffset || !dir) continue;

      // Find start position
      const startRow = r + startOffset.dr;
      const startCol = c + startOffset.dc;

      // Check if start position is valid
      if (!isValidCoord(mask, startRow, startCol)) {
        // Word of length 0
        words.push({
          definitionRow: r,
          definitionCol: c,
          definitionType: fieldType,
          startRow,
          startCol,
          length: 0,
          direction: dir,
          letters: [],
          isHorizontal: isHorizontalWord(fieldType)
        });
        continue;
      }

      // Collect letters - continue until non-letter or grid boundary
      const letters: Array<{ row: number; col: number }> = [];
      let cr = startRow;
      let cc = startCol;

      while (isValidCoord(mask, cr, cc) && isLetterField(mask.grid[cr][cc])) {
        letters.push({ row: cr, col: cc });
        cr += dir.dr;
        cc += dir.dc;
      }

      words.push({
        definitionRow: r,
        definitionCol: c,
        definitionType: fieldType,
        startRow,
        startCol,
        length: letters.length,
        direction: dir,
        letters,
        isHorizontal: isHorizontalWord(fieldType)
      });
      }
    }
  }

  return words;
}

// ============================================================================
// Coverage Analysis (from thesis Chapter 3.2.1)
// ============================================================================

interface CoverageInfo {
  horizontalCount: number;
  verticalCount: number;
  total: number;
  isEnclosedHorizontally: boolean;
  isEnclosedVertically: boolean;
}

/**
 * Analyze coverage for each letter field
 * Per thesis Figure 3.2 and Chapter 3.2.1
 */
function analyzeCoverage(mask: Mask, words: WordInfo[]): Map<string, CoverageInfo> {
  const coverage = new Map<string, CoverageInfo>();

  // Initialize coverage for all letter fields
  for (let r = 0; r < mask.rows; r++) {
    for (let c = 0; c < mask.cols; c++) {
      if (isLetterField(mask.grid[r][c])) {
        // Check enclosure
        const leftBlocked = c === 0 || isBlockedField(mask.grid[r][c - 1]);
        const rightBlocked = c === mask.cols - 1 || isBlockedField(mask.grid[r][c + 1]);
        const topBlocked = r === 0 || isBlockedField(mask.grid[r - 1][c]);
        const bottomBlocked = r === mask.rows - 1 || isBlockedField(mask.grid[r + 1][c]);

        coverage.set(`${r},${c}`, {
          horizontalCount: 0,
          verticalCount: 0,
          total: 0,
          isEnclosedHorizontally: leftBlocked && rightBlocked,
          isEnclosedVertically: topBlocked && bottomBlocked
        });
      }
    }
  }

  // Count coverage from words
  for (const word of words) {
    for (const letter of word.letters) {
      const key = `${letter.row},${letter.col}`;
      const info = coverage.get(key);
      if (info) {
        if (word.isHorizontal) {
          info.horizontalCount++;
        } else {
          info.verticalCount++;
        }
        info.total = info.horizontalCount + info.verticalCount;
      }
    }
  }

  return coverage;
}

// ============================================================================
// Cluster Detection (from thesis Chapter 3.2.3)
// ============================================================================

interface Cluster {
  cells: Array<{ row: number; col: number }>;
  size: number;
  maxExtension: number;
  touchesBorder: boolean;
}

/**
 * Find all 8-connected clusters of definition fields
 * Per thesis: "8-connected (i.e. diagonal adjacency is considered as well)"
 */
function findDefinitionClusters(mask: Mask): Cluster[] {
  const visited = new Set<string>();
  const clusters: Cluster[] = [];

  for (let r = 0; r < mask.rows; r++) {
    for (let c = 0; c < mask.cols; c++) {
      const key = `${r},${c}`;
      if (visited.has(key)) continue;
      if (!isDefinitionField(mask.grid[r][c])) continue;

      // BFS to find cluster
      const cluster: Array<{ row: number; col: number }> = [];
      const queue: Array<{ row: number; col: number }> = [{ row: r, col: c }];
      visited.add(key);

      while (queue.length > 0) {
        const current = queue.shift()!;
        cluster.push(current);

        // Check 8 neighbors (including diagonals)
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = current.row + dr;
            const nc = current.col + dc;
            const nkey = `${nr},${nc}`;

            if (!isValidCoord(mask, nr, nc)) continue;
            if (visited.has(nkey)) continue;
            if (!isDefinitionField(mask.grid[nr][nc])) continue;

            visited.add(nkey);
            queue.push({ row: nr, col: nc });
          }
        }
      }

      // Calculate max extension (horizontal or vertical span)
      const rows = cluster.map(c => c.row);
      const cols = cluster.map(c => c.col);
      const rowSpan = Math.max(...rows) - Math.min(...rows) + 1;
      const colSpan = Math.max(...cols) - Math.min(...cols) + 1;
      const maxExtension = Math.max(rowSpan, colSpan);

      // Check if cluster touches left or top border
      const touchesBorder = cluster.some(cell => cell.row === 0 || cell.col === 0);

      clusters.push({
        cells: cluster,
        size: cluster.length,
        maxExtension,
        touchesBorder
      });
    }
  }

  return clusters;
}

// ============================================================================
// Dead End Detection (from thesis Chapter 3.2.5)
// ============================================================================

/**
 * Find dead ends: letter fields enclosed by 3 non-letter fields
 * Per thesis: "excluding the ones at the left and top border, as there such situations 
 * are unavoidable"
 */
function findDeadEnds(mask: Mask): Array<{ row: number; col: number }> {
  const deadEnds: Array<{ row: number; col: number }> = [];

  for (let r = 0; r < mask.rows; r++) {
    for (let c = 0; c < mask.cols; c++) {
      if (!isLetterField(mask.grid[r][c])) continue;
      
      // Skip fields at top or left border (per thesis)
      if (r === 0 || c === 0) continue;

      // Count blocked neighbors (4-connected)
      let blockedCount = 0;
      const neighbors = [
        { dr: -1, dc: 0 },  // top
        { dr: 1, dc: 0 },   // bottom
        { dr: 0, dc: -1 },  // left
        { dr: 0, dc: 1 }    // right
      ];

      for (const { dr, dc } of neighbors) {
        const nr = r + dr;
        const nc = c + dc;
        if (!isValidCoord(mask, nr, nc) || isBlockedField(mask.grid[nr][nc])) {
          blockedCount++;
        }
      }

      // Dead end if enclosed by 3+ non-letter fields
      if (blockedCount >= 3) {
        deadEnds.push({ row: r, col: c });
      }
    }
  }

  return deadEnds;
}

// ============================================================================
// Fitness Evaluation (from thesis Chapter 3.2)
// ============================================================================

/**
 * Calculate fitness (lower is better) - exact implementation from thesis
 * Per thesis Chapter 3.2.6: fitness = validityPenalty + qualityPenalty
 */
function evaluateFitness(mask: Mask, config: GeneratorConfig): number {
  let validityPenalty = 0;
  let qualityPenalty = 0;

  const words = findAllWords(mask);
  const coverage = analyzeCoverage(mask, words);
  const clusters = findDefinitionClusters(mask);
  const deadEnds = findDeadEnds(mask);

  // Initialize local penalties map for guided mutation
  const localPenalties = new Map<string, number>();
  for (let r = 0; r < mask.rows; r++) {
    for (let c = 0; c < mask.cols; c++) {
      localPenalties.set(`${r},${c}`, 0);
    }
  }

  // 1. Coverage penalties (Chapter 3.2.1)
  for (const [key, info] of coverage) {
    let penalty = 0;
    
    if (info.total === 0) {
      // Type 1: completely uncovered (validity violation)
      penalty = config.weights.uncoveredField;
      validityPenalty += penalty;
    } else if (info.total === 1) {
      // Type 2 or 3: covered only once
      if (info.isEnclosedHorizontally || info.isEnclosedVertically) {
        // Type 2: enclosed between two non-letter fields
        penalty = config.weights.singleCoveredEnclosed;
      } else {
        // Type 3: not enclosed
        penalty = config.weights.singleCoveredOpen;
      }
      qualityPenalty += penalty;
    } else if (info.horizontalCount > 1 || info.verticalCount > 1) {
      // Type 4: covered more than once in same direction (validity violation)
      penalty = config.weights.doubleCoveredSameDirection;
      validityPenalty += penalty;
    }
    // Type 5: covered once horizontally and vertically = 0 penalty
    
    localPenalties.set(key, (localPenalties.get(key) ?? 0) + penalty);
  }

  // 2. Word length penalties (Chapter 3.2.2)
  for (const word of words) {
    const lengthPenalty = config.weights.wordLength[Math.min(word.length, 15)] ?? 1500;
    qualityPenalty += lengthPenalty;
    
    // Distribute to definition field
    const defKey = `${word.definitionRow},${word.definitionCol}`;
    localPenalties.set(defKey, (localPenalties.get(defKey) ?? 0) + lengthPenalty);

    // Validity constraint: 2-letter slots are unfillable with the current Hebrew pool
    if (word.length < 3) {
      validityPenalty += 1000;
      localPenalties.set(defKey, (localPenalties.get(defKey) ?? 0) + 1000);
    }
  }

  // 3. Long word intersection penalties (Chapter 3.2.2)
  // "intersections of two words both longer than six letters receive additional penalty 
  // points given by the product of the lengths"
  const letterToWords = new Map<string, WordInfo[]>();
  for (const word of words) {
    for (const letter of word.letters) {
      const key = `${letter.row},${letter.col}`;
      if (!letterToWords.has(key)) {
        letterToWords.set(key, []);
      }
      letterToWords.get(key)!.push(word);
    }
  }

  for (const [key, wordList] of letterToWords) {
    if (wordList.length >= 2) {
      for (let i = 0; i < wordList.length; i++) {
        for (let j = i + 1; j < wordList.length; j++) {
          if (wordList[i].length > 6 && wordList[j].length > 6) {
            const penalty = wordList[i].length * wordList[j].length * 
                           config.weights.longWordIntersectionMultiplier;
            qualityPenalty += penalty;
            localPenalties.set(key, (localPenalties.get(key) ?? 0) + penalty);
          }
        }
      }
    }
  }

  // 4. Cluster penalties (Chapter 3.2.3)
  for (const cluster of clusters) {
    const penalty = config.weights.clusterPenalty(
      cluster.size, 
      cluster.maxExtension, 
      cluster.touchesBorder
    );
    qualityPenalty += penalty;
    
    // Distribute penalty among cluster cells
    const perCellPenalty = penalty / cluster.size;
    for (const cell of cluster.cells) {
      const key = `${cell.row},${cell.col}`;
      localPenalties.set(key, (localPenalties.get(key) ?? 0) + perCellPenalty);
    }
  }

  // 5. Invalid definition field penalties (Chapter 3.2.4)
  // "penalty of 2000 is introduced for each word violating [enclosure] constraint"
  for (const word of words) {
    if (word.length > 0) {
      const lastLetter = word.letters[word.letters.length - 1];
      const nextRow = lastLetter.row + word.direction.dr;
      const nextCol = lastLetter.col + word.direction.dc;

      // Word should end at grid boundary or blocked field
      if (isValidCoord(mask, nextRow, nextCol) && isLetterField(mask.grid[nextRow][nextCol])) {
        validityPenalty += config.weights.invalidDefinition;
        const defKey = `${word.definitionRow},${word.definitionCol}`;
        localPenalties.set(defKey, (localPenalties.get(defKey) ?? 0) + config.weights.invalidDefinition);
      }
    }
  }

  // 6. Dead end penalties (Chapter 3.2.5)
  for (const deadEnd of deadEnds) {
    qualityPenalty += config.weights.deadEnd;
    const key = `${deadEnd.row},${deadEnd.col}`;
    localPenalties.set(key, (localPenalties.get(key) ?? 0) + config.weights.deadEnd);
  }

  const totalFitness = validityPenalty + qualityPenalty;
  mask.fitness = totalFitness;
  mask.validityPenalty = validityPenalty;
  mask.qualityPenalty = qualityPenalty;
  mask.localPenalties = localPenalties;

  return totalFitness;
}

// ============================================================================
// Initialization (from thesis Chapter 3.3)
// ============================================================================

/**
 * Get allowed field types for a position based on constraints
 * Per thesis Chapter 3.3: "field assignments which - no matter how the surrounding 
 * mask looks like - are certain to cause a validity violation are disallowed"
 */
function arrowGeometryOk(mask: Mask, row: number, col: number, type: ArrowType): boolean {
  switch (type) {
    case '1': return col < mask.cols - 2;
    case '2': return row < mask.rows - 2;
    case '3': return col < mask.cols - 1 && row < mask.rows - 1;
    case '4': return col >= 1 && row < mask.rows - 1;
    case '5': return row < mask.rows - 1 && col < mask.cols - 2;
    case '6': return row >= 1 && col < mask.cols - 2;
  }
}

function getAllowedArrowTypes(
  mask: Mask,
  row: number,
  col: number,
  simpleArrows = false
): ArrowType[] {
  const allowed: ArrowType[] = [];
  const candidates: ArrowType[] = simpleArrows ? ['1', '2'] : ['1', '2', '3', '4', '5', '6'];
  for (const type of candidates) {
    if (!arrowGeometryOk(mask, row, col, type)) continue;
    if ((type === '3' || type === '4' || type === '5' || type === '6') &&
        !bentArrowIsSafe(mask, row, col, type)) {
      continue;
    }
    allowed.push(type);
  }
  return allowed;
}

/**
 * Get allowed field encodings for a position.
 * Includes letter, single arrows, and horizontal+vertical duals (two clues in one cell).
 */
function getAllowedFieldTypes(
  mask: Mask,
  row: number,
  col: number,
  simpleArrows = false
): CellValue[] {
  const arrows = getAllowedArrowTypes(mask, row, col, simpleArrows);
  return ['0', ...arrows];
}

/**
 * Initialize border fields for Swedish-style layout
 * Per thesis Chapter 3.3 and Figure 3.7
 */
function initializeBorders(mask: Mask, simpleArrows = false): void {
  if (simpleArrows && mask.grid[0][0] !== '#') {
    const corner = getAllowedFieldTypes(mask, 0, 0, true);
    if (corner.includes('1')) mask.grid[0][0] = '1';
    else if (corner.includes('2')) mask.grid[0][0] = '2';
  }

  // Top row: typically has definition fields pointing down
  for (let c = 0; c < mask.cols; c++) {
    if (mask.grid[0][c] === '#') continue; // Skip cutouts
    
    // Randomly place down-pointing definition fields
    if ((simpleArrows ? Math.random() < 0.55 : Math.random() < 0.3) && c > 0) {
      const allowed = getAllowedFieldTypes(mask, 0, c, simpleArrows);
      if (allowed.includes('2')) {
        mask.grid[0][c] = '2';
      }
    }
  }

  // Left column: typically has definition fields pointing right
  for (let r = 0; r < mask.rows; r++) {
    if (mask.grid[r][0] === '#') continue; // Skip cutouts
    
    // Randomly place right-pointing definition fields
    if ((simpleArrows ? Math.random() < 0.55 : Math.random() < 0.3) && r > 0) {
      const allowed = getAllowedFieldTypes(mask, r, 0, simpleArrows);
      if (allowed.includes('1')) {
        mask.grid[r][0] = '1';
      }
    }
  }
}

/**
 * Create a random initial mask
 * Per thesis: "initializing the rest of the mask with letter fields only improves 
 * the performance even further"
 */
function createRandomMask(config: GeneratorConfig): Mask {
  const mask = createEmptyMask(config.rows, config.cols);

  // Initialize borders, then pin cutouts / image exits so borders cannot overwrite them
  initializeBorders(mask, config.simpleArrows);
  applyFixedCells(mask, config);

  // With image cutouts, sprinkle interior dual-friendly clues so repair starts
  // closer to a newspaper-style packed grid (references are dense with duals).
  if ((config.cutoutCells?.length ?? 0) > 0 && !config.simpleArrows) {
    seedNewspaperClues(mask, config);
    applyFixedCells(mask, config);
  }

  return mask;
}

/**
 * Stagger short →/↓ (and occasional dual) clues so 15×15 image boards look
 * like Swedish/Hebrew newspaper תשחץ rather than sparse border-only seeds.
 */
function seedNewspaperClues(mask: Mask, config: GeneratorConfig): void {
  const locked = lockedKeySet(config);
  const step = mask.rows >= 15 ? 3 : 4;
  const phase = Math.floor(Math.random() * step);

  for (let r = 1; r < mask.rows - 1; r++) {
    for (let c = 1; c < mask.cols - 1; c++) {
      if (mask.grid[r][c] === '#' || locked.has(`${r},${c}`)) continue;
      if (mask.grid[r][c] !== '0') continue;
      if ((r + c + phase) % step !== 0) continue;
      // Denser clues → shorter slots → much higher Hebrew fill rate.
      if (Math.random() > 0.3) continue;

      const allowed = getAllowedFieldTypes(mask, r, c, config.simpleArrows);
      const duals = allowed.filter((t) => t.length === 2);
      const singles = allowed.filter((t) => t === '1' || t === '2');
      const mixed = allowed.filter(
        (t) => t === '3' || t === '4' || t === '5' || t === '6'
      );
      let pick: CellValue | null = null;
      if (duals.length > 0 && Math.random() < 0.28) {
        pick = duals[Math.floor(Math.random() * duals.length)];
      } else if (singles.length > 0 && Math.random() < 0.65) {
        pick = singles[Math.floor(Math.random() * singles.length)];
      } else if (mixed.length > 0 && Math.random() < 0.25) {
        pick = mixed[Math.floor(Math.random() * mixed.length)];
      }
      if (pick) mask.grid[r][c] = pick;
    }
  }
}

// ============================================================================
// Mutation (from thesis Chapter 3.4)
// ============================================================================

/**
 * Generate random number from standard normal distribution (Box-Muller transform)
 */
function gaussianRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Mutate a mask according to thesis Chapter 3.4
 * Algorithm 1 from Appendix A
 */
function mutate(mask: Mask, config: GeneratorConfig): Mask {
  const mutated = cloneMask(mask);
  const locked = lockedKeySet(config);
  
  // Per thesis: mutation size k randomly chosen from {2, 3}
  const mutationSize = Math.random() < 0.5 ? 2 : 3;
  
  // Per thesis: "Guided Mutation" - select center point using tournament selection
  // with α = 2, favoring areas with high penalty
  const candidates: Array<{ row: number; col: number }> = [];
  for (let r = 0; r < mask.rows; r++) {
    for (let c = 0; c < mask.cols; c++) {
      if (mask.grid[r][c] !== '#' && !locked.has(`${r},${c}`)) {
        candidates.push({ row: r, col: c });
      }
    }
  }

  if (candidates.length === 0) {
    applyFixedCells(mutated, config);
    return mutated;
  }

  // Tournament selection for center point (α = 2)
  const tournamentSize = 2;
  let bestCandidate = candidates[Math.floor(Math.random() * candidates.length)];
  let bestPenalty = mask.localPenalties?.get(`${bestCandidate.row},${bestCandidate.col}`) ?? 0;
  
  for (let i = 1; i < tournamentSize; i++) {
    const candidate = candidates[Math.floor(Math.random() * candidates.length)];
    const penalty = mask.localPenalties?.get(`${candidate.row},${candidate.col}`) ?? 0;
    if (penalty > bestPenalty) {
      bestCandidate = candidate;
      bestPenalty = penalty;
    }
  }

  const centerRow = bestCandidate.row;
  const centerCol = bestCandidate.col;
  
  // Per thesis: σ = 3 for standard deviation
  const sigma = 3;

  // Mutate k fields around center
  for (let i = 0; i < mutationSize; i++) {
    let targetRow: number, targetCol: number;

    if (i === 0) {
      // First mutation is at center point
      targetRow = centerRow;
      targetCol = centerCol;
    } else {
      // Per thesis: "The remaining fields to be modified are then chosen close to 
      // this central point, using a two-dimensional normal distribution"
      const dr = Math.round(gaussianRandom() * sigma);
      const dc = Math.round(gaussianRandom() * sigma);
      targetRow = centerRow + dr;
      targetCol = centerCol + dc;
    }

    if (!isValidCoord(mutated, targetRow, targetCol)) continue;
    if (mutated.grid[targetRow][targetCol] === '#') continue;
    if (locked.has(`${targetRow},${targetCol}`)) continue;

    // Get allowed types and pick one different from current
    const allowed = getAllowedFieldTypes(mutated, targetRow, targetCol, config.simpleArrows);
    const current = mutated.grid[targetRow][targetCol];
    const options = allowed.filter(t => t !== current);

    if (options.length > 0) {
      // Per thesis Chapter 3.4: "Field Type Probabilities"
      // "a letter field is chosen with probability 2/3"
      // "type 1 and 2 each get a probability of 1/12"
      // "type 3, 4, 5 and 6 each 1/24"
      
      const rand = Math.random();
      let newType: CellValue;
      
      if (rand < 2/3 && options.includes('0')) {
        newType = '0';
      } else {
        // Choose from definition field types with appropriate weights
        const defOptions = options.filter(t => t !== '0');
        if (defOptions.length === 0) {
          newType = options[Math.floor(Math.random() * options.length)];
        } else {
          // Weight type 1,2 higher than 3,4,5,6; duals (two clues / cell) highest
          const weighted: CellValue[] = [];
          for (const t of defOptions) {
          if (t.length === 2) {
            weighted.push(t);
          } else if (t === '1' || t === '2') {
              weighted.push(t, t);
            } else {
              weighted.push(t);
            }
          }
          newType = weighted[Math.floor(Math.random() * weighted.length)];
        }
      }
      
      mutated.grid[targetRow][targetCol] = newType;
    }
  }

  applyFixedCells(mutated, config);
  return mutated;
}

// ============================================================================
// Crossover (from thesis Chapter 3.5)
// ============================================================================

/**
 * Crossover two masks using a line through the center at angle beta
 * Algorithm 2 from Appendix A
 * @param beta Optional angle in radians; if omitted, chosen randomly (for backward compatibility)
 */
function crossover(parent1: Mask, parent2: Mask, config: GeneratorConfig, beta?: number): Mask {
  const child = createEmptyMask(parent1.rows, parent1.cols);

  // Per thesis: "Random angle for splitting line through center"
  // When called from memetic algorithm, use the beta that had best potential rating
  const angle = beta ?? Math.random() * Math.PI * 2;
  
  // Calculate center (with respect to non-cutout fields)
  let sumRow = 0, sumCol = 0, count = 0;
  for (let r = 0; r < parent1.rows; r++) {
    for (let c = 0; c < parent1.cols; c++) {
      if (parent1.grid[r][c] !== '#') {
        sumRow += r;
        sumCol += c;
        count++;
      }
    }
  }
  const gx = count > 0 ? sumCol / count : parent1.cols / 2;
  const gy = count > 0 ? sumRow / count : parent1.rows / 2;

  // Per thesis Algorithm 2: 
  // "if (sin β, cos β)(i − gx, j − gy)^T ≤ 0 then result[i,j] ← parent1[i,j]"
  for (let r = 0; r < parent1.rows; r++) {
    for (let c = 0; c < parent1.cols; c++) {
      const dx = c - gx;
      const dy = r - gy;
      const side = Math.sin(angle) * dx + Math.cos(angle) * dy;

      child.grid[r][c] = side <= 0 ? parent1.grid[r][c] : parent2.grid[r][c];
    }
  }

  applyFixedCells(child, config);
  return child;
}

/**
 * Calculate potential rating for a crossover result
 * Per thesis Chapter 4.2: "Let the potential rating of a crossover result be defined 
 * as the sum of the local ratings of both halves"
 */
function calculatePotentialRating(parent1: Mask, parent2: Mask, beta: number): number {
  if (!parent1.localPenalties || !parent2.localPenalties) return Infinity;

  let sumRow = 0, sumCol = 0, count = 0;
  for (let r = 0; r < parent1.rows; r++) {
    for (let c = 0; c < parent1.cols; c++) {
      if (parent1.grid[r][c] !== '#') {
        sumRow += r;
        sumCol += c;
        count++;
      }
    }
  }
  const gx = count > 0 ? sumCol / count : parent1.cols / 2;
  const gy = count > 0 ? sumRow / count : parent1.rows / 2;

  let potential = 0;
  for (let r = 0; r < parent1.rows; r++) {
    for (let c = 0; c < parent1.cols; c++) {
      const key = `${r},${c}`;
      const dx = c - gx;
      const dy = r - gy;
      const side = Math.sin(beta) * dx + Math.cos(beta) * dy;

      if (side <= 0) {
        potential += parent1.localPenalties.get(key) ?? 0;
      } else {
        potential += parent2.localPenalties.get(key) ?? 0;
      }
    }
  }

  return potential;
}

// ============================================================================
// Hill Climbing (from thesis Algorithm 3)
// ============================================================================

/**
 * Hill climb a mask to local optimum
 * Algorithm 3 from Appendix A
 */
function hillClimb(mask: Mask, config: GeneratorConfig, limit: number): Mask {
  let current = cloneMask(mask);
  evaluateFitness(current, config);

  let noChange = 0;

  while (noChange < limit) {
    const mutated = mutate(current, config);
    evaluateFitness(mutated, config);

    if (mutated.fitness! < current.fitness!) {
      current = mutated;
      noChange = 0;
    } else {
      noChange++;
    }
  }

  return current;
}

// ============================================================================
// Similarity Calculation (for thesis Chapter 4.2)
// ============================================================================

/**
 * Calculate similarity between two masks (Hamming distance based)
 * Per thesis: masks are "too similar" if more than (1-δ) fields are identical
 */
function areTooSimilar(mask1: Mask, mask2: Mask, threshold: number): boolean {
  let same = 0;
  let total = 0;

  for (let r = 0; r < mask1.rows; r++) {
    for (let c = 0; c < mask1.cols; c++) {
      if (mask1.grid[r][c] !== '#') {
        total++;
        if (mask1.grid[r][c] === mask2.grid[r][c]) {
          same++;
        }
      }
    }
  }

  // Per thesis: δ = maximal fraction of identically assigned fields
  // Two masks are "too similar" if similarity > (1 - δ)
  const similarity = total > 0 ? same / total : 0;
  return similarity > (1 - threshold);
}

// ============================================================================
// Memetic Algorithm (from thesis Chapter 4.2, Algorithm 5)
// ============================================================================

/**
 * Run the memetic algorithm exactly as described in thesis Chapter 4.2
 * This is the main algorithm - see Figure 4.2 and Algorithm 5 in Appendix A
 */
function memeticAlgorithm(config: GeneratorConfig): Mask {
  if (!config.quiet) {
    console.log(`Starting memetic algorithm: ${config.rows}x${config.cols} grid`);
    console.log(`Parameters: n=${config.populationSize}, bw=${config.weakBreakCondition}, bs=${config.strongBreakCondition}, δ=${config.similarityThreshold}`);
  }

  let n = config.populationSize;

  // Step 0: Create initial masks using a hillclimber
  // Per thesis: "for i ← 1 to n do population[i] ← hillclimbe(getRandomMask(), bs)"
  let population: Mask[] = [];
  for (let i = 0; i < n; i++) {
    if (!config.quiet) console.log(`Initializing mask ${i + 1}/${n}...`);
    const randomMask = createRandomMask(config);
    const optimized = hillClimb(randomMask, config, config.strongBreakCondition);
    population.push(optimized);
  }

  if (!config.quiet) console.log(`Initial population created. Best fitness: ${Math.min(...population.map(m => m.fitness!))}`);

  let iteration = 0;
  const maxIterations = config.maxIterations ?? 100; // Safety limit

  while (iteration < maxIterations) {
    iteration++;
    if (!config.quiet) console.log(`\n=== Iteration ${iteration} ===`);

    // Step 1: Cross every pair of masks, try multiple crossover lines
    // Per thesis: "forall {i, j} in ([n] choose 2) do"
    const newPop: Mask[] = [];
    
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        // Per thesis: "try 50 crossover lines, keep best by potential rating"
        let bestChild: Mask | null = null;
        let bestPotential = Infinity;
        let bestBeta = 0;

        for (let k = 0; k < (config.crossoverSamples ?? 50); k++) {
          const beta = Math.random() * Math.PI * 2;
          const potential = calculatePotentialRating(population[i], population[j], beta);
          
          if (potential < bestPotential) {
            bestPotential = potential;
            bestBeta = beta;
          }
        }

        // Create child with the crossover line that had best potential (per thesis: use that beta)
        const child = crossover(population[i], population[j], config, bestBeta);
        evaluateFitness(child, config);
        child.potentialRating = bestPotential;
        newPop.push(child);
      }
    }

    if (!config.quiet) console.log(`Step 1: Created ${newPop.length} crossover children`);

    // Step 2: Select the 2n best masks with respect to potential rating
    newPop.sort((a, b) => (a.potentialRating ?? Infinity) - (b.potentialRating ?? Infinity));
    const selected2n = newPop.slice(0, 2 * n);
    
    if (!config.quiet) console.log(`Step 2: Selected ${selected2n.length} masks by potential rating`);

    // Step 3: Apply hillclimber with weak break condition
    if (!config.quiet) console.log(`Step 3: Applying weak hillclimber (bw=${config.weakBreakCondition})...`);
    for (let i = 0; i < selected2n.length; i++) {
      selected2n[i] = hillClimb(selected2n[i], config, config.weakBreakCondition);
    }

    // Step 4: Remove masks that are too similar to each other
    // Per thesis: "sort newPop (by descending actual rating of masks)"
    selected2n.sort((a, b) => (a.fitness ?? Infinity) - (b.fitness ?? Infinity));
    
    const minPop = config.minPopulation ?? 5; // Floor to avoid collapse spiral
    const diverse: Mask[] = [];
    const markedForDeletion = new Set<number>();
    
    for (let i = 0; i < selected2n.length; i++) {
      if (markedForDeletion.has(i)) continue;
      diverse.push(selected2n[i]);
      for (let j = i + 1; j < selected2n.length; j++) {
        if (areTooSimilar(selected2n[i], selected2n[j], config.similarityThreshold)) {
          markedForDeletion.add(j);
        }
      }
    }

    if (!config.quiet) {
      console.log(`Step 4: Removed ${selected2n.length - diverse.length} similar masks, ${diverse.length} remain`);
    }

    // Step 5: Select the at most n best masks; never shrink n below minPopulation
    // Per thesis: "if population.Count ≥ n then keep only best n masks in population
    //             else n ← population.Count"
    if (diverse.length >= n) {
      population = diverse.slice(0, n);
    } else if (diverse.length >= minPop) {
      population = diverse;
      n = population.length;
      if (!config.quiet) console.log(`Warning: Population reduced to ${n} masks`);
    } else {
      // Diversity culled too many: keep top minPop (or all) from selected2n to avoid collapse
      const keep = Math.min(selected2n.length, Math.max(minPop, diverse.length));
      population = selected2n.slice(0, keep);
      n = population.length;
      if (!config.quiet) console.log(`Warning: Diversity culled to ${diverse.length}; keeping top ${n} by fitness`);
    }

    if (!config.quiet) console.log(`Step 5: Population size = ${population.length}`);

    // Step 6: Apply hillclimber with strong break condition
    if (!config.quiet) console.log(`Step 6: Applying strong hillclimber (bs=${config.strongBreakCondition})...`);
    for (let i = 0; i < population.length; i++) {
      population[i] = hillClimb(population[i], config, config.strongBreakCondition);
    }

    population.sort((a, b) => (a.fitness ?? Infinity) - (b.fitness ?? Infinity));

    const bestFitness = population[0].fitness!;
    const bestValidity = population[0].validityPenalty!;
    const bestQuality = population[0].qualityPenalty!;
    
    if (!config.quiet) console.log(`Best fitness: ${bestFitness} (validity: ${bestValidity}, quality: ${bestQuality})`);

    // Early termination if we have a valid, good-enough mask (relaxed for seed speed)
    const qualityThreshold = config.rows * config.cols * 60; // ~6000 for 10x10
    const hasCutouts = (config.cutoutCells?.length ?? 0) > 0;
    // With image cutouts, perfect validity is rare — accept a small validity debt early.
    const validityOk = bestValidity === 0;
    const qualityOk = bestQuality < (hasCutouts ? qualityThreshold * 1.5 : qualityThreshold);
    if (validityOk && qualityOk) {
      if (!config.quiet) console.log('Found satisfactory solution, terminating');
      break;
    }

    // Check for population collapse: keep best mask(s), refill rest
    if (population.length < 2) {
      if (!config.quiet) console.log('Population too small, refilling while keeping best...');
      const kept = population.length > 0 ? [population[0]] : [];
      const fillCount = config.populationSize - kept.length;
      const newMasks: Mask[] = [];
      for (let i = 0; i < fillCount; i++) {
        const randomMask = createRandomMask(config);
        const optimized = hillClimb(randomMask, config, config.strongBreakCondition);
        newMasks.push(optimized);
      }
      population = [...kept, ...newMasks].sort((a, b) => (a.fitness ?? Infinity) - (b.fitness ?? Infinity));
      population = population.slice(0, config.populationSize);
      n = population.length;
    }
  }

  // Return best mask
  population.sort((a, b) => (a.fitness ?? Infinity) - (b.fitness ?? Infinity));
  
  if (!config.quiet) {
    console.log('\nFinal mask:');
    printMask(population[0]);
  }
  
  return population[0];
}

// ============================================================================
// Convert to GridTemplate
// ============================================================================

/**
 * Convert internal mask to GridTemplate format
 */
function rebuildSlotCrossings(slots: ClueSlot[]): void {
  for (const slot of slots) {
    slot.crossings = [];
  }
  const letterToSlots = new Map<string, Array<{ slotId: string; position: number }>>();
  for (const slot of slots) {
    const cells = slot.cells && slot.cells.length > 0 ? slot.cells : [];
    for (let pos = 0; pos < cells.length; pos++) {
      const key = `${cells[pos].row},${cells[pos].col}`;
      if (!letterToSlots.has(key)) letterToSlots.set(key, []);
      letterToSlots.get(key)!.push({ slotId: slot.id, position: pos });
    }
  }
  for (const [, slotInfos] of letterToSlots) {
    if (slotInfos.length < 2) continue;
    for (let i = 0; i < slotInfos.length; i++) {
      for (let j = i + 1; j < slotInfos.length; j++) {
        const slot1 = slots.find((s) => s.id === slotInfos[i].slotId);
        const slot2 = slots.find((s) => s.id === slotInfos[j].slotId);
        if (!slot1 || !slot2) continue;
        slot1.crossings.push({
          slotId: slot2.id,
          thisPosition: slotInfos[i].position,
          otherPosition: slotInfos[j].position,
        });
        slot2.crossings.push({
          slotId: slot1.id,
          thisPosition: slotInfos[j].position,
          otherPosition: slotInfos[i].position,
        });
      }
    }
  }
}

function countLetterRun(
  mask: Mask,
  row: number,
  col: number,
  dr: number,
  dc: number
): number {
  let n = 0;
  let r = row;
  let c = col;
  while (isValidCoord(mask, r, c) && isLetterField(mask.grid[r][c])) {
    n += 1;
    r += dr;
    c += dc;
  }
  return n;
}

/** Cell immediately before the first letter, along the word flow (not the clue). */
function cellBeforeFirstLetter(
  fieldType: FieldType,
  first: { row: number; col: number }
): { row: number; col: number } {
  switch (fieldType) {
    case '1':
    case '5':
    case '6':
      return { row: first.row, col: first.col - 1 };
    default:
      return { row: first.row - 1, col: first.col };
  }
}

function bentArrowIsSafe(
  mask: Mask,
  defRow: number,
  defCol: number,
  fieldType: FieldType
): boolean {
  const offset = getWordStartOffset(fieldType);
  if (!offset) return false;
  const first = { row: defRow + offset.dr, col: defCol + offset.dc };
  if (!isValidCoord(mask, first.row, first.col) || !isLetterField(mask.grid[first.row][first.col])) {
    return false;
  }
  const before = cellBeforeFirstLetter(fieldType, first);
  if (!isValidCoord(mask, before.row, before.col)) return true;
  const cell = mask.grid[before.row][before.col];
  return cell !== '0';
}

function lettersFromArrow(
  mask: Mask,
  defRow: number,
  defCol: number,
  type: ArrowType,
  treatAsLetter: Set<string> = new Set()
): Array<{ row: number; col: number }> {
  const offset = getWordStartOffset(type);
  const dir = getWordDirection(type);
  if (!offset || !dir) return [];
  const letters: Array<{ row: number; col: number }> = [];
  let r = defRow + offset.dr;
  let c = defCol + offset.dc;
  while (isValidCoord(mask, r, c)) {
    const key = `${r},${c}`;
    const isLetter = mask.grid[r][c] === '0' || treatAsLetter.has(key);
    if (!isLetter) break;
    letters.push({ row: r, col: c });
    r += dir.dr;
    c += dir.dc;
  }
  return letters;
}

/** Absorb a neighboring single-arrow clue into this cell (two clues, one square). */
function tryMergeDuals(
  mask: Mask,
  canEdit: (row: number, col: number) => boolean,
  simpleArrows: boolean,
  maxLen: number
): boolean {
  for (let r = 0; r < mask.rows; r++) {
    for (let c = 0; c < mask.cols; c++) {
      const keepTypes = arrowTypesIn(mask.grid[r][c]);
      if (keepTypes.length !== 1 || !canEdit(r, c)) continue;
      const keep = keepTypes[0];
      const addOns = simpleArrows ? (['1', '2'] as ArrowType[]) : (['1', '2', '3', '4', '5', '6'] as ArrowType[]);
      for (const add of addOns) {
        if (add === keep) continue;
        if (isHorizontalWord(keep) === isHorizontalWord(add)) continue;
        if (!arrowGeometryOk(mask, r, c, add)) continue;
        const offset = getWordStartOffset(add);
        if (!offset) continue;
        const fr = r + offset.dr;
        const fc = c + offset.dc;
        if (!canEdit(fr, fc)) continue;
        const freeTypes = arrowTypesIn(mask.grid[fr][fc]);
        if (freeTypes.length !== 1 || freeTypes[0] !== add) continue;
        const treat = new Set([`${fr},${fc}`]);
        if ((add === '3' || add === '4' || add === '5' || add === '6')) {
          const first = { row: fr, col: fc };
          const before = cellBeforeFirstLetter(add, first);
          if (isValidCoord(mask, before.row, before.col) && mask.grid[before.row][before.col] === '0') {
            continue;
          }
        }
        const letters = lettersFromArrow(mask, r, c, add, treat);
        if (letters.length < 3 || letters.length > maxLen) continue;
        mask.grid[r][c] = encodeArrows([keep, add]);
        mask.grid[fr][fc] = '0';
        return true;
      }
    }
  }
  return false;
}

/** Add a second arrow onto an existing clue so it covers an uncovered letter. */
function tryStackCover(
  mask: Mask,
  row: number,
  col: number,
  canEdit: (r: number, c: number) => boolean,
  simpleArrows: boolean,
  maxLen: number
): boolean {
  for (let r = 0; r < mask.rows; r++) {
    for (let c = 0; c < mask.cols; c++) {
      const existing = arrowTypesIn(mask.grid[r][c]);
      if (existing.length !== 1 || !canEdit(r, c)) continue;
      const keep = existing[0];
      const addOns = simpleArrows ? (['1', '2'] as ArrowType[]) : (['1', '2', '3', '4', '5', '6'] as ArrowType[]);
      for (const add of addOns) {
        if (add === keep) continue;
        if (isHorizontalWord(keep) === isHorizontalWord(add)) continue;
        if (!arrowGeometryOk(mask, r, c, add)) continue;
        if ((add === '3' || add === '4' || add === '5' || add === '6') &&
            !bentArrowIsSafe(mask, r, c, add)) {
          continue;
        }
        const letters = lettersFromArrow(mask, r, c, add);
        if (letters.length < 3 || letters.length > maxLen) continue;
        if (!letters.some((letter) => letter.row === row && letter.col === col)) continue;
        mask.grid[r][c] = encodeArrows([keep, add]);
        return true;
      }
    }
  }
  return false;
}

/**
 * Pick a legal clue type at (row, col) that starts a word of at least 3 letters.
 * Prefers unused mixed-arrow types so boards do not collapse to →↓.
 */
function bestClueTypeForHole(
  mask: Mask,
  row: number,
  col: number,
  simpleArrows: boolean,
  preferVertical: boolean
): ArrowType | null {
  const allowed = new Set(getAllowedArrowTypes(mask, row, col, simpleArrows));
  const options: Array<{ type: ArrowType; run: number; mixed: boolean }> = [];
  const consider = (type: ArrowType, run: number, mixed: boolean) => {
    if (!allowed.has(type) || run < 3) return;
    options.push({ type, run, mixed });
  };

  consider('1', countLetterRun(mask, row, col + 1, 0, 1), false);
  consider('2', countLetterRun(mask, row + 1, col, 1, 0), false);
  if (!simpleArrows) {
    if (bentArrowIsSafe(mask, row, col, '3')) {
      consider('3', countLetterRun(mask, row, col + 1, 1, 0), true);
    }
    if (bentArrowIsSafe(mask, row, col, '4')) {
      consider('4', countLetterRun(mask, row, col - 1, 1, 0), true);
    }
    if (bentArrowIsSafe(mask, row, col, '5')) {
      consider('5', countLetterRun(mask, row + 1, col, 0, 1), true);
    }
    if (bentArrowIsSafe(mask, row, col, '6')) {
      consider('6', countLetterRun(mask, row - 1, col, 0, 1), true);
    }
  }
  if (options.length === 0) return null;

  const axis = preferVertical
    ? (t: ArrowType) => t === '2' || t === '3' || t === '4'
    : (t: ArrowType) => t === '1' || t === '5' || t === '6';
  options.sort((a, b) => {
    const aAxis = axis(a.type) ? 1 : 0;
    const bAxis = axis(b.type) ? 1 : 0;
    if (bAxis !== aAxis) return bAxis - aAxis;
    if (Number(b.mixed) !== Number(a.mixed)) return Number(b.mixed) - Number(a.mixed);
    return b.run - a.run;
  });
  const top = options.filter(
    (opt) => axis(opt.type) === axis(options[0].type) && opt.mixed === options[0].mixed
  );
  return top[Math.floor(Math.random() * top.length)].type;
}

/**
 * After the GA, pack the mask: split overlong words, absorb 1–2 letter runs,
 * and turn leftover letter holes into clues using any legal arrow type.
 */
function repairPackedMask(mask: Mask, config: GeneratorConfig): Mask {
  const repaired = cloneMask(mask);
  applyFixedCells(repaired, config);

  const maxLen = config.maxSlotLength ?? 11;
  const simpleArrows = config.simpleArrows ?? false;
  const protectedKeys = new Set(
    (config.protectedCells ?? []).map((cell) => `${cell.row},${cell.col}`)
  );

  const pinProtected = () => {
    for (const cell of config.protectedCells ?? []) {
      setField(repaired, cell.row, cell.col, cell.type);
    }
    for (const { row, col } of config.cutoutCells ?? []) {
      setField(repaired, row, col, '#');
    }
  };

  const canEdit = (row: number, col: number) =>
    isValidCoord(repaired, row, col) &&
    repaired.grid[row][col] !== '#' &&
    !protectedKeys.has(`${row},${col}`);

  for (let pass = 0; pass < ((config.cutoutCells?.length ?? 0) > 0 ? 72 : 48); pass++) {
    pinProtected();
    const words = findAllWords(repaired);
    let changed = false;

    for (const word of words) {
      const type = word.definitionType;
      if (type === '0' || type === '#' || type === '1' || type === '2') continue;
      if (word.letters.length >= 3 && bentArrowIsSafe(repaired, word.definitionRow, word.definitionCol, type)) {
        continue;
      }
      const offset = getWordStartOffset(type);
      if (offset) {
        const first = {
          row: word.definitionRow + offset.dr,
          col: word.definitionCol + offset.dc,
        };
        const before = cellBeforeFirstLetter(type, first);
        if (
          isValidCoord(repaired, before.row, before.col) &&
          canEdit(before.row, before.col) &&
          isLetterField(repaired.grid[before.row][before.col])
        ) {
          const pin = bestClueTypeForHole(
            repaired,
            before.row,
            before.col,
            simpleArrows,
            isHorizontalWord(type)
          );
          if (pin) {
            repaired.grid[before.row][before.col] = pin;
            changed = true;
            break;
          }
        }
      }
      if (!canEdit(word.definitionRow, word.definitionCol)) continue;
      const existing = arrowTypesIn(repaired.grid[word.definitionRow][word.definitionCol]);
      const without = existing.filter((arrow) => arrow !== type);
      const fallback = bestClueTypeForHole(
        repaired,
        word.definitionRow,
        word.definitionCol,
        true,
        isVerticalWord(type)
      );
      const next = fallback && fallback !== type ? [...without, fallback] : without;
      repaired.grid[word.definitionRow][word.definitionCol] = encodeArrows(next);
      changed = true;
      break;
    }
    if (changed) continue;

    for (const word of words) {
      if (word.length >= 3) continue;
      if (canEdit(word.definitionRow, word.definitionCol)) {
        const left = arrowTypesIn(repaired.grid[word.definitionRow][word.definitionCol])
          .filter((arrow) => arrow !== word.definitionType);
        repaired.grid[word.definitionRow][word.definitionCol] = encodeArrows(left);
        changed = true;
        break;
      }
      if (word.length === 0) {
        const fr = word.startRow;
        const fc = word.startCol;
        if (canEdit(fr, fc) && repaired.grid[fr][fc] !== '#') {
          repaired.grid[fr][fc] = '0';
          changed = true;
          break;
        }
        continue;
      }
      const last = word.letters[word.letters.length - 1];
      const nr = last.row + word.direction.dr;
      const nc = last.col + word.direction.dc;
      if (canEdit(nr, nc) && arrowTypesIn(repaired.grid[nr][nc]).length === 1) {
        repaired.grid[nr][nc] = '0';
        changed = true;
        break;
      }
      const letter = word.letters[0];
      if (word.length === 1 && canEdit(letter.row, letter.col)) {
        const type = bestClueTypeForHole(
          repaired,
          letter.row,
          letter.col,
          simpleArrows,
          word.isHorizontal
        );
        if (type) {
          repaired.grid[letter.row][letter.col] = type;
          changed = true;
          break;
        }
      }
    }
    if (changed) continue;

    for (const word of words) {
      const defKey = `${word.definitionRow},${word.definitionCol}`;
      const isImageExit = protectedKeys.has(defKey);
      const imageWordTooLong = isImageExit && word.length > 7;
      if (word.length <= maxLen && !imageWordTooLong) continue;
      // Image exits: prefer splitting at catalog-friendly 5–7.
      const splitAt = imageWordTooLong ? 5 : 3;
      const splitUntil = imageWordTooLong
        ? Math.min(7, word.length - 3)
        : word.length - 4;
      for (let i = splitAt; i <= splitUntil; i++) {
        const split = word.letters[i];
        if (!split || !canEdit(split.row, split.col)) continue;
        repaired.grid[split.row][split.col] = word.isHorizontal ? '1' : '2';
        changed = true;
        break;
      }
      if (changed) break;
    }
    if (changed) continue;

    const hasCutouts = (config.cutoutCells?.length ?? 0) > 0;

    // Cover holes BEFORE dual merges — otherwise dual packing can starve coverage.
    const coverage = analyzeCoverage(repaired, words);
    const uncovered: Array<{ row: number; col: number }> = [];
    for (const [key, info] of coverage) {
      if (info.total > 0) continue;
      const [row, col] = key.split(',').map(Number);
      uncovered.push({ row, col });
    }
    uncovered.sort((a, b) => a.row + a.col - (b.row + b.col));
    for (const cell of uncovered) {
      if (!canEdit(cell.row, cell.col)) continue;
      if (
        tryStackCover(
          repaired,
          cell.row,
          cell.col,
          canEdit,
          hasCutouts || simpleArrows,
          maxLen
        )
      ) {
        changed = true;
        break;
      }
      const type = bestClueTypeForHole(repaired, cell.row, cell.col, simpleArrows, false);
      if (!type) continue;
      repaired.grid[cell.row][cell.col] = type;
      changed = true;
      break;
    }
    if (changed) continue;

    // Dual packing for newspaper feel (→↓ only around image cutouts).
    if (tryMergeDuals(repaired, canEdit, hasCutouts || simpleArrows, maxLen)) {
      changed = true;
      continue;
    }

    if (!changed) break;
  }

  pinProtected();
  return repaired;
}

/**
 * Regular 16×16 →↓ lattice: 3–5 letter slots, mixed arrows, fully packed.
 * Image cutouts/locks are applied on top, then repair heals chopped words.
 */
function paintLatticeMask(mask: Mask): void {
  if (mask.rows !== 16 || mask.cols !== 16) return;
  for (let r = 0; r < 16; r++) {
    const clueRow = r % 5 === 0 && r < mask.rows - 1;
    for (let c = 0; c < 16; c++) {
      if (clueRow) {
        if (c === 0 || c === 5 || c === 10) mask.grid[r][c] = '1';
        else if (c === 4 || c === 9 || c === 14 || c === 15) mask.grid[r][c] = '2';
        else mask.grid[r][c] = '0';
      } else if (c === 0 || c === 5 || c === 10) {
        mask.grid[r][c] = '1';
      } else {
        mask.grid[r][c] = '0';
      }
    }
  }
}

/**
 * Newspaper-style →↓ lattice for 13–15 grids (Swedish/Hebrew תשחץ look).
 * Dual clues on lattice nodes; 3–4 letter runs between nodes — very fillable.
 * Image cutouts/locks are applied on top; repairPackedMask heals around them.
 * A few safe bent arrows are sprinkled so quality gates see mixed directions.
 */
function paintNewspaperMask(mask: Mask): void {
  const { rows, cols } = mask;
  // Match the proven 16×16 lattice rhythm (step 5):
  // clue rows: → on the lattice columns, ↓ just before the next node / at the edge
  // other rows: → on the lattice columns only
  const step = 5;

  for (let r = 0; r < rows; r++) {
    const clueRow = r % step === 0 && r < rows - 1;
    for (let c = 0; c < cols; c++) {
      if (clueRow) {
        if (c % step === 0 && c < cols - 1) {
          mask.grid[r][c] = '1';
        } else if (c % step === step - 1 || c === cols - 1) {
          mask.grid[r][c] = '2';
        } else {
          mask.grid[r][c] = '0';
        }
      } else if (c % step === 0 && c < cols - 1) {
        mask.grid[r][c] = '1';
      } else {
        mask.grid[r][c] = '0';
      }
    }
  }

  // Add duals only on clue-row lattice nodes when both arrows have room
  // (→ has letters to the right, ↓ has letters below — not another → cell).
  for (let r = 0; r < rows - 1; r += step) {
    for (let c = 0; c < cols - 1; c += step) {
      if (mask.grid[r][c] !== '1') continue;
      // ↓ needs the cell below to be a letter (not another across clue).
      if (mask.grid[r + 1][c] !== '0') continue;
      mask.grid[r][c] = '12';
    }
  }
}

/** Convert a few →/↓ clues to bent arrows where geometry allows (mixed look). */
function sprinkleBentArrows(mask: Mask, want: number): void {
  const bent: ArrowType[] = ['3', '4', '5', '6'];
  const candidates: Array<{ row: number; col: number }> = [];
  for (let r = 0; r < mask.rows; r++) {
    for (let c = 0; c < mask.cols; c++) {
      const arrows = arrowTypesIn(mask.grid[r][c]);
      if (arrows.length === 1 && (arrows[0] === '1' || arrows[0] === '2')) {
        candidates.push({ row: r, col: c });
      }
    }
  }
  // Shuffle
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  let placed = 0;
  for (const { row, col } of candidates) {
    if (placed >= want) break;
    const keep = arrowTypesIn(mask.grid[row][col])[0];
    const options = bent.filter(
      (type) =>
        isHorizontalWord(keep) !== isHorizontalWord(type) &&
        arrowGeometryOk(mask, row, col, type) &&
        bentArrowIsSafe(mask, row, col, type) &&
        lettersFromArrow(mask, row, col, type).length >= 3
    );
    if (options.length === 0) continue;
    const add = options[Math.floor(Math.random() * options.length)];
    mask.grid[row][col] = encodeArrows([keep, add]);
    placed += 1;
  }
}

function maskToGridTemplate(
  mask: Mask,
  name: string,
  difficulty: Difficulty,
  _lockedCells: Array<{ row: number; col: number; type: string }> = [],
  cutoutCells: Array<{ row: number; col: number }> = []
): GridTemplate {
  const words = findAllWords(mask);
  const slots: ClueSlot[] = [];

  let slotIndex = 0;
  for (const word of words) {
    if (word.length < 3) {
      throw new Error(
        `Template has short word of length ${word.length} at (${word.definitionRow},${word.definitionCol}) type ${word.definitionType}`
      );
    }
    const direction = fieldTypeToDirection(word.definitionType);
    if (!direction) continue;
    slots.push({
      id: `slot_${slotIndex++}`,
      direction,
      startRow: word.definitionRow,
      startCol: word.definitionCol,
      length: word.length,
      crossings: [],
      cells: word.letters.map((l) => ({ row: l.row, col: l.col })),
    });
  }

  let remaining = slots;
  const boundaryCheck = validateSlotsBoundaries(remaining, mask.rows, mask.cols);
  if (!boundaryCheck.valid) {
    throw new Error(
      `Template boundary validation failed: ${(boundaryCheck.errors ?? []).join('; ')}`
    );
  }

  const cutoutSet = new Set(
    (cutoutCells ?? []).map((cell) => `${cell.row},${cell.col}`)
  );
  const letterCovered = new Set<string>();
  for (const slot of remaining) {
    for (const cell of slot.cells ?? []) letterCovered.add(`${cell.row},${cell.col}`);
  }
  for (let r = 0; r < mask.rows; r++) {
    for (let c = 0; c < mask.cols; c++) {
      const cellType = mask.grid[r][c];
      const key = `${r},${c}`;
      if (cellType === '#' && !cutoutSet.has(key)) {
        throw new Error(`Template has empty blocked cell (${r},${c})`);
      }
      if (cellType === '0' && !letterCovered.has(key)) {
        throw new Error(`Template has uncovered letter cell (${r},${c})`);
      }
    }
  }

  rebuildSlotCrossings(remaining);

  return {
    id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    rows: mask.rows,
    cols: mask.cols,
    slots: remaining,
    clueCells: remaining.map((slot) => ({
      row: slot.startRow,
      col: slot.startCol,
      direction: slot.direction,
    })),
    difficulty,
    categories: ['Generated'],
  };
}

// ============================================================================
// Main Generator Function
// ============================================================================

export interface GenerateTemplateOptions {
  rows: number;
  cols: number;
  difficulty?: Difficulty;
  name?: string;
  cutoutCells?: Array<{ row: number; col: number }>;
  lockedCells?: Array<{ row: number; col: number; type: '0' | '1' | '2' | '3' | '4' | '5' | '6' }>;
  protectedCells?: Array<{ row: number; col: number; type: '0' | '1' | '2' | '3' | '4' | '5' | '6' }>;
  // Optional algorithm parameters (defaults from thesis)
  populationSize?: number;        // n, default 15
  weakBreakCondition?: number;    // bw, default 2000
  strongBreakCondition?: number;  // bs, default 10000
  similarityThreshold?: number;   // δ, default 0.1
  minPopulation?: number;         // floor for n to avoid collapse, default 5
  maxIterations?: number;         // cap iterations, default 100
  quiet?: boolean;               // suppress per-iteration logs
  crossoverSamples?: number;
  /** Slot lengths above this are treated as unfillable (penalty 5000). */
  maxSlotLength?: number;
  /** Allow more uncovered/blocked cells so a smaller word pool can fill the grid. */
  sparse?: boolean;
  /** How many times to rerun the GA if the mask fails boundary checks. */
  maxBoundaryRetries?: number;
  simpleArrows?: boolean;
  /** Use a fixed →↓ lattice instead of the memetic algorithm. */
  lattice?: boolean;
  /** Newspaper lattice for 13–15 image boards (faster + more fillable). */
  newspaper?: boolean;
}

/**
 * Generate an arrow crossword template using the memetic algorithm
 * from Jakob Engel's thesis
 */
export function generateTemplate(options: GenerateTemplateOptions): GridTemplate {
  const {
    rows,
    cols,
    difficulty = Difficulty.MEDIUM,
    name = `Arrow Crossword ${rows}x${cols}`,
    cutoutCells = [],
    lockedCells = [],
    protectedCells = [],
    populationSize = 15,
    weakBreakCondition = 2000,
    strongBreakCondition = 10000,
    similarityThreshold = 0.1,
    minPopulation = 5,
    maxIterations: maxIterationsOpt,
    quiet = false,
    maxSlotLength,
    sparse = false,
    maxBoundaryRetries = 3,
    simpleArrows = false,
    lattice = false,
    newspaper = false,
    crossoverSamples,
  } = options;

  // Larger grids need more memetic iterations to converge; default scales with cell count
  const cells = rows * cols;
  const maxIterations = maxIterationsOpt ?? (cells > 144 ? Math.min(200, 80 + Math.ceil(cells / 20)) : 100);

  // Do not scale break conditions up for large grids here — callers pass
  // explicit budgets. Scaling them made 10x10 seeds take minutes.
  const config: GeneratorConfig = {
    rows,
    cols,
    populationSize,
    weakBreakCondition,
    strongBreakCondition,
    similarityThreshold,
    minPopulation,
    maxIterations,
    quiet,
    cutoutCells,
    lockedCells,
    protectedCells,
    simpleArrows,
    maxSlotLength,
    crossoverSamples,
    weights: {
      ...DEFAULT_CONFIG.weights!,
      wordLength: { ...DEFAULT_CONFIG.weights!.wordLength },
    },
  };

  // Adjust word length penalties based on difficulty
  if (difficulty === 'easy') {
    // Prefer 3-10 letters so 10x10 boards can use long answers already in the pool.
    config.weights.wordLength = {
      ...config.weights.wordLength,
      2: 1800, 3: 50, 4: 0, 5: 0, 6: 20, 7: 100,
      8: 50, 9: 150, 10: 250,
      11: 5000, 12: 5000, 13: 5000, 14: 5000, 15: 5000
    };
  } else if (difficulty === 'medium') {
    config.weights.wordLength = {
      ...config.weights.wordLength,
      2: 1800, 9: 150, 10: 250, 11: 5000, 12: 5000, 13: 5000, 14: 5000, 15: 5000
    };
  } else if (difficulty === 'hard' || difficulty === 'expert') {
    config.weights.wordLength = {
      ...config.weights.wordLength,
      2: 1800, 3: 200, 4: 100, 5: 0, 6: 0, 7: 0, 8: 0, 9: 100
    };
  }

  if (maxSlotLength !== undefined) {
    const capped: Record<number, number> = { ...config.weights.wordLength };
    for (let len = maxSlotLength + 1; len <= 15; len++) {
      capped[len] = 5000;
    }
    config.weights.wordLength = capped;
  }

  if (simpleArrows) {
    config.weights.uncoveredField = 4000;
    config.weights.wordLength = {
      ...config.weights.wordLength,
      3: 220,
      4: 40,
      5: 0,
      6: 0,
      7: 0,
      8: 20,
      9: 80,
      10: 400,
      11: 800,
    };
  }

  if (sparse) {
    // Smaller dictionaries cannot fill a fully covered arrow grid; allow
    // blocked cells instead of forcing every letter field to be used.
    config.weights.uncoveredField = 700;
    config.weights.singleCoveredEnclosed = 40;
    config.weights.singleCoveredOpen = 100;
  } else {
    // Crossing-first: pay more for letters that sit in only one word.
    config.weights.uncoveredField = 2800;
    config.weights.singleCoveredEnclosed = 200;
    config.weights.singleCoveredOpen = 450;
  }

  if (newspaper && rows >= 13 && cols >= 13 && rows <= 15 && cols <= 15) {
    let lastError: unknown;
    for (let attempt = 0; attempt < maxBoundaryRetries; attempt++) {
      try {
        const mask = createEmptyMask(rows, cols);
        paintNewspaperMask(mask);
        applyFixedCells(mask, config);
        const plainPacked = repairPackedMask(mask, config);
        try {
          const bentMask = cloneMask(plainPacked);
          sprinkleBentArrows(bentMask, Math.max(3, Math.floor((rows * cols) / 55)));
          applyFixedCells(bentMask, config);
          const bentPacked = repairPackedMask(bentMask, config);
          return maskToGridTemplate(bentPacked, name, difficulty, lockedCells, cutoutCells);
        } catch {
          // Bent sprinkle sometimes leaves holes around image cutouts — use →↓ lattice.
          return maskToGridTemplate(plainPacked, name, difficulty, lockedCells, cutoutCells);
        }
      } catch (e) {
        lastError = e;
        if (!quiet) {
          const message = e instanceof Error ? e.message : String(e);
          console.warn(`Newspaper template retry ${attempt + 1}/${maxBoundaryRetries}: ${message}`);
        }
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('Newspaper template failed after retries');
  }

  if (lattice && rows === 16 && cols === 16) {
    const mask = createEmptyMask(rows, cols);
    paintLatticeMask(mask);
    applyFixedCells(mask, config);
    return maskToGridTemplate(mask, name, difficulty, lockedCells, cutoutCells);
  }

  for (let attempt = 0; attempt < maxBoundaryRetries; attempt++) {
    const bestMask = memeticAlgorithm(config);
    const packed = repairPackedMask(bestMask, config);
    try {
      return maskToGridTemplate(packed, name, difficulty, lockedCells, cutoutCells);
    } catch (e) {
      const retryable =
        e instanceof Error &&
        (e.message.startsWith('Template boundary validation failed') ||
          e.message.includes('uncovered letter') ||
          e.message.includes('short word') ||
          e.message.includes('empty blocked'));
      if (retryable && attempt < maxBoundaryRetries - 1) {
        if (!quiet) {
          console.warn(
            `Template retry ${attempt + 1}/${maxBoundaryRetries}: ${e.message}`
          );
        }
        continue;
      }
      throw e;
    }
  }
  throw new Error('Template boundary validation failed after retries');
}

/**
 * Print mask to console for debugging
 */
function cellGlyph(cell: CellValue): string {
  const arrows = arrowTypesIn(cell);
  if (cell === '#') return '█';
  if (arrows.length === 0) return '·';
  const map: Record<ArrowType, string> = {
    '1': '→',
    '2': '↓',
    '3': '↘',
    '4': '↙',
    '5': '⤵',
    '6': '⤴',
  };
  return arrows.map((arrow) => map[arrow]).join('');
}

function printMask(mask: Mask): void {
  console.log(`Fitness: ${mask.fitness} (validity: ${mask.validityPenalty}, quality: ${mask.qualityPenalty})`);
  for (let r = 0; r < mask.rows; r++) {
    let row = '';
    for (let c = 0; c < mask.cols; c++) {
      row += cellGlyph(mask.grid[r][c]).padEnd(2);
    }
    console.log(row);
  }
}

export default generateTemplate;