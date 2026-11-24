import { decodeHtmlEntities, sanitizeHttpUrl, stripHtmlToText } from './externalJobs.ts';
import type {
  CapitalMarketAnnouncement,
  CapitalMarketEquityRecord,
  CapitalMarketInterbankTradeRecord,
  CapitalMarketPricePoint,
  CapitalMarketSummaryMetrics,
  CapitalMarketTBillRecord,
} from '../types/domain.ts';

export interface EsxListedCompanyRow {
  companyName: string;
  symbol: string;
  sector: string;
  dateListed: string;
  dateIncorporated: string;
  esxProfileUrl: string;
}

export interface EsxCompanyProfileStats {
  symbol: string;
  listedCapitalEtb: number | null;
  listedShares: number | null;
  numberOfShareholders: number | null;
  securityType: string;
  esxProfileUrl: string;
}

export interface StockMarketEtSeries {
  symbol: string;
  name: string;
  points: CapitalMarketPricePoint[];
}

export const CAPITAL_MARKET_SOURCES_META = [
  {
    id: 'cm-esx-listed',
    name: 'Ethiopian Securities Exchange (ESX) — Main Market',
    domain: 'esx.et',
    url: 'https://esx.et/equity-market/listed-companies/',
    role: 'Primary Exchange' as const,
  },
  {
    id: 'cm-stockmarket-et',
    name: 'StockMarket.et — ESX Daily Share Price Feed',
    domain: 'stockmarket.et',
    url: 'https://www.stockmarket.et/stock-market-data/',
    role: 'Equity Feed' as const,
  },
  {
    id: 'cm-esx-fixed-income',
    name: 'ESX Fixed Income & Interbank Market Data',
    domain: 'esx.et',
    url: 'https://esx.et/fixed-income-market/data/',
    role: 'Fixed Income Feed' as const,
  },
  {
    id: 'cm-ecma',
    name: 'Ethiopian Capital Market Authority (ECMA)',
    domain: 'ecma.gov.et',
    url: 'https://ecma.gov.et/',
    role: 'Regulator' as const,
  },
];

function parseNumericClean(raw: string): number | null {
  const cleaned = raw.replace(/ETB|birr|,|%|\s/gi, '').trim();
  if (!cleaned || cleaned === '-' || cleaned === '—') return null;
  const val = Number(cleaned);
  return Number.isFinite(val) ? val : null;
}

