import { Difficulty, Language } from '../../types';
import { Puzzle, GridTemplate, ClueSlot } from '../core/types';
import { getClueProvider, ClueProvider } from '../core/clueProvider';
import { generateTemplate, repairTemplateAroundSlot } from './template-generator';
import { solveGrid } from './grid-solver';
import { buildCrossingIndex, CrossingIndex } from './word-index';
import { generatePuzzleFromGrid } from './puzzle-assembler';
import { getSlotCells, getUncoveredCells } from './direction-utils';
import { normalizeWord } from './validation-utils';
import { createEmptyGridState, canPlaceWord, placeWord } from './grid-state';
import { GridSize, IMAGE_CLUE_COUNT_LADDER, IMAGE_CLUE_SIZE_LADDER, MAX_GRID_SIZE, MIN_GRID_SIZE, sizeFallbackChain } from '../utils/gridSizes';
import {
  catalogLetterLength,
  imageBlockCutouts,
  imageExitLocks,
  isInImageBlock,
  ImageClueCatalogEntry,
  loadGeneratedImageClueCatalog,
  planImageClues,
  PlannedImageClue,
} from './imageClueCatalog';
import { generateFramedTemplate } from './framed-template';
import { solveDenseGrid } from './dense-solver';
import {
  DENSE_MAX_TWO_LETTER_SHARE,
  dailyTargetMisses,
  dailyTargetsFor,
  formatQuality,
  puzzleQualityOk,
  scorePuzzle,
  scoreTemplate,
  shuffled,
  templateQualityOk,
} from './puzzle-quality';

export interface DailyGenerationOptions {
  rows: number;
  cols: number;
  title: string;
  category: string;
  imageClueCount?: number;
  /** 1 easy … 3 hard — clue difficulty the board aims for. */
  targetDifficulty?: number;
  /** When set, the fill also leans toward words whose easiest clue sits near targetDifficulty. */
  wordDifficultyWeight?: number;
  /** Stored on the puzzle; defaults to the generator's usual label. */
  difficulty?: Difficulty;
  /** Normalized answers from recent dailies; words of 4+ letters are kept out of the fill. */
  avoidAnswers?: Iterable<string>;
  /** Clue texts from recent dailies; picked only when an answer has nothing else. */
  avoidClues?: Iterable<string>;
  /** Max answers per tag on one board (tags: "cat:<category>", "pattern:first-name", "pattern:abbrev"). */
  tagCaps?: Record<string, number>;
  timeBudgetMs?: number;
  solveMsPerTemplate?: number;
}

export const DEFAULT_DAILY_TAG_CAPS: Record<string, number> = {
  'cat:geography': 3,
  'cat:people': 3,
  'cat:bible': 3,
  'cat:sport': 2,
  'pattern:first-name': 2,
  'pattern:abbrev': 1,
};

/** Tags used by per-board caps: category plus clue patterns that feel repetitive in bulk. */
export function dailyTagsFor(provider: ClueProvider, word: string): string[] {
  const tags: string[] = [];
  const meta = provider.getWordMeta?.(word);
  if (meta?.category) tags.push(`cat:${meta.category}`);
  const clues = provider.getCluesForWord(word).map((c) => c.replace(/[״”“]/g, '"'));
  if (clues.length > 0 && clues.every((c) => c.includes('ש"מ') || c.includes('שם פרטי'))) {
    tags.push('pattern:first-name');
  }
  if (clues.some((c) => c.includes('ר"ת') || c.includes('בקיצור'))) {
    tags.push('pattern:abbrev');
  }
  return tags;
}

/** Daily fill preference: fillScore dominates; the legacy rank breaks ties between unscored words. */
export function dailyWordScore(provider: ClueProvider, word: string): number {
  const meta = provider.getWordMeta?.(word);
  const fill = meta?.fillScore ?? 3;
  return (fill - 3) * 2 - Math.log(Math.max(provider.getAnswerRank(word), 1)) * 0.3;
}

export class PuzzleGenerator {
  private wordIndex: CrossingIndex;
  private language: Language;
  private clueProvider: ClueProvider;
  private imageClueCatalog: ImageClueCatalogEntry[];
  private lastFailedSlot?: ClueSlot;

