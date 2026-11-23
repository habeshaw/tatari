import { decodeHtmlEntities, sanitizeHttpUrl, stripHtmlToText } from './externalJobs.ts';
import type {
  BankFxHistoryPoint,
  BankFxRateCategory,
  BankFxRateRecord,
  BankFxSourceStatus,
  NbeIndicativeMidRate,
} from '../types/domain.ts';

export interface EthiopianBankRegistryItem {
  bankId: string;
  bankName: string;
  bankShortName: string;
  isCentralBank: boolean;
  officialWebsite: string;
  fxPageUrl: string;
  feedUrl: string;
  method: 'official_api' | 'official_html_table' | 'js_rendered' | 'unreachable_blocked';
  unavailableReason?: string;
}

export const ETHIOPIAN_BANKS_CATALOG: EthiopianBankRegistryItem[] = [
  {
    bankId: 'nbe',
    bankName: 'National Bank of Ethiopia (NBE)',
    bankShortName: 'NBE',
    isCentralBank: true,
    officialWebsite: 'https://nbe.gov.et',
    fxPageUrl: 'https://nbe.gov.et/exchange/',
    feedUrl: 'https://api.nbe.gov.et/api/get-selected-exchange-rates',
    method: 'official_api',
  },
  {
    bankId: 'dashen',
    bankName: 'Dashen Bank S.C.',
    bankShortName: 'Dashen',
    isCentralBank: false,
    officialWebsite: 'https://dashenbanksc.com',
    fxPageUrl: 'https://dashenbanksc.com/daily-exchange-rates/',
    feedUrl: 'https://dashenbanksc.com/daily-exchange-rates/',
    method: 'official_html_table',
  },
  {
    bankId: 'coop',
    bankName: 'Cooperative Bank of Oromia',
    bankShortName: 'CoopBank',
    isCentralBank: false,
    officialWebsite: 'https://coopbankoromia.com.et',
    fxPageUrl: 'https://coopbankoromia.com.et/daily-exchange-rates/',
    feedUrl: 'https://coopbankoromia.com.et/daily-exchange-rates/',
    method: 'official_html_table',
  },
  {
    bankId: 'bunna',
    bankName: 'Bunna Bank S.C.',
    bankShortName: 'Bunna',
    isCentralBank: false,
    officialWebsite: 'https://bunnabanksc.com',
    fxPageUrl: 'https://bunnabanksc.com/foreign-exchange/',
    feedUrl: 'https://mb.bunnabanksc.com/api/v1/user/public/forex',
    method: 'official_api',
  },
  {
    bankId: 'amhara',
    bankName: 'Amhara Bank S.C.',
    bankShortName: 'Amhara',
    isCentralBank: false,
    officialWebsite: 'https://www.amharabank.com.et',
    fxPageUrl: 'https://www.amharabank.com.et/daily-exchange-rate/',
    feedUrl: 'https://www.amharabank.com.et/daily-exchange-rate/',
    method: 'official_html_table',
  },
  {
    bankId: 'nib',
    bankName: 'Nib International Bank',
    bankShortName: 'Nib',
    isCentralBank: false,
    officialWebsite: 'https://www.nibbanksc.com',
    fxPageUrl: 'https://www.nibbanksc.com/exchange-rate/',
    feedUrl: 'https://www.nibbanksc.com/exchange-rate/',
    method: 'official_html_table',
  },
  {
    bankId: 'cbe',
    bankName: 'Commercial Bank of Ethiopia',
    bankShortName: 'CBE',
    isCentralBank: false,
    officialWebsite: 'https://www.combanketh.et',
    fxPageUrl: 'https://www.combanketh.et/en/exchange-rate',
    feedUrl: 'https://www.combanketh.et/en/exchange-rate',
    method: 'unreachable_blocked',
    unavailableReason: 'Official host unreachable from server network or behind WAF/JS protection.',
  },
  {
    bankId: 'awash',
    bankName: 'Awash Bank S.C.',
    bankShortName: 'Awash',
    isCentralBank: false,
    officialWebsite: 'https://awashbank.com',
    fxPageUrl: 'https://awashbank.com/exchange-historical/',
    feedUrl: 'https://awashbank.com/exchange-historical/',
    method: 'js_rendered',
    unavailableReason: 'FX table is client-side rendered without a public static HTML table.',
  },
  {
    bankId: 'abyssinia',
    bankName: 'Bank of Abyssinia',
    bankShortName: 'BOA',
    isCentralBank: false,
    officialWebsite: 'https://www.bankofabyssinia.com',
    fxPageUrl: 'https://www.bankofabyssinia.com/exchange-rate-2/',
    feedUrl: 'https://www.bankofabyssinia.com/exchange-rate-2/',
    method: 'unreachable_blocked',
    unavailableReason: 'Source endpoint timed out or refused automated HTTPS fetch.',
  },
  {
    bankId: 'wegagen',
    bankName: 'Wegagen Bank S.C.',
    bankShortName: 'Wegagen',
    isCentralBank: false,
    officialWebsite: 'https://www.wegagen.com',
    fxPageUrl: 'https://www.wegagen.com/exchange-rate/',
    feedUrl: 'https://www.wegagen.com/exchange-rate/',
    method: 'unreachable_blocked',
    unavailableReason: 'Returned HTTP 403 restriction to automated requests.',
  },
  {
    bankId: 'hibret',
    bankName: 'Hibret Bank S.C.',
    bankShortName: 'Hibret',
    isCentralBank: false,
    officialWebsite: 'https://www.hibretbank.com.et',
    fxPageUrl: 'https://www.hibretbank.com.et/exchange-rate/',
    feedUrl: 'https://www.hibretbank.com.et/exchange-rate/',
    method: 'unreachable_blocked',
    unavailableReason: 'Source host did not respond to automated HTTPS fetch.',
  },
  {
    bankId: 'oromia',
    bankName: 'Oromia Bank S.C.',
    bankShortName: 'Oromia Bank',
    isCentralBank: false,
    officialWebsite: 'https://www.oromiabank.com',
    fxPageUrl: 'https://www.oromiabank.com/exchange-rates/',
    feedUrl: 'https://www.oromiabank.com/exchange-rates/',
    method: 'unreachable_blocked',
    unavailableReason: 'Returned HTTP 406 restriction to automated requests.',
  },
  {
    bankId: 'zemen',
    bankName: 'Zemen Bank S.C.',
    bankShortName: 'Zemen',
    isCentralBank: false,
    officialWebsite: 'https://www.zemenbank.com',
    fxPageUrl: 'https://www.zemenbank.com/exchange-rates',
    feedUrl: 'https://www.zemenbank.com/wp-admin/admin-ajax.php',
    method: 'official_api',
  },
  {
    bankId: 'berhan',
    bankName: 'Berhan Bank S.C.',
    bankShortName: 'Berhan',
    isCentralBank: false,
    officialWebsite: 'https://berhanbanksc.com',
    fxPageUrl: 'https://berhanbanksc.com/exchange-rate/',
    feedUrl: 'https://berhanbanksc.com/exchange-rate/',
    method: 'official_html_table',
  },
  {
    bankId: 'enat',
    bankName: 'Enat Bank S.C.',
    bankShortName: 'Enat',
    isCentralBank: false,
    officialWebsite: 'https://www.enatbanksc.com',
    fxPageUrl: 'https://www.enatbanksc.com/',
    feedUrl: 'https://www.enatbanksc.com/',
    method: 'official_html_table',
  },
  {
    bankId: 'abay',
    bankName: 'Abay Bank S.C.',
    bankShortName: 'Abay',
    isCentralBank: false,
    officialWebsite: 'https://abaybank.com.et',
    fxPageUrl: 'https://abaybank.com.et/',
    feedUrl: 'https://abaybank.com.et/',
    method: 'official_html_table',
  },
  {
    bankId: 'siinqee',
    bankName: 'Siinqee Bank S.C.',
    bankShortName: 'Siinqee',
    isCentralBank: false,
    officialWebsite: 'https://siinqeebank.com',
    fxPageUrl: 'https://siinqeebank.com/',
    feedUrl: 'https://siinqeebank.com/',
    method: 'official_html_table',
  },
  {
    bankId: 'zamzam',
    bankName: 'ZamZam Bank S.C.',
    bankShortName: 'ZamZam',
    isCentralBank: false,
    officialWebsite: 'https://zamzambank.com',
    fxPageUrl: 'https://zamzambank.com/',
    feedUrl: 'https://zamzambank.com/',
    method: 'official_html_table',
  },
  {
    bankId: 'global',
    bankName: 'Global Bank Ethiopia S.C.',
    bankShortName: 'Global',
    isCentralBank: false,
    officialWebsite: 'https://www.globalbankethiopia.com',
    fxPageUrl: 'https://www.globalbankethiopia.com/',
    feedUrl: 'https://www.globalbankethiopia.com/',
    method: 'official_html_table',
  },
  {
    bankId: 'addis',
    bankName: 'Addis International Bank',
    bankShortName: 'AdIB',
    isCentralBank: false,
    officialWebsite: 'https://www.addisbanksc.com',
    fxPageUrl: 'https://www.addisbanksc.com/',
    feedUrl: 'https://www.addisbanksc.com/',
    method: 'unreachable_blocked',
    unavailableReason: 'No accessible automated FX feed verified.',
  },
  {
    bankId: 'gadaa',
    bankName: 'Gadaa Bank S.C.',
    bankShortName: 'Gadaa',
    isCentralBank: false,
    officialWebsite: 'https://www.gadaabank.com.et',
    fxPageUrl: 'https://www.gadaabank.com.et/',
    feedUrl: 'https://www.gadaabank.com.et/',
    method: 'unreachable_blocked',
    unavailableReason: 'No accessible automated FX feed verified.',
  },
  {
    bankId: 'tsedey',
    bankName: 'Tsedey Bank S.C.',
    bankShortName: 'Tsedey',
    isCentralBank: false,
    officialWebsite: 'https://www.tsedeybank.com.et',
    fxPageUrl: 'https://www.tsedeybank.com.et/',
    feedUrl: 'https://www.tsedeybank.com.et/',
    method: 'official_api',
  },
];

