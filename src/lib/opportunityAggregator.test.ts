import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deduplicateOpportunities,
  parse2MerkatoTendersHtml,
  parseGenericRssOrAtomXml,
  parseWordPressPostsToOpportunities,
  runUniversalSearch,
} from './opportunityAggregator';

const SYNCED_AT = '2026-11-23T06:00:00.000Z';

test('parse2MerkatoTendersHtml parses Inertia JSON tenders and normalizes subscription-gated deadlines', () => {
  const html = `
    <html><body>
      <div id="app" data-page="{}"></div>
      <script data-page="app" type="application/json">
        ${JSON.stringify({
          props: {
            tenders: {
              data: [
                {
                  id: '9f4a-1234',
                  title: 'Invitation to Bid for Solar Water Pumps',
                  bid_closing_date_text: 'Subscription required',
                  published_at: '2026-11-22 08:30:00',
                  is_open: true,
                  company: { name_en: 'Oromia Water Bureau' },
                  region: { name_en: 'Oromia' },
                  categories: [{ name_en: 'Machinery & Pumps' }],
                },
                {
                  id: '8b2c-5678',
                  title: 'Consultancy Audit Services',
                  bid_closing_date_text: '2020-01-15',
                  published_at: '2020-01-01 09:00:00',
                  is_open: false,
                  company: { name_en: 'Sample NGO' },
                },
              ],
            },
          },
        })}
      </script>
    </body></html>
  `;

  const parsed = parse2MerkatoTendersHtml(html, SYNCED_AT);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].sourceUrl, 'https://tender.2merkato.com/tenders/9f4a-1234');
  assert.equal(parsed[0].deadline, 'Not provided by source.');
  assert.equal(parsed[0].verificationStatus, 'Verified');
  assert.equal(parsed[1].isExpired, true);
  assert.equal(parsed[1].verificationStatus, 'Expired');
});

test('parseWordPressPostsToOpportunities routes posts into proper modules and strips unsafe URLs', () => {
  const posts = [
    {
      id: 101,
      date: '2026-11-21T10:00:00',
      link: 'https://www.opportunitiesforafricans.com/ethiopia-innovation-grant/',
      title: { rendered: 'Ethiopia Climate Innovation Grant ($50,000 Funding)' },
      excerpt: { rendered: '<p>Apply for up to $50,000 in startup grant funding in Ethiopia.</p>' },
    },
    {
      id: 102,
      date: '2026-11-21T10:00:00',
      link: 'javascript:alert("xss")',
      title: { rendered: 'Malicious Grant Post' },
      excerpt: { rendered: '<p>Should be rejected.</p>' },
    },
  ];

  const grants = parseWordPressPostsToOpportunities(
    posts,
    {
      id: 'src-ofa-grants',
      name: 'Opportunities for Africans (Grants & Innovation)',
      domain: 'opportunitiesforafricans.com',
      module: 'grants',
    },
    SYNCED_AT
  );

  assert.equal(grants.length, 1);
  assert.equal(grants[0].module, 'grants');
  assert.equal(grants[0].priceOrFunding, '$50,000');
  assert.equal(grants[0].eligibilityOrCoverage, 'Ethiopia / Ethiopian Nationals eligible');
});

test('parseGenericRssOrAtomXml extracts standard RSS items cleanly', () => {
  const rss = `
    <rss version="2.0"><channel>
      <item>
        <title><![CDATA[Ethiopian Coffee Export Conference 2026]]></title>
        <link>https://example.org/coffee-expo-2026</link>
        <pubDate>Sun, 22 Nov 2026 10:00:00 GMT</pubDate>
        <description><![CDATA[Annual coffee trade summit in Addis Ababa.]]></description>
      </item>
    </channel></rss>
  `;

  const items = parseGenericRssOrAtomXml(
    rss,
    {
      id: 'src-custom-rss',
      name: 'Custom Trade RSS',
      domain: 'example.org',
      module: 'events',
    },
    SYNCED_AT
  );

  assert.equal(items.length, 1);
  assert.equal(items[0].module, 'events');
  assert.equal(items[0].sourceUrl, 'https://example.org/coffee-expo-2026');
});

test('deduplicateOpportunities eliminates exact URL duplicates while flagging title/date cross-posts', () => {
  const base = parseGenericRssOrAtomXml(
    `<rss><channel><item><title>DAAD Masters Scholarship</title><link>https://a.org/daad</link></item></channel></rss>`,
    { id: 's1', name: 'Source A', domain: 'a.org', module: 'scholarships' },
    SYNCED_AT
  );
  const sameUrl = parseGenericRssOrAtomXml(
    `<rss><channel><item><title>DAAD Masters Scholarship</title><link>https://a.org/daad</link></item></channel></rss>`,
    { id: 's1', name: 'Source A', domain: 'a.org', module: 'scholarships' },
    SYNCED_AT
  );

  const { deduplicated, duplicatesDetected } = deduplicateOpportunities([...base, ...sameUrl]);
  assert.equal(deduplicated.length, 1);
  assert.equal(duplicatesDetected, 1);
});

test('runUniversalSearch queries across Jobs, FX, Opportunities, Training, and Digital Store', () => {
  const results = runUniversalSearch({
    query: 'Dashen',
    jobs: [],
    fxRates: [
      {
        id: 'fx-dashen-usd-cash',
        bankId: 'dashen',
        bankName: 'Dashen Bank S.C.',
        bankShortName: 'Dashen',
        isCentralBank: false,
        currencyCode: 'USD',
        currencyName: 'US Dollar',
        rateCategory: 'cash',
        buyingRate: 155,
        sellingRate: 158,
        midRate: 156.5,
        spreadPct: 1.94,
        dailyChangeBuy: null,
        dailyChangeSell: null,
        publishedDate: '2026-11-23',
        collectedAt: SYNCED_AT,
        lastVerifiedAt: SYNCED_AT,
        sourceUrl: 'https://dashenbanksc.com/daily-exchange-rates/',
        sourceType: 'official_html_table',
        verificationStatus: 'Verified',
        freshness: 'Fresh',
      },
    ],
    opportunities: [
      {
        id: 'opp-1',
        module: 'tenders',
        title: 'Dashen Bank HQ IT Supply Bid',
        organization: 'Dashen Bank S.C.',
        referenceNumber: 'DB-01',
        category: 'IT & Software',
        location: 'Addis Ababa',
        eligibilityOrCoverage: 'Ethiopia',
        priceOrFunding: 'Not provided by source.',
        deadline: '2026-12-01',
        publishedAt: SYNCED_AT,
        collectedAt: SYNCED_AT,
        lastVerifiedAt: SYNCED_AT,
        sourceId: 'src-2merkato-tenders',
        sourceName: '2Merkato',
        sourceDomain: 'tender.2merkato.com',
        sourceUrl: 'https://tender.2merkato.com/tenders/123',
        summary: 'IT tender',
        verificationStatus: 'Verified',
        isExpired: false,
        fingerprint: 'fp-1',
      },
    ],
    trainingPrograms: [],
    products: [],
  });

  assert.equal(results.length, 2);
  assert.equal(results.some((r) => r.section === 'fx'), true);
  assert.equal(results.some((r) => r.section === 'opportunities'), true);
});
