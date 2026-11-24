export type Language = 'en' | 'am';

export type UserRole = 'seeker' | 'employer' | 'admin';

export type AccountStatus = 'pending' | 'approved' | 'suspended';

export type AppView =
  | 'news'
  | 'capital_market'
  | 'jobs'
  | 'ai_studio'
  | 'fx'
  | 'opportunities'
  | 'training'
  | 'store'
  | 'activity'
  | 'employer'
  | 'admin';

export type JobType = 'Full-time' | 'Part-time' | 'Contract' | 'Internship';

export type RemoteType = 'On-site' | 'Hybrid' | 'Remote';

export type JobPostingTier = 'standard' | 'featured' | 'enterprise';

export type JobModerationStatus = 'pending_approval' | 'approved' | 'rejected' | 'paused';

export type DataVerificationStatus =
  | 'New'
  | 'Verified'
  | 'Updated'
  | 'Pending verification'
  | 'Stale'
  | 'Unverified'
  | 'Expired'
  | 'Closed'
  | 'Source unavailable'
  | 'Removed';

export type ApplicationStage =
  | 'Submitted'
  | 'Under Review'
  | 'Shortlisted'
  | 'Interview'
  | 'Offered'
  | 'Hired'
  | 'Rejected';

export type PaymentMethod = 'Telebirr' | 'CBE Bank Transfer' | 'CBE Birr' | 'AwashBirr';

export type PaymentVerificationStatus = 'pending_verification' | 'verified' | 'rejected';

export type OrderApprovalStatus = 'pending_approval' | 'approved' | 'rejected';

export interface CandidateExperienceItem {
  id: string;
  title: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  current?: boolean;
  summary: string;
}

export interface CandidateEducationItem {
  id: string;
  degree: string;
  institution: string;
  fieldOfStudy: string;
  graduationYear: string;
}

export interface CandidateResumeFile {
  id: string;
  fileName: string;
  fileType: 'pdf' | 'docx' | 'txt';
  fileSizeBytes: number;
  uploadedAt: string;
  extractedText: string;
  isPrimary?: boolean;
}

