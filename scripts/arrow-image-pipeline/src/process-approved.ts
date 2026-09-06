import { readFile } from "node:fs/promises";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { MongoClient } from "mongodb";
import sharp from "sharp";
import { config } from "./config.js";
import { ApprovalRecord, CommonsCandidate, ImageClueSeed } from "./types.js";
import { readJson, safeSlug } from "./utils.js";

type CandidateGroup = {
  clue: ImageClueSeed;
  candidates: CommonsCandidate[];
  error?: string | null;
};

if (!config.s3Bucket) throw new Error("S3_BUCKET is required");
if (!config.mongoUri) throw new Error("MONGODB_URI is required");

const groups = await readJson<CandidateGroup[]>("data/candidates.json");
const approvals = await readJson<ApprovalRecord[]>("data/approvals.json");

const byClue = new Map(groups.map((g) => [g.clue.id, g]));
const s3 = new S3Client({ region: config.awsRegion });
const mongo = new MongoClient(config.mongoUri);
await mongo.connect();
const collection = mongo.db(config.mongoDb).collection(config.mongoCollection);

for (const approval of approvals) {
  const group = byClue.get(approval.clueId);
  if (!group) {
    console.warn(`Missing candidate group: ${approval.clueId}`);
    continue;
  }

  const candidate = group.candidates.find((x) => x.id === approval.candidateId);
  if (!candidate) {
    console.warn(`Missing candidate: ${approval.candidateId}`);
    continue;
  }

  if (!candidate.allowed) {
    console.warn(`Skipping non-allowed candidate: ${approval.candidateId}`);
    continue;
  }

  const response = await fetch(candidate.originalUrl, {
    headers: { "User-Agent": config.userAgent },
  });
  if (!response.ok) throw new Error(`Download failed ${response.status}`);

  const input = Buffer.from(await response.arrayBuffer());

  // Produces a uniform clue asset while preserving the full image visually
  // with contain-fit padding rather than cropping off faces/landmarks.
  const output = await sharp(input)
    .rotate()
    .resize(800, 800, {
      fit: "contain",
      background: { r: 18, g: 18, b: 18, alpha: 1 },
      withoutEnlargement: true,
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
        updated_at: new Date(),
      },
      $setOnInsert: { created_at: new Date() },
    },
    { upsert: true }
  );

  console.log(`✓ ${group.clue.answer_hebrew} -> ${key}`);
}

await mongo.close();
console.log("Finished processing approved images.");