const CURRENCY_NAME_MAP: Record<string, string> = {
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'Pound Sterling',
  AED: 'UAE Dirham',
  SAR: 'Saudi Riyal',
  CAD: 'Canadian Dollar',
  CHF: 'Swiss Franc',
  AUD: 'Australian Dollar',
  JPY: 'Japanese Yen',
  CNY: 'Chinese Yuan',
  SEK: 'Swedish Krona',
  NOK: 'Norwegian Krone',
  DKK: 'Danish Krone',
  KWD: 'Kuwaiti Dinar',
  KES: 'Kenyan Shilling',
  ZAR: 'South African Rand',
  INR: 'Indian Rupee',
  DJF: 'Djiboutian Franc',
};

export function normalizeCurrencyCode(raw: string): string | null {
  const clean = decodeHtmlEntities(String(raw || '')).trim();
  if (!clean) return null;
  const mapAlias = (code: string) => (code === 'YUA' ? 'CNY' : code);
  const paren = clean.match(/\(([A-Za-z]{3})\)/);
  if (paren) return mapAlias(paren[1].toUpperCase());
  const prefixDash = clean.match(/^([A-Za-z]{3})\s*[-–]/);
  if (prefixDash) return mapAlias(prefixDash[1].toUpperCase());
  const exact = clean.match(/^([A-Za-z]{3})$/);
  if (exact) return mapAlias(exact[1].toUpperCase());
  const upper = clean.toUpperCase();
  const token = upper.match(
    /\b(USD|EUR|GBP|AED|SAR|CAD|CHF|AUD|JPY|CNY|YUA|SEK|NOK|DKK|KWD|KES|ZAR|INR|DJF)\b/
  );
  if (token) return mapAlias(token[1]);
  if (upper.includes('US DOLLAR')) return 'USD';
  if (upper.includes('EURO')) return 'EUR';
  if (upper.includes('POUND')) return 'GBP';
  if (upper.includes('DIRHAM')) return 'AED';
  if (upper.includes('RIYAL')) return 'SAR';
  if (upper.includes('SWISS')) return 'CHF';
  if (upper.includes('CANADIAN')) return 'CAD';
  if (upper.includes('JAPAN')) return 'JPY';
  if (upper.includes('CHINESE') || upper.includes('YUAN')) return 'CNY';
  return null;
}

