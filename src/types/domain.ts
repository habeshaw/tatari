export type Language = 'en' | 'am';

export type UserRole = 'seeker' | 'employer' | 'admin';

export type AccountStatus = 'pending' | 'approved' | 'suspended';

export type AppView = 'jobs' | 'training' | 'store' | 'activity' | 'employer' | 'admin';

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
  sourceType?: 'tatari' | 'external';
  sourceSite?: string;
  sourceDomain?: string;
  sourceUrl?: string;
  fetchedAt?: string;
}

export type ExternalJobSourceId = 'ethiojobs' | 'geezjobs' | 'effoysira';

export interface ExternalJobSourceStatus {
  id: ExternalJobSourceId;
  name: string;
  domain: string;
  homeUrl: string;
  status: 'ok' | 'error';
  fetchedCount: number;
  errorMessage?: string;
  lastSyncedAt: string;
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
  sourceFilter?: string;
}

export interface ProductFilterCriteria {
  query: string;
  category: string;
  maxPrice: number;
  sortBy?: ProductSortOption;
}

export type TrainingCategory =
  | 'Data & Power BI'
  | 'Payroll & HR Systems'
  | 'Finance & IFRS'
  | 'Leadership & Org Design'
  | 'Digital Transformation';

export type TrainingDeliveryMode =
  | 'On-Site (Your Premises)'
  | 'Live Virtual'
  | 'Hybrid Blended'
  | 'TATARI Training Hub (Addis Ababa)';

export type TrainingProposalStatus =
  | 'Submitted'
  | 'Scoped & Quoted'
  | 'Approved & Scheduled'
  | 'Completed'
  | 'Declined';

export interface TrainingProgram {
  id: string;
  titleEn: string;
  titleAm?: string;
  category: TrainingCategory;
  durationDays: number;
  durationLabel: string;
  targetAudience: string;
  feePerCohortEtb: number;
  maxParticipants: number;
  deliveryModes: TrainingDeliveryMode[];
  sectorFocus: string[];
  summaryEn: string;
  syllabusModules: string[];
  deliverables: string[];
  active: boolean;
  createdAt: string;
}

export interface TrainingRequest {
  id: string;
  requesterEmail: string;
  organizationName: string;
  organizationSector: string;
  contactPerson: string;
  phone: string;
  programId: string;
  programTitle: string;
  customTopics: string;
  teamSize: number;
  deliveryMode: TrainingDeliveryMode;
  preferredDates: string;
  locationCity: string;
  estimatedFeeEtb: number;
  status: TrainingProposalStatus;
  trainerAssigned?: string;
  proposalNotes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TrainingFilterCriteria {
  query: string;
  category: string;
  deliveryMode: string;
}

