/**
 * Validation Utilities for Swedish Arrow Crossword Puzzles
 * 
 * Consolidates common validation logic to avoid duplication
 */

import { Direction, ClueSlot } from '../core/types';
import { getSlotCells, getAnswerOrientation, getCellBeforeAnswer, getNextCellAfterAnswer } from './direction-utils';

/**
 * Normalize a word by removing spaces and converting to uppercase
 * Used for grid placement and duplicate checking
 */
export function normalizeWord(word: string): string {
  return word.replace(/\s+/g, '').toUpperCase();
}

/**
 * Validate that a word's boundary cells follow the boundary rule
 * Words can only start/end at:
 * - Grid boundaries (out of bounds)
 * - Clue cells
 * - Blocked cells (neither clue nor answer)
 * 
 * Words CANNOT start/end at answer cells (would cause word merging)
 */
export function validateWordBoundaries(
  direction: Direction,
  answerCells: Array<{ row: number; col: number }>,
  gridRows: number,
  gridCols: number,
  clueCellPositions: Set<string>,
  answerCellPositions: Set<string>,
  blockedCellPositions?: Set<string>
): { isValid: boolean; reason?: string } {
  if (answerCells.length === 0) {
    return { isValid: true };
  }

  // Check cell BEFORE first answer cell
  const firstCell = answerCells[0];
  const cellBefore = getCellBeforeAnswer(direction, firstCell, gridRows, gridCols);
  
  if (cellBefore !== null) {
    const beforeCellKey = `${cellBefore.row},${cellBefore.col}`;
    if (answerCellPositions.has(beforeCellKey)) {
      return {
        isValid: false,
        reason: `cell before first answer (${cellBefore.row},${cellBefore.col}) is an answer cell`
      };
    }
    // Must be clue cell, blocked cell, or empty (will become blocked)
    const isClueCell = clueCellPositions.has(beforeCellKey);
    const isBlocked = blockedCellPositions?.has(beforeCellKey) ?? false;
    if (!isClueCell && !isBlocked) {
      // Empty cell is OK (will be marked as blocked when slot is placed)
      // But if we're validating existing slots, it should be blocked
      if (blockedCellPositions !== undefined) {
        return {
          isValid: false,
          reason: `cell before first answer (${cellBefore.row},${cellBefore.col}) is not clue/block/boundary`
        };
      }
    }
  }

  // Check cell AFTER last answer cell
  const lastCell = answerCells[answerCells.length - 1];
  const nextCellAfter = getNextCellAfterAnswer(direction, lastCell, gridRows, gridCols);
  
  if (nextCellAfter === null) {
    // Out of bounds - valid!
    return { isValid: true };
  }

  const nextCellKey = `${nextCellAfter.row},${nextCellAfter.col}`;
  
  // The cell after the last answer letter must NOT be an answer cell
  if (answerCellPositions.has(nextCellKey)) {
    return {
      isValid: false,
      reason: `cell after last answer (${nextCellAfter.row},${nextCellAfter.col}) is an answer cell`
    };
  }

  // Must be either a clue cell or blocked cell
  const isClueCell = clueCellPositions.has(nextCellKey);
  const isBlocked = blockedCellPositions?.has(nextCellKey) ?? false;
  if (!isClueCell && !isBlocked) {
    // Empty cell is OK during placement (will be marked as blocked)
    // But if we're validating existing slots, it should be blocked
    if (blockedCellPositions !== undefined) {
      return {
        isValid: false,
        reason: `cell after last answer (${nextCellAfter.row},${nextCellAfter.col}) is not clue/block/boundary`
      };
    }
  }

  return { isValid: true };
}

/**
 * Simple boundary check: verify that cells before/after answer cells are not answer cells
 * This is a lightweight check used during placement to prevent word merging
 * Returns true if boundaries are valid (not merging with other answer cells)
 */
export function checkAnswerBoundaries(
  direction: Direction,
  answerCells: Array<{ row: number; col: number }>,
  gridRows: number,
  gridCols: number,
  answerCellPositions: Set<string>
): boolean {
  if (answerCells.length === 0) {
    return true;
  }

  // Check cell BEFORE first answer cell
  const firstCell = answerCells[0];
  const cellBefore = getCellBeforeAnswer(direction, firstCell, gridRows, gridCols);
  if (cellBefore !== null) {
    const beforeCellKey = `${cellBefore.row},${cellBefore.col}`;
    if (answerCellPositions.has(beforeCellKey)) {
      return false; // Would merge with another answer cell
    }
  }

  // Check cell AFTER last answer cell
  const lastCell = answerCells[answerCells.length - 1];
  const nextCellAfter = getNextCellAfterAnswer(direction, lastCell, gridRows, gridCols);
  if (nextCellAfter !== null) {
    const nextCellKey = `${nextCellAfter.row},${nextCellAfter.col}`;
    if (answerCellPositions.has(nextCellKey)) {
      return false; // Would merge with another answer cell
    }
  }

  return true;
}

