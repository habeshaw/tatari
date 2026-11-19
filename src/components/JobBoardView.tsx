import React, { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  MapPin,
  Search,
  Share2,
  Star,
  X,
} from 'lucide-react';
import { filterJobs, formatRelativeDays } from '../lib/storeLogic';
import { TRANSLATIONS } from '../lib/i18n';
import type { JobApplication, JobFilterCriteria, JobListing, Language } from '../types/domain';

interface JobBoardViewProps {
  jobs: JobListing[];
  savedJobIds: string[];
  applications: JobApplication[];
  currentUserEmail: string;
  language: Language;
  onToggleLanguage: (lang: Language) => void;
  onToggleSaveJob: (jobId: string) => void;
  onOpenApplyModal: (job: JobListing) => void;
  onNavigateEmployer: () => void;
}

export const JobBoardView: React.FC<JobBoardViewProps> = ({
  jobs,
  savedJobIds,
  applications,
  currentUserEmail,
  language,
  onToggleLanguage,
  onToggleSaveJob,
  onOpenApplyModal,
  onNavigateEmployer,
}) => {
  const t = TRANSLATIONS[language];

  const [criteria, setCriteria] = useState<JobFilterCriteria>({
    what: '',
    where: '',
    category: 'all',
    jobType: 'all',
    remoteType: 'all',
    minSalary: 0,
    postedWithinDays: 0,
  });

  const [whatInput, setWhatInput] = useState('');
  const [whereInput, setWhereInput] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('job');
    }
    return null;
  });
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [copiedJobId, setCopiedJobId] = useState<string | null>(null);

  const visibleJobs = useMemo(() => {
    const base = filterJobs(jobs, criteria);
    if (!companyFilter) return base;
    return base.filter((j) => j.companyName.toLowerCase() === companyFilter.toLowerCase());
  }, [jobs, criteria, companyFilter]);

  useEffect(() => {
    if (visibleJobs.length === 0) {
      setSelectedJobId(null);
      return;
    }
    const stillVisible = visibleJobs.some((j) => j.id === selectedJobId);
    if (!stillVisible) {
      setSelectedJobId(visibleJobs[0].id);
    }
  }, [visibleJobs, selectedJobId]);

  const selectedJob = useMemo(
    () => visibleJobs.find((j) => j.id === selectedJobId) || visibleJobs[0] || null,
    [visibleJobs, selectedJobId]
  );

  const handleCopyShareLink = (jobId: string) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('job', jobId);
    window.history.replaceState({}, '', url.toString());
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url.toString()).catch(() => {});
    }
    setCopiedJobId(jobId);
    window.setTimeout(() => setCopiedJobId((prev) => (prev === jobId ? null : prev)), 2500);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCriteria((prev) => ({
      ...prev,
      what: whatInput,
      where: whereInput,
    }));
  };

  const resetAllFilters = () => {
    setWhatInput('');
    setWhereInput('');
    setCompanyFilter('');
    setCriteria({
      what: '',
      where: '',
      category: 'all',
      jobType: 'all',
      remoteType: 'all',
      minSalary: 0,
      postedWithinDays: 0,
    });
  };

  const isJobApplied = (jobId: string) =>
    applications.some(
      (a) =>
        a.jobId === jobId &&
        a.applicantEmail.toLowerCase() === currentUserEmail.toLowerCase()
    );

  const renderJobDetailContent = (job: JobListing) => {
    const saved = savedJobIds.includes(job.id);
    const applied = isJobApplied(job.id);
    const title = language === 'am' && job.titleAm ? job.titleAm : job.titleEn;
    const description =
      language === 'am' && job.descriptionAm ? job.descriptionAm : job.descriptionEn;

    return (
      <div className="flex flex-col">
        <div className="border-b border-slate-200 pb-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              {job.isFeatured && (
                <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-[#0F766E]">
                  Sponsored · Featured Vacancy
                </div>
              )}
              <h2 className="font-display text-xl font-bold text-slate-900 sm:text-2xl">
                {title}
              </h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-700">
                <button
                  type="button"
                  onClick={() =>
                    setCompanyFilter((prev) =>
                      prev === job.companyName ? '' : job.companyName
                    )
                  }
                  className="font-semibold text-[#164081] hover:underline"
                  title="Filter vacancies by this employer"
                >
                  {job.companyName}
                </button>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 tabular-nums text-slate-600">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {job.companyRating.toFixed(1)}
                </span>
                <span aria-hidden="true">·</span>
                <span>{job.location}</span>
              </div>
              <p className="mt-1.5 text-sm font-semibold text-slate-800 tabular-nums">
                {job.salaryDisplay} · {job.jobType} · {job.remoteType}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {applied ? (
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white opacity-90"
              >
                <CheckCircle2 className="h-4 w-4" />
                {t.appliedBadge}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onOpenApplyModal(job)}
                className="inline-flex items-center gap-2 rounded-lg bg-[#164081] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#102E61] whitespace-nowrap shrink-0"
              >
                {t.applyNow}
              </button>
            )}

            <button
              type="button"
              onClick={() => onToggleSaveJob(job.id)}
              aria-pressed={saved}
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                saved
                  ? 'border-[#164081] bg-[#F0F5FF] text-[#164081]'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Bookmark className={`h-4 w-4 ${saved ? 'fill-[#164081]' : ''}`} />
              {saved ? t.savedJob : t.saveJob}
            </button>

            <button
              type="button"
              onClick={() => handleCopyShareLink(job.id)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              {copiedJobId === job.id ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Link Copied</span>
                </>
              ) : (
                <>
                  <Share2 className="h-3.5 w-3.5" />
                  <span>Share Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-6 text-sm leading-relaxed text-slate-700">
          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-slate-500">
              Job Details
            </h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 border-y border-slate-100 py-3 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Pay</dt>
                <dd className="font-semibold text-slate-900 tabular-nums">{job.salaryDisplay}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Job Type &amp; Setting</dt>
                <dd className="font-semibold text-slate-900">
                  {job.jobType} · {job.remoteType}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Experience Level</dt>
                <dd className="font-semibold text-slate-900">{job.experienceLevel}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Application Deadline</dt>
                <dd className="font-semibold text-slate-900 tabular-nums">{job.deadline}</dd>
              </div>
            </dl>
          </div>

          <div>
            <h3 className="font-display text-base font-bold text-slate-900">
              Full Job Description
            </h3>
            <p className="mt-2 whitespace-pre-line text-slate-700">{description}</p>
          </div>

          {job.requirements.length > 0 && (
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">
                Qualifications &amp; Requirements
              </h3>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-slate-700">
                {job.requirements.map((req, idx) => (
                  <li key={idx}>{req}</li>
                ))}
              </ul>
            </div>
          )}

          {job.benefits.length > 0 && (
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">Benefits</h3>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-slate-700">
                {job.benefits.map((b, idx) => (
                  <li key={idx}>{b}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="border-t border-slate-200 pt-4 text-xs text-slate-500">
            Verified Employer Listing · Published{' '}
            {formatRelativeDays(job.publishedAt || job.createdAt)} · Sector: {job.category}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[#F7F8FA]">
      {/* Indeed-style Search Hero Section */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-2xl">
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                {t.jobsHeroTitle}
              </h1>
              <p className="mt-1.5 text-sm text-slate-600">{t.jobsHeroSubtitle}</p>
            </div>

            <div className="flex items-center gap-3">
              {/* Language Segmented Control */}
              <div
                role="group"
                aria-label="Language switch"
                className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 p-1"
              >
                <button
                  type="button"
                  onClick={() => onToggleLanguage('en')}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                    language === 'en'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => onToggleLanguage('am')}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                    language === 'am'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  አማ
                </button>
              </div>

              <button
                type="button"
                onClick={onNavigateEmployer}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                Employers: Post a Job
              </button>
            </div>
          </div>

          {/* Dual "What" + "Where" Search Bar */}
          <form
            onSubmit={handleSearchSubmit}
            className="mt-6 grid grid-cols-1 gap-2 rounded-xl border border-slate-300 bg-white p-2 shadow-sm md:grid-cols-[1.3fr_1fr_auto]"
          >
            <label className="flex items-center gap-2.5 rounded-lg px-3 py-2 focus-within:bg-slate-50">
              <span className="text-xs font-bold text-slate-900 shrink-0">What</span>
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={whatInput}
                onChange={(e) => {
                  setWhatInput(e.target.value);
                  setCriteria((prev) => ({ ...prev, what: e.target.value }));
                }}
                placeholder={t.whatPlaceholder}
                className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
            </label>

            <label className="flex items-center gap-2.5 border-t border-slate-200 px-3 py-2 focus-within:bg-slate-50 md:border-l md:border-t-0">
              <span className="text-xs font-bold text-slate-900 shrink-0">Where</span>
              <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={whereInput}
                onChange={(e) => {
                  setWhereInput(e.target.value);
                  setCriteria((prev) => ({ ...prev, where: e.target.value }));
                }}
                placeholder={t.wherePlaceholder}
                className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
            </label>

            <button
              type="submit"
              className="rounded-lg bg-[#164081] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#102E61] whitespace-nowrap shrink-0"
            >
              {t.findJobs}
            </button>
          </form>

          {/* Filter Strip */}
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <select
              aria-label="Filter by date posted"
              value={criteria.postedWithinDays}
              onChange={(e) =>
                setCriteria((prev) => ({ ...prev, postedWithinDays: Number(e.target.value) }))
              }
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#164081] focus:outline-none"
            >
              <option value={0}>Date posted: Any time</option>
              <option value={1}>Last 24 hours</option>
              <option value={3}>Last 3 days</option>
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
            </select>

            <select
              aria-label="Filter by job type"
              value={criteria.jobType}
              onChange={(e) => setCriteria((prev) => ({ ...prev, jobType: e.target.value }))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#164081] focus:outline-none"
            >
              <option value="all">Job type: All</option>
              <option value="Full-time">Full-time</option>
              <option value="Part-time">Part-time</option>
              <option value="Contract">Contract</option>
              <option value="Internship">Internship</option>
            </select>

            <select
              aria-label="Filter by remote setting"
              value={criteria.remoteType}
              onChange={(e) => setCriteria((prev) => ({ ...prev, remoteType: e.target.value }))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#164081] focus:outline-none"
            >
              <option value="all">Work setting: All</option>
              <option value="On-site">On-site</option>
              <option value="Hybrid">Hybrid</option>
              <option value="Remote">Remote</option>
            </select>

            <select
              aria-label="Filter by category"
              value={criteria.category}
              onChange={(e) => setCriteria((prev) => ({ ...prev, category: e.target.value }))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#164081] focus:outline-none"
            >
              <option value="all">Category: All sectors</option>
              <option value="IT & Data">IT &amp; Data</option>
              <option value="HR & Admin">HR &amp; Admin</option>
              <option value="Finance">Finance</option>
              <option value="Engineering">Engineering</option>
              <option value="NGO & Development">NGO &amp; Development</option>
              <option value="Healthcare">Healthcare</option>
            </select>

            <select
              aria-label="Filter by minimum salary"
              value={criteria.minSalary}
              onChange={(e) =>
                setCriteria((prev) => ({ ...prev, minSalary: Number(e.target.value) }))
              }
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#164081] focus:outline-none tabular-nums"
            >
              <option value={0}>Salary: Any ETB</option>
              <option value={20000}>20,000+ ETB/mo</option>
              <option value={30000}>30,000+ ETB/mo</option>
              <option value={40000}>40,000+ ETB/mo</option>
              <option value={50000}>50,000+ ETB/mo</option>
            </select>

            {(criteria.what ||
              criteria.where ||
              companyFilter ||
              criteria.category !== 'all' ||
              criteria.jobType !== 'all' ||
              criteria.remoteType !== 'all' ||
              criteria.minSalary > 0 ||
              criteria.postedWithinDays > 0) && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="text-xs font-semibold text-[#164081] hover:underline px-2 py-1"
              >
                Reset filters{companyFilter ? ` (Company: ${companyFilter})` : ''}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Master-Detail Split Job Board */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
          <span className="tabular-nums font-medium">
            Showing {visibleJobs.length} approved {visibleJobs.length === 1 ? 'job' : 'jobs'}
            {companyFilter ? ` at ${companyFilter}` : ''}
          </span>
          <span>Sorted by newest verified listings</span>
        </div>

        {visibleJobs.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
            <Briefcase className="mx-auto h-10 w-10 text-slate-400" />
            <h2 className="mt-3 font-display text-lg font-bold text-slate-900">
              No matching jobs found
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Try broadening your keywords, removing salary constraints, or clearing location filters.
            </p>
            <button
              type="button"
              onClick={resetAllFilters}
              className="mt-4 rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102E61]"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
            {/* Left Column: Job Cards List */}
            <div className="space-y-3 lg:col-span-5" data-testid="job-list">
              {visibleJobs.map((job) => {
                const isSelected = selectedJob?.id === job.id;
                const saved = savedJobIds.includes(job.id);
                const applied = isJobApplied(job.id);
                const title = language === 'am' && job.titleAm ? job.titleAm : job.titleEn;

                return (
                  <article
                    key={job.id}
                    className={`rounded-xl border bg-white p-5 transition-colors ${
                      isSelected
                        ? 'border-[#164081] bg-[#F5F8FD] shadow-xs'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedJobId(job.id);
                          setMobileDetailOpen(true);
                          if (typeof window !== 'undefined') {
                            const url = new URL(window.location.href);
                            url.searchParams.set('job', job.id);
                            window.history.replaceState({}, '', url.toString());
                          }
                        }}
                        className="text-left focus-visible:outline-2 focus-visible:outline-[#164081]"
                      >
                        {job.isFeatured && (
                          <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0F766E]">
                            Sponsored
                          </div>
                        )}
                        <h3 className="font-display text-base font-bold text-slate-900 hover:text-[#164081]">
                          {title}
                        </h3>
                      </button>

                      <button
                        type="button"
                        aria-label={saved ? `Remove ${job.titleEn} from saved` : `Save ${job.titleEn}`}
                        onClick={() => onToggleSaveJob(job.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-[#164081]"
                      >
                        <Bookmark
                          className={`h-4 w-4 ${saved ? 'fill-[#164081] text-[#164081]' : ''}`}
                        />
                      </button>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-slate-700">
                      <span className="inline-flex items-center gap-1 font-medium">
                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                        {job.companyName}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="text-slate-600">{job.location}</span>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-medium text-slate-600 tabular-nums">
                      <span className="font-semibold text-slate-900">{job.salaryDisplay}</span>
                      <span aria-hidden="true">·</span>
                      <span>{job.jobType}</span>
                      <span aria-hidden="true">·</span>
                      <span>{job.remoteType}</span>
                    </div>

                    <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-slate-600">
                      {job.summaryEn}
                    </p>

                    <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                      <span className="inline-flex items-center gap-1 text-slate-500 tabular-nums">
                        <Clock className="h-3.5 w-3.5" />
                        {formatRelativeDays(job.publishedAt || job.createdAt)}
                      </span>
                      <span className="font-semibold text-[#0F766E]">
                        {applied ? 'Applied ✓' : job.easyApply ? 'Easy Apply' : 'Direct Apply'}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Right Column: Sticky Job Detail Pane (Desktop) */}
            <aside className="hidden lg:sticky lg:top-22 lg:col-span-7 lg:block">
              {selectedJob && (
                <div className="max-h-[calc(100vh-7.5rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                  {renderJobDetailContent(selectedJob)}
                </div>
              )}
            </aside>
          </div>
        )}
      </main>

      {/* Mobile Job Detail Drawer */}
      {mobileDetailOpen && selectedJob && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-slate-950/50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={selectedJob.titleEn}
        >
          <div className="max-h-[88vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Job Details
              </span>
              <button
                type="button"
                aria-label="Close job details"
                onClick={() => setMobileDetailOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {renderJobDetailContent(selectedJob)}
          </div>
        </div>
      )}
    </div>
  );
};
