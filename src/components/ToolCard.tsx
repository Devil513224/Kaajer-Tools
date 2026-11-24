import React from 'react';
import { Star } from 'lucide-react';
import { TOOL_GRADIENTS } from '../config/toolsConfig';
import { ToolItem } from '../types/tools';

interface GradientToolCardProps {
  tool: ToolItem;
  index: number;
  onSelect: (tool: ToolItem) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (toolId: string) => void;
}

export const GradientToolCard: React.FC<GradientToolCardProps> = ({
  tool,
  index,
  onSelect,
  isFavorite = false,
  onToggleFavorite,
}) => {
  const isFree = tool.group === 'free';
  const bg = tool.gradient || TOOL_GRADIENTS[index % TOOL_GRADIENTS.length];
  const ribbonLabel = tool.ribbonText || (isFree ? 'FREE TOOL' : 'PREMIUM');

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={() => onSelect(tool)}
        style={{ background: bg }}
        className="relative overflow-hidden rounded-[16px] p-5 text-left text-white flex items-center gap-3.5 min-h-[104px] cursor-pointer transition-transform duration-150 group-hover:-translate-y-1 shadow-sm group-hover:shadow-md focus-visible:outline-2 focus-visible:outline-[#ffb347] w-full"
      >
        {tool.isNew && (
          <span className="absolute top-2 left-2 bg-[#ffb347] text-[#3a2a00] text-[10px] font-bold px-2 py-0.5 rounded-[6px] tracking-wide">
            NEW
          </span>
        )}

        <span
          className={`absolute top-[11px] -right-[32px] rotate-45 text-[9px] font-bold px-[34px] py-[2px] tracking-wider ${
            isFree ? 'bg-[#0f2a5c] text-white' : 'bg-[#ffb347] text-[#3a2a00]'
          }`}
        >
          {ribbonLabel}
        </span>

        <div className="w-[46px] h-[46px] rounded-[12px] bg-white/20 grid place-items-center text-2xl shrink-0 group-hover:scale-105 transition-transform">
          {tool.icon}
        </div>

        <div className="min-w-0 pr-8">
          <h3 className="m-0 mb-1 text-[16px] font-bold leading-snug text-white">
            {tool.title}
          </h3>
          <p className="m-0 text-[12px] text-white/90 leading-snug">{tool.subtitle}</p>
        </div>
      </button>

      {onToggleFavorite && (
        <button
          type="button"
          aria-label={isFavorite ? `Remove ${tool.title} from favourites` : `Add ${tool.title} to favourites`}
          title={isFavorite ? 'Remove favourite' : 'Add to favourites'}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(tool.id);
          }}
          className={`absolute bottom-2.5 right-2.5 w-8 h-8 rounded-full grid place-items-center transition-all cursor-pointer z-10 ${
            isFavorite
              ? 'bg-[#ffb347] text-[#3a2a00] shadow'
              : 'bg-black/25 text-white/90 hover:bg-black/45'
          }`}
        >
          <Star className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
        </button>
      )}
    </div>
  );
};

interface PdfToolCardProps {
  tool: ToolItem;
  onSelect: (tool: ToolItem) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (toolId: string) => void;
}

export const PdfToolCard: React.FC<PdfToolCardProps> = ({
  tool,
  onSelect,
  isFavorite = false,
  onToggleFavorite,
}) => {
  return (
    <div className="relative group">
      <button
        type="button"
        onClick={() => onSelect(tool)}
        className="bg-[var(--card)] border border-[var(--bd)] rounded-[16px] p-[18px] flex items-center gap-3 text-left cursor-pointer transition-all duration-150 group-hover:-translate-y-0.5 group-hover:shadow-lg w-full focus-visible:outline-2 focus-visible:outline-[#f57c00]"
      >
        <div
          className="w-[46px] h-[46px] rounded-[12px] grid place-items-center text-2xl text-white shrink-0 group-hover:scale-105 transition-transform"
          style={{ backgroundColor: tool.accentColor || '#3b82f6' }}
        >
          {tool.icon}
        </div>
        <div className="min-w-0 pr-7">
          <div className="font-bold text-[15px] text-[var(--tx)] leading-tight mb-0.5">
            {tool.title}
          </div>
          <div className="text-[12px] text-[var(--mut)] leading-snug">{tool.subtitle}</div>
        </div>
      </button>

      {onToggleFavorite && (
        <button
          type="button"
          aria-label={isFavorite ? `Remove ${tool.title} from favourites` : `Add ${tool.title} to favourites`}
          title={isFavorite ? 'Remove favourite' : 'Add to favourites'}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(tool.id);
          }}
          className={`absolute top-3 right-3 w-7 h-7 rounded-full grid place-items-center transition-colors cursor-pointer z-10 ${
            isFavorite
              ? 'bg-[#ffb347]/30 text-[#d97706]'
              : 'text-[var(--mut)] hover:text-[#f57c00]'
          }`}
        >
          <Star className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
        </button>
      )}
    </div>
  );
};
