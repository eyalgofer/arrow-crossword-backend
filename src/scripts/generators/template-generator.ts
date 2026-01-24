/**
 * Template Generator for Swedish Arrow Crossword Puzzles
 * 
 * Generates grid templates with strategic slot placement and crossings
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
 * Top directions: across, right-down, up-across
 * Note: down-across is also horizontal but not explicitly mentioned in split cell rules
 * For now, we'll allow it but it won't be preferred for split cells
 */
function isTopDirection(direction: Direction): boolean {
  return direction === 'across' || direction === 'right-down' || direction === 'up-across';
}

/**
 * Check if a direction is valid for the bottom position in a split cell
 * Bottom directions: down, left-down
 * Note: "down-right" mentioned by user likely refers to "left-down"
 */
function isBottomDirection(direction: Direction): boolean {
  return direction === 'down' || direction === 'left-down';
}

/**
 * Check if a new direction is compatible with existing directions in a split cell
 * A cell can have at most one top direction and one bottom direction
 * When cell is empty, ALL directions are allowed
 * When cell has one direction, only compatible directions are allowed (top/bottom split)
 */
function isDirectionCompatibleWithCell(
  newDirection: Direction,
  existingDirections: Set<Direction>
): boolean {
  // If cell is empty, ALL directions are allowed (not just top/bottom)
  // Split cell rules only apply when there's already a direction in the cell
  if (existingDirections.size === 0) {
    return true; // Empty cell can accept any direction
  }
  
  // If cell already has a direction, apply split cell rules
  const isNewTop = isTopDirection(newDirection);
  const isNewBottom = isBottomDirection(newDirection);
  
  // If new direction is not a valid split cell direction, reject it
  // (down-across can't be in split cells, but can be in empty cells)
  if (!isNewTop && !isNewBottom) {
    return false;
  }
  
  for (const existingDir of existingDirections) {
    const isExistingTop = isTopDirection(existingDir);
    const isExistingBottom = isBottomDirection(existingDir);
    
    // Can't have two top directions or two bottom directions
    if ((isNewTop && isExistingTop) || (isNewBottom && isExistingBottom)) {
      return false;
    }
  }
  
  return true;
}

