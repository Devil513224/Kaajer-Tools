import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { TOOLS_CONFIG } from '../config/toolsConfig';
import { ToolItem } from '../types/tools';
import { PdfToolCard } from '../components/ToolCard';
import { PrivacyNote } from '../components/PrivacyNote';

interface PdfToolsPageProps {
  onSelectTool: (tool: ToolItem) => void;
  favoriteIds?: string[];
  onToggleFavorite?: (toolId: string) => void;
}

const PDF_CATEGORIES = ['All', 'Organize', 'Convert', 'Edit', 'Optimize'] as const;

export const PdfToolsPage: React.FC<PdfToolsPageProps> = ({
  onSelectTool,
  favoriteIds = [],
  onToggleFavorite,
}) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<(typeof PDF_CATEGORIES)[number]>('All');

  const pdfTools = useMemo(() => TOOLS_CONFIG.filter((t) => t.group === 'pdf'), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pdfTools.filter((tool) => {
      const matchesCat = category === 'All' || tool.pdfCategory === category;
      if (!matchesCat) return false;
      if (!q) return true;
      return (
        tool.title.toLowerCase().includes(q) ||
        tool.subtitle.toLowerCase().includes(q) ||
        tool.keywords.some((k) => k.toLowerCase().includes(q))
      );
    });
  }, [pdfTools, query, category]);

  return (
    <div className="space-y-5">
      {/* PDF Hero Banner */}
      <section
        className="rounded-[22px] p-6 sm:p-8 text-white"
        style={{
          background: 'linear-gradient(120deg, #0ea5e9, #4f46e5 60%, #7c3aed)',
        }}
      >
        <h1 className="text-2xl sm:text-4xl font-bold m-0 mb-2">PDF Tools / পিডিএফ টুলস</h1>
        <p className="text-sm sm:text-base text-white/95 m-0 mb-4 max-w-2xl">
          Merge, split, compress, convert, rotate, delete, extract, rearrange, sign, crop and watermark — simple tools for daily PDF work.
        </p>
        <span className="inline-block bg-white/15 border border-white/25 rounded-full px-3.5 py-1 text-[13px] font-semibold">
          🔒 Browser-side processing • No server upload
        </span>
      </section>

      {/* Search & Category Filter */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[var(--mut)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search PDF tools (e.g. Merge, Split, JPG, Rotate, Watermark)..."
            className="w-full pl-10 pr-4 py-3 border border-[var(--bd)] rounded-[14px] bg-[var(--card)] text-[var(--tx)] text-sm focus:outline-none focus:border-[#f57c00]"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {PDF_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3.5 py-2 rounded-[10px] text-xs font-semibold transition-colors cursor-pointer ${
                category === cat
                  ? 'bg-[#0f2a5c] text-white dark:bg-[#f57c00]'
                  : 'bg-[var(--card)] border border-[var(--bd)] text-[var(--tx)] hover:border-[#f57c00]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Tools Grid */}
      {filtered.length === 0 ? (
        <div className="bg-[var(--card)] border border-[var(--bd)] rounded-[16px] p-10 text-center text-[var(--mut)]">
          No PDF tools matched "{query}". Try clearing your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {filtered.map((tool) => (
            <PdfToolCard
              key={tool.id}
              tool={tool}
              onSelect={onSelectTool}
              isFavorite={favoriteIds.includes(tool.id)}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      )}

      <PrivacyNote />
    </div>
  );
};
