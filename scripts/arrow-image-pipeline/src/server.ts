import express from "express";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config, pipelineRoot } from "./config.js";
import { CroppedImage, renderSquareJpeg } from "./crop.js";
import { fetchOriginal } from "./fetch-image.js";
import { ApprovalRecord, CommonsCandidate, ImageClueSeed } from "./types.js";
import { readJson, writeJson } from "./utils.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../public");
const candidatesPath = path.join(pipelineRoot, "data/candidates_v2.json");
const approvalsPath = path.join(pipelineRoot, "data/approvals_v2.json");
const previewDir = path.join(pipelineRoot, "data/previews");

app.use(express.static(publicDir));

type CandidateGroup = {
  clue: ImageClueSeed;
  candidates: CommonsCandidate[];
  error?: string | null;
};

let groupsPromise: Promise<CandidateGroup[]> | null = null;

function loadGroups(): Promise<CandidateGroup[]> {
  if (!groupsPromise) {
    groupsPromise = readJson<CandidateGroup[]>(candidatesPath).catch(() => []);
  }
  return groupsPromise;
}

async function findCandidate(candidateId: string): Promise<CommonsCandidate | null> {
  const groups = await loadGroups();
  for (const group of groups) {
    const candidate = group.candidates?.find((item) => item.id === candidateId);
    if (candidate) return candidate;
  }
  return null;
}

function previewPaths(candidateId: string) {
  const slug = `crop-v1-${candidateId.replace(/[^a-zA-Z0-9._-]+/g, "_")}`;
  return {
    jpeg: path.join(previewDir, `${slug}.jpg`),
    meta: path.join(previewDir, `${slug}.json`),
  };
}

async function readPreview(candidateId: string): Promise<CroppedImage | null> {
  const paths = previewPaths(candidateId);
  try {
    const [jpeg, metaRaw] = await Promise.all([
      readFile(paths.jpeg),
      readFile(paths.meta, "utf8"),
    ]);
    const meta = JSON.parse(metaRaw) as Pick<CroppedImage, "faceFound" | "mode" | "plan">;
    return { jpeg, faceFound: meta.faceFound, mode: meta.mode, plan: meta.plan };
  } catch {
    return null;
  }
}

async function writePreview(candidateId: string, cropped: CroppedImage) {
  const paths = previewPaths(candidateId);
  await mkdir(previewDir, { recursive: true });
  await Promise.all([
    writeFile(paths.jpeg, cropped.jpeg),
    writeFile(paths.meta, JSON.stringify({
      faceFound: cropped.faceFound,
      mode: cropped.mode,
      plan: cropped.plan,
    })),
  ]);
}

const inflight = new Map<string, Promise<CroppedImage>>();
let activeDownloads = 0;
const downloadWaiters: Array<() => void> = [];
const PREVIEW_CONCURRENCY = 3;

async function withDownloadSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (activeDownloads >= PREVIEW_CONCURRENCY) {
    await new Promise<void>((resolve) => downloadWaiters.push(resolve));
  }
  activeDownloads += 1;
  try {
    return await fn();
  } finally {
    activeDownloads -= 1;
    downloadWaiters.shift()?.();
  }
}

async function ensurePreview(candidateId: string): Promise<CroppedImage> {
  const cached = await readPreview(candidateId);
  if (cached) return cached;

  const pending = inflight.get(candidateId);
  if (pending) return pending;

  const job = withDownloadSlot(async () => {
    const again = await readPreview(candidateId);
    if (again) return again;
    const candidate = await findCandidate(candidateId);
    if (!candidate) {
      const error = new Error(`Unknown candidate ${candidateId}`);
      (error as Error & { status?: number }).status = 404;
      throw error;
    }
    const input = await fetchOriginal(candidate.originalUrl, config.userAgent);
    const cropped = await renderSquareJpeg(input);
    await writePreview(candidateId, cropped);
    return cropped;
  });

  inflight.set(candidateId, job);
  try {
    return await job;
  } finally {
    inflight.delete(candidateId);
  }
}

function candidateParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw ?? "";
}

app.get("/api/candidates", async (_req, res) => {
  try {
    res.json(await readJson(candidatesPath));
  } catch {
    res.json([]);
  }
});

app.get("/api/approvals", async (_req, res) => {
  try {
    res.json(await readJson(approvalsPath));
  } catch {
    res.json([]);
  }
});

app.get("/api/preview/:candidateId", async (req, res) => {
  try {
    const cropped = await ensurePreview(candidateParam(req.params.candidateId));
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(cropped.jpeg);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 502;
    const message = error instanceof Error ? error.message : String(error);
    res.status(status).json({ error: message });
  }
});

app.get("/api/preview-meta/:candidateId", async (req, res) => {
  try {
    const cropped = await ensurePreview(candidateParam(req.params.candidateId));
    res.json({ faceFound: cropped.faceFound, mode: cropped.mode });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 502;
    const message = error instanceof Error ? error.message : String(error);
    res.status(status).json({ error: message });
  }
});

let approvalWrite: Promise<unknown> = Promise.resolve();

function withApprovalLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = approvalWrite.then(fn, fn);
  approvalWrite = run.then(() => undefined, () => undefined);
  return run;
}

app.post("/api/approve", (req, res) => {
  const { clueId, candidateId } = req.body ?? {};
  if (!clueId || !candidateId) {
    return res.status(400).json({ error: "clueId and candidateId required" });
  }

  withApprovalLock(async () => {
    let approvals: ApprovalRecord[] = [];
    try {
      approvals = await readJson<ApprovalRecord[]>(approvalsPath);
    } catch {}

    approvals = approvals.filter((x) => x.clueId !== clueId);
    approvals.push({
      clueId,
      candidateId,
      approvedAt: new Date().toISOString(),
    });

    await writeJson(approvalsPath, approvals);
    res.json({ ok: true });
  }).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    if (!res.headersSent) res.status(500).json({ error: message });
  });
});

app.delete("/api/approve/:clueId", (req, res) => {
  withApprovalLock(async () => {
    let approvals: ApprovalRecord[] = [];
    try {
      approvals = await readJson<ApprovalRecord[]>(approvalsPath);
    } catch {}

    approvals = approvals.filter((x) => x.clueId !== req.params.clueId);
    await writeJson(approvalsPath, approvals);
    res.json({ ok: true });
  }).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    if (!res.headersSent) res.status(500).json({ error: message });
  });
});

app.listen(config.port, () => {
  console.log(`Approval UI: http://localhost:${config.port}`);
});
