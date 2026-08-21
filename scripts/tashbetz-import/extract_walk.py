#!/usr/bin/env python3
"""
Walk-based תשחץ import: answers come only from printed letters.

GPT transcribes letters from the actual letter grid (clue text covered)
and reads clue-cell text. Python detects arrows and walks the grid.
The walked string is the answer — never a model-invented word.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from extract import (  # noqa: E402
    MAX_ANSWER_LEN,
    MAX_CLUE_LEN,
    MIN_ANSWER_LEN,
    Pair,
    apply_final_forms,
    arrows_in_region,
    cell_mean_rgb,
    clean_clue,
    detect_grid,
    find_dash_y,
    hebrew_only,
    is_clue_cell,
    is_usable_clue,
    start_and_delta,
    ts_literal,
    walk_answer,
)
from extract_openai import jpeg_data_url, load_dotenv  # noqa: E402

CACHE_VERSION = "v7"

CELL_PROMPT = """You are labeling isolated Hebrew letter cells from a crossword.
Each tile is ONE white cell crop, labeled r,c under it. The letter sits in the upper/center area.
Ignore small black arrows in corners — they are not letters.
Return JSON: {"letters": {"0,0":"נ","1,1":"י"}}
Include EVERY listed label. Value is exactly one Hebrew letter, or "".
Read that glyph only. Do not invent a word. Do not use other tiles to guess.
"""

CLUE_PROMPT = """You are reading Hebrew תשחץ clue text.
Tiles are independent — never combine words from two tiles.
Each crop is labeled (0,1 or 0,1_top). Copy the printed Hebrew inside THAT frame only, every word.
Return JSON: {"clues": {"0,1":"סדר המאורעות","0,1_top":"נרקב","0,1_bot":"מביא לעולם"}}
Include EVERY listed label. Strip enumerations like [5,3]. Do not guess answers. "" if unreadable.
"""


def chat_json(api_key: str, prompt: str, user: str, data_url: str, model: str, max_tokens: int = 2500) -> dict:
    body = {
        "model": model,
        "temperature": 0,
        "max_tokens": max_tokens,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": prompt},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user},
                    {"type": "image_url", "image_url": {"url": data_url, "detail": "high"}},
                ],
            },
        ],
    }
    payload_bytes = json.dumps(body).encode("utf-8")
    last_err: Exception | None = None
    for attempt in range(8):
        req = urllib.request.Request(
            "https://api.openai.com/v1/chat/completions",
            data=payload_bytes,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            raw = payload["choices"][0]["message"]["content"] or "{}"
            raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip())
            return json.loads(raw)
        except urllib.error.HTTPError as exc:
            body_txt = exc.read().decode("utf-8", errors="replace")
            last_err = RuntimeError(f"HTTP {exc.code}: {body_txt[:240]}")
            if exc.code in (429, 500, 502, 503, 504):
                wait = 20 * (2 ** attempt)
                if exc.code == 429:
                    wait = max(wait, 75)
                time.sleep(min(120, wait))
                continue
            raise last_err from exc
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            time.sleep(min(20, 2 * (2 ** attempt)))
    raise last_err or RuntimeError("chat_json failed")


def sheet_font(size: int) -> ImageFont.ImageFont:
    for path in ("/System/Library/Fonts/Supplemental/Arial.ttf", "/Library/Fonts/Arial.ttf"):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def build_letter_sheet(items: list[tuple[str, Image.Image]], cols: int = 6, tile: int = 140) -> Image.Image:
    font = sheet_font(18)
    gap = 28
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (tile + gap) + gap, rows * (tile + 36) + 16), (230, 230, 230))
    dr = ImageDraw.Draw(sheet)
    for n, (label, glyph) in enumerate(items):
        r, c = divmod(n, cols)
        x, y = gap + c * (tile + gap), 12 + r * (tile + 36)
        g = glyph.convert("RGB").resize((tile, tile), Image.Resampling.LANCZOS)
        sheet.paste(g, (x, y))
        dr.rectangle((x, y, x + tile, y + tile), outline=(0, 0, 0), width=2)
        dr.text((x + 4, y + tile + 6), label, fill=(0, 0, 0), font=font)
    return sheet


def build_clue_sheet(items: list[tuple[str, Image.Image]], cols: int = 2, tw: int = 240, th: int = 280) -> Image.Image:
    font = sheet_font(20)
    gap = 48
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (tw + gap) + gap, rows * (th + 40) + gap), (200, 200, 200))
    dr = ImageDraw.Draw(sheet)
    for n, (label, crop) in enumerate(items):
        r, c = divmod(n, cols)
        x, y = gap + c * (tw + gap), gap + r * (th + 40)
        g = crop.convert("RGB").resize((tw, th), Image.Resampling.LANCZOS)
        sheet.paste(g, (x, y))
        dr.rectangle((x - 3, y - 22, x + tw + 3, y + th + 3), outline=(0, 0, 0), width=3)
        dr.text((x, y - 20), label, fill=(0, 0, 0), font=font)
    return sheet


def chunked(seq, n):
    for i in range(0, len(seq), n):
        yield seq[i : i + n]


def norm_key(key: str) -> str:
    return re.sub(r"\s+", "", str(key).strip())


def one_hebrew_letter(value: str) -> str:
    letters = hebrew_only(str(value or ""))
    return letters if len(letters) == 1 else ""


def letter_view(crop: Image.Image) -> Image.Image:
    """Upper letter band of a cell — skip inset arrows that sit lower or on the right."""
    w, h = crop.size
    top = 0.50 if h > w * 1.25 else 0.72
    return crop.crop((int(w * 0.08), int(h * 0.02), int(w * 0.72), int(h * top)))


def paint_letter_grid(
    im: Image.Image, ys: list[int], xs: list[int], kinds: list[list[str]]
) -> Image.Image:
    canvas = im.crop((xs[0], ys[0], xs[-1], ys[-1])).copy()
    dr = ImageDraw.Draw(canvas)
    font = sheet_font(20)
    rows, cols = len(kinds), len(kinds[0])
    ox, oy = xs[0], ys[0]
    for i in range(rows):
        for j in range(cols):
            x0, y0 = xs[j] - ox, ys[i] - oy
            x1, y1 = xs[j + 1] - ox, ys[i + 1] - oy
            if kinds[i][j] == "C":
                dr.rectangle((x0 + 1, y0 + 1, x1 - 1, y1 - 1), fill=(110, 165, 185))
            else:
                dr.text((x0 + 6, y1 - 24), f"{i},{j}", fill=(210, 30, 30), font=font)
    return canvas


def merge_letter_maps(*maps: dict[str, str]) -> dict[str, str]:
    out: dict[str, str] = {}
    votes: dict[str, dict[str, int]] = {}
    for mp in maps:
        for k, v in mp.items():
            ch = one_hebrew_letter(v)
            if not ch:
                continue
            votes.setdefault(k, {})
            votes[k][ch] = votes[k].get(ch, 0) + 1
    for k, counts in votes.items():
        out[k] = max(counts.items(), key=lambda kv: kv[1])[0]
    return out


def extract_image_walk(
    path: Path, api_key: str, cache_dir: Path, model: str, force: bool = False
) -> list[Pair]:
    cache = cache_dir / f"{path.stem}_walk_{CACHE_VERSION}.json"
    if cache.exists() and not force:
        data = json.loads(cache.read_text(encoding="utf-8"))
        return [Pair(clue=p["clue"], answer=p["answer"], source=path.name) for p in data.get("pairs", [])]

    im = Image.open(path).convert("RGB")
    arr = np.array(im)
    ys, xs = detect_grid(arr)
    rows, cols = len(ys) - 1, len(xs) - 1
    kinds = [["?" for _ in range(cols)] for _ in range(rows)]
    letters = [["" for _ in range(cols)] for _ in range(rows)]
    crops: dict[tuple[int, int], Image.Image] = {}
    letter_labels: list[str] = []
    letter_items: list[tuple[str, Image.Image]] = []
    clue_items: list[tuple[str, Image.Image, int, int, np.ndarray]] = []

    for i in range(rows):
        for j in range(cols):
            crop = im.crop((xs[j], ys[i], xs[j + 1], ys[i + 1]))
            crops[(i, j)] = crop
            rgb = cell_mean_rgb(arr, ys[i], ys[i + 1], xs[j], xs[j + 1])
            if is_clue_cell(rgb):
                kinds[i][j] = "C"
                clue_items.append((f"{i},{j}", crop, i, j, np.array(crop)))
            else:
                kinds[i][j] = "L"
                lab = f"{i},{j}"
                letter_labels.append(lab)
                letter_items.append((lab, letter_view(crop)))

    debug_dir = cache_dir / "debug"
    debug_dir.mkdir(parents=True, exist_ok=True)
    paint_letter_grid(im, ys, xs, kinds).save(debug_dir / f"{path.stem}_painted.jpg", quality=90)

    gpt_letters: dict[str, str] = {}
    for batch_i, batch in enumerate(chunked(letter_items, 12)):
        sheet = build_letter_sheet(list(batch))
        if batch_i == 0:
            sheet.save(debug_dir / f"{path.stem}_letters0.jpg", quality=92)
        labels = [lab for lab, _ in batch]
        result = chat_json(
            api_key,
            CELL_PROMPT,
            "Each tile is independent. Transcribe every labeled tile. Labels: " + " ".join(labels),
            jpeg_data_url(sheet, max_side=1800),
            model,
            max_tokens=1200,
        )
        gpt_letters = merge_letter_maps(
            gpt_letters, {norm_key(k): str(v) for k, v in (result.get("letters") or {}).items()}
        )

    filled = 0
    for lab in letter_labels:
        i, j = (int(x) for x in lab.split(","))
        ch = one_hebrew_letter(gpt_letters.get(lab, ""))
        letters[i][j] = ch
        if ch:
            filled += 1

    clue_crops: list[tuple[str, Image.Image]] = []
    clue_slots: list[tuple[int, int, str, str, Image.Image]] = []  # r,c,kind,label,crop

    for lab, crop, i, j, cell_arr in clue_items:
        full_arrows = arrows_in_region(cell_arr)
        dash = find_dash_y(cell_arr)
        h = cell_arr.shape[0]
        if dash is not None and len(full_arrows) >= 2:
            top_arrows = [a for a in full_arrows if a.cy < dash / h]
            bot_arrows = [a for a in full_arrows if a.cy >= dash / h]
            gap = 6
            top = crop.crop((4, 4, crop.size[0] - 4, max(8, dash - gap)))
            bot = crop.crop((4, min(crop.size[1] - 8, dash + gap), crop.size[0] - 4, crop.size[1] - 4))
            clue_crops.append((f"{lab}_top", top))
            clue_crops.append((f"{lab}_bot", bot))
            if top_arrows:
                clue_slots.append((i, j, top_arrows[0].kind, f"{lab}_top", top))
            if bot_arrows:
                clue_slots.append((i, j, bot_arrows[0].kind, f"{lab}_bot", bot))
        elif full_arrows:
            clue_crops.append((lab, crop))
            clue_slots.append((i, j, full_arrows[0].kind, lab, crop))

    gpt_clues: dict[str, str] = {}
    for batch in chunked(clue_crops, 4):
        sheet = build_clue_sheet(list(batch))
        labels = [lab for lab, _ in batch]
        result = chat_json(
            api_key,
            CLUE_PROMPT,
            "Read every labeled clue crop. Copy every printed word. Labels: " + " ".join(labels),
            jpeg_data_url(sheet, max_side=1800),
            model,
            max_tokens=2200,
        )
        raw = result.get("clues") or {}
        for k, v in raw.items():
            if isinstance(v, list):
                gpt_clues[norm_key(k)] = clean_clue(" ".join(str(x) for x in v))
            else:
                gpt_clues[norm_key(k)] = clean_clue(str(v))

    pairs: list[Pair] = []
    seen: set[tuple[str, str]] = set()

    def add(clue: str, kind: str, r: int, c: int) -> None:
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
        key = (clue, answer)
        if key in seen:
            return
        seen.add(key)
        pairs.append(Pair(clue, answer, path.name))

    for r, c, kind, lab, _crop in clue_slots:
        text = gpt_clues.get(lab, "")
        if text:
            add(text, kind, r, c)

    cache.write_text(
        json.dumps(
            {
                "grid": f"{rows}x{cols}",
                "letters_filled": filled,
                "letters_total": len(letter_labels),
                "letters": letters,
                "pairs": [{"clue": p.clue, "answer": p.answer} for p in pairs],
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return pairs


def merge_walked(pairs: list[Pair]) -> list[dict]:
    clue_freq: dict[str, dict[str, int]] = {}
    by: dict[str, dict] = {}
    for p in pairs:
        a = apply_final_forms(p.answer)
        c = clean_clue(p.clue)
        if len(hebrew_only(c)) < 3:
            continue
        clue_freq.setdefault(a, {})
        clue_freq[a][c] = clue_freq[a].get(c, 0) + 1
        if a not in by:
            by[a] = {"a": a, "c": [], "prefer": True}
        if c not in by[a]["c"]:
            by[a]["c"].append(c)

    for a, entry in by.items():
        freq = clue_freq[a]
        if max(freq.values()) >= 2:
            entry["c"] = [c for c in entry["c"] if freq[c] >= 2]

    entries = list(by.values())
    entries.sort(key=lambda e: e["a"])
    return entries


KNOWN_CHECK = [
    ("מביא לעולם", "יולד"),
    ("סדר המאורעות", "כרוניקה"),
    ("מספרי התנ", "דברים"),
    ("הזיז מצד לצד", "נדנד"),
    ("מחבת עמוקה", "ווק"),
    ("מכמורת", "רשת"),
    ("אריגים", "בדים"),
    ("נרקב", "נמק"),
]


def print_validation(pairs: list[Pair], source_name: str) -> None:
    if "6a0ac0dbedd7d" not in source_name:
        return
    print("  known-pair check:", flush=True)
    for clue_sub, answer in KNOWN_CHECK:
        hits = [p for p in pairs if clue_sub in p.clue]
        if not hits:
            print(f"    MISS clue ~{clue_sub} (expected {answer})", flush=True)
            continue
        got = ", ".join(f"{p.clue}->{p.answer}" for p in hits)
        ok = any(p.answer == answer for p in hits)
        print(f"    {'OK  ' if ok else 'BAD '} {got}  (want {answer})", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--json")
    parser.add_argument("--only")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--model", default="gpt-4o")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    repo = Path(__file__).resolve().parents[2]
    load_dotenv(repo)
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        raise SystemExit("OPENAI_API_KEY missing")

    folder = Path(args.input)
    images = sorted(
        p for p in folder.iterdir()
        if p.suffix.lower() in {".jpg", ".jpeg", ".png"} and " (1)" not in p.name
    )
    if args.only:
        images = [p for p in images if p.name == args.only]
    if args.limit:
        images = images[: args.limit]
    cache_dir = repo / ".clue-import" / "walk"
    cache_dir.mkdir(parents=True, exist_ok=True)

    all_pairs: list[Pair] = []
    for i, img in enumerate(images, 1):
        try:
            pairs = extract_image_walk(img, api_key, cache_dir, args.model, force=args.force)
            all_pairs.extend(pairs)
            print(f"[{i}/{len(images)}] {img.name}: {len(pairs)} walked pairs  (total {len(all_pairs)})", flush=True)
            print_validation(pairs, img.name)
        except Exception as exc:  # noqa: BLE001
            print(f"[{i}/{len(images)}] {img.name}: FAILED {exc}", flush=True)
            if "429" in str(exc):
                print("  rate-limited — waiting 90s", flush=True)
                time.sleep(90)

    entries = merge_walked(all_pairs)
    Path(args.out).write_text(ts_literal(entries), encoding="utf-8")
    print(f"Wrote {len(entries)} answers / {len(all_pairs)} walked pairs -> {args.out}", flush=True)
    if args.json:
        Path(args.json).write_text(
            json.dumps(
                [{"clue": p.clue, "answer": p.answer, "source": p.source} for p in all_pairs],
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )


if __name__ == "__main__":
    main()