export function generateTemplate(
  difficulty: Difficulty = Difficulty.EASY
): GridTemplate {

  // Map difficulty to size using randomness
  const getSizeForDifficulty = (difficulty: Difficulty): Size => {
    const random = Math.random();
    
    switch (difficulty) {
      case Difficulty.EASY:
        // easy: xsmall - medium
        if (random < 0.33) return 'xsmall';
        if (random < 0.67) return 'small';
        return 'medium';
      
      case Difficulty.MEDIUM:
        // medium: xsmall - medium
        if (random < 0.33) return 'xsmall';
        if (random < 0.67) return 'small';
        return 'medium';
      
      case Difficulty.CHALLENGING:
        // challenging: small - xlarge
        if (random < 0.25) return 'small';
        if (random < 0.5) return 'medium';
        if (random < 0.75) return 'large';
        return 'xlarge';
      
      case Difficulty.HARD:
        // hard: large - xxlarge
        if (random < 0.33) return 'large';
        if (random < 0.67) return 'xlarge';
        return 'xlarge';
      
      case Difficulty.EXPERT:
        // expert: xlarge - xxlarge
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
  
  const baseConfig = sizeConfig[selectedSize];
  // Apply difficulty multipliers
  const config = {
    ...baseConfig,
  };
  const slots: ClueSlot[] = [];
  const clueCells: Array<{ row: number; col: number; direction: Direction }> = [];
  // Track which directions are already in each clue cell (supports split cells: two clues per cell)
  const clueCellDirections = new Map<string, Set<Direction>>(); // "row,col" -> Set<Direction>
  const answerCells = new Map<string, { slotId: string; position: number }>(); // Track answer cells for crossings
  const blockedCells = new Set<string>(); // Track cells that must remain empty (after answer ends) to prevent word merging
  
  // Cache empty cells for efficient lookup (updated incrementally)
  const emptyCellsSet = new Set<string>();
  // Initialize empty cells cache
  for (let r = 0; r < config.rows; r++) {
    for (let c = 0; c < config.cols; c++) {
      emptyCellsSet.add(`${r},${c}`);
    }
  }
  
  // Helper to update empty cells cache when placing a slot
  const updateEmptyCellsCache = (clueKey: string, answerCellsForSlot: Array<{ row: number; col: number }>) => {
    // Remove clue cell from empty set only if this is the FIRST direction in this cell
    // If it's already a clue cell (split cell), keep it out of empty set
    const directionsInCell = clueCellDirections.get(clueKey);
    if (!directionsInCell || directionsInCell.size === 0) {
      emptyCellsSet.delete(clueKey);
    }
    // Remove answer cells
    for (const cell of answerCellsForSlot) {
      emptyCellsSet.delete(`${cell.row},${cell.col}`);
    }
    // Note: Blocked cells are removed when they're marked as blocked (see below)
  };
  
  // Helper to rebuild empty cells cache if needed (safety check)
  const rebuildEmptyCellsCache = () => {
    emptyCellsSet.clear();
    for (let r = 0; r < config.rows; r++) {
      for (let c = 0; c < config.cols; c++) {
        const cellKey = `${r},${c}`;
        // Cell is empty if it's not a clue cell (with any direction), not an answer cell, and not blocked
        const hasClue = clueCellDirections.has(cellKey) && (clueCellDirections.get(cellKey)?.size ?? 0) > 0;
        const isBlocked = blockedCells.has(cellKey);
        if (!hasClue && !answerCells.has(cellKey) && !isBlocked) {
          emptyCellsSet.add(cellKey);
        }
      }
    }
  };
  
  // Generate slots with strategic placement
  // For easier puzzles, use fewer slots and simpler directions
  let slotNumber = 1;
  // For easier puzzles, aim for lower slot count (closer to minimum)

  
  const allDirections: Direction[] = ['across', 'down', 'right-down', 'left-down', 'down-across', 'up-across'];
  const directionUsage = new Map<Direction, number>();
  allDirections.forEach(dir => directionUsage.set(dir, 0));
  
  // Create a balanced distribution - each direction appears multiple times
  const directions: Direction[] = [];
  for (let i = 0; i < Math.ceil(config.minSlots / allDirections.length) + 2; i++) {
    directions.push(...allDirections);
  }
  // Shuffle for randomness
  for (let i = directions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [directions[i], directions[j]] = [directions[j], directions[i]];
  }

  // Place slots until we reach target density
  // Use adaptive coverage targets based on size
  const initialGridCells = config.rows * config.cols;
  const initialTargetCoverage = TEMPLATE_CONFIG.COVERAGE.getTargetCoverage(selectedSize);
  const acceptableCoverage = TEMPLATE_CONFIG.PLACEMENT.ACCEPTABLE_COVERAGE;
  const initialTargetFilledCells = Math.floor(initialGridCells * initialTargetCoverage);
  const initialMaxEmptyCells = initialGridCells - initialTargetFilledCells;
  
  let placementAttempts = 0;
  let consecutiveFailures = 0;
  let failureResetCount = 0; // Track how many times we've reset the failure counter
  const maxTotalPlacementAttempts = TEMPLATE_CONFIG.PLACEMENT.MAX_PLACEMENT_ATTEMPTS[selectedSize] || 40000;
  const maxFailureResets = 10; // Maximum number of times we'll reset the failure counter
  
  // Helper to get adaptive failure threshold based on coverage
  const getAdaptiveMaxFailures = (coverage: number): number => {
    const thresholds = TEMPLATE_CONFIG.PLACEMENT.ADAPTIVE_FAILURE_THRESHOLDS;
    if (coverage >= thresholds.HIGH_COVERAGE.threshold) return thresholds.HIGH_COVERAGE.maxFailures;
    if (coverage >= thresholds.MEDIUM_COVERAGE.threshold) return thresholds.MEDIUM_COVERAGE.maxFailures;
    if (coverage >= thresholds.LOW_COVERAGE.threshold) return thresholds.LOW_COVERAGE.maxFailures;
    return thresholds.DEFAULT.maxFailures;
  };
  
  // Continue placing slots until we reach target density OR we've placed minSlots and can't place more
  while (placementAttempts < maxTotalPlacementAttempts) {
    // Check if we've reached target density
    // Count clue cells (each cell can have multiple directions, but counts as one cell)
    const currentFilled = answerCells.size + clueCellDirections.size;
    const currentEmpty = initialGridCells - currentFilled;
    const currentCoverage = currentFilled / initialGridCells;
    
    // Early exit: Only accept if we have minSlots AND high coverage
    // Don't stop early if we're below minSlots, even if coverage is good
    if (slots.length >= config.minSlots && currentCoverage >= acceptableCoverage) {
      console.log(`  ✅ Reached acceptable coverage: ${currentFilled}/${initialGridCells} cells (${(currentCoverage * 100).toFixed(1)}% coverage) with ${slots.length} slots`);
      break;
    }
    
    // Stop if we've reached target density AND have minSlots
    if (slots.length >= config.minSlots && (currentCoverage >= initialTargetCoverage || currentEmpty <= initialMaxEmptyCells)) {
      console.log(`  ✅ Initial placement reached target density: ${currentFilled}/${initialGridCells} cells (${(currentCoverage * 100).toFixed(1)}% coverage) with ${slots.length} slots`);
      break;
    }
    
    // Don't stop early if we're below minSlots - keep trying
    if (slots.length < config.minSlots) {
      // Continue trying to place more slots
    } else if (currentEmpty <= initialMaxEmptyCells + 5) {
      // Close enough to target, stop only if we have minSlots
      break;
    }
    
    // Adaptive failure threshold based on current coverage
    let adaptiveMaxFailures = getAdaptiveMaxFailures(currentCoverage);
    
    // If we're far below target coverage OR below minSlots, increase failure threshold significantly
    // This allows us to push towards 99% density even when placement is difficult
    const isFarBelowTarget = currentCoverage < acceptableCoverage - 0.05; // More than 5% below acceptable
    const isBelowMinSlots = slots.length < config.minSlots;
    if (isFarBelowTarget || isBelowMinSlots) {
      // Increase failure threshold significantly when far below target or below minSlots
      // This allows many more attempts to reach the goal
      adaptiveMaxFailures = Math.max(adaptiveMaxFailures * 3, 1000);
    }
    
    if (consecutiveFailures >= adaptiveMaxFailures) {
      // Only stop if we're close to acceptable coverage AND we've placed min slots
      const isCloseToAcceptable = currentCoverage >= acceptableCoverage - 0.02; // Within 2% of acceptable
      const hasReachedMinSlots = slots.length >= config.minSlots;
      
      // Don't stop if we're below minSlots - keep trying
      if (!hasReachedMinSlots) {
        // Reset failure counter and continue if we're below minSlots
        if (failureResetCount < maxFailureResets) {
          console.log(`  🔄 Resetting failure counter (${consecutiveFailures} failures, reset #${failureResetCount + 1}) - below minSlots (${slots.length}/${config.minSlots}), continuing...`);
          consecutiveFailures = 0;
          failureResetCount++;
        } else {
          console.log(`  ⚠️  Stopping after ${failureResetCount} failure resets - still below minSlots (${slots.length}/${config.minSlots})`);
          break;
        }
      } else if (isCloseToAcceptable || (hasReachedMinSlots && currentCoverage >= acceptableCoverage - 0.05)) {
        console.log(`  ⚠️  Stopping initial placement: ${consecutiveFailures} consecutive failures (adaptive limit: ${adaptiveMaxFailures}), ${slots.length} slots, ${currentFilled}/${initialGridCells} cells (${(currentCoverage * 100).toFixed(1)}% coverage)`);
        break;
      } else {
        // Still far below target, reset failure counter and continue (but log it)
        // But only if we haven't reset too many times already
        if (failureResetCount < maxFailureResets) {
          console.log(`  🔄 Resetting failure counter (${consecutiveFailures} failures, reset #${failureResetCount + 1}) - still below target (${(currentCoverage * 100).toFixed(1)}% < ${(acceptableCoverage * 100).toFixed(1)}%), continuing towards 99%...`);
          consecutiveFailures = 0; // Reset to allow more attempts
          failureResetCount++;
        } else {
          // Too many resets, stop to prevent infinite loops
          console.log(`  ⚠️  Stopping after ${failureResetCount} failure resets - reached max resets limit`);
          break;
        }
      }
    }
    
    // Try to place a slot
    let placed = false;
    let attempts = 0;
    const maxPlacementAttempts = TEMPLATE_CONFIG.PLACEMENT.MAX_PLACEMENT_ATTEMPTS_PER_SLOT[selectedSize] || 5000;
    
    while (!placed && attempts < maxPlacementAttempts) {
      attempts++;
      
      // Smart direction selection: prioritize unused directions, then balance
      let direction: Direction;
      if (slots.length < allDirections.length) {
        // First 6 slots: use each direction once to ensure all are used
        direction = allDirections[slots.length];
      } else {
        // After that, prefer less-used directions but allow all
        const sortedDirections = [...allDirections].sort((a, b) => 
          (directionUsage.get(a) || 0) - (directionUsage.get(b) || 0)
        );
        // 70% chance to pick from least-used, 30% random
        if (Math.random() < 0.7 && sortedDirections.length > 0) {
          const leastUsed = sortedDirections[0];
          const leastUsedCount = directionUsage.get(leastUsed) || 0;
          const candidates = sortedDirections.filter(d => 
            (directionUsage.get(d) || 0) <= leastUsedCount + 1
          );
          direction = candidates[Math.floor(Math.random() * candidates.length)];
        } else {
          direction = directions[Math.floor(Math.random() * directions.length)];
        }
      }
      
      // AGGRESSIVE DENSITY: Smart placement to maximize crossings and fill gaps
      let startRow: number;
      let startCol: number;
      
      // SWEDISH ARROW STRATEGY: Balance crossings with coverage
      // After initial slots, prioritize both crossings AND filling empty areas
      // Once we have minSlots, focus heavily on filling empty cells
      const hasMinSlots = slots.length >= config.minSlots;
      const progressRatio = slots.length / Math.max(config.minSlots, 1);
      if (progressRatio > 0.10 && answerCells.size > 0) {
        // Use cached empty cells (much faster than scanning entire grid)
        // Rebuild cache if it seems suspiciously small (safety check)
        if (emptyCellsSet.size < 10 && emptyCellsSet.size !== (initialGridCells - currentFilled)) {
          rebuildEmptyCellsCache();
        }
        
        // Convert cached empty cells to list for random selection
        const emptyCellsList: Array<{ row: number; col: number }> = Array.from(emptyCellsSet).map(key => {
          const [r, c] = key.split(',').map(Number);
          return { row: r, col: c };
        });
        
        // Once we have minSlots, prioritize filling empty cells (90% chance)
        // Before minSlots, balance crossings and coverage (50% crossings, 50% empty)
        // Also prioritize split cells when possible (try to place in existing clue cells)
        const emptyCellPriority = hasMinSlots ? 0.90 : 0.50;
        const splitCellPriority = 0.20; // 20% chance to try split cell placement
        
        if (Math.random() < splitCellPriority && clueCellDirections.size > 0) {
          // Try to place in an existing clue cell (split cell)
          const existingClueCells = Array.from(clueCellDirections.keys());
          const targetClueCell = existingClueCells[Math.floor(Math.random() * existingClueCells.length)];
          const [cellRow, cellCol] = targetClueCell.split(',').map(Number);
          startRow = cellRow;
          startCol = cellCol;
        } else if (Math.random() < (1 - emptyCellPriority) && answerCells.size > 0) {
          const existingCells = Array.from(answerCells.keys());
          const randomCellKey = existingCells[Math.floor(Math.random() * existingCells.length)];
          const [cellRow, cellCol] = randomCellKey.split(',').map(Number);
          
          // Place clue cell strategically near this answer cell
          // Use very tight range to create maximum crossings (0 to 1 offset)
          const offsetRow = Math.floor(Math.random() * 2); // 0 to 1 (very tight for maximum crossings)
          const offsetCol = Math.floor(Math.random() * 2);
          startRow = Math.max(0, Math.min(config.rows - 1, cellRow + offsetRow));
          startCol = Math.max(0, Math.min(config.cols - 1, cellCol + offsetCol));
        } else if (emptyCellsList.length > 0) {
          // Place near empty cells to fill gaps
          const targetEmpty = emptyCellsList[Math.floor(Math.random() * emptyCellsList.length)];
          // Place clue cell near empty area (within 1-2 cells)
          const offsetRow = Math.floor(Math.random() * 3) - 1; // -1 to 1
          const offsetCol = Math.floor(Math.random() * 3) - 1;
          startRow = Math.max(0, Math.min(config.rows - 1, targetEmpty.row + offsetRow));
          startCol = Math.max(0, Math.min(config.cols - 1, targetEmpty.col + offsetCol));
        } else {
          // Fallback: random placement
          startRow = Math.floor(Math.random() * config.rows);
          startCol = Math.floor(Math.random() * config.cols);
        }
      } else {
        // First 10%: Random placement to establish initial grid structure
        startRow = Math.floor(Math.random() * config.rows);
        startCol = Math.floor(Math.random() * config.cols);
      }
      
      // Adjust for direction constraints
      if (direction === 'left-down' && startCol < 3) startCol = Math.max(3, startCol);
      if (direction === 'up-across' && startRow < 2) startRow = Math.max(2, startRow);
      if (direction === 'right-down' && startCol >= config.cols - 1) startCol = Math.max(0, config.cols - 2);
      if (direction === 'down-across' && startRow >= config.rows - 1) startRow = Math.max(0, config.rows - 2);
      
      // Word length selection based on difficulty
      // Allow longer words for better variety
      const maxLength = selectedSize === 'xsmall' ? 9 : selectedSize === 'small' ? 10 : selectedSize === 'medium' ? 12 : selectedSize === 'large' ? 14 : selectedSize === 'xlarge' ? 15 : 15;
      // Set minimum length based on difficulty to avoid very short words
      const minLength = 2;

      let bestLength = 0;
      let bestCrossings = Infinity;
      let bestAnswerCells: Array<{ row: number; col: number }> = [];
      // Prefer longer words - try from longest to shortest
      for (let testLength = maxLength; testLength >= minLength; testLength--) {
      // Create a temporary slot to calculate answer cells
      const tempSlot: ClueSlot = {
        id: 'temp',
        direction,
        startRow,
        startCol,
        length: testLength,
        crossings: []
      };
      
      const testAnswerCells = getSlotCells(tempSlot);
      
      // Check if answer fits in bounds
      const lastCell = testAnswerCells[testAnswerCells.length - 1];
      const endRow = lastCell.row;
      const endCol = lastCell.col;
      
      if (endRow < 0 || endRow >= config.rows || endCol < 0 || endCol >= config.cols) {
        continue; // This length doesn't fit
      }
      
      // Validate that words can only start/end at grid bounds, clue cells, or blocked cells
      // Check boundaries to prevent word merging
      // Convert Map keys to Set for checkAnswerBoundaries
      const answerCellPositions = new Set(answerCells.keys());
      if (!checkAnswerBoundaries(direction, testAnswerCells, config.rows, config.cols, answerCellPositions)) {
        continue; // Would merge with another answer cell - skip this length
      }
      

      const testClueKey = `${startRow},${startCol}`;
      // Check if this direction is compatible with existing directions in this clue cell
      // Split cell rules: top can have (across, right-down, up-across), bottom can have (down, left-down)
      const directionsInCell = clueCellDirections.get(testClueKey);
      if (directionsInCell) {
        // Check if this exact direction is already used
        if (directionsInCell.has(direction)) {
          continue; // This direction is already used in this clue cell
        }
        // Check if this direction is compatible with split cell rules
        if (!isDirectionCompatibleWithCell(direction, directionsInCell)) {
          continue; // This direction conflicts with existing directions in split cell
        }
      }
      
      // Clue cell cannot be in an answer cell position
      if (answerCells.has(testClueKey)) {
        continue; // Clue cell overlaps with an answer cell - invalid!
      }
      
      // Clue cell cannot be in a blocked cell position
      if (blockedCells.has(testClueKey)) {
        continue; // Clue cell overlaps with a blocked cell - invalid!
      }
      
      // Check for conflicts and count perpendicular crossings
      let hasConflict = false;
      const testCrossingSlots = new Set<string>();
      const testOrientation = getAnswerOrientation(direction);
      
      for (const cell of testAnswerCells) {
        const cellKey = `${cell.row},${cell.col}`;
        
        // Can't place answer in a clue cell (regardless of direction)
        // Check if this cell has any clue directions
        if (clueCellDirections.has(cellKey) && (clueCellDirections.get(cellKey)?.size ?? 0) > 0) {
          hasConflict = true;
          break;
        }
        
        // Can't place answer in a blocked cell (these must remain empty or become clue cells)
        if (blockedCells.has(cellKey)) {
          hasConflict = true;
          break;
        }
        
        // Count perpendicular crossings only
        if (answerCells.has(cellKey)) {
          const existingSlotInfo = answerCells.get(cellKey);
          if (existingSlotInfo) {
            const existingSlot = slots.find(s => s.id === existingSlotInfo.slotId);
            if (existingSlot) {
              const existingOrientation = getAnswerOrientation(existingSlot.direction);
              if (existingOrientation !== testOrientation) {
                testCrossingSlots.add(existingSlotInfo.slotId);
              } else {
                hasConflict = true; // Parallel overlap = conflict
                break;
              }
            }
          }
        }
      }

      // This prevents selecting very short words just because they have fewer crossings
      const isBetter = !hasConflict && (
        testCrossingSlots.size < bestCrossings || 
        (testCrossingSlots.size <= bestCrossings + 1 && testLength > bestLength)
      );
      
      if (isBetter) {
        bestCrossings = testCrossingSlots.size;
        bestLength = testLength;
        bestAnswerCells = testAnswerCells;
      }
        }
      
      // If no valid length found, skip this position
      if (bestLength < minLength) {
        continue; // Try again with different position
      }
      
      const wordLength = bestLength;
      const answerCellsForSlot = bestAnswerCells;
      const clueKey = `${startRow},${startCol}`;
      
      // Use the crossing count from optimal selection (already calculated)
      const crossingCount = bestCrossings; // Number of different slots we cross with (perpendicular only)
      
      // Enforce crossing limits, but be more lenient when we need to reach target density or minSlots
      const currentFilledCheck = answerCells.size + clueCellDirections.size;
      const currentCoverageCheck = currentFilledCheck / initialGridCells;
      const needsMoreDensity = currentCoverageCheck < initialTargetCoverage;
      const needsMoreSlots = slots.length < config.minSlots;
      
      // If we need more density OR more slots, allow more crossings (up to config max)
      // Otherwise, stick to a lower limit
      const maxAllowedCrossings = (needsMoreDensity || needsMoreSlots)
        ? TEMPLATE_CONFIG.CROSSINGS.MAX_INITIAL 
        : 8;
      
      if (crossingCount > maxAllowedCrossings) {
        continue; // Too many crossings for this stage, try a different position
      }

      // Double-check that this direction is compatible with existing directions in this clue cell
      // Split cell rules: top can have (across, right-down, up-across), bottom can have (down, left-down)
      const directionsInCell = clueCellDirections.get(clueKey);
      if (directionsInCell) {
        // Check if this exact direction is already used
        if (directionsInCell.has(direction)) {
          // This should not happen due to earlier checks, but add safety check
          continue; // This direction already used in this clue cell, skip this slot
        }
        // Check if this direction is compatible with split cell rules
        if (!isDirectionCompatibleWithCell(direction, directionsInCell)) {
          continue; // This direction conflicts with existing directions in split cell, skip this slot
        }
      }
      
      // clue cell cannot be in an answer cell
      if (answerCells.has(clueKey)) {
        continue; // Clue cell overlaps with answer cell - invalid!
      }
      
      // ensure answer cells don't start immediately after another answer cell
      // Re-validate the cell before the first answer cell
      const firstAnswerCellForValidation = answerCellsForSlot[0];
      const cellBeforeAnswerForValidation = getCellBeforeAnswer(direction, firstAnswerCellForValidation, config.rows, config.cols);
      if (cellBeforeAnswerForValidation !== null) {
        const prevCellKey = `${cellBeforeAnswerForValidation.row},${cellBeforeAnswerForValidation.col}`;
        if (answerCells.has(prevCellKey)) {
          // This would cause word merging - invalid!
          continue;
        }
        // Must be clue cell (can be split cell), blocked cell, or empty (will be marked as blocked when slot is placed)
        // Empty is OK here because we'll mark it as blocked immediately after validation
      }
      
      // ensure answer cells don't end immediately before another answer cell
      // This is the KEY validation: cell after last answer letter must be boundary/clue/block
      const lastAnswerCellForValidation = answerCellsForSlot[answerCellsForSlot.length - 1];
      const nextCellAfterAnswerForValidation = getNextCellAfterAnswer(direction, lastAnswerCellForValidation, config.rows, config.cols);
      if (nextCellAfterAnswerForValidation !== null) {
        const nextCellKey = `${nextCellAfterAnswerForValidation.row},${nextCellAfterAnswerForValidation.col}`;
        if (answerCells.has(nextCellKey)) {
          // This would cause word merging - invalid!
          continue;
        }
        // Must be clue cell (can be split cell), blocked cell, or empty (will be marked as blocked when slot is placed)
        // Empty is OK here because we'll mark it as blocked immediately after validation
      }
      
      // Place the slot
      const slotId = `slot_${slotNumber}`;
      const slot: ClueSlot = {
        id: slotId,
        direction,
        startRow,
        startCol,
        length: wordLength,
        crossings: [] // Will calculate after all slots are placed
      };
      
      slots.push(slot);
      clueCells.push({ row: startRow, col: startCol, direction });
      // Track which directions are used in this clue cell (supports split cells)
      if (!clueCellDirections.has(clueKey)) {
        clueCellDirections.set(clueKey, new Set<Direction>());
      }
      clueCellDirections.get(clueKey)!.add(direction);
      
      // Update empty cells cache (remove clue and answer cells)
      updateEmptyCellsCache(clueKey, answerCellsForSlot);
      
      // Track direction usage
      directionUsage.set(direction, (directionUsage.get(direction) || 0) + 1);
      
      // Mark answer cells using the calculated cells
      for (let j = 0; j < answerCellsForSlot.length; j++) {
        const cell = answerCellsForSlot[j];
        const cellKey = `${cell.row},${cell.col}`;
        answerCells.set(cellKey, { slotId, position: j });
      }
      
      // Mark the cell BEFORE the first answer cell as blocked
      // This prevents words from merging - the cell must remain empty or become a clue cell
      const firstAnswerCell = answerCellsForSlot[0];
      const cellBeforeAnswer = getCellBeforeAnswer(direction, firstAnswerCell, config.rows, config.cols);
      if (cellBeforeAnswer !== null) {
        const prevCellKey = `${cellBeforeAnswer.row},${cellBeforeAnswer.col}`;
        // Only mark as blocked if it's not already a clue cell (can be split cell)
        if (!clueCellDirections.has(prevCellKey)) {
          blockedCells.add(prevCellKey);
          // Also remove from empty cells cache (it's now blocked)
          emptyCellsSet.delete(prevCellKey);
        }
      }
      
      // Mark the cell after the last answer cell as blocked
      // This prevents words from merging - the cell must remain empty or become a clue cell
      const lastAnswerCell = answerCellsForSlot[answerCellsForSlot.length - 1];
      const nextCellAfterAnswer = getNextCellAfterAnswer(direction, lastAnswerCell, config.rows, config.cols);
      if (nextCellAfterAnswer !== null) {
        const nextCellKey = `${nextCellAfterAnswer.row},${nextCellAfterAnswer.col}`;
        // Only mark as blocked if it's not already a clue cell (can be split cell)
        if (!clueCellDirections.has(nextCellKey)) {
          blockedCells.add(nextCellKey);
          // Also remove from empty cells cache (it's now blocked)
          emptyCellsSet.delete(nextCellKey);
        }
      }
      
      placed = true;
      slotNumber++;
      consecutiveFailures = 0; // Reset failure counter on success
      placementAttempts++;
      
      // Log progress every 10 slots or when we reach milestones
      if (slots.length % 10 === 0 || slots.length === config.minSlots) {
        const currentFilledLog = answerCells.size + clueCellDirections.size;
        const currentCoverageLog = currentFilledLog / initialGridCells;
        console.log(`  📊 Placed ${slots.length} slots: ${currentFilledLog}/${initialGridCells} cells (${(currentCoverageLog * 100).toFixed(1)}% coverage)`);
      }
    }
    
    // After inner loop exits, check if we placed a slot
    if (!placed) {
      // Failed to place a slot
      consecutiveFailures++;
      placementAttempts++;
      
      // Recalculate current coverage for logging (use fresh values)
      const currentFilledLog = answerCells.size + clueCellDirections.size;
      const currentCoverageLog = currentFilledLog / initialGridCells;
      
      // If we couldn't place a slot after many attempts, log and potentially stop
      if (attempts >= maxPlacementAttempts) {
        if (slots.length >= config.minSlots && currentCoverageLog >= initialTargetCoverage) {
          console.log(`  ⚠️  Stopping initial placement: ${slots.length} slots, ${currentFilledLog}/${initialGridCells} cells (${(currentCoverageLog * 100).toFixed(1)}% coverage)`);
          break;
        }
      }
      
      // Log every 100 failures to show we're still trying (recalculate each time)
      if (consecutiveFailures % 100 === 0) {
        console.log(`  🔄 Still trying to place slots... ${consecutiveFailures} consecutive failures, ${slots.length} slots, ${currentFilledLog}/${initialGridCells} cells (${(currentCoverageLog * 100).toFixed(1)}% coverage)`);
      }
    }
  }
  
  // Check if we placed enough slots before filtering
  if (slots.length < config.minSlots) {
    console.warn(`⚠️  Warning: Only placed ${slots.length} slots in initial placement (need ${config.minSlots}). This may cause issues.`);
  }
  
  // Calculate crossings between slots using consolidated function
  recalculateCrossings(slots);
  
  // Sort slots by crossing count (fewest first)
  // The solver will solve slots with most crossings first (MRV heuristic),
  // but we want the FIRST slots to have FEW crossings so they're solvable
  // So we'll sort by crossing count ASCENDING, then filter
  slots.sort((a, b) => a.crossings.length - b.crossings.length);
  
  // FILTERING: Keep slots with reasonable crossing counts
  // Be lenient initially to keep more slots, filter more aggressively later
  const filteredSlots: typeof slots = [];
  
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const crossings = slot.crossings.length;
    
    // SOLVABILITY: Keep slots with up to config max crossings initially
    // We'll filter more aggressively in the second pass, but keep more initially
    // to ensure we have enough slots to meet the minimum
    const hardCap = TEMPLATE_CONFIG.CROSSINGS.MAX_INITIAL;
    if (crossings <= hardCap) {
      filteredSlots.push(slot);
    } else {
      console.log(`  ⚠️  Filtered out slot ${slot.id}: ${crossings} crossings (too many)`);
    }
  }
  
  console.log(`  📊 After first filtering: ${slots.length} -> ${filteredSlots.length} slots`);
  
  // Log direction usage for debugging
  const directionCounts = Array.from(directionUsage.entries())
    .map(([dir, count]) => `${dir}:${count}`)
    .join(', ');
  console.log(`  📊 Direction usage: ${directionCounts}`);
  
  // Validate that no answer cells overlap with clue cells
  // Build a set of all clue cell positions (cells that have at least one clue direction)
  const allClueCellPositions = new Set<string>();
  for (const slot of filteredSlots) {
    allClueCellPositions.add(`${slot.startRow},${slot.startCol}`);
  }
  
  // Filter out any slots whose answer cells overlap with clue cells
  const validatedSlots: typeof filteredSlots = [];
  for (const slot of filteredSlots) {
    const answerCells = getSlotCells(slot);
    if (!hasAnswerClueOverlap(answerCells, allClueCellPositions)) {
      validatedSlots.push(slot);
    } else {
      console.log(`  ⚠️  Filtered out slot ${slot.id}: answer cells overlap with clue cells`);
    }
  }
  
  // Recalculate crossings after filtering
  // When we remove slots, other slots' crossing counts decrease
  recalculateCrossings(validatedSlots);
  
  // Validate that answer cells only overlap at registered crossing points
  // If two slots share cells but have no crossing registered, that's invalid
  // This will catch any parallel overlaps that somehow got through placement logic
  const { invalidSlots: slotsWithInvalidOverlaps, errors: overlapErrors } = validateOverlapsAreCrossings(validatedSlots);
  for (const error of overlapErrors) {
    console.log(`  ⚠️  ${error}`);
  }
  
  // Remove slots with invalid overlaps
  if (slotsWithInvalidOverlaps.length > 0) {
    console.log(`  ⚠️  Removing ${slotsWithInvalidOverlaps.length} slots with invalid answer cell overlaps`);
    const validSlots = validatedSlots.filter(s => !slotsWithInvalidOverlaps.includes(s));
    // Recalculate crossings for remaining slots
    recalculateCrossings(validSlots);
    // Replace validatedSlots with validSlots
    validatedSlots.length = 0;
    validatedSlots.push(...validSlots);
  }
  
  // Now filter again with recalculated crossings - be more selective for solvability
  const finalFilteredSlots: typeof validatedSlots = [];
  for (let i = 0; i < validatedSlots.length; i++) {
    const slot = validatedSlots[i];
    const crossings = slot.crossings.length;
    
    // Progressive limits: earlier slots can have fewer crossings
    // Use config-based progressive limits
    const progressRatio = i / validatedSlots.length;
    const limits = TEMPLATE_CONFIG.CROSSINGS.PROGRESSIVE_LIMITS;
    let maxAllowed: number = limits[limits.length - 1].max; // Default to last limit
    for (const limit of limits) {
      if (progressRatio < limit.ratio) {
        maxAllowed = limit.max;
        break;
      }
    }
    
    if (crossings <= maxAllowed) {
      finalFilteredSlots.push(slot);
    } else {
      // Log when we filter out slots for debugging
      if (i < 5 || i % 10 === 0) {
        console.log(`  ⚠️  Filtered out slot ${slot.id} (recalc): ${crossings} crossings (max: ${maxAllowed})`);
      }
    }
  }
  
  console.log(`  📊 After second filtering: ${validatedSlots.length} -> ${finalFilteredSlots.length} slots`);
  
  // If we filtered out too many, be more lenient to maintain density
  console.log(`  📊 Initial placement: ${slots.length} slots placed`);
  if (finalFilteredSlots.length < config.minSlots) {
    const targetCount = Math.max(
      config.minSlots, // Must have at least minSlots
      finalFilteredSlots.length + 10 // Or at least add 10 more
    );
    const needed = targetCount - finalFilteredSlots.length;
    let added = 0;
    
    // Build clue cell direction map ONLY from slots we're keeping (finalFilteredSlots)
    // This allows us to re-add filtered-out slots if their clue cells don't already have that direction
    const clueCellDirections = new Map<string, Set<Direction>>();
    for (const slot of finalFilteredSlots) {
      const clueKey = `${slot.startRow},${slot.startCol}`;
      if (!clueCellDirections.has(clueKey)) {
        clueCellDirections.set(clueKey, new Set<Direction>());
      }
      clueCellDirections.get(clueKey)!.add(slot.direction);
    }
    
    // Get all slots that were filtered out (from validatedSlots, not original slots)
    // Use validatedSlots because those have recalculated crossings
    const filteredOutSlots = validatedSlots.filter(slot => !finalFilteredSlots.includes(slot));
    
    // Use the original crossing counts from validatedSlots (already recalculated)
    // This is more accurate than recalculating against a smaller set
    const slotsWithCrossings = filteredOutSlots.map(slot => {
      // Use the crossings that were already calculated during validation
      return { slot, crossings: slot.crossings.length };
    });
    
    // Sort by crossing count (ascending) to prefer easier slots
    slotsWithCrossings.sort((a, b) => a.crossings - b.crossings);
    
    for (const { slot, crossings } of slotsWithCrossings) {
      if (added >= needed) break;
      
      // Check if this direction is compatible with existing directions in this clue cell
      // Split cell rules: top can have (across, right-down, up-across), bottom can have (down, left-down)
      const clueKey = `${slot.startRow},${slot.startCol}`;
      const directionsInCell = clueCellDirections.get(clueKey);
      if (directionsInCell) {
        // Check if this exact direction is already used
        if (directionsInCell.has(slot.direction)) {
          continue; // This direction already used in this clue cell
        }
        // Check if this direction is compatible with split cell rules
        if (!isDirectionCompatibleWithCell(slot.direction, directionsInCell)) {
          continue; // This direction conflicts with existing directions in split cell
        }
      }
      
      // Check if answer cells overlap with clue cells (any direction)
      const slotCells = getSlotCells(slot);
      let hasClueOverlap = false;
      for (const cell of slotCells) {
        const cellKey = `${cell.row},${cell.col}`;
        if (clueCellDirections.has(cellKey) && (clueCellDirections.get(cellKey)?.size ?? 0) > 0) {
          hasClueOverlap = true;
          break;
        }
      }
      if (hasClueOverlap) continue; // Skip slots that overlap with clue cells
      
      // Use config-based relaxed limit for ultra-dense puzzles
      const relaxedLimit = TEMPLATE_CONFIG.CROSSINGS.RELAXED_LIMIT;
      if (crossings <= relaxedLimit) {
        // Double-check this direction is still compatible before adding
        const currentDirections = clueCellDirections.get(clueKey);
        if (!currentDirections || (!currentDirections.has(slot.direction) && isDirectionCompatibleWithCell(slot.direction, currentDirections))) {
          finalFilteredSlots.push(slot);
          // Add this slot's direction to the clue cell
          if (!clueCellDirections.has(clueKey)) {
            clueCellDirections.set(clueKey, new Set<Direction>());
          }
          clueCellDirections.get(clueKey)!.add(slot.direction);
          added++;
          console.log(`  ✅ Re-added slot ${slot.id} with ${crossings} crossings (relaxed limit: ${relaxedLimit})`);
        } else {
          console.log(`  ⚠️  Skipped re-adding slot ${slot.id}: direction ${slot.direction} incompatible with existing directions in clue cell (${slot.startRow},${slot.startCol})`);
        }
      }
    }
    console.log(`  ✅ Relaxed filtering: Added ${added} more slots. Total: ${finalFilteredSlots.length}`);
  }
  
    
  if (finalFilteredSlots.length >= config.minSlots) {
    const uniqueClueCells = clueCellDirections.size;
    const totalClueCells = clueCells.length;
    const splitCellsCount = totalClueCells - uniqueClueCells;
    console.log(`  ✅ Generated ${finalFilteredSlots.length} slots with ${uniqueClueCells} unique clue cells${splitCellsCount > 0 ? ` (${splitCellsCount} split cells with multiple directions)` : ''}`);
  } else {
    console.error(`  ❌ CRITICAL: Only ${finalFilteredSlots.length} slots (need ${config.minSlots}) - template is invalid`);
    // Throw error to trigger retry instead of returning invalid template
    throw new Error(`Template generation failed: only ${finalFilteredSlots.length} slots generated (need ${config.minSlots} for ${selectedSize} size)`);
  }
  
  return {
    id: `generated_${selectedSize}_${Date.now()}`,
    name: `Generated ${selectedSize} template`,
    rows: config.rows,
    cols: config.cols,
    slots: finalFilteredSlots,
    clueCells: clueCells,
    difficulty,
    categories: ['Generated'],
    metadata: {
      verified: false,
      generated: true,
      size: selectedSize,
    }
  };
}