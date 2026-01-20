/**
 * Template Generator for Swedish Arrow Crossword Puzzles
 * 
 * Generates grid templates with strategic slot placement and crossings
 */

import { Direction, GridTemplate, ClueSlot, Difficulty } from '../core/types';
import { getSlotCells, getAnswerOrientation } from './direction-utils';

/**
 * Generate a template programmatically for larger, more complex puzzles
 * Creates a grid with strategic slot placement and crossings
 */
export function generateTemplate(
  size: 'tiny' | 'small' | 'medium' | 'large' | 'xlarge',
  difficulty: Difficulty = Difficulty.EASY
): GridTemplate {
  const sizeConfig = {
    // TINY: For EASY difficulty with ~1,700 words - small 7x7 grid
    tiny: { rows: 7, cols: 7, minSlots: 8, maxSlots: 15, maxCrossingsPerSlot: 4, density: 0.85 },
    small: { rows: 14, cols: 14, minSlots: 50, maxSlots: 100, maxCrossingsPerSlot: 10, density: 0.99 },
    medium: { rows: 11, cols: 11, minSlots: 25, maxSlots: 120, maxCrossingsPerSlot: 10, density: 0.99 },
    large: { rows: 15, cols: 15, minSlots: 80, maxSlots: 150, maxCrossingsPerSlot: 12, density: 0.99 },
    xlarge: { rows: 16, cols: 16, minSlots: 90, maxSlots: 180, maxCrossingsPerSlot: 12, density: 0.99 }
  };
  
  const config = sizeConfig[size];
  const slots: ClueSlot[] = [];
  const clueCells: Array<{ row: number; col: number; direction: Direction }> = [];
  const occupiedCells = new Set<string>(); // Track which cells have clues
  const answerCells = new Map<string, { slotId: string; position: number }>(); // Track answer cells for crossings
  
  // Generate slots with strategic placement for dense puzzles
  // With 6M clues, aim for maximum slots to achieve ultra-density
  let slotNumber = 1;
  // Aim for 80-90% of max slots to ensure we get enough for dense puzzles
  const targetRange = config.maxSlots - config.minSlots;
  const targetSlots = Math.floor(config.minSlots + (targetRange * 0.8) + Math.random() * (targetRange * 0.2));
  
  // Use all 6 directions evenly for variety
  // Track which directions have been used to ensure all are used
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
  
  for (let i = 0; i < targetSlots && slotNumber <= targetSlots; i++) {
    // Try to place a slot
    let placed = false;
    let attempts = 0;
    // MAXIMUM COMPUTE POWER: Use all available attempts for perfect placement
    // Significantly increased attempts to ensure we can place all slots
    // With 6M clues, use many more attempts to place all slots
    const maxPlacementAttempts = size === 'xlarge' ? 15000 : size === 'large' ? 12000 : size === 'medium' ? 8000 : 5000;
    
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
      if (i > targetSlots * 0.10 && answerCells.size > 0) {
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
      
      // IMPROVED: Better word length selection - use 3-5 letters for better solvability
      // The improved generator uses 3-5 letters which matches word lists better
      // Max word length based on grid size (tiny grids can't fit long words)
      const maxLength = size === 'tiny' ? 4 : size === 'small' ? 5 : size === 'medium' ? 5 : size === 'large' ? 6 : 7;
      const minLength = 3; // Start from 3 letters (improved generator approach)
      
      // IMPROVED: Optimal length selection - try different lengths and pick the one with most crossings
      // This is smarter than random selection
      let bestLength = 0;
      let bestCrossings = -1;
      let bestAnswerCells: Array<{ row: number; col: number }> = [];
      
      for (let testLength = minLength; testLength <= maxLength; testLength++) {
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
        
        // Check if clue cell is available
        const testClueKey = `${startRow},${startCol}`;
        if (occupiedCells.has(testClueKey)) {
          continue; // Clue cell already taken
        }
        
        // Check for conflicts and count perpendicular crossings
        let hasConflict = false;
        let crossingCount = 0;
        const testCrossingSlots = new Set<string>();
        const testOrientation = getAnswerOrientation(direction);
        
        // Check clue cell doesn't overlap with answer cells
        if (answerCells.has(testClueKey)) {
          hasConflict = true;
        }
        
        for (const cell of testAnswerCells) {
          const cellKey = `${cell.row},${cell.col}`;
          
          // Can't place answer in a clue cell
          if (occupiedCells.has(cellKey)) {
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
        
        if (!hasConflict && testCrossingSlots.size >= bestCrossings) {
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
      
      // Recalculate crossing count for the selected length (already validated in optimal selection)
      const crossingSlots = new Set<string>();
      const currentOrientation = getAnswerOrientation(direction);
      
      for (const cell of answerCellsForSlot) {
        const cellKey = `${cell.row},${cell.col}`;
        if (answerCells.has(cellKey)) {
          const existingSlotInfo = answerCells.get(cellKey);
          if (existingSlotInfo) {
            const existingSlot = slots.find(s => s.id === existingSlotInfo.slotId);
            if (existingSlot) {
              const existingOrientation = getAnswerOrientation(existingSlot.direction);
              // Only count perpendicular crossings
              if (existingOrientation !== currentOrientation) {
                crossingSlots.add(existingSlotInfo.slotId);
              }
            }
          }
        }
      }
      
      const crossingCount = crossingSlots.size; // Number of different slots we cross with (perpendicular only)
      const canPlace = true; // Already validated in optimal length selection
      
      // PROGRESSIVE CROSSING LIMITS: With 6M clues, be much more lenient
      // We need many slots for ultra-density - allow more crossings during placement
      const progressRatio = i / targetSlots;
      let maxAllowedCrossings: number;
      
      // Much more lenient limits to ensure we place enough slots
      if (progressRatio < 0.20) {
        maxAllowedCrossings = 8; // First 20%: max 8 crossings
      } else if (progressRatio < 0.50) {
        maxAllowedCrossings = 10; // Next 30%: max 10 crossings
      } else if (progressRatio < 0.80) {
        maxAllowedCrossings = 12; // Next 30%: max 12 crossings
      } else {
        maxAllowedCrossings = config.maxCrossingsPerSlot; // Last 20%: up to config max (12)
      }
      
      // CRITICAL: Strictly enforce crossing limits during placement
      // This prevents placing slots that will be filtered out later
      if (crossingCount > maxAllowedCrossings) {
        continue; // Too many crossings for this stage, try a different position
      }
      
      // Don't reject at-limit crossings - we need all the slots we can get for density
      // The filtering will handle any that are truly too constrained
      
      // With 6M clues: Be less strict about requiring crossings
      // Focus on placing as many slots as possible - crossings will come naturally
      if (crossingCount === 0 && i > targetSlots * 0.30) {
        // After 30% of slots, prefer crossings but don't be too strict
        // With huge clue database, we can fill gaps later
        const progressRatio = i / targetSlots;
        const slotsBehind = (i + 1) < (targetSlots * progressRatio * 0.7);
        const skipChance = slotsBehind ? 0.60 : 0.75; // Much less strict - prioritize slot count
        if (Math.random() < skipChance) {
          continue; // Skip some slots without crossings
        }
      }
      
      // Also prefer slots with MORE crossings (within limits) - give them priority
      if (crossingCount >= 2 && crossingCount < maxAllowedCrossings && i > targetSlots * 0.15) {
        // If we have good crossings, accept this slot more readily
        // This is handled by the skip logic above, but we can be explicit
      }
      
      // Bonus: Prefer slots with MORE crossings (within limits)
      if (crossingCount > 0 && crossingCount < maxAllowedCrossings && i > targetSlots * 0.25) {
        // If we have crossings but room for more, give this slot priority
        // This is handled implicitly by the skip logic above, but we can be more explicit
      }
      
      // Also prefer slots with MORE crossings (within limits)
      if (crossingCount > 0 && crossingCount < maxAllowedCrossings && i > targetSlots * 0.3) {
        // If we have some crossings but room for more, prefer this slot
        // (This is handled by the crossing count check above, but we can be more aggressive)
      }
      
      if (!canPlace) {
        continue;
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
      
      placed = true;
      slotNumber++;
    }
  }
  
  // Calculate crossings between slots
  // CRITICAL: Only register perpendicular crossings (horizontal x vertical)
  // Parallel overlaps (same direction) should NOT be registered as crossings
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const slotCells = getSlotCells(slot);
    const slotOrientation = getAnswerOrientation(slot.direction);
    
    for (let j = i + 1; j < slots.length; j++) {
      const otherSlot = slots[j];
      const otherCells = getSlotCells(otherSlot);
      const otherOrientation = getAnswerOrientation(otherSlot.direction);
      
      // Only register crossings for perpendicular slots
      // If same orientation, skip (parallel overlaps are invalid but handled by placement logic)
      if (slotOrientation === otherOrientation) {
        continue;
      }
      
      // Find crossing points (only for perpendicular slots)
      for (let pos = 0; pos < slotCells.length; pos++) {
        const cell = slotCells[pos];
        const cellKey = `${cell.row},${cell.col}`;
        
        for (let otherPos = 0; otherPos < otherCells.length; otherPos++) {
          const otherCell = otherCells[otherPos];
          if (cell.row === otherCell.row && cell.col === otherCell.col) {
            // Found a valid perpendicular crossing!
            slot.crossings.push({
              slotId: otherSlot.id,
              thisPosition: pos,
              otherPosition: otherPos
            });
            otherSlot.crossings.push({
              slotId: slot.id,
              thisPosition: otherPos,
              otherPosition: pos
            });
            break; // Only one crossing per cell pair
          }
        }
      }
    }
  }
  
  // CRITICAL: Sort slots by crossing count (fewest first)
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
  
  // CRITICAL: Validate that no answer cells overlap with clue cells
  // Build a set of all clue cell positions
  const allClueCellPositions = new Set<string>();
  for (const slot of filteredSlots) {
    allClueCellPositions.add(`${slot.startRow},${slot.startCol}`);
  }
  
  // Filter out any slots whose answer cells overlap with clue cells
  const validatedSlots: typeof filteredSlots = [];
  for (const slot of filteredSlots) {
    const answerCells = getSlotCells(slot);
    let hasOverlap = false;
    for (const cell of answerCells) {
      const cellKey = `${cell.row},${cell.col}`;
      if (allClueCellPositions.has(cellKey)) {
        // This answer cell overlaps with a clue cell - invalid!
        hasOverlap = true;
        break;
      }
    }
    if (!hasOverlap) {
      validatedSlots.push(slot);
    } else {
      console.log(`  ⚠️  Filtered out slot ${slot.id}: answer cells overlap with clue cells`);
    }
  }
  
  // CRITICAL: Recalculate crossings after filtering
  // When we remove slots, other slots' crossing counts decrease
  // Clear all crossings first
  for (const slot of validatedSlots) {
    slot.crossings = [];
  }
  
  // Recalculate crossings only between validated slots
  // CRITICAL: Only register perpendicular crossings
  for (let i = 0; i < validatedSlots.length; i++) {
    const slot = validatedSlots[i];
    const slotCells = getSlotCells(slot);
    const slotOrientation = getAnswerOrientation(slot.direction);
    
    for (let j = i + 1; j < validatedSlots.length; j++) {
      const otherSlot = validatedSlots[j];
      const otherCells = getSlotCells(otherSlot);
      const otherOrientation = getAnswerOrientation(otherSlot.direction);
      
      // Only register crossings for perpendicular slots
      if (slotOrientation === otherOrientation) {
        continue;
      }
      
      // Find crossing points (only for perpendicular slots)
      for (let pos = 0; pos < slotCells.length; pos++) {
        const cell = slotCells[pos];
        const cellKey = `${cell.row},${cell.col}`;
        
        for (let otherPos = 0; otherPos < otherCells.length; otherPos++) {
          const otherCell = otherCells[otherPos];
          if (cell.row === otherCell.row && cell.col === otherCell.col) {
            // Found a valid perpendicular crossing!
            slot.crossings.push({
              slotId: otherSlot.id,
              thisPosition: pos,
              otherPosition: otherPos
            });
            otherSlot.crossings.push({
              slotId: slot.id,
              thisPosition: otherPos,
              otherPosition: pos
            });
            break; // Only one crossing per cell pair
          }
        }
      }
    }
  }
  
  // CRITICAL: Validate that answer cells only overlap at registered crossing points
  // If two slots share cells but have no crossing registered, that's invalid
  // This will catch any parallel overlaps that somehow got through placement logic
  const slotsWithInvalidOverlaps: typeof validatedSlots = [];
  for (let i = 0; i < validatedSlots.length; i++) {
    const slot = validatedSlots[i];
    const slotCells = getSlotCells(slot);
    const slotCellSet = new Set(slotCells.map(c => `${c.row},${c.col}`));
    
    // Check all other slots
    for (let j = 0; j < validatedSlots.length; j++) {
      if (i === j) continue;
      const otherSlot = validatedSlots[j];
      const otherCells = getSlotCells(otherSlot);
      
      // Check if there's an overlap
      let hasOverlap = false;
      for (const cell of otherCells) {
        const cellKey = `${cell.row},${cell.col}`;
        if (slotCellSet.has(cellKey)) {
          hasOverlap = true;
          break;
        }
      }
      
      // If there's an overlap, it must be registered as a crossing
      if (hasOverlap) {
        const isCrossing = slot.crossings.some(c => c.slotId === otherSlot.id);
        if (!isCrossing) {
          // Overlap exists but no crossing registered - invalid!
          // This catches parallel overlaps (same direction) since they won't have crossings
          if (!slotsWithInvalidOverlaps.includes(slot)) {
            slotsWithInvalidOverlaps.push(slot);
          }
          if (!slotsWithInvalidOverlaps.includes(otherSlot)) {
            slotsWithInvalidOverlaps.push(otherSlot);
          }
          const slotOrientation = getAnswerOrientation(slot.direction);
          const otherOrientation = getAnswerOrientation(otherSlot.direction);
          if (slotOrientation === otherOrientation) {
            console.log(`  ⚠️  Parallel overlap detected: ${slot.id} (${slot.direction}) and ${otherSlot.id} (${otherSlot.direction}) share cells but have no crossing`);
          } else {
            console.log(`  ⚠️  Invalid overlap: ${slot.id} and ${otherSlot.id} share cells but have no crossing registered`);
          }
        }
      }
    }
  }
  
  // Remove slots with invalid overlaps
  if (slotsWithInvalidOverlaps.length > 0) {
    console.log(`  ⚠️  Removing ${slotsWithInvalidOverlaps.length} slots with invalid answer cell overlaps`);
    const validSlots = validatedSlots.filter(s => !slotsWithInvalidOverlaps.includes(s));
    // Clear and recalculate crossings for remaining slots
    for (const slot of validSlots) {
      slot.crossings = [];
    }
    // Recalculate crossings for valid slots only
    // CRITICAL: Only register perpendicular crossings
    for (let i = 0; i < validSlots.length; i++) {
      const slot = validSlots[i];
      const slotCells = getSlotCells(slot);
      const slotOrientation = getAnswerOrientation(slot.direction);
      for (let j = i + 1; j < validSlots.length; j++) {
        const otherSlot = validSlots[j];
        const otherCells = getSlotCells(otherSlot);
        const otherOrientation = getAnswerOrientation(otherSlot.direction);
        
        // Only register crossings for perpendicular slots
        if (slotOrientation === otherOrientation) {
          continue;
        }
        
        for (let pos = 0; pos < slotCells.length; pos++) {
          const cell = slotCells[pos];
          for (let otherPos = 0; otherPos < otherCells.length; otherPos++) {
            const otherCell = otherCells[otherPos];
            if (cell.row === otherCell.row && cell.col === otherCell.col) {
              // Valid perpendicular crossing
              slot.crossings.push({
                slotId: otherSlot.id,
                thisPosition: pos,
                otherPosition: otherPos
              });
              otherSlot.crossings.push({
                slotId: slot.id,
                thisPosition: otherPos,
                otherPosition: pos
              });
              break;
            }
          }
        }
      }
    }
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
  if (finalFilteredSlots.length < config.minSlots * 0.6) {
    console.warn(`⚠️  Warning: Filtered out too many slots (${slots.length} -> ${finalFilteredSlots.length}). Only ${finalFilteredSlots.length} slots remain, need at least ${config.minSlots}.`);
    // If we have too few slots, be MUCH less aggressive with filtering
    if (finalFilteredSlots.length < config.minSlots * 0.6) {
      console.warn(`⚠️  Critical: Too few slots! Relaxing filtering constraints...`);
      // Re-add filtered slots to meet minimum - be VERY lenient
      // Target at least the minimum required slots
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
          finalFilteredSlots.push(slot);
          clueCellSet.add(clueKey); // Add this slot's clue cell
          added++;
          console.log(`  ✅ Re-added slot ${slot.id} with ${crossings} crossings (relaxed limit: ${relaxedLimit})`);
        }
      }
      console.log(`  ✅ Relaxed filtering: Added ${added} more slots. Total: ${finalFilteredSlots.length}`);
    }
  }
  
  // GAP-FILLING: Add more slots to fill empty areas and increase density
  // Find empty areas and try to place additional slots
  const gapFilledSlots = [...finalFilteredSlots];
  const gapFilledAnswerCells = new Map<string, { slotId: string; position: number }>();
  const gapFilledOccupiedCells = new Set<string>();
  
  // Rebuild answer cells and occupied cells from final filtered slots
  for (const slot of finalFilteredSlots) {
    gapFilledOccupiedCells.add(`${slot.startRow},${slot.startCol}`);
    const answerCells = getSlotCells(slot);
    for (let j = 0; j < answerCells.length; j++) {
      const cell = answerCells[j];
      const cellKey = `${cell.row},${cell.col}`;
      gapFilledAnswerCells.set(cellKey, { slotId: slot.id, position: j });
    }
  }
  
  // ULTRA-DENSE: With 6M clues, aim for 99%+ coverage (almost no empty cells)
  // Calculate current coverage
  const totalCells = config.rows * config.cols;
  const currentCoverage = (gapFilledAnswerCells.size + gapFilledOccupiedCells.size) / totalCells;
  
  // Target 99%+ coverage - only 1-2% empty cells max
  // With huge clue database, we can fill almost everything
  const targetCoverage = 0.99; // 99% coverage
  const maxEmptyCells = Math.max(1, Math.floor(totalCells * (1 - targetCoverage))); // At least 1 empty, but aim for 99%
  const targetFilledCells = totalCells - maxEmptyCells;
  const currentFilledCells = gapFilledAnswerCells.size + gapFilledOccupiedCells.size;
  const cellsNeeded = Math.max(0, targetFilledCells - currentFilledCells);
  
  // ULTRA-DENSE: Keep adding slots until we reach 99%+ coverage
  // With 6M clues, we have many word options to fill every possible cell
  console.log(`  🎯 ULTRA-DENSITY target: ${targetFilledCells}/${totalCells} cells (${(targetCoverage * 100).toFixed(1)}% - almost no empty cells!)`);
  console.log(`  📊 Current: ${currentFilledCells}/${totalCells} cells (${(currentCoverage * 100).toFixed(1)}%)`);
  console.log(`  📊 Need to fill: ${cellsNeeded} more cells`);
  
  let gapFilledCount = 0;
  let gapFillAttempts = 0;
  let lastProgressCount = 0;
  let noProgressCount = 0;
  // Much higher limits with 6M clues - we can try many more combinations
  const maxGapFillAttempts = 50000; // Much higher - use the power of 6M clues
  const maxNoProgressAttempts = 5000; // More patience before giving up
  
  // Keep going until we reach target empty cells
  while (gapFillAttempts < maxGapFillAttempts) {
    gapFillAttempts++;
    
    // Progress logging every 1000 attempts
    if (gapFillAttempts % 1000 === 0) {
      const currentFilled = gapFilledAnswerCells.size + gapFilledOccupiedCells.size;
      const currentEmpty = totalCells - currentFilled;
      const currentCoverageCheck = currentFilled / totalCells;
      console.log(`  🔄 Gap-filling progress: ${gapFillAttempts}/${maxGapFillAttempts} attempts, ${currentEmpty} empty cells (${(currentCoverageCheck * 100).toFixed(1)}%), ${gapFilledCount} slots added`);
    }
    
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
    
    // Early exit if no progress for too long - but be more patient with 6M clues
    if (gapFilledCount === lastProgressCount) {
      noProgressCount++;
      // Only exit if we're very close to target (within 10 cells) OR no progress for very long
      const closeToTarget = currentEmpty <= maxEmptyCells + 10;
      if (noProgressCount >= maxNoProgressAttempts && !closeToTarget) {
        console.log(`  ⚠️  Gap-filling: No progress for ${maxNoProgressAttempts} attempts, but continuing...`);
        // Reset counter and keep trying - with 6M clues we should find solutions
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
    
    if (currentEmpty <= maxEmptyCells) {
      console.log(`  ✅ Reached target density: ${currentEmpty} empty cells (${(currentCoverageCheck * 100).toFixed(1)}% coverage)`);
      break;
    }
    
    // With 6M clues, keep going until we reach 99%+ coverage
    // Don't exit early - we have the word database to fill almost everything
    
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
    
    // Prefer shorter words for gap filling (3-6 letters) to pack tighter and fill more gaps
    // Very short words can fill tiny gaps and create more crossings
    const wordLength = Math.floor(Math.random() * 4) + 3;
    
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
    
    // Check if clue cell is available
    const clueKey = `${startRow},${startCol}`;
    if (gapFilledOccupiedCells.has(clueKey)) {
      continue;
    }
    
    // Check for conflicts - CRITICAL: answer cells cannot overlap with clue cells
    let canPlace = true;
    let crossingCount = 0;
    const crossingSlots = new Set<string>();
    
    // First check: make sure clue cell itself is available
    if (gapFilledOccupiedCells.has(clueKey)) {
      canPlace = false;
    }
    
    // Second check: make sure answer cells don't overlap with clue cells
    // CRITICAL: Also check for parallel overlaps (same direction sharing cells)
    if (canPlace) {
      const testOrientation = getAnswerOrientation(direction);
      
      for (const cell of answerCellsForSlot) {
        const cellKey = `${cell.row},${cell.col}`;
        
        // CRITICAL: Answer cells cannot be in clue cells
        if (gapFilledOccupiedCells.has(cellKey)) {
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
              
              // CRITICAL: Parallel overlaps (same direction) are INVALID
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
  }
  
  if (gapFilledCount > 0) {
    console.log(`  ✅ Gap-filling: Added ${gapFilledCount} additional slots to increase density`);
  }
  
  // Recalculate crossings for gap-filled slots
  // CRITICAL: Only register perpendicular crossings
  for (let i = 0; i < gapFilledSlots.length; i++) {
    const slot = gapFilledSlots[i];
    const slotCells = getSlotCells(slot);
    const slotOrientation = getAnswerOrientation(slot.direction);
    
    for (let j = i + 1; j < gapFilledSlots.length; j++) {
      const otherSlot = gapFilledSlots[j];
      const otherCells = getSlotCells(otherSlot);
      const otherOrientation = getAnswerOrientation(otherSlot.direction);
      
      // Only register crossings for perpendicular slots
      if (slotOrientation === otherOrientation) {
        continue;
      }
      
      for (let pos = 0; pos < slotCells.length; pos++) {
        const cell = slotCells[pos];
        for (let otherPos = 0; otherPos < otherCells.length; otherPos++) {
          const otherCell = otherCells[otherPos];
          if (cell.row === otherCell.row && cell.col === otherCell.col) {
            // Valid perpendicular crossing
            slot.crossings.push({
              slotId: otherSlot.id,
              thisPosition: pos,
              otherPosition: otherPos
            });
            otherSlot.crossings.push({
              slotId: slot.id,
              thisPosition: otherPos,
              otherPosition: pos
            });
            break;
          }
        }
      }
    }
  }
  
  // CRITICAL: Validate that gap-filled slots' answer cells only overlap at registered crossing points
  // If two slots share cells but have no crossing registered, that's invalid
  const gapFilledSlotsWithInvalidOverlaps: typeof gapFilledSlots = [];
  for (let i = 0; i < gapFilledSlots.length; i++) {
    const slot = gapFilledSlots[i];
    const slotCells = getSlotCells(slot);
    const slotCellSet = new Set(slotCells.map(c => `${c.row},${c.col}`));
    
    // Check all other slots
    for (let j = 0; j < gapFilledSlots.length; j++) {
      if (i === j) continue;
      const otherSlot = gapFilledSlots[j];
      const otherCells = getSlotCells(otherSlot);
      
      // Check if there's an overlap
      let hasOverlap = false;
      for (const cell of otherCells) {
        const cellKey = `${cell.row},${cell.col}`;
        if (slotCellSet.has(cellKey)) {
          hasOverlap = true;
          break;
        }
      }
      
      // If there's an overlap, it must be registered as a crossing
      if (hasOverlap) {
        const isCrossing = slot.crossings.some(c => c.slotId === otherSlot.id);
        if (!isCrossing) {
          // Overlap exists but no crossing registered - invalid!
          if (!gapFilledSlotsWithInvalidOverlaps.includes(slot)) {
            gapFilledSlotsWithInvalidOverlaps.push(slot);
          }
          if (!gapFilledSlotsWithInvalidOverlaps.includes(otherSlot)) {
            gapFilledSlotsWithInvalidOverlaps.push(otherSlot);
          }
          const slotOrientation = getAnswerOrientation(slot.direction);
          const otherOrientation = getAnswerOrientation(otherSlot.direction);
          if (slotOrientation === otherOrientation) {
            console.log(`  ⚠️  Parallel overlap in gap-filled slots: ${slot.id} (${slot.direction}) and ${otherSlot.id} (${otherSlot.direction}) share cells but have no crossing`);
          } else {
            console.log(`  ⚠️  Invalid gap-filled overlap: ${slot.id} and ${otherSlot.id} share cells but have no crossing registered`);
          }
        }
      }
    }
  }
  
  // Remove slots with invalid overlaps
  if (gapFilledSlotsWithInvalidOverlaps.length > 0) {
    console.log(`  ⚠️  Removing ${gapFilledSlotsWithInvalidOverlaps.length} gap-filled slots with invalid answer cell overlaps`);
    const validGapFilledSlots = gapFilledSlots.filter(s => !gapFilledSlotsWithInvalidOverlaps.includes(s));
    // Clear and recalculate crossings for remaining slots
    for (const slot of validGapFilledSlots) {
      slot.crossings = [];
    }
    // Recalculate crossings for valid slots only
    // CRITICAL: Only register perpendicular crossings
    for (let i = 0; i < validGapFilledSlots.length; i++) {
      const slot = validGapFilledSlots[i];
      const slotCells = getSlotCells(slot);
      const slotOrientation = getAnswerOrientation(slot.direction);
      for (let j = i + 1; j < validGapFilledSlots.length; j++) {
        const otherSlot = validGapFilledSlots[j];
        const otherCells = getSlotCells(otherSlot);
        const otherOrientation = getAnswerOrientation(otherSlot.direction);
        
        // Only register crossings for perpendicular slots
        if (slotOrientation === otherOrientation) {
          continue;
        }
        
        for (let pos = 0; pos < slotCells.length; pos++) {
          const cell = slotCells[pos];
          for (let otherPos = 0; otherPos < otherCells.length; otherPos++) {
            const otherCell = otherCells[otherPos];
            if (cell.row === otherCell.row && cell.col === otherCell.col) {
              // Valid perpendicular crossing
              slot.crossings.push({
                slotId: otherSlot.id,
                thisPosition: pos,
                otherPosition: otherPos
              });
              otherSlot.crossings.push({
                slotId: slot.id,
                thisPosition: otherPos,
                otherPosition: pos
              });
              break;
            }
          }
        }
      }
    }
    // Replace gapFilledSlots with valid slots
    gapFilledSlots.length = 0;
    gapFilledSlots.push(...validGapFilledSlots);
  }
  
  // Re-sort after gap filling
  gapFilledSlots.sort((a, b) => a.crossings.length - b.crossings.length);
  
  // CRITICAL: Final validation - remove slots where answer cells overlap with clue cells
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
    let hasOverlap = false;
    for (const cell of answerCells) {
      const cellKey = `${cell.row},${cell.col}`;
      if (gapFilledClueCellPositions.has(cellKey)) {
        // This answer cell overlaps with a clue cell - invalid!
        hasOverlap = true;
        break;
      }
    }
    if (!hasOverlap) {
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
  
  // Recalculate clue cells for safe slots
  const filteredClueCells = safeSlots.map(slot => ({
    row: slot.startRow,
    col: slot.startCol,
    direction: slot.direction
  }));
  
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
    console.warn(`⚠️  Warning: Only ${safeSlots.length} slots generated, but minimum is ${config.minSlots} for ${size} size`);
    
    // If we're below minimum, be VERY lenient and re-add filtered slots
    if (safeSlots.length < config.minSlots) {
      const needed = config.minSlots - safeSlots.length;
      let added = 0;
      
      // Re-add slots that were filtered out, but only if they have reasonable crossings
      // Sort by crossing count to prefer easier slots
      const availableSlots = validatedGapFilledSlots
        .filter(s => !safeSlots.includes(s))
        .sort((a, b) => a.crossings.length - b.crossings.length);
      
      for (const slot of availableSlots) {
        if (added >= needed) break;
        // CRITICAL: Never re-add slots with more than 10 crossings - they're unsolvable
        if (slot.crossings.length <= 10) {
          safeSlots.push(slot);
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
          if (slot.crossings.length <= 10) {
            safeSlots.push(slot);
            added++;
          }
        }
      }
      
      if (added > 0) {
        console.log(`  ✅ Re-added ${added} slots to meet minimum requirement`);
      }
    }
  }
  
  if (safeSlots.length >= config.minSlots) {
    console.log(`  ✅ Generated ${safeSlots.length} slots (target: ${config.minSlots}-${config.maxSlots})`);
  } else {
    console.warn(`  ⚠️  Still only ${safeSlots.length} slots (need ${config.minSlots}) - template may be invalid`);
  }
  
  return {
    id: `generated_${size}_${Date.now()}`,
    name: `Generated ${size} template`,
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
      size,
      density: config.density,
      avgCrossings: avgCrossings.toFixed(2)
    }
  };
}
