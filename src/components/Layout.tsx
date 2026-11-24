import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { RouteView } from '../types/tools';
import { HeaderPWAInstallButton, MobilePWAInstallBanner } from './PWAInstallUI';

interface LayoutProps {
  currentRoute: RouteView;
  onNavigate: (route: RouteView) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  currentRoute,
  onNavigate,
  isDark,
  onToggleTheme,
  children,
}) => {
  const activeTab =
    currentRoute.page === 'pdf' || currentRoute.page === 'pdf-tool'
      ? 'pdf'
      : currentRoute.page === 'card-crop'
        ? 'card-crop'
        : currentRoute.page === 'blog' || currentRoute.page === 'blog-post'
          ? 'blog'
          : currentRoute.page === 'contact'
            ? 'contact'
            : 'home';

  const navItems: {
    id: 'home' | 'blog' | 'pdf' | 'card-crop' | 'contact';
    label: string;
    route: RouteView;
  }[] = [
    { id: 'home', label: 'Home', route: { page: 'home' } },
    { id: 'blog', label: 'Blog', route: { page: 'blog' } },
    { id: 'pdf', label: 'PDF Tools', route: { page: 'pdf' } },
    { id: 'card-crop', label: 'Card Crop', route: { page: 'card-crop' } },
    { id: 'contact', label: 'Contact', route: { page: 'contact' } },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--tx)]">
      {/* Sticky Navy Header */}
      <header className="sticky top-0 z-30 bg-[#0f2a5c] text-white px-4 md:px-6 py-2.5 shadow-sm">
        <div className="max-w-[1180px] mx-auto flex flex-wrap items-center gap-3 md:gap-5">
          <button
            type="button"
            onClick={() => onNavigate({ page: 'home' })}
            className="font-bold text-xl tracking-tight text-white cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1 focus-visible:outline-2 focus-visible:outline-[#ffb347] rounded"
          >
            <span>KAAJER</span>
            <span className="text-[#ffa733]">TOOLS</span>
          </button>

          <nav
            aria-label="Main Navigation"
            className="flex items-center gap-1 bg-white/10 rounded-[10px] p-1 flex-wrap"
          >
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.route)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-[#ff8a00]/55 text-white'
                      : 'text-white/90 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex-1" />

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Light Mode' : 'Dark Mode'}
              className="w-9 h-9 rounded-[10px] bg-white/12 hover:bg-white/20 text-white grid place-items-center transition-colors cursor-pointer"
            >
              {isDark ? <Sun className="w-4 h-4 text-[#ffb347]" /> : <Moon className="w-4 h-4" />}
            </button>

            <HeaderPWAInstallButton />

            <button
              type="button"
              onClick={() => onNavigate({ page: 'blog' })}
              className="rounded-[10px] px-3.5 py-2 text-sm font-semibold bg-[#ffb347] text-[#3a2a00] hover:bg-[#ffa733] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              নোটিস বক্স
            </button>

            <button
              type="button"
              onClick={() => onNavigate({ page: 'pdf' })}
              className="hidden sm:inline-block rounded-[10px] px-4 py-2 text-sm font-semibold bg-[#f57c00] text-white hover:bg-[#e06d00] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              All PDF Tools
            </button>
          </div>
        </div>
      </header>

      {/* Scrolling Orange Helpdesk Ticker */}
      <div
        className="ticker-wrap overflow-hidden whitespace-nowrap py-2 text-sm font-semibold text-[#3a2a00]"
        style={{ background: 'linear-gradient(90deg, #ffd9a0, #ffa733)' }}
      >
        <div className="ticker-track">
          📞 WhatsApp: 90000 00000 &nbsp;&nbsp;&nbsp; 📢 Helpdesk Email: hello@kaajertools.example
          &nbsp;&nbsp;&nbsp; 📢 নতুন টুলস যোগ হয়েছে — PDF, Image, Passport Photo, Invoice ও Salary Slip সব টুল সম্পূর্ণ ব্রাউজারে চলে!
        </div>
      </div>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-[1180px] mx-auto px-4 pt-5 pb-12">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--bd)] bg-[var(--card)]/60 py-6 px-4 text-center text-[13px] text-[var(--mut)]">
        <div className="max-w-[1180px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>© 2026 Kaajer Tools — সব অধিকার সংরক্ষিত • Browser-side Utility Hub</div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => onNavigate({ page: 'home' })}
              className="hover:text-[var(--tx)] cursor-pointer"
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => onNavigate({ page: 'pdf' })}
              className="hover:text-[var(--tx)] cursor-pointer"
            >
              PDF Tools
            </button>
            <button
              type="button"
              onClick={() => onNavigate({ page: 'card-crop' })}
              className="hover:text-[var(--tx)] cursor-pointer"
            >
              Card Crop
            </button>
            <button
              type="button"
              onClick={() => onNavigate({ page: 'blog' })}
              className="hover:text-[var(--tx)] cursor-pointer"
            >
              Blog
            </button>
            <button
              type="button"
              onClick={() => onNavigate({ page: 'contact' })}
              className="hover:text-[var(--tx)] cursor-pointer"
            >
              Contact
            </button>
          </div>
        </div>
      </footer>

      <MobilePWAInstallBanner />
    </div>
  );
};
