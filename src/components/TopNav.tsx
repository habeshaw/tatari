import type { AuthUser } from '../types';
import { DICT, type Lang } from '../i18n';

export type ActiveTab = 'jobs' | 'store' | 'saved' | 'employer' | 'admin';

interface TopNavProps {
  activeTab: ActiveTab;
  onNavigate: (tab: ActiveTab) => void;
  user: AuthUser | null;
  lang: Lang;
  onOpenAuth: () => void;
  onSignOut: () => void;
}

export function TopNav({
  activeTab,
  onNavigate,
  user,
  lang,
  onOpenAuth,
  onSignOut,
}: TopNavProps) {
  const t = DICT[lang];
  const isAdmin = user?.role === 'admin';

  const linkClass = (tab: ActiveTab) =>
    `text-sm font-medium transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
      activeTab === tab
        ? 'text-[#164081] border-[#164081]'
        : 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300'
    }`;

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('jobs');
          }}
          className="text-xl font-extrabold tracking-tight text-[#164081] whitespace-nowrap shrink-0"
        >
          {t.brand}
        </a>

        <nav aria-label="Primary Navigation" className="hidden md:flex items-center gap-6">
          <button type="button" onClick={() => onNavigate('jobs')} className={linkClass('jobs')}>
            {t.navJobs}
          </button>
          <button type="button" onClick={() => onNavigate('store')} className={linkClass('store')}>
            {t.navStore}
          </button>
          <button type="button" onClick={() => onNavigate('saved')} className={linkClass('saved')}>
            {t.navSaved}
          </button>
          <button
            type="button"
            onClick={() => onNavigate(isAdmin ? 'admin' : 'employer')}
            className={linkClass(isAdmin ? 'admin' : 'employer')}
          >
            {isAdmin ? t.navAdmin : t.navEmployer}
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          {user ? (
            <button
              type="button"
              onClick={onSignOut}
              className="px-4 py-2 text-sm font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {user.name.split(' ')[0]} · {t.signOut}
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#164081] hover:bg-[#103063] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {t.signIn}
            </button>
          )}
        </div>
      </div>

      {/* Compact mobile navigation row */}
      <nav
        aria-label="Mobile Navigation"
        className="flex md:hidden items-center justify-between gap-2 px-4 py-2 border-t border-slate-100 bg-white overflow-x-auto"
      >
        <button type="button" onClick={() => onNavigate('jobs')} className={`${linkClass('jobs')} text-xs`}>
          {t.navJobs}
        </button>
        <button type="button" onClick={() => onNavigate('store')} className={`${linkClass('store')} text-xs`}>
          {t.navStore}
        </button>
        <button type="button" onClick={() => onNavigate('saved')} className={`${linkClass('saved')} text-xs`}>
          {t.navSaved}
        </button>
        <button
          type="button"
          onClick={() => onNavigate(isAdmin ? 'admin' : 'employer')}
          className={`${linkClass(isAdmin ? 'admin' : 'employer')} text-xs`}
        >
          {isAdmin ? 'Admin' : t.navEmployer}
        </button>
      </nav>
    </header>
  );
}
