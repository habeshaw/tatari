import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TOP_NEWS_SOURCES,
  deduplicateAndSortNews,
  parseNewsRssXml,
  parseWordPressNewsPosts,
} from './newsAggregator.ts';

test('TOP_NEWS_SOURCES includes all 10 requested global, African, and Ethiopian publishers', () => {
  assert.equal(TOP_NEWS_SOURCES.length, 10);
  const byName = new Map(TOP_NEWS_SOURCES.map((s) => [s.name, s.coverage]));
  assert.equal(byName.get('Reuters'), 'World');
  assert.equal(byName.get('BBC News'), 'World');
  assert.equal(byName.get('Al Jazeera'), 'World and Africa');
  assert.equal(byName.get('CNN'), 'World');
  assert.equal(byName.get('AP News'), 'World');
  assert.equal(byName.get('Africanews'), 'Africa');
  assert.equal(byName.get('AllAfrica'), 'Africa');
  assert.equal(byName.get('Addis Standard'), 'Ethiopia');
  assert.equal(byName.get('The Reporter'), 'Ethiopia');
  assert.equal(byName.get('BBC Amharic'), 'Ethiopia and world');
});

test('parseNewsRssXml extracts BBC Amharic and Reuters indexed RSS headlines cleanly', () => {
  const bbcAmharic = TOP_NEWS_SOURCES.find((s) => s.id === 'bbc_amharic')!;
  const amharicXml = `
    <rss><channel>
      <item>
        <title><![CDATA[በአዲስ አበባ የንግድ እና የካፒታል ገበያ ጉባዔ ተከፈተ]]></title>
        <description><![CDATA[በአዲስ አበባ ዓለም አቀፍ የኢንቨስትመንት ጉባዔ ዛሬ ተጀምሯል።]]></description>
        <link>https://www.bbc.com/amharic/articles/c123456</link>
        <pubDate>Mon, 23 Nov 2026 08:00:00 GMT</pubDate>
        <media:thumbnail width="240" height="135" url="https://ichef.bbci.co.uk/test.jpg" />
      </item>
    </channel></rss>
  `;
  const amArticles = parseNewsRssXml(amharicXml, bbcAmharic, '2026-11-23T12:00:00Z');
  assert.equal(amArticles.length, 1);
  assert.equal(amArticles[0].language, 'am');
  assert.equal(amArticles[0].coverage, 'Ethiopia and world');
  assert.equal(amArticles[0].imageUrl, 'https://ichef.bbci.co.uk/test.jpg');

  const reuters = TOP_NEWS_SOURCES.find((s) => s.id === 'reuters')!;
  const reutersXml = `
    <rss><channel>
      <item>
        <title>Global central banks hold rates steady - Reuters</title>
        <link>https://news.google.com/rss/articles/test123</link>
        <pubDate>Mon, 23 Nov 2026 11:00:00 GMT</pubDate>
        <description>&lt;a href="https://news.google.com/rss/articles/test123"&gt;Global central banks hold rates steady&lt;/a&gt; Reuters</description>
      </item>
    </channel></rss>
  `;
  const reutersArticles = parseNewsRssXml(reutersXml, reuters, '2026-11-23T12:00:00Z');
  assert.equal(reutersArticles.length, 1);
  assert.equal(reutersArticles[0].title, 'Global central banks hold rates steady');
  assert.equal(reutersArticles[0].coverage, 'World');
  assert.match(reutersArticles[0].summary, /Reuters \(World\) headline/);
});

test('parseWordPressNewsPosts and deduplicateAndSortNews parse Reporter Ethiopia and sort newest first', () => {
  const reporter = TOP_NEWS_SOURCES.find((s) => s.id === 'the_reporter')!;
  const parsed = parseWordPressNewsPosts(
    [
      {
        id: 501,
        date: '2026-11-20T10:00:00',
        link: 'https://www.thereporterethiopia.com/501/',
        title: { rendered: 'Ethiopia Capital Market Adds New Issuers' },
        excerpt: { rendered: '<p>Trading volume climbs across ESX commercial bank shares.</p>' },
        _embedded: {
          'wp:term': [[{ name: 'Business' }]],
          'wp:featuredmedia': [{ source_url: 'https://www.thereporterethiopia.com/img.jpg' }],
        },
      },
      {
        id: 502,
        date: '2026-11-22T12:00:00',
        link: 'https://www.thereporterethiopia.com/502/',
        title: { rendered: 'National Bank Updates FX Directive' },
        excerpt: { rendered: '<p>Revised auction parameters take effect Monday.</p>' },
      },
      {
        id: 503,
        date: '2026-11-22T12:00:00',
        link: 'https://www.thereporterethiopia.com/502/',
        title: { rendered: 'National Bank Updates FX Directive' },
      },
    ],
    reporter,
    '2026-11-23T12:00:00Z'
  );

  const sorted = deduplicateAndSortNews(parsed);
  assert.equal(sorted.length, 2);
  assert.equal(sorted[0].title, 'National Bank Updates FX Directive');
  assert.equal(sorted[1].category, 'Business');
});