/**
 * Validate that all slots satisfy the boundary rule: for each slot, the cell before
 * its first answer and the cell after its last answer must not be answer cells of
 * any other slot. Also: each slot's clue cell (startRow, startCol) must not be an
 * answer cell of any other slot (avoids down-clue definition sitting on across answer).
 * Used at template level (e.g. v2 mask→template) to reject invalid templates.
 */
export function validateSlotsBoundaries(
  slots: ClueSlot[],
  gridRows: number,
  gridCols: number
): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const answerCells = getSlotCells(slot);
    if (answerCells.length === 0) continue;

    const otherAnswerCells = new Set<string>();
    for (let j = 0; j < slots.length; j++) {
      if (j === i) continue;
      for (const c of getSlotCells(slots[j])) {
        otherAnswerCells.add(`${c.row},${c.col}`);
      }
    }

    const clueCellKey = `${slot.startRow},${slot.startCol}`;
    if (otherAnswerCells.has(clueCellKey)) {
      errors.push(`Slot ${slot.id} (${slot.direction}): clue cell (${slot.startRow},${slot.startCol}) is an answer cell of another slot`);
    }

    if (!checkAnswerBoundaries(slot.direction, answerCells, gridRows, gridCols, otherAnswerCells)) {
      const firstCell = answerCells[0];
      const lastCell = answerCells[answerCells.length - 1];
      const cellBefore = getCellBeforeAnswer(slot.direction, firstCell, gridRows, gridCols);
      const cellAfter = getNextCellAfterAnswer(slot.direction, lastCell, gridRows, gridCols);
      if (cellBefore && otherAnswerCells.has(`${cellBefore.row},${cellBefore.col}`)) {
        errors.push(`Slot ${slot.id} (${slot.direction}): cell before first answer (${cellBefore.row},${cellBefore.col}) is an answer cell`);
      }
      if (cellAfter && otherAnswerCells.has(`${cellAfter.row},${cellAfter.col}`)) {
        errors.push(`Slot ${slot.id} (${slot.direction}): cell after last answer (${cellAfter.row},${cellAfter.col}) is an answer cell`);
      }
    }
  }
  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

/**
 * Simple boundary check using deltas (for contexts where Direction is not available)
 * Verifies that cells before/after answer cells are not answer cells
 */
export function checkAnswerBoundariesWithDeltas(
  answerCells: Array<{ row: number; col: number }>,
  rowDelta: number,
  colDelta: number,
  gridRows: number,
  gridCols: number,
  answerCellPositions: Set<string>
): boolean {
  if (answerCells.length === 0) {
    return true;
  }

  // Check cell BEFORE first answer cell
  const firstCell = answerCells[0];
  const prevRow = firstCell.row - rowDelta;
  const prevCol = firstCell.col - colDelta;
  if (prevRow >= 0 && prevRow < gridRows && prevCol >= 0 && prevCol < gridCols) {
    const prevCellKey = `${prevRow},${prevCol}`;
    if (answerCellPositions.has(prevCellKey)) {
      return false; // Would merge with another answer cell
    }
  }

  // Check cell AFTER last answer cell
  const lastCell = answerCells[answerCells.length - 1];
  const nextRow = lastCell.row + rowDelta;
  const nextCol = lastCell.col + colDelta;
  if (nextRow >= 0 && nextRow < gridRows && nextCol >= 0 && nextCol < gridCols) {
    const nextCellKey = `${nextRow},${nextCol}`;
    if (answerCellPositions.has(nextCellKey)) {
      return false; // Would merge with another answer cell
    }
  }

  return true;
}

/**
 * Check if a clue cell position is valid (not overlapping with answer cells or blocked cells)
 */
export function isValidClueCellPosition(
  clueRow: number,
  clueCol: number,
  answerCellPositions: Set<string>,
  blockedCellPositions?: Set<string>
): boolean {
  const clueKey = `${clueRow},${clueCol}`;
  
  // Clue cell cannot be in an answer cell position
  if (answerCellPositions.has(clueKey)) {
    return false;
  }
  
  // Clue cell cannot be in a blocked cell position (if blocked cells are tracked)
  if (blockedCellPositions?.has(clueKey)) {
    return false;
  }
  
  return true;
}

/**
 * Check if answer cells overlap with clue cells
 */
