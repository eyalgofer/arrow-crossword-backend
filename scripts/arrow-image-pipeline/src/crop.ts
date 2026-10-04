import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import * as ort from "onnxruntime-node";
import sharp from "sharp";
import { pipelineRoot } from "./config.js";

/** Square clue asset. Both axes are scaled by the same amount. */
export const OUTPUT_SIZE = 800;

const DETECT_SIZE = 640;
const SCORE_THRESHOLD = 0.6;
const NMS_THRESHOLD = 0.3;
const STRIDES = [8, 16, 32] as const;
const PAD_X = 0.35;
const PAD_TOP = 0.55;
const PAD_BOTTOM = 0.35;
/** Face height should be about half the square when the photo has room. */
const FACE_HEIGHT_FRACTION = 0.5;
/** Place the face center slightly above the middle of the square. */
const FACE_ANCHOR_Y = 0.42;

const MODEL_URL =
  "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx";
const MODEL_PATH = path.join(pipelineRoot, "models/face_detection_yunet_2023mar.onnx");

export type FaceBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
};

export type CropMode = "face" | "cover" | "letterbox";

export type CropPlan =
  | { mode: "face" | "cover"; left: number; top: number; side: number }
  | { mode: "letterbox" };

type Box = { x: number; y: number; w: number; h: number };

export type CroppedImage = {
  jpeg: Buffer;
  faceFound: boolean;
  mode: CropMode;
  plan: CropPlan;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampInt(value: number, min: number, max: number): number {
  const rounded = Math.round(value);
  if (max < min) return Math.round(min);
  return Math.min(max, Math.max(min, rounded));
}

function clampFace(face: FaceBox, width: number, height: number): FaceBox | null {
  const x1 = clamp(face.x, 0, width);
  const y1 = clamp(face.y, 0, height);
  const x2 = clamp(face.x + face.w, 0, width);
  const y2 = clamp(face.y + face.h, 0, height);
  const w = x2 - x1;
  const h = y2 - y1;
  if (w < 1 || h < 1) return null;
  return { x: x1, y: y1, w, h, score: face.score };
}

function expandFace(face: FaceBox, scale: number): Box {
  const padX = face.w * PAD_X * scale;
  const padTop = face.h * PAD_TOP * scale;
  const padBottom = face.h * PAD_BOTTOM * scale;
  return {
    x: face.x - padX,
    y: face.y - padTop,
    w: face.w + padX * 2,
    h: face.h + padTop + padBottom,
  };
}

function clampBox(box: Box, width: number, height: number): Box {
  const x1 = clamp(box.x, 0, width);
  const y1 = clamp(box.y, 0, height);
  const x2 = clamp(box.x + box.w, 0, width);
  const y2 = clamp(box.y + box.h, 0, height);
  return { x: x1, y: y1, w: Math.max(0, x2 - x1), h: Math.max(0, y2 - y1) };
}

/** Largest hair/chin padding that still fits inside some square in the photo. */
function largestPadding(face: FaceBox, width: number, height: number, maxSide: number): Box {
  const attempt = (scale: number) => {
    const box = clampBox(expandFace(face, scale), width, height);
    return { box, ok: box.w <= maxSide && box.h <= maxSide };
  };
  const full = attempt(1);
  if (full.ok) return full.box;

  let lo = 0;
  let hi = 1;
  let best = attempt(0).box;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    const next = attempt(mid);
    if (next.ok) {
      best = next.box;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return best;
}

function coverCrop(width: number, height: number): CropPlan {
  const side = Math.min(width, height);
  const left = width > height ? Math.floor((width - side) / 2) : 0;
  return { mode: "cover", left, top: 0, side };
}

type Range = { minLeft: number; maxLeft: number; minTop: number; maxTop: number };

function placementRange(box: Box, side: number, width: number, height: number): Range {
  return {
    minLeft: Math.max(0, Math.ceil(box.x + box.w) - side),
    maxLeft: Math.min(Math.floor(box.x), width - side),
    minTop: Math.max(0, Math.ceil(box.y + box.h) - side),
    maxTop: Math.min(Math.floor(box.y), height - side),
  };
}

function rangeFits(range: Range): boolean {
  return range.minLeft <= range.maxLeft && range.minTop <= range.maxTop;
}

function integerSquare(
  width: number,
  height: number,
  side: number,
  left: number,
  top: number,
  padded: Box,
  face: Box
): CropPlan {
  const maxSide = Math.min(width, height);
  const faceNeedW = Math.ceil(face.x + face.w) - Math.floor(face.x);
  const faceNeedH = Math.ceil(face.y + face.h) - Math.floor(face.y);
  if (faceNeedW > maxSide || faceNeedH > maxSide) return { mode: "letterbox" };

  let sidePx = Math.min(maxSide, Math.max(Math.round(side), faceNeedW, faceNeedH, 1));
  let required = placementRange(face, sidePx, width, height);
  while (!rangeFits(required) && sidePx < maxSide) {
    sidePx += 1;
    required = placementRange(face, sidePx, width, height);
  }
  if (!rangeFits(required)) return { mode: "letterbox" };

  const paddedRange = placementRange(padded, sidePx, width, height);
  const preferred = rangeFits(paddedRange) ? paddedRange : required;
  const minLeft = Math.max(preferred.minLeft, required.minLeft);
  const maxLeft = Math.min(preferred.maxLeft, required.maxLeft);
  const minTop = Math.max(preferred.minTop, required.minTop);
  const maxTop = Math.min(preferred.maxTop, required.maxTop);

  return {
    mode: "face",
    left: clampInt(left, minLeft <= maxLeft ? minLeft : required.minLeft, minLeft <= maxLeft ? maxLeft : required.maxLeft),
    top: clampInt(top, minTop <= maxTop ? minTop : required.minTop, minTop <= maxTop ? maxTop : required.maxTop),
    side: sidePx,
  };
}

/**
 * Choose a square window inside the photo.
 * A detected face is kept fully inside the window. No axis is scaled differently from the other.
 */
export function planCrop(width: number, height: number, face: FaceBox | null): CropPlan {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new Error(`Invalid image size ${width}x${height}`);
  }

  const clamped = face ? clampFace(face, width, height) : null;
  if (!clamped) return coverCrop(width, height);

  const maxSide = Math.min(width, height);
  if (clamped.w > maxSide + 1 || clamped.h > maxSide + 1) return { mode: "letterbox" };

  const target = largestPadding(clamped, width, height, maxSide);
  const minSide = Math.max(target.w, target.h, 1);
  const preferred = clamped.h / FACE_HEIGHT_FRACTION;
  const side = clamp(preferred, minSide, maxSide);
  const faceCx = clamped.x + clamped.w / 2;
  const faceCy = clamped.y + clamped.h / 2;
  const left = clamp(faceCx - side / 2, 0, width - side);
  const top = clamp(faceCy - side * FACE_ANCHOR_Y, 0, height - side);

  return integerSquare(width, height, side, left, top, target, clamped);
}

export async function renderFromPlan(
  oriented: Buffer,
  plan: CropPlan
): Promise<Buffer> {
  const image = sharp(oriented, { limitInputPixels: false });
  if (plan.mode === "letterbox") {
    return image
      .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
        fit: "contain",
        background: { r: 32, g: 32, b: 32 },
      })
      .jpeg({ quality: 86, mozjpeg: true })
      .toBuffer();
  }

  // The extracted window is square, so this scale is the same on both axes.
  return image
    .extract({
      left: plan.left,
      top: plan.top,
      width: plan.side,
      height: plan.side,
    })
    .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: "fill" })
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();
}

