import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adminCreateTrainingProgram,
  adminDeleteTrainingProgram,
  adminUpdateTrainingProgram,
  adminUpdateTrainingRequestStatus,
  buildTrainingProposalHtml,
  calculateCohortTrainingQuote,
  createTailoredTrainingRequest,
  filterTrainingPrograms,
} from './trainingLogic';
import { SEED_USERS } from '../data/seedData';
import type { TrainingProgram } from '../types/domain';

const sampleProgram: TrainingProgram = {
  id: 'trn-test-1',
  titleEn: 'Power Query & Automated KPI Reporting for Finance Teams',
  category: 'Data & Power BI',
  durationDays: 2,
  durationLabel: '2-Day Intensive (14 hrs)',
  targetAudience: 'Finance Officers, BI Analysts, Operations Managers',
  feePerCohortEtb: 28000,
  maxParticipants: 15,
  deliveryModes: ['On-Site (Your Premises)', 'Live Virtual'],
  sectorFocus: ['Banking & Microfinance', 'NGO & Humanitarian Development'],
  summaryEn: 'Eliminate manual copy-paste reporting with automated Power Query pipelines tailored to your ERP exports.',
  syllabusModules: ['Automated Excel/ERP Extraction', 'Power BI Executive Visuals'],
  deliverables: ['Custom Company Dashboard', 'Completion Certificates'],
  active: true,
  createdAt: '2026-11-10T08:00:00.000Z',
};

test('calculateCohortTrainingQuote accounts for included seats, extra seats, and virtual discount', () => {
  const onSiteBase = calculateCohortTrainingQuote(28000, 15, 12, 'On-Site (Your Premises)');
  assert.equal(onSiteBase.extraParticipants, 0);
  assert.equal(onSiteBase.estimatedTotalEtb, 28000);

  const onSiteExpanded = calculateCohortTrainingQuote(28000, 15, 20, 'On-Site (Your Premises)');
  assert.equal(onSiteExpanded.extraParticipants, 5);
  assert.equal(onSiteExpanded.extraSeatFeeEtb, 6000);
  assert.equal(onSiteExpanded.estimatedTotalEtb, 34000);

  const virtualExpanded = calculateCohortTrainingQuote(28000, 15, 20, 'Live Virtual');
  // 34,000 - 15% (5,100) = 28,900
  assert.equal(virtualExpanded.virtualDiscountEtb, 5100);
  assert.equal(virtualExpanded.estimatedTotalEtb, 28900);
});

test('createTailoredTrainingRequest validates organization fields, enforces auth, and builds downloadable tailored proposal', () => {
  const employer = SEED_USERS.find((u) => u.email === 'hr@addistech.et')!;
  const admin = SEED_USERS.find((u) => u.email === 'admin@tatari.et')!;

  assert.throws(
    () =>
      createTailoredTrainingRequest([sampleProgram], null, {
        programId: sampleProgram.id,
        organizationName: 'Awash Mfg',
        organizationSector: 'Manufacturing & Agro-Processing',
        contactPerson: 'Dawit',
        phone: '+251911223344',
        teamSize: 15,
        deliveryMode: 'On-Site (Your Premises)',
        preferredDates: '2026-12-10 to 2026-12-11',
        locationCity: 'Addis Ababa',
        customTopics: 'Need ERCA payroll tax reporting automation.',
      }),
    /sign in/i
  );

  const req = createTailoredTrainingRequest([sampleProgram], employer, {
    programId: sampleProgram.id,
    organizationName: 'Addis Tech Manufacturing PLC',
    organizationSector: 'Manufacturing & Agro-Processing',
    contactPerson: 'Meron Tadesse',
    phone: '+251911223344',
    teamSize: 18,
    deliveryMode: 'On-Site (Your Premises)',
    preferredDates: '2026-12-15 to 2026-12-16',
    locationCity: 'Addis Ababa',
    customTopics: 'Customize Excel/Power Query templates using our monthly factory output sheets.',
  });

  assert.equal(req.status, 'Submitted');
  assert.equal(req.estimatedFeeEtb, 31600); // 28,000 + 3*1200

  // Non-admin cannot change proposal status
  assert.throws(() =>
    adminUpdateTrainingRequestStatus([req], employer, req.id, {
      status: 'Approved & Scheduled',
    })
  );

  const updated = adminUpdateTrainingRequestStatus([req], admin, req.id, {
    status: 'Scoped & Quoted',
    trainerAssigned: 'Dawit Mekonnen',
    estimatedFeeEtb: 30000,
    proposalNotes: 'Pre-training dataset audit included 3 days prior.',
  });
  assert.equal(updated[0].status, 'Scoped & Quoted');
  assert.equal(updated[0].trainerAssigned, 'Dawit Mekonnen');
  assert.equal(updated[0].estimatedFeeEtb, 30000);

  const doc = buildTrainingProposalHtml(updated[0], sampleProgram);
  assert.match(doc.filename, /addis-tech-manufacturing-plc/);
  assert.match(doc.content, /Dawit Mekonnen/);
  assert.match(doc.content, /Customize Excel\/Power Query templates/);
});

