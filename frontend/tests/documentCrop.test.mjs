import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compiled = ts.transpileModule(
  readFileSync(new URL('../src/services/documentCrop.ts', import.meta.url), 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }
).outputText;
const {
  fullCorners,
  validCorners,
  rotateCorners,
  touchPoint,
  homography,
  project,
  outputSize,
  detectPixels,
  imageDimensions
} = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const trapezoid = [
  { x: 0.2, y: 0.12 },
  { x: 0.85, y: 0.2 },
  { x: 0.93, y: 0.88 },
  { x: 0.08, y: 0.94 }
];

test('accepts rectangle, trapezoid, near-edge and tilted convex documents; rejects crossing and tiny selections', () => {
  for (const p of [
    fullCorners(),
    trapezoid,
    [
      { x: 0.1, y: 0.01 },
      { x: 0.99, y: 0.1 },
      { x: 0.9, y: 0.99 },
      { x: 0.01, y: 0.9 }
    ]
  ])
    assert.ok(validCorners(p));
  const p = fullCorners();
  for (const invalid of [
    [p[0], p[2], p[1], p[3]],
    p.map((p) => ({ x: p.x * 0.02, y: p.y * 0.02 })),
    [{ x: NaN, y: 0 }, ...p.slice(1)],
    [{ x: -0.1, y: 0 }, ...p.slice(1)],
    [p[0], p[0], p[2], p[3]]
  ])
    assert.equal(validCorners(invalid), false);
});
test('inverse homography maps every destination corner and interior lines without an affine approximation', () => {
  const m = homography(trapezoid);
  for (const [i, p] of fullCorners().entries()) {
    const q = project(m, p.x, p.y);
    assert.ok(Math.hypot(q.x - trapezoid[i].x, q.y - trapezoid[i].y) < 1e-10);
  }
  const a = project(m, 0, 0.5),
    b = project(m, 0.5, 0.5),
    c = project(m, 1, 0.5);
  assert.ok(Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) < 1e-10);
});
test('normalized coordinates survive device size, letterbox offsets and 90/180/270 degree rotations', () => {
  for (const rect of [
    { left: 30, top: 100, width: 300, height: 500 },
    { left: 250, top: 15, width: 600, height: 240 }
  ]) {
    assert.deepEqual(
      touchPoint(rect.left + rect.width * 0.5, rect.top + rect.height * 0.25, rect),
      { x: 0.5, y: 0.25 }
    );
    assert.deepEqual(touchPoint(-100, -100, rect), { x: 0, y: 0 });
  }
  let p = trapezoid;
  for (let i = 0; i < 4; i++) {
    p = rotateCorners(p);
    assert.ok(validCorners(p));
  }
  p.forEach((q, i) => assert.ok(Math.hypot(q.x - trapezoid[i].x, q.y - trapezoid[i].y) < 1e-10));
});
test('output uses source edge lengths and caps high resolution without forcing a square', () => {
  assert.deepEqual(outputSize(fullCorners(), 4001, 2001), { width: 3200, height: 1600 });
  const size = outputSize(trapezoid, 6000, 4000);
  assert.equal(Math.max(size.width, size.height), 3200);
  assert.notEqual(size.width, size.height);
});
export function synthetic(points = trapezoid, width = 240, height = 200) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const p = { x: x / (width - 1), y: y / (height - 1) };
      const inside = points.every((a, i) => {
        const b = points[(i + 1) % 4];
        return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) >= 0;
      });
      const v = inside ? 235 : 35;
      const i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  return data;
}
test('contrast detector recovers known trapezoid corners and rotated documents, falls back for uniform images', () => {
  let p = trapezoid;
  for (let turn = 0; turn < 4; turn++) {
    const result = detectPixels(synthetic(p), 240, 200);
    assert.ok(result.corners);
    for (const corner of p)
      assert.ok(result.corners.some((q) => Math.hypot(corner.x - q.x, corner.y - q.y) < 0.025));
    p = rotateCorners(p);
  }
  assert.equal(
    detectPixels(new Uint8ClampedArray(100 * 100 * 4).fill(240), 100, 100).corners,
    undefined
  );
});

test('reads PNG/JPEG sizes before decoding and rejects malformed headers', () => {
  const png = new Uint8Array(24),
    view = new DataView(png.buffer);
  view.setUint32(0, 0x89504e47);
  view.setUint32(4, 0x0d0a1a0a);
  view.setUint32(16, 8000);
  view.setUint32(20, 6000);
  assert.deepEqual(imageDimensions(png), { width: 8000, height: 6000 });
  const jpeg = new Uint8Array([255, 216, 255, 192, 0, 8, 8, 1, 44, 2, 88, 3]);
  assert.deepEqual(imageDimensions(jpeg), { width: 600, height: 300 });
  for (const bytes of [
    new Uint8Array(),
    jpeg.slice(0, 7),
    new Uint8Array([255, 216, 255, 225, 255, 255])
  ])
    assert.throws(() => imageDimensions(bytes));
});
