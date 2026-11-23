import React, { useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  FileText,
  HelpCircle,
  Lock,
  Mail,
  ShieldCheck,
  ShoppingBag,
  UserCheck,
  X,
} from 'lucide-react';
import type { AppView, Language, UserProfile } from '../types/domain';

type HelpTab = 'seeker' | 'employer' | 'buyer' | 'admin';

interface HelpModalProps {
  currentUser: UserProfile | null;
  language: Language;
  onClose: () => void;
  onNavigate: (view: AppView) => void;
  onOpenAuth: (mode?: 'signin' | 'signup', role?: 'seeker' | 'employer') => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({
  currentUser,
  language,
  onClose,
  onNavigate,
  onOpenAuth,
}) => {
  const isAdmin = currentUser?.role === 'admin' && currentUser?.status === 'approved';

  const initialTab: HelpTab = isAdmin
    ? 'admin'
    : currentUser?.role === 'employer'
    ? 'employer'
    : 'seeker';

  const [tab, setTab] = useState<HelpTab>(initialTab);

  const tabs: { id: HelpTab; label: string; icon: React.ReactNode }[] = [
    { id: 'seeker', label: 'Job Seekers', icon: <UserCheck className="h-3.5 w-3.5" /> },
    { id: 'employer', label: 'Employers', icon: <Briefcase className="h-3.5 w-3.5" /> },
    { id: 'buyer', label: 'Digital Store Buyers', icon: <ShoppingBag className="h-3.5 w-3.5" /> },
    ...(isAdmin
      ? [{ id: 'admin' as HelpTab, label: 'Administrators', icon: <ShieldCheck className="h-3.5 w-3.5" /> }]
      : []),
  ];

  const handleGoView = (view: AppView) => {
    onNavigate(view);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="TATARI Help & Support Center"
    >
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#164081]">
              <HelpCircle className="h-4 w-4" />
              <span>
                {language === 'am'
                  ? 'የታታሪ የእገዛ እና የድጋፍ ማዕከል'
                  : 'TATARI Help & Role Support Center'}
              </span>
            </div>
            <h2 className="mt-0.5 font-display text-xl font-extrabold text-slate-900">
              How can we help you today?
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Select your role below for step-by-step workflows, security rules, payment verification
              instructions, and administration documentation.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close help modal"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Role Selector Tabs */}
        <div
          role="tablist"
          aria-label="Help guide by user role"
          className={`mt-4 grid grid-cols-2 gap-1.5 rounded-lg bg-slate-100 p-1 ${
            isAdmin ? 'sm:grid-cols-4' : 'sm:grid-cols-3'
          }`}
        >
          {tabs.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(item.id)}
                className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-white text-[#164081] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Role Content */}
        <div className="mt-5 space-y-4">
          {tab === 'seeker' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-blue-200 bg-[#F0F5FF] p-4">
                <h3 className="font-display text-sm font-bold text-[#10243B]">
                  Job Seeker Workflow (No Pre-Registration Required to Browse)
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-700">
                  Job Seekers can search, filter by location/salary/job type, and read full job
                  descriptions freely as guests. When you click <strong>Apply now</strong> on a
                  specific vacancy, your Job Seeker account is registered automatically as part of
                  submitting your application.
                </p>
              </div>

              <ol className="space-y-2.5 text-xs text-slate-700">
                <li className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-700 shrink-0" />
                  <div>
                    <strong className="text-slate-900">1. Search &amp; Compare Ethiopian Portals:</strong>{' '}
                    Browse verified TATARI vacancies alongside live listings collected from
                    Ethiojobs, GeezJobs, and EffoySira. External jobs clearly state their original
                    source portal and redirect straight to the source website when clicked.
                  </div>
                </li>
                <li className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-700 shrink-0" />
                  <div>
                    <strong className="text-slate-900">2. Apply &amp; Register Simultaneously:</strong>{' '}
                    For TATARI vacancies, click <strong>Apply now</strong>, enter your Name, Email,
                    Phone, Password (min 8 characters + 1 number), and CV link. For external
                    portals, click <strong>View Original &amp; Apply</strong> to open the source
                    listing.
                  </div>
                </li>
                <li className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-700 shrink-0" />
                  <div>
                    <strong className="text-slate-900">3. Explore Bank FX &amp; Opportunities Hub:</strong>{' '}
                    Compare live Ethiopian commercial bank <strong>Cash vs Transaction</strong>{' '}
                    rates alongside the NBE indicative mid-rate in <strong>Bank FX</strong>, or
                    browse verified Tenders, Scholarships, Grants, and Public Notices in{' '}
                    <strong>Opportunities</strong>.
                  </div>
                </li>
                <li className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-700 shrink-0" />
                  <div>
                    <strong className="text-slate-900">4. Manage Profile, Saved Items &amp; Stages:</strong>{' '}
                    Click your account name in the top bar anytime to open{' '}
                    <strong>My Profile</strong>—update your headline and default CV link, rotate your
                    password, or delete your account, and track saved items and stages in{' '}
                    <strong>Saved</strong>.
                  </div>
                </li>
              </ol>

              <div className="flex flex-wrap gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleGoView('jobs')}
                  className="rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102E61]"
                >
                  Browse Verified Jobs
                </button>
                <button
                  type="button"
                  onClick={() => handleGoView('fx')}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Compare Bank FX Rates
                </button>
                <button
                  type="button"
                  onClick={() => handleGoView('opportunities')}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Tenders &amp; Scholarships
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAuth('signin', 'seeker');
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Sign In / Manage Profile
                </button>
              </div>
            </div>
          )}

          {tab === 'employer' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Employer Verification &amp; Paid Job Posting
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-700">
                  To protect job seekers from fraudulent listings, Employers must register with a
                  verified <strong>Company Name</strong> and <strong>Business TIN / License</strong>
                  , receive Administrator approval, and submit a valid job posting payment receipt.
                </p>
              </div>

              <ol className="space-y-2.5 text-xs text-slate-700">
                <li className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-700 shrink-0" />
                  <div>
                    <strong className="text-slate-900">1. Register Employer Account:</strong> Choose{' '}
                    <em>Employer / Hiring Organization</em> during registration and provide your
                    official Company Name and TIN number.
                  </div>
                </li>
                <li className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-700 shrink-0" />
                  <div>
                    <strong className="text-slate-900">2. Await Admin Verification:</strong> An
                    Administrator reviews your TIN and marks your account <em>Approved</em>.
                  </div>
                </li>
                <li className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-700 shrink-0" />
                  <div>
                    <strong className="text-slate-900">3. Post Job &amp; Submit Payment Receipt:</strong>{' '}
                    Transfer the posting fee via Telebirr (<code>0911-00-44-22</code>) or CBE (
                    <code>1000284910293</code>) and submit the transaction reference. The vacancy
                    goes live automatically upon Admin receipt approval.
                  </div>
                </li>
                <li className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-700 shrink-0" />
                  <div>
                    <strong className="text-slate-900">4. Request Tailored Corporate Training:</strong>{' '}
                    Visit the <strong>Training</strong> tab (TATARI Academy) to customize Power BI,
                    Ethiopian Payroll, IFRS, or Leadership workshops for your department, view live
                    ETB cohort quotes, and download tailored proposals.
                  </div>
                </li>
              </ol>

              <div className="flex flex-wrap gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleGoView('employer')}
                  className="rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102E61]"
                >
                  Open Employer Hub
                </button>
                <button
                  type="button"
                  onClick={() => handleGoView('training')}
                  className="rounded-lg border border-[#0F766E] px-4 py-2 text-xs font-semibold text-[#0F766E] hover:bg-emerald-50"
                >
                  Explore Corporate Training
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAuth('signup', 'employer');
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Register Employer Account
                </button>
              </div>
            </div>
          )}

          {tab === 'buyer' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-blue-200 bg-[#F0F5FF] p-4">
                <h3 className="font-display text-sm font-bold text-[#10243B]">
                  Digital Store Purchase &amp; Download Unlocking
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-700">
                  Payroll workbooks, Power BI dashboards, HR legal packs, and career kits require
                  account sign-in and manual receipt verification before download links unlock.
                </p>
              </div>

              <ol className="space-y-2.5 text-xs text-slate-700">
                <li className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-700 shrink-0" />
                  <div>
                    <strong className="text-slate-900">1. Sign In or Register:</strong> Purchase
                    access is tied securely to your registered email address so your downloads stay
                    accessible permanently.
                  </div>
                </li>
                <li className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-700 shrink-0" />
                  <div>
                    <strong className="text-slate-900">2. Pay &amp; Submit Reference ID:</strong>{' '}
                    Pay the listed ETB amount via Telebirr, CBE Bank Transfer, CBE Birr, or
                    AwashBirr and submit the Transaction Reference ID (plus optional screenshot).
                  </div>
                </li>
                <li className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-700 shrink-0" />
                  <div>
                    <strong className="text-slate-900">3. Download &amp; Rate Once Approved:</strong>{' '}
                    Once the Administrator approves your receipt, download the material, download
                    your VAT invoice, and publish a <strong>Verified Buyer Review</strong> on the
                    product card.
                  </div>
                </li>
              </ol>

              <div className="flex flex-wrap gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleGoView('store')}
                  className="rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102E61]"
                >
                  Visit Digital Store
                </button>
                <button
                  type="button"
                  onClick={() => handleGoView('activity')}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Check My Orders &amp; Downloads
                </button>
              </div>
            </div>
          )}

          {tab === 'admin' && isAdmin && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Administrator Governance &amp; User Management Controls
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-700">
                  Authenticated Administrators control financial receipt approvals, vacancy
                  moderation, digital catalog publishing, role governance, and password resets.
                </p>
              </div>

              <ul className="space-y-2.5 text-xs text-slate-700">
                <li className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-700 shrink-0" />
                  <div>
                    <strong className="text-slate-900">Payment Receipt Queue:</strong> Verify
                    Telebirr/CBE references in <em>Admin Console → Payment Approvals</em>. Approving
                    automatically publishes employer jobs or unlocks digital store downloads.
                  </div>
                </li>
                <li className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-700 shrink-0" />
                  <div>
                    <strong className="text-slate-900">Full User CRUD Governance:</strong> Filter
                    users by keyword, role, or status; create verified accounts via{' '}
                    <strong>Create User</strong>; or click <strong>Manage</strong> to read details,
                    update name/phone/company/TIN/role/status, reset passwords, or delete accounts
                    with complete audit logging.
                  </div>
                </li>
                <li className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-700 shrink-0" />
                  <div>
                    <strong className="text-slate-900">
                      Training, Sources &amp; Aggregator Health:
                    </strong>{' '}
                    Assign trainers and manage curriculum tracks in{' '}
                    <em>Admin Console → Training Services</em>, or monitor live Ethiopian job, FX,
                    and tender/scholarship crawlers, resolve flagged rate anomalies, and add custom
                    RSS/WP feeds in <em>Sources &amp; Health</em>.
                  </div>
                </li>
                <li className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-700 shrink-0" />
                  <div>
                    <strong className="text-slate-900">Implementation &amp; Admin Word Guide:</strong>{' '}
                    Download the complete Word documentation covering system architecture, database
                    SQL setup, security policies, and operations runbook.
                  </div>
                </li>
              </ul>

              <div className="flex flex-wrap gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleGoView('admin')}
                  className="rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102E61]"
                >
                  Open Admin Console
                </button>
                <a
                  href="/TATARI_Implementation_and_Administration_Guide.docx"
                  download="TATARI_Implementation_and_Administration_Guide.docx"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#164081] bg-[#F0F5FF] px-4 py-2 text-xs font-semibold text-[#164081] hover:bg-blue-100"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Download Implementation &amp; Admin Guide (.docx)
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Security & Support Footer Strip */}
        <div className="mt-6 grid grid-cols-1 gap-3 border-t border-slate-200 pt-4 text-xs sm:grid-cols-2">
          <div className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-3">
            <Lock className="mt-0.5 h-4 w-4 text-[#164081] shrink-0" />
            <div>
              <div className="font-bold text-slate-900">Account Security &amp; Lockout Policy</div>
              <p className="mt-0.5 text-slate-600">
                Passwords require at least 8 characters including a letter and a number. Five failed
                sign-ins trigger a 60-second lockout. Signed-in users can rotate passwords anytime
                via <strong>Account → Change Password</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-3">
            <Mail className="mt-0.5 h-4 w-4 text-[#164081] shrink-0" />
            <div>
              <div className="font-bold text-slate-900">Direct Verification &amp; Support Desk</div>
              <p className="mt-0.5 text-slate-600">
                Payment receipt or TIN verification questions? Email{' '}
                <strong className="text-slate-800">support@tatari.et</strong> or call{' '}
                <strong className="font-mono text-slate-800">+251-11-667-8899</strong> (Mon–Sat,
                8:30 AM – 5:30 PM EAT).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
