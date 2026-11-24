export interface Point2D {
  x: number;
  y: number;
}

export interface DetectedQuad {
  /** 4 corners in normalized [0..1] image coordinates: [TL, TR, BR, BL] */
  corners: [Point2D, Point2D, Point2D, Point2D];
  confidence: number;
  isFallback?: boolean;
}

export type EnhancementPreset = 'original' | 'clean' | 'bw';

export interface CardEnhancementParams {
  preset: EnhancementPreset;
  brightness: number; // -40 to +40
  contrast: number; // 0.8 to 1.5
  sharpness: number; // 0 to 1
  whiteBalance: number; // 0 to 1
  shadowRemoval: number; // 0 to 1
}

export interface CardOutputOptions extends CardEnhancementParams {
  widthPx: number;
  heightPx: number;
  widthMm: number;
  heightMm: number;
  cornerRadiusMm: number;
  trimMm: number;
  rotation: 0 | 90 | 180 | 270;
}

export const DEFAULT_ENHANCEMENT_BY_PRESET: Record<
  EnhancementPreset,
  Omit<CardEnhancementParams, 'preset'>
> = {
  original: {
    brightness: 0,
    contrast: 1,
    sharpness: 0,
    whiteBalance: 0,
    shadowRemoval: 0,
  },
  clean: {
    brightness: 0,
    contrast: 1.1,
    sharpness: 0.35,
    whiteBalance: 0.85,
    shadowRemoval: 0.85,
  },
  bw: {
    brightness: 6,
    contrast: 1.32,
    sharpness: 0.45,
    whiteBalance: 0.9,
    shadowRemoval: 0.95,
  },
};

function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[maxRow][col])) maxRow = r;
    }
    if (Math.abs(M[maxRow][col]) < 1e-10) return null;
    [M[col], M[maxRow]] = [M[maxRow], M[col]];

    const pivot = M[col][col];
    for (let j = col; j <= n; j++) M[col][j] /= pivot;

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      for (let j = col; j <= n; j++) {
        M[r][j] -= factor * M[col][j];
      }
    }
  }
  return M.map((row) => row[n]);
}

function computeInverseHomography(
  dstW: number,
  dstH: number,
  src: [Point2D, Point2D, Point2D, Point2D]
): number[] | null {
  const dst: Point2D[] = [
    { x: 0, y: 0 },
    { x: dstW, y: 0 },
    { x: dstW, y: dstH },
    { x: 0, y: dstH },
  ];

  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const { x: u, y: v } = dst[i];
    const { x, y } = src[i];
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]);
    b.push(x);
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y]);
    b.push(y);
  }

  const h = solveLinearSystem(A, b);
  if (!h) return null;
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

export function orderQuadCorners(pts: Point2D[]): [Point2D, Point2D, Point2D, Point2D] {
  const cx = pts.reduce((s, p) => s + p.x, 0) / 4;
  const cy = pts.reduce((s, p) => s + p.y, 0) / 4;
  const sorted = [...pts].sort(
    (a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx)
  );
  let tlIdx = 0;
  let minSum = Infinity;
  sorted.forEach((p, idx) => {
    const s = p.x + p.y;
    if (s < minSum) {
      minSum = s;
      tlIdx = idx;
    }
  });
  const ordered: [Point2D, Point2D, Point2D, Point2D] = [
    sorted[tlIdx],
    sorted[(tlIdx + 1) % 4],
    sorted[(tlIdx + 2) % 4],
    sorted[(tlIdx + 3) % 4],
  ];

  const wLen = Math.hypot(ordered[1].x - ordered[0].x, ordered[1].y - ordered[0].y);
  const hLen = Math.hypot(ordered[2].x - ordered[1].x, ordered[2].y - ordered[1].y);
  if (hLen > wLen * 1.05) {
    return [ordered[1], ordered[2], ordered[3], ordered[0]];
  }
  return ordered;
}

