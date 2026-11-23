import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildValidatedFxRecord,
  computeMarketFxExtremes,
  ETHIOPIAN_BANKS_CATALOG,
  mergeBankRatesWithHistory,
  normalizeCurrencyCode,
  parseAbayBankHtml,
  parseAmharaBankHtml,
  parseBerhanBankHtml,
  parseBunnaApiRates,
  parseCoopBankHtml,
  parseDashenBankHtml,
  parseEnatBankHtml,
  parseGlobalBankHtml,
  parseNbeApiRates,
  parseNibBankHtml,
  parsePositiveRate,
  parseSiinqeeBankHtml,
  parseTsedeyBankHtml,
  parseZamZamBankHtml,
  parseZemenApiRates,
} from './fxAggregator';

const SYNCED_AT = '2026-11-23T06:00:00.000Z';

test('normalizeCurrencyCode handles parenthesized, hyphenated, YUA alias, and exact ISO strings', () => {
  assert.equal(normalizeCurrencyCode('US Dollar (USD)'), 'USD');
  assert.equal(normalizeCurrencyCode('EUR - Euro'), 'EUR');
  assert.equal(normalizeCurrencyCode('GBP'), 'GBP');
  assert.equal(normalizeCurrencyCode('YUA'), 'CNY');
  assert.equal(normalizeCurrencyCode('INVALID-CURRENCY'), null);
});

test('parsePositiveRate rejects zero, negative, N/A, and non-numeric strings', () => {
  assert.deepEqual(parsePositiveRate('161.3536'), { num: 161.3536, text: '161.3536' });
  assert.deepEqual(parsePositiveRate('1,234.50'), { num: 1234.5, text: '1234.50' });
  assert.equal(parsePositiveRate('0'), null);
  assert.equal(parsePositiveRate('-15.2'), null);
  assert.equal(parsePositiveRate('N/A'), null);
  assert.equal(parsePositiveRate(''), null);
});

test('parseNbeApiRates keeps NBE separate as central bank reference with indicative mid rate', () => {
  const { rates, indicativeMid } = parseNbeApiRates(
    {
      data: [
        {
          buying: '159.7500',
          selling: '162.9500',
          date: 'November 23, 2026',
          currency: { code: 'USD', name: 'US Dollar' },
        },
        {
          buying: '0',
          selling: '0',
          date: 'November 23, 2026',
          currency: { code: 'BAD', name: 'Zero Row' },
        },
      ],
    },
    {
      data: {
        name: 'Daily Indicative Mid Rate',
        price: '161.3536',
        date: 'November 23, 2026',
      },
    },
    SYNCED_AT
  );

  assert.equal(rates.length, 1);
  assert.equal(rates[0].isCentralBank, true);
  assert.equal(rates[0].rateCategory, 'nbe_reference');
  assert.equal(rates[0].buyingRate, 159.75);
  assert.equal(rates[0].sellingRate, 162.95);
  assert.equal(indicativeMid?.price, 161.3536);
});

test('parseDashenBankHtml strictly separates Transaction, Cash, and Weighted Average tables', () => {
  const html = `
    <p>Daily Exchange Rate - November 23, 2026</p>
    <table>
      <tr><th>Currency Code</th><th>Currency</th><th>Transaction Buying</th><th>Transaction Selling</th></tr>
      <tr><td>USD</td><td>US Dollar</td><td>159.20</td><td>164.50</td></tr>
    </table>
    <table>
      <tr><th>Currency Code</th><th>Currency</th><th>Cash Buying</th><th>Cash Selling</th></tr>
      <tr><td>USD</td><td>US Dollar</td><td>155.10</td><td>158.20</td></tr>
    </table>
    <table>
      <tr><th>Code</th><th>Currency</th><th>Weighted Average November 23, 2026</th><th>Rate</th></tr>
      <tr><td>USD</td><td>US Dollar</td><td>160.11</td><td>163.40</td></tr>
    </table>
  `;

  const parsed = parseDashenBankHtml(html, SYNCED_AT);
  assert.equal(parsed.length, 3);
  const tx = parsed.find((r) => r.rateCategory === 'transaction');
  const cash = parsed.find((r) => r.rateCategory === 'cash');
  const weighted = parsed.find((r) => r.rateCategory === 'weighted_average');

  assert.equal(tx?.buyingRate, 159.2);
  assert.equal(cash?.buyingRate, 155.1);
  assert.equal(weighted?.buyingRate, 160.11);
  assert.notEqual(tx?.buyingRate, cash?.buyingRate);
});

