import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Landmark,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import type {
  BankFxHistoryPoint,
  BankFxRateCategory,
  BankFxRateRecord,
  BankFxSourceStatus,
  NbeIndicativeMidRate,
} from '../types/domain';

interface BankFxDashboardViewProps {
  rates: BankFxRateRecord[];
  history: BankFxHistoryPoint[];
  bankStatuses: BankFxSourceStatus[];
  nbeIndicativeMid: NbeIndicativeMidRate | null;
  syncedAt: string | null;
  isSyncing: boolean;
  onRefresh: () => void;
  onOpenAdminSources: () => void;
}

type SortKey = 'buying_desc' | 'selling_asc' | 'spread_asc' | 'bank_asc';

export const BankFxDashboardView: React.FC<BankFxDashboardViewProps> = ({
  rates,
  history,
  bankStatuses,
  nbeIndicativeMid,
  syncedAt,
  isSyncing,
  onRefresh,
  onOpenAdminSources,
}) => {
  const [selectedCurrency, setSelectedCurrency] = useState<string>('USD');
  const [rateCategory, setRateCategory] = useState<'cash' | 'transaction'>('cash');
  const [bankFilter, setBankFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('buying_desc');
  const [historyBankId, setHistoryBankId] = useState<string>('dashen');
  const [showAllBanksMatrix, setShowAllBanksMatrix] = useState(false);

  const nbeRates = useMemo(
    () => rates.filter((r) => r.isCentralBank || r.rateCategory === 'nbe_reference'),
    [rates]
  );

  const commercialRates = useMemo(
    () => rates.filter((r) => !r.isCentralBank && r.rateCategory !== 'nbe_reference'),
    [rates]
  );

  const availableCurrencies = useMemo(() => {
    const codes = new Set<string>();
    for (const r of commercialRates) {
      codes.add(r.currencyCode);
    }
    const preferredOrder = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'CAD', 'CHF', 'AUD', 'CNY', 'JPY'];
    return Array.from(codes).sort((a, b) => {
      const ia = preferredOrder.indexOf(a);
      const ib = preferredOrder.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [commercialRates]);

  const activeCurrency = availableCurrencies.includes(selectedCurrency)
    ? selectedCurrency
    : availableCurrencies[0] || 'USD';

  const filteredCommercialRows = useMemo(() => {
    const q = bankFilter.trim().toLowerCase();
    const rows = commercialRates.filter(
      (r) =>
        r.currencyCode === activeCurrency &&
        r.rateCategory === rateCategory &&
        (!q || `${r.bankName} ${r.bankShortName}`.toLowerCase().includes(q))
    );

    const sorted = [...rows];
    sorted.sort((a, b) => {
      if (sortBy === 'buying_desc') {
        return (b.buyingRate ?? -1) - (a.buyingRate ?? -1);
      }
      if (sortBy === 'selling_asc') {
        return (a.sellingRate ?? Number.MAX_SAFE_INTEGER) - (b.sellingRate ?? Number.MAX_SAFE_INTEGER);
      }
      if (sortBy === 'spread_asc') {
        return (a.spreadPct ?? Number.MAX_SAFE_INTEGER) - (b.spreadPct ?? Number.MAX_SAFE_INTEGER);
      }
      return a.bankName.localeCompare(b.bankName);
    });
    return sorted;
  }, [commercialRates, activeCurrency, rateCategory, bankFilter, sortBy]);

  const bestBuying = useMemo(() => {
    const valid = filteredCommercialRows.filter((r) => r.buyingRate !== null);
    if (valid.length === 0) return null;
    return valid.reduce((best, cur) =>
      (cur.buyingRate ?? 0) > (best.buyingRate ?? 0) ? cur : best
    );
  }, [filteredCommercialRows]);

  const lowestSelling = useMemo(() => {
    const valid = filteredCommercialRows.filter((r) => r.sellingRate !== null);
    if (valid.length === 0) return null;
    return valid.reduce((best, cur) =>
      (cur.sellingRate ?? Number.MAX_SAFE_INTEGER) < (best.sellingRate ?? Number.MAX_SAFE_INTEGER)
        ? cur
        : best
    );
  }, [filteredCommercialRows]);

  const banksWithRates = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of commercialRates) {
      map.set(r.bankId, r.bankName);
    }
    return Array.from(map.entries()).map(([bankId, bankName]) => ({ bankId, bankName }));
  }, [commercialRates]);

  const effectiveHistoryBankId = banksWithRates.some((b) => b.bankId === historyBankId)
    ? historyBankId
    : banksWithRates[0]?.bankId || 'dashen';

  const historySeries = useMemo(() => {
    return history
      .filter(
        (h) =>
          h.bankId === effectiveHistoryBankId &&
          h.currencyCode === activeCurrency &&
          h.rateCategory === (rateCategory as BankFxRateCategory)
      )
      .slice(-20);
  }, [history, effectiveHistoryBankId, activeCurrency, rateCategory]);

  const verifiedCommercialBanksCount = bankStatuses.filter(
    (b) => !b.isCentralBank && (b.status === 'Verified' || b.status === 'Stale')
  ).length;
  const unavailableBanksCount = bankStatuses.filter(
    (b) => b.status === 'Source unavailable' || b.status === 'Collection failed'
  ).length;

  const formatRate = (val: number | null, text?: string) => {
    if (val === null) return 'Not listed';
    if (text && /^\d+(?:\.\d+)?$/.test(text)) return Number(text).toFixed(4);
    return val.toFixed(4);
  };

  const renderSvgChart = () => {
    if (historySeries.length < 2) {
      return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-xs text-slate-600">
          <div className="font-semibold text-slate-800">
            {historySeries.length === 1
              ? '1 verified snapshot collected in this ledger so far.'
              : 'No historical snapshots recorded for this bank/currency/category yet.'}
          </div>
          <p className="mt-1">
            TATARI appends an immutable history snapshot only when a bank publishes a new date or
            changes its buying/selling quote. Run periodic syncs to build multi-day curves without
            fabricating intermediate values.
          </p>
          {historySeries.length === 1 && (
            <div className="mt-2 font-mono text-[11px] text-slate-700 tabular-nums">
              Latest snapshot: Buy {formatRate(historySeries[0].buyingRate)} / Sell{' '}
              {formatRate(historySeries[0].sellingRate)} ETB · Published{' '}
              {historySeries[0].publishedDate || 'Not provided by source.'} · Collected{' '}
              {new Date(historySeries[0].recordedAt).toLocaleString()}
            </div>
          )}
        </div>
      );
    }

    const w = 680;
    const h = 190;
    const padX = 48;
    const padY = 22;
    const values = historySeries
      .flatMap((p) => [p.buyingRate, p.sellingRate])
      .filter((v): v is number => v !== null && Number.isFinite(v));
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1;

    const toX = (idx: number) =>
      padX + (idx / Math.max(1, historySeries.length - 1)) * (w - padX * 2);
    const toY = (val: number) => padY + ((maxVal - val) / range) * (h - padY * 2);

    const buyPoints = historySeries
      .map((p, idx) => (p.buyingRate !== null ? `${toX(idx)},${toY(p.buyingRate)}` : null))
      .filter(Boolean)
      .join(' ');
    const sellPoints = historySeries
      .map((p, idx) => (p.sellingRate !== null ? `${toX(idx)},${toY(p.sellingRate)}` : null))
      .filter(Boolean)
      .join(' ');

    return (
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="h-48 w-full min-w-[480px]"
          role="img"
          aria-label={`Historical ${activeCurrency} ${rateCategory} exchange rate trend`}
        >
          <line x1={padX} y1={padY} x2={w - padX} y2={padY} stroke="#E2E8F0" strokeDasharray="3 3" />
          <line x1={padX} y1={h / 2} x2={w - padX} y2={h / 2} stroke="#E2E8F0" strokeDasharray="3 3" />
          <line x1={padX} y1={h - padY} x2={w - padX} y2={h - padY} stroke="#CBD5E1" />

          <text x={4} y={padY + 4} fontSize="10" fill="#64748B" fontFamily="monospace">
            {maxVal.toFixed(2)}
          </text>
          <text x={4} y={h - padY} fontSize="10" fill="#64748B" fontFamily="monospace">
            {minVal.toFixed(2)}
          </text>

          {buyPoints && (
            <polyline fill="none" stroke="#0F766E" strokeWidth="2.5" points={buyPoints} />
          )}
          {sellPoints && (
            <polyline fill="none" stroke="#164081" strokeWidth="2.5" points={sellPoints} />
          )}

          {historySeries.map((pt, idx) => (
            <g key={pt.id}>
              {pt.buyingRate !== null && (
                <circle cx={toX(idx)} cy={toY(pt.buyingRate)} r="3.5" fill="#0F766E" />
              )}
              {pt.sellingRate !== null && (
                <circle cx={toX(idx)} cy={toY(pt.sellingRate)} r="3.5" fill="#164081" />
              )}
            </g>
          ))}
        </svg>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 tabular-nums">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#0F766E]">
              <span className="h-0.5 w-4 bg-[#0F766E]" />
              Buying ETB
            </span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#164081]">
              <span className="h-0.5 w-4 bg-[#164081]" />
              Selling ETB
            </span>
          </div>
          <span>
            {historySeries.length} recorded snapshots · Strictly isolated to{' '}
            {rateCategory === 'cash' ? 'Cash' : 'Transaction / Transfer'} category
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[#F7F8FA]">
      {/* Page Header */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#164081]">
                <Landmark className="h-4 w-4" />
                <span>Ethiopian Interbank &amp; NBE Foreign Exchange Monitor</span>
              </div>
              <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                Official Ethiopian Bank Exchange Rates (ETB)
              </h1>
              <p className="mt-1.5 text-sm text-slate-600">
                Verified daily buying and selling quotes fetched directly from official Ethiopian
                bank feeds. Cash rates, Transaction/Transfer rates, and National Bank of Ethiopia
                reference rates are kept strictly separate.
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
                <span>{isSyncing ? 'Syncing Bank Feeds...' : 'Refresh Live Bank Rates'}</span>
              </button>
              <button
                type="button"
                onClick={onOpenAdminSources}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Coverage ({verifiedCommercialBanksCount} Live / {unavailableBanksCount} Unavailable)</span>
              </button>
            </div>
          </div>

          {/* NBE Official Central Bank Benchmark Strip (Always Separated) */}
          <div
            className="mt-6 rounded-xl border border-slate-300 bg-[#F8FAFC] p-5"
            data-testid="nbe-reference-strip"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h2 className="font-display text-sm font-bold text-[#10243B]">
                  National Bank of Ethiopia (NBE) — Official Central Bank Reference
                </h2>
                <p className="mt-0.5 text-xs text-slate-600">
                  Displayed strictly as central bank reference — never mixed or averaged with
                  commercial bank retail quotes.
                </p>
              </div>
              <a
                href="https://nbe.gov.et/exchange/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#164081] hover:underline whitespace-nowrap shrink-0"
              >
                <span>Source: nbe.gov.et</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-white p-3.5">
                <div className="text-xs font-medium text-slate-500">
                  USD Daily Indicative Mid Rate
                </div>
                <div className="mt-1 font-mono text-xl font-bold text-[#10243B] tabular-nums">
                  {nbeIndicativeMid ? `${nbeIndicativeMid.price.toFixed(4)} ETB` : 'Source unavailable'}
                </div>
                <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
                  {nbeIndicativeMid?.dateText
                    ? `Published: ${nbeIndicativeMid.dateText}`
                    : 'Not provided by source.'}
                </div>
              </div>

              {nbeRates.length === 0 ? (
                <div className="sm:col-span-1 lg:col-span-3 flex items-center rounded-lg border border-slate-200 bg-white p-3.5 text-xs text-slate-600">
                  NBE selected currency rates are currently unreachable or syncing. Click Refresh
                  Live Bank Rates to query api.nbe.gov.et directly.
                </div>
              ) : (
                nbeRates.slice(0, 3).map((r) => (
                  <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-3.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900">
                        {r.currencyCode} · {r.currencyName}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                        {r.publishedDate || 'No date'}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-baseline justify-between font-mono text-sm tabular-nums">
                      <span className="text-slate-600">
                        Buy <strong className="text-slate-900">{formatRate(r.buyingRate)}</strong>
                      </span>
                      <span className="text-slate-600">
                        Sell <strong className="text-slate-900">{formatRate(r.sellingRate)}</strong>
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
                      Mid: {formatRate(r.midRate)} ETB
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Commercial Filter Bar: Currency + Strict Cash vs Transaction Switch */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Strict Category Segmented Toggle */}
              <div
                role="tablist"
                aria-label="Exchange rate category"
                className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={rateCategory === 'cash'}
                  onClick={() => setRateCategory('cash')}
                  className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    rateCategory === 'cash'
                      ? 'bg-white text-[#164081] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Cash Rates (Notes)
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={rateCategory === 'transaction'}
                  onClick={() => setRateCategory('transaction')}
                  className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    rateCategory === 'transaction'
                      ? 'bg-white text-[#164081] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Transaction / Transfer Rates
                </button>
              </div>

              {/* Currency Selector */}
              <select
                aria-label="Select currency"
                value={activeCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 focus:border-[#164081] focus:outline-none"
              >
                {(availableCurrencies.length > 0 ? availableCurrencies : ['USD', 'EUR', 'GBP']).map(
                  (code) => (
                    <option key={code} value={code}>
                      Currency: {code}
                    </option>
                  )
                )}
              </select>

              {/* Sort */}
              <div className="inline-flex items-center gap-1.5">
                <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                <select
                  aria-label="Sort commercial bank rates"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortKey)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#164081] focus:outline-none"
                >
                  <option value="buying_desc">Sort: Highest Buying Rate</option>
                  <option value="selling_asc">Sort: Lowest Selling Rate</option>
                  <option value="spread_asc">Sort: Narrowest Spread %</option>
                  <option value="bank_asc">Sort: Bank Name (A–Z)</option>
                </select>
              </div>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="search"
                value={bankFilter}
                onChange={(e) => setBankFilter(e.target.value)}
                placeholder="Filter bank name..."
                aria-label="Filter commercial banks"
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-3 text-xs text-slate-900 focus:border-[#164081] focus:outline-none"
              />
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Best Buying & Lowest Selling Strip (strictly within active category) */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium text-slate-500">
              Highest {activeCurrency} Buying ({rateCategory === 'cash' ? 'Cash' : 'Transaction'})
            </div>
            <div className="mt-1 font-mono text-2xl font-bold text-[#0F766E] tabular-nums">
              {bestBuying ? `${formatRate(bestBuying.buyingRate)} ETB` : 'No verified rate'}
            </div>
            <div className="mt-1 text-xs text-slate-600">
              {bestBuying
                ? `${bestBuying.bankName} · Published ${bestBuying.publishedDate || 'Not provided'}`
                : 'Try another currency or sync bank feeds.'}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium text-slate-500">
              Lowest {activeCurrency} Selling ({rateCategory === 'cash' ? 'Cash' : 'Transaction'})
            </div>
            <div className="mt-1 font-mono text-2xl font-bold text-[#164081] tabular-nums">
              {lowestSelling ? `${formatRate(lowestSelling.sellingRate)} ETB` : 'No verified rate'}
            </div>
            <div className="mt-1 text-xs text-slate-600">
              {lowestSelling
                ? `${lowestSelling.bankName} · Spread ${
                    lowestSelling.spreadPct !== null ? `${lowestSelling.spreadPct}%` : 'N/A'
                  }`
                : 'Try another currency or sync bank feeds.'}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium text-slate-500">Feed Sync &amp; Verification</div>
            <div className="mt-1 font-mono text-lg font-bold text-slate-900 tabular-nums">
              {filteredCommercialRows.length} Verified Quotes
            </div>
            <div className="mt-1 text-xs text-slate-600 tabular-nums">
              {syncedAt
                ? `Last checked ${new Date(syncedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`
                : 'Syncing live commercial feeds...'}
            </div>
          </div>
        </section>

        {/* Commercial Bank Comparison Table */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                Commercial Bank Comparison — {activeCurrency} (
                {rateCategory === 'cash' ? 'Cash Rates' : 'Transaction / Transfer Rates'})
              </h2>
              <p className="text-xs text-slate-500">
                Rates are never combined across Cash and Transaction categories or with NBE
                reference rates.
              </p>
            </div>
          </div>

          {filteredCommercialRows.length === 0 ? (
            <div className="p-10 text-center">
              <Building2 className="mx-auto h-9 w-9 text-slate-400" />
              <h3 className="mt-3 font-display text-base font-bold text-slate-900">
                No verified commercial bank quotes for {activeCurrency} ({rateCategory})
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                Some currencies are only published by specific banks or only under Transaction rates
                (e.g. JPY). Switch currency/category or click Refresh Live Bank Rates.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm" data-testid="fx-comparison-table">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-5 py-3">Commercial Bank</th>
                    <th className="px-4 py-3 text-right">Buying (ETB)</th>
                    <th className="px-4 py-3 text-right">Selling (ETB)</th>
                    <th className="px-4 py-3 text-right">Mid</th>
                    <th className="px-4 py-3 text-right">Spread</th>
                    <th className="px-4 py-3">Published Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Official Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCommercialRows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-900">{row.bankName}</div>
                        <div className="text-[11px] text-slate-500">
                          {row.bankShortName} ·{' '}
                          {row.rateCategory === 'cash' ? 'Cash' : 'Transaction'}
                          {row.manuallyCorrected ? ' · Admin verified' : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-sm font-bold text-slate-900 tabular-nums">
                        {formatRate(row.buyingRate, row.buyingPrecisionText)}
                        {row.dailyChangeBuy !== null && row.dailyChangeBuy !== 0 && (
                          <div
                            className={`text-[11px] font-medium ${
                              row.dailyChangeBuy > 0 ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {row.dailyChangeBuy > 0 ? '+' : ''}
                            {row.dailyChangeBuy.toFixed(4)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-sm font-bold text-slate-900 tabular-nums">
                        {formatRate(row.sellingRate, row.sellingPrecisionText)}
                        {row.dailyChangeSell !== null && row.dailyChangeSell !== 0 && (
                          <div
                            className={`text-[11px] font-medium ${
                              row.dailyChangeSell > 0 ? 'text-rose-700' : 'text-emerald-700'
                            }`}
                          >
                            {row.dailyChangeSell > 0 ? '+' : ''}
                            {row.dailyChangeSell.toFixed(4)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-600 tabular-nums">
                        {formatRate(row.midRate)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-700 tabular-nums">
                        {row.spreadPct !== null ? `${row.spreadPct.toFixed(2)}%` : 'N/A'}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-600 tabular-nums">
                        <div>{row.publishedDate || 'Not provided'}</div>
                        <div className="text-[11px] text-slate-400">
                          Checked{' '}
                          {new Date(row.lastVerifiedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs">
                        {row.anomalyFlagged ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Flagged (&gt;15% shift)
                          </span>
                        ) : row.verificationStatus === 'Verified' ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                            <Clock className="h-3.5 w-3.5" />
                            {row.verificationStatus}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs">
                        <a
                          href={row.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-[#164081] hover:underline whitespace-nowrap"
                        >
                          <span>Verify source</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Bank-by-Bank Rate History Trend */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                Bank-by-Bank Rate History — {activeCurrency} ({rateCategory})
              </h2>
              <p className="text-xs text-slate-500">
                Immutable snapshot ledger recorded whenever an official bank publishes an updated
                rate.
              </p>
            </div>
            <select
              aria-label="Select bank for rate history"
              value={effectiveHistoryBankId}
              onChange={(e) => setHistoryBankId(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800"
            >
              {(banksWithRates.length > 0
                ? banksWithRates
                : [{ bankId: 'dashen', bankName: 'Dashen Bank S.C.' }]
              ).map((b) => (
                <option key={b.bankId} value={b.bankId}>
                  {b.bankName}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4">{renderSvgChart()}</div>
        </section>

        {/* Full Ethiopian Banks Source Coverage Transparency Panel */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                Ethiopian Banking Source Coverage ({bankStatuses.length} Official Institutions Tracked)
              </h2>
              <p className="text-xs text-slate-600">
                Banks without an accessible public table or API are reported honestly as Source
                unavailable rather than guessed or backfilled.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAllBanksMatrix((prev) => !prev)}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {showAllBanksMatrix ? 'Hide Unavailable Banks' : 'Show Full 20-Bank Matrix'}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(showAllBanksMatrix
              ? bankStatuses
              : bankStatuses.filter((b) => b.currenciesCollected > 0 || b.status === 'Collection failed')
            ).map((bank) => (
              <div
                key={bank.bankId}
                className="flex flex-col justify-between rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-display font-bold text-slate-900">{bank.bankName}</div>
                    <div className="text-[11px] text-slate-500">
                      {bank.isCentralBank ? 'Central Bank' : 'Commercial Bank'} · {bank.method}
                    </div>
                  </div>
                  <span
                    className={`font-semibold whitespace-nowrap ${
                      bank.status === 'Verified'
                        ? 'text-emerald-700'
                        : bank.status === 'Stale'
                        ? 'text-amber-700'
                        : 'text-slate-600'
                    }`}
                  >
                    {bank.status}
                  </span>
                </div>

                {bank.errorMessage && (
                  <p className="mt-2 text-[11px] text-slate-600">{bank.errorMessage}</p>
                )}

                <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-200/80 pt-2 text-[11px] text-slate-500 tabular-nums">
                  <span>
                    {bank.currenciesCollected > 0
                      ? `${bank.currenciesCollected} quotes · ${bank.publishedDate || 'Live'}`
                      : '0 quotes collected'}
                  </span>
                  <a
                    href={bank.fxPageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-[#164081] hover:underline"
                  >
                    <span>Official FX page</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};