export async function ensureFaceModel(): Promise<string> {
  try {
    await access(MODEL_PATH);
    return MODEL_PATH;
  } catch {
    const response = await fetch(MODEL_URL);
    if (!response.ok) throw new Error(`YuNet download failed ${response.status}`);
    const model = Buffer.from(await response.arrayBuffer());
    if (model.length < 100_000) throw new Error("YuNet download looked incomplete");
    await mkdir(path.dirname(MODEL_PATH), { recursive: true });
    await writeFile(MODEL_PATH, model);
    return MODEL_PATH;
  }
}

let sessionPromise: Promise<ort.InferenceSession> | null = null;

function faceSession(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = ensureFaceModel()
      .then((modelPath) => ort.InferenceSession.create(modelPath, { executionProviders: ["cpu"] }))
      .catch((error: unknown) => {
        sessionPromise = null;
        throw error;
      });
  }
  return sessionPromise;
}

function tensorValues(tensor: ort.Tensor): Float32Array {
  if (tensor.data instanceof Float32Array) return tensor.data;
  return Float32Array.from(tensor.data as ArrayLike<number>);
}

function channelAt(tensor: ort.Tensor, index: number, channel: number, channels: number): number {
  const dims = tensor.dims;
  if (dims.length === 3 && dims[2] === channels) {
    return tensorValues(tensor)[index * channels + channel];
  }
  throw new Error(`Unexpected YuNet tensor shape ${dims.join("x")}`);
}

