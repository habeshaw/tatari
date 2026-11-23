import type {
  DataVerificationStatus,
  ExternalJobSourceId,
  ExternalJobSourceStatus,
  JobListing,
  JobType,
  RemoteType,
} from '../types/domain';

export interface ExternalJobSourceConfig {
  id: ExternalJobSourceId;
  name: string;
  domain: string;
  homeUrl: string;
  feedUrl: string;
}

export const EXTERNAL_JOB_SOURCES: ExternalJobSourceConfig[] = [
  {
    id: 'ethiojobs',
    name: 'Ethiojobs',
    domain: 'ethiojobs.net',
    homeUrl: 'https://www.ethiojobs.net/jobs',
    feedUrl: 'https://www.ethiojobs.net/jobs',
  },
  {
    id: 'geezjobs',
    name: 'GeezJobs',
    domain: 'geezjobs.com',
    homeUrl: 'https://geezjobs.com/search-jobs',
    feedUrl: 'https://geezjobs.com/search-jobs',
  },
  {
    id: 'effoysira',
    name: 'EffoySira',
    domain: 'effoysira.com',
    homeUrl: 'https://effoysira.com',
    feedUrl: 'https://effoysira.com/wp-json/wp/v2/posts?per_page=12',
  },
];

export interface ExternalJobsApiResponse {
  jobs: JobListing[];
  sources: ExternalJobSourceStatus[];
  syncedAt: string;
  cached?: boolean;
}

const NAMED_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#039;': "'",
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&ndash;': '–',
  '&mdash;': '—',
  '&rsquo;': '’',
  '&lsquo;': '‘',
  '&ldquo;': '“',
  '&rdquo;': '”',
  '&hellip;': '…',
  '&bull;': '•',
};

export function decodeHtmlEntities(input: string): string {
  if (!input) return '';
  let text = input.replace(
    /&(amp|lt|gt|quot|#0?39|apos|nbsp|ndash|mdash|rsquo|lsquo|ldquo|rdquo|hellip|bull);/gi,
    (match) => NAMED_ENTITIES[match.toLowerCase()] ?? match
  );
  text = text.replace(/&#(\d+);/g, (_, dec) => {
    const code = Number(dec);
    return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : '';
  });
  text = text.replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
    const code = parseInt(hex, 16);
    return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : '';
  });
  return text;
}

