# Arrow Image Clue Pipeline

A human-in-the-loop image ingestion pipeline for the Arrow Hebrew crossword app.

## What it does

1. Reads the 500-clue seed JSON.
2. Searches Wikimedia Commons for image candidates.
3. Retrieves image URLs and extended metadata including author/license.
4. Applies a conservative license filter.
5. Generates a local visual approval UI.
6. Downloads only the candidates you approve.
7. Crops approved images to a square 800×800 JPEG without stretching them. People photos keep the whole face inside the square.
8. Uploads the result to S3.
9. Upserts the clue + provenance/license metadata into MongoDB.

Discovery itself does **not** upload to S3 or write to Mongo.

## Setup

Requires Node.js 20+.

```bash
npm install
cp .env.example .env
```

Edit `.env`. At minimum, put a real contact string in `USER_AGENT`.

Run every command below from `scripts/arrow-image-pipeline`.

## 1. Validate the seed

```bash
npm run validate
```

## 2. Discover candidates

```bash
npm run discover
```

This writes:

```text
data/candidates.json
```

For 500 clues and 6 candidates each, expect the output to contain up to ~3,000 candidate images.

You can test on a smaller dataset by making a temporary JSON containing only a few seed records.

## 3. Approve visually

The review screen reads the v2 candidate file:

```bash
npm run serve
```

Open:

```text
http://localhost:4177
```

Each card is the square crop that will be uploaded, not the raw Commons thumbnail. An orange badge means no face was found. The first time you open the page, the YuNet face model downloads into `models/` if it is not already there.

Click a green/reusable candidate to approve it. Approvals are stored in:

```text
data/approvals_v2.json
```

Only one candidate per clue is stored. The older batch remains in `data/approvals.json`.

## 4. Upload approved assets + write Mongo

Set the AWS and Mongo fields in `.env`, then:

```bash
npm run process
```

`npm run process` reads both `data/approvals.json` and `data/approvals_v2.json`. Clues that already have an S3 image are skipped. Do not pass `--force` for this batch; that flag replaces images already in Mongo.

The processor:
- downloads the original file,
- auto-rotates it,
- cuts a square that keeps the largest face fully inside, with hair and chin padding when the photo has room,
- scales that square uniformly to 800×800 JPEG (quality 86),
- if no face is found, uses a top-weighted square cover crop,
- if the face is larger than the short side of the photo, letterboxes the whole photo on a flat background,
- uploads it under `image-clues/<type>/...`,
- writes the final S3 key and attribution/license metadata into Mongo.

## Mongo document shape

The imported document keeps the original seed fields and adds fields similar to:

```json
{
  "image_source": "wikimedia_commons",
  "source_url": "https://commons.wikimedia.org/...",
  "author": "...",
  "license": "CC BY-SA 4.0",
  "license_url": "...",
  "s3_key": "image-clues/person/img_0101-lionel-messi.jpg",
  "image_url": "https://cdn.example.com/...",
  "image_original_url": "https://upload.wikimedia.org/...",
  "image_commons_title": "File:...",
  "image_approved_at": "..."
}
```

## Licensing / rights note

The code intentionally stores provenance and license metadata instead of treating
a downloaded image as an untracked asset.

The filter is conservative, but it is **not legal advice and not a complete rights
clearance system**. In particular:

- brand/logo rights may involve trademark rules in addition to copyright;
- photographs of recognizable people can involve personality/publicity/privacy
  considerations depending on jurisdiction and context;
- Commons metadata can be incomplete or imperfect;
- preserve attribution where the license requires it.

For that reason, brand candidates are deliberately marked for manual review rather
than auto-approved by the code.

## Recommended production improvement

Once V1 works, add a `rights_status` field:

```text
pending -> approved -> rejected
```

and keep `license_snapshot` / `attribution_text` so you can reproduce exactly what
rights information you relied on when an image was ingested.
