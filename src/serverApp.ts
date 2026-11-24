import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {
  createAdminSessionToken,
  extractBearerToken,
  verifyAdminSessionToken,
} from './lib/adminAuth.ts';
import { hashUserPassword } from './lib/security.ts';
import { SEED_USERS } from './data/seedData.ts';
import {
  EXTERNAL_JOB_SOURCES,
  parseEffoySiraPosts,
  parseEthiojobsHtml,
  parseGeezJobsHtml,
  type EffoySiraPostItem,
  type ExternalJobsApiResponse,
} from './lib/externalJobs.ts';
import {
  ETHIOPIAN_BANKS_CATALOG,
  mergeBankRatesWithHistory,
  parseAbayBankHtml,
  parseAmharaBankHtml,
  parseBerhanBankHtml,
  parseBunnaApiRates,
  parseCoopBankHtml,
  parseDashenBankHtml,
  parseEnatBankHtml,
  parseGlobalBankHtml,
  parseNbeApiRates,
  parseNibBankHtml,
  parseSiinqeeBankHtml,
  parseTsedeyBankHtml,
  parseZamZamBankHtml,
  parseZemenApiRates,
  type BunnaForexApiPayload,
  type EthiopianBankRegistryItem,
  type NbeMidRateApiPayload,
  type NbeSelectedRatesApiPayload,
  type ZemenExchangeAjaxPayload,
} from './lib/fxAggregator.ts';
import {
  DEFAULT_OPPORTUNITY_SOURCES,
  deduplicateOpportunities,
  parse2MerkatoTendersHtml,
  parseGenericRssOrAtomXml,
  parseWordPressPostsToOpportunities,
  type WordPressPostRaw,
} from './lib/opportunityAggregator.ts';
import {
  TOP_NEWS_SOURCES,
  deduplicateAndSortNews,
  parseNewsRssXml,
  parseWordPressNewsPosts,
  type NewsWordPressPostRaw,
  type TopNewsSourceDefinition,
} from './lib/newsAggregator.ts';
import {
  CAPITAL_MARKET_SOURCES_META,
  buildCapitalMarketEquitiesAndSummary,
  parseEsxAnnouncementsWpPosts,
  parseEsxCompanyDirectoryProfile,
  parseEsxInterbankDataHtml,
  parseEsxListedCompaniesHtml,
  parseEsxListedTBillsHtml,
  parseStockMarketEtHistoriesHtml,
  type EsxCompanyProfileStats,
  type StockMarketEtSeries,
} from './lib/capitalMarketAggregator.ts';
import {
  answerRecruiterPoolQuestion,
  buildDeterministicInterviewQuestions,
  computeDeterministicJobMatch,
  computeDeterministicResumeAnalysis,
  evaluateInterviewAnswerDeterministic,
  rankJobsForCandidate,
  sanitizeResumePlainText,
  screenApplicantsDeterministic,
  validateUploadedCvBinary,
} from './lib/aiRecruitment.ts';
import type {
  AggregatedOpportunity,
  AggregationSourceRecord,
  AggregatorOverviewResponse,
  AiApplicantScreeningItem,
  AiEngineStatusResponse,
  AiInterviewEvaluation,
  AiInterviewQuestion,
  AiJobMatchResult,
  AiResumeAnalysisResult,
  AiUsageAnalytics,
  BankFxApiResponse,
  BankFxHistoryPoint,
  BankFxRateRecord,
  BankFxSourceStatus,
  CapitalMarketAnnouncement,
  CapitalMarketApiResponse,
  CapitalMarketSourceStatus,
  CollectionErrorEntry,
  CollectionRunEntry,
  ExternalJobSourceStatus,
  JobApplication,
  JobListing,
  NbeIndicativeMidRate,
  NewsApiResponse,
  NewsArticleRecord,
  NewsSourceStatus,
  OpportunitiesApiResponse,
  OpportunityModuleType,
  UserProfile,
} from './types/domain.ts';

const CACHE_TTL_MS = 10 * 60 * 1000;
const STORE_PATH = '/tmp/tatari-aggregator-store.json';
const SESSION_SIGNING_SECRET =
  process.env.TATARI_SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const adminPasswordHashes = new Map<string, string>(
  SEED_USERS.filter((u) => u.role === 'admin' && u.status === 'approved').map((u) => [
    u.email.toLowerCase(),
    u.passwordHash,
  ])
);

const BROWSER_HEADERS: Record<string, string> = {
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  accept: 'text/html,application/json,application/xhtml+xml;q=0.9,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
};

interface PersistedAggregatorState {
  jobs: JobListing[];
  jobSources: ExternalJobSourceStatus[];
  jobsSyncedAt: string | null;
  jobsExpiresAt: number;
  fxRates: BankFxRateRecord[];
  fxHistory: BankFxHistoryPoint[];
  fxBankStatuses: BankFxSourceStatus[];
  nbeIndicativeMid: NbeIndicativeMidRate | null;
  fxSyncedAt: string | null;
  fxExpiresAt: number;
  opportunities: AggregatedOpportunity[];
  opportunitySources: AggregationSourceRecord[];
  opportunitiesSyncedAt: string | null;
  opportunitiesExpiresAt: number;
  newsArticles: NewsArticleRecord[];
  newsSources: NewsSourceStatus[];
  newsSyncedAt: string | null;
  newsExpiresAt: number;
  capitalMarket: CapitalMarketApiResponse | null;
  capitalMarketExpiresAt: number;
  collectionRuns: CollectionRunEntry[];
  collectionErrors: CollectionErrorEntry[];
  duplicatesDetected: number;
  anomaliesCount: number;
  aiUsage: AiUsageAnalytics;
}

function buildInitialSourceRecords(): AggregationSourceRecord[] {
  return DEFAULT_OPPORTUNITY_SOURCES.map((s) => ({
    id: s.id,
    name: s.name,
    domain: s.domain,
    url: s.url,
    feedUrl: s.feedUrl,
    module: s.module,
    method: s.method,
    active: true,
    frequencyLabel: s.frequencyLabel,
    status: 'Verified',
    fetchedCount: 0,
    lastAttemptAt: null,
    lastSuccessAt: null,
    termsNote: s.termsNote,
    isCustom: false,
  }));
}

function buildInitialNewsSourceStatuses(): NewsSourceStatus[] {
  return TOP_NEWS_SOURCES.map((s) => ({
    id: s.id,
    name: s.name,
    domain: s.domain,
    homeUrl: s.homeUrl,
    feedUrl: s.feedUrl,
    coverage: s.coverage,
    language: s.language,
    method: s.method,
    status: 'Stale',
    articlesCollected: 0,
    lastAttemptAt: null,
    lastSuccessAt: null,
  }));
}

function createEmptyStore(): PersistedAggregatorState {
  return {
    jobs: [],
    jobSources: [],
    jobsSyncedAt: null,
    jobsExpiresAt: 0,
    fxRates: [],
    fxHistory: [],
    fxBankStatuses: [],
    nbeIndicativeMid: null,
    fxSyncedAt: null,
    fxExpiresAt: 0,
    opportunities: [],
    opportunitySources: buildInitialSourceRecords(),
    opportunitiesSyncedAt: null,
    opportunitiesExpiresAt: 0,
    newsArticles: [],
    newsSources: buildInitialNewsSourceStatuses(),
    newsSyncedAt: null,
    newsExpiresAt: 0,
    capitalMarket: null,
    capitalMarketExpiresAt: 0,
    collectionRuns: [],
    collectionErrors: [],
    duplicatesDetected: 0,
    anomaliesCount: 0,
    aiUsage: {
      resumeScans: 0,
      jobMatches: 0,
      recommendationsRuns: 0,
      interviewSessions: 0,
      employerScreenings: 0,
      totalAiRequests: 0,
      lastAiCallAt: null,
    },
  };
}

function loadPersistedStore(): PersistedAggregatorState {
  const empty = createEmptyStore();
  try {
    if (!fs.existsSync(STORE_PATH)) return empty;
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PersistedAggregatorState>;
    const defaults = buildInitialSourceRecords();
    const existingSources = Array.isArray(parsed.opportunitySources)
      ? parsed.opportunitySources
      : [];
    const mergedSources = [
      ...defaults.map((def) => existingSources.find((e) => e.id === def.id) || def),
      ...existingSources.filter((e) => e.isCustom),
    ];

    const defaultNews = buildInitialNewsSourceStatuses();
    const existingNewsSources = Array.isArray(parsed.newsSources) ? parsed.newsSources : [];
    const mergedNewsSources = defaultNews.map(
      (def) => existingNewsSources.find((e) => e.id === def.id) || def
    );

    return {
      ...empty,
      ...parsed,
      opportunitySources: mergedSources,
      newsSources: mergedNewsSources,
      newsArticles: Array.isArray(parsed.newsArticles) ? parsed.newsArticles : [],
      collectionRuns: Array.isArray(parsed.collectionRuns) ? parsed.collectionRuns.slice(0, 50) : [],
      collectionErrors: Array.isArray(parsed.collectionErrors)
        ? parsed.collectionErrors.slice(0, 100)
        : [],
      fxHistory: Array.isArray(parsed.fxHistory) ? parsed.fxHistory.slice(-1500) : [],
      aiUsage: parsed.aiUsage
        ? { ...empty.aiUsage, ...parsed.aiUsage }
        : empty.aiUsage,
    };
  } catch {
    return empty;
  }
}

function savePersistedStore(state: PersistedAggregatorState): void {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(state), 'utf8');
  } catch {
    // Non-fatal in read-only or restricted temp environments
  }
}

let store: PersistedAggregatorState = loadPersistedStore();
let inFlightJobsSync: Promise<ExternalJobsApiResponse> | null = null;
let inFlightFxSync: Promise<BankFxApiResponse> | null = null;
let inFlightOppSync: Promise<OpportunitiesApiResponse> | null = null;
let inFlightNewsSync: Promise<NewsApiResponse> | null = null;
let inFlightCapitalSync: Promise<CapitalMarketApiResponse> | null = null;
let isFullSyncRunning = false;

