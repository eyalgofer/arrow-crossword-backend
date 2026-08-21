#!/usr/bin/env python3
"""
Extract clue/answer pairs from solved Hebrew תשחץ images (Mor Turgeman / mor-hbr.com).

Keeps only isolated {clue, answer} pairs — never the original grid layout.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import tempfile
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Optional

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

HEBREW_RE = re.compile(r"[\u05D0-\u05EA]+")
HEBREW_CHARS = "".join(chr(c) for c in range(0x05D0, 0x05EB))
FINAL_FORMS = {"כ": "ך", "מ": "ם", "נ": "ן", "פ": "ף", "צ": "ץ"}
REGULAR_FORMS = {v: k for k, v in FINAL_FORMS.items()}

MIN_ANSWER_LEN = 3
MAX_ANSWER_LEN = 10
MAX_CLUE_LEN = 28


def apply_final_forms(word: str) -> str:
    chars = [REGULAR_FORMS.get(ch, ch) for ch in word]
    if chars and chars[-1] in FINAL_FORMS:
        chars[-1] = FINAL_FORMS[chars[-1]]
    return "".join(chars)


def hebrew_only(text: str) -> str:
    return "".join(ch for ch in text if "\u05D0" <= ch <= "\u05EA")


def clean_clue(text: str) -> str:
    text = text.replace("|", " ").replace("_", " ").replace("-", " ")
    text = re.sub(r"\[[0-9,\s]+\]", " ", text)
    text = re.sub(r"[^\u05D0-\u05EA\u05F3\u05F4\"' ]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    tokens = text.split()
    while tokens and len(hebrew_only(tokens[-1])) <= 1:
        tokens.pop()
    while tokens and len(hebrew_only(tokens[0])) <= 1:
        tokens.pop(0)
    return " ".join(tokens)


def is_usable_clue(clue: str, answer: str) -> bool:
    if not clue:
        return False
    for token in clue.split():
        letters = hebrew_only(token)
        if letters and apply_final_forms(letters) == answer:
            return False
    return True


def peaks(frac: np.ndarray, min_val: float, min_dist: int) -> list[int]:
    idx: list[int] = []
    for i in range(1, len(frac) - 1):
        if frac[i] > min_val and frac[i] >= frac[i - 1] and frac[i] >= frac[i + 1]:
            if not idx or i - idx[-1] >= min_dist:
                idx.append(i)
            elif frac[i] > frac[idx[-1]]:
                idx[-1] = i
    return idx


def detect_grid(arr: np.ndarray) -> tuple[list[int], list[int]]:
    gray = 0.3 * arr[:, :, 0] + 0.59 * arr[:, :, 1] + 0.11 * arr[:, :, 2]
    dark = gray < 80
    ys = peaks(dark.mean(axis=1), 0.22, 70)
    xs = peaks(dark.mean(axis=0), 0.22, 70)
    if len(ys) < 6 or len(xs) < 6:
        raise RuntimeError(f"grid detection failed (lines y={len(ys)} x={len(xs)})")
    return ys, xs


def cell_mean_rgb(arr: np.ndarray, y0: int, y1: int, x0: int, x1: int) -> tuple[float, float, float]:
    pad_y = max(4, (y1 - y0) // 18)
    pad_x = max(4, (x1 - x0) // 18)
    sl = arr[y0 + pad_y : y1 - pad_y, x0 + pad_x : x1 - pad_x]
    if sl.size == 0:
        sl = arr[y0:y1, x0:x1]
    return float(sl[:, :, 0].mean()), float(sl[:, :, 1].mean()), float(sl[:, :, 2].mean())


def is_clue_cell(rgb: tuple[float, float, float]) -> bool:
    r, g, b = rgb
    # Letter cells are near-white. Clue fills are blue, orange, green, yellow, pink.
    if min(r, g, b) > 220:
        return False
    if max(r, g, b) - min(r, g, b) < 28:
        return False
    return max(r, g, b) > 130


def tesseract(image: Image.Image, psm: int, whitelist: Optional[str] = None) -> str:
    with tempfile.TemporaryDirectory() as td:
        inp = os.path.join(td, "in.png")
        outbase = os.path.join(td, "out")
        w, h = image.size
        scale = 3 if max(w, h) < 220 else 2
        up = image.resize((max(1, w * scale), max(1, h * scale)), Image.Resampling.LANCZOS)
        if up.mode != "L":
            up = ImageOps.grayscale(up)
        up = ImageOps.autocontrast(up)
        up.save(inp)
        cmd = ["tesseract", inp, outbase, "-l", "heb", "--psm", str(psm), "--oem", "1"]
        if whitelist:
            cmd += ["-c", f"tessedit_char_whitelist={whitelist}"]
        subprocess.run(cmd, capture_output=True)
        txt_path = outbase + ".txt"
        if not os.path.exists(txt_path):
            return ""
        return Path(txt_path).read_text(encoding="utf-8", errors="replace")


_TEMPLATES: Optional[list[tuple[str, np.ndarray]]] = None
_FONT_PATHS = (
    "/System/Library/Fonts/ArialHB.ttc",
    "/System/Library/Fonts/SFHebrew.ttf",
)


def letter_templates() -> list[tuple[str, np.ndarray]]:
    global _TEMPLATES
    if _TEMPLATES is not None:
        return _TEMPLATES
    letters = list("אבגדהוזחטיךכלםמןנסעףפץצקרשת")
    tmpls: list[tuple[str, np.ndarray]] = []
    size = 48
    for fontpath in _FONT_PATHS:
        try:
            font = ImageFont.truetype(fontpath, int(size * 0.82))
        except OSError:
            continue
        for ch in letters:
            im = Image.new("L", (size, size), 255)
            dr = ImageDraw.Draw(im)
            bbox = dr.textbbox((0, 0), ch, font=font)
            tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
            x = (size - tw) // 2 - bbox[0]
            y = (size - th) // 2 - bbox[1]
            dr.text((x, y), ch, font=font, fill=0)
            a = np.where(np.array(im) < 128, 1.0, 0.0)
            n = np.sqrt((a ** 2).sum()) or 1.0
            tmpls.append((ch, a / n))
    _TEMPLATES = tmpls
    return tmpls


@dataclass
class LetterBlob:
    canvas: Image.Image
    frac_h: float
    frac_w: float
    fill: float
    cy: float


def isolate_letter(cell: Image.Image) -> Optional[LetterBlob]:
    """Union of compact dark blobs in the upper letter band (skip hollow arrows)."""
    g = np.array(ImageOps.grayscale(cell))
    h, w = g.shape
    mask = np.ones((h, w), dtype=bool)
    by, bx = max(4, h // 18), max(4, w // 16)
    mask[:by, :] = False
    mask[-int(h * 0.06) :, :] = False
    mask[:, :bx] = False
    mask[:, -bx:] = False
    mask[: int(h * 0.12), : int(w * 0.18)] = False
    mask[: int(h * 0.12), int(w * 0.82) :] = False
    dark = (g < 100) & mask
    if dark.sum() < 18:
        dark = (g < 130) & mask
    if dark.sum() < 10:
        return None

    vis = np.zeros_like(dark, dtype=bool)
    comps: list[tuple[int, int, int, int, float, int]] = []
    tall = h > w * 1.3
    ys, xs = np.where(dark)
    for y, x in zip(ys, xs):
        if vis[y, x]:
            continue
        stack = [(y, x)]
        vis[y, x] = True
        pts_y = [y]
        pts_x = [x]
        while stack:
            cy, cx = stack.pop()
            for ny in (cy - 1, cy, cy + 1):
                for nx in (cx - 1, cx, cx + 1):
                    if 0 <= ny < h and 0 <= nx < w and dark[ny, nx] and not vis[ny, nx]:
                        vis[ny, nx] = True
                        stack.append((ny, nx))
                        pts_y.append(ny)
                        pts_x.append(nx)
        area = len(pts_y)
        if area < 10:
            continue
        y0, y1, x0, x1 = min(pts_y), max(pts_y), min(pts_x), max(pts_x)
        bw, bh = (x1 - x0 + 1), (y1 - y0 + 1)
        fill = area / max(1, bw * bh)
        cy = float(np.mean(pts_y)) / h
        if fill < 0.16 and area > 40:
            continue
        if x0 < w * 0.10 and bw > bh * 1.15 and cy > 0.22:
            continue
        comps.append((y0, y1, x0, x1, cy, area))
    if not comps:
        return None

    cy_max = 0.30 if tall else 0.62
    upper = [c for c in comps if c[4] <= cy_max]
    use = upper if upper else comps
    y0 = min(c[0] for c in use)
    y1 = max(c[1] for c in use)
    x0 = min(c[2] for c in use)
    x1 = max(c[3] for c in use)
    area = sum(c[5] for c in use)
    bw, bh = (x1 - x0 + 1), (y1 - y0 + 1)
    fill = area / max(1, bw * bh)
    if fill < 0.22 and len(use) > 1:
        use = [max(use, key=lambda c: c[5])]
        y0, y1, x0, x1 = use[0][0], use[0][1], use[0][2], use[0][3]
        area = use[0][5]
        bw, bh = (x1 - x0 + 1), (y1 - y0 + 1)
        fill = area / max(1, bw * bh)
    pad = 3
    y0, x0 = max(0, y0 - pad), max(0, x0 - pad)
    y1, x1 = min(h, y1 + pad + 1), min(w, x1 + pad + 1)
    crop = ImageOps.grayscale(cell).crop((x0, y0, x1, y1))
    a = np.where(np.array(crop) < 140, 0, 255).astype("uint8")
    crop = Image.fromarray(a)
    canvas = Image.new("L", (140, 140), 255)
    cw, ch = crop.size
    scale = 70 / max(cw, ch)
    nw, nh = max(1, int(cw * scale)), max(1, int(ch * scale))
    crop = crop.resize((nw, nh), Image.Resampling.NEAREST)
    canvas.paste(crop, ((140 - nw) // 2, (140 - nh) // 2))
    return LetterBlob(
        canvas=canvas,
        frac_h=(y1 - y0) / h,
        frac_w=(x1 - x0) / w,
        fill=fill,
        cy=(y0 + y1) / 2 / h,
    )


def ocr_letter(cell: Image.Image) -> str:
    blob = isolate_letter(cell)
    if blob is None:
        return ""
    a = np.array(blob.canvas.resize((48, 48), Image.Resampling.BILINEAR))
    vec = np.where(a < 128, 1.0, 0.0)
    n = np.sqrt((vec ** 2).sum()) or 1.0
    vec = vec / n
    scored: dict[str, float] = {}
    for ch, tmpl in letter_templates():
        s = float((vec * tmpl).sum())
        if ch not in scored or s > scored[ch]:
            scored[ch] = s
    ranked = sorted(scored.items(), key=lambda kv: -kv[1])
    if not ranked or ranked[0][1] < 0.40:
        return ""
    ch, score = ranked[0]
    # Isolated vertical stroke: י is shorter than ו.
    if blob.fill > 0.8 and blob.frac_w < 0.12:
        ch = "י" if blob.frac_h < 0.105 else "ו"
    return ch


def find_dash_y(cell_arr: np.ndarray) -> Optional[int]:
    gray = 0.3 * cell_arr[:, :, 0] + 0.59 * cell_arr[:, :, 1] + 0.11 * cell_arr[:, :, 2]
    h, w = gray.shape[:2]
    best = None
    best_score = 0.0
    # Real two-clue separators sit near the middle; edge hits are arrows/text.
    for y in range(int(h * 0.36), int(h * 0.68)):
        row = gray[y, int(w * 0.12) : int(w * 0.88)] < 90
        if row.mean() < 0.12:
            continue
        runs = 0
        prev = False
        for v in row:
            if v and not prev:
                runs += 1
            prev = bool(v)
        score = runs * row.mean()
        if runs >= 5 and score > best_score:
            best_score = score
            best = y
    return best


def white_mask(cell_arr: np.ndarray) -> np.ndarray:
    r, g, b = cell_arr[:, :, 0], cell_arr[:, :, 1], cell_arr[:, :, 2]
    return (r > 228) & (g > 228) & (b > 228)


@dataclass
class Arrow:
    kind: str  # left | right | down_left | down_right | down_below
    strength: int
    cy: float = 0.5
    cx: float = 0.5


def classify_blob(x0: int, x1: int, y0: int, y1: int, w: int, h: int, n: int) -> Optional[Arrow]:
    if n < 40:
        return None
    bw = (x1 - x0 + 1) / w
    bh = (y1 - y0 + 1) / h
    cy = (y0 + y1) / 2 / h
    cx = (x0 + x1) / 2 / w
    on_left = x0 <= max(4, int(0.08 * w))
    on_right = x1 >= int(0.82 * w)
    on_bottom = y1 >= int(0.82 * h)
    on_top = y0 <= int(0.14 * h)

    if on_bottom and cy > 0.75:
        return Arrow("down_below", n, cy, cx)
    if on_left and on_top and bh < 0.18 and bw < 0.22:
        return Arrow("down_left", n, cy, cx)
    if on_right and on_top and bh < 0.18 and bw < 0.22:
        return Arrow("down_right", n, cy, cx)
    if on_left and 0.22 < cy < 0.78 and bw >= 0.12:
        return Arrow("left", n, cy, cx)
    if on_right and 0.22 < cy < 0.78 and bw >= 0.12:
        return Arrow("right", n, cy, cx)
    if on_left and bw >= 0.18:
        return Arrow("left", n, cy, cx)
    if on_right and bw >= 0.18:
        return Arrow("right", n, cy, cx)
    if on_top and on_left:
        return Arrow("down_left", n, cy, cx)
    if on_top and on_right:
        return Arrow("down_right", n, cy, cx)
    return None


def arrows_in_region(cell_arr: np.ndarray) -> list[Arrow]:
    white = white_mask(cell_arr)
    h, w = white.shape
    vis = np.zeros_like(white, dtype=bool)
    found: list[Arrow] = []
    ys, xs = np.where(white)
    for y, x in zip(ys, xs):
        if vis[y, x]:
            continue
        stack = [(y, x)]
        vis[y, x] = True
        pts_y = [y]
        pts_x = [x]
        while stack:
            cy, cx = stack.pop()
            for ny in range(cy - 1, cy + 2):
                for nx in range(cx - 1, cx + 2):
                    if 0 <= ny < h and 0 <= nx < w and white[ny, nx] and not vis[ny, nx]:
                        vis[ny, nx] = True
                        stack.append((ny, nx))
                        pts_y.append(ny)
                        pts_x.append(nx)
        n = len(pts_y)
        y0, y1, x0, x1 = min(pts_y), max(pts_y), min(pts_x), max(pts_x)
        arrow = classify_blob(x0, x1, y0, y1, w, h, n)
        if arrow:
            found.append(arrow)
    found.sort(key=lambda a: -a.strength)
    # unique kinds, strongest first
    seen = set()
    uniq: list[Arrow] = []
    for a in found:
        if a.kind not in seen:
            seen.add(a.kind)
            uniq.append(a)
    return uniq


def ocr_clue_crop(im: Image.Image) -> str:
    # white padding helps Tesseract treat this as a text block
    padded = Image.new("RGB", (im.size[0] + 24, im.size[1] + 24), (255, 255, 255))
    padded.paste(im, (12, 12))
    raw = tesseract(padded, 6)
    lines = [clean_clue(line) for line in raw.splitlines()]
    lines = [ln for ln in lines if ln]
    return clean_clue(" ".join(lines))


def start_and_delta(kind: str, r: int, c: int) -> Optional[tuple[int, int, int, int]]:
    """Return (sr, sc, dr, dc) for walking letter cells."""
    if kind == "left":
        return r, c - 1, 0, -1
    if kind == "right":
        return r, c + 1, 0, 1
    if kind == "down_left":
        return r, c - 1, 1, 0
    if kind == "down_right":
        return r, c + 1, 1, 0
    if kind == "down_below":
        return r + 1, c, 1, 0
    return None


def walk_answer(letters: list[list[str]], sr: int, sc: int, dr: int, dc: int) -> str:
    rows, cols = len(letters), len(letters[0])
    chars: list[str] = []
    r, c = sr, sc
    while 0 <= r < rows and 0 <= c < cols:
        ch = letters[r][c]
        if not ch:
            break
        chars.append(ch)
        r += dr
        c += dc
    return apply_final_forms("".join(REGULAR_FORMS.get(ch, ch) for ch in chars))


@dataclass
class Pair:
    clue: str
    answer: str
    source: str


def extract_image(path: Path) -> list[Pair]:
    im = Image.open(path).convert("RGB")
    arr = np.array(im)
    ys, xs = detect_grid(arr)
    rows, cols = len(ys) - 1, len(xs) - 1
    kinds = [["?" for _ in range(cols)] for _ in range(rows)]
    letters = [["" for _ in range(cols)] for _ in range(rows)]
    crops: dict[tuple[int, int], Image.Image] = {}

    for i in range(rows):
        for j in range(cols):
            y0, y1, x0, x1 = ys[i], ys[i + 1], xs[j], xs[j + 1]
            crop = im.crop((x0, y0, x1, y1))
            crops[(i, j)] = crop
            rgb = cell_mean_rgb(arr, y0, y1, x0, x1)
            if is_clue_cell(rgb):
                kinds[i][j] = "C"
            else:
                kinds[i][j] = "L"
                letters[i][j] = ocr_letter(crop)

    pairs: list[Pair] = []

    def add_pair(clue: str, kind: str, r: int, c: int) -> None:
        clue = clean_clue(clue)
        if len(hebrew_only(clue)) < 3 or len(clue) > MAX_CLUE_LEN:
            return
        start = start_and_delta(kind, r, c)
        if not start:
            return
        sr, sc, dr, dc = start
        answer = walk_answer(letters, sr, sc, dr, dc)
        if not (MIN_ANSWER_LEN <= len(answer) <= MAX_ANSWER_LEN):
            return
        if not re.fullmatch(r"[\u05D0-\u05EA]+", answer):
            return
        if not is_usable_clue(clue, answer):
            return
        pairs.append(Pair(clue, answer, path.name))

    for i in range(rows):
        for j in range(cols):
            if kinds[i][j] != "C":
                continue
            crop = crops[(i, j)]
            cell_arr = np.array(crop)
            dash = find_dash_y(cell_arr)
            if dash is not None:
                gap = 8
                top = crop.crop((6, 4, crop.size[0] - 6, max(8, dash - gap)))
                bot = crop.crop((6, min(crop.size[1] - 8, dash + gap), crop.size[0] - 6, crop.size[1] - 4))
                top_arr = np.array(crop.crop((0, 0, crop.size[0], dash)))
                bot_arr = np.array(crop.crop((0, dash, crop.size[0], crop.size[1])))
                top_clue = ocr_clue_crop(top)
                bot_clue = ocr_clue_crop(bot)
                top_arrows = arrows_in_region(top_arr) or [Arrow("down_left", 1)]
                bot_arrows = arrows_in_region(bot_arr) or [Arrow("down_below", 1)]
                add_pair(top_clue, top_arrows[0].kind, i, j)
                add_pair(bot_clue, bot_arrows[0].kind, i, j)
            else:
                clue = ocr_clue_crop(crop)
                arrs = arrows_in_region(cell_arr)
                if not arrs:
                    # most leftover single clues in this corpus point down into the left column
                    arrs = [Arrow("down_left", 1)]
                add_pair(clue, arrs[0].kind, i, j)

    return pairs


def load_known_answers(repo: Path) -> set[str]:
    known: set[str] = set()
    core = repo / "src" / "scripts" / "core"
    text = (core / "hebrewCluesImported.ts").read_text(encoding="utf-8")
    for m in re.finditer(r'a:\s*["\']([^"\']+)["\']', text):
        known.add(apply_final_forms(m.group(1)))
    return known


def merge_pairs(pairs: Iterable[Pair], known: Optional[set[str]] = None) -> list[dict]:
    known = known or set()
    by_answer: dict[str, dict] = {}
    sources: dict[str, set[str]] = defaultdict(set)
    for p in pairs:
        answer = apply_final_forms(p.answer)
        clue = clean_clue(p.clue)
        if len(hebrew_only(clue)) < 3:
            continue
        sources[answer].add(p.source)
        if answer not in by_answer:
            by_answer[answer] = {"a": answer, "c": [], "t": 1, "prefer": answer in known}
        if clue not in by_answer[answer]["c"]:
            by_answer[answer]["c"].append(clue)

    gk = re.compile(r"עיר|בירת|מדינה|נהר|הר |קיבוץ|שחקנ|נמל|גבינה|מזל")

    def clean_enough(clue: str) -> bool:
        words = clue.split()
        if not (1 <= len(words) <= 6):
            return False
        if any(len(hebrew_only(w)) <= 1 for w in words):
            return False
        return 3 <= len(hebrew_only(clue)) <= MAX_CLUE_LEN

    kept: list[dict] = []
    for answer, entry in by_answer.items():
        clues = [c for c in entry["c"] if clean_enough(c)]
        if not clues:
            continue
        entry["c"] = clues
        nsrc = len(sources[answer])
        if answer in known:
            entry["prefer"] = True
            kept.append(entry)
        elif nsrc >= 2:
            entry["prefer"] = True
            kept.append(entry)
        elif any(gk.search(c) for c in clues) and 4 <= len(answer) <= 10:
            entry["prefer"] = True
            kept.append(entry)
    kept.sort(key=lambda e: e["a"])
    return kept


def ts_literal(entries: list[dict]) -> str:
    lines = [
        "/**",
        " * Clue/answer pairs walked from printed letters in solved תשחץ images.",
        " * Isolated definitions only — original grid layouts are not stored.",
        " * Answers are the letters in the grid, not model guesses from clue meaning.",
        " * This is the sole Hebrew vocab source for the puzzle generator.",
        " */",
        "",
        "export interface RawHebrewEntry {",
        "  a: string;",
        "  c: string[];",
        "  t?: 1 | 2 | 3;",
        "  /** Prefer this answer when filling grids. */",
        "  prefer?: boolean;",
        "}",
        "",
        "export const HEBREW_ENTRIES_IMPORTED: RawHebrewEntry[] = [",
    ]
    for e in entries:
        clues = ", ".join(json.dumps(c, ensure_ascii=False) for c in e["c"])
        lines.append(f"  {{ a: {json.dumps(e['a'], ensure_ascii=False)}, c: [{clues}], prefer: true }},")
    lines.append("];")
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Folder of solved puzzle JPEGs")
    parser.add_argument("--out", required=True, help="Path to hebrewCluesImported.ts")
    parser.add_argument("--json", help="Optional raw JSON dump")
    parser.add_argument("--limit", type=int, default=0, help="Process only N images (debug)")
    args = parser.parse_args()

    folder = Path(args.input)
    images = sorted(
        [p for p in folder.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png"}]
    )
    if args.limit:
        images = images[: args.limit]
    if not images:
        raise SystemExit(f"No images in {folder}")

    all_pairs: list[Pair] = []
    for i, img in enumerate(images, 1):
        try:
            pairs = extract_image(img)
            all_pairs.extend(pairs)
            print(f"[{i}/{len(images)}] {img.name}: {len(pairs)} pairs  (total {len(all_pairs)})", flush=True)
        except Exception as exc:
            print(f"[{i}/{len(images)}] {img.name}: FAILED {exc}", flush=True)

    entries = merge_pairs(all_pairs, load_known_answers(Path(__file__).resolve().parents[2]))
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(ts_literal(entries), encoding="utf-8")
    print(f"Wrote {len(entries)} answers / {len(all_pairs)} raw pairs -> {out}")

    if args.json:
        payload = [{"clue": p.clue, "answer": p.answer, "source": p.source} for p in all_pairs]
        Path(args.json).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
