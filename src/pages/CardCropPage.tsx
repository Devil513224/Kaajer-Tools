import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import { PDFDocument, rgb } from 'pdf-lib';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  Compass,
  Download,
  EyeOff,
  FlipVertical2,
  Loader2,
  Plus,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';
import {
  CARD_TYPES_CONFIG,
  CardTypeConfig,
  CardTypeId,
} from '../config/cardTypesConfig';
import {
  CardEnhancementParams,
  DEFAULT_ENHANCEMENT_BY_PRESET,
  EnhancementPreset,
  Point2D,
  applyEnhancementsToCanvas,
  applyRoundedWhiteMask,
  autoDetectCards,
  calculateEffectiveCardDpi,
  compareOrientationWithReference,
  createDefaultQuad,
  orderQuadCorners,
  suggestFlip180,
  warpCardPerspective,
  warpCardRaw,
} from '../utils/cardDetector';
import {
  MaskRegion,
  MaskStyle,
  WatermarkSettings,
  applyDiagonalWatermarkToCanvas,
  applyMaskRegionsToCanvas,
  createDefaultWatermarkSettings,
} from '../utils/canvasOverlays';
import { A4StartPosition, calculateA4Grid } from '../utils/a4SheetLayout';
import { A4PrintSheetPanel, SheetPreviewCard } from '../components/A4PrintSheetPanel';
import { WatermarkControls } from '../components/WatermarkControls';
import { CardMaskEditor } from '../components/CardMaskEditor';
import { downloadBlob, downloadBytes, loadImageFromFile } from '../utils/download';

interface CardCropPageProps {
  cardTypeId: CardTypeId;
  onBackToHub: () => void;
  onSelectCardType: (ct: CardTypeConfig) => void;
}

interface SourcePhoto {
  id: string;
  name: string;
  url: string;
  img: HTMLImageElement;
}

interface CroppedCardItem {
  id: string;
  photoId: string;
  label: string;
  corners: [Point2D, Point2D, Point2D, Point2D];
  initialCorners: [Point2D, Point2D, Point2D, Point2D];
  rotation: 0 | 90 | 180 | 270;
  side: 'front' | 'back' | 'none';
  enhancement: CardEnhancementParams;
  thumbDataUrl: string;
  orientationStatus: 'ok' | 'check';
  effectiveDpi: number;
  maskRegions: MaskRegion[];
  maskStyle: MaskStyle;
  isFallback?: boolean;
}

