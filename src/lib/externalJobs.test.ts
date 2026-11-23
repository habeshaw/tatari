import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeHtmlEntities,
  mergeExternalJobs,
  parseEffoySiraPosts,
  parseEthiojobsHtml,
  parseGeezJobsHtml,
  stripHtmlToText,
} from './externalJobs';
import { filterJobs } from './storeLogic';
import type { JobListing } from '../types/domain';

test('decodeHtmlEntities and stripHtmlToText sanitize HTML snippets cleanly', () => {
  assert.equal(decodeHtmlEntities('Senior &amp; Lead &#8211; Dev &quot;Addis&quot;'), 'Senior & Lead – Dev "Addis"');
  assert.equal(
    stripHtmlToText('<p>Hello <strong>Ethiopia</strong><br/>&bull; 2+ years exp</p>'),
    'Hello Ethiopia\n• 2+ years exp'
  );
});

test('parseEthiojobsHtml extracts Next.js __NEXT_DATA__ vacancies with canonical ethiojobs.net sourceUrl', () => {
  const samplePayload = {
    props: {
      pageProps: {
        jobs: {
          data: [
            {
              title: 'Senior Accountant &amp; Tax Officer',
              slug: 'abc123-senior-accountant',
              type: 8,
              level: '3',
              location_type: 'Hybrid',
              state: 'Addis Ababa',
              date_published: '2026-11-18T10:00:00.000Z',
              date_expiry: '2026-12-10T23:59:59.000Z',
              company: { name: 'Dashen Manufacturing PLC' },
              catalogs: [{ name: 'Accounting and Finance' }],
              description: '<p>Prepare monthly VAT declarations and IFRS statements.</p>',
            },
          ],
        },
      },
    },
  };
  const html = `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
    samplePayload
  )}</script></body></html>`;

  const jobs = parseEthiojobsHtml(html, '2026-11-19T08:00:00.000Z');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].titleEn, 'Senior Accountant & Tax Officer');
  assert.equal(jobs[0].companyName, 'Dashen Manufacturing PLC');
  assert.equal(jobs[0].location, 'Addis Ababa, Ethiopia');
  assert.equal(jobs[0].remoteType, 'Hybrid');
  assert.equal(jobs[0].category, 'Finance');
  assert.equal(jobs[0].deadline, '2026-12-10');
  assert.equal(jobs[0].sourceType, 'external');
  assert.equal(jobs[0].sourceSite, 'Ethiojobs');
  assert.equal(jobs[0].sourceDomain, 'ethiojobs.net');
  assert.equal(jobs[0].sourceUrl, 'https://www.ethiojobs.net/job/abc123-senior-accountant');
  assert.equal(jobs[0].easyApply, false);
});

test('parseGeezJobsHtml extracts opportunity-card listings and original geezjobs.com link', () => {
  const html = `
    <div class="opportunity-card group">
      <h3><a href="/job-detail/software-engineer-et">Software Engineer (React &amp; Node)</a></h3>
      <div><a href="/company/zala-tech">Zala Tech Ethiopia</a></div>
      <div><i data-lucide="map-pin"></i><span>Addis Ababa - ethiopia</span></div>
      <div><i data-lucide="calendar-x"></i><span>Deadline: December 5, 2026</span></div>
      <div><i data-lucide="briefcase"></i><span>Full-time / Permanent</span></div>
    </div>
  `;

  const jobs = parseGeezJobsHtml(html, '2026-11-19T08:00:00.000Z');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].titleEn, 'Software Engineer (React & Node)');
  assert.equal(jobs[0].companyName, 'Zala Tech Ethiopia');
  assert.equal(jobs[0].location, 'Addis Ababa, Ethiopia');
  assert.equal(jobs[0].category, 'IT & Data');
  assert.equal(jobs[0].jobType, 'Full-time');
  assert.equal(jobs[0].sourceSite, 'GeezJobs');
  assert.equal(jobs[0].sourceDomain, 'geezjobs.com');
  assert.equal(jobs[0].sourceUrl, 'https://geezjobs.com/job-detail/software-engineer-et');
});