test('parseCoopBankHtml extracts separate Cash and Transaction columns', () => {
  const html = `
    <table>
      <tr><th colspan="5">Exchange Rate November 23, 2026</th></tr>
      <tr><th>Currency</th><th>Cash Buying</th><th>Cash Selling</th><th>Tx Buying</th><th>Tx Selling</th></tr>
      <tr><td>USD</td><td>154.00</td><td>157.10</td><td>158.90</td><td>162.10</td></tr>
      <tr><td>EUR</td><td>166.50</td><td>169.90</td><td>171.20</td><td>174.60</td></tr>
    </table>
  `;

  const parsed = parseCoopBankHtml(html, SYNCED_AT);
  assert.equal(parsed.length, 4);
  assert.equal(
    parsed.find((r) => r.currencyCode === 'USD' && r.rateCategory === 'cash')?.buyingRate,
    154
  );
  assert.equal(
    parsed.find((r) => r.currencyCode === 'USD' && r.rateCategory === 'transaction')?.buyingRate,
    158.9
  );
});

test('parseAmharaBankHtml handles empty flag cell offset and omits blank JPY Cash cells instead of zero-filling', () => {
  const html = `
    <p>Exchange Rate Effective November 23, 2026</p>
    <table>
      <tr><th></th><th>Currency</th><th>Cash Buying</th><th>Cash Selling</th><th>Transaction Buying</th><th>Transaction Selling</th></tr>
      <tr><td></td><td>US Dollar (USD)</td><td>155.00</td><td>158.10</td><td>159.40</td><td>162.60</td></tr>
      <tr><td></td><td>Japanese Yen (JPY)</td><td></td><td>-</td><td>1.04</td><td>1.09</td></tr>
    </table>
  `;

  const parsed = parseAmharaBankHtml(html, SYNCED_AT);
  assert.equal(parsed.length, 3);
  assert.equal(
    parsed.some((r) => r.currencyCode === 'JPY' && r.rateCategory === 'cash'),
    false
  );
  assert.equal(
    parsed.find((r) => r.currencyCode === 'JPY' && r.rateCategory === 'transaction')?.buyingRate,
    1.04
  );
});

test('parseBunnaApiRates and parseNibBankHtml produce clean typed records', () => {
  const bunna = parseBunnaApiRates(
    {
      content: [
        {
          currencyCode: 'USD',
          currency: 'US Dollar',
          buying: '154.80',
          selling: '157.90',
          transactionBuying: '159.50',
          transactionSelling: '162.70',
          valueDate: '2026-11-23T00:00:00Z',
        },
      ],
    },
    SYNCED_AT
  );
  assert.equal(bunna.length, 2);
  assert.equal(bunna[0].publishedDate, '2026-11-23');

  const nibHtml = `
    <table><tr><td>Nov 23, 2026</td></tr></table>
    <table>
      <tr><th>Currency</th><th>Buying</th><th>Selling</th><th>Buying</th><th>Selling</th></tr>
      <tr><td>GBP</td><td>195.20</td><td>199.10</td><td>201.30</td><td>205.40</td></tr>
    </table>
  `;
  const nib = parseNibBankHtml(nibHtml, SYNCED_AT);
  assert.equal(nib.length, 2);
  assert.equal(nib.find((r) => r.rateCategory === 'transaction')?.sellingRate, 205.4);
});

test('buildValidatedFxRecord blocks non-http/https URLs', () => {
  const rec = buildValidatedFxRecord({
    bank: ETHIOPIAN_BANKS_CATALOG[1],
    currencyCode: 'USD',
    rateCategory: 'cash',
    buyingRaw: '155',
    sellingRaw: '158',
    publishedDate: '2026-11-23',
    collectedAt: SYNCED_AT,
    sourceUrl: 'javascript:alert(1)',
    sourceType: 'official_html_table',
  });
  assert.equal(rec, null);
});