function convexHull(points: Point2D[]): Point2D[] {
  if (points.length <= 3) return points;
  const pts = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const cross = (o: Point2D, a: Point2D, b: Point2D) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: Point2D[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: Point2D[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function pointToSegmentDist(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-8) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function rdpOpen(pts: Point2D[], epsilon: number): Point2D[] {
  if (pts.length <= 2) return pts;
  let maxDist = 0;
  let index = 0;
  const end = pts.length - 1;
  for (let i = 1; i < end; i++) {
    const d = pointToSegmentDist(pts[i], pts[0], pts[end]);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }
  if (maxDist > epsilon) {
    const left = rdpOpen(pts.slice(0, index + 1), epsilon);
    const right = rdpOpen(pts.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [pts[0], pts[end]];
}

function approxPolyDPClosed(hull: Point2D[], epsilon: number): Point2D[] {
  if (hull.length <= 4) return hull;
  let idxA = 0;
  let idxB = 0;
  let maxD = -1;
  for (let i = 0; i < hull.length; i++) {
    for (let j = i + 1; j < hull.length; j++) {
      const d = Math.hypot(hull[i].x - hull[j].x, hull[i].y - hull[j].y);
      if (d > maxD) {
        maxD = d;
        idxA = i;
        idxB = j;
      }
    }
  }
  const chain1: Point2D[] = [];
  for (let k = idxA; k !== idxB; k = (k + 1) % hull.length) chain1.push(hull[k]);
  chain1.push(hull[idxB]);

  const chain2: Point2D[] = [];
  for (let k = idxB; k !== idxA; k = (k + 1) % hull.length) chain2.push(hull[k]);
  chain2.push(hull[idxA]);

  const s1 = rdpOpen(chain1, epsilon);
  const s2 = rdpOpen(chain2, epsilon);
  return s1.slice(0, -1).concat(s2.slice(0, -1));
}

function polygonArea(pts: Point2D[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(a) / 2;
}

function polygonPerimeter(pts: Point2D[]): number {
  let p = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    p += Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y);
  }
  return p;
}

function minAreaRect(hull: Point2D[]): {
  corners: [Point2D, Point2D, Point2D, Point2D];
  width: number;
  height: number;
  area: number;
} | null {
  if (hull.length < 3) return null;
  let bestArea = Infinity;
  let bestRect: {
    corners: [Point2D, Point2D, Point2D, Point2D];
    width: number;
    height: number;
    area: number;
  } | null = null;

  for (let i = 0; i < hull.length; i++) {
    const p1 = hull[i];
    const p2 = hull[(i + 1) % hull.length];
    const edgeAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const cos = Math.cos(-edgeAngle);
    const sin = Math.sin(-edgeAngle);

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const p of hull) {
      const rx = p.x * cos - p.y * sin;
      const ry = p.x * sin + p.y * cos;
      if (rx < minX) minX = rx;
      if (rx > maxX) maxX = rx;
      if (ry < minY) minY = ry;
      if (ry > maxY) maxY = ry;
    }

    const w = maxX - minX;
    const h = maxY - minY;
    const area = w * h;
    if (area > 0 && area < bestArea) {
      bestArea = area;
      const rCos = Math.cos(edgeAngle);
      const rSin = Math.sin(edgeAngle);
      const unrotate = (rx: number, ry: number): Point2D => ({
        x: rx * rCos - ry * rSin,
        y: rx * rSin + ry * rCos,
      });
      const rawCorners = [
        unrotate(minX, minY),
        unrotate(maxX, minY),
        unrotate(maxX, maxY),
        unrotate(minX, maxY),
      ];
      bestRect = {
        corners: orderQuadCorners(rawCorners),
        width: Math.max(w, h),
        height: Math.min(w, h),
        area,
      };
    }
  }
  return bestRect;
}

function fitPerspectiveQuad(
  hull: Point2D[],
  fallbackRect: { corners: [Point2D, Point2D, Point2D, Point2D]; area: number }
): [Point2D, Point2D, Point2D, Point2D] {
  const perim = polygonPerimeter(hull);
  for (let frac = 0.015; frac <= 0.08; frac += 0.008) {
    const approx = approxPolyDPClosed(hull, perim * frac);
    if (approx.length === 4) {
      const ordered = orderQuadCorners(approx);
      const qArea = polygonArea(ordered);
      const wTop = Math.hypot(ordered[1].x - ordered[0].x, ordered[1].y - ordered[0].y);
      const wBot = Math.hypot(ordered[2].x - ordered[3].x, ordered[2].y - ordered[3].y);
      const hLeft = Math.hypot(ordered[3].x - ordered[0].x, ordered[3].y - ordered[0].y);
      const hRight = Math.hypot(ordered[2].x - ordered[1].x, ordered[2].y - ordered[1].y);
      const avgW = (wTop + wBot) / 2;
      const avgH = (hLeft + hRight) / 2;
      const ratio = avgH > 0 ? avgW / avgH : 0;

      if (
        qArea >= fallbackRect.area * 0.78 &&
        qArea <= fallbackRect.area * 1.15 &&
        ratio >= 1.25 &&
        ratio <= 1.95
      ) {
        return ordered;
      }
    }
  }
  return fallbackRect.corners;
}

function dilateBinary(src: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  const tmp = new Uint8Array(w * h);
  const dst = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let val = 0;
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(w - 1, x + radius);
      for (let kx = x0; kx <= x1; kx++) {
        if (src[row + kx]) {
          val = 1;
          break;
        }
      }
      tmp[row + x] = val;
    }
  }
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(h - 1, y + radius);
    for (let x = 0; x < w; x++) {
      let val = 0;
      for (let ky = y0; ky <= y1; ky++) {
        if (tmp[ky * w + x]) {
          val = 1;
          break;
        }
      }
      dst[y * w + x] = val;
    }
  }
  return dst;
}

