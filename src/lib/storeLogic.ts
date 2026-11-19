import type {
  DigitalProduct,
  JobFilterCriteria,
  JobListing,
  JobPostingTier,
  JobType,
  MaterialOrder,
  PaymentMethod,
  PaymentReceipt,
  ProductFilterCriteria,
  RemoteType,
} from '../types/domain';

export interface JobPostingPackage {
  id: JobPostingTier;
  name: string;
  priceEtb: number;
  durationDays: number;
  isFeatured: boolean;
  summary: string;
}

export const JOB_POSTING_PACKAGES: JobPostingPackage[] = [
  {
    id: 'standard',
    name: 'Standard Listing',
    priceEtb: 500,
    durationDays: 30,
    isFeatured: false,
    summary: '30-day verified listing on the Job Board with Easy Apply pipeline.',
  },
  {
    id: 'featured',
    name: 'Featured Sponsored',
    priceEtb: 1200,
    durationDays: 45,
    isFeatured: true,
    summary: '45-day Sponsored priority placement above standard search results.',
  },
  {
    id: 'enterprise',
    name: 'Hiring Pro Priority',
    priceEtb: 2500,
    durationDays: 60,
    isFeatured: true,
    summary: '60-day top Sponsored placement + bilingual highlight & executive reach.',
  },
];

export const ETHIOPIA_VAT_RATE = 0.15;

export const PROMO_DISCOUNTS: Record<string, number> = {
  TATARI10: 0.1,
  CORP15: 0.15,
  LAUNCH20: 0.2,
};

export interface CommercialPricingBreakdown {
  subtotalEtb: number;
  discountEtb: number;
  netBeforeVatEtb: number;
  vatEtb: number;
  totalEtb: number;
  appliedPromoCode?: string;
  promoPercent: number;
  promoError?: string;
}

export function calculateCommercialPricing(
  baseEtb: number,
  promoCode?: string,
  applyVat: boolean = true
): CommercialPricingBreakdown {
  const subtotalEtb = Math.max(0, Math.round(Number(baseEtb || 0)));
  const cleanCode = (promoCode || '').trim().toUpperCase();
  const promoRate = cleanCode ? PROMO_DISCOUNTS[cleanCode] || 0 : 0;

  const discountEtb = promoRate > 0 ? Math.round(subtotalEtb * promoRate) : 0;
  const netBeforeVatEtb = Math.max(0, subtotalEtb - discountEtb);
  const vatEtb = applyVat ? Math.round(netBeforeVatEtb * ETHIOPIA_VAT_RATE) : 0;
  const totalEtb = netBeforeVatEtb + vatEtb;

  return {
    subtotalEtb,
    discountEtb,
    netBeforeVatEtb,
    vatEtb,
    totalEtb,
    appliedPromoCode: promoRate > 0 ? cleanCode : undefined,
    promoPercent: Math.round(promoRate * 100),
    promoError:
      cleanCode && promoRate === 0
        ? `Promo code "${cleanCode}" is invalid. Try TATARI10 or LAUNCH20.`
        : undefined,
  };
}

export function isDuplicateTransactionRef(
  receipts: PaymentReceipt[],
  transactionRef: string
): boolean {
  const normalized = transactionRef.trim().toUpperCase();
  if (!normalized) return false;
  return receipts.some(
    (r) => r.status !== 'rejected' && r.transactionRef.trim().toUpperCase() === normalized
  );
}

export function isJobPubliclyVisible(job: JobListing): boolean {
  return job.status === 'approved';
}

export function canDownloadMaterial(order: MaterialOrder | undefined): boolean {
  if (!order) return false;
  return order.status === 'approved' && order.paymentStatus === 'verified';
}

export function formatCurrencyEtb(amount: number): string {
  return `ETB ${Math.round(Number(amount || 0)).toLocaleString('en-US')}`;
}

export function formatRelativeDays(isoDate: string, nowMs: number = Date.now()): string {
  const createdMs = new Date(isoDate).getTime();
  if (Number.isNaN(createdMs)) return 'Recently';
  const diffDays = Math.max(0, Math.floor((nowMs - createdMs) / (1000 * 60 * 60 * 24)));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;
  const months = Math.floor(diffDays / 30);
  return months === 1 ? '1 month ago' : `${months} months ago`;
}

