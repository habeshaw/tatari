import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bookmark,
  CheckCircle2,
  Clock,
  ExternalLink,
  Globe,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import {
  OPPORTUNITY_MODULES_META,
  runUniversalSearch,
  type UniversalSearchResult,
} from '../lib/opportunityAggregator';
import { formatRelativeDays } from '../lib/storeLogic';
import type {
  AggregatedOpportunity,
  AggregationSourceRecord,
  AppView,
  BankFxRateRecord,
  CapitalMarketEquityRecord,
  DigitalProduct,
  JobListing,
  NewsArticleRecord,
  OpportunityModuleType,
  TrainingProgram,
} from '../types/domain';

interface OpportunitiesHubViewProps {
  opportunities: AggregatedOpportunity[];
  sources: AggregationSourceRecord[];
  jobs: JobListing[];
  fxRates: BankFxRateRecord[];
  trainingPrograms: TrainingProgram[];
  products: DigitalProduct[];
  newsArticles?: NewsArticleRecord[];
  capitalEquities?: CapitalMarketEquityRecord[];
  savedOpportunityIds: string[];
  syncedAt: string | null;
  isSyncing: boolean;
  isAdmin?: boolean;
  errorMessage?: string | null;
  onRefresh: () => void;
  onToggleSaveOpportunity: (oppId: string) => void;
  onNavigateView: (view: AppView) => void;
  onOpenAdminSources: () => void;
}

