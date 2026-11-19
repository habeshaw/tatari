import { useEffect, useState } from 'react';
import { apiFetch, getStoredToken, setStoredToken } from './api';
import { AdminConsoleView } from './components/AdminConsoleView';
import { ApplyModal } from './components/ApplyModal';
import { AuthModal } from './components/AuthModal';
import { DigitalStoreView } from './components/DigitalStoreView';
import { EmployerPortalView } from './components/EmployerPortalView';
import { JobBoardView } from './components/JobBoardView';
import { JobDetailPage } from './components/JobDetailPage';
import { SavedAndAlertsView } from './components/SavedAndAlertsView';
import { TopNav, type ActiveTab } from './components/TopNav';
import type { Lang } from './i18n';
import type { AuthUser, JobItem } from './types';

function parseRouteFromPath(pathname: string): { tab: ActiveTab; jobSlug: string | null } {
  if (pathname.startsWith('/jobs/')) {
    const slug = decodeURIComponent(pathname.replace('/jobs/', '').replace(/\/$/, ''));
    return { tab: 'jobs', jobSlug: slug || null };
  }
  if (pathname === '/store') return { tab: 'store', jobSlug: null };
  if (pathname === '/saved') return { tab: 'saved', jobSlug: null };
  if (pathname === '/employer') return { tab: 'employer', jobSlug: null };
  if (pathname === '/admin') return { tab: 'admin', jobSlug: null };
  return { tab: 'jobs', jobSlug: null };
}

export default function App() {
  const initialRoute = parseRouteFromPath(window.location.pathname);
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialRoute.tab);
  const [selectedJobSlug, setSelectedJobSlug] = useState<string | null>(initialRoute.jobSlug);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [lang, setLang] = useState<Lang>('en');
  const [savedJobIds, setSavedJobIds] = useState<Set<number>>(new Set());
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [applyJob, setApplyJob] = useState<JobItem | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    const onPopState = () => {
      const next = parseRouteFromPath(window.location.pathname);
      setActiveTab(next.tab);
      setSelectedJobSlug(next.jobSlug);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) return;
    apiFetch<{ user: AuthUser | null }>('/api/auth/me')
      .then((res) => {
        if (res.user) {
          setUser(res.user);
        } else {
          setStoredToken(null);
        }
      })
      .catch(() => {
        setStoredToken(null);
      });
  }, []);

  useEffect(() => {
    if (!user) {
      setSavedJobIds(new Set());
      return;
    }
    apiFetch<{ savedJobs: JobItem[] }>('/api/saved-jobs')
      .then((res) => {
        setSavedJobIds(new Set(res.savedJobs.map((j) => j.id)));
      })
      .catch(() => {});
  }, [user]);

  function navigateTo(tab: ActiveTab, slug: string | null = null) {
    setActiveTab(tab);
    setSelectedJobSlug(slug);
    const path =
      slug ? `/jobs/${encodeURIComponent(slug)}` : tab === 'jobs' ? '/' : `/${tab}`;
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 4500);
  }

  async function handleToggleSaveJob(jobId: number) {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    if (savedJobIds.has(jobId)) {
      await apiFetch(`/api/saved-jobs/${jobId}`, { method: 'DELETE' });
      setSavedJobIds((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
      showToast('Removed from Saved Jobs.');
    } else {
      await apiFetch(`/api/saved-jobs/${jobId}`, { method: 'POST' });
      setSavedJobIds((prev) => new Set(prev).add(jobId));
      showToast('Saved to your Saved Jobs & Alerts list.');
    }
  }

  function handleSignOut() {
    setStoredToken(null);
    setUser(null);
    if (activeTab === 'admin' || activeTab === 'employer') {
      navigateTo('jobs');
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FA] text-[#111827]">
      <TopNav
        activeTab={activeTab}
        onNavigate={(t) => navigateTo(t)}
        user={user}
        lang={lang}
        onOpenAuth={() => setAuthModalOpen(true)}
        onSignOut={handleSignOut}
      />

      {toastMsg && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-40 px-4 py-3 text-sm font-medium text-white bg-slate-900 rounded-xl shadow-lg"
        >
          {toastMsg}
        </div>
      )}

      <main className="flex-1">
        {activeTab === 'jobs' && selectedJobSlug ? (
          <JobDetailPage
            slug={selectedJobSlug}
            onBack={() => navigateTo('jobs', null)}
            onOpenApply={(job) => setApplyJob(job)}
          />
        ) : activeTab === 'jobs' ? (
          <JobBoardView
            user={user}
            lang={lang}
            onToggleLang={() => setLang((l) => (l === 'en' ? 'am' : 'en'))}
            savedJobIds={savedJobIds}
            onToggleSaveJob={handleToggleSaveJob}
            onOpenApply={(job) => setApplyJob(job)}
            onOpenJobPage={(slug) => navigateTo('jobs', slug)}
            onOpenAlerts={() => navigateTo('saved')}
            onRequireAuth={() => setAuthModalOpen(true)}
          />
        ) : activeTab === 'store' ? (
          <DigitalStoreView
            user={user}
            lang={lang}
            onRequireAuth={() => setAuthModalOpen(true)}
            onOrderSubmitted={() => {
              showToast('Receipt submitted. Check Saved & Alerts for approval status.');
            }}
          />
        ) : activeTab === 'saved' ? (
          <SavedAndAlertsView
            user={user}
            onRequireAuth={() => setAuthModalOpen(true)}
            onOpenJobPage={(slug) => navigateTo('jobs', slug)}
            onRemoveSavedJob={handleToggleSaveJob}
          />
        ) : activeTab === 'employer' ? (
          <EmployerPortalView
            user={user}
            onRequireAuth={() => setAuthModalOpen(true)}
          />
        ) : (
          <AdminConsoleView
            user={user}
            onRequireAuth={() => setAuthModalOpen(true)}
          />
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 mt-12">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} TATARI Ethiopia · Centralized Job Discovery &amp; Digital Store</p>
          <div className="flex items-center gap-5">
            <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer" className="hover:text-slate-800">
              Sitemap
            </a>
            <button type="button" onClick={() => navigateTo('jobs')} className="hover:text-slate-800">
              Job Board
            </button>
            <button type="button" onClick={() => navigateTo('store')} className="hover:text-slate-800">
              Digital Store
            </button>
            <button type="button" onClick={() => navigateTo('admin')} className="hover:text-slate-800">
              Admin Console
            </button>
          </div>
        </div>
      </footer>

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={(u) => {
          setUser(u);
          showToast(`Signed in as ${u.name}`);
          if (u.role === 'admin' && activeTab === 'employer') {
            navigateTo('admin');
          }
        }}
      />

      <ApplyModal
        job={applyJob}
        user={user}
        onClose={() => setApplyJob(null)}
        onApplied={(newUser) => {
          if (newUser) setUser(newUser);
          showToast('Application submitted directly on Tatari.');
        }}
      />
    </div>
  );
}