test('admin training program CRUD and catalog filtering enforce admin role', () => {
  const admin = SEED_USERS.find((u) => u.email === 'admin@tatari.et')!;
  const seeker = SEED_USERS.find((u) => u.email === 'abebe@tatari.et')!;

  assert.throws(() =>
    adminCreateTrainingProgram([sampleProgram], seeker, {
      titleEn: 'Unauthorized Program',
      category: 'Payroll & HR Systems',
      durationDays: 1,
      targetAudience: 'HR Teams',
      feePerCohortEtb: 15000,
      maxParticipants: 15,
      deliveryModes: ['Live Virtual'],
      sectorFocus: ['NGO & Humanitarian Development'],
      summaryEn: 'Should fail for non-admin.',
      syllabusModules: ['Module 1'],
      deliverables: ['Certificate'],
    })
  );

  const { programs: afterCreate, created } = adminCreateTrainingProgram([sampleProgram], admin, {
    titleEn: 'Ethiopian Labor Law & HR Compliance Workshop',
    category: 'Payroll & HR Systems',
    durationDays: 2,
    targetAudience: 'HR Managers & Legal Officers',
    feePerCohortEtb: 22000,
    maxParticipants: 20,
    deliveryModes: ['Hybrid Blended'],
    sectorFocus: ['Manufacturing & Agro-Processing'],
    summaryEn: 'Practical workshop covering Proclamation 1156/2019 contracts, probation, and severance.',
    syllabusModules: ['Employment Contracts', 'Disciplinary & Termination Compliance'],
    deliverables: ['Bilingual Policy Templates', 'Certificates'],
  });
  assert.equal(afterCreate.length, 2);

  const filtered = filterTrainingPrograms(afterCreate, {
    query: 'Proclamation',
    category: 'all',
    deliveryMode: 'Hybrid Blended',
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, created.id);

  const afterEdit = adminUpdateTrainingProgram(afterCreate, admin, created.id, {
    titleEn: 'Ethiopian Labor Law & HR Compliance Pro Workshop',
    category: 'Payroll & HR Systems',
    durationDays: 3,
    targetAudience: 'HR Directors & Managers',
    feePerCohortEtb: 26000,
    maxParticipants: 20,
    deliveryModes: ['Hybrid Blended', 'On-Site (Your Premises)'],
    sectorFocus: ['Manufacturing & Agro-Processing'],
    summaryEn: 'Extended 3-day workshop covering Ethiopian Labor Law and ERCA pension compliance.',
    syllabusModules: ['Contracts', 'Disciplinary Compliance', 'Payroll Audit'],
    deliverables: ['Policy Pack', 'Certificates'],
  });
  assert.equal(afterEdit[0].feePerCohortEtb, 26000);

  const afterDelete = adminDeleteTrainingProgram(afterEdit, admin, created.id);
  assert.equal(afterDelete.length, 1);
});
