import {
  SEED_APPLICATIONS,
  SEED_JOBS,
  SEED_LOGS,
  SEED_ORDERS,
  SEED_PRODUCTS,
  SEED_RECEIPTS,
  SEED_USERS,
} from '../data/seedData';
import { getSupabaseClient } from './supabaseClient';
import type {
  AuditLogEntry,
  DigitalProduct,
  JobApplication,
  JobListing,
  Language,
  MaterialOrder,
  PaymentReceipt,
  UserProfile,
} from '../types/domain';

const STORAGE_KEY = 'tatari_platform_state_v13';
const LEGACY_STORAGE_KEY = 'tatari_platform_state_v12';

export interface PlatformState {
  users: UserProfile[];
  currentUserEmail: string;
  language: Language;
  jobs: JobListing[];
  savedJobIdsByUser: Record<string, string[]>;
  applications: JobApplication[];
  products: DigitalProduct[];
  orders: MaterialOrder[];
  receipts: PaymentReceipt[];
  logs: AuditLogEntry[];
}

function normalizeProductImages(products: DigitalProduct[]): DigitalProduct[] {
  return products.map((p) =>
    p.imageUrl && p.imageUrl.startsWith('/src/assets/images/')
      ? { ...p, imageUrl: p.imageUrl.replace('/src/assets/images/', '/images/') }
      : p
  );
}

export function getInitialPlatformState(): PlatformState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PlatformState>;
      const users = (parsed.users?.length ? parsed.users : SEED_USERS).map((u) => {
        if (u.passwordHash) return u;
        const seeded = SEED_USERS.find((s) => s.email.toLowerCase() === u.email.toLowerCase());
        return seeded ? { ...u, passwordHash: seeded.passwordHash } : u;
      });
      const products = normalizeProductImages(
        parsed.products?.length ? parsed.products : SEED_PRODUCTS
      );
      return {
        users,
        currentUserEmail: parsed.currentUserEmail || '',
        language: parsed.language === 'am' ? 'am' : 'en',
        jobs: parsed.jobs?.length ? parsed.jobs : SEED_JOBS,
        savedJobIdsByUser:
          parsed.savedJobIdsByUser && typeof parsed.savedJobIdsByUser === 'object'
            ? parsed.savedJobIdsByUser
            : { 'abebe@tatari.et': ['job-103'] },
        applications: Array.isArray(parsed.applications) ? parsed.applications : SEED_APPLICATIONS,
        products,
        orders: Array.isArray(parsed.orders) ? parsed.orders : SEED_ORDERS,
        receipts: Array.isArray(parsed.receipts) ? parsed.receipts : SEED_RECEIPTS,
        logs: Array.isArray(parsed.logs) ? parsed.logs : SEED_LOGS,
      };
    }
  } catch {
    // Fall back cleanly to seed state if localStorage is malformed
  }

  return {
    users: SEED_USERS,
    currentUserEmail: '',
    language: 'en',
    jobs: SEED_JOBS,
    savedJobIdsByUser: { 'abebe@tatari.et': ['job-103'] },
    applications: SEED_APPLICATIONS,
    products: SEED_PRODUCTS,
    orders: SEED_ORDERS,
    receipts: SEED_RECEIPTS,
    logs: SEED_LOGS,
  };
}

