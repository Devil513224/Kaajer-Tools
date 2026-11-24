import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { BLOG_POSTS } from '../config/toolsConfig';

interface BlogPostPageProps {
  postId: string;
  onBack: () => void;
  onSelectPost: (postId: string) => void;
}

export const BlogPostPage: React.FC<BlogPostPageProps> = ({
  postId,
  onBack,
  onSelectPost,
}) => {
  const post = BLOG_POSTS.find((p) => p.id === postId) || BLOG_POSTS[0];
  const related = BLOG_POSTS.filter((p) => p.id !== post.id).slice(0, 2);

  return (
    <div className="max-w-[780px] mx-auto space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-sm font-semibold bg-[#111827] text-white hover:bg-[#1f2937] transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Blogs
      </button>

      <article className="bg-[var(--card)] border border-[var(--bd)] rounded-[18px] p-6 sm:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold m-0 mb-3 leading-snug">
          {post.title}
        </h1>

        <div className="flex flex-wrap items-center gap-2.5 text-[13px] text-[var(--mut)] mb-5">
          <span className="bg-[#ffe9cf] text-[#b45309] text-[11px] font-bold px-2.5 py-0.5 rounded-full">
            {post.category}
          </span>
          <span>📅 {post.date}</span>
          <span>·</span>
          <span>⏱ {post.readTime}</span>
          <span>·</span>
          <span className="tabular-nums">👁 {post.views} views</span>
        </div>

        <p className="text-base leading-relaxed text-[var(--tx)] mb-5">{post.excerpt}</p>

        {post.steps.map((step, idx) => (
          <div key={idx} className="mb-4">
            <div
              className="rounded-[12px] px-4 py-2.5 font-bold text-white my-4"
              style={{ background: 'linear-gradient(90deg, #c81e1e, #ef4444)' }}
            >
              {step.heading}
            </div>
            <p className="text-[15px] leading-relaxed text-[var(--tx)] m-0">{step.body}</p>
            {step.highlight && (
              <div className="bg-[#1a3f8f] text-white rounded-[12px] p-4 my-4">
                <div className="font-bold mb-1">{step.highlight.title}</div>
                <div className="text-sm text-white/95">{step.highlight.body}</div>
              </div>
            )}
          </div>
        ))}
      </article>

      {/* Related */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold m-0">আরও পড়ুন / Related Guides</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {related.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onSelectPost(r.id)}
              className="bg-[var(--card)] border border-[var(--bd)] rounded-[14px] p-4 text-left hover:border-[#f57c00] transition-colors cursor-pointer"
            >
              <div className="text-xs font-bold text-[#f57c00] mb-1">{r.category}</div>
              <div className="font-bold text-sm text-[var(--tx)]">{r.title}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