  constructor(
    language: Language = 'en',
    imageClueCatalog?: ImageClueCatalogEntry[]
  ) {
    this.language = language;
    this.clueProvider = getClueProvider(language);
    this.imageClueCatalog = imageClueCatalog ?? loadGeneratedImageClueCatalog();

    const words = this.clueProvider.getWordPool();
    if (words.length === 0) {
      throw new Error(
        `(${language}) is empty. Check that ` +
          `the clue database sources exist in src/scripts/core.`
      );
    }
    this.wordIndex = buildCrossingIndex(words);
  }

  generateBatch(config: {
    count: number;
    category: string;
    getTitle: (index: number) => string;
    rows?: number;
    cols?: number;
    sizes?: GridSize[];
    strictSize?: boolean;
    imageClueCount?: number;
    imageClueAttempts?: number;
    /** Override attempt budget for text (non-image) boards. */
    attempts?: number;
    difficulty?: Difficulty;
  }): Puzzle[] {
    const hebrewFloor = this.language === 'he' ? MIN_GRID_SIZE : 8;
    const defaultRows = Math.min(Math.max(config.rows ?? hebrewFloor, hebrewFloor), MAX_GRID_SIZE);
    const defaultCols = Math.min(Math.max(config.cols ?? hebrewFloor, hebrewFloor), MAX_GRID_SIZE);
    const puzzles: Puzzle[] = [];

    for (let i = 0; i < config.count; i++) {
      const raw = config.sizes?.[i % (config.sizes?.length ?? 1)] ?? {
        rows: defaultRows,
        cols: defaultCols,
      };
      const requested =
        this.language === 'he'
          ? {
              rows: Math.max(MIN_GRID_SIZE, Math.min(raw.rows, MAX_GRID_SIZE)),
              cols: Math.max(MIN_GRID_SIZE, Math.min(raw.cols, MAX_GRID_SIZE)),
            }
          : {
              rows: Math.min(raw.rows, MAX_GRID_SIZE),
              cols: Math.min(raw.cols, MAX_GRID_SIZE),
            };
      const chain =
        this.language === 'he' && !config.strictSize
          ? sizeFallbackChain(requested.rows, requested.cols)
          : [requested];

      let generated: Puzzle | null = null;
      for (const size of chain) {
        const attempts =
          config.attempts ??
          (config.imageClueCount
            ? (config.imageClueAttempts ?? 48)
            : config.strictSize
              ? 28
              : undefined);
        generated = this.tryGenerateOne(
          size.rows,
          size.cols,
          {
            title: config.getTitle(puzzles.length),
            category: config.category,
            imageClueCount: config.imageClueCount,
            difficulty: config.difficulty,
          },
          attempts
        );
        if (generated) {
          if (size.rows !== requested.rows || size.cols !== requested.cols) {
            console.log(
              `   ↘️  ${requested.rows}x${requested.cols} too tight, using ${size.rows}x${size.cols}`
            );
          }
          break;
        }
        if (chain.length > 1) {
          console.log(
            `   … ${size.rows}x${size.cols} did not fill, trying a smaller grid`
          );
        }
      }

      if (generated) {
        puzzles.push(generated);
        const images = generated.puzzleItems.filter((p) => p.clueType === 'image').length;
        console.log(
          `✅ Puzzle ${puzzles.length}/${config.count}: ${generated.puzzleItems.length} clues ` +
            `(${generated.grid.rows}x${generated.grid.cols}` +
            (images ? `, ${images} images` : '') +
            `)`
        );
      }
    }

    if (puzzles.length < config.count) {
      console.warn(`⚠️  Generated ${puzzles.length}/${config.count} puzzles`);
    }
    return puzzles;
  }