export function normalizeCurrencyName(code: string, rawName?: string): string {
  const cleaned = decodeHtmlEntities(String(rawName || '')).replace(/\([A-Za-z]{3}\)/g, '').trim();
  if (cleaned && cleaned.length >= 2 && cleaned.toUpperCase() !== code) {
    return cleaned.replace(/^[A-Z]{3}\s*[-–]\s*/i, '').trim() || CURRENCY_NAME_MAP[code] || code;
  }
  return CURRENCY_NAME_MAP[code] || code;
}

export function parsePositiveRate(raw: unknown): { num: number; text: string } | null {
  if (raw === null || raw === undefined) return null;
  const str = decodeHtmlEntities(String(raw)).replace(/,/g, '').trim();
  if (!str || /^(-|n\/a|na|no trade|null|loading)/i.test(str)) return null;
  if (!/^\d+(?:\.\d+)?$/.test(str)) return null;
  const num = Number(str);
  if (!Number.isFinite(num) || num <= 0) return null;
  return { num, text: str };
}

export function extractHtmlTables(html: string): string[][][] {
  if (!html) return [];
  return [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map((tbl) =>
    [...tbl[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)]
      .map((tr) =>
        [...tr[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) =>
          stripHtmlToText(cell[1]).replace(/\s+/g, ' ').trim()
        )
      )
      .filter((row) => row.length > 0)
  );
}

const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

function formatUtcIsoDate(year: number, monthIndex: number, day: number): string | null {
  if (year < 2000 || year > 2100 || monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) {
    return null;
  }
  const utc = new Date(Date.UTC(year, monthIndex, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== monthIndex ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }
  return utc.toISOString().slice(0, 10);
}

const FLEX_DATE_REGEX =
  /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[-\s]+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[-\s,]+\d{4}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4})\b/i;

function parsePublishedDateIso(rawDate: string | null | undefined): string | null {
  if (!rawDate) return null;
  const cleaned = rawDate.replace(/\s+/g, ' ').replace(/,(\S)/g, ', $1').trim();
  if (!cleaned) return null;

  const isoPrefix = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoPrefix) {
    return formatUtcIsoDate(Number(isoPrefix[1]), Number(isoPrefix[2]) - 1, Number(isoPrefix[3]));
  }

  const dayFirst = cleaned.match(/^(\d{1,2})[-\s]+([A-Za-z]+)[-\s,]+(\d{4})$/);
  if (dayFirst) {
    const monIdx = MONTH_INDEX[dayFirst[2].toLowerCase()];
    if (monIdx !== undefined) {
      return formatUtcIsoDate(Number(dayFirst[3]), monIdx, Number(dayFirst[1]));
    }
  }

  const monthFirst = cleaned.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (monthFirst) {
    const monIdx = MONTH_INDEX[monthFirst[1].toLowerCase()];
    if (monIdx !== undefined) {
      return formatUtcIsoDate(Number(monthFirst[3]), monIdx, Number(monthFirst[2]));
    }
  }

  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime())) return cleaned || null;
  return parsed.toISOString().slice(0, 10);
}

function computeFreshness(
  publishedDate: string | null,
  collectedAt: string
): { freshness: 'Fresh' | 'Stale' | 'Outdated'; verificationStatus: 'Verified' | 'Stale' } {
  if (!publishedDate) {
    return { freshness: 'Fresh', verificationStatus: 'Verified' };
  }
  const pubMs = new Date(publishedDate).getTime();
  const colMs = new Date(collectedAt).getTime();
  if (Number.isNaN(pubMs) || Number.isNaN(colMs)) {
    return { freshness: 'Fresh', verificationStatus: 'Verified' };
  }
  const ageDays = (colMs - pubMs) / (1000 * 60 * 60 * 24);
  if (ageDays > 5) {
    return { freshness: 'Outdated', verificationStatus: 'Stale' };
  }
  if (ageDays > 3) {
    return { freshness: 'Stale', verificationStatus: 'Stale' };
  }
  return { freshness: 'Fresh', verificationStatus: 'Verified' };
}

export function buildValidatedFxRecord(params: {
  bank: Pick<EthiopianBankRegistryItem, 'bankId' | 'bankName' | 'bankShortName' | 'isCentralBank'>;
  currencyCode: string;
  currencyName?: string;
  rateCategory: BankFxRateCategory;
  buyingRaw: unknown;
  sellingRaw: unknown;
  publishedDate: string | null;
  collectedAt: string;
  sourceUrl: string;
  sourceType: 'official_api' | 'official_html_table';
}): BankFxRateRecord | null {
  const code = normalizeCurrencyCode(params.currencyCode);
  if (!code || !/^[A-Z]{3}$/.test(code)) return null;

  const safeUrl = sanitizeHttpUrl(params.sourceUrl);
  if (!safeUrl) return null;

  const buy = parsePositiveRate(params.buyingRaw);
  const sell = parsePositiveRate(params.sellingRaw);
  if (!buy && !sell) return null;

  const buyingRate = buy ? buy.num : null;
  const sellingRate = sell ? sell.num : null;
  const midRate =
    buyingRate !== null && sellingRate !== null
      ? Number(((buyingRate + sellingRate) / 2).toFixed(4))
      : null;
  const spreadPct =
    buyingRate !== null && sellingRate !== null && buyingRate > 0 && sellingRate >= buyingRate
      ? Number((((sellingRate - buyingRate) / buyingRate) * 100).toFixed(2))
      : null;

  const normalizedPubDate = parsePublishedDateIso(params.publishedDate);
  const { freshness, verificationStatus } = computeFreshness(
    normalizedPubDate,
    params.collectedAt
  );

  return {
    id: `fx-${params.bank.bankId}-${code.toLowerCase()}-${params.rateCategory}`,
    bankId: params.bank.bankId,
    bankName: params.bank.bankName,
    bankShortName: params.bank.bankShortName,
    isCentralBank: params.bank.isCentralBank,
    currencyCode: code,
    currencyName: normalizeCurrencyName(code, params.currencyName),
    rateCategory: params.rateCategory,
    buyingRate,
    sellingRate,
    buyingPrecisionText: buy?.text,
    sellingPrecisionText: sell?.text,
    midRate,
    spreadPct,
    dailyChangeBuy: null,
    dailyChangeSell: null,
    publishedDate: normalizedPubDate,
    collectedAt: params.collectedAt,
    lastVerifiedAt: params.collectedAt,
    sourceUrl: safeUrl,
    sourceType: params.sourceType,
    verificationStatus,
    freshness,
  };
}

