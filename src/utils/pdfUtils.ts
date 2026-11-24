import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/**
 * Parses 1-indexed page ranges like "1, 3-5, 8" into sorted or ordered 0-indexed page numbers.
 */
export function parsePageRanges(
  input: string,
  totalPages: number,
  preserveOrder = false
): number[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  const result: number[] = [];
  const seen = new Set<number>();

  const parts = trimmed.split(',');
  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (!part) continue;
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map((s) => s.trim());
      const start = Number(startStr);
      const end = Number(endStr);
      if (
        Number.isInteger(start) &&
        Number.isInteger(end) &&
        start >= 1 &&
        end >= 1
      ) {
        const step = start <= end ? 1 : -1;
        for (let p = start; step > 0 ? p <= end : p >= end; p += step) {
          if (p >= 1 && p <= totalPages) {
            const idx = p - 1;
            if (preserveOrder || !seen.has(idx)) {
              result.push(idx);
              seen.add(idx);
            }
          }
        }
      }
    } else {
      const p = Number(part);
      if (Number.isInteger(p) && p >= 1 && p <= totalPages) {
        const idx = p - 1;
        if (preserveOrder || !seen.has(idx)) {
          result.push(idx);
          seen.add(idx);
        }
      }
    }
  }
  return result;
}

export async function getPdfPageCount(bytes: ArrayBuffer): Promise<number> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return doc.getPageCount();
}

export async function renderPdfThumbnails(
  bytes: ArrayBuffer,
  scale = 0.45,
  maxPages = 60
): Promise<string[]> {
  const copy = bytes.slice(0);
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(copy) });
  const pdf = await loadingTask.promise;
  const count = Math.min(pdf.numPages, maxPages);
  const thumbs: string[] = [];

  for (let i = 1; i <= count; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      thumbs.push(canvas.toDataURL('image/jpeg', 0.78));
    }
  }
  await loadingTask.destroy();
  return thumbs;
}

export async function mergePdfs(buffers: ArrayBuffer[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  for (const buf of buffers) {
    const src = await PDFDocument.load(buf, { ignoreEncryption: true });
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }
  return merged.save();
}

export async function splitPdf(
  bytes: ArrayBuffer,
  mode: 'range' | 'every-page' | 'chunk',
  rangeStr: string,
  chunkSize: number
): Promise<{ name: string; bytes: Uint8Array }[]> {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = src.getPageCount();

  if (mode === 'range') {
    const indices = parsePageRanges(rangeStr, total);
    if (indices.length === 0) {
      throw new Error('Please enter valid page numbers or ranges (e.g. 1-3, 5).');
    }
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, indices);
    pages.forEach((p) => out.addPage(p));
    return [{ name: `split-${rangeStr.replace(/\s+/g, '')}.pdf`, bytes: await out.save() }];
  }

  if (mode === 'every-page') {
    const outputs: { name: string; bytes: Uint8Array }[] = [];
    for (let i = 0; i < total; i++) {
      const out = await PDFDocument.create();
      const [page] = await out.copyPages(src, [i]);
      out.addPage(page);
      outputs.push({ name: `page-${i + 1}.pdf`, bytes: await out.save() });
    }
    return outputs;
  }

  const size = Math.max(1, chunkSize);
  const outputs: { name: string; bytes: Uint8Array }[] = [];
  for (let start = 0; start < total; start += size) {
    const end = Math.min(total, start + size);
    const idxs = Array.from({ length: end - start }, (_, k) => start + k);
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, idxs);
    pages.forEach((p) => out.addPage(p));
    outputs.push({
      name: `pages-${start + 1}-to-${end}.pdf`,
      bytes: await out.save(),
    });
  }
  return outputs;
}