  private tryGenerateOne(
    rows: number,
    cols: number,
    meta: { title: string; category: string; imageClueCount?: number; difficulty?: Difficulty },
    attemptOverride?: number
  ): Puzzle | null {
    const cells = rows * cols;
    const attempts =
      attemptOverride ??
      (this.language === 'he'
        ? cells >= 196
          ? 24
          : cells >= 169
            ? 28
            : cells >= 144
              ? 24
              : 20
        : 15);

    // Image clues: Hebrew only, and only when explicitly requested.
    const wantImages =
      this.language === 'he' ? (meta.imageClueCount ?? 0) : 0;
    if (wantImages > 0 && this.imageClueCatalog.length < wantImages) {
      console.error(
        `Image-clue catalog has ${this.imageClueCatalog.length} entries, need ${wantImages}. ` +
          `Run scripts/arrow-image-pipeline \`npm run process\` first.`
      );
      return null;
    }

    for (let attempt = 0; attempt < attempts; attempt++) {
      const imagePlan =
        wantImages > 0
          ? planImageClues(rows, cols, wantImages, this.catalogPreferredLengths())
          : [];
      if (wantImages > 0 && imagePlan.length < wantImages) {
        if (attempt < 3) {
          console.log(
            `   … image attempt ${attempt + 1}: only placed ${imagePlan.length}/${wantImages} blocks`
          );
        }
        continue;
      }
      const imageDirs = new Set(imagePlan.map((img) => img.direction));
      if (wantImages >= 2 && imageDirs.size < 2) {
        continue;
      }

      const cutoutCells =
        imagePlan.length > 0 ? imageBlockCutouts(imagePlan) : undefined;
      const imageLocks = imagePlan.length > 0 ? imageExitLocks(imagePlan) : [];
      // Don't force (0,0) to a text clue — references often put a photo there.
      const lockedCells = imageLocks.length ? imageLocks : undefined;
      const protectedCells = imageLocks.length ? imageLocks : undefined;

      const t0 = Date.now();
      const dense = this.language === 'he' && wantImages === 0;
      const template = this.buildTemplate(
        rows,
        cols,
        cutoutCells,
        lockedCells,
        protectedCells,
        dense
      );
      if (!template) {
        if (wantImages > 0 && attempt < 8) {
          console.log(
            `   … image attempt ${attempt + 1}: template failed (${Date.now() - t0}ms)`
          );
        }
        continue;
      }

      let puzzle: Puzzle | null = null;
      const bindTries = wantImages >= 3 ? 6 : wantImages > 0 ? 4 : 1;
      for (let bindTry = 0; bindTry < bindTries; bindTry++) {
        if (bindTry > 0) this.clearImageBinds(template);
        if (!this.bindImageClues(template, imagePlan, this.imageClueCatalog)) {
          if (wantImages > 0 && attempt < 8 && bindTry === 0) {
            const wanted = imagePlan
              .map((img) => `${img.direction}:${img.answerLength}@(${img.exitRow},${img.exitCol})`)
              .join(' ');
            console.log(
              `   … image attempt ${attempt + 1}: bind failed (${template.slots.length} slots, wanted ${wanted}, ${Date.now() - t0}ms)`
            );
          }
          continue;
        }

        if (wantImages > 0) {
          const covered = new Set<string>();
          for (const clue of template.clueCells) covered.add(`${clue.row},${clue.col}`);
          for (const slot of template.slots) {
            for (const cell of getSlotCells(slot)) covered.add(`${cell.row},${cell.col}`);
          }
          for (const cut of cutoutCells ?? []) covered.add(`${cut.row},${cut.col}`);
          const holes = rows * cols - covered.size;
          if (holes > 0) {
            if (attempt < 8 && bindTry === 0) {
              console.log(`   … image attempt ${attempt + 1}: ${holes} empty cells, retrying`);
            }
            continue;
          }
        }

        const maxLen = this.language === 'he' || wantImages > 0 ? 8 : 11;
        const minLen = dense ? 2 : 3;
        if (template.slots.some((slot) => slot.length > maxLen || slot.length < minLen)) {
          if (wantImages > 0 && attempt < 8 && bindTry === 0) {
            const bad = template.slots.filter((slot) => slot.length > maxLen || slot.length < minLen);
            console.log(
              `   … image attempt ${attempt + 1}: unfillable slot lengths ${bad.map((s) => s.length).join(',')}`
            );
          }
          continue;
        }
        if (dense && template.slots.length > 0) {
          const twoLetter = template.slots.filter((slot) => slot.length === 2).length;
          if (twoLetter / template.slots.length > DENSE_MAX_TWO_LETTER_SHARE) {
            continue;
          }
        }

        const templateStats = scoreTemplate(template);
        if (this.language === 'he' && !templateQualityOk(templateStats, wantImages, dense)) {
          if (attempt < 8 && bindTry === 0) {
            console.log(
              `   … attempt ${attempt + 1}: template quality ${formatQuality(templateStats)}`
            );
          }
          break;
        }

        if ((wantImages > 0 || dense) && bindTry === 0) {
          const images = template.slots
            .filter((slot) => slot.clueType === 'image')
            .map((slot) => `${slot.direction}:${slot.length}`)
            .join(',');
          console.log(
            `   … attempt ${attempt + 1}: solving ${template.slots.length} slots` +
              (images ? ` [${images}]` : '') +
              ` (${Date.now() - t0}ms tmpl) ${formatQuality(templateStats)}`
          );
        }
        const solveTries = wantImages > 0 ? 2 : 1;
        const repairRounds = dense ? 4 : 0;
        let working = template;
        for (let solveTry = 0; solveTry < solveTries && !puzzle; solveTry++) {
          for (let repairRound = 0; repairRound <= repairRounds && !puzzle; repairRound++) {
            if (repairRound > 0) {
              const failed = this.lastFailedSlot;
              if (!failed) break;
              const repaired = repairTemplateAroundSlot(working, failed, {
                minSlotLength: 2,
                maxSlotLength: maxLen,
                simpleArrows: true,
                maxTwoLetterShare: DENSE_MAX_TWO_LETTER_SHARE,
              });
              if (!repaired) break;
              working = repaired;
              if (attempt < 8 && repairRound === 1) {
                console.log(
                  `   … attempt ${attempt + 1}: fill-repair ${formatQuality(scoreTemplate(working))}`
                );
              }
            }
            puzzle = this.solveTemplate(working, meta, dense);
          }
        }
        if (puzzle) break;
      }
      if (!puzzle) {
        if (wantImages > 0) {
          console.log(`   … image attempt ${attempt + 1}: solve/validate failed`);
        } else if (this.language === 'he' && (attempt < 8 || (attempt + 1) % 8 === 0)) {
          console.log(`   … attempt ${attempt + 1}: solve failed`);
        }
        continue;
      }
      const empty = getUncoveredCells(puzzle);
      if (empty.length > 0) {
        if (wantImages > 0 && attempt < 8) {
          console.log(
            `   … image attempt ${attempt + 1}: puzzle has ${empty.length} empty cells`
          );
        }
        continue;
      }
      const stats = scorePuzzle(puzzle);
      if (this.language === 'he' && !puzzleQualityOk(stats, wantImages, dense)) {
        if (attempt < 8) {
          console.log(
            `   … attempt ${attempt + 1}: filled but quality ${formatQuality(stats)}`
          );
        }
        continue;
      }
      if (this.language === 'he') {
        console.log(`   quality ${formatQuality(stats)}`);
      }
      return puzzle;
    }
    return null;
  }

