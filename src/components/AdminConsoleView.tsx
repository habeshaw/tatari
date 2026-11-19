import { useEffect, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react';
import { apiFetch } from '../api';
import type {
  AdminStats,
  AuthUser,
  CollectionLog,
  JobCategory,
  JobItem,
  JobSource,
} from '../types';

interface AdminConsoleViewProps {
  user: AuthUser | null;
  onRequireAuth: () => void;
}

type AdminSection = 'sources' | 'jobs' | 'logs' | 'payments';

interface PaymentQueueItem {
  id: number;
  item_title: string;
  buyer_name: string;
  buyer_email: string;
  payment_method: string;
  payment_ref: string;
  amount_etb?: number;
  status: string;
  created_at: string;
  payment_type: 'store_order' | 'job_posting';
}

interface EmployerRow {
  id: number;
  name: string;
  email: string;
  company_name: string;
  business_tin: string;
  status: string;
}

export function AdminConsoleView({ user, onRequireAuth }: AdminConsoleViewProps) {
  const [section, setSection] = useState<AdminSection>('sources');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [sources, setSources] = useState<JobSource[]>([]);
  const [logs, setLogs] = useState<CollectionLog[]>([]);
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [categories, setCategories] = useState<JobCategory[]>([]);
  const [payments, setPayments] = useState<PaymentQueueItem[]>([]);
  const [employers, setEmployers] = useState<EmployerRow[]>([]);
  const [jobStatusFilter, setJobStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [runningSourceId, setRunningSourceId] = useState<number | 'all' | null>(null);
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  // Add Source Form
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [newWebsiteUrl, setNewWebsiteUrl] = useState('');
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [newMethod, setNewMethod] = useState<'rss' | 'json_api' | 'html_directory' | 'partner_feed'>('rss');
  const [newFrequency, setNewFrequency] = useState<'hourly' | 'every_6h' | 'daily' | 'manual'>('every_6h');

  async function loadAdminData() {
    if (!user || user.role !== 'admin') return;
    setLoading(true);
    try {
      const [statsRes, sourcesRes, logsRes, jobsRes, catRes, payRes, empRes] = await Promise.all([
        apiFetch<{ stats: AdminStats }>('/api/admin/stats'),
        apiFetch<{ sources: JobSource[] }>('/api/admin/sources'),
        apiFetch<{ logs: CollectionLog[] }>('/api/admin/logs'),
        apiFetch<{ jobs: JobItem[] }>(`/api/admin/jobs${jobStatusFilter ? `?status=${jobStatusFilter}` : ''}`),
        apiFetch<{ categories: JobCategory[] }>('/api/categories'),
        apiFetch<{ storeOrders: PaymentQueueItem[]; employerJobs: PaymentQueueItem[] }>('/api/admin/payments'),
        apiFetch<{ employers: EmployerRow[] }>('/api/admin/employers'),
      ]);
      setStats(statsRes.stats);
      setSources(sourcesRes.sources);
      setLogs(logsRes.logs);
      setJobs(jobsRes.jobs);
      setCategories(catRes.categories);
      setPayments([...payRes.storeOrders, ...payRes.employerJobs]);
      setEmployers(empRes.employers);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdminData();
  }, [user, jobStatusFilter]);

  if (!user || user.role !== 'admin') {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-4">
          <h1 className="text-xl font-bold text-slate-900">Administrator Console</h1>
          <p className="text-sm text-slate-600">
            Authorized administrator credentials are required to manage Ethiopian job aggregation sources, review collected listings, and verify Telebirr/CBE payments.
          </p>
          <button
            type="button"
            onClick={onRequireAuth}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-[#164081] hover:bg-[#103063] rounded-lg"
          >
            Sign In as Administrator
          </button>
        </div>
      </div>
    );
  }

  async function handleRunSource(sourceId: number) {
    setRunningSourceId(sourceId);
    setBannerMsg(null);
    try {
      const res = await apiFetch<{
        result: { status: string; jobsFound: number; jobsAdded: number; duplicatesFound: number; error?: string };
      }>(`/api/admin/sources/${sourceId}/collect`, {
        method: 'POST',
        body: JSON.stringify({ auto_approve: true }),
      });
      const r = res.result;
      setBannerMsg(
        r.status === 'success'
          ? `Collection completed: ${r.jobsFound} found, ${r.jobsAdded} added, ${r.duplicatesFound} duplicates skipped.`
          : `Collection failed: ${r.error}`
      );
      await loadAdminData();
    } finally {
      setRunningSourceId(null);
    }
  }

  async function handleRunAllSources() {
    setRunningSourceId('all');
    setBannerMsg(null);
    try {
      const res = await apiFetch<{ results: Array<{ source_name: string; jobsAdded: number; duplicatesFound: number }> }>(
        '/api/admin/sources/collect-all',
        { method: 'POST', body: JSON.stringify({ auto_approve: true }) }
      );
      const totalAdded = res.results.reduce((acc, r) => acc + r.jobsAdded, 0);
      setBannerMsg(`Ran ${res.results.length} active Ethiopian sources. Total new vacancies added: ${totalAdded}.`);
      await loadAdminData();
    } finally {
      setRunningSourceId(null);
    }
  }

  async function handleToggleSourceStatus(src: JobSource) {
    const nextStatus = src.status === 'paused' ? 'active' : 'paused';
    await apiFetch(`/api/admin/sources/${src.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus }),
    });
    await loadAdminData();
  }

  async function handleUpdateSourceFrequency(src: JobSource, frequency: string) {
    await apiFetch(`/api/admin/sources/${src.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ collection_frequency: frequency }),
    });
    await loadAdminData();
  }

  async function handleAddSource(e: FormEvent) {
    e.preventDefault();
    await apiFetch('/api/admin/sources', {
      method: 'POST',
      body: JSON.stringify({
        source_name: newSourceName,
        website_url: newWebsiteUrl,
        feed_url: newFeedUrl,
        collection_method: newMethod,
        collection_frequency: newFrequency,
      }),
    });
    setNewSourceName('');
    setNewWebsiteUrl('');
    setNewFeedUrl('');
    setShowAddSource(false);
    setBannerMsg('New Ethiopian job source registered.');
    await loadAdminData();
  }

  async function handleUpdateJob(jobId: number, patch: Record<string, unknown>) {
    await apiFetch(`/api/admin/jobs/${jobId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    await loadAdminData();
  }

  async function handleDeduplicate() {
    const res = await apiFetch<{ removed: number }>('/api/admin/jobs/dedupe', { method: 'POST' });
    setBannerMsg(`Deduplication sweep completed: ${res.removed} duplicate listings removed.`);
    await loadAdminData();
  }

  async function handleVerifyLinks() {
    setRunningSourceId('all');
    try {
      const res = await apiFetch<{ checked: number; expiredCount: number }>('/api/admin/jobs/verify-links', {
        method: 'POST',
      });
      setBannerMsg(
        `Verified ${res.checked} active external job links. ${res.expiredCount} unavailable link(s) marked expired.`
      );
      await loadAdminData();
    } finally {
      setRunningSourceId(null);
    }
  }

  async function handlePaymentDecision(item: PaymentQueueItem, decision: 'approved' | 'rejected') {
    await apiFetch(`/api/admin/payments/${item.payment_type}/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        decision,
        reason: decision === 'rejected' ? 'Receipt reference did not match bank/Telebirr ledger.' : undefined,
      }),
    });
    await loadAdminData();
  }

  async function handleEmployerStatus(id: number, status: 'approved' | 'suspended') {
    await apiFetch(`/api/admin/employers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    await loadAdminData();
  }

  function exportLogsCsv() {
    const headers = ['ID', 'Source', 'Method', 'Started', 'Found', 'Added', 'Duplicates', 'Status', 'Errors'];
    const rows = logs.map((l) => [
      l.id,
      `"${l.source_name}"`,
      l.collection_method,
      l.collection_started_at,
      l.jobs_found,
      l.jobs_added,
      l.duplicates_found,
      l.collection_status,
      `"${(l.errors || '').replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tatari-collection-logs.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header & Global Run Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Job Aggregation &amp; Platform Governance
          </h1>
          <p className="text-sm text-slate-600">
            Manage Ethiopian vacancy feeds, review collected jobs, monitor errors, and verify payment receipts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <a
            href="/api/download/tatari-upgraded.zip"
            download="tatari-upgraded.zip"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap"
          >
            Download Project ZIP
          </a>
          <button
            type="button"
            disabled={runningSourceId !== null}
            onClick={handleRunAllSources}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#164081] hover:bg-[#103063] disabled:opacity-60 rounded-lg whitespace-nowrap"
          >
            <RefreshCw className={`w-4 h-4 ${runningSourceId === 'all' ? 'animate-spin' : ''}`} />
            {runningSourceId === 'all' ? 'Collecting All...' : 'Run All Active Sources'}
          </button>
        </div>
      </div>

      {bannerMsg && (
        <div className="p-3.5 bg-slate-900 text-white text-sm rounded-xl flex items-center justify-between gap-4">
          <span>{bannerMsg}</span>
          <button type="button" onClick={() => setBannerMsg(null)} className="text-xs underline shrink-0">
            Close
          </button>
        </div>
      )}

      {/* 8 Requested Dashboard KPIs */}
      {stats && (
        <section aria-label="Aggregation Statistics" className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { label: 'Total Jobs', value: stats.totalJobs },
            { label: 'External Jobs', value: stats.externalJobs },
            { label: 'Tatari Jobs', value: stats.tatariJobs },
            { label: 'Active Jobs', value: stats.activeJobs },
            { label: 'Expired Jobs', value: stats.expiredJobs },
            { label: 'Active Sources', value: stats.activeSources },
            { label: 'Collected Today', value: stats.jobsCollectedToday },
            { label: 'Failed Runs', value: stats.failedAttempts, alert: stats.failedAttempts > 0 },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white border border-slate-200 rounded-xl p-3.5">
              <span className="block text-[11px] font-medium text-slate-500">{kpi.label}</span>
              <span
                className={`mt-1 block text-xl font-bold font-mono tabular-nums ${
                  kpi.alert ? 'text-red-700' : 'text-slate-900'
                }`}
              >
                {kpi.value}
              </span>
            </div>
          ))}
        </section>
      )}

      {/* Section Segmented Navigation */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit">
        {[
          { id: 'sources', label: 'Job Sources & Scheduler' },
          { id: 'jobs', label: `Collected Jobs (${jobs.length})` },
          { id: 'logs', label: 'Collection Logs & Errors' },
          {
            id: 'payments',
            label: `Payments & Employers (${
              (stats?.pendingOrders || 0) + (stats?.pendingEmployers || 0)
            })`,
          },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSection(tab.id as AdminSection)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              section === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SECTION 1: JOB SOURCES */}
      {section === 'sources' && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <h2 className="text-base font-bold text-slate-900 inline-flex items-center gap-2">
              <Database className="w-4 h-4 text-[#164081]" />
              Ethiopian Job Sources ({sources.length})
            </h2>
            <button
              type="button"
              onClick={() => setShowAddSource((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#164081] hover:bg-[#103063] rounded-lg"
            >
              <Plus className="w-3.5 h-3.5" />
              Add External Source
            </button>
          </div>

          {showAddSource && (
            <form onSubmit={handleAddSource} className="p-6 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-6 gap-3">
              <input
                type="text"
                required
                value={newSourceName}
                onChange={(e) => setNewSourceName(e.target.value)}
                placeholder="Source Name (e.g. EthioCareer)"
                className="sm:col-span-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
              <input
                type="url"
                required
                value={newWebsiteUrl}
                onChange={(e) => setNewWebsiteUrl(e.target.value)}
                placeholder="https://example.et"
                className="sm:col-span-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
              <input
                type="text"
                required
                value={newFeedUrl}
                onChange={(e) => setNewFeedUrl(e.target.value)}
                placeholder="RSS / JSON API / Feed URL"
                className="sm:col-span-2 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
              <select
                value={newMethod}
                onChange={(e) => setNewMethod(e.target.value as typeof newMethod)}
                className="px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              >
                <option value="rss">RSS / Atom</option>
                <option value="json_api">JSON API</option>
                <option value="html_directory">HTML Directory</option>
                <option value="partner_feed">Partner Feed</option>
              </select>
              <div className="flex gap-2">
                <select
                  value={newFrequency}
                  onChange={(e) => setNewFrequency(e.target.value as typeof newFrequency)}
                  className="px-2 py-2 text-xs bg-white border border-slate-300 rounded-lg flex-1"
                >
                  <option value="hourly">Hourly</option>
                  <option value="every_6h">Every 6h</option>
                  <option value="daily">Daily</option>
                  <option value="manual">Manual</option>
                </select>
                <button type="submit" className="px-3 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg">
                  Save
                </button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Schedule</th>
                  <th className="py-3 px-4 text-right">Collected</th>
                  <th className="py-3 px-4">Last Run</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sources.map((src) => (
                  <tr key={src.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900">{src.source_name}</p>
                      <p className="text-[11px] text-slate-500 font-mono truncate max-w-[260px]">{src.feed_url}</p>
                    </td>
                    <td className="py-3 px-4 font-mono uppercase text-slate-700">{src.collection_method}</td>
                    <td className="py-3 px-4">
                      <select
                        aria-label={`Schedule for ${src.source_name}`}
                        value={src.collection_frequency}
                        onChange={(e) => handleUpdateSourceFrequency(src, e.target.value)}
                        className="px-2 py-1 text-xs bg-white border border-slate-300 rounded"
                      >
                        <option value="hourly">Hourly</option>
                        <option value="every_6h">Every 6h</option>
                        <option value="daily">Daily</option>
                        <option value="manual">Manual</option>
                      </select>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {src.active_jobs_count} / {src.total_jobs_collected}
                    </td>
                    <td className="py-3 px-4 text-slate-600 tabular-nums">
                      {src.last_collected_at ? new Date(src.last_collected_at).toLocaleString() : 'Never'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-semibold capitalize ${
                          src.status === 'active'
                            ? 'text-emerald-700'
                            : src.status === 'error'
                              ? 'text-red-700'
                              : 'text-slate-500'
                        }`}
                      >
                        {src.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        disabled={runningSourceId !== null}
                        onClick={() => handleRunSource(src.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-[#164081] hover:bg-[#103063] rounded"
                      >
                        <Play className="w-3 h-3" />
                        {runningSourceId === src.id ? 'Running...' : 'Collect Now'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleSourceStatus(src)}
                        className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded"
                      >
                        {src.status === 'paused' ? 'Enable' : 'Pause'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* SECTION 2: COLLECTED JOBS REVIEW & CATEGORIZATION */}
      {section === 'jobs' && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-slate-900">Collected &amp; Direct Jobs Review</h2>
              <select
                aria-label="Filter jobs by review status"
                value={jobStatusFilter}
                onChange={(e) => setJobStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
              >
                <option value="">All Statuses</option>
                <option value="pending_review">Pending Review</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={runningSourceId !== null}
                onClick={handleVerifyLinks}
                className="px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg disabled:opacity-60"
              >
                Verify External Links
              </button>
              <button
                type="button"
                onClick={handleDeduplicate}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Remove Duplicate Listings
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Vacancy &amp; Company</th>
                  <th className="py-3 px-4">Origin / Source</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Deadline</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900">{job.title}</p>
                      <p className="text-slate-500">
                        {job.company_name} · {job.location}
                      </p>
                      {job.job_origin === 'external' && job.original_job_url && (
                        <a
                          href={job.original_job_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-teal-700 hover:underline break-all"
                        >
                          {job.original_job_url}
                        </a>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={job.job_origin === 'external' ? 'text-teal-700 font-semibold' : 'text-[#164081] font-semibold'}>
                        {job.job_origin === 'external' ? job.source_name : 'Tatari Direct'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <select
                        aria-label={`Category for ${job.title}`}
                        value={job.category_id}
                        onChange={(e) => handleUpdateJob(job.id, { category_id: Number(e.target.value) })}
                        className="px-2 py-1 text-xs bg-white border border-slate-300 rounded max-w-[180px]"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4 tabular-nums text-slate-600">
                      {job.application_deadline ? new Date(job.application_deadline).toLocaleDateString() : 'Open'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-semibold capitalize ${
                          job.status === 'active'
                            ? 'text-emerald-700'
                            : job.status === 'pending_review'
                              ? 'text-amber-700'
                              : 'text-red-700'
                        }`}
                      >
                        {job.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      {job.status !== 'active' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateJob(job.id, { status: 'active' })}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Approve
                        </button>
                      )}
                      {job.status !== 'rejected' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateJob(job.id, { status: 'rejected' })}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/admin/jobs/${job.id}`, { method: 'DELETE' });
                          await loadAdminData();
                        }}
                        aria-label={`Delete ${job.title}`}
                        className="p-1 text-slate-400 hover:text-red-600 inline-flex"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* SECTION 3: COLLECTION LOGS & ERRORS */}
      {section === 'logs' && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Collection History &amp; Errors</h2>
            <button
              type="button"
              onClick={exportLogsCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Started</th>
                  <th className="py-3 px-4 text-right">Found</th>
                  <th className="py-3 px-4 text-right">Added</th>
                  <th className="py-3 px-4 text-right">Updated</th>
                  <th className="py-3 px-4 text-right">Dupes</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Error Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {log.source_name} <span className="text-slate-400 font-normal">({log.collection_method})</span>
                    </td>
                    <td className="py-3 px-4 tabular-nums text-slate-600">
                      {new Date(log.collection_started_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{log.jobs_found}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                      +{log.jobs_added}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{log.jobs_updated}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500">
                      {log.duplicates_found}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-semibold capitalize ${
                          log.collection_status === 'success'
                            ? 'text-emerald-700'
                            : log.collection_status === 'failed'
                              ? 'text-red-700'
                              : 'text-amber-700'
                        }`}
                      >
                        {log.collection_status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-red-700 max-w-xs truncate">{log.errors || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* SECTION 4: PAYMENTS & EMPLOYERS */}
      {section === 'payments' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900">
              Payment Receipt Verification Queue ({payments.length})
            </h2>
            {payments.length === 0 ? (
              <p className="text-xs text-slate-500">No payment receipts awaiting verification.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <li key={`${p.payment_type}-${p.id}`} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{p.item_title}</p>
                      <p className="text-xs text-slate-500 font-mono">
                        {p.payment_type === 'store_order' ? 'Digital Store' : 'Job Posting Fee'} · {p.buyer_name} ·{' '}
                        {p.payment_method} · Ref: {p.payment_ref}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {p.status === 'pending' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handlePaymentDecision(p, 'approved')}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePaymentDecision(p, 'rejected')}
                            className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded"
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <span
                          className={`text-xs font-semibold capitalize ${
                            p.status === 'approved' || p.status === 'verified' ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {p.status}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900">Employer TIN Verification ({employers.length})</h2>
            <ul className="divide-y divide-slate-100">
              {employers.map((emp) => (
                <li key={emp.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{emp.company_name}</p>
                    <p className="text-xs text-slate-500 font-mono">
                      {emp.email} · {emp.business_tin}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {emp.status === 'pending' ? (
                      <button
                        type="button"
                        onClick={() => handleEmployerStatus(emp.id, 'approved')}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-[#164081] hover:bg-[#103063] rounded"
                      >
                        Verify TIN
                      </button>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-700 capitalize">{emp.status}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {loading && <div className="sr-only">Refreshing administrator data</div>}
    </div>
  );
}
