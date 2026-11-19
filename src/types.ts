export type UserRole = 'admin' | 'employer' | 'seeker';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  company_name: string | null;
  business_tin: string | null;
  status: 'approved' | 'pending' | 'suspended';
}

export interface JobCategory {
  id: number;
  name: string;
  slug: string;
  active_count?: number;
}

export interface PublicSource {
  id: number;
  source_name: string;
  website_url: string;
  active_count: number;
}

export interface JobItem {
  id: number;
  slug: string;
  title: string;
  company_name: string;
  company_logo: string | null;
  location: string;
  description: string;
  category_id: number;
  category_name: string;
  category_slug: string;
  employment_type: 'Full-time' | 'Part-time' | 'Contract' | 'Internship' | 'Consultancy';
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  application_deadline: string | null;
  source_id: number | null;
  source_name: string | null;
  source_website_url: string | null;
  original_job_url: string | null;
  job_origin: 'external' | 'tatari';
  original_job_identifier: string | null;
  published_at: string;
  expires_at: string | null;
  status: 'active' | 'pending_review' | 'rejected' | 'expired';
  is_featured: number;
  expiring_soon?: boolean;
  views_count?: number;
  payment_status?: string;
}

export interface JobSource {
  id: number;
  source_name: string;
  website_url: string;
  feed_url: string;
  collection_method: 'rss' | 'json_api' | 'html_directory' | 'partner_feed';
  collection_frequency: 'hourly' | 'every_6h' | 'daily' | 'manual';
  status: 'active' | 'paused' | 'error';
  rate_limit_ms: number;
  last_collected_at: string | null;
  total_jobs_collected: number;
  active_jobs_count: number;
  last_run_status: string | null;
}

export interface CollectionLog {
  id: number;
  source_id: number;
  source_name: string;
  collection_method: string;
  collection_started_at: string;
  collection_completed_at: string | null;
  jobs_found: number;
  jobs_added: number;
  jobs_updated: number;
  duplicates_found: number;
  errors: string | null;
  collection_status: 'success' | 'partial' | 'failed' | 'running';
}

export interface AdminStats {
  totalJobs: number;
  externalJobs: number;
  tatariJobs: number;
  activeJobs: number;
  expiredJobs: number;
  pendingReviewJobs: number;
  activeSources: number;
  jobsCollectedToday: number;
  failedAttempts: number;
  pendingOrders: number;
  pendingEmployers: number;
}

export interface DigitalProduct {
  id: number;
  title: string;
  category: string;
  description: string;
  price_etb: number;
  format_info: string;
  image_url: string;
  status: string;
}

export interface DigitalOrder {
  id: number;
  product_id: number;
  product_title: string;
  format_info: string;
  product_category: string;
  buyer_name: string;
  buyer_email: string;
  payment_method: string;
  payment_ref: string;
  receipt_note: string | null;
  amount_etb: number;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
  verified_at: string | null;
}

export interface JobAlert {
  id: number;
  category_id: number | null;
  category_name: string | null;
  location: string | null;
  keywords: string | null;
  job_origin_pref: 'all' | 'external' | 'tatari';
  frequency: 'instant' | 'daily';
  active: number;
  created_at: string;
}

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  link_slug: string | null;
  is_read: number;
  created_at: string;
}