export function persistPlatformState(state: PlatformState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

let remoteSchemaUpgraded = false;

function isValidUpgradedJobRow(row: Record<string, unknown>): boolean {
  const title = String(row.title_en || '').trim();
  const company = String(row.company_name || '').trim();
  const salaryDisplay = String(row.salary_display || '').trim();
  const status = String(row.status || '');
  const validStatuses = ['pending_approval', 'approved', 'rejected', 'paused'];
  return (
    'tier_id' in row &&
    'employer_email' in row &&
    title.length >= 3 &&
    company.length >= 2 &&
    salaryDisplay.length > 0 &&
    validStatuses.includes(status)
  );
}

function isValidUpgradedProductRow(row: Record<string, unknown>): boolean {
  const title = String(row.title_en || '').trim();
  const desc = String(row.description_en || '').trim();
  const price = Number(row.price_etb || 0);
  return (
    'title_en' in row &&
    title.length >= 3 &&
    desc.length >= 10 &&
    price > 0 &&
    typeof row.file_format === 'string'
  );
}

function isUpgradedReceiptRow(row: Record<string, unknown>): boolean {
  return 'invoice_number' in row && 'subtotal_etb' in row && 'vat_etb' in row;
}

export async function syncWithSupabaseIfAvailable(): Promise<{
  connected: boolean;
  jobs?: JobListing[];
  products?: DigitalProduct[];
  orders?: MaterialOrder[];
  receipts?: PaymentReceipt[];
  applications?: JobApplication[];
}> {
  const client = getSupabaseClient();
  if (!client) {
    remoteSchemaUpgraded = false;
    return { connected: false };
  }

  try {
    const [jobsRes, productsRes, ordersRes, receiptsRes, appsRes] = await Promise.all([
      client.from('career_jobs').select('*').limit(100),
      client.from('products').select('*').limit(100),
      client.from('material_orders').select('*').limit(100),
      client.from('payment_receipts').select('*').limit(100),
      client.from('job_applications').select('*').limit(100),
    ]);

    if (
      jobsRes.error ||
      productsRes.error ||
      ordersRes.error ||
      receiptsRes.error ||
      appsRes.error
    ) {
      remoteSchemaUpgraded = false;
      return { connected: false };
    }

    const rawJobs = (jobsRes.data || []) as Record<string, unknown>[];
    const rawProducts = (productsRes.data || []) as Record<string, unknown>[];
    const rawReceipts = (receiptsRes.data || []) as Record<string, unknown>[];

    // Detect if the remote DB still has pre-upgrade schema rows (e.g. UUID career_jobs or missing invoice_number)
    const hasLegacyJobs = rawJobs.some((r) => !('tier_id' in r) || !('employer_email' in r));
    const hasLegacyProducts = rawProducts.some((r) => !('title_en' in r));
    const hasLegacyReceipts = rawReceipts.some((r) => !isUpgradedReceiptRow(r));

    if (hasLegacyJobs || hasLegacyProducts || hasLegacyReceipts) {
      remoteSchemaUpgraded = false;
      return { connected: false };
    }

    remoteSchemaUpgraded = true;

    const validJobs: JobListing[] = rawJobs
      .filter((row) => isValidUpgradedJobRow(row))
      .map((row) => ({
        id: String(row.id),
        employerEmail: String(row.employer_email || ''),
        titleEn: String(row.title_en || ''),
        titleAm: row.title_am ? String(row.title_am) : undefined,
        companyName: String(row.company_name || ''),
        companyRating: Number(row.company_rating || 4.5),
        location: String(row.location || 'Addis Ababa'),
        remoteType: (row.remote_type as JobListing['remoteType']) || 'On-site',
        category: String(row.category || 'IT & Data'),
        jobType: (row.job_type as JobListing['jobType']) || 'Full-time',
        experienceLevel: String(row.experience_level || 'Mid-Level'),
        salaryMin: Number(row.salary_min || 0),
        salaryMax: Number(row.salary_max || 0),
        salaryDisplay: String(row.salary_display || 'Negotiable'),
        deadline: String(row.deadline || '2026-12-30'),
        summaryEn: String(row.summary_en || ''),
        descriptionEn: String(row.description_en || ''),
        descriptionAm: row.description_am ? String(row.description_am) : undefined,
        requirements: Array.isArray(row.requirements) ? row.requirements.map(String) : [],
        benefits: Array.isArray(row.benefits) ? row.benefits.map(String) : [],
        easyApply: Boolean(row.easy_apply ?? true),
        tierId: (row.tier_id as JobListing['tierId']) || 'standard',
        tierName: row.tier_name ? String(row.tier_name) : 'Standard Listing',
        isFeatured: Boolean(row.is_featured ?? false),
        postingFeeEtb: Number(row.posting_fee_etb || 500),
        paymentReceiptId: row.payment_receipt_id ? String(row.payment_receipt_id) : undefined,
        status: (row.status as JobListing['status']) || 'approved',
        rejectionReason: row.rejection_reason ? String(row.rejection_reason) : undefined,
        createdAt: String(row.created_at || new Date().toISOString()),
        publishedAt: row.published_at ? String(row.published_at) : undefined,
      }));

    const validProducts: DigitalProduct[] = normalizeProductImages(
      rawProducts
        .filter((row) => isValidUpgradedProductRow(row))
        .map((row) => ({
          id: String(row.id),
          sellerEmail: String(row.seller_email || 'admin@tatari.et'),
          titleEn: String(row.title_en || ''),
          titleAm: row.title_am ? String(row.title_am) : undefined,
          category: String(row.category || 'Payroll & HR'),
          priceEtb: Number(row.price_etb || 0),
          fileFormat: String(row.file_format || 'XLSX / PDF'),
          fileSize: String(row.file_size || '2.0 MB'),
          version: String(row.version || 'v1.0'),
          imageUrl: row.image_url ? String(row.image_url) : undefined,
          descriptionEn: String(row.description_en || ''),
          descriptionAm: row.description_am ? String(row.description_am) : undefined,
          includedFiles: Array.isArray(row.included_files) ? row.included_files.map(String) : [],
          active: Boolean(row.active ?? true),
          createdAt: String(row.created_at || new Date().toISOString()),
        }))
    );

    const validOrders: MaterialOrder[] = (ordersRes.data || []).map(
      (row: Record<string, unknown>) => ({
        id: String(row.id),
        productId: String(row.product_id || ''),
        productTitle: String(row.product_title || ''),
        buyerEmail: String(row.buyer_email || ''),
        buyerName: String(row.buyer_name || ''),
        subtotalEtb: row.subtotal_etb !== undefined ? Number(row.subtotal_etb) : undefined,
        discountEtb: row.discount_etb !== undefined ? Number(row.discount_etb) : undefined,
        vatEtb: row.vat_etb !== undefined ? Number(row.vat_etb) : undefined,
        promoCode: row.promo_code ? String(row.promo_code) : undefined,
        amountEtb: Number(row.amount_etb || 0),
        invoiceNumber: row.invoice_number ? String(row.invoice_number) : undefined,
        paymentReceiptId: String(row.payment_receipt_id || ''),
        paymentStatus:
          (row.payment_status as MaterialOrder['paymentStatus']) || 'pending_verification',
        status: (row.status as MaterialOrder['status']) || 'pending_approval',
        rejectionReason: row.rejection_reason ? String(row.rejection_reason) : undefined,
        createdAt: String(row.created_at || new Date().toISOString()),
        approvedAt: row.approved_at ? String(row.approved_at) : undefined,
      })
    );

    const validReceipts: PaymentReceipt[] = rawReceipts.map((row) => ({
      id: String(row.id),
      targetType: (row.target_type as PaymentReceipt['targetType']) || 'digital_material',
      targetId: String(row.target_id || ''),
      targetTitle: String(row.target_title || ''),
      payerEmail: String(row.payer_email || ''),
      payerName: String(row.payer_name || ''),
      payerPhone: String(row.payer_phone || ''),
      paymentMethod: (row.payment_method as PaymentReceipt['paymentMethod']) || 'Telebirr',
      transactionRef: String(row.transaction_ref || ''),
      subtotalEtb: row.subtotal_etb !== undefined ? Number(row.subtotal_etb) : undefined,
      discountEtb: row.discount_etb !== undefined ? Number(row.discount_etb) : undefined,
      vatEtb: row.vat_etb !== undefined ? Number(row.vat_etb) : undefined,
      promoCode: row.promo_code ? String(row.promo_code) : undefined,
      amountEtb: Number(row.amount_etb || 0),
      invoiceNumber: row.invoice_number ? String(row.invoice_number) : undefined,
      receiptNote: row.receipt_note ? String(row.receipt_note) : undefined,
      receiptImageData: row.receipt_image_data ? String(row.receipt_image_data) : undefined,
      status: (row.status as PaymentReceipt['status']) || 'pending_verification',
      reviewedBy: row.reviewed_by ? String(row.reviewed_by) : undefined,
      reviewedAt: row.reviewed_at ? String(row.reviewed_at) : undefined,
      rejectionReason: row.rejection_reason ? String(row.rejection_reason) : undefined,
      createdAt: String(row.created_at || new Date().toISOString()),
    }));

    const validApps: JobApplication[] = (appsRes.data || []).map(
      (row: Record<string, unknown>) => ({
        id: String(row.id),
        jobId: String(row.job_id || ''),
        jobTitle: String(row.job_title || ''),
        companyName: String(row.company_name || ''),
        applicantName: String(row.applicant_name || ''),
        applicantEmail: String(row.applicant_email || ''),
        phone: String(row.phone || ''),
        resumeUrl: String(row.resume_url || ''),
        coverNote: String(row.cover_note || ''),
        yearsExperience: String(row.years_experience || '1-3 years'),
        status: (row.status as JobApplication['status']) || 'Submitted',
        createdAt: String(row.created_at || new Date().toISOString()),
      })
    );

    return {
      connected: true,
      jobs: validJobs.length > 0 ? validJobs : undefined,
      products: validProducts.length > 0 ? validProducts : undefined,
      orders: validOrders.length > 0 ? validOrders : undefined,
      receipts: validReceipts.length > 0 ? validReceipts : undefined,
      applications: validApps.length > 0 ? validApps : undefined,
    };
  } catch {
    remoteSchemaUpgraded = false;
    return { connected: false };
  }
}

export async function pushReceiptAndAuditToSupabase(
  receipt: PaymentReceipt,
  log: AuditLogEntry
): Promise<void> {
  if (!remoteSchemaUpgraded) return;
  const client = getSupabaseClient();
  if (!client) return;

  try {
    await client.from('payment_receipts').upsert({
      id: receipt.id,
      target_type: receipt.targetType,
      target_id: receipt.targetId,
      target_title: receipt.targetTitle,
      payer_email: receipt.payerEmail,
      payer_name: receipt.payerName,
      payer_phone: receipt.payerPhone,
      payment_method: receipt.paymentMethod,
      transaction_ref: receipt.transactionRef,
      subtotal_etb: receipt.subtotalEtb ?? receipt.amountEtb,
      discount_etb: receipt.discountEtb ?? 0,
      vat_etb: receipt.vatEtb ?? 0,
      promo_code: receipt.promoCode ?? null,
      amount_etb: receipt.amountEtb,
      invoice_number: receipt.invoiceNumber ?? null,
      receipt_note: receipt.receiptNote ?? null,
      status: receipt.status,
      reviewed_by: receipt.reviewedBy ?? null,
      reviewed_at: receipt.reviewedAt ?? null,
      rejection_reason: receipt.rejectionReason ?? null,
    });

    await client.from('activity_logs').insert({
      id: log.id,
      user_email: log.userEmail,
      action_type: log.actionType,
      details: log.details,
    });
  } catch {
    // Non-blocking sync; local state remains authoritative if schema isn't provisioned yet
  }
}

export async function pushJobToSupabase(job: JobListing): Promise<void> {
  if (!remoteSchemaUpgraded) return;
  const client = getSupabaseClient();
  if (!client) return;

  try {
    await client.from('career_jobs').upsert({
      id: job.id,
      employer_email: job.employerEmail,
      title_en: job.titleEn,
      title_am: job.titleAm ?? null,
      company_name: job.companyName,
      company_rating: job.companyRating,
      location: job.location,
      remote_type: job.remoteType,
      category: job.category,
      job_type: job.jobType,
      experience_level: job.experienceLevel,
      salary_min: job.salaryMin,
      salary_max: job.salaryMax,
      salary_display: job.salaryDisplay,
      deadline: job.deadline,
      summary_en: job.summaryEn,
      description_en: job.descriptionEn,
      description_am: job.descriptionAm ?? null,
      requirements: job.requirements,
      benefits: job.benefits,
      easy_apply: job.easyApply,
      tier_id: job.tierId ?? 'standard',
      tier_name: job.tierName ?? 'Standard Listing',
      is_featured: Boolean(job.isFeatured),
      posting_fee_etb: job.postingFeeEtb,
      payment_receipt_id: job.paymentReceiptId ?? null,
      status: job.status,
      rejection_reason: job.rejectionReason ?? null,
      published_at: job.publishedAt ?? null,
    });
  } catch {
    // Non-blocking sync
  }
}

export async function pushOrderToSupabase(order: MaterialOrder): Promise<void> {
  if (!remoteSchemaUpgraded) return;
  const client = getSupabaseClient();
  if (!client) return;

  try {
    await client.from('material_orders').upsert({
      id: order.id,
      product_id: order.productId,
      product_title: order.productTitle,
      buyer_email: order.buyerEmail,
      buyer_name: order.buyerName,
      subtotal_etb: order.subtotalEtb ?? order.amountEtb,
      discount_etb: order.discountEtb ?? 0,
      vat_etb: order.vatEtb ?? 0,
      promo_code: order.promoCode ?? null,
      amount_etb: order.amountEtb,
      invoice_number: order.invoiceNumber ?? null,
      payment_receipt_id: order.paymentReceiptId,
      payment_status: order.paymentStatus,
      status: order.status,
      rejection_reason: order.rejectionReason ?? null,
      approved_at: order.approvedAt ?? null,
    });
  } catch {
    // Non-blocking sync
  }
}

export async function pushApplicationToSupabase(app: JobApplication): Promise<void> {
  if (!remoteSchemaUpgraded) return;
  const client = getSupabaseClient();
  if (!client) return;

  try {
    await client.from('job_applications').upsert({
      id: app.id,
      job_id: app.jobId,
      job_title: app.jobTitle,
      company_name: app.companyName,
      applicant_name: app.applicantName,
      applicant_email: app.applicantEmail,
      phone: app.phone,
      resume_url: app.resumeUrl,
      cover_note: app.coverNote,
      years_experience: app.yearsExperience,
      status: app.status,
    });
  } catch {
    // Non-blocking sync
  }
}

export async function pushProductToSupabase(product: DigitalProduct): Promise<void> {
  if (!remoteSchemaUpgraded) return;
  const client = getSupabaseClient();
  if (!client) return;

  try {
    await client.from('products').upsert({
      id: product.id,
      seller_email: product.sellerEmail,
      title_en: product.titleEn,
      title_am: product.titleAm ?? null,
      category: product.category,
      price_etb: product.priceEtb,
      file_format: product.fileFormat,
      file_size: product.fileSize,
      version: product.version,
      image_url: product.imageUrl ?? null,
      description_en: product.descriptionEn,
      description_am: product.descriptionAm ?? null,
      included_files: product.includedFiles,
      active: product.active,
    });
  } catch {
    // Non-blocking sync
  }
}

export async function pushUserProfileAndAuditToSupabase(
  user: UserProfile,
  log: AuditLogEntry
): Promise<void> {
  if (!remoteSchemaUpgraded) return;
  const client = getSupabaseClient();
  if (!client) return;

  try {
    await client.from('profiles').upsert(
      {
        email: user.email,
        full_name: user.fullName,
        company_name: user.companyName ?? null,
        tin_number: user.tinNumber ?? null,
        phone: user.phone ?? null,
        role: user.role,
        status: user.status,
        password_hash: user.passwordHash,
        last_login_at: user.lastLoginAt ?? null,
      },
      { onConflict: 'email' }
    );

    await client.from('activity_logs').insert({
      id: log.id,
      user_email: log.userEmail,
      action_type: log.actionType,
      details: log.details,
    });
  } catch {
    // Non-blocking sync; local state remains authoritative if schema isn't provisioned yet
  }
}
