import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, Printer, Upload } from 'lucide-react';
import { downloadBlob, downloadBytes, loadImageFromFile } from '../utils/download';
import { canvasToA4Pdf } from '../utils/pdfUtils';
import { PrivacyNote } from '../components/PrivacyNote';

interface PassportPhotoPageProps {
  onBack: () => void;
}

type PhotoSizePreset = '35x45' | '2x2in' | '35x35';

const PHOTO_PRESETS: Record<PhotoSizePreset, { label: string; wMm: number; hMm: number }> = {
  '35x45': { label: '35 × 45 mm (India / BD Standard)', wMm: 35, hMm: 45 },
  '2x2in': { label: '51 × 51 mm (2 × 2 inch US)', wMm: 50.8, hMm: 50.8 },
  '35x35': { label: '35 × 35 mm (Square Visa)', wMm: 35, hMm: 35 },
};

export const PassportPhotoPage: React.FC<PassportPhotoPageProps> = ({ onBack }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [photoImg, setPhotoImg] = useState<HTMLImageElement | null>(null);
  const [preset, setPreset] = useState<PhotoSizePreset>('35x45');
  const [copies, setCopies] = useState(12);
  const [zoom, setZoom] = useState(1);
  const [offsetY, setOffsetY] = useState(0);
  const [bgFill, setBgFill] = useState('#ffffff');
  const [showBorder, setShowBorder] = useState(true);
  const [showCutLines, setShowCutLines] = useState(true);
  const [gapMm, setGapMm] = useState(4);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (!f.type.startsWith('image/')) return;
    const img = await loadImageFromFile(f);
    setPhotoImg(img);
    setZoom(1);
    setOffsetY(0);
  };

  /**
   * Renders full print-ready A4 sheet (210x297mm) at given DPI (e.g. 300 DPI -> 2480x3508px).
   */
  const drawA4Sheet = (canvas: HTMLCanvasElement, dpi = 300) => {
    const mmToPx = dpi / 25.4;
    const sheetW = Math.round(210 * mmToPx);
    const sheetH = Math.round(297 * mmToPx);
    canvas.width = sheetW;
    canvas.height = sheetH;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, sheetW, sheetH);

    const spec = PHOTO_PRESETS[preset];
    const pW = spec.wMm * mmToPx;
    const pH = spec.hMm * mmToPx;
    const gap = gapMm * mmToPx;
    const margin = 10 * mmToPx;

    const cols = Math.max(1, Math.floor((sheetW - margin * 2 + gap) / (pW + gap)));
    const gridW = cols * pW + (cols - 1) * gap;
    const startX = (sheetW - gridW) / 2;
    const startY = margin + 4 * mmToPx;

    for (let i = 0; i < copies; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (pW + gap);
      const y = startY + row * (pH + gap);

      if (y + pH > sheetH - margin) break;

      // Background
      ctx.fillStyle = bgFill;
      ctx.fillRect(x, y, pW, pH);

      if (photoImg) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, pW, pH);
        ctx.clip();

        const coverScale = Math.max(pW / photoImg.naturalWidth, pH / photoImg.naturalHeight) * zoom;
        const dw = photoImg.naturalWidth * coverScale;
        const dh = photoImg.naturalHeight * coverScale;
        const dx = x + (pW - dw) / 2;
        const dy = y + (pH - dh) / 2 + (offsetY / 100) * pH;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(photoImg, dx, dy, dw, dh);
        ctx.restore();
      } else {
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(x, y, pW, pH);
        ctx.fillStyle = '#64748b';
        ctx.font = `600 ${Math.round(11 * mmToPx * 0.25)}px "Hind Siliguri", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Photo', x + pW / 2, y + pH / 2);
      }

      if (showBorder) {
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = Math.max(1, dpi / 150);
        ctx.strokeRect(x, y, pW, pH);
      }

      if (showCutLines) {
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = Math.max(1, dpi / 200);
        ctx.strokeRect(x - gap * 0.25, y - gap * 0.25, pW + gap * 0.5, pH + gap * 0.5);
        ctx.restore();
      }
    }
  };

  useEffect(() => {
    if (!previewCanvasRef.current) return;
    drawA4Sheet(previewCanvasRef.current, 96);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoImg, preset, copies, zoom, offsetY, bgFill, showBorder, showCutLines, gapMm]);

  const exportSheetPdf = async () => {
    const hiRes = document.createElement('canvas');
    drawA4Sheet(hiRes, 300);
    const pdfBytes = await canvasToA4Pdf(hiRes);
    downloadBytes(pdfBytes, `kaajer-passport-${copies}copies-a4.pdf`);
  };

  const exportSheetPng = () => {
    const hiRes = document.createElement('canvas');
    drawA4Sheet(hiRes, 300);
    hiRes.toBlob((blob) => {
      if (blob) downloadBlob(blob, `kaajer-passport-${copies}copies-a4.png`);
    }, 'image/png');
  };

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-[var(--card)] border border-[var(--bd)] text-[var(--tx)] text-sm font-semibold hover:border-[#f57c00] cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </button>

      <section
        className="rounded-[22px] p-6 sm:p-8 text-white"
        style={{ background: 'linear-gradient(120deg, #b02a6e, #f57c00)' }}
      >
        <h1 className="text-2xl sm:text-3xl font-bold m-0 mb-1">
          🪪 পাসপোর্ট ফটো মেকার / Passport Photo Maker (A4 Sheet)
        </h1>
        <p className="text-sm sm:text-base text-white/95 m-0">
          একটি ছবি থেকে প্রিন্ট-রেডি A4 শিটে একাধিক পাসপোর্ট ফটো তৈরি করুন (300 DPI PDF &amp; PNG)।
        </p>
      </section>

      <section className="bg-[var(--card)] border border-[var(--bd)] rounded-[22px] p-5 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Controls */}
          <div className="lg:col-span-5 space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-400/70 hover:border-[#f57c00] rounded-[16px] py-6 px-4 text-center cursor-pointer"
            >
              <Upload className="w-7 h-7 mx-auto mb-1.5 text-[#f57c00]" />
              <div className="font-bold text-sm">
                {photoImg ? 'Change Portrait Photo' : 'Upload Portrait Photo'}
              </div>
              <div className="text-xs text-[var(--mut)]">JPG / PNG supported</div>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept="image/*"
                onChange={(e) => handleUpload(e.target.files)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">Photo Size Standard</label>
              <select
                value={preset}
                onChange={(e) => setPreset(e.target.value as PhotoSizePreset)}
                className="w-full px-3 py-2.5 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
              >
                {Object.entries(PHOTO_PRESETS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1.5">Number of Copies on A4</label>
              <div className="flex flex-wrap gap-1.5">
                {[4, 6, 8, 12, 16, 20, 24, 30].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCopies(c)}
                    className={`px-3 py-1.5 rounded-[8px] text-xs font-bold tabular-nums cursor-pointer ${
                      copies === c
                        ? 'bg-[#f57c00] text-white'
                        : 'bg-[var(--bg)] border border-[var(--bd)]'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">Zoom ({zoom.toFixed(2)}×)</label>
                <input
                  type="range"
                  min={0.8}
                  max={2}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full accent-[#f57c00]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Vertical Shift ({offsetY}%)</label>
                <input
                  type="range"
                  min={-30}
                  max={30}
                  value={offsetY}
                  onChange={(e) => setOffsetY(Number(e.target.value))}
                  className="w-full accent-[#f57c00]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">Spacing ({gapMm} mm)</label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={gapMm}
                  onChange={(e) => setGapMm(Number(e.target.value))}
                  className="w-full accent-[#f57c00]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Background Fill</label>
                <input
                  type="color"
                  value={bgFill}
                  onChange={(e) => setBgFill(e.target.value)}
                  className="w-14 h-9 rounded border border-[var(--bd)] cursor-pointer"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showBorder}
                  onChange={(e) => setShowBorder(e.target.checked)}
                  className="accent-[#f57c00]"
                />
                Photo Border
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCutLines}
                  onChange={(e) => setShowCutLines(e.target.checked)}
                  className="accent-[#f57c00]"
                />
                Cut Guidelines
              </label>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-2">
              <button
                type="button"
                onClick={exportSheetPdf}
                className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-sm font-bold bg-[#f57c00] hover:bg-[#e06d00] text-white cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Download A4 PDF (300 DPI)
              </button>
              <button
                type="button"
                onClick={exportSheetPng}
                className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-sm font-bold bg-[#0f2a5c] hover:bg-[#193d7f] text-white cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Download A4 PNG
              </button>
            </div>
          </div>

          {/* A4 Live Preview */}
          <div className="lg:col-span-7 bg-[var(--bg)] border border-[var(--bd)] rounded-[16px] p-4 flex flex-col items-center">
            <div className="text-xs font-semibold text-[var(--mut)] mb-2">
              A4 Print Sheet Live Preview (210 × 297 mm)
            </div>
            <canvas
              ref={previewCanvasRef}
              className="w-full max-w-[440px] h-auto rounded shadow-md bg-white border border-slate-300"
            />
          </div>
        </div>

        <PrivacyNote />
      </section>
    </div>
  );
};
