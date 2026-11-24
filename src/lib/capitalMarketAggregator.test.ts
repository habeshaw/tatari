import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCapitalMarketEquitiesAndSummary,
  getEatMarketSessionStatus,
  parseEsxCompanyDirectoryProfile,
  parseEsxInterbankDataHtml,
  parseEsxListedCompaniesHtml,
  parseEsxListedTBillsHtml,
  parseStockMarketEtHistoriesHtml,
  type EsxCompanyProfileStats,
  type StockMarketEtSeries,
} from './capitalMarketAggregator.ts';

test('parseEsxListedCompaniesHtml parses ESX listed companies HTML table', () => {
  const html = `
    <table>
      <tr><th>Name</th><th>Symbol</th><th>Sector</th><th>Date Listed</th><th>Date Incorporated</th></tr>
      <tr>
        <td><a href="https://esx.et/directory/wegagen-bank-share-company/">Wegagen Bank Share Company</a></td>
        <td>WGBX</td>
        <td>Financial Services</td>
        <td>2025-01-10</td>
        <td>1997-06-11</td>
      </tr>
      <tr>
        <td>Ethio Telecom Share Company</td>
        <td>TELE</td>
        <td>Telecom Services</td>
        <td>2026-05-26</td>
        <td>2024-07-01</td>
      </tr>
    </table>
  `;
  const rows = parseEsxListedCompaniesHtml(html);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].symbol, 'WGBX');
  assert.equal(rows[0].dateListed, '2025-01-10');
  assert.equal(rows[1].symbol, 'TELE');
  assert.equal(rows[1].esxProfileUrl, 'https://esx.et/directory/ethio-telecom-share-company/');
});

test('parseEsxCompanyDirectoryProfile extracts Listed Capital, Listed Shares, and Shareholders', () => {
  const html = `
    <div>Profile</div>
    <div>Symbol WGBX</div>
    <div>Listed Capital 6,218,635,000</div>
    <div>Listed Shares 6,218,635</div>
    <div>Number of Shareholders 14,549</div>
    <div>Security Type Equity Nature of Business Financial Services</div>
  `;
  const profile = parseEsxCompanyDirectoryProfile(
    html,
    'https://esx.et/directory/wegagen-bank-share-company/'
  );
  assert.ok(profile);
  assert.equal(profile.symbol, 'WGBX');
  assert.equal(profile.listedCapitalEtb, 6218635000);
  assert.equal(profile.listedShares, 6218635);
  assert.equal(profile.numberOfShareholders, 14549);
  assert.equal(profile.securityType, 'Equity');
});

