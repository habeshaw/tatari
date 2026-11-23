import {
  buildContentFingerprint,
  decodeHtmlEntities,
  isDeadlineExpired,
  sanitizeHttpUrl,
  stripHtmlToText,
} from './externalJobs.ts';
import type {
  AggregatedOpportunity,
  AggregationSourceRecord,
  BankFxRateRecord,
  DigitalProduct,
  JobListing,
  OpportunityModuleType,
  TrainingProgram,
} from '../types/domain.ts';

export interface OpportunitySourceDefinition {
  id: string;
  name: string;
  domain: string;
  url: string;
  feedUrl: string;
  module: OpportunityModuleType;
  method: AggregationSourceRecord['method'];
  frequencyLabel: string;
  termsNote: string;
}

export const DEFAULT_OPPORTUNITY_SOURCES: OpportunitySourceDefinition[] = [
  {
    id: 'src-2merkato-tenders',
    name: '2Merkato Tenders Ethiopia',
    domain: 'tender.2merkato.com',
    url: 'https://tender.2merkato.com/tenders',
    feedUrl: 'https://tender.2merkato.com/tenders',
    module: 'tenders',
    method: 'inertia_json',
    frequencyLabel: 'Every 30m',
    termsNote: 'Public tender index — links straight to 2Merkato tender page',
  },
  {
    id: 'src-capital-bids',
    name: 'Capital Ethiopia Bids & Tenders',
    domain: 'capitalethiopia.com',
    url: 'https://capitalethiopia.com/category/vacancy-bid/',
    feedUrl: 'https://www.capitalethiopia.com/wp-json/wp/v2/posts?categories=4906&per_page=10',
    module: 'tenders',
    method: 'wp_rest_json',
    frequencyLabel: 'Every 30m',
    termsNote: 'Public WordPress REST v2 feed with canonical article attribution',
  },
  {
    id: 'src-effoysira-scholarships',
    name: 'EffoySira Scholarships',
    domain: 'effoysira.com',
    url: 'https://effoysira.com/category/scholarship/',
    feedUrl: 'https://effoysira.com/wp-json/wp/v2/posts?categories=2200&per_page=8',
    module: 'scholarships',
    method: 'wp_rest_json',
    frequencyLabel: 'Every 1h',
    termsNote: 'Public WordPress REST v2 scholarship feed',
  },
  {
    id: 'src-ofa-scholarships',
    name: 'Opportunities for Africans (Scholarships)',
    domain: 'opportunitiesforafricans.com',
    url: 'https://www.opportunitiesforafricans.com/category/scholarships/',
    feedUrl: 'https://www.opportunitiesforafricans.com/wp-json/wp/v2/posts?categories=12&per_page=10&_embed=1',
    module: 'scholarships',
    method: 'wp_rest_json',
    frequencyLabel: 'Every 1h',
    termsNote: 'Public WordPress REST v2 feed — eligibility restrictions preserved per post',
  },
  {
    id: 'src-ofa-grants',
    name: 'Opportunities for Africans (Grants & Innovation)',
    domain: 'opportunitiesforafricans.com',
    url: 'https://www.opportunitiesforafricans.com/category/call-for-applications/',
    feedUrl: 'https://www.opportunitiesforafricans.com/wp-json/wp/v2/posts?categories=5,3,453&per_page=14&_embed=1',
    module: 'grants',
    method: 'wp_rest_json',
    frequencyLabel: 'Every 1h',
    termsNote: 'Public WordPress REST v2 feed for startup funding, grants & calls',
  },
  {
    id: 'src-effoysira-internships',
    name: 'EffoySira Fresh Graduate & Internships',
    domain: 'effoysira.com',
    url: 'https://effoysira.com/category/fresh-graduate-jobs/',
    feedUrl: 'https://effoysira.com/wp-json/wp/v2/posts?categories=30&per_page=8',
    module: 'internships',
    method: 'wp_rest_json',
    frequencyLabel: 'Every 1h',
    termsNote: 'Public WordPress REST v2 graduate trainee & internship feed',
  },
  {
    id: 'src-capital-business',
    name: 'Capital Ethiopia Business, Trade & Events',
    domain: 'capitalethiopia.com',
    url: 'https://capitalethiopia.com/category/business-economy/',
    feedUrl: 'https://www.capitalethiopia.com/wp-json/wp/v2/posts?categories=19,16,17,8998&per_page=12',
    module: 'trade',
    method: 'wp_rest_json',
    frequencyLabel: 'Every 1h',
    termsNote: 'Public WordPress REST v2 feed — categorized by verified topic',
  },
  {
    id: 'src-ethmonitor',
    name: 'Ethiopian Monitor Announcements & Trade',
    domain: 'ethiopianmonitor.com',
    url: 'https://ethiopianmonitor.com',
    feedUrl: 'https://ethiopianmonitor.com/wp-json/wp/v2/posts?categories=8,4693,4468,4469&per_page=12',
    module: 'public_announcements',
    method: 'wp_rest_json',
    frequencyLabel: 'Every 1h',
    termsNote: 'Public WordPress REST v2 feed for Ethiopia trade, policy & education notices',
  },
];

