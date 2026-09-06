import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { MongoClient } from "mongodb";
import sharp from "sharp";
import { config, pipelineRoot } from "./config.js";
import { ApprovalRecord, CommonsCandidate, ImageClueSeed } from "./types.js";
import { readJson, safeSlug, writeJson } from "./utils.js";

type CandidateGroup = {
  clue: ImageClueSeed;
  candidates: CommonsCandidate[];
  error?: string | null;
};

type CatalogEntry = {
  id: string;
  answer: string;
  imageUrl: string;
  type: string;
  subject: string;
  letterLength: number;
};

function letterLength(answer: string): number {
  return Array.from(answer.replace(/\s+/g, "")).length;
}

function parseArgs(argv: string[]) {
  const limitArg = argv.find((a) => a.startsWith("--limit="));
  return {
    limit: limitArg ? Number(limitArg.slice("--limit=".length)) : 0,
    force: argv.includes("--force"),
  };
}

async function fetchOriginal(url: string, userAgent: string): Promise<Buffer> {
  const delaysMs = [0, 4000, 10000, 20000];
  let lastError = "";
  for (const delay of delaysMs) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    const response = await fetch(url, { headers: { "User-Agent": userAgent } });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    lastError = `Download failed ${response.status} ${url}`;
    if (response.status !== 429 && response.status !== 503) break;
    console.warn(`  retry after ${response.status}`);
  }
  throw new Error(lastError);
}

if (!config.s3Bucket) throw new Error("S3_BUCKET is required");
if (!config.mongoUri) throw new Error("MONGODB_URI is required");

const { limit, force } = parseArgs(process.argv.slice(2));
const groups = await readJson<CandidateGroup[]>(
  path.join(pipelineRoot, "data/candidates.json")
);
const approvals = await readJson<ApprovalRecord[]>(
  path.join(pipelineRoot, "data/approvals.json")
);

const byClue = new Map(groups.map((g) => [g.clue.id, g]));
const s3 = new S3Client({ region: config.awsRegion });
const mongo = new MongoClient(config.mongoUri);
await mongo.connect();
const collection = mongo.db(config.mongoDb).collection(config.mongoCollection);
await collection.createIndex({ id: 1 }, { unique: true });

const queued = limit > 0 ? approvals.slice(0, limit) : approvals;
let uploaded = 0;
let skipped = 0;
let failed = 0;

for (const approval of queued) {
  const group = byClue.get(approval.clueId);
  if (!group) {
    console.warn(`Missing candidate group: ${approval.clueId}`);
    failed += 1;
    continue;
  }

  const candidate = group.candidates.find((x) => x.id === approval.candidateId);
  if (!candidate) {
    console.warn(`Missing candidate: ${approval.candidateId}`);
    failed += 1;
    continue;
  }

  if (!candidate.allowed) {
    console.warn(`Skipping non-allowed candidate: ${approval.candidateId}`);
    failed += 1;
    continue;
  }

  const existing = await collection.findOne({ id: group.clue.id });
  if (!force && existing?.s3_key && existing?.image_url) {
    console.log(`↷ ${group.clue.answer_hebrew} already in Mongo (${existing.s3_key})`);
    skipped += 1;
    continue;
  }

  try {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const input = await fetchOriginal(candidate.originalUrl, config.userAgent);

    // Uniform 800×800 clue asset; contain-fit padding keeps faces/landmarks.
    const output = await sharp(input, { limitInputPixels: false })
      .rotate()
      .resize(800, 800, {
        fit: "contain",
        background: { r: 18, g: 18, b: 18, alpha: 1 },
      })
      .jpeg({ quality: 86, mozjpeg: true })
      .toBuffer();

    const key = `image-clues/${group.clue.type}/${group.clue.id}-${safeSlug(group.clue.subject)}.jpg`;

    await s3.send(new PutObjectCommand({
      Bucket: config.s3Bucket,
      Key: key,
      Body: output,
      ContentType: "image/jpeg",
      CacheControl: "public,max-age=31536000,immutable",
    }));

    const imageUrl = config.s3PublicBaseUrl
      ? `${config.s3PublicBaseUrl.replace(/\/$/, "")}/${key}`
      : `s3://${config.s3Bucket}/${key}`;

    await collection.updateOne(
      { id: group.clue.id },
      {
        $set: {
          ...group.clue,
          image_source: "wikimedia_commons",
          source_url: candidate.descriptionUrl,
          author: candidate.author ?? "",
          license: candidate.license ?? "",
          license_url: candidate.licenseUrl ?? "",
          s3_key: key,
          image_url: imageUrl,
          image_original_url: candidate.originalUrl,
          image_commons_title: candidate.title,
          image_approved_at: approval.approvedAt,
          letter_length: letterLength(group.clue.answer_hebrew),
          updated_at: new Date(),
        },
        $setOnInsert: { created_at: new Date() },
      },
      { upsert: true }
    );

    uploaded += 1;
    console.log(`✓ ${group.clue.answer_hebrew} -> ${imageUrl}`);
  } catch (error) {
    failed += 1;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`✗ ${group.clue.id} ${group.clue.answer_hebrew}: ${message}`);
  }
}

const ready = await collection
  .find({ image_url: { $exists: true, $nin: [null, ""] } })
  .toArray();

const catalog: CatalogEntry[] = ready.map((doc) => ({
  id: String(doc.id ?? ""),
  answer: String(doc.answer_hebrew ?? ""),
  imageUrl: String(doc.image_url ?? ""),
  type: String(doc.type ?? ""),
  subject: String(doc.subject ?? ""),
  letterLength: Number(doc.letter_length ?? letterLength(String(doc.answer_hebrew ?? ""))),
}));

await writeJson(path.join(pipelineRoot, "data/processed-catalog.json"), catalog);
await writeJson(
  path.resolve(pipelineRoot, "../../src/scripts/generators/imageClues.generated.json"),
  catalog
);

await mongo.close();
console.log(
  `Finished. uploaded=${uploaded} skipped=${skipped} failed=${failed} catalog=${catalog.length}`
);
