import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { BLOG_POSTS } from '../config/toolsConfig';
import { BlogPost } from '../types/tools';

interface BlogPageProps {
  onSelectPost: (postId: string) => void;
}

export const BlogPage: React.FC<BlogPageProps> = ({ onSelectPost }) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    BLOG_POSTS.forEach((p) => {
      counts.set(p.category, (counts.get(p.category) || 0) + 1);
    });
    return Array.from(counts.entries());
  }, []);

  const filteredPosts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return BLOG_POSTS.filter((p: BlogPost) => {
      const catOk = selectedCategory === 'ALL' || p.category === selectedCategory;
      if (!catOk) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.excerpt.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [search, selectedCategory]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold m-0 border-l-[6px] border-[#f57c00] pl-3">
        Latest Blogs / বাংলা গাইড ও টিউটোরিয়াল
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_290px] gap-5 items-start">
        {/* Posts Grid */}
        {filteredPosts.length === 0 ? (
          <div className="bg-[var(--card)] border border-[var(--bd)] rounded-[16px] p-10 text-center text-[var(--mut)]">
            কোনো পোস্ট পাওয়া যায়নি। অনুগ্রহ করে অন্য কীওয়ার্ড দিয়ে খুঁজুন।
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPosts.map((post) => (
              <button
                key={post.id}
                type="button"
                onClick={() => onSelectPost(post.id)}
                className="group bg-[var(--card)] border border-[var(--bd)] rounded-[16px] overflow-hidden text-left cursor-pointer transition-transform duration-150 hover:-translate-y-1 shadow-sm hover:shadow-md flex flex-col"
              >
                <div
                  className="h-[130px] w-full grid place-items-center text-white font-bold text-[17px] text-center p-4 leading-snug"
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
                  <h2 className="text-[15px] font-bold mt-2.5 mb-2 text-[var(--tx)] group-hover:text-[#f57c00] transition-colors leading-snug">
                    {post.title}
                  </h2>
                  <p className="text-[12px] text-[var(--mut)] m-0 mb-3 line-clamp-2">
                    {post.excerpt}
                  </p>
                  <div className="mt-auto text-[12px] text-[var(--mut)]">
                    📅 {post.date} · {post.readTime}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="bg-[var(--card)] border border-[var(--bd)] rounded-[16px] p-4">
            <h3 className="text-base font-bold m-0 mb-2.5">🔎 Search Blogs</h3>
            <div className="relative">
              <Search className="w-4 h-4 text-[var(--mut)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search your keywords..."
                className="w-full pl-9 pr-3 py-2.5 rounded-[10px] border border-[var(--bd)] bg-[var(--bg)] text-[var(--tx)] text-sm focus:outline-none focus:border-[#f57c00]"
              />
            </div>
          </div>

          <div className="bg-[var(--card)] border border-[var(--bd)] rounded-[16px] p-4">
            <h3 className="text-base font-bold m-0 mb-2.5">📁 Categories</h3>
            <ul className="p-0 m-0 space-y-1.5 list-none">
              <li>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('ALL')}
                  className={`w-full flex items-center justify-between rounded-[8px] px-3 py-2 text-sm font-semibold cursor-pointer transition-colors ${
                    selectedCategory === 'ALL'
                      ? 'bg-[#0f2a5c] text-white dark:bg-[#f57c00]'
                      : 'bg-[var(--bg)] text-[var(--tx)] hover:border-[#f57c00]'
                  }`}
                >
                  <span>সবগুলো / All Posts</span>
                  <span className="tabular-nums">{BLOG_POSTS.length}</span>
                </button>
              </li>
              {categories.map(([cat, count]) => (
                <li key={cat}>
                  <button
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`w-full flex items-center justify-between rounded-[8px] px-3 py-2 text-sm font-semibold cursor-pointer transition-colors ${
                      selectedCategory === cat
                        ? 'bg-[#0f2a5c] text-white dark:bg-[#f57c00]'
                        : 'bg-[var(--bg)] text-[var(--tx)] hover:opacity-90'
                    }`}
                  >
                    <span>{cat}</span>
                    <span className="tabular-nums">0{count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
};