export function isSafePublicHttpUrl(rawUrl: string): {
  valid: boolean;
  normalized?: string;
  error?: string;
} {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return { valid: false, error: 'URL is required.' };
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Invalid URL syntax.' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { valid: false, error: 'Only http:// or https:// URLs are permitted.' };
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '[::1]' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^fc00:|^fe80:/i.test(host)
  ) {
    return { valid: false, error: 'Localhost, loopback, and private network addresses are blocked.' };
  }
  return { valid: true, normalized: parsed.toString() };
}

async function fetchWithRetry(
  url: string,
  options: RequestInit & { timeoutMs?: number; retries?: number } = {}
): Promise<Response> {
  const { timeoutMs = 11000, retries = 1, ...init } = options;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok && attempt < retries && (res.status === 429 || res.status >= 500)) {
        await res.text().catch(() => {});
        await new Promise((r) => setTimeout(r, 450 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Network request failed');
}

async function fetchTextImmediate(
  url: string,
  options: RequestInit & { timeoutMs?: number; retries?: number } = {}
): Promise<{ ok: true; status: number; text: string } | { ok: false; status: number; error: string }> {
  try {
    const res = await fetchWithRetry(url, options);
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    }
    return { ok: true, status: res.status, text };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : 'Network request failed',
    };
  }
}

async function fetchJsonImmediate<T>(
  url: string,
  options: RequestInit & { timeoutMs?: number; retries?: number } = {}
): Promise<{ ok: true; status: number; data: T } | { ok: false; status: number; error: string }> {
  try {
    const res = await fetchWithRetry(url, options);
    const raw = await res.text();
    if (!res.ok) {
      return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    }
    return { ok: true, status: res.status, data: JSON.parse(raw) as T };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : 'Invalid JSON or network error',
    };
  }
}

