export type Corner = { x: number; y: number };
// Clockwise in the EXIF-oriented original image: TL, TR, BR, BL.
export type Corners = [Corner, Corner, Corner, Corner];
export const fullCorners = (): Corners => [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 }
];
const cross = (a: Corner, b: Corner, c: Corner) =>
  (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
export function area(points: Corner[]) {
  return (
    points.reduce((sum, p, i) => {
      const q = points[(i + 1) % points.length];
      return sum + p.x * q.y - p.y * q.x;
    }, 0) / 2
  );
}
export function validCorners(points: Corners) {
  return (
    points.every(
      (p, i) =>
        Number.isFinite(p.x + p.y) &&
        p.x >= 0 &&
        p.x <= 1 &&
        p.y >= 0 &&
        p.y <= 1 &&
        cross(p, points[(i + 1) % 4], points[(i + 2) % 4]) > 0.0001
    ) && area(points) >= 0.01
  );
}
export function touchPoint(
  x: number,
  y: number,
  rect: { left: number; top: number; width: number; height: number }
): Corner {
  return {
    x: Math.max(0, Math.min(1, (x - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (y - rect.top) / rect.height))
  };
}
export function rotateCorners(points: Corners): Corners {
  const rotated = points.map((p) => ({ x: 1 - p.y, y: p.x }));
  return [rotated[3], rotated[0], rotated[1], rotated[2]];
}
export function outputSize(points: Corners, width: number, height: number, max = 3200) {
  const distance = (a: Corner, b: Corner) =>
    Math.hypot((a.x - b.x) * (width - 1), (a.y - b.y) * (height - 1));
  const w = Math.max(distance(points[0], points[1]), distance(points[3], points[2]));
  const h = Math.max(distance(points[0], points[3]), distance(points[1], points[2]));
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(2, Math.round(w * scale)), height: Math.max(2, Math.round(h * scale)) };
}
// Maps a unit destination rectangle back to the source quadrilateral (inverse homography).
export function homography(p: Corners) {
  const [a, b, c, d] = p;
  const dx = a.x - b.x + c.x - d.x,
    dy = a.y - b.y + c.y - d.y;
  const ux = b.x - c.x,
    vx = d.x - c.x,
    uy = b.y - c.y,
    vy = d.y - c.y;
  const det = ux * vy - vx * uy;
  if (Math.abs(det) < 1e-12) throw new Error('無法計算透視矩陣，請重新調整四角。');
  const g = (dx * vy - vx * dy) / det,
    h = (ux * dy - dx * uy) / det;
  return [
    b.x - a.x + g * b.x,
    d.x - a.x + h * d.x,
    a.x,
    b.y - a.y + g * b.y,
    d.y - a.y + h * d.y,
    a.y,
    g,
    h
  ];
}
export function project(m: number[], x: number, y: number): Corner {
  const z = m[6] * x + m[7] * y + 1;
  return { x: (m[0] * x + m[1] * y + m[2]) / z, y: (m[3] * x + m[4] * y + m[5]) / z };
}
export function context(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('無法配置影像記憶體，請使用較小圖片。');
  return ctx;
}
export function canvas(width: number, height: number) {
  const result = document.createElement('canvas');
  result.width = width;
  result.height = height;
  return result;
}
export function imageDimensions(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length >= 24 && view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a)
    return { width: view.getUint32(16), height: view.getUint32(20) };
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset++] !== 0xff) break;
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xda || marker === 0xd9 || offset + 2 > bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if (
        [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
          marker
        ) &&
        length >= 8
      )
        return { width: view.getUint16(offset + 5), height: view.getUint16(offset + 3) };
      offset += length;
    }
  }
  throw new Error('無法讀取 PNG／JPEG 尺寸，請重新選圖或使用原圖。');
}
export async function loadOriginal(blob: Blob, signal: AbortSignal) {
  signal.throwIfAborted();
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    signal.throwIfAborted();
    // Modern WebViews decode EXIF orientation before drawImage; never apply it twice.
    const result = canvas(image.naturalWidth, image.naturalHeight);
    const ctx = context(result);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, result.width, result.height);
    ctx.drawImage(image, 0, 0);
    return result;
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function rotateImage(source: HTMLCanvasElement) {
  const result = canvas(source.height, source.width),
    ctx = context(result);
  ctx.translate(result.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(source, 0, 0);
  return result;
}
export function encodeCanvas(source: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    source.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('校正圖片暫存失敗，請重試。'))),
      'image/jpeg',
      0.94
    )
  );
}
export const yieldTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
export async function warp(source: HTMLCanvasElement, points: Corners, signal: AbortSignal) {
  if (!validCorners(points)) throw new Error('四角不可交叉，且選取面積至少需要圖片的 1%。');
  signal.throwIfAborted();
  const { width, height } = outputSize(points, source.width, source.height),
    result = canvas(width, height),
    ctx = context(result);
  const input = context(source).getImageData(0, 0, source.width, source.height),
    output = ctx.createImageData(width, height);
  const m = homography(points);
  for (let y = 0; y < height; y++) {
    if (y % 32 === 0) {
      await yieldTask();
      signal.throwIfAborted();
    }
    for (let x = 0; x < width; x++) {
      const p = project(m, x / (width - 1), y / (height - 1));
      const sx = Math.max(0, Math.min(source.width - 1, p.x * (source.width - 1))),
        sy = Math.max(0, Math.min(source.height - 1, p.y * (source.height - 1)));
      const ix = Math.floor(sx),
        iy = Math.floor(sy),
        fx = sx - ix,
        fy = sy - iy;
      const a = (iy * source.width + ix) * 4,
        b = (iy * source.width + Math.min(ix + 1, source.width - 1)) * 4;
      const c = (Math.min(iy + 1, source.height - 1) * source.width + ix) * 4,
        d =
          (Math.min(iy + 1, source.height - 1) * source.width +
            Math.min(ix + 1, source.width - 1)) *
          4;
      const offset = (y * width + x) * 4;
      for (let k = 0; k < 3; k++)
        output.data[offset + k] =
          (input.data[a + k] * (1 - fx) + input.data[b + k] * fx) * (1 - fy) +
          (input.data[c + k] * (1 - fx) + input.data[d + k] * fx) * fy;
      output.data[offset + 3] = 255;
    }
  }
  ctx.putImageData(output, 0, 0);
  return result;
}
function hull(points: Corner[]) {
  points.sort((a, b) => a.x - b.x || a.y - b.y);
  const half = (list: Corner[]) => {
    const result: Corner[] = [];
    for (const p of list) {
      while (
        result.length > 1 &&
        cross(result[result.length - 2], result[result.length - 1], p) <= 0
      )
        result.pop();
      result.push(p);
    }
    return result;
  };
  return [...half(points).slice(0, -1), ...half([...points].reverse()).slice(0, -1)];
}
// shortcut: contrast segmentation targets light paper on darker surfaces; low-confidence scenes require manual selection.
export function detectPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number
): { corners?: Corners; blurry: boolean } {
  const gray = new Uint8Array(width * height);
  let sum = 0,
    squares = 0,
    sharp = 0;
  for (let i = 0; i < gray.length; i++) {
    const v = (data[i * 4] * 77 + data[i * 4 + 1] * 150 + data[i * 4 + 2] * 29) >> 8;
    gray[i] = v;
    sum += v;
    squares += v * v;
    if (i > width) sharp += Math.abs(v - gray[i - width]);
  }
  const mean = sum / gray.length,
    deviation = Math.sqrt(squares / gray.length - mean * mean);
  const blurry = sharp / gray.length < 1.2;
  if (deviation < 18) return { blurry };
  let best: Corners | undefined,
    bestScore = 0;
  for (const threshold of [mean, mean + deviation * 0.5]) {
    const seen = new Uint8Array(gray.length),
      queue = new Int32Array(gray.length);
    for (let start = 0; start < gray.length; start++) {
      if (seen[start] || gray[start] < threshold) continue;
      let head = 0,
        tail = 1;
      queue[0] = start;
      seen[start] = 1;
      const boundary: Corner[] = [];
      while (head < tail) {
        const i = queue[head++],
          x = i % width,
          y = Math.floor(i / width);
        let edge = false;
        for (const n of [
          x > 0 ? i - 1 : -1,
          x < width - 1 ? i + 1 : -1,
          y > 0 ? i - width : -1,
          y < height - 1 ? i + width : -1
        ]) {
          if (n < 0 || gray[n] < threshold) {
            edge = true;
            continue;
          }
          if (!seen[n]) {
            seen[n] = 1;
            queue[tail++] = n;
          }
        }
        if (edge) boundary.push({ x: x / (width - 1), y: y / (height - 1) });
      }
      if (tail < gray.length * 0.12) continue;
      const polygon = hull(boundary),
        originalArea = area(polygon);
      while (polygon.length > 4) {
        let index = 0,
          min = Infinity;
        for (let i = 0; i < polygon.length; i++) {
          const previous = polygon[(i + polygon.length - 1) % polygon.length];
          const next = polygon[(i + 1) % polygon.length];
          const loss =
            Math.abs(
              cross(
                polygon[(i + polygon.length - 1) % polygon.length],
                polygon[i],
                polygon[(i + 1) % polygon.length]
              )
            ) / Math.hypot(next.x - previous.x, next.y - previous.y);
          if (loss < min) {
            min = loss;
            index = i;
          }
        }
        polygon.splice(index, 1);
      }
      if (polygon.length !== 4) continue;
      const first = polygon.reduce(
        (best, p, i) => (p.x + p.y < polygon[best].x + polygon[best].y ? i : best),
        0
      );
      const corners = [...polygon.slice(first), ...polygon.slice(0, first)] as Corners;
      const size = area(corners),
        fill = tail / gray.length / size;
      const border = corners.filter(
        (p) => p.x < 0.005 || p.x > 0.995 || p.y < 0.005 || p.y > 0.995
      ).length;
      const score = fill * (size / originalArea) * (1 - border * 0.22) * Math.sqrt(size);
      if (
        validCorners(corners) &&
        size > 0.12 &&
        size < 0.98 &&
        fill > 0.75 &&
        size / originalArea > 0.92 &&
        score > bestScore
      ) {
        best = corners;
        bestScore = score;
      }
    }
  }
  return { corners: bestScore > 0.3 ? best : undefined, blurry };
}
export function detect(source: HTMLCanvasElement) {
  const scale = Math.min(1, 640 / Math.max(source.width, source.height)),
    small = canvas(
      Math.max(2, Math.round(source.width * scale)),
      Math.max(2, Math.round(source.height * scale))
    );
  const ctx = context(small);
  ctx.drawImage(source, 0, 0, small.width, small.height);
  return detectPixels(
    ctx.getImageData(0, 0, small.width, small.height).data,
    small.width,
    small.height
  );
}