test('parseStockMarketEtHistoriesHtml extracts escaped RSC histories and computes equity deltas cleanly', () => {
  const html = `
    <script>self.__next_f.push([1,"2a:[\\"$\",\\"$L63\\",null,{\\"histories\\":[{\\"symbol\\":\\"WGBX\\",\\"name\\":\\"Wegagen Bank\\",\\"points\\":[{\\"date\\":\\"2026-08-18\\",\\"price\\":1233.49},{\\"date\\":\\"2026-08-19\\",\\"price\\":1300}]},{\\"symbol\\":\\"TELE\\",\\"name\\":\\"Ethio Telecom\\",\\"points\\":[{\\"date\\":\\"2026-08-18\\",\\"price\\":442.81},{\\"date\\":\\"2026-08-19\\",\\"price\\":459.68}]}]}]"])</script>
  `;
  const series = parseStockMarketEtHistoriesHtml(html);
  assert.equal(series.length, 2);

  const seriesMap = new Map<string, StockMarketEtSeries>(series.map((s) => [s.symbol, s]));
  const profilesMap = new Map<string, EsxCompanyProfileStats>([
    [
      'WGBX',
      {
        symbol: 'WGBX',
        listedCapitalEtb: 6218635000,
        listedShares: 6218635,
        numberOfShareholders: 14549,
        securityType: 'Equity',
        esxProfileUrl: 'https://esx.et/directory/wegagen-bank-share-company/',
      },
    ],
  ]);

  const { equities, summary } = buildCapitalMarketEquitiesAndSummary({
    listedCompanies: [
      {
        companyName: 'Wegagen Bank Share Company',
        symbol: 'WGBX',
        sector: 'Financial Services',
        dateListed: '2025-01-10',
        dateIncorporated: '1997-06-11',
        esxProfileUrl: 'https://esx.et/directory/wegagen-bank-share-company/',
      },
      {
        companyName: 'Ethio Telecom Share Company',
        symbol: 'TELE',
        sector: 'Telecom Services',
        dateListed: '2026-05-26',
        dateIncorporated: '2024-07-01',
        esxProfileUrl: 'https://esx.et/directory/ethio-telecom-share-company/',
      },
      {
        companyName: 'Awash Insurance Share Company',
        symbol: 'AWIN',
        sector: 'Financial Services',
        dateListed: '2026-11-10',
        dateIncorporated: '1994-10-01',
        esxProfileUrl: 'https://esx.et/directory/awash-insurance-share-company/',
      },
    ],
    profilesBySymbol: profilesMap,
    seriesBySymbol: seriesMap,
    interbankTrades: [],
    syncedAt: '2026-11-23T12:00:00Z',
    now: new Date('2026-11-23T08:00:00Z'), // 11:00 AM EAT Monday -> Continuous Trading
  });

  assert.equal(equities.length, 3);
  const wgbx = equities.find((e) => e.symbol === 'WGBX')!;
  const awin = equities.find((e) => e.symbol === 'AWIN')!;
  assert.equal(wgbx.lastPriceEtb, 1300);
  assert.equal(wgbx.previousCloseEtb, 1233.49);
  assert.equal(wgbx.changePct, 5.39);
  assert.equal(wgbx.tradingStatus, 'Continuous Trading');
  assert.equal(awin.lastPriceEtb, null);
  assert.equal(awin.tradingStatus, 'Listed / Quote Pending');
  assert.equal(awin.verificationStatus, 'Source unavailable');
  assert.equal(summary.pricedEquitiesCount, 2);
  assert.equal(summary.advancersCount, 2);
  assert.equal(summary.topGainerSymbol, 'WGBX');
});

test('parseEsxInterbankDataHtml and parseEsxListedTBillsHtml parse official ESX fixed-income tables', () => {
  const ibHtml = `
    <table>
      <tr><th>Week</th><th>Maturity</th><th>Volume</th><th>Total trade</th><th>WA Interest rate</th><th>% Change %</th></tr>
      <tr><td>Jul 07 - Jul 11, 2025</td><td>Overnight</td><td>ETB 6,050,000,000</td><td>16</td><td>12.00</td><td>0.00</td></tr>
    </table>
  `;
  const ib = parseEsxInterbankDataHtml(ibHtml);
  assert.equal(ib.length, 1);
  assert.equal(ib[0].volumeEtb, 6050000000);
  assert.equal(ib[0].totalTrades, 16);
  assert.equal(ib[0].weightedAvgRatePct, 12);

  const tbHtml = `
    <table>
      <tr><th>Auction No</th><th>Auction Date</th><th>Trading Symbol</th><th>Tenor</th><th>Listed Date</th><th>Maturity Date</th><th>Total Amount Accepted</th><th>Yield</th></tr>
      <tr><td>990th/25</td><td>12-Nov-2025</td><td>TBL28D251211</td><td>28</td><td>13/11/2025</td><td>11-Dec-2025</td><td>3,250.555</td><td>14.343</td></tr>
    </table>
  `;
  const tbills = parseEsxListedTBillsHtml(tbHtml);
  assert.equal(tbills.length, 1);
  assert.equal(tbills[0].tradingSymbol, 'TBL28D251211');
  assert.equal(tbills[0].amountAcceptedEtbMillions, 3250.555);
  assert.equal(tbills[0].weightedAvgYieldPct, 14.343);
});

test('getEatMarketSessionStatus reflects Addis Ababa UTC+3 market hours', () => {
  // Monday 06:15 UTC = 09:15 AM EAT -> Pre-Open
  assert.equal(getEatMarketSessionStatus(new Date('2026-11-23T06:15:00Z')).tradingStatus, 'Pre-Open');
  // Monday 10:00 UTC = 13:00 PM EAT -> Continuous Trading
  assert.equal(
    getEatMarketSessionStatus(new Date('2026-11-23T10:00:00Z')).tradingStatus,
    'Continuous Trading'
  );
  // Sunday 10:00 UTC -> Market Closed
  assert.equal(
    getEatMarketSessionStatus(new Date('2026-11-22T10:00:00Z')).tradingStatus,
    'Market Closed'
  );
});
