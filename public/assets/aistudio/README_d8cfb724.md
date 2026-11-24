# ADEY — Ethiopian Foreign Exchange Intelligence & Historical Analytics Platform

Production-grade platform for capturing daily/historical foreign exchange rates across NBE and commercial banks, performing advanced market analytics (volatility, spreads, historical trends), and exporting professional reports in Excel and PDF.

## Quick Setup Instructions
1. **Supabase Database**: Run `database/schema.sql` and `database/rls_policies.sql` in your Supabase SQL Editor.
2. **Environment Variables on Vercel**: Configure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
3. **Deploy**: Push to GitHub and import into Vercel.
