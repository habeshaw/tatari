import { db } from './db';
import {
  buildJobSlug,
  categorizeJob,
  computeDedupeKey,
  isExpiredJob,
  parseHtmlDirectory,
  parseJsonFeed,
  parseRssXmlFeed,
  type ParsedExternalJob,
} from './aggregatorCore';

export interface JobSourceRow {
  id: number;
  source_name: string;
  website_url: string;
  feed_url: string;
  collection_method: 'rss' | 'json_api' | 'html_directory' | 'partner_feed';
  collection_frequency: 'hourly' | 'every_6h' | 'daily' | 'manual';
  status: 'active' | 'paused' | 'error';
  robots_respect: number;
  rate_limit_ms: number;
  last_collected_at: string | null;
}

const USER_AGENT = 'Mozilla/5.0 (compatible; TatariJobAggregator/1.0; +https://tatari.et)';

export async function verifyUrlIsLive(url: string): Promise<boolean> {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    let res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,*/*' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    // Many Ethiopian sites only register GET routes (returning 404/405/403 on HEAD); verify with GET
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      const getController = new AbortController();
      const getTimer = setTimeout(() => getController.abort(), 8000);
      res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,*/*' },
        signal: getController.signal,
      });
      clearTimeout(getTimer);
    }

    const ok = res.ok && !/\/404(?:$|[/?#])|not-found/i.test(res.url);
    await res.body?.cancel().catch(() => {});
    return ok;
  } catch {
    return false;
  }
}

async function fetchWithRetry(
  url: string,
  retries = 2,
  rateLimitMs = 1000
): Promise<{ text: string; contentType: string }> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/rss+xml, application/xml, application/json, text/html, */*',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.status === 401 || res.status === 403 || res.status === 429) {
        throw new Error(
          `Access restricted by remote host (HTTP ${res.status}); honoring access policy without bypass.`
        );
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const text = await res.text();
      if (/captcha|verify you are human|cloudflare challenge/i.test(text.slice(0, 2000))) {
        throw new Error('Remote page presented a CAPTCHA/challenge; stopped per compliance policy.');
      }
      return { text, contentType: res.headers.get('content-type') || '' };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.message.includes('Access restricted') || lastError.message.includes('CAPTCHA')) {
        throw lastError;
      }
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, Math.max(rateLimitMs, 500) * (attempt + 1)));
      }
    }
  }
  throw lastError || new Error('Failed to fetch remote feed');
}

async function checkRobotsAllowed(_websiteUrl: string, feedUrl: string): Promise<boolean> {
  if (!/^https?:\/\//i.test(feedUrl)) return true;
  try {
    const parsedFeed = new URL(feedUrl);
    const robotsUrl = `${parsedFeed.origin}/robots.txt`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(robotsUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return true;
    const body = await res.text();
    const lines = body.split(/\r?\n/);
    let inWildcardOrTatari = false;
    for (const rawLine of lines) {
      const line = rawLine.split('#')[0].trim();
      if (!line) continue;
      if (/^user-agent:\s*(\*|tatarijobaggregator)/i.test(line)) {
        inWildcardOrTatari = true;
      } else if (/^user-agent:/i.test(line)) {
        inWildcardOrTatari = false;
      } else if (inWildcardOrTatari && /^disallow:\s*(.+)$/i.test(line)) {
        const rule = line.replace(/^disallow:\s*/i, '').trim();
        if (rule === '/' || (rule && parsedFeed.pathname.startsWith(rule))) {
          return false;
        }
      }
    }
    return true;
  } catch {
    return true;
  }
}