  /**
   * Daily profile: framed dual-clue layout, fully interlocked fill from well-liked words,
   * clues picked by quality near the target difficulty. Tries many layouts with a short
   * solve budget each — fillable layouts solve fast, the rest are not worth waiting on.
   */
  generateDaily(options: DailyGenerationOptions): Puzzle | null {
    const { rows, cols } = options;
    const wantImages = options.imageClueCount ?? 0;
    if (wantImages > 0 && this.imageClueCatalog.length < wantImages) {
      console.error(`Image-clue catalog has ${this.imageClueCatalog.length} entries, need ${wantImages}.`);
      return null;
    }
    const avoid = new Set([...(options.avoidAnswers ?? [])].map((w) => normalizeWord(w)));
    const words = this.clueProvider
      .getWordPool()
      .filter((word) => !this.clueProvider.getWordMeta?.(word)?.excludeFromDaily);
    // Recent answers stay available (hard exclusion starves the fill) but lose to fresh ones.
    const wordScore = (word: string) => {
      const normalized = normalizeWord(word);
      const recentPenalty = normalized.length >= 4 && avoid.has(normalized) ? 5 : 0;
      const tier = this.clueProvider.getWordMeta?.(word)?.tier;
      const difficultyMiss =
        options.wordDifficultyWeight && tier != null
          ? Math.abs(tier - (options.targetDifficulty ?? 1.5)) * options.wordDifficultyWeight
          : 0;
      return dailyWordScore(this.clueProvider, word) - recentPenalty - difficultyMiss;
    };
    const tagCaps = options.tagCaps ?? DEFAULT_DAILY_TAG_CAPS;
    const targets = dailyTargetsFor(wantImages);
    const clueSelection = {
      targetDifficulty: options.targetDifficulty ?? 1.5,
      avoidClues: new Set(options.avoidClues ?? []),
    };

    const deadline = Date.now() + (options.timeBudgetMs ?? 240000);
    let attempt = 0;
    let filled = 0;
    // Most image placements can't host a framed layout, but one that did once usually does again.
    const workingPlans: ReturnType<typeof planImageClues>[] = [];
    while (Date.now() < deadline) {
      attempt++;
      const reuse = wantImages > 0 && workingPlans.length > 0 && Math.random() < 0.8;
      const imagePlan = reuse
        ? structuredClone(workingPlans[Math.floor(Math.random() * workingPlans.length)])
        : wantImages > 0
          ? planImageClues(rows, cols, wantImages, this.catalogPreferredLengths())
          : [];
      if (imagePlan.length < wantImages) continue;
      const pristinePlan = structuredClone(imagePlan);
      const template = generateFramedTemplate({
        rows,
        cols,
        name: `${rows}x${cols} daily`,
        cutoutCells: imagePlan.length ? imageBlockCutouts(imagePlan) : undefined,
        lockedCells: imagePlan.length ? imageExitLocks(imagePlan) : undefined,
        attempts: wantImages > 0 && !reuse ? 5 : 30,
      });
      if (!template) continue;
      if (wantImages > 0 && !reuse) workingPlans.push(pristinePlan);
      if (!this.bindImageClues(template, imagePlan, this.imageClueCatalog)) continue;
      const layoutMisses = dailyTargetMisses(scoreTemplate(template), targets);
      if (layoutMisses.length > 0) continue;

      const state = solveDenseGrid(template, {
        words,
        maxSolveTimeMs: Math.min(options.solveMsPerTemplate ?? 2500, Math.max(0, deadline - Date.now())),
        wordScore,
        tagsOf: (word) => dailyTagsFor(this.clueProvider, word),
        tagCaps,
        quiet: true,
      });
      if (!state) continue;
      filled++;

      let puzzle: Puzzle;
      try {
        puzzle = generatePuzzleFromGrid(template, state, {
          title: options.title,
          category: options.category,
          language: this.language,
          clueSelection,
        });
      } catch (error) {
        console.log(`   … daily attempt ${attempt}: ${(error as Error).message.slice(0, 120)}`);
        continue;
      }
      if (getUncoveredCells(puzzle).length > 0) continue;
      const stats = scorePuzzle(puzzle);
      const misses = dailyTargetMisses(stats, targets);
      if (misses.length > 0) {
        console.log(`   … daily attempt ${attempt}: filled but ${misses.join('; ')}`);
        continue;
      }
      puzzle.metadata = { ...(puzzle.metadata ?? {}), generationMethod: 'daily-framed' };
      if (options.difficulty) puzzle.difficulty = options.difficulty;
      console.log(
        `   ✅ daily ${rows}x${cols} after ${attempt} layouts (${filled} filled): ${formatQuality(stats)}`
      );
      return puzzle;
    }
    console.log(`   ❌ daily ${rows}x${cols}: no board in budget (${attempt} layouts, ${filled} filled)`);
    return null;
  }

