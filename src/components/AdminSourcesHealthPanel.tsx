import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Globe,
  Plus,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { OPPORTUNITY_MODULES_META } from '../lib/opportunityAggregator';
import type {
  AggregatedOpportunity,
  AggregatorOverviewResponse,
  BankFxRateRecord,
  OpportunityModuleType,
} from '../types/domain';

interface AdminSourcesHealthPanelProps {
  overview: AggregatorOverviewResponse | null;
  fxRates: BankFxRateRecord[];
  opportunities: AggregatedOpportunity[];
  isSyncing: boolean;
  onTriggerSync: (scope: 'all' | 'jobs' | 'fx' | 'opportunities' | 'single', sourceId?: string) => Promise<void>;
  onAddCustomSource: (payload: {
    name: string;
    url: string;
    feedUrl: string;
    module: OpportunityModuleType;
    method: 'wp_rest_json' | 'rss_xml';
  }) => Promise<string | null>;
  onToggleSourceActive: (sourceId: string, nextActive: boolean) => Promise<void>;
  onReviewFxRate: (rateId: string, buyingRate: number | null, sellingRate: number | null) => Promise<void>;
  onVerifyOpportunity: (
    oppId: string,
    updates: { title: string; organization: string; deadline: string }
  ) => Promise<void>;
}