export function filterJobs(
  jobs: JobListing[],
  criteria: JobFilterCriteria,
  nowMs: number = Date.now(),
  includeUnpublished: boolean = false
): JobListing[] {
  const what = criteria.what.trim().toLowerCase();
  const where = criteria.where.trim().toLowerCase();

  const filtered = jobs.filter((job) => {
    if (!includeUnpublished && !isJobPubliclyVisible(job)) {
      return false;
    }

    if (what) {
      const searchable = [
        job.titleEn,
        job.titleAm ?? '',
        job.companyName,
        job.category,
        job.summaryEn,
        job.descriptionEn,
        ...job.requirements,
      ]
        .join(' ')
        .toLowerCase();
      if (!searchable.includes(what)) {
        return false;
      }
    }

    if (where) {
      const locMatch = `${job.location} ${job.remoteType}`.toLowerCase();
      if (!locMatch.includes(where)) {
        return false;
      }
    }

    if (criteria.category !== 'all' && job.category !== criteria.category) {
      return false;
    }

    if (criteria.jobType !== 'all' && job.jobType !== criteria.jobType) {
      return false;
    }

    if (criteria.remoteType !== 'all' && job.remoteType !== criteria.remoteType) {
      return false;
    }

    if (criteria.minSalary > 0 && Math.max(job.salaryMin, job.salaryMax) < criteria.minSalary) {
      return false;
    }

    if (criteria.postedWithinDays > 0) {
      const ageMs = nowMs - new Date(job.publishedAt || job.createdAt).getTime();
      const maxAgeMs = criteria.postedWithinDays * 24 * 60 * 60 * 1000;
      if (ageMs > maxAgeMs) {
        return false;
      }
    }

    return true;
  });

  // Sponsored / Featured jobs stay prioritized cleanly above standard roles, newest first
  return [...filtered].sort((a, b) => {
    const featDiff = Number(Boolean(b.isFeatured)) - Number(Boolean(a.isFeatured));
    if (featDiff !== 0) return featDiff;
    const bTime = new Date(b.publishedAt || b.createdAt).getTime() || 0;
    const aTime = new Date(a.publishedAt || a.createdAt).getTime() || 0;
    return bTime - aTime;
  });
}

export function filterProducts(
  products: DigitalProduct[],
  criteria: ProductFilterCriteria
): DigitalProduct[] {
  const query = criteria.query.trim().toLowerCase();
  return products.filter((product) => {
    if (!product.active) return false;
    if (query) {
      const text = [
        product.titleEn,
        product.titleAm ?? '',
        product.category,
        product.descriptionEn,
        product.fileFormat,
      ]
        .join(' ')
        .toLowerCase();
      if (!text.includes(query)) return false;
    }
    if (criteria.category !== 'all' && product.category !== criteria.category) {
      return false;
    }
    if (criteria.maxPrice > 0 && product.priceEtb > criteria.maxPrice) {
      return false;
    }
    return true;
  });
}

export interface PaymentSubmissionInput {
  payerEmail: string;
  payerName: string;
  payerPhone: string;
  paymentMethod: PaymentMethod;
  transactionRef: string;
  promoCode?: string;
  applyVat?: boolean;
  receiptNote?: string;
  receiptImageData?: string;
}

export interface JobDraftInput {
  employerEmail: string;
  titleEn: string;
  titleAm?: string;
  companyName: string;
  location: string;
  remoteType: RemoteType;
  category: string;
  jobType: JobType;
  experienceLevel: string;
  salaryMin: number;
  salaryMax: number;
  deadline: string;
  summaryEn: string;
  descriptionEn: string;
  requirements: string[];
  benefits: string[];
  tierId?: JobPostingTier;
  tierName?: string;
  isFeatured?: boolean;
  postingFeeEtb: number;
}

export function validatePaymentSubmission(input: PaymentSubmissionInput): string | null {
  if (!input.payerEmail.trim() || !input.payerEmail.includes('@')) {
    return 'A valid payer email address is required.';
  }
  if (input.payerName.trim().length < 2) {
    return 'Payer full name is required.';
  }
  if (input.payerPhone.trim().length < 6) {
    return 'A valid phone number or account number is required.';
  }
  if (input.transactionRef.trim().length < 4) {
    return 'Please enter the payment transaction reference ID (at least 4 characters).';
  }
  return null;
}

