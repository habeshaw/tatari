# TATARI — Ethiopian Job Discovery, Digital Store & Organizational Training

A full-featured Indeed-style job board, live Ethiopian job posting aggregator, certified digital material storefront with **payment receipt submission and Administrator approval gating**, and **TATARI Academy** tailored organizational training service.

## Key Features

- **Ethiopian Job Posting Websites Aggregator**: Automatically collects live vacancies via `/api/external-jobs` from **Ethiojobs**, **GeezJobs**, and **EffoySira** alongside TATARI Administrator-verified listings. Displays the original source name, domain, and exact source URL so jobseekers can redirect directly to the original posting (`target="_blank" rel="noopener noreferrer"`).
- **Indeed-Style Job Search & Master-Detail Board**: Dual "What" & "Where" search, multi-criteria filtering (source portal filter, date posted, job type, category, remote mode, minimum salary in ETB), sticky right-hand job detail pane, Easy Apply workflow, and Saved Jobs.
- **Tailored Organizational Training Service (`TATARI Academy`)**: Dedicated corporate training catalog with search/category/delivery filters, master-detail syllabus & deliverables view, organization-specific tailoring (`Banking / MFI`, `NGO / Development`, `Manufacturing`, `Technology`, `Healthcare`, `Public Sector`, etc.), live ETB cohort pricing calculator, downloadable HTML proposal briefs, user proposal tracking, and full Admin scoping, trainer assignment, and curriculum CRUD.
- **Digital Store with Payment-Gated Downloads**: Curated business, payroll, HR, and career toolkits. Buyers submit a Telebirr / CBE Bank Transfer / CBE Birr payment reference and receipt proof. Downloads remain locked until verified and approved by the Administrator.
- **Employer Job Posting with Payment Approval**: Employers compose job vacancies and submit the posting fee receipt. Jobs stay in `Pending Admin Approval` until the Administrator verifies payment, upon which the job publishes live to the Job Board.
- **Administrator Governance Console**: Unified Payment Receipt Verification Queue (approve or reject with reason), Job Postings Moderation & External Feed Monitor, Digital Store Catalog Manager, Training Proposals & Curriculum CRUD, Help Center, and User & Audit Ledger with CSV export.
- **Bilingual Support**: Instant English (`EN`) and Amharic (`አማ`) interface switching.

## Role-Based Security & Registration Policy
- **Job Seekers**: Visitors can browse and search all approved job vacancies without pre-registering. When applying for a specific job, the Job Seeker registers their account simultaneously inside the application flow (or signs in if already registered).
- **Registered Activity Gate**: Bookmarking jobs, accessing `Saved & Orders`, purchasing/downloading Digital Store materials, posting vacancies, and moderating platform content require an authenticated registered account.
- **Employer Verification**: Employers must register with Company Name and Business TIN / License Number and remain `pending` until verified and approved by the Administrator.
- **Administrator Governance**: Protected by SHA-256 salted credential verification and 5-attempt failed-login lockout protection.

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
   git commit -m "Deploy TATARI Job Portal and Digital Store"
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