export function hasAnswerClueOverlap(
  answerCells: Array<{ row: number; col: number }>,
  clueCellPositions: Set<string>
): boolean {
  for (const cell of answerCells) {
    const cellKey = `${cell.row},${cell.col}`;
    if (clueCellPositions.has(cellKey)) {
      return true;
    }
  }
  return false;
}

/**
 * Calculate crossings between two slots
 * Only registers perpendicular crossings (horizontal x vertical)
 */
export function calculateCrossings(
  slot1: ClueSlot,
  slot2: ClueSlot
): Array<{ slot1Position: number; slot2Position: number }> | null {
  const slot1Orientation = getAnswerOrientation(slot1.direction);
  const slot2Orientation = getAnswerOrientation(slot2.direction);
  
  // Only register crossings for perpendicular slots
  if (slot1Orientation === slot2Orientation) {
    return null; // Parallel overlaps are invalid
  }
  
  const slot1Cells = getSlotCells(slot1);
  const slot2Cells = getSlotCells(slot2);
  const crossings: Array<{ slot1Position: number; slot2Position: number }> = [];
  
  // Find crossing points
  for (let pos1 = 0; pos1 < slot1Cells.length; pos1++) {
    const cell1 = slot1Cells[pos1];
    for (let pos2 = 0; pos2 < slot2Cells.length; pos2++) {
      const cell2 = slot2Cells[pos2];
      if (cell1.row === cell2.row && cell1.col === cell2.col) {
        crossings.push({ slot1Position: pos1, slot2Position: pos2 });
        break; // Only one crossing per cell pair
      }
    }
  }
  
  return crossings.length > 0 ? crossings : null;
}

/**
 * Recalculate all crossings for a set of slots
 * Only registers perpendicular crossings
 */
export function recalculateCrossings(slots: ClueSlot[]): void {
  // Clear all existing crossings
  for (const slot of slots) {
    slot.crossings = [];
  }
  
  // Calculate crossings between all slot pairs
  for (let i = 0; i < slots.length; i++) {
    const slot1 = slots[i];
    for (let j = i + 1; j < slots.length; j++) {
      const slot2 = slots[j];
      const crossings = calculateCrossings(slot1, slot2);
      
      if (crossings) {
        // Register crossings in both directions
        for (const crossing of crossings) {
          slot1.crossings.push({
            slotId: slot2.id,
            thisPosition: crossing.slot1Position,
            otherPosition: crossing.slot2Position
          });
          slot2.crossings.push({
            slotId: slot1.id,
            thisPosition: crossing.slot2Position,
            otherPosition: crossing.slot1Position
          });
        }
      }
    }
  }
}

/**
 * Validate that answer cells only overlap at registered crossing points
 * If two slots share cells but have no crossing registered, that's invalid
 */
export function validateOverlapsAreCrossings(
  slots: ClueSlot[]
): { invalidSlots: ClueSlot[]; errors: string[] } {
  const invalidSlots: ClueSlot[] = [];
  const errors: string[] = [];
  
  for (let i = 0; i < slots.length; i++) {
    const slot1 = slots[i];
    const slot1Cells = getSlotCells(slot1);
    const slot1CellSet = new Set(slot1Cells.map(c => `${c.row},${c.col}`));
    const slot1Orientation = getAnswerOrientation(slot1.direction);
    
    for (let j = i + 1; j < slots.length; j++) {
      const slot2 = slots[j];
      const slot2Cells = getSlotCells(slot2);
      
      // Check if there's an overlap
      let hasOverlap = false;
      for (const cell of slot2Cells) {
        const cellKey = `${cell.row},${cell.col}`;
        if (slot1CellSet.has(cellKey)) {
          hasOverlap = true;
          break;
        }
      }
      
      // If there's an overlap, it must be registered as a crossing
      if (hasOverlap) {
        const isCrossing = slot1.crossings.some(c => c.slotId === slot2.id);
        if (!isCrossing) {
          if (!invalidSlots.includes(slot1)) {
            invalidSlots.push(slot1);
          }
          if (!invalidSlots.includes(slot2)) {
            invalidSlots.push(slot2);
          }
          
          const slot2Orientation = getAnswerOrientation(slot2.direction);
          if (slot1Orientation === slot2Orientation) {
            errors.push(`Parallel overlap: ${slot1.id} (${slot1.direction}) and ${slot2.id} (${slot2.direction}) share cells but have no crossing`);
          } else {
            errors.push(`Invalid overlap: ${slot1.id} and ${slot2.id} share cells but have no crossing registered`);
          }
        }
      }
    }
  }
  
  return { invalidSlots, errors };
}
