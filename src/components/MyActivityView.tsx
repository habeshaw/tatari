import React, { useState } from 'react';
import {
  Bookmark,
  Briefcase,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  Lock,
  XCircle,
} from 'lucide-react';
import { canDownloadMaterial, formatCurrencyEtb, formatRelativeDays } from '../lib/storeLogic';
import type {
  AggregatedOpportunity,
  DigitalProduct,
  JobApplication,
  JobListing,
  MaterialOrder,
  PaymentReceipt,
  TrainingRequest,
} from '../types/domain';

interface MyActivityViewProps {
  currentUserEmail: string;
  jobs: JobListing[];
  savedJobIds: string[];
  opportunities?: AggregatedOpportunity[];
  savedOpportunityIds?: string[];
  applications: JobApplication[];
  orders: MaterialOrder[];
  products: DigitalProduct[];
  receipts: PaymentReceipt[];
  trainingRequests: TrainingRequest[];
  onToggleSaveJob: (jobId: string) => void;
  onToggleSaveOpportunity?: (oppId: string) => void;
  onApplyJob: (job: JobListing) => void;
  onDownloadMaterial: (product: DigitalProduct, order: MaterialOrder) => void;
  onDownloadInvoice: (receipt: PaymentReceipt) => void;
  onDownloadTrainingProposal: (request: TrainingRequest) => void;
  onBrowseJobs: () => void;
  onBrowseOpportunities?: () => void;
  onBrowseStore: () => void;
  onBrowseTraining: () => void;
  onRequireAuth: () => void;
}

export const MyActivityView: React.FC<MyActivityViewProps> = ({
  currentUserEmail,
  jobs,
  savedJobIds,
  opportunities = [],
  savedOpportunityIds = [],
  applications,
  orders,
  products,
  receipts,
  trainingRequests,
  onToggleSaveJob,
  onToggleSaveOpportunity,
  onApplyJob,
  onDownloadMaterial,
  onDownloadInvoice,
  onDownloadTrainingProposal,
  onBrowseJobs,
  onBrowseOpportunities,
  onBrowseStore,
  onBrowseTraining,
  onRequireAuth,
}) => {
  const [tab, setTab] = useState<'orders' | 'applications' | 'saved' | 'training'>('orders');

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
  const myTrainingRequests = trainingRequests.filter(
    (r) => r.requesterEmail.toLowerCase() === currentUserEmail.toLowerCase()
  );
  const savedJobs = jobs.filter(
    (j) => savedJobIds.includes(j.id) && j.status === 'approved'
  );
  const savedOpportunities = opportunities.filter((o) =>
    savedOpportunityIds.includes(o.id)
  );
  const totalSavedCount = savedJobs.length + savedOpportunities.length;

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
            Saved ({totalSavedCount})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'training'}
            onClick={() => setTab('training')}
            className={`rounded-md px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              tab === 'training'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Training Proposals ({myTrainingRequests.length})
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

      {/* Tab 3: Saved Jobs & Opportunities */}
      {tab === 'saved' && (
        <section className="mt-6 space-y-6">
          {totalSavedCount === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
              <Bookmark className="mx-auto h-9 w-9 text-slate-400" />
              <h2 className="mt-3 font-display text-base font-bold text-slate-900">
                No saved jobs or opportunities
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Bookmark jobs, tenders, scholarships, or grants to review and act on them later.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={onBrowseJobs}
                  className="rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102E61]"
                >
                  Browse Jobs
                </button>
                {onBrowseOpportunities && (
                  <button
                    type="button"
                    onClick={onBrowseOpportunities}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Browse Tenders &amp; Grants
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {savedJobs.length > 0 && (
                <div className="space-y-3">
                  <h2 className="font-display text-sm font-bold uppercase tracking-wider text-slate-600">
                    Saved Jobs ({savedJobs.length})
                  </h2>
                  {savedJobs.map((job) => {
                    const isExternal = job.sourceType === 'external' && Boolean(job.sourceUrl);
                    const sourceName = job.sourceSite || 'Ethiopian Job Portal';
                    return (
                      <article
                        key={job.id}
                        className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center"
                      >
                        <div>
                          {isExternal && (
                            <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-[#164081]">
                              Source · {sourceName} ({job.sourceDomain})
                            </div>
                          )}
                          <h3 className="font-display text-base font-bold text-slate-900">
                            {job.titleEn}
                          </h3>
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
                          {isExternal ? (
                            <a
                              href={job.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102E61] whitespace-nowrap shrink-0"
                            >
                              <span>View on {sourceName}</span>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onApplyJob(job)}
                              className="rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102E61]"
                            >
                              Apply now
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {savedOpportunities.length > 0 && (
                <div className="space-y-3">
                  <h2 className="font-display text-sm font-bold uppercase tracking-wider text-slate-600">
                    Saved Tenders, Scholarships &amp; Grants ({savedOpportunities.length})
                  </h2>
                  {savedOpportunities.map((opp) => (
                    <article
                      key={opp.id}
                      className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center"
                    >
                      <div>
                        <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-[#164081]">
                          {opp.category} · Source: {opp.sourceName} ({opp.sourceDomain}) ·{' '}
                          {opp.verificationStatus}
                        </div>
                        <h3 className="font-display text-base font-bold text-slate-900">
                          {opp.title}
                        </h3>
                        <p className="mt-1 text-xs text-slate-600 tabular-nums">
                          {opp.organization} · {opp.location} · Deadline: {opp.deadline}
                        </p>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        {onToggleSaveOpportunity && (
                          <button
                            type="button"
                            onClick={() => onToggleSaveOpportunity(opp.id)}
                            className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Remove
                          </button>
                        )}
                        <a
                          href={opp.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102E61] whitespace-nowrap shrink-0"
                        >
                          <span>View on {opp.sourceName}</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* Tab 4: Organizational Training Proposals */}
      {tab === 'training' && (
        <section className="mt-6">
          {myTrainingRequests.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
              <GraduationCap className="mx-auto h-9 w-9 text-slate-400" />
              <h2 className="mt-3 font-display text-base font-bold text-slate-900">
                No organizational training requests yet
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Browse TATARI Academy tracks to request a tailored corporate or NGO training
                proposal.
              </p>
              <button
                type="button"
                onClick={onBrowseTraining}
                className="mt-4 rounded-lg bg-[#164081] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102E61]"
              >
                Explore Training Services
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {myTrainingRequests.map((req) => (
                <article
                  key={req.id}
                  className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center"
                >
                  <div className="space-y-1">
                    <div className="text-xs text-slate-500 tabular-nums">
                      <strong className="text-[#164081]">{req.status}</strong> ·{' '}
                      {req.organizationName} · {req.teamSize} participants · {req.deliveryMode}
                    </div>
                    <h2 className="font-display text-base font-bold text-slate-900">
                      {req.programTitle}
                    </h2>
                    <div className="text-xs text-slate-600 tabular-nums">
                      Quoted Cohort Fee:{' '}
                      <strong className="font-mono text-slate-900">
                        {formatCurrencyEtb(req.estimatedFeeEtb)}
                      </strong>
                      {req.trainerAssigned && ` · Facilitator: ${req.trainerAssigned}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDownloadTrainingProposal(req)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#164081] hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Download Proposal
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