test('mergeBankRatesWithHistory flags >15% anomalies, avoids duplicate snapshots, and marks failed banks Stale', () => {
  const bank = ETHIOPIAN_BANKS_CATALOG.find((b) => b.bankId === 'dashen')!;
  const coop = ETHIOPIAN_BANKS_CATALOG.find((b) => b.bankId === 'coop')!;

  const baseDashen = buildValidatedFxRecord({
    bank,
    currencyCode: 'USD',
    rateCategory: 'cash',
    buyingRaw: '155.00',
    sellingRaw: '158.00',
    publishedDate: '2026-11-22',
    collectedAt: '2026-11-22T06:00:00.000Z',
    sourceUrl: bank.fxPageUrl,
    sourceType: 'official_html_table',
  })!;
  const baseCoop = buildValidatedFxRecord({
    bank: coop,
    currencyCode: 'USD',
    rateCategory: 'cash',
    buyingRaw: '154.00',
    sellingRaw: '157.00',
    publishedDate: '2026-11-22',
    collectedAt: '2026-11-22T06:00:00.000Z',
    sourceUrl: coop.fxPageUrl,
    sourceType: 'official_html_table',
  })!;

  // First sync: identical Dashen value -> no duplicate history added, Coop fails -> retained as Stale
  const unchangedRun = mergeBankRatesWithHistory({
    previousRates: [baseDashen, baseCoop],
    previousHistory: [
      {
        id: 'fxh-initial',
        bankId: 'dashen',
        currencyCode: 'USD',
        rateCategory: 'cash',
        buyingRate: 155,
        sellingRate: 158,
        publishedDate: '2026-11-22',
        recordedAt: '2026-11-22T06:00:00.000Z',
        sourceUrl: bank.fxPageUrl,
      },
    ],
    incomingRates: [
      buildValidatedFxRecord({
        bank,
        currencyCode: 'USD',
        rateCategory: 'cash',
        buyingRaw: '155.00',
        sellingRaw: '158.00',
        publishedDate: '2026-11-22',
        collectedAt: SYNCED_AT,
        sourceUrl: bank.fxPageUrl,
        sourceType: 'official_html_table',
      })!,
    ],
    failedBankIds: new Set(['coop']),
  });

  assert.equal(unchangedRun.history.length, 1);
  const staleCoop = unchangedRun.rates.find((r) => r.bankId === 'coop');
  assert.equal(staleCoop?.verificationStatus, 'Stale');

  // Second sync: >15% anomalous jump on Dashen -> flagged and recorded
  const anomalyRun = mergeBankRatesWithHistory({
    previousRates: unchangedRun.rates,
    previousHistory: unchangedRun.history,
    incomingRates: [
      buildValidatedFxRecord({
        bank,
        currencyCode: 'USD',
        rateCategory: 'cash',
        buyingRaw: '195.00',
        sellingRaw: '198.00',
        publishedDate: '2026-11-23',
        collectedAt: SYNCED_AT,
        sourceUrl: bank.fxPageUrl,
        sourceType: 'official_html_table',
      })!,
    ],
    failedBankIds: new Set(),
  });

  assert.equal(anomalyRun.anomaliesCount, 1);
  assert.equal(anomalyRun.history.length, 2);
  const updatedDashen = anomalyRun.rates.find((r) => r.bankId === 'dashen');
  assert.equal(updatedDashen?.anomalyFlagged, true);
  assert.equal(updatedDashen?.dailyChangeBuy, 40);
});

test('parseZemenApiRates separates Cash and Transaction rates cleanly', () => {
  const parsed = parseZemenApiRates(
    {
      status: 'success',
      date: '2026-11-23',
      rates: {
        day: [
          {
            currency_code: 'USD',
            buying_rate: '161.1993',
            selling_rate: '164.4233',
            cash_buying_rate: '162.8113',
            cash_selling_rate: '166.0675',
          },
        ],
      },
    },
    SYNCED_AT
  );
  assert.equal(parsed.length, 2);
  assert.equal(parsed.find((r) => r.rateCategory === 'cash')?.buyingRate, 162.8113);
  assert.equal(parsed.find((r) => r.rateCategory === 'transaction')?.buyingRate, 161.1993);
});

test('parseBerhanBankHtml and parseEnatBankHtml extract rates and map YUA -> CNY', () => {
  const berhanHtml = `
    <input type='hidden' id='USD' value={"buying":"162.3735","selling":"165.6210","currency":"USD","currencyText":"1_USD_($)"} />
    <input type='hidden' id='YUA' value={"buying":"24.3555","selling":"24.8426","currency":"YUA","currencyText":"1_YUA"} />
  `;
  const berhan = parseBerhanBankHtml(berhanHtml, SYNCED_AT);
  assert.equal(berhan.length, 2);
  assert.equal(berhan.find((r) => r.currencyCode === 'CNY')?.buyingRate, 24.3555);

  const enatHtml = `
    <div><h4>USD</h4></div><div><p>161.8481</p></div><div><p>165.0851</p></div>
    <div><h4>EUR</h4></div><div><p>187.5119</p></div><div><p>191.2621</p></div>
  `;
  const enat = parseEnatBankHtml(enatHtml, SYNCED_AT);
  assert.equal(enat.length, 2);
  assert.equal(enat[0].currencyCode, 'USD');
  assert.equal(enat[0].sellingRate, 165.0851);
});

