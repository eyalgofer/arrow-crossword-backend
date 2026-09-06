import { Direction, Difficulty, GridTemplate, ClueSlot } from '../core/types';
import { validateSlotsBoundaries } from './validation-utils';

/**
 * Arrow Crossword Template Generator
 * Based on Jakob Engel’s BSc thesis “Generating Swedish-style Crossword Puzzle Masks
 * using Evolutionary Algorithms” (2009).
 * Reference: https://jakobengel.github.io/pdf/JakobEngelBsc.pdf
 *
 * Swedish arrow crosswords (arrowords): clue-in-cell, arrows show direction (→↓↘↙⤵⤴),
 * high letter intersection. Six definition types (Figure 2.2) map to across, down,
 * right-down, left-down, down-across, up-across. Memetic algorithm (Ch. 4) with
 * fitness from coverage, word length, clustering, dead ends (Ch. 3.2).
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
 * Per thesis: Types 1, 5, 6 define HORIZONTAL words
 *            Types 2, 3, 4 define VERTICAL words
 */
type FieldType = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '#';

interface Mask {
  rows: number;
  cols: number;
  grid: FieldType[][];
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
  minPopulation?: number;       // floor so n never drops below this (avoids collapse)
  maxIterations?: number;      // cap iterations (default 100)
  quiet?: boolean;             // suppress per-iteration logs when true
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

/**
 * Check if field type is a definition field
 */
function isDefinitionField(fieldType: FieldType): boolean {
  return ['1', '2', '3', '4', '5', '6'].includes(fieldType);
}

/**
 * Check if field type is a letter field
 */
function isLetterField(fieldType: FieldType): boolean {
  return fieldType === '0';
}

/**
 * Check if field type is blocked (non-letter)
 */
function isBlockedField(fieldType: FieldType): boolean {
  return fieldType !== '0';
}

// ============================================================================
// Mask Operations
// ============================================================================

function createEmptyMask(rows: number, cols: number): Mask {
  const grid: FieldType[][] = [];
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

function getField(mask: Mask, row: number, col: number): FieldType | null {
  if (!isValidCoord(mask, row, col)) return null;
  return mask.grid[row][col];
}

function setField(mask: Mask, row: number, col: number, fieldType: FieldType): void {
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

/** Re-apply cutouts and locked definition cells after create/mutate/crossover. */
function applyFixedCells(mask: Mask, config: GeneratorConfig): void {
  if (config.cutoutCells) {
    for (const { row, col } of config.cutoutCells) {
      setField(mask, row, col, '#');
    }
  }
  if (config.lockedCells) {
    for (const { row, col, type } of config.lockedCells) {
      setField(mask, row, col, type);
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
      const fieldType = mask.grid[r][c];
      if (!isDefinitionField(fieldType)) continue;

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
function getAllowedFieldTypes(mask: Mask, row: number, col: number): FieldType[] {
  const allowed: FieldType[] = ['0']; // Letter field always allowed

  // Don't allow definition fields that would point outside grid or create impossible words
  // Per thesis Figure 2.2: 1→, 2↓, 3↘, 4↙, 5⤵, 6⤴
  // Type 1: needs at least 2 cells to the right
  if (col < mask.cols - 2) allowed.push('1');
  // Type 2: needs at least 2 cells below
  if (row < mask.rows - 2) allowed.push('2');
  // Type 3 (right-down): vertical, start in cell (r,c+1) right of clue, go down; need ≥2 cells
  if (col < mask.cols - 1 && row < mask.rows - 1) allowed.push('3');
  // Type 4 (left-down): vertical, start in cell (r,c-1) left of clue, go down; need ≥2 cells
  if (col >= 1 && row < mask.rows - 1) allowed.push('4');
  // Type 5 (down-across): start (r+1,c), go right; need space below and right
  if (row < mask.rows - 1 && col < mask.cols - 2) allowed.push('5');
  // Type 6 (up-across): start (r-1,c), go right; need space above and right
  if (row >= 1 && col < mask.cols - 2) allowed.push('6');

  // Per thesis Figure 3.6: Avoid certain configurations that cause violations
  // Check for adjacent definition fields that would cause problems
  const above = getField(mask, row - 1, col);
  const left = getField(mask, row, col - 1);
  const right = getField(mask, row, col + 1);
  const below = getField(mask, row + 1, col);

  // Remove types that would conflict with existing arrows
  // If cell above is type 2 pointing down, we shouldn't start a horizontal word here
  if (above === '2' || above === '3' || above === '4') {
    // These would create overlapping words - remove horizontal types that start here
  }

  // If cell to left is type 1 pointing right, we shouldn't start a vertical word here
  if (left === '1' || left === '5' || left === '6') {
    // These would create overlapping words - remove vertical types that start here  
  }

  return allowed;
}

/**
 * Initialize border fields for Swedish-style layout
 * Per thesis Chapter 3.3 and Figure 3.7
 */
function initializeBorders(mask: Mask): void {
  // Top row: typically has definition fields pointing down
  for (let c = 0; c < mask.cols; c++) {
    if (mask.grid[0][c] === '#') continue; // Skip cutouts
    
    // Randomly place down-pointing definition fields
    if (Math.random() < 0.3 && c > 0) {
      const allowed = getAllowedFieldTypes(mask, 0, c);
      if (allowed.includes('2')) {
        mask.grid[0][c] = '2';
      }
    }
  }

  // Left column: typically has definition fields pointing right
  for (let r = 0; r < mask.rows; r++) {
    if (mask.grid[r][0] === '#') continue; // Skip cutouts
    
    // Randomly place right-pointing definition fields
    if (Math.random() < 0.3 && r > 0) {
      const allowed = getAllowedFieldTypes(mask, r, 0);
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
  initializeBorders(mask);
  applyFixedCells(mask, config);

  // Rest starts as letter fields (per thesis)
  // The hillclimber will find good positions for definition fields

  return mask;
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
    const allowed = getAllowedFieldTypes(mutated, targetRow, targetCol);
    const current = mutated.grid[targetRow][targetCol];
    const options = allowed.filter(t => t !== current);

    if (options.length > 0) {
      // Per thesis Chapter 3.4: "Field Type Probabilities"
      // "a letter field is chosen with probability 2/3"
      // "type 1 and 2 each get a probability of 1/12"
      // "type 3, 4, 5 and 6 each 1/24"
      
      const rand = Math.random();
      let newType: FieldType;
      
      if (rand < 2/3 && options.includes('0')) {
        newType = '0';
      } else {
        // Choose from definition field types with appropriate weights
        const defOptions = options.filter(t => t !== '0');
        if (defOptions.length === 0) {
          newType = options[Math.floor(Math.random() * options.length)];
        } else {
          // Weight type 1,2 higher than 3,4,5,6
          const weighted: FieldType[] = [];
          for (const t of defOptions) {
            if (t === '1' || t === '2') {
              weighted.push(t, t); // Double weight for types 1,2
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

        for (let k = 0; k < 50; k++) {
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
    const validityOk = hasCutouts ? bestValidity <= 2000 : bestValidity === 0;
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
function maskToGridTemplate(mask: Mask, name: string, difficulty: Difficulty): GridTemplate {
  const words = findAllWords(mask);
  const slots: ClueSlot[] = [];
  const clueCells: Array<{ row: number; col: number; direction: Direction }> = [];

  // Create slots from words with length >= 3
  let slotIndex = 0;
  for (const word of words) {
    if (word.length < 3) continue;

    const direction = fieldTypeToDirection(word.definitionType);
    if (!direction) continue;

    const slotId = `slot_${slotIndex++}`;
    // startRow/startCol = clue cell; cells = actual letter positions (Engel types 3,4,6 differ from direction-utils)
    const slot: ClueSlot = {
      id: slotId,
      direction,
      startRow: word.definitionRow,
      startCol: word.definitionCol,
      length: word.length,
      crossings: [],
      cells: word.letters.map((l) => ({ row: l.row, col: l.col }))
    };

    slots.push(slot);

    clueCells.push({
      row: word.definitionRow,
      col: word.definitionCol,
      direction
    });
  }

  // Calculate crossings
  const letterToSlots = new Map<string, Array<{ slotId: string; position: number }>>();

  for (const slot of slots) {
    const word = words.find(w =>
      w.definitionRow === slot.startRow &&
      w.definitionCol === slot.startCol &&
      fieldTypeToDirection(w.definitionType) === slot.direction &&
      w.length === slot.length
    );

    if (word) {
      for (let pos = 0; pos < word.letters.length; pos++) {
        const letter = word.letters[pos];
        const key = `${letter.row},${letter.col}`;

        if (!letterToSlots.has(key)) {
          letterToSlots.set(key, []);
        }
        letterToSlots.get(key)!.push({ slotId: slot.id, position: pos });
      }
    }
  }

  // Add crossing info to slots
  for (const [, slotInfos] of letterToSlots) {
    if (slotInfos.length >= 2) {
      for (let i = 0; i < slotInfos.length; i++) {
        for (let j = i + 1; j < slotInfos.length; j++) {
          const slot1 = slots.find(s => s.id === slotInfos[i].slotId);
          const slot2 = slots.find(s => s.id === slotInfos[j].slotId);

          if (slot1 && slot2) {
            slot1.crossings.push({
              slotId: slot2.id,
              thisPosition: slotInfos[i].position,
              otherPosition: slotInfos[j].position
            });

            slot2.crossings.push({
              slotId: slot1.id,
              thisPosition: slotInfos[j].position,
              otherPosition: slotInfos[i].position
            });
          }
        }
      }
    }
  }

  const boundaryCheck = validateSlotsBoundaries(slots, mask.rows, mask.cols);
  if (!boundaryCheck.valid) {
    throw new Error(`Template boundary validation failed: ${(boundaryCheck.errors ?? []).join('; ')}`);
  }

  return {
    id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    rows: mask.rows,
    cols: mask.cols,
    slots,
    clueCells,
    difficulty,
    categories: ['Generated']
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
  // Optional algorithm parameters (defaults from thesis)
  populationSize?: number;        // n, default 15
  weakBreakCondition?: number;    // bw, default 2000
  strongBreakCondition?: number;  // bs, default 10000
  similarityThreshold?: number;   // δ, default 0.1
  minPopulation?: number;         // floor for n to avoid collapse, default 5
  maxIterations?: number;         // cap iterations, default 100
  quiet?: boolean;               // suppress per-iteration logs
  /** Slot lengths above this are treated as unfillable (penalty 5000). */
  maxSlotLength?: number;
  /** Allow more uncovered/blocked cells so a smaller word pool can fill the grid. */
  sparse?: boolean;
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
    populationSize = 15,
    weakBreakCondition = 2000,
    strongBreakCondition = 10000,
    similarityThreshold = 0.1,
    minPopulation = 5,
    maxIterations: maxIterationsOpt,
    quiet = false,
    maxSlotLength,
    sparse = false
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
    weights: DEFAULT_CONFIG.weights!
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

  if (sparse) {
    // Smaller dictionaries cannot fill a fully covered arrow grid; allow
    // blocked cells instead of forcing every letter field to be used.
    config.weights.uncoveredField = 700;
    config.weights.singleCoveredEnclosed = 40;
    config.weights.singleCoveredOpen = 100;
  }

  const maxBoundaryRetries = 3;
  for (let attempt = 0; attempt < maxBoundaryRetries; attempt++) {
    const bestMask = memeticAlgorithm(config);
    try {
      return maskToGridTemplate(bestMask, name, difficulty);
    } catch (e) {
      const isBoundaryError = e instanceof Error && e.message.startsWith('Template boundary validation failed');
      if (isBoundaryError && attempt < maxBoundaryRetries - 1) {
        if (!quiet) {
          console.warn(`Template boundary validation failed (attempt ${attempt + 1}/${maxBoundaryRetries}), retrying...`);
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
function printMask(mask: Mask): void {
  const symbols: Record<FieldType, string> = {
    '0': '·',
    '1': '→',
    '2': '↓',
    '3': '↘',
    '4': '↙',
    '5': '⤵',
    '6': '⤴',
    '#': '█'
  };

  console.log(`Fitness: ${mask.fitness} (validity: ${mask.validityPenalty}, quality: ${mask.qualityPenalty})`);
  for (let r = 0; r < mask.rows; r++) {
    let row = '';
    for (let c = 0; c < mask.cols; c++) {
      row += symbols[mask.grid[r][c]] + ' ';
    }
    console.log(row);
  }
}

export default generateTemplate;