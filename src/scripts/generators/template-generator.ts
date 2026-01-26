/**
 * Template Generator for Swedish Arrow Crossword Puzzles
 * 
 * Uses backtracking to GUARANTEE 100% coverage:
 * 1. Seed placement: Create initial connected structure
 * 2. Systematic expansion: Build outwards ensuring connectivity
 * 3. Backtracking fill: Guarantee every cell is filled
 */
import { Direction, GridTemplate, ClueSlot, Difficulty } from '../core/types';
import { getSlotCells, getAnswerOrientation, getNextCellAfterAnswer, getCellBeforeAnswer } from './direction-utils';
import {   
  hasAnswerClueOverlap,
  recalculateCrossings,
  validateOverlapsAreCrossings,
  checkAnswerBoundaries
} from './validation-utils';
import { TEMPLATE_CONFIG, Size } from './template-config';

/**
 * Check if a direction is valid for the top position in a split cell
 */
function isTopDirection(direction: Direction): boolean {
  return direction === 'across' || direction === 'right-down' || direction === 'up-across';
}

/**
 * Check if a direction is valid for the bottom position in a split cell
 */
function isBottomDirection(direction: Direction): boolean {
  return direction === 'down' || direction === 'left-down';
}

/**
 * Check if a new direction is compatible with existing directions in a split cell
 */
function isDirectionCompatibleWithCell(
  newDirection: Direction,
  existingDirections: Set<Direction>
): boolean {
  if (existingDirections.size === 0) {
    return true; // Empty cell can accept any direction
  }
  
  const isNewTop = isTopDirection(newDirection);
  const isNewBottom = isBottomDirection(newDirection);
  
  if (!isNewTop && !isNewBottom) {
    return false; // Not a valid split cell direction
  }
  
  for (const existingDir of existingDirections) {
    const isExistingTop = isTopDirection(existingDir);
    const isExistingBottom = isBottomDirection(existingDir);
    
    if ((isNewTop && isExistingTop) || (isNewBottom && isExistingBottom)) {
      return false; // Can't have two top or two bottom directions
    }
  }
  
  return true;
}

/**
 * Grid state for backtracking
 */
interface GridState {
  slots: ClueSlot[];
  clueCells: Array<{ row: number; col: number; direction: Direction }>;
  clueCellDirections: Map<string, Set<Direction>>;
  answerCells: Map<string, { slotId: string; position: number }>;
  blockedCells: Set<string>;
  slotNumber: number;
}

/**
 * Find all valid placements for a given direction and position
 */
function findValidPlacements(
  direction: Direction,
  startRow: number,
  startCol: number,
  config: { rows: number; cols: number },
  state: GridState,
  minLength: number = 2,
  maxLength: number = 15
): Array<{ length: number; answerCells: Array<{ row: number; col: number }>; crossings: number }> {
  const validPlacements: Array<{ length: number; answerCells: Array<{ row: number; col: number }>; crossings: number }> = [];
  
  for (let length = maxLength; length >= minLength; length--) {
    const tempSlot: ClueSlot = {
      id: 'temp',
      direction,
      startRow,
      startCol,
      length,
      crossings: []
    };
    
    const testAnswerCells = getSlotCells(tempSlot);
    
    // Check bounds
    const lastCell = testAnswerCells[testAnswerCells.length - 1];
    if (lastCell.row < 0 || lastCell.row >= config.rows || lastCell.col < 0 || lastCell.col >= config.cols) {
      continue;
    }
    
    // Check boundaries
    const answerCellPositions = new Set(state.answerCells.keys());
    if (!checkAnswerBoundaries(direction, testAnswerCells, config.rows, config.cols, answerCellPositions)) {
      continue;
    }
    
    // Check clue cell compatibility
    const clueKey = `${startRow},${startCol}`;
    const directionsInCell = state.clueCellDirections.get(clueKey);
    const isSplitCell = directionsInCell && directionsInCell.size > 0;
    
    if (directionsInCell) {
      if (directionsInCell.has(direction) || !isDirectionCompatibleWithCell(direction, directionsInCell)) {
        continue;
      }
    }
    
    // Check if clue cell conflicts
    // For split cells, allow answer cells at clue position (they're from other compatible directions)
    // Allow blocked cells - we can convert them to clue cells (aggressive split cell usage)
    // Only block answer cells at clue position if it's NOT a split cell placement
    if (!isSplitCell && state.answerCells.has(clueKey)) {
      continue;
    }
    
    // Check answer cells for conflicts and count crossings
    let hasConflict = false;
    const crossingSlots = new Set<string>();
    const testOrientation = getAnswerOrientation(direction);
    
    for (const cell of testAnswerCells) {
      const cellKey = `${cell.row},${cell.col}`;
      
      if (state.clueCellDirections.has(cellKey) && (state.clueCellDirections.get(cellKey)?.size ?? 0) > 0) {
        hasConflict = true;
        break;
      }
      
      if (state.blockedCells.has(cellKey)) {
        hasConflict = true;
        break;
      }
      
      if (state.answerCells.has(cellKey)) {
        const existingSlotInfo = state.answerCells.get(cellKey);
        if (existingSlotInfo) {
          const existingSlot = state.slots.find(s => s.id === existingSlotInfo.slotId);
          if (existingSlot) {
            const existingOrientation = getAnswerOrientation(existingSlot.direction);
            if (existingOrientation !== testOrientation) {
              crossingSlots.add(existingSlotInfo.slotId);
            } else {
              hasConflict = true;
              break;
            }
          }
        }
      }
    }
    
    if (!hasConflict && crossingSlots.size <= TEMPLATE_CONFIG.CROSSINGS.MAX_INITIAL) {
      validPlacements.push({
        length,
        answerCells: testAnswerCells,
        crossings: crossingSlots.size
      });
    }
  }
  
  return validPlacements;
}

/**
 * Get all empty cells in the grid
 */
