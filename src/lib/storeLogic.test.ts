import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adminApprovePaymentReceipt,
  adminRejectPaymentReceipt,
  buildDownloadableMaterialFile,
  buildOfficialInvoiceHtml,
  calculateCommercialPricing,
  canDownloadMaterial,
  createJobPostingWithPayment,
  createMaterialOrderWithPayment,
  deleteDigitalProduct,
  deleteEmployerJobListing,
  filterJobs,
  filterProducts,
  getProductRatingSummary,
  isDuplicateTransactionRef,
  isJobPubliclyVisible,
  updateDigitalProduct,
  updateEmployerJobListing,
  upsertProductReview,
} from './storeLogic';
import { SEED_USERS } from '../data/seedData';
import type { DigitalProduct, JobListing } from '../types/domain';

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

test('material download stays locked until admin approves payment receipt and generates official invoice', () => {
  const { order, receipt } = createMaterialOrderWithPayment(sampleProduct, {
    payerEmail: 'abebe@tatari.et',
    payerName: 'Abebe Bikila',
    payerPhone: '+251911223344',
    paymentMethod: 'Telebirr',
    transactionRef: 'TB-774411',
    promoCode: 'TATARI10',
  });

  // 1500 - 10% (150) = 1350 + 15% VAT (203) = 1553 ETB
  assert.equal(order.subtotalEtb, 1500);
  assert.equal(order.discountEtb, 150);
  assert.equal(order.vatEtb, 203);
  assert.equal(order.amountEtb, 1553);
  assert.equal(order.promoCode, 'TATARI10');
  assert.equal(order.status, 'pending_approval');
  assert.equal(order.paymentStatus, 'pending_verification');
  assert.equal(canDownloadMaterial(order), false);

  const next = adminApprovePaymentReceipt(
    { jobs: [sampleApprovedJob], orders: [order], receipts: [receipt] },
    receipt.id,
    'admin@tatari.et'
  );

  assert.equal(next.receipts[0].status, 'verified');
  assert.ok(next.receipts[0].invoiceNumber?.startsWith('INV-'));
  assert.equal(next.orders[0].status, 'approved');
  assert.equal(next.orders[0].paymentStatus, 'verified');
  assert.equal(canDownloadMaterial(next.orders[0]), true);

  const file = buildDownloadableMaterialFile(sampleProduct, next.orders[0], next.receipts[0]);
  assert.match(file.filename, /automated-ethiopian-payroll-model-v3\.0\.csv/);
  assert.match(file.content, /TB-774411/);

  const invoice = buildOfficialInvoiceHtml(next.receipts[0]);
  assert.match(invoice.filename, /^inv-/);
  assert.match(invoice.content, /TATARI10/);
  assert.match(invoice.content, /VAT 15%/);
});

test('employer job posting remains hidden from public job board until admin approves payment receipt and sorts featured first', () => {
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
      tierId: 'featured',
      tierName: 'Featured Sponsored',
      isFeatured: true,
      postingFeeEtb: 1200,
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
  assert.equal(job.isFeatured, true);
  assert.equal(job.postingFeeEtb, 1380); // 1200 + 15% VAT
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
  const allApproved = filterJobs(afterApproval.jobs, {
    what: '',
    where: '',
    category: 'all',
    jobType: 'all',
    remoteType: 'all',
    minSalary: 0,
    postedWithinDays: 0,
  });
  assert.equal(allApproved[0].id, job.id);
});

test('admin rejection keeps download locked, records reason, and allows resubmission with same or new ref', () => {
  const { order, receipt } = createMaterialOrderWithPayment(sampleProduct, {
    payerEmail: 'buyer@tatari.et',
    payerName: 'Hanna Bekele',
    payerPhone: '+251922334455',
    paymentMethod: 'Telebirr',
    transactionRef: 'TB-0000',
  });

  // Pending receipt blocks duplicate TXN replay
  assert.equal(isDuplicateTransactionRef([receipt], 'tb-0000'), true);

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
  // Once rejected, reference is no longer marked active/verified
  assert.equal(isDuplicateTransactionRef(rejected.receipts, 'TB-0000'), false);
});

