import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXTERNAL_JOB_SOURCES,
  parseEffoySiraPosts,
  parseEthiojobsHtml,
  parseGeezJobsHtml,
  type EffoySiraPostItem,
  type ExternalJobsApiResponse,
} from './src/lib/externalJobs.ts';
import type { ExternalJobSourceStatus, JobListing } from './src/types/domain.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const CACHE_TTL_MS = 5 * 60 * 1000;

interface FeedCache {
  expiresAt: number;
  payload: ExternalJobsApiResponse;
}

let cachedFeeds: FeedCache | null = null;
let inFlightSync: Promise<ExternalJobsApiResponse> | null = null;

const BROWSER_HEADERS: Record<string, string> = {
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  accept: 'text/html,application/json,application/xhtml+xml;q=0.9,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
};

async function fetchEthiojobsFeed(syncedAt: string): Promise<{
  status: ExternalJobSourceStatus;
  jobs: JobListing[];
}> {
  const meta = EXTERNAL_JOB_SOURCES[0];
  try {
    const res = await fetch(meta.feedUrl, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(7500),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const html = await res.text();
    const jobs = parseEthiojobsHtml(html, syncedAt).slice(0, 12);
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
    return {
      jobs: [],
      status: {
        id: meta.id,
        name: meta.name,
        domain: meta.domain,
        homeUrl: meta.homeUrl,
        status: 'error',
        fetchedCount: 0,
        errorMessage: err instanceof Error ? err.message : 'Unable to reach ethiojobs.net',
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
    const res = await fetch(meta.feedUrl, {
      headers: {
        ...BROWSER_HEADERS,
        cookie: 'gj_ok=1',
      },
      signal: AbortSignal.timeout(7500),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const html = await res.text();
    const jobs = parseGeezJobsHtml(html, syncedAt).slice(0, 12);
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
    return {
      jobs: [],
      status: {
        id: meta.id,
        name: meta.name,
        domain: meta.domain,
        homeUrl: meta.homeUrl,
        status: 'error',
        fetchedCount: 0,
        errorMessage: err instanceof Error ? err.message : 'Unable to reach geezjobs.com',
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
    const res = await fetch(meta.feedUrl, {
      headers: {
        ...BROWSER_HEADERS,
        accept: 'application/json',
      },
      signal: AbortSignal.timeout(7500),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = (await res.json()) as EffoySiraPostItem[];
    const jobs = parseEffoySiraPosts(data, syncedAt).slice(0, 10);
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
    return {
      jobs: [],
      status: {
        id: meta.id,
        name: meta.name,
        domain: meta.domain,
        homeUrl: meta.homeUrl,
        status: 'error',
        fetchedCount: 0,
        errorMessage: err instanceof Error ? err.message : 'Unable to reach effoysira.com',
        lastSyncedAt: syncedAt,
      },
    };
  }
}

async function collectAllExternalJobs(forceRefresh: boolean): Promise<ExternalJobsApiResponse> {
  const now = Date.now();
  if (!forceRefresh && cachedFeeds && cachedFeeds.expiresAt > now) {
    return {
      ...cachedFeeds.payload,
      cached: true,
    };
  }

  if (inFlightSync) {
    return inFlightSync;
  }

  inFlightSync = (async () => {
    const syncedAt = new Date().toISOString();
    const [ethiojobs, geezjobs, effoysira] = await Promise.all([
      fetchEthiojobsFeed(syncedAt),
      fetchGeezJobsFeed(syncedAt),
      fetchEffoySiraFeed(syncedAt),
    ]);

    const combinedJobs: JobListing[] = [
      ...ethiojobs.jobs,
      ...geezjobs.jobs,
      ...effoysira.jobs,
    ];

    const payload: ExternalJobsApiResponse = {
      jobs: combinedJobs,
      sources: [ethiojobs.status, geezjobs.status, effoysira.status],
      syncedAt,
      cached: false,
    };

    if (combinedJobs.length > 0 || !cachedFeeds) {
      cachedFeeds = {
        expiresAt: Date.now() + CACHE_TTL_MS,
        payload,
      };
    }

    return payload;
  })();

  try {
    return await inFlightSync;
  } finally {
    inFlightSync = null;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'tatari-job-portal-digital-store',
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

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TATARI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start TATARI server:', err);
  process.exit(1);
});
