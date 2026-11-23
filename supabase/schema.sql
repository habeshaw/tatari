-- ============================================================================
-- TATARI JOB PORTAL & DIGITAL STORE — PRODUCTION SUPABASE SCHEMA (POSTGRESQL)
-- Safe to run on BOTH a fresh Supabase project and an existing TATARI project.
-- Execute this entire script in: Supabase Dashboard -> SQL Editor -> New Query
-- ============================================================================

-- 1. User Profiles & Role-Based Access Control
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    company_name TEXT,
    tin_number TEXT,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'seeker' CHECK (role IN ('seeker', 'employer', 'admin')),
    status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'suspended')),
    password_hash TEXT,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tin_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS headline TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_resume_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

INSERT INTO public.profiles (email, full_name, company_name, tin_number, phone, role, status)
VALUES
  ('admin@tatari.et', 'TATARI System Administrator', 'TATARI Consulting PLC', '0011223344', '+251911000001', 'admin', 'approved'),
  ('hr@addistech.et', 'Meron Tadesse', 'Addis Tech Manufacturing PLC', '0045678912', '+251911223344', 'employer', 'approved'),
  ('abebe@tatari.et', 'Abebe Bikila', NULL, NULL, '+251911556677', 'seeker', 'approved')
ON CONFLICT (email) DO UPDATE
SET full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    status = EXCLUDED.status;

-- 2. Job Vacancies (Indeed-style Job Board, gated by Admin Payment Approval)
CREATE TABLE IF NOT EXISTS public.career_jobs (
    id TEXT PRIMARY KEY,
    employer_email TEXT NOT NULL DEFAULT '',
    title_en TEXT NOT NULL,
    title_am TEXT,
    company_name TEXT NOT NULL,
    company_rating NUMERIC(2,1) DEFAULT 4.5,
    location TEXT NOT NULL,
    remote_type TEXT NOT NULL DEFAULT 'On-site',
    category TEXT NOT NULL,
    job_type TEXT NOT NULL,
    experience_level TEXT NOT NULL DEFAULT 'Mid-Level',
    salary_min NUMERIC NOT NULL DEFAULT 0,
    salary_max NUMERIC NOT NULL DEFAULT 0,
    salary_display TEXT NOT NULL DEFAULT 'Negotiable',
    deadline DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
    summary_en TEXT NOT NULL DEFAULT '',
    description_en TEXT NOT NULL DEFAULT '',
    description_am TEXT,
    requirements TEXT[] NOT NULL DEFAULT '{}',
    benefits TEXT[] NOT NULL DEFAULT '{}',
    easy_apply BOOLEAN DEFAULT true,
    posting_fee_etb NUMERIC NOT NULL DEFAULT 500,
    payment_receipt_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending_approval',
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    published_at TIMESTAMPTZ
);

ALTER TABLE public.career_jobs ADD COLUMN IF NOT EXISTS company_rating NUMERIC(2,1) DEFAULT 4.5;
ALTER TABLE public.career_jobs ADD COLUMN IF NOT EXISTS remote_type TEXT NOT NULL DEFAULT 'On-site';
ALTER TABLE public.career_jobs ADD COLUMN IF NOT EXISTS experience_level TEXT NOT NULL DEFAULT 'Mid-Level';
ALTER TABLE public.career_jobs ADD COLUMN IF NOT EXISTS salary_min NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.career_jobs ADD COLUMN IF NOT EXISTS salary_max NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.career_jobs ADD COLUMN IF NOT EXISTS salary_display TEXT NOT NULL DEFAULT 'Negotiable';
ALTER TABLE public.career_jobs ADD COLUMN IF NOT EXISTS summary_en TEXT NOT NULL DEFAULT '';
ALTER TABLE public.career_jobs ADD COLUMN IF NOT EXISTS benefits TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.career_jobs ADD COLUMN IF NOT EXISTS easy_apply BOOLEAN DEFAULT true;
ALTER TABLE public.career_jobs ADD COLUMN IF NOT EXISTS posting_fee_etb NUMERIC NOT NULL DEFAULT 500;
ALTER TABLE public.career_jobs ADD COLUMN IF NOT EXISTS payment_receipt_id TEXT;
ALTER TABLE public.career_jobs ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.career_jobs ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE public.career_jobs ADD COLUMN IF NOT EXISTS tier_id TEXT DEFAULT 'standard';
ALTER TABLE public.career_jobs ADD COLUMN IF NOT EXISTS tier_name TEXT DEFAULT 'Standard Listing';
ALTER TABLE public.career_jobs ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