export interface UserProfile {
  email: string;
  fullName: string;
  companyName?: string;
  tinNumber?: string;
  phone?: string;
  headline?: string;
  location?: string;
  bio?: string;
  avatarDataUrl?: string;
  skills?: string[];
  languages?: string[];
  certifications?: string[];
  careerInterests?: string[];
  yearsExperience?: number;
  experience?: CandidateExperienceItem[];
  education?: CandidateEducationItem[];
  resumes?: CandidateResumeFile[];
  defaultResumeUrl?: string;
  companyWebsite?: string;
  companyLocation?: string;
  companyDescription?: string;
  companyLogoDataUrl?: string;
  isRecruitmentAgency?: boolean;
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
  lastVerifiedAt?: string;
  verificationStatus?: DataVerificationStatus;
  isExpired?: boolean;
  isDemoSeed?: boolean;
  fingerprint?: string;
  skills?: string[];
  industry?: string;
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
  resumeId?: string;
  resumeFileName?: string;
  resumeText?: string;
  coverNote: string;
  yearsExperience: string;
  status: ApplicationStage;
  aiMatchScore?: number;
  aiMatchSummary?: string;
  humanDecisionOverride?: string;
  createdAt: string;
  updatedAt?: string;
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

// ============================================================================
// MODULE B: ETHIOPIAN BANK FOREIGN EXCHANGE AGGREGATOR TYPES
// ============================================================================

export type BankFxRateCategory =
  | 'cash'
  | 'transaction'
  | 'weighted_average'
  | 'nbe_reference';

export interface BankFxRateRecord {
  id: string;
  bankId: string;
  bankName: string;
  bankShortName: string;
  isCentralBank: boolean;
  currencyCode: string;
  currencyName: string;
  rateCategory: BankFxRateCategory;
  buyingRate: number | null;
  sellingRate: number | null;
  buyingPrecisionText?: string;
  sellingPrecisionText?: string;
  midRate: number | null;
  spreadPct: number | null;
  dailyChangeBuy: number | null;
  dailyChangeSell: number | null;
  publishedDate: string | null;
  collectedAt: string;
  lastVerifiedAt: string;
  sourceUrl: string;
  sourceType: 'official_api' | 'official_html_table' | 'admin_override';
  verificationStatus: 'Verified' | 'Stale' | 'Unverified';
  freshness: 'Fresh' | 'Stale' | 'Outdated';
  anomalyFlagged?: boolean;
  anomalyReason?: string;
  manuallyCorrected?: boolean;
  originalExtractedBuying?: number | null;
  originalExtractedSelling?: number | null;
}

export interface BankFxHistoryPoint {
  id: string;
  bankId: string;
  currencyCode: string;
  rateCategory: BankFxRateCategory;
  buyingRate: number | null;
  sellingRate: number | null;
  publishedDate: string | null;
  recordedAt: string;
  sourceUrl: string;
}

export interface BankFxSourceStatus {
  bankId: string;
  bankName: string;
  bankShortName: string;
  isCentralBank: boolean;
  officialWebsite: string;
  fxPageUrl: string;
  method: 'official_api' | 'official_html_table' | 'js_rendered' | 'unreachable_blocked';
  status: 'Verified' | 'Stale' | 'Collection failed' | 'Source unavailable';
  currenciesCollected: number;
  publishedDate: string | null;
  lastCheckedAt: string;
  lastSuccessAt?: string | null;
  errorMessage?: string;
}

export interface NbeIndicativeMidRate {
  price: number;
  dateText: string;
  sourceUrl: string;
  collectedAt: string;
}

export interface BankFxApiResponse {
  rates: BankFxRateRecord[];
  history: BankFxHistoryPoint[];
  bankStatuses: BankFxSourceStatus[];
  nbeIndicativeMid: NbeIndicativeMidRate | null;
  syncedAt: string;
  cached?: boolean;
}

// ============================================================================
// MODULES C–P: CENTRALIZED OPPORTUNITY & INFORMATION AGGREGATION TYPES
// ============================================================================

export type OpportunityModuleType =
  | 'tenders'
  | 'scholarships'
  | 'grants'
  | 'internships'
  | 'training_external'
  | 'events'
  | 'public_announcements'
  | 'agriculture'
  | 'trade'
  | 'business_directory'
  | 'real_estate'
  | 'vehicles'
  | 'certifications';

export interface AggregatedOpportunity {
  id: string;
  module: OpportunityModuleType;
  title: string;
  organization: string;
  referenceNumber: string;
  category: string;
  location: string;
  eligibilityOrCoverage: string;
  priceOrFunding: string;
  deadline: string;
  publishedAt: string | null;
  collectedAt: string;
  lastVerifiedAt: string;
  sourceId: string;
  sourceName: string;
  sourceDomain: string;
  sourceUrl: string;
  summary: string;
  verificationStatus: DataVerificationStatus;
  isExpired: boolean;
  fingerprint: string;
  duplicateOfId?: string;
  manuallyCorrected?: boolean;
  manuallyVerified?: boolean;
  originalValues?: {
    title?: string;
    organization?: string;
    deadline?: string;
  };
}

export type SourceCollectionMethod =
  | 'official_api'
  | 'wp_rest_json'
  | 'inertia_json'
  | 'html_table'
  | 'html_cards'
  | 'rss_xml'
  | 'rss_atom'
  | 'unavailable';

export interface AggregationSourceRecord {
  id: string;
  name: string;
  domain: string;
  url: string;
  feedUrl: string;
  module: OpportunityModuleType | 'jobs' | 'fx';
  method: SourceCollectionMethod;
  frequencyLabel: string;
  termsNote: string;
  active: boolean;
  status: 'Verified' | 'Stale' | 'Collection failed' | 'Source unavailable' | 'Paused' | 'Unverified';
  fetchedCount: number;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError?: string;
  isCustom?: boolean;
}

export interface CollectionRunEntry {
  id: string;
  startedAt: string;
  completedAt: string;
  scope: 'all' | 'jobs' | 'fx' | 'opportunities' | 'news' | 'capital_market' | 'single';
  itemsCollected: number;
  duplicatesSkipped: number;
  failedSources: number;
  durationMs: number;
  status: 'success' | 'partial' | 'failed';
}

export interface CollectionErrorEntry {
  id: string;
  sourceId: string;
  sourceName: string;
  module: string;
  reason: string;
  timestamp: string;
}

export interface OpportunitiesApiResponse {
  items: AggregatedOpportunity[];
  sources: AggregationSourceRecord[];
  collectionRuns: CollectionRunEntry[];
  collectionErrors: CollectionErrorEntry[];
  syncedAt: string;
  cached?: boolean;
}

export interface AggregatorOverviewResponse {
  jobSources: ExternalJobSourceStatus[];
  fxBankStatuses: BankFxSourceStatus[];
  opportunitySources: AggregationSourceRecord[];
  newsSources?: NewsSourceStatus[];
  capitalMarketSources?: CapitalMarketSourceStatus[];
  collectionRuns: CollectionRunEntry[];
  collectionErrors: CollectionErrorEntry[];
  countsByModule: Record<string, number>;
  totalCollectedListings: number;
  duplicatesDetected: number;
  expiredCount: number;
  anomaliesCount: number;
  lastFullSyncAt: string | null;
  aiUsage?: AiUsageAnalytics;
}

// ============================================================================
// MODULE Q: TOP GLOBAL, AFRICA & ETHIOPIA NEWS AGGREGATOR TYPES
// ============================================================================

export type NewsCoverageScope =
  | 'World'
  | 'World and Africa'
  | 'Africa'
  | 'Ethiopia'
  | 'Ethiopia and world';

export type NewsPublisherId =
  | 'reuters'
  | 'bbc_news'
  | 'al_jazeera'
  | 'cnn'
  | 'ap_news'
  | 'africanews'
  | 'allafrica'
  | 'addis_standard'
  | 'the_reporter'
  | 'bbc_amharic';

export interface NewsArticleRecord {
  id: string;
  publisherId: NewsPublisherId;
  publisherName: string;
  publisherDomain: string;
  coverage: NewsCoverageScope;
  language: 'en' | 'am';
  title: string;
  summary: string;
  sourceUrl: string;
  imageUrl?: string;
  category: string;
  publishedAt: string | null;
  collectedAt: string;
  sourceMethod: 'rss_xml' | 'wp_rest_json' | 'news_index_rss';
  verificationStatus: 'Verified' | 'Stale';
  fingerprint: string;
}

export interface NewsSourceStatus {
  id: NewsPublisherId;
  name: string;
  domain: string;
  homeUrl: string;
  feedUrl: string;
  coverage: NewsCoverageScope;
  language: 'en' | 'am';
  method: 'rss_xml' | 'wp_rest_json' | 'news_index_rss';
  status: 'Verified' | 'Stale' | 'Collection failed' | 'Source unavailable';
  articlesCollected: number;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  errorMessage?: string;
}

export interface NewsApiResponse {
  articles: NewsArticleRecord[];
  sources: NewsSourceStatus[];
  syncedAt: string;
  cached?: boolean;
}

// ============================================================================
// MODULE R: ETHIOPIAN CAPITAL MARKET & ESX DAILY SHARE SALES ACTIVITY TYPES
// ============================================================================

export interface CapitalMarketPricePoint {
  date: string;
  price: number;
}

export interface CapitalMarketEquityRecord {
  symbol: string;
  companyName: string;
  sector: string;
  securityType: string;
  dateListed: string | null;
  dateIncorporated: string | null;
  listedCapitalEtb: number | null;
  listedShares: number | null;
  numberOfShareholders: number | null;
  lastPriceEtb: number | null;
  previousCloseEtb: number | null;
  changeEtb: number | null;
  changePct: number | null;
  periodHighEtb: number | null;
  periodLowEtb: number | null;
  sessionDate: string | null;
  marketCapImpliedEtb: number | null;
  dailyVolumeNote: string;
  tradingStatus: 'Continuous Trading' | 'Pre-Open' | 'Market Closed' | 'Listed / Quote Pending';
  priceHistory: CapitalMarketPricePoint[];
  esxProfileUrl: string;
  marketDataUrl: string;
  lastVerifiedAt: string;
  sourceName: string;
  verificationStatus: 'Verified' | 'Stale' | 'Source unavailable';
}

export interface CapitalMarketInterbankTradeRecord {
  id: string;
  weekLabel: string;
  maturity: string;
  volumeEtb: number | null;
  volumeLabel: string;
  totalTrades: number | null;
  weightedAvgRatePct: number | null;
  rateChangePct: number | null;
  sourceUrl: string;
}

export interface CapitalMarketTBillRecord {
  id: string;
  auctionNo: string;
  auctionDate: string;
  tradingSymbol: string;
  tenorDays: string;
  listedDate: string;
  maturityDate: string;
  amountAcceptedEtbMillions: number | null;
  weightedAvgYieldPct: number | null;
  sourceUrl: string;
}

export interface CapitalMarketAnnouncement {
  id: string;
  title: string;
  summary: string;
  publishedAt: string | null;
  sourceName: string;
  sourceUrl: string;
  category: string;
}

export interface CapitalMarketSourceStatus {
  id: string;
  name: string;
  domain: string;
  url: string;
  role: 'Primary Exchange' | 'Equity Feed' | 'Fixed Income Feed' | 'Regulator';
  status: 'Verified' | 'Stale' | 'Source unavailable' | 'Collection failed';
  recordsCollected: number;
  lastCheckedAt: string;
  errorMessage?: string;
}

export interface CapitalMarketSummaryMetrics {
  listedCompaniesCount: number;
  pricedEquitiesCount: number;
  totalListedShares: number;
  totalImpliedMarketCapEtb: number;
  latestSessionDate: string | null;
  advancersCount: number;
  declinersCount: number;
  unchangedCount: number;
  topGainerSymbol: string | null;
  topGainerPct: number | null;
  latestInterbankVolumeEtb: number | null;
  latestInterbankTradesCount: number | null;
  latestInterbankWeek: string | null;
  marketSessionState: string;
}

export interface CapitalMarketApiResponse {
  equities: CapitalMarketEquityRecord[];
  interbankTrades: CapitalMarketInterbankTradeRecord[];
  tBills: CapitalMarketTBillRecord[];
  announcements: CapitalMarketAnnouncement[];
  sources: CapitalMarketSourceStatus[];
  summary: CapitalMarketSummaryMetrics;
  syncedAt: string;
  cached?: boolean;
}

// ============================================================================
// MODULE S: AI RECRUITMENT, ALERTS, NOTIFICATIONS & MODERATION TYPES
// ============================================================================

export interface JobAlertConfig {
  id: string;
  email: string;
  keywords: string;
  location: string;
  category: string;
  remoteType: string;
  minSalaryEtb: number;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  active: boolean;
  createdAt: string;
}

export interface PlatformNotification {
  id: string;
  recipientEmail: string;
  title: string;
  message: string;
  type: 'application_update' | 'job_alert' | 'ai_insight' | 'system';
  linkView?: AppView;
  read: boolean;
  createdAt: string;
}

export interface ReportedListingEntry {
  id: string;
  targetType: 'job' | 'company';
  targetId: string;
  targetTitle: string;
  reporterEmail: string;
  reason: string;
  status: 'open' | 'resolved' | 'dismissed';
  resolutionNote?: string;
  createdAt: string;
}

export interface AiResumeAnalysisResult {
  engine: 'openai' | 'deterministic';
  modelLabel: string;
  overallScore: number;
  sectionScores: {
    structure: number;
    clarity: number;
    experience: number;
    education: number;
    skills: number;
  };
  extractedSkills: string[];
  strengths: string[];
  weaknesses: string[];
  missingInfo: string[];
  missingKeywords: string[];
  suggestions: string[];
  improvedResumeText: string;
  analyzedAt: string;
}

export interface AiJobMatchResult {
  engine: 'openai' | 'deterministic';
  modelLabel: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  compatibilityScore: number;
  matchingSkills: string[];
  missingSkills: string[];
  relevantExperience: string[];
  explanation: string;
  suggestions: string[];
  tailoredResumeText: string;
  matchedAt: string;
}

export interface AiJobRecommendation {
  jobId: string;
  compatibilityScore: number;
  matchReasons: string[];
  matchingSkills: string[];
  missingSkillsToLearn: string[];
}

export interface AiInterviewQuestion {
  id: string;
  category: 'Technical' | 'Behavioral' | 'Role-Specific' | 'Situational';
  question: string;
  focusTip: string;
}

export interface AiInterviewEvaluation {
  engine: 'openai' | 'deterministic';
  overallScore: number;
  scores: {
    communication: number;
    relevance: number;
    clarity: number;
    technicalKnowledge: number;
  };
  strengths: string[];
  improvements: string[];
  suggestedStrongerAnswer: string;
  feedbackSummary: string;
}

export interface AiInterviewSession {
  id: string;
  userEmail: string;
  jobId?: string;
  jobTitle: string;
  questions: AiInterviewQuestion[];
  answers: Record<string, string>;
  evaluations: Record<string, AiInterviewEvaluation>;
  averageScore: number;
  completedAt: string;
}

export interface AiApplicantScreeningItem {
  applicationId: string;
  applicantName: string;
  applicantEmail: string;
  jobId: string;
  jobTitle: string;
  fitScore: number;
  category: 'Strong Fit' | 'Potential Fit' | 'Needs Review';
  summary: string;
  matchingSkills: string[];
  missingQualifications: string[];
  biasCheckNote: string;
}

export interface AiUsageAnalytics {
  resumeScans: number;
  jobMatches: number;
  recommendationsRuns: number;
  interviewSessions: number;
  employerScreenings: number;
  totalAiRequests: number;
  lastAiCallAt: string | null;
}

export interface AiEngineStatusResponse {
  openAiConfigured: boolean;
  model: string;
  engineMode: 'openai' | 'deterministic';
  usage: AiUsageAnalytics;
}

