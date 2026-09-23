/**
 * Bitset CSP solver for fully interlocked (framed) daily boards.
 *
 * Every slot keeps its exact candidate set as a bitset over the words of its length;
 * placing a word intersects the crossing slots' sets (forward checking), the most
 * constrained slot is filled next, and randomized restarts escape heavy-tailed dead ends.
 */

import { ClueSlot, GridTemplate } from '../core/types';
import { foldHebrewLetter } from '../core/hebrewOrthography';
import { normalizeWord } from './validation-utils';
import { getSlotCells } from './direction-utils';
import { GridState, createEmptyGridState, placeWord } from './grid-state';

export interface DenseSolverOptions {
  /** Higher = tried first (noise is added per restart). */
  wordScore?: (word: string) => number;
  maxSolveTimeMs?: number;
  /** Words allowed in text slots (image slots use their own candidateAnswers). */
  words: string[];
  /** Tags per word (e.g. "cat:people", "pattern:first-name") capped by tagCaps per board. */
  tagsOf?: (word: string) => string[];
  tagCaps?: Record<string, number>;
  quiet?: boolean;
}

interface Dictionary {
  /** normalized (no spaces) words of this length */
  words: string[];
  /** original display form per word */
  display: string[];
  letters: Uint8Array[];
  /** bits[pos * ALPHA + letter] → bitset of word ids */
  bits: Uint32Array[];
  blocks: number;
}

const LETTER_IDS = new Map<string, number>();
function letterId(ch: string): number {
  const folded = foldHebrewLetter(ch);
  let id = LETTER_IDS.get(folded);
  if (id === undefined) {
    id = LETTER_IDS.size;
    LETTER_IDS.set(folded, id);
  }
  return id;
}
const ALPHA = 64;

