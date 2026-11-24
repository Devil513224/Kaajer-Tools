export interface CompressTargetResult {
  blob: Blob;
  finalKB: number;
  qualityUsed: number;
  scaleUsed: number;
  finalW: number;
  finalH: number;
  inRange: boolean;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed to encode image'))),
      mime,
      quality
    );
  });
}

function createScaledCanvas(src: HTMLCanvasElement, scale: number): HTMLCanvasElement {
  if (scale >= 0.999) return src;
  const c = document.createElement('canvas');
  c.width = Math.max(16, Math.round(src.width * scale));
  c.height = Math.max(16, Math.round(src.height * scale));
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, c.width, c.height);
  }
  return c;
}

/**
 * Compresses canvas into [minKB, maxKB] range by binary-searching JPEG quality
 * and, if still above maxKB, progressively reducing dimensions slightly.
 */
export async function compressCanvasToKbRange(
  canvas: HTMLCanvasElement,
  options: {
    format: 'jpeg' | 'png';
    minKB: number;
    maxKB: number;
  }
): Promise<CompressTargetResult> {
  const minBytes = Math.max(0, options.minKB) * 1024;
  const maxBytes = Math.max(1024, options.maxKB * 1024);

  if (options.format === 'png') {
    const scales = [1, 0.9, 0.8, 0.7, 0.6];
    let bestBlob: Blob | null = null;
    let bestScale = 1;
    for (const s of scales) {
      const scaled = createScaledCanvas(canvas, s);
      const blob = await canvasToBlob(scaled, 'image/png', 1);
      bestBlob = blob;
      bestScale = s;
      if (blob.size <= maxBytes) break;
    }
    const finalKB = Number(((bestBlob?.size || 0) / 1024).toFixed(1));
    const inRange = finalKB >= options.minKB && finalKB <= options.maxKB;
    return {
      blob: bestBlob!,
      finalKB,
      qualityUsed: 1,
      scaleUsed: bestScale,
      finalW: Math.round(canvas.width * bestScale),
      finalH: Math.round(canvas.height * bestScale),
      inRange,
    };
  }

  const scales = [1, 0.93, 0.85, 0.76, 0.66];
  let bestOverall: { blob: Blob; quality: number; scale: number; dist: number } | null = null;

  for (const s of scales) {
    const targetCanvas = createScaledCanvas(canvas, s);
    let lo = 0.08;
    let hi = 0.98;

    // Binary search JPEG quality
    for (let step = 0; step < 9; step++) {
      const mid = (lo + hi) / 2;
      const blob = await canvasToBlob(targetCanvas, 'image/jpeg', mid);
      const size = blob.size;

      // Exact hit inside [minBytes, maxBytes] -> prefer higher quality inside range
      if (size >= minBytes && size <= maxBytes) {
        if (
          !bestOverall ||
          bestOverall.dist > 0 ||
          (bestOverall.scale < s) ||
          (bestOverall.scale === s && mid > bestOverall.quality)
        ) {
          bestOverall = { blob, quality: mid, scale: s, dist: 0 };
        }
        lo = mid; // try higher quality inside valid range
      } else {
        const dist = size < minBytes ? minBytes - size : size - maxBytes;
        if (!bestOverall || dist < bestOverall.dist) {
          bestOverall = { blob, quality: mid, scale: s, dist };
        }
        if (size > maxBytes) {
          hi = mid;
        } else {
          lo = mid;
        }
      }
    }

    if (bestOverall && bestOverall.dist === 0) {
      break;
    }
    // Check highest quality at current scale before shrinking dimensions further
    if (bestOverall && bestOverall.blob.size <= maxBytes) {
      break;
    }
  }

  const chosen = bestOverall!;
  const finalKB = Number((chosen.blob.size / 1024).toFixed(1));
  const inRange = chosen.blob.size >= minBytes && chosen.blob.size <= maxBytes;

  return {
    blob: chosen.blob,
    finalKB,
    qualityUsed: chosen.quality,
    scaleUsed: chosen.scale,
    finalW: Math.round(canvas.width * chosen.scale),
    finalH: Math.round(canvas.height * chosen.scale),
    inRange,
  };
}
