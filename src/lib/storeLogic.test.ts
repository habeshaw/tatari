import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adminApprovePaymentReceipt,
  adminRejectPaymentReceipt,
  buildDownloadableMaterialFile,
  canDownloadMaterial,
  createJobPostingWithPayment,
  createMaterialOrderWithPayment,
  filterJobs,
  isJobPubliclyVisible,
} from './storeLogic';
import type { DigitalProduct, JobListing, MaterialOrder, PaymentReceipt } from '../types/domain';

const sampleProduct: DigitalProduct = {
  id: 'prod-1',
  sellerEmail: 'admin@tatari.et',
  titleEn: 'Automated Ethiopian Payroll Model',
  category: 'Payroll & HR',
  priceEtb: 1500,
  fileFormat: 'XLSX / CSV',
  fileSize: '2.4 MB',
  version: 'v3.0',
  descriptionEn: 'Complete Ethiopian payroll model with income tax and pension brackets.',
  includedFiles: ['Payroll_Engine.xlsx', 'Tax_Brackets_2026.pdf'],
  active: true,
  createdAt: '2026-11-01T10:00:00.000Z',
};

const sampleApprovedJob: JobListing = {
  id: 'job-1',
  employerEmail: 'hr@addistech.et',
  titleEn: 'HR & Payroll Systems Officer',
  companyName: 'Addis Tech PLC',
  companyRating: 4.7,
  location: 'Addis Ababa',
  remoteType: 'On-site',
  category: 'HR & Admin',
  jobType: 'Full-time',
  experienceLevel: 'Mid-Level',
  salaryMin: 28000,
  salaryMax: 34000,
  salaryDisplay: '28,000 – 34,000 ETB/mo',
  deadline: '2026-12-30',
  summaryEn: 'Manage monthly payroll and HR compliance.',
  descriptionEn: 'Manage monthly payroll in Power Query and maintain employee records.',
  requirements: ['BA in HRM', 'Power Query'],
  benefits: ['Health Insurance', 'Transport Allowance'],
  easyApply: true,
  postingFeeEtb: 500,
  status: 'approved',
  createdAt: '2026-11-16T08:00:00.000Z',
  publishedAt: '2026-11-16T09:00:00.000Z',
};

test('material download stays locked until admin approves payment receipt', () => {
  const { order, receipt } = createMaterialOrderWithPayment(sampleProduct, {
    payerEmail: 'abebe@tatari.et',
    payerName: 'Abebe Bikila',
    payerPhone: '+251911223344',
    paymentMethod: 'Telebirr',
    transactionRef: 'TB-774411',
  });

  assert.equal(order.status, 'pending_approval');
  assert.equal(order.paymentStatus, 'pending_verification');
  assert.equal(canDownloadMaterial(order), false);

  const next = adminApprovePaymentReceipt(
    { jobs: [sampleApprovedJob], orders: [order], receipts: [receipt] },
    receipt.id,
    'admin@tatari.et'
  );

  assert.equal(next.receipts[0].status, 'verified');
  assert.equal(next.orders[0].status, 'approved');
  assert.equal(next.orders[0].paymentStatus, 'verified');
  assert.equal(canDownloadMaterial(next.orders[0]), true);

  const file = buildDownloadableMaterialFile(sampleProduct, next.orders[0], next.receipts[0]);
  assert.match(file.filename, /automated-ethiopian-payroll-model-v3\.0\.csv/);
  assert.match(file.content, /TB-774411/);
});

test('employer job posting remains hidden from public job board until admin approves payment receipt', () => {
  const { job, receipt } = createJobPostingWithPayment(
    {
      employerEmail: 'hr@sheger.et',
      titleEn: 'Senior React Engineer',
      companyName: 'Sheger Digital',
      location: 'Addis Ababa',
      remoteType: 'Hybrid',
      category: 'IT & Data',
      jobType: 'Full-time',
      experienceLevel: 'Senior',
      salaryMin: 45000,
      salaryMax: 60000,
      deadline: '2026-12-28',
      summaryEn: 'Build scalable React and Supabase web apps.',
      descriptionEn: 'Lead frontend architecture in React, TypeScript, and PostgreSQL.',
      requirements: ['React', 'TypeScript'],
      benefits: ['Remote stipend'],
      postingFeeEtb: 500,
    },
    {
      payerEmail: 'hr@sheger.et',
      payerName: 'Meron Tadesse',
      payerPhone: '+251911998877',
      paymentMethod: 'CBE Bank Transfer',
      transactionRef: 'CBE-998877',
    }
  );

  assert.equal(job.status, 'pending_approval');
  assert.equal(isJobPubliclyVisible(job), false);

  const beforeApprovalResults = filterJobs([sampleApprovedJob, job], {
    what: 'React',
    where: '',
    category: 'all',
    jobType: 'all',
    remoteType: 'all',
    minSalary: 0,
    postedWithinDays: 0,
  });
  assert.equal(beforeApprovalResults.length, 0);

  const afterApproval = adminApprovePaymentReceipt(
    { jobs: [sampleApprovedJob, job], orders: [], receipts: [receipt] },
    receipt.id,
    'admin@tatari.et'
  );

  assert.equal(isJobPubliclyVisible(afterApproval.jobs[1]), true);
  const afterApprovalResults = filterJobs(afterApproval.jobs, {
    what: 'React',
    where: 'Addis',
    category: 'all',
    jobType: 'all',
    remoteType: 'all',
    minSalary: 40000,
    postedWithinDays: 0,
  });
  assert.equal(afterApprovalResults.length, 1);
  assert.equal(afterApprovalResults[0].titleEn, 'Senior React Engineer');
});

test('admin rejection keeps download locked and records rejection reason', () => {
  const { order, receipt } = createMaterialOrderWithPayment(sampleProduct, {
    payerEmail: 'buyer@tatari.et',
    payerName: 'Hanna Bekele',
    payerPhone: '+251922334455',
    paymentMethod: 'Telebirr',
    transactionRef: 'TB-0000',
  });

  const rejected = adminRejectPaymentReceipt(
    { jobs: [], orders: [order], receipts: [receipt] },
    receipt.id,
    'admin@tatari.et',
    'Transaction ID not found in Telebirr statement.'
  );

  assert.equal(rejected.receipts[0].status, 'rejected');
  assert.equal(rejected.orders[0].status, 'rejected');
  assert.equal(rejected.orders[0].rejectionReason, 'Transaction ID not found in Telebirr statement.');
  assert.equal(canDownloadMaterial(rejected.orders[0]), false);
});

test('payment submission rejects invalid or missing transaction references', () => {
  assert.throws(
    () =>
      createMaterialOrderWithPayment(sampleProduct, {
        payerEmail: 'buyer@tatari.et',
        payerName: 'Hanna Bekele',
        payerPhone: '+251922334455',
        paymentMethod: 'Telebirr',
        transactionRef: '12',
      }),
    /transaction reference ID/i
  );
});
