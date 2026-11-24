import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, RotateCw, Upload } from 'lucide-react';
import { ImageToolMode } from '../types/tools';
import { downloadBlob, downloadBytes, formatBytes, loadImageFromFile } from '../utils/download';
import { canvasToA4Pdf } from '../utils/pdfUtils';
import {
  WatermarkSettings,
  applyDiagonalWatermarkToCanvas,
  createDefaultWatermarkSettings,
} from '../utils/canvasOverlays';
import { WatermarkControls } from '../components/WatermarkControls';
import { PrivacyNote } from '../components/PrivacyNote';

interface ImageToolsPageProps {
  initialMode?: ImageToolMode;
  onBack: () => void;
}

const TABS: { id: ImageToolMode; label: string; bn: string }[] = [
  { id: 'resize', label: 'Resize', bn: 'রিসাইজ' },
  { id: 'compress', label: 'Compress', bn: 'কম্প্রেস' },
  { id: 'crop', label: 'Crop', bn: 'ক্রপ' },
  { id: 'convert', label: 'Convert Format', bn: 'ফরম্যাট' },
  { id: 'card-crop', label: 'ID Card Crop', bn: 'কার্ড ক্রপ' },
  { id: 'straighten', label: 'Straighten', bn: 'সোজা করুন' },
  { id: 'bg-studio', label: 'BG Studio', bn: 'ব্যাকগ্রাউন্ড' },
  { id: 'exam-photo', label: 'Exam Photo & Sign', bn: 'পরীক্ষার ফটো' },
];