export interface ModuleMetadataInfo {
  id: OpportunityModuleType;
  label: string;
  description: string;
  emptyReason: string;
}

export const OPPORTUNITY_MODULES_META: ModuleMetadataInfo[] = [
  {
    id: 'tenders',
    label: 'Tenders & Procurement',
    description: 'Ethiopian government, university, NGO, and enterprise procurement bids.',
    emptyReason: 'No live tender records loaded right now. Check Source Health or refresh.',
  },
  {
    id: 'scholarships',
    label: 'Scholarships & Fellowships',
    description: 'Undergraduate, Masters, Doctoral, and international fellowships with source eligibility notes.',
    emptyReason: 'No live scholarship feeds returned items.',
  },
  {
    id: 'grants',
    label: 'Grants & Startup Funding',
    description: 'Innovation challenges, SME grants, accelerator programs, and research funding.',
    emptyReason: 'No live grant announcements matched.',
  },
  {
    id: 'internships',
    label: 'Internships & Grad Trainees',
    description: 'Graduate trainee tracks, internships, and youth fellowships separated from full-time jobs.',
    emptyReason: 'No live internship/graduate announcements returned.',
  },
  {
    id: 'training_external',
    label: 'External Courses & Bootcamps',
    description: 'External academies, bootcamps, and short workshops from verified providers.',
    emptyReason: 'No external short courses currently returned from connected feeds.',
  },
  {
    id: 'trade',
    label: 'Import, Export & Trade',
    description: 'Verified trade, investment, licensing, and business announcements in Ethiopia.',
    emptyReason: 'No trade announcements matched.',
  },
  {
    id: 'agriculture',
    label: 'Agriculture & Agribusiness',
    description: 'Coffee, farming, commodities, and agribusiness reports with source geographic coverage.',
    emptyReason: 'No agriculture announcements matched right now.',
  },
  {
    id: 'events',
    label: 'Events & Exhibitions',
    description: 'Trade fairs, business exhibitions, summits, and technology events.',
    emptyReason: 'No upcoming events matched from active feeds.',
  },
  {
    id: 'public_announcements',
    label: 'Public & Policy Notices',
    description: 'Public directives, education, energy, and official regulatory announcements.',
    emptyReason: 'No public notices matched right now.',
  },
  {
    id: 'business_directory',
    label: 'Business Directory',
    description: 'Verified Ethiopian companies, NGOs, hospitals, universities, and service providers.',
    emptyReason:
      'No authorized Ethiopian business registry API or verified directory feed is connected yet. TATARI never generates synthetic business profiles or contact details. Administrators can connect an authorized feed in Admin → Sources & Health.',
  },
  {
    id: 'real_estate',
    label: 'Real Estate & Property',
    description: 'Authorized residential, commercial, warehouse, and land listings.',
    emptyReason:
      'No authorized real estate source feed is connected yet. TATARI never invents property listings, square footage, or ETB prices. Administrators can attach an approved RSS/JSON property feed in Admin → Sources & Health.',
  },
  {
    id: 'vehicles',
    label: 'Vehicle Marketplace',
    description: 'Authorized used, new, and commercial vehicle listings.',
    emptyReason:
      'No authorized Ethiopian vehicle marketplace feed is connected yet. TATARI will never fabricate vehicle listings or asking prices.',
  },
  {
    id: 'certifications',
    label: 'Certifications & Exams',
    description: 'Official examination schedules, licensing bodies, and recognized certification notices.',
    emptyReason:
      'No authorized examination or licensing board feed is connected yet. TATARI never claims unverified certificate accreditation.',
  },
];