export async function rotatePdf(
  bytes: ArrayBuffer,
  angle: 90 | 180 | 270,
  pageIndices: number[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pages = doc.getPages();
  const targetSet = new Set(pageIndices);
  pages.forEach((page, idx) => {
    if (targetSet.size === 0 || targetSet.has(idx)) {
      const current = page.getRotation().angle;
      page.setRotation(degrees((current + angle) % 360));
    }
  });
  return doc.save();
}

export async function deletePdfPages(
  bytes: ArrayBuffer,
  deleteIndices: number[]
): Promise<Uint8Array> {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = src.getPageCount();
  const removeSet = new Set(deleteIndices);
  const keepIndices = Array.from({ length: total }, (_, i) => i).filter(
    (i) => !removeSet.has(i)
  );
  if (keepIndices.length === 0) {
    throw new Error('Cannot delete all pages from the PDF.');
  }
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, keepIndices);
  pages.forEach((p) => out.addPage(p));
  return out.save();
}

export async function extractPdfPages(
  bytes: ArrayBuffer,
  extractIndices: number[]
): Promise<Uint8Array> {
  if (extractIndices.length === 0) {
    throw new Error('Please select at least one page to extract.');
  }
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, extractIndices);
  pages.forEach((p) => out.addPage(p));
  return out.save();
}

export async function rearrangePdfPages(
  bytes: ArrayBuffer,
  newOrderIndices: number[]
): Promise<Uint8Array> {
  if (newOrderIndices.length === 0) {
    throw new Error('Please specify a valid page order.');
  }
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, newOrderIndices);
  pages.forEach((p) => out.addPage(p));
  return out.save();
}

export async function addPageNumbersToPdf(
  bytes: ArrayBuffer,
  options: {
    position: 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right';
    startNumber: number;
    format: 'number' | 'page-n' | 'n-of-total';
    fontSize: number;
  }
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();
  const total = pages.length;

  pages.forEach((page, idx) => {
    const { width, height } = page.getSize();
    const num = options.startNumber + idx;
    const label =
      options.format === 'page-n'
        ? `Page ${num}`
        : options.format === 'n-of-total'
          ? `${num} / ${options.startNumber + total - 1}`
          : `${num}`;

    const textWidth = font.widthOfTextAtSize(label, options.fontSize);
    const margin = 24;
    let x = (width - textWidth) / 2;
    let y = margin;

    if (options.position.includes('right')) x = width - textWidth - margin;
    if (options.position.includes('left')) x = margin;
    if (options.position.startsWith('top')) y = height - margin - options.fontSize;

    page.drawText(label, {
      x,
      y,
      size: options.fontSize,
      font,
      color: rgb(0.12, 0.2, 0.35),
    });
  });

  return doc.save();
}

function hexToRgbTuple(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const n = parseInt(clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function createTextWatermarkPng(
  text: string,
  colorHex: string,
  fontSizePx: number,
  opacity: number
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject(new Error('Canvas unavailable'));
    ctx.font = `700 ${fontSizePx}px "Hind Siliguri", system-ui, sans-serif`;
    const metrics = ctx.measureText(text);
    const w = Math.max(200, Math.ceil(metrics.width + 64));
    const h = Math.max(80, Math.ceil(fontSizePx * 1.8));
    canvas.width = w;
    canvas.height = h;
    ctx.font = `700 ${fontSizePx}px "Hind Siliguri", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = opacity;
    ctx.fillStyle = colorHex;
    ctx.fillText(text, w / 2, h / 2);
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('Failed to create watermark'));
      blob.arrayBuffer().then((ab) => resolve(new Uint8Array(ab)));
    }, 'image/png');
  });
}

export async function addWatermarkToPdf(
  bytes: ArrayBuffer,
  options: {
    text: string;
    opacity: number;
    fontSize: number;
    rotation: number;
    colorHex: string;
  }
): Promise<Uint8Array> {
  const text = options.text.trim();
  if (!text) throw new Error('Please enter watermark text.');

  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pages = doc.getPages();
  const isAscii = /^[\x20-\x7E]+$/.test(text);

  if (isAscii) {
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const [r, g, b] = hexToRgbTuple(options.colorHex);
    for (const page of pages) {
      const { width, height } = page.getSize();
      const textWidth = font.widthOfTextAtSize(text, options.fontSize);
      const rad = (options.rotation * Math.PI) / 180;
      const x = width / 2 - (textWidth / 2) * Math.cos(rad);
      const y = height / 2 - (textWidth / 2) * Math.sin(rad);
      page.drawText(text, {
        x,
        y,
        size: options.fontSize,
        font,
        color: rgb(r, g, b),
        opacity: options.opacity,
        rotate: degrees(options.rotation),
      });
    }
  } else {
    await document.fonts.ready;
    const pngBytes = await createTextWatermarkPng(
      text,
      options.colorHex,
      options.fontSize * 2,
      options.opacity
    );
    const embedded = await doc.embedPng(pngBytes);
    const imgW = embedded.width / 2;
    const imgH = embedded.height / 2;
    for (const page of pages) {
      const { width, height } = page.getSize();
      const rad = (options.rotation * Math.PI) / 180;
      const cx = width / 2;
      const cy = height / 2;
      const x = cx - (imgW / 2) * Math.cos(rad) + (imgH / 2) * Math.sin(rad);
      const y = cy - (imgW / 2) * Math.sin(rad) - (imgH / 2) * Math.cos(rad);
      page.drawImage(embedded, {
        x,
        y,
        width: imgW,
        height: imgH,
        rotate: degrees(options.rotation),
      });
    }
  }

  return doc.save();
}

function fileToJpegBytes(file: File): Promise<{ bytes: Uint8Array; isPng: boolean }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas error'));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Image encode failed'));
          blob.arrayBuffer().then((ab) => resolve({ bytes: new Uint8Array(ab), isPng: false }));
        },
        'image/jpeg',
        0.92
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Unable to read image ${file.name}`));
    };
    img.src = url;
  });
}