export interface NbeSelectedRatesApiPayload {
  status?: number;
  data?: Array<{
    buying?: string | number;
    selling?: string | number;
    weighted_average?: string | number;
    date?: string;
    currency?: { code?: string; name?: string };
  }>;
}

export interface NbeMidRateApiPayload {
  status?: number;
  data?: {
    name?: string;
    price?: string | number;
    date?: string;
  };
}

export function parseNbeApiRates(
  selectedPayload: NbeSelectedRatesApiPayload | null,
  midPayload: NbeMidRateApiPayload | null,
  collectedAt: string = new Date().toISOString()
): { rates: BankFxRateRecord[]; indicativeMid: NbeIndicativeMidRate | null } {
  const bank = ETHIOPIAN_BANKS_CATALOG[0];
  const rates: BankFxRateRecord[] = [];

  if (selectedPayload && Array.isArray(selectedPayload.data)) {
    for (const item of selectedPayload.data) {
      const code = item.currency?.code || '';
      const rec = buildValidatedFxRecord({
        bank,
        currencyCode: code,
        currencyName: item.currency?.name,
        rateCategory: 'nbe_reference',
        buyingRaw: item.buying,
        sellingRaw: item.selling,
        publishedDate: item.date || null,
        collectedAt,
        sourceUrl: bank.fxPageUrl,
        sourceType: 'official_api',
      });
      if (rec) rates.push(rec);
    }
  }

  let indicativeMid: NbeIndicativeMidRate | null = null;
  if (midPayload?.data) {
    const parsedPrice = parsePositiveRate(midPayload.data.price);
    if (parsedPrice) {
      indicativeMid = {
        price: parsedPrice.num,
        dateText: parsePublishedDateIso(midPayload.data.date) || String(midPayload.data.date || ''),
        sourceUrl: bank.fxPageUrl,
        collectedAt,
      };
    }
  }

  return { rates, indicativeMid };
}

export function parseDashenBankHtml(
  html: string,
  collectedAt: string = new Date().toISOString()
): BankFxRateRecord[] {
  const bank = ETHIOPIAN_BANKS_CATALOG.find((b) => b.bankId === 'dashen')!;
  const tables = extractHtmlTables(html);
  if (tables.length === 0) return [];

  const dateMatch = html.match(
    /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i
  );
  const pageDate = dateMatch ? dateMatch[0] : null;
  const results: BankFxRateRecord[] = [];

  for (const rows of tables) {
    const headerRow = rows[0]?.join(' ').toLowerCase() || '';
    let category: BankFxRateCategory | null = null;
    if (headerRow.includes('transaction')) category = 'transaction';
    else if (headerRow.includes('cash')) category = 'cash';
    else if (headerRow.includes('weighted average')) category = 'weighted_average';
    if (!category) continue;

    const weightedDateMatch =
      category === 'weighted_average'
        ? rows[0]?.join(' ').match(
            /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i
          )
        : null;

    for (const row of rows.slice(1)) {
      if (row.length < 4) continue;
      const rec = buildValidatedFxRecord({
        bank,
        currencyCode: row[0],
        currencyName: row[1],
        rateCategory: category,
        buyingRaw: row[2],
        sellingRaw: row[3],
        publishedDate: weightedDateMatch?.[0] || pageDate,
        collectedAt,
        sourceUrl: bank.fxPageUrl,
        sourceType: 'official_html_table',
      });
      if (rec) results.push(rec);
    }
  }

  return results;
}

export function parseCoopBankHtml(
  html: string,
  collectedAt: string = new Date().toISOString()
): BankFxRateRecord[] {
  const bank = ETHIOPIAN_BANKS_CATALOG.find((b) => b.bankId === 'coop')!;
  const tables = extractHtmlTables(html);
  if (tables.length === 0) return [];

  const results: BankFxRateRecord[] = [];
  const mainTable = tables[0];
  if (mainTable && mainTable.length >= 4) {
    const titleDateMatch = mainTable[0]?.[0]?.match(
      /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i
    );
    const pubDate = titleDateMatch ? titleDateMatch[0] : null;

    for (const row of mainTable) {
      if (row.length < 5) continue;
      const code = normalizeCurrencyCode(row[0]);
      if (!code) continue;

      const cash = buildValidatedFxRecord({
        bank,
        currencyCode: row[0],
        currencyName: row[0],
        rateCategory: 'cash',
        buyingRaw: row[1],
        sellingRaw: row[2],
        publishedDate: pubDate,
        collectedAt,
        sourceUrl: bank.fxPageUrl,
        sourceType: 'official_html_table',
      });
      if (cash) results.push(cash);

      const tx = buildValidatedFxRecord({
        bank,
        currencyCode: row[0],
        currencyName: row[0],
        rateCategory: 'transaction',
        buyingRaw: row[3],
        sellingRaw: row[4],
        publishedDate: pubDate,
        collectedAt,
        sourceUrl: bank.fxPageUrl,
        sourceType: 'official_html_table',
      });
      if (tx) results.push(tx);
    }
  }

  return results;
}

export function parseAmharaBankHtml(
  html: string,
  collectedAt: string = new Date().toISOString()
): BankFxRateRecord[] {
  const bank = ETHIOPIAN_BANKS_CATALOG.find((b) => b.bankId === 'amhara')!;
  const tables = extractHtmlTables(html);
  if (tables.length === 0) return [];

  const dateMatch = html.match(
    /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i
  );
  const pubDate = dateMatch ? dateMatch[0] : null;
  const results: BankFxRateRecord[] = [];

  const t0 = tables[0];
  if (!t0 || t0.length < 2) return [];
  const headerText = t0[0].join(' ').toLowerCase();
  if (!headerText.includes('cash') || !headerText.includes('transaction')) return [];

  for (const row of t0.slice(1)) {
    // Amhara table rows sometimes prepend an empty flag cell: ["", "US Dollar (USD)", cashBuy, cashSell, txBuy, txSell]
    const labelOffset = row[0] === '' && row.length >= 6 ? 1 : 0;
    const label = row[labelOffset];
    if (!label) continue;

    const cash = buildValidatedFxRecord({
      bank,
      currencyCode: label,
      currencyName: label,
      rateCategory: 'cash',
      buyingRaw: row[labelOffset + 1],
      sellingRaw: row[labelOffset + 2],
      publishedDate: pubDate,
      collectedAt,
      sourceUrl: bank.fxPageUrl,
      sourceType: 'official_html_table',
    });
    if (cash) results.push(cash);

    const tx = buildValidatedFxRecord({
      bank,
      currencyCode: label,
      currencyName: label,
      rateCategory: 'transaction',
      buyingRaw: row[labelOffset + 3],
      sellingRaw: row[labelOffset + 4],
      publishedDate: pubDate,
      collectedAt,
      sourceUrl: bank.fxPageUrl,
      sourceType: 'official_html_table',
    });
    if (tx) results.push(tx);
  }

  return results;
}