interface TwoMerkatoTenderRaw {
  id?: string;
  title?: string;
  bid_closing_date_text?: string;
  published_at?: string;
  created_at?: string;
  is_open?: boolean | null;
  company?: { name_en?: string; name_am?: string };
  region?: { name_en?: string } | null;
  categories?: Array<{ name_en?: string }> | null;
}

export function parse2MerkatoTendersHtml(
  html: string,
  collectedAt: string = new Date().toISOString()
): AggregatedOpportunity[] {
  const match = html.match(/<script[^>]*data-page="app"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match?.[1]) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1]);
  } catch {
    return [];
  }

  const list = (parsed as { props?: { tenders?: { data?: TwoMerkatoTenderRaw[] } } })?.props
    ?.tenders?.data;
  if (!Array.isArray(list)) return [];

  const results: AggregatedOpportunity[] = [];
  for (const item of list) {
    const idRaw = String(item.id || '').trim();
    const title = decodeHtmlEntities(String(item.title || '')).replace(/\s+/g, ' ').trim();
    if (!idRaw || !title) continue;

    const sourceUrl = sanitizeHttpUrl(`https://tender.2merkato.com/tenders/${encodeURIComponent(idRaw)}`);
    if (!sourceUrl) continue;

    const org =
      decodeHtmlEntities(String(item.company?.name_en || item.company?.name_am || '')).trim() ||
      'Not provided by source.';
    const rawClosing = String(item.bid_closing_date_text || '').trim();
    const deadline =
      !rawClosing || /subscription required/i.test(rawClosing)
        ? 'Not provided by source.'
        : rawClosing;
    const publishedAt = item.published_at
      ? new Date(item.published_at.replace(' ', 'T') + (item.published_at.includes('Z') ? '' : 'Z')).toISOString()
      : item.created_at
      ? new Date(item.created_at).toISOString()
      : null;
    const expired = item.is_open === false || isDeadlineExpired(deadline);
    const categoryName =
      item.categories && item.categories[0]?.name_en
        ? item.categories[0].name_en
        : inferTenderCategory(title);
    const location = item.region?.name_en ? `${item.region.name_en}, Ethiopia` : 'Ethiopia';

    results.push({
      id: `opp-2merkato-${idRaw.slice(0, 32)}`,
      module: 'tenders',
      title,
      organization: org,
      referenceNumber: idRaw.slice(0, 16),
      category: categoryName,
      location,
      eligibilityOrCoverage: 'See tender notice on 2Merkato',
      priceOrFunding: 'Not provided by source.',
      deadline,
      publishedAt: publishedAt && !Number.isNaN(new Date(publishedAt).getTime()) ? publishedAt : null,
      collectedAt,
      lastVerifiedAt: collectedAt,
      sourceId: 'src-2merkato-tenders',
      sourceName: '2Merkato Tenders Ethiopia',
      sourceDomain: 'tender.2merkato.com',
      sourceUrl,
      summary: `${title} issued by ${org}. View full tender documents and submission details on tender.2merkato.com.`,
      verificationStatus: expired ? 'Expired' : 'Verified',
      isExpired: expired,
      fingerprint: buildContentFingerprint([title, org, '2merkato']),
    });
  }

  return results;
}

function inferTenderCategory(title: string): string {
  const l = title.toLowerCase();
  if (/construct|building|road|water|civil|renovat|ግንባታ/.test(l)) return 'Construction & Infrastructure';
  if (/software|it|network|computer|server|printer|ict/.test(l)) return 'IT & Software';
  if (/medic|pharma|hospital|clinic|lab|health/.test(l)) return 'Medical Supplies';
  if (/consult|audit|study|train|survey/.test(l)) return 'Consultancy';
  if (/transport|vehicle|truck|car|fuel/.test(l)) return 'Transportation';
  if (/agri|seed|fertilizer|coffee|food|refreshment/.test(l)) return 'Agriculture & Food';
  return 'General Procurement';
}

