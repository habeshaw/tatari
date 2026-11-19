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

const STORAGE_KEY = 'tatari_platform_state_v11';

export interface PlatformState {
  users: UserProfile[];
  currentUserEmail: string;
  language: Language;
  jobs: JobListing[];
  savedJobIds: string[];
  applications: JobApplication[];
  products: DigitalProduct[];
  orders: MaterialOrder[];
  receipts: PaymentReceipt[];
  logs: AuditLogEntry[];
}

export function getInitialPlatformState(): PlatformState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PlatformState>;
      return {
        users: parsed.users?.length ? parsed.users : SEED_USERS,
        currentUserEmail: parsed.currentUserEmail || 'abebe@tatari.et',
        language: parsed.language === 'am' ? 'am' : 'en',
        jobs: parsed.jobs?.length ? parsed.jobs : SEED_JOBS,
        savedJobIds: Array.isArray(parsed.savedJobIds) ? parsed.savedJobIds : ['job-103'],
        applications: Array.isArray(parsed.applications) ? parsed.applications : SEED_APPLICATIONS,
        products: parsed.products?.length ? parsed.products : SEED_PRODUCTS,
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
    currentUserEmail: 'abebe@tatari.et',
    language: 'en',
    jobs: SEED_JOBS,
    savedJobIds: ['job-103'],
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

function isValidUpgradedJobRow(row: Record<string, unknown>): boolean {
  const title = String(row.title_en || '').trim();
  const company = String(row.company_name || '').trim();
  const salaryDisplay = String(row.salary_display || '').trim();
  const status = String(row.status || '');
  const validStatuses = ['pending_approval', 'approved', 'rejected', 'paused'];
  return (
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
  return title.length >= 3 && desc.length >= 10 && price > 0 && typeof row.file_format === 'string';
}

export async function syncWithSupabaseIfAvailable(): Promise<{
  connected: boolean;
  jobs?: JobListing[];
  products?: DigitalProduct[];
}> {
  const client = getSupabaseClient();
  if (!client) return { connected: false };

  try {
    const [jobsRes, productsRes] = await Promise.all([
      client.from('career_jobs').select('*').limit(50),
      client.from('products').select('*').limit(50),
    ]);

    if (jobsRes.error && productsRes.error) {
      return { connected: false };
    }

    const validJobs: JobListing[] = (jobsRes.data || [])
      .filter((row: Record<string, unknown>) => isValidUpgradedJobRow(row))
      .map((row: Record<string, unknown>) => ({
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
        postingFeeEtb: Number(row.posting_fee_etb || 500),
        paymentReceiptId: row.payment_receipt_id ? String(row.payment_receipt_id) : undefined,
        status: (row.status as JobListing['status']) || 'approved',
        rejectionReason: row.rejection_reason ? String(row.rejection_reason) : undefined,
        createdAt: String(row.created_at || new Date().toISOString()),
        publishedAt: row.published_at ? String(row.published_at) : undefined,
      }));

    const validProducts: DigitalProduct[] = (productsRes.data || [])
      .filter((row: Record<string, unknown>) => isValidUpgradedProductRow(row))
      .map((row: Record<string, unknown>) => ({
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
      }));

    return {
      connected: true,
      jobs: validJobs.length > 0 ? validJobs : undefined,
      products: validProducts.length > 0 ? validProducts : undefined,
    };
  } catch {
    return { connected: false };
  }
}

export async function pushReceiptAndAuditToSupabase(
  receipt: PaymentReceipt,
  log: AuditLogEntry
): Promise<void> {
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
      amount_etb: receipt.amountEtb,
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
