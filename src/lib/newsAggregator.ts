import {
  buildContentFingerprint,
  decodeHtmlEntities,
  sanitizeHttpUrl,
  stripHtmlToText,
} from './externalJobs.ts';
import type {
  NewsArticleRecord,
  NewsCoverageScope,
  NewsPublisherId,
} from '../types/domain.ts';

export interface TopNewsSourceDefinition {
  id: NewsPublisherId;
  name: string;
  domain: string;
  homeUrl: string;
  feedUrl: string;
  coverage: NewsCoverageScope;
  language: 'en' | 'am';
  method: 'rss_xml' | 'wp_rest_json' | 'news_index_rss';
  fallbackFeedUrl?: string;
  fallbackMethod?: 'rss_xml' | 'wp_rest_json' | 'news_index_rss';
  stripPublisherSuffix?: string[];
}

export const TOP_NEWS_SOURCES: TopNewsSourceDefinition[] = [
  {
    id: 'reuters',
    name: 'Reuters',
    domain: 'reuters.com',
    homeUrl: 'https://www.reuters.com/world/',
    feedUrl:
      'https://news.google.com/rss/search?q=site:reuters.com+when:7d&hl=en-US&gl=US&ceid=US:en',
    coverage: 'World',
    language: 'en',
    method: 'news_index_rss',
    stripPublisherSuffix: [' - Reuters'],
  },
  {
    id: 'bbc_news',
    name: 'BBC News',
    domain: 'bbc.co.uk',
    homeUrl: 'https://www.bbc.com/news/world',
    feedUrl: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    coverage: 'World',
    language: 'en',
    method: 'rss_xml',
  },
  {
    id: 'al_jazeera',
    name: 'Al Jazeera',
    domain: 'aljazeera.com',
    homeUrl: 'https://www.aljazeera.com/africa/',
    feedUrl: 'https://www.aljazeera.com/xml/rss/all.xml',
    coverage: 'World and Africa',
    language: 'en',
    method: 'rss_xml',
  },
  {
    id: 'cnn',
    name: 'CNN',
    domain: 'cnn.com',
    homeUrl: 'https://edition.cnn.com/world',
    feedUrl:
      'https://news.google.com/rss/search?q=site:cnn.com+when:7d&hl=en-US&gl=US&ceid=US:en',
    coverage: 'World',
    language: 'en',
    method: 'news_index_rss',
    stripPublisherSuffix: [' - CNN'],
  },
  {
    id: 'ap_news',
    name: 'AP News',
    domain: 'apnews.com',
    homeUrl: 'https://apnews.com/world-news',
    feedUrl:
      'https://news.google.com/rss/search?q=site:apnews.com+world+when:7d&hl=en-US&gl=US&ceid=US:en',
    coverage: 'World',
    language: 'en',
    method: 'news_index_rss',
    stripPublisherSuffix: [' - AP News', ' - The Associated Press'],
  },
  {
    id: 'africanews',
    name: 'Africanews',
    domain: 'africanews.com',
    homeUrl: 'https://www.africanews.com/',
    feedUrl: 'https://www.africanews.com/feed/rss',
    coverage: 'Africa',
    language: 'en',
    method: 'rss_xml',
  },
  {
    id: 'allafrica',
    name: 'AllAfrica',
    domain: 'allafrica.com',
    homeUrl: 'https://allafrica.com/',
    feedUrl: 'https://allafrica.com/tools/headlines/rdf/africa/headlines.rdf',
    coverage: 'Africa',
    language: 'en',
    method: 'rss_xml',
  },
  {
    id: 'addis_standard',
    name: 'Addis Standard',
    domain: 'addisstandard.com',
    homeUrl: 'https://addisstandard.com/',
    feedUrl:
      'https://news.google.com/rss/search?q=site:addisstandard.com&hl=en-US&gl=US&ceid=US:en',
    coverage: 'Ethiopia',
    language: 'en',
    method: 'news_index_rss',
    stripPublisherSuffix: [' - Addis Standard'],
  },
  {
    id: 'the_reporter',
    name: 'The Reporter',
    domain: 'thereporterethiopia.com',
    homeUrl: 'https://www.thereporterethiopia.com/',
    feedUrl: 'https://www.thereporterethiopia.com/wp-json/wp/v2/posts?per_page=12&_embed',
    fallbackFeedUrl:
      'https://news.google.com/rss/search?q=site:thereporterethiopia.com&hl=en-US&gl=US&ceid=US:en',
    fallbackMethod: 'news_index_rss',
    stripPublisherSuffix: [' - The Reporter Ethiopia', ' - The Reporter'],
    coverage: 'Ethiopia',
    language: 'en',
    method: 'wp_rest_json',
  },
  {
    id: 'bbc_amharic',
    name: 'BBC Amharic',
    domain: 'bbc.com/amharic',
    homeUrl: 'https://www.bbc.com/amharic',
    feedUrl: 'https://feeds.bbci.co.uk/amharic/rss.xml',
    coverage: 'Ethiopia and world',
    language: 'am',
    method: 'rss_xml',
  },
];