export function stripHtmlToText(html: string): string {
  if (!html) return '';
  const withBreaks = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ');
  return decodeHtmlEntities(withBreaks)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function sanitizeHttpUrl(rawUrl: string): string | null {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function buildContentFingerprint(parts: Array<string | null | undefined>): string {
  const normalized = parts
    .map((p) =>
      String(p || '')
        .toLowerCase()
        .replace(/[^a-z0-9\u1200-\u137f]+/gi, ' ')
        .trim()
    )
    .filter(Boolean)
    .join('|');
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fp-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function isDeadlineExpired(
  deadlineText: string | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!deadlineText) return false;
  const trimmed = deadlineText.trim();
  if (
    !trimmed ||
    /not provided|see original|open until|subscription/i.test(trimmed)
  ) {
    return false;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return false;
  // Treat a date-only deadline as valid through the end of that UTC day
  const endOfDayMs = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? parsed.getTime() + 24 * 60 * 60 * 1000 - 1
    : parsed.getTime();
  return endOfDayMs < nowMs;
}

export function normalizeCategoryFromText(text: string): string {
  const lower = text.toLowerCase();
  if (
    /\b(software|developer|engineer|it|data|network|cloud|cyber|react|system admin|ict)\b/.test(
      lower
    )
  ) {
    return 'IT & Data';
  }
  if (/\b(finance|accountant|audit|bank|credit|tax|payroll|cashier|treasury)\b/.test(lower)) {
    return 'Finance';
  }
  if (/\b(hr|human resource|admin|office|reception|secretary|procurement|logistics|supply)\b/.test(lower)) {
    return 'HR & Admin';
  }
  if (/\b(ngo|humanitarian|program|grant|relief|un|development|wash|protection|m&e)\b/.test(lower)) {
    return 'NGO & Development';
  }
  if (/\b(health|nurse|doctor|pharmac|medical|clinic|hospital|lab|public health)\b/.test(lower)) {
    return 'Healthcare';
  }
  if (/\b(civil|architect|mechanical|electrical|construction|site|manufacturing)\b/.test(lower)) {
    return 'Engineering';
  }
  return 'HR & Admin';
}

function normalizeJobType(raw: unknown): JobType {
  if (typeof raw === 'number') {
    if (raw === 9) return 'Part-time';
    if (raw === 10) return 'Contract';
    if (raw === 11) return 'Internship';
    return 'Full-time';
  }
  const s = String(raw || '').toLowerCase();
  if (s.includes('part')) return 'Part-time';
  if (s.includes('contract') || s.includes('consult')) return 'Contract';
  if (s.includes('intern') || s.includes('graduate') || s.includes('trainee')) return 'Internship';
  return 'Full-time';
}

function normalizeRemoteType(raw: unknown): RemoteType {
  const s = String(raw || '').toLowerCase();
  if (s.includes('remote')) return 'Remote';
  if (s.includes('hybrid')) return 'Hybrid';
  return 'On-site';
}

function normalizeExperienceLevel(raw: unknown): string {
  const s = String(raw || '').trim();
  if (s === '1') return 'Junior / Entry-Level';
  if (s === '2') return 'Mid-Level';
  if (s === '3') return 'Senior-Level';
  if (s === '4') return 'Management / Lead';
  return s || 'Not provided by source.';
}

function normalizeIsoDateOnly(raw: unknown, fallback: string = 'Not provided by source.'): string {
  if (!raw) return fallback;
  const parsed = new Date(String(raw));
  if (Number.isNaN(parsed.getTime())) {
    const clean = String(raw).trim();
    return clean || fallback;
  }
  return parsed.toISOString().slice(0, 10);
}

function safeSlugId(prefix: string, rawKey: string): string {
  const cleaned = rawKey
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48);
  return `${prefix}-${cleaned || 'listing'}`;
}

interface EthiojobsRawItem {
  title?: string;
  slug?: string;
  type?: number | string;
  level?: string | number;
  location_type?: string;
  description?: string;
  state?: string;
  catalogs?: Array<{ name?: string }>;
  date_published?: string;
  date_expiry?: string;
  company?: { name?: string };
}

export function parseEthiojobsHtml(
  html: string,
  fetchedAt: string = new Date().toISOString()
): JobListing[] {
  const match = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match?.[1]) return [];

  let payload: unknown;
  try {
    payload = JSON.parse(match[1]);
  } catch {
    return [];
  }

  const jobsData = (
    payload as { props?: { pageProps?: { jobs?: { data?: EthiojobsRawItem[] } } } }
  )?.props?.pageProps?.jobs?.data;
  if (!Array.isArray(jobsData)) return [];

  const nowMs = new Date(fetchedAt).getTime() || Date.now();
  const results: JobListing[] = [];

  for (const item of jobsData) {
    const title = decodeHtmlEntities(String(item.title || '')).trim();
    const slug = String(item.slug || '').trim();
    if (!title || !slug) continue;

    const sourceUrl = sanitizeHttpUrl(`https://www.ethiojobs.net/job/${slug.replace(/^\/+/, '')}`);
    if (!sourceUrl) continue;

    const companyName =
      decodeHtmlEntities(String(item.company?.name || '')).trim() || 'Not provided by source.';
    const location = decodeHtmlEntities(String(item.state || '')).trim() || 'Ethiopia';
    const catalogNames = Array.isArray(item.catalogs)
      ? item.catalogs.map((c) => c.name || '').filter(Boolean).join(' ')
      : '';
    const plainDesc = stripHtmlToText(String(item.description || ''));
    const category = normalizeCategoryFromText(`${title} ${catalogNames}`);
    const publishedAt = item.date_published
      ? new Date(item.date_published).toISOString()
      : undefined;
    const deadline = normalizeIsoDateOnly(item.date_expiry, 'Not provided by source.');
    const expired = isDeadlineExpired(deadline, nowMs);
    const verificationStatus: DataVerificationStatus = expired ? 'Expired' : 'Verified';

    results.push({
      id: safeSlugId('ext-ethiojobs', slug),
      employerEmail: 'aggregator@ethiojobs.net',
      titleEn: title,
      companyName,
      companyRating: 0,
      location: location.includes('Ethiopia') ? location : `${location}, Ethiopia`,
      remoteType: normalizeRemoteType(item.location_type),
      category,
      jobType: normalizeJobType(item.type),
      experienceLevel: normalizeExperienceLevel(item.level),
      salaryMin: 0,
      salaryMax: 0,
      salaryDisplay: 'Not provided by source.',
      deadline,
      summaryEn:
        plainDesc.slice(0, 180) ||
        `${title} vacancy at ${companyName}. View the original posting on Ethiojobs.`,
      descriptionEn:
        plainDesc ||
        `${title} position at ${companyName}. Open the original posting on Ethiojobs (${sourceUrl}) for complete terms of reference and application steps.`,
      requirements: catalogNames ? [`Sector: ${catalogNames}`] : [],
      benefits: [],
      easyApply: false,
      postingFeeEtb: 0,
      status: 'approved',
      createdAt: publishedAt || fetchedAt,
      publishedAt,
      sourceType: 'external',
      sourceSite: 'Ethiojobs',
      sourceDomain: 'ethiojobs.net',
      sourceUrl,
      fetchedAt,
      lastVerifiedAt: fetchedAt,
      verificationStatus,
      isExpired: expired,
      isDemoSeed: false,
      fingerprint: buildContentFingerprint([title, companyName, 'ethiojobs.net']),
    });
  }

  return results;
}

export function parseGeezJobsHtml(
  html: string,
  fetchedAt: string = new Date().toISOString()
): JobListing[] {
  const cards = html.split(/class="opportunity-card\b/i).slice(1);
  if (cards.length === 0) return [];

  const nowMs = new Date(fetchedAt).getTime() || Date.now();
  const results: JobListing[] = [];

  for (const card of cards) {
    const linkMatch = card.match(/<a\s+href="(\/job-detail\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    const relHref = linkMatch[1].trim();
    const title = stripHtmlToText(linkMatch[2]);
    if (!title || !relHref) continue;

    const sourceUrl = sanitizeHttpUrl(`https://geezjobs.com${relHref}`);
    if (!sourceUrl) continue;

    const companyMatch = card.match(/<a\s+href="\/company\/[^"]+"[^>]*>([\s\S]*?)<\/a>/i);
    const companyName = companyMatch
      ? stripHtmlToText(companyMatch[1])
      : 'Not provided by source.';

    const locMatch = card.match(/data-lucide="map-pin"[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i);
    const rawLocation = locMatch
      ? stripHtmlToText(locMatch[1]).replace(/\s*-\s*ethiopia/i, ', Ethiopia')
      : 'Addis Ababa, Ethiopia';
    const location = rawLocation.replace(/\s+/g, ' ').trim() || 'Addis Ababa, Ethiopia';

    const deadlineMatch = card.match(/Deadline:\s*([^<\n]+)/i);
    const deadline = deadlineMatch
      ? normalizeIsoDateOnly(deadlineMatch[1].trim(), deadlineMatch[1].trim())
      : 'Not provided by source.';
    const expired = isDeadlineExpired(deadline, nowMs);

    const jobTypeMatch = card.match(/data-lucide="briefcase"[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i);
    const rawTypeText = jobTypeMatch ? stripHtmlToText(jobTypeMatch[1]) : 'Full-time';
    const category = normalizeCategoryFromText(`${title} ${companyName}`);

    results.push({
      id: safeSlugId('ext-geezjobs', relHref.replace('/job-detail/', '')),
      employerEmail: 'aggregator@geezjobs.com',
      titleEn: title,
      companyName,
      companyRating: 0,
      location,
      remoteType: 'On-site',
      category,
      jobType: normalizeJobType(rawTypeText),
      experienceLevel: 'Not provided by source.',
      salaryMin: 0,
      salaryMax: 0,
      salaryDisplay: 'Not provided by source.',
      deadline,
      summaryEn: `${title} at ${companyName} (${location}). Collected from GeezJobs — open the original listing on geezjobs.com for full instructions.`,
      descriptionEn: `This vacancy for ${title} at ${companyName} (${location}) was collected from GeezJobs.\n\nEmployment Type: ${rawTypeText}\nApplication Deadline: ${deadline}\n\nClick "View Original & Apply on GeezJobs" to inspect complete qualifications and submit your application on geezjobs.com.`,
      requirements: [],
      benefits: [],
      easyApply: false,
      postingFeeEtb: 0,
      status: 'approved',
      createdAt: fetchedAt,
      publishedAt: undefined,
      sourceType: 'external',
      sourceSite: 'GeezJobs',
      sourceDomain: 'geezjobs.com',
      sourceUrl,
      fetchedAt,
      lastVerifiedAt: fetchedAt,
      verificationStatus: expired ? 'Expired' : 'Verified',
      isExpired: expired,
      isDemoSeed: false,
      fingerprint: buildContentFingerprint([title, companyName, 'geezjobs.com']),
    });
  }

  return results;
}

export interface EffoySiraPostItem {
  id: number | string;
  date?: string;
  link?: string;
  categories?: number[];
  title?: { rendered?: string };
  excerpt?: { rendered?: string };
  content?: { rendered?: string };
}

function extractEffoyCompany(title: string): string {
  const cleaned = title
    .replace(/\s+(job\s+vacancy|vacancy|careers|recruitment|jobs)\s*(\d{4})?.*$/i, '')
    .trim();
  return cleaned && cleaned.length >= 2 && cleaned.length < title.length
    ? cleaned
    : 'Not provided by source.';
}

export function parseEffoySiraPosts(
  posts: EffoySiraPostItem[],
  fetchedAt: string = new Date().toISOString()
): JobListing[] {
  if (!Array.isArray(posts)) return [];

  const results: JobListing[] = [];
  for (const post of posts) {
    const title = decodeHtmlEntities(stripHtmlToText(String(post.title?.rendered || ''))).trim();
    const sourceUrl = sanitizeHttpUrl(String(post.link || '').trim());
    if (!title || !sourceUrl) continue;

    const lowerTitle = title.toLowerCase();
    const isLikelyJob =
      lowerTitle.includes('vacancy') ||
      lowerTitle.includes('job') ||
      lowerTitle.includes('career') ||
      lowerTitle.includes('hiring') ||
      lowerTitle.includes('recruitment') ||
      lowerTitle.includes('position');
    if (!isLikelyJob) continue;

    const fullText = stripHtmlToText(
      String(post.content?.rendered || post.excerpt?.rendered || '')
    );
    const excerptText = stripHtmlToText(String(post.excerpt?.rendered || ''));
    const companyName = extractEffoyCompany(title);
    const publishedAt = post.date ? new Date(post.date).toISOString() : undefined;
    const category = normalizeCategoryFromText(`${title} ${excerptText}`);

    results.push({
      id: safeSlugId('ext-effoysira', String(post.id)),
      employerEmail: 'aggregator@effoysira.com',
      titleEn: title,
      companyName,
      companyRating: 0,
      location: 'Ethiopia',
      remoteType: 'On-site',
      category,
      jobType: 'Full-time',
      experienceLevel: 'Not provided by source.',
      salaryMin: 0,
      salaryMax: 0,
      salaryDisplay: 'Not provided by source.',
      deadline: 'Not provided by source.',
      summaryEn:
        excerptText.slice(0, 180) ||
        `${title}. Collected from EffoySira — open the original link on effoysira.com to apply.`,
      descriptionEn:
        fullText.slice(0, 2200) ||
        `${title}. Open the original announcement on EffoySira for full position details and application instructions.`,
      requirements: [],
      benefits: [],
      easyApply: false,
      postingFeeEtb: 0,
      status: 'approved',
      createdAt: publishedAt || fetchedAt,
      publishedAt,
      sourceType: 'external',
      sourceSite: 'EffoySira',
      sourceDomain: 'effoysira.com',
      sourceUrl,
      fetchedAt,
      lastVerifiedAt: fetchedAt,
      verificationStatus: 'Verified',
      isExpired: false,
      isDemoSeed: false,
      fingerprint: buildContentFingerprint([title, companyName, 'effoysira.com']),
    });
  }

  return results;
}

export function mergeExternalJobs(
  existingJobs: JobListing[],
  incomingExternalJobs: JobListing[]
): JobListing[] {
  const tatariJobs = existingJobs.filter((j) => j.sourceType !== 'external');
  const existingExternalByKey = new Map<string, JobListing>();

  for (const job of existingJobs) {
    if (job.sourceType === 'external') {
      const key = (job.sourceUrl || job.id).toLowerCase();
      existingExternalByKey.set(key, job);
    }
  }

  const seenIncomingKeys = new Set<string>();
  const mergedExternal: JobListing[] = [];

  for (const incoming of incomingExternalJobs) {
    const key = (incoming.sourceUrl || incoming.id).toLowerCase();
    if (seenIncomingKeys.has(key)) continue;
    seenIncomingKeys.add(key);

    const prior = existingExternalByKey.get(key);
    mergedExternal.push(
      prior
        ? {
            ...incoming,
            status: prior.status === 'paused' ? 'paused' : incoming.status,
          }
        : incoming
    );
  }

  if (mergedExternal.length === 0) {
    return existingJobs;
  }

  return [...tatariJobs, ...mergedExternal];
}
