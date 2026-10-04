import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { OUTPUT_SIZE, planCrop, renderFromPlan, type FaceBox } from "./crop.js";

function assertFaceInside(
  width: number,
  height: number,
  face: FaceBox
) {
  const plan = planCrop(width, height, face);
  assert.equal(plan.mode, "face");
  if (plan.mode !== "face") return;
  assert.ok(plan.left >= 0);
  assert.ok(plan.top >= 0);
  assert.ok(plan.left + plan.side <= width);
  assert.ok(plan.top + plan.side <= height);
  assert.ok(plan.left <= face.x);
  assert.ok(plan.top <= face.y);
  assert.ok(plan.left + plan.side >= face.x + face.w);
  assert.ok(plan.top + plan.side >= face.y + face.h);
  return plan;
}

test("a centered face stays fully inside a square about twice as tall as the face", () => {
  const face = { x: 450, y: 450, w: 100, h: 100, score: 1 };
  const plan = assertFaceInside(1000, 1000, face);
  assert.ok(plan);
  assert.ok(plan.side >= 190 && plan.side <= 210);
});

test("padding above the face is kept when the photo has room", () => {
  const face = { x: 400, y: 200, w: 100, h: 100, score: 1 };
  const plan = assertFaceInside(1000, 1000, face);
  assert.ok(plan);
  assert.ok(plan.top <= face.y - 40);
});

test("a face in the corner still fits inside the photo", () => {
  assertFaceInside(800, 500, { x: 2, y: 3, w: 70, h: 80, score: 1 });
  assertFaceInside(800, 500, { x: 700, y: 390, w: 80, h: 90, score: 1 });
});

test("a face taller than the short side is letterboxed instead of clipped", () => {
  const plan = planCrop(200, 400, { x: 10, y: 20, w: 180, h: 300, score: 1 });
  assert.deepEqual(plan, { mode: "letterbox" });
});

test("no face uses a top-weighted square cover", () => {
  assert.deepEqual(planCrop(100, 400, null), { mode: "cover", left: 0, top: 0, side: 100 });
  assert.deepEqual(planCrop(300, 100, null), { mode: "cover", left: 100, top: 0, side: 100 });
});

test("portrait cover keeps the top of the photo and does not stretch", async () => {
  const blue = sharp({
    create: { width: 100, height: 400, channels: 3, background: { r: 0, g: 0, b: 255 } },
  });
  const red = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } },
  }).png().toBuffer();
  const input = await blue.composite([{ input: red, left: 0, top: 0 }]).png().toBuffer();
  const plan = planCrop(100, 400, null);
  const jpeg = await renderFromPlan(input, plan);
  const { data, info } = await sharp(jpeg).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, OUTPUT_SIZE);
  assert.equal(info.height, OUTPUT_SIZE);
  const i = (400 * OUTPUT_SIZE + 400) * 3;
  assert.ok(data[i] > 200);
  assert.ok(data[i + 2] < 40);
});

test("square resize scales both axes equally", async () => {
  const dot = await sharp({
    create: { width: 16, height: 16, channels: 3, background: { r: 255, g: 255, b: 0 } },
  }).png().toBuffer();
  const input = await sharp({
    create: { width: 160, height: 80, channels: 3, background: { r: 0, g: 0, b: 0 } },
  }).composite([{ input: dot, left: 10, top: 10 }]).png().toBuffer();

  const jpeg = await renderFromPlan(input, { mode: "face", left: 0, top: 0, side: 80 });
  const { data, info } = await sharp(jpeg).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, OUTPUT_SIZE);
  assert.equal(info.height, OUTPUT_SIZE);

  let minX = OUTPUT_SIZE;
  let maxX = 0;
  let minY = OUTPUT_SIZE;
  let maxY = 0;
  for (let y = 0; y < OUTPUT_SIZE; y++) {
    for (let x = 0; x < OUTPUT_SIZE; x++) {
      const i = (y * OUTPUT_SIZE + x) * 3;
      if (data[i] > 200 && data[i + 1] > 200 && data[i + 2] < 80) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  assert.ok(Math.abs(w - h) <= 6, `yellow box ${w}x${h} should stay square`);
  assert.ok(w > 140 && w < 190, `expected about 160px, got ${w}`);
});

test("letterbox keeps the whole photo without stretching", async () => {
  const input = await sharp({
    create: { width: 300, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } },
  }).png().toBuffer();
  const jpeg = await renderFromPlan(input, { mode: "letterbox" });
  const { data, info } = await sharp(jpeg).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, OUTPUT_SIZE);
  assert.equal(info.height, OUTPUT_SIZE);
  const at = (x: number, y: number) => {
    const i = (y * OUTPUT_SIZE + x) * 3;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const top = at(400, 8);
  assert.ok(top[0] < 60 && top[1] < 60 && top[2] < 60);
  const mid = at(400, 400);
  assert.ok(mid[0] > 200 && mid[2] < 40);
});