function erodeBinary(src: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  const tmp = new Uint8Array(w * h);
  const dst = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let val = 1;
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(w - 1, x + radius);
      for (let kx = x0; kx <= x1; kx++) {
        if (!src[row + kx]) {
          val = 0;
          break;
        }
      }
      tmp[row + x] = val;
    }
  }
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(h - 1, y + radius);
    for (let x = 0; x < w; x++) {
      let val = 1;
      for (let ky = y0; ky <= y1; ky++) {
        if (!tmp[ky * w + x]) {
          val = 0;
          break;
        }
      }
      dst[y * w + x] = val;
    }
  }
  return dst;
}

function detectCardsFromMask(
  mask: Uint8Array,
  w: number,
  h: number,
  minFillRatio: number
): DetectedQuad[] {
  const opened = dilateBinary(erodeBinary(mask, w, h, 2), w, h, 2);
  const closed = erodeBinary(dilateBinary(opened, w, h, 2), w, h, 2);

  const visited = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  const totalArea = w * h;
  const minArea = totalArea * 0.03;
  const results: DetectedQuad[] = [];

  for (let idx = 0; idx < totalArea; idx++) {
    if (!closed[idx] || visited[idx]) continue;

    let qHead = 0;
    let qTail = 0;
    queue[qTail++] = idx;
    visited[idx] = 1;

    let area = 0;
    const boundaryPts: Point2D[] = [];

    while (qHead < qTail) {
      const curr = queue[qHead++];
      area++;
      const cx = curr % w;
      const cy = (curr - cx) / w;

      let isEdge = cx === 0 || cy === 0 || cx === w - 1 || cy === h - 1;
      const neighbors = [
        cx > 0 ? curr - 1 : -1,
        cx < w - 1 ? curr + 1 : -1,
        cy > 0 ? curr - w : -1,
        cy < h - 1 ? curr + w : -1,
      ];

      for (const nb of neighbors) {
        if (nb === -1) continue;
        if (!closed[nb]) {
          isEdge = true;
        } else if (!visited[nb]) {
          visited[nb] = 1;
          queue[qTail++] = nb;
        }
      }

      if (isEdge && (area % 2 === 0 || boundaryPts.length < 360)) {
        boundaryPts.push({ x: cx, y: cy });
      }
    }

    if (area < minArea || area > totalArea * 0.94 || boundaryPts.length < 12) continue;

    const hull = convexHull(boundaryPts);
    const rect = minAreaRect(hull);
    if (!rect || rect.height < 12) continue;

    const aspect = rect.width / rect.height;
    const fillRatio = area / rect.area;

    if (aspect >= 1.3 && aspect <= 1.9 && fillRatio >= minFillRatio) {
      const refinedCorners = fitPerspectiveQuad(hull, rect);
      const normalized = refinedCorners.map((p) => ({
        x: Math.min(0.995, Math.max(0.005, p.x / w)),
        y: Math.min(0.995, Math.max(0.005, p.y / h)),
      })) as [Point2D, Point2D, Point2D, Point2D];

      results.push({
        corners: orderQuadCorners(normalized),
        confidence: Math.min(1, fillRatio),
      });
    }
  }

  results.sort((a, b) => {
    const ay = a.corners.reduce((s, p) => s + p.y, 0) / 4;
    const by = b.corners.reduce((s, p) => s + p.y, 0) / 4;
    if (Math.abs(ay - by) > 0.14) return ay - by;
    const ax = a.corners.reduce((s, p) => s + p.x, 0) / 4;
    const bx = b.corners.reduce((s, p) => s + p.x, 0) / 4;
    return ax - bx;
  });

  return results.slice(0, 4);
}