function iou(a: FaceBox, b: FaceBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.w * a.h + b.w * b.h - inter;
  return union <= 0 ? 0 : inter / union;
}

function nonMaxSuppression(faces: FaceBox[]): FaceBox[] {
  const sorted = [...faces].sort((a, b) => b.score - a.score);
  const kept: FaceBox[] = [];
  for (const face of sorted) {
    if (kept.length >= 5000) break;
    if (kept.some((other) => iou(other, face) > NMS_THRESHOLD)) continue;
    kept.push(face);
  }
  return kept;
}

function decodeFaces(
  output: Record<string, ort.Tensor>,
  inputW: number,
  inputH: number
): FaceBox[] {
  const faces: FaceBox[] = [];
  for (const stride of STRIDES) {
    const cols = DETECT_SIZE / stride;
    const rows = DETECT_SIZE / stride;
    const cls = output[`cls_${stride}`];
    const obj = output[`obj_${stride}`];
    const bbox = output[`bbox_${stride}`];
    if (!cls || !obj || !bbox) {
      throw new Error(`YuNet output missing stride ${stride}`);
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const index = r * cols + c;
        const clsScore = clamp(channelAt(cls, index, 0, 1), 0, 1);
        const objScore = clamp(channelAt(obj, index, 0, 1), 0, 1);
        const score = Math.sqrt(clsScore * objScore);
        if (score < SCORE_THRESHOLD) continue;

        const cx = (c + channelAt(bbox, index, 0, 4)) * stride;
        const cy = (r + channelAt(bbox, index, 1, 4)) * stride;
        const w = Math.exp(channelAt(bbox, index, 2, 4)) * stride;
        const h = Math.exp(channelAt(bbox, index, 3, 4)) * stride;
        const x = cx - w / 2;
        const y = cy - h / 2;
        if (x + w / 2 >= inputW || y + h / 2 >= inputH) continue;
        if (w < 2 || h < 2) continue;
        faces.push({ x, y, w, h, score });
      }
    }
  }
  return nonMaxSuppression(faces);
}

async function detectFaces(oriented: Buffer, width: number, height: number): Promise<FaceBox[]> {
  const scale = Math.min(DETECT_SIZE / width, DETECT_SIZE / height);
  const inputW = Math.max(1, Math.round(width * scale));
  const inputH = Math.max(1, Math.round(height * scale));
  const { data, info } = await sharp(oriented, { limitInputPixels: false })
    .resize(inputW, inputH, { fit: "fill" })
    .removeAlpha()
    .toColorspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.channels !== 3 || info.width !== inputW || info.height !== inputH) {
    throw new Error(`Unexpected detector input ${info.width}x${info.height}x${info.channels}`);
  }

  const floats = new Float32Array(1 * 3 * DETECT_SIZE * DETECT_SIZE);
  const plane = DETECT_SIZE * DETECT_SIZE;
  for (let y = 0; y < inputH; y++) {
    for (let x = 0; x < inputW; x++) {
      const src = (y * inputW + x) * 3;
      const dst = y * DETECT_SIZE + x;
      floats[dst] = data[src + 2];
      floats[plane + dst] = data[src + 1];
      floats[plane * 2 + dst] = data[src];
    }
  }

  const session = await faceSession();
  const tensor = new ort.Tensor("float32", floats, [1, 3, DETECT_SIZE, DETECT_SIZE]);
  const output = await session.run({ input: tensor });
  const detected = decodeFaces(output, inputW, inputH);
  const scaleX = inputW / width;
  const scaleY = inputH / height;
  return detected.map((face) => ({
    x: face.x / scaleX,
    y: face.y / scaleY,
    w: face.w / scaleX,
    h: face.h / scaleY,
    score: face.score,
  }));
}

function largestFace(faces: FaceBox[]): FaceBox | null {
  let best: FaceBox | null = null;
  for (const face of faces) {
    if (!best || face.w * face.h > best.w * best.h) best = face;
  }
  return best;
}

/** Auto-rotate, then cut a square that keeps the largest face fully inside. */
export async function renderSquareJpeg(input: Buffer): Promise<CroppedImage> {
  const oriented = await sharp(input, { limitInputPixels: false }).rotate().toBuffer();
  const meta = await sharp(oriented, { limitInputPixels: false }).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const faces = await detectFaces(oriented, width, height);
  const face = largestFace(faces);
  const plan = planCrop(width, height, face);
  const jpeg = await renderFromPlan(oriented, plan);
  return {
    jpeg,
    faceFound: plan.mode !== "cover",
    mode: plan.mode,
    plan,
  };
}
