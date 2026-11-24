import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Globe,
  Newspaper,
  RefreshCw,
  Search,
} from 'lucide-react';
import { NEWS_COVERAGE_FILTERS } from '../lib/newsAggregator';
import { formatRelativeDays } from '../lib/storeLogic';
import type {
  NewsArticleRecord,
  NewsCoverageScope,
  NewsPublisherId,
  NewsSourceStatus,
} from '../types/domain';

interface TopNewsViewProps {
  articles: NewsArticleRecord[];
  sources: NewsSourceStatus[];
  syncedAt: string | null;
  isSyncing: boolean;
  errorMessage?: string | null;
  onRefresh: () => void;
}

export const TopNewsView: React.FC<TopNewsViewProps> = ({
  articles,
  sources,
  syncedAt,
  isSyncing,
  errorMessage = null,
  onRefresh,
}) => {
  const [selectedCoverage, setSelectedCoverage] = useState<'all' | NewsCoverageScope>('all');
  const [selectedPublisher, setSelectedPublisher] = useState<'all' | NewsPublisherId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  const coverageCounts = useMemo(() => {
    const map: Record<string, number> = { all: articles.length };
    for (const art of articles) {
      map[art.coverage] = (map[art.coverage] || 0) + 1;
    }
    return map;
  }, [articles]);

  const filteredArticles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return articles.filter((a) => {
      if (selectedCoverage !== 'all' && a.coverage !== selectedCoverage) return false;
      if (selectedPublisher !== 'all' && a.publisherId !== selectedPublisher) return false;
      if (!q) return true;
      return `${a.title} ${a.summary} ${a.publisherName} ${a.coverage} ${a.category}`
        .toLowerCase()
        .includes(q);
    });
  }, [articles, selectedCoverage, selectedPublisher, searchQuery]);

  const activeArticle =
    filteredArticles.find((a) => a.id === selectedArticleId) || filteredArticles[0] || null;
  const leadArticle = filteredArticles[0] || null;
  const feedArticles = filteredArticles.slice(1);

  const liveSourcesCount = sources.filter((s) => s.status === 'Verified').length;

  const formatPublishTime = (iso: string | null) => {
    if (!iso) return 'Recent';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Recent';
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-[#F7F8FA]" data-testid="top-news-view">
      {/* Masthead & 10-Outlet Coverage Matrix */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#164081]">
                <Newspaper className="h-4 w-4" />
                <span>World, Africa &amp; Ethiopia Live Wire</span>
              </div>
              <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                Top News Across Leading Global &amp; Ethiopian Publishers
              </h1>
              <p className="mt-1.5 text-sm text-slate-600">
                Real-time headlines collected from Reuters, BBC News, Al Jazeera, CNN, AP News,
                Africanews, AllAfrica, Addis Standard, The Reporter, and BBC Amharic with full
                publisher attribution.
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
                <span>{isSyncing ? 'Refreshing Feeds...' : 'Refresh Headlines'}</span>
              </button>
            </div>
          </div>

          {/* 10-Publisher Directory Strip */}
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-slate-700">
                Publisher Desk ({liveSourcesCount}/{sources.length || 10} Live Outlets)
              </span>
              {selectedPublisher !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedPublisher('all')}
                  className="font-semibold text-[#164081] hover:underline"
                >
                  Clear publisher filter
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {sources.map((src) => {
                const isSelected = selectedPublisher === src.id;
                const isOk = src.status === 'Verified';
                return (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() =>
                      setSelectedPublisher((prev) => (prev === src.id ? 'all' : src.id))
                    }
                    className={`flex flex-col justify-between rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      isSelected
                        ? 'border-[#164081] bg-[#F0F5FF]'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="truncate text-xs font-bold text-slate-900">{src.name}</span>
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          isOk
                            ? 'bg-emerald-600'
                            : src.status === 'Collection failed'
                            ? 'bg-rose-600'
                            : 'bg-amber-500'
                        }`}
                        title={src.status}
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                      <span className="truncate">{src.coverage}</span>
                      <span className="font-mono font-semibold text-slate-700">
                        {src.articlesCollected}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search + Coverage Tabs */}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search headlines across World, Africa, Ethiopia, or Amharic..."
                aria-label="Search Top News headlines"
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#164081] focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="News coverage regions">
              {NEWS_COVERAGE_FILTERS.map((f) => {
                const active = selectedCoverage === f.id;
                const count = coverageCounts[f.id] || 0;
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedCoverage(f.id)}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-[#10243B] text-white'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {f.label} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Main Editorial Grid */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {errorMessage && (
          <div
            role="alert"
            className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-950"
          >
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={onRefresh}
              className="rounded-lg bg-amber-900 px-3 py-1.5 font-semibold text-white hover:bg-amber-800"
            >
              Retry Sync
            </button>
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            Showing <strong className="text-slate-900">{filteredArticles.length}</strong> live
            headlines
            {selectedPublisher !== 'all'
              ? ` from ${sources.find((s) => s.id === selectedPublisher)?.name}`
              : ''}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span>
              {syncedAt ? `Synced ${formatRelativeDays(syncedAt)}` : 'Syncing live wire...'}
            </span>
          </span>
        </div>

        {isSyncing && filteredArticles.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
            Collecting live headlines from Reuters, BBC News, Al Jazeera, CNN, AP News,
            Africanews, AllAfrica, Addis Standard, The Reporter, and BBC Amharic...
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
            <Globe className="mx-auto h-8 w-8 text-slate-400" />
            <h2 className="mt-3 font-display text-base font-bold text-slate-900">
              No headlines match your current filters
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Try clearing your search keyword or switching to All Coverage.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCoverage('all');
                setSelectedPublisher('all');
                setSearchQuery('');
              }}
              className="mt-4 rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white"
            >
              Show All Headlines
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Editorial Feed Column */}
            <div className="space-y-4 lg:col-span-7">
              {leadArticle && (
                <article
                  onClick={() => setSelectedArticleId(leadArticle.id)}
                  className={`cursor-pointer rounded-xl border bg-white p-5 transition-colors ${
                    activeArticle?.id === leadArticle.id
                      ? 'border-[#164081] ring-1 ring-[#164081]/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#164081]">
                    Lead Story · {leadArticle.publisherName} · {leadArticle.coverage}
                  </div>
                  <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start">
                    <div className="flex-1">
                      <h2 className="font-display text-xl font-extrabold leading-snug text-slate-900">
                        {leadArticle.title}
                      </h2>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">
                        {leadArticle.summary}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span>{formatPublishTime(leadArticle.publishedAt)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{leadArticle.publisherDomain}</span>
                        <a
                          href={leadArticle.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 font-semibold text-[#164081] hover:underline"
                        >
                          <span>Read original</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                    {leadArticle.imageUrl && (
                      <img
                        src={leadArticle.imageUrl}
                        alt=""
                        loading="lazy"
                        className="h-28 w-full shrink-0 rounded-lg border border-slate-200 object-cover sm:w-40"
                      />
                    )}
                  </div>
                </article>
              )}

              <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {feedArticles.map((art) => {
                  const selected = activeArticle?.id === art.id;
                  return (
                    <article
                      key={art.id}
                      onClick={() => setSelectedArticleId(art.id)}
                      className={`cursor-pointer px-5 py-4 transition-colors ${
                        selected ? 'bg-[#F0F5FF]/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                            <span className="text-[#164081]">{art.publisherName}</span>
                            <span aria-hidden="true">·</span>
                            <span>{art.coverage}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono">{formatPublishTime(art.publishedAt)}</span>
                          </div>
                          <h3 className="mt-1 font-display text-sm font-bold leading-snug text-slate-900">
                            {art.title}
                          </h3>
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">
                            {art.summary}
                          </p>
                        </div>
                        {art.imageUrl && (
                          <img
                            src={art.imageUrl}
                            alt=""
                            loading="lazy"
                            className="h-16 w-24 shrink-0 rounded-md border border-slate-200 object-cover"
                          />
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            {/* Sticky Article Reader & Provenance Desk */}
            <aside className="lg:col-span-5">
              {activeArticle && (
                <div className="sticky top-20 space-y-4 rounded-xl border border-slate-200 bg-white p-6">
                  <div className="border-b border-slate-100 pb-4">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-[#164081]">
                        {activeArticle.publisherName} · {activeArticle.coverage}
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {activeArticle.verificationStatus}
                      </span>
                    </div>
                    <h2 className="mt-2 font-display text-xl font-extrabold leading-snug text-slate-900">
                      {activeArticle.title}
                    </h2>
                    <div className="mt-2 text-xs text-slate-500">
                      Published {formatPublishTime(activeArticle.publishedAt)} · Source:{' '}
                      <span className="font-mono text-slate-700">
                        {activeArticle.publisherDomain}
                      </span>
                    </div>
                  </div>

                  {activeArticle.imageUrl && (
                    <img
                      src={activeArticle.imageUrl}
                      alt=""
                      className="max-h-56 w-full rounded-lg border border-slate-200 object-cover"
                    />
                  )}

                  <p className="text-sm leading-relaxed text-slate-700">{activeArticle.summary}</p>

                  <dl className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-xs">
                    <div>
                      <dt className="text-slate-500">Coverage Region</dt>
                      <dd className="mt-0.5 font-semibold text-slate-900">
                        {activeArticle.coverage}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Language</dt>
                      <dd className="mt-0.5 font-semibold text-slate-900">
                        {activeArticle.language === 'am' ? 'Amharic (አማርኛ)' : 'English'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Category</dt>
                      <dd className="mt-0.5 font-semibold text-slate-900">
                        {activeArticle.category}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Collection Feed</dt>
                      <dd className="mt-0.5 font-mono text-[11px] text-slate-700">
                        {activeArticle.sourceMethod === 'wp_rest_json'
                          ? 'Official WP REST'
                          : activeArticle.sourceMethod === 'rss_xml'
                          ? 'Official Publisher RSS'
                          : 'Verified Publisher Index'}
                      </dd>
                    </div>
                  </dl>

                  <div className="border-t border-slate-100 pt-4">
                    <a
                      href={activeArticle.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#164081] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#102E61]"
                    >
                      <span>Open Full Story on {activeArticle.publisherName}</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
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
