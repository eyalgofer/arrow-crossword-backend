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

export function generateTemplate(
  difficulty: Difficulty = Difficulty.EASY
): GridTemplate {

  // Map difficulty to size using randomness
  type Size = 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge' | 'xxlarge';
  
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
  
  const sizeConfig: Record<Size, { rows: number; cols: number; minSlots: number; maxCrossingsPerSlot: number; }> = {
    xsmall: { rows: 9, cols: 9, minSlots: 20, maxCrossingsPerSlot: 10 },
    small: { rows: 10, cols: 10, minSlots: 22, maxCrossingsPerSlot: 10},
    medium: { rows: 11, cols: 11, minSlots: 23, maxCrossingsPerSlot: 10 },
    large: { rows: 12, cols: 12, minSlots: 28, maxCrossingsPerSlot: 12 },
    xlarge: { rows: 13, cols: 13, minSlots: 36, maxCrossingsPerSlot: 12 },
    xxlarge: { rows: 14, cols: 14, minSlots: 42, maxCrossingsPerSlot: 12 }
  };
  
  const baseConfig = sizeConfig[selectedSize];
  // Apply difficulty multipliers
  const config = {
    ...baseConfig,
  };
  const slots: ClueSlot[] = [];
  const clueCells: Array<{ row: number; col: number; direction: Direction }> = [];
  const occupiedCells = new Set<string>(); // Track which cells have clues
  const answerCells = new Map<string, { slotId: string; position: number }>(); // Track answer cells for crossings
  const blockedCells = new Set<string>(); // Track cells that must remain empty (after answer ends) to prevent word merging
  
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

  // Place slots until we reach target density (99%)
  // Continue beyond minSlots to achieve high density
  const initialGridCells = config.rows * config.cols;
  const initialTargetCoverage = 0.85;
  const initialTargetFilledCells = Math.floor(initialGridCells * initialTargetCoverage);
  const initialMaxEmptyCells = initialGridCells - initialTargetFilledCells;
  
  let placementAttempts = 0;
  let consecutiveFailures = 0;
  const maxConsecutiveFailures = 200; // If we fail 1000 times in a row, stop trying
  const maxTotalPlacementAttempts = selectedSize === 'xlarge' ? 100000
   : selectedSize === 'large' ? 80000 
   : selectedSize === 'medium' ? 60000 
   : 40000;
  
  // Continue placing slots until we reach target density OR we've placed minSlots and can't place more
  while (placementAttempts < maxTotalPlacementAttempts) {
    // Check if we've reached target density
    const currentFilled = answerCells.size + occupiedCells.size;
    const currentEmpty = initialGridCells - currentFilled;
    const currentCoverage = currentFilled / initialGridCells;
    
    // Stop if we've reached target density
    if (currentCoverage >= initialTargetCoverage || currentEmpty <= initialMaxEmptyCells) {
      console.log(`  ✅ Initial placement reached target density: ${currentFilled}/${initialGridCells} cells (${(currentCoverage * 100).toFixed(1)}% coverage) with ${slots.length} slots`);
      break;
    }
    
    // Also ensure we place at least minSlots
    if (slots.length >= config.minSlots && currentEmpty <= initialMaxEmptyCells + 5) {
      // Close enough to target, stop
      break;
    }
    
    // If we've failed too many times in a row, stop
    if (consecutiveFailures >= maxConsecutiveFailures) {
      console.log(`  ⚠️  Stopping initial placement: ${consecutiveFailures} consecutive failures, ${slots.length} slots, ${currentFilled}/${initialGridCells} cells (${(currentCoverage * 100).toFixed(1)}% coverage)`);
      break;
    }
    
    // Try to place a slot
    let placed = false;
    let attempts = 0;
    const maxPlacementAttempts = selectedSize === 'xlarge' ? 15000
     : selectedSize === 'large' ? 12000 
     : selectedSize === 'medium' ? 8000 
     : 5000;
    
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
        // Find empty cells that could be filled
        const emptyCellsList: Array<{ row: number; col: number }> = [];
        for (let r = 0; r < config.rows; r++) {
          for (let c = 0; c < config.cols; c++) {
            const cellKey = `${r},${c}`;
            if (!occupiedCells.has(cellKey) && !answerCells.has(cellKey)) {
              emptyCellsList.push({ row: r, col: c });
            }
          }
        }
        
        // Once we have minSlots, prioritize filling empty cells (80% chance)
        // Before minSlots, balance crossings and coverage (70% crossings, 30% empty)
        const emptyCellPriority = hasMinSlots ? 0.80 : 0.30;
        if (Math.random() < (1 - emptyCellPriority) && answerCells.size > 0) {
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
      if (occupiedCells.has(testClueKey)) {
        continue; // Clue cell already taken by another clue
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
        
        // Can't place answer in a clue cell
        if (occupiedCells.has(cellKey)) {
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
      
      // Enforce crossing limits, but be more lenient when we need to reach target density
      const currentFilledCheck = answerCells.size + occupiedCells.size;
      const currentCoverageCheck = currentFilledCheck / initialGridCells;
      const needsMoreDensity = currentCoverageCheck < initialTargetCoverage;
      
      // If we need more density, allow more crossings (up to 15)
      // Otherwise, stick to the config limit
      const maxAllowedCrossings = needsMoreDensity ? Math.max(config.maxCrossingsPerSlot, 15) : config.maxCrossingsPerSlot;
      
      if (crossingCount > maxAllowedCrossings) {
        continue; // Too many crossings for this stage, try a different position
      }

      // Double-check that clue cell is still available (prevent duplicates)
      // Also check that clue cell doesn't overlap with answer cells
      if (occupiedCells.has(clueKey)) {
        // This should not happen due to earlier checks, but add safety check
        continue; // Clue cell already taken, skip this slot
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
        // Must be clue cell, blocked cell, or empty (will be marked as blocked when slot is placed)
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
        // Must be clue cell, blocked cell, or empty (will be marked as blocked when slot is placed)
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
      occupiedCells.add(clueKey);
      
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
        // Only mark as blocked if it's not already a clue cell
        if (!occupiedCells.has(prevCellKey)) {
          blockedCells.add(prevCellKey);
        }
      }
      
      // Mark the cell after the last answer cell as blocked
      // This prevents words from merging - the cell must remain empty or become a clue cell
      const lastAnswerCell = answerCellsForSlot[answerCellsForSlot.length - 1];
      const nextCellAfterAnswer = getNextCellAfterAnswer(direction, lastAnswerCell, config.rows, config.cols);
      if (nextCellAfterAnswer !== null) {
        const nextCellKey = `${nextCellAfterAnswer.row},${nextCellAfterAnswer.col}`;
        // Only mark as blocked if it's not already a clue cell
        if (!occupiedCells.has(nextCellKey)) {
          blockedCells.add(nextCellKey);
        }
      }
      
      placed = true;
      slotNumber++;
      consecutiveFailures = 0; // Reset failure counter on success
      placementAttempts++;
      
      // Log progress every 10 slots or when we reach milestones
      if (slots.length % 10 === 0 || slots.length === config.minSlots) {
        const currentFilledLog = answerCells.size + occupiedCells.size;
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
      const currentFilledLog = answerCells.size + occupiedCells.size;
      const currentCoverageLog = currentFilledLog / initialGridCells;
      
      // If we couldn't place a slot after many attempts, log and potentially stop
      if (attempts >= maxPlacementAttempts) {
        // If we have minSlots and are at least 90% dense, stop
        if (slots.length >= config.minSlots && currentCoverageLog >= 0.90) {
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
    
    // SOLVABILITY: Keep slots with up to 15 crossings initially
    // We'll filter more aggressively in the second pass, but keep more initially
    // to ensure we have enough slots to meet the minimum
    const hardCap = 15; // Allow up to 15 crossings initially (increased from 12)
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
  // Build a set of all clue cell positions
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
    
    // With 6M clues: Keep slots with up to 12 crossings for ultra-dense puzzles
    // Progressive limits: earlier slots can have fewer crossings
    // Much more lenient to keep as many slots as possible
    const progressRatio = i / validatedSlots.length;
    let maxAllowed: number;
    if (progressRatio < 0.40) {
      maxAllowed = 10; // First 40%: max 10 crossings
    } else if (progressRatio < 0.80) {
      maxAllowed = 11; // Next 40%: max 11 crossings
    } else {
      maxAllowed = 12; // Last 20%: max 12 crossings (config max)
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
    
    // Build clue cell set ONLY from slots we're keeping (finalFilteredSlots)
    // This allows us to re-add filtered-out slots if their clue cells aren't taken
    const clueCellSet = new Set<string>();
    for (const slot of finalFilteredSlots) {
      clueCellSet.add(`${slot.startRow},${slot.startCol}`);
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
      
      // Check if clue cell is already taken
      const clueKey = `${slot.startRow},${slot.startCol}`;
      if (clueCellSet.has(clueKey)) {
        continue; // Clue cell already taken
      }
      
      // Check if answer cells overlap with clue cells
      const slotCells = getSlotCells(slot);
      let hasClueOverlap = false;
      for (const cell of slotCells) {
        const cellKey = `${cell.row},${cell.col}`;
        if (clueCellSet.has(cellKey)) {
          hasClueOverlap = true;
          break;
        }
      }
      if (hasClueOverlap) continue; // Skip slots that overlap with clue cells
      
      // With 6M clues, we can handle more crossings - be more aggressive
      // Cap at 15 crossings for ultra-dense puzzles
      const relaxedLimit = 15;
      if (crossings <= relaxedLimit) {
        // Double-check clue cell is still available before adding
        if (!clueCellSet.has(clueKey)) {
          finalFilteredSlots.push(slot);
          clueCellSet.add(clueKey); // Add this slot's clue cell
          added++;
          console.log(`  ✅ Re-added slot ${slot.id} with ${crossings} crossings (relaxed limit: ${relaxedLimit})`);
        } else {
          console.log(`  ⚠️  Skipped re-adding slot ${slot.id}: clue cell (${slot.startRow},${slot.startCol}) already taken`);
        }
      }
    }
    console.log(`  ✅ Relaxed filtering: Added ${added} more slots. Total: ${finalFilteredSlots.length}`);
  }
  
    
  if (finalFilteredSlots.length >= config.minSlots) {
    console.log(`  ✅ Generated ${finalFilteredSlots.length} slots with ${clueCells.length} unique clue cells`);
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