test('parseAbayBankHtml, parseSiinqeeBankHtml, parseZamZamBankHtml, and parseGlobalBankHtml handle tables and skip No Trade rows', () => {
  const abayHtml = `
    <table><tr><th colspan="3">CASH RATE</th></tr><tr><td>USD</td><td>164.5118</td><td>167.8020</td></tr></table>
    <table><tr><th colspan="3">TRANSACTION RATE</th></tr><tr><td>USD</td><td>162.1071</td><td>165.3492</td></tr></table>
  `;
  const abay = parseAbayBankHtml(abayHtml, SYNCED_AT);
  assert.equal(abay.length, 2);
  assert.equal(abay.find((r) => r.rateCategory === 'cash')?.buyingRate, 164.5118);
  assert.equal(abay.find((r) => r.rateCategory === 'transaction')?.buyingRate, 162.1071);

  const siinqeeHtml = `<table><tr><th>Currency</th><th>Buying</th><th>Selling</th></tr><tr><td>USD</td><td>161.3585</td><td>164.5857</td></tr></table>`;
  const siinqee = parseSiinqeeBankHtml(siinqeeHtml, SYNCED_AT);
  assert.equal(siinqee.length, 1);
  assert.equal(siinqee[0].buyingRate, 161.3585);

  const zamzamHtml = `
    <table>
      <tr><th colspan="5">Exchange Rate - November 21, 2026</th></tr>
      <tr><th>Currency</th><th colspan="2">Cash</th><th colspan="2">Transaction</th></tr>
      <tr><th></th><th>Buying</th><th>Selling</th><th>Buying</th><th>Selling</th></tr>
      <tr><td>USD - Us Dollar</td><td>162.2896</td><td>165.5354</td><td>162.2896</td><td>165.5354</td></tr>
    </table>
  `;
  const zamzam = parseZamZamBankHtml(zamzamHtml, SYNCED_AT);
  assert.equal(zamzam.length, 2);

  const globalHtml = `
    <table><tr><th>Currency</th><th>Buying</th><th>Selling</th></tr><tr><td>USD</td><td>161.5581</td><td>164.7893</td></tr></table>
    <table><tr><th>Currency</th><th>Buying</th><th>Selling</th></tr><tr><td>USD</td><td>No Trade</td><td>No Trade</td></tr></table>
  `;
  const global = parseGlobalBankHtml(globalHtml, SYNCED_AT);
  assert.equal(global.length, 1);
  assert.equal(global[0].buyingRate, 161.5581);
});

test('computeMarketFxExtremes computes daily highest buying and lowest selling across Ethiopian banks strictly by category', () => {
  const nbe = ETHIOPIAN_BANKS_CATALOG.find((b) => b.bankId === 'nbe')!;
  const abay = ETHIOPIAN_BANKS_CATALOG.find((b) => b.bankId === 'abay')!;
  const dashen = ETHIOPIAN_BANKS_CATALOG.find((b) => b.bankId === 'dashen')!;
  const siinqee = ETHIOPIAN_BANKS_CATALOG.find((b) => b.bankId === 'siinqee')!;

  const rates = [
    buildValidatedFxRecord({
      bank: nbe,
      currencyCode: 'USD',
      rateCategory: 'nbe_reference',
      buyingRaw: '169.00',
      sellingRaw: '150.00',
      publishedDate: '2026-11-23',
      collectedAt: SYNCED_AT,
      sourceUrl: nbe.fxPageUrl,
      sourceType: 'official_api',
    })!,
    buildValidatedFxRecord({
      bank: abay,
      currencyCode: 'USD',
      rateCategory: 'cash',
      buyingRaw: '164.51',
      sellingRaw: '167.80',
      publishedDate: '2026-11-23',
      collectedAt: SYNCED_AT,
      sourceUrl: abay.fxPageUrl,
      sourceType: 'official_html_table',
    })!,
    buildValidatedFxRecord({
      bank: dashen,
      currencyCode: 'USD',
      rateCategory: 'cash',
      buyingRaw: '161.20',
      sellingRaw: '164.42',
      publishedDate: '2026-11-23',
      collectedAt: SYNCED_AT,
      sourceUrl: dashen.fxPageUrl,
      sourceType: 'official_html_table',
    })!,
    buildValidatedFxRecord({
      bank: siinqee,
      currencyCode: 'USD',
      rateCategory: 'transaction',
      buyingRaw: '168.00',
      sellingRaw: '170.00',
      publishedDate: '2026-11-23',
      collectedAt: SYNCED_AT,
      sourceUrl: siinqee.fxPageUrl,
      sourceType: 'official_html_table',
    })!,
  ];

  const cashExtremes = computeMarketFxExtremes(rates, 'cash');
  assert.equal(cashExtremes.length, 1);
  assert.equal(cashExtremes[0].banksCount, 2);
  assert.equal(cashExtremes[0].highestBuyingRate, 164.51);
  assert.equal(cashExtremes[0].highestBuyingBank, 'Abay');
  assert.equal(cashExtremes[0].lowestBuyingRate, 161.2);
  assert.equal(cashExtremes[0].lowestSellingRate, 164.42);
  assert.equal(cashExtremes[0].lowestSellingBank, 'Dashen');
});

