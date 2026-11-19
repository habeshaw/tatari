import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Download,
  FileText,
  KeyRound,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';
import {
  filterUsersForAdmin,
  type AdminCreateUserInput,
  type AdminUserUpdateInput,
} from '../lib/security';
import { formatCurrencyEtb, formatRelativeDays } from '../lib/storeLogic';
import type {
  AccountStatus,
  AuditLogEntry,
  DigitalProduct,
  JobApplication,
  JobListing,
  JobModerationStatus,
  MaterialOrder,
  PaymentReceipt,
  UserProfile,
  UserRole,
} from '../types/domain';

interface AdminConsoleViewProps {
  currentUser: UserProfile | null;
  receipts: PaymentReceipt[];
  jobs: JobListing[];
  products: DigitalProduct[];
  applications: JobApplication[];
  orders: MaterialOrder[];
  users: UserProfile[];
  logs: AuditLogEntry[];
  onApproveReceipt: (receiptId: string) => void;
  onRejectReceipt: (receiptId: string, reason: string) => void;
  onSetJobStatus: (jobId: string, status: JobModerationStatus) => void;
  onToggleProductActive: (productId: string) => void;
  onOpenAddProduct: () => void;
  onOpenEditProduct: (product: DigitalProduct) => void;
  onDeleteProduct: (productId: string) => void;
  onSetUserStatus: (email: string, status: AccountStatus) => void;
  onCreateUser: (input: AdminCreateUserInput) => string | null;
  onUpdateUser: (email: string, updates: AdminUserUpdateInput) => string | null;
  onDeleteUser: (email: string) => string | null;
  onUpdateUserRole: (email: string, role: UserRole) => string | null;
  onResetUserPassword: (
    email: string,
    newPassword: string,
    confirmPassword: string
  ) => string | null;
  onDownloadInvoice: (receipt: PaymentReceipt) => void;
  onExportCsv: () => void;
  onOpenAdminSignIn: () => void;
}