export function detectCardsFromRgba(
  data: Uint8ClampedArray,
  w: number,
  h: number
): DetectedQuad[] {
  const buildMask = (minV: number, maxS: number): Uint8Array => {
    const mask = new Uint8Array(w * h);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const v = max;
      const s = max === 0 ? 0 : (max - min) / max;
      if (v >= minV && s <= maxS) {
        mask[p] = 1;
      }
    }
    return mask;
  };

  let detected = detectCardsFromMask(buildMask(0.46, 0.42), w, h, 0.85);
  if (detected.length === 0) {
    detected = detectCardsFromMask(buildMask(0.36, 0.50), w, h, 0.85);
  }
  if (detected.length === 0) {
    detected = detectCardsFromMask(buildMask(0.52, 0.36), w, h, 0.78);
  }

  if (detected.length === 0) {
    return [createDefaultQuad(true)];
  }
  return detected;
}

export function autoDetectCards(img: HTMLImageElement): DetectedQuad[] {
  const maxDim = 420;
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(40, Math.round(img.naturalWidth * scale));
  const h = Math.max(40, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [createDefaultQuad(true)];

  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  return detectCardsFromRgba(data, w, h);
}

export function createDefaultQuad(isFallback = false): DetectedQuad {
  return {
    corners: [
      { x: 0.12, y: 0.18 },
      { x: 0.88, y: 0.18 },
      { x: 0.88, y: 0.82 },
      { x: 0.12, y: 0.82 },
    ],
    confidence: isFallback ? 0 : 1,
    isFallback,
  };
}

/**
 * Estimates actual source photo DPI across the cropped card quad.
 */
export function calculateEffectiveCardDpi(
  img: HTMLImageElement,
  corners: [Point2D, Point2D, Point2D, Point2D],
  widthMm: number,
  heightMm: number
): number {
  const [tl, tr, br, bl] = corners;
  const w1 = Math.hypot((tr.x - tl.x) * img.naturalWidth, (tr.y - tl.y) * img.naturalHeight);
  const w2 = Math.hypot((br.x - bl.x) * img.naturalWidth, (br.y - bl.y) * img.naturalHeight);
  const h1 = Math.hypot((bl.x - tl.x) * img.naturalWidth, (bl.y - tl.y) * img.naturalHeight);
  const h2 = Math.hypot((br.x - tr.x) * img.naturalWidth, (br.y - tr.y) * img.naturalHeight);

  const avgPxW = (w1 + w2) / 2;
  const avgPxH = (h1 + h2) / 2;
  const dpiW = avgPxW / (Math.max(10, widthMm) / 25.4);
  const dpiH = avgPxH / (Math.max(10, heightMm) / 25.4);
  return Math.round(Math.min(dpiW, dpiH));
}

function shrinkQuadInward(
  quad: [Point2D, Point2D, Point2D, Point2D],
  trimFracX: number,
  trimFracY: number
): [Point2D, Point2D, Point2D, Point2D] {
  if (trimFracX <= 0 && trimFracY <= 0) return quad;
  const [tl, tr, br, bl] = quad;
  const fx = Math.min(0.12, Math.max(0, trimFracX));
  const fy = Math.min(0.12, Math.max(0, trimFracY));

  const lerp2 = (a: Point2D, b: Point2D, t: number): Point2D => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  });

  const bilerp = (u: number, v: number): Point2D => {
    const top = lerp2(tl, tr, u);
    const bot = lerp2(bl, br, u);
    return lerp2(top, bot, v);
  };

  return [
    bilerp(fx, fy),
    bilerp(1 - fx, fy),
    bilerp(1 - fx, 1 - fy),
    bilerp(fx, 1 - fy),
  ];
}

