import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 4177),
  candidatesPerClue: Number(process.env.CANDIDATES_PER_CLUE ?? 6),
  discoveryConcurrency: Number(process.env.DISCOVERY_CONCURRENCY ?? 3),
  userAgent:
    process.env.USER_AGENT ??
    "ArrowCrosswordImagePipeline/1.0 (please configure USER_AGENT)",
  awsRegion: process.env.AWS_REGION ?? "eu-central-1",
  s3Bucket: process.env.S3_BUCKET ?? "",
  s3PublicBaseUrl: process.env.S3_PUBLIC_BASE_URL ?? "",
  mongoUri: process.env.MONGODB_URI ?? "",
  mongoDb: process.env.MONGODB_DB ?? "arrow",
  mongoCollection: process.env.MONGODB_COLLECTION ?? "image_clues",
};
