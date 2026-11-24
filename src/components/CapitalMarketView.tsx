import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Info,
  Landmark,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { formatRelativeDays } from '../lib/storeLogic';
import type {
  CapitalMarketApiResponse,
  CapitalMarketEquityRecord,
} from '../types/domain';

interface CapitalMarketViewProps {
  data: CapitalMarketApiResponse | null;
  isSyncing: boolean;
  errorMessage?: string | null;
  onRefresh: () => void;
}

type CapitalMarketSubTab = 'equities' | 'interbank' | 'tbills' | 'announcements';

export const CapitalMarketView: React.FC<CapitalMarketViewProps> = ({
  data,
  isSyncing,
  errorMessage = null,
  onRefresh,
}) => {
  const [subTab, setSubTab] = useState<CapitalMarketSubTab>('equities');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('WGBX');
  const [showSourcesDrawer, setShowSourcesDrawer] = useState(false);

  const equities = data?.equities || [];
  const interbankTrades = data?.interbankTrades || [];
  const tBills = data?.tBills || [];
  const announcements = data?.announcements || [];
  const sources = data?.sources || [];
  const summary = data?.summary;

  const filteredEquities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return equities;
    return equities.filter((e) =>
      `${e.symbol} ${e.companyName} ${e.sector}`.toLowerCase().includes(q)
    );
  }, [equities, searchQuery]);

  const activeEquity: CapitalMarketEquityRecord | null =
    filteredEquities.find((e) => e.symbol === selectedSymbol) ||
    filteredEquities[0] ||
    equities[0] ||
    null;

  const formatEtb = (val: number | null, digits: number = 2) => {
    if (val === null || !Number.isFinite(val)) return 'Pending print';
    return val.toLocaleString('en-US', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  };

  const formatCompactEtb = (val: number | null) => {
    if (val === null || !Number.isFinite(val)) return '—';
    if (val >= 1_000_000_000) return `ETB ${(val / 1_000_000_000).toFixed(2)}B`;
    if (val >= 1_000_000) return `ETB ${(val / 1_000_000).toFixed(1)}M`;
    return `ETB ${val.toLocaleString('en-US')}`;
  };

  const renderEquityPriceChart = (eq: CapitalMarketEquityRecord) => {
    const pts = eq.priceHistory;
    if (!pts || pts.length < 2) {
      return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
          <div className="font-semibold text-slate-800">
            Daily share price history awaiting public print for {eq.symbol}
          </div>
          <p className="mt-1">
            {eq.companyName} is officially registered on the ESX Main Market (listed{' '}
            {eq.dateListed || 'recently'}), with {eq.listedShares?.toLocaleString('en-US') ?? 'N/A'}{' '}
            listed shares. Check the official ESX directory link for corporate filings.
          </p>
        </div>
      );
    }

    const prices = pts.map((p) => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const span = max - min || 1;
    const width = 540;
    const height = 160;
    const padX = 16;
    const padY = 16;

    const coords = pts.map((p, idx) => {
      const x = padX + (idx / Math.max(1, pts.length - 1)) * (width - padX * 2);
      const y = height - padY - ((p.price - min) / span) * (height - padY * 2);
      return { x, y, ...p };
    });

    const polylinePoints = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
    const isUp = (eq.changePct ?? 0) >= 0;
    const stroke = isUp ? '#0F766E' : '#BE123C';

    return (
      <div>
        <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
          <span>
            {pts.length} Trading Sessions ({pts[0].date} to {pts[pts.length - 1].date})
          </span>
          <span className="font-mono tabular-nums">
            Range: {formatEtb(min)} – {formatEtb(max)} ETB
          </span>
        </div>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-44 w-full rounded-lg border border-slate-200 bg-slate-50"
          role="img"
          aria-label={`${eq.symbol} share price trend chart`}
        >
          <polyline
            fill="none"
            stroke={stroke}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={polylinePoints}
          />
          {coords.length > 0 && (
            <circle
              cx={coords[coords.length - 1].x}
              cy={coords[coords.length - 1].y}
              r="4"
              fill={stroke}
            />
          )}
        </svg>
      </div>
    );
  };

  return (
    <div className="bg-[#F7F8FA]" data-testid="capital-market-view">
      {/* Header & Market Session Status */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#164081]">
                <Landmark className="h-4 w-4" />
                <span>Ethiopian Securities Exchange (ESX) · ECMA Market Monitor</span>
              </div>
              <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                Ethiopian Capital Market &amp; Daily Share Sales Activity
              </h1>
              <p className="mt-1.5 text-sm text-slate-600">
                Track ESX Main Market listed share companies, daily traded prices, session changes,
                listed share capital, interbank money market trades, and listed treasury bills from
                verified exchange feeds.
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
                <span>{isSyncing ? 'Syncing ESX Feeds...' : 'Sync Market Data'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowSourcesDrawer((p) => !p)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <Info className="h-3.5 w-3.5" />
                <span>
                  Sources ({sources.filter((s) => s.status === 'Verified').length}/{sources.length || 4} Live)
                </span>
              </button>
            </div>
          </div>

          {/* Session & Feed Attribution Ribbon */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs">
            <div className="flex items-center gap-2 font-semibold text-slate-800">
              <span
                className={`h-2 w-2 rounded-full ${
                  summary?.marketSessionState.includes('Open')
                    ? 'bg-emerald-600'
                    : 'bg-slate-500'
                }`}
              />
              <span>{summary?.marketSessionState || 'ESX Daily Hours: 9:00 AM – 3:00 PM EAT'}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-slate-500 tabular-nums">
              {summary?.latestSessionDate && (
                <span>Latest Quote Date: {summary.latestSessionDate}</span>
              )}
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {data?.syncedAt ? `Synced ${formatRelativeDays(data.syncedAt)}` : 'Syncing...'}
              </span>
            </div>
          </div>

          {showSourcesDrawer && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-xs">
                <span className="font-semibold text-slate-900">
                  Official Ethiopian Capital Market Source Registry
                </span>
                <button
                  type="button"
                  onClick={() => setShowSourcesDrawer(false)}
                  className="font-semibold text-[#164081] hover:underline"
                >
                  Close
                </button>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {sources.map((src) => (
                  <div
                    key={src.id}
                    className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900">{src.role}</span>
                        <span
                          className={`font-semibold ${
                            src.status === 'Verified'
                              ? 'text-emerald-700'
                              : src.status === 'Collection failed'
                              ? 'text-rose-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {src.status}
                        </span>
                      </div>
                      <div className="mt-1 font-medium text-slate-700">{src.name}</div>
                      {src.errorMessage && (
                        <div className="mt-1 text-[11px] text-slate-500">{src.errorMessage}</div>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500 tabular-nums">
                      <span>{src.recordsCollected} records</span>
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

          {/* 4 Institutional KPI Summary Cards */}
          <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 tabular-nums">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <dt className="text-xs font-medium text-slate-500">ESX Listed Equities</dt>
              <dd className="mt-1 font-mono text-2xl font-extrabold text-slate-900">
                {summary?.listedCompaniesCount ?? equities.length}
              </dd>
              <div className="mt-1 text-[11px] text-slate-500">
                {summary?.pricedEquitiesCount ?? 0} with live traded quotes
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <dt className="text-xs font-medium text-slate-500">Total Listed Shares</dt>
              <dd className="mt-1 font-mono text-2xl font-extrabold text-slate-900">
                {summary?.totalListedShares
                  ? summary.totalListedShares.toLocaleString('en-US')
                  : '—'}
              </dd>
              <div className="mt-1 text-[11px] text-slate-500">
                Implied Equity Cap: {formatCompactEtb(summary?.totalImpliedMarketCapEtb ?? null)}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <dt className="text-xs font-medium text-slate-500">Session Movers</dt>
              <dd className="mt-1 font-mono text-2xl font-extrabold text-[#0F766E]">
                {summary?.topGainerSymbol
                  ? `${summary.topGainerSymbol} ${
                      (summary.topGainerPct ?? 0) >= 0 ? '+' : ''
                    }${summary.topGainerPct?.toFixed(2)}%`
                  : '—'}
              </dd>
              <div className="mt-1 text-[11px] text-slate-500">
                {summary?.advancersCount ?? 0} Up · {summary?.declinersCount ?? 0} Down ·{' '}
                {summary?.unchangedCount ?? 0} Flat
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <dt className="text-xs font-medium text-slate-500">ESX Interbank Turnover</dt>
              <dd className="mt-1 font-mono text-2xl font-extrabold text-[#164081]">
                {formatCompactEtb(summary?.latestInterbankVolumeEtb ?? null)}
              </dd>
              <div className="mt-1 text-[11px] text-slate-500">
                {summary?.latestInterbankTradesCount
                  ? `${summary.latestInterbankTradesCount} trades (${summary.latestInterbankWeek})`
                  : 'Fixed income weekly activity'}
              </div>
            </div>
          </dl>

          {/* Navigation Sub-Tabs + Search */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Capital Market Sections">
              {(
                [
                  { id: 'equities', label: `Daily Share Activity (${equities.length})` },
                  { id: 'interbank', label: `Interbank Market (${interbankTrades.length})` },
                  { id: 'tbills', label: `Treasury Bills (${tBills.length})` },
                  { id: 'announcements', label: `ESX Announcements (${announcements.length})` },
                ] as { id: CapitalMarketSubTab; label: string }[]
              ).map((t) => {
                const active = subTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSubTab(t.id)}
                    className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-[#10243B] text-white'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {subTab === 'equities' && (
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by ticker (WGBX, TELE) or bank..."
                  aria-label="Filter ESX listed equities"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#164081] focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {errorMessage && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-950"
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

        {subTab === 'equities' && (
          <>
            {/* Equities Daily Sales & Quote Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="font-display text-base font-bold text-slate-900">
                    ESX Main Market Listed Share Securities
                  </h2>
                  <p className="text-xs text-slate-500">
                    Click any row to view multi-session price chart, listed share capital, and
                    shareholder count.
                  </p>
                </div>
                <span className="text-[11px] text-slate-500">
                  Currency: Ethiopian Birr (ETB)
                </span>
              </div>

              {isSyncing && filteredEquities.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-600">
                  Loading live Ethiopian Securities Exchange (ESX) listed equity quotes...
                </div>
              ) : filteredEquities.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-600">
                  No listed ESX equities match "{searchQuery}".
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                    <tr>
                      <th className="px-5 py-3">Symbol &amp; Company</th>
                      <th className="px-4 py-3">Sector</th>
                      <th className="px-4 py-3 text-right">Last Price (ETB)</th>
                      <th className="px-4 py-3 text-right">Prev Close</th>
                      <th className="px-4 py-3 text-right">Change</th>
                      <th className="px-4 py-3 text-right">Session Range</th>
                      <th className="px-4 py-3 text-right">Listed Shares</th>
                      <th className="px-4 py-3 text-right">Implied Market Cap</th>
                      <th className="px-5 py-3">Official Profile</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 tabular-nums">
                    {filteredEquities.map((eq) => {
                      const selected = activeEquity?.symbol === eq.symbol;
                      const isPositive = (eq.changePct ?? 0) > 0;
                      const isNegative = (eq.changePct ?? 0) < 0;
                      return (
                        <tr
                          key={eq.symbol}
                          onClick={() => setSelectedSymbol(eq.symbol)}
                          className={`cursor-pointer transition-colors ${
                            selected ? 'bg-[#F0F5FF]' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <span className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#10243B]">
                                {eq.symbol}
                              </span>
                              <span className="font-semibold text-slate-900">{eq.companyName}</span>
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-500">
                              Listed {eq.dateListed || 'N/A'} ·{' '}
                              {eq.sessionDate ? `Session ${eq.sessionDate}` : 'Awaiting first trade'}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-slate-700">{eq.sector}</td>
                          <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900">
                            {eq.lastPriceEtb !== null ? formatEtb(eq.lastPriceEtb) : 'Pending print'}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-slate-600">
                            {eq.previousCloseEtb !== null ? formatEtb(eq.previousCloseEtb) : '—'}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono font-semibold">
                            {eq.changePct !== null ? (
                              <span
                                className={`inline-flex items-center gap-1 ${
                                  isPositive
                                    ? 'text-[#0F766E]'
                                    : isNegative
                                    ? 'text-rose-700'
                                    : 'text-slate-600'
                                }`}
                              >
                                {isPositive && <TrendingUp className="h-3 w-3" />}
                                {isNegative && <TrendingDown className="h-3 w-3" />}
                                <span>
                                  {eq.changePct > 0 ? '+' : ''}
                                  {eq.changePct.toFixed(2)}%
                                </span>
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-slate-600">
                            {eq.periodLowEtb !== null && eq.periodHighEtb !== null
                              ? `${formatEtb(eq.periodLowEtb)} – ${formatEtb(eq.periodHighEtb)}`
                              : '—'}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-slate-700">
                            {eq.listedShares !== null
                              ? eq.listedShares.toLocaleString('en-US')
                              : '—'}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono font-semibold text-slate-800">
                            {formatCompactEtb(eq.marketCapImpliedEtb)}
                          </td>
                          <td className="px-5 py-3.5">
                            <a
                              href={eq.esxProfileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 font-semibold text-[#164081] hover:underline"
                            >
                              <span>ESX</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Selected Security Inspector & Historical Trend Chart */}
            {activeEquity && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-[#164081]">
                        <Building2 className="h-4 w-4" />
                        <span>
                          {activeEquity.symbol} · {activeEquity.securityType}
                        </span>
                      </div>
                      <h3 className="mt-1 font-display text-lg font-extrabold text-slate-900">
                        {activeEquity.companyName}
                      </h3>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <div className="text-xl font-extrabold text-slate-900">
                        {activeEquity.lastPriceEtb !== null
                          ? `ETB ${formatEtb(activeEquity.lastPriceEtb)}`
                          : 'Quote Pending'}
                      </div>
                      {activeEquity.changeEtb !== null && activeEquity.changePct !== null && (
                        <div
                          className={`text-xs font-semibold ${
                            activeEquity.changePct >= 0 ? 'text-[#0F766E]' : 'text-rose-700'
                          }`}
                        >
                          {activeEquity.changeEtb >= 0 ? '+' : ''}
                          {activeEquity.changeEtb.toFixed(2)} ETB ({activeEquity.changePct >= 0 ? '+' : ''}
                          {activeEquity.changePct.toFixed(2)}%)
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4">{renderEquityPriceChart(activeEquity)}</div>

                  <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[11px] text-slate-600">
                    <strong>Volume Transparency:</strong> {activeEquity.dailyVolumeNote}. Verified
                    capital &amp; share counts sourced from{' '}
                    <a
                      href={activeEquity.esxProfileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-[#164081] hover:underline"
                    >
                      ESX Issuer Directory
                    </a>
                    .
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5">
                  <h3 className="font-display text-sm font-bold text-slate-900">
                    Issuer Fundamentals &amp; Share Structure
                  </h3>
                  <dl className="mt-4 divide-y divide-slate-100 text-xs tabular-nums">
                    <div className="flex justify-between py-2.5">
                      <dt className="text-slate-500">Trading Symbol</dt>
                      <dd className="font-mono font-bold text-slate-900">{activeEquity.symbol}</dd>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <dt className="text-slate-500">Listed Capital</dt>
                      <dd className="font-mono font-semibold text-slate-900">
                        {activeEquity.listedCapitalEtb !== null
                          ? `ETB ${activeEquity.listedCapitalEtb.toLocaleString('en-US')}`
                          : 'Not listed'}
                      </dd>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <dt className="text-slate-500">Listed Shares</dt>
                      <dd className="font-mono font-semibold text-slate-900">
                        {activeEquity.listedShares !== null
                          ? activeEquity.listedShares.toLocaleString('en-US')
                          : 'Not listed'}
                      </dd>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <dt className="text-slate-500">Shareholders</dt>
                      <dd className="font-mono font-semibold text-slate-900">
                        {activeEquity.numberOfShareholders !== null
                          ? activeEquity.numberOfShareholders.toLocaleString('en-US')
                          : 'Not disclosed'}
                      </dd>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <dt className="text-slate-500">Date Listed on ESX</dt>
                      <dd className="font-mono text-slate-800">
                        {activeEquity.dateListed || 'N/A'}
                      </dd>
                    </div>
                    <div className="flex justify-between py-2.5">
                      <dt className="text-slate-500">Verification</dt>
                      <dd className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {activeEquity.verificationStatus}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-5 flex flex-col gap-2">
                    <a
                      href={activeEquity.esxProfileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#164081] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#102E61]"
                    >
                      <span>View Official Profile on ESX.et</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    {activeEquity.lastPriceEtb !== null && (
                      <a
                        href={activeEquity.marketDataUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <span>Open Price Sheet on StockMarket.et</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {subTab === 'interbank' && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  ESX Fixed Income — Interbank Money Market Sales &amp; Volume
                </h2>
                <p className="text-xs text-slate-500">
                  Weekly interbank overnight and 7-day transaction volume, trade counts, and
                  weighted average interest rates published by ESX.
                </p>
              </div>
              <a
                href="https://esx.et/fixed-income-market/data/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#164081] hover:underline"
              >
                <span>Source: esx.et</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <table className="w-full text-left text-xs tabular-nums">
              <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3">Trading Week</th>
                  <th className="px-4 py-3">Maturity</th>
                  <th className="px-4 py-3 text-right">Volume Traded</th>
                  <th className="px-4 py-3 text-right">Total Trades</th>
                  <th className="px-4 py-3 text-right">WA Interest Rate</th>
                  <th className="px-5 py-3 text-right">Rate Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...interbankTrades].reverse().map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-900">{row.weekLabel}</td>
                    <td className="px-4 py-3 text-slate-700">{row.maturity}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                      {row.volumeLabel}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-800">
                      {row.totalTrades ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-[#164081]">
                      {row.weightedAvgRatePct !== null
                        ? `${row.weightedAvgRatePct.toFixed(2)}%`
                        : '—'}
                    </td>
                    <td className="px-5 py-3 text-right font-mono">
                      {row.rateChangePct !== null
                        ? `${row.rateChangePct > 0 ? '+' : ''}${row.rateChangePct.toFixed(2)}%`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {subTab === 'tbills' && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  ESX Listed Treasury Bills Instruments
                </h2>
                <p className="text-xs text-slate-500">
                  Official NBE / ESX T-Bill auctions admitted for secondary trading.
                </p>
              </div>
              <a
                href="https://esx.et/fixed-income-market/listed-instruments/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#164081] hover:underline"
              >
                <span>Source: esx.et</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <table className="w-full text-left text-xs tabular-nums">
              <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3">Symbol</th>
                  <th className="px-4 py-3">Auction No</th>
                  <th className="px-4 py-3">Auction Date</th>
                  <th className="px-4 py-3 text-right">Tenor (Days)</th>
                  <th className="px-4 py-3">Maturity Date</th>
                  <th className="px-4 py-3 text-right">Accepted (ETB M)</th>
                  <th className="px-5 py-3 text-right">WA Yield (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...tBills].reverse().slice(0, 40).map((tb) => (
                  <tr key={tb.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-mono font-bold text-[#10243B]">
                      {tb.tradingSymbol}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{tb.auctionNo}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{tb.auctionDate}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">
                      {tb.tenorDays}d
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">{tb.maturityDate}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">
                      {tb.amountAcceptedEtbMillions !== null
                        ? tb.amountAcceptedEtbMillions.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 3,
                          })
                        : '—'}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-[#0F766E]">
                      {tb.weightedAvgYieldPct !== null
                        ? `${tb.weightedAvgYieldPct.toFixed(3)}%`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {subTab === 'announcements' && (
          <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="px-5 py-4">
              <h2 className="font-display text-base font-bold text-slate-900">
                Official ESX Listings &amp; Ethiopian Capital Market Briefs
              </h2>
            </div>
            {announcements.map((ann) => (
              <div key={ann.id} className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
                <div className="max-w-3xl">
                  <div className="text-[11px] font-semibold text-[#164081]">
                    {ann.sourceName} · {ann.category} ·{' '}
                    {ann.publishedAt ? ann.publishedAt.slice(0, 10) : 'Recent'}
                  </div>
                  <h3 className="mt-1 font-display text-sm font-bold text-slate-900">
                    {ann.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{ann.summary}</p>
                </div>
                <a
                  href={ann.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#164081] hover:bg-slate-50"
                >
                  <span>Read Notice</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
