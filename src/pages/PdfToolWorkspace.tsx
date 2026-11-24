import React, { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Download,
  FileText,
  Loader2,
  RotateCw,
  Trash2,
  Upload,
} from 'lucide-react';
import { TOOLS_CONFIG } from '../config/toolsConfig';
import { downloadBlob, downloadBytes, formatBytes } from '../utils/download';
import {
  addPageNumbersToPdf,
  addWatermarkToPdf,
  compressPdf,
  cropPdf,
  deletePdfPages,
  extractPdfPages,
  getPdfPageCount,
  imagesToPdf,
  mergePdfs,
  organizePdf,
  parsePageRanges,
  pdfToJpg,
  rearrangePdfPages,
  renderPdfThumbnails,
  rotatePdf,
  signPdf,
  splitPdf,
} from '../utils/pdfUtils';
import { PrivacyNote } from '../components/PrivacyNote';

interface PdfToolWorkspaceProps {
  toolId: string;
  onBack: () => void;
}

interface LoadedPdfFile {
  id: string;
  name: string;
  size: number;
  bytes: ArrayBuffer;
  pageCount: number;
}

interface OrganizePageState {
  id: string;
  originalIndex: number;
  rotation: number;
  thumb: string;
}

export const PdfToolWorkspace: React.FC<PdfToolWorkspaceProps> = ({ toolId, onBack }) => {
  const tool = TOOLS_CONFIG.find((t) => t.id === toolId) || TOOLS_CONFIG.find((t) => t.id === 'split-pdf')!;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [pdfFiles, setPdfFiles] = useState<LoadedPdfFile[]>([]);
  const [imageFiles, setImageFiles] = useState<{ id: string; file: File; previewUrl: string }[]>([]);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [loadingThumbs, setLoadingThumbs] = useState(false);

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Tool-specific options
  const [splitMode, setSplitMode] = useState<'range' | 'every-page' | 'chunk'>('range');
  const [rangeInput, setRangeInput] = useState('1-2');
  const [chunkSize, setChunkSize] = useState(2);

  const [rotateAngle, setRotateAngle] = useState<90 | 180 | 270>(90);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);

  const [pageNumPosition, setPageNumPosition] = useState<
    'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right'
  >('bottom-center');
  const [pageNumStart, setPageNumStart] = useState(1);
  const [pageNumFormat, setPageNumFormat] = useState<'number' | 'page-n' | 'n-of-total'>('number');
  const [pageNumSize, setPageNumSize] = useState(12);

  const [wmText, setWmText] = useState('CONFIDENTIAL / গোপনীয়');
  const [wmOpacity, setWmOpacity] = useState(0.28);
  const [wmSize, setWmSize] = useState(38);
  const [wmRotation, setWmRotation] = useState(-35);
  const [wmColor, setWmColor] = useState('#0f2a5c');

  const [imgPdfSize, setImgPdfSize] = useState<'a4' | 'letter' | 'fit'>('a4');
  const [imgPdfOrient, setImgPdfOrient] = useState<'portrait' | 'landscape' | 'auto'>('auto');
  const [imgPdfMargin, setImgPdfMargin] = useState(18);

  const [jpgDpi, setJpgDpi] = useState(150);
  const [jpgQuality, setJpgQuality] = useState(0.9);
  const [jpgResults, setJpgResults] = useState<{ pageNum: number; dataUrl: string; blob: Blob }[]>([]);

  const [compressLevel, setCompressLevel] = useState<'balanced' | 'lossless' | 'strong'>('balanced');

  const [cropTop, setCropTop] = useState(20);
  const [cropRight, setCropRight] = useState(20);
  const [cropBottom, setCropBottom] = useState(20);
  const [cropLeft, setCropLeft] = useState(20);

  const [sigMode, setSigMode] = useState<'draw' | 'type'>('draw');
  const [sigTyped, setSigTyped] = useState('Kaajer Sign');
  const [sigPageNum, setSigPageNum] = useState(1);
  const [sigPos, setSigPos] = useState<'bottom-right' | 'bottom-left' | 'bottom-center'>('bottom-right');
  const isDrawingRef = useRef(false);

  const [organizePages, setOrganizePages] = useState<OrganizePageState[]>([]);

  const resetAll = () => {
    imageFiles.forEach((im) => URL.revokeObjectURL(im.previewUrl));
    setPdfFiles([]);
    setImageFiles([]);
    setThumbs([]);
    setSelectedPages([]);
    setJpgResults([]);
    setOrganizePages([]);
    setError(null);
    setStatusMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    clearSigCanvas();
  };

  useEffect(() => {
    resetAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolId]);

  const isImageInput = tool.id === 'jpg-to-pdf';
  const isMultiPdf = tool.id === 'merge-pdf';

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    setStatusMsg(null);
    setJpgResults([]);

    try {
      if (isImageInput) {
        const added: { id: string; file: File; previewUrl: string }[] = [];
        for (const f of Array.from(fileList)) {
          if (!f.type.startsWith('image/')) continue;
          added.push({
            id: `${Date.now()}-${Math.random()}`,
            file: f,
            previewUrl: URL.createObjectURL(f),
          });
        }
        if (added.length === 0) {
          setError('Please choose valid JPG, PNG, or WebP image files.');
          return;
        }
        setImageFiles((prev) => [...prev, ...added]);
        return;
      }

      const incoming = Array.from(fileList).filter(
        (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
      );
      if (incoming.length === 0) {
        setError('Please select a valid PDF file.');
        return;
      }

      if (isMultiPdf) {
        const loaded: LoadedPdfFile[] = [];
        for (const f of incoming) {
          const bytes = await f.arrayBuffer();
          const pageCount = await getPdfPageCount(bytes);
          loaded.push({
            id: `${Date.now()}-${Math.random()}`,
            name: f.name,
            size: f.size,
            bytes,
            pageCount,
          });
        }
        setPdfFiles((prev) => [...prev, ...loaded]);
      } else {
        const f = incoming[0];
        const bytes = await f.arrayBuffer();
        const pageCount = await getPdfPageCount(bytes);
        setPdfFiles([
          {
            id: `${Date.now()}`,
            name: f.name,
            size: f.size,
            bytes,
            pageCount,
          },
        ]);
        setRangeInput(pageCount > 1 ? `1-${Math.min(2, pageCount)}` : '1');
        setSelectedPages([]);
        setSigPageNum(1);

        // Render visual thumbnails for single-PDF tools
        setLoadingThumbs(true);
        try {
          const rendered = await renderPdfThumbnails(bytes, 0.36, 48);
          setThumbs(rendered);
          setOrganizePages(
            rendered.map((thumb, idx) => ({
              id: `pg-${idx}-${Date.now()}`,
              originalIndex: idx,
              rotation: 0,
              thumb,
            }))
          );
          if (tool.id === 'rearrange-pages') {
            setRangeInput(Array.from({ length: pageCount }, (_, i) => i + 1).join(', '));
          }
        } catch {
          setThumbs([]);
        } finally {
          setLoadingThumbs(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file.');
    }
  };

  const togglePageSelection = (idx: number) => {
    setSelectedPages((prev) =>
      prev.includes(idx) ? prev.filter((p) => p !== idx) : [...prev, idx].sort((a, b) => a - b)
    );
  };

  const moveItem = <T,>(arr: T[], idx: number, dir: -1 | 1): T[] => {
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return arr;
    const copy = [...arr];
    const [removed] = copy.splice(idx, 1);
    copy.splice(target, 0, removed);
    return copy;
  };

  // Signature drawing handlers
  const clearSigCanvas = () => {
    const c = sigCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, c.width, c.height);
  };

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = sigCanvasRef.current!;
    const rect = c.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * c.width,
      y: ((e.clientY - rect.top) / rect.height) * c.height,
    };
  };

  const onSigDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = sigCanvasRef.current;
    if (!c) return;
    c.setPointerCapture(e.pointerId);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    isDrawingRef.current = true;
    const pt = getCanvasPoint(e);
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f2a5c';
  };

  const onSigMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !sigCanvasRef.current) return;
    const ctx = sigCanvasRef.current.getContext('2d');
    if (!ctx) return;
    const pt = getCanvasPoint(e);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  };

  const onSigUp = () => {
    isDrawingRef.current = false;
  };

  const buildSignaturePng = (): string => {
    if (sigMode === 'draw' && sigCanvasRef.current) {
      return sigCanvasRef.current.toDataURL('image/png');
    }
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 140;
    const ctx = canvas.getContext('2d')!;
    ctx.font = 'italic 700 46px "Hind Siliguri", Georgia, serif';
    ctx.fillStyle = '#0f2a5c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sigTyped.trim() || 'Signature', 240, 70);
    return canvas.toDataURL('image/png');
  };

  const handleProcess = async () => {
    setError(null);
    setStatusMsg(null);
    setProcessing(true);

    try {
      if (tool.id === 'jpg-to-pdf') {
        if (imageFiles.length === 0) throw new Error('Please select at least one image.');
        const outBytes = await imagesToPdf(
          imageFiles.map((x) => x.file),
          {
            pageSize: imgPdfSize,
            orientation: imgPdfOrient,
            marginPt: imgPdfMargin,
          }
        );
        downloadBytes(outBytes, 'kaajer-images.pdf');
        setStatusMsg(`Converted ${imageFiles.length} image(s) to PDF (${formatBytes(outBytes.byteLength)}).`);
        return;
      }

      if (pdfFiles.length === 0) {
        throw new Error('Please select a PDF file first.');
      }

      const mainPdf = pdfFiles[0];
      const baseName = mainPdf.name.replace(/\.pdf$/i, '');

      switch (tool.id) {
        case 'merge-pdf': {
          if (pdfFiles.length < 2) throw new Error('Add at least 2 PDF files to merge.');
          const merged = await mergePdfs(pdfFiles.map((f) => f.bytes));
          downloadBytes(merged, 'kaajer-merged.pdf');
          setStatusMsg(
            `Merged ${pdfFiles.length} PDFs (${formatBytes(merged.byteLength)}).`
          );
          break;
        }

        case 'split-pdf': {
          const outputs = await splitPdf(mainPdf.bytes, splitMode, rangeInput, chunkSize);
          if (outputs.length === 1) {
            downloadBytes(outputs[0].bytes, `${baseName}-${outputs[0].name}`);
            setStatusMsg(`Split PDF downloaded (${outputs[0].name}).`);
          } else {
            const zip = new JSZip();
            outputs.forEach((o) => zip.file(o.name, o.bytes));
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            downloadBlob(zipBlob, `${baseName}-split-pages.zip`);
            setStatusMsg(`Downloaded ${outputs.length} split PDFs inside ZIP archive.`);
          }
          break;
        }

        case 'rotate-pdf': {
          const targets =
            selectedPages.length > 0
              ? selectedPages
              : parsePageRanges(rangeInput, mainPdf.pageCount);
          const out = await rotatePdf(mainPdf.bytes, rotateAngle, targets);
          downloadBytes(out, `${baseName}-rotated.pdf`);
          setStatusMsg(
            targets.length > 0
              ? `Rotated ${targets.length} selected page(s) by ${rotateAngle}°.`
              : `Rotated all ${mainPdf.pageCount} pages by ${rotateAngle}°.`
          );
          break;
        }

        case 'delete-pages': {
          const targets =
            selectedPages.length > 0
              ? selectedPages
              : parsePageRanges(rangeInput, mainPdf.pageCount);
          if (targets.length === 0) {
            throw new Error('Click pages above or enter page numbers to delete.');
          }
          const out = await deletePdfPages(mainPdf.bytes, targets);
          downloadBytes(out, `${baseName}-deleted.pdf`);
          setStatusMsg(`Deleted ${targets.length} page(s). Remaining: ${mainPdf.pageCount - targets.length}.`);
          break;
        }

        case 'extract-pages': {
          const targets =
            selectedPages.length > 0
              ? selectedPages
              : parsePageRanges(rangeInput, mainPdf.pageCount);
          const out = await extractPdfPages(mainPdf.bytes, targets);
          downloadBytes(out, `${baseName}-extracted.pdf`);
          setStatusMsg(`Extracted ${targets.length} page(s) into a new PDF.`);
          break;
        }

        case 'rearrange-pages': {
          const order = parsePageRanges(rangeInput, mainPdf.pageCount, true);
          const out = await rearrangePdfPages(mainPdf.bytes, order);
          downloadBytes(out, `${baseName}-rearranged.pdf`);
          setStatusMsg(`Rearranged PDF with ${order.length} page(s).`);
          break;
        }

        case 'add-page-numbers': {
          const out = await addPageNumbersToPdf(mainPdf.bytes, {
            position: pageNumPosition,
            startNumber: pageNumStart,
            format: pageNumFormat,
            fontSize: pageNumSize,
          });
          downloadBytes(out, `${baseName}-numbered.pdf`);
          setStatusMsg(`Added page numbers to ${mainPdf.pageCount} page(s).`);
          break;
        }

        case 'add-watermark': {
          const out = await addWatermarkToPdf(mainPdf.bytes, {
            text: wmText,
            opacity: wmOpacity,
            fontSize: wmSize,
            rotation: wmRotation,
            colorHex: wmColor,
          });
          downloadBytes(out, `${baseName}-watermarked.pdf`);
          setStatusMsg(`Applied watermark "${wmText}" across ${mainPdf.pageCount} page(s).`);
          break;
        }

        case 'pdf-to-jpg': {
          const pages = await pdfToJpg(mainPdf.bytes, jpgDpi, jpgQuality);
          setJpgResults(pages);
          setStatusMsg(`Rendered ${pages.length} page(s) as JPG. Download individually or as ZIP.`);
          break;
        }

        case 'compress-pdf': {
          const out = await compressPdf(mainPdf.bytes, compressLevel);
          downloadBytes(out, `${baseName}-compressed.pdf`);
          setStatusMsg(
            `Original: ${formatBytes(mainPdf.size)} → Compressed: ${formatBytes(out.byteLength)}.`
          );
          break;
        }

        case 'crop-pdf': {
          const targets =
            selectedPages.length > 0
              ? selectedPages
              : parsePageRanges(rangeInput, mainPdf.pageCount);
          const out = await cropPdf(
            mainPdf.bytes,
            { top: cropTop, right: cropRight, bottom: cropBottom, left: cropLeft },
            targets
          );
          downloadBytes(out, `${baseName}-cropped.pdf`);
          setStatusMsg('Cropped PDF margins and downloaded.');
          break;
        }

        case 'sign-pdf': {
          const sigPng = buildSignaturePng();
          const out = await signPdf(mainPdf.bytes, sigPng, sigPageNum, sigPos);
          downloadBytes(out, `${baseName}-signed.pdf`);
          setStatusMsg(`Added signature to page ${sigPageNum}.`);
          break;
        }

        case 'organize-pdf': {
          const out = await organizePdf(
            mainPdf.bytes,
            organizePages.map((p) => ({
              originalIndex: p.originalIndex,
              rotation: p.rotation,
            }))
          );
          downloadBytes(out, `${baseName}-organized.pdf`);
          setStatusMsg(`Saved organized PDF with ${organizePages.length} page(s).`);
          break;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong while processing.');
    } finally {
      setProcessing(false);
    }
  };

  const downloadAllJpgZip = async () => {
    if (jpgResults.length === 0) return;
    const zip = new JSZip();
    jpgResults.forEach((p) => {
      zip.file(`page-${p.pageNum}.jpg`, p.blob);
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, 'pdf-pages-jpg.zip');
  };

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-[var(--card)] border border-[var(--bd)] text-[var(--tx)] text-sm font-semibold hover:border-[#f57c00] transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to PDF Tools
      </button>

      {/* Banner */}
      <section
        className="rounded-[22px] p-6 sm:p-8 text-white"
        style={{
          background: 'linear-gradient(120deg, #0ea5e9, #4f46e5 60%, #7c3aed)',
        }}
      >
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">{tool.icon}</span>
          <h1 className="text-2xl sm:text-3xl font-bold m-0">{tool.title}</h1>
        </div>
        <p className="text-sm sm:text-base text-white/95 m-0">
          {tool.subtitle} • Browser-side processing
        </p>
      </section>

      {/* Workspace Card */}
      <section className="bg-[var(--card)] border border-[var(--bd)] rounded-[22px] p-5 sm:p-7 space-y-5">
        {/* Dropzone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFilesSelected(e.dataTransfer.files);
          }}
          className="border-2 border-dashed border-slate-400/70 hover:border-[#f57c00] hover:bg-[#ff8a00]/5 rounded-[18px] py-10 px-4 text-center cursor-pointer transition-colors"
        >
          <Upload className="w-10 h-10 mx-auto mb-2 text-[#f57c00]" />
          <div className="font-bold text-base text-[var(--tx)]">
            {isImageInput
              ? 'Select JPG / PNG / WebP Images'
              : isMultiPdf
                ? 'Select Multiple PDF Files'
                : 'Select PDF File'}
          </div>
          <div className="text-xs text-[var(--mut)] mt-1">
            Click to browse or drag &amp; drop files from your device
          </div>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            accept={isImageInput ? 'image/*' : 'application/pdf,.pdf'}
            multiple={isImageInput || isMultiPdf}
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
        </div>

        {/* Selected Files Summary */}
        {!isImageInput && pdfFiles.length > 0 && (
          <div className="space-y-2">
            {pdfFiles.map((f, idx) => (
              <div
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-[var(--bg)] border border-[var(--bd)] px-3.5 py-2.5 text-sm"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-4 h-4 text-[#f57c00] shrink-0" />
                  <span className="font-semibold truncate max-w-[240px] sm:max-w-md">
                    {f.name}
                  </span>
                  <span className="text-xs text-[var(--mut)] tabular-nums">
                    ({f.pageCount} pages · {formatBytes(f.size)})
                  </span>
                </div>
                {isMultiPdf && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPdfFiles((prev) => moveItem(prev, idx, -1))}
                      className="p-1.5 rounded-lg border border-[var(--bd)] hover:border-[#f57c00] cursor-pointer"
                      title="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfFiles((prev) => moveItem(prev, idx, 1))}
                      className="p-1.5 rounded-lg border border-[var(--bd)] hover:border-[#f57c00] cursor-pointer"
                      title="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfFiles((prev) => prev.filter((x) => x.id !== f.id))}
                      className="p-1.5 rounded-lg border border-[var(--bd)] text-rose-600 hover:border-rose-500 cursor-pointer"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Selected Images for JPG to PDF */}
        {isImageInput && imageFiles.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {imageFiles.map((im, idx) => (
              <div
                key={im.id}
                className="rounded-[12px] border border-[var(--bd)] bg-[var(--bg)] p-2 flex flex-col gap-1.5"
              >
                <img
                  src={im.previewUrl}
                  alt={im.file.name}
                  className="w-full h-24 object-cover rounded-lg"
                />
                <div className="text-[11px] truncate text-[var(--mut)]">{im.file.name}</div>
                <div className="flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => setImageFiles((prev) => moveItem(prev, idx, -1))}
                    className="p-1 rounded border border-[var(--bd)] cursor-pointer"
                    title="Move earlier"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageFiles((prev) => moveItem(prev, idx, 1))}
                    className="p-1 rounded border border-[var(--bd)] cursor-pointer"
                    title="Move later"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(im.previewUrl);
                      setImageFiles((prev) => prev.filter((x) => x.id !== im.id));
                    }}
                    className="p-1 rounded border border-[var(--bd)] text-rose-600 cursor-pointer"
                    title="Remove"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tool-specific Controls */}
        {loadingThumbs && (
          <div className="flex items-center gap-2 text-sm text-[var(--mut)]">
            <Loader2 className="w-4 h-4 animate-spin text-[#f57c00]" />
            Rendering page previews in browser...
          </div>
        )}

        {/* Visual Thumbnails for Page Selection (Rotate / Delete / Extract) */}
        {(tool.id === 'delete-pages' ||
          tool.id === 'extract-pages' ||
          tool.id === 'rotate-pdf') &&
          thumbs.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-[var(--mut)] mb-2">
                Click pages to select ({selectedPages.length} selected) — or use page range input below:
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2.5">
                {thumbs.map((src, idx) => {
                  const isSel = selectedPages.includes(idx);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => togglePageSelection(idx)}
                      className={`relative rounded-[10px] border-2 p-1.5 bg-[var(--bg)] cursor-pointer transition-all ${
                        isSel
                          ? tool.id === 'delete-pages'
                            ? 'border-rose-500 ring-2 ring-rose-400/40'
                            : 'border-[#f57c00] ring-2 ring-[#f57c00]/40'
                          : 'border-[var(--bd)] hover:border-slate-400'
                      }`}
                    >
                      <img src={src} alt={`Page ${idx + 1}`} className="w-full h-28 object-contain" />
                      <div className="mt-1 text-[11px] font-bold text-center tabular-nums">
                        Page {idx + 1}
                      </div>
                      {isSel && (
                        <span
                          className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full text-white grid place-items-center text-[10px] ${
                            tool.id === 'delete-pages' ? 'bg-rose-600' : 'bg-[#f57c00]'
                          }`}
                        >
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        {/* Organize PDF Visual Grid */}
        {tool.id === 'organize-pdf' && organizePages.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-[var(--mut)] mb-2">
              Rotate, reorder, or remove pages ({organizePages.length} pages kept):
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {organizePages.map((pg, idx) => (
                <div
                  key={pg.id}
                  className="rounded-[12px] border border-[var(--bd)] bg-[var(--bg)] p-2 flex flex-col items-center gap-2"
                >
                  <div className="w-full h-28 grid place-items-center overflow-hidden">
                    <img
                      src={pg.thumb}
                      alt={`Page ${pg.originalIndex + 1}`}
                      style={{ transform: `rotate(${pg.rotation}deg)` }}
                      className="max-h-26 object-contain transition-transform"
                    />
                  </div>
                  <div className="text-[11px] font-bold tabular-nums">
                    Orig. Page {pg.originalIndex + 1}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setOrganizePages((prev) => moveItem(prev, idx, -1))}
                      className="p-1 rounded border border-[var(--bd)] cursor-pointer"
                      title="Move Left"
                    >
                      <ArrowUp className="w-3.5 h-3.5 -rotate-90" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setOrganizePages((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, rotation: (item.rotation + 90) % 360 } : item
                          )
                        )
                      }
                      className="p-1 rounded border border-[var(--bd)] cursor-pointer"
                      title="Rotate 90°"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrganizePages((prev) => moveItem(prev, idx, 1))}
                      className="p-1 rounded border border-[var(--bd)] cursor-pointer"
                      title="Move Right"
                    >
                      <ArrowDown className="w-3.5 h-3.5 -rotate-90" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setOrganizePages((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="p-1 rounded border border-[var(--bd)] text-rose-600 cursor-pointer"
                      title="Delete Page"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Split PDF Options */}
        {tool.id === 'split-pdf' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold mb-1.5">Split Mode</label>
              <select
                value={splitMode}
                onChange={(e) => setSplitMode(e.target.value as 'range' | 'every-page' | 'chunk')}
                className="w-full px-3 py-2.5 rounded-[10px] border border-[var(--bd)] bg-[var(--card)] text-[var(--tx)] text-sm"
              >
                <option value="range">Extract specific page range (1 PDF)</option>
                <option value="every-page">Split every page into separate PDFs (ZIP)</option>
                <option value="chunk">Split into fixed page chunks (ZIP)</option>
              </select>
            </div>
            {splitMode === 'range' && (
              <div>
                <label className="block text-sm font-bold mb-1.5">Pages / Ranges</label>
                <input
                  type="text"
                  value={rangeInput}
                  onChange={(e) => setRangeInput(e.target.value)}
                  placeholder="Example: 1, 3-5"
                  className="w-full px-3 py-2.5 rounded-[10px] border border-[var(--bd)] bg-[var(--card)] text-[var(--tx)] text-sm"
                />
              </div>
            )}
            {splitMode === 'chunk' && (
              <div>
                <label className="block text-sm font-bold mb-1.5">Pages per PDF chunk</label>
                <input
                  type="number"
                  min={1}
                  value={chunkSize}
                  onChange={(e) => setChunkSize(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2.5 rounded-[10px] border border-[var(--bd)] bg-[var(--card)] text-[var(--tx)] text-sm"
                />
              </div>
            )}
          </div>
        )}

        {/* Rotate PDF Options */}
        {tool.id === 'rotate-pdf' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold mb-1.5">Rotation Angle</label>
              <div className="flex gap-2">
                {([90, 180, 270] as const).map((deg) => (
                  <button
                    key={deg}
                    type="button"
                    onClick={() => setRotateAngle(deg)}
                    className={`px-4 py-2 rounded-[10px] text-sm font-semibold cursor-pointer ${
                      rotateAngle === deg
                        ? 'bg-[#f57c00] text-white'
                        : 'bg-[var(--bg)] border border-[var(--bd)] text-[var(--tx)]'
                    }`}
                  >
                    {deg}°
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold mb-1.5">
                Target Pages (leave empty for all pages)
              </label>
              <input
                type="text"
                value={rangeInput}
                onChange={(e) => setRangeInput(e.target.value)}
                placeholder="All pages, or e.g. 1, 3-4"
                className="w-full px-3 py-2.5 rounded-[10px] border border-[var(--bd)] bg-[var(--card)] text-[var(--tx)] text-sm"
              />
            </div>
          </div>
        )}

        {/* Delete / Extract / Rearrange Page Range Input */}
        {(tool.id === 'delete-pages' ||
          tool.id === 'extract-pages' ||
          tool.id === 'rearrange-pages') && (
          <div>
            <label className="block text-sm font-bold mb-1.5">
              {tool.id === 'rearrange-pages'
                ? 'New Page Order (e.g. 3, 1, 2)'
                : tool.id === 'delete-pages'
                  ? 'Pages to Delete (or click thumbnails above)'
                  : 'Pages to Extract (or click thumbnails above)'}
            </label>
            <input
              type="text"
              value={rangeInput}
              onChange={(e) => setRangeInput(e.target.value)}
              placeholder="Example: 1, 3-5"
              className="w-full max-w-md px-3 py-2.5 rounded-[10px] border border-[var(--bd)] bg-[var(--card)] text-[var(--tx)] text-sm"
            />
          </div>
        )}

        {/* Add Page Numbers Options */}
        {tool.id === 'add-page-numbers' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
            <div>
              <label className="block text-sm font-bold mb-1">Position</label>
              <select
                value={pageNumPosition}
                onChange={(e) =>
                  setPageNumPosition(
                    e.target.value as
                      | 'bottom-center'
                      | 'bottom-right'
                      | 'bottom-left'
                      | 'top-center'
                      | 'top-right'
                  )
                }
                className="w-full px-3 py-2.5 rounded-[10px] border border-[var(--bd)] bg-[var(--card)] text-sm"
              >
                <option value="bottom-center">Bottom Center</option>
                <option value="bottom-right">Bottom Right</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="top-center">Top Center</option>
                <option value="top-right">Top Right</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Format</label>
              <select
                value={pageNumFormat}
                onChange={(e) =>
                  setPageNumFormat(e.target.value as 'number' | 'page-n' | 'n-of-total')
                }
                className="w-full px-3 py-2.5 rounded-[10px] border border-[var(--bd)] bg-[var(--card)] text-sm"
              >
                <option value="number">1, 2, 3</option>
                <option value="page-n">Page 1, Page 2</option>
                <option value="n-of-total">1 / N, 2 / N</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Start Number</label>
              <input
                type="number"
                min={1}
                value={pageNumStart}
                onChange={(e) => setPageNumStart(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2.5 rounded-[10px] border border-[var(--bd)] bg-[var(--card)] text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Font Size (pt)</label>
              <input
                type="number"
                min={8}
                max={32}
                value={pageNumSize}
                onChange={(e) => setPageNumSize(Math.max(8, Number(e.target.value)))}
                className="w-full px-3 py-2.5 rounded-[10px] border border-[var(--bd)] bg-[var(--card)] text-sm"
              />
            </div>
          </div>
        )}

        {/* Add Watermark Options */}
        {tool.id === 'add-watermark' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-sm font-bold mb-1">Watermark Text (English / বাংলা)</label>
              <input
                type="text"
                value={wmText}
                onChange={(e) => setWmText(e.target.value)}
                placeholder="Enter watermark text..."
                className="w-full px-3 py-2.5 rounded-[10px] border border-[var(--bd)] bg-[var(--card)] text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">
                Opacity ({Math.round(wmOpacity * 100)}%)
              </label>
              <input
                type="range"
                min={0.1}
                max={0.85}
                step={0.05}
                value={wmOpacity}
                onChange={(e) => setWmOpacity(Number(e.target.value))}
                className="w-full mt-2 accent-[#f57c00]"
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Font Size ({wmSize} pt)</label>
              <input
                type="range"
                min={18}
                max={80}
                value={wmSize}
                onChange={(e) => setWmSize(Number(e.target.value))}
                className="w-full mt-2 accent-[#f57c00]"
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Angle ({wmRotation}°)</label>
              <input
                type="range"
                min={-60}
                max={60}
                value={wmRotation}
                onChange={(e) => setWmRotation(Number(e.target.value))}
                className="w-full mt-2 accent-[#f57c00]"
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Color</label>
              <input
                type="color"
                value={wmColor}
                onChange={(e) => setWmColor(e.target.value)}
                className="w-16 h-10 p-1 rounded-[10px] border border-[var(--bd)] bg-[var(--card)] cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* JPG to PDF Options */}
        {tool.id === 'jpg-to-pdf' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-sm font-bold mb-1">Page Size</label>
              <select
                value={imgPdfSize}
                onChange={(e) => setImgPdfSize(e.target.value as 'a4' | 'letter' | 'fit')}
                className="w-full px-3 py-2.5 rounded-[10px] border border-[var(--bd)] bg-[var(--card)] text-sm"
              >
                <option value="a4">A4 (210 × 297 mm)</option>
                <option value="letter">US Letter</option>
                <option value="fit">Fit to Image Size</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Orientation</label>
              <select
                value={imgPdfOrient}
                onChange={(e) =>
                  setImgPdfOrient(e.target.value as 'portrait' | 'landscape' | 'auto')
                }
                className="w-full px-3 py-2.5 rounded-[10px] border border-[var(--bd)] bg-[var(--card)] text-sm"
              >
                <option value="auto">Auto (Match Image)</option>
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Margin</label>
              <select
                value={imgPdfMargin}
                onChange={(e) => setImgPdfMargin(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-[10px] border border-[var(--bd)] bg-[var(--card)] text-sm"
              >
                <option value={0}>No Margin</option>
                <option value={18}>Small Margin</option>
                <option value={36}>Normal Margin</option>
              </select>
            </div>
          </div>
        )}

        {/* PDF to JPG Options */}
        {tool.id === 'pdf-to-jpg' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-sm font-bold mb-1">Render Resolution</label>
              <select
                value={jpgDpi}
                onChange={(e) => setJpgDpi(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-[10px] border border-[var(--bd)] bg-[var(--card)] text-sm"
              >
                <option value={120}>Standard (120 DPI)</option>
                <option value={150}>High (150 DPI)</option>
                <option value={220}>Print Crisp (220 DPI)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">
                JPG Quality ({Math.round(jpgQuality * 100)}%)
              </label>
              <input
                type="range"
                min={0.6}
                max={0.98}
                step={0.02}
                value={jpgQuality}
                onChange={(e) => setJpgQuality(Number(e.target.value))}
                className="w-full mt-2 accent-[#f57c00]"
              />
            </div>
          </div>
        )}

        {/* Compress PDF Options */}
        {tool.id === 'compress-pdf' && (
          <div>
            <label className="block text-sm font-bold mb-2">Compression Level</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                {
                  id: 'lossless' as const,
                  label: 'Lossless Cleanup',
                  desc: 'Keeps vector text sharp',
                },
                {
                  id: 'balanced' as const,
                  label: 'Balanced Compression',
                  desc: 'Good quality, smaller size',
                },
                {
                  id: 'strong' as const,
                  label: 'Strong Compression',
                  desc: 'Smallest size for portal uploads',
                },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setCompressLevel(opt.id)}
                  className={`p-3 rounded-[12px] border text-left cursor-pointer ${
                    compressLevel === opt.id
                      ? 'border-[#f57c00] bg-[#f57c00]/10'
                      : 'border-[var(--bd)] bg-[var(--bg)]'
                  }`}
                >
                  <div className="font-bold text-sm">{opt.label}</div>
                  <div className="text-xs text-[var(--mut)]">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Crop PDF Options */}
        {tool.id === 'crop-pdf' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Top (pt)', val: cropTop, set: setCropTop },
              { label: 'Right (pt)', val: cropRight, set: setCropRight },
              { label: 'Bottom (pt)', val: cropBottom, set: setCropBottom },
              { label: 'Left (pt)', val: cropLeft, set: setCropLeft },
            ].map((item) => (
              <div key={item.label}>
                <label className="block text-xs font-bold mb-1">{item.label}</label>
                <input
                  type="number"
                  min={0}
                  max={250}
                  value={item.val}
                  onChange={(e) => item.set(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--card)] text-sm"
                />
              </div>
            ))}
          </div>
        )}

        {/* Sign PDF Options */}
        {tool.id === 'sign-pdf' && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSigMode('draw')}
                className={`px-3.5 py-1.5 rounded-[10px] text-sm font-semibold cursor-pointer ${
                  sigMode === 'draw'
                    ? 'bg-[#0f2a5c] text-white'
                    : 'bg-[var(--bg)] border border-[var(--bd)]'
                }`}
              >
                Draw Signature
              </button>
              <button
                type="button"
                onClick={() => setSigMode('type')}
                className={`px-3.5 py-1.5 rounded-[10px] text-sm font-semibold cursor-pointer ${
                  sigMode === 'type'
                    ? 'bg-[#0f2a5c] text-white'
                    : 'bg-[var(--bg)] border border-[var(--bd)]'
                }`}
              >
                Type Signature
              </button>
            </div>

            {sigMode === 'draw' ? (
              <div>
                <div className="flex items-center justify-between max-w-md mb-1">
                  <span className="text-xs text-[var(--mut)]">Draw inside the box below:</span>
                  <button
                    type="button"
                    onClick={clearSigCanvas}
                    className="text-xs font-semibold text-[#f57c00] cursor-pointer"
                  >
                    Clear Pad
                  </button>
                </div>
                <canvas
                  ref={sigCanvasRef}
                  width={440}
                  height={130}
                  onPointerDown={onSigDown}
                  onPointerMove={onSigMove}
                  onPointerUp={onSigUp}
                  onPointerLeave={onSigUp}
                  className="w-full max-w-md h-[130px] rounded-[12px] border border-[var(--bd)] bg-white touch-none cursor-crosshair"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-bold mb-1">Typed Signature</label>
                <input
                  type="text"
                  value={sigTyped}
                  onChange={(e) => setSigTyped(e.target.value)}
                  className="w-full max-w-md px-3 py-2.5 rounded-[10px] border border-[var(--bd)] bg-[var(--card)] text-sm"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
              <div>
                <label className="block text-xs font-bold mb-1">Page Number</label>
                <input
                  type="number"
                  min={1}
                  max={pdfFiles[0]?.pageCount || 1}
                  value={sigPageNum}
                  onChange={(e) => setSigPageNum(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--card)] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Placement</label>
                <select
                  value={sigPos}
                  onChange={(e) =>
                    setSigPos(e.target.value as 'bottom-right' | 'bottom-left' | 'bottom-center')
                  }
                  className="w-full px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--card)] text-sm"
                >
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="bottom-center">Bottom Center</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            disabled={processing}
            onClick={handleProcess}
            className="inline-flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-sm font-bold bg-[#f57c00] hover:bg-[#e06d00] disabled:opacity-60 text-white transition-colors cursor-pointer"
          >
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Process &amp; Download
              </>
            )}
          </button>

          <button
            type="button"
            onClick={resetAll}
            className="rounded-[10px] px-4 py-2.5 text-sm font-semibold border border-[var(--bd)] bg-[var(--bg)] hover:border-[#f57c00] text-[var(--tx)] transition-colors cursor-pointer"
          >
            Reset
          </button>
        </div>

        {/* Status / Error */}
        {error && (
          <div className="rounded-[10px] px-4 py-3 text-sm font-semibold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
            {error}
          </div>
        )}
        {statusMsg && (
          <div className="rounded-[10px] px-4 py-3 text-sm font-semibold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
            ✓ {statusMsg}
          </div>
        )}

        {/* PDF to JPG Output Gallery */}
        {tool.id === 'pdf-to-jpg' && jpgResults.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold text-base m-0">
                Exported JPG Pages ({jpgResults.length})
              </h3>
              <button
                type="button"
                onClick={downloadAllJpgZip}
                className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-sm font-bold bg-[#0f2a5c] text-white hover:bg-[#193d7f] cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Download All as ZIP
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {jpgResults.map((pg) => (
                <div
                  key={pg.pageNum}
                  className="rounded-[12px] border border-[var(--bd)] bg-[var(--bg)] p-2 flex flex-col gap-2"
                >
                  <img
                    src={pg.dataUrl}
                    alt={`Page ${pg.pageNum}`}
                    className="w-full h-40 object-contain rounded bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => downloadBlob(pg.blob, `page-${pg.pageNum}.jpg`)}
                    className="w-full rounded-lg py-1.5 text-xs font-bold bg-[#f57c00] text-white hover:bg-[#e06d00] cursor-pointer"
                  >
                    Download Page {pg.pageNum}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <PrivacyNote />
      </section>
    </div>
  );
};