export function validateJobDraft(draft: JobDraftInput): string | null {
  if (draft.titleEn.trim().length < 3) return 'Job title must be at least 3 characters.';
  if (draft.companyName.trim().length < 2) return 'Company name is required.';
  if (draft.location.trim().length < 2) return 'Job location is required.';
  if (draft.salaryMin < 0 || draft.salaryMax < draft.salaryMin) {
    return 'Maximum salary must be greater than or equal to minimum salary.';
  }
  if (!draft.deadline) return 'Application deadline date is required.';
  if (draft.descriptionEn.trim().length < 15) {
    return 'Please provide a clear job description (at least 15 characters).';
  }
  return null;
}

export function createJobPostingWithPayment(
  draft: JobDraftInput,
  payment: PaymentSubmissionInput,
  nowIso: string = new Date().toISOString()
): { job: JobListing; receipt: PaymentReceipt } {
  const jobErr = validateJobDraft(draft);
  if (jobErr) throw new Error(jobErr);
  const payErr = validatePaymentSubmission(payment);
  if (payErr) throw new Error(payErr);

  const uid = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const jobId = `job-${uid}`;
  const receiptId = `rcpt-${uid}`;
  const pricing = calculateCommercialPricing(
    draft.postingFeeEtb,
    payment.promoCode,
    payment.applyVat ?? true
  );

  const pkg = JOB_POSTING_PACKAGES.find((p) => p.id === (draft.tierId || 'standard'));

  const salaryDisplay =
    draft.salaryMax > draft.salaryMin
      ? `${draft.salaryMin.toLocaleString('en-US')} – ${draft.salaryMax.toLocaleString('en-US')} ETB/mo`
      : `${draft.salaryMin.toLocaleString('en-US')} ETB/mo`;

  const job: JobListing = {
    id: jobId,
    employerEmail: draft.employerEmail.trim().toLowerCase(),
    titleEn: draft.titleEn.trim(),
    titleAm: draft.titleAm?.trim(),
    companyName: draft.companyName.trim(),
    companyRating: 4.6,
    location: draft.location.trim(),
    remoteType: draft.remoteType,
    category: draft.category,
    jobType: draft.jobType,
    experienceLevel: draft.experienceLevel,
    salaryMin: draft.salaryMin,
    salaryMax: draft.salaryMax,
    salaryDisplay,
    deadline: draft.deadline,
    summaryEn: draft.summaryEn.trim() || draft.descriptionEn.trim().slice(0, 140),
    descriptionEn: draft.descriptionEn.trim(),
    requirements: draft.requirements.filter((r) => r.trim().length > 0),
    benefits: draft.benefits.filter((b) => b.trim().length > 0),
    easyApply: true,
    tierId: draft.tierId || pkg?.id || 'standard',
    tierName: draft.tierName || pkg?.name || 'Standard Listing',
    isFeatured: draft.isFeatured ?? pkg?.isFeatured ?? false,
    postingFeeEtb: pricing.totalEtb,
    paymentReceiptId: receiptId,
    status: 'pending_approval',
    createdAt: nowIso,
  };

  const receipt: PaymentReceipt = {
    id: receiptId,
    targetType: 'job_post',
    targetId: jobId,
    targetTitle: `${job.titleEn} (${job.companyName})`,
    payerEmail: payment.payerEmail.trim().toLowerCase(),
    payerName: payment.payerName.trim(),
    payerPhone: payment.payerPhone.trim(),
    paymentMethod: payment.paymentMethod,
    transactionRef: payment.transactionRef.trim(),
    subtotalEtb: pricing.subtotalEtb,
    discountEtb: pricing.discountEtb,
    vatEtb: pricing.vatEtb,
    promoCode: pricing.appliedPromoCode,
    amountEtb: pricing.totalEtb,
    receiptNote: payment.receiptNote?.trim(),
    receiptImageData: payment.receiptImageData,
    status: 'pending_verification',
    createdAt: nowIso,
  };

  return { job, receipt };
}

