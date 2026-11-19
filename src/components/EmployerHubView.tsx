import React, { useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Clock,
  Lock,
  Plus,
  ShieldAlert,
  Upload,
  Users,
  XCircle,
} from 'lucide-react';
import { formatCurrencyEtb, validateJobDraft } from '../lib/storeLogic';
import type {
  ApplicationStage,
  JobApplication,
  JobListing,
  JobType,
  PaymentMethod,
  PaymentReceipt,
  RemoteType,
  UserProfile,
} from '../types/domain';
import type { JobDraftInput, PaymentSubmissionInput } from '../lib/storeLogic';

interface EmployerHubViewProps {
  currentUser: UserProfile | null;
  jobs: JobListing[];
  applications: JobApplication[];
  receipts: PaymentReceipt[];
  onSubmitJobWithPayment: (draft: JobDraftInput, payment: PaymentSubmissionInput) => void;
  onUpdateApplicationStage: (appId: string, stage: ApplicationStage) => void;
  onRequireAuth: (options?: { mode?: 'signin' | 'signup'; role?: 'seeker' | 'employer'; notice?: string }) => void;
}

const JOB_POSTING_FEE_ETB = 500;

export const EmployerHubView: React.FC<EmployerHubViewProps> = ({
  currentUser,
  jobs,
  applications,
  receipts,
  onSubmitJobWithPayment,
  onUpdateApplicationStage,
  onRequireAuth,
}) => {
  const [activeTab, setActiveTab] = useState<'post' | 'listings' | 'candidates'>('post');
  const [step, setStep] = useState<1 | 2>(1);
  const [formError, setFormError] = useState<string | null>(null);

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
  const [receiptNote, setReceiptNote] = useState('');
  const [receiptImageData, setReceiptImageData] = useState<string | undefined>(undefined);

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
    postingFeeEtb: JOB_POSTING_FEE_ETB,
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
    try {
      onSubmitJobWithPayment(buildDraft(), {
        payerEmail: currentUser.email,
        payerName: payerName || currentUser.fullName,
        payerPhone,
        paymentMethod,
        transactionRef,
        receiptNote,
        receiptImageData,
      });
      setTitleEn('');
      setTitleAm('');
      setDescriptionEn('');
      setRequirementsText('');
      setBenefitsText('');
      setTransactionRef('');
      setReceiptNote('');
      setReceiptImageData(undefined);
      setStep(1);
      setActiveTab('listings');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to submit job posting.');
    }
  };

  const employerJobs = jobs.filter(
    (j) =>
      currentUser.role === 'admin' ||
      j.employerEmail.toLowerCase() === currentUser.email.toLowerCase()
  );

  const employerJobIds = new Set(employerJobs.map((j) => j.id));
  const employerCandidates = applications.filter((a) => employerJobIds.has(a.jobId));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="border-b border-slate-200 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">
              Employer Hiring Hub
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Post verified vacancies ({formatCurrencyEtb(JOB_POSTING_FEE_ETB)} posting fee) and
              review applicants. Job posts publish live immediately after Administrator payment
              approval.
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
        </div>
      </div>

      {/* Tab 1: Two-Step Post a Job + Payment Receipt */}
      {activeTab === 'post' && (
        <div className="mt-6 max-w-3xl rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 tabular-nums">
              Step {step} of 2 · {step === 1 ? 'Vacancy Details' : 'Payment Receipt Verification'}
            </div>
            <div className="font-mono text-xs font-semibold text-[#164081] tabular-nums">
              Posting Fee: {formatCurrencyEtb(JOB_POSTING_FEE_ETB)}
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
            <form onSubmit={handleContinueToPayment} className="space-y-4">
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
                  Continue to Payment ({formatCurrencyEtb(JOB_POSTING_FEE_ETB)})
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleFinalSubmit} className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
                <div className="font-bold text-slate-900">
                  TATARI Job Posting Fee: {formatCurrencyEtb(JOB_POSTING_FEE_ETB)}
                </div>
                <p className="mt-1">
                  Transfer {formatCurrencyEtb(JOB_POSTING_FEE_ETB)} to{' '}
                  <strong className="font-mono">Telebirr 0911-00-44-22</strong> or{' '}
                  <strong className="font-mono">CBE 1000284910293</strong> (TATARI Consulting PLC),
                  then enter your transaction reference below. Your vacancy will publish live once
                  the Administrator verifies receipt.
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
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-5 py-3.5">Job Title</th>
                <th className="px-5 py-3.5">Location &amp; Pay</th>
                <th className="px-5 py-3.5">Receipt Ref</th>
                <th className="px-5 py-3.5">Approval Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employerJobs.map((job) => {
                const rcpt = receipts.find((r) => r.id === job.paymentReceiptId);
                return (
                  <tr key={job.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900">{job.titleEn}</div>
                      <div className="text-xs text-slate-500">{job.companyName}</div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600 tabular-nums">
                      {job.location} · {job.salaryDisplay}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-700">
                      {rcpt ? `${rcpt.paymentMethod}: ${rcpt.transactionRef}` : 'Seeded'}
                    </td>
                    <td className="px-5 py-3.5 text-xs">
                      {job.status === 'approved' ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approved &amp; Live
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Candidate Pipeline */}
      {activeTab === 'candidates' && (
        <div className="mt-6">
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
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="px-5 py-3.5">Candidate</th>
                    <th className="px-5 py-3.5">Vacancy</th>
                    <th className="px-5 py-3.5">Resume</th>
                    <th className="px-5 py-3.5">Stage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employerCandidates.map((app) => (
                    <tr key={app.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-900">{app.applicantName}</div>
                        <div className="text-xs text-slate-500">
                          {app.applicantEmail} · {app.phone}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-700">{app.jobTitle}</td>
                      <td className="px-5 py-3.5">
                        <a
                          href={app.resumeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-[#164081] hover:underline"
                        >
                          Open CV Link
                        </a>
                      </td>
                      <td className="px-5 py-3.5">
                        <select
                          aria-label={`Stage for ${app.applicantName}`}
                          value={app.status}
                          onChange={(e) =>
                            onUpdateApplicationStage(app.id, e.target.value as ApplicationStage)
                          }
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-[#164081] focus:outline-none"
                        >
                          <option value="Submitted">Submitted</option>
                          <option value="Under Review">Under Review</option>
                          <option value="Shortlisted">Shortlisted</option>
                          <option value="Interview">Interview</option>
                          <option value="Hired">Hired</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