function recordError(
  sourceId: string,
  sourceName: string,
  module: string,
  reason: string
): void {
  store.collectionErrors = [
    {
      id: `err-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      sourceId,
      sourceName,
      module,
      reason,
    },
    ...store.collectionErrors,
  ].slice(0, 100);
}

// ---------- External Jobs Collector ----------

async function fetchEthiojobsFeed(syncedAt: string): Promise<{
  status: ExternalJobSourceStatus;
  jobs: JobListing[];
}> {
  const meta = EXTERNAL_JOB_SOURCES[0];
  try {
    const res = await fetchWithRetry(meta.feedUrl, { headers: BROWSER_HEADERS, timeoutMs: 8500 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const jobs = parseEthiojobsHtml(html, syncedAt).slice(0, 15);
    return {
      jobs,
      status: {
        id: meta.id,
        name: meta.name,
        domain: meta.domain,
        homeUrl: meta.homeUrl,
        status: jobs.length > 0 ? 'ok' : 'error',
        fetchedCount: jobs.length,
        errorMessage: jobs.length === 0 ? 'No structured listings returned' : undefined,
        lastSyncedAt: syncedAt,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unable to reach ethiojobs.net';
    recordError(meta.id, meta.name, 'jobs', msg);
    return {
      jobs: [],
      status: {
        id: meta.id,
        name: meta.name,
        domain: meta.domain,
        homeUrl: meta.homeUrl,
        status: 'error',
        fetchedCount: 0,
        errorMessage: msg,
        lastSyncedAt: syncedAt,
      },
    };
  }
}

async function fetchGeezJobsFeed(syncedAt: string): Promise<{
  status: ExternalJobSourceStatus;
  jobs: JobListing[];
}> {
  const meta = EXTERNAL_JOB_SOURCES[1];
  try {
    const res = await fetchWithRetry(meta.feedUrl, {
      headers: { ...BROWSER_HEADERS, cookie: 'gj_ok=1' },
      timeoutMs: 8500,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const jobs = parseGeezJobsHtml(html, syncedAt).slice(0, 15);
    return {
      jobs,
      status: {
        id: meta.id,
        name: meta.name,
        domain: meta.domain,
        homeUrl: meta.homeUrl,
        status: jobs.length > 0 ? 'ok' : 'error',
        fetchedCount: jobs.length,
        errorMessage: jobs.length === 0 ? 'No listings extracted' : undefined,
        lastSyncedAt: syncedAt,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unable to reach geezjobs.com';
    recordError(meta.id, meta.name, 'jobs', msg);
    return {
      jobs: [],
      status: {
        id: meta.id,
        name: meta.name,
        domain: meta.domain,
        homeUrl: meta.homeUrl,
        status: 'error',
        fetchedCount: 0,
        errorMessage: msg,
        lastSyncedAt: syncedAt,
      },
    };
  }
}

async function fetchEffoySiraFeed(syncedAt: string): Promise<{
  status: ExternalJobSourceStatus;
  jobs: JobListing[];
}> {
  const meta = EXTERNAL_JOB_SOURCES[2];
  try {
    const res = await fetchWithRetry(meta.feedUrl, {
      headers: { ...BROWSER_HEADERS, accept: 'application/json' },
      timeoutMs: 8500,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as EffoySiraPostItem[];
    const jobs = parseEffoySiraPosts(data, syncedAt).slice(0, 12);
    return {
      jobs,
      status: {
        id: meta.id,
        name: meta.name,
        domain: meta.domain,
        homeUrl: meta.homeUrl,
        status: jobs.length > 0 ? 'ok' : 'error',
        fetchedCount: jobs.length,
        errorMessage: jobs.length === 0 ? 'No job announcements returned' : undefined,
        lastSyncedAt: syncedAt,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unable to reach effoysira.com';
    recordError(meta.id, meta.name, 'jobs', msg);
    return {
      jobs: [],
      status: {
        id: meta.id,
        name: meta.name,
        domain: meta.domain,
        homeUrl: meta.homeUrl,
        status: 'error',
        fetchedCount: 0,
        errorMessage: msg,
        lastSyncedAt: syncedAt,
      },
    };
  }
}

async function collectAllExternalJobs(forceRefresh: boolean): Promise<ExternalJobsApiResponse> {
  const now = Date.now();
  if (!forceRefresh && store.jobs.length > 0 && store.jobsExpiresAt > now && store.jobsSyncedAt) {
    return {
      jobs: store.jobs,
      sources: store.jobSources,
      syncedAt: store.jobsSyncedAt,
      cached: true,
    };
  }
  if (inFlightJobsSync) return inFlightJobsSync;

  inFlightJobsSync = (async () => {
    const startedMs = Date.now();
    const syncedAt = new Date().toISOString();
    const [ethiojobs, geezjobs, effoysira] = await Promise.all([
      fetchEthiojobsFeed(syncedAt),
      fetchGeezJobsFeed(syncedAt),
      fetchEffoySiraFeed(syncedAt),
    ]);

    const previousBySource = {
      ethiojobs: store.jobs.filter((j) => j.sourceDomain === 'ethiojobs.net'),
      geezjobs: store.jobs.filter((j) => j.sourceDomain === 'geezjobs.com'),
      effoysira: store.jobs.filter((j) => j.sourceDomain === 'effoysira.com'),
    };
    const combinedJobs: JobListing[] = [
      ...(ethiojobs.jobs.length > 0 ? ethiojobs.jobs : previousBySource.ethiojobs),
      ...(geezjobs.jobs.length > 0 ? geezjobs.jobs : previousBySource.geezjobs),
      ...(effoysira.jobs.length > 0 ? effoysira.jobs : previousBySource.effoysira),
    ];
    const sources = [ethiojobs.status, geezjobs.status, effoysira.status];
    const failedCount = sources.filter((s) => s.status !== 'ok').length;

    if (combinedJobs.length > 0 || store.jobs.length === 0) {
      store.jobs = combinedJobs;
    }
    store.jobSources = sources;
    store.jobsSyncedAt = syncedAt;
    store.jobsExpiresAt = Date.now() + CACHE_TTL_MS;

    const jobsRun: CollectionRunEntry = {
      id: `run-jobs-${Date.now()}`,
      startedAt: syncedAt,
      completedAt: new Date().toISOString(),
      scope: 'jobs',
      itemsCollected: combinedJobs.length,
      duplicatesSkipped: 0,
      failedSources: failedCount,
      durationMs: Date.now() - startedMs,
      status: failedCount === sources.length ? 'failed' : failedCount > 0 ? 'partial' : 'success',
    };
    store.collectionRuns = [jobsRun, ...store.collectionRuns].slice(0, 50);

    savePersistedStore(store);

    return {
      jobs: store.jobs,
      sources,
      syncedAt,
      cached: false,
    };
  })();

  try {
    return await inFlightJobsSync;
  } finally {
    inFlightJobsSync = null;
  }
}

// ---------- Bank FX Aggregator ----------

async function fetchSingleBankFx(
  bank: EthiopianBankRegistryItem,
  syncedAt: string
): Promise<{
  rates: BankFxRateRecord[];
  indicativeMid?: NbeIndicativeMidRate | null;
  status: BankFxSourceStatus;
  failed: boolean;
}> {
  if (bank.method === 'js_rendered' || bank.method === 'unreachable_blocked') {
    return {
      rates: [],
      failed: false,
      status: {
        bankId: bank.bankId,
        bankName: bank.bankName,
        bankShortName: bank.bankShortName,
        isCentralBank: bank.isCentralBank,
        officialWebsite: bank.officialWebsite,
        fxPageUrl: bank.fxPageUrl,
        method: bank.method,
        status: 'Source unavailable',
        currenciesCollected: 0,
        publishedDate: null,
        lastCheckedAt: syncedAt,
        errorMessage:
          bank.unavailableReason || 'Source does not provide a reachable static/API FX feed.',
      },
    };
  }

  try {
    if (bank.bankId === 'nbe') {
      const selRes = await fetchWithRetry('https://api.nbe.gov.et/api/get-selected-exchange-rates', {
        headers: { ...BROWSER_HEADERS, accept: 'application/json' },
        timeoutMs: 12000,
        retries: 1,
      });
      await new Promise((r) => setTimeout(r, 300));
      const midRes = await fetchWithRetry('https://api.nbe.gov.et/api/one-daily-indicative-mid-rates', {
        headers: { ...BROWSER_HEADERS, accept: 'application/json' },
        timeoutMs: 12000,
        retries: 1,
      });

      let selPayload: NbeSelectedRatesApiPayload | null = null;
      let midPayload: NbeMidRateApiPayload | null = null;

      if (selRes.ok && (selRes.headers.get('content-type') || '').includes('json')) {
        selPayload = (await selRes.json()) as NbeSelectedRatesApiPayload;
      }
      if (midRes.ok && (midRes.headers.get('content-type') || '').includes('json')) {
        midPayload = (await midRes.json()) as NbeMidRateApiPayload;
      }

      const { rates, indicativeMid } = parseNbeApiRates(selPayload, midPayload, syncedAt);
      if (rates.length === 0 && !indicativeMid) {
        const statusHint =
          selRes.status === 429 || midRes.status === 429
            ? 'NBE API rate-limited (HTTP 429); retrying on next cycle.'
            : 'NBE API returned non-JSON or empty rate payload.';
        throw new Error(statusHint);
      }
      return {
        rates,
        indicativeMid,
        failed: false,
        status: {
          bankId: bank.bankId,
          bankName: bank.bankName,
          bankShortName: bank.bankShortName,
          isCentralBank: true,
          officialWebsite: bank.officialWebsite,
          fxPageUrl: bank.fxPageUrl,
          method: bank.method,
          status: 'Verified',
          currenciesCollected: rates.length,
          publishedDate: indicativeMid?.dateText || rates[0]?.publishedDate || null,
          lastCheckedAt: syncedAt,
        },
      };
    }

    if (bank.bankId === 'bunna') {
      const res = await fetchWithRetry(bank.feedUrl, {
        headers: { ...BROWSER_HEADERS, accept: 'application/json' },
        timeoutMs: 10000,
        retries: 1,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = (await res.json()) as BunnaForexApiPayload;
      const rates = parseBunnaApiRates(payload, syncedAt);
      if (rates.length === 0) throw new Error('Bunna FX API returned 0 valid currency rates.');
      return {
        rates,
        failed: false,
        status: {
          bankId: bank.bankId,
          bankName: bank.bankName,
          bankShortName: bank.bankShortName,
          isCentralBank: false,
          officialWebsite: bank.officialWebsite,
          fxPageUrl: bank.fxPageUrl,
          method: bank.method,
          status: rates[0]?.verificationStatus === 'Stale' ? 'Stale' : 'Verified',
          currenciesCollected: rates.length,
          publishedDate: rates[0]?.publishedDate || null,
          lastCheckedAt: syncedAt,
        },
      };
    }

    if (bank.bankId === 'zemen') {
      const res = await fetchWithRetry(bank.feedUrl, {
        method: 'POST',
        headers: {
          ...BROWSER_HEADERS,
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          accept: 'application/json',
        },
        body: 'action=get_exchange_rates&date=',
        timeoutMs: 11000,
        retries: 1,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = (await res.json()) as ZemenExchangeAjaxPayload;
      const rates = parseZemenApiRates(payload, syncedAt);
      if (rates.length === 0) throw new Error('Zemen FX AJAX returned 0 valid currency rates.');
      return {
        rates,
        failed: false,
        status: {
          bankId: bank.bankId,
          bankName: bank.bankName,
          bankShortName: bank.bankShortName,
          isCentralBank: false,
          officialWebsite: bank.officialWebsite,
          fxPageUrl: bank.fxPageUrl,
          method: bank.method,
          status: rates[0]?.verificationStatus === 'Stale' ? 'Stale' : 'Verified',
          currenciesCollected: rates.length,
          publishedDate: rates[0]?.publishedDate || null,
          lastCheckedAt: syncedAt,
        },
      };
    }

    const res = await fetchWithRetry(bank.feedUrl, {
      headers: BROWSER_HEADERS,
      timeoutMs: 11000,
      retries: 1,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    let rates: BankFxRateRecord[] = [];
    if (bank.bankId === 'dashen') rates = parseDashenBankHtml(html, syncedAt);
    else if (bank.bankId === 'coop') rates = parseCoopBankHtml(html, syncedAt);
    else if (bank.bankId === 'amhara') rates = parseAmharaBankHtml(html, syncedAt);
    else if (bank.bankId === 'nib') rates = parseNibBankHtml(html, syncedAt);
    else if (bank.bankId === 'berhan') rates = parseBerhanBankHtml(html, syncedAt);
    else if (bank.bankId === 'enat') rates = parseEnatBankHtml(html, syncedAt);
    else if (bank.bankId === 'abay') rates = parseAbayBankHtml(html, syncedAt);
    else if (bank.bankId === 'siinqee') rates = parseSiinqeeBankHtml(html, syncedAt);
    else if (bank.bankId === 'zamzam') rates = parseZamZamBankHtml(html, syncedAt);
    else if (bank.bankId === 'global') rates = parseGlobalBankHtml(html, syncedAt);
    else if (bank.bankId === 'tsedey') rates = parseTsedeyBankHtml(html, syncedAt);

    if (rates.length === 0) {
      throw new Error('Parsed 0 valid FX rows from official HTML page.');
    }

    return {
      rates,
      failed: false,
      status: {
        bankId: bank.bankId,
        bankName: bank.bankName,
        bankShortName: bank.bankShortName,
        isCentralBank: false,
        officialWebsite: bank.officialWebsite,
        fxPageUrl: bank.fxPageUrl,
        method: bank.method,
        status: rates[0]?.verificationStatus === 'Stale' ? 'Stale' : 'Verified',
        currenciesCollected: rates.length,
        publishedDate: rates[0]?.publishedDate || null,
        lastCheckedAt: syncedAt,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unable to reach official bank FX feed.';
    recordError(`fx-${bank.bankId}`, bank.bankName, 'fx', msg);
    return {
      rates: [],
      failed: true,
      status: {
        bankId: bank.bankId,
        bankName: bank.bankName,
        bankShortName: bank.bankShortName,
        isCentralBank: bank.isCentralBank,
        officialWebsite: bank.officialWebsite,
        fxPageUrl: bank.fxPageUrl,
        method: bank.method,
        status: 'Collection failed',
        currenciesCollected: 0,
        publishedDate: null,
        lastCheckedAt: syncedAt,
        errorMessage: msg,
      },
    };
  }
}

async function collectAllBankFx(forceRefresh: boolean): Promise<BankFxApiResponse> {
  const now = Date.now();
  if (!forceRefresh && store.fxRates.length > 0 && store.fxExpiresAt > now && store.fxSyncedAt) {
    return {
      rates: store.fxRates,
      history: store.fxHistory,
      bankStatuses: store.fxBankStatuses,
      nbeIndicativeMid: store.nbeIndicativeMid,
      syncedAt: store.fxSyncedAt,
      cached: true,
    };
  }
  if (inFlightFxSync) return inFlightFxSync;

  inFlightFxSync = (async () => {
    const startedMs = Date.now();
    const syncedAt = new Date().toISOString();

    const activeCatalog = ETHIOPIAN_BANKS_CATALOG;
    const settled = await Promise.all(activeCatalog.map((bank) => fetchSingleBankFx(bank, syncedAt)));

    const incomingRates: BankFxRateRecord[] = [];
    const bankStatuses: BankFxSourceStatus[] = [];
    const failedBankIds = new Set<string>();
    let nbeMid = store.nbeIndicativeMid;

    for (const entry of settled) {
      bankStatuses.push(entry.status);
      if (entry.failed) failedBankIds.add(entry.status.bankId);
      if (entry.indicativeMid) nbeMid = entry.indicativeMid;
      incomingRates.push(...entry.rates);
    }

    const merged = mergeBankRatesWithHistory({
      previousRates: store.fxRates,
      previousHistory: store.fxHistory,
      incomingRates,
      failedBankIds,
    });

    store.fxRates = merged.rates;
    store.fxHistory = merged.history;
    store.fxBankStatuses = bankStatuses;
    store.nbeIndicativeMid = nbeMid;
    store.fxSyncedAt = syncedAt;
    store.fxExpiresAt = Date.now() + CACHE_TTL_MS;
    store.anomaliesCount = merged.anomaliesCount;

    const failedRuns = bankStatuses.filter((b) => b.status === 'Collection failed').length;
    const fxRun: CollectionRunEntry = {
      id: `run-fx-${Date.now()}`,
      startedAt: syncedAt,
      completedAt: new Date().toISOString(),
      scope: 'fx',
      itemsCollected: incomingRates.length,
      duplicatesSkipped: 0,
      failedSources: failedRuns,
      durationMs: Date.now() - startedMs,
      status: incomingRates.length === 0 ? 'failed' : failedRuns > 0 ? 'partial' : 'success',
    };
    store.collectionRuns = [fxRun, ...store.collectionRuns].slice(0, 50);

    savePersistedStore(store);

    return {
      rates: store.fxRates,
      history: store.fxHistory,
      bankStatuses,
      nbeIndicativeMid: nbeMid,
      syncedAt,
      cached: false,
    };
  })();

  try {
    return await inFlightFxSync;
  } finally {
    inFlightFxSync = null;
  }
}

// ---------- Opportunities Aggregator ----------

async function fetchSingleOpportunitySource(
  src: AggregationSourceRecord,
  syncedAt: string
): Promise<{
  items: AggregatedOpportunity[];
  updatedSource: AggregationSourceRecord;
}> {
  if (!src.active) {
    return {
      items: [],
      updatedSource: { ...src, status: 'Paused' },
    };
  }

  const safety = isSafePublicHttpUrl(src.feedUrl);
  if (!safety.valid) {
    const errMsg = safety.error || 'Unsafe URL blocked by SSRF policy.';
    recordError(src.id, src.name, src.module, errMsg);
    return {
      items: [],
      updatedSource: {
        ...src,
        status: 'Collection failed',
        fetchedCount: 0,
        lastAttemptAt: syncedAt,
        lastError: errMsg,
      },
    };
  }

  try {
    const acceptHeader =
      src.method === 'wp_rest_json'
        ? 'application/json'
        : 'text/html,application/xml,application/rss+xml,*/*';
    const res = await fetchWithRetry(src.feedUrl, {
      headers: { ...BROWSER_HEADERS, accept: acceptHeader },
      timeoutMs: 10000,
      retries: 1,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const oppSourceMeta = {
      id: src.id,
      name: src.name,
      domain: src.domain,
      module: (src.module === 'jobs' || src.module === 'fx'
        ? 'public_announcements'
        : src.module) as OpportunityModuleType,
    };

    let items: AggregatedOpportunity[] = [];
    if (src.method === 'inertia_json') {
      const html = await res.text();
      items = parse2MerkatoTendersHtml(html, syncedAt);
    } else if (src.method === 'wp_rest_json') {
      const posts = (await res.json()) as WordPressPostRaw[];
      items = parseWordPressPostsToOpportunities(posts, oppSourceMeta, syncedAt);
    } else if (src.method === 'rss_xml' || src.method === 'rss_atom') {
      const xml = await res.text();
      items = parseGenericRssOrAtomXml(xml, oppSourceMeta, syncedAt);
    }

    return {
      items,
      updatedSource: {
        ...src,
        status: items.length > 0 ? 'Verified' : 'Stale',
        fetchedCount: items.length,
        lastAttemptAt: syncedAt,
        lastSuccessAt: items.length > 0 ? syncedAt : src.lastSuccessAt,
        lastError: items.length === 0 ? 'Feed returned 0 items matching criteria' : undefined,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unable to reach source endpoint.';
    recordError(src.id, src.name, src.module, msg);
    return {
      items: [],
      updatedSource: {
        ...src,
        status: 'Collection failed',
        fetchedCount: 0,
        lastAttemptAt: syncedAt,
        lastError: msg,
      },
    };
  }
}

async function collectAllOpportunities(forceRefresh: boolean): Promise<OpportunitiesApiResponse> {
  const now = Date.now();
  if (
    !forceRefresh &&
    store.opportunities.length > 0 &&
    store.opportunitiesExpiresAt > now &&
    store.opportunitiesSyncedAt
  ) {
    return {
      items: store.opportunities,
      sources: store.opportunitySources,
      collectionRuns: store.collectionRuns,
      collectionErrors: store.collectionErrors,
      syncedAt: store.opportunitiesSyncedAt,
      cached: true,
    };
  }
  if (inFlightOppSync) return inFlightOppSync;

  inFlightOppSync = (async () => {
    const startedMs = Date.now();
    const syncedAt = new Date().toISOString();

    const settled = await Promise.all(
      store.opportunitySources.map((src) => fetchSingleOpportunitySource(src, syncedAt))
    );

    const updatedSources: AggregationSourceRecord[] = [];
    const rawItems: AggregatedOpportunity[] = [];
    const failedSourceIds = new Set<string>();

    for (const s of settled) {
      updatedSources.push(s.updatedSource);
      rawItems.push(...s.items);
      if (s.updatedSource.status === 'Collection failed') {
        failedSourceIds.add(s.updatedSource.id);
      }
    }

    const previousById = new Map<string, AggregatedOpportunity>(
      store.opportunities.map((o) => [o.id, o])
    );

    const mergedRaw: AggregatedOpportunity[] = rawItems.map((item) => {
      const prev = previousById.get(item.id);
      if (prev?.manuallyVerified) {
        return {
          ...prev,
          lastVerifiedAt: item.lastVerifiedAt,
        };
      }
      return item;
    });

    for (const prev of store.opportunities) {
      if (failedSourceIds.has(prev.sourceId) && !mergedRaw.some((m) => m.id === prev.id)) {
        mergedRaw.push({
          ...prev,
          verificationStatus: prev.isExpired ? 'Expired' : 'Stale',
        });
      }
    }

    const { deduplicated, duplicatesDetected } = deduplicateOpportunities(mergedRaw);
    deduplicated.sort((a, b) => {
      const ta = new Date(a.publishedAt || a.collectedAt).getTime();
      const tb = new Date(b.publishedAt || b.collectedAt).getTime();
      return tb - ta;
    });

    store.opportunities = deduplicated;
    store.opportunitySources = updatedSources;
    store.opportunitiesSyncedAt = syncedAt;
    store.opportunitiesExpiresAt = Date.now() + CACHE_TTL_MS;
    store.duplicatesDetected = duplicatesDetected;

    const failedCount = failedSourceIds.size;
    const oppRun: CollectionRunEntry = {
      id: `run-opp-${Date.now()}`,
      startedAt: syncedAt,
      completedAt: new Date().toISOString(),
      scope: 'opportunities',
      itemsCollected: deduplicated.length,
      duplicatesSkipped: duplicatesDetected,
      failedSources: failedCount,
      durationMs: Date.now() - startedMs,
      status: deduplicated.length === 0 ? 'failed' : failedCount > 0 ? 'partial' : 'success',
    };
    store.collectionRuns = [oppRun, ...store.collectionRuns].slice(0, 50);

    savePersistedStore(store);

    return {
      items: deduplicated,
      sources: updatedSources,
      collectionRuns: store.collectionRuns,
      collectionErrors: store.collectionErrors,
      syncedAt,
      cached: false,
    };
  })();

  try {
    return await inFlightOppSync;
  } finally {
    inFlightOppSync = null;
  }
}

// ---------- Top News Aggregator (10 Global, Africa & Ethiopia Outlets) ----------

async function fetchNewsFeedCandidate(
  def: TopNewsSourceDefinition,
  feedUrl: string,
  method: TopNewsSourceDefinition['method'],
  syncedAt: string
): Promise<{ articles: NewsArticleRecord[]; error?: string }> {
  const acceptHeader =
    method === 'wp_rest_json'
      ? 'application/json'
      : 'application/rss+xml, application/xml, text/xml, */*';

  if (method === 'wp_rest_json') {
    const res = await fetchJsonImmediate<NewsWordPressPostRaw[]>(feedUrl, {
      headers: { ...BROWSER_HEADERS, accept: acceptHeader },
      timeoutMs: 10000,
      retries: 1,
    });
    if (!res.ok) {
      return { articles: [], error: res.error };
    }
    return { articles: parseWordPressNewsPosts(res.data, def, syncedAt, 10) };
  }

  const res = await fetchTextImmediate(feedUrl, {
    headers: { ...BROWSER_HEADERS, accept: acceptHeader },
    timeoutMs: 10000,
    retries: 1,
  });
  if (!res.ok) {
    return { articles: [], error: res.error };
  }
  const effectiveDef: TopNewsSourceDefinition = { ...def, method };
  return { articles: parseNewsRssXml(res.text, effectiveDef, syncedAt, 10) };
}

async function fetchSingleNewsSource(
  def: TopNewsSourceDefinition,
  syncedAt: string,
  staggerIndex: number = 0
): Promise<{
  articles: NewsArticleRecord[];
  status: NewsSourceStatus;
  failed: boolean;
}> {
  try {
    if (def.method === 'news_index_rss' && staggerIndex > 0) {
      await new Promise((r) => setTimeout(r, staggerIndex * 110));
    }

    let usedMethod = def.method;
    let usedUrl = def.feedUrl;
    let attempt = await fetchNewsFeedCandidate(def, def.feedUrl, def.method, syncedAt);

    if (attempt.articles.length === 0 && def.fallbackFeedUrl) {
      const fbMethod = def.fallbackMethod || 'news_index_rss';
      const fallbackAttempt = await fetchNewsFeedCandidate(
        def,
        def.fallbackFeedUrl,
        fbMethod,
        syncedAt
      );
      if (fallbackAttempt.articles.length > 0) {
        attempt = fallbackAttempt;
        usedMethod = fbMethod;
        usedUrl = def.fallbackFeedUrl;
      } else if (!attempt.error && fallbackAttempt.error) {
        attempt.error = fallbackAttempt.error;
      }
    }

    const { articles } = attempt;
    const errMsg = articles.length === 0 ? attempt.error || 'Feed returned 0 articles.' : undefined;
    if (articles.length === 0 && errMsg) {
      recordError(`news-${def.id}`, def.name, 'news', errMsg);
    }

    return {
      articles,
      failed: articles.length === 0,
      status: {
        id: def.id,
        name: def.name,
        domain: def.domain,
        homeUrl: def.homeUrl,
        feedUrl: usedUrl,
        coverage: def.coverage,
        language: def.language,
        method: usedMethod,
        status: articles.length > 0 ? 'Verified' : errMsg?.startsWith('HTTP') || errMsg ? 'Collection failed' : 'Stale',
        articlesCollected: articles.length,
        lastAttemptAt: syncedAt,
        lastSuccessAt: articles.length > 0 ? syncedAt : null,
        errorMessage: errMsg,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : `Unable to reach ${def.domain}`;
    recordError(`news-${def.id}`, def.name, 'news', msg);
    return {
      articles: [],
      failed: true,
      status: {
        id: def.id,
        name: def.name,
        domain: def.domain,
        homeUrl: def.homeUrl,
        feedUrl: def.feedUrl,
        coverage: def.coverage,
        language: def.language,
        method: def.method,
        status: 'Collection failed',
        articlesCollected: 0,
        lastAttemptAt: syncedAt,
        lastSuccessAt: null,
        errorMessage: msg,
      },
    };
  }
}

async function collectAllTopNews(forceRefresh: boolean): Promise<NewsApiResponse> {
  const now = Date.now();
  if (
    !forceRefresh &&
    store.newsArticles.length > 0 &&
    store.newsExpiresAt > now &&
    store.newsSyncedAt
  ) {
    return {
      articles: store.newsArticles,
      sources: store.newsSources,
      syncedAt: store.newsSyncedAt,
      cached: true,
    };
  }
  if (inFlightNewsSync) return inFlightNewsSync;

  inFlightNewsSync = (async () => {
    const startedMs = Date.now();
    const syncedAt = new Date().toISOString();

    const settled = await Promise.all(
      TOP_NEWS_SOURCES.map((src, idx) => fetchSingleNewsSource(src, syncedAt, idx))
    );

    const prevByPublisher = new Map<string, NewsArticleRecord[]>();
    for (const art of store.newsArticles) {
      const list = prevByPublisher.get(art.publisherId) || [];
      list.push(art);
      prevByPublisher.set(art.publisherId, list);
    }

    const combined: NewsArticleRecord[] = [];
    const statuses: NewsSourceStatus[] = [];
    let failedCount = 0;

    for (const s of settled) {
      statuses.push(s.status);
      if (s.articles.length > 0) {
        combined.push(...s.articles);
      } else {
        failedCount++;
        const cachedForPub = (prevByPublisher.get(s.status.id) || []).map((a) => ({
          ...a,
          verificationStatus: 'Stale' as const,
        }));
        combined.push(...cachedForPub);
      }
    }

    const deduplicated = deduplicateAndSortNews(combined);
    store.newsArticles = deduplicated;
    store.newsSources = statuses;
    store.newsSyncedAt = syncedAt;
    store.newsExpiresAt = Date.now() + CACHE_TTL_MS;

    const newsRun: CollectionRunEntry = {
      id: `run-news-${Date.now()}`,
      startedAt: syncedAt,
      completedAt: new Date().toISOString(),
      scope: 'news',
      itemsCollected: deduplicated.length,
      duplicatesSkipped: Math.max(0, combined.length - deduplicated.length),
      failedSources: failedCount,
      durationMs: Date.now() - startedMs,
      status: deduplicated.length === 0 ? 'failed' : failedCount > 0 ? 'partial' : 'success',
    };
    store.collectionRuns = [newsRun, ...store.collectionRuns].slice(0, 50);

    savePersistedStore(store);

    return {
      articles: deduplicated,
      sources: statuses,
      syncedAt,
      cached: false,
    };
  })();

  try {
    return await inFlightNewsSync;
  } finally {
    inFlightNewsSync = null;
  }
}

// ---------- Ethiopian Capital Market (ESX / ECMA / Daily Share Sales) Collector ----------

async function collectCapitalMarketActivity(
  forceRefresh: boolean
): Promise<CapitalMarketApiResponse> {
  const now = Date.now();
  if (!forceRefresh && store.capitalMarket && store.capitalMarketExpiresAt > now) {
    return {
      ...store.capitalMarket,
      cached: true,
    };
  }
  if (inFlightCapitalSync) return inFlightCapitalSync;

  inFlightCapitalSync = (async () => {
    const startedMs = Date.now();
    const syncedAt = new Date().toISOString();

    type WpPostLite = {
      id: number | string;
      date?: string;
      link?: string;
      title?: { rendered?: string };
      excerpt?: { rendered?: string };
    };

    const [
      esxListedRes,
      stockMarketRes,
      esxInterbankRes,
      esxTBillsRes,
      esxPostsRes,
      smPostsRes,
      ecmaRes,
    ] = await Promise.all([
      fetchTextImmediate('https://esx.et/equity-market/listed-companies/', {
        headers: BROWSER_HEADERS,
        timeoutMs: 12000,
      }),
      fetchTextImmediate('https://www.stockmarket.et/stock-market-data/', {
        headers: BROWSER_HEADERS,
        timeoutMs: 12000,
      }),
      fetchTextImmediate('https://esx.et/fixed-income-market/data/', {
        headers: BROWSER_HEADERS,
        timeoutMs: 12000,
      }),
      fetchTextImmediate('https://esx.et/fixed-income-market/listed-instruments/', {
        headers: BROWSER_HEADERS,
        timeoutMs: 12000,
      }),
      fetchJsonImmediate<WpPostLite[]>('https://esx.et/wp-json/wp/v2/posts?per_page=8', {
        headers: { ...BROWSER_HEADERS, accept: 'application/json' },
        timeoutMs: 10000,
      }),
      fetchJsonImmediate<WpPostLite[]>('https://www.stockmarket.et/wp-json/wp/v2/posts?per_page=6', {
        headers: { ...BROWSER_HEADERS, accept: 'application/json' },
        timeoutMs: 10000,
      }),
      fetchTextImmediate('https://ecma.gov.et/', {
        headers: BROWSER_HEADERS,
        timeoutMs: 9000,
        retries: 0,
      }),
    ]);

    let listedCompanies = [] as ReturnType<typeof parseEsxListedCompaniesHtml>;
    let esxListedError: string | undefined;
    if (esxListedRes.ok) {
      listedCompanies = parseEsxListedCompaniesHtml(esxListedRes.text);
    } else {
      esxListedError = esxListedRes.error || 'Unable to reach esx.et';
      recordError('cm-esx-listed', 'ESX Listed Companies', 'capital_market', esxListedError);
    }

    // Fetch individual ESX issuer profiles for Listed Shares & Listed Capital
    const profilesBySymbol = new Map<string, EsxCompanyProfileStats>();
    if (listedCompanies.length > 0) {
      const profileResults = await Promise.all(
        listedCompanies.map(async (c) => {
          const r = await fetchTextImmediate(c.esxProfileUrl, {
            headers: BROWSER_HEADERS,
            timeoutMs: 8500,
            retries: 0,
          });
          if (!r.ok) return null;
          return parseEsxCompanyDirectoryProfile(r.text, c.esxProfileUrl);
        })
      );
      for (const profile of profileResults) {
        if (profile) {
          profilesBySymbol.set(profile.symbol, profile);
        }
      }
    }

    let seriesBySymbol = new Map<string, StockMarketEtSeries>();
    let smError: string | undefined;
    if (stockMarketRes.ok) {
      const parsedSeries = parseStockMarketEtHistoriesHtml(stockMarketRes.text);
      seriesBySymbol = new Map(parsedSeries.map((s) => [s.symbol, s]));
    } else {
      smError = stockMarketRes.error || 'Unable to reach stockmarket.et';
      recordError('cm-stockmarket-et', 'StockMarket.et ESX Feed', 'capital_market', smError);
    }

    let interbankTrades = [] as ReturnType<typeof parseEsxInterbankDataHtml>;
    let fixedIncomeError: string | undefined;
    if (esxInterbankRes.ok) {
      interbankTrades = parseEsxInterbankDataHtml(esxInterbankRes.text);
    } else {
      fixedIncomeError = esxInterbankRes.error || 'Unable to reach esx.et fixed income';
    }

    let tBills = [] as ReturnType<typeof parseEsxListedTBillsHtml>;
    if (esxTBillsRes.ok) {
      tBills = parseEsxListedTBillsHtml(esxTBillsRes.text);
    }

    const announcements: CapitalMarketAnnouncement[] = [];
    if (esxPostsRes.ok && Array.isArray(esxPostsRes.data)) {
      announcements.push(
        ...parseEsxAnnouncementsWpPosts(
          esxPostsRes.data,
          'Ethiopian Securities Exchange (ESX)',
          'Official Release'
        )
      );
    }
    if (smPostsRes.ok && Array.isArray(smPostsRes.data)) {
      announcements.push(
        ...parseEsxAnnouncementsWpPosts(
          smPostsRes.data,
          'StockMarket.et',
          'Market Commentary'
        )
      );
    }
    announcements.sort((a, b) => {
      const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return tb - ta;
    });

    const ecmaOk = ecmaRes.ok;
    const { equities, summary } = buildCapitalMarketEquitiesAndSummary({
      listedCompanies,
      profilesBySymbol,
      seriesBySymbol,
      interbankTrades,
      syncedAt,
    });

    const sources: CapitalMarketSourceStatus[] = [
      {
        ...CAPITAL_MARKET_SOURCES_META[0],
        status: listedCompanies.length > 0 ? 'Verified' : 'Collection failed',
        recordsCollected: listedCompanies.length,
        lastCheckedAt: syncedAt,
        errorMessage: esxListedError,
      },
      {
        ...CAPITAL_MARKET_SOURCES_META[1],
        status: seriesBySymbol.size > 0 ? 'Verified' : 'Collection failed',
        recordsCollected: seriesBySymbol.size,
        lastCheckedAt: syncedAt,
        errorMessage: smError,
      },
      {
        ...CAPITAL_MARKET_SOURCES_META[2],
        status:
          interbankTrades.length > 0 || tBills.length > 0
            ? 'Verified'
            : fixedIncomeError
            ? 'Collection failed'
            : 'Stale',
        recordsCollected: interbankTrades.length + tBills.length,
        lastCheckedAt: syncedAt,
        errorMessage: fixedIncomeError,
      },
      {
        ...CAPITAL_MARKET_SOURCES_META[3],
        status: ecmaOk ? 'Verified' : 'Source unavailable',
        recordsCollected: ecmaOk ? 1 : 0,
        lastCheckedAt: syncedAt,
        errorMessage: ecmaOk
          ? undefined
          : 'ECMA WordPress REST API requires authorization; regulator home portal monitored.',
      },
    ];

    const prev = store.capitalMarket;
    const hasFreshData = equities.length > 0 || interbankTrades.length > 0 || tBills.length > 0;
    const finalPayload: CapitalMarketApiResponse = hasFreshData
      ? {
          equities,
          interbankTrades,
          tBills,
          announcements,
          sources,
          summary,
          syncedAt,
          cached: false,
        }
      : prev
      ? {
          ...prev,
          sources,
          syncedAt,
          cached: false,
        }
      : {
          equities: [],
          interbankTrades: [],
          tBills: [],
          announcements,
          sources,
          summary,
          syncedAt,
          cached: false,
        };

    store.capitalMarket = finalPayload;
    store.capitalMarketExpiresAt = Date.now() + CACHE_TTL_MS;

    const failedSources = sources.filter((s) => s.status === 'Collection failed').length;
    const cmRun: CollectionRunEntry = {
      id: `run-cm-${Date.now()}`,
      startedAt: syncedAt,
      completedAt: new Date().toISOString(),
      scope: 'capital_market',
      itemsCollected:
        finalPayload.equities.length +
        finalPayload.interbankTrades.length +
        finalPayload.tBills.length,
      duplicatesSkipped: 0,
      failedSources,
      durationMs: Date.now() - startedMs,
      status: !hasFreshData ? 'failed' : failedSources > 0 ? 'partial' : 'success',
    };
    store.collectionRuns = [cmRun, ...store.collectionRuns].slice(0, 50);

    savePersistedStore(store);
    return finalPayload;
  })();

  try {
    return await inFlightCapitalSync;
  } finally {
    inFlightCapitalSync = null;
  }
}

function buildOverviewResponse(): AggregatorOverviewResponse {
  const countsByModule: Record<string, number> = {};
  for (const opp of store.opportunities) {
    countsByModule[opp.module] = (countsByModule[opp.module] || 0) + 1;
  }
  const expiredCount = store.opportunities.filter((o) => o.isExpired).length;

  return {
    jobSources: store.jobSources,
    fxBankStatuses: store.fxBankStatuses,
    opportunitySources: store.opportunitySources,
    newsSources: store.newsSources,
    capitalMarketSources: store.capitalMarket?.sources || [],
    collectionRuns: store.collectionRuns,
    collectionErrors: store.collectionErrors,
    countsByModule,
    totalCollectedListings:
      store.jobs.length +
      store.opportunities.length +
      store.fxRates.length +
      store.newsArticles.length +
      (store.capitalMarket?.equities.length || 0),
    duplicatesDetected: store.duplicatesDetected,
    expiredCount,
    anomaliesCount: store.anomaliesCount,
    lastFullSyncAt:
      store.opportunitiesSyncedAt ||
      store.newsSyncedAt ||
      store.capitalMarket?.syncedAt ||
      store.fxSyncedAt ||
      store.jobsSyncedAt,
    aiUsage: store.aiUsage,
  };
}

export async function runFullBackgroundSync(forceRefresh: boolean = true): Promise<void> {
  if (isFullSyncRunning) return;
  isFullSyncRunning = true;
  try {
    await Promise.allSettled([
      collectAllExternalJobs(forceRefresh),
      collectAllBankFx(forceRefresh),
      collectAllOpportunities(forceRefresh),
      collectAllTopNews(forceRefresh),
      collectCapitalMarketActivity(forceRefresh),
    ]);
  } finally {
    isFullSyncRunning = false;
  }
}

export function createTatariApp(): express.Express {
  const app = express();
  app.use(express.json({ limit: '8mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'tatari-opportunity-platform',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/external-jobs/sources', (_req, res) => {
    res.json({
      sources: EXTERNAL_JOB_SOURCES.map((s) => ({
        id: s.id,
        name: s.name,
        domain: s.domain,
        homeUrl: s.homeUrl,
      })),
    });
  });

  app.get('/api/external-jobs', async (req, res) => {
    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
    try {
      const payload = await collectAllExternalJobs(forceRefresh);
      res.json(payload);
    } catch (err) {
      res.status(500).json({
        jobs: [],
        sources: [],
        syncedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : 'Failed to collect external Ethiopian jobs.',
      });
    }
  });

  app.get('/api/fx-rates', async (req, res) => {
    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
    try {
      const payload = await collectAllBankFx(forceRefresh);
      res.json(payload);
    } catch (err) {
      res.status(500).json({
        rates: [],
        history: [],
        bankStatuses: [],
        nbeIndicativeMid: null,
        syncedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : 'Failed to collect Ethiopian bank FX rates.',
      });
    }
  });

  app.get('/api/opportunities', async (req, res) => {
    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const moduleFilter = typeof req.query.module === 'string' ? req.query.module : 'all';
    try {
      const payload = await collectAllOpportunities(forceRefresh);
      const items =
        moduleFilter !== 'all'
          ? payload.items.filter((i) => i.module === moduleFilter)
          : payload.items;
      res.json({
        ...payload,
        items,
      });
    } catch (err) {
      res.status(500).json({
        items: [],
        sources: store.opportunitySources,
        collectionRuns: store.collectionRuns,
        collectionErrors: store.collectionErrors,
        syncedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : 'Failed to collect opportunities.',
      });
    }
  });

  app.get('/api/news', async (req, res) => {
    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const coverageFilter = typeof req.query.coverage === 'string' ? req.query.coverage : 'all';
    const publisherFilter = typeof req.query.publisher === 'string' ? req.query.publisher : 'all';
    try {
      const payload = await collectAllTopNews(forceRefresh);
      let articles = payload.articles;
      if (coverageFilter !== 'all') {
        articles = articles.filter((a) => a.coverage === coverageFilter);
      }
      if (publisherFilter !== 'all') {
        articles = articles.filter((a) => a.publisherId === publisherFilter);
      }
      res.json({
        ...payload,
        articles,
      });
    } catch (err) {
      res.status(500).json({
        articles: [],
        sources: store.newsSources,
        syncedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : 'Failed to collect top news headlines.',
      });
    }
  });

  app.get('/api/capital-market', async (req, res) => {
    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
    try {
      const payload = await collectCapitalMarketActivity(forceRefresh);
      res.json(payload);
    } catch (err) {
      res.status(500).json({
        equities: [],
        interbankTrades: [],
        tBills: [],
        announcements: [],
        sources: [],
        summary: {
          listedCompaniesCount: 0,
          pricedEquitiesCount: 0,
          totalListedShares: 0,
          totalImpliedMarketCapEtb: 0,
          latestSessionDate: null,
          advancersCount: 0,
          declinersCount: 0,
          unchangedCount: 0,
          topGainerSymbol: null,
          topGainerPct: null,
          latestInterbankVolumeEtb: null,
          latestInterbankTradesCount: null,
          latestInterbankWeek: null,
          marketSessionState: 'Feed unavailable',
        },
        syncedAt: new Date().toISOString(),
        error:
          err instanceof Error
            ? err.message
            : 'Failed to collect Ethiopian Capital Market data.',
      });
    }
  });

  const requireAdminBearer: express.RequestHandler = (req, res, next) => {
    const token = extractBearerToken(req.headers.authorization);
    const verified = verifyAdminSessionToken(token, SESSION_SIGNING_SECRET);
    if (!verified) {
      res.status(401).json({
        error: 'Administrator authentication required.',
      });
      return;
    }
    (req as express.Request & { adminEmail?: string }).adminEmail = verified.email;
    next();
  };

  app.post('/api/auth/admin-session', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const expectedHash = adminPasswordHashes.get(email);
    if (!expectedHash || hashUserPassword(email, password) !== expectedHash) {
      res.status(401).json({ error: 'Invalid Administrator credentials.' });
      return;
    }
    const session = createAdminSessionToken(email, SESSION_SIGNING_SECRET);
    res.json({
      ok: true,
      email,
      token: session.token,
      expiresAt: session.expiresAt,
    });
  });

  app.patch('/api/auth/admin-password', requireAdminBearer, (req, res) => {
    const adminEmail = (req as express.Request & { adminEmail?: string }).adminEmail || '';
    const targetEmail = String(req.body?.email || adminEmail).trim().toLowerCase();
    const newPassword = String(req.body?.newPassword || '');
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      res.status(400).json({ error: 'Password must be at least 8 characters with letter & number.' });
      return;
    }
    adminPasswordHashes.set(targetEmail, hashUserPassword(targetEmail, newPassword));
    res.json({ ok: true });
  });

  app.get('/api/aggregator/overview', requireAdminBearer, (_req, res) => {
    res.json(buildOverviewResponse());
  });

  app.post('/api/aggregator/sync', requireAdminBearer, async (req, res) => {
    const scope = String(req.body?.scope || 'all');
    const sourceId = typeof req.body?.sourceId === 'string' ? req.body.sourceId : undefined;
    try {
      if (scope === 'jobs') {
        await collectAllExternalJobs(true);
      } else if (scope === 'fx') {
        await collectAllBankFx(true);
      } else if (scope === 'opportunities') {
        await collectAllOpportunities(true);
      } else if (scope === 'news') {
        await collectAllTopNews(true);
      } else if (scope === 'capital_market') {
        await collectCapitalMarketActivity(true);
      } else if (scope === 'single' && sourceId) {
        const target = store.opportunitySources.find((s) => s.id === sourceId);
        if (!target) {
          res.status(404).json({ error: 'Source ID not found.' });
          return;
        }
        const syncedAt = new Date().toISOString();
        const result = await fetchSingleOpportunitySource(target, syncedAt);
        store.opportunitySources = store.opportunitySources.map((s) =>
          s.id === sourceId ? result.updatedSource : s
        );
        if (result.items.length > 0) {
          const withoutSource = store.opportunities.filter((o) => o.sourceId !== sourceId);
          const { deduplicated, duplicatesDetected } = deduplicateOpportunities([
            ...result.items,
            ...withoutSource,
          ]);
          store.opportunities = deduplicated;
          store.duplicatesDetected = duplicatesDetected;
          store.opportunitiesSyncedAt = syncedAt;
        }
        savePersistedStore(store);
      } else {
        await runFullBackgroundSync(true);
      }

      res.json({
        ok: true,
        overview: buildOverviewResponse(),
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Sync failed.',
      });
    }
  });

  app.post('/api/aggregator/sources', requireAdminBearer, async (req, res) => {
    const name = String(req.body?.name || '').trim();
    const url = String(req.body?.url || '').trim();
    const feedUrl = String(req.body?.feedUrl || url).trim();
    const module = String(req.body?.module || 'public_announcements') as OpportunityModuleType;
    const method = (req.body?.method === 'wp_rest_json' ? 'wp_rest_json' : 'rss_xml') as
      | 'wp_rest_json'
      | 'rss_xml';
    const frequencyLabel = String(req.body?.frequencyLabel || 'Every 1h').trim();

    if (name.length < 3) {
      res.status(400).json({ error: 'Source name must be at least 3 characters.' });
      return;
    }

    const urlCheck = isSafePublicHttpUrl(url);
    const feedCheck = isSafePublicHttpUrl(feedUrl);
    if (!urlCheck.valid || !feedCheck.valid || !feedCheck.normalized || !urlCheck.normalized) {
      res.status(400).json({
        error: feedCheck.error || urlCheck.error || 'Invalid or unsafe source URL.',
      });
      return;
    }

    const parsedFeedUrl = new URL(feedCheck.normalized);
    const newSource: AggregationSourceRecord = {
      id: `src-custom-${Date.now()}`,
      name,
      domain: parsedFeedUrl.hostname,
      url: urlCheck.normalized,
      feedUrl: feedCheck.normalized,
      module,
      method,
      active: true,
      frequencyLabel,
      status: 'Unverified',
      fetchedCount: 0,
      lastAttemptAt: null,
      lastSuccessAt: null,
      termsNote: 'Administrator-configured custom feed',
      isCustom: true,
    };

    const syncedAt = new Date().toISOString();
    const testResult = await fetchSingleOpportunitySource(newSource, syncedAt);
    store.opportunitySources = [testResult.updatedSource, ...store.opportunitySources];
    if (testResult.items.length > 0) {
      const { deduplicated, duplicatesDetected } = deduplicateOpportunities([
        ...testResult.items,
        ...store.opportunities,
      ]);
      store.opportunities = deduplicated;
      store.duplicatesDetected = duplicatesDetected;
    }
    savePersistedStore(store);

    res.status(201).json({
      source: testResult.updatedSource,
      itemsAdded: testResult.items.length,
      overview: buildOverviewResponse(),
    });
  });

  app.patch('/api/aggregator/sources/:id', requireAdminBearer, (req, res) => {
    const id = req.params.id;
    const target = store.opportunitySources.find((s) => s.id === id);
    if (!target) {
      res.status(404).json({ error: 'Source not found.' });
      return;
    }

    const active = typeof req.body?.active === 'boolean' ? req.body.active : target.active;
    const frequencyLabel =
      typeof req.body?.frequencyLabel === 'string' && req.body.frequencyLabel.trim()
        ? req.body.frequencyLabel.trim()
        : target.frequencyLabel;

    store.opportunitySources = store.opportunitySources.map((s) =>
      s.id === id
        ? {
            ...s,
            active,
            frequencyLabel,
            status: !active ? 'Paused' : s.status === 'Paused' ? 'Unverified' : s.status,
          }
        : s
    );
    savePersistedStore(store);
    res.json({ ok: true, overview: buildOverviewResponse() });
  });

  app.patch('/api/aggregator/listings/:id/verify', requireAdminBearer, (req, res) => {
    const id = req.params.id;
    const idx = store.opportunities.findIndex((o) => o.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Aggregated listing not found.' });
      return;
    }

    const current = store.opportunities[idx];
    const originalValues = current.originalValues || {
      title: current.title,
      organization: current.organization,
      deadline: current.deadline,
    };

    const next: AggregatedOpportunity = {
      ...current,
      title:
        typeof req.body?.title === 'string' && req.body.title.trim()
          ? req.body.title.trim()
          : current.title,
      organization:
        typeof req.body?.organization === 'string' && req.body.organization.trim()
          ? req.body.organization.trim()
          : current.organization,
      deadline:
        typeof req.body?.deadline === 'string' && req.body.deadline.trim()
          ? req.body.deadline.trim()
          : current.deadline,
      verificationStatus: req.body?.verificationStatus || 'Verified',
      manuallyVerified: true,
      lastVerifiedAt: new Date().toISOString(),
      originalValues,
    };

    store.opportunities[idx] = next;
    savePersistedStore(store);
    res.json({ ok: true, item: next });
  });

  app.patch('/api/aggregator/fx/:id/review', requireAdminBearer, (req, res) => {
    const id = req.params.id;
    const idx = store.fxRates.findIndex((r) => r.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'FX rate record not found.' });
      return;
    }
    const current = store.fxRates[idx];
    const buy =
      req.body?.buyingRate !== undefined && Number(req.body.buyingRate) > 0
        ? Number(req.body.buyingRate)
        : current.buyingRate;
    const sell =
      req.body?.sellingRate !== undefined && Number(req.body.sellingRate) > 0
        ? Number(req.body.sellingRate)
        : current.sellingRate;

    const updated: BankFxRateRecord = {
      ...current,
      buyingRate: buy,
      sellingRate: sell,
      midRate:
        buy !== null && sell !== null ? Number(((buy + sell) / 2).toFixed(4)) : current.midRate,
      spreadPct:
        buy !== null && sell !== null && buy > 0 && sell >= buy
          ? Number((((sell - buy) / buy) * 100).toFixed(2))
          : current.spreadPct,
      anomalyFlagged: false,
      anomalyReason: undefined,
      manuallyCorrected:
        buy !== current.buyingRate || sell !== current.sellingRate || current.manuallyCorrected,
      originalExtractedBuying: current.originalExtractedBuying ?? current.buyingRate,
      originalExtractedSelling: current.originalExtractedSelling ?? current.sellingRate,
      verificationStatus: 'Verified',
      lastVerifiedAt: new Date().toISOString(),
    };

    store.fxRates[idx] = updated;
    store.anomaliesCount = store.fxRates.filter((r) => r.anomalyFlagged).length;
    savePersistedStore(store);
    res.json({ ok: true, rate: updated });
  });

  // ---------- AI Recruitment Suite & Secure Document Parsing Routes ----------

  const aiRateWindow = new Map<string, number[]>();
  const AI_RATE_LIMIT = 40;
  const AI_RATE_WINDOW_MS = 10 * 60 * 1000;

  function enforceAiRateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
    const ip =
      String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local')
        .split(',')[0]
        .trim() || 'local';
    const now = Date.now();
    const recent = (aiRateWindow.get(ip) || []).filter((ts) => now - ts < AI_RATE_WINDOW_MS);
    if (recent.length >= AI_RATE_LIMIT) {
      res.status(429).json({
        error: 'AI request rate limit exceeded. Please wait a few minutes before retrying.',
      });
      return;
    }
    recent.push(now);
    aiRateWindow.set(ip, recent);
    next();
  }

  function trackAiUsage(
    metric: 'resumeScans' | 'jobMatches' | 'recommendationsRuns' | 'interviewSessions' | 'employerScreenings'
  ) {
    store.aiUsage[metric] = (store.aiUsage[metric] || 0) + 1;
    store.aiUsage.totalAiRequests = (store.aiUsage.totalAiRequests || 0) + 1;
    store.aiUsage.lastAiCallAt = new Date().toISOString();
    savePersistedStore(store);
  }

  async function callOpenAiJson<T>(systemPrompt: string, userPayload: unknown): Promise<T | null> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return null;
    const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.25,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: JSON.stringify(userPayload) },
          ],
        }),
        signal: AbortSignal.timeout(25000),
      });
      if (!response.ok) return null;
      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) return null;
      return JSON.parse(content) as T;
    } catch {
      return null;
    }
  }

  app.get('/api/ai/status', (_req, res) => {
    const openAiConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
    const payload: AiEngineStatusResponse = {
      openAiConfigured,
      model: openAiConfigured
        ? process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini'
        : 'TATARI Evidence NLP Engine',
      engineMode: openAiConfigured ? 'openai' : 'deterministic',
      usage: store.aiUsage,
    };
    res.json(payload);
  });

  app.post('/api/ai/parse-cv', enforceAiRateLimit, async (req, res) => {
    try {
      const fileName = String(req.body?.fileName || '').trim();
      const base64Data = String(req.body?.base64Data || '').trim();
      if (!fileName || !base64Data) {
        res.status(400).json({ error: 'fileName and base64Data are required.' });
        return;
      }

      const rawBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
      const buffer = Buffer.from(rawBase64, 'base64');
      const check = validateUploadedCvBinary(fileName, buffer.length, new Uint8Array(buffer));
      if (!check.valid || !check.fileType) {
        res.status(400).json({ error: check.error || 'Unsupported file format.' });
        return;
      }

      let extractedText = '';
      if (check.fileType === 'txt') {
        extractedText = sanitizeResumePlainText(buffer.toString('utf8'));
      } else if (check.fileType === 'docx') {
        const mammoth = await import('mammoth');
        const mod = mammoth.default || mammoth;
        const result = await mod.extractRawText({ buffer });
        extractedText = sanitizeResumePlainText(result.value || '');
      } else {
        const { extractText } = await import('unpdf');
        const result = await extractText(new Uint8Array(buffer), { mergePages: true });
        const joined = Array.isArray(result.text) ? result.text.join('\n') : String(result.text || '');
        extractedText = sanitizeResumePlainText(joined);
      }

      if (!extractedText || extractedText.length < 15) {
        res.status(422).json({
          error:
            'No readable text could be extracted from this file. Scanned image-only PDFs require OCR or pasting text.',
        });
        return;
      }

      res.json({
        ok: true,
        fileName: fileName.replace(/[^a-zA-Z0-9._-]/g, '_'),
        fileType: check.fileType,
        fileSizeBytes: buffer.length,
        extractedText: extractedText.slice(0, 35000),
        wordCount: extractedText.split(/\s+/).filter(Boolean).length,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to parse resume document.',
      });
    }
  });

  app.post('/api/ai/analyze-resume', enforceAiRateLimit, async (req, res) => {
    const cvText = sanitizeResumePlainText(String(req.body?.cvText || '')).slice(0, 28000);
    const targetRole = String(req.body?.targetRole || '').trim().slice(0, 140);
    if (cvText.length < 25) {
      res.status(400).json({ error: 'Please provide at least 25 characters of resume text or upload a CV file.' });
      return;
    }

    const baseline = computeDeterministicResumeAnalysis(cvText, targetRole);
    const openAiOutput = await callOpenAiJson<Partial<AiResumeAnalysisResult>>(
      `You are an ethical, evidence-based career coach. Analyze ONLY the supplied resume text. Never invent degrees, employers, dates, or skills not present in the source CV. Return strict JSON with keys: overallScore (0-100), sectionScores ({structure,clarity,experience,education,skills} each 0-100), extractedSkills (string[]), strengths (string[]), weaknesses (string[]), missingInfo (string[]), missingKeywords (string[]), suggestions (string[]), improvedResumeText (string rewritten cleanly using ONLY truthful facts from the source CV).`,
      { cvText, targetRole }
    );

    trackAiUsage('resumeScans');

    if (openAiOutput && typeof openAiOutput.overallScore === 'number') {
      res.json({
        ...baseline,
        ...openAiOutput,
        engine: 'openai',
        modelLabel: `OpenAI (${process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini'})`,
        analyzedAt: new Date().toISOString(),
      } satisfies AiResumeAnalysisResult);
      return;
    }

    res.json(baseline);
  });

  app.post('/api/ai/match-job', enforceAiRateLimit, async (req, res) => {
    const cvText = sanitizeResumePlainText(String(req.body?.cvText || '')).slice(0, 28000);
    const job = req.body?.job as JobListing | undefined;
    if (cvText.length < 25 || !job || !job.titleEn) {
      res.status(400).json({ error: 'Resume text and target job description are required.' });
      return;
    }

    const baseline = computeDeterministicJobMatch(cvText, job);
    const openAiOutput = await callOpenAiJson<Partial<AiJobMatchResult>>(
      `You are an evidence-based ATS matcher. Compare the candidate's CV against the job description. Never fabricate qualifications or experience. Return strict JSON with keys: compatibilityScore (0-100), matchingSkills (string[]), missingSkills (string[]), relevantExperience (string[] quoting real CV evidence), explanation (string), suggestions (string[]), tailoredResumeText (string reorganizing ONLY facts from the source CV to emphasize role alignment).`,
      {
        cvText,
        job: {
          title: job.titleEn,
          company: job.companyName,
          category: job.category,
          experienceLevel: job.experienceLevel,
          description: job.descriptionEn,
          requirements: job.requirements,
          skills: job.skills || [],
        },
      }
    );

    trackAiUsage('jobMatches');

    if (openAiOutput && typeof openAiOutput.compatibilityScore === 'number') {
      res.json({
        ...baseline,
        ...openAiOutput,
        engine: 'openai',
        modelLabel: `OpenAI (${process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini'})`,
        matchedAt: new Date().toISOString(),
      } satisfies AiJobMatchResult);
      return;
    }

    res.json(baseline);
  });

  app.post('/api/ai/recommendations', enforceAiRateLimit, (req, res) => {
    const profile = req.body?.profile as UserProfile | null;
    const jobs = Array.isArray(req.body?.jobs) ? (req.body.jobs as JobListing[]) : [];
    if (!profile || jobs.length === 0) {
      res.json({ recommendations: [] });
      return;
    }
    const recommendations = rankJobsForCandidate(profile, jobs, 15);
    trackAiUsage('recommendationsRuns');
    res.json({ recommendations });
  });

  app.post('/api/ai/interview/questions', enforceAiRateLimit, async (req, res) => {
    const jobTitle = String(req.body?.jobTitle || '').trim();
    const jobDescription = String(req.body?.jobDescription || '').trim();
    const requirements = Array.isArray(req.body?.requirements)
      ? req.body.requirements.map(String)
      : [];

    if (!jobTitle) {
      res.status(400).json({ error: 'Job title is required to generate interview questions.' });
      return;
    }

    const baseline = buildDeterministicInterviewQuestions(jobTitle, jobDescription, requirements);
    const openAiOutput = await callOpenAiJson<{ questions?: AiInterviewQuestion[] }>(
      `You are an expert technical & HR interviewer. Generate 5 realistic interview questions tailored to the supplied job description. Return strict JSON: {"questions":[{"id":"iq-1","category":"Role-Specific"|"Technical"|"Behavioral"|"Situational","question":"...","focusTip":"..."}]}.`,
      { jobTitle, jobDescription, requirements }
    );

    if (openAiOutput?.questions && Array.isArray(openAiOutput.questions) && openAiOutput.questions.length > 0) {
      res.json({ engine: 'openai', questions: openAiOutput.questions.slice(0, 6) });
      return;
    }

    res.json({ engine: 'deterministic', questions: baseline });
  });

  app.post('/api/ai/interview/evaluate', enforceAiRateLimit, async (req, res) => {
    const question = req.body?.question as AiInterviewQuestion | undefined;
    const answer = String(req.body?.answer || '').trim();
    const jobTitle = String(req.body?.jobTitle || 'Target Role').trim();
    const requirements = Array.isArray(req.body?.requirements)
      ? req.body.requirements.map(String)
      : [];

    if (!question?.question || answer.length < 5) {
      res.status(400).json({ error: 'Please provide an answer before requesting evaluation.' });
      return;
    }

    const baseline = evaluateInterviewAnswerDeterministic(question, answer, jobTitle, requirements);
    const openAiOutput = await callOpenAiJson<Partial<AiInterviewEvaluation>>(
      `Evaluate the candidate's interview answer objectively on communication, relevance, clarity, and technicalKnowledge (each 0-100). Return strict JSON with keys: overallScore, scores ({communication,relevance,clarity,technicalKnowledge}), strengths (string[]), improvements (string[]), suggestedStrongerAnswer (string), feedbackSummary (string).`,
      { jobTitle, question: question.question, answer, requirements }
    );

    trackAiUsage('interviewSessions');

    if (openAiOutput && typeof openAiOutput.overallScore === 'number') {
      res.json({
        ...baseline,
        ...openAiOutput,
        engine: 'openai',
      } satisfies AiInterviewEvaluation);
      return;
    }

    res.json(baseline);
  });

  app.post('/api/ai/employer/screen', enforceAiRateLimit, async (req, res) => {
    const job = req.body?.job as JobListing | undefined;
    const applications = Array.isArray(req.body?.applications)
      ? (req.body.applications as JobApplication[])
      : [];
    if (!job || !job.id) {
      res.status(400).json({ error: 'Target job listing is required.' });
      return;
    }

    const baseline = screenApplicantsDeterministic(job, applications);
    const openAiOutput = await callOpenAiJson<{
      screenings?: AiApplicantScreeningItem[];
      comparisonSummary?: string;
    }>(
      `You are an ethical HR recruitment assistant. Summarize and score applicants ONLY by job-relevant skills, stated experience, and submitted CV/cover note evidence. Strictly avoid protected characteristics (age, gender, ethnicity, religion, marital status). Never make final automated hiring decisions. Return strict JSON: {"screenings":[{"applicationId","applicantName","applicantEmail","jobId","jobTitle","fitScore","category":"Strong Fit"|"Potential Fit"|"Needs Review","summary","matchingSkills":[],"missingQualifications":[],"biasCheckNote"}],"comparisonSummary":"..."}.`,
      {
        job: {
          id: job.id,
          titleEn: job.titleEn,
          requirements: job.requirements,
          descriptionEn: job.descriptionEn,
        },
        applicants: applications
          .filter((a) => a.jobId === job.id)
          .map((a) => ({
            applicationId: a.id,
            applicantName: a.applicantName,
            applicantEmail: a.applicantEmail,
            yearsExperience: a.yearsExperience,
            coverNote: a.coverNote,
            resumeText: (a.resumeText || '').slice(0, 3500),
            status: a.status,
          })),
      }
    );

    trackAiUsage('employerScreenings');

    if (openAiOutput?.screenings && Array.isArray(openAiOutput.screenings) && openAiOutput.screenings.length > 0) {
      res.json({
        engine: 'openai',
        screenings: openAiOutput.screenings,
        comparisonSummary:
          openAiOutput.comparisonSummary ||
          `Screened ${openAiOutput.screenings.length} applicant(s) for ${job.titleEn}.`,
      });
      return;
    }

    const strongCount = baseline.filter((b) => b.category === 'Strong Fit').length;
    res.json({
      engine: 'deterministic',
      screenings: baseline,
      comparisonSummary:
        baseline.length === 0
          ? `No applicants have applied to ${job.titleEn} yet.`
          : `Screened ${baseline.length} applicant(s) for ${job.titleEn}: ${strongCount} Strong Fit. Highest fit: ${baseline[0].applicantName} (${baseline[0].fitScore}/100).`,
    });
  });

  app.post('/api/ai/employer/ask', enforceAiRateLimit, async (req, res) => {
    const question = String(req.body?.question || '').trim();
    const job = (req.body?.job as JobListing | null) || null;
    const applications = Array.isArray(req.body?.applications)
      ? (req.body.applications as JobApplication[])
      : [];
    if (!question) {
      res.status(400).json({ error: 'Question is required.' });
      return;
    }

    const openAiOutput = await callOpenAiJson<{ answer?: string }>(
      `Answer the recruiter's question strictly using evidence from the provided applicants and job description. Do not invent facts or reference protected characteristics. Return JSON: {"answer":"..."}.`,
      {
        question,
        job: job ? { title: job.titleEn, requirements: job.requirements } : null,
        applicants: applications.slice(0, 25).map((a) => ({
          name: a.applicantName,
          jobTitle: a.jobTitle,
          yearsExperience: a.yearsExperience,
          status: a.status,
          coverNote: a.coverNote,
          resumeExcerpt: (a.resumeText || '').slice(0, 1200),
        })),
      }
    );

    if (openAiOutput?.answer) {
      res.json({ engine: 'openai', answer: openAiOutput.answer });
      return;
    }

    res.json({
      engine: 'deterministic',
      answer: answerRecruiterPoolQuestion(question, job, applications),
    });
  });

  return app;
}
