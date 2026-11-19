import crypto from 'crypto';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  buildJobPostingJsonLd,
  buildJobSlug,
  categorizeJob,
  computeDedupeKey,
  isExpiringSoon,
} from './server/aggregatorCore';
import {
  ensureLiveExternalJobsOnStartup,
  expireOutdatedJobs,
  runCollectionForSource,
  startBackgroundAggregator,
  verifyAndPruneExternalLinks,
} from './server/collectorService';
import { db, hashPassword } from './server/db';

dotenv.config();

const PORT = 3000;
const TOKEN_SECRET = process.env.TATARI_TOKEN_SECRET || 'tatari-hmac-secret-2026';

interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'employer' | 'seeker';
  company_name: string | null;
  business_tin: string | null;
  status: 'approved' | 'pending' | 'suspended';
}

interface AuthedRequest extends Request {
  user?: AuthUser;
}

// Lightweight query cache for fast public job discovery
const jobsCache = new Map<string, { expiresAt: number; payload: unknown }>();
function invalidateJobsCache(): void {
  jobsCache.clear();
}

function signToken(userId: number, role: string): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, role, exp: Date.now() + 7 * 86400 * 1000 })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token: string): { uid: number; role: string } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  if (sig !== expected) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!parsed.uid || !parsed.exp || parsed.exp < Date.now()) return null;
    return { uid: Number(parsed.uid), role: String(parsed.role) };
  } catch {
    return null;
  }
}

function attachUser(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const headerToken = (req.headers['x-tatari-token'] as string | undefined) || bearer;
  if (headerToken) {
    const verified = verifyToken(headerToken);
    if (verified) {
      const user = db
        .prepare(
          'SELECT id, name, email, role, company_name, business_tin, status FROM users WHERE id = ?'
        )
        .get(verified.uid) as AuthUser | undefined;
      if (user && user.status !== 'suspended') {
        req.user = user;
      }
    }
  }
  next();
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Administrator privileges required.' });
    return;
  }
  next();
}

