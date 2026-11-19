import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildJobPostingJsonLd,
  buildJobSlug,
  categorizeJob,
  computeDedupeKey,
  isExpiredJob,
  isExpiringSoon,
  normalizeEmploymentType,
  parseHtmlDirectory,
  parseJsonFeed,
  parseRssXmlFeed,
  parseSalaryRange,
  resolveJobUrl,
} from './aggregatorCore';

test('categorizeJob accurately classifies Ethiopian job vacancies into standard categories', () => {
  assert.equal(
    categorizeJob('Senior Full-Stack Software Engineer', 'Build React and Node.js fintech APIs'),
    'information-technology'
  );
  assert.equal(
    categorizeJob('WASH Field Coordinator', 'Humanitarian relief and NGO community water program in Somali Region'),
    'ngo-and-development'
  );
  assert.equal(
    categorizeJob('Senior IFRS Accountant', 'Prepare monthly tax returns, payroll, and external audit schedules'),
    'accounting-and-finance'
  );
  assert.equal(
    categorizeJob('Site Civil Engineer', 'Highway construction supervision and AutoCAD structural drawings'),
    'construction'
  );
  assert.equal(
    categorizeJob('General Role', 'Some unspecified task', 'Government Jobs'),
    'government-jobs'
  );
});

test('normalizeEmploymentType maps varied source labels cleanly', () => {
  assert.equal(normalizeEmploymentType('Full Time Permanent'), 'Full-time');
  assert.equal(normalizeEmploymentType('Fixed-Term Contract'), 'Contract');
  assert.equal(normalizeEmploymentType('Graduate Trainee / Internship'), 'Internship');
  assert.equal(normalizeEmploymentType('Short-term Consultancy'), 'Consultancy');
  assert.equal(normalizeEmploymentType('Part time'), 'Part-time');
});

test('parseSalaryRange parses single and ranged ETB salaries', () => {
  assert.deepEqual(parseSalaryRange('25,000 - 40,000 ETB/month'), {
    salaryMin: 25000,
    salaryMax: 40000,
  });
  assert.deepEqual(parseSalaryRange('ETB 18,500'), {
    salaryMin: 18500,
    salaryMax: 18500,
  });
  assert.deepEqual(parseSalaryRange('Negotiable'), {
    salaryMin: null,
    salaryMax: null,
  });
});

test('computeDedupeKey normalizes punctuation and spacing across duplicates', () => {
  const k1 = computeDedupeKey({
    sourceId: 1,
    title: 'Senior Accountant (IFRS)',
    companyName: 'Dashen Bank S.C.',
    location: 'Addis Ababa',
  });
  const k2 = computeDedupeKey({
    sourceId: 2,
    title: 'senior accountant  ifrs ',
    companyName: 'Dashen Bank S C',
    location: 'Addis Ababa',
  });
  assert.equal(k1, k2);
});

test('buildJobSlug creates clean SEO-friendly job URLs', () => {
  assert.equal(
    buildJobSlug('Senior DevOps Engineer (Cloud)', 'Ethio Telecom', 42),
    'senior-devops-engineer-cloud-ethio-telecom-42'
  );
});

test('isExpiredJob and isExpiringSoon detect expiration and 5-day warning window', () => {
  const now = new Date('2026-11-19T10:00:00Z');
  assert.equal(isExpiredJob('2026-11-18T10:00:00Z', null, now), true);
  assert.equal(isExpiredJob('2026-11-25T10:00:00Z', null, now), false);
  assert.equal(isExpiringSoon('2026-11-22T10:00:00Z', now, 5), true);
  assert.equal(isExpiringSoon('2026-12-05T10:00:00Z', now, 5), false);
});