export function suggestFlip180(canvas: HTMLCanvasElement): boolean {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx || w < 40 || h < 40) return false;

  const data = ctx.getImageData(0, 0, w, h).data;
  const bandH = Math.floor(h * 0.24);
  let topDark = 0;
  let botDark = 0;

  for (let y = 8; y < bandH; y += 2) {
    for (let x = 10; x < w - 10; x += 4) {
      const iTop = (y * w + x) * 4;
      const lumTop = 0.299 * data[iTop] + 0.587 * data[iTop + 1] + 0.114 * data[iTop + 2];
      if (lumTop < 155) topDark++;

      const yBot = h - 1 - y;
      const iBot = (yBot * w + x) * 4;
      const lumBot = 0.299 * data[iBot] + 0.587 * data[iBot + 1] + 0.114 * data[iBot + 2];
      if (lumBot < 155) botDark++;
    }
  }
  return botDark > topDark * 2.1 && botDark > 120;
}

/**
 * Computes Normalized Cross-Correlation (NCC) on 64x40 downscaled grayscale buffers
 * at 0° vs 180° to match a card's orientation to a user-marked reference card.
 */
export function compareOrientationWithReference(
  refCanvas: HTMLCanvasElement,
  targetCanvas: HTMLCanvasElement
): { shouldFlip180: boolean; score0: number; score180: number } {
  const gw = 64;
  const gh = 40;

  const toGrayVec = (src: HTMLCanvasElement, flip180: boolean): Float32Array => {
    const c = document.createElement('canvas');
    c.width = gw;
    c.height = gh;
    const ctx = c.getContext('2d')!;
    if (flip180) {
      ctx.translate(gw / 2, gh / 2);
      ctx.rotate(Math.PI);
      ctx.drawImage(src, -gw / 2, -gh / 2, gw, gh);
    } else {
      ctx.drawImage(src, 0, 0, gw, gh);
    }
    const px = ctx.getImageData(0, 0, gw, gh).data;
    const vec = new Float32Array(gw * gh);
    let sum = 0;
    for (let i = 0, p = 0; i < px.length; i += 4, p++) {
      const l = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      vec[p] = l;
      sum += l;
    }
    const mean = sum / vec.length;
    for (let p = 0; p < vec.length; p++) vec[p] -= mean;
    return vec;
  };

  const ncc = (a: Float32Array, b: Float32Array): number => {
    let num = 0;
    let denA = 0;
    let denB = 0;
    for (let i = 0; i < a.length; i++) {
      num += a[i] * b[i];
      denA += a[i] * a[i];
      denB += b[i] * b[i];
    }
    const denom = Math.sqrt(denA * denB);
    return denom > 1e-6 ? num / denom : 0;
  };

  const refVec = toGrayVec(refCanvas, false);
  const vec0 = toGrayVec(targetCanvas, false);
  const vec180 = toGrayVec(targetCanvas, true);

  const score0 = ncc(refVec, vec0);
  const score180 = ncc(refVec, vec180);

  return {
    shouldFlip180: score180 > score0 + 0.02,
    score0,
    score180,
  };
}

function boxBlurRgb(
  src: Float32Array,
  w: number,
  h: number,
  radius: number
): Float32Array {
  const tmp = new Float32Array(w * h * 3);
  const dst = new Float32Array(w * h * 3);
  const win = radius * 2 + 1;

  for (let y = 0; y < h; y++) {
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let kx = -radius; kx <= radius; kx++) {
        const cx = Math.min(w - 1, Math.max(0, kx));
        sum += src[(y * w + cx) * 3 + c];
      }
      for (let x = 0; x < w; x++) {
        tmp[(y * w + x) * 3 + c] = sum / win;
        const addX = Math.min(w - 1, x + radius + 1);
        const remX = Math.max(0, x - radius);
        sum += src[(y * w + addX) * 3 + c] - src[(y * w + remX) * 3 + c];
      }
    }
  }

  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let ky = -radius; ky <= radius; ky++) {
        const cy = Math.min(h - 1, Math.max(0, ky));
        sum += tmp[(cy * w + x) * 3 + c];
      }
      for (let y = 0; y < h; y++) {
        dst[(y * w + x) * 3 + c] = sum / win;
        const addY = Math.min(h - 1, y + radius + 1);
        const remY = Math.max(0, y - radius);
        sum += tmp[(addY * w + x) * 3 + c] - tmp[(remY * w + x) * 3 + c];
      }
    }
  }

  return dst;
}