function logAudit(actorEmail: string, action: string, targetType: string, targetId: string | number, details: string): void {
  db.prepare(
    'INSERT INTO audit_logs (actor_email, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(actorEmail, action, targetType, String(targetId), details, new Date().toISOString());
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(attachUser);

  // Start background Ethiopian job collector, expiry monitor, and initial live fetch
  startBackgroundAggregator();
  ensureLiveExternalJobsOnStartup()
    .then(() => invalidateJobsCache())
    .catch((err) => console.error('Initial live Ethiopian job collection error:', err));

  // --- SEO: Sitemap & Robots ---
  app.get('/robots.txt', (req, res) => {
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    res.type('text/plain').send(
      `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${baseUrl}/sitemap.xml\n`
    );
  });

  app.get('/sitemap.xml', (req, res) => {
    const baseUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const activeJobs = db
      .prepare("SELECT slug, updated_at, job_origin FROM jobs WHERE status = 'active' ORDER BY published_at DESC LIMIT 500")
      .all() as Array<{ slug: string; updated_at: string; job_origin: string }>;

    const urls = [
      `<url><loc>${baseUrl}/</loc><changefreq>hourly</changefreq><priority>1.0</priority></url>`,
      `<url><loc>${baseUrl}/store</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`,
      ...activeJobs.map(
        (j) =>
          `<url><loc>${baseUrl}/jobs/${encodeURIComponent(j.slug)}</loc><lastmod>${j.updated_at.split('T')[0]}</lastmod><changefreq>daily</changefreq><priority>${j.job_origin === 'tatari' ? '0.9' : '0.7'}</priority></url>`
      ),
    ];

    res
      .type('application/xml')
      .send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`
      );
  });

  // --- Auth Routes ---
  app.post('/api/auth/login', (req: AuthedRequest, res: Response) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const userRow = db.prepare('SELECT * FROM users WHERE lower(email) = ?').get(email) as
      | (AuthUser & { password_hash: string; failed_attempts: number; locked_until: string | null })
      | undefined;

    if (!userRow) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    if (userRow.locked_until && Date.parse(userRow.locked_until) > Date.now()) {
      res.status(429).json({
        error: 'Account temporarily locked after 5 failed attempts. Please try again in 15 minutes.',
      });
      return;
    }

    if (hashPassword(password) !== userRow.password_hash) {
      const nextAttempts = (userRow.failed_attempts || 0) + 1;
      const lockedUntil = nextAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
      db.prepare('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?').run(
        nextAttempts,
        lockedUntil,
        userRow.id
      );
      res.status(401).json({
        error:
          nextAttempts >= 5
            ? 'Account locked for 15 minutes due to 5 failed login attempts.'
            : `Invalid password (${5 - nextAttempts} attempts remaining).`,
      });
      return;
    }

    db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?').run(userRow.id);
    const token = signToken(userRow.id, userRow.role);
    res.json({
      token,
      user: {
        id: userRow.id,
        name: userRow.name,
        email: userRow.email,
        role: userRow.role,
        company_name: userRow.company_name,
        business_tin: userRow.business_tin,
        status: userRow.status,
      },
    });
  });

  app.post('/api/auth/register', (req: AuthedRequest, res: Response) => {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const role = req.body.role === 'employer' ? 'employer' : 'seeker';
    const companyName = req.body.company_name ? String(req.body.company_name).trim() : null;
    const businessTin = req.body.business_tin ? String(req.body.business_tin).trim() : null;

    if (!name || !email || password.length < 6) {
      res.status(400).json({ error: 'Name, valid email, and password (min 6 characters) are required.' });
      return;
    }
    if (role === 'employer' && (!companyName || !businessTin)) {
      res.status(400).json({ error: 'Employers must provide Company Name and Business TIN / License.' });
      return;
    }

    const exists = db.prepare('SELECT id FROM users WHERE lower(email) = ?').get(email);
    if (exists) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const status = role === 'employer' ? 'pending' : 'approved';
    const info = db
      .prepare(
        `INSERT INTO users (name, email, password_hash, role, company_name, business_tin, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(name, email, hashPassword(password), role, companyName, businessTin, status, new Date().toISOString());

    const userId = Number(info.lastInsertRowid);
    const token = signToken(userId, role);
    res.status(201).json({
      token,
      user: {
        id: userId,
        name,
        email,
        role,
        company_name: companyName,
        business_tin: businessTin,
        status,
      },
    });
  });

  app.get('/api/auth/me', (req: AuthedRequest, res: Response) => {
    res.json({ user: req.user || null });
  });

  // --- Public Categories & Sources ---
  app.get('/api/categories', (_req, res) => {
    const rows = db
      .prepare(
        `SELECT c.id, c.name, c.slug,
         (SELECT COUNT(*) FROM jobs j WHERE j.category_id = c.id AND j.status = 'active') as active_count
         FROM job_categories c ORDER BY c.id ASC`
      )
      .all();
    res.json({ categories: rows });
  });

  app.get('/api/sources/public', (_req, res) => {
    const rows = db
      .prepare(
        `SELECT s.id, s.source_name, s.website_url,
         (SELECT COUNT(*) FROM jobs j WHERE j.source_id = s.id AND j.status = 'active') as active_count
         FROM job_sources s ORDER BY s.source_name ASC`
      )
      .all();
    res.json({ sources: rows });
  });

  // --- Public Job Discovery Search & Filtering ---
  app.get('/api/jobs', (req: Request, res: Response) => {
    const cacheKey = req.originalUrl;
    const cached = jobsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.json(cached.payload);
      return;
    }

    expireOutdatedJobs();

    const q = String(req.query.q || '').trim().toLowerCase();
    const company = String(req.query.company || '').trim().toLowerCase();
    const location = String(req.query.location || '').trim().toLowerCase();
    const categoryId = req.query.category_id ? Number(req.query.category_id) : null;
    const employmentType = String(req.query.employment_type || '').trim();
    const salaryMin = req.query.salary_min ? Number(req.query.salary_min) : null;
    const salaryMax = req.query.salary_max ? Number(req.query.salary_max) : null;
    const datePosted = String(req.query.date_posted || '').trim();
    const sourceId = req.query.source_id ? Number(req.query.source_id) : null;
    const jobOrigin = String(req.query.job_origin || '').trim();
    const featured = req.query.featured === '1';
    const expiringSoon = req.query.expiring_soon === '1';
    const includeExpired = req.query.include_expired === '1';
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 12)));
    const offset = (page - 1) * limit;

    const where: string[] = [];
    const params: unknown[] = [];

    if (!includeExpired) {
      where.push("j.status = 'active'");
    } else {
      where.push("j.status IN ('active', 'expired')");
    }

    if (q) {
      where.push('(lower(j.title) LIKE ? OR lower(j.company_name) LIKE ? OR lower(j.description) LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (company) {
      where.push('lower(j.company_name) LIKE ?');
      params.push(`%${company}%`);
    }
    if (location) {
      where.push('lower(j.location) LIKE ?');
      params.push(`%${location}%`);
    }
    if (categoryId) {
      where.push('j.category_id = ?');
      params.push(categoryId);
    }
    if (employmentType) {
      where.push('j.employment_type = ?');
      params.push(employmentType);
    }
    if (salaryMin !== null && !Number.isNaN(salaryMin) && salaryMin > 0) {
      where.push('(j.salary_max >= ? OR j.salary_min >= ?)');
      params.push(salaryMin, salaryMin);
    }
    if (salaryMax !== null && !Number.isNaN(salaryMax) && salaryMax > 0) {
      where.push('(j.salary_min <= ?)');
      params.push(salaryMax);
    }
    if (sourceId) {
      where.push('j.source_id = ?');
      params.push(sourceId);
    }
    if (jobOrigin === 'external' || jobOrigin === 'tatari') {
      where.push('j.job_origin = ?');
      params.push(jobOrigin);
    }
    if (featured) {
      where.push('j.is_featured = 1');
    }
    if (datePosted === '24h') {
      where.push('j.published_at >= ?');
      params.push(new Date(Date.now() - 24 * 3600 * 1000).toISOString());
    } else if (datePosted === '7d') {
      where.push('j.published_at >= ?');
      params.push(new Date(Date.now() - 7 * 86400 * 1000).toISOString());
    } else if (datePosted === '30d') {
      where.push('j.published_at >= ?');
      params.push(new Date(Date.now() - 30 * 86400 * 1000).toISOString());
    }
    if (expiringSoon) {
      const nowIso = new Date().toISOString();
      const fiveDaysIso = new Date(Date.now() + 5 * 86400 * 1000).toISOString();
      where.push('j.application_deadline IS NOT NULL AND j.application_deadline > ? AND j.application_deadline <= ?');
      params.push(nowIso, fiveDaysIso);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countRow = db
      .prepare(`SELECT COUNT(*) as total FROM jobs j ${whereSql}`)
      .get(...params) as { total: number };

    const rows = db
      .prepare(
        `SELECT j.*, c.name as category_name, c.slug as category_slug,
                s.source_name, s.website_url as source_website_url
         FROM jobs j
         LEFT JOIN job_categories c ON j.category_id = c.id
         LEFT JOIN job_sources s ON j.source_id = s.id
         ${whereSql}
         ORDER BY j.is_featured DESC, j.published_at DESC, j.id DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset) as Array<Record<string, unknown>>;

    const enriched = rows.map((r) => ({
      ...r,
      expiring_soon: isExpiringSoon(r.application_deadline as string | null),
    }));

    const payload = {
      jobs: enriched,
      total: countRow.total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(countRow.total / limit)),
    };

    jobsCache.set(cacheKey, { expiresAt: Date.now() + 15000, payload });
    res.json(payload);
  });

  app.get('/api/jobs/:slugOrId', (req: Request, res: Response) => {
    const param = req.params.slugOrId;
    const isNumeric = /^\d+$/.test(param);
    const job = db
      .prepare(
        `SELECT j.*, c.name as category_name, c.slug as category_slug,
                s.source_name, s.website_url as source_website_url
         FROM jobs j
         LEFT JOIN job_categories c ON j.category_id = c.id
         LEFT JOIN job_sources s ON j.source_id = s.id
         WHERE ${isNumeric ? 'j.id = ?' : 'j.slug = ?'}
         LIMIT 1`
      )
      .get(isNumeric ? Number(param) : param) as Record<string, unknown> | undefined;

    if (!job) {
      res.status(404).json({ error: 'Job vacancy not found.' });
      return;
    }

    db.prepare('UPDATE jobs SET views_count = views_count + 1 WHERE id = ?').run(job.id);
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const jsonLd = buildJobPostingJsonLd(
      {
        slug: String(job.slug),
        title: String(job.title),
        description: String(job.description),
        companyName: String(job.company_name),
        location: String(job.location),
        employmentType: String(job.employment_type),
        publishedAt: String(job.published_at),
        expiresAt: job.expires_at ? String(job.expires_at) : null,
        salaryMin: job.salary_min ? Number(job.salary_min) : null,
        salaryMax: job.salary_max ? Number(job.salary_max) : null,
        salaryCurrency: String(job.salary_currency || 'ETB'),
        jobOrigin: job.job_origin as 'external' | 'tatari',
        status: String(job.status),
      },
      baseUrl
    );

    res.json({
      job: {
        ...job,
        expiring_soon: isExpiringSoon(job.application_deadline as string | null),
      },
      jsonLd,
    });
  });

  // --- Internal Application (Tatari-native jobs only, supports inline seeker registration) ---
  app.post('/api/jobs/:id/apply', (req: AuthedRequest, res: Response) => {
    const jobId = Number(req.params.id);
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId) as
      | { id: number; title: string; job_origin: string; original_job_url: string | null; status: string }
      | undefined;

    if (!job) {
      res.status(404).json({ error: 'Job listing not found.' });
      return;
    }
    if (job.job_origin === 'external') {
      res.status(400).json({
        error: 'External jobs must be applied to on their original website.',
        redirect_url: job.original_job_url,
      });
      return;
    }
    if (job.status !== 'active') {
      res.status(400).json({ error: 'This job vacancy is no longer accepting applications.' });
      return;
    }

    const applicantName = String(req.body.applicant_name || req.user?.name || '').trim();
    const applicantEmail = String(req.body.applicant_email || req.user?.email || '').trim().toLowerCase();
    const applicantPhone = String(req.body.applicant_phone || '').trim();
    const coverNote = String(req.body.cover_note || '').trim();
    const cvSummary = String(req.body.cv_summary || '').trim();
    const inlinePassword = String(req.body.password || '');

    if (!applicantName || !applicantEmail || !applicantPhone || !coverNote) {
      res.status(400).json({ error: 'Full name, email, phone number, and cover note are required.' });
      return;
    }

    let seekerId = req.user?.id ?? null;
    let issuedToken: string | null = null;
    let createdUser: AuthUser | null = null;

    if (!seekerId) {
      const existing = db.prepare('SELECT id, name, email, role, company_name, business_tin, status FROM users WHERE lower(email) = ?').get(applicantEmail) as AuthUser | undefined;
      if (existing) {
        seekerId = existing.id;
      } else {
        if (inlinePassword.length < 6) {
          res.status(400).json({ error: 'Please provide a password (min 6 chars) to create your Job Seeker account while applying.' });
          return;
        }
        const userInfo = db
          .prepare(
            `INSERT INTO users (name, email, password_hash, role, status, created_at) VALUES (?, ?, ?, 'seeker', 'approved', ?)`
          )
          .run(applicantName, applicantEmail, hashPassword(inlinePassword), new Date().toISOString());
        seekerId = Number(userInfo.lastInsertRowid);
        issuedToken = signToken(seekerId, 'seeker');
        createdUser = {
          id: seekerId,
          name: applicantName,
          email: applicantEmail,
          role: 'seeker',
          company_name: null,
          business_tin: null,
          status: 'approved',
        };
      }
    }

    const appInfo = db
      .prepare(
        `INSERT INTO job_applications (job_id, seeker_id, applicant_name, applicant_email, applicant_phone, cover_note, cv_summary, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        jobId,
        seekerId,
        applicantName,
        applicantEmail,
        applicantPhone,
        coverNote,
        cvSummary || 'Submitted via Tatari Quick Apply',
        new Date().toISOString()
      );

    res.status(201).json({
      application_id: Number(appInfo.lastInsertRowid),
      message: `Application submitted for ${job.title}.`,
      token: issuedToken,
      user: createdUser,
    });
  });

  // --- Saved Jobs, Alerts, Notifications & My Applications ---
  app.get('/api/saved-jobs', requireAuth, (req: AuthedRequest, res: Response) => {
    const rows = db
      .prepare(
        `SELECT sj.id as saved_id, sj.created_at as saved_at, j.*, c.name as category_name, s.source_name
         FROM saved_jobs sj
         JOIN jobs j ON sj.job_id = j.id
         LEFT JOIN job_categories c ON j.category_id = c.id
         LEFT JOIN job_sources s ON j.source_id = s.id
         WHERE sj.user_id = ?
         ORDER BY sj.created_at DESC`
      )
      .all(req.user!.id);
    res.json({ savedJobs: rows });
  });

  app.post('/api/saved-jobs/:jobId', requireAuth, (req: AuthedRequest, res: Response) => {
    const jobId = Number(req.params.jobId);
    db.prepare('INSERT OR IGNORE INTO saved_jobs (user_id, job_id, created_at) VALUES (?, ?, ?)').run(
      req.user!.id,
      jobId,
      new Date().toISOString()
    );
    res.status(201).json({ saved: true });
  });

  app.delete('/api/saved-jobs/:jobId', requireAuth, (req: AuthedRequest, res: Response) => {
    const jobId = Number(req.params.jobId);
    db.prepare('DELETE FROM saved_jobs WHERE user_id = ? AND job_id = ?').run(req.user!.id, jobId);
    res.json({ saved: false });
  });

  app.get('/api/job-alerts', requireAuth, (req: AuthedRequest, res: Response) => {
    const rows = db
      .prepare(
        `SELECT a.*, c.name as category_name
         FROM job_alerts a
         LEFT JOIN job_categories c ON a.category_id = c.id
         WHERE a.user_id = ?
         ORDER BY a.created_at DESC`
      )
      .all(req.user!.id);
    res.json({ alerts: rows });
  });

  app.post('/api/job-alerts', requireAuth, (req: AuthedRequest, res: Response) => {
    const categoryId = req.body.category_id ? Number(req.body.category_id) : null;
    const location = req.body.location ? String(req.body.location).trim() : null;
    const keywords = req.body.keywords ? String(req.body.keywords).trim() : null;
    const originPref = ['external', 'tatari'].includes(req.body.job_origin_pref)
      ? req.body.job_origin_pref
      : 'all';
    const frequency = req.body.frequency === 'daily' ? 'daily' : 'instant';

    const info = db
      .prepare(
        `INSERT INTO job_alerts (user_id, email, category_id, location, keywords, job_origin_pref, frequency, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`
      )
      .run(
        req.user!.id,
        req.user!.email,
        categoryId,
        location,
        keywords,
        originPref,
        frequency,
        new Date().toISOString()
      );
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  });

  app.delete('/api/job-alerts/:id', requireAuth, (req: AuthedRequest, res: Response) => {
    db.prepare('DELETE FROM job_alerts WHERE id = ? AND user_id = ?').run(
      Number(req.params.id),
      req.user!.id
    );
    res.json({ deleted: true });
  });

  app.get('/api/notifications', requireAuth, (req: AuthedRequest, res: Response) => {
    const rows = db
      .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30')
      .all(req.user!.id);
    res.json({ notifications: rows });
  });

  app.patch('/api/notifications/read-all', requireAuth, (req: AuthedRequest, res: Response) => {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user!.id);
    res.json({ ok: true });
  });

  app.get('/api/my-applications', requireAuth, (req: AuthedRequest, res: Response) => {
    const rows = db
      .prepare(
        `SELECT a.*, j.title as job_title, j.company_name, j.location, j.slug
         FROM job_applications a
         JOIN jobs j ON a.job_id = j.id
         WHERE a.seeker_id = ? OR lower(a.applicant_email) = ?
         ORDER BY a.created_at DESC`
      )
      .all(req.user!.id, req.user!.email.toLowerCase());
    res.json({ applications: rows });
  });

  // --- Digital Store ---
  app.get('/api/store/products', (_req, res) => {
    const rows = db.prepare("SELECT * FROM digital_products WHERE status = 'active' ORDER BY id ASC").all();
    res.json({ products: rows });
  });

  app.post('/api/store/orders', requireAuth, (req: AuthedRequest, res: Response) => {
    const productId = Number(req.body.product_id);
    const paymentMethod = String(req.body.payment_method || '').trim();
    const paymentRef = String(req.body.payment_ref || '').trim();
    const receiptNote = String(req.body.receipt_note || '').trim();

    if (!productId || !paymentMethod || !paymentRef) {
      res.status(400).json({ error: 'Product, payment method, and transaction reference are required.' });
      return;
    }

    const product = db.prepare('SELECT * FROM digital_products WHERE id = ?').get(productId) as
      | { id: number; title: string; price_etb: number }
      | undefined;
    if (!product) {
      res.status(404).json({ error: 'Digital product not found.' });
      return;
    }

    const info = db
      .prepare(
        `INSERT INTO digital_orders (product_id, user_id, buyer_name, buyer_email, payment_method, payment_ref, receipt_note, amount_etb, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
      )
      .run(
        productId,
        req.user!.id,
        req.user!.name,
        req.user!.email,
        paymentMethod,
        paymentRef,
        receiptNote || null,
        product.price_etb,
        new Date().toISOString()
      );

    res.status(201).json({
      id: Number(info.lastInsertRowid),
      status: 'pending',
      message: 'Payment receipt submitted. Download unlocks automatically after Administrator approval.',
    });
  });

  app.get('/api/store/my-orders', requireAuth, (req: AuthedRequest, res: Response) => {
    const rows = db
      .prepare(
        `SELECT o.*, p.title as product_title, p.format_info, p.category as product_category
         FROM digital_orders o
         JOIN digital_products p ON o.product_id = p.id
         WHERE o.user_id = ?
         ORDER BY o.created_at DESC`
      )
      .all(req.user!.id);
    res.json({ orders: rows });
  });

  app.get('/api/store/orders/:id/download', requireAuth, (req: AuthedRequest, res: Response) => {
    const order = db
      .prepare(
        `SELECT o.*, p.title, p.format_info, p.deliverable_content
         FROM digital_orders o
         JOIN digital_products p ON o.product_id = p.id
         WHERE o.id = ? AND (o.user_id = ? OR ? = 'admin')`
      )
      .get(Number(req.params.id), req.user!.id, req.user!.role) as
      | { status: string; title: string; deliverable_content: string }
      | undefined;

    if (!order) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }
    if (order.status !== 'approved') {
      res.status(403).json({ error: 'Download is locked until Administrator verifies your payment receipt.' });
      return;
    }

    const filename = `${order.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.type('text/plain').send(`${order.title}\n========================================\n\n${order.deliverable_content}\n`);
  });

  // --- Employer Portal ---
  app.get('/api/employer/jobs', requireAuth, (req: AuthedRequest, res: Response) => {
    if (req.user!.role !== 'employer' && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Employer account required.' });
      return;
    }
    const jobs = db
      .prepare(
        `SELECT j.*, c.name as category_name,
         (SELECT COUNT(*) FROM job_applications a WHERE a.job_id = j.id) as applicant_count
         FROM jobs j
         LEFT JOIN job_categories c ON j.category_id = c.id
         WHERE j.employer_id = ? OR (? = 'admin' AND j.job_origin = 'tatari')
         ORDER BY j.created_at DESC`
      )
      .all(req.user!.id, req.user!.role);

    const applications = db
      .prepare(
        `SELECT a.*, j.title as job_title
         FROM job_applications a
         JOIN jobs j ON a.job_id = j.id
         WHERE j.employer_id = ? OR ? = 'admin'
         ORDER BY a.created_at DESC`
      )
      .all(req.user!.id, req.user!.role);

    res.json({ jobs, applications });
  });

  app.post('/api/employer/jobs', requireAuth, (req: AuthedRequest, res: Response) => {
    if (req.user!.role !== 'employer' && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Employer or Admin account required.' });
      return;
    }
    if (req.user!.role === 'employer' && req.user!.status !== 'approved') {
      res.status(403).json({ error: 'Your Employer TIN verification is pending Administrator approval.' });
      return;
    }

    const title = String(req.body.title || '').trim();
    const companyName = String(req.body.company_name || req.user!.company_name || '').trim();
    const location = String(req.body.location || '').trim();
    const description = String(req.body.description || '').trim();
    const employmentType = String(req.body.employment_type || 'Full-time').trim();
    const salaryMin = req.body.salary_min ? Number(req.body.salary_min) : null;
    const salaryMax = req.body.salary_max ? Number(req.body.salary_max) : null;
    const deadline = String(req.body.application_deadline || '').trim();
    const paymentMethod = String(req.body.payment_method || '').trim();
    const paymentRef = String(req.body.payment_ref || '').trim();
    const categoryId = req.body.category_id ? Number(req.body.category_id) : null;

    if (!title || !companyName || !location || !description || !deadline) {
      res.status(400).json({ error: 'Title, company, location, description, and deadline are required.' });
      return;
    }
    if (req.user!.role === 'employer' && (!paymentMethod || !paymentRef)) {
      res.status(400).json({ error: 'Posting fee payment method and receipt reference are required.' });
      return;
    }

    let finalCategoryId = categoryId;
    if (!finalCategoryId) {
      const catSlug = categorizeJob(title, description);
      const catRow = db.prepare('SELECT id FROM job_categories WHERE slug = ?').get(catSlug) as { id: number } | undefined;
      finalCategoryId = catRow?.id ?? 13;
    }

    const nowIso = new Date().toISOString();
    const deadlineIso = new Date(deadline).toISOString();
    const isAdmin = req.user!.role === 'admin';
    const status = isAdmin ? 'active' : 'pending_review';
    const paymentStatus = isAdmin ? 'verified' : 'pending';
    const slug = buildJobSlug(title, companyName, Date.now().toString(36));
    const dedupeKey = computeDedupeKey({
      sourceId: null,
      title,
      companyName,
      location,
    });

    const info = db
      .prepare(
        `INSERT INTO jobs (
          slug, title, company_name, location, description, category_id, employment_type,
          salary_min, salary_max, salary_currency, application_deadline, job_origin,
          dedupe_key, published_at, expires_at, status, is_featured, employer_id,
          payment_status, payment_method, payment_ref, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ETB', ?, 'tatari', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        slug,
        title,
        companyName,
        location,
        description,
        finalCategoryId,
        employmentType,
        salaryMin,
        salaryMax,
        deadlineIso,
        dedupeKey,
        nowIso,
        deadlineIso,
        status,
        req.body.is_featured ? 1 : 0,
        req.user!.id,
        paymentStatus,
        paymentMethod || 'Admin Direct',
        paymentRef || 'ADMIN-DIRECT',
        nowIso,
        nowIso
      );

    invalidateJobsCache();
    res.status(201).json({
      id: Number(info.lastInsertRowid),
      slug,
      status,
      message: isAdmin
        ? 'Job published directly on Tatari.'
        : 'Job submitted with payment receipt. It will publish live on Tatari once Administrator approves.',
    });
  });

  // --- Admin Governance & Ethiopian Job Aggregation Dashboard ---
  app.get('/api/admin/stats', requireAdmin, (_req: AuthedRequest, res: Response) => {
    expireOutdatedJobs();
    const todayPrefix = new Date().toISOString().split('T')[0];

    const totalJobs = (db.prepare('SELECT COUNT(*) as c FROM jobs').get() as { c: number }).c;
    const externalJobs = (db.prepare("SELECT COUNT(*) as c FROM jobs WHERE job_origin = 'external'").get() as { c: number }).c;
    const tatariJobs = (db.prepare("SELECT COUNT(*) as c FROM jobs WHERE job_origin = 'tatari'").get() as { c: number }).c;
    const activeJobs = (db.prepare("SELECT COUNT(*) as c FROM jobs WHERE status = 'active'").get() as { c: number }).c;
    const expiredJobs = (db.prepare("SELECT COUNT(*) as c FROM jobs WHERE status = 'expired'").get() as { c: number }).c;
    const pendingReviewJobs = (db.prepare("SELECT COUNT(*) as c FROM jobs WHERE status = 'pending_review'").get() as { c: number }).c;
    const activeSources = (db.prepare("SELECT COUNT(*) as c FROM job_sources WHERE status = 'active'").get() as { c: number }).c;
    const jobsCollectedToday = (
      db
        .prepare("SELECT COALESCE(SUM(jobs_added), 0) as c FROM job_collection_logs WHERE collection_started_at LIKE ?")
        .get(`${todayPrefix}%`) as { c: number }
    ).c;
    const failedAttempts = (
      db.prepare("SELECT COUNT(*) as c FROM job_collection_logs WHERE collection_status = 'failed'").get() as { c: number }
    ).c;
    const pendingOrders = (
      db.prepare("SELECT COUNT(*) as c FROM digital_orders WHERE status = 'pending'").get() as { c: number }
    ).c;
    const pendingEmployers = (
      db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'employer' AND status = 'pending'").get() as { c: number }
    ).c;

    res.json({
      stats: {
        totalJobs,
        externalJobs,
        tatariJobs,
        activeJobs,
        expiredJobs,
        pendingReviewJobs,
        activeSources,
        jobsCollectedToday,
        failedAttempts,
        pendingOrders,
        pendingEmployers,
      },
    });
  });

  app.get('/api/admin/sources', requireAdmin, (_req: AuthedRequest, res: Response) => {
    const sources = db
      .prepare(
        `SELECT s.*,
         (SELECT COUNT(*) FROM jobs j WHERE j.source_id = s.id) as total_jobs_collected,
         (SELECT COUNT(*) FROM jobs j WHERE j.source_id = s.id AND j.status = 'active') as active_jobs_count,
         (SELECT collection_status FROM job_collection_logs l WHERE l.source_id = s.id ORDER BY l.id DESC LIMIT 1) as last_run_status
         FROM job_sources s
         ORDER BY s.id ASC`
      )
      .all();
    res.json({ sources });
  });

  app.post('/api/admin/sources', requireAdmin, (req: AuthedRequest, res: Response) => {
    const sourceName = String(req.body.source_name || '').trim();
    const websiteUrl = String(req.body.website_url || '').trim();
    const feedUrl = String(req.body.feed_url || '').trim();
    const method = ['rss', 'json_api', 'html_directory', 'partner_feed'].includes(req.body.collection_method)
      ? req.body.collection_method
      : 'rss';
    const frequency = ['hourly', 'every_6h', 'daily', 'manual'].includes(req.body.collection_frequency)
      ? req.body.collection_frequency
      : 'every_6h';
    const rateLimitMs = Math.max(500, Number(req.body.rate_limit_ms || 1200));

    if (!sourceName || !websiteUrl || !feedUrl) {
      res.status(400).json({ error: 'Source name, website URL, and feed URL are required.' });
      return;
    }

    const nowIso = new Date().toISOString();
    const info = db
      .prepare(
        `INSERT INTO job_sources (source_name, website_url, feed_url, collection_method, collection_frequency, status, robots_respect, rate_limit_ms, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', 1, ?, ?, ?)`
      )
      .run(sourceName, websiteUrl, feedUrl, method, frequency, rateLimitMs, nowIso, nowIso);

    logAudit(req.user!.email, 'CREATE_SOURCE', 'job_source', Number(info.lastInsertRowid), `Added ${sourceName} (${method})`);
    res.status(201).json({ id: Number(info.lastInsertRowid) });
  });

  app.patch('/api/admin/sources/:id', requireAdmin, (req: AuthedRequest, res: Response) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM job_sources WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Source not found.' });
      return;
    }

    const status = ['active', 'paused', 'error'].includes(req.body.status) ? req.body.status : existing.status;
    const frequency = ['hourly', 'every_6h', 'daily', 'manual'].includes(req.body.collection_frequency)
      ? req.body.collection_frequency
      : existing.collection_frequency;
    const method = ['rss', 'json_api', 'html_directory', 'partner_feed'].includes(req.body.collection_method)
      ? req.body.collection_method
      : existing.collection_method;
    const feedUrl = req.body.feed_url ? String(req.body.feed_url).trim() : existing.feed_url;
    const sourceName = req.body.source_name ? String(req.body.source_name).trim() : existing.source_name;

    db.prepare(
      `UPDATE job_sources SET source_name = ?, feed_url = ?, collection_method = ?, collection_frequency = ?, status = ?, updated_at = ? WHERE id = ?`
    ).run(sourceName, feedUrl, method, frequency, status, new Date().toISOString(), id);

    logAudit(req.user!.email, 'UPDATE_SOURCE', 'job_source', id, `Status=${status}, Freq=${frequency}`);
    res.json({ ok: true });
  });

  app.delete('/api/admin/sources/:id', requireAdmin, (req: AuthedRequest, res: Response) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM job_sources WHERE id = ?').run(id);
    invalidateJobsCache();
    logAudit(req.user!.email, 'DELETE_SOURCE', 'job_source', id, 'Deleted external source');
    res.json({ deleted: true });
  });

  app.post('/api/admin/sources/:id/collect', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      const autoApprove = req.body.auto_approve !== false;
      const result = await runCollectionForSource(id, autoApprove);
      invalidateJobsCache();
      logAudit(
        req.user!.email,
        'TRIGGER_COLLECTION',
        'job_source',
        id,
        `Status=${result.status}, Found=${result.jobsFound}, Added=${result.jobsAdded}, Dupes=${result.duplicatesFound}`
      );
      res.json({ result });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Collection failed' });
    }
  });

  app.post('/api/admin/sources/collect-all', requireAdmin, async (req: AuthedRequest, res: Response) => {
    const activeSources = db
      .prepare("SELECT id, source_name FROM job_sources WHERE status != 'paused'")
      .all() as Array<{ id: number; source_name: string }>;
    const results = [];
    for (const src of activeSources) {
      const r = await runCollectionForSource(src.id, req.body.auto_approve !== false);
      results.push({ source_id: src.id, source_name: src.source_name, ...r });
    }
    invalidateJobsCache();
    logAudit(req.user!.email, 'TRIGGER_ALL_COLLECTIONS', 'job_source', 'all', `Ran ${results.length} sources`);
    res.json({ results });
  });

  app.get('/api/admin/logs', requireAdmin, (_req: AuthedRequest, res: Response) => {
    const logs = db
      .prepare(
        `SELECT l.*, s.source_name, s.collection_method
         FROM job_collection_logs l
         JOIN job_sources s ON l.source_id = s.id
         ORDER BY l.id DESC LIMIT 100`
      )
      .all();
    res.json({ logs });
  });

  app.get('/api/admin/jobs', requireAdmin, (req: AuthedRequest, res: Response) => {
    const status = String(req.query.status || '').trim();
    const origin = String(req.query.origin || '').trim();
    const where: string[] = [];
    const params: unknown[] = [];
    if (status) {
      where.push('j.status = ?');
      params.push(status);
    }
    if (origin) {
      where.push('j.job_origin = ?');
      params.push(origin);
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const jobs = db
      .prepare(
        `SELECT j.*, c.name as category_name, s.source_name
         FROM jobs j
         LEFT JOIN job_categories c ON j.category_id = c.id
         LEFT JOIN job_sources s ON j.source_id = s.id
         ${whereSql}
         ORDER BY j.created_at DESC LIMIT 200`
      )
      .all(...params);
    res.json({ jobs });
  });

  app.patch('/api/admin/jobs/:id', requireAdmin, (req: AuthedRequest, res: Response) => {
    const id = Number(req.params.id);
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!job) {
      res.status(404).json({ error: 'Job not found.' });
      return;
    }

    const status = ['active', 'pending_review', 'rejected', 'expired'].includes(req.body.status)
      ? req.body.status
      : job.status;
    const categoryId = req.body.category_id ? Number(req.body.category_id) : job.category_id;
    const title = req.body.title ? String(req.body.title).trim() : job.title;
    const location = req.body.location ? String(req.body.location).trim() : job.location;
    const isFeatured = req.body.is_featured !== undefined ? (req.body.is_featured ? 1 : 0) : job.is_featured;
    const paymentStatus =
      status === 'active' && job.job_origin === 'tatari' ? 'verified' : job.payment_status;

    db.prepare(
      `UPDATE jobs SET title = ?, location = ?, category_id = ?, status = ?, is_featured = ?, payment_status = ?, updated_at = ? WHERE id = ?`
    ).run(title, location, categoryId, status, isFeatured, paymentStatus, new Date().toISOString(), id);

    invalidateJobsCache();
    logAudit(req.user!.email, 'UPDATE_JOB', 'job', id, `Status=${status}, Category=${categoryId}`);
    res.json({ ok: true });
  });

  app.delete('/api/admin/jobs/:id', requireAdmin, (req: AuthedRequest, res: Response) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM jobs WHERE id = ?').run(id);
    invalidateJobsCache();
    logAudit(req.user!.email, 'DELETE_JOB', 'job', id, 'Removed listing');
    res.json({ deleted: true });
  });

  app.post('/api/admin/jobs/dedupe', requireAdmin, (req: AuthedRequest, res: Response) => {
    const rows = db
      .prepare('SELECT id, dedupe_key, status, created_at FROM jobs ORDER BY id ASC')
      .all() as Array<{ id: number; dedupe_key: string; status: string }>;

    const seen = new Map<string, number>();
    const dupeIds: number[] = [];
    for (const row of rows) {
      if (seen.has(row.dedupe_key)) {
        dupeIds.push(row.id);
      } else {
        seen.set(row.dedupe_key, row.id);
      }
    }

    if (dupeIds.length > 0) {
      const del = db.prepare('DELETE FROM jobs WHERE id = ?');
      for (const id of dupeIds) del.run(id);
      invalidateJobsCache();
    }
    logAudit(req.user!.email, 'DEDUPLICATE_JOBS', 'job', 'batch', `Removed ${dupeIds.length} duplicate postings`);
    res.json({ removed: dupeIds.length });
  });

  app.post('/api/admin/jobs/verify-links', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const result = await verifyAndPruneExternalLinks();
      invalidateJobsCache();
      logAudit(
        req.user!.email,
        'VERIFY_EXTERNAL_LINKS',
        'job',
        'batch',
        `Checked=${result.checked}, ExpiredBroken=${result.expiredCount}`
      );
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Link verification failed' });
    }
  });

  app.get('/api/admin/payments', requireAdmin, (_req: AuthedRequest, res: Response) => {
    const storeOrders = db
      .prepare(
        `SELECT o.*, p.title as item_title, 'store_order' as payment_type
         FROM digital_orders o
         JOIN digital_products p ON o.product_id = p.id
         ORDER BY CASE WHEN o.status = 'pending' THEN 0 ELSE 1 END, o.created_at DESC`
      )
      .all();

    const employerJobs = db
      .prepare(
        `SELECT j.id, j.title as item_title, j.company_name as buyer_name, u.email as buyer_email,
                j.payment_method, j.payment_ref, j.payment_status as status, j.created_at, 'job_posting' as payment_type
         FROM jobs j
         LEFT JOIN users u ON j.employer_id = u.id
         WHERE j.job_origin = 'tatari' AND j.payment_status != 'not_required'
         ORDER BY CASE WHEN j.payment_status = 'pending' THEN 0 ELSE 1 END, j.created_at DESC`
      )
      .all();

    res.json({ storeOrders, employerJobs });
  });

  app.patch('/api/admin/payments/:type/:id', requireAdmin, (req: AuthedRequest, res: Response) => {
    const { type, id } = req.params;
    const decision = req.body.decision === 'approved' ? 'approved' : 'rejected';
    const reason = req.body.reason ? String(req.body.reason).trim() : null;
    const nowIso = new Date().toISOString();

    if (type === 'store_order') {
      db.prepare(
        'UPDATE digital_orders SET status = ?, rejection_reason = ?, verified_at = ? WHERE id = ?'
      ).run(decision, reason, nowIso, Number(id));
      logAudit(req.user!.email, `STORE_ORDER_${decision.toUpperCase()}`, 'digital_order', id, reason || 'Verified');
      res.json({ ok: true });
      return;
    }

    if (type === 'job_posting') {
      const nextJobStatus = decision === 'approved' ? 'active' : 'rejected';
      const nextPayStatus = decision === 'approved' ? 'verified' : 'rejected';
      db.prepare(
        'UPDATE jobs SET status = ?, payment_status = ?, rejection_reason = ?, updated_at = ? WHERE id = ?'
      ).run(nextJobStatus, nextPayStatus, reason, nowIso, Number(id));
      invalidateJobsCache();
      logAudit(req.user!.email, `JOB_PAYMENT_${decision.toUpperCase()}`, 'job', id, reason || 'Verified');
      res.json({ ok: true });
      return;
    }

    res.status(400).json({ error: 'Invalid payment verification type.' });
  });

  app.get('/api/admin/employers', requireAdmin, (_req: AuthedRequest, res: Response) => {
    const employers = db
      .prepare(
        `SELECT id, name, email, company_name, business_tin, status, created_at
         FROM users WHERE role = 'employer'
         ORDER BY CASE WHEN status = 'pending' THEN 0 ELSE 1 END, created_at DESC`
      )
      .all();
    res.json({ employers });
  });

  app.patch('/api/admin/employers/:id', requireAdmin, (req: AuthedRequest, res: Response) => {
    const status = ['approved', 'pending', 'suspended'].includes(req.body.status) ? req.body.status : 'approved';
    db.prepare('UPDATE users SET status = ? WHERE id = ? AND role = ?').run(
      status,
      Number(req.params.id),
      'employer'
    );
    logAudit(req.user!.email, 'EMPLOYER_STATUS', 'user', req.params.id, `Status=${status}`);
    res.json({ ok: true });
  });

  app.get('/api/admin/audit-logs', requireAdmin, (_req: AuthedRequest, res: Response) => {
    const logs = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100').all();
    res.json({ logs });
  });

  app.get('/api/download/tatari-upgraded.zip', (_req: Request, res: Response) => {
    const zipCandidates = [
      path.resolve('/.aistudio/artifacts/tatari-upgraded.zip'),
      path.resolve(process.cwd(), 'tatari-upgraded.zip'),
      path.resolve('/tmp/tatari-upgraded.zip'),
    ];
    const found = zipCandidates.find((p) => fs.existsSync(p));
    if (!found) {
      res.status(404).json({ error: 'Project ZIP archive has not been generated yet.' });
      return;
    }
    res.download(found, 'tatari-upgraded.zip');
  });

  // --- Vite / Static Serving ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TATARI server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start TATARI server:', err);
  process.exit(1);
});
