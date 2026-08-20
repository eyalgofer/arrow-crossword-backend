#!/usr/bin/env python3
"""
Extract {clue, answer} pairs from solved Hebrew תשחץ images via OpenAI vision.

Reads OPENAI_API_KEY from the repo .env (gitignored). Never stores grid layouts.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO
from pathlib import Path

from PIL import Image
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from extract import (  # noqa: E402
    MAX_ANSWER_LEN,
    MAX_CLUE_LEN,
    MIN_ANSWER_LEN,
    Pair,
    apply_final_forms,
    clean_clue,
    detect_grid,
    hebrew_only,
    is_usable_clue,
    load_known_answers,
    ts_literal,
)

PROMPT = """You extract clue-answer pairs from a CROP of a fully solved Hebrew תשחץ (arroword).

The grid is already filled. You MUST read the printed letters. Do not guess an answer from the clue meaning (do not replace the written letters with a city/word you know).

How to read:
- Blue cells = clues. A cell may have two clues split by a dashed line. Each has its own arrow.
- White cells = one Hebrew letter each. An inset clue in a white cell uses that cell's letter as letter 1.
- Follow the arrow through consecutive white letters until a clue cell, block, or edge.
- Horizontal answers follow the arrow (often left). Vertical answers go down. L-arrows turn after the first letter.

Output:
- clue: Hebrew clue only, no [5,3]
- letters: the individual Hebrew letters you actually see, in order
- answer: those letters joined, with a final form (ך ם ן ף ץ) on the last letter if needed

Omit a pair if you cannot see the letters. Unique pairs only. Never repeat. About 8–30 pairs per crop.

