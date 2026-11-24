import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface PrivacyNoteProps {
  className?: string;
}

export const PrivacyNote: React.FC<PrivacyNoteProps> = ({ className = '' }) => {
  return (
    <div
      className={`mt-4 flex items-center gap-2.5 rounded-[10px] px-3.5 py-2.5 text-[13px] bg-[#e8f1ff] text-[#1e3a8a] dark:bg-[#172747] dark:text-[#bfd6ff] border border-[#c8dcfb] dark:border-[#2a4273] ${className}`}
    >
      <ShieldCheck className="w-4 h-4 shrink-0 text-[#0f2a5c] dark:text-[#ffb347]" />
      <span>
        Files are processed in your browser and are never stored.{' '}
        <span className="opacity-85">
          (আপনার ফাইল সম্পূর্ণ ব্রাউজারে প্রসেস হয় এবং কোথাও সংরক্ষণ করা হয় না।)
        </span>
      </span>
    </div>
  );
};