export const AdminConsoleView: React.FC<AdminConsoleViewProps> = ({
  currentUser,
  receipts,
  jobs,
  products,
  applications,
  orders,
  users,
  logs,
  onApproveReceipt,
  onRejectReceipt,
  onSetJobStatus,
  onToggleProductActive,
  onOpenAddProduct,
  onOpenEditProduct,
  onDeleteProduct,
  onSetUserStatus,
  onCreateUser,
  onUpdateUser,
  onDeleteUser,
  onResetUserPassword,
  onDownloadInvoice,
  onExportCsv,
  onOpenAdminSignIn,
}) => {
  const [tab, setTab] = useState<'payments' | 'jobs' | 'store' | 'users'>('payments');
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | UserRole>('all');
  const [userFilter, setUserFilter] = useState<'all' | AccountStatus>('all');
  const [logSearch, setLogSearch] = useState('');
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [managedUserEmail, setManagedUserEmail] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PaymentReceipt | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [previewReceiptImg, setPreviewReceiptImg] = useState<string | null>(null);

  // Create user modal state
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('+251911');
  const [newRole, setNewRole] = useState<UserRole>('employer');
  const [newStatus, setNewStatus] = useState<AccountStatus>('approved');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newTinNumber, setNewTinNumber] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newConfirmPassword, setNewConfirmPassword] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  // Manage user modal state (Full User Read + Update + Delete)
  const [manageFullName, setManageFullName] = useState('');
  const [managePhone, setManagePhone] = useState('');
  const [manageCompanyName, setManageCompanyName] = useState('');
  const [manageTinNumber, setManageTinNumber] = useState('');
  const [manageHeadline, setManageHeadline] = useState('');
  const [manageRole, setManageRole] = useState<UserRole>('seeker');
  const [manageStatus, setManageStatus] = useState<AccountStatus>('approved');
  const [confirmDeleteUserEmail, setConfirmDeleteUserEmail] = useState<string | null>(null);
  const [confirmDeleteProductId, setConfirmDeleteProductId] = useState<string | null>(null);
  const [resetPwd, setResetPwd] = useState('');
  const [resetConfirmPwd, setResetConfirmPwd] = useState('');
  const [manageFeedback, setManageFeedback] = useState<{ text: string; isError?: boolean } | null>(
    null
  );

  const isAdmin = currentUser?.role === 'admin' && currentUser?.status === 'approved';

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-xs">
          <ShieldCheck className="mx-auto h-10 w-10 text-[#164081]" />
          <h1 className="mt-3 font-display text-xl font-bold text-slate-900">
            Administrator Authentication Required
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            This governance console is strictly restricted to authenticated Administrator accounts.
            Sign in with your Administrator email and password to verify payment receipts, approve
            employer registrations, and manage platform content.
          </p>
          <button
            type="button"
            onClick={onOpenAdminSignIn}
            className="mt-5 rounded-lg bg-[#164081] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#102E61]"
          >
            Sign In with Administrator Credentials
          </button>
        </div>
      </div>
    );
  }

  const pendingUsersCount = users.filter((u) => u.status === 'pending').length;
  const approvedUsersCount = users.filter((u) => u.status === 'approved').length;
  const suspendedUsersCount = users.filter((u) => u.status === 'suspended').length;
  const filteredUsers = filterUsersForAdmin(users, {
    query: userSearch,
    role: userRoleFilter,
    status: userFilter,
  });

  const managedUser = managedUserEmail
    ? users.find((u) => u.email.toLowerCase() === managedUserEmail.toLowerCase()) || null
    : null;

  const pendingReceipts = receipts.filter((r) => r.status === 'pending_verification');
  const verifiedReceipts = receipts.filter((r) => r.status === 'verified');
  const verifiedTotalEtb = verifiedReceipts.reduce((sum, r) => sum + Number(r.amountEtb || 0), 0);
  const jobRevenueEtb = verifiedReceipts
    .filter((r) => r.targetType === 'job_post')
    .reduce((sum, r) => sum + Number(r.amountEtb || 0), 0);
  const storeRevenueEtb = verifiedReceipts
    .filter((r) => r.targetType === 'digital_material')
    .reduce((sum, r) => sum + Number(r.amountEtb || 0), 0);
  const pendingValueEtb = pendingReceipts.reduce((sum, r) => sum + Number(r.amountEtb || 0), 0);
  const liveJobsCount = jobs.filter((j) => j.status === 'approved').length;

  const filteredLogs = logs.filter((entry) => {
    const q = logSearch.trim().toLowerCase();
    if (!q) return true;
    return `${entry.userEmail} ${entry.actionType} ${entry.details}`.toLowerCase().includes(q);
  });

  const openManageModal = (u: UserProfile) => {
    setManagedUserEmail(u.email);
    setManageFullName(u.fullName);
    setManagePhone(u.phone || '+251911');
    setManageCompanyName(u.companyName || '');
    setManageTinNumber(u.tinNumber || '');
    setManageHeadline(u.headline || '');
    setManageRole(u.role);
    setManageStatus(u.status);
    setConfirmDeleteUserEmail(null);
    setResetPwd('');
    setResetConfirmPwd('');
    setManageFeedback(null);
  };

  const handleCreateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    const err = onCreateUser({
      fullName: newFullName,
      email: newEmail,
      phone: newPhone,
      role: newRole,
      status: newStatus,
      companyName: newCompanyName,
      tinNumber: newTinNumber,
      password: newPassword,
      confirmPassword: newConfirmPassword,
    });
    if (err) {
      setCreateError(err);
      return;
    }
    setCreateUserOpen(false);
    setNewFullName('');
    setNewEmail('');
    setNewPhone('+251911');
    setNewCompanyName('');
    setNewTinNumber('');
    setNewPassword('');
    setNewConfirmPassword('');
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header & KPI Summary Row */}
      <div className="border-b border-slate-200 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">
              Administrator Payment &amp; Content Governance
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Verify payment receipts to publish employer jobs and unlock digital store downloads.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href="/TATARI_Implementation_and_Administration_Guide.docx"
              download="TATARI_Implementation_and_Administration_Guide.docx"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              <FileText className="h-4 w-4 text-[#164081]" />
              Admin Guide (.docx)
            </a>
            <button
              type="button"
              onClick={onExportCsv}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Export Ledger CSV
            </button>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <dt className="text-xs font-medium text-slate-500">Pending Receipt Approvals</dt>
            <dd className="mt-1 font-mono text-2xl font-bold text-amber-700 tabular-nums">
              {pendingReceipts.length}
            </dd>
            <div className="mt-0.5 font-mono text-[11px] text-slate-500 tabular-nums">
              Queue Value: {formatCurrencyEtb(pendingValueEtb)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <dt className="text-xs font-medium text-slate-500">Verified Revenue (incl. VAT)</dt>
            <dd className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {formatCurrencyEtb(verifiedTotalEtb)}
            </dd>
            <div className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
              Jobs {formatCurrencyEtb(jobRevenueEtb)} · Store {formatCurrencyEtb(storeRevenueEtb)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <dt className="text-xs font-medium text-slate-500">Published Jobs</dt>
            <dd className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {liveJobsCount} / {jobs.length}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <dt className="text-xs font-medium text-slate-500">Active Store Materials</dt>
            <dd className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {products.filter((p) => p.active).length}
            </dd>
          </div>
        </dl>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Admin sections"
          className="mt-6 inline-flex flex-wrap gap-1.5 rounded-lg bg-slate-100 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'payments'}
            onClick={() => setTab('payments')}
            className={`rounded-md px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              tab === 'payments'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Payment Approvals ({pendingReceipts.length} pending)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'jobs'}
            onClick={() => setTab('jobs')}
            className={`rounded-md px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              tab === 'jobs'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Job Moderation ({jobs.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'store'}
            onClick={() => setTab('store')}
            className={`rounded-md px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              tab === 'store'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Digital Store Catalog ({products.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'users'}
            onClick={() => setTab('users')}
            className={`rounded-md px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              tab === 'users'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Users &amp; Audit Logs
            {pendingUsersCount > 0 ? ` (${pendingUsersCount} pending)` : ''}
          </button>
        </div>
      </div>

      {/* Tab 1: Payment Receipt Approval Queue */}
      {tab === 'payments' && (
        <section className="mt-6 space-y-3" data-testid="admin-receipt-queue">
          {receipts.map((rcpt) => (
            <article
              key={rcpt.id}
              className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 lg:flex-row lg:items-center"
            >
              <div className="space-y-1">
                <div className="text-xs font-medium text-slate-500 tabular-nums">
                  {rcpt.targetType === 'job_post' ? 'Job Posting Fee' : 'Digital Material Order'} ·{' '}
                  {rcpt.paymentMethod} · Ref:{' '}
                  <strong className="font-mono text-slate-900">{rcpt.transactionRef}</strong> ·{' '}
                  {formatRelativeDays(rcpt.createdAt)}
                </div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  {rcpt.targetTitle}
                </h2>
                <div className="text-xs text-slate-600">
                  Payer: <strong className="text-slate-800">{rcpt.payerName}</strong> (
                  {rcpt.payerEmail} · {rcpt.payerPhone}) · Amount:{' '}
                  <strong className="font-mono text-slate-900 tabular-nums">
                    {formatCurrencyEtb(rcpt.amountEtb)}
                  </strong>
                  {rcpt.promoCode && (
                    <span className="ml-1.5 font-mono text-emerald-700">
                      (Promo: {rcpt.promoCode})
                    </span>
                  )}
                  {rcpt.invoiceNumber && (
                    <span className="ml-1.5 font-mono text-slate-500">
                      · {rcpt.invoiceNumber}
                    </span>
                  )}
                </div>
                {rcpt.receiptNote && (
                  <p className="text-xs text-slate-500">Note: {rcpt.receiptNote}</p>
                )}
                {rcpt.receiptImageData && (
                  <button
                    type="button"
                    onClick={() => setPreviewReceiptImg(rcpt.receiptImageData || null)}
                    className="mt-1 text-xs font-semibold text-[#164081] hover:underline"
                  >
                    View Attached Receipt Screenshot
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                {rcpt.status === 'pending_verification' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onApproveReceipt(rcpt.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F766E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0D625C]"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Approve Payment ({rcpt.transactionRef})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectTarget(rcpt);
                        setRejectReason('');
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </button>
                  </>
                ) : rcpt.status === 'verified' ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                      Verified &amp; {rcpt.targetType === 'job_post' ? 'Published' : 'Unlocked'}
                    </span>
                    <button
                      type="button"
                      onClick={() => onDownloadInvoice(rcpt)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#164081] hover:bg-slate-50"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Invoice
                    </button>
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700">
                    <XCircle className="h-4 w-4" />
                    Rejected: {rcpt.rejectionReason}
                  </span>
                )}
              </div>
            </article>
          ))}
        </section>
      )}

      {/* Tab 2: Job Postings Moderation */}
      {tab === 'jobs' && (
        <section className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-5 py-3.5">Job &amp; Company</th>
                <th className="px-5 py-3.5">Employer</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-slate-900">{job.titleEn}</div>
                    <div className="text-xs text-slate-500">
                      {job.companyName} · {job.location}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-600">{job.employerEmail}</td>
                  <td className="px-5 py-3.5 text-xs">
                    {job.status === 'approved' ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Published
                      </span>
                    ) : job.status === 'rejected' ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-rose-700">
                        <XCircle className="h-3.5 w-3.5" />
                        Rejected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                        <Clock className="h-3.5 w-3.5" />
                        {job.status}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      {job.status !== 'approved' ? (
                        <button
                          type="button"
                          onClick={() => onSetJobStatus(job.id, 'approved')}
                          className="rounded-lg bg-[#0F766E] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0D625C]"
                        >
                          Publish
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSetJobStatus(job.id, 'paused')}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Pause
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Tab 3: Digital Store Catalog Manager */}
      {tab === 'store' && (
        <section className="mt-6">
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={onOpenAddProduct}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102E61]"
            >
              <Plus className="h-4 w-4" />
              Add Digital Material
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-5 py-3.5">Material Title</th>
                  <th className="px-5 py-3.5">Category &amp; Format</th>
                  <th className="px-5 py-3.5">Price</th>
                  <th className="px-5 py-3.5">Availability</th>
                  <th className="px-5 py-3.5">CRUD Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((prod) => (
                  <tr key={prod.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3.5 font-semibold text-slate-900">{prod.titleEn}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-600">
                      {prod.category} · {prod.fileFormat} ({prod.version})
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-900 tabular-nums">
                      {formatCurrencyEtb(prod.priceEtb)}
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        type="button"
                        onClick={() => onToggleProductActive(prod.id)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                          prod.active
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                            : 'border-slate-300 bg-slate-50 text-slate-600'
                        }`}
                      >
                        {prod.active ? 'Active in Store' : 'Hidden'}
                      </button>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenEditProduct(prod)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Pencil className="h-3 w-3 text-[#164081]" />
                          Edit
                        </button>
                        {confirmDeleteProductId === prod.id ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteProduct(prod.id);
                                setConfirmDeleteProductId(null);
                              }}
                              className="rounded-lg bg-rose-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-800"
                            >
                              Confirm Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteProductId(null)}
                              className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteProductId(prod.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Tab 4: Secure & Easy User Management + Audit Logs */}
      {tab === 'users' && (
        <section className="mt-6 space-y-6">
          {/* User Security Overview Strip */}
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <dt className="text-xs font-medium text-slate-500">Total Accounts</dt>
              <dd className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
                {users.length}
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <dt className="text-xs font-medium text-slate-500">Pending Verification</dt>
              <dd className="mt-1 font-mono text-xl font-bold text-amber-700 tabular-nums">
                {pendingUsersCount}
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <dt className="text-xs font-medium text-slate-500">Active Approved</dt>
              <dd className="mt-1 font-mono text-xl font-bold text-emerald-700 tabular-nums">
                {approvedUsersCount}
              </dd>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <dt className="text-xs font-medium text-slate-500">Suspended Accounts</dt>
              <dd className="mt-1 font-mono text-xl font-bold text-rose-700 tabular-nums">
                {suspendedUsersCount}
              </dd>
            </div>
          </dl>

          {/* Search, Filter & Create User Controls */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-1 flex-wrap items-center gap-2.5">
                <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="search"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search name, email, company, or TIN..."
                    aria-label="Search registered users"
                    className="w-full rounded-lg border border-slate-300 py-1.5 pl-9 pr-3 text-xs text-slate-900 focus:border-[#164081] focus:outline-none"
                  />
                </div>

                <select
                  aria-label="Filter users by role"
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value as 'all' | UserRole)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:border-[#164081] focus:outline-none"
                >
                  <option value="all">All Roles</option>
                  <option value="seeker">Job Seekers</option>
                  <option value="employer">Employers</option>
                  <option value="admin">Administrators</option>
                </select>

                <div className="inline-flex rounded-lg bg-slate-100 p-1 text-xs font-semibold">
                  {(['all', 'pending', 'approved', 'suspended'] as const).map((statusKey) => (
                    <button
                      key={statusKey}
                      type="button"
                      onClick={() => setUserFilter(statusKey)}
                      className={`rounded-md px-2.5 py-1 capitalize ${
                        userFilter === statusKey
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {statusKey}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setCreateError(null);
                  setCreateUserOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102E61] whitespace-nowrap shrink-0"
              >
                <UserPlus className="h-4 w-4" />
                Create User
              </button>
            </div>

            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3">Name &amp; Contact</th>
                  <th className="px-5 py-3">Organization / TIN</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Last Sign In</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-xs text-slate-500">
                      No user accounts match the current search or filter.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.email} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3">
                        <div className="font-semibold text-slate-900">{u.fullName}</div>
                        <div className="text-xs text-slate-500">
                          {u.email} {u.phone ? `· ${u.phone}` : ''}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-600">
                        {u.companyName ? (
                          <div>
                            <div className="font-medium text-slate-800">{u.companyName}</div>
                            {u.tinNumber && (
                              <div className="font-mono text-[11px] text-slate-500">
                                TIN: {u.tinNumber}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs font-semibold uppercase text-slate-700">
                        {u.role}
                      </td>
                      <td className="px-5 py-3 text-xs font-semibold">
                        <span
                          className={
                            u.status === 'approved'
                              ? 'text-emerald-700'
                              : u.status === 'pending'
                              ? 'text-amber-700'
                              : 'text-rose-700'
                          }
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500 tabular-nums">
                        {u.lastLoginAt
                          ? new Date(u.lastLoginAt).toLocaleDateString()
                          : 'Never signed in'}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {u.email === 'admin@tatari.et' ? (
                            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                              Primary Admin
                            </span>
                          ) : (
                            <>
                              {u.status === 'pending' && (
                                <button
                                  type="button"
                                  onClick={() => onSetUserStatus(u.email, 'approved')}
                                  className="rounded-lg bg-[#0F766E] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#0D625C]"
                                >
                                  Approve Account
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => openManageModal(u)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                <UserCog className="h-3.5 w-3.5 text-[#164081]" />
                                Manage
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Payment, User Governance &amp; Security Audit Ledger ({filteredLogs.length})
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="search"
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  placeholder="Filter audit logs..."
                  aria-label="Filter audit logs"
                  className="w-full rounded-lg border border-slate-300 py-1.5 pl-8 pr-3 text-xs text-slate-900 focus:border-[#164081] focus:outline-none"
                />
              </div>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3">Actor</th>
                  <th className="px-5 py-3">Event</th>
                  <th className="px-5 py-3">Details</th>
                  <th className="px-5 py-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-5 py-3 font-medium text-slate-900">{entry.userEmail}</td>
                    <td className="px-5 py-3 font-mono text-slate-700">{entry.actionType}</td>
                    <td className="px-5 py-3 text-slate-600">{entry.details}</td>
                    <td className="px-5 py-3 text-slate-500 tabular-nums">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Admin Create User Modal */}
      {createUserOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Create verified user account"
        >
          <form
            onSubmit={handleCreateUserSubmit}
            className="max-h-[92vh] w-full max-w-lg space-y-3.5 overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Create Verified User Account
                </h2>
                <p className="text-xs text-slate-500">
                  Directly provision a Job Seeker, Employer, or Administrator account.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close create user modal"
                onClick={() => setCreateUserOpen(false)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {createError && (
              <div
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800"
              >
                {createError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-slate-700">
                Role *
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  <option value="seeker">Job Seeker</option>
                  <option value="employer">Employer</option>
                  <option value="admin">Administrator</option>
                </select>
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Initial Status *
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as AccountStatus)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  <option value="approved">Approved</option>
                  <option value="pending">Pending Verification</option>
                </select>
              </label>
            </div>

            <label className="block text-xs font-semibold text-slate-700">
              Full Name *
              <input
                type="text"
                required
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="e.g. Mekdes Alemu"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-slate-700">
                Email Address *
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="user@company.et"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Phone Number *
                <input
                  type="text"
                  required
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </label>
            </div>

            {newRole === 'employer' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Company Name *
                  <input
                    type="text"
                    required
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    placeholder="e.g. Habesha Bank S.C."
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-700">
                  Business TIN *
                  <input
                    type="text"
                    required
                    value={newTinNumber}
                    onChange={(e) => setNewTinNumber(e.target.value)}
                    placeholder="e.g. 0011223344"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900"
                  />
                </label>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-slate-700">
                Password *
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 chars + number"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Confirm Password *
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newConfirmPassword}
                  onChange={(e) => setNewConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setCreateUserOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102E61]"
              >
                Create User Account
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Admin Manage User Account Modal (Full Read, Update, Delete & Password Reset) */}
      {managedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Manage ${managedUser.fullName}`}
        >
          <div className="max-h-[92vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <p className="text-xs font-semibold text-[#164081]">
                  User Security Governance &amp; Profile CRUD
                </p>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  {managedUser.fullName}
                </h2>
                <p className="text-xs text-slate-500">
                  {managedUser.email} {managedUser.phone ? `· ${managedUser.phone}` : ''}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400 tabular-nums">
                  Created {new Date(managedUser.createdAt).toLocaleDateString()}
                  {managedUser.lastLoginAt
                    ? ` · Last sign in ${new Date(managedUser.lastLoginAt).toLocaleString()}`
                    : ' · Never signed in'}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close manage user modal"
                onClick={() => setManagedUserEmail(null)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {manageFeedback && (
              <div
                role="status"
                className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                  manageFeedback.isError
                    ? 'border-rose-200 bg-rose-50 text-rose-800'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                }`}
              >
                {manageFeedback.text}
              </div>
            )}

            {/* User Activity Read Summary */}
            <div className="grid grid-cols-3 gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-center text-xs">
              <div>
                <div className="font-mono text-base font-bold text-slate-900">
                  {
                    applications.filter(
                      (a) => a.applicantEmail.toLowerCase() === managedUser.email.toLowerCase()
                    ).length
                  }
                </div>
                <div className="text-[11px] text-slate-500">Applications</div>
              </div>
              <div>
                <div className="font-mono text-base font-bold text-slate-900">
                  {
                    jobs.filter(
                      (j) => j.employerEmail.toLowerCase() === managedUser.email.toLowerCase()
                    ).length
                  }
                </div>
                <div className="text-[11px] text-slate-500">Jobs Posted</div>
              </div>
              <div>
                <div className="font-mono text-base font-bold text-slate-900">
                  {
                    orders.filter(
                      (o) => o.buyerEmail.toLowerCase() === managedUser.email.toLowerCase()
                    ).length
                  }
                </div>
                <div className="text-[11px] text-slate-500">Store Orders</div>
              </div>
            </div>

            {/* Update User Profile, Role & Status Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const err = onUpdateUser(managedUser.email, {
                  fullName: manageFullName,
                  phone: managePhone,
                  companyName: manageCompanyName,
                  tinNumber: manageTinNumber,
                  headline: manageHeadline,
                  role: manageRole,
                  status: manageStatus,
                });
                if (err) {
                  setManageFeedback({ text: err, isError: true });
                  return;
                }
                setManageFeedback({
                  text: `Profile, role (${manageRole.toUpperCase()}), and status (${manageStatus}) updated for ${managedUser.email}.`,
                });
              }}
              className="space-y-3 rounded-lg border border-slate-200 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900">
                  Update User Details &amp; Authorization
                </span>
                <div className="flex gap-2">
                  {managedUser.status !== 'approved' && (
                    <button
                      type="button"
                      onClick={() => {
                        onSetUserStatus(managedUser.email, 'approved');
                        setManageStatus('approved');
                        setManageFeedback({ text: 'Account status set to Approved.' });
                      }}
                      className="rounded-lg bg-[#0F766E] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#0D625C]"
                    >
                      Approve
                    </button>
                  )}
                  {managedUser.status !== 'suspended' && (
                    <button
                      type="button"
                      onClick={() => {
                        onSetUserStatus(managedUser.email, 'suspended');
                        setManageStatus('suspended');
                        setManageFeedback({ text: 'Account suspended immediately.' });
                      }}
                      className="rounded-lg border border-rose-300 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      Suspend
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Full Name *
                  <input
                    type="text"
                    required
                    value={manageFullName}
                    onChange={(e) => setManageFullName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-700">
                  Phone Number *
                  <input
                    type="text"
                    required
                    value={managePhone}
                    onChange={(e) => setManagePhone(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-700">
                  Assigned Role
                  <select
                    value={manageRole}
                    onChange={(e) => setManageRole(e.target.value as UserRole)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                  >
                    <option value="seeker">Job Seeker</option>
                    <option value="employer">Employer</option>
                    <option value="admin">Administrator</option>
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-700">
                  Account Status
                  <select
                    value={manageStatus}
                    onChange={(e) => setManageStatus(e.target.value as AccountStatus)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                  >
                    <option value="approved">Approved</option>
                    <option value="pending">Pending Verification</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </label>
              </div>

              {(manageRole === 'employer' || manageCompanyName || manageTinNumber) && (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Company Name {manageRole === 'employer' ? '*' : ''}
                    <input
                      type="text"
                      required={manageRole === 'employer'}
                      value={manageCompanyName}
                      onChange={(e) => setManageCompanyName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-700">
                    Business TIN {manageRole === 'employer' ? '*' : ''}
                    <input
                      type="text"
                      required={manageRole === 'employer'}
                      value={manageTinNumber}
                      onChange={(e) => setManageTinNumber(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-xs text-slate-900"
                    />
                  </label>
                </div>
              )}

              <label className="block text-xs font-semibold text-slate-700">
                Headline / Internal Note
                <input
                  type="text"
                  value={manageHeadline}
                  onChange={(e) => setManageHeadline(e.target.value)}
                  placeholder="Role bio or organization summary"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900"
                />
              </label>

              <button
                type="submit"
                className="w-full rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102E61]"
              >
                Save User Changes
              </button>
            </form>

            {/* Admin Password Reset Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const err = onResetUserPassword(managedUser.email, resetPwd, resetConfirmPwd);
                if (err) {
                  setManageFeedback({ text: err, isError: true });
                  return;
                }
                setResetPwd('');
                setResetConfirmPwd('');
                setManageFeedback({
                  text: `Password securely reset for ${managedUser.email}.`,
                });
              }}
              className="space-y-3 rounded-lg border border-slate-200 p-4"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <KeyRound className="h-3.5 w-3.5 text-[#164081]" />
                <span>Admin Password Reset</span>
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <input
                  type="password"
                  required
                  minLength={8}
                  value={resetPwd}
                  onChange={(e) => setResetPwd(e.target.value)}
                  placeholder="New password (8+ chars + #)"
                  aria-label="New password for user"
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900"
                />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={resetConfirmPwd}
                  onChange={(e) => setResetConfirmPwd(e.target.value)}
                  placeholder="Confirm new password"
                  aria-label="Confirm new password for user"
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900"
                />
              </div>
              <button
                type="submit"
                className="rounded-lg border border-[#164081] bg-white px-4 py-1.5 text-xs font-semibold text-[#164081] hover:bg-[#F0F5FF]"
              >
                Reset User Password
              </button>
            </form>

            {/* Admin Delete User Control */}
            <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-4">
              {confirmDeleteUserEmail === managedUser.email ? (
                <div className="space-y-2.5">
                  <div className="text-xs font-bold text-rose-900">
                    Confirm deleting user {managedUser.email}?
                  </div>
                  <p className="text-[11px] text-rose-800">
                    This permanently removes the user account and signs out any matching active
                    session. Audit logs are preserved.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const delErr = onDeleteUser(managedUser.email);
                        if (delErr) {
                          setManageFeedback({ text: delErr, isError: true });
                          setConfirmDeleteUserEmail(null);
                          return;
                        }
                        setConfirmDeleteUserEmail(null);
                        setManagedUserEmail(null);
                      }}
                      className="rounded-lg bg-rose-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-800"
                    >
                      Confirm Delete User
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteUserEmail(null)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-rose-900">Danger Zone · Delete User</div>
                    <div className="text-[11px] text-rose-700">
                      Permanently delete this user profile from TATARI.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteUserEmail(managedUser.email)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete User Account
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Reject payment receipt"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onRejectReceipt(rejectTarget.id, rejectReason);
              setRejectTarget(null);
            }}
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          >
            <h2 className="font-display text-lg font-bold text-slate-900">
              Reject Receipt {rejectTarget.transactionRef}
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Specify why this payment receipt could not be verified. The user will see this reason.
            </p>
            <textarea
              required
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Reference ID does not match bank statement or incorrect ETB amount."
              className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#164081] focus:outline-none"
            />
            <div className="mt-4 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-rose-700 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-800"
              >
                Confirm Rejection
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Receipt Image Preview Modal */}
      {previewReceiptImg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Receipt screenshot preview"
        >
          <div className="max-w-lg rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Attached Payment Receipt</span>
              <button
                type="button"
                onClick={() => setPreviewReceiptImg(null)}
                className="rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
            <img
              src={previewReceiptImg}
              alt="Uploaded payment receipt"
              className="max-h-[70vh] w-auto rounded-lg border border-slate-200"
            />
          </div>
        </div>
      )}
    </div>
  );
};
