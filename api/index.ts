import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

type VercelReq = IncomingMessage & {
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type VercelRes = ServerResponse & {
  status?: (code: number) => VercelRes;
  json?: (data: unknown) => void;
  send?: (data: unknown) => void;
};

type JobOrigin = 'external' | 'tatari';
type EmploymentType = 'Full-time' | 'Part-time' | 'Contract' | 'Internship' | 'Consultancy';

const STANDARD_CATEGORIES = [
  { slug: 'information-technology', name: 'Information Technology' },
  { slug: 'engineering', name: 'Engineering' },
  { slug: 'accounting-and-finance', name: 'Accounting and Finance' },
  { slug: 'business-and-management', name: 'Business and Management' },
  { slug: 'healthcare-and-medicine', name: 'Healthcare and Medicine' },
  { slug: 'education', name: 'Education' },
  { slug: 'marketing-and-sales', name: 'Marketing and Sales' },
  { slug: 'administration', name: 'Administration' },
  { slug: 'construction', name: 'Construction' },
  { slug: 'government-jobs', name: 'Government Jobs' },
  { slug: 'ngo-and-development', name: 'NGO and Development' },
  { slug: 'customer-service', name: 'Customer Service' },
  { slug: 'other', name: 'Other' },
] as const;

type CategorySlug = (typeof STANDARD_CATEGORIES)[number]['slug'];

const CATEGORY_KEYWORDS: Record<CategorySlug, string[]> = {
  'information-technology': [
    'software', 'developer', 'engineer', 'frontend', 'backend', 'fullstack',
    'full-stack', 'devops', 'cloud', 'cybersecurity', 'data analyst', 'data scientist',
    'it support', 'network administrator', 'system administrator', 'sysadmin',
    'mobile app', 'react', 'node.js', 'python', 'database', 'ict', 'ui/ux',
  ],
  engineering: [
    'mechanical engineer', 'electrical engineer', 'chemical engineer', 'industrial engineer',
    'telecom engineer', 'electromechanical', 'maintenance engineer', 'plant engineer',
    'biomedical engineer', 'water resources engineer', 'manufacturing',
  ],
  'accounting-and-finance': [
    'accountant', 'accounting', 'finance', 'auditor', 'audit', 'tax', 'payroll',
    'bookkeeper', 'treasury', 'banking', 'credit analyst', 'ifrs', 'cfo',
    'financial controller', 'cashier',
  ],
  'business-and-management': [
    'project manager', 'operations manager', 'general manager', 'business development',
    'strategy', 'supply chain', 'procurement', 'logistics', 'human resource',
    'hr manager', 'talent acquisition', 'monitoring and evaluation', 'm&e', 'chief of staff',
  ],
  'healthcare-and-medicine': [
    'physician', 'doctor', 'nurse', 'nursing', 'pharmacist', 'pharmacy', 'medical',
    'clinical', 'public health', 'midwife', 'laboratory technologist', 'radiologist',
    'hospital', 'epidemiologist',
  ],
  education: [
    'teacher', 'lecturer', 'professor', 'instructor', 'academic', 'school principal',
    'curriculum', 'tutor', 'training officer', 'university', 'faculty',
  ],
  'marketing-and-sales': [
    'marketing', 'sales', 'brand manager', 'digital marketing', 'social media',
    'account executive', 'merchandising', 'distribution', 'territory manager',
    'promotion', 'copywriter',
  ],
  administration: [
    'administrative assistant', 'office administrator', 'executive assistant', 'secretary',
    'receptionist', 'office manager', 'record officer', 'archivist', 'clerical',
    'fleet coordinator',
  ],
  construction: [
    'civil engineer', 'site engineer', 'structural engineer', 'quantity surveyor',
    'architect', 'construction', 'autocad', 'building', 'highway', 'geotechnical',
    'foreman', 'urban planner',
  ],
  'government-jobs': [
    'ministry', 'civil service', 'federal', 'municipality', 'public sector',
    'government', 'revenue authority', 'ethiopian airlines', 'ethiotelecom',
    'regional bureau', 'woreda',
  ],
  'ngo-and-development': [
    'ngo', 'unicef', 'undp', 'usaid', 'humanitarian', 'wash', 'livelihood',
    'relief', 'refugee', 'non-governmental', 'international development',
    'grant officer', 'field coordinator', 'protection officer',
  ],
  'customer-service': [
    'customer service', 'call center', 'contact center', 'client support',
    'helpdesk', 'front desk', 'customer care', 'teller', 'branch officer',
  ],
  other: [],
};

function categorizeJob(title: string, description: string, hintedCategory?: string): CategorySlug {
  const hint = (hintedCategory || '').trim().toLowerCase();
  if (hint) {
    const direct = STANDARD_CATEGORIES.find(
      (c) => c.slug === hint || c.name.toLowerCase() === hint
    );
    if (direct && direct.slug !== 'other') return direct.slug;
  }

  const titleLower = title.toLowerCase();
  const bodyLower = `${titleLower} ${description.toLowerCase()}`;
  let bestSlug: CategorySlug = 'other';
  let bestScore = 0;

  for (const cat of STANDARD_CATEGORIES) {
    if (cat.slug === 'other') continue;
    let score = 0;
    for (const kw of CATEGORY_KEYWORDS[cat.slug]) {
      if (titleLower.includes(kw)) score += 3;
      else if (bodyLower.includes(kw)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestSlug = cat.slug;
    }
  }
  return bestSlug;
}

function normalizeEmploymentType(raw?: string): EmploymentType {
  const text = (raw || '').toLowerCase().trim();
  if (text.includes('part')) return 'Part-time';
  if (text.includes('intern') || text.includes('trainee') || text.includes('graduate')) return 'Internship';
  if (text.includes('consult')) return 'Consultancy';
  if (text.includes('contract') || text.includes('fixed') || text.includes('temp')) return 'Contract';
  return 'Full-time';
}

function parseSalaryRange(raw?: string): { salaryMin: number | null; salaryMax: number | null } {
  if (!raw) return { salaryMin: null, salaryMax: null };
  const cleaned = raw.replace(/,/g, '');
  const matches = cleaned.match(/\d{3,8}/g);
  if (!matches || matches.length === 0) return { salaryMin: null, salaryMax: null };
  const nums = matches.map((m) => Number(m)).filter((n) => Number.isFinite(n) && n > 0);
  if (nums.length === 0) return { salaryMin: null, salaryMax: null };
  if (nums.length === 1) return { salaryMin: nums[0], salaryMax: nums[0] };
  return { salaryMin: Math.min(nums[0], nums[1]), salaryMax: Math.max(nums[0], nums[1]) };
}

function normalizeTextForKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function computeDedupeKey(params: {
  sourceId: number | null;
  originalJobIdentifier?: string | null;
  originalJobUrl?: string | null;
  title: string;
  companyName: string;
  location: string;
}): string {
  return `${normalizeTextForKey(params.title)}::${normalizeTextForKey(params.companyName)}::${normalizeTextForKey(params.location || 'ethiopia')}`;
}

function buildJobSlug(title: string, companyName: string, uniqueToken?: number | string): string {
  const base = `${title} ${companyName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  return uniqueToken !== undefined && uniqueToken !== null ? `${base}-${uniqueToken}` : base;
}

function isExpiredJob(expiresAtIso?: string | null, deadlineIso?: string | null, now = new Date()): boolean {
  const checkDate = expiresAtIso || deadlineIso;
  if (!checkDate) return false;
  const parsed = new Date(checkDate);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() < now.getTime();
}

function isExpiringSoon(deadlineIso?: string | null, now = new Date(), windowDays = 5): boolean {
  if (!deadlineIso) return false;
  const parsed = new Date(deadlineIso);
  if (Number.isNaN(parsed.getTime())) return false;
  const diffMs = parsed.getTime() - now.getTime();
  return diffMs > 0 && diffMs <= windowDays * 86400000;
}

interface ParsedExternalJob {
  originalJobIdentifier: string;
  originalJobUrl: string;
  title: string;
  companyName: string;
  companyLogo: string | null;
  location: string;
  description: string;
  categoryHint?: string;
  employmentType: EmploymentType;
  salaryMin: number | null;
  salaryMax: number | null;
  applicationDeadline: string | null;
  publishedAt: string;
  expiresAt: string | null;
}

function stripHtml(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveJobUrl(rawUrl: string | undefined | null, fallbackBaseUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return fallbackBaseUrl;
  try {
    return new URL(trimmed, fallbackBaseUrl).toString();
  } catch {
    return fallbackBaseUrl;
  }
}

function inferDeadlineFromClosingText(text: string): string {
  const daysMatch = text.match(/(\d+)\s*day/i);
  if (daysMatch) {
    return new Date(Date.now() + Math.max(1, Number(daysMatch[1])) * 86400000).toISOString();
  }
  const cleaned = text.replace(/^deadline\s*:\s*/i, '').trim();
  if (cleaned && !Number.isNaN(Date.parse(cleaned))) {
    return new Date(cleaned).toISOString();
  }
  return new Date(Date.now() + 14 * 86400000).toISOString();
}

function parseRssXmlFeed(xmlText: string, fallbackBaseUrl: string): ParsedExternalJob[] {
  const $ = cheerio.load(xmlText, { xmlMode: true });
  const results: ParsedExternalJob[] = [];
  const items = $('item').length > 0 ? $('item') : $('entry');
  items.each((idx, el) => {
    const node = $(el);
    const title = node.find('title').first().text().trim();
    const rawLink =
      node.find('link[rel="alternate"]').first().attr('href') ||
      node.find('link').first().attr('href') ||
      node.find('link').first().text().trim() ||
      '';
    const link = resolveJobUrl(rawLink, fallbackBaseUrl);
    const guid =
      node.find('guid').first().text().trim() ||
      node.find('id').first().text().trim() ||
      link ||
      `item-${idx}`;
    const rawDesc =
      node.find('description').first().text() ||
      node.find('summary').first().text() ||
      node.find('content').first().text() ||
      '';
    const description = stripHtml(rawDesc);
    const companyName =
      node.find('company').first().text().trim() ||
      node.find('author > name').first().text().trim() ||
      node.find('author').first().text().trim() ||
      'Ethiopian Employer';
    const location = node.find('location').first().text().trim() || 'Addis Ababa, Ethiopia';
    const categoryHint = node.find('category').first().text().trim() || undefined;
    const empTypeRaw =
      node.find('employmentType').first().text().trim() ||
      node.find('type').first().text().trim();
    const salaryRaw = node.find('salary').first().text().trim();
    const { salaryMin, salaryMax } = parseSalaryRange(salaryRaw || description);
    const pubRaw =
      node.find('pubDate').first().text().trim() ||
      node.find('published').first().text().trim() ||
      node.find('updated').first().text().trim();
    const publishedAt =
      pubRaw && !Number.isNaN(Date.parse(pubRaw))
        ? new Date(pubRaw).toISOString()
        : new Date().toISOString();
    const deadlineRaw =
      node.find('deadline').first().text().trim() ||
      node.find('expiresAt').first().text().trim();
    const applicationDeadline =
      deadlineRaw && !Number.isNaN(Date.parse(deadlineRaw))
        ? new Date(deadlineRaw).toISOString()
        : new Date(Date.now() + 14 * 86400000).toISOString();

    if (title && link) {
      results.push({
        originalJobIdentifier: guid,
        originalJobUrl: link,
        title,
        companyName,
        companyLogo: node.find('logo').first().text().trim() || null,
        location,
        description: description || `${title} position at ${companyName} in ${location}.`,
        categoryHint,
        employmentType: normalizeEmploymentType(empTypeRaw || description),
        salaryMin,
        salaryMax,
        applicationDeadline,
        publishedAt,
        expiresAt: applicationDeadline,
      });
    }
  });
  return results;
}

function parseJsonFeed(payload: unknown, fallbackBaseUrl: string): ParsedExternalJob[] {
  const list = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as { jobs?: unknown[] }).jobs)
      ? (payload as { jobs: unknown[] }).jobs
      : payload && typeof payload === 'object' && Array.isArray((payload as { items?: unknown[] }).items)
        ? (payload as { items: unknown[] }).items
        : [];
  const results: ParsedExternalJob[] = [];
  for (const entry of list) {
    const raw = entry as Record<string, unknown>;
    if (!raw || typeof raw !== 'object') continue;
    const title = String(raw.title || '').trim();
    const rawUrl = String(raw.original_job_url || raw.apply_url || raw.url || raw.link || '').trim();
    const originalJobUrl = resolveJobUrl(rawUrl, fallbackBaseUrl);
    if (!title || !originalJobUrl) continue;

    const companyName = String(raw.company || raw.company_name || 'Ethiopian Employer').trim();
    const location = String(raw.location || 'Addis Ababa, Ethiopia').trim();
    const description = stripHtml(String(raw.description || raw.summary || `${title} at ${companyName}`));
    const salaryInfo =
      raw.salary_min || raw.salary_max
        ? {
            salaryMin: raw.salary_min ? Number(raw.salary_min) : null,
            salaryMax: raw.salary_max ? Number(raw.salary_max) : null,
          }
        : parseSalaryRange(String(raw.salary || description));
    const publishedAt =
      raw.published_at && !Number.isNaN(Date.parse(String(raw.published_at)))
        ? new Date(String(raw.published_at)).toISOString()
        : new Date().toISOString();
    const applicationDeadline =
      raw.deadline && !Number.isNaN(Date.parse(String(raw.deadline)))
        ? new Date(String(raw.deadline)).toISOString()
        : new Date(Date.now() + 14 * 86400000).toISOString();

    results.push({
      originalJobIdentifier: String(raw.id || raw.external_id || originalJobUrl),
      originalJobUrl,
      title,
      companyName,
      companyLogo: raw.company_logo ? String(raw.company_logo) : null,
      location,
      description,
      categoryHint: raw.category ? String(raw.category) : undefined,
      employmentType: normalizeEmploymentType(String(raw.employment_type || raw.type || description)),
      salaryMin: salaryInfo.salaryMin,
      salaryMax: salaryInfo.salaryMax,
      applicationDeadline,
      publishedAt,
      expiresAt: applicationDeadline,
    });
  }
  return results;
}

function parseEthiojobsNextData(htmlText: string, baseWebsiteUrl: string): ParsedExternalJob[] {
  const $ = cheerio.load(htmlText);
  const nextRaw = $('#__NEXT_DATA__').text().trim();
  if (!nextRaw) return [];
  try {
    const parsed = JSON.parse(nextRaw) as {
      props?: { pageProps?: { jobs?: { data?: Array<Record<string, unknown>> } } };
    };
    const list = parsed?.props?.pageProps?.jobs?.data;
    if (!Array.isArray(list)) return [];
    const results: ParsedExternalJob[] = [];
    for (const item of list) {
      const title = String(item.title || '').trim();
      const slug = String(item.slug || '').trim();
      if (!title || !slug) continue;
      const companyObj = (item.company || {}) as Record<string, unknown>;
      const companyName = String(companyObj.name || 'Ethiopian Employer').trim();
      const companyLogo = companyObj.logo
        ? resolveJobUrl(`/storage/${String(companyObj.logo).replace(/^\/+/, '')}`, baseWebsiteUrl)
        : null;
      const location = String(item.state || item.location || 'Addis Ababa, Ethiopia').trim();
      const description = stripHtml(String(item.description || `${title} at ${companyName}`)).slice(0, 1800).trim();
      const catalogs = Array.isArray(item.catalogs) ? (item.catalogs as Array<{ name?: string }>) : [];
      const publishedAt =
        item.date_published && !Number.isNaN(Date.parse(String(item.date_published)))
          ? new Date(String(item.date_published)).toISOString()
          : new Date().toISOString();
      const applicationDeadline =
        item.date_expiry && !Number.isNaN(Date.parse(String(item.date_expiry)))
          ? new Date(String(item.date_expiry)).toISOString()
          : new Date(Date.now() + 14 * 86400000).toISOString();
      results.push({
        originalJobIdentifier: `ethiojobs-${slug}`,
        originalJobUrl: resolveJobUrl(`/job/${encodeURIComponent(slug)}`, baseWebsiteUrl),
        title,
        companyName,
        companyLogo,
        location,
        description: description || `${title} at ${companyName} (${location}).`,
        categoryHint: catalogs[0]?.name ? String(catalogs[0].name) : undefined,
        employmentType: normalizeEmploymentType(`${String(item.location_type || '')} ${description}`),
        ...parseSalaryRange(description),
        applicationDeadline,
        publishedAt,
        expiresAt: applicationDeadline,
      });
    }
    return results;
  } catch {
    return [];
  }
}

function parseHtmlDirectory(htmlText: string, baseWebsiteUrl: string): ParsedExternalJob[] {
  if (baseWebsiteUrl.includes('ethiojobs.net') || htmlText.includes('__NEXT_DATA__')) {
    const nextJobs = parseEthiojobsNextData(htmlText, baseWebsiteUrl);
    if (nextJobs.length > 0) return nextJobs;
  }

  const $ = cheerio.load(htmlText);
  const results: ParsedExternalJob[] = [];
  const seenUrls = new Set<string>();
  const pushUnique = (job: ParsedExternalJob) => {
    if (seenUrls.has(job.originalJobUrl)) return;
    seenUrls.add(job.originalJobUrl);
    results.push(job);
  };

  if (baseWebsiteUrl.includes('geezjobs.com') || $('a[href^="/job-detail/"]').length > 0) {
    $('a[href^="/job-detail/"]').each((_idx, el) => {
      const node = $(el);
      const href = node.attr('href') || '';
      const title = (node.attr('data-title') || node.find('h2, h3, .font-bold, .font-semibold').first().text() || node.text()).trim();
      if (!href || !title) return;
      const companyName = (node.attr('data-company') || 'Ethiopian Employer').trim();
      const location = (node.attr('data-city') || 'Addis Ababa, Ethiopia').trim();
      const empTypeRaw = node.attr('data-type') || 'Full-time';
      const closingRaw = node.attr('data-closing') || '';
      const deadline = inferDeadlineFromClosingText(closingRaw);
      pushUnique({
        originalJobIdentifier: `geezjobs-${href.replace(/^\/+/, '')}`,
        originalJobUrl: resolveJobUrl(href, baseWebsiteUrl),
        title,
        companyName,
        companyLogo: null,
        location,
        description: `${title} position at ${companyName} in ${location} (${empTypeRaw}). Listed on GeezJobs${closingRaw ? ` — ${closingRaw}` : ''}.`,
        employmentType: normalizeEmploymentType(empTypeRaw),
        salaryMin: null,
        salaryMax: null,
        applicationDeadline: deadline,
        publishedAt: new Date().toISOString(),
        expiresAt: deadline,
      });
    });
    if (results.length > 0) return results;
  }

  if (baseWebsiteUrl.includes('ezega.com') || $('a[href*="/Jobs/viewjobposting/"]').length > 0) {
    $('a[href*="/Jobs/viewjobposting/"]').each((_idx, el) => {
      const node = $(el);
      const href = node.attr('href') || '';
      const title = node.text().trim();
      if (!href || !title) return;
      const row = node.parent().parent();
      const cols = row.children('div');
      const dateStr = cols.eq(0).text().trim();
      const companyName = cols.eq(2).text().trim() || 'Ethiopian Employer';
      const location = cols.eq(3).text().trim() || 'Addis Ababa, Ethiopia';
      const publishedAt =
        dateStr && !Number.isNaN(Date.parse(dateStr))
          ? new Date(dateStr).toISOString()
          : new Date().toISOString();
      const deadline = new Date(Date.parse(publishedAt) + 14 * 86400000).toISOString();
      pushUnique({
        originalJobIdentifier: `ezega-${href.replace(/^\/+/, '')}`,
        originalJobUrl: resolveJobUrl(href, baseWebsiteUrl),
        title,
        companyName,
        companyLogo: null,
        location,
        description: `${title} vacancy at ${companyName} in ${location}, published on Ezega Jobs (${dateStr || 'Recent'}).`,
        employmentType: normalizeEmploymentType(title),
        salaryMin: null,
        salaryMax: null,
        applicationDeadline: deadline,
        publishedAt,
        expiresAt: deadline,
      });
    });
    if (results.length > 0) return results;
  }

  if (baseWebsiteUrl.includes('ethiopianwork.com') || $('.job-card__title').length > 0) {
    $('.job-card').each((idx, el) => {
      const node = $(el);
      const titleAnchor = node.find('a.job-card__title, a[href*="/job/"]').first();
      const href = titleAnchor.attr('href') || '';
      const title = titleAnchor.text().trim();
      if (!href || !title) return;
      const companyName = node.find('.job-card__company').first().text().trim() || 'Ethiopian Employer';
      const badges = node.find('.job-card__meta .badge').map((_, b) => $(b).text().trim()).get();
      const location = badges[0] || 'Addis Ababa, Ethiopia';
      const empRaw = badges[1] || 'Full-time';
      const deadlineText = node.find('.job-card__deadline').first().text().trim();
      const deadline = inferDeadlineFromClosingText(deadlineText);
      pushUnique({
        originalJobIdentifier: `ethiopianwork-${href.split('/').filter(Boolean).pop() || idx}`,
        originalJobUrl: resolveJobUrl(href, baseWebsiteUrl),
        title,
        companyName,
        companyLogo: null,
        location,
        description: `${title} at ${companyName} (${location} · ${empRaw}). ${deadlineText ? deadlineText + '.' : ''}`.trim(),
        employmentType: normalizeEmploymentType(empRaw),
        salaryMin: null,
        salaryMax: null,
        applicationDeadline: deadline,
        publishedAt: new Date().toISOString(),
        expiresAt: deadline,
      });
    });
    if (results.length > 0) return results;
  }

  return results;
}

function buildJobPostingJsonLd(
  job: {
    slug: string;
    title: string;
    description: string;
    companyName: string;
    location: string;
    employmentType: string;
    publishedAt: string;
    expiresAt?: string | null;
    salaryMin?: number | null;
    salaryMax?: number | null;
    salaryCurrency?: string;
    jobOrigin: JobOrigin;
    status: string;
  },
  baseUrl: string
): Record<string, unknown> | null {
  if (job.jobOrigin !== 'tatari' || job.status !== 'active') return null;
  if (isExpiredJob(job.expiresAt, job.expiresAt)) return null;

  const mappedType =
    job.employmentType === 'Full-time'
      ? 'FULL_TIME'
      : job.employmentType === 'Part-time'
        ? 'PART_TIME'
        : job.employmentType === 'Internship'
          ? 'INTERN'
          : 'CONTRACTOR';

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description,
    datePosted: job.publishedAt,
    employmentType: mappedType,
    hiringOrganization: { '@type': 'Organization', name: job.companyName },
    jobLocation: {
      '@type': 'Place',
      address: { '@type': 'PostalAddress', addressLocality: job.location, addressCountry: 'ET' },
    },
    url: `${baseUrl.replace(/\/$/, '')}/jobs/${job.slug}`,
  };
  if (job.expiresAt) schema.validThrough = job.expiresAt;
  if (job.salaryMin) {
    schema.baseSalary = {
      '@type': 'MonetaryAmount',
      currency: job.salaryCurrency || 'ETB',
      value: {
        '@type': 'QuantitativeValue',
        minValue: job.salaryMin,
        maxValue: job.salaryMax || job.salaryMin,
        unitText: 'MONTH',
      },
    };
  }
  return schema;
}

interface ServerlessUser {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'employer' | 'seeker';
  company_name: string | null;
  business_tin: string | null;
  status: 'approved' | 'pending' | 'suspended';
  failed_attempts: number;
  locked_until: string | null;
  created_at: string;
}

interface ServerlessSource {
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
  last_run_status: string | null;
}

interface ServerlessJob {
  id: number;
  slug: string;
  title: string;
  company_name: string;
  company_logo: string | null;
  location: string;
  description: string;
  category_id: number;
  category_name: string;
  category_slug: string;
  employment_type: EmploymentType;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  application_deadline: string | null;
  source_id: number | null;
  source_name: string | null;
  source_website_url: string | null;
  original_job_url: string | null;
  job_origin: JobOrigin;
  original_job_identifier: string | null;
  dedupe_key: string;
  published_at: string;
  expires_at: string | null;
  status: 'active' | 'pending_review' | 'rejected' | 'expired';
  is_featured: number;
  employer_id: number | null;
  payment_status: string;
  payment_method: string | null;
  payment_ref: string | null;
  rejection_reason: string | null;
  views_count: number;
  created_at: string;
  updated_at: string;
}

interface ServerlessLog {
  id: number;
  source_id: number;
  source_name: string;
  collection_method: string;
  collection_started_at: string;
  collection_completed_at: string | null;
  jobs_found: number;
  jobs_added: number;
  jobs_updated: number;
  duplicates_found: number;
  errors: string | null;
  collection_status: 'success' | 'partial' | 'failed' | 'running';
}

interface ServerlessProduct {
  id: number;
  title: string;
  category: string;
  description: string;
  price_etb: number;
  format_info: string;
  image_url: string;
  deliverable_content: string;
  status: string;
  created_at: string;
}

interface ServerlessOrder {
  id: number;
  product_id: number;
  product_title: string;
  format_info: string;
  product_category: string;
  user_id: number;
  buyer_name: string;
  buyer_email: string;
  payment_method: string;
  payment_ref: string;
  receipt_note: string | null;
  amount_etb: number;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
  verified_at: string | null;
}

interface ServerlessApplication {
  id: number;
  job_id: number;
  job_title: string;
  company_name: string;
  location: string;
  slug: string;
  seeker_id: number | null;
  applicant_name: string;
  applicant_email: string;
  applicant_phone: string;
  cover_note: string;
  cv_summary: string;
  status: string;
  created_at: string;
}

interface ServerlessAlert {
  id: number;
  user_id: number;
  email: string;
  category_id: number | null;
  category_name: string | null;
  location: string | null;
  keywords: string | null;
  job_origin_pref: 'all' | 'external' | 'tatari';
  frequency: 'instant' | 'daily';
  active: number;
  created_at: string;
}

interface ServerlessNotification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  link_slug: string | null;
  is_read: number;
  created_at: string;
}

const PASSWORD_SALT = process.env.TATARI_AUTH_SALT || 'tatari-ethiopia-2026-salt';
const TOKEN_SECRET = process.env.TATARI_TOKEN_SECRET || 'tatari-hmac-secret-2026';
const USER_AGENT = 'Mozilla/5.0 (compatible; TatariJobAggregator/1.0; +https://tatari.et)';
const COLLECT_TTL_MS = 10 * 60 * 1000;

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(`${PASSWORD_SALT}:${password}`).digest('hex');
}

function signToken(userId: number, role: string): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, role, exp: Date.now() + 7 * 86400 * 1000 })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token: string): { uid: number; role: string } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  if (sig !== expected) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!parsed.uid || !parsed.exp || parsed.exp < Date.now()) return null;
    return { uid: Number(parsed.uid), role: String(parsed.role) };
  } catch {
    return null;
  }
}

function getSupabaseServerClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key || !url.startsWith('http') || url.includes('MY_SUPABASE')) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

interface MemoryStore {
  nextId: number;
  categories: Array<{ id: number; name: string; slug: string }>;
  sources: ServerlessSource[];
  users: ServerlessUser[];
  jobs: ServerlessJob[];
  logs: ServerlessLog[];
  products: ServerlessProduct[];
  orders: ServerlessOrder[];
  applications: ServerlessApplication[];
  savedJobs: Array<{ user_id: number; job_id: number }>;
  alerts: ServerlessAlert[];
  notifications: ServerlessNotification[];
  lastCollectedMs: number;
  collectingPromise: Promise<void> | null;
}

function createInitialStore(): MemoryStore {
  const now = new Date();
  const nowIso = now.toISOString();
  const dayMs = 86400000;

  const categories = STANDARD_CATEGORIES.map((c, i) => ({ id: i + 1, name: c.name, slug: c.slug }));
  const catBySlug = new Map(categories.map((c) => [c.slug, c]));

  const users: ServerlessUser[] = [
    {
      id: 1,
      name: 'Selamawit Tadesse (Admin)',
      email: 'admin@tatari.et',
      password_hash: hashPassword('TatariAdmin#2026'),
      role: 'admin',
      company_name: 'TATARI Platform Operations',
      business_tin: null,
      status: 'approved',
      failed_attempts: 0,
      locked_until: null,
      created_at: nowIso,
    },
    {
      id: 2,
      name: 'Dawit Bekele',
      email: 'hr@addistech.et',
      password_hash: hashPassword('Employer@2026'),
      role: 'employer',
      company_name: 'AddisTech Solutions PLC',
      business_tin: 'TIN-0048291034',
      status: 'approved',
      failed_attempts: 0,
      locked_until: null,
      created_at: nowIso,
    },
    {
      id: 3,
      name: 'Abebe Kebede',
      email: 'abebe@tatari.et',
      password_hash: hashPassword('Seeker@2026'),
      role: 'seeker',
      company_name: null,
      business_tin: null,
      status: 'approved',
      failed_attempts: 0,
      locked_until: null,
      created_at: nowIso,
    },
  ];

  const sources: ServerlessSource[] = [
    {
      id: 1,
      source_name: 'Ethiojobs',
      website_url: 'https://ethiojobs.net',
      feed_url: 'https://ethiojobs.net/jobs',
      collection_method: 'html_directory',
      collection_frequency: 'every_6h',
      status: 'active',
      robots_respect: 1,
      rate_limit_ms: 1000,
      last_collected_at: null,
      last_run_status: null,
    },
    {
      id: 2,
      source_name: 'GeezJobs',
      website_url: 'https://geezjobs.com',
      feed_url: 'https://geezjobs.com/jobs-in-ethiopia',
      collection_method: 'html_directory',
      collection_frequency: 'every_6h',
      status: 'active',
      robots_respect: 1,
      rate_limit_ms: 1200,
      last_collected_at: null,
      last_run_status: null,
    },
    {
      id: 3,
      source_name: 'Ezega Jobs',
      website_url: 'https://www.ezega.com',
      feed_url: 'https://www.ezega.com/jobs/AllPostedJobs',
      collection_method: 'html_directory',
      collection_frequency: 'every_6h',
      status: 'active',
      robots_respect: 1,
      rate_limit_ms: 1200,
      last_collected_at: null,
      last_run_status: null,
    },
    {
      id: 4,
      source_name: 'EthiopianWork',
      website_url: 'https://ethiopianwork.com',
      feed_url: 'https://ethiopianwork.com/jobs',
      collection_method: 'html_directory',
      collection_frequency: 'every_6h',
      status: 'active',
      robots_respect: 1,
      rate_limit_ms: 1200,
      last_collected_at: null,
      last_run_status: null,
    },
  ];

  const nativeTemplates = [
    {
      title: 'Senior Full-Stack TypeScript Engineer',
      company: 'AddisTech Solutions PLC',
      location: 'Addis Ababa (Bole)',
      description:
        'Lead architecture and delivery of enterprise financial and logistics web platforms serving Ethiopian SMEs. Requirements: 4+ years with React, Node.js, PostgreSQL/SQLite, REST API security, and bilingual localization workflows. Competitive salary, medical coverage, and hybrid flexibility.',
      employmentType: 'Full-time' as const,
      salaryMin: 55000,
      salaryMax: 85000,
      deadlineDays: 16,
      publishedDaysAgo: 0,
      featured: 1,
      paymentMethod: 'Telebirr',
      paymentRef: 'TB-99482104',
    },
    {
      title: 'IFRS Senior Financial Accountant',
      company: 'Zemen Logistics & Freight S.C.',
      location: 'Addis Ababa (Kazanchis)',
      description:
        'Manage monthly IFRS reporting, Ministry of Revenue VAT & withholding tax filings, payroll reconciliation, and annual external audit readiness. Bachelor degree in Accounting & Finance plus 5 years relevant experience required.',
      employmentType: 'Full-time' as const,
      salaryMin: 32000,
      salaryMax: 44000,
      deadlineDays: 3,
      publishedDaysAgo: 2,
      featured: 1,
      paymentMethod: 'CBE Bank Transfer',
      paymentRef: 'CBE-77210945',
    },
    {
      title: 'Digital Growth & B2B Sales Lead',
      company: 'Kifiya Digital Commerce Partner',
      location: 'Addis Ababa (Mexico)',
      description:
        'Own merchant onboarding campaigns across Addis Ababa, Adama, and Hawassa. Coordinate field sales teams, track CRM conversion pipelines, and run merchant training workshops.',
      employmentType: 'Full-time' as const,
      salaryMin: 28000,
      salaryMax: 40000,
      deadlineDays: 12,
      publishedDaysAgo: 1,
      featured: 0,
      paymentMethod: 'Telebirr',
      paymentRef: 'TB-88120933',
    },
  ];

  const jobs: ServerlessJob[] = nativeTemplates.map((j, idx) => {
    const id = idx + 1;
    const catSlug = categorizeJob(j.title, j.description);
    const cat = catBySlug.get(catSlug) || catBySlug.get('other')!;
    const pubDate = new Date(now.getTime() - j.publishedDaysAgo * dayMs).toISOString();
    const deadlineDate = new Date(now.getTime() + j.deadlineDays * dayMs).toISOString();
    return {
      id,
      slug: buildJobSlug(j.title, j.company, id),
      title: j.title,
      company_name: j.company,
      company_logo: null,
      location: j.location,
      description: j.description,
      category_id: cat.id,
      category_name: cat.name,
      category_slug: cat.slug,
      employment_type: j.employmentType,
      salary_min: j.salaryMin,
      salary_max: j.salaryMax,
      salary_currency: 'ETB',
      application_deadline: deadlineDate,
      source_id: null,
      source_name: null,
      source_website_url: null,
      original_job_url: null,
      job_origin: 'tatari',
      original_job_identifier: null,
      dedupe_key: computeDedupeKey({
        sourceId: null,
        originalJobIdentifier: null,
        originalJobUrl: null,
        title: j.title,
        companyName: j.company,
        location: j.location,
      }),
      published_at: pubDate,
      expires_at: deadlineDate,
      status: 'active',
      is_featured: j.featured,
      employer_id: 2,
      payment_status: 'verified',
      payment_method: j.paymentMethod,
      payment_ref: j.paymentRef,
      rejection_reason: null,
      views_count: 0,
      created_at: pubDate,
      updated_at: nowIso,
    };
  });

  const products: ServerlessProduct[] = [
    {
      id: 1,
      title: 'Ethiopian Payroll & Tax Compliance Calculator 2026',
      category: 'Finance & Payroll',
      description:
        'Automated Excel/CSV payroll schedule with Ethiopian progressive income tax brackets, 7%/11% pension deductions, overtime multipliers, and Ministry of Revenue summary sheets.',
      price_etb: 650,
      format_info: 'XLSX + CSV + Tax Guide PDF',
      image_url: '/src/assets/images/store_payroll_kit_1795090975036.jpg',
      deliverable_content:
        'TATARI CERTIFIED PAYROLL BRACKETS (ETB)\n0 - 600: 0%\n601 - 1,650: 10% (-60)\n1,651 - 3,200: 15% (-142.50)\n3,201 - 5,250: 20% (-302.50)\n5,251 - 7,800: 25% (-565)\n7,801 - 10,900: 30% (-955)\nAbove 10,900: 35% (-1,500)\nPension: Employee 7% / Employer 11%',
      status: 'active',
      created_at: nowIso,
    },
    {
      id: 2,
      title: 'Ethiopian Labor Law HR Policy & Contract Kit',
      category: 'HR & Legal',
      description:
        'Bilingual (English & Amharic) employment contracts aligned with Proclamation No. 1156/2019, probation evaluation rubrics, leave policies, and disciplinary templates.',
      price_etb: 890,
      format_info: 'DOCX + PDF Bundle (24 Templates)',
      image_url: '/src/assets/images/store_hr_bundle_1795090940161.jpg',
      deliverable_content:
        'TATARI HR POLICY & PROCLAMATION 1156/2019 KIT\nIncludes: Indefinite & Definite-Term Employment Contracts, 60-Day Probation Review Form, Annual & Maternity Leave Ledger, and Workplace Grievance SOP.',
      status: 'active',
      created_at: nowIso,
    },
    {
      id: 3,
      title: 'Executive CV, Cover Letter & Interview Pack',
      category: 'Career Toolkits',
      description:
        'ATS-optimized resume templates tailored for Ethiopian NGOs, commercial banks, and tech firms, plus structured STAR interview answer frameworks.',
      price_etb: 350,
      format_info: 'DOCX + Figma + Checklist PDF',
      image_url: '/src/assets/images/store_career_cv_1795090940993.jpg',
      deliverable_content:
        'TATARI CAREER TOOLKIT\nIncludes: 5 ATS-Safe Resume Layouts, NGO/UN Competency Statement Guide, Ethiopian Banking Interview Prep (60 Q&As).',
      status: 'active',
      created_at: nowIso,
    },
    {
      id: 4,
      title: 'Public & NGO Tender Bid Compliance Pack',
      category: 'Procurement & Tenders',
      description:
        'Complete technical and financial bid response templates structured for Ethiopian public procurement and international NGO tenders.',
      price_etb: 1200,
      format_info: 'DOCX + XLSX BOQ + Checklist',
      image_url: '/src/assets/images/store_tender_pack_1795090940763.jpg',
      deliverable_content:
        'TATARI TENDER COMPLIANCE PACK\nIncludes: Technical Methodology Outline, BOQ Pricing Matrix, Bid Bond & Tax Clearance Checklist.',
      status: 'active',
      created_at: nowIso,
    },
  ];

  const orders: ServerlessOrder[] = [
    {
      id: 1,
      product_id: 1,
      product_title: products[0].title,
      format_info: products[0].format_info,
      product_category: products[0].category,
      user_id: 3,
      buyer_name: 'Abebe Kebede',
      buyer_email: 'abebe@tatari.et',
      payment_method: 'Telebirr',
      payment_ref: 'TB-4402918',
      receipt_note: 'Paid via Telebirr mobile app',
      amount_etb: 650,
      status: 'approved',
      rejection_reason: null,
      created_at: nowIso,
      verified_at: nowIso,
    },
  ];

  const itCat = catBySlug.get('information-technology')!;
  const alerts: ServerlessAlert[] = [
    {
      id: 1,
      user_id: 3,
      email: 'abebe@tatari.et',
      category_id: itCat.id,
      category_name: itCat.name,
      location: 'Addis Ababa',
      keywords: 'Engineer',
      job_origin_pref: 'all',
      frequency: 'instant',
      active: 1,
      created_at: nowIso,
    },
  ];

  const notifications: ServerlessNotification[] = [
    {
      id: 1,
      user_id: 3,
      title: 'New IT Job Match in Addis Ababa',
      message: 'Senior Full-Stack TypeScript Engineer at AddisTech Solutions PLC matches your alert.',
      link_slug: jobs[0].slug,
      is_read: 0,
      created_at: nowIso,
    },
  ];

  return {
    nextId: 1000,
    categories,
    sources,
    users,
    jobs,
    logs: [],
    products,
    orders,
    applications: [],
    savedJobs: [],
    alerts,
    notifications,
    lastCollectedMs: 0,
    collectingPromise: null,
  };
}

const g = globalThis as unknown as { __tatariMemoryStore?: MemoryStore };
const store: MemoryStore = g.__tatariMemoryStore ?? createInitialStore();
g.__tatariMemoryStore = store;

async function verifyUrlIsLiveFast(url: string): Promise<boolean> {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    let res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,*/*' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      const getController = new AbortController();
      const getTimer = setTimeout(() => getController.abort(), 3500);
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

async function collectSingleSource(source: ServerlessSource, autoApprove = true) {
  const startedAt = new Date().toISOString();
  const catBySlug = new Map(store.categories.map((c) => [c.slug, c]));

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(source.feed_url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/rss+xml, application/xml, application/json, text/html, */*',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const text = await res.text();
    const contentType = res.headers.get('content-type') || '';

    let parsed: ParsedExternalJob[] = [];
    if (source.collection_method === 'json_api' || contentType.includes('application/json')) {
      parsed = parseJsonFeed(JSON.parse(text), source.website_url);
    } else if (
      source.collection_method === 'rss' ||
      contentType.includes('xml') ||
      text.trim().startsWith('<?xml')
    ) {
      parsed = parseRssXmlFeed(text, source.website_url);
    } else {
      parsed = parseHtmlDirectory(text, source.website_url);
    }

    const candidates = parsed
      .filter((item) => !isExpiredJob(item.expiresAt, item.applicationDeadline))
      .slice(0, 10);

    const checks = await Promise.all(
      candidates.map(async (item) => ({
        item,
        live: await verifyUrlIsLiveFast(item.originalJobUrl),
      }))
    );

    const verifiedItems = checks.filter((c) => c.live).map((c) => c.item);
    let jobsAdded = 0;
    let jobsUpdated = 0;
    let duplicatesFound = 0;
    const nowIso = new Date().toISOString();

    for (const item of verifiedItems) {
      const catSlug = categorizeJob(item.title, item.description);
      const cat = catBySlug.get(catSlug) || catBySlug.get('other')!;
      const dedupeKey = computeDedupeKey({
        sourceId: source.id,
        originalJobIdentifier: item.originalJobIdentifier,
        originalJobUrl: item.originalJobUrl,
        title: item.title,
        companyName: item.companyName,
        location: item.location,
      });

      const existing = store.jobs.find(
        (j) =>
          (j.source_id === source.id &&
            item.originalJobIdentifier &&
            j.original_job_identifier === item.originalJobIdentifier) ||
          j.dedupe_key === dedupeKey ||
          (j.original_job_url && j.original_job_url === item.originalJobUrl)
      );

      if (existing) {
        if (existing.title !== item.title || existing.description !== item.description) {
          existing.title = item.title;
          existing.description = item.description;
          existing.updated_at = nowIso;
          jobsUpdated += 1;
        } else {
          duplicatesFound += 1;
        }
        continue;
      }

      const id = ++store.nextId;
      store.jobs.push({
        id,
        slug: buildJobSlug(item.title, item.companyName, id),
        title: item.title,
        company_name: item.companyName,
        company_logo: item.companyLogo || null,
        location: item.location,
        description: item.description,
        category_id: cat.id,
        category_name: cat.name,
        category_slug: cat.slug,
        employment_type: item.employmentType,
        salary_min: item.salaryMin,
        salary_max: item.salaryMax,
        salary_currency: 'ETB',
        application_deadline: item.applicationDeadline,
        source_id: source.id,
        source_name: source.source_name,
        source_website_url: source.website_url,
        original_job_url: item.originalJobUrl,
        job_origin: 'external',
        original_job_identifier: item.originalJobIdentifier || item.originalJobUrl,
        dedupe_key: dedupeKey,
        published_at: item.publishedAt || nowIso,
        expires_at: item.expiresAt || item.applicationDeadline,
        status: autoApprove ? 'active' : 'pending_review',
        is_featured: 0,
        employer_id: null,
        payment_status: 'not_required',
        payment_method: null,
        payment_ref: null,
        rejection_reason: null,
        views_count: 0,
        created_at: nowIso,
        updated_at: nowIso,
      });
      jobsAdded += 1;
    }

    source.last_collected_at = nowIso;
    source.status = 'active';
    source.last_run_status = 'success';

    const logId = ++store.nextId;
    store.logs.unshift({
      id: logId,
      source_id: source.id,
      source_name: source.source_name,
      collection_method: source.collection_method,
      collection_started_at: startedAt,
      collection_completed_at: nowIso,
      jobs_found: verifiedItems.length,
      jobs_added: jobsAdded,
      jobs_updated: jobsUpdated,
      duplicates_found: duplicatesFound,
      errors: null,
      collection_status: 'success',
    });

    return { logId, status: 'success' as const, jobsFound: verifiedItems.length, jobsAdded, jobsUpdated, duplicatesFound };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const nowIso = new Date().toISOString();
    source.last_run_status = 'failed';
    const logId = ++store.nextId;
    store.logs.unshift({
      id: logId,
      source_id: source.id,
      source_name: source.source_name,
      collection_method: source.collection_method,
      collection_started_at: startedAt,
      collection_completed_at: nowIso,
      jobs_found: 0,
      jobs_added: 0,
      jobs_updated: 0,
      duplicates_found: 0,
      errors: message,
      collection_status: 'failed',
    });
    return { logId, status: 'failed' as const, jobsFound: 0, jobsAdded: 0, jobsUpdated: 0, duplicatesFound: 0, error: message };
  }
}

async function syncSupabaseNativeJobs(): Promise<void> {
  const sb = getSupabaseServerClient();
  if (!sb) return;
  try {
    const { data, error } = await sb.from('jobs').select('*').in('status', ['active', 'approved']).limit(50);
    if (error || !data) return;

    const catBySlug = new Map(store.categories.map((c) => [c.slug, c]));
    for (const row of data as Array<Record<string, unknown>>) {
      const title = String(row.title || row.job_title || row.position || '').trim();
      const company = String(row.company_name || row.company || 'Tatari Employer').trim();
      if (!title) continue;

      const dedupeKey = String(
        row.dedupe_key ||
          computeDedupeKey({
            sourceId: null,
            originalJobIdentifier: row.id ? String(row.id) : null,
            originalJobUrl: row.original_job_url ? String(row.original_job_url) : null,
            title,
            companyName: company,
            location: String(row.location || 'Addis Ababa'),
          })
      );

      if (store.jobs.some((j) => j.dedupe_key === dedupeKey || (row.slug && j.slug === String(row.slug)))) continue;

      const id = ++store.nextId;
      const desc = String(row.description || row.job_description || '');
      const catSlug = categorizeJob(title, desc);
      const cat = catBySlug.get(catSlug) || catBySlug.get('other')!;
      const origin: JobOrigin = row.job_origin === 'external' ? 'external' : 'tatari';
      const pubAt = String(row.published_at || row.created_at || new Date().toISOString());

      store.jobs.push({
        id,
        slug: String(row.slug || buildJobSlug(title, company, id)),
        title,
        company_name: company,
        company_logo: row.company_logo ? String(row.company_logo) : null,
        location: String(row.location || 'Addis Ababa'),
        description: desc,
        category_id: cat.id,
        category_name: cat.name,
        category_slug: cat.slug,
        employment_type: String(row.employment_type || 'Full-time') as EmploymentType,
        salary_min: typeof row.salary_min === 'number' ? row.salary_min : null,
        salary_max: typeof row.salary_max === 'number' ? row.salary_max : null,
        salary_currency: String(row.salary_currency || 'ETB'),
        application_deadline: row.application_deadline ? String(row.application_deadline) : null,
        source_id: null,
        source_name: origin === 'external' ? 'External Partner' : null,
        source_website_url: null,
        original_job_url: row.original_job_url ? String(row.original_job_url) : null,
        job_origin: origin,
        original_job_identifier: row.original_job_identifier ? String(row.original_job_identifier) : null,
        dedupe_key: dedupeKey,
        published_at: pubAt,
        expires_at: row.expires_at ? String(row.expires_at) : null,
        status: 'active',
        is_featured: row.is_featured ? 1 : 0,
        employer_id: null,
        payment_status: String(row.payment_status || 'verified'),
        payment_method: row.payment_method ? String(row.payment_method) : null,
        payment_ref: row.payment_ref ? String(row.payment_ref) : null,
        rejection_reason: null,
        views_count: Number(row.views_count || 0),
        created_at: pubAt,
        updated_at: pubAt,
      });
    }
  } catch {
    // Ignore schema mismatches gracefully
  }
}

async function ensureFreshAggregatedJobs(): Promise<void> {
  const hasExternal = store.jobs.some((j) => j.job_origin === 'external' && j.status === 'active');
  const stale = Date.now() - store.lastCollectedMs > COLLECT_TTL_MS;
  if (hasExternal && !stale) return;

  if (!store.collectingPromise) {
    store.collectingPromise = (async () => {
      try {
        await Promise.allSettled([
          syncSupabaseNativeJobs(),
          ...store.sources.filter((s) => s.status === 'active').map((src) => collectSingleSource(src, true)),
        ]);
        store.lastCollectedMs = Date.now();
      } finally {
        store.collectingPromise = null;
      }
    })();
  }
  await store.collectingPromise;
}

function sendJson(res: VercelRes, statusCode: number, data: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

async function readBody(req: VercelReq): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object') return req.body as Record<string, unknown>;
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (req.readableEnded) return {};
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function getAuthedUser(req: VercelReq): ServerlessUser | null {
  const authHeader = String(req.headers.authorization || '');
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const headerToken = String(req.headers['x-tatari-token'] || bearer || '');
  if (!headerToken) return null;
  const verified = verifyToken(headerToken);
  if (!verified) return null;
  const user = store.users.find((u) => u.id === verified.uid);
  if (!user || user.status === 'suspended') return null;
  return user;
}

function publicUserShape(u: ServerlessUser) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    company_name: u.company_name,
    business_tin: u.business_tin,
    status: u.status,
  };
}

function extractApiPath(req: VercelReq): { pathname: string; query: URLSearchParams } {
  const rawUrl = (req.url || '/').replace(/^\/+/, '/');
  const parsed = new URL(rawUrl, 'https://tatari.vercel.app');
  const qs = new URLSearchParams(parsed.search);
  const queryPath = typeof req.query?.__path === 'string' ? req.query.__path : Array.isArray(req.query?.__path) ? req.query.__path[0] : null;
  const pathParam = qs.get('__path') || queryPath;
  qs.delete('__path');
  let pathname = pathParam ? `/api/${pathParam.replace(/^\/+/, '')}` : parsed.pathname;
  if (!pathname.startsWith('/api')) {
    pathname = `/api${pathname.startsWith('/') ? '' : '/'}${pathname}`;
  }
  return { pathname: pathname.replace(/\/+$/, '') || '/api', query: qs };
}

export default async function handler(req: VercelReq, res: VercelRes): Promise<void> {
  try {
    const method = (req.method || 'GET').toUpperCase();
    if (method === 'OPTIONS') {
      res.statusCode = 204;
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-tatari-token');
      res.end('');
      return;
    }

    const { pathname, query } = extractApiPath(req);

    if (pathname === '/api/health') {
      sendJson(res, 200, { ok: true, mode: 'vercel-serverless', jobs: store.jobs.length });
      return;
    }

    if (pathname === '/api/robots.txt' && method === 'GET') {
      const host = String(req.headers.host || 'tatari.vercel.app');
      const proto = host.includes('localhost') ? 'http' : 'https';
      const baseUrl = (process.env.APP_URL || `${proto}://${host}`).replace(/\/$/, '');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${baseUrl}/sitemap.xml\n`);
      return;
    }

    if (pathname === '/api/sitemap.xml' && method === 'GET') {
      await ensureFreshAggregatedJobs();
      const host = String(req.headers.host || 'tatari.vercel.app');
      const proto = host.includes('localhost') ? 'http' : 'https';
      const baseUrl = (process.env.APP_URL || `${proto}://${host}`).replace(/\/$/, '');
      const activeJobs = store.jobs.filter((j) => j.status === 'active').slice(0, 500);
      const urls = [
        `<url><loc>${baseUrl}/</loc><changefreq>hourly</changefreq><priority>1.0</priority></url>`,
        `<url><loc>${baseUrl}/store</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`,
        ...activeJobs.map(
          (j) =>
            `<url><loc>${baseUrl}/jobs/${encodeURIComponent(j.slug)}</loc><lastmod>${j.updated_at.split('T')[0]}</lastmod><changefreq>daily</changefreq><priority>${j.job_origin === 'tatari' ? '0.9' : '0.7'}</priority></url>`
        ),
      ];
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.end(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`
      );
      return;
    }

    // --- Auth ---
    if (pathname === '/api/auth/login' && method === 'POST') {
      const body = await readBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const user = store.users.find((u) => u.email.toLowerCase() === email);
      if (!user || hashPassword(password) !== user.password_hash) {
        sendJson(res, 401, { error: 'Invalid email or password.' });
        return;
      }
      sendJson(res, 200, { token: signToken(user.id, user.role), user: publicUserShape(user) });
      return;
    }

    if (pathname === '/api/auth/register' && method === 'POST') {
      const body = await readBody(req);
      const name = String(body.name || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const role = body.role === 'employer' ? 'employer' : 'seeker';
      const companyName = body.company_name ? String(body.company_name).trim() : null;
      const businessTin = body.business_tin ? String(body.business_tin).trim() : null;

      if (!name || !email || password.length < 6) {
        sendJson(res, 400, { error: 'Name, valid email, and password (min 6 characters) are required.' });
        return;
      }
      if (role === 'employer' && (!companyName || !businessTin)) {
        sendJson(res, 400, { error: 'Employers must provide Company Name and Business TIN / License.' });
        return;
      }
      if (store.users.some((u) => u.email.toLowerCase() === email)) {
        sendJson(res, 409, { error: 'An account with this email already exists.' });
        return;
      }

      const newUser: ServerlessUser = {
        id: ++store.nextId,
        name,
        email,
        password_hash: hashPassword(password),
        role,
        company_name: companyName,
        business_tin: businessTin,
        status: role === 'employer' ? 'pending' : 'approved',
        failed_attempts: 0,
        locked_until: null,
        created_at: new Date().toISOString(),
      };
      store.users.push(newUser);
      sendJson(res, 201, { token: signToken(newUser.id, newUser.role), user: publicUserShape(newUser) });
      return;
    }

    if (pathname === '/api/auth/me' && method === 'GET') {
      const user = getAuthedUser(req);
      sendJson(res, 200, { user: user ? publicUserShape(user) : null });
      return;
    }

    // --- Categories & Sources ---
    if (pathname === '/api/categories' && method === 'GET') {
      await ensureFreshAggregatedJobs();
      const categories = store.categories.map((c) => ({
        ...c,
        active_count: store.jobs.filter((j) => j.status === 'active' && j.category_id === c.id).length,
      }));
      sendJson(res, 200, { categories });
      return;
    }

    if (pathname === '/api/sources/public' && method === 'GET') {
      await ensureFreshAggregatedJobs();
      const sources = store.sources
        .filter((s) => s.status === 'active')
        .map((s) => ({
          id: s.id,
          source_name: s.source_name,
          website_url: s.website_url,
          active_count: store.jobs.filter((j) => j.status === 'active' && j.source_id === s.id).length,
        }));
      sendJson(res, 200, { sources });
      return;
    }

    // --- Public Jobs Discovery ---
    if (pathname === '/api/jobs' && method === 'GET') {
      await ensureFreshAggregatedJobs();
      const q = (query.get('q') || '').trim().toLowerCase();
      const company = (query.get('company') || '').trim().toLowerCase();
      const location = (query.get('location') || '').trim().toLowerCase();
      const categoryId = query.get('category_id') ? Number(query.get('category_id')) : null;
      const sourceId = query.get('source_id') ? Number(query.get('source_id')) : null;
      const jobOrigin = (query.get('job_origin') || '').trim();
      const employmentType = (query.get('employment_type') || '').trim();
      const remote = query.get('remote') === 'true' || query.get('remote') === '1';
      const minSalaryRaw = query.get('salary_min') || query.get('min_salary');
      const minSalary = minSalaryRaw ? Number(minSalaryRaw) : null;
      const maxSalaryRaw = query.get('salary_max');
      const maxSalary = maxSalaryRaw ? Number(maxSalaryRaw) : null;
      const datePosted = (query.get('date_posted') || '').trim();
      const featured = query.get('featured') === '1' || query.get('featured') === 'true';
      const expiringSoon = query.get('expiring_soon') === '1' || query.get('expiring_soon') === 'true';
      const includeExpired = query.get('include_expired') === '1' || query.get('include_expired') === 'true';
      const sort = (query.get('sort') || 'recent').trim();
      const page = Math.max(1, Number(query.get('page') || 1));
      const limit = Math.min(50, Math.max(1, Number(query.get('limit') || 10)));

      let filtered = includeExpired
        ? store.jobs.filter((j) => j.status === 'active' || j.status === 'expired')
        : store.jobs.filter((j) => j.status === 'active');

      if (q) {
        filtered = filtered.filter(
          (j) =>
            j.title.toLowerCase().includes(q) ||
            j.company_name.toLowerCase().includes(q) ||
            j.description.toLowerCase().includes(q)
        );
      }
      if (company) filtered = filtered.filter((j) => j.company_name.toLowerCase().includes(company));
      if (location) filtered = filtered.filter((j) => j.location.toLowerCase().includes(location));
      if (categoryId) filtered = filtered.filter((j) => j.category_id === categoryId);
      if (sourceId) filtered = filtered.filter((j) => j.source_id === sourceId);
      if (jobOrigin === 'external' || jobOrigin === 'tatari') {
        filtered = filtered.filter((j) => j.job_origin === jobOrigin);
      }
      if (employmentType) filtered = filtered.filter((j) => j.employment_type === employmentType);
      if (remote) {
        filtered = filtered.filter(
          (j) => /remote|hybrid/i.test(j.location) || /remote|hybrid/i.test(j.description)
        );
      }
      if (minSalary && Number.isFinite(minSalary) && minSalary > 0) {
        filtered = filtered.filter(
          (j) => (j.salary_min ?? 0) >= minSalary || (j.salary_max ?? 0) >= minSalary
        );
      }
      if (maxSalary && Number.isFinite(maxSalary) && maxSalary > 0) {
        filtered = filtered.filter((j) => j.salary_min !== null && j.salary_min <= maxSalary);
      }
      if (datePosted) {
        const days = datePosted === '24h' ? 1 : datePosted === '7d' ? 7 : datePosted === '30d' ? 30 : null;
        if (days) {
          const cutoff = Date.now() - days * 86400000;
          filtered = filtered.filter((j) => Date.parse(j.published_at) >= cutoff);
        }
      }
      if (featured) filtered = filtered.filter((j) => j.is_featured === 1);
      if (expiringSoon) filtered = filtered.filter((j) => isExpiringSoon(j.application_deadline));

      if (sort === 'deadline') {
        filtered.sort((a, b) => {
          const da = a.application_deadline ? Date.parse(a.application_deadline) : Number.MAX_SAFE_INTEGER;
          const db = b.application_deadline ? Date.parse(b.application_deadline) : Number.MAX_SAFE_INTEGER;
          return da - db;
        });
      } else if (sort === 'salary') {
        filtered.sort(
          (a, b) => (b.salary_max ?? b.salary_min ?? 0) - (a.salary_max ?? a.salary_min ?? 0)
        );
      } else {
        filtered.sort((a, b) => {
          if (b.is_featured !== a.is_featured) return b.is_featured - a.is_featured;
          return Date.parse(b.published_at) - Date.parse(a.published_at);
        });
      }

      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const offset = (page - 1) * limit;
      const rows = filtered.slice(offset, offset + limit).map((j) => ({
        ...j,
        expiring_soon: isExpiringSoon(j.application_deadline),
      }));

      sendJson(res, 200, { jobs: rows, total, page, limit, totalPages });
      return;
    }

    // --- Single Job Detail & Apply ---
    const applyMatch = pathname.match(/^\/api\/jobs\/(\d+)\/apply$/);
    if (applyMatch && method === 'POST') {
      const jobId = Number(applyMatch[1]);
      const job = store.jobs.find((j) => j.id === jobId);
      if (!job) {
        sendJson(res, 404, { error: 'Job listing not found.' });
        return;
      }
      if (job.job_origin === 'external') {
        sendJson(res, 400, {
          error: 'External jobs must be applied to on the original publishing website.',
          original_job_url: job.original_job_url,
        });
        return;
      }

      const body = await readBody(req);
      const authed = getAuthedUser(req);
      const name = authed ? authed.name : String(body.applicant_name || '').trim();
      const email = authed ? authed.email : String(body.applicant_email || '').trim().toLowerCase();
      const phone = String(body.applicant_phone || '').trim();
      const coverNote = String(body.cover_note || '').trim();
      const cvSummary = String(body.cv_summary || '').trim();
      const password = String(body.password || '');

      if (!name || !email || !phone || !coverNote) {
        sendJson(res, 400, { error: 'Full name, email, phone number, and cover note are required.' });
        return;
      }

      let seeker = authed;
      let issuedToken: string | null = null;
      if (!seeker) {
        const existing = store.users.find((u) => u.email.toLowerCase() === email);
        if (existing) {
          if (!password || hashPassword(password) !== existing.password_hash) {
            sendJson(res, 401, {
              error: 'An account with this email exists. Please enter your matching password or sign in first.',
            });
            return;
          }
          seeker = existing;
        } else {
          if (password.length < 6) {
            sendJson(res, 400, {
              error: 'Please enter a password (min 6 characters) to register your Tatari Job Seeker account.',
            });
            return;
          }
          seeker = {
            id: ++store.nextId,
            name,
            email,
            password_hash: hashPassword(password),
            role: 'seeker',
            company_name: null,
            business_tin: null,
            status: 'approved',
            failed_attempts: 0,
            locked_until: null,
            created_at: new Date().toISOString(),
          };
          store.users.push(seeker);
        }
        issuedToken = signToken(seeker.id, seeker.role);
      }

      store.applications.unshift({
        id: ++store.nextId,
        job_id: job.id,
        job_title: job.title,
        company_name: job.company_name,
        location: job.location,
        slug: job.slug,
        seeker_id: seeker.id,
        applicant_name: name,
        applicant_email: email,
        applicant_phone: phone,
        cover_note: coverNote,
        cv_summary: cvSummary,
        status: 'submitted',
        created_at: new Date().toISOString(),
      });

      sendJson(res, 201, {
        message: 'Application submitted successfully on Tatari.',
        token: issuedToken,
        user: issuedToken ? publicUserShape(seeker) : null,
      });
      return;
    }

    const jobDetailMatch = pathname.match(/^\/api\/jobs\/([^/]+)$/);
    if (jobDetailMatch && method === 'GET') {
      await ensureFreshAggregatedJobs();
      const slugOrId = decodeURIComponent(jobDetailMatch[1]);
      const job = store.jobs.find((j) => j.slug === slugOrId || String(j.id) === slugOrId);
      if (!job) {
        sendJson(res, 404, { error: 'Job vacancy not found.' });
        return;
      }
      job.views_count += 1;
      const jsonLd = buildJobPostingJsonLd(
        {
          slug: job.slug,
          title: job.title,
          description: job.description,
          companyName: job.company_name,
          location: job.location,
          employmentType: job.employment_type,
          publishedAt: job.published_at,
          expiresAt: job.expires_at,
          salaryMin: job.salary_min,
          salaryMax: job.salary_max,
          salaryCurrency: job.salary_currency,
          jobOrigin: job.job_origin,
          status: job.status,
        },
        'https://tatari.vercel.app'
      );
      sendJson(res, 200, {
        job: { ...job, expiring_soon: isExpiringSoon(job.application_deadline) },
        jsonLd,
      });
      return;
    }

    // --- Digital Store ---
    if (pathname === '/api/store/products' && method === 'GET') {
      sendJson(res, 200, { products: store.products.filter((p) => p.status === 'active') });
      return;
    }

    if (pathname === '/api/store/orders' && method === 'POST') {
      const user = getAuthedUser(req);
      if (!user) {
        sendJson(res, 401, { error: 'Authentication required.' });
        return;
      }
      const body = await readBody(req);
      const product = store.products.find((p) => p.id === Number(body.product_id));
      if (!product) {
        sendJson(res, 404, { error: 'Digital product not found.' });
        return;
      }
      const paymentMethod = String(body.payment_method || 'Telebirr').trim();
      const paymentRef = String(body.payment_ref || '').trim();
      if (!paymentRef) {
        sendJson(res, 400, { error: 'Payment reference number is required.' });
        return;
      }
      const newOrder: ServerlessOrder = {
        id: ++store.nextId,
        product_id: product.id,
        product_title: product.title,
        format_info: product.format_info,
        product_category: product.category,
        user_id: user.id,
        buyer_name: user.name,
        buyer_email: user.email,
        payment_method: paymentMethod,
        payment_ref: paymentRef,
        receipt_note: body.receipt_note ? String(body.receipt_note).trim() : null,
        amount_etb: product.price_etb,
        status: 'pending',
        rejection_reason: null,
        created_at: new Date().toISOString(),
        verified_at: null,
      };
      store.orders.unshift(newOrder);
      sendJson(res, 201, {
        orderId: newOrder.id,
        message: 'Payment receipt submitted. Download unlocks once Administrator verifies the transfer.',
      });
      return;
    }

    if (pathname === '/api/store/my-orders' && method === 'GET') {
      const user = getAuthedUser(req);
      if (!user) {
        sendJson(res, 401, { error: 'Authentication required.' });
        return;
      }
      sendJson(res, 200, { orders: store.orders.filter((o) => o.user_id === user.id) });
      return;
    }

    const downloadMatch = pathname.match(/^\/api\/store\/orders\/(\d+)\/download$/);
    if (downloadMatch && method === 'GET') {
      const user = getAuthedUser(req);
      if (!user) {
        sendJson(res, 401, { error: 'Authentication required.' });
        return;
      }
      const order = store.orders.find((o) => o.id === Number(downloadMatch[1]) && o.user_id === user.id);
      if (!order || order.status !== 'approved') {
        sendJson(res, 403, { error: 'Order is pending verification.' });
        return;
      }
      const product = store.products.find((p) => p.id === order.product_id);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="tatari-toolkit.txt"');
      res.end(product?.deliverable_content || order.product_title);
      return;
    }

    // --- Saved Jobs, Alerts, Notifications, Applications ---
    if (pathname === '/api/saved-jobs' && method === 'GET') {
      const user = getAuthedUser(req);
      if (!user) {
        sendJson(res, 401, { error: 'Authentication required.' });
        return;
      }
      const ids = new Set(store.savedJobs.filter((s) => s.user_id === user.id).map((s) => s.job_id));
      sendJson(res, 200, { savedJobs: store.jobs.filter((j) => ids.has(j.id)) });
      return;
    }

    const savedJobMatch = pathname.match(/^\/api\/saved-jobs\/(\d+)$/);
    if (savedJobMatch) {
      const user = getAuthedUser(req);
      if (!user) {
        sendJson(res, 401, { error: 'Authentication required.' });
        return;
      }
      const jobId = Number(savedJobMatch[1]);
      if (method === 'POST') {
        if (!store.savedJobs.some((s) => s.user_id === user.id && s.job_id === jobId)) {
          store.savedJobs.push({ user_id: user.id, job_id: jobId });
        }
        sendJson(res, 200, { ok: true });
        return;
      }
      if (method === 'DELETE') {
        store.savedJobs = store.savedJobs.filter((s) => !(s.user_id === user.id && s.job_id === jobId));
        sendJson(res, 200, { ok: true });
        return;
      }
    }

    if (pathname === '/api/job-alerts') {
      const user = getAuthedUser(req);
      if (!user) {
        sendJson(res, 401, { error: 'Authentication required.' });
        return;
      }
      if (method === 'GET') {
        sendJson(res, 200, { alerts: store.alerts.filter((a) => a.user_id === user.id) });
        return;
      }
      if (method === 'POST') {
        const body = await readBody(req);
        const catId = body.category_id ? Number(body.category_id) : null;
        const cat = catId ? store.categories.find((c) => c.id === catId) : null;
        const alert: ServerlessAlert = {
          id: ++store.nextId,
          user_id: user.id,
          email: user.email,
          category_id: catId,
          category_name: cat ? cat.name : null,
          location: body.location ? String(body.location).trim() : null,
          keywords: body.keywords ? String(body.keywords).trim() : null,
          job_origin_pref:
            body.job_origin_pref === 'external' || body.job_origin_pref === 'tatari'
              ? body.job_origin_pref
              : 'all',
          frequency: body.frequency === 'daily' ? 'daily' : 'instant',
          active: 1,
          created_at: new Date().toISOString(),
        };
        store.alerts.unshift(alert);
        sendJson(res, 201, { alert });
        return;
      }
    }

    const alertDeleteMatch = pathname.match(/^\/api\/job-alerts\/(\d+)$/);
    if (alertDeleteMatch && method === 'DELETE') {
      const user = getAuthedUser(req);
      if (!user) {
        sendJson(res, 401, { error: 'Authentication required.' });
        return;
      }
      const id = Number(alertDeleteMatch[1]);
      store.alerts = store.alerts.filter((a) => !(a.id === id && a.user_id === user.id));
      sendJson(res, 200, { ok: true });
      return;
    }

    if (pathname === '/api/notifications' && method === 'GET') {
      const user = getAuthedUser(req);
      if (!user) {
        sendJson(res, 401, { error: 'Authentication required.' });
        return;
      }
      sendJson(res, 200, { notifications: store.notifications.filter((n) => n.user_id === user.id) });
      return;
    }

    if (pathname === '/api/notifications/read-all' && method === 'PATCH') {
      const user = getAuthedUser(req);
      if (!user) {
        sendJson(res, 401, { error: 'Authentication required.' });
        return;
      }
      store.notifications.forEach((n) => {
        if (n.user_id === user.id) n.is_read = 1;
      });
      sendJson(res, 200, { ok: true });
      return;
    }

    if (pathname === '/api/my-applications' && method === 'GET') {
      const user = getAuthedUser(req);
      if (!user) {
        sendJson(res, 401, { error: 'Authentication required.' });
        return;
      }
      sendJson(res, 200, { applications: store.applications.filter((a) => a.seeker_id === user.id) });
      return;
    }

    // --- Employer Portal ---
    if (pathname === '/api/employer/jobs') {
      const user = getAuthedUser(req);
      if (!user || (user.role !== 'employer' && user.role !== 'admin')) {
        sendJson(res, 403, { error: 'Verified Employer account required.' });
        return;
      }
      if (method === 'GET') {
        const myJobs = store.jobs
          .filter((j) => j.job_origin === 'tatari' && (user.role === 'admin' || j.employer_id === user.id))
          .map((j) => ({
            ...j,
            applicant_count: store.applications.filter((a) => a.job_id === j.id).length,
          }));
        const myJobIds = new Set(myJobs.map((j) => j.id));
        sendJson(res, 200, {
          jobs: myJobs,
          applications: store.applications.filter((a) => myJobIds.has(a.job_id)),
        });
        return;
      }
      if (method === 'POST') {
        const body = await readBody(req);
        const title = String(body.title || '').trim();
        const companyName = String(body.company_name || user.company_name || '').trim();
        const location = String(body.location || '').trim();
        const description = String(body.description || '').trim();
        if (!title || !companyName || !location || !description) {
          sendJson(res, 400, { error: 'Title, company name, location, and description are required.' });
          return;
        }
        const id = ++store.nextId;
        const catSlug = categorizeJob(title, description);
        const requestedCat = body.category_id
          ? store.categories.find((c) => c.id === Number(body.category_id))
          : undefined;
        const cat =
          requestedCat ||
          store.categories.find((c) => c.slug === catSlug) ||
          store.categories[store.categories.length - 1];
        const nowIso = new Date().toISOString();
        const isAdmin = user.role === 'admin';
        const newJob: ServerlessJob = {
          id,
          slug: buildJobSlug(title, companyName, id),
          title,
          company_name: companyName,
          company_logo: null,
          location,
          description,
          category_id: cat.id,
          category_name: cat.name,
          category_slug: cat.slug,
          employment_type: String(body.employment_type || 'Full-time') as EmploymentType,
          salary_min: body.salary_min ? Number(body.salary_min) : null,
          salary_max: body.salary_max ? Number(body.salary_max) : null,
          salary_currency: 'ETB',
          application_deadline: body.application_deadline ? String(body.application_deadline) : null,
          source_id: null,
          source_name: null,
          source_website_url: null,
          original_job_url: null,
          job_origin: 'tatari',
          original_job_identifier: null,
          dedupe_key: computeDedupeKey({
            sourceId: null,
            originalJobIdentifier: null,
            originalJobUrl: null,
            title,
            companyName,
            location,
          }),
          published_at: nowIso,
          expires_at: body.application_deadline ? String(body.application_deadline) : null,
          status: isAdmin ? 'active' : 'pending_review',
          is_featured: 0,
          employer_id: user.id,
          payment_status: isAdmin ? 'verified' : 'pending',
          payment_method: body.payment_method ? String(body.payment_method) : null,
          payment_ref: body.payment_ref ? String(body.payment_ref) : null,
          rejection_reason: null,
          views_count: 0,
          created_at: nowIso,
          updated_at: nowIso,
        };
        store.jobs.unshift(newJob);
        sendJson(res, 201, {
          job: newJob,
          message: isAdmin
            ? 'Job published directly on Tatari.'
            : 'Vacancy submitted with payment receipt. It will go live on Tatari upon Administrator verification.',
        });
        return;
      }
    }

    // --- Admin Console ---
    if (pathname.startsWith('/api/admin/')) {
      const user = getAuthedUser(req);
      if (!user || user.role !== 'admin') {
        sendJson(res, 403, { error: 'Administrator privileges required.' });
        return;
      }

      if (pathname === '/api/admin/stats' && method === 'GET') {
        await ensureFreshAggregatedJobs();
        sendJson(res, 200, {
          stats: {
            totalJobs: store.jobs.length,
            externalJobs: store.jobs.filter((j) => j.job_origin === 'external').length,
            tatariJobs: store.jobs.filter((j) => j.job_origin === 'tatari').length,
            activeJobs: store.jobs.filter((j) => j.status === 'active').length,
            expiredJobs: store.jobs.filter((j) => j.status === 'expired').length,
            pendingReviewJobs: store.jobs.filter((j) => j.status === 'pending_review').length,
            activeSources: store.sources.filter((s) => s.status === 'active').length,
            jobsCollectedToday: store.jobs.filter((j) => j.job_origin === 'external').length,
            failedAttempts: store.logs.filter((l) => l.collection_status === 'failed').length,
            pendingOrders: store.orders.filter((o) => o.status === 'pending').length,
            pendingEmployers: store.users.filter((u) => u.role === 'employer' && u.status === 'pending').length,
          },
        });
        return;
      }

      if (pathname === '/api/admin/sources') {
        if (method === 'GET') {
          sendJson(res, 200, {
            sources: store.sources.map((s) => ({
              ...s,
              total_jobs_collected: store.jobs.filter((j) => j.source_id === s.id).length,
              active_jobs_count: store.jobs.filter((j) => j.source_id === s.id && j.status === 'active').length,
            })),
          });
          return;
        }
        if (method === 'POST') {
          const body = await readBody(req);
          const newSrc: ServerlessSource = {
            id: ++store.nextId,
            source_name: String(body.source_name || '').trim(),
            website_url: String(body.website_url || '').trim(),
            feed_url: String(body.feed_url || '').trim(),
            collection_method: (body.collection_method as ServerlessSource['collection_method']) || 'html_directory',
            collection_frequency: (body.collection_frequency as ServerlessSource['collection_frequency']) || 'every_6h',
            status: 'active',
            robots_respect: 1,
            rate_limit_ms: 1200,
            last_collected_at: null,
            last_run_status: null,
          };
          store.sources.push(newSrc);
          sendJson(res, 201, { source: newSrc });
          return;
        }
      }

      if (pathname === '/api/admin/sources/collect-all' && method === 'POST') {
        const results = [];
        for (const s of store.sources.filter((src) => src.status === 'active')) {
          const result = await collectSingleSource(s, true);
          results.push({ source_name: s.source_name, ...result });
        }
        store.lastCollectedMs = Date.now();
        sendJson(res, 200, { results });
        return;
      }

      const srcCollectMatch = pathname.match(/^\/api\/admin\/sources\/(\d+)\/collect$/);
      if (srcCollectMatch && method === 'POST') {
        const src = store.sources.find((s) => s.id === Number(srcCollectMatch[1]));
        if (!src) {
          sendJson(res, 404, { error: 'Source not found.' });
          return;
        }
        const result = await collectSingleSource(src, true);
        store.lastCollectedMs = Date.now();
        sendJson(res, 200, { result });
        return;
      }

      const srcPatchMatch = pathname.match(/^\/api\/admin\/sources\/(\d+)$/);
      if (srcPatchMatch) {
        const src = store.sources.find((s) => s.id === Number(srcPatchMatch[1]));
        if (!src) {
          sendJson(res, 404, { error: 'Source not found.' });
          return;
        }
        if (method === 'PATCH') {
          const body = await readBody(req);
          if (body.status === 'active' || body.status === 'paused' || body.status === 'error') {
            src.status = body.status;
          }
          sendJson(res, 200, { ok: true });
          return;
        }
        if (method === 'DELETE') {
          store.sources = store.sources.filter((s) => s.id !== src.id);
          sendJson(res, 200, { ok: true });
          return;
        }
      }

      if (pathname === '/api/admin/logs' && method === 'GET') {
        sendJson(res, 200, { logs: store.logs.slice(0, 80) });
        return;
      }

      if (pathname === '/api/admin/jobs' && method === 'GET') {
        await ensureFreshAggregatedJobs();
        const status = query.get('status') || '';
        const list = status ? store.jobs.filter((j) => j.status === status) : store.jobs;
        sendJson(res, 200, { jobs: list });
        return;
      }

      if (pathname === '/api/admin/jobs/verify-links' && method === 'POST') {
        const external = store.jobs.filter((j) => j.job_origin === 'external' && j.status === 'active');
        const results = await Promise.all(
          external.map(async (j) => ({
            job: j,
            live: j.original_job_url ? await verifyUrlIsLiveFast(j.original_job_url) : false,
          }))
        );
        let expiredCount = 0;
        for (const r of results) {
          if (!r.live) {
            r.job.status = 'expired';
            expiredCount += 1;
          }
        }
        sendJson(res, 200, { checked: external.length, expiredCount });
        return;
      }

      if (pathname === '/api/admin/jobs/dedupe' && method === 'POST') {
        const seen = new Set<string>();
        let removed = 0;
        store.jobs = store.jobs.filter((j) => {
          if (seen.has(j.dedupe_key)) {
            removed += 1;
            return false;
          }
          seen.add(j.dedupe_key);
          return true;
        });
        sendJson(res, 200, { removed });
        return;
      }

      const adminJobMatch = pathname.match(/^\/api\/admin\/jobs\/(\d+)$/);
      if (adminJobMatch) {
        const jobId = Number(adminJobMatch[1]);
        if (method === 'PATCH') {
          const job = store.jobs.find((j) => j.id === jobId);
          if (!job) {
            sendJson(res, 404, { error: 'Job not found.' });
            return;
          }
          const body = await readBody(req);
          if (body.status) job.status = body.status as ServerlessJob['status'];
          if (body.is_featured !== undefined) job.is_featured = body.is_featured ? 1 : 0;
          sendJson(res, 200, { ok: true });
          return;
        }
        if (method === 'DELETE') {
          store.jobs = store.jobs.filter((j) => j.id !== jobId);
          sendJson(res, 200, { ok: true });
          return;
        }
      }

      if (pathname === '/api/admin/payments' && method === 'GET') {
        const storeOrders = store.orders.map((o) => ({
          ...o,
          item_title: o.product_title,
          payment_type: 'store_order',
        }));
        const employerJobs = store.jobs
          .filter((j) => j.job_origin === 'tatari' && j.payment_ref)
          .map((j) => ({
            id: j.id,
            item_title: j.title,
            buyer_name: j.company_name,
            buyer_email: 'employer@tatari.et',
            payment_method: j.payment_method || 'Telebirr',
            payment_ref: j.payment_ref || '',
            status: j.payment_status,
            created_at: j.created_at,
            payment_type: 'job_posting',
          }));
        sendJson(res, 200, { storeOrders, employerJobs });
        return;
      }

      const payMatch = pathname.match(/^\/api\/admin\/payments\/(store_order|job_posting)\/(\d+)$/);
      if (payMatch && method === 'PATCH') {
        const type = payMatch[1];
        const id = Number(payMatch[2]);
        const body = await readBody(req);
        const decision = body.decision === 'approved' ? 'approved' : 'rejected';
        if (type === 'store_order') {
          const order = store.orders.find((o) => o.id === id);
          if (order) {
            order.status = decision;
            order.verified_at = new Date().toISOString();
            order.rejection_reason = body.reason ? String(body.reason) : null;
          }
        } else {
          const job = store.jobs.find((j) => j.id === id);
          if (job) {
            job.status = decision === 'approved' ? 'active' : 'rejected';
            job.payment_status = decision === 'approved' ? 'verified' : 'rejected';
          }
        }
        sendJson(res, 200, { ok: true });
        return;
      }

      if (pathname === '/api/admin/employers' && method === 'GET') {
        sendJson(res, 200, {
          employers: store.users.filter((u) => u.role === 'employer').map(publicUserShape),
        });
        return;
      }

      const empMatch = pathname.match(/^\/api\/admin\/employers\/(\d+)$/);
      if (empMatch && method === 'PATCH') {
        const emp = store.users.find((u) => u.id === Number(empMatch[1]) && u.role === 'employer');
        if (emp) {
          const body = await readBody(req);
          if (body.status === 'approved' || body.status === 'pending' || body.status === 'suspended') {
            emp.status = body.status;
          }
        }
        sendJson(res, 200, { ok: true });
        return;
      }
    }

    sendJson(res, 404, { error: `API route not found: ${method} ${pathname}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendJson(res, 500, { error: `Serverless error: ${message}` });
  }
}
