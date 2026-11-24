import React from 'react';
import { CARD_TYPES_CONFIG, CardTypeConfig } from '../config/cardTypesConfig';

interface CardCropHubPageProps {
  onSelectCardType: (cardType: CardTypeConfig) => void;
}

export const CardCropHubPage: React.FC<CardCropHubPageProps> = ({
  onSelectCardType,
}) => {
  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <section
        className="rounded-[22px] p-6 sm:p-8 text-white"
        style={{ background: 'linear-gradient(120deg, #0f2a5c, #1e4fa3 60%, #f57c00)' }}
      >
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="bg-[#ffb347] text-[#3a2a00] text-[11px] font-bold px-2.5 py-0.5 rounded-md">
            NEW
          </span>
          <span className="text-xs font-semibold text-white/90">
            Print-Ready &amp; Lamination-Ready • 300 DPI A4 PDF
          </span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-bold m-0 mb-1.5">
          কার্ড ক্রপ / Smart Card Crop
        </h1>
        <p className="text-sm sm:text-base text-white/95 m-0 max-w-2xl">
          Aadhaar, Ration, Ayushman, PAN, Voter and any card, auto crop in one click
        </p>
      </section>

      {/* Card Type Selection Grid */}
      <section className="bg-[var(--card)] border border-[var(--bd)] rounded-[22px] p-5 sm:p-6">
        <div className="text-center mb-5">
          <h2 className="text-xl sm:text-2xl font-bold m-0 mb-1">
            কার্ডের ধরন বেছে নিন / Choose Card Type
          </h2>
          <p className="text-sm text-[var(--mut)] m-0">
            প্রতিটি কার্ডের জন্য আলাদা প্রিসেট, অটো-ক্রপ, শ্যাডো রিমুভ এবং A4 লেমিনেশন প্রিন্ট শিট
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CARD_TYPES_CONFIG.map((ct) => (
            <button
              key={ct.id}
              type="button"
              onClick={() => onSelectCardType(ct)}
              style={{ background: ct.gradient }}
              className="group relative overflow-hidden rounded-[16px] p-5 text-left text-white flex items-center gap-4 min-h-[118px] cursor-pointer transition-transform duration-150 hover:-translate-y-1 shadow-sm hover:shadow-md focus-visible:outline-2 focus-visible:outline-[#ffb347] w-full"
            >
              {ct.isNew && (
                <span className="absolute top-2 left-2 bg-[#ffb347] text-[#3a2a00] text-[10px] font-bold px-2 py-0.5 rounded-[6px] tracking-wide">
                  NEW
                </span>
              )}

              <span className="absolute top-[11px] -right-[32px] rotate-45 bg-[#ffb347] text-[#3a2a00] text-[9px] font-bold px-[34px] py-[2px] tracking-wider">
                AUTO CROP
              </span>

              <div className="w-[50px] h-[50px] rounded-[12px] bg-white/20 grid place-items-center text-2xl shrink-0 group-hover:scale-105 transition-transform">
                {ct.icon}
              </div>

              <div className="min-w-0 pr-5">
                <h3 className="m-0 mb-0.5 text-[16px] font-bold leading-snug text-white">
                  {ct.name}
                </h3>
                <div className="text-[13px] font-semibold text-[#ffd9a0] mb-1">
                  {ct.bnName}
                </div>
                <p className="m-0 text-[12px] text-white/90 leading-snug">
                  {ct.shortDesc}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

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
