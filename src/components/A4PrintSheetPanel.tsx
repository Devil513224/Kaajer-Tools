import React from 'react';
import { FolderArchive, Plus, Printer } from 'lucide-react';
import { A4GridCalculation, A4StartPosition } from '../utils/a4SheetLayout';

export interface SheetPreviewCard {
  id: string;
  previewUrl: string;
  side: 'front' | 'back' | 'none';
  isRotatedVertical: boolean;
}

interface A4PrintSheetPanelProps {
  grid: A4GridCalculation;
  orderedCards: SheetPreviewCard[];
  cardsPerSheet: number;
  onChangeCardsPerSheet: (n: number) => void;
  startPosition: A4StartPosition;
  onChangeStartPosition: (pos: A4StartPosition) => void;
  startSlotOffset: number;
  onChangeStartSlotOffset: (offset: number) => void;
  laminationMarginMm: 0 | 2 | 3;
  onChangeLaminationMarginMm: (m: 0 | 2 | 3) => void;
  gapMm: number;
  onChangeGapMm: (g: number) => void;
  showCropMarks: boolean;
  onToggleCropMarks: (val: boolean) => void;
  showMaskedFooter: boolean;
  onToggleMaskedFooter: (val: boolean) => void;
  zipFormat: 'jpeg' | 'png';
  onChangeZipFormat: (fmt: 'jpeg' | 'png') => void;
  onDownloadA4Pdf: () => void;
  onDownloadAllZip: () => void;
  onAddMoreCards: () => void;
}