export async function imagesToPdf(
  files: File[],
  options: {
    pageSize: 'a4' | 'letter' | 'fit';
    orientation: 'portrait' | 'landscape' | 'auto';
    marginPt: number;
  }
): Promise<Uint8Array> {
  if (files.length === 0) throw new Error('Select at least one image.');
  const doc = await PDFDocument.create();

  for (const file of files) {
    let embedded;
    if (file.type === 'image/png') {
      const ab = await file.arrayBuffer();
      embedded = await doc.embedPng(ab);
    } else if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
      const ab = await file.arrayBuffer();
      embedded = await doc.embedJpg(ab);
    } else {
      const { bytes } = await fileToJpegBytes(file);
      embedded = await doc.embedJpg(bytes);
    }

    const imgW = embedded.width;
    const imgH = embedded.height;

    if (options.pageSize === 'fit') {
      const pW = imgW + options.marginPt * 2;
      const pH = imgH + options.marginPt * 2;
      const page = doc.addPage([pW, pH]);
      page.drawImage(embedded, {
        x: options.marginPt,
        y: options.marginPt,
        width: imgW,
        height: imgH,
      });
    } else {
      const baseW = options.pageSize === 'a4' ? 595.28 : 612;
      const baseH = options.pageSize === 'a4' ? 841.89 : 792;
      const useLandscape =
        options.orientation === 'landscape' ||
        (options.orientation === 'auto' && imgW > imgH);
      const pW = useLandscape ? baseH : baseW;
      const pH = useLandscape ? baseW : baseH;
      const page = doc.addPage([pW, pH]);

      const availW = Math.max(10, pW - options.marginPt * 2);
      const availH = Math.max(10, pH - options.marginPt * 2);
      const scale = Math.min(availW / imgW, availH / imgH);
      const drawW = imgW * scale;
      const drawH = imgH * scale;
      page.drawImage(embedded, {
        x: (pW - drawW) / 2,
        y: (pH - drawH) / 2,
        width: drawW,
        height: drawH,
      });
    }
  }

  return doc.save();
}

export async function pdfToJpg(
  bytes: ArrayBuffer,
  dpi = 150,
  quality = 0.9
): Promise<{ pageNum: number; dataUrl: string; blob: Blob }[]> {
  const copy = bytes.slice(0);
  const scale = dpi / 72;
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(copy) });
  const pdf = await loadingTask.promise;
  const results: { pageNum: number; dataUrl: string; blob: Blob }[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Failed to export JPEG'))),
        'image/jpeg',
        quality
      )
    );
    results.push({ pageNum: i, dataUrl, blob });
  }
  await loadingTask.destroy();
  return results;
}

