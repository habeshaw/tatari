import React, { useState } from 'react';
import { HelpCircle, Menu, X } from 'lucide-react';
import type { AppView, Language, UserProfile } from '../types/domain';
import { TRANSLATIONS } from '../lib/i18n';

interface HeaderProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  currentUser: UserProfile | null;
  pendingApprovalCount: number;
  unreadNotificationCount?: number;
  language: Language;
  onOpenAuth: () => void;
  onOpenHelp: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  onNavigate,
  currentUser,
  pendingApprovalCount,
  unreadNotificationCount = 0,
  language,
  onOpenAuth,
  onOpenHelp,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const t = TRANSLATIONS[language];

  const isAdmin = currentUser?.role === 'admin' && currentUser?.status === 'approved';

  const navItems: { id: AppView; label: string }[] = [
    { id: 'jobs', label: t.navJobs },
    { id: 'ai_studio', label: t.navAiStudio },
    { id: 'fx', label: t.navFx },
    { id: 'capital_market', label: t.navCapitalMarket },
    { id: 'news', label: t.navNews },
    { id: 'opportunities', label: t.navOpportunities },
    { id: 'training', label: t.navTraining },
    { id: 'store', label: t.navStore },
    {
      id: 'activity',
      label:
        unreadNotificationCount > 0 ? `${t.navActivity} (${unreadNotificationCount})` : t.navActivity,
    },
    { id: 'employer', label: t.navEmployer },
    ...(isAdmin
      ? [
          {
            id: 'admin' as AppView,
            label:
              pendingApprovalCount > 0
                ? `${t.navAdmin} (${pendingApprovalCount})`
                : t.navAdmin,
          },
        ]
      : []),
  ];

  const handleNavClick = (view: AppView) => {
    onNavigate(view);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2.5 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleNavClick('jobs')}
          className="font-display text-xl font-extrabold tracking-tight text-[#10243B] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#164081]"
        >
          TATARI
        </button>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden lg:flex items-center gap-2.5 xl:gap-3.5 text-[12px] xl:text-[13px] font-medium text-slate-600"
        >
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`relative py-5 font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-[#164081] ${
                  isActive
                    ? 'text-[#164081] font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-[#164081]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Help & Auth Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenHelp}
            aria-label="Open Help and Support Center"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#164081]"
          >
            <HelpCircle className="h-3.5 w-3.5 text-[#164081]" />
            <span>{t.helpButton}</span>
          </button>

          <button
            type="button"
            onClick={onOpenAuth}
            className="rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#102E61] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#164081]"
          >
            {currentUser
              ? `${currentUser.fullName.split(' ')[0]} · ${currentUser.role.toUpperCase()}`
              : t.signIn}
          </button>

          <button
            type="button"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 lg:hidden"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <nav
          aria-label="Mobile Navigation"
          className="border-t border-slate-200 bg-white px-4 py-3 lg:hidden"
        >
          <div className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium ${
                    isActive
                      ? 'bg-[#F0F5FF] text-[#164081] font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{item.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenHelp();
              }}
              className="mt-1 flex w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm font-semibold text-[#164081] hover:bg-slate-50"
            >
              <HelpCircle className="h-4 w-4" />
              <span>{t.helpButton} &amp; User Guides</span>
            </button>
          </div>
        </nav>
      )}
    </header>
  );
};
