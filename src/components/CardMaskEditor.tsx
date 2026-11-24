import React, { useRef, useState } from 'react';
import { EyeOff, Plus, Trash2, X } from 'lucide-react';
import { MaskRegion, MaskStyle } from '../utils/canvasOverlays';

interface CardMaskEditorProps {
  previewSrc: string;
  regions: MaskRegion[];
  maskStyle: MaskStyle;
  onChangeRegions: (next: MaskRegion[]) => void;
  onChangeStyle: (style: MaskStyle) => void;
}

type InteractionState =
  | { type: 'draw'; startX: number; startY: number; currX: number; currY: number }
  | { type: 'move'; id: string; startX: number; startY: number; origX: number; origY: number }
  | { type: 'resize'; id: string; startX: number; startY: number; origW: number; origH: number };

export const CardMaskEditor: React.FC<CardMaskEditorProps> = ({
  previewSrc,
  regions,
  maskStyle,
  onChangeRegions,
  onChangeStyle,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [interaction, setInteraction] = useState<InteractionState | null>(null);
  const [selectedRectId, setSelectedRectId] = useState<string | null>(null);

  const getNormPos = (e: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handleContainerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget && (e.target as HTMLElement).dataset.role !== 'bg-layer') {
      return;
    }
    const pt = getNormPos(e);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setInteraction({
      type: 'draw',
      startX: pt.x,
      startY: pt.y,
      currX: pt.x,
      currY: pt.y,
    });
  };

  const handleContainerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interaction) return;
    const pt = getNormPos(e);

    if (interaction.type === 'draw') {
      setInteraction({ ...interaction, currX: pt.x, currY: pt.y });
      return;
    }

    if (interaction.type === 'move') {
      const dx = pt.x - interaction.startX;
      const dy = pt.y - interaction.startY;
      onChangeRegions(
        regions.map((r) => {
          if (r.id !== interaction.id) return r;
          return {
            ...r,
            x: Math.min(1 - r.w, Math.max(0, interaction.origX + dx)),
            y: Math.min(1 - r.h, Math.max(0, interaction.origY + dy)),
          };
        })
      );
      return;
    }

    if (interaction.type === 'resize') {
      const dx = pt.x - interaction.startX;
      const dy = pt.y - interaction.startY;
      onChangeRegions(
        regions.map((r) => {
          if (r.id !== interaction.id) return r;
          return {
            ...r,
            w: Math.min(1 - r.x, Math.max(0.05, interaction.origW + dx)),
            h: Math.min(1 - r.y, Math.max(0.05, interaction.origH + dy)),
          };
        })
      );
    }
  };

  const finishInteraction = () => {
    if (!interaction) return;
    if (interaction.type === 'draw') {
      const x = Math.min(interaction.startX, interaction.currX);
      const y = Math.min(interaction.startY, interaction.currY);
      const w = Math.abs(interaction.currX - interaction.startX);
      const h = Math.abs(interaction.currY - interaction.startY);
      if (w >= 0.03 && h >= 0.03) {
        const newRect: MaskRegion = {
          id: `mask-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          x,
          y,
          w,
          h,
        };
        onChangeRegions([...regions, newRect]);
        setSelectedRectId(newRect.id);
      }
    }
    setInteraction(null);
  };

  const addFirst8DigitsPreset = () => {
    const presetRect: MaskRegion = {
      id: `mask-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      x: 0.27,
      y: 0.72,
      w: 0.34,
      h: 0.11,
    };
    onChangeRegions([...regions, presetRect]);
    setSelectedRectId(presetRect.id);
  };

  const drawBox =
    interaction?.type === 'draw'
      ? {
          x: Math.min(interaction.startX, interaction.currX),
          y: Math.min(interaction.startY, interaction.currY),
          w: Math.abs(interaction.currX - interaction.startX),
          h: Math.abs(interaction.currY - interaction.startY),
        }
      : null;

  return (
    <div className="rounded-[18px] border border-[var(--bd)] bg-[var(--bg)] p-4 space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold m-0 flex items-center gap-1.5">
            <EyeOff className="w-4 h-4 text-[#f57c00]" />
            Manual Aadhaar / ID Masking (গোপন অংশ ঢাকুন)
          </h3>
          <p className="text-[11px] text-[var(--mut)] m-0 mt-0.5">
            Drag with finger or mouse directly on the card to hide sensitive numbers permanently on export. Zero OCR.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={addFirst8DigitsPreset}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#0f2a5c] hover:bg-[#193d7f] text-white cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Mask first 8 digits
          </button>
          {regions.length > 0 && (
            <button
              type="button"
              onClick={() => onChangeRegions([])}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-[var(--bd)] bg-[var(--card)] text-rose-600 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear ({regions.length})
            </button>
          )}
        </div>
      </div>

      {/* Fill Style Selector */}
      <div>
        <label className="block text-[11px] font-bold text-[var(--mut)] mb-1">
          Mask Fill Style (Permanent on Export)
        </label>
        <div className="grid grid-cols-4 gap-1.5">
          {([
            { id: 'black' as MaskStyle, label: 'Solid Black' },
            { id: 'white' as MaskStyle, label: 'Solid White' },
            { id: 'blur' as MaskStyle, label: 'Blur' },
            { id: 'pixelate' as MaskStyle, label: 'Pixelate' },
          ]).map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => onChangeStyle(st.id)}
              className={`py-2 px-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                maskStyle === st.id
                  ? 'bg-[#f57c00] text-white'
                  : 'bg-[var(--card)] border border-[var(--bd)]'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Touch-Friendly Drawing Canvas */}
      <div className="flex justify-center">
        <div
          ref={containerRef}
          onPointerDown={handleContainerPointerDown}
          onPointerMove={handleContainerPointerMove}
          onPointerUp={finishInteraction}
          onPointerCancel={finishInteraction}
          className="relative w-full max-w-[460px] rounded-[12px] overflow-hidden border-2 border-dashed border-[#0f2a5c]/40 bg-white select-none touch-none cursor-crosshair"
        >
          <img
            src={previewSrc}
            alt="Mask drawing preview"
            data-role="bg-layer"
            draggable={false}
            className="w-full h-auto block pointer-events-none"
          />

          {/* Existing mask rectangles (draggable + resizable + delete button) */}
          {regions.map((r) => {
            const isSel = selectedRectId === r.id;
            return (
              <div
                key={r.id}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setSelectedRectId(r.id);
                  const pt = getNormPos(e);
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  setInteraction({
                    type: 'move',
                    id: r.id,
                    startX: pt.x,
                    startY: pt.y,
                    origX: r.x,
                    origY: r.y,
                  });
                }}
                style={{
                  left: `${r.x * 100}%`,
                  top: `${r.y * 100}%`,
                  width: `${r.w * 100}%`,
                  height: `${r.h * 100}%`,
                }}
                className={`absolute border-2 cursor-move ${
                  isSel
                    ? 'border-[#f57c00] bg-[#f57c00]/25'
                    : 'border-[#0f2a5c] bg-[#0f2a5c]/20'
                }`}
              >
                {/* Delete rectangle button */}
                <button
                  type="button"
                  aria-label="Delete mask region"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChangeRegions(regions.filter((item) => item.id !== r.id));
                  }}
                  className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-rose-600 text-white grid place-items-center shadow cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                {/* Bottom-Right Resize Handle (touch-friendly) */}
                <div
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setSelectedRectId(r.id);
                    const pt = getNormPos(e);
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    setInteraction({
                      type: 'resize',
                      id: r.id,
                      startX: pt.x,
                      startY: pt.y,
                      origW: r.w,
                      origH: r.h,
                    });
                  }}
                  className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full bg-[#f57c00] border-2 border-white shadow cursor-nwse-resize grid place-items-center text-[9px] font-bold text-white"
                >
                  ↘
                </div>
              </div>
            );
          })}

          {/* Currently drawing rubberband */}
          {drawBox && (
            <div
              style={{
                left: `${drawBox.x * 100}%`,
                top: `${drawBox.y * 100}%`,
                width: `${drawBox.w * 100}%`,
                height: `${drawBox.h * 100}%`,
              }}
              className="absolute border-2 border-dashed border-[#f57c00] bg-[#f57c00]/20 pointer-events-none"
            />
          )}
        </div>
      </div>
    </div>
  );
};