-- 3. Job Applications Pipeline
CREATE TABLE IF NOT EXISTS public.job_applications (
    id TEXT PRIMARY KEY,
    job_id TEXT,
    job_title TEXT NOT NULL DEFAULT '',
    company_name TEXT NOT NULL DEFAULT '',
    applicant_name TEXT NOT NULL,
    applicant_email TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    resume_url TEXT NOT NULL,
    cover_note TEXT,
    years_experience TEXT DEFAULT '1-3 years',
    status TEXT NOT NULL DEFAULT 'Submitted',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS job_title TEXT NOT NULL DEFAULT '';
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS company_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS cover_note TEXT;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS years_experience TEXT DEFAULT '1-3 years';

-- 4. Digital Store Catalog
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    seller_email TEXT NOT NULL DEFAULT 'admin@tatari.et',
    title_en TEXT NOT NULL,
    title_am TEXT,
    category TEXT NOT NULL,
    price_etb NUMERIC NOT NULL,
    file_format TEXT NOT NULL DEFAULT 'XLSX / PDF',
    file_size TEXT NOT NULL DEFAULT '2.4 MB',
    version TEXT NOT NULL DEFAULT 'v2.1',
    image_url TEXT,
    description_en TEXT NOT NULL,
    description_am TEXT,
    included_files TEXT[] NOT NULL DEFAULT '{}',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS file_format TEXT NOT NULL DEFAULT 'XLSX / PDF';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS file_size TEXT NOT NULL DEFAULT '2.4 MB';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS version TEXT NOT NULL DEFAULT 'v2.1';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS included_files TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- 5. Digital Store Material Orders (Download gated by Admin Receipt Approval)
CREATE TABLE IF NOT EXISTS public.material_orders (
    id TEXT PRIMARY KEY,
    product_id TEXT,
    product_title TEXT NOT NULL,
    buyer_email TEXT NOT NULL,
    buyer_name TEXT NOT NULL,
    subtotal_etb NUMERIC DEFAULT 0,
    discount_etb NUMERIC DEFAULT 0,
    vat_etb NUMERIC DEFAULT 0,
    promo_code TEXT,
    amount_etb NUMERIC NOT NULL,
    invoice_number TEXT,
    payment_receipt_id TEXT,
    payment_status TEXT NOT NULL DEFAULT 'pending_verification' CHECK (payment_status IN ('pending_verification', 'verified', 'rejected')),
    status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'rejected')),
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    approved_at TIMESTAMPTZ
);