function popcount(bits: Uint32Array): number {
  let n = 0;
  for (let i = 0; i < bits.length; i++) {
    let v = bits[i];
    v = v - ((v >>> 1) & 0x55555555);
    v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
    n += (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
  }
  return n;
}

function bitIds(bits: Uint32Array): number[] {
  const out: number[] = [];
  for (let b = 0; b < bits.length; b++) {
    let v = bits[b];
    while (v !== 0) {
      const t = v & -v;
      out.push(b * 32 + (31 - Math.clz32(t)));
      v ^= t;
    }
  }
  return out;
}

function buildDictionary(length: number, entries: Array<{ normalized: string; display: string }>): Dictionary {
  const blocks = Math.ceil(entries.length / 32) || 1;
  const bits: Uint32Array[] = Array.from({ length: length * ALPHA }, () => new Uint32Array(blocks));
  const letters: Uint8Array[] = [];
  entries.forEach(({ normalized }, id) => {
    const ls = new Uint8Array(length);
    for (let p = 0; p < length; p++) {
      const l = letterId(normalized[p]);
      ls[p] = l;
      bits[p * ALPHA + l][id >>> 5] |= 1 << (id & 31);
    }
    letters.push(ls);
  });
  return {
    words: entries.map((e) => e.normalized),
    display: entries.map((e) => e.display),
    letters,
    bits,
    blocks,
  };
}

interface SlotInfo {
  slot: ClueSlot;
  length: number;
  cells: number[]; // cell ids
  dict: Dictionary;
  base: Uint32Array;
  crossing: number[]; // indices of slots sharing a cell
}

export function solveDenseGrid(template: GridTemplate, options: DenseSolverOptions): GridState | null {
  const deadline = Date.now() + (options.maxSolveTimeMs ?? 30000);
  const cols = template.cols;

  // Dictionaries per length: text pool plus image candidates.
  const byLength = new Map<number, Map<string, string>>();
  const add = (word: string) => {
    const normalized = normalizeWord(word);
    const length = Array.from(normalized).length;
    if (!byLength.has(length)) byLength.set(length, new Map());
    const map = byLength.get(length)!;
    if (!map.has(normalized) || (word.includes(' ') && !map.get(normalized)!.includes(' '))) {
      map.set(normalized, word);
    }
  };
  options.words.forEach(add);
  const textWords = new Set(options.words.map((w) => normalizeWord(w)));
  for (const slot of template.slots) slot.candidateAnswers?.forEach(add);

  const dicts = new Map<number, Dictionary>();
  for (const [length, map] of byLength) {
    dicts.set(
      length,
      buildDictionary(
        length,
        [...map].map(([normalized, display]) => ({ normalized, display }))
      )
    );
  }

  const slots: SlotInfo[] = [];
  const cellToSlots = new Map<number, number[]>();
  for (const slot of template.slots) {
    const cells = getSlotCells(slot).map((c) => c.row * cols + c.col);
    const dict = dicts.get(cells.length);
    if (!dict) return null;
    const base = new Uint32Array(dict.blocks);
    const allowed = slot.candidateAnswers?.length
      ? new Set(slot.candidateAnswers.map((w) => normalizeWord(w)))
      : slot.fixedAnswer
        ? new Set([normalizeWord(slot.fixedAnswer)])
        : null;
    dict.words.forEach((w, id) => {
      const ok = allowed ? allowed.has(w) : textWords.has(w);
      if (ok) base[id >>> 5] |= 1 << (id & 31);
    });
    const idx = slots.length;
    slots.push({ slot, length: cells.length, cells, dict, base, crossing: [] });
    for (const cell of cells) {
      if (!cellToSlots.has(cell)) cellToSlots.set(cell, []);
      cellToSlots.get(cell)!.push(idx);
    }
  }
  for (const [, list] of cellToSlots) {
    for (const a of list) for (const b of list) if (a !== b && !slots[a].crossing.includes(b)) slots[a].crossing.push(b);
  }

  const scoreCache = new Map<string, number>();
  const scoreOf = (display: string) => {
    let s = scoreCache.get(display);
    if (s === undefined) {
      s = options.wordScore ? options.wordScore(display) : 0;
      scoreCache.set(display, s);
    }
    return s;
  };

  const cellLetter = new Int16Array(template.rows * cols).fill(-1);
  const assigned = new Int32Array(slots.length).fill(-1);
  const used = new Set<string>();

  const caps = options.tagCaps ?? {};
  const tagCache = new Map<string, string[]>();
  const tagsFor = (display: string): string[] => {
    let tags = tagCache.get(display);
    if (!tags) {
      tags = (options.tagsOf?.(display) ?? []).filter((tag) => caps[tag] !== undefined);
      tagCache.set(display, tags);
    }
    return tags;
  };
  const tagCounts = new Map<string, number>();
  const withinCaps = (display: string) =>
    tagsFor(display).every((tag) => (tagCounts.get(tag) ?? 0) < caps[tag]);
  const bumpTags = (display: string, delta: number) => {
    for (const tag of tagsFor(display)) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + delta);
  };

  const domainOf = (s: SlotInfo): Uint32Array => {
    const d = s.base.slice();
    for (let p = 0; p < s.length; p++) {
      const l = cellLetter[s.cells[p]];
      if (l < 0) continue;
      const mask = s.dict.bits[p * ALPHA + l];
      for (let b = 0; b < d.length; b++) d[b] &= mask[b];
    }
    return d;
  };

  let nodes = 0;
  let nodeLimit = 0;
  let noise = 1;

  const search = (remaining: number): boolean | null => {
    if (remaining === 0) return true;
    if (++nodes > nodeLimit) return null;
    if ((nodes & 255) === 0 && Date.now() > deadline) return null;

    // MRV over unassigned slots.
    let bestIdx = -1;
    let bestDomain: Uint32Array | null = null;
    let bestCount = Infinity;
    for (let i = 0; i < slots.length; i++) {
      if (assigned[i] >= 0) continue;
      const d = domainOf(slots[i]);
      const count = popcount(d);
      if (count === 0) return false;
      if (count < bestCount || (count === bestCount && Math.random() < 0.3)) {
        bestIdx = i;
        bestDomain = d;
        bestCount = count;
        if (count === 1) break;
      }
    }
    const s = slots[bestIdx];
    const isImage = s.slot.clueType === 'image';
    const ids = bitIds(bestDomain!).filter(
      (id) => !used.has(s.dict.words[id]) && (isImage || withinCaps(s.dict.display[id]))
    );
    if (ids.length === 0) return false;
    const shortlist = ids
      .map((id) => ({ id, score: scoreOf(s.dict.display[id]) + Math.random() * noise }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 40);

    const setLetters = (id: number): number[] => {
      const letters = s.dict.letters[id];
      const changed: number[] = [];
      for (let p = 0; p < s.length; p++) {
        const cell = s.cells[p];
        if (cellLetter[cell] < 0) {
          cellLetter[cell] = letters[p];
          changed.push(cell);
        }
      }
      return changed;
    };

    // Forward check + least-constraining value: keep crossing slots as open as possible.
    const ranked: Array<{ id: number; value: number }> = [];
    for (const { id, score } of shortlist) {
      const changed = setLetters(id);
      let viable = true;
      let openness = 0;
      for (const c of s.crossing) {
        if (assigned[c] >= 0) continue;
        const count = popcount(domainOf(slots[c]));
        if (count === 0) {
          viable = false;
          break;
        }
        openness += Math.log2(1 + count);
      }
      for (const cell of changed) cellLetter[cell] = -1;
      if (viable) ranked.push({ id, value: openness + score * 2 });
    }
    ranked.sort((a, b) => b.value - a.value);

    for (let k = 0; k < Math.min(ranked.length, 12); k++) {
      const id = ranked[k].id;
      const display = s.dict.display[id];
      const changed = setLetters(id);
      assigned[bestIdx] = id;
      used.add(s.dict.words[id]);
      if (!isImage) bumpTags(display, 1);
      const result = search(remaining - 1);
      if (result) return true;
      assigned[bestIdx] = -1;
      used.delete(s.dict.words[id]);
      if (!isImage) bumpTags(display, -1);
      for (const cell of changed) cellLetter[cell] = -1;
      if (result === null) return null;
    }
    return false;
  };

  // Luby-style restarts: short randomized runs, growing budget.
  let restart = 0;
  while (Date.now() < deadline) {
    restart++;
    nodes = 0;
    nodeLimit = 400 * Math.pow(2, Math.min(10, Math.floor(Math.log2(restart + 1))));
    noise = 0.6 + Math.random() * 1.2;
    cellLetter.fill(-1);
    assigned.fill(-1);
    used.clear();
    tagCounts.clear();
    const result = search(slots.length);
    if (result) {
      let state = createEmptyGridState(template.rows, template.cols);
      for (const cell of template.clueCells) state.clueCells.add(`${cell.row},${cell.col}`);
      slots.forEach((s, i) => {
        const cells = getSlotCells(s.slot);
        const rowDelta = cells.length >= 2 ? cells[1].row - cells[0].row : 0;
        const colDelta = cells.length >= 2 ? cells[1].col - cells[0].col : 0;
        state = placeWord(state, s.slot.id, s.dict.display[assigned[i]], cells, rowDelta, colDelta);
      });
      if (!options.quiet) console.log(`   dense solve ok after ${restart} restarts`);
      return state;
    }
    if (result === false && nodes <= 1) break; // a slot has no candidates at all
  }
  if (!options.quiet) console.log(`   dense solve failed after ${restart} restarts`);
  return null;
}
