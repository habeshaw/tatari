export type Language = 'en' | 'am';

export type UserRole = 'seeker' | 'employer' | 'admin';

export type AccountStatus = 'pending' | 'approved' | 'suspended';

export type AppView = 'jobs' | 'store' | 'activity' | 'employer' | 'admin';

export type JobType = 'Full-time' | 'Part-time' | 'Contract' | 'Internship';

export type RemoteType = 'On-site' | 'Hybrid' | 'Remote';

export type JobPostingTier = 'standard' | 'featured' | 'enterprise';

export type JobModerationStatus = 'pending_approval' | 'approved' | 'rejected' | 'paused';

export type ApplicationStage =
  | 'Submitted'
  | 'Under Review'
  | 'Shortlisted'
  | 'Interview'
  | 'Hired'
  | 'Rejected';

export type PaymentMethod = 'Telebirr' | 'CBE Bank Transfer' | 'CBE Birr' | 'AwashBirr';

export type PaymentVerificationStatus = 'pending_verification' | 'verified' | 'rejected';

export type OrderApprovalStatus = 'pending_approval' | 'approved' | 'rejected';

export interface UserProfile {
  email: string;
  fullName: string;
  companyName?: string;
  tinNumber?: string;
  phone?: string;
  headline?: string;
  defaultResumeUrl?: string;
  role: UserRole;
  status: AccountStatus;
  passwordHash: string;
  lastLoginAt?: string;
  updatedAt?: string;
  createdAt: string;
}

export interface JobListing {
  id: string;
  employerEmail: string;
  titleEn: string;
  titleAm?: string;
  companyName: string;
  companyRating: number;
  location: string;
  remoteType: RemoteType;
  category: string;
  jobType: JobType;
  experienceLevel: string;
  salaryMin: number;
  salaryMax: number;
  salaryDisplay: string;
  deadline: string;
  summaryEn: string;
  descriptionEn: string;
  descriptionAm?: string;
  requirements: string[];
  benefits: string[];
  easyApply: boolean;
  tierId?: JobPostingTier;
  tierName?: string;
  isFeatured?: boolean;
  postingFeeEtb: number;
  paymentReceiptId?: string;
  status: JobModerationStatus;
  rejectionReason?: string;
  createdAt: string;
  publishedAt?: string;
}

export interface JobApplication {
  id: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  applicantName: string;
  applicantEmail: string;
  phone: string;
  resumeUrl: string;
  coverNote: string;
  yearsExperience: string;
  status: ApplicationStage;
  createdAt: string;
}

export interface DigitalProduct {
  id: string;
  sellerEmail: string;
  titleEn: string;
  titleAm?: string;
  category: string;
  priceEtb: number;
  fileFormat: string;
  fileSize: string;
  version: string;
  imageUrl?: string;
  descriptionEn: string;
  descriptionAm?: string;
  includedFiles: string[];
  active: boolean;
  createdAt: string;
}

export interface MaterialOrder {
  id: string;
  productId: string;
  productTitle: string;
  buyerEmail: string;
  buyerName: string;
  subtotalEtb?: number;
  discountEtb?: number;
  vatEtb?: number;
  promoCode?: string;
  amountEtb: number;
  invoiceNumber?: string;
  paymentReceiptId: string;
  paymentStatus: PaymentVerificationStatus;
  status: OrderApprovalStatus;
  rejectionReason?: string;
  createdAt: string;
  approvedAt?: string;
}

export interface PaymentReceipt {
  id: string;
  targetType: 'job_post' | 'digital_material';
  targetId: string;
  targetTitle: string;
  payerEmail: string;
  payerName: string;
  payerPhone: string;
  paymentMethod: PaymentMethod;
  transactionRef: string;
  subtotalEtb?: number;
  discountEtb?: number;
  vatEtb?: number;
  promoCode?: string;
  amountEtb: number;
  invoiceNumber?: string;
  receiptNote?: string;
  receiptImageData?: string;
  status: PaymentVerificationStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  userEmail: string;
  actionType: string;
  details: string;
  createdAt: string;
}

export interface ProductReview {
  id: string;
  productId: string;
  reviewerEmail: string;
  reviewerName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export type ProductSortOption = 'newest' | 'price_asc' | 'price_desc' | 'top_rated';

export interface JobFilterCriteria {
  what: string;
  where: string;
  category: string;
  jobType: string;
  remoteType: string;
  minSalary: number;
  postedWithinDays: number;
}

export interface ProductFilterCriteria {
  query: string;
  category: string;
  maxPrice: number;
  sortBy?: ProductSortOption;
}