function triggerMatchingJobAlerts(
  title: string,
  companyName: string,
  location: string,
  categoryId: number,
  jobOrigin: string,
  slug: string
): void {
  const alerts = db
    .prepare('SELECT * FROM job_alerts WHERE active = 1')
    .all() as Array<{
    id: number;
    user_id: number;
    category_id: number | null;
    location: string | null;
    keywords: string | null;
    job_origin_pref: string;
  }>;

  const insertNotification = db.prepare(`
    INSERT INTO notifications (user_id, title, message, link_slug, is_read, created_at)
    VALUES (?, ?, ?, ?, 0, ?)
  `);
  const nowIso = new Date().toISOString();

  for (const alert of alerts) {
    if (alert.job_origin_pref !== 'all' && alert.job_origin_pref !== jobOrigin) continue;
    if (alert.category_id && alert.category_id !== categoryId) continue;
    if (alert.location && !location.toLowerCase().includes(alert.location.toLowerCase())) continue;
    if (alert.keywords) {
      const kw = alert.keywords.toLowerCase();
      if (!title.toLowerCase().includes(kw) && !companyName.toLowerCase().includes(kw)) continue;
    }

    insertNotification.run(
      alert.user_id,
      `New Job Alert: ${title}`,
      `${title} at ${companyName} (${location}) is now live.`,
      slug,
      nowIso
    );
  }
}

async function filterVerifiedLiveJobs(items: ParsedExternalJob[], maxPerSource = 12): Promise<ParsedExternalJob[]> {
  const activeCandidates = items
    .filter((item) => !isExpiredJob(item.expiresAt, item.applicationDeadline))
    .slice(0, maxPerSource);

  const verified: ParsedExternalJob[] = [];
  const batchSize = 5;
  for (let i = 0; i < activeCandidates.length; i += batchSize) {
    const chunk = activeCandidates.slice(i, i + batchSize);
    const checks = await Promise.all(
      chunk.map(async (item) => ({
        item,
        live: await verifyUrlIsLive(item.originalJobUrl),
      }))
    );
    for (const c of checks) {
      if (c.live) verified.push(c.item);
    }
  }
  return verified;
}