export const OpportunitiesHubView: React.FC<OpportunitiesHubViewProps> = ({
  opportunities,
  sources,
  jobs,
  fxRates,
  trainingPrograms,
  products,
  newsArticles = [],
  capitalEquities = [],
  savedOpportunityIds,
  syncedAt,
  isSyncing,
  isAdmin = false,
  errorMessage = null,
  onRefresh,
  onToggleSaveOpportunity,
  onNavigateView,
  onOpenAdminSources,
}) => {
  const [selectedModule, setSelectedModule] = useState<'all' | OpportunityModuleType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [universalSearchActive, setUniversalSearchActive] = useState(false);
  const [selectedOppId, setSelectedOppId] = useState<string | null>(null);
  const [hideExpired, setHideExpired] = useState(true);
  const [showPublicSources, setShowPublicSources] = useState(false);

  const moduleCounts = useMemo(() => {
    const map: Record<string, number> = { all: opportunities.length };
    for (const o of opportunities) {
      map[o.module] = (map[o.module] || 0) + 1;
    }
    return map;
  }, [opportunities]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return opportunities.filter((item) => {
      if (selectedModule !== 'all' && item.module !== selectedModule) return false;
      if (hideExpired && item.isExpired) return false;
      if (!q) return true;
      return `${item.title} ${item.organization} ${item.category} ${item.location} ${item.summary} ${item.sourceName}`
        .toLowerCase()
        .includes(q);
    });
  }, [opportunities, selectedModule, hideExpired, searchQuery]);

  const universalResults: UniversalSearchResult[] = useMemo(() => {
    if (!universalSearchActive || searchQuery.trim().length < 2) return [];
    return runUniversalSearch({
      query: searchQuery,
      jobs,
      fxRates,
      opportunities,
      trainingPrograms,
      products,
      newsArticles,
      capitalEquities,
    });
  }, [
    universalSearchActive,
    searchQuery,
    jobs,
    fxRates,
    opportunities,
    trainingPrograms,
    products,
    newsArticles,
    capitalEquities,
  ]);

  const selectedOpp =
    filteredItems.find((i) => i.id === selectedOppId) || filteredItems[0] || null;

  const activeModuleMeta = OPPORTUNITY_MODULES_META.find((m) => m.id === selectedModule);

  const handleUniversalJump = (res: UniversalSearchResult) => {
    if (res.section === 'news') onNavigateView('news');
    else if (res.section === 'capital_market') onNavigateView('capital_market');
    else if (res.section === 'jobs') onNavigateView('jobs');
    else if (res.section === 'fx') onNavigateView('fx');
    else if (res.section === 'training') onNavigateView('training');
    else if (res.section === 'store') onNavigateView('store');
    else {
      setUniversalSearchActive(false);
      setSelectedOppId(res.id);
    }
  };

  return (
    <div className="bg-[#F7F8FA]">
      {/* Hero & Universal Search */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#164081]">
                <Globe className="h-4 w-4" />
                <span>Verified Ethiopian Opportunities &amp; Information Index</span>
              </div>
              <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                Tenders, Scholarships, Grants &amp; Market Announcements
              </h1>
              <p className="mt-1.5 text-sm text-slate-600">
                Aggregated strictly from verified live public sources with publication dates,
                collection timestamps, and direct links to original publishers.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={onRefresh}
                disabled={isSyncing}
                className="inline-flex items-center gap-2 rounded-lg bg-[#164081] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#102E61] disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Collecting Sources...' : 'Sync Verified Sources'}</span>
              </button>
              <button
                type="button"
                onClick={isAdmin ? onOpenAdminSources : () => setShowPublicSources((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>
                  {isAdmin
                    ? `Manage Sources (${sources.filter((s) => s.status === 'Verified').length} Live)`
                    : `Verified Sources (${sources.filter((s) => s.status === 'Verified').length} Live)`}
                </span>
              </button>
            </div>
          </div>

          {!isAdmin && showPublicSources && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2 text-xs">
                <span className="font-semibold text-slate-900">
                  Active Ethiopian Public Publishers &amp; Provenance Directory
                </span>
                <button
                  type="button"
                  onClick={() => setShowPublicSources(false)}
                  className="font-semibold text-[#164081] hover:underline"
                >
                  Close
                </button>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {sources.map((src) => (
                  <div
                    key={src.id}
                    className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-3 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">{src.name}</span>
                      <span
                        className={`font-semibold ${
                          src.status === 'Verified' ? 'text-emerald-700' : 'text-slate-500'
                        }`}
                      >
                        {src.status}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                      <span>{src.fetchedCount} live items</span>
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-[#164081] hover:underline"
                      >
                        <span>{src.domain}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search + Universal Platform Toggle */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value.trim().length >= 2) {
                    setUniversalSearchActive(true);
                  } else {
                    setUniversalSearchActive(false);
                  }
                }}
                placeholder="Universal search across Top News, ESX Capital Market, Jobs, Bank FX, Tenders & Store..."
                aria-label="Search Ethiopian opportunities and platform modules"
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
              />
            </div>

            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 whitespace-nowrap shrink-0">
              <input
                type="checkbox"
                checked={hideExpired}
                onChange={(e) => setHideExpired(e.target.checked)}
                className="rounded border-slate-300 text-[#164081]"
              />
              <span>Hide expired items</span>
            </label>
          </div>

          {/* Universal Search Instant Dropdown Results */}
          {universalSearchActive && searchQuery.trim().length >= 2 && (
            <div
              className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
              data-testid="universal-search-results"
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2 text-xs">
                <span className="font-semibold text-slate-900">
                  Cross-Platform Search Results for “{searchQuery.trim()}” (
                  {universalResults.length})
                </span>
                <button
                  type="button"
                  onClick={() => setUniversalSearchActive(false)}
                  className="font-semibold text-[#164081] hover:underline"
                >
                  Close global panel
                </button>
              </div>
              {universalResults.length === 0 ? (
                <p className="mt-2.5 text-xs text-slate-600">
                  No verified records matched “{searchQuery.trim()}” across Jobs, Bank FX,
                  Opportunities, Training, or Store.
                </p>
              ) : (
                <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {universalResults.slice(0, 9).map((res) => (
                    <button
                      key={`${res.section}-${res.id}`}
                      type="button"
                      onClick={() => handleUniversalJump(res)}
                      className="flex flex-col rounded-lg border border-slate-200 bg-white p-3 text-left transition-colors hover:border-[#164081]"
                    >
                      <span className="text-[11px] font-semibold text-[#164081]">
                        {res.badge} · {res.sourceLabel}
                      </span>
                      <span className="mt-0.5 line-clamp-1 font-display text-xs font-bold text-slate-900">
                        {res.title}
                      </span>
                      <span className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">
                        {res.subtitle}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Category Navigation Tabs */}
          <div
            role="tablist"
            aria-label="Opportunity categories"
            className="mt-5 flex flex-wrap gap-1.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedModule === 'all'}
              onClick={() => setSelectedModule('all')}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                selectedModule === 'all'
                  ? 'bg-[#164081] text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              All Verified ({moduleCounts.all || 0})
            </button>
            {OPPORTUNITY_MODULES_META.map((mod) => {
              const count = moduleCounts[mod.id] || 0;
              const active = selectedModule === mod.id;
              return (
                <button
                  key={mod.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedModule(mod.id)}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                    active
                      ? 'bg-[#164081] text-white'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {mod.label} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {errorMessage && (
          <div
            role="alert"
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-950"
          >
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={onRefresh}
              className="rounded-md bg-amber-900 px-3 py-1.5 font-semibold text-white hover:bg-amber-800"
            >
              Retry Live Sync
            </button>
          </div>
        )}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 tabular-nums">
          <span>
            Showing {filteredItems.length} verified records
            {activeModuleMeta ? ` in ${activeModuleMeta.label}` : ''}
          </span>
          <span>
            {syncedAt
              ? `Last verified ${new Date(syncedAt).toLocaleString()}`
              : 'Loading live verified feeds...'}
          </span>
        </div>

        {filteredItems.length === 0 ? (
          <div
            className="rounded-xl border border-slate-200 bg-white p-10 text-center"
            data-testid="opportunity-empty-state"
          >
            <Globe className="mx-auto h-9 w-9 text-slate-400" />
            <h2 className="mt-3 font-display text-lg font-bold text-slate-900">
              {activeModuleMeta ? `${activeModuleMeta.label}: No Live Listings` : 'No matching items'}
            </h2>
            <p className="mx-auto mt-1.5 max-w-2xl text-sm text-slate-600">
              {activeModuleMeta
                ? activeModuleMeta.emptyReason
                : 'Try adjusting your search keywords or refreshing verified Ethiopian sources.'}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onRefresh}
                className="rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102E61]"
              >
                Refresh Live Feeds
              </button>
              <button
                type="button"
                onClick={isAdmin ? onOpenAdminSources : () => setShowPublicSources(true)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {isAdmin ? 'Manage Sources (Admin)' : 'View Verified Public Sources'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
            {/* List Column */}
            <div className="space-y-3 lg:col-span-6" data-testid="opportunities-list">
              {filteredItems.map((item) => {
                const isSelected = selectedOpp?.id === item.id;
                const saved = savedOpportunityIds.includes(item.id);
                return (
                  <article
                    key={item.id}
                    className={`rounded-xl border bg-white p-5 transition-colors ${
                      isSelected
                        ? 'border-[#164081] bg-[#F5F8FD] shadow-xs'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedOppId(item.id)}
                        className="text-left focus-visible:outline-2 focus-visible:outline-[#164081]"
                      >
                        <div className="text-[11px] font-semibold text-[#164081]">
                          {item.module.replace('_', ' ')} · {item.sourceName} ·{' '}
                          {item.verificationStatus}
                        </div>
                        <h3 className="mt-0.5 font-display text-base font-bold text-slate-900 hover:text-[#164081]">
                          {item.title}
                        </h3>
                      </button>

                      <button
                        type="button"
                        aria-label={saved ? `Unsave ${item.title}` : `Save ${item.title}`}
                        onClick={() => onToggleSaveOpportunity(item.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-[#164081]"
                      >
                        <Bookmark
                          className={`h-4 w-4 ${saved ? 'fill-[#164081] text-[#164081]' : ''}`}
                        />
                      </button>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600 tabular-nums">
                      <span className="font-medium text-slate-800">{item.organization}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.location}</span>
                      <span aria-hidden="true">·</span>
                      <span>Deadline: {item.deadline}</span>
                    </div>

                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600">
                      {item.summary}
                    </p>

                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-2.5 text-xs text-slate-500 tabular-nums">
                      <span>
                        Published:{' '}
                        {item.publishedAt
                          ? formatRelativeDays(item.publishedAt)
                          : 'Not provided by source.'}{' '}
                        · Checked{' '}
                        {new Date(item.lastVerifiedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-[#164081] hover:underline whitespace-nowrap shrink-0"
                      >
                        <span>Original source</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Sticky Provenance & Detail Pane */}
            <aside className="lg:sticky lg:top-22 lg:col-span-6">
              {selectedOpp && (
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
                  <div className="border-b border-slate-200 pb-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-[#164081]">
                        {selectedOpp.sourceName} ({selectedOpp.sourceDomain})
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 font-semibold ${
                          selectedOpp.verificationStatus === 'Verified'
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {selectedOpp.verificationStatus === 'Verified' ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <Clock className="h-3.5 w-3.5" />
                        )}
                        {selectedOpp.verificationStatus}
                      </span>
                    </div>

                    <h2 className="mt-1.5 font-display text-xl font-bold text-slate-900">
                      {selectedOpp.title}
                    </h2>

                    <div className="mt-4 flex flex-wrap items-center gap-2.5">
                      <a
                        href={selectedOpp.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg bg-[#164081] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#102E61] whitespace-nowrap shrink-0"
                      >
                        <span>Open Official Source Page</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => onToggleSaveOpportunity(selectedOpp.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Bookmark
                          className={`h-3.5 w-3.5 ${
                            savedOpportunityIds.includes(selectedOpp.id)
                              ? 'fill-[#164081] text-[#164081]'
                              : ''
                          }`}
                        />
                        <span>
                          {savedOpportunityIds.includes(selectedOpp.id) ? 'Saved' : 'Save Item'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <dl className="mt-4 grid grid-cols-1 gap-3 border-b border-slate-100 pb-4 text-xs sm:grid-cols-2 tabular-nums">
                    <div>
                      <dt className="text-slate-500">Issuing Body / Publisher</dt>
                      <dd className="font-semibold text-slate-900">{selectedOpp.organization}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Reference Number</dt>
                      <dd className="font-mono font-semibold text-slate-900">
                        {selectedOpp.referenceNumber}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Location / Coverage</dt>
                      <dd className="font-semibold text-slate-900">{selectedOpp.location}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Eligibility / Notes</dt>
                      <dd className="font-semibold text-slate-900">
                        {selectedOpp.eligibilityOrCoverage}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Funding / Amount</dt>
                      <dd className="font-semibold text-slate-900">{selectedOpp.priceOrFunding}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Application / Bid Deadline</dt>
                      <dd className="font-semibold text-slate-900">{selectedOpp.deadline}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Published Date</dt>
                      <dd className="font-mono text-slate-800">
                        {selectedOpp.publishedAt
                          ? new Date(selectedOpp.publishedAt).toLocaleDateString()
                          : 'Not provided by source.'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Collected &amp; Last Verified</dt>
                      <dd className="font-mono text-slate-800">
                        {new Date(selectedOpp.lastVerifiedAt).toLocaleString()}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 text-sm leading-relaxed text-slate-700">
                    <h3 className="font-display text-xs font-bold uppercase tracking-wider text-slate-500">
                      Source Summary
                    </h3>
                    <p className="mt-1.5">{selectedOpp.summary}</p>
                    <p className="mt-3 break-all font-mono text-[11px] text-slate-500">
                      Canonical URL: {selectedOpp.sourceUrl}
                    </p>
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}
      </main>
    </div>
  );
};