export function createMaterialOrderWithPayment(
  product: DigitalProduct,
  payment: PaymentSubmissionInput,
  nowIso: string = new Date().toISOString()
): { order: MaterialOrder; receipt: PaymentReceipt } {
  const payErr = validatePaymentSubmission(payment);
  if (payErr) throw new Error(payErr);

  const uid = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const orderId = `ord-${uid}`;
  const receiptId = `rcpt-${uid}`;
  const pricing = calculateCommercialPricing(
    product.priceEtb,
    payment.promoCode,
    payment.applyVat ?? true
  );

  const order: MaterialOrder = {
    id: orderId,
    productId: product.id,
    productTitle: product.titleEn,
    buyerEmail: payment.payerEmail.trim().toLowerCase(),
    buyerName: payment.payerName.trim(),
    subtotalEtb: pricing.subtotalEtb,
    discountEtb: pricing.discountEtb,
    vatEtb: pricing.vatEtb,
    promoCode: pricing.appliedPromoCode,
    amountEtb: pricing.totalEtb,
    paymentReceiptId: receiptId,
    paymentStatus: 'pending_verification',
    status: 'pending_approval',
    createdAt: nowIso,
  };

  const receipt: PaymentReceipt = {
    id: receiptId,
    targetType: 'digital_material',
    targetId: orderId,
    targetTitle: product.titleEn,
    payerEmail: payment.payerEmail.trim().toLowerCase(),
    payerName: payment.payerName.trim(),
    payerPhone: payment.payerPhone.trim(),
    paymentMethod: payment.paymentMethod,
    transactionRef: payment.transactionRef.trim(),
    subtotalEtb: pricing.subtotalEtb,
    discountEtb: pricing.discountEtb,
    vatEtb: pricing.vatEtb,
    promoCode: pricing.appliedPromoCode,
    amountEtb: pricing.totalEtb,
    receiptNote: payment.receiptNote?.trim(),
    receiptImageData: payment.receiptImageData,
    status: 'pending_verification',
    createdAt: nowIso,
  };

  return { order, receipt };
}

export interface ApprovalState {
  jobs: JobListing[];
  orders: MaterialOrder[];
  receipts: PaymentReceipt[];
}

export function adminApprovePaymentReceipt(
  state: ApprovalState,
  receiptId: string,
  adminEmail: string,
  nowIso: string = new Date().toISOString()
): ApprovalState {
  const targetReceipt = state.receipts.find((r) => r.id === receiptId);
  if (!targetReceipt) return state;

  const year = nowIso.slice(0, 4) || '2026';
  const suffix = targetReceipt.transactionRef
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(-6)
    .padStart(6, '0');
  const invoiceNumber = targetReceipt.invoiceNumber || `INV-${year}-${suffix}`;

  const receipts = state.receipts.map((r) =>
    r.id === receiptId
      ? {
          ...r,
          invoiceNumber,
          status: 'verified' as const,
          reviewedBy: adminEmail,
          reviewedAt: nowIso,
          rejectionReason: undefined,
        }
      : r
  );

  const jobs =
    targetReceipt.targetType === 'job_post'
      ? state.jobs.map((j) =>
          j.id === targetReceipt.targetId || j.paymentReceiptId === receiptId
            ? {
                ...j,
                status: 'approved' as const,
                publishedAt: nowIso,
                rejectionReason: undefined,
              }
            : j
        )
      : state.jobs;

  const orders =
    targetReceipt.targetType === 'digital_material'
      ? state.orders.map((o) =>
          o.id === targetReceipt.targetId || o.paymentReceiptId === receiptId
            ? {
                ...o,
                invoiceNumber,
                paymentStatus: 'verified' as const,
                status: 'approved' as const,
                approvedAt: nowIso,
                rejectionReason: undefined,
              }
            : o
        )
      : state.orders;

  return { jobs, orders, receipts };
}

export function adminRejectPaymentReceipt(
  state: ApprovalState,
  receiptId: string,
  adminEmail: string,
  reason: string,
  nowIso: string = new Date().toISOString()
): ApprovalState {
  const cleanReason = reason.trim() || 'Payment reference could not be verified.';
  const targetReceipt = state.receipts.find((r) => r.id === receiptId);
  if (!targetReceipt) return state;

  const receipts = state.receipts.map((r) =>
    r.id === receiptId
      ? {
          ...r,
          status: 'rejected' as const,
          reviewedBy: adminEmail,
          reviewedAt: nowIso,
          rejectionReason: cleanReason,
        }
      : r
  );

  const jobs =
    targetReceipt.targetType === 'job_post'
      ? state.jobs.map((j) =>
          j.id === targetReceipt.targetId || j.paymentReceiptId === receiptId
            ? {
                ...j,
                status: 'rejected' as const,
                rejectionReason: cleanReason,
              }
            : j
        )
      : state.jobs;

  const orders =
    targetReceipt.targetType === 'digital_material'
      ? state.orders.map((o) =>
          o.id === targetReceipt.targetId || o.paymentReceiptId === receiptId
            ? {
                ...o,
                paymentStatus: 'rejected' as const,
                status: 'rejected' as const,
                rejectionReason: cleanReason,
              }
            : o
        )
      : state.orders;

  return { jobs, orders, receipts };
}