export const A4PrintSheetPanel: React.FC<A4PrintSheetPanelProps> = ({
  grid,
  orderedCards,
  cardsPerSheet,
  onChangeCardsPerSheet,
  startPosition,
  onChangeStartPosition,
  startSlotOffset,
  onChangeStartSlotOffset,
  laminationMarginMm,
  onChangeLaminationMarginMm,
  gapMm,
  onChangeGapMm,
  showCropMarks,
  onToggleCropMarks,
  showMaskedFooter,
  onToggleMaskedFooter,
  zipFormat,
  onChangeZipFormat,
  onDownloadA4Pdf,
  onDownloadAllZip,
  onAddMoreCards,
}) => {
  const placedCount = Math.min(
    orderedCards.length,
    Math.max(0, grid.maxSlots - startSlotOffset)
  );

  return (
    <section className="rounded-[22px] border border-[var(--bd)] bg-[var(--card)] p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold m-0">
            🖨️ A4 Print &amp; Lamination Sheet (210 × 297 mm • 300 DPI)
          </h3>
          <p className="text-xs text-[var(--mut)] m-0 mt-0.5 tabular-nums">
            Margin: {grid.edgeMarginMm} mm · Gap: {gapMm} mm · Placed: {placedCount} card(s) ·{' '}
            <strong className="text-[#0f2a5c] dark:text-[#ffb347]">
              Remaining space: {grid.remainingFreeSlots} free slot(s) (~{grid.remainingHeightMm} mm unused)
            </strong>
          </p>
        </div>

        <button
          type="button"
          onClick={onAddMoreCards}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-xs font-bold bg-[#0f2a5c] hover:bg-[#193d7f] text-white cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Add More Cards to Sheet
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Controls Column */}
        <div className="lg:col-span-7 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold mb-1">Start Position / কোথা থেকে শুরু</label>
              <select
                value={startPosition}
                onChange={(e) => onChangeStartPosition(e.target.value as A4StartPosition)}
                className="w-full px-3 py-2.5 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
              >
                <option value="top-left">Top-Left (Default — 8 mm edge)</option>
                <option value="top-right">Top-Right (8 mm edge)</option>
                <option value="bottom-left">Bottom-Left (8 mm edge)</option>
                <option value="bottom-right">Bottom-Right (8 mm edge)</option>
                <option value="center">Center on A4</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">Cards Per Sheet / প্রতি পাতায় কার্ড</label>
              <select
                value={cardsPerSheet}
                onChange={(e) => onChangeCardsPerSheet(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
              >
                <option value={8}>8 Cards (Max A4 — 4 Pairs)</option>
                <option value={6}>6 Cards (3 Pairs)</option>
                <option value={4}>4 Cards (2 Pairs)</option>
                <option value={2}>2 Cards (Front &amp; Back)</option>
                <option value={1}>1 Card</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">
                Start at Slot # (Reuse same sheet)
              </label>
              <select
                value={startSlotOffset}
                onChange={(e) => onChangeStartSlotOffset(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
              >
                {Array.from({ length: Math.max(1, grid.maxSlots) }, (_, idx) => (
                  <option key={idx} value={idx}>
                    Slot #{idx + 1} {idx === 0 ? '(Fresh Sheet)' : `(Skip first ${idx} used)`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">
                Lamination Margin (White Border)
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {([0, 2, 3] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onChangeLaminationMarginMm(m)}
                    className={`py-2.5 rounded-[10px] text-xs font-bold cursor-pointer ${
                      laminationMarginMm === m
                        ? 'bg-[#0f2a5c] text-white dark:bg-[#f57c00]'
                        : 'bg-[var(--bg)] border border-[var(--bd)]'
                    }`}
                  >
                    {m} mm
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">
                Card Gap ({gapMm} mm)
              </label>
              <input
                type="range"
                min={3}
                max={5}
                step={0.5}
                value={gapMm}
                onChange={(e) => onChangeGapMm(Number(e.target.value))}
                className="w-full mt-2 accent-[#f57c00]"
              />
            </div>

            <div className="flex flex-wrap items-end gap-4">
              <label className="inline-flex items-center gap-2 text-sm font-semibold cursor-pointer py-2">
                <input
                  type="checkbox"
                  checked={showCropMarks}
                  onChange={(e) => onToggleCropMarks(e.target.checked)}
                  className="accent-[#f57c00]"
                />
                Thin Crop Marks
              </label>

              <label className="inline-flex items-center gap-2 text-sm font-semibold cursor-pointer py-2">
                <input
                  type="checkbox"
                  checked={showMaskedFooter}
                  onChange={(e) => onToggleMaskedFooter(e.target.checked)}
                  className="accent-[#f57c00]"
                />
                &ldquo;Masked copy&rdquo; footer label
              </label>
            </div>
          </div>

          <div className="rounded-[12px] bg-[var(--bg)] border border-[var(--bd)] p-3 text-xs text-[var(--mut)] leading-relaxed">
            💡 <strong>Tip:</strong> Print at <strong>100% / Actual Size</strong> (do not select "Fit to page"). Empty space below stays blank so you can feed the same sheet again starting at the next free slot.
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onDownloadA4Pdf}
              className="inline-flex items-center gap-2 rounded-[10px] px-5 py-3 text-sm font-bold bg-[#f57c00] hover:bg-[#e06d00] text-white cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Download A4 Print Sheet (PDF)
            </button>

            <div className="flex items-center gap-2">
              <select
                value={zipFormat}
                onChange={(e) => onChangeZipFormat(e.target.value as 'jpeg' | 'png')}
                className="px-3 py-3 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-xs font-semibold"
              >
                <option value="jpeg">ZIP as JPG</option>
                <option value="png">ZIP as PNG</option>
              </select>
              <button
                type="button"
                onClick={onDownloadAllZip}
                className="inline-flex items-center gap-2 rounded-[10px] px-4 py-3 text-sm font-bold bg-[#0f2a5c] hover:bg-[#193d7f] text-white cursor-pointer"
              >
                <FolderArchive className="w-4 h-4" />
                Download All (ZIP)
              </button>
            </div>
          </div>
        </div>

        {/* Live A4 Page Preview */}
        <div className="lg:col-span-5 flex flex-col items-center bg-[var(--bg)] border border-[var(--bd)] rounded-[16px] p-4">
          <div className="w-full flex items-center justify-between text-xs font-semibold text-[var(--mut)] mb-2">
            <span>Live A4 Sheet Preview</span>
            <span className="tabular-nums">210 × 297 mm</span>
          </div>

          <div
            className="relative w-full max-w-[290px] bg-white border border-slate-300 shadow-md overflow-hidden"
            style={{ aspectRatio: '210 / 297' }}
          >
            {/* Slots */}
            {grid.slots.map((slot) => {
              const cardIdx = slot.slotIndex - startSlotOffset;
              const placed =
                cardIdx >= 0 && cardIdx < orderedCards.length ? orderedCards[cardIdx] : null;
              const isSkipped = slot.slotIndex < startSlotOffset;

              const leftPct = (slot.xMm / grid.pageWMm) * 100;
              const topPct = (slot.yTopMm / grid.pageHMm) * 100;
              const wPct = (slot.slotWMm / grid.pageWMm) * 100;
              const hPct = (slot.slotHMm / grid.pageHMm) * 100;
              const padPctX =
                slot.slotWMm > 0 ? (laminationMarginMm / slot.slotWMm) * 100 : 0;
              const padPctY =
                slot.slotHMm > 0 ? (laminationMarginMm / slot.slotHMm) * 100 : 0;

              return (
                <div
                  key={slot.slotIndex}
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    width: `${wPct}%`,
                    height: `${hPct}%`,
                    padding: `${padPctY}% ${padPctX}%`,
                  }}
                  className={`absolute box-border ${
                    placed
                      ? 'bg-white border border-slate-300'
                      : isSkipped
                        ? 'border border-dashed border-slate-300 bg-slate-100/70'
                        : 'border border-dashed border-slate-200/90'
                  }`}
                >
                  {placed ? (
                    <div className="relative w-full h-full overflow-hidden">
                      <img
                        src={placed.previewUrl}
                        alt={`Slot ${slot.slotIndex + 1}`}
                        className="w-full h-full object-contain block"
                      />
                      {placed.side !== 'none' && (
                        <span
                          className={`absolute top-0.5 left-0.5 px-1 py-0 text-[8px] font-bold text-white rounded-sm ${
                            placed.side === 'front' ? 'bg-[#0f2a5c]' : 'bg-[#f57c00]'
                          }`}
                        >
                          {placed.side.toUpperCase()}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="w-full h-full grid place-items-center text-[8px] font-semibold text-slate-400 tabular-nums">
                      {isSkipped ? `Used #${slot.slotIndex + 1}` : `Free #${slot.slotIndex + 1}`}
                    </div>
                  )}

                  {/* Crop mark corner ticks */}
                  {showCropMarks && placed && (
                    <>
                      <span className="absolute -top-[3px] left-0 w-[1px] h-[3px] bg-slate-500" />
                      <span className="absolute -top-[3px] right-0 w-[1px] h-[3px] bg-slate-500" />
                      <span className="absolute -bottom-[3px] left-0 w-[1px] h-[3px] bg-slate-500" />
                      <span className="absolute -bottom-[3px] right-0 w-[1px] h-[3px] bg-slate-500" />
                    </>
                  )}
                </div>
              );
            })}

            {showMaskedFooter && (
              <div className="absolute bottom-1.5 left-2 right-2 text-center text-[8px] font-bold tracking-wide text-slate-600 border-t border-slate-200 pt-0.5">
                MASKED COPY — VERIFICATION USE ONLY
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