ALTER TABLE public.material_orders ADD COLUMN IF NOT EXISTS subtotal_etb NUMERIC DEFAULT 0;
ALTER TABLE public.material_orders ADD COLUMN IF NOT EXISTS discount_etb NUMERIC DEFAULT 0;
ALTER TABLE public.material_orders ADD COLUMN IF NOT EXISTS vat_etb NUMERIC DEFAULT 0;
ALTER TABLE public.material_orders ADD COLUMN IF NOT EXISTS promo_code TEXT;
ALTER TABLE public.material_orders ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- 6. Unified Payment Receipts Ledger (Job Posting Fees & Digital Store Purchases)
CREATE TABLE IF NOT EXISTS public.payment_receipts (
    id TEXT PRIMARY KEY,
    target_type TEXT NOT NULL CHECK (target_type IN ('job_post', 'digital_material')),
    target_id TEXT NOT NULL,
    target_title TEXT NOT NULL,
    payer_email TEXT NOT NULL,
    payer_name TEXT NOT NULL,
    payer_phone TEXT NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('Telebirr', 'CBE Bank Transfer', 'CBE Birr', 'AwashBirr')),
    transaction_ref TEXT NOT NULL,
    subtotal_etb NUMERIC DEFAULT 0,
    discount_etb NUMERIC DEFAULT 0,
    vat_etb NUMERIC DEFAULT 0,
    promo_code TEXT,
    amount_etb NUMERIC NOT NULL,
    invoice_number TEXT,
    receipt_note TEXT,
    receipt_image_data TEXT,
    status TEXT NOT NULL DEFAULT 'pending_verification' CHECK (status IN ('pending_verification', 'verified', 'rejected')),
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.payment_receipts ADD COLUMN IF NOT EXISTS subtotal_etb NUMERIC DEFAULT 0;
ALTER TABLE public.payment_receipts ADD COLUMN IF NOT EXISTS discount_etb NUMERIC DEFAULT 0;
ALTER TABLE public.payment_receipts ADD COLUMN IF NOT EXISTS vat_etb NUMERIC DEFAULT 0;
ALTER TABLE public.payment_receipts ADD COLUMN IF NOT EXISTS promo_code TEXT;
ALTER TABLE public.payment_receipts ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- 7. Audit Activity Logs
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    action_type TEXT NOT NULL,
    details TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Digital Store Verified Buyer Reviews