export function buildDownloadableMaterialFile(
  product: DigitalProduct,
  order: MaterialOrder,
  receipt?: PaymentReceipt
): { filename: string; mimeType: string; content: string } {
  const slug = product.titleEn
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const isSpreadsheet =
    product.fileFormat.toLowerCase().includes('xlsx') ||
    product.category === 'Payroll & HR' ||
    product.category === 'Financial Models';

  if (isSpreadsheet) {
    const csvLines = [
      `"TATARI CERTIFIED DIGITAL MATERIAL — LICENSED EDITION"`,
      `"Product","${product.titleEn.replace(/"/g, '""')}"`,
      `"Version","${product.version}"`,
      `"Order ID","${order.id}"`,
      `"Invoice Number","${order.invoiceNumber || receipt?.invoiceNumber || 'VERIFIED'}"`,
      `"Licensed Buyer","${order.buyerName} (${order.buyerEmail})"`,
      `"Verified Payment Ref","${receipt?.transactionRef ?? 'ADMIN-VERIFIED'}"`,
      `"Total Paid (incl. VAT)","ETB ${order.amountEtb}"`,
      `"Approved At","${order.approvedAt ?? new Date().toISOString()}"`,
      ``,
      `"=== SAMPLE ETHIOPIAN PAYROLL & KPI WORKSHEET MODEL ==="`,
      `"Employee ID","Full Name","Department","Gross Salary (ETB)","Taxable Income (ETB)","Income Tax (ETB)","Employee Pension 7%","Employer Pension 11%","Net Pay (ETB)"`,
      `"EMP-001","Abebe Bikila","Operations",28000,28000,6455,1960,3080,19585`,
      `"EMP-002","Meron Tadesse","Human Resources",35000,35000,8905,2450,3850,23645`,
      `"EMP-003","Dawit Mekonnen","Finance & BI",42000,42000,11355,2940,4620,27705`,
      ``,
      `"Included Package Files","${product.includedFiles.join(' | ').replace(/"/g, '""')}"`,
    ];
    return {
      filename: `${slug}-${product.version}.csv`,
      mimeType: 'text/csv;charset=utf-8;',
      content: csvLines.join('\n'),
    };
  }

  const htmlDoc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${product.titleEn} — TATARI Certified Edition</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; max-width: 820px; margin: 40px auto; color: #111827; line-height: 1.6; padding: 0 24px; }
  h1 { color: #10243b; border-bottom: 2px solid #15a99a; padding-bottom: 12px; }
  .meta { background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; font-size: 14px; margin-bottom: 24px; }
  h2 { color: #164081; margin-top: 28px; }
  ul { padding-left: 20px; }
</style>
</head>
<body>
  <h1>${product.titleEn}</h1>
  <div class="meta">
    <strong>License Holder:</strong> ${order.buyerName} (${order.buyerEmail})<br/>
    <strong>Order ID:</strong> ${order.id} &nbsp;|&nbsp; <strong>Invoice:</strong> ${order.invoiceNumber || receipt?.invoiceNumber || 'VERIFIED'} &nbsp;|&nbsp; <strong>Payment Ref:</strong> ${receipt?.transactionRef ?? 'VERIFIED'}<br/>
    <strong>Format &amp; Version:</strong> ${product.fileFormat} (${product.version}) &nbsp;|&nbsp; <strong>Status:</strong> Administrator Approved
  </div>
  <h2>Overview</h2>
  <p>${product.descriptionEn}</p>
  <h2>Included Deliverables &amp; Clauses</h2>
  <ul>
    ${product.includedFiles.map((f) => `<li>${f}</li>`).join('\n    ')}
  </ul>
  <h2>Implementation Checklist</h2>
  <ol>
    <li>Review the organization-specific parameters and update the header block with your company TIN and legal entity name.</li>
    <li>Verify statutory Ethiopian Labor Proclamation No. 1156/2019 alignment or KPI targets prior to rollout.</li>
    <li>Distribute digitally or print signed copies for internal compliance records.</li>
  </ol>
</body>
</html>`;

  return {
    filename: `${slug}-${product.version}.html`,
    mimeType: 'text/html;charset=utf-8;',
    content: htmlDoc,
  };
}

export function buildOfficialInvoiceHtml(
  receipt: PaymentReceipt,
  customerLabel?: string
): { filename: string; mimeType: string; content: string } {
  const invoiceNo =
    receipt.invoiceNumber ||
    `INV-${receipt.createdAt.slice(0, 4)}-${receipt.transactionRef.replace(/[^A-Za-z0-9]/g, '').slice(-6)}`;
  const subtotal = receipt.subtotalEtb ?? receipt.amountEtb;
  const discount = receipt.discountEtb ?? 0;
  const vat = receipt.vatEtb ?? 0;
  const issuedDate = (receipt.reviewedAt || receipt.createdAt).slice(0, 10);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${invoiceNo} — TATARI Official Payment Receipt</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; max-width: 760px; margin: 36px auto; color: #0f172a; padding: 0 24px; }
  .header { display: flex; justify-content: space-between; border-bottom: 2px solid #164081; padding-bottom: 16px; }
  .brand { font-size: 22px; font-weight: 800; color: #10243B; }
  .sub { font-size: 12px; color: #475569; margin-top: 4px; }
  .badge { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; height: fit-content; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0; font-size: 13px; }
  .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
  th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 8px; text-align: left; }
  th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; color: #475569; }
  .right { text-align: right; font-family: ui-monospace, monospace; }
  .total-row td { font-weight: 800; font-size: 15px; border-top: 2px solid #0f172a; }
  .footer { margin-top: 32px; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 12px; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">TATARI CONSULTING PLC</div>
      <div class="sub">TIN: 0011223344 · Bole Sub-City, Addis Ababa, Ethiopia · support@tatari.et</div>
    </div>
    <div class="badge">VERIFIED PAYMENT RECEIPT</div>
  </div>

  <div class="grid">
    <div class="box">
      <strong>Billed To:</strong><br/>
      ${customerLabel || receipt.payerName}<br/>
      ${receipt.payerEmail}<br/>
      ${receipt.payerPhone}
    </div>
    <div class="box">
      <strong>Invoice No:</strong> ${invoiceNo}<br/>
      <strong>Issued Date:</strong> ${issuedDate}<br/>
      <strong>Method:</strong> ${receipt.paymentMethod}<br/>
      <strong>Bank/TXN Ref:</strong> ${receipt.transactionRef}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Category</th>
        <th class="right">Amount (ETB)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${receipt.targetTitle}</td>
        <td>${receipt.targetType === 'job_post' ? 'Job Vacancy Listing' : 'Licensed Digital Material'}</td>
        <td class="right">${subtotal.toLocaleString('en-US')}</td>
      </tr>
      ${
        discount > 0
          ? `<tr><td>Promotional Discount (${receipt.promoCode || 'PROMO'})</td><td>Promo Applied</td><td class="right">-${discount.toLocaleString('en-US')}</td></tr>`
          : ''
      }
      ${
        vat > 0
          ? `<tr><td>Value Added Tax (VAT 15%)</td><td>Statutory Tax</td><td class="right">${vat.toLocaleString('en-US')}</td></tr>`
          : ''
      }
      <tr class="total-row">
        <td colspan="2">Total Paid &amp; Verified (ETB)</td>
        <td class="right">ETB ${receipt.amountEtb.toLocaleString('en-US')}</td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    Approved by: ${receipt.reviewedBy || 'admin@tatari.et'} · Verified at: ${receipt.reviewedAt || issuedDate}.<br/>
    This is an electronically verified commercial receipt generated by TATARI Job Portal &amp; Digital Store.
  </div>
</body>
</html>`;

  return {
    filename: `${invoiceNo.toLowerCase()}.html`,
    mimeType: 'text/html;charset=utf-8;',
    content: html,
  };
}

