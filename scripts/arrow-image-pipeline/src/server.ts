import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { readJson, writeJson } from "./utils.js";
import { ApprovalRecord } from "./types.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../public");
const candidatesPath = path.resolve("data/candidates.json");
const approvalsPath = path.resolve("data/approvals.json");

app.use(express.static(publicDir));

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

app.post("/api/approve", async (req, res) => {
  const { clueId, candidateId } = req.body ?? {};
  if (!clueId || !candidateId) {
    return res.status(400).json({ error: "clueId and candidateId required" });
  }

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
});

app.delete("/api/approve/:clueId", async (req, res) => {
  let approvals: ApprovalRecord[] = [];
  try {
    approvals = await readJson<ApprovalRecord[]>(approvalsPath);
  } catch {}

  approvals = approvals.filter((x) => x.clueId !== req.params.clueId);
  await writeJson(approvalsPath, approvals);
  res.json({ ok: true });
});

app.listen(config.port, () => {
  console.log(`Approval UI: http://localhost:${config.port}`);
});