export async function runCollectionForSource(
  sourceId: number,
  autoApprove = true
): Promise<{
  logId: number;
  status: 'success' | 'failed';
  jobsFound: number;
  jobsAdded: number;
  jobsUpdated: number;
  duplicatesFound: number;
  error?: string;
}> {
  const source = db.prepare('SELECT * FROM job_sources WHERE id = ?').get(sourceId) as JobSourceRow | undefined;
  if (!source) {
    throw new Error(`Job source #${sourceId} not found`);
  }

  const startedAt = new Date().toISOString();
  const logInsert = db
    .prepare(
      `INSERT INTO job_collection_logs (source_id, collection_started_at, collection_status) VALUES (?, ?, 'running')`
    )
    .run(sourceId, startedAt);
  const logId = Number(logInsert.lastInsertRowid);

  try {
    if (source.robots_respect) {
      const allowed = await checkRobotsAllowed(source.website_url, source.feed_url);
      if (!allowed) {
        throw new Error(`Blocked by robots.txt policy at ${source.website_url}`);
      }
    }

    const { text, contentType } = await fetchWithRetry(source.feed_url, 2, source.rate_limit_ms);
    let parsedJobs: ParsedExternalJob[] = [];
    if (source.collection_method === 'json_api' || contentType.includes('application/json')) {
      parsedJobs = parseJsonFeed(JSON.parse(text), source.website_url);
    } else if (
      source.collection_method === 'rss' ||
      contentType.includes('xml') ||
      text.trim().startsWith('<rss') ||
      text.trim().startsWith('<?xml')
    ) {
      parsedJobs = parseRssXmlFeed(text, source.website_url);
    } else {
      parsedJobs = parseHtmlDirectory(text, source.website_url);
    }

    // Only keep direct job postings whose original_job_url actually returns HTTP 200
    const liveJobs = await filterVerifiedLiveJobs(parsedJobs, 12);

    const cats = db.prepare('SELECT id, slug FROM job_categories').all() as Array<{ id: number; slug: string }>;
    const catMap = new Map(cats.map((c) => [c.slug, c.id]));

    let jobsAdded = 0;
    let jobsUpdated = 0;
    let duplicatesFound = 0;

    const findBySourceExt = db.prepare(
      'SELECT id, slug, title, description, application_deadline, salary_min, salary_max, status FROM jobs WHERE source_id = ? AND original_job_identifier = ?'
    );
    const findByDedupe = db.prepare('SELECT id FROM jobs WHERE dedupe_key = ? LIMIT 1');

    const insertJob = db.prepare(`
      INSERT INTO jobs (
        slug, title, company_name, company_logo, location, description, category_id,
        employment_type, salary_min, salary_max, salary_currency, application_deadline,
        source_id, original_job_url, job_origin, original_job_identifier, dedupe_key,
        published_at, expires_at, status, is_featured, payment_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ETB', ?, ?, ?, 'external', ?, ?, ?, ?, ?, 0, 'not_required', ?, ?)
    `);

    const updateJob = db.prepare(`
      UPDATE jobs SET
        title = ?, description = ?, salary_min = ?, salary_max = ?,
        application_deadline = ?, expires_at = ?, original_job_url = ?, updated_at = ?
      WHERE id = ?
    `);

    const nowIso = new Date().toISOString();

    for (const item of liveJobs) {
      const catSlug = categorizeJob(item.title, item.description, item.categoryHint);
      const categoryId = catMap.get(catSlug) ?? catMap.get('other')!;
      const dedupeKey = computeDedupeKey({
        sourceId,
        originalJobIdentifier: item.originalJobIdentifier,
        originalJobUrl: item.originalJobUrl,
        title: item.title,
        companyName: item.companyName,
        location: item.location,
      });

      const existingSameSource = findBySourceExt.get(sourceId, item.originalJobIdentifier) as
        | {
            id: number;
            title: string;
            description: string;
            application_deadline: string | null;
            salary_min: number | null;
            salary_max: number | null;
          }
        | undefined;

      if (existingSameSource) {
        const changed =
          existingSameSource.title !== item.title ||
          existingSameSource.description !== item.description ||
          existingSameSource.salary_min !== item.salaryMin ||
          existingSameSource.salary_max !== item.salaryMax;
        if (changed) {
          updateJob.run(
            item.title,
            item.description,
            item.salaryMin,
            item.salaryMax,
            item.applicationDeadline,
            item.expiresAt,
            item.originalJobUrl,
            nowIso,
            existingSameSource.id
          );
          jobsUpdated++;
        } else {
          duplicatesFound++;
        }
        continue;
      }

      const crossSourceDupe = findByDedupe.get(dedupeKey) as { id: number } | undefined;
      if (crossSourceDupe) {
        duplicatesFound++;
        continue;
      }

      const tempToken = `${Date.now().toString(36)}-${Math.floor(Math.random() * 999)}`;
      const slug = buildJobSlug(item.title, item.companyName, tempToken);
      const initialStatus = autoApprove ? 'active' : 'pending_review';

      insertJob.run(
        slug,
        item.title,
        item.companyName,
        item.companyLogo,
        item.location,
        item.description,
        categoryId,
        item.employmentType,
        item.salaryMin,
        item.salaryMax,
        item.applicationDeadline,
        sourceId,
        item.originalJobUrl,
        item.originalJobIdentifier,
        dedupeKey,
        item.publishedAt,
        item.expiresAt,
        initialStatus,
        nowIso,
        nowIso
      );

      if (initialStatus === 'active') {
        triggerMatchingJobAlerts(
          item.title,
          item.companyName,
          item.location,
          categoryId,
          'external',
          slug
        );
      }

      jobsAdded++;
    }

    const completedAt = new Date().toISOString();
    db.prepare(`
      UPDATE job_collection_logs
      SET collection_completed_at = ?, jobs_found = ?, jobs_added = ?, jobs_updated = ?, duplicates_found = ?, collection_status = 'success'
      WHERE id = ?
    `).run(completedAt, liveJobs.length, jobsAdded, jobsUpdated, duplicatesFound, logId);

    db.prepare(`
      UPDATE job_sources SET last_collected_at = ?, status = 'active', updated_at = ? WHERE id = ?
    `).run(completedAt, completedAt, sourceId);

    return {
      logId,
      status: 'success',
      jobsFound: liveJobs.length,
      jobsAdded,
      jobsUpdated,
      duplicatesFound,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const completedAt = new Date().toISOString();
    db.prepare(`
      UPDATE job_collection_logs
      SET collection_completed_at = ?, errors = ?, collection_status = 'failed'
      WHERE id = ?
    `).run(completedAt, errorMsg, logId);

    db.prepare(`
      UPDATE job_sources SET status = 'error', updated_at = ? WHERE id = ?
    `).run(completedAt, sourceId);

    return {
      logId,
      status: 'failed',
      jobsFound: 0,
      jobsAdded: 0,
      jobsUpdated: 0,
      duplicatesFound: 0,
      error: errorMsg,
    };
  }
}

export async function verifyAndPruneExternalLinks(): Promise<{ checked: number; expiredCount: number }> {
  const activeExternal = db
    .prepare("SELECT id, original_job_url FROM jobs WHERE job_origin = 'external' AND status = 'active'")
    .all() as Array<{ id: number; original_job_url: string | null }>;

  let expiredCount = 0;
  const nowIso = new Date().toISOString();
  const markExpired = db.prepare("UPDATE jobs SET status = 'expired', updated_at = ? WHERE id = ?");

  const batchSize = 5;
  for (let i = 0; i < activeExternal.length; i += batchSize) {
    const chunk = activeExternal.slice(i, i + batchSize);
    const checks = await Promise.all(
      chunk.map(async (row) => ({
        id: row.id,
        live: row.original_job_url ? await verifyUrlIsLive(row.original_job_url) : false,
      }))
    );
    for (const c of checks) {
      if (!c.live) {
        markExpired.run(nowIso, c.id);
        expiredCount++;
      }
    }
  }

  return { checked: activeExternal.length, expiredCount };
}

export async function ensureLiveExternalJobsOnStartup(): Promise<number> {
  const activeExternalCount = (
    db.prepare("SELECT COUNT(*) as c FROM jobs WHERE job_origin = 'external' AND status = 'active'").get() as {
      c: number;
    }
  ).c;

  if (activeExternalCount > 0) {
    return activeExternalCount;
  }

  const sources = db
    .prepare("SELECT id, source_name FROM job_sources WHERE status = 'active' ORDER BY id ASC")
    .all() as Array<{ id: number; source_name: string }>;

  let totalAdded = 0;
  for (const src of sources) {
    const res = await runCollectionForSource(src.id, true);
    totalAdded += res.jobsAdded;
  }
  console.log(`Initial live Ethiopian job collection completed: +${totalAdded} verified jobs.`);
  return totalAdded;
}

export function expireOutdatedJobs(): number {
  const nowIso = new Date().toISOString();
  const res = db
    .prepare(
      `UPDATE jobs SET status = 'expired', updated_at = ? WHERE status = 'active' AND ((expires_at IS NOT NULL AND expires_at < ?) OR (application_deadline IS NOT NULL AND application_deadline < ?))`
    )
    .run(nowIso, nowIso, nowIso);
  return res.changes;
}

let schedulerHandle: ReturnType<typeof setInterval> | null = null;

export function startBackgroundAggregator(): void {
  if (schedulerHandle) return;
  expireOutdatedJobs();

  schedulerHandle = setInterval(async () => {
    try {
      expireOutdatedJobs();
      const sources = db
        .prepare("SELECT * FROM job_sources WHERE status = 'active' AND collection_frequency != 'manual'")
        .all() as JobSourceRow[];

      const nowMs = Date.now();
      for (const src of sources) {
        const lastMs = src.last_collected_at ? Date.parse(src.last_collected_at) : 0;
        const intervalMs =
          src.collection_frequency === 'hourly'
            ? 60 * 60 * 1000
            : src.collection_frequency === 'every_6h'
              ? 6 * 60 * 60 * 1000
              : 24 * 60 * 60 * 1000;

        if (!lastMs || nowMs - lastMs >= intervalMs) {
          await runCollectionForSource(src.id, true);
        }
      }
    } catch (err) {
      console.error('Background aggregation tick error:', err);
    }
  }, 5 * 60 * 1000);
}
