import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, MessageSquarePlus, Search, Star, Trash2, X } from 'lucide-react';
import { BLOG_POSTS, TOOLS_CONFIG } from '../config/toolsConfig';
import { RouteView, ToolItem } from '../types/tools';
import { GradientToolCard, PdfToolCard } from '../components/ToolCard';

interface HomePageProps {
  onNavigate: (route: RouteView) => void;
  onSelectTool: (tool: ToolItem) => void;
  recentIds: string[];
  favoriteIds: string[];
  onToggleFavorite: (toolId: string) => void;
  onClearRecent: () => void;
  onClearFavorites: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onNavigate,
  onSelectTool,
  recentIds,
  favoriteIds,
  onToggleFavorite,
  onClearRecent,
  onClearFavorites,
}) => {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestForm, setShowSuggestForm] = useState(false);
  const [suggestName, setSuggestName] = useState('');
  const [suggestMessage, setSuggestMessage] = useState('');
  const [suggestSubmitted, setSuggestSubmitted] = useState(false);

  const premiumTools = TOOLS_CONFIG.filter((t) => t.group === 'premium');
  const freeTools = TOOLS_CONFIG.filter((t) => t.group === 'free');
  const latestPosts = BLOG_POSTS.slice(0, 3);

  // Keyboard shortcut "/" focuses the search bar cleanly
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
        return;
      }
      e.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return TOOLS_CONFIG.filter((t) => {
      if (t.title.toLowerCase().includes(q)) return true;
      if (t.subtitle.toLowerCase().includes(q)) return true;
      return t.keywords.some((kw) => kw.toLowerCase().includes(q));
    });
  }, [searchQuery]);

  const recentTools = useMemo(
    () =>
      recentIds
        .map((id) => TOOLS_CONFIG.find((t) => t.id === id))
        .filter((t): t is ToolItem => Boolean(t)),
    [recentIds]
  );

  const favoriteTools = useMemo(
    () =>
      favoriteIds
        .map((id) => TOOLS_CONFIG.find((t) => t.id === id))
        .filter((t): t is ToolItem => Boolean(t)),
    [favoriteIds]
  );

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSuggestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestMessage.trim()) return;
    setSuggestSubmitted(true);
    setSuggestName('');
    setSuggestMessage('');
  };

  const renderAnyToolCard = (tool: ToolItem, index: number) => {
    const isFav = favoriteIds.includes(tool.id);
    if (tool.group === 'pdf') {
      return (
        <PdfToolCard
          key={tool.id}
          tool={tool}
          onSelect={onSelectTool}
          isFavorite={isFav}
          onToggleFavorite={onToggleFavorite}
        />
      );
    }
    return (
      <GradientToolCard
        key={tool.id}
        tool={tool}
        index={index}
        onSelect={onSelectTool}
        isFavorite={isFav}
        onToggleFavorite={onToggleFavorite}
      />
    );
  };

  const isSearching = searchQuery.trim().length > 0;

  return (
    <div className="space-y-6">
      {/* Global Instant Search Bar at Top of Home */}
      <section className="bg-[var(--card)] border border-[var(--bd)] rounded-[20px] p-3.5 sm:p-4 shadow-sm">
        <div className="relative flex items-center">
          <Search className="w-5 h-5 text-[#f57c00] absolute left-3.5 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSuggestSubmitted(false);
            }}
            placeholder='Search tools in বাংলা বা English (e.g. "pan", "ফটো", "pdf", "signature")...'
            aria-label="Search all tools"
            className="w-full pl-11 pr-20 py-3 rounded-[14px] border border-[var(--bd)] bg-[var(--bg)] text-[var(--tx)] text-sm sm:text-base focus:outline-none focus:border-[#f57c00]"
          />
          {isSearching ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-500/15 hover:bg-slate-500/25 text-[var(--tx)] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          ) : (
            <kbd
              title="Press / to search"
              className="hidden sm:inline-flex items-center justify-center absolute right-3.5 px-2 py-0.5 text-xs font-bold text-[var(--mut)] bg-[var(--card)] border border-[var(--bd)] rounded-md pointer-events-none"
            >
              /
            </kbd>
          )}
        </div>
      </section>

      {/* Live Search Results or Empty State */}
      {isSearching && (
        <section className="border border-[var(--bd)] rounded-[22px] p-5 sm:p-6 bg-[var(--card)] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg sm:text-xl font-bold m-0">
              Search Results ({searchResults.length})
            </h2>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs font-bold text-[#f57c00] hover:underline cursor-pointer"
            >
              Clear Search
            </button>
          </div>

          {searchResults.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {searchResults.map((tool, index) => renderAnyToolCard(tool, index))}
            </div>
          ) : (
            <div className="rounded-[18px] border border-[var(--bd)] bg-[var(--bg)] p-6 text-center space-y-3">
              <div className="text-2xl">🔍</div>
              <h3 className="text-base font-bold m-0">
                No tool found matching &ldquo;{searchQuery}&rdquo;
              </h3>
              <p className="text-xs text-[var(--mut)] m-0">
                বাংলা বা ইংরেজিতে অন্য কোনো শব্দ দিয়ে খুঁজুন, অথবা নতুন টুলের জন্য আমাদের জানান।
              </p>

              {!showSuggestForm && !suggestSubmitted && (
                <button
                  type="button"
                  onClick={() => setShowSuggestForm(true)}
                  className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-sm font-bold bg-[#0f2a5c] hover:bg-[#193d7f] text-white cursor-pointer"
                >
                  <MessageSquarePlus className="w-4 h-4 text-[#ffb347]" />
                  Tell us which tool you need
                </button>
              )}

              {showSuggestForm && !suggestSubmitted && (
                <form
                  onSubmit={handleSuggestSubmit}
                  className="max-w-md mx-auto text-left bg-[var(--card)] border border-[var(--bd)] rounded-[16px] p-4 space-y-3 mt-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold">Suggest a New Tool (নতুন টুলের পরামর্শ)</div>
                    <button
                      type="button"
                      onClick={() => setShowSuggestForm(false)}
                      className="text-xs text-[var(--mut)] hover:text-[var(--tx)] cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">
                      Your Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={suggestName}
                      onChange={(e) => setSuggestName(e.target.value)}
                      placeholder="আপনার নাম (ঐচ্ছিক)"
                      className="w-full px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">
                      Which tool do you need? *
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={suggestMessage}
                      onChange={(e) => setSuggestMessage(e.target.value)}
                      placeholder="কোন টুলটি থাকলে আপনার সুবিধা হয় তা লিখুন..."
                      className="w-full px-3 py-2 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full rounded-[10px] py-2.5 text-sm font-bold bg-[#f57c00] hover:bg-[#e06d00] text-white cursor-pointer"
                  >
                    Submit Feedback
                  </button>
                </form>
              )}

              {suggestSubmitted && (
                <div className="max-w-md mx-auto rounded-[12px] p-3 text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/35">
                  ✓ Thank you! Your tool suggestion was noted locally (nothing was sent over the network).
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Hero Section */}
      <section
        className="rounded-[24px] p-6 sm:p-10 text-white"
        style={{
          background: 'linear-gradient(120deg, #0f2a5c, #1e4fa3 60%, #d9730d)',
        }}
      >
        <div className="max-w-3xl">
          <h1 className="text-[32px] sm:text-[44px] font-bold leading-[1.15] m-0 mb-3">
            আপনার সমস্যার
            <span className="block text-[#ffb347]">একমাত্র সমাধান</span>
          </h1>
          <p className="text-[16px] sm:text-[17px] text-white/95 m-0 mb-5 leading-relaxed">
            সরকারি পরিষেবার তথ্য, অনলাইন গাইড, PDF এডিট, ফটো সাইজ ও ডিজিটাল ডকুমেন্ট তৈরি — সব এক জায়গায়, সম্পূর্ণ ব্রাউজারে।
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => scrollToSection('premium')}
              className="rounded-[10px] px-4 py-2.5 text-sm font-semibold bg-[#f57c00] hover:bg-[#e06e00] text-white transition-colors cursor-pointer"
            >
              🧰 Explore Tools →
            </button>
            <button
              type="button"
              onClick={() => onNavigate({ page: 'pdf' })}
              className="rounded-[10px] px-4 py-2.5 text-sm font-semibold bg-[#ffb347] hover:bg-[#ffa733] text-[#3a2a00] transition-colors cursor-pointer"
            >
              📑 Open PDF Tools
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mt-5">
            <span className="bg-white/12 border border-white/20 rounded-full px-3.5 py-1.5 text-[13px] font-semibold">
              📖 Trusted Information
            </span>
            <span className="bg-white/12 border border-white/20 rounded-full px-3.5 py-1.5 text-[13px] font-semibold">
              ⚡ Easy Guides
            </span>
            <span className="bg-white/12 border border-white/20 rounded-full px-3.5 py-1.5 text-[13px] font-semibold">
              🛡 100% Safe
            </span>
            <span className="bg-white/12 border border-white/20 rounded-full px-3.5 py-1.5 text-[13px] font-semibold">
              💬 Always With You
            </span>
          </div>
        </div>
      </section>

      {/* Favourites Row (Saved in localStorage) */}
      {favoriteTools.length > 0 && (
        <section className="border border-[var(--bd)] rounded-[22px] p-5 bg-[var(--card)] space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold m-0 flex items-center gap-2">
              <Star className="w-5 h-5 text-[#f57c00] fill-[#f57c00]" />
              Favourites / প্রিয় টুলস ({favoriteTools.length})
            </h2>
            <button
              type="button"
              onClick={onClearFavorites}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border border-[var(--bd)] bg-[var(--bg)] hover:border-rose-500 text-[var(--mut)] hover:text-rose-600 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {favoriteTools.map((tool, index) => renderAnyToolCard(tool, index))}
          </div>
        </section>
      )}

      {/* Recently Used Row (Last 6 tools in localStorage) */}
      {recentTools.length > 0 && (
        <section className="border border-[var(--bd)] rounded-[22px] p-5 bg-[var(--card)] space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold m-0 flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#0f2a5c] dark:text-[#ffb347]" />
              Recently Used / সাম্প্রতিক ব্যবহৃত
            </h2>
            <button
              type="button"
              onClick={onClearRecent}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border border-[var(--bd)] bg-[var(--bg)] hover:border-rose-500 text-[var(--mut)] hover:text-rose-600 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {recentTools.map((tool, index) => renderAnyToolCard(tool, index + 1))}
          </div>
        </section>
      )}

      {/* Featured Smart Card Crop Banner Card */}
      {(() => {
        const cardCropTool = TOOLS_CONFIG.find((t) => t.id === 'smart-card-crop');
        if (!cardCropTool) return null;
        return (
          <section className="rounded-[22px] p-1 border-2 border-[#f57c00] bg-[var(--card)]">
            <button
              type="button"
              onClick={() => onSelectTool(cardCropTool)}
              style={{
                background: 'linear-gradient(120deg, #0f2a5c, #1e4fa3 55%, #f57c00)',
              }}
              className="group relative overflow-hidden w-full rounded-[18px] p-6 sm:p-7 text-left text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer transition-transform duration-150 hover:-translate-y-0.5"
            >
              <span className="absolute top-3 left-4 bg-[#ffb347] text-[#3a2a00] text-[10px] font-bold px-2.5 py-0.5 rounded-[6px] tracking-wide">
                NEW FEATURED TOOL
              </span>
              <span className="absolute top-[12px] -right-[32px] rotate-45 bg-[#ffb347] text-[#3a2a00] text-[9px] font-bold px-[36px] py-[2px] tracking-wider">
                AUTO CROP
              </span>

              <div className="flex items-center gap-4 pt-4 sm:pt-2">
                <div className="w-14 h-14 rounded-[14px] bg-white/20 grid place-items-center text-3xl shrink-0 group-hover:scale-105 transition-transform">
                  {cardCropTool.icon}
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold m-0 mb-1 text-white">
                    {cardCropTool.title}
                  </h2>
                  <p className="text-sm text-white/90 m-0">
                    {cardCropTool.subtitle}
                  </p>
                </div>
              </div>

              <span className="inline-flex items-center justify-center rounded-[10px] px-5 py-2.5 text-sm font-bold bg-[#f57c00] group-hover:bg-[#ff8f1f] text-white shrink-0">
                Open Card Crop →
              </span>
            </button>
          </section>
        );
      })()}

      {/* Premium Tools Grid */}
      <section
        id="premium"
        className="border border-[var(--bd)] rounded-[22px] p-5 sm:p-6 bg-[var(--card)]"
      >
        <div className="text-center mb-5">
          <h2 className="text-xl sm:text-2xl font-bold m-0 mb-1">
            ⭐ প্রিমিয়াম টুলস / Premium Tools
          </h2>
          <p className="text-[14px] text-[var(--mut)] m-0">
            ফটো, আইডি কার্ড, বায়োডাটা ও ভিজিটিং কার্ড — সম্পূর্ণ ব্রাউজারে বিনামূল্যে ব্যবহার করুন
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {premiumTools.map((tool, index) => (
            <GradientToolCard
              key={tool.id}
              tool={tool}
              index={index}
              onSelect={onSelectTool}
              isFavorite={favoriteIds.includes(tool.id)}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      </section>

      {/* Free Tools Grid */}
      <section
        id="free"
        className="border border-[var(--bd)] rounded-[22px] p-5 sm:p-6 bg-[var(--card)]"
      >
        <div className="text-center mb-5">
          <h2 className="text-xl sm:text-2xl font-bold m-0 mb-1">
            🎁 ফ্রি টুলস / Free Tools
          </h2>
          <p className="text-[14px] text-[var(--mut)] m-0">
            দৈনন্দিন কাজের বিনামূল্যের PDF, Image ও ডকুমেন্ট টুলস
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {freeTools.map((tool, index) => (
            <GradientToolCard
              key={tool.id}
              tool={tool}
              index={index + 2}
              onSelect={onSelectTool}
              isFavorite={favoriteIds.includes(tool.id)}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      </section>

      {/* Latest 3 Blog Posts */}
      <section className="pt-2">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-xl sm:text-2xl font-bold m-0 border-l-[6px] border-[#f57c00] pl-3">
            Latest Blogs / সাম্প্রতিক গাইড
          </h2>
          <button
            type="button"
            onClick={() => onNavigate({ page: 'blog' })}
            className="rounded-[10px] px-4 py-2 text-sm font-semibold bg-[#f57c00] hover:bg-[#e06e00] text-white transition-colors cursor-pointer"
          >
            View All Blogs →
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {latestPosts.map((post) => (
            <button
              key={post.id}
              type="button"
              onClick={() => onNavigate({ page: 'blog-post', postId: post.id })}
              className="group bg-[var(--card)] border border-[var(--bd)] rounded-[16px] overflow-hidden text-left cursor-pointer transition-transform duration-150 hover:-translate-y-1 shadow-sm hover:shadow-md flex flex-col"
            >
              <div
                className="h-[130px] w-full grid place-items-center text-white font-bold text-[18px] text-center p-4 leading-snug"
                style={{ backgroundColor: post.thumbColor }}
              >
                {post.title.slice(0, 48)}…
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <div>
                  <span className="inline-block bg-[#ffe9cf] text-[#b45309] text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                    {post.category}
                  </span>
                </div>
                <h3 className="text-[15px] font-bold mt-2.5 mb-2 text-[var(--tx)] group-hover:text-[#f57c00] transition-colors leading-snug">
                  {post.title}
                </h3>
                <div className="mt-auto text-[12px] text-[var(--mut)]">
                  📅 {post.date} · {post.readTime}
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
