import React, { useState } from 'react';
import {
  Bookmark,
  Briefcase,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Lock,
  XCircle,
} from 'lucide-react';
import { canDownloadMaterial, formatCurrencyEtb, formatRelativeDays } from '../lib/storeLogic';
import type {
  DigitalProduct,
  JobApplication,
  JobListing,
  MaterialOrder,
  PaymentReceipt,
} from '../types/domain';

interface MyActivityViewProps {
  currentUserEmail: string;
  jobs: JobListing[];
  savedJobIds: string[];
  applications: JobApplication[];
  orders: MaterialOrder[];
  products: DigitalProduct[];
  receipts: PaymentReceipt[];
  onToggleSaveJob: (jobId: string) => void;
  onApplyJob: (job: JobListing) => void;
  onDownloadMaterial: (product: DigitalProduct, order: MaterialOrder) => void;
  onDownloadInvoice: (receipt: PaymentReceipt) => void;
  onBrowseJobs: () => void;
  onBrowseStore: () => void;
  onRequireAuth: () => void;
}

export const MyActivityView: React.FC<MyActivityViewProps> = ({
  currentUserEmail,
  jobs,
  savedJobIds,
  applications,
  orders,
  products,
  receipts,
  onToggleSaveJob,
  onApplyJob,
  onDownloadMaterial,
  onDownloadInvoice,
  onBrowseJobs,
  onBrowseStore,
  onRequireAuth,
}) => {
  const [tab, setTab] = useState<'orders' | 'applications' | 'saved'>('orders');

  if (!currentUserEmail) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-xs">
          <Lock className="mx-auto h-10 w-10 text-[#164081]" />
          <h1 className="mt-3 font-display text-xl font-bold text-slate-900">
            Registration Required for Saved Jobs &amp; Orders
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Sign in or register an account to save jobs, manage digital store downloads, and track
            your submitted applications. Job seekers are also registered automatically when applying
            for any specific job.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onRequireAuth}
              className="rounded-lg bg-[#164081] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#102E61]"
            >
              Sign In / Register
            </button>
            <button
              type="button"
              onClick={onBrowseJobs}
              className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Browse Jobs &amp; Apply
            </button>
          </div>
        </div>
      </div>
    );
  }

  const myOrders = orders.filter(
    (o) => o.buyerEmail.toLowerCase() === currentUserEmail.toLowerCase()
  );
  const myApplications = applications.filter(
    (a) => a.applicantEmail.toLowerCase() === currentUserEmail.toLowerCase()
  );
  const savedJobs = jobs.filter(
    (j) => savedJobIds.includes(j.id) && j.status === 'approved'
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="border-b border-slate-200 pb-6">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900">
          Saved Jobs, Applications &amp; Purchased Materials
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Signed in as <span className="font-semibold text-slate-900">{currentUserEmail}</span>.
          Digital downloads unlock automatically once the Administrator verifies your payment receipt.
        </p>

        <div
          role="tablist"
          aria-label="Activity sections"
          className="mt-5 inline-flex flex-wrap gap-1.5 rounded-lg bg-slate-100 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'orders'}
            onClick={() => setTab('orders')}
            className={`rounded-md px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              tab === 'orders'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Purchased Materials ({myOrders.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'applications'}
            onClick={() => setTab('applications')}
            className={`rounded-md px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              tab === 'applications'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            My Applications ({myApplications.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'saved'}
            onClick={() => setTab('saved')}
            className={`rounded-md px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              tab === 'saved'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Saved Jobs ({savedJobs.length})
          </button>
        </div>
      </div>

      {/* Tab 1: Purchased Digital Materials */}
      {tab === 'orders' && (
        <section className="mt-6">
          {myOrders.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
              <Download className="mx-auto h-9 w-9 text-slate-400" />
              <h2 className="mt-3 font-display text-base font-bold text-slate-900">
                No material purchases yet
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Browse the Digital Store to purchase payroll engines, HR packs, or BI dashboards.
              </p>
              <button
                type="button"
                onClick={onBrowseStore}
                className="mt-4 rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102E61]"
              >
                Explore Digital Store
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {myOrders.map((order) => {
                const product = products.find((p) => p.id === order.productId);
                const receipt = receipts.find((r) => r.id === order.paymentReceiptId);
                const unlocked = canDownloadMaterial(order);

                return (
                  <article
                    key={order.id}
                    className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center"
                  >
                    <div>
                      <div className="text-xs font-medium text-slate-500 tabular-nums">
                        Order {order.id} · Receipt {receipt?.transactionRef || 'Pending'} ·{' '}
                        {receipt?.paymentMethod || 'Telebirr'} · {formatCurrencyEtb(order.amountEtb)}
                      </div>
                      <h2 className="mt-1 font-display text-base font-bold text-slate-900">
                        {order.productTitle}
                      </h2>
                      <div className="mt-1.5 flex items-center gap-2 text-xs">
                        {unlocked ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Payment Verified &amp; Download Unlocked
                          </span>
                        ) : order.status === 'rejected' ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-rose-700">
                            <XCircle className="h-3.5 w-3.5" />
                            Rejected: {order.rejectionReason || 'Receipt verification failed'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                            <Clock className="h-3.5 w-3.5" />
                            Pending Administrator Payment Approval
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {unlocked && product ? (
                        <>
                          {receipt && (
                            <button
                              type="button"
                              onClick={() => onDownloadInvoice(receipt)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <FileText className="h-4 w-4 text-[#164081]" />
                              Download Invoice
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onDownloadMaterial(product, order)}
                            className="inline-flex items-center gap-2 rounded-lg bg-[#0F766E] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#0D625C]"
                          >
                            <Download className="h-4 w-4" />
                            Download Material
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-500 cursor-not-allowed"
                        >
                          <Lock className="h-4 w-4" />
                          {order.status === 'rejected'
                            ? 'Download Locked (Rejected)'
                            : 'Locked Until Admin Approval'}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Tab 2: Applications */}
      {tab === 'applications' && (
        <section className="mt-6">
          {myApplications.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
              <Briefcase className="mx-auto h-9 w-9 text-slate-400" />
              <h2 className="mt-3 font-display text-base font-bold text-slate-900">
                No job applications yet
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Search open roles and submit an Easy Apply application.
              </p>
              <button
                type="button"
                onClick={onBrowseJobs}
                className="mt-4 rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102E61]"
              >
                Find Jobs
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="px-5 py-3.5">Job Title</th>
                    <th className="px-5 py-3.5">Company</th>
                    <th className="px-5 py-3.5">Applied</th>
                    <th className="px-5 py-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myApplications.map((app) => (
                    <tr key={app.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3.5 font-semibold text-slate-900">{app.jobTitle}</td>
                      <td className="px-5 py-3.5 text-slate-600">{app.companyName}</td>
                      <td className="px-5 py-3.5 text-slate-500 tabular-nums">
                        {formatRelativeDays(app.createdAt)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-[#164081]">{app.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Tab 3: Saved Jobs */}
      {tab === 'saved' && (
        <section className="mt-6">
          {savedJobs.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
              <Bookmark className="mx-auto h-9 w-9 text-slate-400" />
              <h2 className="mt-3 font-display text-base font-bold text-slate-900">
                No saved jobs
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Bookmark jobs from the search board to review and apply later.
              </p>
              <button
                type="button"
                onClick={onBrowseJobs}
                className="mt-4 rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102E61]"
              >
                Browse Jobs
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {savedJobs.map((job) => (
                <article
                  key={job.id}
                  className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center"
                >
                  <div>
                    <h2 className="font-display text-base font-bold text-slate-900">
                      {job.titleEn}
                    </h2>
                    <p className="mt-1 text-xs text-slate-600 tabular-nums">
                      {job.companyName} · {job.location} · {job.salaryDisplay}
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleSaveJob(job.id)}
                      className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Remove
                    </button>
                    <button
                      type="button"
                      onClick={() => onApplyJob(job)}
                      className="rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102E61]"
                    >
                      Apply now
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
