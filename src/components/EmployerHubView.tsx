import React, { useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Lock,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { downloadResumeAsPdf } from '../lib/pdfExport';
import type { SelfProfileUpdateInput } from '../lib/security';
import {
  calculateCommercialPricing,
  formatCurrencyEtb,
  JOB_POSTING_PACKAGES,
  validateJobDraft,
  type JobDraftInput,
  type PaymentSubmissionInput,
} from '../lib/storeLogic';
import type {
  AiApplicantScreeningItem,
  ApplicationStage,
  JobApplication,
  JobListing,
  JobPostingTier,
  JobType,
  PaymentMethod,
  PaymentReceipt,
  RemoteType,
  UserProfile,
} from '../types/domain';

interface EmployerHubViewProps {
  currentUser: UserProfile | null;
  jobs: JobListing[];
  applications: JobApplication[];
  receipts: PaymentReceipt[];
  onSubmitJobWithPayment: (draft: JobDraftInput, payment: PaymentSubmissionInput) => string | null;
  onUpdateJob: (
    jobId: string,
    updates: {
      titleEn: string;
      location: string;
      salaryMin: number;
      salaryMax: number;
      deadline: string;
      descriptionEn: string;
    }
  ) => string | null;
  onDeleteJob: (jobId: string) => void;
  onUpdateApplicationStage: (appId: string, stage: ApplicationStage) => void;
  onUpdateApplicationDetails?: (
    appId: string,
    patch: { humanDecisionOverride?: string; aiMatchScore?: number; aiMatchSummary?: string }
  ) => void;
  onUpdateCompanyProfile?: (updates: SelfProfileUpdateInput) => string | null;
  onToggleJobActiveStatus: (jobId: string) => void;
  onDownloadInvoice: (receipt: PaymentReceipt) => void;
  onRequireAuth: (options?: {
    mode?: 'signin' | 'signup';
    role?: 'seeker' | 'employer';
    notice?: string;
  }) => void;
}

export const EmployerHubView: React.FC<EmployerHubViewProps> = ({
  currentUser,
  jobs,
  applications,
  receipts,
  onSubmitJobWithPayment,
  onUpdateJob,
  onDeleteJob,
  onUpdateApplicationStage,
  onUpdateApplicationDetails,
  onUpdateCompanyProfile,
  onToggleJobActiveStatus,
  onDownloadInvoice,
  onRequireAuth,
}) => {
  const [activeTab, setActiveTab] = useState<'post' | 'listings' | 'candidates' | 'company'>('post');
  const [step, setStep] = useState<1 | 2>(1);
  const [formError, setFormError] = useState<string | null>(null);

  const [selectedTier, setSelectedTier] = useState<JobPostingTier>('standard');
  const [titleEn, setTitleEn] = useState('');
  const [titleAm, setTitleAm] = useState('');
  const [companyName, setCompanyName] = useState(currentUser?.companyName || '');
  const [location, setLocation] = useState('Addis Ababa');
  const [remoteType, setRemoteType] = useState<RemoteType>('On-site');
  const [category, setCategory] = useState('IT & Data');
  const [jobType, setJobType] = useState<JobType>('Full-time');
  const [experienceLevel, setExperienceLevel] = useState('Mid-Level (2-4 yrs)');
  const [salaryMin, setSalaryMin] = useState(25000);
  const [salaryMax, setSalaryMax] = useState(35000);
  const [deadline, setDeadline] = useState('2026-12-30');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [requirementsText, setRequirementsText] = useState('');
  const [benefitsText, setBenefitsText] = useState('');

  // Step 2 Payment Receipt Fields
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Telebirr');
  const [payerName, setPayerName] = useState(currentUser?.fullName || '');
  const [payerPhone, setPayerPhone] = useState(currentUser?.phone || '+251911223344');
  const [transactionRef, setTransactionRef] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromoInput, setAppliedPromoInput] = useState('');
  const [receiptNote, setReceiptNote] = useState('');
  const [receiptImageData, setReceiptImageData] = useState<string | undefined>(undefined);

  // Candidate Pipeline Filters & AI Screening State
  const [candidateSearch, setCandidateSearch] = useState('');
  const [candidateStageFilter, setCandidateStageFilter] = useState<'all' | ApplicationStage>('all');
  const [listingStatusFilter, setListingStatusFilter] = useState<
    'all' | 'approved' | 'pending_approval' | 'paused' | 'expired'
  >('all');
  const [aiJobId, setAiJobId] = useState<string>('');
  const [aiScreenings, setAiScreenings] = useState<AiApplicantScreeningItem[]>([]);
  const [aiComparisonSummary, setAiComparisonSummary] = useState<string>('');
  const [isScreeningAi, setIsScreeningAi] = useState(false);
  const [aiScreenError, setAiScreenError] = useState<string | null>(null);
  const [recruiterQuestion, setRecruiterQuestion] = useState('');
  const [recruiterAnswer, setRecruiterAnswer] = useState('');
  const [isAskingAi, setIsAskingAi] = useState(false);
  const [overrideDrafts, setOverrideDrafts] = useState<Record<string, string>>({});

  // Company Profile State
  const [compName, setCompName] = useState(currentUser?.companyName || '');
  const [compTin, setCompTin] = useState(currentUser?.tinNumber || '');
  const [compPhone, setCompPhone] = useState(currentUser?.phone || '+251911');
  const [compLocation, setCompLocation] = useState(currentUser?.companyLocation || 'Addis Ababa');
  const [compWebsite, setCompWebsite] = useState(currentUser?.companyWebsite || '');
  const [compDescription, setCompDescription] = useState(currentUser?.companyDescription || '');
  const [compLogo, setCompLogo] = useState<string | undefined>(currentUser?.companyLogoDataUrl);
  const [compIsAgency, setCompIsAgency] = useState<boolean>(
    Boolean(currentUser?.isRecruitmentAgency)
  );
  const [compSaveMsg, setCompSaveMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  // Job Edit / Delete State
  const [editingJob, setEditingJob] = useState<JobListing | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editSalaryMin, setEditSalaryMin] = useState(0);
  const [editSalaryMax, setEditSalaryMax] = useState(0);
  const [editDeadline, setEditDeadline] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [confirmDeleteJobId, setConfirmDeleteJobId] = useState<string | null>(null);

  const activePackage =
    JOB_POSTING_PACKAGES.find((p) => p.id === selectedTier) || JOB_POSTING_PACKAGES[0];
  const pricing = calculateCommercialPricing(activePackage.priceEtb, appliedPromoInput, true);

  const employerJobs = useMemo(
    () =>
      currentUser
        ? jobs.filter(
            (j) =>
              currentUser.role === 'admin' ||
              j.employerEmail.toLowerCase() === currentUser.email.toLowerCase()
          )
        : [],
    [jobs, currentUser]
  );

  const filteredEmployerJobs = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return employerJobs.filter((j) => {
      if (listingStatusFilter === 'all') return true;
      if (listingStatusFilter === 'expired') {
        return Boolean(j.isExpired || (j.deadline && j.deadline < today));
      }
      return j.status === listingStatusFilter;
    });
  }, [employerJobs, listingStatusFilter]);

  const employerCandidates = useMemo(() => {
    const employerJobIds = new Set(employerJobs.map((j) => j.id));
    return applications.filter((a) => employerJobIds.has(a.jobId));
  }, [applications, employerJobs]);

  const filteredCandidates = useMemo(() => {
    const q = candidateSearch.trim().toLowerCase();
    return employerCandidates.filter((app) => {
      if (candidateStageFilter !== 'all' && app.status !== candidateStageFilter) return false;
      if (!q) return true;
      return `${app.applicantName} ${app.applicantEmail} ${app.jobTitle} ${app.phone}`
        .toLowerCase()
        .includes(q);
    });
  }, [employerCandidates, candidateSearch, candidateStageFilter]);

  // Strict Access Gate 1: Must be registered & signed in
  if (!currentUser) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-xs">
          <Lock className="mx-auto h-10 w-10 text-[#164081]" />
          <h1 className="mt-3 font-display text-xl font-bold text-slate-900">
            Employer Registration Required
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Only registered and Administrator-verified Employers can post job vacancies or review
            applicant pipelines. Job seekers can browse and apply freely on the Job Board without
            pre-registration.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() =>
                onRequireAuth({
                  mode: 'signup',
                  role: 'employer',
                  notice:
                    'Register your Employer organization with your Business TIN to post vacancies.',
                })
              }
              className="rounded-lg bg-[#164081] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#102E61]"
            >
              Register Employer Account
            </button>
            <button
              type="button"
              onClick={() =>
                onRequireAuth({
                  mode: 'signin',
                  notice: 'Sign in with your verified Employer credentials.',
                })
              }
              className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Employer Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Strict Access Gate 2: Job Seekers cannot access Employer Hub
  if (currentUser.role === 'seeker') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-xs">
          <ShieldAlert className="mx-auto h-10 w-10 text-amber-600" />
          <h1 className="mt-3 font-display text-xl font-bold text-slate-900">
            Employer Account Required
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            You are currently signed in as a <strong>Job Seeker</strong> ({currentUser.email}). To
            post jobs or manage applicants, register or sign in with an Employer organization account.
          </p>
          <button
            type="button"
            onClick={() =>
              onRequireAuth({
                mode: 'signup',
                role: 'employer',
                notice: 'Sign out or register a separate Employer account with Company TIN.',
              })
            }
            className="mt-6 rounded-lg bg-[#164081] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#102E61]"
          >
            Switch / Register Employer Account
          </button>
        </div>
      </div>
    );
  }

  // Strict Access Gate 3: Employer must be verified/approved by Admin
  if (currentUser.role === 'employer' && currentUser.status !== 'approved') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-xl border border-amber-200 bg-white p-8 shadow-xs">
          <Clock className="mx-auto h-10 w-10 text-amber-600" />
          <h1 className="mt-3 font-display text-xl font-bold text-slate-900">
            Employer Verification Pending
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Your organization profile for{' '}
            <strong>{currentUser.companyName || currentUser.fullName}</strong> (TIN:{' '}
            <span className="font-mono font-semibold">{currentUser.tinNumber || 'Provided'}</span>)
            is awaiting Administrator verification. Once approved, you can post jobs and manage
            candidates.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-800">
            <Building2 className="h-4 w-4" />
            Account Status: {currentUser.status.toUpperCase()}
          </div>
        </div>
      </div>
    );
  }

  const buildDraft = (): JobDraftInput => ({
    employerEmail: currentUser.email.toLowerCase(),
    titleEn,
    titleAm: titleAm || undefined,
    companyName: companyName || currentUser.companyName || '',
    location,
    remoteType,
    category,
    jobType,
    experienceLevel,
    salaryMin: Number(salaryMin),
    salaryMax: Number(salaryMax),
    deadline,
    summaryEn: descriptionEn.slice(0, 140),
    descriptionEn,
    requirements: requirementsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
    benefits: benefitsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
    tierId: activePackage.id,
    tierName: activePackage.name,
    isFeatured: activePackage.isFeatured,
    postingFeeEtb: activePackage.priceEtb,
  });

  const handleContinueToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const err = validateJobDraft(buildDraft());
    if (err) {
      setFormError(err);
      return;
    }
    if (!payerName) setPayerName(currentUser.fullName);
    setStep(2);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setReceiptImageData(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const err = onSubmitJobWithPayment(buildDraft(), {
      payerEmail: currentUser.email,
      payerName: payerName || currentUser.fullName,
      payerPhone,
      paymentMethod,
      transactionRef,
      promoCode: pricing.appliedPromoCode,
      applyVat: true,
      receiptNote,
      receiptImageData,
    });
    if (err) {
      setFormError(err);
      return;
    }
    setTitleEn('');
    setTitleAm('');
    setDescriptionEn('');
    setRequirementsText('');
    setBenefitsText('');
    setTransactionRef('');
    setPromoInput('');
    setAppliedPromoInput('');
    setReceiptNote('');
    setReceiptImageData(undefined);
    setStep(1);
    setActiveTab('listings');
  };

  const handleExportCandidatesCsv = () => {
    const rows = [
      ['Candidate Name', 'Email', 'Phone', 'Vacancy', 'Experience', 'Stage', 'CV Link', 'Applied At'],
      ...filteredCandidates.map((a) => [
        a.applicantName,
        a.applicantEmail,
        a.phone,
        a.jobTitle,
        a.yearsExperience,
        a.status,
        a.resumeUrl,
        a.createdAt,
      ]),
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tatari-candidates-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="border-b border-slate-200 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">
              Employer Hiring Hub
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Choose a Standard or Featured Sponsored listing package, submit your payment receipt,
              and publish live upon Administrator approval.
            </p>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Employer hub sections"
          className="mt-5 inline-flex flex-wrap gap-1.5 rounded-lg bg-slate-100 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'post'}
            onClick={() => setActiveTab('post')}
            className={`rounded-md px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'post'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Post a New Job
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'listings'}
            onClick={() => setActiveTab('listings')}
            className={`rounded-md px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'listings'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            My Job Postings ({employerJobs.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'candidates'}
            onClick={() => setActiveTab('candidates')}
            className={`rounded-md px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'candidates'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Applicant Pipeline ({employerCandidates.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'company'}
            onClick={() => setActiveTab('company')}
            className={`rounded-md px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'company'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Company Profile
          </button>
        </div>
      </div>

      {/* Tab 1: Two-Step Post a Job + Package Selection + Payment Receipt */}
      {activeTab === 'post' && (
        <div className="mt-6 max-w-3xl rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 tabular-nums">
              Step {step} of 2 · {step === 1 ? 'Package & Vacancy Details' : 'Payment Receipt Verification'}
            </div>
            <div className="font-mono text-xs font-semibold text-[#164081] tabular-nums">
              {activePackage.name}: {formatCurrencyEtb(pricing.totalEtb)} (incl. VAT)
            </div>
          </div>

          {formError && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800"
            >
              {formError}
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleContinueToPayment} className="space-y-5">
              {/* Listing Package Selector */}
              <div>
                <div className="text-xs font-semibold text-slate-700">
                  1. Select Commercial Job Package *
                </div>
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {JOB_POSTING_PACKAGES.map((pkg) => {
                    const selected = selectedTier === pkg.id;
                    return (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => setSelectedTier(pkg.id)}
                        className={`rounded-xl border p-3.5 text-left transition-colors ${
                          selected
                            ? 'border-[#164081] bg-[#F0F5FF]'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display text-xs font-bold text-slate-900">
                            {pkg.name}
                          </span>
                          {pkg.isFeatured && (
                            <span className="text-[10px] font-bold uppercase text-[#0F766E]">
                              Sponsored
                            </span>
                          )}
                        </div>
                        <div className="mt-1 font-mono text-sm font-bold text-[#164081] tabular-nums">
                          {formatCurrencyEtb(pkg.priceEtb)} + VAT
                        </div>
                        <p className="mt-1 text-[11px] leading-snug text-slate-600">{pkg.summary}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Job Title (English) *
                  <input
                    type="text"
                    required
                    value={titleEn}
                    onChange={(e) => setTitleEn(e.target.value)}
                    placeholder="e.g. Senior React Engineer"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                  />
                </label>

                <label className="block text-xs font-semibold text-slate-700">
                  Job Title (Amharic - Optional)
                  <input
                    type="text"
                    value={titleAm}
                    onChange={(e) => setTitleAm(e.target.value)}
                    placeholder="ለምሳሌ፡ ሶፍትዌር ገንቢ"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                  />
                </label>

                <label className="block text-xs font-semibold text-slate-700">
                  Company Name *
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Addis Tech PLC"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                  />
                </label>

                <label className="block text-xs font-semibold text-slate-700">
                  City / Location *
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Addis Ababa, Hawassa, Remote..."
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                  />
                </label>

                <label className="block text-xs font-semibold text-slate-700">
                  Category
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                  >
                    <option value="IT & Data">IT &amp; Data</option>
                    <option value="HR & Admin">HR &amp; Admin</option>
                    <option value="Finance">Finance</option>
                    <option value="Engineering">Engineering</option>
                    <option value="NGO & Development">NGO &amp; Development</option>
                    <option value="Healthcare">Healthcare</option>
                  </select>
                </label>

                <label className="block text-xs font-semibold text-slate-700">
                  Job Type
                  <select
                    value={jobType}
                    onChange={(e) => setJobType(e.target.value as JobType)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Internship">Internship</option>
                  </select>
                </label>

                <label className="block text-xs font-semibold text-slate-700">
                  Work Setting
                  <select
                    value={remoteType}
                    onChange={(e) => setRemoteType(e.target.value as RemoteType)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                  >
                    <option value="On-site">On-site</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="Remote">Remote</option>
                  </select>
                </label>

                <label className="block text-xs font-semibold text-slate-700">
                  Application Deadline *
                  <input
                    type="date"
                    required
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none tabular-nums"
                  />
                </label>

                <label className="block text-xs font-semibold text-slate-700">
                  Min Monthly Salary (ETB) *
                  <input
                    type="number"
                    min={0}
                    required
                    value={salaryMin}
                    onChange={(e) => setSalaryMin(Number(e.target.value))}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none tabular-nums"
                  />
                </label>

                <label className="block text-xs font-semibold text-slate-700">
                  Max Monthly Salary (ETB) *
                  <input
                    type="number"
                    min={0}
                    required
                    value={salaryMax}
                    onChange={(e) => setSalaryMax(Number(e.target.value))}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none tabular-nums"
                  />
                </label>
              </div>

              <label className="block text-xs font-semibold text-slate-700">
                Experience Level
                <input
                  type="text"
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                />
              </label>

              <label className="block text-xs font-semibold text-slate-700">
                Job Description *
                <textarea
                  rows={4}
                  required
                  value={descriptionEn}
                  onChange={(e) => setDescriptionEn(e.target.value)}
                  placeholder="Describe daily responsibilities, team structure, and mission..."
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                />
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Requirements (one per line)
                  <textarea
                    rows={3}
                    value={requirementsText}
                    onChange={(e) => setRequirementsText(e.target.value)}
                    placeholder="BSc in Computer Science&#10;3+ years React & TypeScript"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-700">
                  Benefits (one per line)
                  <textarea
                    rows={3}
                    value={benefitsText}
                    onChange={(e) => setBenefitsText(e.target.value)}
                    placeholder="Medical insurance&#10;Transport allowance"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                  />
                </label>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#164081] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#102E61]"
                >
                  <Plus className="h-4 w-4" />
                  Continue to Payment ({formatCurrencyEtb(pricing.totalEtb)})
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleFinalSubmit} className="space-y-4">
              {/* Promo & 15% VAT Summary */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-slate-900">
                    {activePackage.name} ({activePackage.durationDays} days)
                  </div>
                  <span className="font-mono font-bold text-[#164081]">
                    Total Due: {formatCurrencyEtb(pricing.totalEtb)}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                    placeholder="Promo code (e.g. CORP15)"
                    aria-label="Employer promo code"
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs uppercase text-slate-900 focus:border-[#164081] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setAppliedPromoInput(promoInput.trim().toUpperCase())}
                    className="rounded-lg border border-[#164081] bg-white px-3 py-1.5 text-xs font-semibold text-[#164081] hover:bg-[#F0F5FF]"
                  >
                    Apply Promo
                  </button>
                </div>
                {pricing.promoError && (
                  <p className="mt-1.5 font-medium text-rose-700">{pricing.promoError}</p>
                )}
                {pricing.appliedPromoCode && (
                  <p className="mt-1.5 font-semibold text-emerald-700">
                    Promo {pricing.appliedPromoCode} applied ({pricing.promoPercent}% off)
                  </p>
                )}

                <dl className="mt-3 space-y-1 border-t border-slate-200 pt-2.5 tabular-nums">
                  <div className="flex justify-between">
                    <dt>Package Base Fee</dt>
                    <dd className="font-mono">{formatCurrencyEtb(pricing.subtotalEtb)}</dd>
                  </div>
                  {pricing.discountEtb > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <dt>Promo Discount</dt>
                      <dd className="font-mono">-{formatCurrencyEtb(pricing.discountEtb)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt>VAT (15%)</dt>
                    <dd className="font-mono">{formatCurrencyEtb(pricing.vatEtb)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold text-slate-900">
                    <dt>Total Payable</dt>
                    <dd className="font-mono">{formatCurrencyEtb(pricing.totalEtb)}</dd>
                  </div>
                </dl>

                <p className="mt-3 border-t border-slate-200 pt-2.5">
                  Transfer <strong className="font-mono">{formatCurrencyEtb(pricing.totalEtb)}</strong>{' '}
                  to <strong className="font-mono">Telebirr 0911-00-44-22</strong> or{' '}
                  <strong className="font-mono">CBE 1000284910293</strong> (TATARI Consulting PLC),
                  then enter your unique transaction reference below.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Payment Method *
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                  >
                    <option value="Telebirr">Telebirr</option>
                    <option value="CBE Bank Transfer">CBE Bank Transfer</option>
                    <option value="CBE Birr">CBE Birr</option>
                    <option value="AwashBirr">AwashBirr</option>
                  </select>
                </label>

                <label className="block text-xs font-semibold text-slate-700">
                  Transaction Reference ID *
                  <input
                    type="text"
                    required
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    placeholder="e.g. TB-998877 or FT26..."
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                  />
                </label>

                <label className="block text-xs font-semibold text-slate-700">
                  Payer Full Name *
                  <input
                    type="text"
                    required
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                  />
                </label>

                <label className="block text-xs font-semibold text-slate-700">
                  Payer Phone / Account *
                  <input
                    type="text"
                    required
                    value={payerPhone}
                    onChange={(e) => setPayerPhone(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                  />
                </label>
              </div>

              <label className="block text-xs font-semibold text-slate-700">
                Payment Receipt Screenshot (Optional)
                <div className="mt-1.5 flex items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    <Upload className="h-4 w-4" />
                    Attach Receipt Image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                  </label>
                  {receiptImageData && (
                    <span className="text-xs font-medium text-emerald-700">
                      Receipt image attached
                    </span>
                  )}
                </div>
              </label>

              <label className="block text-xs font-semibold text-slate-700">
                Receipt Note (Optional)
                <input
                  type="text"
                  value={receiptNote}
                  onChange={(e) => setReceiptNote(e.target.value)}
                  placeholder="Branch or sender account details"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                />
              </label>

              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Back to Job Details
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#164081] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#102E61]"
                >
                  Submit Job &amp; Payment Receipt
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Tab 2: Employer Job Listings & Moderation Status */}
      {activeTab === 'listings' && (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 text-xs font-semibold">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'approved', label: 'Approved' },
                  { id: 'pending_approval', label: 'Pending' },
                  { id: 'paused', label: 'Paused' },
                  { id: 'expired', label: 'Expired' },
                ] as const
              ).map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setListingStatusFilter(pill.id)}
                  className={`rounded-md px-3 py-1 transition-colors ${
                    listingStatusFilter === pill.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-500 tabular-nums">
              Showing {filteredEmployerJobs.length} of {employerJobs.length} postings
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-5 py-3.5">Job Title &amp; Package</th>
                  <th className="px-5 py-3.5">Location &amp; Pay</th>
                  <th className="px-5 py-3.5">Receipt Ref</th>
                  <th className="px-5 py-3.5">Approval Status</th>
                  <th className="px-5 py-3.5">Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployerJobs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-xs text-slate-500">
                      No job postings match the selected status filter.
                    </td>
                  </tr>
                ) : (
                  filteredEmployerJobs.map((job) => {
                    const rcpt = receipts.find((r) => r.id === job.paymentReceiptId);
                    return (
                      <tr key={job.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900">{job.titleEn}</div>
                      <div className="text-xs text-slate-500">
                        {job.companyName} · {job.tierName || 'Standard Listing'}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600 tabular-nums">
                      {job.location} · {job.salaryDisplay}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-700">
                      {rcpt ? `${rcpt.paymentMethod}: ${rcpt.transactionRef}` : 'Verified'}
                    </td>
                    <td className="px-5 py-3.5 text-xs">
                      {job.status === 'approved' ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approved &amp; Live
                        </span>
                      ) : job.status === 'paused' ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-600">
                          <PauseCircle className="h-3.5 w-3.5" />
                          Paused by Employer
                        </span>
                      ) : job.status === 'rejected' ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-rose-700">
                          <XCircle className="h-3.5 w-3.5" />
                          Rejected ({job.rejectionReason || 'Receipt invalid'})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                          <Clock className="h-3.5 w-3.5" />
                          Pending Admin Approval
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingJob(job);
                            setEditTitle(job.titleEn);
                            setEditLocation(job.location);
                            setEditSalaryMin(job.salaryMin);
                            setEditSalaryMax(job.salaryMax);
                            setEditDeadline(job.deadline);
                            setEditDesc(job.descriptionEn);
                            setEditError(null);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Pencil className="h-3 w-3 text-[#164081]" />
                          Edit
                        </button>
                        {(job.status === 'approved' || job.status === 'paused') && (
                          <button
                            type="button"
                            onClick={() => onToggleJobActiveStatus(job.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            {job.status === 'approved' ? (
                              <>
                                <PauseCircle className="h-3.5 w-3.5" />
                                Pause
                              </>
                            ) : (
                              <>
                                <PlayCircle className="h-3.5 w-3.5 text-[#0F766E]" />
                                Reopen
                              </>
                            )}
                          </button>
                        )}
                        {confirmDeleteJobId === job.id ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteJob(job.id);
                                setConfirmDeleteJobId(null);
                              }}
                              className="rounded-lg bg-rose-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-800"
                            >
                              Confirm Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteJobId(null)}
                              className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteJobId(job.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </button>
                        )}
                        {rcpt && rcpt.status === 'verified' && (
                          <button
                            type="button"
                            onClick={() => onDownloadInvoice(rcpt)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-[#164081] hover:bg-slate-50"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Invoice
                          </button>
                        )}
                      </div>
                    </td>
                    </tr>
                  );
                })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Candidate Pipeline with AI Recruitment Assistant, Search, Stage Filter & CSV Export */}
      {activeTab === 'candidates' && (
        <div className="mt-6 space-y-5">
          {employerJobs.length > 0 && (
            <section className="rounded-xl border border-[#164081]/20 bg-gradient-to-br from-[#F0F5FF] to-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#164081]">
                    <Sparkles className="h-3.5 w-3.5" />
                    AI Recruitment Screening Assistant
                  </div>
                  <h2 className="mt-1 font-display text-base font-bold text-slate-900">
                    Evidence-Based Applicant Fit Ranking &amp; Pool Q&amp;A
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-600">
                    Scores applicants strictly on stated skills, experience, and CV/cover note
                    alignment. Human hiring managers retain full final review and override authority.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Select job vacancy for AI screening"
                    value={aiJobId || employerJobs[0]?.id || ''}
                    onChange={(e) => setAiJobId(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-[#164081] focus:outline-none"
                  >
                    {employerJobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.titleEn} ({applications.filter((a) => a.jobId === j.id).length} applicants)
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={isScreeningAi}
                    onClick={async () => {
                      const targetId = aiJobId || employerJobs[0]?.id;
                      const targetJob = employerJobs.find((j) => j.id === targetId);
                      if (!targetJob) return;
                      setIsScreeningAi(true);
                      setAiScreenError(null);
                      try {
                        const pool = applications.filter((a) => a.jobId === targetJob.id);
                        const res = await fetch('/api/ai/employer/screen', {
                          method: 'POST',
                          headers: { 'content-type': 'application/json' },
                          body: JSON.stringify({ job: targetJob, applications: pool }),
                        });
                        const data = (await res.json()) as {
                          error?: string;
                          screenings?: AiApplicantScreeningItem[];
                          comparisonSummary?: string;
                        };
                        if (!res.ok) {
                          setAiScreenError(data.error || 'AI screening failed.');
                          return;
                        }
                        const items = data.screenings || [];
                        setAiScreenings(items);
                        setAiComparisonSummary(data.comparisonSummary || '');
                        if (onUpdateApplicationDetails) {
                          for (const s of items) {
                            onUpdateApplicationDetails(s.applicationId, {
                              aiMatchScore: s.fitScore,
                              aiMatchSummary: s.summary,
                            });
                          }
                        }
                      } catch {
                        setAiScreenError('Network error reaching AI screening assistant.');
                      } finally {
                        setIsScreeningAi(false);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102E61] disabled:opacity-60"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {isScreeningAi ? 'Screening Pool...' : 'Screen & Rank Applicants with AI'}
                  </button>
                </div>
              </div>

              {aiScreenError && (
                <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                  {aiScreenError}
                </div>
              )}

              {aiComparisonSummary && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-800">
                  <strong className="text-[#164081]">AI Pool Comparison: </strong>
                  {aiComparisonSummary}
                </div>
              )}

              {aiScreenings.length > 0 && (
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {aiScreenings.map((item) => (
                    <div
                      key={item.applicationId}
                      className="rounded-lg border border-slate-200 bg-white p-3.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="font-bold text-slate-900">{item.applicantName}</span>
                          <span className="ml-2 text-slate-500">{item.applicantEmail}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                              item.category === 'Strong Fit'
                                ? 'bg-emerald-50 text-emerald-700'
                                : item.category === 'Potential Fit'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {item.category}
                          </span>
                          <span className="font-mono font-bold text-[#164081] tabular-nums">
                            {item.fitScore}/100
                          </span>
                        </div>
                      </div>
                      <p className="mt-1.5 text-slate-700">{item.summary}</p>
                      {item.matchingSkills.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {item.matchingSkills.slice(0, 6).map((skill) => (
                            <span
                              key={skill}
                              className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}
                      {item.missingQualifications.length > 0 && (
                        <div className="mt-1.5 text-[11px] text-amber-800">
                          Gaps to probe: {item.missingQualifications.slice(0, 3).join(', ')}
                        </div>
                      )}
                      <div className="mt-1.5 text-[10px] text-slate-500">{item.biasCheckNote}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200/80 pt-3">
                <input
                  type="text"
                  value={recruiterQuestion}
                  onChange={(e) => setRecruiterQuestion(e.target.value)}
                  placeholder="Ask AI about this candidate pool (e.g. Who has 3+ years React or IFRS experience?)..."
                  aria-label="Ask AI about applicant pool"
                  className="min-w-[240px] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#164081] focus:outline-none"
                />
                <button
                  type="button"
                  disabled={isAskingAi || !recruiterQuestion.trim()}
                  onClick={async () => {
                    const targetId = aiJobId || employerJobs[0]?.id;
                    const targetJob = employerJobs.find((j) => j.id === targetId) || null;
                    const pool = targetJob
                      ? applications.filter((a) => a.jobId === targetJob.id)
                      : employerCandidates;
                    setIsAskingAi(true);
                    try {
                      const res = await fetch('/api/ai/employer/ask', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({
                          question: recruiterQuestion.trim(),
                          job: targetJob,
                          applications: pool,
                        }),
                      });
                      const data = (await res.json()) as { answer?: string };
                      setRecruiterAnswer(data.answer || 'No response returned.');
                    } catch {
                      setRecruiterAnswer('Unable to query AI assistant right now.');
                    } finally {
                      setIsAskingAi(false);
                    }
                  }}
                  className="rounded-lg border border-[#164081] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#164081] hover:bg-[#F0F5FF] disabled:opacity-50"
                >
                  {isAskingAi ? 'Analyzing...' : 'Ask AI'}
                </button>
              </div>
              {recruiterAnswer && (
                <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800">
                  {recruiterAnswer}
                </div>
              )}
            </section>
          )}

          {employerCandidates.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
              <Users className="mx-auto h-9 w-9 text-slate-400" />
              <h2 className="mt-3 font-display text-base font-bold text-slate-900">
                No candidates have applied yet
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Applications submitted to your live jobs appear here for stage tracking.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
                <div className="flex flex-1 flex-wrap items-center gap-2.5">
                  <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="search"
                      value={candidateSearch}
                      onChange={(e) => setCandidateSearch(e.target.value)}
                      placeholder="Search candidate or job..."
                      aria-label="Search applicants"
                      className="w-full rounded-lg border border-slate-300 py-1.5 pl-8 pr-3 text-xs text-slate-900 focus:border-[#164081] focus:outline-none"
                    />
                  </div>
                  <select
                    aria-label="Filter candidates by stage"
                    value={candidateStageFilter}
                    onChange={(e) =>
                      setCandidateStageFilter(e.target.value as 'all' | ApplicationStage)
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:border-[#164081] focus:outline-none"
                  >
                    <option value="all">All Stages</option>
                    <option value="Submitted">Submitted</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Shortlisted">Shortlisted</option>
                    <option value="Interview">Interview</option>
                    <option value="Offered">Offered</option>
                    <option value="Hired">Hired</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleExportCandidatesCsv}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export Candidates CSV
                </button>
              </div>

              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="px-5 py-3.5">Candidate &amp; Cover Note</th>
                    <th className="px-5 py-3.5">Vacancy &amp; AI Fit</th>
                    <th className="px-5 py-3.5">Resume / CV</th>
                    <th className="px-5 py-3.5">Stage &amp; Recruiter Override</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-xs text-slate-500">
                        No applicants match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredCandidates.map((app) => {
                      const draftOverride =
                        overrideDrafts[app.id] ?? app.humanDecisionOverride ?? '';
                      return (
                        <tr key={app.id} className="align-top hover:bg-slate-50/70">
                          <td className="px-5 py-3.5">
                            <div className="font-semibold text-slate-900">{app.applicantName}</div>
                            <div className="text-xs text-slate-500">
                              {app.applicantEmail} · {app.phone} · {app.yearsExperience}
                            </div>
                            {app.coverNote && (
                              <p className="mt-1 max-w-xs text-xs text-slate-600 line-clamp-2">
                                “{app.coverNote}”
                              </p>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="font-medium text-slate-800">{app.jobTitle}</div>
                            {typeof app.aiMatchScore === 'number' && (
                              <div className="mt-1 inline-flex items-center gap-1 rounded bg-[#F0F5FF] px-2 py-0.5 font-mono text-[11px] font-bold text-[#164081]">
                                AI Fit: {app.aiMatchScore}/100
                              </div>
                            )}
                            {app.aiMatchSummary && (
                              <div className="mt-1 max-w-xs text-[11px] text-slate-500 line-clamp-2">
                                {app.aiMatchSummary}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex flex-col items-start gap-1.5">
                              <a
                                href={app.resumeUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-[#164081] hover:underline"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Open CV Link
                              </a>
                              {app.resumeText && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    downloadResumeAsPdf(
                                      app.resumeFileName || `${app.applicantName}-CV`,
                                      `${app.applicantName} — Application CV (${app.jobTitle})`,
                                      app.resumeText || ''
                                    )
                                  }
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                                >
                                  <FileText className="h-3 w-3 text-[#0F766E]" />
                                  {app.resumeFileName ? `PDF (${app.resumeFileName})` : 'Download CV PDF'}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 space-y-2">
                            <select
                              aria-label={`Stage for ${app.applicantName}`}
                              value={app.status}
                              onChange={(e) =>
                                onUpdateApplicationStage(app.id, e.target.value as ApplicationStage)
                              }
                              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-[#164081] focus:outline-none"
                            >
                              <option value="Submitted">Submitted</option>
                              <option value="Under Review">Under Review</option>
                              <option value="Shortlisted">Shortlisted</option>
                              <option value="Interview">Interview</option>
                              <option value="Offered">Offered</option>
                              <option value="Hired">Hired</option>
                              <option value="Rejected">Rejected</option>
                            </select>
                            {onUpdateApplicationDetails && (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={draftOverride}
                                  onChange={(e) =>
                                    setOverrideDrafts((prev) => ({
                                      ...prev,
                                      [app.id]: e.target.value,
                                    }))
                                  }
                                  placeholder="Human review note..."
                                  aria-label={`Human decision note for ${app.applicantName}`}
                                  className="w-36 rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-800 focus:border-[#164081] focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateApplicationDetails(app.id, {
                                      humanDecisionOverride: draftOverride.trim(),
                                    })
                                  }
                                  className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  Save
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Employer Organization & Agency Profile */}
      {activeTab === 'company' && (
        <div className="mt-6 max-w-3xl rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                Company &amp; Recruitment Agency Profile
              </h2>
              <p className="text-xs text-slate-600">
                Keep your Ethiopian organization details, logo, and public career profile up to date.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Admin Verification: {currentUser.status.toUpperCase()}
            </span>
          </div>

          {compSaveMsg && (
            <div
              role="alert"
              className={`mt-4 rounded-lg border px-4 py-2.5 text-xs font-medium ${
                compSaveMsg.isError
                  ? 'border-rose-200 bg-rose-50 text-rose-800'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800'
              }`}
            >
              {compSaveMsg.text}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setCompSaveMsg(null);
              if (!onUpdateCompanyProfile) return;
              const err = onUpdateCompanyProfile({
                fullName: currentUser.fullName,
                phone: compPhone.trim(),
                companyName: compName.trim(),
                tinNumber: compTin.trim(),
                companyLocation: compLocation.trim(),
                companyWebsite: compWebsite.trim() || undefined,
                companyDescription: compDescription.trim(),
                companyLogoDataUrl: compLogo,
                isRecruitmentAgency: compIsAgency,
              });
              if (err) {
                setCompSaveMsg({ text: err, isError: true });
              } else {
                setCompSaveMsg({ text: 'Company profile saved and synchronized.' });
              }
            }}
            className="mt-5 space-y-4"
          >
            <div className="flex flex-wrap items-center gap-4">
              {compLogo ? (
                <img
                  src={compLogo}
                  alt={compName || 'Company Logo'}
                  className="h-16 w-16 rounded-xl border border-slate-200 object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400">
                  <Building2 className="h-7 w-7" />
                </div>
              )}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    <Upload className="h-3.5 w-3.5 text-[#164081]" />
                    Upload Logo (&lt; 2 MB)
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        if (file.size > 2 * 1024 * 1024) {
                          setCompSaveMsg({ text: 'Logo image must be under 2 MB.', isError: true });
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => {
                          if (typeof reader.result === 'string') setCompLogo(reader.result);
                        };
                        reader.readAsDataURL(file);
                      }}
                      className="sr-only"
                    />
                  </label>
                  {compLogo && (
                    <button
                      type="button"
                      onClick={() => setCompLogo(undefined)}
                      className="text-xs font-semibold text-rose-700 hover:underline"
                    >
                      Remove Logo
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">PNG, JPG, or SVG recommended.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-slate-700">
                Company / Organization Name *
                <input
                  type="text"
                  required
                  value={compName}
                  onChange={(e) => setCompName(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Business TIN / License *
                <input
                  type="text"
                  required
                  value={compTin}
                  onChange={(e) => setCompTin(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Primary Phone *
                <input
                  type="text"
                  required
                  value={compPhone}
                  onChange={(e) => setCompPhone(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Headquarters / City
                <input
                  type="text"
                  value={compLocation}
                  onChange={(e) => setCompLocation(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                />
              </label>
            </div>

            <label className="block text-xs font-semibold text-slate-700">
              Company Website
              <input
                type="url"
                value={compWebsite}
                onChange={(e) => setCompWebsite(e.target.value)}
                placeholder="https://company.et"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
              />
            </label>

            <label className="block text-xs font-semibold text-slate-700">
              Organization Overview &amp; Culture
              <textarea
                rows={4}
                value={compDescription}
                onChange={(e) => setCompDescription(e.target.value)}
                placeholder="Describe your sector, hiring priorities, and workplace culture..."
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
              />
            </label>

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={compIsAgency}
                onChange={(e) => setCompIsAgency(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#164081]"
              />
              Operating as a licensed Recruitment / Staffing Agency
            </label>

            <div className="flex justify-end border-t border-slate-100 pt-4">
              <button
                type="submit"
                className="rounded-lg bg-[#164081] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#102E61]"
              >
                Save Company Profile
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Employer Edit Job Modal */}
      {editingJob && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Edit ${editingJob.titleEn}`}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setEditError(null);
              const err = onUpdateJob(editingJob.id, {
                titleEn: editTitle,
                location: editLocation,
                salaryMin: Number(editSalaryMin),
                salaryMax: Number(editSalaryMax),
                deadline: editDeadline,
                descriptionEn: editDesc,
              });
              if (err) {
                setEditError(err);
                return;
              }
              setEditingJob(null);
            }}
            className="max-h-[90vh] w-full max-w-lg space-y-3.5 overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <p className="text-xs font-semibold text-[#164081]">Update Vacancy Details</p>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  {editingJob.titleEn}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingJob(null)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {editError && (
              <div
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800"
              >
                {editError}
              </div>
            )}

            <label className="block text-xs font-semibold text-slate-700">
              Job Title *
              <input
                type="text"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-slate-700">
                Location *
                <input
                  type="text"
                  required
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Application Deadline *
                <input
                  type="date"
                  required
                  value={editDeadline}
                  onChange={(e) => setEditDeadline(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 tabular-nums"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Min Salary (ETB) *
                <input
                  type="number"
                  min={0}
                  required
                  value={editSalaryMin}
                  onChange={(e) => setEditSalaryMin(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 tabular-nums"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Max Salary (ETB) *
                <input
                  type="number"
                  min={0}
                  required
                  value={editSalaryMax}
                  onChange={(e) => setEditSalaryMax(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 tabular-nums"
                />
              </label>
            </div>

            <label className="block text-xs font-semibold text-slate-700">
              Full Description *
              <textarea
                rows={4}
                required
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </label>

            <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setEditingJob(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102E61]"
              >
                Save Vacancy Changes
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