export interface BunnaForexApiPayload {
  content?: Array<{
    currencyCode?: string;
    currency?: string;
    buying?: number | string;
    selling?: number | string;
    transactionBuying?: number | string;
    transactionSelling?: number | string;
    valueDate?: string;
  }>;
}

export function parseBunnaApiRates(
  payload: BunnaForexApiPayload | null,
  collectedAt: string = new Date().toISOString()
): BankFxRateRecord[] {
  const bank = ETHIOPIAN_BANKS_CATALOG.find((b) => b.bankId === 'bunna')!;
  if (!payload || !Array.isArray(payload.content)) return [];

  const results: BankFxRateRecord[] = [];
  for (const item of payload.content) {
    const code = item.currencyCode || '';
    const pubDate = item.valueDate ? item.valueDate.slice(0, 10) : null;

    const cash = buildValidatedFxRecord({
      bank,
      currencyCode: code,
      currencyName: item.currency,
      rateCategory: 'cash',
      buyingRaw: item.buying,
      sellingRaw: item.selling,
      publishedDate: pubDate,
      collectedAt,
      sourceUrl: bank.fxPageUrl,
      sourceType: 'official_api',
    });
    if (cash) results.push(cash);

    const tx = buildValidatedFxRecord({
      bank,
      currencyCode: code,
      currencyName: item.currency,
      rateCategory: 'transaction',
      buyingRaw: item.transactionBuying,
      sellingRaw: item.transactionSelling,
      publishedDate: pubDate,
      collectedAt,
      sourceUrl: bank.fxPageUrl,
      sourceType: 'official_api',
    });
    if (tx) results.push(tx);
  }

  return results;
}

export function parseNibBankHtml(
  html: string,
  collectedAt: string = new Date().toISOString()
): BankFxRateRecord[] {
  const bank = ETHIOPIAN_BANKS_CATALOG.find((b) => b.bankId === 'nib')!;
  const tables = extractHtmlTables(html);
  if (tables.length < 2) return [];

  const pubDate = tables[0]?.[0]?.[0] || null;
  const mainTable = tables[1];
  const results: BankFxRateRecord[] = [];

  for (const row of mainTable.slice(1)) {
    if (row.length < 3) continue;
    const code = normalizeCurrencyCode(row[0]);
    if (!code) continue;

    // Nib publishes Cash (cols 1-2) and Transaction/Transfer (cols 3-4)
    const cash = buildValidatedFxRecord({
      bank,
      currencyCode: code,
      rateCategory: 'cash',
      buyingRaw: row[1],
      sellingRaw: row[2],
      publishedDate: pubDate,
      collectedAt,
      sourceUrl: bank.fxPageUrl,
      sourceType: 'official_html_table',
    });
    if (cash) results.push(cash);

    if (row.length >= 5) {
      const tx = buildValidatedFxRecord({
        bank,
        currencyCode: code,
        rateCategory: 'transaction',
        buyingRaw: row[3],
        sellingRaw: row[4],
        publishedDate: pubDate,
        collectedAt,
        sourceUrl: bank.fxPageUrl,
        sourceType: 'official_html_table',
      });
      if (tx) results.push(tx);
    }
  }

  return results;
}

export interface ZemenExchangeAjaxPayload {
  status?: string;
  date?: string;
  rates?: {
    day?: Array<{
      currency_code?: string;
      buying_rate?: string | number | null;
      selling_rate?: string | number | null;
      cash_buying_rate?: string | number | null;
      cash_selling_rate?: string | number | null;
      post_date?: string | null;
    }>;
  };
}

export function parseZemenApiRates(
  payload: ZemenExchangeAjaxPayload | null,
  collectedAt: string = new Date().toISOString()
): BankFxRateRecord[] {
  const bank = ETHIOPIAN_BANKS_CATALOG.find((b) => b.bankId === 'zemen')!;
  const dayRows = payload?.rates?.day;
  if (!Array.isArray(dayRows)) return [];

  const results: BankFxRateRecord[] = [];
  for (const row of dayRows) {
    const code = row.currency_code || '';
    const pubDate = payload?.date || (row.post_date ? row.post_date.slice(0, 10) : null);

    const cash = buildValidatedFxRecord({
      bank,
      currencyCode: code,
      rateCategory: 'cash',
      buyingRaw: row.cash_buying_rate,
      sellingRaw: row.cash_selling_rate,
      publishedDate: pubDate,
      collectedAt,
      sourceUrl: bank.fxPageUrl,
      sourceType: 'official_api',
    });
    if (cash) results.push(cash);

    const tx = buildValidatedFxRecord({
      bank,
      currencyCode: code,
      rateCategory: 'transaction',
      buyingRaw: row.buying_rate,
      sellingRaw: row.selling_rate,
      publishedDate: pubDate,
      collectedAt,
      sourceUrl: bank.fxPageUrl,
      sourceType: 'official_api',
    });
    if (tx) results.push(tx);
  }
  return results;
}

export function parseBerhanBankHtml(
  html: string,
  collectedAt: string = new Date().toISOString()
): BankFxRateRecord[] {
  const bank = ETHIOPIAN_BANKS_CATALOG.find((b) => b.bankId === 'berhan')!;
  const dateMatch = html.match(
    /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i
  );
  const pubDate = dateMatch ? dateMatch[0] : collectedAt.slice(0, 10);
  const results: BankFxRateRecord[] = [];

  for (const match of html.matchAll(/<input[^>]+value=(\{[^>]+\})[^>]*>/gi)) {
    try {
      const parsed = JSON.parse(match[1]) as {
        buying?: string | number;
        selling?: string | number;
        currency?: string;
      };
      if (!parsed.currency) continue;
      const rec = buildValidatedFxRecord({
        bank,
        currencyCode: parsed.currency,
        rateCategory: 'cash',
        buyingRaw: parsed.buying,
        sellingRaw: parsed.selling,
        publishedDate: pubDate,
        collectedAt,
        sourceUrl: bank.fxPageUrl,
        sourceType: 'official_html_table',
      });
      if (rec) results.push(rec);
    } catch {
      // Skip malformed non-FX input blocks
    }
  }
  return results;
}