JSON: {"pairs":[{"clue":"...","letters":["א","ב"],"answer":"..."}]}
"""


def load_dotenv(repo: Path) -> None:
    env_path = repo / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


def jpeg_data_url(im: Image.Image, max_side: int = 1400, quality: int = 88) -> str:
    w, h = im.size
    scale = min(1.0, max_side / max(w, h))
    if scale < 1:
        im = im.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
    buf = BytesIO()
    im.save(buf, format="JPEG", quality=quality, optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"


def grid_tiles(path: Path) -> list[tuple[str, Image.Image]]:
    im = Image.open(path).convert("RGB")
    arr = np.array(im)
    ys, xs = detect_grid(arr)
    grid = im.crop((xs[0], ys[0], xs[-1], ys[-1]))
    gw, gh = grid.size
    ox, oy = int(gw * 0.14), int(gh * 0.14)
    tw, th = gw // 2 + ox, gh // 2 + oy
    positions = [
        ("tl", 0, 0),
        ("tr", max(0, gw - tw), 0),
        ("bl", 0, max(0, gh - th)),
        ("br", max(0, gw - tw), max(0, gh - th)),
    ]
    tiles: list[tuple[str, Image.Image]] = []
    for name, x, y in positions:
        tiles.append((name, grid.crop((x, y, min(gw, x + tw), min(gh, y + th)))))
    return tiles


def chat_vision(api_key: str, data_url: str, model: str) -> dict:
    body = {
        "model": model,
        "temperature": 0,
        "max_tokens": 2200,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": PROMPT},
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "This is a crop of part of a solved תשחץ. Extract every unique clue-answer pair visible here. JSON only.",
                    },
                    {"type": "image_url", "image_url": {"url": data_url, "detail": "high"}},
                ],
            },
        ],
    }
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        return json.loads(resp.read().decode("utf-8"))


def parse_pairs(payload: dict, source: str) -> list[Pair]:
    content = payload["choices"][0]["message"]["content"] or ""
    content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip())
    raw: list = []
    try:
        data = json.loads(content)
        raw = data.get("pairs") or data.get("items") or data
        if isinstance(raw, dict):
            raw = raw.get("pairs") or []
    except json.JSONDecodeError:
        raw = []
        for m in re.finditer(
            r'\{\s*"clue"\s*:\s*"(.*?)"\s*,\s*"answer"\s*:\s*"(.*?)"\s*\}',
            content,
            flags=re.DOTALL,
        ):
            raw.append({"clue": json.loads(f'"{m.group(1)}"'), "answer": json.loads(f'"{m.group(2)}"')})

    pairs: list[Pair] = []
    seen: set[tuple[str, str]] = set()
    for item in raw:
        if not isinstance(item, dict):
            continue
        clue = clean_clue(str(item.get("clue") or ""))
        letter_list = item.get("letters")
        if isinstance(letter_list, list) and letter_list:
            from_letters = apply_final_forms(hebrew_only("".join(str(ch) for ch in letter_list)))
            answer = from_letters
        else:
            answer = apply_final_forms(hebrew_only(str(item.get("answer") or "")))
            from_letters = answer
        stated = apply_final_forms(hebrew_only(str(item.get("answer") or "")))
        if stated and from_letters and stated != from_letters:
            # model guessed a word that doesn't match the letters it claimed to read
            continue
        if len(hebrew_only(clue)) < 3 or len(clue) > MAX_CLUE_LEN:
            continue
        if not (MIN_ANSWER_LEN <= len(answer) <= MAX_ANSWER_LEN):
            continue
        if not re.fullmatch(r"[\u05D0-\u05EA]+", answer):
            continue
        if not is_usable_clue(clue, answer):
            continue
        key = (clue, answer)
        if key in seen:
            continue
        seen.add(key)
        pairs.append(Pair(clue=clue, answer=answer, source=source))
        if len(pairs) >= 90:
            break
    return pairs


def extract_tile(
    api_key: str, tile: Image.Image, cache: Path, model: str, source: str, label: str
) -> list[Pair]:
    if cache.exists():
        try:
            payload = json.loads(cache.read_text(encoding="utf-8"))
            return parse_pairs(payload, source)
        except Exception:
            cache.unlink(missing_ok=True)

    last_err: Exception | None = None
    for attempt in range(4):
        try:
            payload = chat_vision(api_key, jpeg_data_url(tile), model)
            cache.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
            return parse_pairs(payload, source)
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            last_err = RuntimeError(f"HTTP {exc.code}: {body[:300]}")
            if exc.code in (429, 500, 502, 503, 504):
                time.sleep(min(60, 4 * (2 ** attempt)))
                continue
            raise last_err from exc
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            time.sleep(min(20, 2 * (2 ** attempt)))
    raise last_err or RuntimeError(f"extract failed {label}")


def extract_one(api_key: str, image: Path, cache_dir: Path, model: str) -> list[Pair]:
    merged: list[Pair] = []
    seen: set[tuple[str, str]] = set()
    tiles = grid_tiles(image)
    for label, tile in tiles:
        cache = cache_dir / f"{image.stem}_{label}.json"
        print(f"  {image.name} tile {label}", flush=True)
        for p in extract_tile(api_key, tile, cache, model, image.name, label):
            key = (p.clue, p.answer)
            if key in seen:
                continue
            seen.add(key)
            merged.append(p)
    return merged


def merge_pairs(pairs: list[Pair], known: set[str]) -> list[dict]:
    gk = re.compile(r"עיר|בירת|מדינה|נהר|הר |קיבוץ|נמל|גבינה|מזלות|תבלין|תכשיט|מקרא|תנ\"ך")
    by_answer: dict[str, dict] = {}
    sources: dict[str, set[str]] = {}
    for p in pairs:
        answer = apply_final_forms(p.answer)
        clue = clean_clue(p.clue)
        if len(hebrew_only(clue)) < 3:
            continue
        sources.setdefault(answer, set()).add(p.source)
        if answer not in by_answer:
            by_answer[answer] = {"a": answer, "c": [], "t": 1, "prefer": True}
        if clue not in by_answer[answer]["c"]:
            by_answer[answer]["c"].append(clue)

    kept: list[dict] = []
    for answer, entry in by_answer.items():
        clues = entry["c"]
        nsrc = len(sources.get(answer, ()))
        if answer in known or nsrc >= 2 or any(gk.search(c) for c in clues):
            if answer not in known and len(answer) >= 8:
                entry["t"] = 2
            kept.append(entry)
    kept.sort(key=lambda e: e["a"])
    return kept


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--json")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--workers", type=int, default=3)
    parser.add_argument("--model", default="gpt-4o")
    parser.add_argument("--only", help="Process a single filename")
    args = parser.parse_args()

    repo = Path(__file__).resolve().parents[2]
    load_dotenv(repo)
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        raise SystemExit("OPENAI_API_KEY missing from environment / .env")

    folder = Path(args.input)
    images = sorted(p for p in folder.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png"})
    if args.only:
        images = [p for p in images if p.name == args.only]
    if args.limit:
        images = images[: args.limit]
    if not images:
        raise SystemExit(f"No images in {folder}")

    cache_dir = repo / ".clue-import" / "openai"
    cache_dir.mkdir(parents=True, exist_ok=True)

    all_pairs: list[Pair] = []
    done = 0
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        futs = {pool.submit(extract_one, api_key, img, cache_dir, args.model): img for img in images}
        for fut in as_completed(futs):
            img = futs[fut]
            done += 1
            try:
                pairs = fut.result()
                all_pairs.extend(pairs)
                print(f"[{done}/{len(images)}] {img.name}: {len(pairs)} pairs  (total {len(all_pairs)})", flush=True)
            except Exception as exc:  # noqa: BLE001
                print(f"[{done}/{len(images)}] {img.name}: FAILED {exc}", flush=True)

    known = load_known_answers(repo)
    entries = merge_pairs(all_pairs, known)
    out = Path(args.out)
    out.write_text(ts_literal(entries), encoding="utf-8")
    print(f"Wrote {len(entries)} answers / {len(all_pairs)} raw pairs -> {out}", flush=True)

    if args.json:
        payload = [{"clue": p.clue, "answer": p.answer, "source": p.source} for p in all_pairs]
        Path(args.json).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