test('parseTsedeyBankHtml extracts cash, non-cash transaction, and weighted_average quotes without NO TRADE rows', () => {
  const html = `
    <div x-data='{ rates: [{"id":2,"name":"US DOLLAR","code":"USD","category":"non-cash","buying_rate":"162.2780","selling_rate":"165.5258","weighted_average_buying":"162.2780","weighted_average_selling":"165.5258","updated_at":"2026-11-23T05:43:00.000000Z"},{"id":8,"name":"US DOLLAR","code":"USD","category":"cash","buying_rate":"162.2780","selling_rate":"165.5236","weighted_average_buying":"162.2780","weighted_average_selling":"165.5236","updated_at":"2026-11-23T05:41:45.000000Z"},{"id":9,"name":"EURO","code":"EUR","category":"cash","buying_rate":"181.8390","selling_rate":"185.4758","weighted_average_buying":"NO TRADE","weighted_average_selling":"NO TRADE","updated_at":"2026-11-23T05:42:19.000000Z"}], activeTab: "cash" }'></div>
  `;
  const parsed = parseTsedeyBankHtml(html, SYNCED_AT);
  assert.equal(parsed.length, 4);
  assert.equal(parsed.find((r) => r.currencyCode === 'USD' && r.rateCategory === 'cash')?.sellingRate, 165.5236);
  assert.equal(parsed.find((r) => r.currencyCode === 'USD' && r.rateCategory === 'transaction')?.sellingRate, 165.5258);
  assert.equal(parsed.find((r) => r.currencyCode === 'USD' && r.rateCategory === 'weighted_average')?.buyingRate, 162.278);
  assert.equal(parsed.some((r) => r.currencyCode === 'EUR' && r.rateCategory === 'weighted_average'), false);
  assert.equal(parsed[0].publishedDate, '2026-11-23');
  assert.equal(parsed[0].verificationStatus, 'Verified');
});

test('scoped FX date parsing ignores unrelated old news dates on Abay, Siinqee, and Enat pages', () => {
  const abayHtml = `
    <article>Old press release from February 6, 2020</article>
    <section>FOREIGN CURRENCY EXCHANGE RATE 21 NOVEMBER 2026
      <table><tr><th colspan="3">CASH RATE</th></tr><tr><td>USD</td><td>164.5118</td><td>167.8020</td></tr></table>
    </section>
  `;
  const abay = parseAbayBankHtml(abayHtml, SYNCED_AT);
  assert.equal(abay[0].publishedDate, '2026-11-21');
  assert.equal(abay[0].verificationStatus, 'Verified');

  const siinqeeHtml = `
    <div>Archive notice August 14, 2025</div>
    <h2>Exchange Rate 23-Nov-2026</h2>
    <table><tr><th>Currency</th><th>Buying</th><th>Selling</th></tr><tr><td>USD</td><td>161.3585</td><td>164.5857</td></tr></table>
  `;
  const siinqee = parseSiinqeeBankHtml(siinqeeHtml, SYNCED_AT);
  assert.equal(siinqee[0].publishedDate, '2026-11-23');
  assert.equal(siinqee[0].verificationStatus, 'Verified');

  const enatHtml = `
    <div><h4>USD</h4></div><div><p>161.8481</p></div><div><p>165.0851</p></div>
    <article>Annual report published May 16, 2025</article>
  `;
  const enat = parseEnatBankHtml(enatHtml, SYNCED_AT);
  assert.equal(enat[0].publishedDate, '2026-11-23');
  assert.equal(enat[0].verificationStatus, 'Verified');
});

