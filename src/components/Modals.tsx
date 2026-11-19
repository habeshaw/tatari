import React, { useState } from 'react';
import { LogOut, Lock, ShieldCheck, Trash2, Upload, UserCheck, UserPen, X } from 'lucide-react';
import {
  validateEmailFormat,
  validatePasswordStrength,
  type SelfProfileUpdateInput,
} from '../lib/security';
import {
  calculateCommercialPricing,
  formatCurrencyEtb,
  validatePaymentSubmission,
  type PaymentSubmissionInput,
} from '../lib/storeLogic';
import type {
  DigitalProduct,
  JobListing,
  PaymentMethod,
  UserProfile,
} from '../types/domain';

/* 1. Job Easy Apply Modal (Registers Job Seeker automatically while applying if unauthenticated) */
interface JobApplyModalProps {
  job: JobListing;
  currentUser: UserProfile | null;
  onClose: () => void;
  onOpenSignIn: () => void;
  onSubmit: (payload: {
    job: JobListing;
    applicantName: string;
    applicantEmail: string;
    phone: string;
    resumeUrl: string;
    yearsExperience: string;
    coverNote: string;
    password?: string;
    confirmPassword?: string;
  }) => string | null;
}

export const JobApplyModal: React.FC<JobApplyModalProps> = ({
  job,
  currentUser,
  onClose,
  onOpenSignIn,
  onSubmit,
}) => {
  const [applicantName, setApplicantName] = useState(currentUser?.fullName || '');
  const [applicantEmail, setApplicantEmail] = useState(currentUser?.email || '');
  const [phone, setPhone] = useState(currentUser?.phone || '+251911');
  const [resumeUrl, setResumeUrl] = useState(
    currentUser?.defaultResumeUrl || 'https://drive.google.com/my-cv-2026'
  );
  const [yearsExperience, setYearsExperience] = useState('3-5 years');
  const [coverNote, setCoverNote] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isGuest = !currentUser;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (applicantName.trim().length < 2) {
      setError('Full name is required.');
      return;
    }
    if (!validateEmailFormat(applicantEmail)) {
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

    if (isGuest) {
      const pwdErr = validatePasswordStrength(password);
      if (pwdErr) {
        setError(pwdErr);
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    const submitErr = onSubmit({
      job,
      applicantName: applicantName.trim(),
      applicantEmail: applicantEmail.trim().toLowerCase(),
      phone: phone.trim(),
      resumeUrl: resumeUrl.trim(),
      yearsExperience,
      coverNote: coverNote.trim(),
      password: isGuest ? password : undefined,
      confirmPassword: isGuest ? confirmPassword : undefined,
    });

    if (submitErr) {
      setError(submitErr);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Apply for ${job.titleEn}`}
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs font-semibold text-[#164081]">
              {isGuest ? 'Easy Apply & Instant Job Seeker Registration' : 'Easy Apply'}
            </p>
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

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {isGuest ? (
            <div className="rounded-lg border border-blue-200 bg-[#F0F5FF] p-3 text-xs text-slate-700">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[#10243B]">
                  No pre-registration needed to browse jobs
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSignIn();
                  }}
                  className="font-semibold text-[#164081] hover:underline whitespace-nowrap"
                >
                  Already registered? Sign in
                </button>
              </div>
              <p className="mt-1 text-slate-600">
                Submitting this application registers your Job Seeker account automatically so you
                can track interview updates.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              <UserCheck className="h-4 w-4 text-emerald-700 shrink-0" />
              <span>
                Applying as <strong>{currentUser.fullName}</strong> ({currentUser.email})
              </span>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800"
            >
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
                readOnly={!isGuest}
                value={applicantEmail}
                onChange={(e) => setApplicantEmail(e.target.value)}
                className={`mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none ${
                  !isGuest ? 'bg-slate-100 text-slate-600' : ''
                }`}
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

          {isGuest && (
            <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3.5 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-slate-700">
                Create Account Password *
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 chars + number"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Confirm Password *
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                />
              </label>
            </div>
          )}

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
              {isGuest ? 'Register & Submit Application' : 'Submit Application'}
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
  currentUser: UserProfile;
  onClose: () => void;
  onSubmitPayment: (product: DigitalProduct, payment: PaymentSubmissionInput) => string | null;
}

export const PaymentCheckoutModal: React.FC<PaymentCheckoutModalProps> = ({
  product,
  currentUser,
  onClose,
  onSubmitPayment,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Telebirr');
  const [payerName, setPayerName] = useState(currentUser.fullName);
  const [payerPhone, setPayerPhone] = useState(currentUser.phone || '+251911');
  const [transactionRef, setTransactionRef] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromoInput, setAppliedPromoInput] = useState('');
  const [receiptNote, setReceiptNote] = useState('');
  const [receiptImageData, setReceiptImageData] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const pricing = calculateCommercialPricing(product.priceEtb, appliedPromoInput, true);

  const handleApplyPromo = () => {
    setAppliedPromoInput(promoInput.trim().toUpperCase());
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload: PaymentSubmissionInput = {
      payerEmail: currentUser.email.toLowerCase(),
      payerName: payerName.trim(),
      payerPhone: payerPhone.trim(),
      paymentMethod,
      transactionRef: transactionRef.trim(),
      promoCode: pricing.appliedPromoCode,
      applyVat: true,
      receiptNote: receiptNote.trim(),
      receiptImageData,
    };
    const err = validatePaymentSubmission(payload);
    if (err) {
      setError(err);
      return;
    }
    const submitErr = onSubmitPayment(product, payload);
    if (submitErr) {
      setError(submitErr);
    }
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
              Total Due (incl. 15% VAT): {formatCurrencyEtb(pricing.totalEtb)}
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
          {/* Commercial Promo Code & VAT Breakdown */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value)}
                placeholder="Promo code (e.g. TATARI10)"
                aria-label="Promo code"
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs uppercase text-slate-900 focus:border-[#164081] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleApplyPromo}
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

            <dl className="mt-3 space-y-1 border-t border-slate-200 pt-2.5 text-slate-700 tabular-nums">
              <div className="flex justify-between">
                <dt>Base License Price</dt>
                <dd className="font-mono">{formatCurrencyEtb(pricing.subtotalEtb)}</dd>
              </div>
              {pricing.discountEtb > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <dt>Discount ({pricing.appliedPromoCode})</dt>
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
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700">
            <div className="font-bold text-slate-900">Merchant Payment Instructions</div>
            <p className="mt-1">
              1. Send{' '}
              <strong className="font-mono">{formatCurrencyEtb(pricing.totalEtb)}</strong> via{' '}
              <strong>Telebirr (0911-00-44-22)</strong> or{' '}
              <strong>CBE (1000284910293 — TATARI Consulting)</strong>.<br />
              2. Enter your unique transaction reference below.<br />
              3. Download &amp; official VAT invoice unlock for{' '}
              <strong className="font-mono">{currentUser.email}</strong> once the Administrator
              approves receipt of payment.
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
              Registered Buyer Email
              <input
                type="email"
                readOnly
                value={currentUser.email}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-600"
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

/* 3. Secure Auth Sign In / Verified Role Registration / Profile CRUD / Change Password Modal */
interface AuthModalProps {
  currentUser: UserProfile | null;
  initialMode?: 'profile' | 'signin' | 'signup' | 'password';
  initialRole?: 'seeker' | 'employer';
  contextNotice?: string | null;
  lockoutSecondsRemaining?: number;
  onClose: () => void;
  onSignIn: (email: string, password: string) => string | null;
  onSignOut: () => void;
  onRegister: (user: {
    email: string;
    fullName: string;
    companyName?: string;
    tinNumber?: string;
    phone: string;
    role: 'seeker' | 'employer';
    password: string;
    confirmPassword: string;
  }) => string | null;
  onChangePassword: (
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
  ) => string | null;
  onUpdateProfile: (updates: SelfProfileUpdateInput) => string | null;
  onDeleteOwnAccount: (currentPassword: string) => string | null;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  currentUser,
  initialMode = 'signin',
  initialRole = 'seeker',
  contextNotice,
  lockoutSecondsRemaining = 0,
  onClose,
  onSignIn,
  onSignOut,
  onRegister,
  onChangePassword,
  onUpdateProfile,
  onDeleteOwnAccount,
}) => {
  const defaultMode: 'profile' | 'signin' | 'signup' | 'password' =
    currentUser && initialMode === 'signin' && !contextNotice ? 'profile' : initialMode;

  const [mode, setMode] = useState<'profile' | 'signin' | 'signup' | 'password'>(defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [tinNumber, setTinNumber] = useState('');
  const [phone, setPhone] = useState('+251911');
  const [role, setRole] = useState<'seeker' | 'employer'>(initialRole);
  const [error, setError] = useState<string | null>(null);
  const [profileFeedback, setProfileFeedback] = useState<string | null>(null);

  // Self-service Profile Read/Update/Delete fields
  const [editFullName, setEditFullName] = useState(currentUser?.fullName || '');
  const [editPhone, setEditPhone] = useState(currentUser?.phone || '+251911');
  const [editCompanyName, setEditCompanyName] = useState(currentUser?.companyName || '');
  const [editTinNumber, setEditTinNumber] = useState(currentUser?.tinNumber || '');
  const [editHeadline, setEditHeadline] = useState(currentUser?.headline || '');
  const [editResumeUrl, setEditResumeUrl] = useState(currentUser?.defaultResumeUrl || '');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setProfileFeedback(null);

    if (mode === 'profile' && currentUser) {
      const err = onUpdateProfile({
        fullName: editFullName,
        phone: editPhone,
        companyName: currentUser.role === 'employer' ? editCompanyName : undefined,
        tinNumber: currentUser.role === 'employer' ? editTinNumber : undefined,
        headline: editHeadline,
        defaultResumeUrl: editResumeUrl,
      });
      if (err) {
        setError(err);
        return;
      }
      setProfileFeedback('Your profile details were updated successfully.');
      return;
    }

    if (mode === 'password') {
      const err = onChangePassword(currentPassword, newPassword, confirmPassword);
      if (err) {
        setError(err);
        return;
      }
      onClose();
      return;
    }

    if (mode === 'signin') {
      if (lockoutSecondsRemaining > 0) {
        setError(`Too many failed attempts. Try again in ${lockoutSecondsRemaining}s.`);
        return;
      }
      const err = onSignIn(email, password);
      if (err) {
        setError(err);
        return;
      }
      onClose();
      return;
    }

    const err = onRegister({
      email,
      fullName,
      companyName,
      tinNumber,
      phone,
      role,
      password,
      confirmPassword,
    });
    if (err) {
      setError(err);
      return;
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Secure account sign in and registration"
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#164081]">
              <ShieldCheck className="h-4 w-4" />
              <span>TATARI Secure Access</span>
            </div>
            <h2 className="mt-0.5 font-display text-lg font-bold text-slate-900">
              {mode === 'profile'
                ? 'My Profile & Account Controls'
                : mode === 'password'
                ? 'Account Security & Password'
                : mode === 'signin'
                ? 'Sign In to Your Account'
                : 'Register Verified Account'}
            </h2>
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

        {/* Active Session Box with Sign Out */}
        {currentUser && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-bold text-slate-900">{currentUser.fullName}</div>
                <div className="text-slate-600">
                  {currentUser.email} ·{' '}
                  <span className="font-semibold uppercase text-[#164081]">
                    {currentUser.role}
                  </span>{' '}
                  · Status:{' '}
                  <span
                    className={`font-semibold ${
                      currentUser.status === 'approved' ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {currentUser.status}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
                  Joined {new Date(currentUser.createdAt).toLocaleDateString()}
                  {currentUser.lastLoginAt
                    ? ` · Last sign in ${new Date(currentUser.lastLoginAt).toLocaleDateString()}`
                    : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onSignOut();
                  onClose();
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 shrink-0"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        )}

        {contextNotice && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-[#F0F5FF] px-3.5 py-2.5 text-xs text-[#10243B]">
            {contextNotice}
          </div>
        )}

        <div
          role="tablist"
          aria-label="Authentication mode"
          className={`mt-4 grid gap-1.5 rounded-lg bg-slate-100 p-1 ${
            currentUser ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'
          }`}
        >
          {currentUser && (
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'profile'}
              onClick={() => {
                setMode('profile');
                setError(null);
                setProfileFeedback(null);
              }}
              className={`rounded-md py-1.5 text-xs font-semibold transition-colors ${
                mode === 'profile' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              My Profile
            </button>
          )}
          {currentUser && (
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'password'}
              onClick={() => {
                setMode('password');
                setError(null);
                setProfileFeedback(null);
              }}
              className={`rounded-md py-1.5 text-xs font-semibold transition-colors ${
                mode === 'password' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Password
            </button>
          )}
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signin'}
            onClick={() => {
              setMode('signin');
              setError(null);
              setProfileFeedback(null);
            }}
            className={`rounded-md py-1.5 text-xs font-semibold transition-colors ${
              mode === 'signin' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            {currentUser ? 'Switch User' : 'Sign In'}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            onClick={() => {
              setMode('signup');
              setError(null);
              setProfileFeedback(null);
            }}
            className={`rounded-md py-1.5 text-xs font-semibold transition-colors ${
              mode === 'signup' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800"
            >
              {error}
            </div>
          )}

          {profileFeedback && (
            <div
              role="status"
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800"
            >
              {profileFeedback}
            </div>
          )}

          {mode === 'profile' && currentUser ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Full Name *
                  <input
                    type="text"
                    required
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-700">
                  Phone Number *
                  <input
                    type="text"
                    required
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                  />
                </label>
              </div>

              {currentUser.role === 'employer' && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Company / Organization *
                    <input
                      type="text"
                      required
                      value={editCompanyName}
                      onChange={(e) => setEditCompanyName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-700">
                    Business TIN / License *
                    <input
                      type="text"
                      required
                      value={editTinNumber}
                      onChange={(e) => setEditTinNumber(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                    />
                  </label>
                </div>
              )}

              <label className="block text-xs font-semibold text-slate-700">
                Professional Headline (Optional)
                <input
                  type="text"
                  value={editHeadline}
                  onChange={(e) => setEditHeadline(e.target.value)}
                  placeholder="e.g. Senior HR & Payroll Specialist · Addis Ababa"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                />
              </label>

              <label className="block text-xs font-semibold text-slate-700">
                Default CV / Resume URL (Auto-fills Easy Apply)
                <input
                  type="url"
                  value={editResumeUrl}
                  onChange={(e) => setEditResumeUrl(e.target.value)}
                  placeholder="https://drive.google.com/your-cv"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                />
              </label>

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#164081] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#102E61]"
              >
                <UserPen className="h-3.5 w-3.5" />
                Save Profile Changes
              </button>

              {/* Self-service Delete Account Section */}
              <div className="mt-4 border-t border-slate-200 pt-4">
                {currentUser.email.toLowerCase() === 'admin@tatari.et' ? (
                  <p className="text-[11px] text-slate-500">
                    Primary System Administrator account cannot be self-deleted.
                  </p>
                ) : !confirmDeleteOpen ? (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDeleteOpen(true);
                      setError(null);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 hover:underline"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete My Account Permanently
                  </button>
                ) : (
                  <div className="space-y-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3.5">
                    <div className="text-xs font-bold text-rose-900">
                      Confirm Permanent Account Deletion
                    </div>
                    <p className="text-[11px] text-rose-800">
                      Enter your current password to permanently delete{' '}
                      <strong>{currentUser.email}</strong>. This signs you out immediately.
                    </p>
                    <input
                      type="password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      placeholder="Current password to confirm delete"
                      aria-label="Current password to confirm account deletion"
                      className="w-full rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-rose-600 focus:outline-none"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const delErr = onDeleteOwnAccount(deletePassword);
                          if (delErr) {
                            setError(delErr);
                            return;
                          }
                          onClose();
                        }}
                        className="rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800"
                      >
                        Confirm Permanent Deletion
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmDeleteOpen(false);
                          setDeletePassword('');
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : mode === 'password' && currentUser ? (
            <>
              <label className="block text-xs font-semibold text-slate-700">
                Current Password *
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                New Password *
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 chars + letter & number"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Confirm New Password *
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                />
              </label>
              <button
                type="submit"
                className="w-full rounded-lg bg-[#164081] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#102E61]"
              >
                Update Password Securely
              </button>
            </>
          ) : (
            <>
              {mode === 'signup' && (
                <>
                  <label className="block text-xs font-semibold text-slate-700">
                    Account Type *
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as 'seeker' | 'employer')}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                    >
                      <option value="seeker">Job Seeker &amp; Digital Store Buyer</option>
                      <option value="employer">Employer / Hiring Organization</option>
                    </select>
                  </label>

                  {role === 'employer' && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                      Employer accounts require Company Name &amp; TIN verification by the
                      Administrator before posting jobs or accessing candidate pipelines.
                    </div>
                  )}

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

                  {role === 'employer' && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Company Name *
                        <input
                          type="text"
                          required
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="e.g. EthioCorp PLC"
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                        />
                      </label>
                      <label className="block text-xs font-semibold text-slate-700">
                        Business TIN / License *
                        <input
                          type="text"
                          required
                          value={tinNumber}
                          onChange={(e) => setTinNumber(e.target.value)}
                          placeholder="e.g. 0045678912"
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                        />
                      </label>
                    </div>
                  )}

                  <label className="block text-xs font-semibold text-slate-700">
                    Phone Number *
                    <input
                      type="text"
                      required
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
                  placeholder="name@company.et"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                />
              </label>

              <label className="block text-xs font-semibold text-slate-700">
                Password *
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    mode === 'signup' ? 'Min 8 characters + letter & number' : 'Enter password'
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                />
              </label>

              {mode === 'signup' && (
                <label className="block text-xs font-semibold text-slate-700">
                  Confirm Password *
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
                  />
                </label>
              )}

              <button
                type="submit"
                disabled={mode === 'signin' && lockoutSecondsRemaining > 0}
                className="w-full rounded-lg bg-[#164081] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#102E61] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {mode === 'signin' ? 'Sign In Securely' : 'Create Verified Account'}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
};

/* 4. Admin Create / Edit Digital Store Material Modal */
interface AddProductModalProps {
  editingProduct?: DigitalProduct | null;
  onClose: () => void;
  onAddProduct: (product: Omit<DigitalProduct, 'id' | 'sellerEmail' | 'active' | 'createdAt'>) => void;
  onUpdateProduct?: (
    productId: string,
    updates: Omit<DigitalProduct, 'id' | 'sellerEmail' | 'active' | 'createdAt'>
  ) => void;
}

export const AddProductModal: React.FC<AddProductModalProps> = ({
  editingProduct,
  onClose,
  onAddProduct,
  onUpdateProduct,
}) => {
  const [titleEn, setTitleEn] = useState(editingProduct?.titleEn || '');
  const [category, setCategory] = useState(editingProduct?.category || 'Payroll & HR');
  const [priceEtb, setPriceEtb] = useState(editingProduct?.priceEtb ?? 1200);
  const [fileFormat, setFileFormat] = useState(editingProduct?.fileFormat || 'XLSX / PDF');
  const [fileSize, setFileSize] = useState(editingProduct?.fileSize || '2.5 MB');
  const [version, setVersion] = useState(editingProduct?.version || 'v1.0');
  const [descriptionEn, setDescriptionEn] = useState(editingProduct?.descriptionEn || '');
  const [includedFilesText, setIncludedFilesText] = useState(
    editingProduct?.includedFiles?.join('\n') || ''
  );

  const isEditing = Boolean(editingProduct);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      titleEn: titleEn.trim(),
      category,
      priceEtb: Number(priceEtb),
      fileFormat: fileFormat.trim(),
      fileSize: fileSize.trim(),
      version: version.trim(),
      descriptionEn: descriptionEn.trim(),
      includedFiles: includedFilesText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    if (editingProduct && onUpdateProduct) {
      onUpdateProduct(editingProduct.id, payload);
    } else {
      onAddProduct(payload);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? 'Edit digital material' : 'Add digital material'}
    >
      <form
        onSubmit={handleSubmit}
        className="max-h-[92vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 className="font-display text-lg font-bold text-slate-900">
            {isEditing ? 'Update Digital Material' : 'Publish Digital Material to Store'}
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
            {isEditing ? 'Save Material Changes' : 'Publish Material'}
          </button>
        </div>
      </form>
    </div>
  );
};