export interface WordPressPostRaw {
  id: number | string;
  date?: string;
  link?: string;
  title?: { rendered?: string };
  excerpt?: { rendered?: string };
  content?: { rendered?: string };
  _embedded?: {
    'wp:term'?: Array<Array<{ name?: string; slug?: string }>>;
  };
}

function classifyWordPressModule(
  defaultModule: OpportunityModuleType,
  title: string,
  excerpt: string,
  terms: string[]
): OpportunityModuleType | null {
  const combined = `${title} ${excerpt} ${terms.join(' ')}`.toLowerCase();

  if (defaultModule === 'tenders') {
    if (/bid|tender|auction|procurement|invitation|rfp|rfq/.test(combined)) return 'tenders';
    // Capital Ethiopia Vacancy & Bid category also posts vacancies — skip pure job ads here or ignore
    return null;
  }

  if (defaultModule === 'scholarships') {
    if (/academy|bootcamp|short course|training|workshop/.test(combined) && !/scholarship|masters|phd|bursary|degree/.test(combined)) {
      return 'training_external';
    }
    return 'scholarships';
  }

  if (defaultModule === 'grants') {
    if (/grant|fund|funding|award|challenge|competition|startup|innovation|entrepreneur|accelerator|incubator|investment|\€|\$/.test(combined)) {
      return 'grants';
    }
    if (/fellowship|leadership|board|youth/.test(combined)) return 'scholarships';
    if (/intern|graduate trainee/.test(combined)) return 'internships';
    return null;
  }

  if (defaultModule === 'internships') {
    if (/intern|graduate|trainee|volunteer|apprentice|fellow/.test(combined)) return 'internships';
    return 'internships';
  }

  if (defaultModule === 'trade' || defaultModule === 'public_announcements') {
    if (/exhibition|conference|summit|expo|fair|forum|wub addis|seminar/.test(combined)) return 'events';
    if (/coffee|agri|farm|fertilizer|wheat|milk|crop|livestock/.test(combined)) return 'agriculture';
    if (/directive|authority|proclamation|tax|license|ministry|commission|admission|exam|university/.test(combined)) {
      return 'public_announcements';
    }
    if (/export|import|trade|investment|pipeline|factory|plant|business|bank|entrepreneurs/.test(combined)) {
      return 'trade';
    }
    return defaultModule;
  }

  return defaultModule;
}

function inferCountryEligibility(text: string): string {
  const l = text.toLowerCase();
  if (l.includes('ethiopia')) return 'Ethiopia / Ethiopian Nationals eligible';
  if (l.includes('african') || l.includes('africa')) return 'African Nationals (Verify Ethiopia eligibility on source)';
  if (l.includes('worldwide') || l.includes('global') || l.includes('developing countries')) {
    return 'Global / International (Verify Ethiopia eligibility on source)';
  }
  if (l.includes('nigeria') || l.includes('nigerian')) return 'Nigeria-specific (Verify eligibility on source)';
  if (l.includes('kenya') || l.includes('kenyan')) return 'Kenya-specific (Verify eligibility on source)';
  if (l.includes('south africa')) return 'South Africa-specific (Verify eligibility on source)';
  return 'See original source for country & eligibility rules';
}

function extractFundingMention(text: string): string {
  const match = text.match(/(?:€|\$|USD|EUR|ETB)\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:million|k|thousand|billion))?/i);
  if (match) return match[0];
  if (/fully funded/i.test(text)) return 'Fully Funded (See source details)';
  if (/partial/i.test(text)) return 'Partial Funding (See source details)';
  return 'Not provided by source.';
}