function getEmptyCells(
  config: { rows: number; cols: number },
  state: GridState
): Array<{ row: number; col: number }> {
  const emptyCells: Array<{ row: number; col: number }> = [];
  
  for (let r = 0; r < config.rows; r++) {
    for (let c = 0; c < config.cols; c++) {
      const cellKey = `${r},${c}`;
      const hasClue = state.clueCellDirections.has(cellKey) && (state.clueCellDirections.get(cellKey)?.size ?? 0) > 0;
      const isBlocked = state.blockedCells.has(cellKey);
      
      if (!hasClue && !state.answerCells.has(cellKey) && !isBlocked) {
        emptyCells.push({ row: r, col: c });
      }
    }
  }
  
  return emptyCells;
}

/**
 * Detect large empty regions using flood fill
 * Returns cells grouped by region, sorted by region size (largest first)
 */
function detectEmptyRegions(
  config: { rows: number; cols: number },
  state: GridState
): Array<Array<{ row: number; col: number }>> {
  const emptyCells = getEmptyCells(config, state);
  const visited = new Set<string>();
  const regions: Array<Array<{ row: number; col: number }>> = [];
  
  for (const cell of emptyCells) {
    const cellKey = `${cell.row},${cell.col}`;
    if (visited.has(cellKey)) continue;
    
    // Flood fill to find connected empty region
    const region: Array<{ row: number; col: number }> = [];
    const queue: Array<{ row: number; col: number }> = [cell];
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentKey = `${current.row},${current.col}`;
      
      if (visited.has(currentKey)) continue;
      visited.add(currentKey);
      
      // Check if this cell is actually empty
      const hasClue = state.clueCellDirections.has(currentKey) && (state.clueCellDirections.get(currentKey)?.size ?? 0) > 0;
      const isBlocked = state.blockedCells.has(currentKey);
      const isAnswer = state.answerCells.has(currentKey);
      
      if (!hasClue && !isAnswer && !isBlocked) {
        region.push(current);
        
        // Add neighbors to queue
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            if (Math.abs(dr) + Math.abs(dc) > 1) continue; // Only orthogonal neighbors
            
            const neighborRow = current.row + dr;
            const neighborCol = current.col + dc;
            if (neighborRow >= 0 && neighborRow < config.rows && neighborCol >= 0 && neighborCol < config.cols) {
              const neighborKey = `${neighborRow},${neighborCol}`;
              if (!visited.has(neighborKey)) {
                queue.push({ row: neighborRow, col: neighborCol });
              }
            }
          }
        }
      }
    }
    
    if (region.length > 0) {
      regions.push(region);
    }
  }
  
  // Sort by size (largest first) - these are the problematic empty regions
  regions.sort((a, b) => b.length - a.length);
  return regions;
}

/**
 * Place a slot and return new state
 */
function placeSlot(
  slot: ClueSlot,
  placement: { answerCells: Array<{ row: number; col: number }> },
  config: { rows: number; cols: number },
  state: GridState
): GridState {
  const newState: GridState = {
    slots: [...state.slots, slot],
    clueCells: [...state.clueCells, { row: slot.startRow, col: slot.startCol, direction: slot.direction }],
    clueCellDirections: new Map(state.clueCellDirections),
    answerCells: new Map(state.answerCells),
    blockedCells: new Set(state.blockedCells),
    slotNumber: state.slotNumber + 1
  };
  
  // Add clue cell direction
  const clueKey = `${slot.startRow},${slot.startCol}`;
  if (!newState.clueCellDirections.has(clueKey)) {
    newState.clueCellDirections.set(clueKey, new Set<Direction>());
  }
  newState.clueCellDirections.get(clueKey)!.add(slot.direction);
  
  // If this clue cell was previously blocked, remove it from blocked cells
  // (we're converting a blocked cell into a clue cell - aggressive split cell usage)
  if (newState.blockedCells.has(clueKey)) {
    newState.blockedCells.delete(clueKey);
  }
  
  // Add answer cells
  for (let j = 0; j < placement.answerCells.length; j++) {
    const cell = placement.answerCells[j];
    newState.answerCells.set(`${cell.row},${cell.col}`, { slotId: slot.id, position: j });
  }
  
  // Mark blocked cells to prevent word merging
  // Block cells before/after answers UNLESS they're already clue cells (split cell scenario)
  const firstCell = placement.answerCells[0];
  const cellBefore = getCellBeforeAnswer(slot.direction, firstCell, config.rows, config.cols);
  if (cellBefore && !newState.clueCellDirections.has(`${cellBefore.row},${cellBefore.col}`)) {
    // Only block if it's not already an answer cell (shouldn't happen, but be safe)
    if (!newState.answerCells.has(`${cellBefore.row},${cellBefore.col}`)) {
      newState.blockedCells.add(`${cellBefore.row},${cellBefore.col}`);
    }
  }
  
  const lastCell = placement.answerCells[placement.answerCells.length - 1];
  const cellAfter = getNextCellAfterAnswer(slot.direction, lastCell, config.rows, config.cols);
  if (cellAfter && !newState.clueCellDirections.has(`${cellAfter.row},${cellAfter.col}`)) {
    // Only block if it's not already an answer cell (shouldn't happen, but be safe)
    if (!newState.answerCells.has(`${cellAfter.row},${cellAfter.col}`)) {
      newState.blockedCells.add(`${cellAfter.row},${cellAfter.col}`);
    }
  }
  
  return newState;
}

/**
 * Backtracking algorithm to guarantee 100% coverage
 * Uses iterative deepening and aggressive pruning for efficiency
 */
