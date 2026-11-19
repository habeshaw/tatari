import React, { useState } from 'react';
import { Lock, Upload, X } from 'lucide-react';
import { formatCurrencyEtb, validatePaymentSubmission } from '../lib/storeLogic';
import type { PaymentSubmissionInput } from '../lib/storeLogic';
import type {
  DigitalProduct,
  JobListing,
  PaymentMethod,
  UserProfile,
  UserRole,
} from '../types/domain';

/* 1. Job Easy Apply Modal */
interface JobApplyModalProps {
  job: JobListing;
  currentUser: UserProfile | null;
  onClose: () => void;
  onSubmit: (payload: {
    job: JobListing;
    applicantName: string;
    applicantEmail: string;
    phone: string;
    resumeUrl: string;
    yearsExperience: string;
    coverNote: string;
  }) => void;
}

export const JobApplyModal: React.FC<JobApplyModalProps> = ({
  job,
  currentUser,
  onClose,
  onSubmit,
}) => {
  const [applicantName, setApplicantName] = useState(currentUser?.fullName || '');
  const [applicantEmail, setApplicantEmail] = useState(currentUser?.email || '');
  const [phone, setPhone] = useState(currentUser?.phone || '+251911');
  const [resumeUrl, setResumeUrl] = useState('https://drive.google.com/my-cv-2026');
  const [yearsExperience, setYearsExperience] = useState('3-5 years');
  const [coverNote, setCoverNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (applicantName.trim().length < 2) {
      setError('Full name is required.');
      return;
    }
    if (!applicantEmail.includes('@')) {
      setError('A valid email address is required.');
      return;
    }
    if (phone.trim().length < 6) {
      setError('A valid phone number is required.');
      return;
    }
    if (!resumeUrl.trim()) {
      setError('Please provide your CV / Resume link.');
      return;
    }
    onSubmit({
      job,
      applicantName: applicantName.trim(),
      applicantEmail: applicantEmail.trim().toLowerCase(),
      phone: phone.trim(),
      resumeUrl: resumeUrl.trim(),
      yearsExperience,
      coverNote: coverNote.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Apply for ${job.titleEn}`}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs font-semibold text-[#164081]">Easy Apply</p>
            <h2 className="mt-0.5 font-display text-lg font-bold text-slate-900">
              {job.titleEn}
            </h2>
            <p className="text-xs text-slate-500">
              {job.companyName} · {job.location}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close application modal"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
              {error}
            </div>
          )}

          <label className="block text-xs font-semibold text-slate-700">
            Full Name *
            <input
              type="text"
              required
              value={applicantName}
              onChange={(e) => setApplicantName(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-700">
              Email Address *
              <input
                type="email"
                required
                value={applicantEmail}
                onChange={(e) => setApplicantEmail(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
              />
            </label>

            <label className="block text-xs font-semibold text-slate-700">
              Phone Number *
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
              />
            </label>
          </div>

          <label className="block text-xs font-semibold text-slate-700">
            CV / Resume Link (Google Drive, LinkedIn, or Portfolio) *
            <input
              type="url"
              required
              value={resumeUrl}
              onChange={(e) => setResumeUrl(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
            />
          </label>

          <label className="block text-xs font-semibold text-slate-700">
            Relevant Experience
            <select
              value={yearsExperience}
              onChange={(e) => setYearsExperience(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
            >
              <option value="0-1 years">0–1 years</option>
              <option value="1-3 years">1–3 years</option>
              <option value="3-5 years">3–5 years</option>
              <option value="5+ years">5+ years</option>
            </select>
          </label>

          <label className="block text-xs font-semibold text-slate-700">
            Cover Note
            <textarea
              rows={3}
              value={coverNote}
              onChange={(e) => setCoverNote(e.target.value)}
              placeholder="Briefly highlight why you are a great fit for this role..."
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
            />
          </label>

          <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#164081] px-5 py-2 text-xs font-semibold text-white hover:bg-[#102E61]"
            >
              Submit Application
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* 2. Digital Store Payment Checkout Modal */
interface PaymentCheckoutModalProps {
  product: DigitalProduct;
  currentUser: UserProfile | null;
  onClose: () => void;
  onSubmitPayment: (product: DigitalProduct, payment: PaymentSubmissionInput) => void;
}

export const PaymentCheckoutModal: React.FC<PaymentCheckoutModalProps> = ({
  product,
  currentUser,
  onClose,
  onSubmitPayment,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Telebirr');
  const [payerName, setPayerName] = useState(currentUser?.fullName || '');
  const [payerEmail, setPayerEmail] = useState(currentUser?.email || '');
  const [payerPhone, setPayerPhone] = useState(currentUser?.phone || '+251911');
  const [transactionRef, setTransactionRef] = useState('');
  const [receiptNote, setReceiptNote] = useState('');
  const [receiptImageData, setReceiptImageData] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: PaymentSubmissionInput = {
      payerEmail: payerEmail.trim().toLowerCase(),
      payerName: payerName.trim(),
      payerPhone: payerPhone.trim(),
      paymentMethod,
      transactionRef: transactionRef.trim(),
      receiptNote: receiptNote.trim(),
      receiptImageData,
    };
    const err = validatePaymentSubmission(payload);
    if (err) {
      setError(err);
      return;
    }
    onSubmitPayment(product, payload);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Checkout ${product.titleEn}`}
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs font-semibold text-[#164081]">Digital Material Checkout</p>
            <h2 className="mt-0.5 font-display text-lg font-bold text-slate-900">
              {product.titleEn}
            </h2>
            <p className="mt-1 font-mono text-sm font-bold text-slate-900 tabular-nums">
              Amount Due: {formatCurrencyEtb(product.priceEtb)}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close checkout modal"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700">
            <div className="font-bold text-slate-900">Merchant Payment Instructions</div>
            <p className="mt-1">
              1. Send{' '}
              <strong className="font-mono">{formatCurrencyEtb(product.priceEtb)}</strong> via{' '}
              <strong>Telebirr (0911-00-44-22)</strong> or{' '}
              <strong>CBE (1000284910293 — TATARI Consulting)</strong>.<br />
              2. Enter your transaction reference below.<br />
              3. Download unlocks automatically once the Administrator approves receipt of payment.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800"
            >
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-700">
              Payment Method *
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
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
                placeholder="e.g. TB-774411"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
              />
            </label>

            <label className="block text-xs font-semibold text-slate-700">
              Your Full Name *
              <input
                type="text"
                required
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
              />
            </label>

            <label className="block text-xs font-semibold text-slate-700">
              Your Email Address *
              <input
                type="email"
                required
                value={payerEmail}
                onChange={(e) => setPayerEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
              />
            </label>
          </div>

          <label className="block text-xs font-semibold text-slate-700">
            Payer Phone / Account *
            <input
              type="text"
              required
              value={payerPhone}
              onChange={(e) => setPayerPhone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
            />
          </label>

          <label className="block text-xs font-semibold text-slate-700">
            Upload Payment Receipt Image (Optional)
            <div className="mt-1.5 flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                <Upload className="h-3.5 w-3.5" />
                Attach Screenshot
                <input type="file" accept="image/*" onChange={handleFileChange} className="sr-only" />
              </label>
              {receiptImageData && (
                <span className="text-xs font-medium text-emerald-700">Screenshot attached</span>
              )}
            </div>
          </label>

          <label className="block text-xs font-semibold text-slate-700">
            Payment Note (Optional)
            <input
              type="text"
              value={receiptNote}
              onChange={(e) => setReceiptNote(e.target.value)}
              placeholder="Sender account or branch info"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
            />
          </label>

          <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#164081] px-5 py-2 text-xs font-semibold text-white hover:bg-[#102E61]"
            >
              <Lock className="h-3.5 w-3.5" />
              Submit Receipt for Approval
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* 3. Auth Sign In / Self-Register Modal */
interface AuthModalProps {
  currentUser: UserProfile | null;
  users: UserProfile[];
  onClose: () => void;
  onSignIn: (email: string) => void;
  onRegister: (user: {
    email: string;
    fullName: string;
    companyName?: string;
    phone?: string;
    role: UserRole;
  }) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  currentUser,
  users,
  onClose,
  onSignIn,
  onRegister,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState(currentUser?.email || 'abebe@tatari.et');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('+251911');
  const [role, setRole] = useState<UserRole>('seeker');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (mode === 'signin') {
      const exists = users.find((u) => u.email.toLowerCase() === cleanEmail);
      if (!exists) {
        setError('Account not found. Switch to Register to create a new account.');
        return;
      }
      if (exists.status === 'suspended') {
        setError('This account has been suspended by the Administrator.');
        return;
      }
      onSignIn(exists.email);
      onClose();
      return;
    }

    if (cleanEmail === 'admin@tatari.et') {
      setError('admin@tatari.et is reserved for the system administrator.');
      return;
    }
    if (fullName.trim().length < 2) {
      setError('Full name is required.');
      return;
    }
    onRegister({
      email: cleanEmail,
      fullName: fullName.trim(),
      companyName: companyName.trim() || undefined,
      phone: phone.trim() || undefined,
      role,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Account sign in and registration"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              {mode === 'signin' ? 'Sign In to TATARI' : 'Create TATARI Account'}
            </h2>
            <p className="text-xs text-slate-500">
              {currentUser
                ? `Active session: ${currentUser.email} (${currentUser.role.toUpperCase()})`
                : 'Choose an account or register below.'}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close account modal"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
              {error}
            </div>
          )}

          {mode === 'signup' && (
            <>
              <label className="block text-xs font-semibold text-slate-700">
                Full Name *
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                />
              </label>

              <label className="block text-xs font-semibold text-slate-700">
                Account Role
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                >
                  <option value="seeker">Job Seeker &amp; Digital Store Buyer</option>
                  <option value="employer">Employer / Hiring Organization</option>
                </select>
              </label>

              {role === 'employer' && (
                <label className="block text-xs font-semibold text-slate-700">
                  Company Name
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                  />
                </label>
              )}

              <label className="block text-xs font-semibold text-slate-700">
                Phone Number
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                />
              </label>
            </>
          )}

          <label className="block text-xs font-semibold text-slate-700">
            Email Address *
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-lg bg-[#164081] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#102E61]"
          >
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {/* Quick Demo Role Switcher inside Auth Modal */}
        <div className="mt-5 border-t border-slate-200 pt-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Quick Switch Demo Accounts
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                onSignIn('abebe@tatari.et');
                onClose();
              }}
              className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Job Seeker
            </button>
            <button
              type="button"
              onClick={() => {
                onSignIn('hr@addistech.et');
                onClose();
              }}
              className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Employer
            </button>
            <button
              type="button"
              onClick={() => {
                onSignIn('admin@tatari.et');
                onClose();
              }}
              className="rounded-lg border border-[#164081] bg-[#F0F5FF] px-2.5 py-2 text-xs font-semibold text-[#164081] hover:bg-[#E5EEFD]"
            >
              Admin
            </button>
          </div>
        </div>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            className="text-xs font-semibold text-[#164081] hover:underline"
          >
            {mode === 'signin'
              ? 'New to TATARI? Register an account'
              : 'Already have an account? Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* 4. Admin Add Digital Store Material Modal */
interface AddProductModalProps {
  onClose: () => void;
  onAddProduct: (product: Omit<DigitalProduct, 'id' | 'sellerEmail' | 'active' | 'createdAt'>) => void;
}

export const AddProductModal: React.FC<AddProductModalProps> = ({ onClose, onAddProduct }) => {
  const [titleEn, setTitleEn] = useState('');
  const [category, setCategory] = useState('Payroll & HR');
  const [priceEtb, setPriceEtb] = useState(1200);
  const [fileFormat, setFileFormat] = useState('XLSX / PDF');
  const [fileSize, setFileSize] = useState('2.5 MB');
  const [version, setVersion] = useState('v1.0');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [includedFilesText, setIncludedFilesText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddProduct({
      titleEn: titleEn.trim(),
      category,
      priceEtb: Number(priceEtb),
      fileFormat,
      fileSize,
      version,
      descriptionEn: descriptionEn.trim(),
      includedFiles: includedFilesText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Add digital material"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl space-y-4"
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 className="font-display text-lg font-bold text-slate-900">
            Publish Digital Material to Store
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="block text-xs font-semibold text-slate-700">
          Material Title *
          <input
            type="text"
            required
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-semibold text-slate-700">
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="Payroll & HR">Payroll &amp; HR</option>
              <option value="BI Dashboards">BI Dashboards</option>
              <option value="Legal & Compliance">Legal &amp; Compliance</option>
              <option value="Financial Models">Financial Models</option>
              <option value="Career & CV Kits">Career &amp; CV Kits</option>
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Price (ETB) *
            <input
              type="number"
              min={50}
              required
              value={priceEtb}
              onChange={(e) => setPriceEtb(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 tabular-nums"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            File Format
            <input
              type="text"
              value={fileFormat}
              onChange={(e) => setFileFormat(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Version / Size
            <input
              type="text"
              value={`${version} · ${fileSize}`}
              onChange={(e) => {
                const [v, s] = e.target.value.split('·').map((x) => x.trim());
                setVersion(v || 'v1.0');
                setFileSize(s || '2.5 MB');
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </label>
        </div>

        <label className="block text-xs font-semibold text-slate-700">
          Description *
          <textarea
            rows={3}
            required
            value={descriptionEn}
            onChange={(e) => setDescriptionEn(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
        </label>

        <label className="block text-xs font-semibold text-slate-700">
          Included Deliverable Files (one per line)
          <textarea
            rows={2}
            value={includedFilesText}
            onChange={(e) => setIncludedFilesText(e.target.value)}
            placeholder="Master_Workbook.xlsx&#10;Implementation_Guide.pdf"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
        </label>

        <div className="flex justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102E61]"
          >
            Publish Material
          </button>
        </div>
      </form>
    </div>
  );
};