/**
 * Applies White Balance, Shadow Removal, Contrast, Brightness, Sharpness, and B&W document mode
 * directly onto an already-warped canvas (used for both real-time preview and full-res export).
 */
export function applyEnhancementsToCanvas(
  canvas: HTMLCanvasElement,
  params: CardEnhancementParams
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const px = imgData.data;

  const isBw = params.preset === 'bw';
  const useIllum = params.shadowRemoval > 0.01;
  const useWb = params.whiteBalance > 0.01;

  let illum: Float32Array | null = null;
  let sw = 0;
  let sh = 0;
  if (useIllum) {
    sw = Math.max(24, Math.floor(w / 8));
    sh = Math.max(16, Math.floor(h / 8));
    const small = new Float32Array(sw * sh * 3);
    for (let sy = 0; sy < sh; sy++) {
      const y0 = Math.floor((sy * h) / sh);
      for (let sx = 0; sx < sw; sx++) {
        const x0 = Math.floor((sx * w) / sw);
        const idx = (y0 * w + x0) * 4;
        const sIdx = (sy * sw + sx) * 3;
        small[sIdx] = px[idx];
        small[sIdx + 1] = px[idx + 1];
        small[sIdx + 2] = px[idx + 2];
      }
    }
    illum = boxBlurRgb(small, sw, sh, Math.max(4, Math.round(sw / 10)));
  }

  let wb = [1, 1, 1];
  if (useWb) {
    let sumR = 0, sumG = 0, sumB = 0, cnt = 0;
    for (let i = 0; i < px.length; i += 20) {
      const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      if (lum > 175) {
        sumR += px[i];
        sumG += px[i + 1];
        sumB += px[i + 2];
        cnt++;
      }
    }
    const avgR = cnt > 20 ? sumR / cnt : 230;
    const avgG = cnt > 20 ? sumG / cnt : 230;
    const avgB = cnt > 20 ? sumB / cnt : 230;
    const avgMax = Math.max(avgR, avgG, avgB, 200);
    const s = params.whiteBalance;
    wb = [
      1 + (Math.min(1.28, avgMax / Math.max(140, avgR)) - 1) * s,
      1 + (Math.min(1.28, avgMax / Math.max(140, avgG)) - 1) * s,
      1 + (Math.min(1.28, avgMax / Math.max(140, avgB)) - 1) * s,
    ];
  }

  const shadowMix = params.shadowRemoval * 0.72;
  const cFactor = params.contrast;

  for (let y = 0; y < h; y++) {
    const syf = useIllum ? (y / h) * (sh - 1) : 0;
    const sy0 = Math.floor(syf);
    const sy1 = useIllum ? Math.min(sh - 1, sy0 + 1) : 0;
    const dy = syf - sy0;

    for (let x = 0; x < w; x++) {
      const outIdx = (y * w + x) * 4;
      let r = px[outIdx] * wb[0];
      let g = px[outIdx + 1] * wb[1];
      let b = px[outIdx + 2] * wb[2];

      if (useIllum && illum) {
        const sxf = (x / w) * (sw - 1);
        const sx0 = Math.floor(sxf);
        const sx1 = Math.min(sw - 1, sx0 + 1);
        const dx = sxf - sx0;

        const i00 = (sy0 * sw + sx0) * 3;
        const i10 = (sy0 * sw + sx1) * 3;
        const i01 = (sy1 * sw + sx0) * 3;
        const i11 = (sy1 * sw + sx1) * 3;

        const bg0 =
          illum[i00] * (1 - dx) * (1 - dy) +
          illum[i10] * dx * (1 - dy) +
          illum[i01] * (1 - dx) * dy +
          illum[i11] * dx * dy;
        const bg1 =
          illum[i00 + 1] * (1 - dx) * (1 - dy) +
          illum[i10 + 1] * dx * (1 - dy) +
          illum[i01 + 1] * (1 - dx) * dy +
          illum[i11 + 1] * dx * dy;
        const bg2 =
          illum[i00 + 2] * (1 - dx) * (1 - dy) +
          illum[i10 + 2] * dx * (1 - dy) +
          illum[i01 + 2] * (1 - dx) * dy +
          illum[i11 + 2] * dx * dy;

        const normR = (r * 246) / Math.max(92, bg0);
        const normG = (g * 246) / Math.max(92, bg1);
        const normB = (b * 246) / Math.max(92, bg2);

        r = normR * shadowMix + r * (1 - shadowMix);
        g = normG * shadowMix + g * (1 - shadowMix);
        b = normB * shadowMix + b * (1 - shadowMix);
      }

      if (isBw) {
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        let v = (lum - 128) * cFactor + 134 + params.brightness;
        v = v < 0 ? 0 : v > 255 ? 255 : v;
        px[outIdx] = v;
        px[outIdx + 1] = v;
        px[outIdx + 2] = v;
      } else {
        let vr = (r - 128) * cFactor + 128 + params.brightness;
        let vg = (g - 128) * cFactor + 128 + params.brightness;
        let vb = (b - 128) * cFactor + 128 + params.brightness;
        px[outIdx] = vr < 0 ? 0 : vr > 255 ? 255 : vr;
        px[outIdx + 1] = vg < 0 ? 0 : vg > 255 ? 255 : vg;
        px[outIdx + 2] = vb < 0 ? 0 : vb > 255 ? 255 : vb;
      }
    }
  }

  if (params.sharpness > 0.02) {
    const copy = new Uint8ClampedArray(px);
    const amount = params.sharpness * 0.65;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          const blur4 =
            (copy[i - 4 + c] +
              copy[i + 4 + c] +
              copy[i - w * 4 + c] +
              copy[i + w * 4 + c]) *
            0.25;
          const sharp = copy[i + c] + amount * (copy[i + c] - blur4);
          px[i + c] = sharp < 0 ? 0 : sharp > 255 ? 255 : sharp;
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

export function applyRoundedWhiteMask(
  canvas: HTMLCanvasElement,
  cornerRadiusPx: number
): void {
  if (cornerRadiusPx <= 0.5) return;
  const w = canvas.width;
  const h = canvas.height;
  const r = Math.min(cornerRadiusPx, w / 4, h / 4);

  const masked = document.createElement('canvas');
  masked.width = w;
  masked.height = h;
  const mCtx = masked.getContext('2d')!;

  mCtx.fillStyle = '#ffffff';
  mCtx.fillRect(0, 0, w, h);

  mCtx.save();
  mCtx.beginPath();
  mCtx.moveTo(r, 0);
  mCtx.lineTo(w - r, 0);
  mCtx.quadraticCurveTo(w, 0, w, r);
  mCtx.lineTo(w, h - r);
  mCtx.quadraticCurveTo(w, h, w - r, h);
  mCtx.lineTo(r, h);
  mCtx.quadraticCurveTo(0, h, 0, h - r);
  mCtx.lineTo(0, r);
  mCtx.quadraticCurveTo(0, 0, r, 0);
  mCtx.closePath();
  mCtx.clip();

  mCtx.drawImage(canvas, 0, 0);
  mCtx.restore();

  const origCtx = canvas.getContext('2d')!;
  origCtx.clearRect(0, 0, w, h);
  origCtx.drawImage(masked, 0, 0);
}

/**
 * Performs pure perspective warp + trim inward (no enhancement yet) so caller can cache raw warped image.
 */
export function warpCardRaw(
  img: HTMLImageElement,
  normalizedCorners: [Point2D, Point2D, Point2D, Point2D],
  widthPx: number,
  heightPx: number,
  widthMm: number,
  heightMm: number,
  trimMm: number,
  rotation: 0 | 90 | 180 | 270
): HTMLCanvasElement {
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;

  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = srcW;
  srcCanvas.height = srcH;
  const srcCtx = srcCanvas.getContext('2d')!;
  srcCtx.drawImage(img, 0, 0, srcW, srcH);
  const srcImgData = srcCtx.getImageData(0, 0, srcW, srcH).data;

  const trimmedNorm = shrinkQuadInward(
    normalizedCorners,
    trimMm / Math.max(10, widthMm),
    trimMm / Math.max(10, heightMm)
  );

  const srcQuad = trimmedNorm.map((p) => ({
    x: p.x * srcW,
    y: p.y * srcH,
  })) as [Point2D, Point2D, Point2D, Point2D];

  const H = computeInverseHomography(widthPx, heightPx, srcQuad);
  const flatCanvas = document.createElement('canvas');
  flatCanvas.width = widthPx;
  flatCanvas.height = heightPx;
  const flatCtx = flatCanvas.getContext('2d')!;
  const outImgData = flatCtx.createImageData(widthPx, heightPx);
  const dst = outImgData.data;

  if (H) {
    const [h0, h1, h2, h3, h4, h5, h6, h7, h8] = H;
    for (let y = 0; y < heightPx; y++) {
      for (let x = 0; x < widthPx; x++) {
        const denom = h6 * x + h7 * y + h8;
        if (Math.abs(denom) < 1e-8) continue;
        const sx = (h0 * x + h1 * y + h2) / denom;
        const sy = (h3 * x + h4 * y + h5) / denom;

        const outIdx = (y * widthPx + x) * 4;
        if (sx < 0 || sy < 0 || sx >= srcW - 1 || sy >= srcH - 1) {
          dst[outIdx] = 255;
          dst[outIdx + 1] = 255;
          dst[outIdx + 2] = 255;
          dst[outIdx + 3] = 255;
          continue;
        }

        const x0 = Math.floor(sx);
        const y0 = Math.floor(sy);
        const dx = sx - x0;
        const dy = sy - y0;
        const w00 = (1 - dx) * (1 - dy);
        const w10 = dx * (1 - dy);
        const w01 = (1 - dx) * dy;
        const w11 = dx * dy;

        const i00 = (y0 * srcW + x0) * 4;
        const i10 = i00 + 4;
        const i01 = i00 + srcW * 4;
        const i11 = i01 + 4;

        dst[outIdx] =
          srcImgData[i00] * w00 +
          srcImgData[i10] * w10 +
          srcImgData[i01] * w01 +
          srcImgData[i11] * w11;
        dst[outIdx + 1] =
          srcImgData[i00 + 1] * w00 +
          srcImgData[i10 + 1] * w10 +
          srcImgData[i01 + 1] * w01 +
          srcImgData[i11 + 1] * w11;
        dst[outIdx + 2] =
          srcImgData[i00 + 2] * w00 +
          srcImgData[i10 + 2] * w10 +
          srcImgData[i01 + 2] * w01 +
          srcImgData[i11 + 2] * w11;
        dst[outIdx + 3] = 255;
      }
    }
    flatCtx.putImageData(outImgData, 0, 0);
  } else {
    flatCtx.drawImage(img, 0, 0, widthPx, heightPx);
  }

  if (rotation === 0) return flatCanvas;

  const rotCanvas = document.createElement('canvas');
  if (rotation === 90 || rotation === 270) {
    rotCanvas.width = heightPx;
    rotCanvas.height = widthPx;
  } else {
    rotCanvas.width = widthPx;
    rotCanvas.height = heightPx;
  }
  const rCtx = rotCanvas.getContext('2d')!;
  rCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
  rCtx.rotate((rotation * Math.PI) / 180);
  rCtx.drawImage(flatCanvas, -widthPx / 2, -heightPx / 2);
  return rotCanvas;
}

/**
 * Full pipeline: warp from full-res source + apply enhancement + rounded white corner mask.
 */
export function warpCardPerspective(
  img: HTMLImageElement,
  normalizedCorners: [Point2D, Point2D, Point2D, Point2D],
  options: CardOutputOptions
): HTMLCanvasElement {
  const canvas = warpCardRaw(
    img,
    normalizedCorners,
    options.widthPx,
    options.heightPx,
    options.widthMm,
    options.heightMm,
    options.trimMm,
    options.rotation
  );

  applyEnhancementsToCanvas(canvas, options);
  const pxPerMm = options.widthPx / Math.max(10, options.widthMm);
  applyRoundedWhiteMask(canvas, options.cornerRadiusMm * pxPerMm);
  return canvas;
}
