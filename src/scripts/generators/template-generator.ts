/**
 * Template Generator for Swedish Arrow Crossword Puzzles
 * 
 * Generates grid templates with strategic slot placement and crossings
 */
import { Direction, GridTemplate, ClueSlot, Difficulty } from '../core/types';
import { getSlotCells, getAnswerOrientation, getNextCellAfterAnswer, getCellBeforeAnswer } from './direction-utils';
import { 
  validateWordBoundaries, 
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
    xsmall: { rows: 9, cols: 9, minSlots: 18, maxCrossingsPerSlot: 10 },
    small: { rows: 10, cols: 10, minSlots: 20, maxCrossingsPerSlot: 10},
    medium: { rows: 11, cols: 11, minSlots: 22, maxCrossingsPerSlot: 10 },
    large: { rows: 12, cols: 12, minSlots: 24, maxCrossingsPerSlot: 12 },
    xlarge: { rows: 13, cols: 13, minSlots: 26, maxCrossingsPerSlot: 12 },
    xxlarge: { rows: 14, cols: 14, minSlots: 28, maxCrossingsPerSlot: 12 }
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
  const targetSlots = config.minSlots;
  
  const allDirections: Direction[] = ['across', 'down', 'right-down', 'left-down', 'down-across', 'up-across'];
  const directionUsage = new Map<Direction, number>();
  allDirections.forEach(dir => directionUsage.set(dir, 0));
  
  // Create a balanced distribution - each direction appears multiple times
  const directions: Direction[] = [];
  for (let i = 0; i < Math.ceil(targetSlots / allDirections.length) + 2; i++) {
    directions.push(...allDirections);
  }
  // Shuffle for randomness
  for (let i = directions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [directions[i], directions[j]] = [directions[j], directions[i]];
  }

  // Try to place targetSlots slots, but ensure we place at least minSlots
  // If we can't place enough slots, we'll throw an error after the loop
  const slotsToPlace = Math.max(config.minSlots, targetSlots);
  for (let i = 0; i < slotsToPlace && slotNumber <= slotsToPlace; i++) {
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
      if (i < allDirections.length) {
        // First 6 slots: use each direction once to ensure all are used
        direction = allDirections[i];
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
      const progressRatio = slots.length / Math.max(config.minSlots, targetSlots);
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
        
        // 70% chance to place near existing answer cells for crossings
        // 30% chance to place near empty cells to fill gaps
        if (Math.random() < 0.70 && answerCells.size > 0) {
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
      
      const progressRatioForCrossings = slots.length / Math.max(config.minSlots, targetSlots);
      
      
      // Strictly enforce crossing limits during placement
      // This prevents placing slots that will be filtered out later
      if (crossingCount > config.maxCrossingsPerSlot) {
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
  
  // GAP-FILLING: Add more slots to fill empty areas and increase density
  // Only for harder puzzles (disabled for easy)
  let gapFilledSlots = [...finalFilteredSlots];
  let gapFilledAnswerCells = new Map<string, { slotId: string; position: number }>();
  let gapFilledOccupiedCells = new Set<string>();
  let gapFilledBlockedCells = new Set<string>(blockedCells); // Copy blocked cells from initial placement
  
  // Rebuild answer cells and occupied cells from final filtered slots
  for (const slot of finalFilteredSlots) {
    gapFilledOccupiedCells.add(`${slot.startRow},${slot.startCol}`);
    const answerCells = getSlotCells(slot);
    for (let j = 0; j < answerCells.length; j++) {
      const cell = answerCells[j];
      const cellKey = `${cell.row},${cell.col}`;
      gapFilledAnswerCells.set(cellKey, { slotId: slot.id, position: j });
    }
    // Also mark the cell BEFORE the first answer cell as blocked
    const firstAnswerCell = answerCells[0];
    const cellBeforeAnswer = getCellBeforeAnswer(slot.direction, firstAnswerCell, config.rows, config.cols);
    if (cellBeforeAnswer !== null) {
      const prevCellKey = `${cellBeforeAnswer.row},${cellBeforeAnswer.col}`;
      if (!gapFilledOccupiedCells.has(prevCellKey)) {
        gapFilledBlockedCells.add(prevCellKey);
      }
    }
    
    // Also mark the cell after the last answer cell as blocked
    const lastAnswerCell = answerCells[answerCells.length - 1];
    const nextCellAfterAnswer = getNextCellAfterAnswer(slot.direction, lastAnswerCell, config.rows, config.cols);
    if (nextCellAfterAnswer !== null) {
      const nextCellKey = `${nextCellAfterAnswer.row},${nextCellAfterAnswer.col}`;
      if (!gapFilledOccupiedCells.has(nextCellKey)) {
        gapFilledBlockedCells.add(nextCellKey);
      }
    }
  }

  // Gap-filling: Only for harder puzzles, disabled for easy puzzles
  // Initialize gap-filled structures (will be populated during gap-filling if enabled)
  const totalCells = config.rows * config.cols;
  let gapFilledCount = 0;

  // Calculate current coverage
  const currentCoverage = (gapFilledAnswerCells.size + gapFilledOccupiedCells.size) / totalCells;
  
  // Target coverage based on difficulty (easier = less dense)
  const targetCoverage = 0.90;
  const maxEmptyCells = Math.max(1, Math.floor(totalCells * (1 - targetCoverage)));
  const targetFilledCells = totalCells - maxEmptyCells;
  const currentFilledCells = gapFilledAnswerCells.size + gapFilledOccupiedCells.size;
  const cellsNeeded = Math.max(0, targetFilledCells - currentFilledCells);
  
  console.log(`  🎯 Density target: ${targetFilledCells}/${totalCells} cells (${(targetCoverage * 100).toFixed(1)}% coverage)`);
  console.log(`  📊 Current: ${currentFilledCells}/${totalCells} cells (${(currentCoverage * 100).toFixed(1)}%)`);
  console.log(`  📊 Need to fill: ${cellsNeeded} more cells`);

  let gapFillAttempts = 0;
  let lastProgressCount = 0;
  let noProgressCount = 0;
  // Limits based on difficulty
  const maxGapFillAttempts = difficulty === Difficulty.EASY ? 5000 : difficulty === Difficulty.MEDIUM ? 20000 : 50000;
  const maxNoProgressAttempts = difficulty === Difficulty.EASY ? 500 : difficulty === Difficulty.MEDIUM ? 2000 : 5000;
  
  // Keep going until we reach target empty cells
  while (gapFillAttempts < maxGapFillAttempts) {
    gapFillAttempts++;
  
  // Check current coverage - stop when we reach 99%+ or within 5 cells of target
  const currentFilled = gapFilledAnswerCells.size + gapFilledOccupiedCells.size;
  const currentEmpty = totalCells - currentFilled;
  const currentCoverageCheck = currentFilled / totalCells;
  
  // Early exit if we've reached target coverage (99%+)
  if (currentCoverageCheck >= targetCoverage || currentEmpty <= maxEmptyCells) {
    console.log(`  ✅ Gap-filling complete: ${currentEmpty} empty cells (${(currentCoverageCheck * 100).toFixed(1)}% coverage) with ${gapFilledCount} additional slots`);
    break;
  }
  
  // Early exit if we're very close (within 5 cells)
  if (currentEmpty <= maxEmptyCells + 5) {
    console.log(`  ✅ Gap-filling: Very close to target (${currentEmpty} empty cells, ${(currentCoverageCheck * 100).toFixed(1)}% coverage) with ${gapFilledCount} additional slots`);
    break;
  }
  
  if (gapFilledCount === lastProgressCount) {
    noProgressCount++;
    // Only exit if we're very close to target (within 10 cells) OR no progress for very long
    const closeToTarget = currentEmpty <= maxEmptyCells + 10;
    if (noProgressCount >= maxNoProgressAttempts && !closeToTarget) {
      noProgressCount = 0;
    } else if (noProgressCount >= maxNoProgressAttempts * 3) {
      // After 3x the normal limit, give up
      console.log(`  ⚠️  Gap-filling: No progress for ${maxNoProgressAttempts * 3} attempts, stopping`);
      console.log(`  📊 Final: ${currentEmpty} empty cells (${(currentCoverageCheck * 100).toFixed(1)}% coverage) with ${gapFilledCount} additional slots`);
      break;
    }
  } else {
    lastProgressCount = gapFilledCount;
    noProgressCount = 0;
  }
  
  // Find ALL empty cells - prioritize those that will fill the most empty cells
  const emptyCells: Array<{ row: number; col: number; emptyNeighbors: number }> = [];
  for (let r = 0; r < config.rows; r++) {
    for (let c = 0; c < config.cols; c++) {
      const cellKey = `${r},${c}`;
      if (!gapFilledOccupiedCells.has(cellKey) && !gapFilledAnswerCells.has(cellKey)) {
        // Count how many empty neighbors this cell has (potential for filling)
        let emptyNeighbors = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const checkRow = r + dr;
            const checkCol = c + dc;
            if (checkRow >= 0 && checkRow < config.rows && checkCol >= 0 && checkCol < config.cols) {
              const checkKey = `${checkRow},${checkCol}`;
              if (!gapFilledOccupiedCells.has(checkKey) && !gapFilledAnswerCells.has(checkKey)) {
                emptyNeighbors++;
              }
            }
          }
        }
        emptyCells.push({ row: r, col: c, emptyNeighbors });
      }
    }
  }
  
  if (emptyCells.length === 0) break; // No more empty cells
  
  // Prioritize cells with many empty neighbors (will fill more cells)
  emptyCells.sort((a, b) => b.emptyNeighbors - a.emptyNeighbors);
  // Pick from top 30% of cells with most empty neighbors
  const topCells = emptyCells.slice(0, Math.max(1, Math.floor(emptyCells.length * 0.3)));
  
  // Pick a random cell from top candidates (those with most empty neighbors)
  const targetCell = topCells[Math.floor(Math.random() * topCells.length)];
  
  // Try to place a slot starting near this cell
  const direction = allDirections[Math.floor(Math.random() * allDirections.length)];
  let startRow = targetCell.row;
  let startCol = targetCell.col;
  
  // Adjust for direction constraints
  if (direction === 'left-down' && startCol < 3) startCol = Math.max(3, startCol);
  if (direction === 'up-across' && startRow < 2) startRow = Math.max(2, startRow);
  if (direction === 'right-down' && startCol >= config.cols - 1) startCol = Math.max(0, config.cols - 2);
  if (direction === 'down-across' && startRow >= config.rows - 1) startRow = Math.max(0, config.rows - 2);
  
  const minGapLength = difficulty === Difficulty.EASY ? 3 : difficulty === Difficulty.MEDIUM ? 4 : 5;
  const maxGapLength = selectedSize === 'xsmall' ? 9 : selectedSize === 'small' ? 10 : selectedSize === 'medium' ? 12 : selectedSize === 'large' ? 14 : selectedSize === 'xlarge' ? 15 : 15;
  const wordLength = Math.floor(Math.random() * (maxGapLength - minGapLength + 1)) + minGapLength;
  
  const tempSlot: ClueSlot = {
    id: 'gap_fill',
    direction,
    startRow,
    startCol,
    length: wordLength,
    crossings: []
  };
  
  const answerCellsForSlot = getSlotCells(tempSlot);
  
  // Check bounds
  const lastCell = answerCellsForSlot[answerCellsForSlot.length - 1];
  if (lastCell.row < 0 || lastCell.row >= config.rows || lastCell.col < 0 || lastCell.col >= config.cols) {
    continue;
  }
  
  // Validate that words can only start/end at grid bounds, clue cells, or blocked cells
  // Check boundaries to prevent word merging
  // Convert Map keys to Set for checkAnswerBoundaries
  const gapFilledAnswerCellPositions = new Set(gapFilledAnswerCells.keys());
  if (!checkAnswerBoundaries(direction, answerCellsForSlot, config.rows, config.cols, gapFilledAnswerCellPositions)) {
    continue; // Would merge with another answer cell - skip this slot
  }
  
  // Check if clue cell is available AND doesn't overlap with answer cells
  const clueKey = `${startRow},${startCol}`;
  if (gapFilledOccupiedCells.has(clueKey)) {
    continue; // Clue cell already taken by another clue
  }
  
  // CRITICAL FIX: Clue cell cannot be in an answer cell position
  if (gapFilledAnswerCells.has(clueKey)) {
    continue; // Clue cell overlaps with an answer cell - invalid!
  }
  
  // Clue cell cannot be in a blocked cell position
  if (gapFilledBlockedCells.has(clueKey)) {
    continue; // Clue cell overlaps with a blocked cell - invalid!
  }
  
  // Check for conflicts - answer cells cannot overlap with clue cells
  let canPlace = true;
  let crossingCount = 0;
  const crossingSlots = new Set<string>();
  
  // First check: make sure clue cell itself is available (already checked above, but double-check)
  if (gapFilledOccupiedCells.has(clueKey)) {
    canPlace = false;
  }
  
  // Second check: make sure answer cells don't overlap with clue cells
  // Also check for parallel overlaps (same direction sharing cells)
  if (canPlace) {
    const testOrientation = getAnswerOrientation(direction);
    
    for (const cell of answerCellsForSlot) {
      const cellKey = `${cell.row},${cell.col}`;
      
      // Answer cells cannot be in clue cells
      if (gapFilledOccupiedCells.has(cellKey)) {
        canPlace = false;
        break;
      }
      
      // Answer cells cannot be in blocked cells (these must remain empty or become clue cells)
      if (gapFilledBlockedCells.has(cellKey)) {
        canPlace = false;
        break;
      }
      
      // Count crossings with other slots - ONLY if perpendicular
      if (gapFilledAnswerCells.has(cellKey)) {
        const existingSlotInfo = gapFilledAnswerCells.get(cellKey);
        if (existingSlotInfo) {
          // Find the existing slot to check its orientation
          const existingSlot = gapFilledSlots.find(s => s.id === existingSlotInfo.slotId);
          if (existingSlot) {
            const existingOrientation = getAnswerOrientation(existingSlot.direction);
            
            // Parallel overlaps (same direction) are INVALID
            if (testOrientation === existingOrientation) {
              canPlace = false; // Cannot share cells with same direction
              break;
            }
            
            // Only count as crossing if perpendicular
            if (existingOrientation !== testOrientation) {
              crossingSlots.add(existingSlotInfo.slotId);
            }
          }
        }
      }
    }
  }
  
  crossingCount = crossingSlots.size; // Number of different slots we cross with
  
  // MAXIMUM DENSITY: Allow many crossings during gap filling
  // Count how many empty cells this slot would fill
  let emptyCellsFilled = 0;
  for (const cell of answerCellsForSlot) {
    const cellKey = `${cell.row},${cell.col}`;
    if (!gapFilledOccupiedCells.has(cellKey) && !gapFilledAnswerCells.has(cellKey)) {
      emptyCellsFilled++;
    }
  }
  
  // For gap-filling with 6M clues, be ULTRA-lenient - allow up to 20 crossings
  // Priority is filling empty cells - crossings don't matter as much here
  // These slots are added AFTER initial solve, so they can have more constraints
  if (canPlace && crossingCount <= 20) {
    // STRONGLY prefer slots that fill empty cells
    // If we have many empty cells, only accept slots that fill at least 2
    // If we're close to target, accept ANY slot that fills at least 1
    const currentEmpty = totalCells - (gapFilledAnswerCells.size + gapFilledOccupiedCells.size);
    const minEmptyCellsToFill = currentEmpty > maxEmptyCells + 15 ? 2 : 1;
    if (emptyCellsFilled < minEmptyCellsToFill && Math.random() < 0.85) {
      continue; // 85% chance to skip slots that don't fill enough empty cells
    }
    
    // clue cell cannot be in an answer cell
    if (gapFilledAnswerCells.has(clueKey)) {
      continue; // Clue cell overlaps with answer cell - invalid!
    }
    
    // ensure answer cells don't start immediately after another answer cell
    // Re-validate the cell before the first answer cell
    const firstCell = answerCellsForSlot[0];
    const cellBeforeAnswerFinal = getCellBeforeAnswer(direction, firstCell, config.rows, config.cols);
    if (cellBeforeAnswerFinal !== null) {
      const prevCellKey = `${cellBeforeAnswerFinal.row},${cellBeforeAnswerFinal.col}`;
      if (gapFilledAnswerCells.has(prevCellKey)) {
        // This would cause word merging - invalid!
        continue;
      }
      // Must be clue cell, blocked cell, or empty (will be marked as blocked when slot is placed)
      // Empty is OK here because we'll mark it as blocked immediately after validation
    }
    
    // ensure answer cells don't end immediately before another answer cell
    // This is the KEY validation: cell after last answer letter must be boundary/clue/block
    // Reuse lastCell from earlier
    const nextCellAfterAnswerFinal = getNextCellAfterAnswer(direction, lastCell, config.rows, config.cols);
    if (nextCellAfterAnswerFinal !== null) {
      const nextCellKey = `${nextCellAfterAnswerFinal.row},${nextCellAfterAnswerFinal.col}`;
      if (gapFilledAnswerCells.has(nextCellKey)) {
        // This would cause word merging - invalid!
        continue;
      }
      // Must be clue cell, blocked cell, or empty (will be marked as blocked when slot is placed)
      // Empty is OK here because we'll mark it as blocked immediately after validation
    }
    
    const gapSlotId = `gap_slot_${slotNumber}`;
    const gapSlot: ClueSlot = {
      id: gapSlotId,
      direction,
      startRow,
      startCol,
      length: wordLength,
      crossings: []
    };
    
    gapFilledSlots.push(gapSlot);
    gapFilledOccupiedCells.add(clueKey);
    
    for (let j = 0; j < answerCellsForSlot.length; j++) {
      const cell = answerCellsForSlot[j];
      const cellKey = `${cell.row},${cell.col}`;
      gapFilledAnswerCells.set(cellKey, { slotId: gapSlotId, position: j });
    }
    
    // Mark the cell BEFORE the first answer cell as blocked
    // This prevents words from merging - the cell must remain empty or become a clue cell
    // Reuse cellBeforeAnswerFinal from earlier validation
    if (cellBeforeAnswerFinal !== null) {
      const prevCellKey = `${cellBeforeAnswerFinal.row},${cellBeforeAnswerFinal.col}`;
      // Only mark as blocked if it's not already a clue cell
      if (!gapFilledOccupiedCells.has(prevCellKey)) {
        gapFilledBlockedCells.add(prevCellKey);
      }
    }
    
    // Mark the cell after the last answer cell as blocked
    // This prevents words from merging - the cell must remain empty or become a clue cell
    // Reuse nextCellAfterAnswerFinal from earlier validation
    if (nextCellAfterAnswerFinal !== null) {
      const nextCellKey = `${nextCellAfterAnswerFinal.row},${nextCellAfterAnswerFinal.col}`;
      // Only mark as blocked if it's not already a clue cell
      if (!gapFilledOccupiedCells.has(nextCellKey)) {
        gapFilledBlockedCells.add(nextCellKey);
      }
    }
    
    gapFilledCount++;
    slotNumber++;
    
    // Update coverage tracking
    const newFilled = gapFilledAnswerCells.size + gapFilledOccupiedCells.size;
    const newEmpty = totalCells - newFilled;
    const newCoverage = newFilled / totalCells;
    
    if (newEmpty <= maxEmptyCells) {
      // We've reached target (5 empty cells max for xlarge)
      console.log(`  ✅ Gap-filling complete: ${newEmpty} empty cells (${(newCoverage * 100).toFixed(1)}% coverage) with ${gapFilledCount} additional slots`);
      break;
    }
    
    // Also stop if we're very close (within 5 cells) and have added reasonable slots
    if (newEmpty <= maxEmptyCells + 5 && gapFilledCount >= 5) {
      console.log(`  ✅ Gap-filling: ${newEmpty} empty cells (${(newCoverage * 100).toFixed(1)}% coverage) with ${gapFilledCount} additional slots`);
      break;
    }
    
    // Early exit if we have good coverage
    if (newCoverage >= 0.95 && gapFilledCount >= 5) {
      console.log(`  ✅ Gap-filling: Good coverage achieved (${(newCoverage * 100).toFixed(1)}%) with ${gapFilledCount} additional slots`);
      break;
    }
    
    // If we're making progress but not there yet, continue
    // Don't stop early - keep going until we're close
  }
  } // End of while loop
  
  if (gapFilledCount > 0) {
    console.log(`  ✅ Gap-filling: Added ${gapFilledCount} additional slots to increase density`);
  }
  
  // Recalculate crossings for gap-filled slots
  recalculateCrossings(gapFilledSlots);
  
  // Validate that gap-filled slots' answer cells only overlap at registered crossing points
  // If two slots share cells but have no crossing registered, that's invalid
  const { invalidSlots: gapFilledSlotsWithInvalidOverlaps, errors: gapFilledOverlapErrors } = validateOverlapsAreCrossings(gapFilledSlots);
  for (const error of gapFilledOverlapErrors) {
    console.log(`  ⚠️  ${error}`);
  }
  
  // Remove slots with invalid overlaps
  if (gapFilledSlotsWithInvalidOverlaps.length > 0) {
    console.log(`  ⚠️  Removing ${gapFilledSlotsWithInvalidOverlaps.length} gap-filled slots with invalid answer cell overlaps`);
    const validGapFilledSlots = gapFilledSlots.filter(s => !gapFilledSlotsWithInvalidOverlaps.includes(s));
    // Recalculate crossings for remaining slots
    recalculateCrossings(validGapFilledSlots);
    // Replace gapFilledSlots with valid slots
    gapFilledSlots.length = 0;
    gapFilledSlots.push(...validGapFilledSlots);
  }
  
  // Re-sort after gap filling
  gapFilledSlots.sort((a, b) => a.crossings.length - b.crossings.length);
  
  // remove slots where answer cells overlap with clue cells
  // Build set of all clue cell positions
  const gapFilledClueCellPositions = new Set<string>();
  for (const slot of gapFilledSlots) {
    gapFilledClueCellPositions.add(`${slot.startRow},${slot.startCol}`);
  }
  
  // Filter out slots with invalid overlaps, but be lenient if we're below minimum
  const validatedGapFilledSlots: typeof gapFilledSlots = [];
  const slotsWithOverlaps: typeof gapFilledSlots = [];
  
  for (const slot of gapFilledSlots) {
    const answerCells = getSlotCells(slot);
    if (!hasAnswerClueOverlap(answerCells, gapFilledClueCellPositions)) {
      validatedGapFilledSlots.push(slot);
    } else {
      slotsWithOverlaps.push(slot);
      // Only log if we have plenty of slots
      if (validatedGapFilledSlots.length > config.minSlots * 1.2) {
        console.log(`  ⚠️  Filtered out gap-filled slot ${slot.id}: answer cells overlap with clue cells`);
      }
    }
  }
  
  // If we're below minimum, be more lenient about overlaps
  if (validatedGapFilledSlots.length < config.minSlots && slotsWithOverlaps.length > 0) {
    console.log(`  ⚠️  Below minimum slots (${validatedGapFilledSlots.length}/${config.minSlots}), being lenient with overlaps...`);
    // Sort by crossing count to prefer easier slots
    slotsWithOverlaps.sort((a, b) => a.crossings.length - b.crossings.length);
    // Keep slots with overlaps if they have reasonable crossings (max 8)
    for (const slot of slotsWithOverlaps) {
      if (validatedGapFilledSlots.length >= config.minSlots) break;
      // Cap at 8 crossings even when desperate - overlaps make it harder
      if (slot.crossings.length <= 8) {
        validatedGapFilledSlots.push(slot);
      }
    }
  }
  
  // Final filter: Remove slots with too many crossings, but be lenient if below minimum
  const finalGapFilledSlots: typeof validatedGapFilledSlots = [];
  const slotsWithManyCrossings: typeof validatedGapFilledSlots = [];
  
  for (let i = 0; i < validatedGapFilledSlots.length; i++) {
    const slot = validatedGapFilledSlots[i];
    const crossings = slot.crossings.length;
    
    // With 6M clues: Keep gap-filled slots with up to 12 crossings for ultra-dense puzzles
    const maxAllowed = 12;
    if (crossings <= maxAllowed) {
      finalGapFilledSlots.push(slot);
    } else {
      slotsWithManyCrossings.push(slot);
    }
  }
  
  // If we're below minimum, be more lenient about crossings, but cap at reasonable limit
  if (finalGapFilledSlots.length < config.minSlots && slotsWithManyCrossings.length > 0) {
    console.log(`  ⚠️  Below minimum slots (${finalGapFilledSlots.length}/${config.minSlots}), being lenient with crossings...`);
    // Sort by crossing count (ascending) to prefer easier slots
    slotsWithManyCrossings.sort((a, b) => a.crossings.length - b.crossings.length);
    // Keep slots with more crossings if we're desperate, but cap at 10 for solvability
    for (const slot of slotsWithManyCrossings) {
      if (finalGapFilledSlots.length >= config.minSlots) break;
      // With 6M clues: Allow up to 15 crossings for ultra-dense puzzles
      if (slot.crossings.length <= 15) {
      finalGapFilledSlots.push(slot);
      }
    }
  }
  
  // Final safety filter - with 6M clues, allow up to 15 crossings for ultra-dense puzzles
  // This is much higher than before because we have many more word options
  const safeSlots = finalGapFilledSlots.filter(slot => slot.crossings.length <= 15);
  const removedExcessive = finalGapFilledSlots.length - safeSlots.length;
  if (removedExcessive > 0) {
    console.warn(`  ⚠️  Removed ${removedExcessive} slots with excessive crossings (>15)`);
  }
  
  // Recalculate clue cells for safe slots and ensure uniqueness
  // Each clue cell position must be unique - no two slots can share the same clue cell
  const clueCellPositions = new Map<string, { row: number; col: number; direction: Direction; slotId: string }>();
  const filteredClueCells: Array<{ row: number; col: number; direction: Direction }> = [];
  
  // First pass: collect all clue cells and detect duplicates
  const duplicateSlots: string[] = [];
  for (const slot of safeSlots) {
    const clueKey = `${slot.startRow},${slot.startCol}`;
    if (clueCellPositions.has(clueKey)) {
      // Duplicate detected - this slot shares a clue cell with another slot
      const existing = clueCellPositions.get(clueKey)!;
      console.warn(`  ⚠️  Duplicate clue cell detected at (${slot.startRow},${slot.startCol}): slot ${slot.id} conflicts with slot ${existing.slotId}`);
      duplicateSlots.push(slot.id);
    } else {
      clueCellPositions.set(clueKey, {
        row: slot.startRow,
        col: slot.startCol,
        direction: slot.direction,
        slotId: slot.id
      });
    }
  }
  
  // Remove duplicate slots (keep the first one encountered)
  const uniqueSlots = safeSlots.filter(slot => !duplicateSlots.includes(slot.id));
  
  if (duplicateSlots.length > 0) {
    console.warn(`  ⚠️  Removed ${duplicateSlots.length} slots with duplicate clue cells. Remaining: ${uniqueSlots.length} slots`);
  }
  
  // Build clue cells array from unique slots
  for (const slot of uniqueSlots) {
    filteredClueCells.push({
      row: slot.startRow,
      col: slot.startCol,
      direction: slot.direction
    });
  }
  
  // Ensure we have exactly one clue cell per slot
  if (filteredClueCells.length !== uniqueSlots.length) {
    console.error(`  ❌ Clue cells count (${filteredClueCells.length}) doesn't match unique slots count (${uniqueSlots.length})`);
  }
  
  // Update safeSlots to use unique slots
  safeSlots.length = 0;
  safeSlots.push(...uniqueSlots);
  
  // Calculate average crossings for metadata
  const avgCrossings = safeSlots.length > 0 
    ? safeSlots.reduce((sum, s) => sum + s.crossings.length, 0) / safeSlots.length 
    : 0;
  
  // Calculate grid density (percentage of cells used)
  const gridTotalCells = config.rows * config.cols;
  const usedCells = new Set<string>();
  for (const slot of safeSlots) {
    const answerCells = getSlotCells(slot);
    for (const cell of answerCells) {
      usedCells.add(`${cell.row},${cell.col}`);
    }
  }
  const densityPercent = ((usedCells.size / gridTotalCells) * 100).toFixed(1);
  
  console.log(`  📊 Final template: ${safeSlots.length} slots, ${densityPercent}% cell coverage, ${avgCrossings.toFixed(2)} avg crossings`);
  
  // Ensure we have enough slots - if below minimum, be more lenient and keep more slots
  if (safeSlots.length < config.minSlots) {
    console.warn(`⚠️  Warning: Only ${safeSlots.length} slots generated, but minimum is ${config.minSlots} for ${selectedSize} size`);
    
    // If we're below minimum, be VERY lenient and re-add filtered slots
    const needed = config.minSlots - safeSlots.length;
    let added = 0;
    
    // Re-add slots that were filtered out, but only if they have reasonable crossings
    // Sort by crossing count to prefer easier slots
    const availableSlots = validatedGapFilledSlots
      .filter(s => !safeSlots.includes(s))
      .sort((a, b) => a.crossings.length - b.crossings.length);
    
    // Build a set of clue cell positions from current safe slots to prevent duplicates
    const currentClueCellSet = new Set<string>();
    for (const slot of safeSlots) {
      currentClueCellSet.add(`${slot.startRow},${slot.startCol}`);
    }
    
    for (const slot of availableSlots) {
      if (added >= needed) break;
      const slotClueKey = `${slot.startRow},${slot.startCol}`;
      if (slot.crossings.length <= 10 && !currentClueCellSet.has(slotClueKey)) {
        safeSlots.push(slot);
        currentClueCellSet.add(slotClueKey);
        added++;
      }
    }
    
    // If still not enough, re-add from gap-filled slots that were filtered for overlaps
    // But only if they have reasonable crossings
    if (safeSlots.length < config.minSlots) {
      const overlapFiltered = gapFilledSlots
        .filter(s => !validatedGapFilledSlots.includes(s))
        .sort((a, b) => a.crossings.length - b.crossings.length);
      
      for (const slot of overlapFiltered) {
        if (safeSlots.length >= config.minSlots) break;
        // Be desperate - add even slots with overlaps if crossings are reasonable (max 10)
        const slotClueKey = `${slot.startRow},${slot.startCol}`;
        if (slot.crossings.length <= 10 && !currentClueCellSet.has(slotClueKey)) {
          safeSlots.push(slot);
          currentClueCellSet.add(slotClueKey);
          added++;
        }
      }
    }
    
    if (added > 0) {
      console.log(`  ✅ Re-added ${added} slots to meet minimum requirement`);
    }
  }
  
  // Ensure clue cells exactly match slots (one-to-one relationship)
  // Note: filteredClueCells and safeSlots are defined earlier in the function
  if (filteredClueCells.length !== safeSlots.length) {
    console.error(`  ❌ CRITICAL ERROR: Clue cells (${filteredClueCells.length}) don't match slots (${safeSlots.length})`);
    // Rebuild clue cells from slots to fix the mismatch
    const rebuiltClueCells = safeSlots.map(slot => ({
      row: slot.startRow,
      col: slot.startCol,
      direction: slot.direction
    }));
    console.log(`  🔧 Rebuilt clue cells array: ${rebuiltClueCells.length} clue cells`);
    filteredClueCells.length = 0;
    filteredClueCells.push(...rebuiltClueCells);
  }
  
  // Verify uniqueness one more time
  const finalClueCellSet = new Set<string>();
  for (const clueCell of filteredClueCells) {
    const key = `${clueCell.row},${clueCell.col}`;
    if (finalClueCellSet.has(key)) {
      console.error(`  ❌ Duplicate clue cell in final array at (${clueCell.row},${clueCell.col})`);
    }
    finalClueCellSet.add(key);
  }
  
  // --------------------------------------------------------------------------
  // xEnsure every slot follows the boundary rule
  // For each slot, the cell after the last answer letter must be:
  // - Out of bounds (grid boundary), OR
  // - A clue cell, OR  
  // - A blocked cell (neither clue nor answer)
  // --------------------------------------------------------------------------
  const finalClueCellPositions = new Set<string>();
  for (const clueCell of filteredClueCells) {
    finalClueCellPositions.add(`${clueCell.row},${clueCell.col}`);
  }
  
  const finalAnswerCellPositions = new Set<string>();
  for (const slot of safeSlots) {
    const slotCells = getSlotCells(slot);
    for (const cell of slotCells) {
      finalAnswerCellPositions.add(`${cell.row},${cell.col}`);
    }
  }
  
  // Compute blocked cells: cells that are neither clue nor answer
  const finalBlockedCells = new Set<string>();
  for (let r = 0; r < config.rows; r++) {
    for (let c = 0; c < config.cols; c++) {
      const key = `${r},${c}`;
      if (!finalClueCellPositions.has(key) && !finalAnswerCellPositions.has(key)) {
        finalBlockedCells.add(key);
      }
    }
  }
  
  // Validate each slot using consolidated validation function
  const validSlots: typeof safeSlots = [];
  const invalidSlots: typeof safeSlots = [];
  
  for (const slot of safeSlots) {
    const slotCells = getSlotCells(slot);
    if (slotCells.length === 0) {
      invalidSlots.push(slot);
      continue;
    }
    
    const validation = validateWordBoundaries(
      slot.direction,
      slotCells,
      config.rows,
      config.cols,
      finalClueCellPositions,
      finalAnswerCellPositions,
      finalBlockedCells
    );
    
    if (validation.isValid) {
      validSlots.push(slot);
    } else {
      invalidSlots.push(slot);
      console.warn(`  ⚠️  Slot ${slot.id} (${slot.direction}) fails boundary rule: ${validation.reason}`);
    }
  }
  
  if (invalidSlots.length > 0) {
    console.warn(`  ⚠️  Filtered out ${invalidSlots.length} slots that violate boundary rule. Valid slots: ${validSlots.length}`);
    
    // If we still have enough valid slots, use them
    if (validSlots.length >= config.minSlots) {
      // Recalculate crossings for valid slots only
      recalculateCrossings(validSlots);
      
      // Rebuild clue cells from valid slots only
      const validClueCells = validSlots.map(slot => ({
        row: slot.startRow,
        col: slot.startCol,
        direction: slot.direction
      }));
      
      // Calculate average crossings for metadata
      const avgCrossings = validSlots.length > 0 
        ? validSlots.reduce((sum, s) => sum + s.crossings.length, 0) / validSlots.length 
        : 0;
      
      if (validSlots.length >= config.minSlots) {
        console.log(`  ✅ Generated ${validSlots.length} valid slots with ${validClueCells.length} clue cells`);
      } else {
        console.warn(`  ⚠️  Only ${validSlots.length} valid slots (need ${config.minSlots}) - template may be invalid`);
      }
      
      return {
        id: `generated_${selectedSize}_${Date.now()}`,
        name: `Generated ${selectedSize} template`,
        rows: config.rows,
        cols: config.cols,
        slots: validSlots,
        clueCells: validClueCells,
        difficulty,
        categories: ['Generated'],
        metadata: {
          verified: false,
          successRate: avgCrossings <= 2 ? 0.8 : avgCrossings <= 3 ? 0.7 : 0.6,
          generated: true,
          size: selectedSize,
          avgCrossings: avgCrossings.toFixed(2)
        }
      };
    } else {
      // Not enough valid slots - return null or throw to trigger retry
      console.error(`  ❌ Not enough valid slots after boundary validation: ${validSlots.length}/${config.minSlots}`);
      throw new Error(`Template generation failed: only ${validSlots.length} valid slots after boundary validation (need ${config.minSlots})`);
    }
  }
  
  if (safeSlots.length >= config.minSlots) {
    console.log(`  ✅ Generated ${safeSlots.length} slots with ${filteredClueCells.length} unique clue cells`);
  } else {
    console.error(`  ❌ CRITICAL: Only ${safeSlots.length} slots (need ${config.minSlots}) - template is invalid`);
    // Throw error to trigger retry instead of returning invalid template
    throw new Error(`Template generation failed: only ${safeSlots.length} slots generated (need ${config.minSlots} for ${selectedSize} size)`);
  }
  
  return {
    id: `generated_${selectedSize}_${Date.now()}`,
    name: `Generated ${selectedSize} template`,
    rows: config.rows,
    cols: config.cols,
    slots: safeSlots,
    clueCells: filteredClueCells,
    difficulty,
    categories: ['Generated'],
    metadata: {
      verified: false,
      successRate: avgCrossings <= 2 ? 0.8 : avgCrossings <= 3 ? 0.7 : 0.6,
      generated: true,
      size: selectedSize,
      avgCrossings: avgCrossings.toFixed(2)
    }
  };
}