export function parseWordPressPostsToOpportunities(
  posts: WordPressPostRaw[],
  source: Pick<OpportunitySourceDefinition, 'id' | 'name' | 'domain' | 'module'>,
  collectedAt: string = new Date().toISOString()
): AggregatedOpportunity[] {
  if (!Array.isArray(posts)) return [];
  const results: AggregatedOpportunity[] = [];

  for (const post of posts) {
    const title = decodeHtmlEntities(stripHtmlToText(String(post.title?.rendered || ''))).trim();
    const sourceUrl = sanitizeHttpUrl(String(post.link || '').trim());
    if (!title || !sourceUrl) continue;

    const excerpt = stripHtmlToText(String(post.excerpt?.rendered || ''));
    const terms = (post._embedded?.['wp:term']?.[0] || [])
      .map((t) => String(t.name || ''))
      .filter(Boolean);

    const resolvedModule = classifyWordPressModule(source.module, title, excerpt, terms);
    if (!resolvedModule) continue;

    const publishedAt =
      post.date && !Number.isNaN(new Date(post.date).getTime())
        ? new Date(post.date).toISOString()
        : null;

    const location = /ethiopia|addis/i.test(`${title} ${excerpt}`) ? 'Ethiopia' : inferCountryEligibility(`${title} ${excerpt}`);

    results.push({
      id: `opp-${source.id}-${String(post.id).replace(/[^a-z0-9]/gi, '')}`,
      module: resolvedModule,
      title,
      organization: source.name,
      referenceNumber: `WP-${post.id}`,
      category: terms[0] || resolvedModule.replace('_', ' '),
      location,
      eligibilityOrCoverage: inferCountryEligibility(`${title} ${excerpt}`),
      priceOrFunding:
        resolvedModule === 'training_external'
          ? 'Verify fee & accreditation on provider'
          : extractFundingMention(`${title} ${excerpt}`),
      deadline: 'Not provided by source.',
      publishedAt,
      collectedAt,
      lastVerifiedAt: collectedAt,
      sourceId: source.id,
      sourceName: source.name,
      sourceDomain: source.domain,
      sourceUrl,
      summary: excerpt.slice(0, 220) || `${title}. Open original source on ${source.domain}.`,
      verificationStatus: 'Verified',
      isExpired: false,
      fingerprint: buildContentFingerprint([title, source.domain, publishedAt?.slice(0, 10)]),
    });
  }

  return results;
}

export function parseGenericRssOrAtomXml(
  xml: string,
  source: Pick<OpportunitySourceDefinition, 'id' | 'name' | 'domain' | 'module'>,
  collectedAt: string = new Date().toISOString()
): AggregatedOpportunity[] {
  if (!xml) return [];
  const itemMatches = [
    ...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi),
  ];
  const results: AggregatedOpportunity[] = [];

  for (let i = 0; i < itemMatches.length; i++) {
    const block = itemMatches[i][2];
    const titleRaw = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
    const title = decodeHtmlEntities(stripHtmlToText(titleRaw.replace(/<!\[CDATA\[|\]\]>/g, ''))).trim();
    const linkHref =
      block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] ||
      block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ||
      '';
    const sourceUrl = sanitizeHttpUrl(linkHref.replace(/<!\[CDATA\[|\]\]>/g, '').trim());
    if (!title || !sourceUrl) continue;

    const pubRaw =
      block.match(/<(pubDate|published|updated)[^>]*>([\s\S]*?)<\/\1>/i)?.[2]?.trim() || '';
    const parsedPub = pubRaw && !Number.isNaN(new Date(pubRaw).getTime()) ? new Date(pubRaw).toISOString() : null;
    const descRaw =
      block.match(/<(description|summary|content)[^>]*>([\s\S]*?)<\/\1>/i)?.[2] || '';
    const summary = stripHtmlToText(descRaw.replace(/<!\[CDATA\[|\]\]>/g, '')).slice(0, 220);

    results.push({
      id: `opp-rss-${source.id}-${buildContentFingerprint([title, sourceUrl]).slice(3)}`,
      module: source.module,
      title,
      organization: source.name,
      referenceNumber: 'Not provided by source.',
      category: source.module,
      location: 'Ethiopia',
      eligibilityOrCoverage: 'See original source',
      priceOrFunding: 'Not provided by source.',
      deadline: 'Not provided by source.',
      publishedAt: parsedPub,
      collectedAt,
      lastVerifiedAt: collectedAt,
      sourceId: source.id,
      sourceName: source.name,
      sourceDomain: source.domain,
      sourceUrl,
      summary: summary || `${title}. View details on ${source.domain}.`,
      verificationStatus: 'Verified',
      isExpired: false,
      fingerprint: buildContentFingerprint([title, source.domain]),
    });
  }

  return results;
}