test('parseRssXmlFeed parses RSS 2.0 Ethiopian vacancy XML', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0">
    <channel>
      <title>Ethiojobs Feed</title>
      <item>
        <guid>ej-901</guid>
        <title>Backend Node.js Developer</title>
        <link>https://www.ethiojobs.net/display-job/901</link>
        <company>Chapa Financial Technologies</company>
        <location>Addis Ababa</location>
        <salary>45,000 - 65,000 ETB</salary>
        <employmentType>Full-time</employmentType>
        <deadline>2026-12-10T00:00:00Z</deadline>
        <pubDate>2026-11-18T08:00:00Z</pubDate>
        <description>&lt;p&gt;Build payment microservices in TypeScript.&lt;/p&gt;</description>
      </item>
    </channel>
  </rss>`;
  const jobs = parseRssXmlFeed(xml, 'https://www.ethiojobs.net');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].originalJobIdentifier, 'ej-901');
  assert.equal(jobs[0].companyName, 'Chapa Financial Technologies');
  assert.equal(jobs[0].salaryMin, 45000);
  assert.equal(jobs[0].salaryMax, 65000);
});

test('parseJsonFeed and parseHtmlDirectory extract structured job fields safely', () => {
  const jsonJobs = parseJsonFeed(
    {
      jobs: [
        {
          id: 'hahu-77',
          title: 'Public Health Officer',
          company: 'Save the Children Ethiopia',
          location: 'Hawassa',
          url: 'https://hahujobs.io/jobs/77',
          salary: '32,000 ETB',
          employment_type: 'Contract',
          description: 'Manage maternal health outreach in Sidama Region.',
        },
      ],
    },
    'https://hahujobs.io'
  );
  assert.equal(jsonJobs.length, 1);
  assert.equal(jsonJobs[0].employmentType, 'Contract');
  assert.equal(jsonJobs[0].salaryMin, 32000);

  const html = `
    <div data-job-card data-job-id="cb-12">
      <h2>Customer Service Officer</h2>
      <span class="company">Commercial Bank of Ethiopia</span>
      <span class="location">Bahir Dar</span>
      <span class="employment-type">Full-time</span>
      <a href="/careers/cb-12">Apply</a>
      <p class="summary">Branch teller and client support operations.</p>
    </div>
  `;
  const htmlJobs = parseHtmlDirectory(html, 'https://combanketh.et');
  assert.equal(htmlJobs.length, 1);
  assert.equal(htmlJobs[0].originalJobUrl, 'https://combanketh.et/careers/cb-12');
  assert.equal(htmlJobs[0].companyName, 'Commercial Bank of Ethiopia');
});

test('buildJobPostingJsonLd only emits structured data for active Tatari-originated jobs', () => {
  const externalSchema = buildJobPostingJsonLd(
    {
      slug: 'ext-1',
      title: 'External Role',
      description: 'External job',
      companyName: 'Partner Co',
      location: 'Addis Ababa',
      employmentType: 'Full-time',
      publishedAt: '2026-11-18T00:00:00Z',
      expiresAt: '2026-12-20T00:00:00Z',
      jobOrigin: 'external',
      status: 'active',
    },
    'https://tatari.et'
  );
  assert.equal(externalSchema, null);

  const tatariSchema = buildJobPostingJsonLd(
    {
      slug: 'tatari-role-1',
      title: 'Product Designer',
      description: 'Design fintech workflows',
      companyName: 'AddisTech',
      location: 'Addis Ababa',
      employmentType: 'Full-time',
      publishedAt: '2026-11-18T00:00:00Z',
      expiresAt: '2099-12-20T00:00:00Z',
      salaryMin: 30000,
      salaryMax: 45000,
      jobOrigin: 'tatari',
      status: 'active',
    },
    'https://tatari.et'
  );
  assert.ok(tatariSchema);
  assert.equal(tatariSchema['@type'], 'JobPosting');
  assert.equal(tatariSchema.url, 'https://tatari.et/jobs/tatari-role-1');
});

test('resolveJobUrl preserves absolute URLs and resolves relative Ethiopian job paths', () => {
  assert.equal(
    resolveJobUrl('/display-job/50101/backend-engineer', 'https://www.ethiojobs.net'),
    'https://www.ethiojobs.net/display-job/50101/backend-engineer'
  );
  assert.equal(
    resolveJobUrl('https://hahujobs.io/jobs/cloud-9102', 'https://hahujobs.io'),
    'https://hahujobs.io/jobs/cloud-9102'
  );
  assert.equal(resolveJobUrl('', 'https://geezjobs.com'), 'https://geezjobs.com');
});

test('parseHtmlDirectory parses live Ethiojobs, GeezJobs, Ezega, and EthiopianWork formats', () => {
  const ethiojobsHtml = `<!doctype html><html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: {
      pageProps: {
        jobs: {
          data: [
            {
              title: 'Human Rights Officer',
              slug: 'abc123-human-rights-officer',
              state: 'Addis Ababa',
              location_type: 'Office',
              description: '<p>Monitor human rights programs. Salary 35,000 - 45,000 ETB.</p>',
              date_published: '2026-11-19T10:00:00Z',
              date_expiry: '2099-12-01T23:59:59Z',
              company: { name: 'EHRC', logo: 'company-logo/1/ehrc.png' },
              catalogs: [{ name: 'NGO and Development' }],
            },
          ],
        },
      },
    },
  })}</script></body></html>`;
  const ej = parseHtmlDirectory(ethiojobsHtml, 'https://ethiojobs.net/jobs');
  assert.equal(ej.length, 1);
  assert.equal(ej[0].originalJobUrl, 'https://ethiojobs.net/job/abc123-human-rights-officer');
  assert.equal(ej[0].companyName, 'EHRC');
  assert.equal(ej[0].salaryMin, 35000);

  const geezHtml = `<a href="/job-detail/secretary-zeeleons" class="job-card" data-city="Addis Ababa" data-type="Full-time" data-title="Secretary" data-company="Zeeleons PLC" data-closing="5 days left">Secretary</a>`;
  const gz = parseHtmlDirectory(geezHtml, 'https://geezjobs.com/jobs-in-ethiopia');
  assert.equal(gz.length, 1);
  assert.equal(gz[0].originalJobUrl, 'https://geezjobs.com/job-detail/secretary-zeeleons');
  assert.equal(gz[0].companyName, 'Zeeleons PLC');

  const ezegaHtml = `<div><div class="col-xs-12 col-sm-2">Nov 17 2026</div><div class="col-xs-12 col-sm-4"><a href="/Jobs/viewjobposting/98503/Maintenance-Technician">Maintenance Technician</a></div><div class="col-xs-12 col-sm-4">CEMI PLC</div><div class="col-xs-12 col-sm-2">Addis Ababa</div></div>`;
  const ez = parseHtmlDirectory(ezegaHtml, 'https://www.ezega.com/jobs/AllPostedJobs');
  assert.equal(ez.length, 1);
  assert.equal(ez[0].originalJobUrl, 'https://www.ezega.com/Jobs/viewjobposting/98503/Maintenance-Technician');
  assert.equal(ez[0].companyName, 'CEMI PLC');

  const ewHtml = `<div class="job-card"><a href="https://ethiopianwork.com/job/awash-bank-vacancy" class="job-card__title">Awash Bank Vacancy</a><div class="job-card__company">Awash Bank</div><div class="job-card__meta"><span class="badge">Addis Ababa</span><span class="badge">Full time</span></div><div class="job-card__deadline">Deadline: Dec 20, 2099</div></div>`;
  const ew = parseHtmlDirectory(ewHtml, 'https://ethiopianwork.com/jobs');
  assert.equal(ew.length, 1);
  assert.equal(ew[0].originalJobUrl, 'https://ethiopianwork.com/job/awash-bank-vacancy');
  assert.equal(ew[0].companyName, 'Awash Bank');
});


