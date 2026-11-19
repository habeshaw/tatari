import * as cheerio from 'cheerio';

export type JobOrigin = 'external' | 'tatari';
export type EmploymentType =
  | 'Full-time'
  | 'Part-time'
  | 'Contract'
  | 'Internship'
  | 'Consultancy';

export const STANDARD_CATEGORIES = [
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

export type CategorySlug = (typeof STANDARD_CATEGORIES)[number]['slug'];

const CATEGORY_KEYWORDS: Record<CategorySlug, string[]> = {
  'information-technology': [
    'software',
    'developer',
    'engineer',
    'frontend',
    'backend',
    'fullstack',
    'full-stack',
    'devops',
    'cloud',
    'cybersecurity',
    'data analyst',
    'data scientist',
    'it support',
    'network administrator',
    'system administrator',
    'sysadmin',
    'mobile app',
    'react',
    'node.js',
    'python',
    'database',
    'ict',
    'ui/ux',
  ],
  engineering: [
    'mechanical engineer',
    'electrical engineer',
    'chemical engineer',
    'industrial engineer',
    'telecom engineer',
    'electromechanical',
    'maintenance engineer',
    'plant engineer',
    'biomedical engineer',
    'water resources engineer',
    'manufacturing',
  ],
  'accounting-and-finance': [
    'accountant',
    'accounting',
    'finance',
    'auditor',
    'audit',
    'tax',
    'payroll',
    'bookkeeper',
    'treasury',
    'banking',
    'credit analyst',
    'ifrs',
    'cfo',
    'financial controller',
    'cashier',
  ],
  'business-and-management': [
    'project manager',
    'operations manager',
    'general manager',
    'business development',
    'strategy',
    'supply chain',
    'procurement',
    'logistics',
    'human resource',
    'hr manager',
    'talent acquisition',
    'monitoring and evaluation',
    'm&e',
    'chief of staff',
  ],
  'healthcare-and-medicine': [
    'physician',
    'doctor',
    'nurse',
    'nursing',
    'pharmacist',
    'pharmacy',
    'medical',
    'clinical',
    'public health',
    'midwife',
    'laboratory technologist',
    'radiologist',
    'hospital',
    'epidemiologist',
  ],
  education: [
    'teacher',
    'lecturer',
    'professor',
    'instructor',
    'academic',
    'school principal',
    'curriculum',
    'tutor',
    'training officer',
    'university',
    'faculty',
  ],
  'marketing-and-sales': [
    'marketing',
    'sales',
    'brand manager',
    'digital marketing',
    'social media',
    'account executive',
    'merchandising',
    'distribution',
    'territory manager',
    'promotion',
    'copywriter',
  ],
  administration: [
    'administrative assistant',
    'office administrator',
    'executive assistant',
    'secretary',
    'receptionist',
    'office manager',
    'record officer',
    'archivist',
    'clerical',
    'fleet coordinator',
  ],
  construction: [
    'civil engineer',
    'site engineer',
    'structural engineer',
    'quantity surveyor',
    'architect',
    'construction',
    'autocad',
    'building',
    'highway',
    'geotechnical',
    'foreman',
    'urban planner',
  ],
  'government-jobs': [
    'ministry',
    'civil service',
    'federal',
    'municipality',
    'public sector',
    'government',
    'revenue authority',
    'ethiopian airlines',
    'ethiotelecom',
    'regional bureau',
    'woreda',
  ],
  'ngo-and-development': [
    'ngo',
    'unicef',
    'undp',
    'usaid',
    'humanitarian',
    'wash',
    'livelihood',
    'relief',
    'refugee',
    'non-governmental',
    'international development',
    'grant officer',
    'field coordinator',
    'protection officer',
  ],
  'customer-service': [
    'customer service',
    'call center',
    'contact center',
    'client support',
    'helpdesk',
    'front desk',
    'customer care',
    'teller',
    'branch officer',
  ],
  other: [],
};

export function categorizeJob(title: string, description: string, hintedCategory?: string): CategorySlug {
  const hint = (hintedCategory || '').trim().toLowerCase();
  if (hint) {
    const direct = STANDARD_CATEGORIES.find(
      (c) => c.slug === hint || c.name.toLowerCase() === hint
    );
    if (direct && direct.slug !== 'other') {
      return direct.slug;
    }
  }

  const titleLower = title.toLowerCase();
  const bodyLower = `${titleLower} ${description.toLowerCase()}`;

  let bestSlug: CategorySlug = 'other';
  let bestScore = 0;

  for (const cat of STANDARD_CATEGORIES) {
    if (cat.slug === 'other') continue;
    const keywords = CATEGORY_KEYWORDS[cat.slug];
    let score = 0;
    for (const kw of keywords) {
      if (titleLower.includes(kw)) {
        score += 3;
      } else if (bodyLower.includes(kw)) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestSlug = cat.slug;
    }
  }

  return bestSlug;
}

export function normalizeEmploymentType(raw?: string): EmploymentType {
  const text = (raw || '').toLowerCase().trim();
  if (text.includes('part')) return 'Part-time';
  if (text.includes('intern') || text.includes('trainee') || text.includes('graduate')) return 'Internship';
  if (text.includes('consult')) return 'Consultancy';
  if (text.includes('contract') || text.includes('fixed') || text.includes('temp')) return 'Contract';
  return 'Full-time';
}

export function parseSalaryRange(raw?: string): { salaryMin: number | null; salaryMax: number | null } {
  if (!raw) return { salaryMin: null, salaryMax: null };
  const cleaned = raw.replace(/,/g, '');
  const matches = cleaned.match(/\d{3,8}/g);
  if (!matches || matches.length === 0) {
    return { salaryMin: null, salaryMax: null };
  }
  const nums = matches.map((m) => Number(m)).filter((n) => Number.isFinite(n) && n > 0);
  if (nums.length === 0) return { salaryMin: null, salaryMax: null };
  if (nums.length === 1) return { salaryMin: nums[0], salaryMax: nums[0] };
  const min = Math.min(nums[0], nums[1]);
  const max = Math.max(nums[0], nums[1]);
  return { salaryMin: min, salaryMax: max };
}

export function normalizeTextForKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function computeDedupeKey(params: {
  sourceId: number | null;
  originalJobIdentifier?: string | null;
  originalJobUrl?: string | null;
  title: string;
  companyName: string;
  location: string;
}): string {
  const normTitle = normalizeTextForKey(params.title);
  const normCompany = normalizeTextForKey(params.companyName);
  const normLoc = normalizeTextForKey(params.location || 'ethiopia');
  return `${normTitle}::${normCompany}::${normLoc}`;
}

export function buildJobSlug(title: string, companyName: string, uniqueToken?: number | string): string {
  const base = `${title} ${companyName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  return uniqueToken !== undefined && uniqueToken !== null ? `${base}-${uniqueToken}` : base;
}

export function isExpiredJob(
  expiresAtIso?: string | null,
  deadlineIso?: string | null,
  now: Date = new Date()
): boolean {
  const checkDate = expiresAtIso || deadlineIso;
  if (!checkDate) return false;
  const parsed = new Date(checkDate);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() < now.getTime();
}

export function isExpiringSoon(
  deadlineIso?: string | null,
  now: Date = new Date(),
  windowDays = 5
): boolean {
  if (!deadlineIso) return false;
  const parsed = new Date(deadlineIso);
  if (Number.isNaN(parsed.getTime())) return false;
  const diffMs = parsed.getTime() - now.getTime();
  return diffMs > 0 && diffMs <= windowDays * 24 * 60 * 60 * 1000;
}

export interface ParsedExternalJob {
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

export function resolveJobUrl(rawUrl: string | undefined | null, fallbackBaseUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return fallbackBaseUrl;
  try {
    return new URL(trimmed, fallbackBaseUrl).toString();
  } catch {
    return fallbackBaseUrl;
  }
}

export function parseRssXmlFeed(xmlText: string, fallbackBaseUrl: string): ParsedExternalJob[] {
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
      node.find('dc\\:creator').first().text().trim() ||
      node.find('author > name').first().text().trim() ||
      node.find('author').first().text().trim() ||
      'Ethiopian Employer';
    const location =
      node.find('location').first().text().trim() || 'Addis Ababa, Ethiopia';
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
    const publishedAt = pubRaw && !Number.isNaN(Date.parse(pubRaw))
      ? new Date(pubRaw).toISOString()
      : new Date().toISOString();
    const deadlineRaw =
      node.find('deadline').first().text().trim() ||
      node.find('expiresAt').first().text().trim();
    const applicationDeadline =
      deadlineRaw && !Number.isNaN(Date.parse(deadlineRaw))
        ? new Date(deadlineRaw).toISOString()
        : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const companyLogo = node.find('logo').first().text().trim() || null;

    if (title && link) {
      results.push({
        originalJobIdentifier: guid,
        originalJobUrl: link,
        title,
        companyName,
        companyLogo,
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

export function parseJsonFeed(payload: unknown, fallbackBaseUrl: string): ParsedExternalJob[] {
  const list = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as { jobs?: unknown[] }).jobs)
      ? (payload as { jobs: unknown[] }).jobs
      : payload && typeof payload === 'object' && Array.isArray((payload as { items?: unknown[] }).items)
        ? (payload as { items: unknown[] }).items
        : [];

  const results: ParsedExternalJob[] = [];
  for (let i = 0; i < list.length; i++) {
    const raw = list[i] as Record<string, unknown>;
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
        : raw.application_deadline && !Number.isNaN(Date.parse(String(raw.application_deadline)))
          ? new Date(String(raw.application_deadline)).toISOString()
          : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

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

function inferDeadlineFromClosingText(text: string): string {
  const daysMatch = text.match(/(\d+)\s*day/i);
  if (daysMatch) {
    const days = Math.max(1, Number(daysMatch[1]));
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  }
  const cleaned = text.replace(/^deadline\s*:\s*/i, '').trim();
  if (cleaned && !Number.isNaN(Date.parse(cleaned))) {
    return new Date(cleaned).toISOString();
  }
  return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
}

export function parseEthiojobsNextData(htmlText: string, baseWebsiteUrl: string): ParsedExternalJob[] {
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
      const description = stripHtml(String(item.description || `${title} at ${companyName}`))
        .slice(0, 1800)
        .trim();
      const catalogs = Array.isArray(item.catalogs) ? (item.catalogs as Array<{ name?: string }>) : [];
      const categoryHint = catalogs[0]?.name ? String(catalogs[0].name) : undefined;
      const publishedAt =
        item.date_published && !Number.isNaN(Date.parse(String(item.date_published)))
          ? new Date(String(item.date_published)).toISOString()
          : new Date().toISOString();
      const applicationDeadline =
        item.date_expiry && !Number.isNaN(Date.parse(String(item.date_expiry)))
          ? new Date(String(item.date_expiry)).toISOString()
          : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const originalJobUrl = resolveJobUrl(`/job/${encodeURIComponent(slug)}`, baseWebsiteUrl);

      results.push({
        originalJobIdentifier: `ethiojobs-${slug}`,
        originalJobUrl,
        title,
        companyName,
        companyLogo,
        location,
        description: description || `${title} at ${companyName} (${location}).`,
        categoryHint,
        employmentType: normalizeEmploymentType(
          `${String(item.location_type || '')} ${description}`
        ),
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

export function parseHtmlDirectory(htmlText: string, baseWebsiteUrl: string): ParsedExternalJob[] {
  // 1. Ethiojobs Next.js SSR payload
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

  // 2. GeezJobs live directory (a.job-card[href^="/job-detail/"])
  if (baseWebsiteUrl.includes('geezjobs.com') || $('a[href^="/job-detail/"]').length > 0) {
    $('a[href^="/job-detail/"]').each((idx, el) => {
      const node = $(el);
      const href = node.attr('href') || '';
      if (!href) return;
      const title = (node.attr('data-title') || node.find('h2, h3, .font-bold, .font-semibold').first().text() || node.text()).trim();
      if (!title) return;
      const originalJobUrl = resolveJobUrl(href, baseWebsiteUrl);
      const companyName = (node.attr('data-company') || 'Ethiopian Employer').trim();
      const location = (node.attr('data-city') || 'Addis Ababa, Ethiopia').trim();
      const empTypeRaw = node.attr('data-type') || 'Full-time';
      const closingRaw = node.attr('data-closing') || '';
      const deadline = inferDeadlineFromClosingText(closingRaw);

      pushUnique({
        originalJobIdentifier: `geezjobs-${href.replace(/^\/+/, '')}`,
        originalJobUrl,
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

  // 3. Ezega Jobs live directory (a[href*="/Jobs/viewjobposting/"])
  if (baseWebsiteUrl.includes('ezega.com') || $('a[href*="/Jobs/viewjobposting/"]').length > 0) {
    $('a[href*="/Jobs/viewjobposting/"]').each((idx, el) => {
      const node = $(el);
      const href = node.attr('href') || '';
      const title = node.text().trim();
      if (!href || !title) return;
      const originalJobUrl = resolveJobUrl(href, baseWebsiteUrl);
      const row = node.parent().parent();
      const cols = row.children('div');
      const dateStr = cols.eq(0).text().trim();
      const companyName = cols.eq(2).text().trim() || 'Ethiopian Employer';
      const location = cols.eq(3).text().trim() || 'Addis Ababa, Ethiopia';
      const publishedAt =
        dateStr && !Number.isNaN(Date.parse(dateStr))
          ? new Date(dateStr).toISOString()
          : new Date().toISOString();
      const deadline = new Date(Date.parse(publishedAt) + 14 * 24 * 60 * 60 * 1000).toISOString();

      pushUnique({
        originalJobIdentifier: `ezega-${href.replace(/^\/+/, '')}`,
        originalJobUrl,
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

  // 4. EthiopianWork live directory (.job-card with .job-card__title)
  if (baseWebsiteUrl.includes('ethiopianwork.com') || $('.job-card__title').length > 0) {
    $('.job-card').each((idx, el) => {
      const node = $(el);
      const titleAnchor = node.find('a.job-card__title, a[href*="/job/"]').first();
      const href = titleAnchor.attr('href') || '';
      const title = titleAnchor.text().trim();
      if (!href || !title) return;

      const originalJobUrl = resolveJobUrl(href, baseWebsiteUrl);
      const companyName = node.find('.job-card__company').first().text().trim() || 'Ethiopian Employer';
      const badges = node.find('.job-card__meta .badge').map((_, b) => $(b).text().trim()).get();
      const location = badges[0] || 'Addis Ababa, Ethiopia';
      const empRaw = badges[1] || 'Full-time';
      const deadlineText = node.find('.job-card__deadline').first().text().trim();
      const deadline = inferDeadlineFromClosingText(deadlineText);

      pushUnique({
        originalJobIdentifier: `ethiopianwork-${href.split('/').filter(Boolean).pop() || idx}`,
        originalJobUrl,
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

  // 5. Generic HTML directory fallback
  $('[data-job-card], article.job-listing, .job-card, tr.job-row').each((idx, el) => {
    const node = $(el);
    const title = node.find('h2, h3, .job-title, a').first().text().trim();
    const href = node.find('a').first().attr('href') || '';
    if (!title || !href) return;

    const originalJobUrl = resolveJobUrl(href, baseWebsiteUrl);
    const companyName = node.find('.company, .employer, [data-company]').first().text().trim() || 'Ethiopian Employer';
    const location = node.find('.location, [data-location]').first().text().trim() || 'Addis Ababa, Ethiopia';
    const description = node.find('.summary, .description, p').first().text().trim() || `${title} at ${companyName}`;
    const salaryText = node.find('.salary, [data-salary]').first().text().trim();
    const { salaryMin, salaryMax } = parseSalaryRange(salaryText);
    const deadlineRaw = node.find('.deadline, [data-deadline]').first().text().trim();
    const applicationDeadline =
      deadlineRaw && !Number.isNaN(Date.parse(deadlineRaw))
        ? new Date(deadlineRaw).toISOString()
        : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    pushUnique({
      originalJobIdentifier: node.attr('data-job-id') || originalJobUrl || `html-${idx}`,
      originalJobUrl,
      title,
      companyName,
      companyLogo: null,
      location,
      description,
      employmentType: normalizeEmploymentType(node.find('.employment-type').first().text().trim()),
      salaryMin,
      salaryMax,
      applicationDeadline,
      publishedAt: new Date().toISOString(),
      expiresAt: applicationDeadline,
    });
  });

  return results;
}

export interface JobPostingJsonLdInput {
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
}

export function buildJobPostingJsonLd(
  job: JobPostingJsonLdInput,
  baseUrl: string
): Record<string, unknown> | null {
  // Never emit JobPosting structured data for expired or external listings
  // so search engines do not misrepresent external postings as Tatari-originated.
  if (job.jobOrigin !== 'tatari' || job.status !== 'active') {
    return null;
  }
  if (isExpiredJob(job.expiresAt, job.expiresAt)) {
    return null;
  }

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
    hiringOrganization: {
      '@type': 'Organization',
      name: job.companyName,
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: job.location,
        addressCountry: 'ET',
      },
    },
    url: `${baseUrl.replace(/\/$/, '')}/jobs/${job.slug}`,
  };

  if (job.expiresAt) {
    schema.validThrough = job.expiresAt;
  }

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