export const AdminSourcesHealthPanel: React.FC<AdminSourcesHealthPanelProps> = ({
  overview,
  fxRates,
  opportunities,
  isSyncing,
  onTriggerSync,
  onAddCustomSource,
  onToggleSourceActive,
  onReviewFxRate,
  onVerifyOpportunity,
}) => {
  const [srcName, setSrcName] = useState('');
  const [srcUrl, setSrcUrl] = useState('');
  const [srcFeedUrl, setSrcFeedUrl] = useState('');
  const [srcModule, setSrcModule] = useState<OpportunityModuleType>('public_announcements');
  const [srcMethod, setSrcMethod] = useState<'rss_xml' | 'wp_rest_json'>('rss_xml');
  const [srcError, setSrcError] = useState<string | null>(null);
  const [srcSubmitting, setSrcSubmitting] = useState(false);

  const [editingOppId, setEditingOppId] = useState<string | null>(null);
  const [editOppTitle, setEditOppTitle] = useState('');
  const [editOppOrg, setEditOppOrg] = useState('');
  const [editOppDeadline, setEditOppDeadline] = useState('');

  const flaggedFxRates = fxRates.filter((r) => r.anomalyFlagged);
  const opportunitySources = overview?.opportunitySources || [];
  const bankStatuses = overview?.fxBankStatuses || [];
  const runs = overview?.collectionRuns || [];
  const errors = overview?.collectionErrors || [];

  const handleAddSourceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSrcError(null);
    setSrcSubmitting(true);
    try {
      const err = await onAddCustomSource({
        name: srcName,
        url: srcUrl,
        feedUrl: srcFeedUrl || srcUrl,
        module: srcModule,
        method: srcMethod,
      });
      if (err) {
        setSrcError(err);
      } else {
        setSrcName('');
        setSrcUrl('');
        setSrcFeedUrl('');
      }
    } finally {
      setSrcSubmitting(false);
    }
  };

  const exportErrorsCsv = () => {
    const rows = [
      ['Timestamp', 'Source ID', 'Source Name', 'Module', 'Error Reason'],
      ...errors.map((err) => [err.timestamp, err.sourceId, err.sourceName, err.module, err.reason]),
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tatari-collection-errors-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="mt-6 space-y-6" data-testid="admin-sources-health">
      {/* Top KPIs & Manual Sync Triggers */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#164081]">
              <Globe className="h-4 w-4" />
              <span>Centralized Aggregation Engine &amp; Source Coverage</span>
            </div>
            <p className="mt-0.5 text-xs text-slate-600">
              Monitor live verified feeds, inspect unreachable or JS-blocked banks transparently,
              and register authorized RSS or WordPress REST endpoints.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isSyncing}
              onClick={() => void onTriggerSync('all')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102E61] disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Running Full Sync...' : 'Sync All Feeds Now'}</span>
            </button>
            <button
              type="button"
              disabled={isSyncing}
              onClick={() => void onTriggerSync('fx')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Sync Bank FX
            </button>
            <button
              type="button"
              disabled={isSyncing}
              onClick={() => void onTriggerSync('opportunities')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Sync Opportunities
            </button>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 tabular-nums">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <dt className="text-[11px] font-medium text-slate-500">Total Live Records</dt>
            <dd className="mt-0.5 font-mono text-lg font-bold text-slate-900">
              {overview?.totalCollectedListings ?? 0}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <dt className="text-[11px] font-medium text-slate-500">Duplicates Prevented</dt>
            <dd className="mt-0.5 font-mono text-lg font-bold text-slate-900">
              {overview?.duplicatesDetected ?? 0}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <dt className="text-[11px] font-medium text-slate-500">Expired Items Flagged</dt>
            <dd className="mt-0.5 font-mono text-lg font-bold text-amber-700">
              {overview?.expiredCount ?? 0}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <dt className="text-[11px] font-medium text-slate-500">FX Anomalies (&gt;15%)</dt>
            <dd className="mt-0.5 font-mono text-lg font-bold text-rose-700">
              {flaggedFxRates.length}
            </dd>
          </div>
        </dl>
      </div>

      {/* Flagged FX Anomalies Review (If any) */}
      {flaggedFxRates.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
            <ShieldAlert className="h-4 w-4" />
            <span>FX Rate Anomaly Review Queue ({flaggedFxRates.length} Flagged)</span>
          </div>
          <p className="mt-1 text-xs text-amber-800">
            Rates below jumped more than 15% compared to the prior snapshot. Verify against the
            bank’s official website before approving or adjusting.
          </p>
          <div className="mt-3 space-y-2">
            {flaggedFxRates.map((rate) => (
              <div
                key={rate.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white p-3 text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900">
                    {rate.bankName} · {rate.currencyCode} ({rate.rateCategory})
                  </div>
                  <div className="text-slate-600">{rate.anomalyReason}</div>
                  <div className="font-mono text-[11px] text-slate-500">
                    Extracted Buy: {rate.originalExtractedBuying ?? rate.buyingRate} · Sell:{' '}
                    {rate.originalExtractedSelling ?? rate.sellingRate} ETB
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={rate.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-[#164081] hover:bg-slate-50"
                  >
                    Verify Page
                  </a>
                  <button
                    type="button"
                    onClick={() => void onReviewFxRate(rate.id, rate.buyingRate, rate.sellingRate)}
                    className="rounded-lg bg-[#0F766E] px-3 py-1.5 font-semibold text-white hover:bg-[#0D625C]"
                  >
                    Approve Quote
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Opportunity Sources Coverage Matrix */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-display text-base font-bold text-slate-900">
            Opportunity Feed Registry ({opportunitySources.length} Sources)
          </h2>
          <p className="text-xs text-slate-500">
            Every external tender, scholarship, grant, trade, and news source with status and
            attribution rules.
          </p>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
            <tr>
              <th className="px-5 py-3">Source &amp; Domain</th>
              <th className="px-4 py-3">Module</th>
              <th className="px-4 py-3">Method &amp; Cadence</th>
              <th className="px-4 py-3 text-right">Items</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-5 py-3 text-right">Controls</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {opportunitySources.map((src) => (
              <tr key={src.id} className="hover:bg-slate-50/70">
                <td className="px-5 py-3">
                  <div className="font-semibold text-slate-900">{src.name}</div>
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-[11px] text-[#164081] hover:underline"
                  >
                    <span>{src.domain}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  {src.lastError && (
                    <div className="mt-0.5 text-[11px] text-rose-700">{src.lastError}</div>
                  )}
                </td>
                <td className="px-4 py-3 font-medium text-slate-700">{src.module}</td>
                <td className="px-4 py-3 text-slate-600">
                  {src.method} · {src.frequencyLabel}
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                  {src.fetchedCount}
                </td>
                <td className="px-4 py-3">
                  {src.status === 'Verified' ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Verified
                    </span>
                  ) : src.status === 'Collection failed' ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-rose-700">
                      <XCircle className="h-3.5 w-3.5" />
                      Failed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                      <Clock className="h-3.5 w-3.5" />
                      {src.status}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void onToggleSourceActive(src.id, !src.active)}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {src.active ? 'Pause' : 'Enable'}
                    </button>
                    <button
                      type="button"
                      disabled={isSyncing || !src.active}
                      onClick={() => void onTriggerSync('single', src.id)}
                      className="rounded-lg bg-[#164081] px-2.5 py-1 font-semibold text-white hover:bg-[#102E61] disabled:opacity-50"
                    >
                      Run
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Verified Custom Source Form (SSRF-protected on server) */}
      <form
        onSubmit={handleAddSourceSubmit}
        className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
      >
        <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
          <Plus className="h-4 w-4 text-[#164081]" />
          <span>Register Authorized External Feed (RSS / Atom / WordPress REST)</span>
        </div>

        {srcError && (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800"
          >
            {srcError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block text-xs font-semibold text-slate-700">
            Source Name *
            <input
              type="text"
              required
              value={srcName}
              onChange={(e) => setSrcName(e.target.value)}
              placeholder="e.g. Ethiopian Investment Comm."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Website URL *
            <input
              type="url"
              required
              value={srcUrl}
              onChange={(e) => setSrcUrl(e.target.value)}
              placeholder="https://example.gov.et"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            RSS / WP-JSON Feed URL
            <input
              type="url"
              value={srcFeedUrl}
              onChange={(e) => setSrcFeedUrl(e.target.value)}
              placeholder="https://example.gov.et/feed"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Target Module
            <select
              value={srcModule}
              onChange={(e) => setSrcModule(e.target.value as OpportunityModuleType)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
            >
              {OPPORTUNITY_MODULES_META.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Feed Format
            <select
              value={srcMethod}
              onChange={(e) => setSrcMethod(e.target.value as 'rss_xml' | 'wp_rest_json')}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
            >
              <option value="rss_xml">RSS / Atom XML</option>
              <option value="wp_rest_json">WordPress REST JSON</option>
            </select>
          </label>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={srcSubmitting}
            className="rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102E61] disabled:opacity-60"
          >
            {srcSubmitting ? 'Validating & Fetching Feed...' : 'Validate & Add Source'}
          </button>
        </div>
      </form>

      {/* Manual Listing Verification & Correction (Preserving Original Extracted Fields) */}
      {opportunities.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-3.5">
            <h2 className="font-display text-sm font-bold text-slate-900">
              Recent Aggregated Listings — Manual Verification &amp; Audit Correction
            </h2>
            <p className="text-xs text-slate-500">
              Edits preserve the original extracted title, organization, and deadline for
              accountability.
            </p>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
              <tr>
                <th className="px-5 py-2.5">Title &amp; Source</th>
                <th className="px-4 py-2.5">Module</th>
                <th className="px-4 py-2.5">Deadline</th>
                <th className="px-5 py-2.5 text-right">Verify</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {opportunities.slice(0, 8).map((opp) => (
                <tr key={opp.id}>
                  <td className="px-5 py-2.5">
                    {editingOppId === opp.id ? (
                      <div className="space-y-1.5">
                        <input
                          type="text"
                          value={editOppTitle}
                          onChange={(e) => setEditOppTitle(e.target.value)}
                          aria-label="Edited listing title"
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                        <input
                          type="text"
                          value={editOppOrg}
                          onChange={(e) => setEditOppOrg(e.target.value)}
                          aria-label="Edited listing organization"
                          className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="font-semibold text-slate-900">{opp.title}</div>
                        <div className="text-[11px] text-slate-500">
                          {opp.organization} · {opp.sourceName}
                          {opp.manuallyVerified ? ' · Manually Verified' : ''}
                        </div>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-2.5">{opp.module}</td>
                  <td className="px-4 py-2.5 font-mono">
                    {editingOppId === opp.id ? (
                      <input
                        type="text"
                        value={editOppDeadline}
                        onChange={(e) => setEditOppDeadline(e.target.value)}
                        aria-label="Edited deadline"
                        className="w-36 rounded border border-slate-300 px-2 py-1 text-xs"
                      />
                    ) : (
                      opp.deadline
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    {editingOppId === opp.id ? (
                      <div className="inline-flex gap-1.5">
                        <button
                          type="button"
                          onClick={async () => {
                            await onVerifyOpportunity(opp.id, {
                              title: editOppTitle,
                              organization: editOppOrg,
                              deadline: editOppDeadline,
                            });
                            setEditingOppId(null);
                          }}
                          className="rounded bg-[#0F766E] px-2.5 py-1 font-semibold text-white"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingOppId(null)}
                          className="rounded border border-slate-300 px-2 py-1 text-slate-600"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingOppId(opp.id);
                          setEditOppTitle(opp.title);
                          setEditOppOrg(opp.organization);
                          setEditOppDeadline(opp.deadline);
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-semibold text-[#164081] hover:bg-slate-50"
                      >
                        Edit / Verify
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bank FX Status Summary & Collection Run History + Error Log */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-3.5">
            <h3 className="font-display text-sm font-bold text-slate-900">
              Collection Run Log ({runs.length})
            </h3>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-2.5">Scope</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Items</th>
                <th className="px-4 py-2.5 text-right">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {runs.slice(0, 10).map((run) => (
                <tr key={run.id}>
                  <td className="px-4 py-2.5 font-semibold text-slate-800">{run.scope}</td>
                  <td className="px-4 py-2.5">{run.status}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    {run.itemsCollected}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    {run.durationMs}ms
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
            <h3 className="font-display text-sm font-bold text-slate-900">
              Recent Collection Errors ({errors.length})
            </h3>
            <button
              type="button"
              onClick={exportErrorsCsv}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-3 w-3" />
              Export Errors CSV
            </button>
          </div>
          {errors.length === 0 ? (
            <p className="p-5 text-xs text-slate-500">
              No feed connection errors logged in recent sync runs. Note that banks configured as
              Source unavailable ({bankStatuses.filter((b) => b.status === 'Source unavailable').length}
              ) are reported directly in the Bank FX matrix.
            </p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-2.5">Source</th>
                  <th className="px-4 py-2.5">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {errors.slice(0, 8).map((err) => (
                  <tr key={err.id}>
                    <td className="px-4 py-2.5 font-semibold text-slate-800">
                      {err.sourceName}
                      <div className="font-mono text-[10px] text-slate-400">
                        {new Date(err.timestamp).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-rose-700">{err.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
};