export const CardCropPage: React.FC<CardCropPageProps> = ({
  cardTypeId,
  onBackToHub,
  onSelectCardType,
}) => {
  const activeType = useMemo(
    () => CARD_TYPES_CONFIG.find((c) => c.id === cardTypeId) || CARD_TYPES_CONFIG[0],
    [cardTypeId]
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Live preview canvases & cached raw downscaled canvas for 60fps slider updates
  const beforeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const afterCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rawPreviewCacheRef = useRef<{
    key: string;
    canvas: HTMLCanvasElement;
  } | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const [photos, setPhotos] = useState<SourcePhoto[]>([]);
  const [cards, setCards] = useState<CroppedCardItem[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [referenceCardId, setReferenceCardId] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);

  // Aadhaar Paper Print / e-Aadhaar mode
  const [aadhaarMode, setAadhaarMode] = useState<'pvc' | 'paper'>('pvc');

  // Dimensions & Crop settings
  const [customWidthMm, setCustomWidthMm] = useState(activeType.widthMm);
  const [customHeightMm, setCustomHeightMm] = useState(activeType.heightMm);
  const [cornerRadiusMm, setCornerRadiusMm] = useState(activeType.cornerRadiusMm);
  const [trimMm, setTrimMm] = useState(0.75);
  const [dpi, setDpi] = useState<200 | 300 | 600>(300);
  const [quality, setQuality] = useState(0.92);

  // Apply-to-all toggle & before/after split position
  const [applyToAll, setApplyToAll] = useState(false);
  const [splitPercent, setSplitPercent] = useState(50);

  // A4 Print & Lamination Settings (Top-left default, 3mm gap default)
  const [cardsPerSheet, setCardsPerSheet] = useState(8);
  const [startPosition, setStartPosition] = useState<A4StartPosition>('top-left');
  const [startSlotOffset, setStartSlotOffset] = useState(0);
  const [gapMm, setGapMm] = useState(3);
  const [laminationMarginMm, setLaminationMarginMm] = useState<0 | 2 | 3>(2);
  const [showCropMarks, setShowCropMarks] = useState(true);
  const [showMaskedFooter, setShowMaskedFooter] = useState(false);
  const [zipFormat, setZipFormat] = useState<'jpeg' | 'png'>('jpeg');

  // Copy-protection watermark & Manual Masking drawer
  const [watermark, setWatermark] = useState<WatermarkSettings>(() =>
    createDefaultWatermarkSettings()
  );
  const [showMaskEditor, setShowMaskEditor] = useState(false);

  // Manual Fix Editor with Loupe
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [draftCorners, setDraftCorners] = useState<[Point2D, Point2D, Point2D, Point2D] | null>(
    null
  );
  const [draggingHandle, setDraggingHandle] = useState<number | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    setAadhaarMode('pvc');
    setCustomWidthMm(activeType.widthMm);
    setCustomHeightMm(activeType.heightMm);
    setCornerRadiusMm(activeType.cornerRadiusMm);
  }, [activeType]);

  const activeDimensionsMm = useMemo(() => {
    if (activeType.id === 'custom') {
      return {
        wMm: Math.max(20, customWidthMm),
        hMm: Math.max(20, customHeightMm),
        rMm: Math.max(0, Math.min(10, cornerRadiusMm)),
      };
    }
    if (activeType.supportsPaperPrintMode && aadhaarMode === 'paper') {
      return {
        wMm: Math.max(30, customWidthMm),
        hMm: Math.max(30, customHeightMm),
        rMm: 1.5,
      };
    }
    return {
      wMm: activeType.widthMm,
      hMm: activeType.heightMm,
      rMm: activeType.cornerRadiusMm,
    };
  }, [activeType, aadhaarMode, customWidthMm, customHeightMm, cornerRadiusMm]);

  const outputPixels = useMemo(() => {
    const pxPerMm = dpi / 25.4;
    return {
      w: Math.round(activeDimensionsMm.wMm * pxPerMm),
      h: Math.round(activeDimensionsMm.hMm * pxPerMm),
    };
  }, [activeDimensionsMm, dpi]);

  // Downscaled live preview dimensions (~500px wide for instant 60fps feedback)
  const previewPixels = useMemo(() => {
    const baseW = 500;
    const baseH = Math.round((baseW * activeDimensionsMm.hMm) / activeDimensionsMm.wMm);
    return { w: baseW, h: Math.max(120, baseH) };
  }, [activeDimensionsMm]);

  const selectedCard = useMemo(
    () => cards.find((c) => c.id === selectedCardId) || cards[0] || null,
    [cards, selectedCardId]
  );

  const activeEnhancement: CardEnhancementParams = useMemo(() => {
    if (selectedCard) return selectedCard.enhancement;
    return {
      preset: 'clean',
      ...DEFAULT_ENHANCEMENT_BY_PRESET.clean,
    };
  }, [selectedCard]);

  const makeThumbUrl = useCallback(
    (
      img: HTMLImageElement,
      corners: [Point2D, Point2D, Point2D, Point2D],
      rotation: 0 | 90 | 180 | 270,
      enhancement: CardEnhancementParams,
      trim: number,
      maskRegions: MaskRegion[] = [],
      maskStyle: MaskStyle = 'black',
      wm: WatermarkSettings = watermark
    ): string => {
      const thumbW = 360;
      const thumbH = Math.max(100, Math.round((thumbW * activeDimensionsMm.hMm) / activeDimensionsMm.wMm));
      const c = warpCardPerspective(img, corners, {
        widthPx: thumbW,
        heightPx: thumbH,
        widthMm: activeDimensionsMm.wMm,
        heightMm: activeDimensionsMm.hMm,
        cornerRadiusMm: activeDimensionsMm.rMm,
        trimMm: trim,
        rotation,
        ...enhancement,
      });
      applyMaskRegionsToCanvas(c, maskRegions, maskStyle);
      applyDiagonalWatermarkToCanvas(c, wm);
      const pxPerMm = c.width / Math.max(10, activeDimensionsMm.wMm);
      applyRoundedWhiteMask(c, activeDimensionsMm.rMm * pxPerMm);
      return c.toDataURL('image/jpeg', 0.85);
    },
    [activeDimensionsMm, watermark]
  );

  // Unmasked clean card dataUrl used as background inside CardMaskEditor
  const maskEditorBaseUrl = useMemo(() => {
    if (!showMaskEditor || !selectedCard) return '';
    const photo = photos.find((p) => p.id === selectedCard.photoId);
    if (!photo) return '';
    const w = 480;
    const h = Math.max(120, Math.round((w * activeDimensionsMm.hMm) / activeDimensionsMm.wMm));
    const c = warpCardPerspective(photo.img, selectedCard.corners, {
      widthPx: w,
      heightPx: h,
      widthMm: activeDimensionsMm.wMm,
      heightMm: activeDimensionsMm.hMm,
      cornerRadiusMm: activeDimensionsMm.rMm,
      trimMm,
      rotation: selectedCard.rotation,
      ...selectedCard.enhancement,
    });
    return c.toDataURL('image/jpeg', 0.88);
  }, [showMaskEditor, selectedCard, photos, activeDimensionsMm, trimMm]);

  // Real-time requestAnimationFrame live preview renderer for selectedCard
  useEffect(() => {
    if (!selectedCard) return;
    const photo = photos.find((p) => p.id === selectedCard.photoId);
    if (!photo) return;

    if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);

    rafIdRef.current = requestAnimationFrame(() => {
      const cacheKey = [
        selectedCard.id,
        selectedCard.photoId,
        selectedCard.rotation,
        trimMm.toFixed(2),
        activeDimensionsMm.wMm,
        activeDimensionsMm.hMm,
        selectedCard.corners.map((p) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`).join(';'),
      ].join('|');

      let rawCanvas: HTMLCanvasElement;
      if (rawPreviewCacheRef.current?.key === cacheKey) {
        rawCanvas = rawPreviewCacheRef.current.canvas;
      } else {
        rawCanvas = warpCardRaw(
          photo.img,
          selectedCard.corners,
          previewPixels.w,
          previewPixels.h,
          activeDimensionsMm.wMm,
          activeDimensionsMm.hMm,
          trimMm,
          selectedCard.rotation
        );
        rawPreviewCacheRef.current = { key: cacheKey, canvas: rawCanvas };
      }

      const pxPerMm = rawCanvas.width / Math.max(10, activeDimensionsMm.wMm);
      const radiusPx = activeDimensionsMm.rMm * pxPerMm;

      // Render Before canvas
      if (beforeCanvasRef.current) {
        const bCan = beforeCanvasRef.current;
        bCan.width = rawCanvas.width;
        bCan.height = rawCanvas.height;
        const bCtx = bCan.getContext('2d');
        if (bCtx) {
          bCtx.drawImage(rawCanvas, 0, 0);
          applyRoundedWhiteMask(bCan, radiusPx);
        }
      }

      // Render After canvas (includes enhancements + destructive mask + diagonal watermark)
      if (afterCanvasRef.current) {
        const aCan = afterCanvasRef.current;
        aCan.width = rawCanvas.width;
        aCan.height = rawCanvas.height;
        const aCtx = aCan.getContext('2d');
        if (aCtx) {
          aCtx.drawImage(rawCanvas, 0, 0);
          applyEnhancementsToCanvas(aCan, selectedCard.enhancement);
          applyMaskRegionsToCanvas(aCan, selectedCard.maskRegions, selectedCard.maskStyle);
          applyDiagonalWatermarkToCanvas(aCan, watermark);
          applyRoundedWhiteMask(aCan, radiusPx);
        }
      }
    });

    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    };
  }, [selectedCard, photos, trimMm, activeDimensionsMm, previewPixels, watermark]);

  // Debounced thumbnail sync when trim, dimensions, or watermark change
  useEffect(() => {
    if (cards.length === 0 || photos.length === 0) return;
    const t = setTimeout(() => {
      setCards((prev) =>
        prev.map((c) => {
          const photo = photos.find((p) => p.id === c.photoId);
          if (!photo) return c;
          return {
            ...c,
            effectiveDpi: calculateEffectiveCardDpi(
              photo.img,
              c.corners,
              activeDimensionsMm.wMm,
              activeDimensionsMm.hMm
            ),
            thumbDataUrl: makeThumbUrl(
              photo.img,
              c.corners,
              c.rotation,
              c.enhancement,
              trimMm,
              c.maskRegions,
              c.maskStyle,
              watermark
            ),
          };
        })
      );
    }, 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimMm, activeDimensionsMm.wMm, activeDimensionsMm.hMm, activeDimensionsMm.rMm, watermark]);

  const handleAadhaarModeChange = (mode: 'pvc' | 'paper') => {
    setAadhaarMode(mode);
    if (mode === 'pvc') {
      setCustomWidthMm(85.6);
      setCustomHeightMm(54);
    } else {
      setCustomWidthMm(90);
      setCustomHeightMm(58);
    }
  };

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setDetecting(true);
    setStatusMsg(null);

    try {
      const validFiles = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
      const newPhotos: SourcePhoto[] = [];
      const newCards: CroppedCardItem[] = [];

      const baseEnhancement: CardEnhancementParams = {
        preset: 'clean',
        ...DEFAULT_ENHANCEMENT_BY_PRESET.clean,
      };

      for (const file of validFiles) {
        const img = await loadImageFromFile(file);
        const url = URL.createObjectURL(file);
        const photoId = `ph-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        newPhotos.push({ id: photoId, name: file.name, url, img });

        const detected = autoDetectCards(img);
        detected.forEach((quad, idx) => {
          const cardId = `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const probe = warpCardRaw(
            img,
            quad.corners,
            260,
            164,
            activeDimensionsMm.wMm,
            activeDimensionsMm.hMm,
            trimMm,
            0
          );
          const flaggedFlip = suggestFlip180(probe);
          const initialRot: 0 | 180 = flaggedFlip ? 180 : 0;
          const effDpi = calculateEffectiveCardDpi(
            img,
            quad.corners,
            activeDimensionsMm.wMm,
            activeDimensionsMm.hMm
          );

          const thumbDataUrl = makeThumbUrl(
            img,
            quad.corners,
            initialRot,
            baseEnhancement,
            trimMm,
            [],
            'black',
            watermark
          );

          const inferredSide: 'front' | 'back' | 'none' =
            detected.length === 2 ? (idx === 0 ? 'front' : 'back') : 'none';

          newCards.push({
            id: cardId,
            photoId,
            label: `${file.name.replace(/\.[^.]+$/, '')} #${idx + 1}`,
            corners: quad.corners,
            initialCorners: quad.corners,
            rotation: initialRot,
            side: inferredSide,
            enhancement: { ...baseEnhancement },
            thumbDataUrl,
            orientationStatus: quad.isFallback || flaggedFlip ? 'check' : 'ok',
            effectiveDpi: effDpi,
            maskRegions: [],
            maskStyle: 'black',
            isFallback: quad.isFallback,
          });
        });
      }

      setPhotos((prev) => [...prev, ...newPhotos]);
      setCards((prev) => {
        const merged = [...prev, ...newCards];
        return merged;
      });
      if (!selectedCardId && newCards.length > 0) {
        setSelectedCardId(newCards[0].id);
      }
      if (!referenceCardId && newCards.length > 0) {
        setReferenceCardId(newCards[0].id);
      }
      if (newCards.length > 0) {
        setStatusMsg(
          `Detected ${newCards.length} card(s) across ${newPhotos.length} photo(s).`
        );
      }
    } finally {
      setDetecting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  // Update enhancement on selected card (or all cards if applyToAll is ON)
  const updateEnhancementField = (patch: Partial<CardEnhancementParams>) => {
    if (!selectedCard) return;
    const nextEnh: CardEnhancementParams = {
      ...selectedCard.enhancement,
      ...patch,
    };

    setCards((prev) =>
      prev.map((c) => {
        if (!applyToAll && c.id !== selectedCard.id) return c;
        const photo = photos.find((p) => p.id === c.photoId);
        if (!photo) return { ...c, enhancement: nextEnh };
        return {
          ...c,
          enhancement: { ...nextEnh },
          thumbDataUrl: makeThumbUrl(
            photo.img,
            c.corners,
            c.rotation,
            nextEnh,
            trimMm,
            c.maskRegions,
            c.maskStyle,
            watermark
          ),
        };
      })
    );
  };

  const applyPreset = (preset: EnhancementPreset) => {
    updateEnhancementField({
      preset,
      ...DEFAULT_ENHANCEMENT_BY_PRESET[preset],
    });
  };

  const handleToggleApplyToAll = () => {
    const next = !applyToAll;
    setApplyToAll(next);
    if (next && selectedCard) {
      const enh = selectedCard.enhancement;
      setCards((prev) =>
        prev.map((c) => {
          const photo = photos.find((p) => p.id === c.photoId);
          return {
            ...c,
            enhancement: { ...enh },
            thumbDataUrl: photo
              ? makeThumbUrl(
                  photo.img,
                  c.corners,
                  c.rotation,
                  enh,
                  trimMm,
                  c.maskRegions,
                  c.maskStyle,
                  watermark
                )
              : c.thumbDataUrl,
          };
        })
      );
      setStatusMsg('Applied current enhancement settings to all cards.');
    }
  };

  const updateSelectedCardMask = (
    patch: { maskRegions?: MaskRegion[]; maskStyle?: MaskStyle }
  ) => {
    if (!selectedCard) return;
    const regions = patch.maskRegions ?? selectedCard.maskRegions;
    const style = patch.maskStyle ?? selectedCard.maskStyle;
    const hasAnyMask = regions.length > 0;
    if (hasAnyMask && !showMaskedFooter) {
      setShowMaskedFooter(true);
    }

    setCards((prev) =>
      prev.map((c) => {
        if (c.id !== selectedCard.id) return c;
        const photo = photos.find((p) => p.id === c.photoId);
        return {
          ...c,
          maskRegions: regions,
          maskStyle: style,
          thumbDataUrl: photo
            ? makeThumbUrl(
                photo.img,
                c.corners,
                c.rotation,
                c.enhancement,
                trimMm,
                regions,
                style,
                watermark
              )
            : c.thumbDataUrl,
        };
      })
    );
  };

  // Magnifier Loupe drawing while dragging corner
  useEffect(() => {
    if (
      draggingHandle === null ||
      !draftCorners ||
      !editingCardId ||
      !loupeCanvasRef.current
    ) {
      return;
    }
    const card = cards.find((c) => c.id === editingCardId);
    const photo = card ? photos.find((p) => p.id === card.photoId) : null;
    if (!photo) return;

    const pt = draftCorners[draggingHandle];
    const loupe = loupeCanvasRef.current;
    const ctx = loupe.getContext('2d');
    if (!ctx) return;

    const size = loupe.width;
    const srcX = pt.x * photo.img.naturalWidth;
    const srcY = pt.y * photo.img.naturalHeight;
    const sampleRadius = Math.max(
      24,
      Math.round(Math.min(photo.img.naturalWidth, photo.img.naturalHeight) * 0.08)
    );

    ctx.fillStyle = '#0f2a5c';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(
      photo.img,
      srcX - sampleRadius,
      srcY - sampleRadius,
      sampleRadius * 2,
      sampleRadius * 2,
      0,
      0,
      size,
      size
    );

    ctx.strokeStyle = '#f57c00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size / 2, size);
    ctx.moveTo(0, size / 2);
    ctx.lineTo(size, size / 2);
    ctx.stroke();
  }, [draggingHandle, draftCorners, editingCardId, cards, photos]);

  const openManualFix = (card: CroppedCardItem) => {
    setSelectedCardId(card.id);
    setEditingCardId(card.id);
    setDraftCorners([...card.corners] as [Point2D, Point2D, Point2D, Point2D]);
  };

  const handleCornerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingHandle === null || !editorContainerRef.current || !draftCorners) return;
    const rect = editorContainerRef.current.getBoundingClientRect();
    const nx = Math.min(0.99, Math.max(0.01, (e.clientX - rect.left) / rect.width));
    const ny = Math.min(0.99, Math.max(0.01, (e.clientY - rect.top) / rect.height));
    const next = [...draftCorners] as [Point2D, Point2D, Point2D, Point2D];
    next[draggingHandle] = { x: nx, y: ny };
    setDraftCorners(next);
  };

  const applyManualCorners = () => {
    if (!editingCardId || !draftCorners) return;
    const ordered = orderQuadCorners(draftCorners);
    setCards((prev) =>
      prev.map((c) => {
        if (c.id !== editingCardId) return c;
        const photo = photos.find((p) => p.id === c.photoId);
        if (!photo) return c;
        return {
          ...c,
          corners: ordered,
          isFallback: false,
          effectiveDpi: calculateEffectiveCardDpi(
            photo.img,
            ordered,
            activeDimensionsMm.wMm,
            activeDimensionsMm.hMm
          ),
          thumbDataUrl: makeThumbUrl(
            photo.img,
            ordered,
            c.rotation,
            c.enhancement,
            trimMm,
            c.maskRegions,
            c.maskStyle,
            watermark
          ),
        };
      })
    );
    setEditingCardId(null);
    setDraftCorners(null);
    setDraggingHandle(null);
  };

  const handleAutoRedetectInEditor = () => {
    if (!editingCardId) return;
    const card = cards.find((c) => c.id === editingCardId);
    const photo = card ? photos.find((p) => p.id === card.photoId) : null;
    if (!photo) return;
    const detected = autoDetectCards(photo.img);
    if (detected.length > 0) setDraftCorners(detected[0].corners);
  };

  const handleResetEditorCorners = () => {
    if (!editingCardId) return;
    const card = cards.find((c) => c.id === editingCardId);
    if (!card) return;
    setDraftCorners(
      card.isFallback
        ? createDefaultQuad().corners
        : ([...card.initialCorners] as [Point2D, Point2D, Point2D, Point2D])
    );
  };

  const addManualCardFromPhoto = (photoId: string) => {
    const photo = photos.find((p) => p.id === photoId);
    if (!photo) return;
    const quad = createDefaultQuad(true);
    const cardId = `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const baseEnh: CardEnhancementParams = {
      preset: 'clean',
      ...DEFAULT_ENHANCEMENT_BY_PRESET.clean,
    };
    const newCard: CroppedCardItem = {
      id: cardId,
      photoId,
      label: `${photo.name.replace(/\.[^.]+$/, '')} (Extra)`,
      corners: quad.corners,
      initialCorners: quad.corners,
      rotation: 0,
      side: 'none',
      enhancement: baseEnh,
      thumbDataUrl: makeThumbUrl(photo.img, quad.corners, 0, baseEnh, trimMm, [], 'black', watermark),
      orientationStatus: 'check',
      effectiveDpi: calculateEffectiveCardDpi(
        photo.img,
        quad.corners,
        activeDimensionsMm.wMm,
        activeDimensionsMm.hMm
      ),
      maskRegions: [],
      maskStyle: 'black',
      isFallback: true,
    };
    setCards((prev) => [...prev, newCard]);
    openManualFix(newCard);
  };

  const rotateCard = (cardId: string, delta: 90 | 180) => {
    setCards((prev) =>
      prev.map((c) => {
        if (c.id !== cardId) return c;
        const photo = photos.find((p) => p.id === c.photoId);
        if (!photo) return c;
        const nextRot = ((c.rotation + delta) % 360) as 0 | 90 | 180 | 270;
        return {
          ...c,
          rotation: nextRot,
          orientationStatus: 'ok',
          thumbDataUrl: makeThumbUrl(
            photo.img,
            c.corners,
            nextRot,
            c.enhancement,
            trimMm,
            c.maskRegions,
            c.maskStyle,
            watermark
          ),
        };
      })
    );
  };

  const rotateAll180 = () => {
    setCards((prev) =>
      prev.map((c) => {
        const photo = photos.find((p) => p.id === c.photoId);
        if (!photo) return c;
        const nextRot = ((c.rotation + 180) % 360) as 0 | 90 | 180 | 270;
        return {
          ...c,
          rotation: nextRot,
          orientationStatus: 'ok',
          thumbDataUrl: makeThumbUrl(
            photo.img,
            c.corners,
            nextRot,
            c.enhancement,
            trimMm,
            c.maskRegions,
            c.maskStyle,
            watermark
          ),
        };
      })
    );
    setStatusMsg('Rotated all cards by 180°.');
  };

  const toggleOrientationOk = (cardId: string) => {
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? { ...c, orientationStatus: c.orientationStatus === 'ok' ? 'check' : 'ok' }
          : c
      )
    );
  };

  /**
   * Matches every other card's orientation (0° vs 180°) to the user-marked Reference card
   * using Normalized Cross-Correlation on downscaled 64x40 grayscale buffers.
   */
  const matchOrientationToReference = () => {
    const refCard = cards.find((c) => c.id === referenceCardId) || cards[0];
    if (!refCard) return;
    const refPhoto = photos.find((p) => p.id === refCard.photoId);
    if (!refPhoto) return;

    const refCanvas = warpCardRaw(
      refPhoto.img,
      refCard.corners,
      256,
      160,
      activeDimensionsMm.wMm,
      activeDimensionsMm.hMm,
      trimMm,
      refCard.rotation
    );

    let flippedCount = 0;
    setCards((prev) =>
      prev.map((c) => {
        if (c.id === refCard.id) {
          return { ...c, orientationStatus: 'ok' };
        }
        const photo = photos.find((p) => p.id === c.photoId);
        if (!photo) return c;

        const targetCanvas = warpCardRaw(
          photo.img,
          c.corners,
          256,
          160,
          activeDimensionsMm.wMm,
          activeDimensionsMm.hMm,
          trimMm,
          c.rotation
        );

        const cmp = compareOrientationWithReference(refCanvas, targetCanvas);
        const nextRot = cmp.shouldFlip180
          ? (((c.rotation + 180) % 360) as 0 | 90 | 180 | 270)
          : c.rotation;
        if (cmp.shouldFlip180) flippedCount++;

        return {
          ...c,
          rotation: nextRot,
          orientationStatus: 'ok',
          thumbDataUrl: makeThumbUrl(
            photo.img,
            c.corners,
            nextRot,
            c.enhancement,
            trimMm,
            c.maskRegions,
            c.maskStyle,
            watermark
          ),
        };
      })
    );

    setStatusMsg(
      flippedCount > 0
        ? `Matched orientation to reference: flipped ${flippedCount} upside-down card(s).`
        : 'Matched orientation to reference: all cards already align with the reference.'
    );
  };

  const setCardSide = (cardId: string, side: 'front' | 'back' | 'none') => {
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, side } : c)));
  };

  const deleteCard = (cardId: string) => {
    setCards((prev) => {
      const next = prev.filter((c) => c.id !== cardId);
      if (selectedCardId === cardId) {
        setSelectedCardId(next[0]?.id || null);
      }
      if (referenceCardId === cardId) {
        setReferenceCardId(next[0]?.id || null);
      }
      return next;
    });
    if (editingCardId === cardId) {
      setEditingCardId(null);
      setDraftCorners(null);
    }
  };

  // Full-resolution source export warp + destructive mask + copy-protection watermark
  const exportFullResCardCanvas = (card: CroppedCardItem, forceDpi?: number) => {
    const photo = photos.find((p) => p.id === card.photoId);
    if (!photo) return null;
    const useDpi = forceDpi ?? dpi;
    const pxPerMm = useDpi / 25.4;
    const canvas = warpCardPerspective(photo.img, card.corners, {
      widthPx: Math.round(activeDimensionsMm.wMm * pxPerMm),
      heightPx: Math.round(activeDimensionsMm.hMm * pxPerMm),
      widthMm: activeDimensionsMm.wMm,
      heightMm: activeDimensionsMm.hMm,
      cornerRadiusMm: activeDimensionsMm.rMm,
      trimMm,
      rotation: card.rotation,
      ...card.enhancement,
    });
    applyMaskRegionsToCanvas(canvas, card.maskRegions, card.maskStyle);
    applyDiagonalWatermarkToCanvas(canvas, watermark);
    applyRoundedWhiteMask(canvas, activeDimensionsMm.rMm * pxPerMm);
    return canvas;
  };

  const downloadSingleCard = (card: CroppedCardItem, format: 'jpeg' | 'png') => {
    const canvas = exportFullResCardCanvas(card);
    if (!canvas) return;
    const mime = format === 'png' ? 'image/png' : 'image/jpeg';
    const ext = format === 'png' ? 'png' : 'jpg';
    const sideTag = card.side !== 'none' ? `-${card.side}` : '';
    canvas.toBlob(
      (blob) => {
        if (blob) downloadBlob(blob, `${activeType.id}-${card.label}${sideTag}.${ext}`);
      },
      mime,
      quality
    );
  };

  // Pair Front + Back cards in print order
  const orderedCardsForSheet = useMemo(() => {
    const fronts = cards.filter((c) => c.side === 'front');
    const backs = cards.filter((c) => c.side === 'back');
    const others = cards.filter((c) => c.side === 'none');
    const ordered: CroppedCardItem[] = [];
    const maxPairs = Math.max(fronts.length, backs.length);
    for (let i = 0; i < maxPairs; i++) {
      if (fronts[i]) ordered.push(fronts[i]);
      if (backs[i]) ordered.push(backs[i]);
    }
    ordered.push(...others);
    return ordered;
  }, [cards]);

  const a4Grid = useMemo(
    () =>
      calculateA4Grid({
        cardWMm: activeDimensionsMm.wMm,
        cardHMm: activeDimensionsMm.hMm,
        laminationMarginMm,
        gapMm,
        cardsPerSheet,
        startPosition,
        startSlotOffset,
        cardCount: orderedCardsForSheet.length,
      }),
    [
      activeDimensionsMm,
      laminationMarginMm,
      gapMm,
      cardsPerSheet,
      startPosition,
      startSlotOffset,
      orderedCardsForSheet.length,
    ]
  );

  const sheetPreviewCards: SheetPreviewCard[] = useMemo(
    () =>
      orderedCardsForSheet.map((c) => ({
        id: c.id,
        previewUrl: c.thumbDataUrl,
        side: c.side,
        isRotatedVertical: c.rotation === 90 || c.rotation === 270,
      })),
    [orderedCardsForSheet]
  );

  const downloadAllZip = async () => {
    if (cards.length === 0) return;
    const zip = new JSZip();
    const mime = zipFormat === 'png' ? 'image/png' : 'image/jpeg';
    const ext = zipFormat === 'png' ? 'png' : 'jpg';

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const canvas = exportFullResCardCanvas(card);
      if (!canvas) continue;
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), mime, quality)
      );
      if (blob) {
        const sideTag = card.side !== 'none' ? `-${card.side}` : '';
        zip.file(`${activeType.id}-${i + 1}${sideTag}.${ext}`, blob);
      }
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(zipBlob, `kaajer-${activeType.id}-cards.zip`);
  };

  /**
   * Generates A4 PDF (210 x 297 mm) starting from chosen corner (default top-left 8mm margin),
   * embedding full-res 300 DPI card images and skipping any already-used slots (`startSlotOffset`).
   */
  const downloadA4PrintPdf = async () => {
    if (orderedCardsForSheet.length === 0) return;
    const doc = await PDFDocument.create();
    const a4W = 595.28; // 210 mm
    const a4H = 841.89; // 297 mm
    const mmToPt = 72 / 25.4;

    const page = doc.addPage([a4W, a4H]);

    const drawCropMarks = (x: number, y: number, w: number, h: number) => {
      const tick = 3.2 * mmToPt;
      const off = 0.8 * mmToPt;
      const col = rgb(0.45, 0.52, 0.62);
      const t = 0.5;
      page.drawLine({ start: { x: x - off - tick, y }, end: { x: x - off, y }, thickness: t, color: col });
      page.drawLine({ start: { x, y: y - off - tick }, end: { x, y: y - off }, thickness: t, color: col });
      page.drawLine({ start: { x: x + w + off, y }, end: { x: x + w + off + tick, y }, thickness: t, color: col });
      page.drawLine({ start: { x: x + w, y: y - off - tick }, end: { x: x + w, y: y - off }, thickness: t, color: col });
      page.drawLine({ start: { x: x - off - tick, y: y + h }, end: { x: x - off, y: y + h }, thickness: t, color: col });
      page.drawLine({ start: { x, y: y + h + off }, end: { x, y: y + h + off + tick }, thickness: t, color: col });
      page.drawLine({ start: { x: x + w + off, y: y + h }, end: { x: x + w + off + tick, y: y + h }, thickness: t, color: col });
      page.drawLine({ start: { x: x + w, y: y + h + off }, end: { x: x + w, y: y + h + off + tick }, thickness: t, color: col });
    };

    for (const slot of a4Grid.slots) {
      const cardIdx = slot.slotIndex - startSlotOffset;
      if (cardIdx < 0 || cardIdx >= orderedCardsForSheet.length) continue;
      const cardItem = orderedCardsForSheet[cardIdx];

      const canvas = exportFullResCardCanvas(cardItem, 300);
      if (!canvas) continue;
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob((b) => res(b), 'image/jpeg', Math.max(0.9, quality))
      );
      if (!blob) continue;
      const embedded = await doc.embedJpg(await blob.arrayBuffer());

      const slotX = slot.xMm * mmToPt;
      const slotWpt = slot.slotWMm * mmToPt;
      const slotHpt = slot.slotHMm * mmToPt;
      // Convert top-down mm to PDF bottom-up pt
      const slotY = a4H - (slot.yTopMm + slot.slotHMm) * mmToPt;

      const cardWpt = slot.cardWMm * mmToPt;
      const cardHpt = slot.cardHMm * mmToPt;
      const isVert = canvas.height > canvas.width;
      const drawW = isVert ? cardHpt : cardWpt;
      const drawH = isVert ? cardWpt : cardHpt;
      const imgX = slotX + (slotWpt - drawW) / 2;
      const imgY = slotY + (slotHpt - drawH) / 2;

      if (laminationMarginMm > 0) {
        page.drawRectangle({
          x: slotX,
          y: slotY,
          width: slotWpt,
          height: slotHpt,
          borderColor: rgb(0.84, 0.87, 0.92),
          borderWidth: 0.4,
        });
      }

      page.drawImage(embedded, {
        x: imgX,
        y: imgY,
        width: drawW,
        height: drawH,
      });

      if (showCropMarks) {
        drawCropMarks(slotX, slotY, slotWpt, slotHpt);
      }
    }

    if (showMaskedFooter) {
      const footerText = 'MASKED COPY - VERIFICATION USE ONLY';
      page.drawLine({
        start: { x: 24, y: 24 },
        end: { x: a4W - 24, y: 24 },
        thickness: 0.5,
        color: rgb(0.75, 0.78, 0.84),
      });
      page.drawText(footerText, {
        x: a4W / 2 - footerText.length * 2.5,
        y: 12,
        size: 8.5,
        color: rgb(0.3, 0.35, 0.45),
      });
    }

    const pdfBytes = await doc.save();
    downloadBytes(pdfBytes, `kaajer-${activeType.id}-a4-sheet-300dpi.pdf`);
  };

  const resetAll = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    setPhotos([]);
    setCards([]);
    setSelectedCardId(null);
    setReferenceCardId(null);
    setEditingCardId(null);
    setDraftCorners(null);
    setStartSlotOffset(0);
    setStatusMsg(null);
  };

  const editingCard = cards.find((c) => c.id === editingCardId) || null;
  const editingPhoto = editingCard
    ? photos.find((p) => p.id === editingCard.photoId) || null
    : null;

  return (
    <div className="space-y-5">
      {/* Top Navigation & Quick Card Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBackToHub}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-[var(--card)] border border-[var(--bd)] text-[var(--tx)] text-sm font-semibold hover:border-[#f57c00] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          All Card Types
        </button>

        <div className="flex flex-wrap gap-1.5">
          {CARD_TYPES_CONFIG.map((ct) => (
            <button
              key={ct.id}
              type="button"
              onClick={() => onSelectCardType(ct)}
              className={`px-3 py-1.5 rounded-[9px] text-xs font-semibold cursor-pointer transition-colors ${
                ct.id === activeType.id
                  ? 'bg-[#0f2a5c] text-white dark:bg-[#f57c00]'
                  : 'bg-[var(--card)] border border-[var(--bd)] text-[var(--tx)] hover:border-[#f57c00]'
              }`}
            >
              {ct.icon} {ct.name.replace(' Crop', '')}
            </button>
          ))}
        </div>
      </div>

      {/* Type-Specific Banner */}
      <section
        className="rounded-[22px] p-5 sm:p-7 text-white"
        style={{ background: activeType.gradient }}
      >
        <div className="flex items-center gap-3 mb-1.5">
          <span className="text-3xl">{activeType.icon}</span>
          <h1 className="text-xl sm:text-3xl font-bold m-0">
            {activeType.name} / {activeType.bnName}
          </h1>
        </div>
        <p className="text-sm text-white/95 m-0 mb-1">{activeType.instructions}</p>
        <p className="text-xs text-[#ffe9cf] m-0">{activeType.instructionsBn}</p>
      </section>

      {/* Upload Bar */}
      <section className="bg-[var(--card)] border border-[var(--bd)] rounded-[22px] p-5 space-y-4">
        {activeType.supportsPaperPrintMode && (
          <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-[var(--bd)]">
            <span className="text-xs font-bold text-[var(--mut)] mr-1">
              Aadhaar Mode / ধরন:
            </span>
            <button
              type="button"
              onClick={() => handleAadhaarModeChange('pvc')}
              className={`px-4 py-2 rounded-[10px] text-xs font-bold cursor-pointer ${
                aadhaarMode === 'pvc'
                  ? 'bg-[#0f2a5c] text-white dark:bg-[#f57c00]'
                  : 'bg-[var(--bg)] border border-[var(--bd)]'
              }`}
            >
              PVC Card (85.6 × 54 mm)
            </button>
            <button
              type="button"
              onClick={() => handleAadhaarModeChange('paper')}
              className={`px-4 py-2 rounded-[10px] text-xs font-bold cursor-pointer ${
                aadhaarMode === 'paper'
                  ? 'bg-[#0f2a5c] text-white dark:bg-[#f57c00]'
                  : 'bg-[var(--bg)] border border-[var(--bd)]'
              }`}
            >
              Paper Print / e-Aadhaar (Custom Cutout)
            </button>
          </div>
        )}

        {(activeType.id === 'custom' ||
          (activeType.supportsPaperPrintMode && aadhaarMode === 'paper')) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pb-2 border-b border-[var(--bd)]">
            <div>
              <label className="block text-xs font-bold mb-1">Width (mm)</label>
              <input
                type="number"
                min={20}
                max={200}
                step={0.5}
                value={customWidthMm}
                onChange={(e) => setCustomWidthMm(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Height (mm)</label>
              <input
                type="number"
                min={20}
                max={250}
                step={0.5}
                value={customHeightMm}
                onChange={(e) => setCustomHeightMm(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
              />
            </div>
            {activeType.id === 'custom' && (
              <div>
                <label className="block text-xs font-bold mb-1">Corner Radius (mm)</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.2}
                  value={cornerRadiusMm}
                  onChange={(e) => setCornerRadiusMm(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                />
              </div>
            )}
          </div>
        )}

        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFilesSelected(e.dataTransfer.files);
          }}
          className="border-2 border-dashed border-slate-400/70 hover:border-[#f57c00] hover:bg-[#ff8a00]/5 rounded-[18px] py-7 px-4 text-center cursor-pointer transition-colors"
        >
          <Upload className="w-8 h-8 mx-auto mb-1.5 text-[#f57c00]" />
          <div className="font-bold text-base">
            ছবি দিন বা ড্র্যাগ করুন / Upload Multiple Card Photos
          </div>
          <div className="text-xs text-[var(--mut)] mt-1">
            JPG, PNG, WebP • প্রতিটি ছবিতে ১ থেকে ৪টি কার্ড থাকলেও অটো ডিটেক্ট হবে
          </div>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            accept="image/*"
            multiple
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-sm font-bold bg-[#0f2a5c] hover:bg-[#193d7f] text-white cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            Take Photo (ক্যামেরা)
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            hidden
            accept="image/*"
            capture="environment"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />

          {cards.length > 0 && (
            <button
              type="button"
              onClick={resetAll}
              className="inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-sm font-semibold border border-[var(--bd)] bg-[var(--bg)] hover:border-rose-500 text-rose-600 dark:text-rose-400 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              Clear All / সব মুছুন
            </button>
          )}
        </div>

        {detecting && (
          <div className="flex items-center gap-2 text-sm font-semibold text-[#f57c00]">
            <Loader2 className="w-4 h-4 animate-spin" />
            কার্ড ডিটেক্ট, সোজা ও পরিষ্কার করা হচ্ছে...
          </div>
        )}

        {statusMsg && (
          <div className="rounded-[10px] px-4 py-2.5 text-sm font-semibold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
            ✓ {statusMsg}
          </div>
        )}
      </section>

      {/* Manual Fix Corner Editor with Magnifier Loupe */}
      {editingCard && editingPhoto && draftCorners && (
        <section className="bg-[var(--card)] border-2 border-[#f57c00] rounded-[22px] p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold m-0">
                ✋ Manual Fix / কর্নার ঠিক করুন — {editingCard.label}
              </h2>
              <p className="text-xs text-[var(--mut)] m-0">
                Drag any corner handle; a 2.5× magnifier loupe appears for pixel-accurate alignment.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleAutoRedetectInEditor}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-xs font-bold bg-[#0f2a5c] text-white cursor-pointer"
              >
                <Wand2 className="w-3.5 h-3.5" />
                Auto
              </button>
              <button
                type="button"
                onClick={handleResetEditorCorners}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-xs font-bold border border-[var(--bd)] bg-[var(--bg)] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
              <button
                type="button"
                onClick={applyManualCorners}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-xs font-bold bg-[#f57c00] text-white cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                Apply Crop
              </button>
            </div>
          </div>

          <div className="flex justify-center bg-[var(--bg)] rounded-[16px] p-3">
            <div
              ref={editorContainerRef}
              onPointerMove={handleCornerPointerMove}
              onPointerUp={() => setDraggingHandle(null)}
              onPointerLeave={() => setDraggingHandle(null)}
              className="relative inline-block max-w-full select-none touch-none"
            >
              <img
                src={editingPhoto.url}
                alt={editingPhoto.name}
                draggable={false}
                className="max-h-[460px] w-auto max-w-full block rounded-lg"
              />

              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="absolute inset-0 w-full h-full pointer-events-none"
              >
                <polygon
                  points={draftCorners
                    .map((p) => `${p.x * 100},${p.y * 100}`)
                    .join(' ')}
                  fill="rgba(245, 124, 0, 0.16)"
                  stroke="#f57c00"
                  strokeWidth="0.9"
                />
              </svg>

              {draggingHandle !== null && (
                <div
                  style={{
                    left: `${draftCorners[draggingHandle].x * 100}%`,
                    top: `${Math.max(12, draftCorners[draggingHandle].y * 100 - 18)}%`,
                  }}
                  className="absolute -translate-x-1/2 -translate-y-full pointer-events-none z-20 rounded-full border-[3px] border-[#f57c00] shadow-xl overflow-hidden bg-[#0f2a5c]"
                >
                  <canvas ref={loupeCanvasRef} width={108} height={108} className="block" />
                </div>
              )}

              {draftCorners.map((pt, idx) => (
                <button
                  key={idx}
                  type="button"
                  aria-label={`Corner ${idx + 1}`}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    setDraggingHandle(idx);
                  }}
                  style={{
                    left: `${pt.x * 100}%`,
                    top: `${pt.y * 100}%`,
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 w-11 h-11 rounded-full grid place-items-center touch-none cursor-grab active:cursor-grabbing"
                >
                  <span className="w-6 h-6 rounded-full bg-[#f57c00] border-[3px] border-white shadow-md" />
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* LIVE PREVIEW + STICKY CONTROLS WORKSPACE (Desktop 2-col: Left Sticky Controls, Right Large Preview; Mobile: Sticky Top Preview + Bottom Sheet Sliders) */}
      {selectedCard && (
        <section className="flex flex-col lg:grid lg:grid-cols-12 gap-5 items-start">
          {/* LIVE PREVIEW (Order 1 on Mobile & sticky at top; Order 2 on Desktop Right Column) */}
          <div className="w-full order-1 lg:order-2 lg:col-span-7 sticky top-[54px] z-20 lg:static bg-[var(--card)] border border-[var(--bd)] rounded-[22px] p-4 sm:p-5 shadow-md lg:shadow-none space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#f57c00]">
                  LIVE CARD PREVIEW {applyToAll ? '(Editing All Cards)' : ''}
                </div>
                <div className="font-bold text-sm sm:text-base truncate">
                  {selectedCard.label}
                </div>
              </div>
              <div className="text-xs text-[var(--mut)] tabular-nums">
                Export: {outputPixels.w} × {outputPixels.h} px @ {dpi} DPI
              </div>
            </div>

            {selectedCard.effectiveDpi < 150 && (
              <div className="flex items-center gap-2 rounded-[10px] px-3 py-2 text-xs font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/40">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Low resolution (~{selectedCard.effectiveDpi} DPI), print may look blurry
              </div>
            )}

            {/* Before / After Interactive Split Canvas */}
            <div className="relative w-full max-w-[600px] mx-auto rounded-[14px] overflow-hidden border border-[var(--bd)] bg-white select-none">
              <canvas
                ref={afterCanvasRef}
                className="w-full h-auto block"
              />
              <div
                style={{
                  clipPath: `inset(0 ${100 - splitPercent}% 0 0)`,
                }}
                className="absolute inset-0 pointer-events-none"
              >
                <canvas
                  ref={beforeCanvasRef}
                  className="w-full h-auto block"
                />
              </div>

              {/* Split Vertical Line */}
              <div
                style={{ left: `${splitPercent}%` }}
                className="absolute top-0 bottom-0 w-0.5 bg-[#f57c00] shadow pointer-events-none"
              >
                <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#f57c00] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow">
                  ↔
                </span>
              </div>

              <span className="absolute top-2 left-2 bg-black/70 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                Before
              </span>
              <span className="absolute top-2 right-2 bg-[#0f2a5c]/85 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                After
              </span>
            </div>

            {/* Before/After Split Slider */}
            <div className="flex items-center gap-3 max-w-[600px] mx-auto">
              <span className="text-[11px] font-bold text-[var(--mut)] shrink-0">
                Before / After Split
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={splitPercent}
                onChange={(e) => setSplitPercent(Number(e.target.value))}
                className="w-full accent-[#f57c00]"
              />
              <span className="text-[11px] font-bold tabular-nums w-9 text-right">
                {splitPercent}%
              </span>
            </div>

            {/* Selected Card Quick Action Bar */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => rotateCard(selectedCard.id, 90)}
                className="px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-xs font-bold inline-flex items-center gap-1 cursor-pointer hover:border-[#f57c00]"
              >
                <RotateCw className="w-3.5 h-3.5" />
                90°
              </button>
              <button
                type="button"
                onClick={() => rotateCard(selectedCard.id, 180)}
                className="px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-xs font-bold inline-flex items-center gap-1 cursor-pointer hover:border-[#f57c00]"
              >
                <FlipVertical2 className="w-3.5 h-3.5" />
                Rotate 180°
              </button>
              <button
                type="button"
                onClick={() => openManualFix(selectedCard)}
                className="px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-xs font-bold inline-flex items-center gap-1 cursor-pointer hover:border-[#f57c00]"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Fix Corners
              </button>
              <button
                type="button"
                onClick={() => setShowMaskEditor((v) => !v)}
                className={`px-3 py-2 rounded-[10px] text-xs font-bold inline-flex items-center gap-1 cursor-pointer ${
                  showMaskEditor || selectedCard.maskRegions.length > 0
                    ? 'bg-[#0f2a5c] text-white dark:bg-[#f57c00]'
                    : 'border border-[var(--bd)] bg-[var(--bg)] hover:border-[#f57c00]'
                }`}
              >
                <EyeOff className="w-3.5 h-3.5" />
                Mask Digits {selectedCard.maskRegions.length > 0 ? `(${selectedCard.maskRegions.length})` : ''}
              </button>
              <button
                type="button"
                onClick={() => downloadSingleCard(selectedCard, 'jpeg')}
                className="px-3.5 py-2 rounded-[10px] bg-[#f57c00] hover:bg-[#e06d00] text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                JPG (Full Res)
              </button>
              <button
                type="button"
                onClick={() => downloadSingleCard(selectedCard, 'png')}
                className="px-3.5 py-2 rounded-[10px] bg-[#0f2a5c] hover:bg-[#193d7f] text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                PNG (Full Res)
              </button>
            </div>

            {showMaskEditor && maskEditorBaseUrl && (
              <CardMaskEditor
                previewSrc={maskEditorBaseUrl}
                regions={selectedCard.maskRegions}
                maskStyle={selectedCard.maskStyle}
                onChangeRegions={(maskRegions) => updateSelectedCardMask({ maskRegions })}
                onChangeStyle={(maskStyle) => updateSelectedCardMask({ maskStyle })}
              />
            )}
          </div>

          {/* STICKY LEFT CONTROL PANEL (Desktop Left Sticky / Mobile Bottom Sheet Panel) */}
          <div className="w-full order-2 lg:order-1 lg:col-span-5 lg:sticky lg:top-[72px] bg-[var(--card)] border border-[var(--bd)] rounded-[22px] p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--bd)]">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Sparkles className="w-4 h-4 text-[#f57c00]" />
                Enhancement &amp; Crop Controls
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer bg-[var(--bg)] px-2.5 py-1.5 rounded-lg border border-[var(--bd)]">
                <input
                  type="checkbox"
                  checked={applyToAll}
                  onChange={handleToggleApplyToAll}
                  className="accent-[#f57c00]"
                />
                Apply to all cards
              </label>
            </div>

            {/* Presets */}
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'original' as const, label: 'Original' },
                { id: 'clean' as const, label: 'Clean (Rec.)' },
                { id: 'bw' as const, label: 'B&W Doc' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className={`py-2 px-2 rounded-[10px] text-xs font-bold cursor-pointer transition-colors ${
                    activeEnhancement.preset === p.id
                      ? 'bg-[#0f2a5c] text-white dark:bg-[#f57c00]'
                      : 'bg-[var(--bg)] border border-[var(--bd)] text-[var(--tx)]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Real-time Sliders with Numeric Values + Individual Reset */}
            <div className="space-y-3">
              {/* Brightness */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold">
                    Brightness{' '}
                    <span className="text-[#f57c00] tabular-nums">
                      {activeEnhancement.brightness > 0
                        ? `+${activeEnhancement.brightness}`
                        : activeEnhancement.brightness}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => updateEnhancementField({ brightness: 0 })}
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
                  value={activeEnhancement.brightness}
                  onChange={(e) =>
                    updateEnhancementField({ brightness: Number(e.target.value) })
                  }
                  className="w-full accent-[#f57c00]"
                />
              </div>

              {/* Contrast */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold">
                    Contrast{' '}
                    <span className="text-[#f57c00] tabular-nums">
                      {activeEnhancement.contrast.toFixed(2)}×
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => updateEnhancementField({ contrast: 1 })}
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
                  value={activeEnhancement.contrast}
                  onChange={(e) =>
                    updateEnhancementField({ contrast: Number(e.target.value) })
                  }
                  className="w-full accent-[#f57c00]"
                />
              </div>

              {/* Sharpness */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold">
                    Sharpness{' '}
                    <span className="text-[#f57c00] tabular-nums">
                      {Math.round(activeEnhancement.sharpness * 100)}%
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => updateEnhancementField({ sharpness: 0 })}
                    className="text-[11px] font-semibold text-[var(--mut)] hover:text-[#f57c00] cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={activeEnhancement.sharpness}
                  onChange={(e) =>
                    updateEnhancementField({ sharpness: Number(e.target.value) })
                  }
                  className="w-full accent-[#f57c00]"
                />
              </div>

              {/* White Balance */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold">
                    White Balance{' '}
                    <span className="text-[#f57c00] tabular-nums">
                      {Math.round(activeEnhancement.whiteBalance * 100)}%
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => updateEnhancementField({ whiteBalance: 0 })}
                    className="text-[11px] font-semibold text-[var(--mut)] hover:text-[#f57c00] cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={activeEnhancement.whiteBalance}
                  onChange={(e) =>
                    updateEnhancementField({ whiteBalance: Number(e.target.value) })
                  }
                  className="w-full accent-[#f57c00]"
                />
              </div>

              {/* Shadow Removal */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold">
                    Shadow Removal{' '}
                    <span className="text-[#f57c00] tabular-nums">
                      {Math.round(activeEnhancement.shadowRemoval * 100)}%
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => updateEnhancementField({ shadowRemoval: 0 })}
                    className="text-[11px] font-semibold text-[var(--mut)] hover:text-[#f57c00] cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={activeEnhancement.shadowRemoval}
                  onChange={(e) =>
                    updateEnhancementField({ shadowRemoval: Number(e.target.value) })
                  }
                  className="w-full accent-[#f57c00]"
                />
              </div>

              {/* Trim Edge */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold">
                    Trim Edge{' '}
                    <span className="text-[#f57c00] tabular-nums">
                      {trimMm.toFixed(2)} mm
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setTrimMm(0.75)}
                    className="text-[11px] font-semibold text-[var(--mut)] hover:text-[#f57c00] cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
                <input
                  type="range"
                  min={0}
                  max={3}
                  step={0.25}
                  value={trimMm}
                  onChange={(e) => setTrimMm(Number(e.target.value))}
                  className="w-full accent-[#f57c00]"
                />
              </div>

              {/* Quality & DPI */}
              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-[var(--bd)]">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold">
                      Quality{' '}
                      <span className="text-[#f57c00] tabular-nums">
                        {Math.round(quality * 100)}%
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuality(0.92)}
                      className="text-[11px] font-semibold text-[var(--mut)] hover:text-[#f57c00] cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                  <input
                    type="range"
                    min={0.6}
                    max={1}
                    step={0.02}
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                    className="w-full accent-[#f57c00]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">Export DPI</label>
                  <select
                    value={dpi}
                    onChange={(e) => setDpi(Number(e.target.value) as 200 | 300 | 600)}
                    className="w-full px-2.5 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-xs font-semibold"
                  >
                    <option value={200}>200 DPI</option>
                    <option value={300}>300 DPI (Print)</option>
                    <option value={600}>600 DPI (Ultra)</option>
                  </select>
                </div>
              </div>

              {/* Copy-protection Diagonal Watermark */}
              <WatermarkControls value={watermark} onChange={setWatermark} />
            </div>
          </div>
        </section>
      )}

      {/* Source Photos Strip */}
      {photos.length > 0 && (
        <section className="bg-[var(--card)] border border-[var(--bd)] rounded-[18px] p-4 space-y-2.5">
          <div className="text-xs font-bold text-[var(--mut)]">
            Uploaded Photos ({photos.length}) — Tap "+ Add Card" if a photo has more cards
          </div>
          <div className="flex flex-wrap gap-3">
            {photos.map((ph) => (
              <div
                key={ph.id}
                className="flex items-center gap-2.5 rounded-[12px] border border-[var(--bd)] bg-[var(--bg)] p-2"
              >
                <img src={ph.url} alt={ph.name} className="w-14 h-10 object-cover rounded" />
                <div className="text-xs max-w-[140px] truncate font-semibold">{ph.name}</div>
                <button
                  type="button"
                  onClick={() => addManualCardFromPhoto(ph.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-[#0f2a5c] text-white cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  Add Card
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Thumbnails Grid + Orientation Tools */}
      {cards.length > 0 && (
        <section className="bg-[var(--card)] border border-[var(--bd)] rounded-[22px] p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold m-0">
                Detected Card Thumbnails ({cards.length})
              </h2>
              <p className="text-xs text-[var(--mut)] m-0">
                Click any card thumbnail to edit it in the Live Preview above.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={rotateAll180}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-xs font-bold bg-[var(--bg)] border border-[var(--bd)] hover:border-[#f57c00] cursor-pointer"
              >
                <FlipVertical2 className="w-3.5 h-3.5" />
                Rotate ALL 180°
              </button>

              <button
                type="button"
                onClick={matchOrientationToReference}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-xs font-bold bg-[#0f2a5c] hover:bg-[#193d7f] text-white cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5" />
                Match Orientation to Reference
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((card) => {
              const isSelected = selectedCard?.id === card.id;
              const isRef = referenceCardId === card.id;

              return (
                <div
                  key={card.id}
                  onClick={() => setSelectedCardId(card.id)}
                  className={`rounded-[16px] border-2 p-3.5 flex flex-col gap-2.5 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-[#f57c00] bg-[#f57c00]/5'
                      : 'border-[var(--bd)] bg-[var(--bg)] hover:border-slate-400'
                  }`}
                >
                  <div className="relative rounded-xl overflow-hidden bg-white border border-[var(--bd)]">
                    <img
                      src={card.thumbDataUrl}
                      alt={card.label}
                      className="w-full h-auto block"
                    />

                    {/* Side Tag */}
                    {card.side !== 'none' && (
                      <span
                        className={`absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold text-white ${
                          card.side === 'front' ? 'bg-[#0f2a5c]' : 'bg-[#f57c00]'
                        }`}
                      >
                        {card.side === 'front' ? 'FRONT' : 'BACK'}
                      </span>
                    )}

                    {/* Orientation Status Badge (One-tap toggle/fix) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (card.orientationStatus === 'check') {
                          rotateCard(card.id, 180);
                        } else {
                          toggleOrientationOk(card.id);
                        }
                      }}
                      title={
                        card.orientationStatus === 'check'
                          ? 'Tap to flip 180° and mark OK'
                          : 'Orientation OK'
                      }
                      className={`absolute top-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer ${
                        card.orientationStatus === 'ok'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-amber-500 text-[#3a2a00]'
                      }`}
                    >
                      {card.orientationStatus === 'ok' ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" /> OK
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3 h-3" /> Check (180°)
                        </>
                      )}
                    </button>
                  </div>

                  {/* Low-res warning on thumbnail */}
                  {card.effectiveDpi < 150 && (
                    <div className="text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      Low resolution (~{card.effectiveDpi} DPI)
                    </div>
                  )}

                  {/* Reference + Front/Back Controls */}
                  <div className="flex items-center justify-between gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReferenceCardId(card.id);
                        setCards((prev) =>
                          prev.map((x) =>
                            x.id === card.id ? { ...x, orientationStatus: 'ok' } : x
                          )
                        );
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                        isRef
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[var(--card)] border border-[var(--bd)] text-[var(--mut)]'
                      }`}
                    >
                      {isRef ? '✓ Reference' : 'Set Reference'}
                    </button>

                    {activeType.hasFrontBack && (
                      <div className="flex gap-1">
                        {(['front', 'back', 'none'] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCardSide(card.id, s);
                            }}
                            className={`px-2 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer ${
                              card.side === s
                                ? 'bg-[#0f2a5c] text-white dark:bg-[#f57c00]'
                                : 'bg-[var(--card)] border border-[var(--bd)]'
                            }`}
                          >
                            {s === 'front' ? 'Front' : s === 'back' ? 'Back' : '—'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Rotate / Fix / Delete */}
                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        rotateCard(card.id, 90);
                      }}
                      className="py-2 rounded-lg border border-[var(--bd)] bg-[var(--card)] text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer hover:border-[#f57c00]"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      90°
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        rotateCard(card.id, 180);
                      }}
                      className="py-2 rounded-lg border border-[var(--bd)] bg-[var(--card)] text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer hover:border-[#f57c00]"
                    >
                      <FlipVertical2 className="w-3.5 h-3.5" />
                      180°
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openManualFix(card);
                      }}
                      className="py-2 rounded-lg border border-[var(--bd)] bg-[var(--card)] text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer hover:border-[#f57c00]"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      Fix
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCard(card.id);
                      }}
                      className="py-2 rounded-lg border border-[var(--bd)] bg-[var(--card)] text-rose-600 text-xs font-semibold flex items-center justify-center cursor-pointer hover:border-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* A4 Print Sheet Panel (Top-Left Default + Live A4 Preview) */}
      {cards.length > 0 && (
        <A4PrintSheetPanel
          grid={a4Grid}
          orderedCards={sheetPreviewCards}
          cardsPerSheet={cardsPerSheet}
          onChangeCardsPerSheet={(n) => {
            setCardsPerSheet(n);
            if (startSlotOffset >= n) setStartSlotOffset(0);
          }}
          startPosition={startPosition}
          onChangeStartPosition={setStartPosition}
          startSlotOffset={startSlotOffset}
          onChangeStartSlotOffset={setStartSlotOffset}
          laminationMarginMm={laminationMarginMm}
          onChangeLaminationMarginMm={setLaminationMarginMm}
          gapMm={gapMm}
          onChangeGapMm={setGapMm}
          showCropMarks={showCropMarks}
          onToggleCropMarks={setShowCropMarks}
          showMaskedFooter={showMaskedFooter}
          onToggleMaskedFooter={setShowMaskedFooter}
          zipFormat={zipFormat}
          onChangeZipFormat={setZipFormat}
          onDownloadA4Pdf={downloadA4PrintPdf}
          onDownloadAllZip={downloadAllZip}
          onAddMoreCards={() => fileInputRef.current?.click()}
        />
      )}

      {/* Privacy Note */}
      <div className="rounded-[12px] px-4 py-3 text-[13px] bg-[#e8f1ff] text-[#1e3a8a] dark:bg-[#172747] dark:text-[#bfd6ff] border border-[#c8dcfb] dark:border-[#2a4273]">
        🔒 <strong>Photos are processed in your browser and are never uploaded or stored.</strong>{' '}
        <span className="opacity-85">
          (আপনার কার্ডের ছবি সম্পূর্ণ আপনার ব্রাউজারেই প্রসেস হয়, কোথাও আপলোড বা সেভ করা হয় না।)
        </span>
      </div>
    </div>
  );
};