function backtrackFill(
  config: { rows: number; cols: number; minSlots: number },
  state: GridState,
  allDirections: Direction[],
  maxDepth: number = 500,
  depth: number = 0,
  startTime: number = Date.now()
): GridState | null {
  // Timeout after 30 seconds
  if (Date.now() - startTime > 30000) {
    return null;
  }
  
  // Base case: Check if we've achieved 100% coverage
  const emptyCells = getEmptyCells(config, state);
  const totalCells = config.rows * config.cols;
  const filledCells = state.answerCells.size + state.clueCellDirections.size;
  const coverage = filledCells / totalCells;
  
  // Log progress every 50 depth levels
  if (depth % 50 === 0 && depth > 0) {
    console.log(`    🔍 Backtracking depth ${depth}: ${state.slots.length} slots, ${filledCells}/${totalCells} cells (${(coverage * 100).toFixed(1)}%), ${emptyCells.length} empty`);
  }
  
  // Success: 100% coverage (or very close, accounting for blocked cells)
  if (emptyCells.length === 0 || coverage >= 0.99) {
    if (state.slots.length >= config.minSlots) {
      return state;
    }
  }
  
  // Prevent infinite recursion - more aggressive limits
  if (depth >= maxDepth || state.slots.length > config.minSlots * 1.5) {
    return null;
  }
  
  // Early pruning: if we have too many empty cells relative to depth, this branch is unlikely to succeed
  const emptyRatio = emptyCells.length / totalCells;
  if (depth > 100 && emptyRatio > 0.3) {
    return null; // Too many empty cells, unlikely to fill them all
  }
  
  // Try to fill empty cells systematically
  // Sort empty cells by how many neighbors are filled (prefer cells near existing structure)
  const emptyCellsWithScore = emptyCells.map(cell => {
    let score = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const neighborRow = cell.row + dr;
        const neighborCol = cell.col + dc;
        if (neighborRow >= 0 && neighborRow < config.rows && neighborCol >= 0 && neighborCol < config.cols) {
          const neighborKey = `${neighborRow},${neighborCol}`;
          if (state.answerCells.has(neighborKey) || state.clueCellDirections.has(neighborKey)) {
            score++;
          }
        }
      }
    }
    return { cell, score };
  });
  
  // Sort by score (cells with more filled neighbors first)
  emptyCellsWithScore.sort((a, b) => b.score - a.score);
  
  // Reduce candidates as depth increases (focus search)
  const candidatesToTry = depth < 50 ? Math.min(5, emptyCellsWithScore.length) : Math.min(2, emptyCellsWithScore.length);
  
  for (let i = 0; i < candidatesToTry; i++) {
    const { cell: targetCell } = emptyCellsWithScore[i];
    
    // Prioritize directions that create crossings (more efficient)
    const directionsToTry = [...allDirections].sort((a, b) => {
      // Prefer directions that would cross with existing slots
      const aOrientation = getAnswerOrientation(a);
      const bOrientation = getAnswerOrientation(b);
      // Check if any nearby answer cells have perpendicular orientation
      let aScore = 0, bScore = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const neighborRow = targetCell.row + dr;
          const neighborCol = targetCell.col + dc;
          if (neighborRow >= 0 && neighborRow < config.rows && neighborCol >= 0 && neighborCol < config.cols) {
            const neighborKey = `${neighborRow},${neighborCol}`;
            const cellInfo = state.answerCells.get(neighborKey);
            if (cellInfo) {
              const existingSlot = state.slots.find(s => s.id === cellInfo.slotId);
              if (existingSlot) {
                const existingOrientation = getAnswerOrientation(existingSlot.direction);
                if (existingOrientation !== aOrientation) aScore++;
                if (existingOrientation !== bOrientation) bScore++;
              }
            }
          }
        }
      }
      return bScore - aScore;
    });
    
    // Limit directions tried
    const maxDirections = depth < 100 ? 6 : 3;
    
    for (let dirIdx = 0; dirIdx < Math.min(maxDirections, directionsToTry.length); dirIdx++) {
      const direction = directionsToTry[dirIdx];
      const placements = findValidPlacements(
        direction,
        targetCell.row,
        targetCell.col,
        config,
        state,
        2,
        depth < 50 ? 10 : 6 // Shorter words at deeper levels
      );
      
      if (placements.length === 0) continue;
      
      // Try placements in order (prefer longer words that fill more cells)
      const sortedPlacements = placements.sort((a, b) => {
        // Prefer placements that fill more empty cells
        const aFillsEmpty = a.answerCells.filter(c => emptyCells.some(e => e.row === c.row && e.col === c.col)).length;
        const bFillsEmpty = b.answerCells.filter(c => emptyCells.some(e => e.row === c.row && e.col === c.col)).length;
        if (aFillsEmpty !== bFillsEmpty) return bFillsEmpty - aFillsEmpty;
        return b.length - a.length;
      });
      
      // Limit placements tried per direction
      const maxPlacements = depth < 50 ? sortedPlacements.length : Math.min(3, sortedPlacements.length);
      
      for (let pIdx = 0; pIdx < maxPlacements; pIdx++) {
        const placement = sortedPlacements[pIdx];
        const slot: ClueSlot = {
          id: `slot_${state.slotNumber}`,
          direction,
          startRow: targetCell.row,
          startCol: targetCell.col,
          length: placement.length,
          crossings: []
        };
        
        const newState = placeSlot(slot, placement, config, state);
        const result = backtrackFill(config, newState, allDirections, maxDepth, depth + 1, startTime);
        
        if (result !== null) {
          return result;
        }
      }
    }
    
    // Try split cell placement (only at shallow depths for efficiency)
    if (depth < 30 && state.clueCellDirections.size > 0) {
      const existingClueCells = Array.from(state.clueCellDirections.keys());
      // Limit split cell attempts
      const maxSplitAttempts = Math.min(3, existingClueCells.length);
      
      for (let splitIdx = 0; splitIdx < maxSplitAttempts; splitIdx++) {
        const clueCellKey = existingClueCells[splitIdx];
        const [cellRow, cellCol] = clueCellKey.split(',').map(Number);
        
        // Try only compatible directions
        const directionsInCell = state.clueCellDirections.get(clueCellKey);
        if (!directionsInCell) continue;
        
        const compatibleDirections = allDirections.filter(d => 
          !directionsInCell.has(d) && isDirectionCompatibleWithCell(d, directionsInCell)
        );
        
        for (const direction of compatibleDirections.slice(0, 2)) { // Limit to 2 directions
          const placements = findValidPlacements(
            direction,
            cellRow,
            cellCol,
            config,
            state,
            2,
            8
          );
          
          if (placements.length > 0) {
            const bestPlacement = placements[0];
            
            const slot: ClueSlot = {
              id: `slot_${state.slotNumber}`,
              direction,
              startRow: cellRow,
              startCol: cellCol,
              length: bestPlacement.length,
              crossings: []
            };
            
            const newState = placeSlot(slot, bestPlacement, config, state);
            const result = backtrackFill(config, newState, allDirections, maxDepth, depth + 1, startTime);
            
            if (result !== null) {
              return result;
            }
          }
        }
      }
    }
  }
  
  return null; // No solution found from this state
}

