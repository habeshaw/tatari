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
    role TEXT NOT NULL DEFAULT 'seeker',
    status TEXT NOT NULL DEFAULT 'approved',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tin_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;

INSERT INTO public.profiles (email, full_name, company_name, phone, role, status)
VALUES
  ('admin@tatari.et', 'TATARI System Administrator', 'TATARI Consulting PLC', '+251911000001', 'admin', 'approved'),
  ('hr@addistech.et', 'Meron Tadesse', 'Addis Tech Manufacturing PLC', '+251911223344', 'employer', 'approved'),
  ('abebe@tatari.et', 'Abebe Bikila', NULL, '+251911556677', 'seeker', 'approved')
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
    amount_etb NUMERIC NOT NULL,
    payment_receipt_id TEXT,
    payment_status TEXT NOT NULL DEFAULT 'pending_verification' CHECK (payment_status IN ('pending_verification', 'verified', 'rejected')),
    status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'rejected')),
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    approved_at TIMESTAMPTZ
);

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
    amount_etb NUMERIC NOT NULL,
    receipt_note TEXT,
    receipt_image_data TEXT,
    status TEXT NOT NULL DEFAULT 'pending_verification' CHECK (status IN ('pending_verification', 'verified', 'rejected')),
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Audit Activity Logs
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    action_type TEXT NOT NULL,
    details TEXT NOT NULL,
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