export function deduplicateOpportunities(
  items: AggregatedOpportunity[]
): { deduplicated: AggregatedOpportunity[]; duplicatesDetected: number } {
  const seenUrls = new Set<string>();
  const seenFingerprints = new Map<string, string>();
  const deduplicated: AggregatedOpportunity[] = [];
  let duplicatesDetected = 0;

  for (const item of items) {
    const urlKey = item.sourceUrl.toLowerCase();
    if (seenUrls.has(urlKey)) {
      duplicatesDetected++;
      continue;
    }
    seenUrls.add(urlKey);

    const existingId = seenFingerprints.get(item.fingerprint);
    if (existingId) {
      // Preserve distinct source attribution while flagging duplicate cross-posting
      duplicatesDetected++;
      deduplicated.push({ ...item, duplicateOfId: existingId });
    } else {
      seenFingerprints.set(item.fingerprint, item.id);
      deduplicated.push(item);
    }
  }

  return { deduplicated, duplicatesDetected };
}

export interface UniversalSearchResult {
  id: string;
  section: 'jobs' | 'fx' | 'opportunities' | 'training' | 'store';
  badge: string;
  title: string;
  subtitle: string;
  sourceLabel: string;
  sourceUrl?: string;
}

export function runUniversalSearch(params: {
  query: string;
  jobs: JobListing[];
  fxRates: BankFxRateRecord[];
  opportunities: AggregatedOpportunity[];
  trainingPrograms: TrainingProgram[];
  products: DigitalProduct[];
}): UniversalSearchResult[] {
  const q = params.query.trim().toLowerCase();
  if (q.length < 2) return [];

  const results: UniversalSearchResult[] = [];

  for (const j of params.jobs) {
    if (j.status !== 'approved') continue;
    if (`${j.titleEn} ${j.companyName} ${j.location} ${j.category}`.toLowerCase().includes(q)) {
      results.push({
        id: j.id,
        section: 'jobs',
        badge: j.sourceType === 'external' ? `Job · ${j.sourceSite}` : 'Job · TATARI',
        title: j.titleEn,
        subtitle: `${j.companyName} · ${j.location}`,
        sourceLabel: j.sourceDomain || 'tatari.et',
        sourceUrl: j.sourceUrl,
      });
    }
  }

  for (const r of params.fxRates) {
    if (`${r.bankName} ${r.bankShortName} ${r.currencyCode} ${r.currencyName}`.toLowerCase().includes(q)) {
      results.push({
        id: r.id,
        section: 'fx',
        badge: `Bank FX · ${r.currencyCode} (${r.rateCategory})`,
        title: `${r.bankName} — ${r.currencyCode}`,
        subtitle: `Buy: ${r.buyingRate ?? 'N/A'} · Sell: ${r.sellingRate ?? 'N/A'} ETB`,
        sourceLabel: r.publishedDate || 'Official Feed',
        sourceUrl: r.sourceUrl,
      });
    }
  }

  for (const o of params.opportunities) {
    if (`${o.title} ${o.organization} ${o.category} ${o.location} ${o.summary}`.toLowerCase().includes(q)) {
      results.push({
        id: o.id,
        section: 'opportunities',
        badge: o.module.replace('_', ' '),
        title: o.title,
        subtitle: `${o.organization} · ${o.location}`,
        sourceLabel: o.sourceDomain,
        sourceUrl: o.sourceUrl,
      });
    }
  }

  for (const t of params.trainingPrograms) {
    if (!t.active) continue;
    if (`${t.titleEn} ${t.category} ${t.summaryEn}`.toLowerCase().includes(q)) {
      results.push({
        id: t.id,
        section: 'training',
        badge: 'TATARI Academy',
        title: t.titleEn,
        subtitle: `${t.durationLabel} · ETB ${t.feePerCohortEtb.toLocaleString('en-US')}`,
        sourceLabel: 'TATARI Consulting',
      });
    }
  }

  for (const p of params.products) {
    if (!p.active) continue;
    if (`${p.titleEn} ${p.category} ${p.descriptionEn}`.toLowerCase().includes(q)) {
      results.push({
        id: p.id,
        section: 'store',
        badge: 'Digital Store',
        title: p.titleEn,
        subtitle: `${p.category} · ETB ${p.priceEtb.toLocaleString('en-US')}`,
        sourceLabel: p.fileFormat,
      });
    }
  }

  return results.slice(0, 30);
}
