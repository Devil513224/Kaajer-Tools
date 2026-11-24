import React from 'react';
import { Calendar, ShieldCheck } from 'lucide-react';
import {
  WatermarkColor,
  WatermarkDensity,
  WatermarkSettings,
  getFormattedTodayDate,
} from '../utils/canvasOverlays';

interface WatermarkControlsProps {
  value: WatermarkSettings;
  onChange: (next: WatermarkSettings) => void;
}

export const WatermarkControls: React.FC<WatermarkControlsProps> = ({ value, onChange }) => {
  const applyTodaysDate = () => {
    const today = getFormattedTodayDate();
    const dateRegex = /\b\d{2}-\d{2}-\d{4}\b/;
    const nextText = dateRegex.test(value.text)
      ? value.text.replace(dateRegex, today)
      : value.text.trim()
        ? `${value.text.trim()}, ${today}`
        : `Only for Bank KYC, ${today}`;
    onChange({ ...value, enabled: true, text: nextText });
  };

  return (
    <div className="rounded-[16px] border border-[var(--bd)] bg-[var(--bg)] p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="inline-flex items-center gap-2 text-sm font-bold cursor-pointer">
          <input
            type="checkbox"
            checked={value.enabled}
            onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
            className="w-4 h-4 accent-[#f57c00]"
          />
          <ShieldCheck className="w-4 h-4 text-[#f57c00]" />
          <span>Add copy-protection watermark</span>
        </label>

        <button
          type="button"
          onClick={applyTodaysDate}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-[#0f2a5c] text-white cursor-pointer hover:bg-[#193d7f]"
        >
          <Calendar className="w-3 h-3" />
          Today&apos;s Date
        </button>
      </div>

      {value.enabled && (
        <div className="space-y-3 pt-1">
          <div>
            <label className="block text-xs font-bold mb-1">
              Watermark Text (কপি সুরক্ষা লেখা)
            </label>
            <input
              type="text"
              value={value.text}
              onChange={(e) => onChange({ ...value, text: e.target.value })}
              placeholder="Only for Bank KYC, 24-11-2026"
              className="w-full px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--card)] text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-bold">Opacity</span>
                <span className="font-bold text-[#f57c00] tabular-nums">{value.opacity}%</span>
              </div>
              <input
                type="range"
                min={5}
                max={60}
                step={1}
                value={value.opacity}
                onChange={(e) => onChange({ ...value, opacity: Number(e.target.value) })}
                className="w-full accent-[#f57c00]"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-bold">Text Size</span>
                <span className="font-bold text-[#f57c00] tabular-nums">{value.size}px</span>
              </div>
              <input
                type="range"
                min={10}
                max={36}
                step={1}
                value={value.size}
                onChange={(e) => onChange({ ...value, size: Number(e.target.value) })}
                className="w-full accent-[#f57c00]"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-bold">Tilt Angle</span>
                <span className="font-bold text-[#f57c00] tabular-nums">{value.angleDeg}°</span>
              </div>
              <input
                type="range"
                min={30}
                max={45}
                step={1}
                value={value.angleDeg}
                onChange={(e) => onChange({ ...value, angleDeg: Number(e.target.value) })}
                className="w-full accent-[#f57c00]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">Density</label>
              <div className="grid grid-cols-3 gap-1">
                {(['low', 'medium', 'high'] as WatermarkDensity[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onChange({ ...value, density: d })}
                    className={`py-1.5 rounded-lg text-[11px] font-bold capitalize cursor-pointer ${
                      value.density === d
                        ? 'bg-[#0f2a5c] text-white dark:bg-[#f57c00]'
                        : 'bg-[var(--card)] border border-[var(--bd)]'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1">Colour</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: 'grey' as WatermarkColor, label: 'Grey', swatch: '#475569' },
                { id: 'red' as WatermarkColor, label: 'Red', swatch: '#dc2626' },
                { id: 'blue' as WatermarkColor, label: 'Navy Blue', swatch: '#0f2a5c' },
              ]).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onChange({ ...value, color: c.id })}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    value.color === c.id
                      ? 'bg-[#f57c00] text-white'
                      : 'bg-[var(--card)] border border-[var(--bd)]'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full border border-white/60"
                    style={{ backgroundColor: c.swatch }}
                  />
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
