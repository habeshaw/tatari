import { useEffect, useState } from 'react';
import { ArrowLeft, Briefcase, Building2, Calendar, Clock, ExternalLink, MapPin } from 'lucide-react';
import { apiFetch } from '../api';
import type { JobItem } from '../types';

interface JobDetailPageProps {
  slug: string;
  onBack: () => void;
  onOpenApply: (job: JobItem) => void;
}

export function JobDetailPage({ slug, onBack, onOpenApply }: JobDetailPageProps) {
  const [job, setJob] = useState<JobItem | null>(null);
  const [jsonLd, setJsonLd] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    apiFetch<{ job: JobItem; jsonLd: Record<string, unknown> | null }>(`/api/jobs/${encodeURIComponent(slug)}`)
      .then((res) => {
        if (!active) return;
        setJob(res.job);
        setJsonLd(res.jsonLd);
        document.title = `${res.job.title} at ${res.job.company_name} — TATARI`;
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load job');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      document.title = 'TATARI — Ethiopian Job Search Portal & Digital Store';
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="h-80 bg-white border border-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4">
          <p className="text-base font-semibold text-slate-900">{error || 'Vacancy not found'}</p>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#164081] rounded-lg"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Job Board
          </button>
        </div>
      </div>
    );
  }

  const isExternal = job.job_origin === 'external';
  const isExpired = job.status === 'expired';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-5">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to all Ethiopian jobs
      </button>

      <article className="bg-white border border-slate-200 rounded-xl p-6 sm:p-10 space-y-6">
        <div className="space-y-3 pb-6 border-b border-slate-200">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className={isExternal ? 'text-teal-700' : 'text-[#164081]'}>
              {isExternal ? `Source: ${job.source_name || 'External Partner'}` : 'Published on Tatari'}
            </span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span className="text-slate-600 font-medium">{job.category_name}</span>
            {isExpired && (
              <>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span className="text-red-700 font-semibold">Expired</span>
              </>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{job.title}</h1>

          <div className="flex flex-wrap items-center gap-5 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
              <Building2 className="w-4 h-4 text-slate-400" />
              {job.company_name}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-slate-400" />
              {job.location}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-slate-400" />
              {job.employment_type}
            </span>
          </div>

          <div className="pt-3 flex flex-wrap gap-3">
            {isExpired ? (
              <span className="px-4 py-2.5 text-sm font-medium text-slate-500 bg-slate-100 rounded-lg">
                This vacancy has closed
              </span>
            ) : isExternal ? (
              <a
                href={job.original_job_url || job.source_website_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
              >
                Apply on Original Website
                <ExternalLink className="w-4 h-4" />
              </a>
            ) : (
              <button
                type="button"
                onClick={() => onOpenApply(job)}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-[#164081] hover:bg-[#103063] rounded-lg"
              >
                Apply on Tatari
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm pb-4 border-b border-slate-100">
          <div>
            <span className="block text-xs text-slate-500">Salary Range</span>
            <span className="font-semibold text-slate-900 tabular-nums">
              {job.salary_min
                ? `${job.salary_min.toLocaleString()} – ${(job.salary_max || job.salary_min).toLocaleString()} ${job.salary_currency}`
                : 'Competitive / Undisclosed'}
            </span>
          </div>
          <div>
            <span className="block text-xs text-slate-500">Published</span>
            <span className="inline-flex items-center gap-1 text-slate-800 tabular-nums">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {new Date(job.published_at).toLocaleDateString()}
            </span>
          </div>
          <div>
            <span className="block text-xs text-slate-500">Deadline</span>
            <span className="inline-flex items-center gap-1 text-slate-800 tabular-nums">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {job.application_deadline ? new Date(job.application_deadline).toLocaleDateString() : 'Open'}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">Job Description</h2>
          <p className="text-sm sm:text-base text-slate-700 leading-relaxed whitespace-pre-line">
            {job.description}
          </p>
        </div>

        {isExternal && job.original_job_url && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-900">
              Source Attribution: {job.source_name}
            </p>
            <p>
              Originally published at{' '}
              <a
                href={job.original_job_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-700 font-medium underline break-all"
              >
                {job.original_job_url}
              </a>
            </p>
          </div>
        )}
      </article>
    </div>
  );
}