CREATE TABLE IF NOT EXISTS public.product_reviews (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    reviewer_email TEXT NOT NULL,
    reviewer_name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS Policies
DROP POLICY IF EXISTS "Public access profiles" ON public.profiles;
CREATE POLICY "Public access profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access career_jobs" ON public.career_jobs;
CREATE POLICY "Public access career_jobs" ON public.career_jobs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access job_applications" ON public.job_applications;
CREATE POLICY "Public access job_applications" ON public.job_applications FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access products" ON public.products;
CREATE POLICY "Public access products" ON public.products FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access material_orders" ON public.material_orders;
CREATE POLICY "Public access material_orders" ON public.material_orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access payment_receipts" ON public.payment_receipts;
CREATE POLICY "Public access payment_receipts" ON public.payment_receipts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access activity_logs" ON public.activity_logs;
CREATE POLICY "Public access activity_logs" ON public.activity_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access product_reviews" ON public.product_reviews;
CREATE POLICY "Public access product_reviews" ON public.product_reviews FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- PHASE 2+ UPGRADE MIGRATIONS (IDEMPOTENT)
-- Rollback note: Drop newly added tables (training_*, aggregation_*, collection_*,
-- aggregated_listings, bank_exchange_*, banks, currencies, user_saved_listings,
-- user_alert_preferences) without touching core tables 1-8.
-- ============================================================================

-- 9. Tailored Corporate & Organizational Training Services
CREATE TABLE IF NOT EXISTS public.training_programs (
    id TEXT PRIMARY KEY,
    title_en TEXT NOT NULL,
    title_am TEXT,
    category TEXT NOT NULL,
    duration_days INTEGER NOT NULL DEFAULT 2,
    duration_label TEXT NOT NULL,
    target_audience TEXT NOT NULL DEFAULT '',
    fee_per_cohort_etb NUMERIC NOT NULL DEFAULT 25000,
    max_participants INTEGER NOT NULL DEFAULT 15,
    delivery_modes TEXT[] NOT NULL DEFAULT '{}',
    sector_focus TEXT[] NOT NULL DEFAULT '{}',
    summary_en TEXT NOT NULL,
    syllabus_modules TEXT[] NOT NULL DEFAULT '{}',
    deliverables TEXT[] NOT NULL DEFAULT '{}',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.training_requests (
    id TEXT PRIMARY KEY,
    requester_email TEXT NOT NULL,
    organization_name TEXT NOT NULL,
    organization_sector TEXT NOT NULL,
    contact_person TEXT NOT NULL,
    phone TEXT NOT NULL,
    program_id TEXT NOT NULL REFERENCES public.training_programs(id) ON DELETE RESTRICT,
    program_title TEXT NOT NULL,
    custom_topics TEXT NOT NULL,
    team_size INTEGER NOT NULL CHECK (team_size BETWEEN 1 AND 250),
    delivery_mode TEXT NOT NULL,
    preferred_dates TEXT NOT NULL,
    location_city TEXT NOT NULL,
    estimated_fee_etb NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Submitted', 'Scoped & Quoted', 'Approved & Scheduled', 'Completed', 'Declined')),
    trainer_assigned TEXT,
    proposal_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ
);

-- 10. Centralized Aggregation Sources, Runs & Errors
CREATE TABLE IF NOT EXISTS public.aggregation_sources (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    url TEXT NOT NULL,
    module TEXT NOT NULL,
    method TEXT NOT NULL,
    frequency_label TEXT NOT NULL DEFAULT 'Every 30m',
    terms_note TEXT NOT NULL DEFAULT 'Publicly accessible index',
    active BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'Verified',
    item_count INTEGER NOT NULL DEFAULT 0,
    last_successful_at TIMESTAMPTZ,
    last_failed_at TIMESTAMPTZ,
    last_error TEXT,
    is_custom BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.collection_runs (
    id TEXT PRIMARY KEY,
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ NOT NULL,
    scope TEXT NOT NULL,
    sources_checked INTEGER NOT NULL DEFAULT 0,
    sources_succeeded INTEGER NOT NULL DEFAULT 0,
    records_collected INTEGER NOT NULL DEFAULT 0,
    duplicates_detected INTEGER NOT NULL DEFAULT 0,
    errors_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.collection_errors (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    source_name TEXT NOT NULL,
    module TEXT NOT NULL,
    message TEXT NOT NULL,
    occurred_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. Aggregated Ethiopian Listings (Tenders, Scholarships, Grants, Internships, Notices, etc.)
CREATE TABLE IF NOT EXISTS public.aggregated_listings (
    id TEXT PRIMARY KEY,
    module TEXT NOT NULL,
    title TEXT NOT NULL,
    organization TEXT NOT NULL DEFAULT 'Not provided by source.',
    reference_number TEXT NOT NULL DEFAULT 'Not provided by source.',
    category TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT 'Ethiopia',
    eligibility_or_coverage TEXT NOT NULL DEFAULT 'Not provided by source.',
    price_or_funding TEXT NOT NULL DEFAULT 'Not provided by source.',
    deadline TEXT NOT NULL DEFAULT 'Not provided by source.',
    published_at TIMESTAMPTZ,
    collected_at TIMESTAMPTZ NOT NULL,
    last_verified_at TIMESTAMPTZ NOT NULL,
    source_id TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_domain TEXT NOT NULL,
    source_url TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    verification_status TEXT NOT NULL DEFAULT 'Verified',
    is_expired BOOLEAN NOT NULL DEFAULT false,
    fingerprint TEXT NOT NULL,
    duplicate_of_id TEXT,
    manually_corrected BOOLEAN NOT NULL DEFAULT false,
    original_values JSONB,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_aggregated_listings_module_status
    ON public.aggregated_listings (module, verification_status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_aggregated_listings_fingerprint
    ON public.aggregated_listings (fingerprint);

-- 12. Ethiopian Banks, Currencies & Immutable Foreign Exchange Rate History
CREATE TABLE IF NOT EXISTS public.banks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    is_central_bank BOOLEAN NOT NULL DEFAULT false,
    official_website TEXT NOT NULL,
    fx_page_url TEXT NOT NULL,
    integration_method TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.currencies (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.bank_exchange_rates (
    id TEXT PRIMARY KEY,
    bank_id TEXT NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
    currency_code TEXT NOT NULL,
    currency_name TEXT NOT NULL,
    rate_category TEXT NOT NULL CHECK (rate_category IN ('cash', 'transaction', 'weighted_average', 'nbe_reference')),
    buying_rate NUMERIC,
    selling_rate NUMERIC,
    mid_rate NUMERIC,
    spread_pct NUMERIC,
    published_date TEXT,
    collected_at TIMESTAMPTZ NOT NULL,
    last_verified_at TIMESTAMPTZ NOT NULL,
    source_url TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'official_html_table',
    verification_status TEXT NOT NULL DEFAULT 'Verified',
    freshness TEXT NOT NULL DEFAULT 'Fresh',
    anomaly_flagged BOOLEAN NOT NULL DEFAULT false,
    anomaly_reason TEXT,
    manually_corrected BOOLEAN NOT NULL DEFAULT false,
    original_extracted_buying NUMERIC,
    original_extracted_selling NUMERIC,
    UNIQUE (bank_id, currency_code, rate_category)
);

CREATE INDEX IF NOT EXISTS idx_bank_fx_currency_category
    ON public.bank_exchange_rates (currency_code, rate_category);

CREATE TABLE IF NOT EXISTS public.bank_exchange_rate_history (
    id TEXT PRIMARY KEY,
    bank_id TEXT NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
    currency_code TEXT NOT NULL,
    rate_category TEXT NOT NULL CHECK (rate_category IN ('cash', 'transaction', 'weighted_average', 'nbe_reference')),
    buying_rate NUMERIC,
    selling_rate NUMERIC,
    published_date TEXT,
    recorded_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    source_url TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bank_fx_history_lookup
    ON public.bank_exchange_rate_history (bank_id, currency_code, rate_category, recorded_at DESC);

-- 13. Saved Opportunity Listings & User Alert Preferences
CREATE TABLE IF NOT EXISTS public.user_saved_listings (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    listing_id TEXT NOT NULL,
    listing_type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (user_email, listing_id)
);

CREATE TABLE IF NOT EXISTS public.user_alert_preferences (
    user_email TEXT PRIMARY KEY,
    preferred_modules TEXT[] NOT NULL DEFAULT '{}',
    preferred_locations TEXT[] NOT NULL DEFAULT '{}',
    email_alerts BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS & Secure Policies on New Tables
ALTER TABLE public.training_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aggregation_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aggregated_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_exchange_rate_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_saved_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_alert_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read verified aggregated_listings" ON public.aggregated_listings;
CREATE POLICY "Public read verified aggregated_listings" ON public.aggregated_listings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read banks" ON public.banks;
CREATE POLICY "Public read banks" ON public.banks FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read currencies" ON public.currencies;
CREATE POLICY "Public read currencies" ON public.currencies FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read bank_exchange_rates" ON public.bank_exchange_rates;
CREATE POLICY "Public read bank_exchange_rates" ON public.bank_exchange_rates FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read bank_exchange_rate_history" ON public.bank_exchange_rate_history;
CREATE POLICY "Public read bank_exchange_rate_history" ON public.bank_exchange_rate_history FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read aggregation_sources" ON public.aggregation_sources;
CREATE POLICY "Public read aggregation_sources" ON public.aggregation_sources FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public access training_programs" ON public.training_programs;
CREATE POLICY "Public access training_programs" ON public.training_programs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access training_requests" ON public.training_requests;
CREATE POLICY "Public access training_requests" ON public.training_requests FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access user_saved_listings" ON public.user_saved_listings;
CREATE POLICY "Public access user_saved_listings" ON public.user_saved_listings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access user_alert_preferences" ON public.user_alert_preferences;
CREATE POLICY "Public access user_alert_preferences" ON public.user_alert_preferences FOR ALL USING (true) WITH CHECK (true);