export const NEWS_COVERAGE_FILTERS: { id: 'all' | NewsCoverageScope; label: string }[] = [
  { id: 'all', label: 'All Coverage' },
  { id: 'Ethiopia', label: 'Ethiopia' },
  { id: 'Ethiopia and world', label: 'Ethiopia & World' },
  { id: 'Africa', label: 'Africa' },
  { id: 'World and Africa', label: 'World & Africa' },
  { id: 'World', label: 'World' },
];

export interface NewsWordPressPostRaw {
  id: number | string;
  date?: string;
  link?: string;
  title?: { rendered?: string };
  excerpt?: { rendered?: string };
  _embedded?: {
    'wp:term'?: Array<Array<{ name?: string; slug?: string }>>;
    'wp:featuredmedia'?: Array<{ source_url?: string }>;
  };
}

function cleanIndexedTitle(title: string, suffixes?: string[]): string {
  let out = title.trim();
  if (suffixes) {
    for (const s of suffixes) {
      if (out.endsWith(s)) {
        out = out.slice(0, -s.length).trim();
      }
    }
  }
  return out;
}

function extractImageFromXmlBlock(block: string): string | undefined {
  const mediaThumb = block.match(/<media:(?:thumbnail|content)[^>]+url=["']([^"']+)["']/i)?.[1];
  if (mediaThumb) return sanitizeHttpUrl(mediaThumb) ?? undefined;
  const enclosure = block.match(
    /<enclosure[^>]+type=["']image\/[^"']*["'][^>]+url=["']([^"']+)["']|<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image\//i
  );
  const encUrl = enclosure?.[1] || enclosure?.[2];
  if (encUrl) return sanitizeHttpUrl(encUrl) ?? undefined;
  return undefined;
}

export function parseNewsRssXml(
  xml: string,
  source: TopNewsSourceDefinition,
  collectedAt: string = new Date().toISOString(),
  limit: number = 12
): NewsArticleRecord[] {
  if (!xml) return [];
  const itemMatches = [...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)];
  const articles: NewsArticleRecord[] = [];

  for (const match of itemMatches) {
    if (articles.length >= limit) break;
    const block = match[2];

    const titleRaw = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
    const decodedTitle = decodeHtmlEntities(
      stripHtmlToText(titleRaw.replace(/<!\[CDATA\[|\]\]>/g, ''))
    ).trim();
    const title = cleanIndexedTitle(decodedTitle, source.stripPublisherSuffix);

    const linkHref =
      block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] ||
      block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ||
      '';
    const sourceUrl = sanitizeHttpUrl(
      decodeHtmlEntities(linkHref.replace(/<!\[CDATA\[|\]\]>/g, '')).trim()
    );

    if (!title || !sourceUrl) continue;

    const pubRaw =
      block.match(/<(pubDate|published|updated|dc:date)[^>]*>([\s\S]*?)<\/\1>/i)?.[2]?.trim() ||
      '';
    const publishedAt =
      pubRaw && !Number.isNaN(new Date(pubRaw).getTime())
        ? new Date(pubRaw).toISOString()
        : null;

    const catRaw = block.match(/<category[^>]*>([\s\S]*?)<\/category>/i)?.[1] || '';
    const category =
      decodeHtmlEntities(stripHtmlToText(catRaw.replace(/<!\[CDATA\[|\]\]>/g, ''))).trim() ||
      source.coverage;

    const descRaw =
      block.match(/<(description|summary|content)[^>]*>([\s\S]*?)<\/\1>/i)?.[2] || '';
    const strippedDesc = decodeHtmlEntities(
      stripHtmlToText(descRaw.replace(/<!\[CDATA\[|\]\]>/g, ''))
    ).trim();

    // Google News descriptions repeat the anchor title + outlet name; format cleanly instead
    const summary =
      source.method === 'news_index_rss' ||
      !strippedDesc ||
      strippedDesc.toLowerCase().startsWith(title.slice(0, 24).toLowerCase())
        ? `${source.name} (${source.coverage}) headline. Open original article on ${source.domain}.`
        : strippedDesc.slice(0, 260);

    const imageUrl = extractImageFromXmlBlock(block);
    const fingerprint = buildContentFingerprint([title, source.id]);

    articles.push({
      id: `news-${source.id}-${fingerprint.slice(3)}`,
      publisherId: source.id,
      publisherName: source.name,
      publisherDomain: source.domain,
      coverage: source.coverage,
      language: source.language,
      title,
      summary,
      sourceUrl,
      imageUrl,
      category,
      publishedAt,
      collectedAt,
      sourceMethod: source.method,
      verificationStatus: 'Verified',
      fingerprint,
    });
  }

  return articles;
}

