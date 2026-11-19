/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { AdminConsoleView } from './components/AdminConsoleView';
import { DigitalStoreView } from './components/DigitalStoreView';
import { EmployerHubView } from './components/EmployerHubView';
import { Header } from './components/Header';
import { JobBoardView } from './components/JobBoardView';
import {
  AddProductModal,
  AuthModal,
  JobApplyModal,
  PaymentCheckoutModal,
} from './components/Modals';
import { MyActivityView } from './components/MyActivityView';
import {
  getInitialPlatformState,
  persistPlatformState,
  pushReceiptAndAuditToSupabase,
  syncWithSupabaseIfAvailable,
  type PlatformState,
} from './lib/repository';
import {
  adminApprovePaymentReceipt,
  adminRejectPaymentReceipt,
  buildDownloadableMaterialFile,
  canDownloadMaterial,
  createJobPostingWithPayment,
  createMaterialOrderWithPayment,
  type JobDraftInput,
  type PaymentSubmissionInput,
} from './lib/storeLogic';
import type {
  AccountStatus,
  ApplicationStage,
  AppView,
  DigitalProduct,
  JobApplication,
  JobListing,
  JobModerationStatus,
  Language,
  MaterialOrder,
  UserRole,
} from './types/domain';

export default function App() {
  const [state, setState] = useState<PlatformState>(() => getInitialPlatformState());
  const [activeView, setActiveView] = useState<AppView>('jobs');

  const [applyModalJob, setApplyModalJob] = useState<JobListing | null>(null);
  const [checkoutProduct, setCheckoutProduct] = useState<DigitalProduct | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [addProductModalOpen, setAddProductModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; isError?: boolean } | null>(null);

  const showToast = (message: string, isError: boolean = false) => {
    setToast({ message, isError });
  };

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    persistPlatformState(state);
  }, [state]);

  useEffect(() => {
    let active = true;
    syncWithSupabaseIfAvailable().then((res) => {
      if (!active || !res.connected) return;
      setState((prev) => ({
        ...prev,
        jobs: res.jobs && res.jobs.length > 0 ? res.jobs : prev.jobs,
        products: res.products && res.products.length > 0 ? res.products : prev.products,
      }));
    });
    return () => {
      active = false;
    };
  }, []);

  const currentUser =
    state.users.find((u) => u.email.toLowerCase() === state.currentUserEmail.toLowerCase()) ||
    null;

  const pendingApprovalCount = state.receipts.filter(
    (r) => r.status === 'pending_verification'
  ).length;

  const handleToggleLanguage = (lang: Language) => {
    setState((prev) => ({ ...prev, language: lang }));
  };

  const handleToggleSaveJob = (jobId: string) => {
    setState((prev) => {
      const exists = prev.savedJobIds.includes(jobId);
      const nextSaved = exists
        ? prev.savedJobIds.filter((id) => id !== jobId)
        : [jobId, ...prev.savedJobIds];
      return { ...prev, savedJobIds: nextSaved };
    });
  };

  const handleSubmitApplication = (payload: {
    job: JobListing;
    applicantName: string;
    applicantEmail: string;
    phone: string;
    resumeUrl: string;
    yearsExperience: string;
    coverNote: string;
  }) => {
    const newApp: JobApplication = {
      id: `app-${Date.now()}`,
      jobId: payload.job.id,
      jobTitle: payload.job.titleEn,
      companyName: payload.job.companyName,
      applicantName: payload.applicantName,
      applicantEmail: payload.applicantEmail,
      phone: payload.phone,
      resumeUrl: payload.resumeUrl,
      yearsExperience: payload.yearsExperience,
      coverNote: payload.coverNote,
      status: 'Submitted',
      createdAt: new Date().toISOString(),
    };

    const logEntry = {
      id: `log-${Date.now()}`,
      userEmail: payload.applicantEmail,
      actionType: 'JOB_APPLICATION',
      details: `Applied to "${payload.job.titleEn}" at ${payload.job.companyName}`,
      createdAt: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      applications: [newApp, ...prev.applications],
      logs: [logEntry, ...prev.logs],
    }));
    setApplyModalJob(null);
    showToast(`Application submitted for ${payload.job.titleEn}.`);
  };

  const handleBuyProductWithReceipt = (
    product: DigitalProduct,
    payment: PaymentSubmissionInput
  ) => {
    try {
      const { order, receipt } = createMaterialOrderWithPayment(product, payment);
      const logEntry = {
        id: `log-${Date.now()}`,
        userEmail: payment.payerEmail,
        actionType: 'SUBMIT_STORE_RECEIPT',
        details: `Submitted ${payment.paymentMethod} ref ${payment.transactionRef} for "${product.titleEn}".`,
        createdAt: new Date().toISOString(),
      };

      setState((prev) => ({
        ...prev,
        orders: [order, ...prev.orders],
        receipts: [receipt, ...prev.receipts],
        logs: [logEntry, ...prev.logs],
      }));
      void pushReceiptAndAuditToSupabase(receipt, logEntry);
      setCheckoutProduct(null);
      showToast(
        `Payment receipt ${payment.transactionRef} submitted. Download unlocks once Administrator approves.`
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to submit payment.', true);
    }
  };

  const handleDownloadMaterial = (product: DigitalProduct, order: MaterialOrder) => {
    if (!canDownloadMaterial(order)) {
      showToast('Download is locked until Administrator verifies payment receipt.', true);
      return;
    }
    const receipt = state.receipts.find((r) => r.id === order.paymentReceiptId);
    const file = buildDownloadableMaterialFile(product, order, receipt);
    const blob = new Blob([file.content], { type: file.mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast(`Downloading ${file.filename}`);
  };

  const handleSubmitJobWithPayment = (
    draft: JobDraftInput,
    payment: PaymentSubmissionInput
  ) => {
    const { job, receipt } = createJobPostingWithPayment(draft, payment);
    const logEntry = {
      id: `log-${Date.now()}`,
      userEmail: payment.payerEmail,
      actionType: 'SUBMIT_JOB_RECEIPT',
      details: `Submitted job "${job.titleEn}" with ${payment.paymentMethod} ref ${payment.transactionRef}.`,
      createdAt: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      jobs: [job, ...prev.jobs],
      receipts: [receipt, ...prev.receipts],
      logs: [logEntry, ...prev.logs],
    }));
    void pushReceiptAndAuditToSupabase(receipt, logEntry);
    showToast(
      `Job "${job.titleEn}" and receipt ${payment.transactionRef} submitted for Administrator approval.`
    );
  };

  const handleApproveReceipt = (receiptId: string) => {
    const rcpt = state.receipts.find((r) => r.id === receiptId);
    if (!rcpt) return;

    const updated = adminApprovePaymentReceipt(
      { jobs: state.jobs, orders: state.orders, receipts: state.receipts },
      receiptId,
      currentUser?.email || 'admin@tatari.et'
    );

    const logEntry = {
      id: `log-${Date.now()}`,
      userEmail: currentUser?.email || 'admin@tatari.et',
      actionType:
        rcpt.targetType === 'job_post' ? 'APPROVE_JOB_PAYMENT' : 'APPROVE_STORE_PAYMENT',
      details: `Verified ${rcpt.transactionRef} — ${
        rcpt.targetType === 'job_post'
          ? `published "${rcpt.targetTitle}"`
          : `unlocked download for "${rcpt.targetTitle}"`
      }.`,
      createdAt: new Date().toISOString(),
    };

    const nextReceipt = updated.receipts.find((r) => r.id === receiptId);
    if (nextReceipt) {
      void pushReceiptAndAuditToSupabase(nextReceipt, logEntry);
    }

    setState((prev) => ({
      ...prev,
      jobs: updated.jobs,
      orders: updated.orders,
      receipts: updated.receipts,
      logs: [logEntry, ...prev.logs],
    }));
    showToast(
      rcpt.targetType === 'job_post'
        ? `Payment ${rcpt.transactionRef} approved — job is now live on the Job Board.`
        : `Payment ${rcpt.transactionRef} approved — material download unlocked for ${rcpt.payerName}.`
    );
  };

  const handleRejectReceipt = (receiptId: string, reason: string) => {
    const rcpt = state.receipts.find((r) => r.id === receiptId);
    if (!rcpt) return;

    const updated = adminRejectPaymentReceipt(
      { jobs: state.jobs, orders: state.orders, receipts: state.receipts },
      receiptId,
      currentUser?.email || 'admin@tatari.et',
      reason
    );

    const logEntry = {
      id: `log-${Date.now()}`,
      userEmail: currentUser?.email || 'admin@tatari.et',
      actionType: 'REJECT_PAYMENT_RECEIPT',
      details: `Rejected ${rcpt.transactionRef}: ${reason}`,
      createdAt: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      jobs: updated.jobs,
      orders: updated.orders,
      receipts: updated.receipts,
      logs: [logEntry, ...prev.logs],
    }));
    showToast(`Receipt ${rcpt.transactionRef} rejected.`, true);
  };

  const handleUpdateApplicationStage = (appId: string, stage: ApplicationStage) => {
    setState((prev) => ({
      ...prev,
      applications: prev.applications.map((a) =>
        a.id === appId ? { ...a, status: stage } : a
      ),
    }));
    showToast(`Candidate stage updated to ${stage}.`);
  };

  const handleSetJobStatus = (jobId: string, status: JobModerationStatus) => {
    setState((prev) => ({
      ...prev,
      jobs: prev.jobs.map((j) =>
        j.id === jobId
          ? {
              ...j,
              status,
              publishedAt: status === 'approved' ? new Date().toISOString() : j.publishedAt,
            }
          : j
      ),
    }));
    showToast(`Job status updated to ${status}.`);
  };

  const handleToggleProductActive = (productId: string) => {
    setState((prev) => ({
      ...prev,
      products: prev.products.map((p) =>
        p.id === productId ? { ...p, active: !p.active } : p
      ),
    }));
  };

  const handleAddProduct = (
    payload: Omit<DigitalProduct, 'id' | 'sellerEmail' | 'active' | 'createdAt'>
  ) => {
    const newProd: DigitalProduct = {
      ...payload,
      id: `prod-${Date.now()}`,
      sellerEmail: currentUser?.email || 'admin@tatari.et',
      imageUrl: '/src/assets/images/store_kpi_dashboard_1794985400650.jpg',
      active: true,
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      products: [newProd, ...prev.products],
    }));
    showToast(`"${newProd.titleEn}" published to the Digital Store.`);
  };

  const handleSetUserStatus = (email: string, status: AccountStatus) => {
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.email === email ? { ...u, status } : u)),
    }));
    showToast(`User ${email} marked as ${status}.`);
  };

  const handleSignIn = (email: string) => {
    setState((prev) => ({ ...prev, currentUserEmail: email }));
    showToast(`Signed in as ${email}.`);
  };

  const handleRegister = (user: {
    email: string;
    fullName: string;
    companyName?: string;
    phone?: string;
    role: UserRole;
  }) => {
    const newProfile = {
      email: user.email,
      fullName: user.fullName,
      companyName: user.companyName,
      phone: user.phone,
      role: user.role,
      status: 'approved' as const,
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      users: prev.users.some((u) => u.email === user.email)
        ? prev.users
        : [...prev.users, newProfile],
      currentUserEmail: user.email,
    }));
    showToast(`Account created and signed in as ${user.email}.`);
  };

  const handleExportCsv = () => {
    const rows = [
      ['Type', 'Title', 'User', 'Method', 'TXN Ref', 'Amount ETB', 'Status'],
      ...state.receipts.map((r) => [
        r.targetType,
        r.targetTitle,
        r.payerEmail,
        r.paymentMethod,
        r.transactionRef,
        String(r.amountEtb),
        r.status,
      ]),
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tatari-payment-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Payment & approval ledger exported to CSV.');
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F8FA] text-slate-900">
      <Header
        activeView={activeView}
        onNavigate={setActiveView}
        currentUser={currentUser}
        pendingApprovalCount={pendingApprovalCount}
        language={state.language}
        onOpenAuth={() => setAuthModalOpen(true)}
      />

      <div className="flex-1">
        {activeView === 'jobs' && (
          <JobBoardView
            jobs={state.jobs}
            savedJobIds={state.savedJobIds}
            applications={state.applications}
            currentUserEmail={state.currentUserEmail}
            language={state.language}
            onToggleLanguage={handleToggleLanguage}
            onToggleSaveJob={handleToggleSaveJob}
            onOpenApplyModal={(job) => setApplyModalJob(job)}
            onNavigateEmployer={() => setActiveView('employer')}
          />
        )}

        {activeView === 'store' && (
          <DigitalStoreView
            products={state.products}
            orders={state.orders}
            currentUserEmail={state.currentUserEmail}
            language={state.language}
            onBuyProduct={(product) => setCheckoutProduct(product)}
            onDownloadMaterial={handleDownloadMaterial}
          />
        )}

        {activeView === 'activity' && (
          <MyActivityView
            currentUserEmail={state.currentUserEmail}
            jobs={state.jobs}
            savedJobIds={state.savedJobIds}
            applications={state.applications}
            orders={state.orders}
            products={state.products}
            receipts={state.receipts}
            onToggleSaveJob={handleToggleSaveJob}
            onApplyJob={(job) => setApplyModalJob(job)}
            onDownloadMaterial={handleDownloadMaterial}
            onBrowseJobs={() => setActiveView('jobs')}
            onBrowseStore={() => setActiveView('store')}
          />
        )}

        {activeView === 'employer' && (
          <EmployerHubView
            currentUser={currentUser}
            jobs={state.jobs}
            applications={state.applications}
            receipts={state.receipts}
            onSubmitJobWithPayment={handleSubmitJobWithPayment}
            onUpdateApplicationStage={handleUpdateApplicationStage}
            onRequireAuth={() => setAuthModalOpen(true)}
          />
        )}

        {activeView === 'admin' && (
          <AdminConsoleView
            currentUser={currentUser}
            receipts={state.receipts}
            jobs={state.jobs}
            products={state.products}
            users={state.users}
            logs={state.logs}
            onApproveReceipt={handleApproveReceipt}
            onRejectReceipt={handleRejectReceipt}
            onSetJobStatus={handleSetJobStatus}
            onToggleProductActive={handleToggleProductActive}
            onOpenAddProduct={() => setAddProductModalOpen(true)}
            onSetUserStatus={handleSetUserStatus}
            onExportCsv={handleExportCsv}
            onQuickSwitchAdmin={() => handleSignIn('admin@tatari.et')}
          />
        )}
      </div>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="font-display text-sm font-extrabold text-[#10243B]">TATARI</span>
            <span aria-hidden="true">·</span>
            <span>Addis Ababa, Ethiopia · Job Portal &amp; Digital Store</span>
          </div>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => setActiveView('jobs')}
              className="hover:text-slate-900"
            >
              Find Jobs
            </button>
            <button
              type="button"
              onClick={() => setActiveView('store')}
              className="hover:text-slate-900"
            >
              Digital Store
            </button>
            <button
              type="button"
              onClick={() => setActiveView('employer')}
              className="hover:text-slate-900"
            >
              Post a Job
            </button>
            <span>© {new Date().getFullYear()} TATARI Consulting PLC</span>
          </div>
        </div>
      </footer>

      {/* Active Modals */}
      {applyModalJob && (
        <JobApplyModal
          job={applyModalJob}
          currentUser={currentUser}
          onClose={() => setApplyModalJob(null)}
          onSubmit={handleSubmitApplication}
        />
      )}

      {checkoutProduct && (
        <PaymentCheckoutModal
          product={checkoutProduct}
          currentUser={currentUser}
          onClose={() => setCheckoutProduct(null)}
          onSubmitPayment={handleBuyProductWithReceipt}
        />
      )}

      {authModalOpen && (
        <AuthModal
          currentUser={currentUser}
          users={state.users}
          onClose={() => setAuthModalOpen(false)}
          onSignIn={handleSignIn}
          onRegister={handleRegister}
        />
      )}

      {addProductModalOpen && (
        <AddProductModal
          onClose={() => setAddProductModalOpen(false)}
          onAddProduct={handleAddProduct}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 right-5 z-50 max-w-md rounded-lg px-4 py-3 text-xs font-semibold text-white shadow-lg ${
            toast.isError ? 'bg-rose-800' : 'bg-[#10243B]'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
