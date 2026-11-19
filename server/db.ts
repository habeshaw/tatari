import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  buildJobSlug,
  categorizeJob,
  computeDedupeKey,
  STANDARD_CATEGORIES,
} from './aggregatorCore';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'tatari.db');
export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const PASSWORD_SALT = process.env.TATARI_AUTH_SALT || 'tatari-ethiopia-2026-salt';

export function hashPassword(password: string): string {
  return crypto
    .createHash('sha256')
    .update(`${PASSWORD_SALT}:${password}`)
    .digest('hex');
}

export function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'employer', 'seeker')),
      company_name TEXT,
      business_tin TEXT,
      status TEXT NOT NULL DEFAULT 'approved' CHECK(status IN ('approved', 'pending', 'suspended')),
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS job_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS job_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_name TEXT NOT NULL,
      website_url TEXT NOT NULL,
      feed_url TEXT NOT NULL,
      collection_method TEXT NOT NULL CHECK(collection_method IN ('rss', 'json_api', 'html_directory', 'partner_feed')),
      collection_frequency TEXT NOT NULL DEFAULT 'every_6h' CHECK(collection_frequency IN ('hourly', 'every_6h', 'daily', 'manual')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused', 'error')),
      robots_respect INTEGER NOT NULL DEFAULT 1,
      rate_limit_ms INTEGER NOT NULL DEFAULT 1200,
      last_collected_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      company_name TEXT NOT NULL,
      company_logo TEXT,
      location TEXT NOT NULL,
      description TEXT NOT NULL,
      category_id INTEGER REFERENCES job_categories(id),
      employment_type TEXT NOT NULL DEFAULT 'Full-time',
      salary_min INTEGER,
      salary_max INTEGER,
      salary_currency TEXT NOT NULL DEFAULT 'ETB',
      application_deadline TEXT,
      source_id INTEGER REFERENCES job_sources(id) ON DELETE SET NULL,
      original_job_url TEXT,
      job_origin TEXT NOT NULL CHECK(job_origin IN ('external', 'tatari')),
      original_job_identifier TEXT,
      dedupe_key TEXT NOT NULL,
      published_at TEXT NOT NULL,
      expires_at TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'pending_review', 'rejected', 'expired')),
      is_featured INTEGER NOT NULL DEFAULT 0,
      employer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      payment_status TEXT NOT NULL DEFAULT 'not_required' CHECK(payment_status IN ('not_required', 'pending', 'verified', 'rejected')),
      payment_method TEXT,
      payment_ref TEXT,
      rejection_reason TEXT,
      views_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS job_collection_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL REFERENCES job_sources(id) ON DELETE CASCADE,
      collection_started_at TEXT NOT NULL,
      collection_completed_at TEXT,
      jobs_found INTEGER NOT NULL DEFAULT 0,
      jobs_added INTEGER NOT NULL DEFAULT 0,
      jobs_updated INTEGER NOT NULL DEFAULT 0,
      duplicates_found INTEGER NOT NULL DEFAULT 0,
      errors TEXT,
      collection_status TEXT NOT NULL CHECK(collection_status IN ('success', 'partial', 'failed', 'running'))
    );

    CREATE TABLE IF NOT EXISTS job_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      seeker_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      applicant_name TEXT NOT NULL,
      applicant_email TEXT NOT NULL,
      applicant_phone TEXT NOT NULL,
      cover_note TEXT NOT NULL,
      cv_summary TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted', 'shortlisted', 'reviewed')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS saved_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, job_id)
    );

    CREATE TABLE IF NOT EXISTS job_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      category_id INTEGER REFERENCES job_categories(id) ON DELETE SET NULL,
      location TEXT,
      keywords TEXT,
      job_origin_pref TEXT NOT NULL DEFAULT 'all' CHECK(job_origin_pref IN ('all', 'external', 'tatari')),
      frequency TEXT NOT NULL DEFAULT 'instant' CHECK(frequency IN ('instant', 'daily')),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      link_slug TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS digital_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      price_etb INTEGER NOT NULL,
      format_info TEXT NOT NULL,
      image_url TEXT NOT NULL,
      deliverable_content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS digital_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES digital_products(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      buyer_name TEXT NOT NULL,
      buyer_email TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      payment_ref TEXT NOT NULL,
      receipt_note TEXT,
      amount_etb INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
      rejection_reason TEXT,
      created_at TEXT NOT NULL,
      verified_at TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_email TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_status_origin ON jobs(status, job_origin);
    CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category_id);
    CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs(location);
    CREATE INDEX IF NOT EXISTS idx_jobs_published ON jobs(published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_jobs_expires ON jobs(expires_at);
    CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source_id);
    CREATE INDEX IF NOT EXISTS idx_jobs_dedupe ON jobs(dedupe_key);
    CREATE INDEX IF NOT EXISTS idx_jobs_source_ext_id ON jobs(source_id, original_job_identifier);
    CREATE INDEX IF NOT EXISTS idx_logs_source_started ON job_collection_logs(source_id, collection_started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
  `);
}

export function seedInitialData(): void {
  const now = new Date();
  const nowIso = now.toISOString();
  const dayMs = 24 * 60 * 60 * 1000;

  const existingCatCount = (db.prepare('SELECT COUNT(*) as c FROM job_categories').get() as { c: number }).c;
  if (existingCatCount === 0) {
    const insertCat = db.prepare(
      'INSERT INTO job_categories (name, slug, created_at) VALUES (?, ?, ?)'
    );
    for (const cat of STANDARD_CATEGORIES) {
      insertCat.run(cat.name, cat.slug, nowIso);
    }
  }

  const existingUserCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  if (existingUserCount === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, company_name, business_tin, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertUser.run('Tatari Administrator', 'admin@tatari.et', hashPassword('TatariAdmin#2026'), 'admin', 'TATARI Platform', 'TIN-0001001', 'approved', nowIso);
    insertUser.run('AddisTech Solutions HR', 'hr@addistech.et', hashPassword('Employer@2026'), 'employer', 'AddisTech Solutions PLC', 'TIN-004829104', 'approved', nowIso);
    insertUser.run('Selamawit Bekele', 'hr@habeshacapital.et', hashPassword('Employer@2026'), 'employer', 'Habesha Capital Microfinance', 'TIN-009182311', 'pending', nowIso);
    insertUser.run('Abebe Kebede', 'abebe@tatari.et', hashPassword('Seeker@2026'), 'seeker', null, null, 'approved', nowIso);
  }

  // Clean up any legacy placeholder local:// sources or synthetic external job fixtures from earlier builds
  const hasLegacyLocal = (
    db.prepare("SELECT COUNT(*) as c FROM job_sources WHERE feed_url LIKE 'local://%'").get() as { c: number }
  ).c;
  if (hasLegacyLocal > 0) {
    db.prepare("DELETE FROM jobs WHERE job_origin = 'external'").run();
    db.prepare("DELETE FROM job_collection_logs").run();
    db.prepare("DELETE FROM job_sources WHERE feed_url LIKE 'local://%'").run();
  }

  const existingSourcesCount = (db.prepare('SELECT COUNT(*) as c FROM job_sources').get() as { c: number }).c;
  if (existingSourcesCount === 0) {
    const insertSource = db.prepare(`
      INSERT INTO job_sources (source_name, website_url, feed_url, collection_method, collection_frequency, status, robots_respect, rate_limit_ms, last_collected_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
    `);
    insertSource.run(
      'Ethiojobs',
      'https://ethiojobs.net',
      'https://ethiojobs.net/jobs',
      'html_directory',
      'every_6h',
      'active',
      1000,
      null,
      nowIso,
      nowIso
    );
    insertSource.run(
      'GeezJobs',
      'https://geezjobs.com',
      'https://geezjobs.com/jobs-in-ethiopia',
      'html_directory',
      'every_6h',
      'active',
      1200,
      null,
      nowIso,
      nowIso
    );
    insertSource.run(
      'Ezega Jobs',
      'https://www.ezega.com',
      'https://www.ezega.com/jobs/AllPostedJobs',
      'html_directory',
      'every_6h',
      'active',
      1200,
      null,
      nowIso,
      nowIso
    );
    insertSource.run(
      'EthiopianWork',
      'https://ethiopianwork.com',
      'https://ethiopianwork.com/jobs',
      'html_directory',
      'every_6h',
      'active',
      1200,
      null,
      nowIso,
      nowIso
    );
  }

  const categoriesBySlug = new Map<string, number>();
  const cats = db.prepare('SELECT id, slug FROM job_categories').all() as Array<{ id: number; slug: string }>;
  for (const c of cats) categoriesBySlug.set(c.slug, c.id);

  const employerRow = db.prepare('SELECT id FROM users WHERE email = ?').get('hr@addistech.et') as { id: number } | undefined;
  const employerId = employerRow?.id ?? null;

  const existingTatariJobsCount = (
    db.prepare("SELECT COUNT(*) as c FROM jobs WHERE job_origin = 'tatari'").get() as { c: number }
  ).c;
  if (existingTatariJobsCount === 0) {
    const insertJob = db.prepare(`
      INSERT INTO jobs (
        slug, title, company_name, company_logo, location, description, category_id,
        employment_type, salary_min, salary_max, salary_currency, application_deadline,
        source_id, original_job_url, job_origin, original_job_identifier, dedupe_key,
        published_at, expires_at, status, is_featured, employer_id, payment_status,
        payment_method, payment_ref, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ETB', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const seedTatariJobs = [
      {
        title: 'Senior Full-Stack TypeScript Engineer',
        company: 'AddisTech Solutions PLC',
        location: 'Addis Ababa (Bole)',
        description:
          'Lead architecture and delivery of enterprise financial and logistics web platforms serving Ethiopian SMEs. Requirements: 4+ years with React, Node.js, PostgreSQL/SQLite, REST API security, and bilingual localization workflows. Competitive salary, medical coverage, and hybrid flexibility.',
        employmentType: 'Full-time',
        salaryMin: 55000,
        salaryMax: 85000,
        deadlineDays: 16,
        publishedDaysAgo: 0,
        featured: 1,
        status: 'active',
        paymentStatus: 'verified',
        paymentMethod: 'Telebirr',
        paymentRef: 'TB-99482104',
      },
      {
        title: 'IFRS Senior Financial Accountant',
        company: 'Zemen Logistics & Freight S.C.',
        location: 'Addis Ababa (Kazanchis)',
        description:
          'Manage monthly IFRS reporting, Ministry of Revenue VAT & withholding tax filings, payroll reconciliation, and annual external audit readiness. Bachelor degree in Accounting & Finance plus 5 years relevant experience required.',
        employmentType: 'Full-time',
        salaryMin: 32000,
        salaryMax: 44000,
        deadlineDays: 3,
        publishedDaysAgo: 2,
        featured: 1,
        status: 'active',
        paymentStatus: 'verified',
        paymentMethod: 'CBE Bank Transfer',
        paymentRef: 'CBE-77210945',
      },
      {
        title: 'Digital Growth & B2B Sales Lead',
        company: 'Kifiya Digital Commerce Partner',
        location: 'Addis Ababa (Mexico)',
        description:
          'Own merchant onboarding campaigns across Addis Ababa, Adama, and Hawassa. Coordinate field sales teams, track CRM conversion pipelines, and run merchant training workshops.',
        employmentType: 'Full-time',
        salaryMin: 28000,
        salaryMax: 40000,
        deadlineDays: 12,
        publishedDaysAgo: 1,
        featured: 0,
        status: 'active',
        paymentStatus: 'verified',
        paymentMethod: 'Telebirr',
        paymentRef: 'TB-88120933',
      },
    ];

    seedTatariJobs.forEach((j, idx) => {
      const catSlug = categorizeJob(j.title, j.description);
      const catId = categoriesBySlug.get(catSlug) ?? categoriesBySlug.get('other')!;
      const pubDate = new Date(now.getTime() - j.publishedDaysAgo * dayMs).toISOString();
      const deadlineDate = new Date(now.getTime() + j.deadlineDays * dayMs).toISOString();
      const slug = buildJobSlug(j.title, j.company, idx + 1);
      const dedupeKey = computeDedupeKey({
        sourceId: null,
        originalJobIdentifier: null,
        originalJobUrl: null,
        title: j.title,
        companyName: j.company,
        location: j.location,
      });

      insertJob.run(
        slug,
        j.title,
        j.company,
        null,
        j.location,
        j.description,
        catId,
        j.employmentType,
        j.salaryMin,
        j.salaryMax,
        deadlineDate,
        null,
        null,
        'tatari',
        null,
        dedupeKey,
        pubDate,
        deadlineDate,
        j.status,
        j.featured,
        employerId,
        j.paymentStatus,
        j.paymentMethod,
        j.paymentRef,
        pubDate,
        nowIso
      );
    });
  }

  const existingProductsCount = (db.prepare('SELECT COUNT(*) as c FROM digital_products').get() as { c: number }).c;
  if (existingProductsCount === 0) {
    const insertProduct = db.prepare(`
      INSERT INTO digital_products (title, category, description, price_etb, format_info, image_url, deliverable_content, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `);
    insertProduct.run(
      'Ethiopian Payroll & Tax Compliance Calculator 2026',
      'Finance & Payroll',
      'Automated Excel/CSV payroll schedule with Ethiopian progressive income tax brackets, 7%/11% pension deductions, overtime multipliers, and Ministry of Revenue summary sheets.',
      650,
      'XLSX + CSV + Tax Guide PDF',
      '/src/assets/images/store_payroll_kit_1795090975036.jpg',
      'TATARI CERTIFIED PAYROLL BRACKETS (ETB)\n0 - 600: 0%\n601 - 1,650: 10% (-60)\n1,651 - 3,200: 15% (-142.50)\n3,201 - 5,250: 20% (-302.50)\n5,251 - 7,800: 25% (-565)\n7,801 - 10,900: 30% (-955)\nAbove 10,900: 35% (-1,500)\nPension: Employee 7% / Employer 11%',
      nowIso
    );
    insertProduct.run(
      'Ethiopian Labor Law HR Policy & Contract Kit',
      'HR & Legal',
      'Bilingual (English & Amharic) employment contracts aligned with Proclamation No. 1156/2019, probation evaluation rubrics, leave policies, and disciplinary templates.',
      890,
      'DOCX + PDF Bundle (24 Templates)',
      '/src/assets/images/store_hr_bundle_1795090940161.jpg',
      'TATARI HR POLICY & PROCLAMATION 1156/2019 KIT\nIncludes: Indefinite & Definite-Term Employment Contracts, 60-Day Probation Review Form, Annual & Maternity Leave Ledger, and Workplace Grievance SOP.',
      nowIso
    );
    insertProduct.run(
      'Executive CV, Cover Letter & Interview Pack',
      'Career Toolkits',
      'ATS-optimized resume templates tailored for Ethiopian NGOs, commercial banks, and tech firms, plus structured STAR interview answer frameworks.',
      350,
      'DOCX + Figma + Checklist PDF',
      '/src/assets/images/store_career_cv_1795090940993.jpg',
      'TATARI CAREER TOOLKIT\nIncludes: 5 ATS-Safe Resume Layouts, NGO/UN Competency Statement Guide, Ethiopian Banking Interview Prep (60 Q&As).',
      nowIso
    );
    insertProduct.run(
      'Public & NGO Tender Bid Compliance Pack',
      'Procurement & Tenders',
      'Complete technical and financial bid response templates structured for Ethiopian public procurement and international NGO tenders.',
      1200,
      'DOCX + XLSX BOQ + Checklist',
      '/src/assets/images/store_tender_pack_1795090940763.jpg',
      'TATARI TENDER COMPLIANCE PACK\nIncludes: Technical Methodology Outline, BOQ Pricing Matrix, Bid Bond & Tax Clearance Checklist.',
      nowIso
    );
  }

  // Seed one sample digital order & alert for Abebe so Saved & Orders / Alerts has realistic history
  const abebeRow = db.prepare('SELECT id FROM users WHERE email = ?').get('abebe@tatari.et') as { id: number } | undefined;
  const firstProduct = db.prepare('SELECT id, price_etb FROM digital_products LIMIT 1').get() as { id: number; price_etb: number } | undefined;
  if (abebeRow && firstProduct) {
    const orderCount = (db.prepare('SELECT COUNT(*) as c FROM digital_orders').get() as { c: number }).c;
    if (orderCount === 0) {
      db.prepare(`
        INSERT INTO digital_orders (product_id, user_id, buyer_name, buyer_email, payment_method, payment_ref, receipt_note, amount_etb, status, created_at, verified_at)
        VALUES (?, ?, 'Abebe Kebede', 'abebe@tatari.et', 'Telebirr', 'TB-4402918', 'Paid via Telebirr mobile app', ?, 'approved', ?, ?)
      `).run(firstProduct.id, abebeRow.id, firstProduct.price_etb, nowIso, nowIso);
    }

    const alertCount = (db.prepare('SELECT COUNT(*) as c FROM job_alerts').get() as { c: number }).c;
    if (alertCount === 0) {
      const itCatId = categoriesBySlug.get('information-technology') ?? null;
      db.prepare(`
        INSERT INTO job_alerts (user_id, email, category_id, location, keywords, job_origin_pref, frequency, active, created_at)
        VALUES (?, 'abebe@tatari.et', ?, 'Addis Ababa', 'Engineer', 'all', 'instant', 1, ?)
      `).run(abebeRow.id, itCatId, nowIso);

      db.prepare(`
        INSERT INTO notifications (user_id, title, message, link_slug, is_read, created_at)
        VALUES (?, 'New IT Job Match in Addis Ababa', 'Senior Full-Stack TypeScript Engineer at AddisTech Solutions PLC matches your alert.', 'senior-full-stack-typescript-engineer-addistech-solutions-plc-1', 0, ?)
      `).run(abebeRow.id, nowIso);
    }
  }
}

initSchema();
seedInitialData();