export async function compressPdf(
  bytes: ArrayBuffer,
  level: 'lossless' | 'balanced' | 'strong'
): Promise<Uint8Array> {
  if (level === 'lossless') {
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
    return out.save({ useObjectStreams: true });
  }

  const dpi = level === 'balanced' ? 120 : 88;
  const quality = level === 'balanced' ? 0.72 : 0.52;
  const rendered = await pdfToJpg(bytes, dpi, quality);
  const out = await PDFDocument.create();
  for (const pageImg of rendered) {
    const ab = await pageImg.blob.arrayBuffer();
    const embedded = await out.embedJpg(ab);
    const ptW = (embedded.width * 72) / dpi;
    const ptH = (embedded.height * 72) / dpi;
    const page = out.addPage([ptW, ptH]);
    page.drawImage(embedded, { x: 0, y: 0, width: ptW, height: ptH });
  }
  return out.save({ useObjectStreams: true });
}

export async function cropPdf(
  bytes: ArrayBuffer,
  marginsPt: { top: number; right: number; bottom: number; left: number },
  pageIndices: number[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pages = doc.getPages();
  const target = new Set(pageIndices);

  pages.forEach((page, idx) => {
    if (target.size === 0 || target.has(idx)) {
      const box = page.getCropBox();
      const newX = box.x + marginsPt.left;
      const newY = box.y + marginsPt.bottom;
      const newW = Math.max(20, box.width - marginsPt.left - marginsPt.right);
      const newH = Math.max(20, box.height - marginsPt.top - marginsPt.bottom);
      page.setCropBox(newX, newY, newW, newH);
    }
  });

  return doc.save();
}

export async function signPdf(
  bytes: ArrayBuffer,
  signaturePngDataUrl: string,
  pageNumber: number,
  position: 'bottom-right' | 'bottom-left' | 'bottom-center'
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pages = doc.getPages();
  const idx = Math.min(Math.max(0, pageNumber - 1), pages.length - 1);
  const page = pages[idx];

  const res = await fetch(signaturePngDataUrl);
  const pngBytes = await res.arrayBuffer();
  const embedded = await doc.embedPng(pngBytes);

  const { width } = page.getSize();
  const targetW = Math.min(180, width * 0.32);
  const targetH = (embedded.height / embedded.width) * targetW;
  const margin = 32;

  let x = width - targetW - margin;
  if (position === 'bottom-left') x = margin;
  if (position === 'bottom-center') x = (width - targetW) / 2;

  page.drawImage(embedded, {
    x,
    y: margin,
    width: targetW,
    height: targetH,
  });

  return doc.save();
}

export async function organizePdf(
  bytes: ArrayBuffer,
  ops: { originalIndex: number; rotation: number }[]
): Promise<Uint8Array> {
  if (ops.length === 0) throw new Error('Keep at least one page.');
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const out = await PDFDocument.create();
  for (const op of ops) {
    const [copied] = await out.copyPages(src, [op.originalIndex]);
    if (op.rotation !== 0) {
      const current = copied.getRotation().angle;
      copied.setRotation(degrees((current + op.rotation) % 360));
    }
    out.addPage(copied);
  }
  return out.save();
}

/**
 * Exports any high-DPI HTML5 canvas onto a crisp print-ready A4 PDF page.
 */
export async function canvasToA4Pdf(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const pngBlob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))),
      'image/png'
    )
  );
  const embedded = await doc.embedPng(await pngBlob.arrayBuffer());
  const a4W = 595.28;
  const a4H = 841.89;
  const page = doc.addPage([a4W, a4H]);
  page.drawImage(embedded, { x: 0, y: 0, width: a4W, height: a4H });
  return doc.save();
}

export async function canvasToCustomPdf(
  canvas: HTMLCanvasElement,
  widthPt: number,
  heightPt: number
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const pngBlob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))),
      'image/png'
    )
  );
  const embedded = await doc.embedPng(await pngBlob.arrayBuffer());
  const page = doc.addPage([widthPt, heightPt]);
  page.drawImage(embedded, { x: 0, y: 0, width: widthPt, height: heightPt });
  return doc.save();
}
