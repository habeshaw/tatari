# TATARI — Job Search Portal & Digital Store

A full-featured Indeed-style job board and certified digital material storefront with **payment receipt submission and Administrator approval gating** (materials unlock for download and employer job posts publish live only after Administrator verification of payment).

## Key Features

- **Indeed-Style Job Search & Master-Detail Board**: Dual "What" & "Where" search, multi-criteria filtering (date posted, job type, category, remote mode, minimum salary in ETB), sticky right-hand job detail pane, Easy Apply workflow, and Saved Jobs.
- **Digital Store with Payment-Gated Downloads**: Curated business, payroll, HR, and career toolkits. Buyers submit a Telebirr / CBE Bank Transfer / CBE Birr payment reference and receipt proof. Downloads remain locked until verified and approved by the Administrator.
- **Employer Job Posting with Payment Approval**: Employers compose job vacancies and submit the posting fee receipt. Jobs stay in `Pending Admin Approval` until the Administrator verifies payment, upon which the job publishes live to the Job Board.
- **Administrator Governance Console**: Unified Payment Receipt Verification Queue (approve or reject with reason), Job Postings Moderation, Digital Store Catalog Manager, and User & Audit Ledger with CSV export.
- **Bilingual Support**: Instant English (`EN`) and Amharic (`አማ`) interface switching.

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
