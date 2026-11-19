import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Download,
  Plus,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { formatCurrencyEtb, formatRelativeDays } from '../lib/storeLogic';
import type {
  AccountStatus,
  AuditLogEntry,
  DigitalProduct,
  JobListing,
  JobModerationStatus,
  PaymentReceipt,
  UserProfile,
} from '../types/domain';

interface AdminConsoleViewProps {
  currentUser: UserProfile | null;
  receipts: PaymentReceipt[];
  jobs: JobListing[];
  products: DigitalProduct[];
  users: UserProfile[];
  logs: AuditLogEntry[];
  onApproveReceipt: (receiptId: string) => void;
  onRejectReceipt: (receiptId: string, reason: string) => void;
  onSetJobStatus: (jobId: string, status: JobModerationStatus) => void;
  onToggleProductActive: (productId: string) => void;
  onOpenAddProduct: () => void;
  onSetUserStatus: (email: string, status: AccountStatus) => void;
  onExportCsv: () => void;
  onQuickSwitchAdmin: () => void;
}

export const AdminConsoleView: React.FC<AdminConsoleViewProps> = ({
  currentUser,
  receipts,
  jobs,
  products,
  users,
  logs,
  onApproveReceipt,
  onRejectReceipt,
  onSetJobStatus,
  onToggleProductActive,
  onOpenAddProduct,
  onSetUserStatus,
  onExportCsv,
  onQuickSwitchAdmin,
}) => {
  const [tab, setTab] = useState<'payments' | 'jobs' | 'store' | 'users'>('payments');
  const [rejectTarget, setRejectTarget] = useState<PaymentReceipt | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [previewReceiptImg, setPreviewReceiptImg] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'admin';

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-xl border border-slate-200 bg-white p-8">
          <ShieldCheck className="mx-auto h-10 w-10 text-[#164081]" />
          <h1 className="mt-3 font-display text-xl font-bold text-slate-900">
            Administrator Access Required
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Only the authorized Administrator (<span className="font-mono">admin@tatari.et</span>)
            can verify payment receipts, unlock digital material downloads, and publish employer job
            postings.
          </p>
          <button
            type="button"
            onClick={onQuickSwitchAdmin}
            className="mt-5 rounded-lg bg-[#164081] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#102E61]"
          >
            Sign In as Administrator (admin@tatari.et)
          </button>
        </div>
      </div>
    );
  }

  const pendingReceipts = receipts.filter((r) => r.status === 'pending_verification');
  const verifiedTotalEtb = receipts
    .filter((r) => r.status === 'verified')
    .reduce((sum, r) => sum + Number(r.amountEtb || 0), 0);
  const liveJobsCount = jobs.filter((j) => j.status === 'approved').length;

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
          <button
            type="button"
            onClick={onExportCsv}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Export Ledger CSV
          </button>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <dt className="text-xs font-medium text-slate-500">Pending Receipt Approvals</dt>
            <dd className="mt-1 font-mono text-2xl font-bold text-amber-700 tabular-nums">
              {pendingReceipts.length}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <dt className="text-xs font-medium text-slate-500">Verified Revenue</dt>
            <dd className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {formatCurrencyEtb(verifiedTotalEtb)}
            </dd>
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
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Verified &amp; {rcpt.targetType === 'job_post' ? 'Published' : 'Unlocked'}
                  </span>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Tab 4: Users & Audit Logs */}
      {tab === 'users' && (
        <section className="mt-6 space-y-6">
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-600">
              Registered Accounts
            </div>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3">Name &amp; Email</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.email}>
                    <td className="px-5 py-3">
                      <div className="font-semibold text-slate-900">{u.fullName}</div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                    </td>
                    <td className="px-5 py-3 text-xs font-semibold uppercase text-slate-700">
                      {u.role}
                    </td>
                    <td className="px-5 py-3 text-xs font-semibold text-slate-700">{u.status}</td>
                    <td className="px-5 py-3">
                      {u.email === 'admin@tatari.et' ? (
                        <span className="text-xs text-slate-400">Primary Admin</span>
                      ) : u.status === 'approved' ? (
                        <button
                          type="button"
                          onClick={() => onSetUserStatus(u.email, 'suspended')}
                          className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSetUserStatus(u.email, 'approved')}
                          className="rounded-lg bg-[#0F766E] px-3 py-1 text-xs font-semibold text-white hover:bg-[#0D625C]"
                        >
                          Approve
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-600">
              Payment &amp; Moderation Audit Ledger
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
                {logs.map((entry) => (
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
