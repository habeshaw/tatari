import { useEffect, useState, type FormEvent } from 'react';
import {
  Bell,
  Bookmark,
  BookmarkCheck,
  Briefcase,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  MapPin,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { apiFetch } from '../api';
import { DICT, type Lang } from '../i18n';
import type { AuthUser, JobCategory, JobItem, PublicSource } from '../types';

interface JobBoardViewProps {
  user: AuthUser | null;
  lang: Lang;
  onToggleLang: () => void;
  savedJobIds: Set<number>;
  onToggleSaveJob: (jobId: number) => Promise<void>;
  onOpenApply: (job: JobItem) => void;
  onOpenJobPage: (slug: string) => void;
  onOpenAlerts: () => void;
  onRequireAuth: () => void;
}

function formatMoneyRange(min: number | null, max: number | null, currency = 'ETB'): string {
  if (!min && !max) return 'Competitive / Undisclosed';
  const fmt = (n: number) => n.toLocaleString('en-US');
  if (min && max && min !== max) return `${fmt(min)} – ${fmt(max)} ${currency}`;
  return `${fmt(min || max || 0)} ${currency}`;
}

function formatDateShort(iso: string | null): string {
  if (!iso) return 'Open until filled';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Open';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function JobBoardView({
  user,
  lang,
  onToggleLang,
  savedJobIds,
  onToggleSaveJob,
  onOpenApply,
  onOpenJobPage,
  onOpenAlerts,
  onRequireAuth,
}: JobBoardViewProps) {
  const t = DICT[lang];
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobItem | null>(null);
  const [categories, setCategories] = useState<JobCategory[]>([]);
  const [sources, setSources] = useState<PublicSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter State
  const [q, setQ] = useState('');
  const [location, setLocation] = useState('');
  const [company, setCompany] = useState('');
  const [originFilter, setOriginFilter] = useState<'' | 'external' | 'tatari'>('');
  const [categoryId, setCategoryId] = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [datePosted, setDatePosted] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [retryCount, setRetryCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    Promise.all([
      apiFetch<{ categories: JobCategory[] }>('/api/categories'),
      apiFetch<{ sources: PublicSource[] }>('/api/sources/public'),
    ])
      .then(([catRes, srcRes]) => {
        setCategories(catRes.categories);
        setSources(srcRes.sources);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (company.trim()) params.set('company', company.trim());
    if (location.trim()) params.set('location', location.trim());
    if (originFilter) params.set('job_origin', originFilter);
    if (categoryId) params.set('category_id', categoryId);
    if (employmentType) params.set('employment_type', employmentType);
    if (salaryMin) params.set('salary_min', salaryMin);
    if (datePosted) params.set('date_posted', datePosted);
    if (sourceId) params.set('source_id', sourceId);
    if (featuredOnly) params.set('featured', '1');
    if (expiringOnly) params.set('expiring_soon', '1');
    params.set('page', String(page));
    params.set('limit', '10');

    apiFetch<{ jobs: JobItem[]; total: number; totalPages: number }>(`/api/jobs?${params.toString()}`)
      .then((res) => {
        if (!active) return;
        setJobs(res.jobs);
        setTotal(res.total);
        setTotalPages(res.totalPages);
        setSelectedJob((prev) => {
          if (prev && res.jobs.some((j) => j.id === prev.id)) {
            return res.jobs.find((j) => j.id === prev.id) || res.jobs[0] || null;
          }
          return res.jobs[0] || null;
        });
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load job listings');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [q, company, location, originFilter, categoryId, employmentType, salaryMin, datePosted, sourceId, featuredOnly, expiringOnly, page, retryCount]);

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    setPage(1);
  }

  function resetAllFilters() {
    setQ('');
    setCompany('');
    setLocation('');
    setOriginFilter('');
    setCategoryId('');
    setEmploymentType('');
    setSalaryMin('');
    setDatePosted('');
    setSourceId('');
    setFeaturedOnly(false);
    setExpiringOnly(false);
    setPage(1);
  }

  async function handleBookmarkClick(jobId: number) {
    if (!user) {
      onRequireAuth();
      return;
    }
    await onToggleSaveJob(jobId);
  }

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Workspace Hero & Search Bar */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-7 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900" style={{ textWrap: 'balance' }}>
              {t.heroTitle}
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              {t.heroSubtitle}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenAlerts}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
            >
              <Bell className="w-3.5 h-3.5" />
              Job Alerts
            </button>
            <button
              type="button"
              onClick={onToggleLang}
              className="px-3 py-2 text-xs font-semibold text-[#164081] bg-[#164081]/8 hover:bg-[#164081]/15 rounded-lg transition-colors whitespace-nowrap"
              aria-label="Toggle language between English and Amharic"
            >
              {lang === 'en' ? 'አማርኛ (AM)' : 'English (EN)'}
            </button>
          </div>
        </div>

        {/* Dual What / Where Search Form */}
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5 relative">
            <label htmlFor="search-what" className="sr-only">
              Job title or company
            </label>
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="search-what"
              type="text"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder={t.whatPlaceholder}
              className="w-full pl-10 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#164081]"
            />
          </div>

          <div className="md:col-span-4 relative">
            <label htmlFor="search-where" className="sr-only">
              Location
            </label>
            <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="search-where"
              type="text"
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                setPage(1);
              }}
              placeholder={t.wherePlaceholder}
              className="w-full pl-10 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#164081]"
            />
          </div>

          <div className="md:col-span-3 flex gap-2">
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 text-sm font-semibold text-white bg-[#164081] hover:bg-[#103063] rounded-lg transition-colors whitespace-nowrap"
            >
              {t.searchBtn}
            </button>
            <button
              type="button"
              onClick={() => setShowMoreFilters((v) => !v)}
              aria-expanded={showMoreFilters}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-lg border transition-colors whitespace-nowrap ${
                showMoreFilters
                  ? 'border-[#164081] bg-[#164081]/5 text-[#164081]'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
            </button>
          </div>
        </form>

        {/* Origin Segmented Control + Quick Spotlight Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-1 p-1 bg-slate-100 rounded-lg max-w-full">
            <button
              type="button"
              onClick={() => {
                setOriginFilter('');
                setPage(1);
              }}
              className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                originFilter === '' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.allOrigins}
            </button>
            <button
              type="button"
              onClick={() => {
                setOriginFilter('external');
                setPage(1);
              }}
              className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                originFilter === 'external' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.externalOnly}
            </button>
            <button
              type="button"
              onClick={() => {
                setOriginFilter('tatari');
                setPage(1);
              }}
              className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                originFilter === 'tatari' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.tatariOnly}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setFeaturedOnly((v) => !v);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                featuredOnly
                  ? 'border-[#164081] bg-[#164081]/8 text-[#164081]'
                  : 'border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.featured}
            </button>
            <button
              type="button"
              onClick={() => {
                setExpiringOnly((v) => !v);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                expiringOnly
                  ? 'border-amber-600 bg-amber-50 text-amber-800'
                  : 'border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.expiringSoon}
            </button>
            {(q || company || location || originFilter || categoryId || employmentType || salaryMin || datePosted || sourceId || featuredOnly || expiringOnly) && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 underline"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Expanded Multi-Criteria Filter Drawer */}
        {showMoreFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-4 border-t border-slate-200">
            <div>
              <label htmlFor="filter-category" className="block text-xs font-medium text-slate-600 mb-1">
                Category
              </label>
              <select
                id="filter-category"
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.active_count ?? 0})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filter-source" className="block text-xs font-medium text-slate-600 mb-1">
                Job Source
              </label>
              <select
                id="filter-source"
                value={sourceId}
                onChange={(e) => {
                  setSourceId(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              >
                <option value="">All Ethiopian Sources</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.source_name} ({s.active_count})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filter-type" className="block text-xs font-medium text-slate-600 mb-1">
                Employment Type
              </label>
              <select
                id="filter-type"
                value={employmentType}
                onChange={(e) => {
                  setEmploymentType(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              >
                <option value="">Any Type</option>
                <option value="Full-time">Full-time</option>
                <option value="Contract">Contract</option>
                <option value="Part-time">Part-time</option>
                <option value="Internship">Internship</option>
                <option value="Consultancy">Consultancy</option>
              </select>
            </div>

            <div>
              <label htmlFor="filter-salary" className="block text-xs font-medium text-slate-600 mb-1">
                Min Salary (ETB)
              </label>
              <select
                id="filter-salary"
                value={salaryMin}
                onChange={(e) => {
                  setSalaryMin(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              >
                <option value="">Any Salary</option>
                <option value="15000">15,000+ ETB</option>
                <option value="25000">25,000+ ETB</option>
                <option value="40000">40,000+ ETB</option>
                <option value="60000">60,000+ ETB</option>
              </select>
            </div>

            <div>
              <label htmlFor="filter-date" className="block text-xs font-medium text-slate-600 mb-1">
                Date Posted
              </label>
              <select
                id="filter-date"
                value={datePosted}
                onChange={(e) => {
                  setDatePosted(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              >
                <option value="">Any Time</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
            </div>

            <div>
              <label htmlFor="filter-company" className="block text-xs font-medium text-slate-600 mb-1">
                Company
              </label>
              <input
                id="filter-company"
                type="text"
                value={company}
                onChange={(e) => {
                  setCompany(e.target.value);
                  setPage(1);
                }}
                placeholder="Filter company..."
                className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>
        )}
      </section>

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-slate-600 px-1">
        <span className="font-medium tabular-nums" data-testid="jobs-count">
          Showing {jobs.length} of {total} active Ethiopian vacancies
        </span>
        <span className="hidden sm:inline text-slate-500">
          External jobs redirect to their original website · Tatari jobs open for direct application
        </span>
      </div>

      {/* Master-Detail Grid */}
      {error ? (
        <div role="alert" className="bg-white border border-red-200 rounded-xl p-8 text-center space-y-2">
          <p className="text-sm font-semibold text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => setRetryCount((c) => c + 1)}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#164081] rounded-lg"
          >
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-36 bg-white border border-slate-200 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="hidden lg:block lg:col-span-7 h-[460px] bg-white border border-slate-200 rounded-xl animate-pulse" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
          <p className="text-base font-semibold text-slate-900">No vacancies match your filters</p>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Try widening your search terms, clearing the salary minimum, or switching between External and Tatari job sources.
          </p>
          <button
            type="button"
            onClick={resetAllFilters}
            className="px-4 py-2 text-sm font-semibold text-white bg-[#164081] hover:bg-[#103063] rounded-lg"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Job Cards List */}
          <div className="lg:col-span-5 space-y-3" data-testid="job-list">
            {jobs.map((job) => {
              const isSelected = selectedJob?.id === job.id;
              const isSaved = savedJobIds.has(job.id);
              const isExternal = job.job_origin === 'external';

              return (
                <article
                  key={job.id}
                  className={`bg-white rounded-xl border transition-colors p-5 ${
                    isSelected
                      ? 'border-[#164081] ring-1 ring-[#164081]/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      {/* Origin & Category Clean Unboxed Line */}
                      <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
                        <span className={isExternal ? 'text-teal-700' : 'text-[#164081]'}>
                          {isExternal ? `Source: ${job.source_name || 'External Partner'}` : t.publishedOnTatari}
                        </span>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <span className="text-slate-500">{job.category_name}</span>
                        {job.expiring_soon && (
                          <>
                            <span aria-hidden="true" className="text-slate-300">
                              ·
                            </span>
                            <span className="text-amber-700 font-semibold">{t.expiringSoon}</span>
                          </>
                        )}
                      </div>

                      <h2 className="text-base font-bold text-slate-900 leading-snug">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedJob(job);
                            if (window.innerWidth < 1024) {
                              setTimeout(() => {
                                document.getElementById('job-detail-pane')?.scrollIntoView({ behavior: 'smooth' });
                              }, 50);
                            }
                          }}
                          className="text-left hover:text-[#164081] transition-colors focus:outline-none focus-visible:underline"
                        >
                          {job.title}
                        </button>
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleBookmarkClick(job.id)}
                      aria-label={isSaved ? `Remove ${job.title} from saved jobs` : `Save ${job.title}`}
                      className="p-2 text-slate-400 hover:text-[#164081] rounded-lg hover:bg-slate-50 shrink-0"
                    >
                      {isSaved ? (
                        <BookmarkCheck className="w-4 h-4 text-[#164081]" />
                      ) : (
                        <Bookmark className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                    <span className="font-medium text-slate-800">{job.company_name}</span>
                    <span aria-hidden="true" className="text-slate-300">
                      ·
                    </span>
                    <span>{job.location}</span>
                    <span aria-hidden="true" className="text-slate-300">
                      ·
                    </span>
                    <span>{job.employment_type}</span>
                  </div>

                  <p className="mt-2.5 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {job.description}
                  </p>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-3 text-slate-500 tabular-nums">
                      <span className="font-semibold text-slate-800">
                        {formatMoneyRange(job.salary_min, job.salary_max, job.salary_currency)}
                      </span>
                      <span>Due {formatDateShort(job.application_deadline)}</span>
                    </div>

                    {isExternal && job.original_job_url ? (
                      <a
                        href={job.original_job_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:text-teal-900 whitespace-nowrap"
                      >
                        {t.viewOriginalJob}
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedJob(job);
                          if (window.innerWidth < 1024) {
                            setTimeout(() => {
                              document.getElementById('job-detail-pane')?.scrollIntoView({ behavior: 'smooth' });
                            }, 50);
                          }
                        }}
                        className="font-semibold text-[#164081] hover:underline whitespace-nowrap"
                      >
                        {t.viewDetails}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <span className="font-medium text-slate-600 tabular-nums">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Sticky Job Detail Pane with Strict Origin Redirection Logic */}
          {selectedJob && (
            <aside
              id="job-detail-pane"
              aria-label="Selected Job Details"
              className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 lg:sticky lg:top-20 space-y-6"
              data-testid="job-detail-pane"
            >
              <div className="space-y-3 pb-5 border-b border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    {selectedJob.job_origin === 'external' ? (
                      <span className="text-teal-700">
                        Source: {selectedJob.source_name || 'External Website'}
                      </span>
                    ) : (
                      <span className="text-[#164081]">{t.publishedOnTatari}</span>
                    )}
                    <span aria-hidden="true" className="text-slate-300">
                      ·
                    </span>
                    <span className="text-slate-600 font-medium">{selectedJob.category_name}</span>
                    {selectedJob.is_featured === 1 && (
                      <>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <span className="text-[#164081]">{t.featured}</span>
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenJobPage(selectedJob.slug)}
                    className="text-xs font-medium text-slate-500 hover:text-[#164081] underline"
                  >
                    Open full job URL
                  </button>
                </div>

                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                  {selectedJob.title}
                </h2>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    {selectedJob.company_name}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    {selectedJob.location}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4 text-slate-400" />
                    {selectedJob.employment_type}
                  </span>
                </div>

                {/* Primary Origin-Aware Action Bar */}
                <div className="pt-3 flex flex-wrap items-center gap-3">
                  {selectedJob.job_origin === 'external' ? (
                    <a
                      href={selectedJob.original_job_url || selectedJob.source_website_url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
                    >
                      {t.applyOnOriginal}
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onOpenApply(selectedJob)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#164081] hover:bg-[#103063] rounded-lg transition-colors"
                    >
                      {t.applyOnTatari}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleBookmarkClick(selectedJob.id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    {savedJobIds.has(selectedJob.id) ? (
                      <>
                        <BookmarkCheck className="w-4 h-4 text-[#164081]" />
                        Saved
                      </>
                    ) : (
                      <>
                        <Bookmark className="w-4 h-4" />
                        Save Job
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Structured Compensation & Timeline Facts */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-2 border-b border-slate-100 text-sm">
                <div>
                  <span className="block text-xs text-slate-500">Compensation</span>
                  <span className="font-semibold text-slate-900 tabular-nums">
                    {formatMoneyRange(selectedJob.salary_min, selectedJob.salary_max, selectedJob.salary_currency)}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-slate-500">Published Date</span>
                  <span className="inline-flex items-center gap-1 font-medium text-slate-900 tabular-nums">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {formatDateShort(selectedJob.published_at)}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-slate-500">Application Deadline</span>
                  <span
                    className={`inline-flex items-center gap-1 font-medium tabular-nums ${
                      selectedJob.expiring_soon ? 'text-amber-700 font-semibold' : 'text-slate-900'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    {formatDateShort(selectedJob.application_deadline)}
                  </span>
                </div>
              </div>

              {/* Description & Origin Transparency Notice */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900">Vacancy Summary &amp; Requirements</h3>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {selectedJob.description}
                </p>

                {selectedJob.job_origin === 'external' ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs text-slate-600">
                    <p className="font-semibold text-slate-800">
                      Original Source Attribution: {selectedJob.source_name}
                    </p>
                    <p>
                      This vacancy was collected from{' '}
                      <span className="font-medium text-slate-900">{selectedJob.source_name}</span>. Tatari indexes
                      this listing for unified Ethiopian job discovery; all applications and full employer instructions
                      take place directly on the original publishing website.
                    </p>
                    {selectedJob.original_job_url && (
                      <a
                        href={selectedJob.original_job_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-semibold text-teal-700 hover:underline pt-1 break-all"
                      >
                        <span className="break-all">
                          {t.viewOriginalJob}: {selectedJob.original_job_url}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-[#164081]/5 border border-[#164081]/15 rounded-lg text-xs text-slate-700">
                    <span className="font-semibold text-[#164081]">Published directly on TATARI:</span>{' '}
                    Your application is delivered straight to {selectedJob.company_name}&apos;s hiring team inside
                    Tatari.
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