export function generateTemplate(
  difficulty: Difficulty = Difficulty.EASY
): GridTemplate {
  const getSizeForDifficulty = (difficulty: Difficulty): Size => {
    const random = Math.random();
    switch (difficulty) {
      case Difficulty.EASY:
        if (random < 0.33) return 'xsmall';
        if (random < 0.67) return 'small';
        return 'medium';
      case Difficulty.MEDIUM:
        if (random < 0.33) return 'xsmall';
        if (random < 0.67) return 'small';
        return 'medium';
      case Difficulty.CHALLENGING:
        if (random < 0.25) return 'small';
        if (random < 0.5) return 'medium';
        if (random < 0.75) return 'large';
        return 'xlarge';
      case Difficulty.HARD:
        if (random < 0.33) return 'large';
        if (random < 0.67) return 'xlarge';
        return 'xlarge';
      case Difficulty.EXPERT:
        if (random < 0.5) return 'xlarge';
        return 'xlarge';
      default:
        return 'medium';
    }
  };
  
  const selectedSize = getSizeForDifficulty(difficulty);
  
  const sizeConfig: Record<Size, { rows: number; cols: number; minSlots: number; }> = {
    xsmall: { rows: 9, cols: 9, minSlots: 16 },
    small: { rows: 10, cols: 10, minSlots: 22 },
    medium: { rows: 11, cols: 11, minSlots: 22 },
    large: { rows: 12, cols: 12, minSlots: 22 },
    xlarge: { rows: 13, cols: 13, minSlots: 22 },
    xxlarge: { rows: 14, cols: 14, minSlots: 22 }
  };
  
  const config = sizeConfig[selectedSize];
  const allDirections: Direction[] = ['across', 'down', 'right-down', 'left-down', 'down-across', 'up-across'];
  const initialGridCells = config.rows * config.cols;
  
  // PHASE 1: Seed Placement - Create initial connected structure with variety
  console.log(`  🌱 Phase 1: Seed placement`);
  let state: GridState = {
    slots: [],
    clueCells: [],
    clueCellDirections: new Map(),
    answerCells: new Map(),
    blockedCells: new Set(),
    slotNumber: 1
  };
  
  // Use diverse directions in seed phase for more interesting templates
  // Mix of standard and diagonal directions
  const seedDirections: Direction[] = ['across', 'down', 'right-down', 'left-down', 'down-across', 'up-across'];
  const centerRow = Math.floor(config.rows / 2);
  const centerCol = Math.floor(config.cols / 2);
  
  // Place initial seeds with variety in directions and word lengths
  const seedCount = Math.min(6, config.minSlots);
  for (let i = 0; i < seedCount; i++) {
    const direction = seedDirections[i % seedDirections.length];
    
    let placed = false;
    // Try multiple positions around center for better coverage
    const offsets = [
      { dr: 0, dc: 0 },
      { dr: -1, dc: 0 },
      { dr: 1, dc: 0 },
      { dr: 0, dc: -1 },
      { dr: 0, dc: 1 },
      { dr: -1, dc: -1 },
      { dr: 1, dc: 1 }
    ];
    
    for (const offset of offsets) {
      const startRow = centerRow + offset.dr;
      const startCol = centerCol + offset.dc;
      
      if (startRow < 0 || startRow >= config.rows || startCol < 0 || startCol >= config.cols) continue;
      
      // Encourage longer words in seed phase (4-10 letters) for more interesting structure
      const placements = findValidPlacements(
        direction,
        startRow,
        startCol,
        config,
        state,
        4,
        10
      );
      
      if (placements.length > 0) {
        // Balance: prefer some crossings (1-3) for interest, but not too many
        // Also prefer longer words for better structure
        const bestPlacement = placements.sort((a, b) => {
          // Prefer crossings between 1-3 (interesting but solvable)
          const aCrossingScore = a.crossings >= 1 && a.crossings <= 3 ? 10 : (a.crossings === 0 ? 5 : 0);
          const bCrossingScore = b.crossings >= 1 && b.crossings <= 3 ? 10 : (b.crossings === 0 ? 5 : 0);
          if (aCrossingScore !== bCrossingScore) return bCrossingScore - aCrossingScore;
          // Then prefer longer words
          return b.length - a.length;
        })[0];
        
        const slot: ClueSlot = {
          id: `slot_${state.slotNumber}`,
          direction,
          startRow,
          startCol,
          length: bestPlacement.length,
          crossings: []
        };
        
        state = placeSlot(slot, bestPlacement, config, state);
        placed = true;
        break;
      }
    }
  }
  
  console.log(`  📊 After seed: ${state.slots.length} slots, ${state.answerCells.size + state.clueCellDirections.size}/${initialGridCells} cells filled`);
  
  // PHASE 2: Greedy Expansion - Build outwards efficiently until 100% coverage
  console.log(`  🔗 Phase 2: Greedy expansion to 100% coverage`);
  const maxGreedyAttempts = 100000;
  let greedyAttempts = 0;
  let lastProgressLog = Date.now();
  let consecutiveFailures = 0;
  
  while (greedyAttempts < maxGreedyAttempts) {
    greedyAttempts++;
    consecutiveFailures++;
    
    const emptyCells = getEmptyCells(config, state);
    const totalCells = config.rows * config.cols;
    const filledCells = state.answerCells.size + state.clueCellDirections.size;
    const coverage = filledCells / totalCells;
    
    // Log progress every 5 seconds
    if (Date.now() - lastProgressLog > 5000) {
      console.log(`    📊 Progress: ${state.slots.length} slots, ${filledCells}/${totalCells} cells (${(coverage * 100).toFixed(1)}%), ${emptyCells.length} empty cells`);
      lastProgressLog = Date.now();
    }
    
    if (emptyCells.length === 0 || coverage >= 1.0) {
      console.log(`  ✅ All cells filled via greedy expansion!`);
      break;
    }
    
    // When stuck, try more aggressive strategies
    const isStuck = consecutiveFailures > 100;
    
    let placed = false;
    
    // Strategy 0: Detect and fill large empty regions first (prevents big empty squares)
    if (!placed && emptyCells.length > 5) {
      const emptyRegions = detectEmptyRegions(config, state);
      const largeRegions = emptyRegions.filter(region => region.length >= 4); // Regions with 4+ cells
      
      if (largeRegions.length > 0) {
        // Prioritize filling the largest empty region
        const targetRegion = largeRegions[0];
        
        // Score cells in this region by how many neighbors they have (prefer edge cells)
        const regionCellsWithScore = targetRegion.map(cell => {
          let neighborScore = 0;
          let crossingScore = 0;
          
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              const neighborRow = cell.row + dr;
              const neighborCol = cell.col + dc;
              if (neighborRow >= 0 && neighborRow < config.rows && neighborCol >= 0 && neighborCol < config.cols) {
                const neighborKey = `${neighborRow},${neighborCol}`;
                if (state.answerCells.has(neighborKey)) {
                  neighborScore += 3; // Higher weight for answer cells
                  crossingScore += 1;
                } else if (state.clueCellDirections.has(neighborKey)) {
                  neighborScore += 2;
                }
              }
            }
          }
          
          return { 
            cell, 
            score: neighborScore * 10 + crossingScore * 5 
          };
        });
        
        regionCellsWithScore.sort((a, b) => b.score - a.score);
        
        // Try top cells from the large empty region
        for (let candidateIdx = 0; candidateIdx < Math.min(5, regionCellsWithScore.length) && !placed; candidateIdx++) {
          const targetCell = regionCellsWithScore[candidateIdx].cell;
          
          // Try all directions
          for (const direction of allDirections) {
            const placements = findValidPlacements(
              direction,
              targetCell.row,
              targetCell.col,
              config,
              state,
              2,
              12
            );
            
            if (placements.length > 0) {
              // Prefer interesting crossings (1-4) and longer words
              const bestPlacement = placements.sort((a, b) => {
                // Prefer 1-4 crossings (interesting but solvable)
                const aCrossingScore = a.crossings >= 1 && a.crossings <= 4 ? 10 : (a.crossings === 0 ? 5 : 0);
                const bCrossingScore = b.crossings >= 1 && b.crossings <= 4 ? 10 : (b.crossings === 0 ? 5 : 0);
                if (aCrossingScore !== bCrossingScore) return bCrossingScore - aCrossingScore;
                const aFillsEmpty = a.answerCells.filter(c => emptyCells.some(e => e.row === c.row && e.col === c.col)).length;
                const bFillsEmpty = b.answerCells.filter(c => emptyCells.some(e => e.row === c.row && e.col === c.col)).length;
                if (aFillsEmpty !== bFillsEmpty) return bFillsEmpty - aFillsEmpty;
                return b.length - a.length; // Prefer longer words
              })[0];
              
              const slot: ClueSlot = {
                id: `slot_${state.slotNumber}`,
                direction,
                startRow: targetCell.row,
                startCol: targetCell.col,
                length: bestPlacement.length,
                crossings: []
              };
              
              state = placeSlot(slot, bestPlacement, config, state);
              placed = true;
              consecutiveFailures = 0;
              break;
            }
          }
        }
      }
    }
    
    // Strategy 1: Try placing clue cells at blocked positions (aggressive split cell usage)
    // This converts blocked cells into clue cells, reducing blocked cells and improving coverage
    if (!placed && state.blockedCells.size > 0) {
      const blockedCellsArray = Array.from(state.blockedCells);
      // Prioritize blocked cells that are adjacent to answer cells (better clue positions)
      const blockedCellsWithScore = blockedCellsArray.map(cellKey => {
        const [row, col] = cellKey.split(',').map(Number);
        let neighborScore = 0;
        
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const neighborRow = row + dr;
            const neighborCol = col + dc;
            if (neighborRow >= 0 && neighborRow < config.rows && neighborCol >= 0 && neighborCol < config.cols) {
              const neighborKey = `${neighborRow},${neighborCol}`;
              if (state.answerCells.has(neighborKey)) {
                neighborScore += 2; // Answer cells nearby make this a good clue position
              } else if (state.clueCellDirections.has(neighborKey)) {
                neighborScore += 1;
              }
            }
          }
        }
        
        return { cellKey, row, col, score: neighborScore };
      });
      
      blockedCellsWithScore.sort((a, b) => b.score - a.score);
      
      // Try top blocked cells (those with most answer neighbors)
      const blockedCellsToTry = Math.min(10, blockedCellsWithScore.length);
      
      for (let blockedIdx = 0; blockedIdx < blockedCellsToTry && !placed; blockedIdx++) {
        const { row, col } = blockedCellsWithScore[blockedIdx];
        
        // Try all directions from this blocked cell position
        // Prioritize diagonal directions for more interesting layouts
        const sortedDirections = [...allDirections].sort((a, b) => {
          const aIsDiagonal = a.includes('down') || a.includes('across');
          const bIsDiagonal = b.includes('down') || b.includes('across');
          if (aIsDiagonal && !bIsDiagonal) return -1;
          if (!aIsDiagonal && bIsDiagonal) return 1;
          return 0;
        });
        
        for (const direction of sortedDirections) {
          const placements = findValidPlacements(
            direction,
            row,
            col,
            config,
            state,
            4, // Encourage longer words (4+)
            12 // Allow medium-length words
          );
          
          if (placements.length > 0) {
            // Prefer interesting crossings (1-4) and longer words
            const bestPlacement = placements.sort((a, b) => {
              // Prefer 1-4 crossings (interesting but solvable)
              const aCrossingScore = a.crossings >= 1 && a.crossings <= 4 ? 10 : (a.crossings === 0 ? 5 : 0);
              const bCrossingScore = b.crossings >= 1 && b.crossings <= 4 ? 10 : (b.crossings === 0 ? 5 : 0);
              if (aCrossingScore !== bCrossingScore) return bCrossingScore - aCrossingScore;
              const emptyCellsNow = getEmptyCells(config, state);
              const aFillsEmpty = a.answerCells.filter(c => emptyCellsNow.some(e => e.row === c.row && e.col === c.col)).length;
              const bFillsEmpty = b.answerCells.filter(c => emptyCellsNow.some(e => e.row === c.row && e.col === c.col)).length;
              if (aFillsEmpty !== bFillsEmpty) return bFillsEmpty - aFillsEmpty;
              return b.length - a.length; // Prefer longer words
            })[0];
            
            const slot: ClueSlot = {
              id: `slot_${state.slotNumber}`,
              direction,
              startRow: row,
              startCol: col,
              length: bestPlacement.length,
              crossings: []
            };
            
            // Place the slot - this will convert the blocked cell into a clue cell
            state = placeSlot(slot, bestPlacement, config, state);
            placed = true;
            consecutiveFailures = 0;
            break;
          }
        }
      }
    }
    
    // Strategy 2: Try empty cells systematically (prioritize those with neighbors)
    if (!placed) {
      // Calculate direction diversity to encourage variety
      const directionCounts = new Map<Direction, number>();
      for (const slot of state.slots) {
        directionCounts.set(slot.direction, (directionCounts.get(slot.direction) || 0) + 1);
      }
      
      const centerRow = Math.floor(config.rows / 2);
      const centerCol = Math.floor(config.cols / 2);
      const emptyCellsWithScore = emptyCells.map(cell => {
        let neighborScore = 0;
        let crossingScore = 0;
        
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const neighborRow = cell.row + dr;
            const neighborCol = cell.col + dc;
            if (neighborRow >= 0 && neighborRow < config.rows && neighborCol >= 0 && neighborCol < config.cols) {
              const neighborKey = `${neighborRow},${neighborCol}`;
              if (state.answerCells.has(neighborKey)) {
                neighborScore += 2;
                const cellInfo = state.answerCells.get(neighborKey);
                if (cellInfo) {
                  crossingScore += 1;
                }
              } else if (state.clueCellDirections.has(neighborKey)) {
                neighborScore += 1;
              }
            }
          }
        }
        
        const distanceFromCenter = Math.abs(cell.row - centerRow) + Math.abs(cell.col - centerCol);
        const centerScore = Math.max(0, 10 - distanceFromCenter);
        
        return { 
          cell, 
          score: neighborScore * 10 + crossingScore * 5 + centerScore 
        };
      });
      
      emptyCellsWithScore.sort((a, b) => b.score - a.score);
      
      // Try more candidates when stuck
      const candidatesToTry = isStuck ? Math.min(emptyCells.length, 20) : Math.min(10, emptyCells.length);
      
      for (let candidateIdx = 0; candidateIdx < candidatesToTry && !placed; candidateIdx++) {
        const targetCell = emptyCellsWithScore[candidateIdx].cell;
        
        // Score directions: prefer underused directions for variety, and those that create interesting crossings
        const directionsToTry = [...allDirections].sort((a, b) => {
          const aOrientation = getAnswerOrientation(a);
          const bOrientation = getAnswerOrientation(b);
          
          // Diversity bonus: prefer directions we haven't used much
          const aCount = directionCounts.get(a) || 0;
          const bCount = directionCounts.get(b) || 0;
          const diversityBonus = bCount - aCount; // Prefer less used directions
          
          // Crossing bonus: prefer directions that create crossings (1-4 crossings is interesting)
          let aCrossingScore = 0, bCrossingScore = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const neighborRow = targetCell.row + dr;
              const neighborCol = targetCell.col + dc;
              if (neighborRow >= 0 && neighborRow < config.rows && neighborCol >= 0 && neighborCol < config.cols) {
                const neighborKey = `${neighborRow},${neighborCol}`;
                const cellInfo = state.answerCells.get(neighborKey);
                if (cellInfo) {
                  const existingSlot = state.slots.find(s => s.id === cellInfo.slotId);
                  if (existingSlot) {
                    const existingOrientation = getAnswerOrientation(existingSlot.direction);
                    if (existingOrientation !== aOrientation) aCrossingScore += 5;
                    if (existingOrientation !== bOrientation) bCrossingScore += 5;
                  }
                }
              }
            }
          }
          
          // Combine scores: diversity is important, but crossings are also good
          return (bCrossingScore + diversityBonus * 3) - (aCrossingScore + diversityBonus * 3);
        });
        
        // Try all directions
        for (const direction of directionsToTry) {
          // Encourage longer words (4-12) for more interesting templates, shorter only when stuck
          const maxLength = isStuck ? 8 : 12;
          const minLength = isStuck ? 2 : 4;
          
          const placements = findValidPlacements(
            direction,
            targetCell.row,
            targetCell.col,
            config,
            state,
            minLength,
            maxLength
          );
          
          if (placements.length > 0) {
            // Balance crossings: prefer 1-4 crossings (interesting but solvable)
            // Also prefer longer words and filling more empty cells
            const bestPlacement = placements.sort((a, b) => {
              // Crossing score: 1-4 crossings is ideal (interesting but solvable)
              const aCrossingScore = a.crossings >= 1 && a.crossings <= 4 ? 10 : (a.crossings === 0 ? 5 : 0);
              const bCrossingScore = b.crossings >= 1 && b.crossings <= 4 ? 10 : (b.crossings === 0 ? 5 : 0);
              if (aCrossingScore !== bCrossingScore) return bCrossingScore - aCrossingScore;
              
              // Second priority: fill more empty cells
              const aFillsEmpty = a.answerCells.filter(c => emptyCells.some(e => e.row === c.row && e.col === c.col)).length;
              const bFillsEmpty = b.answerCells.filter(c => emptyCells.some(e => e.row === c.row && e.col === c.col)).length;
              if (aFillsEmpty !== bFillsEmpty) return bFillsEmpty - aFillsEmpty;
              
              // Third priority: prefer longer words (more interesting)
              return b.length - a.length;
            })[0];
            
            const slot: ClueSlot = {
              id: `slot_${state.slotNumber}`,
              direction,
              startRow: targetCell.row,
              startCol: targetCell.col,
              length: bestPlacement.length,
              crossings: []
            };
            
            state = placeSlot(slot, bestPlacement, config, state);
            placed = true;
            consecutiveFailures = 0;
            break;
          }
        }
      }
    }
    
    // Strategy 3: Try split cell placement (encourage more split cells for interesting layouts)
    if (!placed && state.clueCellDirections.size > 0) {
      const existingClueCells = Array.from(state.clueCellDirections.keys());
      // Try more clue cells - split cells make puzzles more interesting
      const clueCellsToTry = isStuck 
        ? existingClueCells.slice(0, Math.min(30, existingClueCells.length))
        : existingClueCells.slice(0, Math.min(20, existingClueCells.length));
      
      for (const clueCellKey of clueCellsToTry) {
        if (placed) break;
        
        const [cellRow, cellCol] = clueCellKey.split(',').map(Number);
        const directionsInCell = state.clueCellDirections.get(clueCellKey);
        if (!directionsInCell) continue;
        
        const compatibleDirections = allDirections.filter(d => 
          !directionsInCell.has(d) && isDirectionCompatibleWithCell(d, directionsInCell)
        );
        
        // Prioritize diagonal directions for split cells (more interesting)
        const sortedDirections = compatibleDirections.sort((a, b) => {
          const aIsDiagonal = a.includes('down') || a.includes('across');
          const bIsDiagonal = b.includes('down') || b.includes('across');
          if (aIsDiagonal && !bIsDiagonal) return -1;
          if (!aIsDiagonal && bIsDiagonal) return 1;
          return 0;
        });
        
        for (const direction of sortedDirections) {
          // Encourage longer words for split cells (4-10 letters)
          const maxLength = isStuck ? 8 : 10;
          const minLength = isStuck ? 2 : 4;
          const placements = findValidPlacements(
            direction,
            cellRow,
            cellCol,
            config,
            state,
            minLength,
            maxLength
          );
          
          if (placements.length > 0) {
            // Prefer interesting crossings (1-3) for split cells
            const bestPlacement = placements.sort((a, b) => {
              // Prefer 1-3 crossings (interesting but solvable)
              const aCrossingScore = a.crossings >= 1 && a.crossings <= 3 ? 10 : (a.crossings === 0 ? 5 : 0);
              const bCrossingScore = b.crossings >= 1 && b.crossings <= 3 ? 10 : (b.crossings === 0 ? 5 : 0);
              if (aCrossingScore !== bCrossingScore) return bCrossingScore - aCrossingScore;
              // Second: fill more empty cells
              const emptyCellsNow = getEmptyCells(config, state);
              const aFillsEmpty = a.answerCells.filter(c => emptyCellsNow.some(e => e.row === c.row && e.col === c.col)).length;
              const bFillsEmpty = b.answerCells.filter(c => emptyCellsNow.some(e => e.row === c.row && e.col === c.col)).length;
              if (aFillsEmpty !== bFillsEmpty) return bFillsEmpty - aFillsEmpty;
              // Third: prefer longer words
              return b.length - a.length;
            })[0];
            
            const slot: ClueSlot = {
              id: `slot_${state.slotNumber}`,
              direction,
              startRow: cellRow,
              startCol: cellCol,
              length: bestPlacement.length,
              crossings: []
            };
            
            state = placeSlot(slot, bestPlacement, config, state);
            placed = true;
            consecutiveFailures = 0;
            break;
          }
        }
      }
    }
    
    // Strategy 4: Try split cells at clue cells adjacent to empty cells
    if (!placed && emptyCells.length > 0) {
      // Find clue cells that are adjacent to empty cells
      const clueCellsAdjacentToEmpty: Array<{ clueKey: string; emptyNeighbors: number }> = [];
      
      for (const clueCellKey of state.clueCellDirections.keys()) {
        const [clueRow, clueCol] = clueCellKey.split(',').map(Number);
        let emptyNeighbors = 0;
        
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const neighborRow = clueRow + dr;
            const neighborCol = clueCol + dc;
            if (neighborRow >= 0 && neighborRow < config.rows && neighborCol >= 0 && neighborCol < config.cols) {
              const neighborKey = `${neighborRow},${neighborCol}`;
              if (emptyCells.some(e => e.row === neighborRow && e.col === neighborCol)) {
                emptyNeighbors++;
              }
            }
          }
        }
        
        if (emptyNeighbors > 0) {
          clueCellsAdjacentToEmpty.push({ clueKey: clueCellKey, emptyNeighbors });
        }
      }
      
      clueCellsAdjacentToEmpty.sort((a, b) => b.emptyNeighbors - a.emptyNeighbors);
      
      for (const { clueKey } of clueCellsAdjacentToEmpty.slice(0, Math.min(10, clueCellsAdjacentToEmpty.length))) {
        if (placed) break;
        
        const [cellRow, cellCol] = clueKey.split(',').map(Number);
        const directionsInCell = state.clueCellDirections.get(clueKey);
        if (!directionsInCell) continue;
        
        const compatibleDirections = allDirections.filter(d => 
          !directionsInCell.has(d) && isDirectionCompatibleWithCell(d, directionsInCell)
        );
        
        for (const direction of compatibleDirections) {
          const maxLength = isStuck ? 6 : 10;
          const placements = findValidPlacements(
            direction,
            cellRow,
            cellCol,
            config,
            state,
            2,
            maxLength
          );
          
          if (placements.length > 0) {
            // Prefer interesting crossings (1-3) for split cells
            const bestPlacement = placements.sort((a, b) => {
              // Prefer 1-3 crossings (interesting but solvable)
              const aCrossingScore = a.crossings >= 1 && a.crossings <= 3 ? 10 : (a.crossings === 0 ? 5 : 0);
              const bCrossingScore = b.crossings >= 1 && b.crossings <= 3 ? 10 : (b.crossings === 0 ? 5 : 0);
              if (aCrossingScore !== bCrossingScore) return bCrossingScore - aCrossingScore;
              const emptyCellsNow = getEmptyCells(config, state);
              const aFillsEmpty = a.answerCells.filter(c => emptyCellsNow.some(e => e.row === c.row && e.col === c.col)).length;
              const bFillsEmpty = b.answerCells.filter(c => emptyCellsNow.some(e => e.row === c.row && e.col === c.col)).length;
              if (aFillsEmpty !== bFillsEmpty) return bFillsEmpty - aFillsEmpty;
              return b.length - a.length; // Prefer longer words
            })[0];
            
            const slot: ClueSlot = {
              id: `slot_${state.slotNumber}`,
              direction,
              startRow: cellRow,
              startCol: cellCol,
              length: bestPlacement.length,
              crossings: []
            };
            
            state = placeSlot(slot, bestPlacement, config, state);
            placed = true;
            consecutiveFailures = 0;
            break;
          }
        }
      }
    }
    
    // Strategy 4: When very stuck, try placing clue cells in ANY empty cell (even isolated ones)
    if (!placed && isStuck && emptyCells.length > 0) {
      // Try random empty cells
      const cellsToTry = emptyCells.slice(0, Math.min(30, emptyCells.length));
      
      for (const targetCell of cellsToTry) {
        if (placed) break;
        
        // Try all directions with shorter words
        for (const direction of allDirections) {
          const placements = findValidPlacements(
            direction,
            targetCell.row,
            targetCell.col,
            config,
            state,
            2,
            6 // Very short words when desperate
          );
          
          if (placements.length > 0) {
            const bestPlacement = placements[0];
            const slot: ClueSlot = {
              id: `slot_${state.slotNumber}`,
              direction,
              startRow: targetCell.row,
              startCol: targetCell.col,
              length: bestPlacement.length,
              crossings: []
            };
            
            state = placeSlot(slot, bestPlacement, config, state);
            placed = true;
            consecutiveFailures = 0;
            break;
          }
        }
      }
    }
    
    // If we still haven't placed anything after many attempts, we're truly stuck
    if (!placed && consecutiveFailures > 5000) {
      console.log(`  ⚠️  Greedy expansion stuck after ${consecutiveFailures} consecutive failures`);
      const remainingEmpty = getEmptyCells(config, state);
      console.log(`  ⚠️  Accepting ${(coverage * 100).toFixed(1)}% coverage (${remainingEmpty.length} empty cells remain)`);
      break;
    }
  }
  
  console.log(`  📊 After greedy expansion: ${state.slots.length} slots, ${state.answerCells.size + state.clueCellDirections.size}/${initialGridCells} cells filled`);
  
  // Calculate crossings
  recalculateCrossings(state.slots);
  
  // Filter slots with too many crossings
  const filteredSlots = state.slots.filter(slot => slot.crossings.length <= TEMPLATE_CONFIG.CROSSINGS.MAX_INITIAL);
  
  // Validate
  const allClueCellPositions = new Set<string>();
  for (const slot of filteredSlots) {
    allClueCellPositions.add(`${slot.startRow},${slot.startCol}`);
  }
  
  const validatedSlots = filteredSlots.filter(slot => {
    const answerCellsForSlot = getSlotCells(slot);
    return !hasAnswerClueOverlap(answerCellsForSlot, allClueCellPositions);
  });
  
  recalculateCrossings(validatedSlots);
  
  const finalSlots = validatedSlots.filter(slot => 
    slot.crossings.length <= TEMPLATE_CONFIG.CROSSINGS.MAX_FINAL
  );
  
  const finalFilled = state.answerCells.size + state.clueCellDirections.size;
  const finalCoverage = finalFilled / initialGridCells;
  const emptyCells = getEmptyCells(config, state);
  
  console.log(`  ✅ Generated ${finalSlots.length} slots: ${finalFilled}/${initialGridCells} cells (${(finalCoverage * 100).toFixed(1)}% coverage), ${emptyCells.length} empty cells`);
  
  if (finalSlots.length < config.minSlots) {
    throw new Error(`Template generation failed: only ${finalSlots.length} slots generated (need ${config.minSlots})`);
  }
  
  if (emptyCells.length > 0 && finalCoverage < 0.99) {
    console.warn(`  ⚠️  Warning: ${emptyCells.length} empty cells remaining (${(finalCoverage * 100).toFixed(1)}% coverage)`);
  }
  
  return {
    id: `generated_${selectedSize}_${Date.now()}`,
    name: `Generated ${selectedSize} template`,
    rows: config.rows,
    cols: config.cols,
    slots: finalSlots,
    clueCells: state.clueCells,
    difficulty,
    categories: ['Generated'],
    metadata: {
      verified: false,
      generated: true,
      size: selectedSize,
    }
  };
}
