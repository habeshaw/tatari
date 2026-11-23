# TATARI — Ethiopian Job Aggregation Portal & Digital Store

A centralized Ethiopian job discovery platform and certified digital material storefront that collects job links from multiple Ethiopian job websites while preserving Tatari's direct employer postings, Telebirr/CBE payment-gated Digital Store, and Administrator governance.

## Key Features

- **Ethiopian Job Aggregation System**: Automatically collects live vacancies via RSS/Atom feeds, JSON APIs, and `robots.txt`-compliant directory parsing from **Ethiojobs**, **GeezJobs**, **Ezega Jobs**, **EthiopianWork**, and custom admin-configured Ethiopian sources. Every external job URL is HTTP-verified before publishing so only active, working direct job links appear.
- **Strict Origin Separation & Exact Original Website Links**:
  - **External Aggregated Jobs**: Clearly labeled with their original platform (`Source: Ethiojobs`, etc.), display the exact original posting URL, and open the original website safely in a new tab (`target="_blank" rel="noopener noreferrer"`) when visitors click **View Original Job** or **Apply on Original Website**.
  - **Tatari-Published Jobs**: Marked **Published on Tatari**, open full details on Tatari, and support direct internal applications with inline Job Seeker registration.
- **Indeed-Style Search & Multi-Filtering**: Search by job title/company/location and filter by job origin (`External Platforms` vs `Published on Tatari`), category, Ethiopian job source, employment type, minimum ETB salary, publication date, featured, and expiring soon.
- **Digital Store with Payment-Gated Downloads**: Business, Ethiopian payroll, HR compliance, and career toolkits unlocked after Administrator approval of Telebirr / CBE Bank Transfer receipts.
- **Employer Job Posting with Payment Approval**: Verified employers (with Business TIN / License) submit direct Tatari job postings with payment receipts for Administrator approval.
- **Administrator Governance Console**: Manage Ethiopian job sources and schedules, trigger manual/batch collections, review and deduplicate collected vacancies, inspect error logs with CSV export, and verify payments/employers.
- **Bilingual Support & SEO**: Instant English (`EN`) and Amharic (`አማ`) UI switching, dynamic `/sitemap.xml`, `/robots.txt`, `/jobs/:slug` pages, and conditional `JobPosting` JSON-LD strictly for active Tatari-originated jobs.

### Default Seeded Evaluation Accounts
| Role | Email | Password |
| :--- | :--- | :--- |
| Administrator | `admin@tatari.et` | `TatariAdmin#2026` |
| Approved Employer | `hr@addistech.et` | `Employer@2026` |
| Job Seeker | `abebe@tatari.et` | `Seeker@2026` |

## Deployment Guide (GitHub + Supabase + Vercel)

### 1. Supabase Setup
1. Create or open your Supabase project.
2. Open the **SQL Editor** and execute the entire contents of `supabase/schema.sql`.
3. Copy your **Project URL** and **Anon / Publishable Key** from **Project Settings -> API**.

### 2. GitHub Repository
1. Push this codebase to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Deploy TATARI Ethiopian Job Aggregator and Digital Store"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```

### 3. Vercel Deployment
1. Import the GitHub repository in **Vercel**.
2. Framework Preset: **Vite** (`npm run build`, output directory: `dist`).
3. Add Environment Variables in Vercel:
   - `VITE_SUPABASE_URL` = your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase Anon / Publishable Key
4. Deploy. `vercel.json` is preconfigured for clean URLs and SPA routing.

### 4. Local Full-Stack Development
```bash
npm install
npm run dev
```
Runs the Express + SQLite Ethiopian job aggregator backend alongside Vite on `http://localhost:3000`.