  private clearImageBinds(template: GridTemplate): void {
    for (const slot of template.slots) {
      if (slot.clueType !== 'image') continue;
      if (slot.exitRow != null) slot.startRow = slot.exitRow;
      if (slot.exitCol != null) slot.startCol = slot.exitCol;
      delete slot.clueType;
      delete slot.imageUrl;
      delete slot.fixedAnswer;
      delete slot.fixedEnumeration;
      delete slot.candidateAnswers;
      delete slot.imageUrlByAnswer;
      delete slot.exitRow;
      delete slot.exitCol;
    }
  }

  private catalogPreferredLengths(): number[] {
    const counts = new Map<number, number>();
    for (const entry of this.imageClueCatalog) {
      const len = catalogLetterLength(entry);
      counts.set(len, (counts.get(len) ?? 0) + 1);
    }
    // Prefer lengths the catalog can actually supply (5–9). Require at least 2
    // answers so bindImageClues has a choice; fall back to richest available.
    const preferred = [...counts.entries()]
      .filter(([len, n]) => len >= 5 && len <= 9 && n >= 2)
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .map(([len]) => len);
    if (preferred.length > 0) return preferred;
    const any = [...counts.entries()]
      .filter(([len, n]) => len >= 4 && len <= 10 && n >= 1)
      .sort((a, b) => b[1] - a[1])
      .map(([len]) => len);
    return any.length > 0 ? any : [7, 8, 6, 5];
  }

