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
import type {
  AggregatedOpportunity,
  AggregationSourceRecord,
  AggregatorOverviewResponse,
  BankFxApiResponse,
  BankFxHistoryPoint,
  BankFxRateRecord,
  BankFxSourceStatus,
  CollectionErrorEntry,
  CollectionRunEntry,
  ExternalJobSourceStatus,
  JobListing,
  NbeIndicativeMidRate,
  OpportunitiesApiResponse,
  OpportunityModuleType,
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
  collectionRuns: CollectionRunEntry[];
  collectionErrors: CollectionErrorEntry[];
  duplicatesDetected: number;
  anomaliesCount: number;
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
    collectionRuns: [],
    collectionErrors: [],
    duplicatesDetected: 0,
    anomaliesCount: 0,
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

    return {
      ...empty,
      ...parsed,
      opportunitySources: mergedSources,
      collectionRuns: Array.isArray(parsed.collectionRuns) ? parsed.collectionRuns.slice(0, 50) : [],
      collectionErrors: Array.isArray(parsed.collectionErrors)
        ? parsed.collectionErrors.slice(0, 100)
        : [],
      fxHistory: Array.isArray(parsed.fxHistory) ? parsed.fxHistory.slice(-1500) : [],
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
  const { timeoutMs = 9500, retries = 1, ...init } = options;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok && attempt < retries && res.status >= 500) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Network request failed');
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
    collectionRuns: store.collectionRuns,
    collectionErrors: store.collectionErrors,
    countsByModule,
    totalCollectedListings:
      store.jobs.length + store.opportunities.length + store.fxRates.length,
    duplicatesDetected: store.duplicatesDetected,
    expiredCount,
    anomaliesCount: store.anomaliesCount,
    lastFullSyncAt: store.opportunitiesSyncedAt || store.fxSyncedAt || store.jobsSyncedAt,
  };
}

export async function runFullBackgroundSync(forceRefresh: boolean = true): Promise<void> {
  if (isFullSyncRunning) return;
  isFullSyncRunning = true;
  try {
    await Promise.all([
      collectAllExternalJobs(forceRefresh),
      collectAllBankFx(forceRefresh),
      collectAllOpportunities(forceRefresh),
    ]);
  } finally {
    isFullSyncRunning = false;
  }
}

export function createTatariApp(): express.Express {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

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

  return app;
}
