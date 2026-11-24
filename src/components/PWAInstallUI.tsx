import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const HeaderPWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOSSafari, install } = usePWAInstall();
  const [showIOSHint, setShowIOSHint] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-xs sm:text-sm font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="w-3.5 h-3.5 text-[#ffb347]" />
        Install App
      </button>
    );
  }

  if (isIOSSafari) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSHint(true)}
          className="inline-flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-xs sm:text-sm font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Share className="w-3.5 h-3.5 text-[#ffb347]" />
          Install App
        </button>

        {showIOSHint && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
            <div className="w-full max-w-sm rounded-[20px] bg-[var(--card)] border border-[var(--bd)] p-5 shadow-2xl text-[var(--tx)]">
              <h3 className="text-base font-bold m-0 mb-2">
                Install Kaajer Tools on iPhone / iPad
              </h3>
              <p className="text-sm text-[var(--mut)] m-0 leading-relaxed">
                Tap <strong>Share</strong> in Safari toolbar, then tap{' '}
                <strong>Add to Home Screen</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSHint(false)}
                className="mt-4 w-full rounded-[10px] bg-[#0f2a5c] text-white py-2.5 text-sm font-bold cursor-pointer"
              >
                OK
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const MobilePWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOSSafari, bannerDismissed, dismissBanner, install } =
    usePWAInstall();

  if (isInstalled || bannerDismissed) return null;
  if (!isInstallable && !isIOSSafari) return null;

  return (
    <div className="sm:hidden fixed bottom-3 left-3 right-3 z-40 rounded-[16px] bg-[#0f2a5c] text-white border border-[#f57c00] p-3.5 shadow-xl flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-xs font-bold text-[#ffb347]">Install Kaajer Tools App</div>
        <div className="text-[11px] text-white/90 truncate">
          {isInstallable
            ? 'Works offline & opens fast from your home screen'
            : 'Tap Share, then Add to Home Screen'}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {isInstallable && (
          <button
            type="button"
            onClick={install}
            className="rounded-[9px] bg-[#f57c00] text-white px-3 py-1.5 text-xs font-bold cursor-pointer"
          >
            Install
          </button>
        )}
        <button
          type="button"
          aria-label="Dismiss install banner"
          onClick={dismissBanner}
          className="w-7 h-7 rounded-lg bg-white/15 grid place-items-center text-white cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