test('parseEffoySiraPosts extracts WordPress job announcements and preserves original effoysira.com link', () => {
  const posts = [
    {
      id: 32183,
      date: '2026-11-19T06:48:47',
      link: 'https://effoysira.com/mullege-plc-job-vacancy-2026/',
      title: { rendered: 'Mullege PLC Job Vacancy 2026' },
      excerpt: { rendered: '<p>Mullege PLC is hiring logistics and quality officers in Addis Ababa.</p>' },
      content: { rendered: '<p>Full requirements on site.</p>' },
    },
    {
      id: 99999,
      date: '2026-11-18T06:00:00',
      link: 'https://effoysira.com/random-news/',
      title: { rendered: 'Weekend Sports Highlights' },
      excerpt: { rendered: '<p>Not a job post.</p>' },
    },
  ];

  const jobs = parseEffoySiraPosts(posts, '2026-11-19T08:00:00.000Z');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].titleEn, 'Mullege PLC Job Vacancy 2026');
  assert.equal(jobs[0].companyName, 'Mullege PLC');
  assert.equal(jobs[0].sourceSite, 'EffoySira');
  assert.equal(jobs[0].sourceUrl, 'https://effoysira.com/mullege-plc-job-vacancy-2026/');
});

test('mergeExternalJobs retains TATARI postings, preserves paused admin moderation, and filters by source', () => {
  const tatariJob: JobListing = {
    id: 'job-101',
    employerEmail: 'hr@addistech.et',
    titleEn: 'Verified TATARI Engineer',
    companyName: 'Addis Tech PLC',
    companyRating: 4.8,
    location: 'Addis Ababa',
    remoteType: 'Hybrid',
    category: 'IT & Data',
    jobType: 'Full-time',
    experienceLevel: 'Mid-Level',
    salaryMin: 40000,
    salaryMax: 50000,
    salaryDisplay: '40,000 – 50,000 ETB/mo',
    deadline: '2026-12-30',
    summaryEn: 'Direct verified posting.',
    descriptionEn: 'Direct verified posting on TATARI.',
    requirements: [],
    benefits: [],
    easyApply: true,
    postingFeeEtb: 500,
    status: 'approved',
    createdAt: '2026-11-18T10:00:00.000Z',
    publishedAt: '2026-11-18T10:00:00.000Z',
    sourceType: 'tatari',
  };

  const pausedExternal: JobListing = {
    ...tatariJob,
    id: 'ext-geezjobs-old',
    titleEn: 'Paused External Role',
    status: 'paused',
    sourceType: 'external',
    sourceSite: 'GeezJobs',
    sourceDomain: 'geezjobs.com',
    sourceUrl: 'https://geezjobs.com/job-detail/old',
  };

  const incomingExternal: JobListing[] = [
    { ...pausedExternal, status: 'approved' },
    {
      ...tatariJob,
      id: 'ext-ethiojobs-1',
      titleEn: 'Logistics Officer',
      sourceType: 'external',
      sourceSite: 'Ethiojobs',
      sourceDomain: 'ethiojobs.net',
      sourceUrl: 'https://www.ethiojobs.net/job/logistics-1',
    },
  ];

  const merged = mergeExternalJobs([tatariJob, pausedExternal], incomingExternal);
  assert.equal(merged.length, 3);
  assert.equal(merged.find((j) => j.id === 'ext-geezjobs-old')?.status, 'paused');

  const tatariOnly = filterJobs(merged, {
    what: '',
    where: '',
    category: 'all',
    jobType: 'all',
    remoteType: 'all',
    minSalary: 0,
    postedWithinDays: 0,
    sourceFilter: 'tatari',
  });
  assert.equal(tatariOnly.length, 1);
  assert.equal(tatariOnly[0].id, 'job-101');

  const ethiojobsOnly = filterJobs(merged, {
    what: '',
    where: '',
    category: 'all',
    jobType: 'all',
    remoteType: 'all',
    minSalary: 0,
    postedWithinDays: 0,
    sourceFilter: 'ethiojobs',
  });
  assert.equal(ethiojobsOnly.length, 1);
  assert.equal(ethiojobsOnly[0].sourceSite, 'Ethiojobs');
});
