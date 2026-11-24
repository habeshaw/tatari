import test from 'node:test';
import assert from 'node:assert/strict';
import {
  answerRecruiterPoolQuestion,
  computeDeterministicJobMatch,
  computeDeterministicResumeAnalysis,
  evaluateInterviewAnswerDeterministic,
  findMatchingJobsForAlert,
  rankJobsForCandidate,
  screenApplicantsDeterministic,
  validateUploadedCvBinary,
} from './aiRecruitment.ts';
import type { JobAlertConfig, JobApplication, JobListing, UserProfile } from '../types/domain.ts';

const SAMPLE_JOB: JobListing = {
  id: 'job-test-1',
  employerEmail: 'hr@addistech.et',
  titleEn: 'HR & Payroll Systems Officer',
  companyName: 'Addis Tech Manufacturing PLC',
  companyRating: 4.7,
  location: 'Addis Ababa',
  remoteType: 'On-site',
  category: 'HR & Admin',
  jobType: 'Full-time',
  experienceLevel: 'Mid-Level (2-4 yrs)',
  salaryMin: 28000,
  salaryMax: 35000,
  salaryDisplay: '28,000 – 35,000 ETB/mo',
  deadline: '2026-12-20',
  summaryEn: 'Manage Ethiopian payroll calculation in Power Query and Labor Proclamation compliance.',
  descriptionEn:
    'Own monthly payroll, pension compliance, income tax filings, and Excel Power Query automation for 120 staff.',
  requirements: [
    '2+ years managing Ethiopian payroll',
    'Advanced Microsoft Excel and Power Query',
    'Working knowledge of Ethiopian Labor Proclamation 1156/2019',
  ],
  benefits: ['Medical insurance'],
  easyApply: true,
  postingFeeEtb: 500,
  status: 'approved',
  createdAt: '2026-11-16T07:30:00.000Z',
};

const SAMPLE_CV = `
ABEBE BIKILA
abebe@tatari.et | +251911556677 | Addis Ababa
PROFESSIONAL SUMMARY
HR & Payroll Analyst with 3 years managing monthly payroll for 140 employees.
WORK EXPERIENCE
- Automated payroll cycles using Microsoft Excel and Power Query, cutting processing time by 35%.
- Maintained compliance with Ethiopian Labor Proclamation 1156/2019 and pension rules.
EDUCATION
BA in Business Administration — Addis Ababa University (2022)
SKILLS
Microsoft Excel, Power Query, Ethiopian Payroll, SQL, HR Administration
`;