export function parseEnatBankHtml(
  html: string,
  collectedAt: string = new Date().toISOString()
): BankFxRateRecord[] {
  const bank = ETHIOPIAN_BANKS_CATALOG.find((b) => b.bankId === 'enat')!;
  const usdIdx = html.search(/<h4[^>]*>\s*USD\s*<\/h4>/i);
  const fxWindow = usdIdx !== -1 ? html.slice(Math.max(0, usdIdx - 1200), usdIdx) : '';
  const dateMatch = fxWindow ? fxWindow.match(FLEX_DATE_REGEX) : null;
  const pubDate = dateMatch ? dateMatch[0] : collectedAt.slice(0, 10);
  const results: BankFxRateRecord[] = [];
  const seen = new Set<string>();

  const cardRegex =
    /<h4[^>]*>\s*([A-Z]{3})\s*<\/h4>[\s\S]{0,450}?<p[^>]*>\s*([\d.]+)\s*<\/p>[\s\S]{0,250}?<p[^>]*>\s*([\d.]+)\s*<\/p>/gi;
  for (const match of html.matchAll(cardRegex)) {
    const code = match[1].toUpperCase();
    if (seen.has(code)) continue;
    const rec = buildValidatedFxRecord({
      bank,
      currencyCode: code,
      rateCategory: 'cash',
      buyingRaw: match[2],
      sellingRaw: match[3],
      publishedDate: pubDate,
      collectedAt,
      sourceUrl: bank.fxPageUrl,
      sourceType: 'official_html_table',
    });
    if (rec) {
      seen.add(code);
      results.push(rec);
    }
  }
  return results;
}

export function parseAbayBankHtml(
  html: string,
  collectedAt: string = new Date().toISOString()
): BankFxRateRecord[] {
  const bank = ETHIOPIAN_BANKS_CATALOG.find((b) => b.bankId === 'abay')!;
  const tables = extractHtmlTables(html);
  if (tables.length === 0) return [];

  const headingIdx = html.search(/FOREIGN CURRENCY EXCHANGE RATE/i);
  const fxWindow =
    headingIdx !== -1 ? html.slice(headingIdx, headingIdx + 1200) : '';
  const dateMatch = fxWindow ? fxWindow.match(FLEX_DATE_REGEX) : null;
  const pubDate = dateMatch ? dateMatch[0] : collectedAt.slice(0, 10);
  const results: BankFxRateRecord[] = [];

  for (const rows of tables) {
    if (rows.length < 2) continue;
    const heading = rows[0].join(' ').toLowerCase();
    let category: BankFxRateCategory | null = null;
    if (heading.includes('cash rate')) category = 'cash';
    else if (heading.includes('transaction rate')) category = 'transaction';
    else if (heading.includes('weighted average')) category = 'weighted_average';
    if (!category) continue;

    for (const row of rows.slice(1)) {
      if (row.length < 2) continue;
      const code = normalizeCurrencyCode(row[0]);
      if (!code) continue;
      const rec = buildValidatedFxRecord({
        bank,
        currencyCode: code,
        rateCategory: category,
        buyingRaw: row[1],
        sellingRaw: row[2] ?? null,
        publishedDate: pubDate,
        collectedAt,
        sourceUrl: bank.fxPageUrl,
        sourceType: 'official_html_table',
      });
      if (rec) results.push(rec);
    }
  }
  return results;
}

export function parseSiinqeeBankHtml(
  html: string,
  collectedAt: string = new Date().toISOString()
): BankFxRateRecord[] {
  const bank = ETHIOPIAN_BANKS_CATALOG.find((b) => b.bankId === 'siinqee')!;
  const tables = extractHtmlTables(html);
  if (tables.length === 0) return [];

  const headingIdx = html.search(/Exchange Rate/i);
  const fxWindow =
    headingIdx !== -1 ? html.slice(headingIdx, headingIdx + 600) : '';
  const dateMatch = fxWindow ? fxWindow.match(FLEX_DATE_REGEX) : null;
  const pubDate = dateMatch ? dateMatch[0] : collectedAt.slice(0, 10);
  const results: BankFxRateRecord[] = [];

  for (const rows of tables) {
    const header = rows[0]?.join(' ').toLowerCase() || '';
    if (!header.includes('buying') || !header.includes('selling')) continue;
    for (const row of rows.slice(1)) {
      if (row.length < 3) continue;
      const rec = buildValidatedFxRecord({
        bank,
        currencyCode: row[0],
        rateCategory: 'cash',
        buyingRaw: row[1],
        sellingRaw: row[2],
        publishedDate: pubDate,
        collectedAt,
        sourceUrl: bank.fxPageUrl,
        sourceType: 'official_html_table',
      });
      if (rec) results.push(rec);
    }
  }
  return results;
}

export function parseZamZamBankHtml(
  html: string,
  collectedAt: string = new Date().toISOString()
): BankFxRateRecord[] {
  const bank = ETHIOPIAN_BANKS_CATALOG.find((b) => b.bankId === 'zamzam')!;
  const tables = extractHtmlTables(html);
  if (tables.length === 0) return [];

  const results: BankFxRateRecord[] = [];
  for (const rows of tables) {
    if (rows.length < 2) continue;
    const flatHeader = rows.slice(0, 3).map((r) => r.join(' ')).join(' ');
    const lowerHeader = flatHeader.toLowerCase();
    const dateMatch = flatHeader.match(
      /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i
    );
    const pubDate = dateMatch ? dateMatch[0] : collectedAt.slice(0, 10);

    if (lowerHeader.includes('weighted average')) {
      for (const row of rows.slice(1)) {
        if (row.length < 3) continue;
        const rec = buildValidatedFxRecord({
          bank,
          currencyCode: row[0],
          currencyName: row[0],
          rateCategory: 'weighted_average',
          buyingRaw: row[1],
          sellingRaw: row[2],
          publishedDate: pubDate,
          collectedAt,
          sourceUrl: bank.fxPageUrl,
          sourceType: 'official_html_table',
        });
        if (rec) results.push(rec);
      }
      continue;
    }

    if (lowerHeader.includes('cash') && lowerHeader.includes('transaction')) {
      for (const row of rows) {
        if (row.length < 5) continue;
        const code = normalizeCurrencyCode(row[0]);
        if (!code) continue;

        const cash = buildValidatedFxRecord({
          bank,
          currencyCode: row[0],
          currencyName: row[0],
          rateCategory: 'cash',
          buyingRaw: row[1],
          sellingRaw: row[2],
          publishedDate: pubDate,
          collectedAt,
          sourceUrl: bank.fxPageUrl,
          sourceType: 'official_html_table',
        });
        if (cash) results.push(cash);

        const tx = buildValidatedFxRecord({
          bank,
          currencyCode: row[0],
          currencyName: row[0],
          rateCategory: 'transaction',
          buyingRaw: row[3],
          sellingRaw: row[4],
          publishedDate: pubDate,
          collectedAt,
          sourceUrl: bank.fxPageUrl,
          sourceType: 'official_html_table',
        });
        if (tx) results.push(tx);
      }
    }
  }
  return results;
}