test('commercial pricing calculator validates promo codes and 15% VAT accurately', () => {
  const valid = calculateCommercialPricing(1000, 'LAUNCH20', true);
  assert.equal(valid.discountEtb, 200);
  assert.equal(valid.netBeforeVatEtb, 800);
  assert.equal(valid.vatEtb, 120);
  assert.equal(valid.totalEtb, 920);
  assert.equal(valid.promoError, undefined);

  const invalid = calculateCommercialPricing(1000, 'BADCODE', true);
  assert.equal(invalid.discountEtb, 0);
  assert.equal(invalid.totalEtb, 1150);
  assert.match(invalid.promoError || '', /invalid/i);
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

test('digital store sorting, verified buyer reviews, and admin product CRUD enforce authorization', () => {
  const admin = SEED_USERS.find((u) => u.email === 'admin@tatari.et')!;
  const abebe = SEED_USERS.find((u) => u.email === 'abebe@tatari.et')!;
  const prod2: DigitalProduct = {
    ...sampleProduct,
    id: 'prod-2',
    titleEn: 'Career Resume Pack',
    priceEtb: 450,
    createdAt: '2026-11-10T10:00:00.000Z',
  };

  // Price sorting
  const asc = filterProducts([sampleProduct, prod2], {
    query: '',
    category: 'all',
    maxPrice: 0,
    sortBy: 'price_asc',
  });
  assert.equal(asc[0].id, 'prod-2');

  // Unverified user cannot post review
  assert.throws(
    () =>
      upsertProductReview([], [], abebe, {
        productId: sampleProduct.id,
        rating: 5,
        comment: 'Great workbook!',
      }),
    /verified buyers/i
  );

  // Create & approve order -> buyer can review
  const { order, receipt } = createMaterialOrderWithPayment(sampleProduct, {
    payerEmail: abebe.email,
    payerName: abebe.fullName,
    payerPhone: '+251911556677',
    paymentMethod: 'Telebirr',
    transactionRef: 'TB-REVIEW-01',
  });
  const approved = adminApprovePaymentReceipt(
    { jobs: [], orders: [order], receipts: [receipt] },
    receipt.id,
    admin.email
  );
  const reviews = upsertProductReview([], approved.orders, abebe, {
    productId: sampleProduct.id,
    rating: 5,
    comment: 'Saved hours on monthly payroll.',
  });
  assert.equal(getProductRatingSummary(reviews, sampleProduct.id).average, 5);
  assert.equal(getProductRatingSummary(reviews, sampleProduct.id).count, 1);

  const topRated = filterProducts([prod2, sampleProduct], {
    query: '',
    category: 'all',
    maxPrice: 0,
    sortBy: 'top_rated',
  }, reviews);
  assert.equal(topRated[0].id, sampleProduct.id);

  // Non-admin cannot update or delete products
  assert.throws(() =>
    updateDigitalProduct([sampleProduct], abebe, sampleProduct.id, { priceEtb: 900 })
  );
  assert.throws(() => deleteDigitalProduct([sampleProduct], abebe, sampleProduct.id));

  const edited = updateDigitalProduct([sampleProduct], admin, sampleProduct.id, {
    titleEn: 'Automated Ethiopian Payroll Model Pro',
    priceEtb: 1850,
  });
  assert.equal(edited[0].priceEtb, 1850);
  const removed = deleteDigitalProduct(edited, admin, sampleProduct.id);
  assert.equal(removed.length, 0);
});

test('employer job edit and delete restrict access to listing owner or admin', () => {
  const employer = SEED_USERS.find((u) => u.email === 'hr@addistech.et')!;
  const seeker = SEED_USERS.find((u) => u.email === 'abebe@tatari.et')!;

  assert.throws(() =>
    updateEmployerJobListing([sampleApprovedJob], seeker, sampleApprovedJob.id, {
      titleEn: 'Hijacked Title',
      location: 'Addis Ababa',
      salaryMin: 10000,
      salaryMax: 20000,
      deadline: '2026-12-30',
      descriptionEn: 'Updated job description text here.',
    })
  );

  const editedJobs = updateEmployerJobListing([sampleApprovedJob], employer, sampleApprovedJob.id, {
    titleEn: 'Lead Payroll & HR Systems Officer',
    location: 'Bole, Addis Ababa',
    salaryMin: 32000,
    salaryMax: 40000,
    deadline: '2026-12-31',
    descriptionEn: 'Lead monthly payroll automation and compliance reporting across departments.',
  });
  assert.equal(editedJobs[0].titleEn, 'Lead Payroll & HR Systems Officer');
  assert.equal(editedJobs[0].salaryDisplay, '32,000 – 40,000 ETB/mo');

  assert.throws(() => deleteEmployerJobListing(editedJobs, seeker, sampleApprovedJob.id));
  const afterDelete = deleteEmployerJobListing(editedJobs, employer, sampleApprovedJob.id);
  assert.equal(afterDelete.length, 0);
});