  private bindImageClues(
    template: GridTemplate,
    imagePlan: PlannedImageClue[],
    catalog: ImageClueCatalogEntry[]
  ): boolean {
    if (imagePlan.length === 0) return true;

    const catalogByLen = new Map<number, number>();
    for (const entry of catalog) {
      const len = catalogLetterLength(entry);
      catalogByLen.set(len, (catalogByLen.get(len) ?? 0) + 1);
    }

    const usedSlots = new Set<string>();
    for (const img of imagePlan) {
      const candidates = template.slots.filter(
        (s) =>
          !usedSlots.has(s.id) &&
          s.startRow === img.exitRow &&
          s.startCol === img.exitCol &&
          s.length >= 4 &&
          s.length <= 10 &&
          (catalogByLen.get(s.length) ?? 0) >= 1
      );
      // Prefer planned length, then catalog-rich lengths, then matching direction.
      candidates.sort((a, b) => {
        const aDir = a.direction === img.direction ? 1 : 0;
        const bDir = b.direction === img.direction ? 1 : 0;
        if (bDir !== aDir) return bDir - aDir;
        const aPlan = a.length === img.answerLength ? 1 : 0;
        const bPlan = b.length === img.answerLength ? 1 : 0;
        if (bPlan !== aPlan) return bPlan - aPlan;
        return (catalogByLen.get(b.length) ?? 0) - (catalogByLen.get(a.length) ?? 0);
      });
      const slot = candidates[0];
      if (!slot) return false;

      const fromExit = getSlotCells({
        ...slot,
        cells: undefined,
        clueType: 'image',
        exitRow: img.exitRow,
        exitCol: img.exitCol,
        startRow: img.exitRow,
        startCol: img.exitCol,
        direction: slot.direction,
      });
      if (
        fromExit.length < 3 ||
        fromExit.some((cell) => isInImageBlock(cell.row, cell.col, img.startRow, img.startCol))
      ) {
        return false;
      }

      const entries = shuffled(
        catalog.filter((entry) => catalogLetterLength(entry) === slot.length)
      );
      if (entries.length < 1) {
        console.log(`   … no image answer of length ${slot.length}`);
        return false;
      }

      const rowDelta = fromExit.length >= 2 ? fromExit[1].row - fromExit[0].row : 0;
      const colDelta = fromExit.length >= 2 ? fromExit[1].col - fromExit[0].col : 0;
      const probe = createEmptyGridState(template.rows, template.cols);
      for (const clue of template.clueCells) {
        probe.clueCells.add(`${clue.row},${clue.col}`);
      }
      for (const block of imagePlan) {
        probe.clueCells.add(`${block.exitRow},${block.exitCol}`);
        for (let dr = 0; dr < 3; dr++) {
          for (let dc = 0; dc < 3; dc++) {
            const row = block.startRow + dr;
            const col = block.startCol + dc;
            if (row === block.exitRow && col === block.exitCol) continue;
            probe.clueCells.add(`${row},${col}`);
          }
        }
      }
      if (!entries.some((entry) => canPlaceWord(probe, entry.answer, fromExit, rowDelta, colDelta))) {
        return false;
      }

      const imageUrlByAnswer: Record<string, string> = {};
      for (const entry of entries) {
        imageUrlByAnswer[entry.answer] = entry.imageUrl;
        imageUrlByAnswer[normalizeWord(entry.answer)] = entry.imageUrl;
      }

      usedSlots.add(slot.id);
      slot.cells = fromExit;
      slot.clueType = 'image';
      slot.exitRow = img.exitRow;
      slot.exitCol = img.exitCol;
      slot.startRow = img.startRow;
      slot.startCol = img.startCol;
      slot.candidateAnswers = entries.map((entry) => entry.answer);
      slot.imageUrlByAnswer = imageUrlByAnswer;
      delete slot.fixedAnswer;
      delete slot.imageUrl;
    }

    const probe = createEmptyGridState(template.rows, template.cols);
    for (const clue of template.clueCells) {
      probe.clueCells.add(`${clue.row},${clue.col}`);
    }
    for (const slot of template.slots) {
      if (slot.clueType !== 'image') continue;
      if (slot.exitRow != null) probe.clueCells.add(`${slot.exitRow},${slot.exitCol}`);
      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          probe.clueCells.add(`${slot.startRow + dr},${slot.startCol + dc}`);
        }
      }
    }
    const dummy = (length: number) => 'א'.repeat(length);
    let filled = probe;
    const orderedSlots = [
      ...template.slots.filter((slot) => slot.clueType === 'image'),
      ...template.slots.filter((slot) => slot.clueType !== 'image'),
    ];
    for (const slot of orderedSlots) {
      const cells = getSlotCells(slot);
      const rowDelta = cells.length >= 2 ? cells[1].row - cells[0].row : 0;
      const colDelta = cells.length >= 2 ? cells[1].col - cells[0].col : 0;
      const word = dummy(slot.length);
      if (!canPlaceWord(filled, word, cells, rowDelta, colDelta)) {
        return false;
      }
      filled = placeWord(filled, slot.id, word, cells, rowDelta, colDelta);
    }
    return true;
  }

  private buildTemplate(
    rows: number,
    cols: number,
    cutoutCells?: Array<{ row: number; col: number }>,
    lockedCells?: Array<{
      row: number;
      col: number;
      type: '0' | '1' | '2' | '3' | '4' | '5' | '6';
    }>,
    protectedCells?: Array<{
      row: number;
      col: number;
      type: '0' | '1' | '2' | '3' | '4' | '5' | '6';
    }>,
    dense = false
  ): GridTemplate | null {
    const cells = rows * cols;
    const large = cells >= 144;
    const xl = cells >= 225;
    const withImages = (cutoutCells?.length ?? 0) > 0;
    try {
      const template = generateTemplate({
        rows,
        cols,
        name: `${rows}x${cols} arrow crossword`,
        quiet: true,
        // Same GA budget for text + image Hebrew — text used to burn minutes per layout.
        maxIterations: this.language === 'he'
          ? (xl ? 14 : large ? 12 : 12)
          : 8,
        minPopulation: 4,
        populationSize: this.language === 'he' ? 8 : 5,
        weakBreakCondition: this.language === 'he' ? 180 : 80,
        strongBreakCondition: this.language === 'he' ? 420 : 250,
        maxBoundaryRetries: withImages ? 2 : dense ? 4 : 3,
        crossoverSamples: withImages ? 12 : undefined,
        // Cap slot length like image/daily boards — len 9–11 rarely fill in Hebrew.
        maxSlotLength: this.language === 'he' ? 8 : undefined,
        minSlotLength: dense ? 2 : 3,
        densePacking: dense,
        maxTwoLetterShare: dense ? DENSE_MAX_TWO_LETTER_SHARE : undefined,
        sparse: false,
        simpleArrows: dense,
        lattice: false,
        // Keep the step-5 newspaper lattice off — it has weak crossing ratios.
        newspaper: false,
        cutoutCells,
        lockedCells,
        protectedCells,
      });
      template.metadata = {
        ...(template.metadata ?? {}),
        generationMethod: dense ? 'dense-simple-arrows' : 'ga',
        minSlotLength: dense ? 2 : 3,
      };
      return template;
    } catch (error) {
      if (withImages || dense) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(`   … template error: ${message.slice(0, 160)}`);
      }
      return null;
    }
  }

  private solveTemplate(
    template: GridTemplate,
    config: { title: string; category: string; difficulty?: Difficulty },
    dense = false
  ): Puzzle | null {
    this.lastFailedSlot = undefined;
    const slotCount = template.slots.length;
    const maxAttempts = Math.min(80000 + slotCount * 5000, dense ? 360000 : 300000);
    const cells = template.rows * template.cols;
    const hasImages = template.slots.some((slot) => slot.clueType === 'image');
    const imageSlotCount = template.slots.filter((slot) => slot.clueType === 'image').length;
    const maxSolveTimeMs = hasImages
      ? // 3+ image boards need more solver time on 14×14/15×15
        imageSlotCount >= 3
          ? cells >= 196
            ? 90000
            : 75000
          : cells >= 196
            ? 45000
            : 35000
      : // Dense text needs more fill time; otherwise fail faster so more templates get tried.
        (this.language === 'he' ? (dense ? 22 : 14) : 12) * 1000 +
        cells * (cells >= 256 ? 40 : 25);
    const jitter = new Map<string, number>();
    const wordScorer = (word: string, _placedWords: string[]) => {
      let j = jitter.get(word);
      if (j === undefined) {
        j = Math.random();
        jitter.set(word, j);
      }
      const rank = this.clueProvider.getAnswerRank(word);
      return -Math.log(Math.max(rank, 1)) + j;
    };

    const tSolve = Date.now();
    const solved = solveGrid(template, this.wordIndex, {
      maxAttempts,
      maxSolveTimeMs,
      maxTextSliceMs: hasImages ? (imageSlotCount >= 3 ? 16000 : 10000) : undefined,
      wordScorer,
      quiet: true,
    });
    this.lastFailedSlot = solved.failedSlot;
    const result = solved.state;
    if (!result) {
      if (hasImages) {
        console.log(`   … solver empty after ${Date.now() - tSolve}ms`);
      }
      return null;
    }

    try {
      return generatePuzzleFromGrid(template, result, {
        title: config.title,
        category: config.category,
        language: this.language,
        difficulty: config.difficulty,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('validation failed') ||
          error.message.includes('No clue available') ||
          error.message.includes('out of sync'))
      ) {
        console.error(`  ❌ ${error.message}`);
        return null;
      }
      throw error;
    }
  }
}