export function parseGlobalBankHtml(
  html: string,
  collectedAt: string = new Date().toISOString()
): BankFxRateRecord[] {
  const bank = ETHIOPIAN_BANKS_CATALOG.find((b) => b.bankId === 'global')!;
  const tables = extractHtmlTables(html);
  if (tables.length === 0) return [];

  const dateMatch = html.match(
    /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i
  );
  const pubDate = dateMatch ? dateMatch[0] : collectedAt.slice(0, 10);
  const results: BankFxRateRecord[] = [];
  const seen = new Set<string>();

  for (const rows of tables) {
    const header = rows[0]?.join(' ').toLowerCase() || '';
    if (!header.includes('buying') || !header.includes('selling')) continue;
    for (const row of rows.slice(1)) {
      if (row.length < 3) continue;
      const code = normalizeCurrencyCode(row[0]);
      if (!code || seen.has(code)) continue;
      const rec = buildValidatedFxRecord({
        bank,
        currencyCode: code,
        rateCategory: 'cash',
        buyingRaw: row[1],
        sellingRaw: row[2],
        publishedDate: pubDate,
        collectedAt,
        sourceUrl: bank.fxPageUrl,
        sourceType: 'official_html_table',
      });
      if (rec) {
        seen.add(code);
        results.push(rec);
      }
    }
  }
  return results;
}

export interface TsedeyRateItemRaw {
  name?: string;
  code?: string;
  category?: string;
  buying_rate?: string | number | null;
  selling_rate?: string | number | null;
  weighted_average_buying?: string | number | null;
  weighted_average_selling?: string | number | null;
  updated_at?: string | null;
}

export function parseTsedeyBankHtml(
  html: string,
  collectedAt: string = new Date().toISOString()
): BankFxRateRecord[] {
  const bank = ETHIOPIAN_BANKS_CATALOG.find((b) => b.bankId === 'tsedey')!;
  const match = html.match(/x-data='\{\s*rates:\s*(\[[\s\S]*?\])\s*,/);
  if (!match) return [];

  let rawItems: TsedeyRateItemRaw[] = [];
  try {
    const parsed = JSON.parse(match[1]);
    if (!Array.isArray(parsed)) return [];
    rawItems = parsed as TsedeyRateItemRaw[];
  } catch {
    return [];
  }

  const results: BankFxRateRecord[] = [];
  const seenKeys = new Set<string>();

  for (const item of rawItems) {
    const code = normalizeCurrencyCode(item.code || item.name || '');
    if (!code) continue;

    const rawCat = String(item.category || 'cash').toLowerCase();
    const rateCategory: BankFxRateCategory =
      rawCat.includes('non-cash') || rawCat.includes('transaction') ? 'transaction' : 'cash';
    const pubDate = item.updated_at ? item.updated_at.slice(0, 10) : collectedAt.slice(0, 10);

    const primaryKey = `${code}:${rateCategory}`;
    if (!seenKeys.has(primaryKey)) {
      const rec = buildValidatedFxRecord({
        bank,
        currencyCode: code,
        currencyName: item.name,
        rateCategory,
        buyingRaw: item.buying_rate,
        sellingRaw: item.selling_rate,
        publishedDate: pubDate,
        collectedAt,
        sourceUrl: bank.fxPageUrl,
        sourceType: 'official_api',
      });
      if (rec) {
        seenKeys.add(primaryKey);
        results.push(rec);
      }
    }

    const weightedKey = `${code}:weighted_average`;
    if (!seenKeys.has(weightedKey)) {
      const weightedRec = buildValidatedFxRecord({
        bank,
        currencyCode: code,
        currencyName: item.name,
        rateCategory: 'weighted_average',
        buyingRaw: item.weighted_average_buying,
        sellingRaw: item.weighted_average_selling,
        publishedDate: pubDate,
        collectedAt,
        sourceUrl: bank.fxPageUrl,
        sourceType: 'official_api',
      });
      if (weightedRec) {
        seenKeys.add(weightedKey);
        results.push(weightedRec);
      }
    }
  }

  return results;
}

export interface CurrencyMarketExtremes {
  currencyCode: string;
  currencyName: string;
  banksCount: number;
  highestBuyingRate: number | null;
  highestBuyingBank: string | null;
  lowestBuyingRate: number | null;
  lowestBuyingBank: string | null;
  highestSellingRate: number | null;
  highestSellingBank: string | null;
  lowestSellingRate: number | null;
  lowestSellingBank: string | null;
  avgSpreadPct: number | null;
}

export function computeMarketFxExtremes(
  rates: BankFxRateRecord[],
  category: 'cash' | 'transaction'
): CurrencyMarketExtremes[] {
  const byCurrency = new Map<string, BankFxRateRecord[]>();
  for (const r of rates) {
    if (r.isCentralBank || r.rateCategory !== category) continue;
    const list = byCurrency.get(r.currencyCode) || [];
    list.push(r);
    byCurrency.set(r.currencyCode, list);
  }

  const preferredOrder = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'CAD', 'CHF', 'AUD', 'CNY', 'JPY'];
  const summary: CurrencyMarketExtremes[] = [];

  for (const [code, rows] of byCurrency.entries()) {
    const validBuy = rows.filter((r) => r.buyingRate !== null);
    const validSell = rows.filter((r) => r.sellingRate !== null);
    const validSpread = rows.filter((r) => r.spreadPct !== null);

    let hiBuy: BankFxRateRecord | null = null;
    let loBuy: BankFxRateRecord | null = null;
    for (const r of validBuy) {
      if (!hiBuy || (r.buyingRate ?? 0) > (hiBuy.buyingRate ?? 0)) hiBuy = r;
      if (!loBuy || (r.buyingRate ?? Number.MAX_SAFE_INTEGER) < (loBuy.buyingRate ?? Number.MAX_SAFE_INTEGER)) {
        loBuy = r;
      }
    }

    let hiSell: BankFxRateRecord | null = null;
    let loSell: BankFxRateRecord | null = null;
    for (const r of validSell) {
      if (!hiSell || (r.sellingRate ?? 0) > (hiSell.sellingRate ?? 0)) hiSell = r;
      if (!loSell || (r.sellingRate ?? Number.MAX_SAFE_INTEGER) < (loSell.sellingRate ?? Number.MAX_SAFE_INTEGER)) {
        loSell = r;
      }
    }

    const avgSpreadPct =
      validSpread.length > 0
        ? Number(
            (
              validSpread.reduce((acc, r) => acc + (r.spreadPct ?? 0), 0) / validSpread.length
            ).toFixed(2)
          )
        : null;

    summary.push({
      currencyCode: code,
      currencyName: CURRENCY_NAME_MAP[code] || rows[0]?.currencyName || code,
      banksCount: rows.length,
      highestBuyingRate: hiBuy?.buyingRate ?? null,
      highestBuyingBank: hiBuy?.bankShortName ?? null,
      lowestBuyingRate: loBuy?.buyingRate ?? null,
      lowestBuyingBank: loBuy?.bankShortName ?? null,
      highestSellingRate: hiSell?.sellingRate ?? null,
      highestSellingBank: hiSell?.bankShortName ?? null,
      lowestSellingRate: loSell?.sellingRate ?? null,
      lowestSellingBank: loSell?.bankShortName ?? null,
      avgSpreadPct,
    });
  }

  return summary.sort((a, b) => {
    const ia = preferredOrder.indexOf(a.currencyCode);
    const ib = preferredOrder.indexOf(b.currencyCode);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return b.banksCount - a.banksCount || a.currencyCode.localeCompare(b.currencyCode);
  });
}