function slugifyEsxCompany(companyName: string): string {
  return companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function parseEsxListedCompaniesHtml(html: string): EsxListedCompanyRow[] {
  if (!html) return [];
  const tableMatch = html.match(/<table[\s\S]*?<\/table>/i)?.[0] || '';
  if (!tableMatch) return [];

  const rowMatches = [...tableMatch.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  const rows: EsxListedCompanyRow[] = [];

  for (const rowMatch of rowMatches) {
    const cells = [...rowMatch[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => ({
      raw: c[1],
      text: decodeHtmlEntities(stripHtmlToText(c[1])).trim(),
    }));
    if (cells.length < 4) continue;
    // Skip table header row
    if (/^name$/i.test(cells[0].text) && /^symbol$/i.test(cells[1].text)) continue;

    const companyName = cells[0].text;
    const symbol = cells[1].text.toUpperCase();
    const sector = cells[2].text || 'Financial Services';
    const dateListed = cells[3].text || '';
    const dateIncorporated = cells[4]?.text || '';
    if (!companyName || !/^[A-Z0-9]{2,10}$/.test(symbol)) continue;

    const anchorHref = cells[0].raw.match(/href=["']([^"']+)["']/i)?.[1];
    const esxProfileUrl =
      sanitizeHttpUrl(
        anchorHref || `https://esx.et/directory/${slugifyEsxCompany(companyName)}/`
      ) || `https://esx.et/equity-market/listed-companies/`;

    rows.push({
      companyName,
      symbol,
      sector,
      dateListed,
      dateIncorporated,
      esxProfileUrl,
    });
  }

  return rows;
}

export function parseEsxCompanyDirectoryProfile(
  html: string,
  esxProfileUrl: string
): EsxCompanyProfileStats | null {
  if (!html) return null;
  const text = decodeHtmlEntities(stripHtmlToText(html));
  const symbolMatch = text.match(/\bSymbol\s+([A-Z0-9]{2,10})\b/);
  if (!symbolMatch) return null;

  const capMatch = text.match(/Listed Capital\s+([\d,]+(?:\.\d+)?)/i);
  const sharesMatch = text.match(/Listed Shares\s+([\d,]+)/i);
  const shareholdersMatch = text.match(/Number of Shareholders\s+([\d,]+)/i);
  const secTypeMatch = text.match(
    /Security Type\s+([A-Za-z0-9\s–—-]+?)\s+(?:Nature of Business|Date of Incorporation|Sub Sector|Company Address)/i
  );

  return {
    symbol: symbolMatch[1].toUpperCase(),
    listedCapitalEtb: capMatch ? parseNumericClean(capMatch[1]) : null,
    listedShares: sharesMatch ? parseNumericClean(sharesMatch[1]) : null,
    numberOfShareholders: shareholdersMatch ? parseNumericClean(shareholdersMatch[1]) : null,
    securityType: secTypeMatch ? secTypeMatch[1].trim() : 'Equity',
    esxProfileUrl,
  };
}

export function parseStockMarketEtHistoriesHtml(html: string): StockMarketEtSeries[] {
  if (!html) return [];
  // StockMarket.et embeds RSC JSON payload either escaped (\"histories\":) or unescaped ("histories":)
  const normalized = html.includes('\\"histories\\":')
    ? html.replace(/\\"/g, '"')
    : html;

  const markerIdx = normalized.indexOf('"histories":[');
  if (markerIdx === -1) return [];

  const sub = normalized.slice(markerIdx + '"histories":'.length);
  // Extract balanced JSON array for histories
  let depth = 0;
  let endIdx = -1;
  for (let i = 0; i < sub.length; i++) {
    const ch = sub[i];
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) {
        endIdx = i + 1;
        break;
      }
    }
  }
  if (endIdx === -1) return [];

  try {
    const rawArray = JSON.parse(sub.slice(0, endIdx)) as Array<{
      symbol?: string;
      name?: string;
      points?: Array<{ date?: string; price?: number | string }>;
    }>;

    const bySymbol = new Map<string, StockMarketEtSeries>();
    for (const entry of rawArray) {
      const symbol = String(entry.symbol || '').trim().toUpperCase();
      if (!symbol || !Array.isArray(entry.points)) continue;
      const points: CapitalMarketPricePoint[] = [];
      for (const p of entry.points) {
        const date = String(p.date || '').trim();
        const price = Number(p.price);
        if (date && Number.isFinite(price) && price > 0) {
          points.push({ date, price });
        }
      }
      if (points.length === 0) continue;
      const existing = bySymbol.get(symbol);
      if (!existing || points.length > existing.points.length) {
        bySymbol.set(symbol, {
          symbol,
          name: decodeHtmlEntities(String(entry.name || symbol)).trim(),
          points,
        });
      }
    }

    return Array.from(bySymbol.values());
  } catch {
    return [];
  }
}

export function parseEsxInterbankDataHtml(html: string): CapitalMarketInterbankTradeRecord[] {
  if (!html) return [];
  const tableMatch = html.match(/<table[\s\S]*?<\/table>/i)?.[0] || '';
  if (!tableMatch) return [];

  const rowMatches = [...tableMatch.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  const records: CapitalMarketInterbankTradeRecord[] = [];

  for (let i = 0; i < rowMatches.length; i++) {
    const cells = [...rowMatches[i][1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      decodeHtmlEntities(stripHtmlToText(c[1])).trim()
    );
    if (cells.length < 5) continue;
    if (/^week$/i.test(cells[0])) continue;

    const weekLabel = cells[0];
    const maturity = cells[1];
    const volumeLabel = cells[2];
    const volumeEtb = parseNumericClean(volumeLabel);
    const totalTrades = parseNumericClean(cells[3]);
    const weightedAvgRatePct = parseNumericClean(cells[4]);
    const rateChangePct = cells[5] ? parseNumericClean(cells[5]) : null;
    if (!weekLabel || !maturity) continue;

    records.push({
      id: `esx-ib-${i}-${weekLabel.replace(/[^a-z0-9]/gi, '').slice(0, 14)}`,
      weekLabel,
      maturity,
      volumeEtb,
      volumeLabel,
      totalTrades,
      weightedAvgRatePct,
      rateChangePct,
      sourceUrl: 'https://esx.et/fixed-income-market/data/',
    });
  }

  return records;
}

export function parseEsxListedTBillsHtml(html: string): CapitalMarketTBillRecord[] {
  if (!html) return [];
  const tableMatch = html.match(/<table[\s\S]*?<\/table>/i)?.[0] || '';
  if (!tableMatch) return [];

  const rowMatches = [...tableMatch.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  const records: CapitalMarketTBillRecord[] = [];

  for (let i = 0; i < rowMatches.length; i++) {
    const cells = [...rowMatches[i][1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      decodeHtmlEntities(stripHtmlToText(c[1])).trim()
    );
    if (cells.length < 7) continue;
    if (/auction no/i.test(cells[0])) continue;

    const auctionNo = cells[0];
    const auctionDate = cells[1];
    const tradingSymbol = cells[2];
    const tenorDays = cells[3];
    const listedDate = cells[4];
    const maturityDate = cells[5];
    const amountAcceptedEtbMillions = parseNumericClean(cells[6]);
    const weightedAvgYieldPct = cells[7] ? parseNumericClean(cells[7]) : null;

    if (!tradingSymbol) continue;

    records.push({
      id: `esx-tbill-${tradingSymbol}-${i}`,
      auctionNo,
      auctionDate,
      tradingSymbol,
      tenorDays,
      listedDate,
      maturityDate,
      amountAcceptedEtbMillions,
      weightedAvgYieldPct,
      sourceUrl: 'https://esx.et/fixed-income-market/listed-instruments/',
    });
  }

  return records;
}

export function parseEsxAnnouncementsWpPosts(
  posts: Array<{
    id: number | string;
    date?: string;
    link?: string;
    title?: { rendered?: string };
    excerpt?: { rendered?: string };
  }>,
  sourceName: string,
  category: string
): CapitalMarketAnnouncement[] {
  if (!Array.isArray(posts)) return [];
  const announcements: CapitalMarketAnnouncement[] = [];
  for (const post of posts) {
    const title = decodeHtmlEntities(stripHtmlToText(String(post.title?.rendered || ''))).trim();
    const sourceUrl = sanitizeHttpUrl(String(post.link || '').trim());
    if (!title || !sourceUrl) continue;
    const summary = decodeHtmlEntities(stripHtmlToText(String(post.excerpt?.rendered || '')))
      .trim()
      .slice(0, 240);
    const publishedAt =
      post.date && !Number.isNaN(new Date(post.date).getTime())
        ? new Date(post.date).toISOString()
        : null;
    announcements.push({
      id: `cm-ann-${String(post.id).replace(/[^a-z0-9]/gi, '')}`,
      title,
      summary: summary || `${title}. Official market release on ${sourceName}.`,
      publishedAt,
      sourceName,
      sourceUrl,
      category,
    });
  }
  return announcements;
}

export function getEatMarketSessionStatus(now: Date = new Date()): {
  tradingStatus: CapitalMarketEquityRecord['tradingStatus'];
  label: string;
} {
  // Addis Ababa is East Africa Time (UTC+3, no DST)
  const eatMs = now.getTime() + 3 * 60 * 60 * 1000;
  const eat = new Date(eatMs);
  const day = eat.getUTCDay(); // 0 = Sun, 6 = Sat
  const mins = eat.getUTCHours() * 60 + eat.getUTCMinutes();

  if (day === 0 || day === 6) {
    return {
      tradingStatus: 'Market Closed',
      label: 'Market Closed (Weekend · Opens Mon 9:00 AM EAT)',
    };
  }
  if (mins >= 9 * 60 && mins < 9 * 60 + 30) {
    return {
      tradingStatus: 'Pre-Open',
      label: 'Pre-Open Session (9:00 AM – 9:30 AM EAT)',
    };
  }
  if (mins >= 9 * 60 + 30 && mins < 15 * 60) {
    return {
      tradingStatus: 'Continuous Trading',
      label: 'Continuous Trading Session Open (9:30 AM – 3:00 PM EAT)',
    };
  }
  return {
    tradingStatus: 'Market Closed',
    label: 'Market Closed (Daily Session: 9:00 AM – 3:00 PM EAT)',
  };
}

export function buildCapitalMarketEquitiesAndSummary(params: {
  listedCompanies: EsxListedCompanyRow[];
  profilesBySymbol: Map<string, EsxCompanyProfileStats>;
  seriesBySymbol: Map<string, StockMarketEtSeries>;
  interbankTrades: CapitalMarketInterbankTradeRecord[];
  syncedAt: string;
  now?: Date;
}): {
  equities: CapitalMarketEquityRecord[];
  summary: CapitalMarketSummaryMetrics;
} {
  const session = getEatMarketSessionStatus(params.now);
  const equities: CapitalMarketEquityRecord[] = [];
  const handledSymbols = new Set<string>();

  for (const row of params.listedCompanies) {
    handledSymbols.add(row.symbol);
    const prof = params.profilesBySymbol.get(row.symbol);
    const series = params.seriesBySymbol.get(row.symbol);
    const points = series?.points || [];
    const latest = points[points.length - 1];
    const prev = points.length >= 2 ? points[points.length - 2] : undefined;

    const lastPriceEtb = latest ? Number(latest.price.toFixed(2)) : null;
    const previousCloseEtb = prev ? Number(prev.price.toFixed(2)) : lastPriceEtb;
    const changeEtb =
      lastPriceEtb !== null && previousCloseEtb !== null
        ? Number((lastPriceEtb - previousCloseEtb).toFixed(2))
        : null;
    const changePct =
      lastPriceEtb !== null && previousCloseEtb !== null && previousCloseEtb > 0
        ? Number((((lastPriceEtb - previousCloseEtb) / previousCloseEtb) * 100).toFixed(2))
        : null;

    const prices = points.map((p) => p.price);
    const periodHighEtb = prices.length > 0 ? Number(Math.max(...prices).toFixed(2)) : null;
    const periodLowEtb = prices.length > 0 ? Number(Math.min(...prices).toFixed(2)) : null;

    const listedShares = prof?.listedShares ?? null;
    const marketCapImpliedEtb =
      lastPriceEtb !== null && listedShares !== null
        ? Math.round(lastPriceEtb * listedShares)
        : prof?.listedCapitalEtb ?? null;

    equities.push({
      symbol: row.symbol,
      companyName: row.companyName,
      sector: row.sector,
      securityType: prof?.securityType || 'Equity',
      dateListed: row.dateListed || null,
      dateIncorporated: row.dateIncorporated || null,
      listedCapitalEtb: prof?.listedCapitalEtb ?? null,
      listedShares,
      numberOfShareholders: prof?.numberOfShareholders ?? null,
      lastPriceEtb,
      previousCloseEtb,
      changeEtb,
      changePct,
      periodHighEtb,
      periodLowEtb,
      sessionDate: latest?.date || null,
      marketCapImpliedEtb,
      dailyVolumeNote:
        lastPriceEtb !== null
          ? 'ESX public feed reports closing price; share volume requires member feed'
          : 'Newly listed issuer — awaiting first public trade print',
      tradingStatus: lastPriceEtb !== null ? session.tradingStatus : 'Listed / Quote Pending',
      priceHistory: points,
      esxProfileUrl: prof?.esxProfileUrl || row.esxProfileUrl,
      marketDataUrl: `https://www.stockmarket.et/stock-market-data/${row.symbol.toLowerCase()}/`,
      lastVerifiedAt: params.syncedAt,
      sourceName: lastPriceEtb !== null ? 'ESX · StockMarket.et' : 'ESX Official Directory',
      verificationStatus: lastPriceEtb !== null ? 'Verified' : 'Source unavailable',
    });
  }

  // Sort equities: priced ones first by implied market cap descending, then pending ones by listing date
  equities.sort((a, b) => {
    const aHas = a.lastPriceEtb !== null ? 1 : 0;
    const bHas = b.lastPriceEtb !== null ? 1 : 0;
    if (aHas !== bHas) return bHas - aHas;
    return (b.marketCapImpliedEtb ?? 0) - (a.marketCapImpliedEtb ?? 0);
  });

  const priced = equities.filter((e) => e.lastPriceEtb !== null);
  const advancers = priced.filter((e) => (e.changePct ?? 0) > 0);
  const decliners = priced.filter((e) => (e.changePct ?? 0) < 0);
  const unchanged = priced.filter((e) => (e.changePct ?? 0) === 0);

  let topGainerSymbol: string | null = null;
  let topGainerPct: number | null = null;
  for (const e of priced) {
    if (e.changePct !== null && (topGainerPct === null || e.changePct > topGainerPct)) {
      topGainerPct = e.changePct;
      topGainerSymbol = e.symbol;
    }
  }

  const latestSessionDate =
    priced
      .map((e) => e.sessionDate)
      .filter((d): d is string => Boolean(d))
      .sort()
      .pop() || null;

  const totalListedShares = equities.reduce((acc, e) => acc + (e.listedShares ?? 0), 0);
  const totalImpliedMarketCapEtb = equities.reduce(
    (acc, e) => acc + (e.marketCapImpliedEtb ?? 0),
    0
  );

  // Latest week interbank totals
  const latestIbWeek =
    params.interbankTrades.length > 0
      ? params.interbankTrades[params.interbankTrades.length - 1].weekLabel
      : null;
  const latestWeekRows = latestIbWeek
    ? params.interbankTrades.filter((t) => t.weekLabel === latestIbWeek)
    : [];
  const latestInterbankVolumeEtb =
    latestWeekRows.length > 0
      ? latestWeekRows.reduce((acc, t) => acc + (t.volumeEtb ?? 0), 0)
      : null;
  const latestInterbankTradesCount =
    latestWeekRows.length > 0
      ? latestWeekRows.reduce((acc, t) => acc + (t.totalTrades ?? 0), 0)
      : null;

  return {
    equities,
    summary: {
      listedCompaniesCount: equities.length,
      pricedEquitiesCount: priced.length,
      totalListedShares,
      totalImpliedMarketCapEtb,
      latestSessionDate,
      advancersCount: advancers.length,
      declinersCount: decliners.length,
      unchangedCount: unchanged.length,
      topGainerSymbol,
      topGainerPct,
      latestInterbankVolumeEtb,
      latestInterbankTradesCount,
      latestInterbankWeek: latestIbWeek,
      marketSessionState: session.label,
    },
  };
}
