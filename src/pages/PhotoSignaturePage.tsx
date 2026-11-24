import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Download,
  Move,
  RotateCcw,
  RotateCw,
  Upload,
  ZoomIn,
} from 'lucide-react';
import {
  PHOTO_SIGNATURE_PRESETS,
  PhotoSignaturePreset,
} from '../config/photoPresetsConfig';
import { downloadBlob, loadImageFromFile } from '../utils/download';
import {
  CompressTargetResult,
  compressCanvasToKbRange,
} from '../utils/imageExportUtils';
import {
  WatermarkSettings,
  applyDiagonalWatermarkToCanvas,
  createDefaultWatermarkSettings,
  getFormattedTodayDate,
} from '../utils/canvasOverlays';
import { WatermarkControls } from '../components/WatermarkControls';
import { PrivacyNote } from '../components/PrivacyNote';

interface PhotoSignaturePageProps {
  onBack: () => void;
}

export const PhotoSignaturePage: React.FC<PhotoSignaturePageProps> = ({ onBack }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const beforeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const afterCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    origPanX: number;
    origPanY: number;
  } | null>(null);

  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceImg, setSourceImg] = useState<HTMLImageElement | null>(null);

  const [presetId, setPresetId] = useState<string>(PHOTO_SIGNATURE_PRESETS[0].id);
  const activePreset: PhotoSignaturePreset = useMemo(
    () =>
      PHOTO_SIGNATURE_PRESETS.find((p) => p.id === presetId) ||
      PHOTO_SIGNATURE_PRESETS[0],
    [presetId]
  );

  // Editable preset values (seeded from selected preset)
  const [targetW, setTargetW] = useState(activePreset.widthPx);
  const [targetH, setTargetH] = useState(activePreset.heightPx);
  const [minKB, setMinKB] = useState(activePreset.minKB);
  const [maxKB, setMaxKB] = useState(activePreset.maxKB);
  const [format, setFormat] = useState<'jpeg' | 'png'>(activePreset.format);

  // Draggable & Zoomable locked-ratio crop frame transform
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0); // pixels in viewport space normalized
  const [panY, setPanY] = useState(0);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);

  // Styling & exam options
  const [fillWhiteBg, setFillWhiteBg] = useState(true);
  const [showNameDateStrip, setShowNameDateStrip] = useState(false);
  const [stripName, setStripName] = useState('');
  const [stripDate, setStripDate] = useState(() => getFormattedTodayDate());
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(1);
  const [splitPercent, setSplitPercent] = useState(50);
  const [watermark, setWatermark] = useState<WatermarkSettings>(() =>
    createDefaultWatermarkSettings()
  );

  const [liveResult, setLiveResult] = useState<CompressTargetResult | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    setTargetW(activePreset.widthPx);
    setTargetH(activePreset.heightPx);
    setMinKB(activePreset.minKB);
    setMaxKB(activePreset.maxKB);
    setFormat(activePreset.format);
    if (activePreset.category === 'signature') {
      setShowNameDateStrip(false);
    }
  }, [activePreset]);

  const handleFile = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (!f.type.startsWith('image/')) return;
    const img = await loadImageFromFile(f);
    setSourceFile(f);
    setSourceImg(img);
    setZoom(1);
    setPanX(0);
    setPanY(0);
    setRotation(0);
    setStatusMsg(null);
  };

  /**
   * Renders the cropped locked-ratio canvas.
   * When withEnhancements is false, renders raw crop (for "Before" split comparison).
   */
  const renderOutputCanvas = (withEnhancements: boolean): HTMLCanvasElement | null => {
    if (!sourceImg) return null;
    const w = Math.max(32, Math.round(targetW));
    const h = Math.max(32, Math.round(targetH));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (fillWhiteBg || format === 'jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
    }

    const stripH =
      withEnhancements && showNameDateStrip ? Math.max(22, Math.round(h * 0.17)) : 0;
    const imgBoxH = Math.max(16, h - stripH);

    // Base cover scale fitted into locked (w x imgBoxH) area
    const rotSwap = rotation === 90 || rotation === 270;
    const effW = rotSwap ? sourceImg.naturalHeight : sourceImg.naturalWidth;
    const effH = rotSwap ? sourceImg.naturalWidth : sourceImg.naturalHeight;

    const baseScale = Math.max(w / effW, imgBoxH / effH) * zoom;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, imgBoxH);
    ctx.clip();

    if (withEnhancements && (brightness !== 0 || contrast !== 1)) {
      const bPct = Math.round(100 + brightness * 1.4);
      const cPct = Math.round(contrast * 100);
      ctx.filter = `brightness(${bPct}%) contrast(${cPct}%)`;
    }

    ctx.translate(w / 2 + panX * w, imgBoxH / 2 + panY * imgBoxH);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const dw = sourceImg.naturalWidth * baseScale;
    const dh = sourceImg.naturalHeight * baseScale;
    ctx.drawImage(sourceImg, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();

    if (withEnhancements && showNameDateStrip && stripH > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, imgBoxH, w, stripH);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = Math.max(1, Math.round(w / 240));
      ctx.beginPath();
      ctx.moveTo(0, imgBoxH);
      ctx.lineTo(w, imgBoxH);
      ctx.stroke();

      const line1 = stripName.trim() || 'APPLICANT NAME';
      const line2 = stripDate.trim() ? `DOP: ${stripDate.trim()}` : '';
      const hasTwoLines = line1.length > 0 && line2.length > 0;

      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const fontSize = Math.max(
        7,
        Math.round(stripH * (hasTwoLines ? 0.34 : 0.44))
      );
      ctx.font = `700 ${fontSize}px "Hind Siliguri", sans-serif`;

      if (hasTwoLines) {
        ctx.fillText(line1.toUpperCase(), w / 2, imgBoxH + stripH * 0.33, w - 8);
        ctx.font = `600 ${Math.max(6, Math.round(fontSize * 0.9))}px "Hind Siliguri", sans-serif`;
        ctx.fillText(line2, w / 2, imgBoxH + stripH * 0.72, w - 8);
      } else {
        ctx.fillText(line1.toUpperCase() || line2, w / 2, imgBoxH + stripH * 0.5, w - 8);
      }
    }

    if (withEnhancements) {
      applyDiagonalWatermarkToCanvas(canvas, watermark);
    }

    return canvas;
  };

  // Update Before / After live preview & real-time target KB compression
  useEffect(() => {
    if (!sourceImg) return;
    let cancelled = false;

    const timer = setTimeout(async () => {
      const before = renderOutputCanvas(false);
      const after = renderOutputCanvas(true);
      if (!before || !after || cancelled) return;

      if (beforeCanvasRef.current) {
        const bc = beforeCanvasRef.current;
        bc.width = before.width;
        bc.height = before.height;
        bc.getContext('2d')?.drawImage(before, 0, 0);
      }

      if (afterCanvasRef.current) {
        const ac = afterCanvasRef.current;
        ac.width = after.width;
        ac.height = after.height;
        ac.getContext('2d')?.drawImage(after, 0, 0);
      }

      const res = await compressCanvasToKbRange(after, {
        format,
        minKB,
        maxKB,
      });
      if (!cancelled) setLiveResult(res);
    }, 60);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sourceImg,
    targetW,
    targetH,
    minKB,
    maxKB,
    format,
    zoom,
    panX,
    panY,
    rotation,
    fillWhiteBg,
    showNameDateStrip,
    stripName,
    stripDate,
    brightness,
    contrast,
    watermark,
  ]);

  const handleDownload = async () => {
    const after = renderOutputCanvas(true);
    if (!after) return;
    const res = await compressCanvasToKbRange(after, { format, minKB, maxKB });
    setLiveResult(res);
    const ext = format === 'png' ? 'png' : 'jpg';
    const base = sourceFile?.name.replace(/\.[^.]+$/, '') || 'kaajer-photo';
    downloadBlob(res.blob, `${base}-${res.finalW}x${res.finalH}-${Math.round(res.finalKB)}kb.${ext}`);
    setStatusMsg(`Downloaded ${res.finalW}×${res.finalH} px (${res.finalKB} KB)`);
  };

  // Interactive draggable locked-ratio crop frame handlers
  const handleViewportPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!sourceImg) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origPanX: panX,
      origPanY: panY,
    };
  };

  const handleViewportPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = (e.clientX - dragStateRef.current.startX) / Math.max(100, rect.width);
    const dy = (e.clientY - dragStateRef.current.startY) / Math.max(100, rect.height);
    setPanX(Math.min(0.85, Math.max(-0.85, dragStateRef.current.origPanX + dx)));
    setPanY(Math.min(0.85, Math.max(-0.85, dragStateRef.current.origPanY + dy)));
  };

  const handleViewportPointerUp = () => {
    dragStateRef.current = null;
  };

  const lockedAspect = `${Math.max(16, targetW)} / ${Math.max(16, targetH)}`;

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

      {/* Banner */}
      <section
        className="rounded-[22px] p-6 sm:p-8 text-white"
        style={{ background: 'linear-gradient(120deg, #0f2a5c, #b02a6e 55%, #f57c00)' }}
      >
        <h1 className="text-2xl sm:text-3xl font-bold m-0 mb-1.5">
          📷 ফটো ও সিগনেচার সাইজ টুল / Photo + Signature Size Tool
        </h1>
        <p className="text-sm sm:text-base text-white/95 m-0">
          চাকরি ও পরীক্ষার ফর্মের জন্য নির্দিষ্ট Pixel এবং KB সাইজে ফটো ও স্বাক্ষর ক্রপ এবং অটো-কম্প্রেস করুন।
        </p>
      </section>

      {/* Upload + Presets */}
      <section className="bg-[var(--card)] border border-[var(--bd)] rounded-[22px] p-5 sm:p-6 space-y-5">
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFile(e.dataTransfer.files);
          }}
          className="border-2 border-dashed border-slate-400/70 hover:border-[#f57c00] hover:bg-[#f57c00]/5 rounded-[16px] py-7 px-4 text-center cursor-pointer transition-colors"
        >
          <Upload className="w-8 h-8 mx-auto mb-2 text-[#f57c00]" />
          <div className="font-bold text-base">
            {sourceFile
              ? `Loaded: ${sourceFile.name} (${sourceImg?.naturalWidth}×${sourceImg?.naturalHeight}px)`
              : 'ফটো বা সিগনেচার দিন / Upload Photo or Signature'}
          </div>
          <div className="text-xs text-[var(--mut)] mt-1">
            JPG, PNG, WebP supported • Drag &amp; drop or tap to browse
          </div>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            accept="image/*"
            onChange={(e) => handleFile(e.target.files)}
          />
        </div>

        {/* Presets Config Array Grid */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-sm font-bold">
              1. Pick a Preset (উদাহরণ প্রিসেট বেছে নিন)
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {PHOTO_SIGNATURE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPresetId(p.id)}
                className={`p-3 rounded-[12px] text-left cursor-pointer border transition-colors ${
                  presetId === p.id
                    ? 'bg-[#0f2a5c] text-white border-[#0f2a5c] dark:bg-[#f57c00] dark:border-[#f57c00]'
                    : 'bg-[var(--bg)] border-[var(--bd)] hover:border-[#f57c00]'
                }`}
              >
                <div className="text-xs sm:text-sm font-bold leading-snug">{p.name}</div>
                <div
                  className={`text-[11px] mt-0.5 ${
                    presetId === p.id ? 'text-white/85' : 'text-[var(--mut)]'
                  }`}
                >
                  {p.bnName}
                </div>
              </button>
            ))}
          </div>

          <div className="rounded-[12px] px-3.5 py-2.5 text-xs bg-amber-500/12 text-amber-900 dark:text-amber-200 border border-amber-500/35">
            ⚠️ <strong>Important Note:</strong> All preset dimensions and KB ranges shown above are{' '}
            <strong>editable examples</strong>. Please check the official notification of your exam or
            application form before submitting.
          </div>
        </div>

        {/* Editable Dimensions & KB Range */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-[var(--bg)] border border-[var(--bd)] rounded-[14px] p-3.5">
          <div>
            <label className="block text-[11px] font-bold mb-1">Width (px)</label>
            <input
              type="number"
              min={40}
              max={2000}
              value={targetW}
              onChange={(e) => setTargetW(Math.max(40, Number(e.target.value)))}
              className="w-full px-2.5 py-2 rounded-lg border border-[var(--bd)] bg-[var(--card)] text-sm tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold mb-1">Height (px)</label>
            <input
              type="number"
              min={30}
              max={2000}
              value={targetH}
              onChange={(e) => setTargetH(Math.max(30, Number(e.target.value)))}
              className="w-full px-2.5 py-2 rounded-lg border border-[var(--bd)] bg-[var(--card)] text-sm tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold mb-1">Min Size (KB)</label>
            <input
              type="number"
              min={1}
              max={2000}
              value={minKB}
              onChange={(e) => setMinKB(Math.max(1, Number(e.target.value)))}
              className="w-full px-2.5 py-2 rounded-lg border border-[var(--bd)] bg-[var(--card)] text-sm tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold mb-1">Max Size (KB)</label>
            <input
              type="number"
              min={5}
              max={5000}
              value={maxKB}
              onChange={(e) => setMaxKB(Math.max(minKB, Number(e.target.value)))}
              className="w-full px-2.5 py-2 rounded-lg border border-[var(--bd)] bg-[var(--card)] text-sm tabular-nums"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[11px] font-bold mb-1">Format</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as 'jpeg' | 'png')}
              className="w-full px-2.5 py-2 rounded-lg border border-[var(--bd)] bg-[var(--card)] text-sm font-semibold"
            >
              <option value="jpeg">JPG</option>
              <option value="png">PNG</option>
            </select>
          </div>
        </div>

        {/* Interactive Workspace when Image is Loaded */}
        {sourceImg && (
          <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 items-start">
            {/* RIGHT ON DESKTOP / TOP STICKY ON MOBILE: Live Draggable Frame + Before/After */}
            <div className="w-full order-1 lg:order-2 lg:col-span-7 sticky top-[54px] z-20 lg:static bg-[var(--bg)] border border-[var(--bd)] rounded-[18px] p-4 space-y-3 shadow-md lg:shadow-none">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-[#0f2a5c] dark:text-[#ffb347] flex items-center gap-1.5">
                  <Move className="w-3.5 h-3.5" />
                  Drag inside frame to position (Locked {targetW}:{targetH})
                </div>

                {liveResult && (
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold tabular-nums inline-flex items-center gap-1 ${
                      liveResult.inRange
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40'
                        : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/40'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Final: {liveResult.finalKB} KB ({liveResult.finalW}×{liveResult.finalH}px)
                  </span>
                )}
              </div>

              {/* Draggable Locked-Ratio Frame with Before/After Split */}
              <div className="flex justify-center">
                <div
                  onPointerDown={handleViewportPointerDown}
                  onPointerMove={handleViewportPointerMove}
                  onPointerUp={handleViewportPointerUp}
                  onPointerCancel={handleViewportPointerUp}
                  style={{ aspectRatio: lockedAspect }}
                  className="relative w-full max-w-[360px] max-h-[340px] rounded-[12px] overflow-hidden border-2 border-[#f57c00] bg-white shadow-md select-none touch-none cursor-grab active:cursor-grabbing"
                >
                  <canvas
                    ref={afterCanvasRef}
                    className="w-full h-full object-contain block pointer-events-none"
                  />
                  <div
                    style={{ clipPath: `inset(0 ${100 - splitPercent}% 0 0)` }}
                    className="absolute inset-0 pointer-events-none"
                  >
                    <canvas
                      ref={beforeCanvasRef}
                      className="w-full h-full object-contain block"
                    />
                  </div>

                  {/* Rule-of-thirds crop guide */}
                  <div className="absolute inset-0 pointer-events-none border border-white/30">
                    <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/25" />
                    <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/25" />
                    <div className="absolute top-1/3 left-0 right-0 h-px bg-white/25" />
                    <div className="absolute top-2/3 left-0 right-0 h-px bg-white/25" />
                  </div>

                  <div
                    style={{ left: `${splitPercent}%` }}
                    className="absolute top-0 bottom-0 w-0.5 bg-[#f57c00] pointer-events-none"
                  />

                  <span className="absolute top-1.5 left-1.5 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded pointer-events-none">
                    Before
                  </span>
                  <span className="absolute top-1.5 right-1.5 bg-[#0f2a5c]/85 text-white text-[10px] font-bold px-1.5 py-0.5 rounded pointer-events-none">
                    After
                  </span>
                </div>
              </div>

              {/* Before/After Split Control */}
              <div className="flex items-center gap-3 max-w-[380px] mx-auto">
                <span className="text-[11px] font-bold text-[var(--mut)] shrink-0">
                  Before / After
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={splitPercent}
                  onChange={(e) => setSplitPercent(Number(e.target.value))}
                  className="w-full accent-[#f57c00]"
                />
                <span className="text-[11px] font-bold tabular-nums w-8 text-right">
                  {splitPercent}%
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setRotation((r) => ((r + 90) % 360) as 0 | 90 | 180 | 270)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-xs font-bold border border-[var(--bd)] bg-[var(--card)] cursor-pointer hover:border-[#f57c00]"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Rotate 90°
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setPanX(0);
                    setPanY(0);
                    setRotation(0);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-xs font-bold border border-[var(--bd)] bg-[var(--card)] cursor-pointer hover:border-[#f57c00]"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Frame
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-sm font-bold bg-[#f57c00] hover:bg-[#e06d00] text-white cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Download {format.toUpperCase()}
                </button>
              </div>

              {statusMsg && (
                <div className="text-center text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  ✓ {statusMsg}
                </div>
              )}
            </div>

            {/* LEFT ON DESKTOP: Sticky Controls */}
            <div className="w-full order-2 lg:order-1 lg:col-span-5 space-y-4">
              {/* Zoom + Brightness + Contrast */}
              <div className="rounded-[16px] border border-[var(--bd)] bg-[var(--bg)] p-4 space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-bold flex items-center gap-1">
                      <ZoomIn className="w-3.5 h-3.5 text-[#f57c00]" />
                      Zoom Frame{' '}
                      <span className="text-[#f57c00] tabular-nums">{zoom.toFixed(2)}×</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setZoom(1)}
                      className="text-[11px] font-semibold text-[var(--mut)] hover:text-[#f57c00] cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={3.5}
                    step={0.05}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="w-full accent-[#f57c00]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-bold">
                      Brightness{' '}
                      <span className="text-[#f57c00] tabular-nums">
                        {brightness > 0 ? `+${brightness}` : brightness}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setBrightness(0)}
                      className="text-[11px] font-semibold text-[var(--mut)] hover:text-[#f57c00] cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                  <input
                    type="range"
                    min={-40}
                    max={40}
                    step={1}
                    value={brightness}
                    onChange={(e) => setBrightness(Number(e.target.value))}
                    className="w-full accent-[#f57c00]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-bold">
                      Contrast{' '}
                      <span className="text-[#f57c00] tabular-nums">
                        {contrast.toFixed(2)}×
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setContrast(1)}
                      className="text-[11px] font-semibold text-[var(--mut)] hover:text-[#f57c00] cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                  <input
                    type="range"
                    min={0.8}
                    max={1.5}
                    step={0.02}
                    value={contrast}
                    onChange={(e) => setContrast(Number(e.target.value))}
                    className="w-full accent-[#f57c00]"
                  />
                </div>

                <label className="inline-flex items-center gap-2 text-sm font-semibold cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={fillWhiteBg}
                    onChange={(e) => setFillWhiteBg(e.target.checked)}
                    className="w-4 h-4 accent-[#f57c00]"
                  />
                  White background fill (সাদা ব্যাকগ্রাউন্ড)
                </label>
              </div>

              {/* Exam Name & Date Strip */}
              <div className="rounded-[16px] border border-[var(--bd)] bg-[var(--bg)] p-4 space-y-3">
                <label className="inline-flex items-center gap-2 text-sm font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showNameDateStrip}
                    onChange={(e) => setShowNameDateStrip(e.target.checked)}
                    className="w-4 h-4 accent-[#f57c00]"
                  />
                  Add Name &amp; Date strip below photo (পরীক্ষার ফর্মের জন্য)
                </label>

                {showNameDateStrip && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold mb-1">
                        Candidate Name
                      </label>
                      <input
                        type="text"
                        value={stripName}
                        onChange={(e) => setStripName(e.target.value)}
                        placeholder="e.g. ARIJIT DAS"
                        className="w-full px-3 py-2 rounded-lg border border-[var(--bd)] bg-[var(--card)] text-sm"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold">Date of Photo</label>
                        <button
                          type="button"
                          onClick={() => setStripDate(getFormattedTodayDate())}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-[#f57c00] cursor-pointer"
                        >
                          <Calendar className="w-3 h-3" />
                          Today
                        </button>
                      </div>
                      <input
                        type="text"
                        value={stripDate}
                        onChange={(e) => setStripDate(e.target.value)}
                        placeholder="24-11-2026"
                        className="w-full px-3 py-2 rounded-lg border border-[var(--bd)] bg-[var(--card)] text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Copy-protection Watermark Controls */}
              <WatermarkControls value={watermark} onChange={setWatermark} />
            </div>
          </div>
        )}

        <PrivacyNote />
      </section>
    </div>
  );
};