export function parseWordPressNewsPosts(
  posts: NewsWordPressPostRaw[],
  source: TopNewsSourceDefinition,
  collectedAt: string = new Date().toISOString(),
  limit: number = 12
): NewsArticleRecord[] {
  if (!Array.isArray(posts)) return [];
  const articles: NewsArticleRecord[] = [];

  for (const post of posts) {
    if (articles.length >= limit) break;
    const title = decodeHtmlEntities(stripHtmlToText(String(post.title?.rendered || ''))).trim();
    const sourceUrl = sanitizeHttpUrl(String(post.link || '').trim());
    if (!title || !sourceUrl) continue;

    const excerpt = decodeHtmlEntities(
      stripHtmlToText(String(post.excerpt?.rendered || ''))
    ).trim();
    const publishedAt =
      post.date && !Number.isNaN(new Date(post.date).getTime())
        ? new Date(post.date).toISOString()
        : null;
    const category =
      decodeHtmlEntities(String(post._embedded?.['wp:term']?.[0]?.[0]?.name || '')).trim() ||
      source.coverage;
    const rawImg = post._embedded?.['wp:featuredmedia']?.[0]?.source_url;
    const imageUrl = rawImg ? (sanitizeHttpUrl(rawImg) ?? undefined) : undefined;
    const fingerprint = buildContentFingerprint([title, source.id]);

    articles.push({
      id: `news-${source.id}-${String(post.id).replace(/[^a-z0-9]/gi, '')}`,
      publisherId: source.id,
      publisherName: source.name,
      publisherDomain: source.domain,
      coverage: source.coverage,
      language: source.language,
      title,
      summary:
        excerpt.slice(0, 260) ||
        `${source.name} (${source.coverage}) report. Read full coverage on ${source.domain}.`,
      sourceUrl,
      imageUrl,
      category,
      publishedAt,
      collectedAt,
      sourceMethod: 'wp_rest_json',
      verificationStatus: 'Verified',
      fingerprint,
    });
  }

  return articles;
}

export function deduplicateAndSortNews(articles: NewsArticleRecord[]): NewsArticleRecord[] {
  const seenUrls = new Set<string>();
  const seenFingerprints = new Set<string>();
  const out: NewsArticleRecord[] = [];

  for (const a of articles) {
    const urlKey = a.sourceUrl.toLowerCase();
    if (seenUrls.has(urlKey) || seenFingerprints.has(a.fingerprint)) continue;
    seenUrls.add(urlKey);
    seenFingerprints.add(a.fingerprint);
    out.push(a);
  }

  out.sort((a, b) => {
    const ta = new Date(a.publishedAt || a.collectedAt).getTime();
    const tb = new Date(b.publishedAt || b.collectedAt).getTime();
    return tb - ta;
  });

  return out;
}