export function generatePuzzlesBatch(config: {
  difficulty: Difficulty;
  count: number;
  category: string;
  startIndex: number;
  rows?: number;
  cols?: number;
  sizes?: GridSize[];
  language?: Language;
  strictSize?: boolean;
  imageClueCount?: number;
  imageClueCatalog?: ImageClueCatalogEntry[];
  imageClueAttempts?: number;
  attempts?: number;
}): Puzzle[] {
  const language = config.language ?? 'en';
  const generator = new PuzzleGenerator(language, config.imageClueCatalog);
  return generator.generateBatch({
    count: config.count,
    category: config.category,
    getTitle: (i) => `${config.startIndex + i}`,
    rows: config.rows,
    cols: config.cols,
    sizes: config.sizes,
    strictSize: config.strictSize,
    imageClueCount: config.imageClueCount,
    imageClueAttempts: config.imageClueAttempts,
    attempts: config.attempts,
    difficulty: config.difficulty,
  });
}

export function generateDailyPuzzle(
  options: DailyGenerationOptions & { imageClueCatalog?: ImageClueCatalogEntry[] }
): Puzzle | null {
  return new PuzzleGenerator('he', options.imageClueCatalog).generateDaily(options);
}

/** Prefer 15×15; fall back to smaller only if 15 cannot fill. */
export function generateLargestImageCluePuzzle(config: {
  category: string;
  startIndex: number;
  imageClueCount?: number;
  imageClueCatalog: ImageClueCatalogEntry[];
  imageClueAttempts?: number;
  sizes?: GridSize[];
}): Puzzle | null {
  const generator = new PuzzleGenerator('he', config.imageClueCatalog);
  const counts = config.imageClueCount
    ? [config.imageClueCount]
    : IMAGE_CLUE_COUNT_LADDER;
  const sizes = config.sizes ?? IMAGE_CLUE_SIZE_LADDER;
  for (const size of sizes) {
    for (const imageCount of counts) {
      const base = config.imageClueAttempts ?? (imageCount >= 4 ? 64 : 48);
      const cells = size.rows * size.cols;
      // Full budget for 14×14 and 15×15 — smaller boards only get a reduced share.
      const attempts =
        cells >= 196 ? base :
        Math.max(10, Math.round(base * 0.55));
      console.log(
        `\n—— Trying ${size.rows}x${size.cols} with ${imageCount} image${imageCount === 1 ? '' : 's'} (${attempts} attempts) ——`
      );
      const t0 = Date.now();
      const puzzles = generator.generateBatch({
        count: 1,
        category: config.category,
        getTitle: () => `${config.startIndex}`,
        rows: size.rows,
        cols: size.cols,
        strictSize: true,
        imageClueCount: imageCount,
        imageClueAttempts: attempts,
      });
      console.log(
        `   ${size.rows}x${size.cols} / ${imageCount} image(s) elapsed ${Date.now() - t0}ms`
      );
      if (puzzles[0]) {
        console.log(`   ✅ filled ${size.rows}x${size.cols}`);
        return puzzles[0];
      }
      console.log(`   did not fill, trying next size`);
    }
  }
  return null;
}