test('validateUploadedCvBinary enforces size limits, allowed extensions, and PDF/DOCX magic bytes', () => {
  const validPdf = validateUploadedCvBinary('cv.pdf', 1024, new Uint8Array([0x25, 0x50, 0x44, 0x46]));
  assert.equal(validPdf.valid, true);
  assert.equal(validPdf.fileType, 'pdf');

  const spoofedPdf = validateUploadedCvBinary('fake.pdf', 1024, new Uint8Array([0x4d, 0x5a, 0x90, 0x00]));
  assert.equal(spoofedPdf.valid, false);

  const oversized = validateUploadedCvBinary('huge.docx', 6 * 1024 * 1024, new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
  assert.equal(oversized.valid, false);

  const disallowed = validateUploadedCvBinary('script.exe', 500);
  assert.equal(disallowed.valid, false);
});

test('computeDeterministicResumeAnalysis scores structured CV higher than sparse text and reports missing keywords', () => {
  const strong = computeDeterministicResumeAnalysis(SAMPLE_CV, 'Power BI Analyst');
  const weak = computeDeterministicResumeAnalysis('Looking for job');

  assert.ok(strong.overallScore > weak.overallScore);
  assert.ok(strong.extractedSkills.includes('Power Query'));
  assert.ok(strong.missingKeywords.some((k) => k.toLowerCase().includes('power bi')));
  assert.ok(weak.missingInfo.length >= 2);
});

test('computeDeterministicJobMatch scores evidence-based skill overlap without inventing experience', () => {
  const match = computeDeterministicJobMatch(SAMPLE_CV, SAMPLE_JOB);
  assert.ok(match.compatibilityScore >= 60);
  assert.ok(match.matchingSkills.includes('Power Query'));
  assert.ok(match.relevantExperience.length > 0);
  assert.ok(match.tailoredResumeText.includes('Ethio') || match.tailoredResumeText.includes('Power Query'));
});

test('rankJobsForCandidate prioritizes aligned vacancies and findMatchingJobsForAlert filters alerts cleanly', () => {
  const seeker: UserProfile = {
    email: 'abebe@tatari.et',
    fullName: 'Abebe Bikila',
    location: 'Addis Ababa',
    skills: ['Microsoft Excel', 'Power Query', 'Ethiopian Payroll'],
    careerInterests: ['HR & Admin'],
    role: 'seeker',
    status: 'approved',
    passwordHash: 'hash',
    createdAt: '2026-10-01T00:00:00.000Z',
  };
  const unrelatedJob: JobListing = {
    ...SAMPLE_JOB,
    id: 'job-test-2',
    titleEn: 'Industrial PLC Maintenance Engineer',
    category: 'Engineering',
    location: 'Hawassa',
    descriptionEn: 'PLC diagnostics, mechanical preventive maintenance, and AutoCAD electrical schematics.',
    requirements: ['BSc Electrical Engineering', 'AutoCAD'],
    salaryMax: 22000,
  };

  const recs = rankJobsForCandidate(seeker, [unrelatedJob, SAMPLE_JOB]);
  assert.equal(recs[0].jobId, SAMPLE_JOB.id);
  assert.ok(recs[0].compatibilityScore > recs[1].compatibilityScore);

  const alert: JobAlertConfig = {
    id: 'alert-1',
    email: 'abebe@tatari.et',
    keywords: 'Payroll',
    location: 'Addis Ababa',
    category: 'HR & Admin',
    remoteType: 'all',
    minSalaryEtb: 25000,
    emailEnabled: true,
    inAppEnabled: true,
    active: true,
    createdAt: '2026-11-20T00:00:00.000Z',
  };
  const matches = findMatchingJobsForAlert(alert, [unrelatedJob, SAMPLE_JOB]);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, SAMPLE_JOB.id);
});

test('evaluateInterviewAnswerDeterministic & screenApplicantsDeterministic return transparent structured metrics', () => {
  const evaluation = evaluateInterviewAnswerDeterministic(
    {
      id: 'q1',
      category: 'Technical',
      question: 'How have you applied Power Query in payroll?',
      focusTip: 'Give metrics.',
    },
    'In my role I built a Power Query pipeline for 140 employees that reduced payroll processing time by 35% and ensured Labor Proclamation 1156/2019 compliance.',
    SAMPLE_JOB.titleEn,
    SAMPLE_JOB.requirements
  );
  assert.ok(evaluation.overallScore >= 65);
  assert.ok(evaluation.scores.technicalKnowledge >= 55);

  const apps: JobApplication[] = [
    {
      id: 'app-1',
      jobId: SAMPLE_JOB.id,
      jobTitle: SAMPLE_JOB.titleEn,
      companyName: SAMPLE_JOB.companyName,
      applicantName: 'Abebe Bikila',
      applicantEmail: 'abebe@tatari.et',
      phone: '+251911556677',
      resumeUrl: 'https://example.com/cv.pdf',
      resumeText: SAMPLE_CV,
      coverNote: '3 years Ethiopian payroll & Power Query automation.',
      yearsExperience: '3-5 years',
      status: 'Submitted',
      createdAt: '2026-11-20T00:00:00.000Z',
    },
  ];
  const screened = screenApplicantsDeterministic(SAMPLE_JOB, apps);
  assert.equal(screened.length, 1);
  assert.ok(screened[0].fitScore >= 60);
  const qaReply = answerRecruiterPoolQuestion('Who has Power Query?', SAMPLE_JOB, apps);
  assert.ok(qaReply.includes('Abebe Bikila'));
});