export const ImageToolsPage: React.FC<ImageToolsPageProps> = ({
  initialMode = 'resize',
  onBack,
}) => {
  const [mode, setMode] = useState<ImageToolMode>(initialMode);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceImg, setSourceImg] = useState<HTMLImageElement | null>(null);
  const [origW, setOrigW] = useState(0);
  const [origH, setOrigH] = useState(0);

  // Resize
  const [targetW, setTargetW] = useState(800);
  const [targetH, setTargetH] = useState(600);
  const [lockAspect, setLockAspect] = useState(true);

  // Compress
  const [quality, setQuality] = useState(0.78);
  const [useTargetKb, setUseTargetKb] = useState(false);
  const [targetKb, setTargetKb] = useState(50);

  // Crop / Card Crop
  const [cropX, setCropX] = useState(5);
  const [cropY, setCropY] = useState(5);
  const [cropW, setCropW] = useState(90);
  const [cropH, setCropH] = useState(90);
  const [cardPreset, setCardPreset] = useState<'free' | 'id-card' | 'passport' | 'square'>('free');

  // Convert
  const [outFormat, setOutFormat] = useState<'image/jpeg' | 'image/png' | 'image/webp'>('image/jpeg');

  // Straighten
  const [angleDeg, setAngleDeg] = useState(0);
  const [baseRotate, setBaseRotate] = useState(0);
  const [scanBw, setScanBw] = useState(false);
  const [contrast, setContrast] = useState(110);

  // BG Studio
  const [bgColor, setBgColor] = useState('#ffffff');
  const [bgThreshold, setBgThreshold] = useState(32);

  // Exam photo
  const [examPreset, setExamPreset] = useState<'photo-200x230' | 'photo-300x300' | 'sign-140x60' | 'sign-300x100'>('photo-200x230');

  const [estimatedSize, setEstimatedSize] = useState<number | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [watermark, setWatermark] = useState<WatermarkSettings>(() =>
    createDefaultWatermarkSettings()
  );

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (mode === 'card-crop') {
      setCardPreset('id-card');
    } else if (mode === 'exam-photo') {
      setUseTargetKb(true);
      setTargetKb(40);
      setOutFormat('image/jpeg');
    }
  }, [mode]);

  const handleFile = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (!f.type.startsWith('image/')) return;
    const img = await loadImageFromFile(f);
    setSourceFile(f);
    setSourceImg(img);
    setOrigW(img.naturalWidth);
    setOrigH(img.naturalHeight);
    setTargetW(img.naturalWidth);
    setTargetH(img.naturalHeight);
    setCropX(5);
    setCropY(5);
    setCropW(90);
    setCropH(90);
    setAngleDeg(0);
    setBaseRotate(0);
    setStatusMsg(null);
  };

  const renderProcessedCanvas = (): HTMLCanvasElement | null => {
    const base = renderBaseCanvas();
    if (base) {
      applyDiagonalWatermarkToCanvas(base, watermark);
    }
    return base;
  };

  const renderBaseCanvas = (): HTMLCanvasElement | null => {
    if (!sourceImg) return null;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (mode === 'resize') {
      canvas.width = Math.max(1, targetW);
      canvas.height = Math.max(1, targetH);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(sourceImg, 0, 0, canvas.width, canvas.height);
      return canvas;
    }

    if (mode === 'exam-photo') {
      const dims =
        examPreset === 'photo-200x230'
          ? [200, 230]
          : examPreset === 'photo-300x300'
            ? [300, 300]
            : examPreset === 'sign-140x60'
              ? [140, 60]
              : [300, 100];
      canvas.width = dims[0];
      canvas.height = dims[1];
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const scale = Math.max(canvas.width / sourceImg.naturalWidth, canvas.height / sourceImg.naturalHeight);
      const dw = sourceImg.naturalWidth * scale;
      const dh = sourceImg.naturalHeight * scale;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(sourceImg, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
      return canvas;
    }

    if (mode === 'crop' || mode === 'card-crop') {
      const sx = (cropX / 100) * sourceImg.naturalWidth;
      const sy = (cropY / 100) * sourceImg.naturalHeight;
      const sw = Math.max(10, (cropW / 100) * sourceImg.naturalWidth);
      const sh = Math.max(10, (cropH / 100) * sourceImg.naturalHeight);

      if (baseRotate % 180 !== 0) {
        canvas.width = Math.round(sh);
        canvas.height = Math.round(sw);
      } else {
        canvas.width = Math.round(sw);
        canvas.height = Math.round(sh);
      }

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((baseRotate * Math.PI) / 180);
      ctx.drawImage(sourceImg, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh);
      ctx.restore();
      return canvas;
    }

    if (mode === 'straighten') {
      const totalDeg = baseRotate + angleDeg;
      const rad = (totalDeg * Math.PI) / 180;
      const w = sourceImg.naturalWidth;
      const h = sourceImg.naturalHeight;
      canvas.width = w;
      canvas.height = h;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.filter = `${scanBw ? 'grayscale(100%) ' : ''}contrast(${contrast}%)`;
      ctx.translate(w / 2, h / 2);
      ctx.rotate(rad);
      ctx.drawImage(sourceImg, -w / 2, -h / 2, w, h);
      ctx.restore();
      return canvas;
    }

    if (mode === 'bg-studio') {
      const w = sourceImg.naturalWidth;
      const h = sourceImg.naturalHeight;
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(sourceImg, 0, 0);
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;
      // Sample top-left corner pixel as background reference
      const refR = data[0];
      const refG = data[1];
      const refB = data[2];
      const hex = bgColor.replace('#', '');
      const nr = parseInt(hex.slice(0, 2), 16);
      const ng = parseInt(hex.slice(2, 4), 16);
      const nb = parseInt(hex.slice(4, 6), 16);
      const threshSq = bgThreshold * bgThreshold * 3;

      for (let i = 0; i < data.length; i += 4) {
        const dr = data[i] - refR;
        const dg = data[i + 1] - refG;
        const db = data[i + 2] - refB;
        if (dr * dr + dg * dg + db * db <= threshSq) {
          data[i] = nr;
          data[i + 1] = ng;
          data[i + 2] = nb;
          data[i + 3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);
      return canvas;
    }

    // compress / convert default
    canvas.width = sourceImg.naturalWidth;
    canvas.height = sourceImg.naturalHeight;
    if (outFormat === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(sourceImg, 0, 0);
    return canvas;
  };

  useEffect(() => {
    if (!sourceImg || !previewCanvasRef.current) return;
    const processed = renderProcessedCanvas();
    if (!processed) return;

    const preview = previewCanvasRef.current;
    const maxW = 540;
    const scale = Math.min(1, maxW / processed.width);
    preview.width = Math.max(1, Math.round(processed.width * scale));
    preview.height = Math.max(1, Math.round(processed.height * scale));
    const pCtx = preview.getContext('2d');
    if (pCtx) {
      pCtx.clearRect(0, 0, preview.width, preview.height);
      pCtx.drawImage(processed, 0, 0, preview.width, preview.height);
    }

    const mime =
      mode === 'compress' || mode === 'exam-photo'
        ? 'image/jpeg'
        : mode === 'convert'
          ? outFormat
          : 'image/jpeg';
    processed.toBlob(
      (b) => {
        if (b) setEstimatedSize(b.size);
      },
      mime,
      mode === 'compress' ? quality : 0.92
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sourceImg,
    mode,
    targetW,
    targetH,
    quality,
    cropX,
    cropY,
    cropW,
    cropH,
    outFormat,
    angleDeg,
    baseRotate,
    scanBw,
    contrast,
    bgColor,
    bgThreshold,
    examPreset,
    watermark,
  ]);

  const applyAspectCrop = (preset: 'free' | 'id-card' | 'passport' | 'square') => {
    setCardPreset(preset);
    if (!sourceImg || preset === 'free') return;
    const ratio =
      preset === 'id-card' ? 85.6 / 54 : preset === 'passport' ? 35 / 45 : 1;
    const imgRatio = sourceImg.naturalWidth / sourceImg.naturalHeight;
    if (imgRatio > ratio) {
      const hPct = 84;
      const wPct = Math.min(96, (hPct * ratio) / imgRatio);
      setCropW(Math.round(wPct));
      setCropH(hPct);
      setCropX(Math.round((100 - wPct) / 2));
      setCropY(8);
    } else {
      const wPct = 84;
      const hPct = Math.min(96, (wPct * imgRatio) / ratio);
      setCropW(wPct);
      setCropH(Math.round(hPct));
      setCropX(8);
      setCropY(Math.round((100 - hPct) / 2));
    }
  };

  const compressToTargetKb = async (canvas: HTMLCanvasElement, kb: number): Promise<Blob> => {
    const targetBytes = kb * 1024;
    let lo = 0.1;
    let hi = 0.96;
    let bestBlob: Blob | null = null;

    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2;
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Blob error'))), 'image/jpeg', mid)
      );
      bestBlob = blob;
      if (blob.size > targetBytes) {
        hi = mid;
      } else {
        lo = mid;
      }
    }
    return bestBlob!;
  };

  const handleDownloadImage = async () => {
    const canvas = renderProcessedCanvas();
    if (!canvas || !sourceFile) return;

    const base = sourceFile.name.replace(/\.[^.]+$/, '');
    if ((mode === 'compress' || mode === 'exam-photo') && useTargetKb) {
      const blob = await compressToTargetKb(canvas, targetKb);
      downloadBlob(blob, `${base}-${targetKb}kb.jpg`);
      setStatusMsg(`Downloaded (${formatBytes(blob.size)})`);
      return;
    }

    const mime =
      mode === 'convert'
        ? outFormat
        : mode === 'compress' || mode === 'exam-photo'
          ? 'image/jpeg'
          : 'image/png';
    const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png';

    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Export failed'))),
        mime,
        mode === 'compress' ? quality : 0.92
      )
    );
    downloadBlob(blob, `${base}-${mode}.${ext}`);
    setStatusMsg(`Downloaded ${base}-${mode}.${ext} (${formatBytes(blob.size)})`);
  };

  const handleDownloadPdf = async () => {
    const canvas = renderProcessedCanvas();
    if (!canvas || !sourceFile) return;
    const base = sourceFile.name.replace(/\.[^.]+$/, '');
    const pdfBytes = await canvasToA4Pdf(canvas);
    downloadBytes(pdfBytes, `${base}-${mode}.pdf`);
    setStatusMsg(`Downloaded A4 PDF (${formatBytes(pdfBytes.byteLength)})`);
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

      {/* Banner */}
      <section
        className="rounded-[22px] p-6 sm:p-8 text-white"
        style={{ background: 'linear-gradient(120deg, #0f2a5c, #4338ca 60%, #db2777)' }}
      >
        <h1 className="text-2xl sm:text-3xl font-bold m-0 mb-1">
          🖼 ইমেজ ও ডকুমেন্ট টুলস / Image Tools Studio
        </h1>
        <p className="text-sm sm:text-base text-white/90 m-0">
          Resize, Compress (Target KB), Crop, Convert Format, ID Card Crop, Document Straightener &amp; Background Changer
        </p>
      </section>

      {/* Mode Tabs */}
      <div className="flex flex-wrap gap-1.5 bg-[var(--card)] border border-[var(--bd)] p-2 rounded-[16px]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setMode(t.id)}
            className={`px-3.5 py-2 rounded-[10px] text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
              mode === t.id
                ? 'bg-[#f57c00] text-white'
                : 'text-[var(--tx)] hover:bg-[var(--bg)]'
            }`}
          >
            {t.label} <span className="opacity-80">({t.bn})</span>
          </button>
        ))}
      </div>

      {/* Main Workspace */}
      <section className="bg-[var(--card)] border border-[var(--bd)] rounded-[22px] p-5 sm:p-6 space-y-5">
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFile(e.dataTransfer.files);
          }}
          className="border-2 border-dashed border-slate-400/70 hover:border-[#f57c00] rounded-[16px] py-8 px-4 text-center cursor-pointer transition-colors"
        >
          <Upload className="w-8 h-8 mx-auto mb-2 text-[#f57c00]" />
          <div className="font-bold text-sm sm:text-base">
            {sourceFile ? `Loaded: ${sourceFile.name} (${origW}×${origH}px)` : 'Select an Image (JPG, PNG, WebP)'}
          </div>
          <div className="text-xs text-[var(--mut)] mt-1">
            Click or drag &amp; drop an image file here
          </div>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            accept="image/*"
            onChange={(e) => handleFile(e.target.files)}
          />
        </div>

        {sourceImg && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Controls */}
            <div className="space-y-4">
              {mode === 'resize' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold mb-1">Width (px)</label>
                      <input
                        type="number"
                        min={16}
                        value={targetW}
                        onChange={(e) => {
                          const w = Math.max(1, Number(e.target.value));
                          setTargetW(w);
                          if (lockAspect && origW > 0) {
                            setTargetH(Math.max(1, Math.round((w * origH) / origW)));
                          }
                        }}
                        className="w-full px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1">Height (px)</label>
                      <input
                        type="number"
                        min={16}
                        value={targetH}
                        onChange={(e) => {
                          const h = Math.max(1, Number(e.target.value));
                          setTargetH(h);
                          if (lockAspect && origH > 0) {
                            setTargetW(Math.max(1, Math.round((h * origW) / origH)));
                          }
                        }}
                        className="w-full px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                      />
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lockAspect}
                      onChange={(e) => setLockAspect(e.target.checked)}
                      className="accent-[#f57c00]"
                    />
                    Lock Aspect Ratio
                  </label>
                </div>
              )}

              {(mode === 'compress' || mode === 'exam-photo') && (
                <div className="space-y-3">
                  {mode === 'exam-photo' && (
                    <div>
                      <label className="block text-xs font-bold mb-1.5">Exam Preset Size</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'photo-200x230' as const, label: 'Photo 200×230 px' },
                          { id: 'photo-300x300' as const, label: 'Photo 300×300 px' },
                          { id: 'sign-140x60' as const, label: 'Signature 140×60 px' },
                          { id: 'sign-300x100' as const, label: 'Signature 300×100 px' },
                        ].map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setExamPreset(p.id)}
                            className={`px-3 py-2 rounded-[10px] text-xs font-bold cursor-pointer ${
                              examPreset === p.id
                                ? 'bg-[#0f2a5c] text-white'
                                : 'bg-[var(--bg)] border border-[var(--bd)]'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <label className="inline-flex items-center gap-2 text-sm font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useTargetKb}
                      onChange={(e) => setUseTargetKb(e.target.checked)}
                      className="accent-[#f57c00]"
                    />
                    Compress to exact Target KB (যেমন 20 KB / 50 KB)
                  </label>

                  {useTargetKb ? (
                    <div>
                      <label className="block text-xs font-bold mb-1">Target Max Size (KB)</label>
                      <input
                        type="number"
                        min={5}
                        max={2000}
                        value={targetKb}
                        onChange={(e) => setTargetKb(Math.max(5, Number(e.target.value)))}
                        className="w-40 px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold mb-1">
                        JPEG Quality ({Math.round(quality * 100)}%)
                      </label>
                      <input
                        type="range"
                        min={0.15}
                        max={0.98}
                        step={0.03}
                        value={quality}
                        onChange={(e) => setQuality(Number(e.target.value))}
                        className="w-full accent-[#f57c00]"
                      />
                    </div>
                  )}
                </div>
              )}

              {(mode === 'crop' || mode === 'card-crop') && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold mb-1.5">Crop Ratio Presets</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 'free' as const, label: 'Free' },
                        { id: 'id-card' as const, label: 'ID Card (CR80 / PAN)' },
                        { id: 'passport' as const, label: 'Passport (35:45)' },
                        { id: 'square' as const, label: 'Square (1:1)' },
                      ].map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => applyAspectCrop(p.id)}
                          className={`px-3 py-1.5 rounded-[10px] text-xs font-semibold cursor-pointer ${
                            cardPreset === p.id
                              ? 'bg-[#0f2a5c] text-white'
                              : 'bg-[var(--bg)] border border-[var(--bd)]'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold">Left ({cropX}%)</label>
                      <input
                        type="range"
                        min={0}
                        max={80}
                        value={cropX}
                        onChange={(e) => setCropX(Number(e.target.value))}
                        className="w-full accent-[#f57c00]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold">Top ({cropY}%)</label>
                      <input
                        type="range"
                        min={0}
                        max={80}
                        value={cropY}
                        onChange={(e) => setCropY(Number(e.target.value))}
                        className="w-full accent-[#f57c00]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold">Width ({cropW}%)</label>
                      <input
                        type="range"
                        min={10}
                        max={100 - cropX}
                        value={cropW}
                        onChange={(e) => setCropW(Number(e.target.value))}
                        className="w-full accent-[#f57c00]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold">Height ({cropH}%)</label>
                      <input
                        type="range"
                        min={10}
                        max={100 - cropY}
                        value={cropH}
                        onChange={(e) => setCropH(Number(e.target.value))}
                        className="w-full accent-[#f57c00]"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBaseRotate((r) => (r + 90) % 360)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border border-[var(--bd)] text-xs font-semibold cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    Rotate 90°
                  </button>
                </div>
              )}

              {mode === 'convert' && (
                <div>
                  <label className="block text-xs font-bold mb-1.5">Target Output Format</label>
                  <select
                    value={outFormat}
                    onChange={(e) =>
                      setOutFormat(e.target.value as 'image/jpeg' | 'image/png' | 'image/webp')
                    }
                    className="w-full max-w-xs px-3 py-2.5 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                  >
                    <option value="image/jpeg">JPG / JPEG</option>
                    <option value="image/png">PNG (Lossless)</option>
                    <option value="image/webp">WebP (Modern Compact)</option>
                  </select>
                </div>
              )}

              {mode === 'straighten' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold mb-1">
                      Fine Tilt Angle ({angleDeg}°)
                    </label>
                    <input
                      type="range"
                      min={-25}
                      max={25}
                      step={0.5}
                      value={angleDeg}
                      onChange={(e) => setAngleDeg(Number(e.target.value))}
                      className="w-full accent-[#f57c00]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">
                      Scan Contrast ({contrast}%)
                    </label>
                    <input
                      type="range"
                      min={80}
                      max={180}
                      value={contrast}
                      onChange={(e) => setContrast(Number(e.target.value))}
                      className="w-full accent-[#f57c00]"
                    />
                  </div>
                  <div className="flex flex-wrap gap-3 items-center">
                    <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={scanBw}
                        onChange={(e) => setScanBw(e.target.checked)}
                        className="accent-[#f57c00]"
                      />
                      Black &amp; White Scan Mode
                    </label>
                    <button
                      type="button"
                      onClick={() => setBaseRotate((r) => (r + 90) % 360)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border border-[var(--bd)] text-xs font-semibold cursor-pointer"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      Rotate 90°
                    </button>
                  </div>
                </div>
              )}

              {mode === 'bg-studio' && (
                <div className="space-y-3">
                  <div className="text-xs text-[var(--mut)]">
                    Uniform backdrop colors (sampled from corner) are replaced cleanly with your chosen studio color.
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { hex: '#ffffff', label: 'White' },
                      { hex: '#dbeafe', label: 'Passport Blue' },
                      { hex: '#f3f4f6', label: 'Studio Gray' },
                      { hex: '#fef3c7', label: 'Warm Cream' },
                    ].map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setBgColor(c.hex)}
                        className={`px-3 py-1.5 rounded-[10px] text-xs font-semibold border cursor-pointer ${
                          bgColor === c.hex ? 'border-[#f57c00] ring-2 ring-[#f57c00]/30' : 'border-[var(--bd)]'
                        }`}
                        style={{ backgroundColor: c.hex, color: '#12263a' }}
                      >
                        {c.label}
                      </button>
                    ))}
                    <input
                      type="color"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="w-9 h-9 rounded border border-[var(--bd)] cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">
                      Color Tolerance ({bgThreshold})
                    </label>
                    <input
                      type="range"
                      min={8}
                      max={90}
                      value={bgThreshold}
                      onChange={(e) => setBgThreshold(Number(e.target.value))}
                      className="w-full accent-[#f57c00]"
                    />
                  </div>
                </div>
              )}

              <WatermarkControls value={watermark} onChange={setWatermark} />

              <div className="flex flex-wrap gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleDownloadImage}
                  className="inline-flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-sm font-bold bg-[#f57c00] hover:bg-[#e06d00] text-white cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Download Image
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-sm font-bold bg-[#0f2a5c] hover:bg-[#193d7f] text-white cursor-pointer"
                >
                  Download A4 PDF
                </button>
              </div>

              {statusMsg && (
                <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  ✓ {statusMsg}
                </div>
              )}
            </div>

            {/* Live Preview */}
            <div className="rounded-[16px] border border-[var(--bd)] bg-[var(--bg)] p-4 flex flex-col items-center">
              <div className="w-full flex items-center justify-between text-xs text-[var(--mut)] mb-2 tabular-nums">
                <span>Live Preview</span>
                <span>
                  Orig: {formatBytes(sourceFile?.size || 0)}
                  {estimatedSize !== null && !useTargetKb ? ` → Est: ${formatBytes(estimatedSize)}` : ''}
                </span>
              </div>
              <canvas
                ref={previewCanvasRef}
                className="max-w-full max-h-[360px] object-contain rounded-lg border border-[var(--bd)] bg-white"
              />
            </div>
          </div>
        )}

        <PrivacyNote />
      </section>
    </div>
  );
};