export function mergeBankRatesWithHistory(params: {
  previousRates: BankFxRateRecord[];
  previousHistory: BankFxHistoryPoint[];
  incomingRates: BankFxRateRecord[];
  failedBankIds: Set<string>;
}): { rates: BankFxRateRecord[]; history: BankFxHistoryPoint[]; anomaliesCount: number } {
  const prevById = new Map<string, BankFxRateRecord>();
  for (const r of params.previousRates) {
    prevById.set(r.id, r);
  }

  const incomingById = new Map<string, BankFxRateRecord>();
  for (const r of params.incomingRates) {
    incomingById.set(r.id, r);
  }

  const nextHistory = [...params.previousHistory];
  const nextRates: BankFxRateRecord[] = [];
  let anomaliesCount = 0;

  // Retain previous verified rates marked Stale if a bank failed during this run
  for (const prev of params.previousRates) {
    if (!incomingById.has(prev.id) && params.failedBankIds.has(prev.bankId)) {
      nextRates.push({
        ...prev,
        verificationStatus: 'Stale',
        freshness: 'Stale',
      });
    }
  }

  for (const inc of params.incomingRates) {
    const prev = prevById.get(inc.id);
    let dailyChangeBuy: number | null = prev?.dailyChangeBuy ?? null;
    let dailyChangeSell: number | null = prev?.dailyChangeSell ?? null;
    let anomalyFlagged = false;
    let anomalyReason: string | undefined;

    const changedBuy =
      prev && prev.buyingRate !== null && inc.buyingRate !== null
        ? Number((inc.buyingRate - prev.buyingRate).toFixed(4))
        : null;
    const changedSell =
      prev && prev.sellingRate !== null && inc.sellingRate !== null
        ? Number((inc.sellingRate - prev.sellingRate).toFixed(4))
        : null;

    const valuesChanged =
      !prev ||
      prev.buyingRate !== inc.buyingRate ||
      prev.sellingRate !== inc.sellingRate ||
      prev.publishedDate !== inc.publishedDate;

    if (prev && valuesChanged) {
      if (changedBuy !== null && changedBuy !== 0) dailyChangeBuy = changedBuy;
      if (changedSell !== null && changedSell !== 0) dailyChangeSell = changedSell;

      if (
        prev.buyingRate &&
        inc.buyingRate &&
        Math.abs(inc.buyingRate - prev.buyingRate) / prev.buyingRate > 0.15
      ) {
        anomalyFlagged = true;
        anomalyReason = `Buying rate shifted >15% (${prev.buyingRate} -> ${inc.buyingRate}). Flagged for Admin verification.`;
      } else if (
        prev.sellingRate &&
        inc.sellingRate &&
        Math.abs(inc.sellingRate - prev.sellingRate) / prev.sellingRate > 0.15
      ) {
        anomalyFlagged = true;
        anomalyReason = `Selling rate shifted >15% (${prev.sellingRate} -> ${inc.sellingRate}). Flagged for Admin verification.`;
      }
    }

    if (anomalyFlagged) anomaliesCount++;

    if (valuesChanged) {
      nextHistory.push({
        id: `fxh-${inc.bankId}-${inc.currencyCode.toLowerCase()}-${inc.rateCategory}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        bankId: inc.bankId,
        currencyCode: inc.currencyCode,
        rateCategory: inc.rateCategory,
        buyingRate: inc.buyingRate,
        sellingRate: inc.sellingRate,
        publishedDate: inc.publishedDate,
        recordedAt: inc.collectedAt,
        sourceUrl: inc.sourceUrl,
      });
    }

    nextRates.push({
      ...inc,
      dailyChangeBuy,
      dailyChangeSell,
      anomalyFlagged,
      anomalyReason,
      manuallyCorrected: prev?.manuallyCorrected,
      originalExtractedBuying: prev?.originalExtractedBuying ?? inc.buyingRate,
      originalExtractedSelling: prev?.originalExtractedSelling ?? inc.sellingRate,
    });
  }

  return {
    rates: nextRates,
    history: nextHistory.slice(-1500),
    anomaliesCount,
  };
}
