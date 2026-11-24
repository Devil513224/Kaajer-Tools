export type WatermarkColor = 'grey' | 'red' | 'blue';
export type WatermarkDensity = 'low' | 'medium' | 'high';

export interface WatermarkSettings {
  enabled: boolean;
  text: string;
  opacity: number; // 5 to 60 (percent)
  size: number; // 10 to 42
  color: WatermarkColor;
  density: WatermarkDensity;
  angleDeg: number; // 30 to 45
}

export type MaskStyle = 'black' | 'white' | 'blur' | 'pixelate';

export interface MaskRegion {
  id: string;
  x: number; // normalized [0..1]
  y: number;
  w: number;
  h: number;
}

export function getFormattedTodayDate(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export function createDefaultWatermarkSettings(): WatermarkSettings {
  return {
    enabled: false,
    text: `Only for Bank KYC, ${getFormattedTodayDate()}`,
    opacity: 22,
    size: 18,
    color: 'grey',
    density: 'medium',
    angleDeg: 36,
  };
}

/**
 * Destructively burns manual mask rectangles directly onto the canvas pixels
 * so the hidden area cannot be recovered from the exported image or PDF.
 */
export function applyMaskRegionsToCanvas(
  canvas: HTMLCanvasElement,
  regions: MaskRegion[],
  style: MaskStyle
): void {
  if (!regions || regions.length === 0) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  for (const r of regions) {
    const rx = Math.max(0, Math.round(r.x * w));
    const ry = Math.max(0, Math.round(r.y * h));
    const rw = Math.max(2, Math.min(w - rx, Math.round(r.w * w)));
    const rh = Math.max(2, Math.min(h - ry, Math.round(r.h * h)));
    if (rw <= 0 || rh <= 0) continue;

    if (style === 'black') {
      ctx.fillStyle = '#000000';
      ctx.fillRect(rx, ry, rw, rh);
    } else if (style === 'white') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(rx, ry, rw, rh);
    } else if (style === 'pixelate') {
      const imgData = ctx.getImageData(rx, ry, rw, rh);
      const px = imgData.data;
      const block = Math.max(6, Math.round(Math.min(w, h) / 28));

      for (let by = 0; by < rh; by += block) {
        for (let bx = 0; bx < rw; bx += block) {
          let sumR = 0;
          let sumG = 0;
          let sumB = 0;
          let count = 0;
          const bw = Math.min(block, rw - bx);
          const bh = Math.min(block, rh - by);

          for (let py = 0; py < bh; py++) {
            for (let pxIdx = 0; pxIdx < bw; pxIdx++) {
              const i = ((by + py) * rw + (bx + pxIdx)) * 4;
              sumR += px[i];
              sumG += px[i + 1];
              sumB += px[i + 2];
              count++;
            }
          }

          const avgR = Math.round(sumR / Math.max(1, count));
          const avgG = Math.round(sumG / Math.max(1, count));
          const avgB = Math.round(sumB / Math.max(1, count));

          for (let py = 0; py < bh; py++) {
            for (let pxIdx = 0; pxIdx < bw; pxIdx++) {
              const i = ((by + py) * rw + (bx + pxIdx)) * 4;
              px[i] = avgR;
              px[i + 1] = avgG;
              px[i + 2] = avgB;
              px[i + 3] = 255;
            }
          }
        }
      }
      ctx.putImageData(imgData, rx, ry);
    } else if (style === 'blur') {
      // Strong non-recoverable mosaic + box smooth directly into target pixels
      const imgData = ctx.getImageData(rx, ry, rw, rh);
      const px = imgData.data;
      const rad = Math.max(6, Math.round(Math.min(w, h) / 36));
      const tmp = new Uint8ClampedArray(px.length);

      for (let pass = 0; pass < 2; pass++) {
        for (let py = 0; py < rh; py++) {
          for (let pxx = 0; pxx < rw; pxx++) {
            let sr = 0, sg = 0, sb = 0, cnt = 0;
            const x0 = Math.max(0, pxx - rad);
            const x1 = Math.min(rw - 1, pxx + rad);
            for (let kx = x0; kx <= x1; kx += 2) {
              const i = (py * rw + kx) * 4;
              sr += px[i];
              sg += px[i + 1];
              sb += px[i + 2];
              cnt++;
            }
            const o = (py * rw + pxx) * 4;
            tmp[o] = sr / cnt;
            tmp[o + 1] = sg / cnt;
            tmp[o + 2] = sb / cnt;
            tmp[o + 3] = 255;
          }
        }
        for (let py = 0; py < rh; py++) {
          for (let pxx = 0; pxx < rw; pxx++) {
            let sr = 0, sg = 0, sb = 0, cnt = 0;
            const y0 = Math.max(0, py - rad);
            const y1 = Math.min(rh - 1, py + rad);
            for (let ky = y0; ky <= y1; ky += 2) {
              const i = (ky * rw + pxx) * 4;
              sr += tmp[i];
              sg += tmp[i + 1];
              sb += tmp[i + 2];
              cnt++;
            }
            const o = (py * rw + pxx) * 4;
            px[o] = sr / cnt;
            px[o + 1] = sg / cnt;
            px[o + 2] = sb / cnt;
            px[o + 3] = 255;
          }
        }
      }
      ctx.putImageData(imgData, rx, ry);
    }
  }
}

/**
 * Draws a tiled diagonal copy-protection watermark across the entire canvas.
 */
export function applyDiagonalWatermarkToCanvas(
  canvas: HTMLCanvasElement,
  wm: WatermarkSettings
): void {
  if (!wm.enabled) return;
  const label = wm.text.trim();
  if (!label) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const minDim = Math.min(w, h);

  // Scale font cleanly regardless of whether canvas is 500px preview or 1011px / 2022px export
  const fontPx = Math.max(9, Math.round((wm.size / 420) * minDim * 1.15));

  const colorMap: Record<WatermarkColor, string> = {
    grey: '51, 65, 85',
    red: '211, 47, 47',
    blue: '15, 42, 92',
  };

  const rgb = colorMap[wm.color] || colorMap.grey;
  const alpha = Math.max(0.05, Math.min(0.6, wm.opacity / 100));

  ctx.save();
  ctx.font = `700 ${fontPx}px "Hind Siliguri", sans-serif`;
  ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  const metrics = ctx.measureText(label);
  const textW = Math.max(fontPx * 2, metrics.width);

  const densityMult = wm.density === 'high' ? 0.72 : wm.density === 'low' ? 1.45 : 1.05;
  const stepX = Math.max(fontPx * 2.5, (textW + fontPx * 2.2) * densityMult);
  const stepY = Math.max(fontPx * 1.9, fontPx * 3.4 * densityMult);

  const angleRad = (-Math.max(30, Math.min(45, wm.angleDeg)) * Math.PI) / 180;
  const diag = Math.hypot(w, h) * 1.25;

  ctx.translate(w / 2, h / 2);
  ctx.rotate(angleRad);

  let rowIdx = 0;
  for (let y = -diag; y <= diag; y += stepY) {
    const stagger = (rowIdx % 2) * (stepX * 0.5);
    for (let x = -diag - stagger; x <= diag; x += stepX) {
      ctx.fillText(label, x, y);
    }
    rowIdx++;
  }

  ctx.restore();
}
