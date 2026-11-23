/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { AdminConsoleView } from './components/AdminConsoleView';
import { BankFxDashboardView } from './components/BankFxDashboardView';
import { DigitalStoreView } from './components/DigitalStoreView';
import { EmployerHubView } from './components/EmployerHubView';
import { Header } from './components/Header';
import { HelpModal } from './components/HelpModal';
import { JobBoardView } from './components/JobBoardView';
import {
  AddProductModal,
  AuthModal,
  JobApplyModal,
  PaymentCheckoutModal,
} from './components/Modals';
import { MyActivityView } from './components/MyActivityView';
import { OpportunitiesHubView } from './components/OpportunitiesHubView';
import { TrainingServicesView } from './components/TrainingServicesView';
import {
  deleteJobFromSupabase,
  deleteProductFromSupabase,
  deleteUserFromSupabase,
  getInitialPlatformState,
  persistPlatformState,
  pushApplicationToSupabase,
  pushJobToSupabase,
  pushOrderToSupabase,
  pushProductToSupabase,
  pushReceiptAndAuditToSupabase,
  pushUserProfileAndAuditToSupabase,
  syncWithSupabaseIfAvailable,
  type PlatformState,
} from './lib/repository';
import {
  adminCreateUserAccount,
  adminDeleteUserAccount,
  adminResetUserPassword,
  adminUpdateAccountStatus,
  adminUpdateUserAccount,
  adminUpdateUserRole,
  authenticateCredentials,
  canAccessActivity,
  changeOwnPassword,
  deleteOwnAccount,
  registerSeekerAndCreateApplication,
  registerVerifiedRoleAccount,
  updateOwnProfile,
  type AdminCreateUserInput,
  type AdminUserUpdateInput,
  type SelfProfileUpdateInput,
} from './lib/security';
import {
  adminApprovePaymentReceipt,
  adminRejectPaymentReceipt,
  buildDownloadableMaterialFile,
  buildOfficialInvoiceHtml,
  canDownloadMaterial,
  createJobPostingWithPayment,
  createMaterialOrderWithPayment,
  deleteDigitalProduct,
  deleteEmployerJobListing,
  isDuplicateTransactionRef,
  updateDigitalProduct,
  updateEmployerJobListing,
  upsertProductReview,
  type JobDraftInput,
  type PaymentSubmissionInput,
} from './lib/storeLogic';
import { mergeExternalJobs, type ExternalJobsApiResponse } from './lib/externalJobs';
import {
  adminCreateTrainingProgram,
  adminDeleteTrainingProgram,
  adminUpdateTrainingProgram,
  adminUpdateTrainingRequestStatus,
  buildTrainingProposalHtml,
  createTailoredTrainingRequest,
  type CreateTrainingRequestInput,
  type TrainingProgramInput,
} from './lib/trainingLogic';
import type {
  AccountStatus,
  AggregatedOpportunity,
  AggregatorOverviewResponse,
  ApplicationStage,
  AppView,
  BankFxApiResponse,
  DigitalProduct,
  ExternalJobSourceStatus,
  JobListing,
  JobModerationStatus,
  Language,
  MaterialOrder,
  OpportunitiesApiResponse,
  OpportunityModuleType,
  PaymentReceipt,
  TrainingProposalStatus,
  TrainingRequest,
  UserRole,
} from './types/domain';

interface AuthModalConfig {
  open: boolean;
  mode: 'profile' | 'signin' | 'signup' | 'password';
  role: 'seeker' | 'employer';
  notice: string | null;
}

export default function App() {
  const [state, setState] = useState<PlatformState>(() => getInitialPlatformState());
  const [activeView, setActiveView] = useState<AppView>('jobs');

  const [applyModalJob, setApplyModalJob] = useState<JobListing | null>(null);
  const [checkoutProduct, setCheckoutProduct] = useState<DigitalProduct | null>(null);
  const [pendingProductAfterAuth, setPendingProductAfterAuth] = useState<DigitalProduct | null>(
    null
  );
  const [authConfig, setAuthConfig] = useState<AuthModalConfig>({
    open: false,
    mode: 'signin',
    role: 'seeker',
    notice: null,
  });
  const [addProductModalOpen, setAddProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<DigitalProduct | null>(null);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [failedLoginCount, setFailedLoginCount] = useState(0);
  const [lockoutUntilMs, setLockoutUntilMs] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [externalSources, setExternalSources] = useState<ExternalJobSourceStatus[]>([]);
  const [isSyncingExternal, setIsSyncingExternal] = useState(false);
  const [lastExternalSyncAt, setLastExternalSyncAt] = useState<string | null>(null);
  const [externalJobsError, setExternalJobsError] = useState<string | null>(null);
  const [fxData, setFxData] = useState<BankFxApiResponse | null>(null);
  const [isSyncingFx, setIsSyncingFx] = useState(false);
  const [fxError, setFxError] = useState<string | null>(null);
  const [oppData, setOppData] = useState<OpportunitiesApiResponse | null>(null);
  const [isSyncingOpp, setIsSyncingOpp] = useState(false);
  const [oppError, setOppError] = useState<string | null>(null);
  const [aggregatorOverview, setAggregatorOverview] = useState<AggregatorOverviewResponse | null>(
    null
  );
  const [adminBearerToken, setAdminBearerToken] = useState<string | null>(null);
  const [isSyncingAggregator, setIsSyncingAggregator] = useState(false);
  const [adminRequestedTab, setAdminRequestedTab] = useState<
    'payments' | 'jobs' | 'store' | 'training' | 'sources' | 'users' | undefined
  >(undefined);
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
    if (lockoutUntilMs <= Date.now()) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [lockoutUntilMs]);

  useEffect(() => {
    persistPlatformState(state);
  }, [state]);

  const syncExternalJobs = async (forceRefresh: boolean = false, notifyUser: boolean = false) => {
    setIsSyncingExternal(true);
    setExternalJobsError(null);
    try {
      const response = await fetch(`/api/external-jobs${forceRefresh ? '?refresh=1' : ''}`);
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok) {
        throw new Error(`Feed sync returned HTTP ${response.status}.`);
      }
      if (!contentType.includes('application/json')) {
        throw new Error(
          'External jobs API returned HTML instead of JSON. Ensure backend /api routes are running (npm start or Vercel Serverless Functions).'
        );
      }
      const data = (await response.json()) as ExternalJobsApiResponse;
      const incomingJobs = Array.isArray(data.jobs) ? data.jobs : [];
      const incomingSources = Array.isArray(data.sources) ? data.sources : [];

      setExternalSources(incomingSources);
      setLastExternalSyncAt(data.syncedAt || new Date().toISOString());

      setState((prev) => {
        const nextJobs =
          incomingJobs.length > 0 ? mergeExternalJobs(prev.jobs, incomingJobs) : prev.jobs;
        const syncLog =
          forceRefresh && prev.currentUserEmail
            ? [
                {
                  id: `log-${Date.now()}-extsync`,
                  userEmail: prev.currentUserEmail,
                  actionType: 'EXTERNAL_JOBS_SYNC',
                  details: `Collected ${incomingJobs.length} vacancies across ${
                    incomingSources.filter((s) => s.status === 'ok').length
                  } Ethiopian job websites.`,
                  createdAt: new Date().toISOString(),
                },
                ...prev.logs,
              ]
            : prev.logs;
        return {
          ...prev,
          jobs: nextJobs,
          logs: syncLog,
        };
      });

      if (incomingJobs.length === 0) {
        setExternalJobsError(
          'External job portals returned 0 open vacancies right now. Click Retry Live Sync shortly.'
        );
      }

      if (notifyUser) {
        const activeNames = incomingSources
          .filter((s) => s.status === 'ok' && s.fetchedCount > 0)
          .map((s) => `${s.name} (${s.fetchedCount})`)
          .join(', ');
        showToast(
          incomingJobs.length > 0
            ? `Collected ${incomingJobs.length} open vacancies: ${activeNames}.`
            : 'No external vacancies returned right now. Please try again shortly.',
          incomingJobs.length === 0
        );
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Could not reach external Ethiopian job websites right now.';
      setExternalJobsError(msg);
      if (notifyUser) {
        showToast(msg, true);
      }
    } finally {
      setIsSyncingExternal(false);
    }
  };

  const refreshAggregatorOverview = async (tokenOverride?: string | null) => {
    const token = tokenOverride ?? adminBearerToken;
    if (!token) return;
    try {
      const response = await fetch('/api/aggregator/overview', {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return;
      const data = (await response.json()) as AggregatorOverviewResponse;
      setAggregatorOverview(data);
    } catch {
      // Non-blocking overview fetch
    }
  };

  const fetchFxRates = async (forceRefresh: boolean = false, notifyUser: boolean = false) => {
    setIsSyncingFx(true);
    setFxError(null);
    try {
      const response = await fetch(`/api/fx-rates${forceRefresh ? '?refresh=1' : ''}`);
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok) {
        throw new Error(`FX sync returned HTTP ${response.status}.`);
      }
      if (!contentType.includes('application/json')) {
        throw new Error(
          'Bank FX API returned HTML instead of JSON. Ensure backend /api routes are active.'
        );
      }
      const data = (await response.json()) as BankFxApiResponse;
      setFxData(data);
      const liveBanks = (data.bankStatuses || []).filter(
        (b) => b.status === 'Verified' || b.status === 'Stale'
      ).length;
      if (data.rates.length === 0) {
        setFxError('No commercial bank FX quotes were returned during the last sync.');
      }
      if (notifyUser) {
        showToast(
          data.rates.length > 0
            ? `Collected ${data.rates.length} official FX quotes from ${liveBanks} live bank sources.`
            : 'No verified commercial FX feeds returned right now.',
          data.rates.length === 0
        );
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Could not reach live Ethiopian bank FX sources right now.';
      setFxError(msg);
      if (notifyUser) {
        showToast(msg, true);
      }
    } finally {
      setIsSyncingFx(false);
    }
  };

  const fetchOpportunities = async (forceRefresh: boolean = false, notifyUser: boolean = false) => {
    setIsSyncingOpp(true);
    setOppError(null);
    try {
      const response = await fetch(`/api/opportunities${forceRefresh ? '?refresh=1' : ''}`);
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok) {
        throw new Error(`Opportunities sync returned HTTP ${response.status}.`);
      }
      if (!contentType.includes('application/json')) {
        throw new Error(
          'Opportunities API returned HTML instead of JSON. Ensure backend /api routes are active.'
        );
      }
      const data = (await response.json()) as OpportunitiesApiResponse;
      setOppData(data);
      if (data.items.length === 0) {
        setOppError('External opportunity publishers returned 0 live items during the last sync.');
      }
      if (notifyUser) {
        showToast(
          data.items.length > 0
            ? `Synced ${data.items.length} verified tenders, scholarships, grants & public notices.`
            : 'No external opportunity records returned right now.',
          data.items.length === 0
        );
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Could not reach external Ethiopian opportunity feeds right now.';
      setOppError(msg);
      if (notifyUser) {
        showToast(msg, true);
      }
    } finally {
      setIsSyncingOpp(false);
    }
  };

  useEffect(() => {
    let active = true;
    syncWithSupabaseIfAvailable().then((res) => {
      if (!active || !res.connected) return;
      setState((prev) => ({
        ...prev,
        jobs: res.jobs && res.jobs.length > 0 ? res.jobs : prev.jobs,
        products: res.products && res.products.length > 0 ? res.products : prev.products,
        orders: res.orders && res.orders.length > 0 ? res.orders : prev.orders,
        receipts: res.receipts && res.receipts.length > 0 ? res.receipts : prev.receipts,
        applications:
          res.applications && res.applications.length > 0 ? res.applications : prev.applications,
      }));
    });
    void syncExternalJobs(false, false);
    void fetchFxRates(false, false);
    void fetchOpportunities(false, false);
    return () => {
      active = false;
    };
  }, []);

  const currentUser =
    state.currentUserEmail
      ? state.users.find(
          (u) => u.email.toLowerCase() === state.currentUserEmail.toLowerCase()
        ) || null
      : null;

  const isAdmin = currentUser?.role === 'admin' && currentUser?.status === 'approved';

  useEffect(() => {
    if (activeView === 'admin' && !isAdmin) {
      setActiveView('jobs');
    }
  }, [activeView, isAdmin]);

  const currentSavedJobIds = currentUser
    ? state.savedJobIdsByUser[currentUser.email.toLowerCase()] || []
    : [];

  const currentSavedOpportunityIds = currentUser
    ? state.savedOpportunityIdsByUser[currentUser.email.toLowerCase()] || []
    : [];

  const pendingApprovalCount = isAdmin
    ? state.receipts.filter((r) => r.status === 'pending_verification').length
    : 0;

  const lockoutSecondsRemaining = Math.max(0, Math.ceil((lockoutUntilMs - nowMs) / 1000));

  const openAuthModal = (options?: {
    mode?: 'profile' | 'signin' | 'signup' | 'password';
    role?: 'seeker' | 'employer';
    notice?: string;
  }) => {
    setAuthConfig({
      open: true,
      mode: options?.mode || 'signin',
      role: options?.role || 'seeker',
      notice: options?.notice || null,
    });
  };

  const handleToggleLanguage = (lang: Language) => {
    setState((prev) => ({ ...prev, language: lang }));
  };

  const handleToggleSaveJob = (jobId: string) => {
    const access = canAccessActivity(currentUser, 'save_job');
    if (!access.allowed || !currentUser) {
      openAuthModal({
        mode: 'signup',
        role: 'seeker',
        notice:
          'Registration is required to bookmark and manage saved jobs. Job seekers are also registered automatically when applying for a specific job.',
      });
      return;
    }

    const emailKey = currentUser.email.toLowerCase();
    setState((prev) => {
      const existing = prev.savedJobIdsByUser[emailKey] || [];
      const exists = existing.includes(jobId);
      const nextSaved = exists ? existing.filter((id) => id !== jobId) : [jobId, ...existing];
      return {
        ...prev,
        savedJobIdsByUser: {
          ...prev.savedJobIdsByUser,
          [emailKey]: nextSaved,
        },
      };
    });
  };

  const handleToggleSaveOpportunity = (oppId: string) => {
    const access = canAccessActivity(currentUser, 'save_job');
    if (!access.allowed || !currentUser) {
      openAuthModal({
        mode: 'signup',
        role: 'seeker',
        notice:
          'Sign in or register an account to bookmark tenders, scholarships, grants, and public opportunities.',
      });
      return;
    }

    const emailKey = currentUser.email.toLowerCase();
    setState((prev) => {
      const existing = prev.savedOpportunityIdsByUser[emailKey] || [];
      const exists = existing.includes(oppId);
      const nextSaved = exists ? existing.filter((id) => id !== oppId) : [oppId, ...existing];
      return {
        ...prev,
        savedOpportunityIdsByUser: {
          ...prev.savedOpportunityIdsByUser,
          [emailKey]: nextSaved,
        },
      };
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
    password?: string;
    confirmPassword?: string;
  }): string | null => {
    try {
      const result = registerSeekerAndCreateApplication(
        state.users,
        currentUser,
        payload,
        new Date().toISOString(),
        state.applications
      );
      const nowIso = new Date().toISOString();
      const logsToAdd = [
        {
          id: `log-${Date.now()}-app`,
          userEmail: result.actorEmail,
          actionType: 'JOB_APPLICATION',
          details: `Applied to "${payload.job.titleEn}" at ${payload.job.companyName}`,
          createdAt: nowIso,
        },
      ];

      if (result.newUser) {
        const regLog = {
          id: `log-${Date.now()}-reg`,
          userEmail: result.newUser.email,
          actionType: 'REGISTER_SEEKER_ON_APPLY',
          details: `Registered Job Seeker account while applying for "${payload.job.titleEn}".`,
          createdAt: nowIso,
        };
        logsToAdd.unshift(regLog);
        void pushUserProfileAndAuditToSupabase(result.newUser, regLog);
      }

      void pushApplicationToSupabase(result.application);

      setState((prev) => ({
        ...prev,
        users: result.newUser ? [...prev.users, result.newUser] : prev.users,
        currentUserEmail: result.newUser ? result.newUser.email : prev.currentUserEmail,
        applications: [result.application, ...prev.applications],
        logs: [...logsToAdd, ...prev.logs],
      }));
      setApplyModalJob(null);
      showToast(
        result.newUser
          ? `Job Seeker account registered & application submitted for ${payload.job.titleEn}.`
          : `Application submitted for ${payload.job.titleEn}.`
      );
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Unable to submit application.';
    }
  };

  const handleRequestBuyProduct = (product: DigitalProduct) => {
    const access = canAccessActivity(currentUser, 'store_checkout');
    if (!access.allowed || !currentUser) {
      setPendingProductAfterAuth(product);
      openAuthModal({
        mode: 'signup',
        role: 'seeker',
        notice:
          'Registration and sign-in are required before purchasing or downloading digital materials.',
      });
      return;
    }
    setCheckoutProduct(product);
  };

  const handleBuyProductWithReceipt = (
    product: DigitalProduct,
    payment: PaymentSubmissionInput
  ): string | null => {
    const access = canAccessActivity(currentUser, 'store_checkout');
    if (!access.allowed || !currentUser) {
      return 'Please register and sign in before submitting payment.';
    }
    if (isDuplicateTransactionRef(state.receipts, payment.transactionRef)) {
      return `Transaction reference "${payment.transactionRef.trim()}" has already been submitted. Enter a unique Telebirr or Bank reference ID.`;
    }

    try {
      const { order, receipt } = createMaterialOrderWithPayment(product, {
        ...payment,
        payerEmail: currentUser.email,
      });
      const logEntry = {
        id: `log-${Date.now()}`,
        userEmail: currentUser.email,
        actionType: 'SUBMIT_STORE_RECEIPT',
        details: `Submitted ${payment.paymentMethod} ref ${payment.transactionRef} (ETB ${receipt.amountEtb}) for "${product.titleEn}".`,
        createdAt: new Date().toISOString(),
      };

      setState((prev) => ({
        ...prev,
        orders: [order, ...prev.orders],
        receipts: [receipt, ...prev.receipts],
        logs: [logEntry, ...prev.logs],
      }));
      void pushOrderToSupabase(order);
      void pushReceiptAndAuditToSupabase(receipt, logEntry);
      setCheckoutProduct(null);
      showToast(
        `Payment receipt ${payment.transactionRef} submitted. Download unlocks once Administrator approves.`
      );
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Unable to submit payment.';
    }
  };

  const handleDownloadMaterial = (product: DigitalProduct, order: MaterialOrder) => {
    const access = canAccessActivity(currentUser, 'store_download');
    if (!access.allowed || !currentUser) {
      openAuthModal({
        mode: 'signin',
        notice: 'Sign in with your registered account to download approved materials.',
      });
      return;
    }
    if (
      order.buyerEmail.toLowerCase() !== currentUser.email.toLowerCase() &&
      currentUser.role !== 'admin'
    ) {
      showToast('You are not authorized to download another buyer’s order.', true);
      return;
    }
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

  const handleDownloadInvoice = (receipt: PaymentReceipt) => {
    if (!currentUser) {
      openAuthModal({ mode: 'signin', notice: 'Sign in to download verified receipts.' });
      return;
    }
    if (
      receipt.payerEmail.toLowerCase() !== currentUser.email.toLowerCase() &&
      currentUser.role !== 'admin'
    ) {
      showToast('You are not authorized to download another customer’s invoice.', true);
      return;
    }
    const invoice = buildOfficialInvoiceHtml(receipt);
    const blob = new Blob([invoice.content], { type: invoice.mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = invoice.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast(`Official invoice ${invoice.filename} downloaded.`);
  };

  const handleSubmitJobWithPayment = (
    draft: JobDraftInput,
    payment: PaymentSubmissionInput
  ): string | null => {
    const access = canAccessActivity(currentUser, 'employer_hub');
    if (!access.allowed || !currentUser) {
      return access.reason || 'Verified Employer account required.';
    }
    if (isDuplicateTransactionRef(state.receipts, payment.transactionRef)) {
      return `Transaction reference "${payment.transactionRef.trim()}" has already been submitted. Enter a unique Telebirr or Bank reference ID.`;
    }

    try {
      const { job, receipt } = createJobPostingWithPayment(
        { ...draft, employerEmail: currentUser.email },
        { ...payment, payerEmail: currentUser.email }
      );
      const logEntry = {
        id: `log-${Date.now()}`,
        userEmail: currentUser.email,
        actionType: 'SUBMIT_JOB_RECEIPT',
        details: `Submitted ${job.tierName || 'Standard'} job "${job.titleEn}" with ${payment.paymentMethod} ref ${payment.transactionRef} (ETB ${receipt.amountEtb}).`,
        createdAt: new Date().toISOString(),
      };

      setState((prev) => ({
        ...prev,
        jobs: [job, ...prev.jobs],
        receipts: [receipt, ...prev.receipts],
        logs: [logEntry, ...prev.logs],
      }));
      void pushJobToSupabase(job);
      void pushReceiptAndAuditToSupabase(receipt, logEntry);
      showToast(
        `Job "${job.titleEn}" and receipt ${payment.transactionRef} submitted for Administrator approval.`
      );
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Unable to submit job posting.';
    }
  };

  const handleApproveReceipt = (receiptId: string) => {
    if (!canAccessActivity(currentUser, 'admin_console').allowed || !currentUser) {
      showToast('Administrator authentication required.', true);
      return;
    }

    const rcpt = state.receipts.find((r) => r.id === receiptId);
    if (!rcpt) return;

    const updated = adminApprovePaymentReceipt(
      { jobs: state.jobs, orders: state.orders, receipts: state.receipts },
      receiptId,
      currentUser.email
    );

    const logEntry = {
      id: `log-${Date.now()}`,
      userEmail: currentUser.email,
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
    const nextJob = updated.jobs.find(
      (j) => j.id === rcpt.targetId || j.paymentReceiptId === receiptId
    );
    if (nextJob) void pushJobToSupabase(nextJob);
    const nextOrder = updated.orders.find(
      (o) => o.id === rcpt.targetId || o.paymentReceiptId === receiptId
    );
    if (nextOrder) void pushOrderToSupabase(nextOrder);

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
    if (!canAccessActivity(currentUser, 'admin_console').allowed || !currentUser) {
      showToast('Administrator authentication required.', true);
      return;
    }

    const rcpt = state.receipts.find((r) => r.id === receiptId);
    if (!rcpt) return;

    const updated = adminRejectPaymentReceipt(
      { jobs: state.jobs, orders: state.orders, receipts: state.receipts },
      receiptId,
      currentUser.email,
      reason
    );

    const logEntry = {
      id: `log-${Date.now()}`,
      userEmail: currentUser.email,
      actionType: 'REJECT_PAYMENT_RECEIPT',
      details: `Rejected ${rcpt.transactionRef}: ${reason}`,
      createdAt: new Date().toISOString(),
    };

    const nextReceipt = updated.receipts.find((r) => r.id === receiptId);
    if (nextReceipt) void pushReceiptAndAuditToSupabase(nextReceipt, logEntry);
    const nextJob = updated.jobs.find(
      (j) => j.id === rcpt.targetId || j.paymentReceiptId === receiptId
    );
    if (nextJob) void pushJobToSupabase(nextJob);
    const nextOrder = updated.orders.find(
      (o) => o.id === rcpt.targetId || o.paymentReceiptId === receiptId
    );
    if (nextOrder) void pushOrderToSupabase(nextOrder);

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
    if (!canAccessActivity(currentUser, 'employer_hub').allowed) {
      showToast('Verified Employer access required.', true);
      return;
    }
    const existing = state.applications.find((a) => a.id === appId);
    if (existing) {
      void pushApplicationToSupabase({ ...existing, status: stage });
    }
    setState((prev) => ({
      ...prev,
      applications: prev.applications.map((a) =>
        a.id === appId ? { ...a, status: stage } : a
      ),
    }));
    showToast(`Candidate stage updated to ${stage}.`);
  };

  const handleEmployerToggleJobPause = (jobId: string) => {
    if (!canAccessActivity(currentUser, 'employer_hub').allowed || !currentUser) {
      showToast('Verified Employer access required.', true);
      return;
    }
    const target = state.jobs.find((j) => j.id === jobId);
    if (!target) return;
    if (
      currentUser.role !== 'admin' &&
      target.employerEmail.toLowerCase() !== currentUser.email.toLowerCase()
    ) {
      showToast('You can only pause or reopen your own listings.', true);
      return;
    }
    if (target.status !== 'approved' && target.status !== 'paused') {
      showToast('Only Administrator-approved jobs can be paused or reopened.', true);
      return;
    }
    const nextStatus: JobModerationStatus = target.status === 'approved' ? 'paused' : 'approved';
    const nextJob = { ...target, status: nextStatus };
    void pushJobToSupabase(nextJob);
    setState((prev) => ({
      ...prev,
      jobs: prev.jobs.map((j) => (j.id === jobId ? nextJob : j)),
    }));
    showToast(
      nextStatus === 'paused'
        ? `"${target.titleEn}" paused from public Job Board.`
        : `"${target.titleEn}" reopened and live on Job Board.`
    );
  };

  const handleSetJobStatus = (jobId: string, status: JobModerationStatus) => {
    if (!canAccessActivity(currentUser, 'admin_console').allowed) {
      showToast('Administrator authentication required.', true);
      return;
    }
    const existing = state.jobs.find((j) => j.id === jobId);
    if (existing) {
      void pushJobToSupabase({
        ...existing,
        status,
        publishedAt: status === 'approved' ? new Date().toISOString() : existing.publishedAt,
      });
    }
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
    if (!canAccessActivity(currentUser, 'admin_console').allowed) {
      showToast('Administrator authentication required.', true);
      return;
    }
    const existing = state.products.find((p) => p.id === productId);
    if (existing) {
      void pushProductToSupabase({ ...existing, active: !existing.active });
    }
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
    if (!canAccessActivity(currentUser, 'admin_console').allowed || !currentUser) {
      showToast('Administrator authentication required.', true);
      return;
    }
    const newProd: DigitalProduct = {
      ...payload,
      id: `prod-${Date.now()}`,
      sellerEmail: currentUser.email,
      imageUrl: '/images/store_kpi_dashboard_1794985400650.jpg',
      active: true,
      createdAt: new Date().toISOString(),
    };
    const logEntry = {
      id: `log-${Date.now()}-addprod`,
      userEmail: currentUser.email,
      actionType: 'ADMIN_CREATE_PRODUCT',
      details: `Published digital material "${newProd.titleEn}" (ETB ${newProd.priceEtb}).`,
      createdAt: new Date().toISOString(),
    };
    void pushProductToSupabase(newProd);
    setState((prev) => ({
      ...prev,
      products: [newProd, ...prev.products],
      logs: [logEntry, ...prev.logs],
    }));
    showToast(`"${newProd.titleEn}" published to the Digital Store.`);
  };

  const handleUpdateProduct = (
    productId: string,
    updates: Omit<DigitalProduct, 'id' | 'sellerEmail' | 'active' | 'createdAt'>
  ) => {
    try {
      const nextProducts = updateDigitalProduct(state.products, currentUser, productId, updates);
      const updated = nextProducts.find((p) => p.id === productId);
      const logEntry = {
        id: `log-${Date.now()}-updprod`,
        userEmail: currentUser?.email || 'admin@tatari.et',
        actionType: 'ADMIN_UPDATE_PRODUCT',
        details: `Updated digital material "${updates.titleEn}" (ETB ${updates.priceEtb}).`,
        createdAt: new Date().toISOString(),
      };
      if (updated) {
        void pushProductToSupabase(updated);
      }
      setState((prev) => ({
        ...prev,
        products: nextProducts,
        logs: [logEntry, ...prev.logs],
      }));
      showToast(`"${updates.titleEn}" updated successfully.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update digital material.', true);
    }
  };

  const handleDeleteProduct = (productId: string) => {
    try {
      const existing = state.products.find((p) => p.id === productId);
      const nextProducts = deleteDigitalProduct(state.products, currentUser, productId);
      const logEntry = {
        id: `log-${Date.now()}-delprod`,
        userEmail: currentUser?.email || 'admin@tatari.et',
        actionType: 'ADMIN_DELETE_PRODUCT',
        details: `Deleted digital material "${existing?.titleEn || productId}".`,
        createdAt: new Date().toISOString(),
      };
      void deleteProductFromSupabase(productId);
      setState((prev) => ({
        ...prev,
        products: nextProducts,
        logs: [logEntry, ...prev.logs],
      }));
      showToast(`Digital material "${existing?.titleEn || productId}" deleted.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete digital material.', true);
    }
  };

  const handleSubmitProductReview = (
    productId: string,
    rating: number,
    comment: string
  ): string | null => {
    try {
      const nextReviews = upsertProductReview(state.reviews, state.orders, currentUser, {
        productId,
        rating,
        comment,
      });
      const logEntry = {
        id: `log-${Date.now()}-rev`,
        userEmail: currentUser?.email || 'buyer',
        actionType: 'STORE_PRODUCT_REVIEW',
        details: `Published ${rating}-star verified buyer review on product ${productId}.`,
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        reviews: nextReviews,
        logs: [logEntry, ...prev.logs],
      }));
      showToast('Thank you! Your verified buyer review is live.');
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Unable to publish review.';
    }
  };

  const handleUpdateEmployerJob = (
    jobId: string,
    updates: {
      titleEn: string;
      location: string;
      salaryMin: number;
      salaryMax: number;
      deadline: string;
      descriptionEn: string;
    }
  ): string | null => {
    try {
      const nextJobs = updateEmployerJobListing(state.jobs, currentUser, jobId, updates);
      const updated = nextJobs.find((j) => j.id === jobId);
      const logEntry = {
        id: `log-${Date.now()}-updjob`,
        userEmail: currentUser?.email || 'employer',
        actionType: 'EMPLOYER_UPDATE_JOB',
        details: `Updated job listing "${updates.titleEn}" (${updates.location}).`,
        createdAt: new Date().toISOString(),
      };
      if (updated) {
        void pushJobToSupabase(updated);
      }
      setState((prev) => ({
        ...prev,
        jobs: nextJobs,
        logs: [logEntry, ...prev.logs],
      }));
      showToast(`Job listing "${updates.titleEn}" updated.`);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Unable to update job listing.';
    }
  };

  const handleDeleteEmployerJob = (jobId: string) => {
    try {
      const existing = state.jobs.find((j) => j.id === jobId);
      const nextJobs = deleteEmployerJobListing(state.jobs, currentUser, jobId);
      const logEntry = {
        id: `log-${Date.now()}-deljob`,
        userEmail: currentUser?.email || 'employer',
        actionType: 'EMPLOYER_DELETE_JOB',
        details: `Removed job listing "${existing?.titleEn || jobId}".`,
        createdAt: new Date().toISOString(),
      };
      void deleteJobFromSupabase(jobId);
      setState((prev) => ({
        ...prev,
        jobs: nextJobs,
        logs: [logEntry, ...prev.logs],
      }));
      showToast(`Job listing "${existing?.titleEn || jobId}" removed.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete job listing.', true);
    }
  };

  const handleSetUserStatus = (email: string, status: AccountStatus) => {
    try {
      const nextUsers = adminUpdateAccountStatus(state.users, currentUser, email, status);
      const updatedUser = nextUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
      const logEntry = {
        id: `log-${Date.now()}`,
        userEmail: currentUser?.email || 'admin@tatari.et',
        actionType: status === 'approved' ? 'APPROVE_USER_ACCOUNT' : 'SUSPEND_USER_ACCOUNT',
        details: `Set account ${email} status to ${status}.`,
        createdAt: new Date().toISOString(),
      };
      if (updatedUser) {
        void pushUserProfileAndAuditToSupabase(updatedUser, logEntry);
      }
      setState((prev) => ({
        ...prev,
        users: nextUsers,
        currentUserEmail:
          status === 'suspended' &&
          prev.currentUserEmail.toLowerCase() === email.toLowerCase()
            ? ''
            : prev.currentUserEmail,
        logs: [logEntry, ...prev.logs],
      }));
      showToast(`User ${email} marked as ${status}.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unauthorized user update.', true);
    }
  };

  const handleAdminCreateUser = (input: AdminCreateUserInput): string | null => {
    try {
      const { users: nextUsers, createdUser } = adminCreateUserAccount(
        state.users,
        currentUser,
        input
      );
      const logEntry = {
        id: `log-${Date.now()}-cuser`,
        userEmail: currentUser?.email || 'admin@tatari.et',
        actionType: 'ADMIN_CREATE_USER',
        details: `Provisioned ${createdUser.role.toUpperCase()} account ${createdUser.email} (${createdUser.status}).`,
        createdAt: new Date().toISOString(),
      };
      void pushUserProfileAndAuditToSupabase(createdUser, logEntry);
      setState((prev) => ({
        ...prev,
        users: nextUsers,
        logs: [logEntry, ...prev.logs],
      }));
      showToast(`Account created for ${createdUser.fullName} (${createdUser.email}).`);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Unable to create user account.';
    }
  };

  const handleAdminUpdateUserRole = (email: string, nextRole: UserRole): string | null => {
    try {
      const nextUsers = adminUpdateUserRole(state.users, currentUser, email, nextRole);
      const updatedUser = nextUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
      const logEntry = {
        id: `log-${Date.now()}-role`,
        userEmail: currentUser?.email || 'admin@tatari.et',
        actionType: 'ADMIN_UPDATE_ROLE',
        details: `Changed role for ${email} to ${nextRole.toUpperCase()}.`,
        createdAt: new Date().toISOString(),
      };
      if (updatedUser) {
        void pushUserProfileAndAuditToSupabase(updatedUser, logEntry);
      }
      setState((prev) => ({
        ...prev,
        users: nextUsers,
        logs: [logEntry, ...prev.logs],
      }));
      showToast(`Role updated for ${email} (${nextRole.toUpperCase()}).`);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Unable to update user role.';
    }
  };

  const handleAdminResetUserPassword = (
    email: string,
    newPassword: string,
    confirmPassword: string
  ): string | null => {
    try {
      const nextUsers = adminResetUserPassword(
        state.users,
        currentUser,
        email,
        newPassword,
        confirmPassword
      );
      const updatedUser = nextUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
      const logEntry = {
        id: `log-${Date.now()}-rpwd`,
        userEmail: currentUser?.email || 'admin@tatari.et',
        actionType: 'ADMIN_RESET_PASSWORD',
        details: `Administrator reset password hash for ${email}.`,
        createdAt: new Date().toISOString(),
      };
      if (updatedUser) {
        void pushUserProfileAndAuditToSupabase(updatedUser, logEntry);
      }
      setState((prev) => ({
        ...prev,
        users: nextUsers,
        logs: [logEntry, ...prev.logs],
      }));
      showToast(`Password securely reset for ${email}.`);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Unable to reset user password.';
    }
  };

  const handleAdminUpdateUser = (
    email: string,
    updates: AdminUserUpdateInput
  ): string | null => {
    try {
      const nextUsers = adminUpdateUserAccount(state.users, currentUser, email, updates);
      const updatedUser = nextUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
      const logEntry = {
        id: `log-${Date.now()}-uupd`,
        userEmail: currentUser?.email || 'admin@tatari.et',
        actionType: 'ADMIN_UPDATE_USER',
        details: `Updated user ${email}: ${updates.fullName}, role=${updates.role.toUpperCase()}, status=${updates.status}.`,
        createdAt: new Date().toISOString(),
      };
      if (updatedUser) {
        void pushUserProfileAndAuditToSupabase(updatedUser, logEntry);
      }
      setState((prev) => ({
        ...prev,
        users: nextUsers,
        currentUserEmail:
          updates.status === 'suspended' &&
          prev.currentUserEmail.toLowerCase() === email.toLowerCase()
            ? ''
            : prev.currentUserEmail,
        logs: [logEntry, ...prev.logs],
      }));
      showToast(`User account ${email} updated.`);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Unable to update user account.';
    }
  };

  const handleAdminDeleteUser = (email: string): string | null => {
    try {
      const nextUsers = adminDeleteUserAccount(state.users, currentUser, email);
      const logEntry = {
        id: `log-${Date.now()}-udel`,
        userEmail: currentUser?.email || 'admin@tatari.et',
        actionType: 'ADMIN_DELETE_USER',
        details: `Administrator permanently deleted user account ${email}.`,
        createdAt: new Date().toISOString(),
      };
      void deleteUserFromSupabase(email, logEntry);
      setState((prev) => ({
        ...prev,
        users: nextUsers,
        currentUserEmail:
          prev.currentUserEmail.toLowerCase() === email.toLowerCase()
            ? ''
            : prev.currentUserEmail,
        logs: [logEntry, ...prev.logs],
      }));
      showToast(`User account ${email} permanently deleted.`);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Unable to delete user account.';
    }
  };

  const handleUpdateOwnProfile = (updates: SelfProfileUpdateInput): string | null => {
    if (!currentUser) {
      return 'You must be signed in to update your profile.';
    }
    try {
      const nextUsers = updateOwnProfile(state.users, currentUser.email, updates);
      const updatedUser = nextUsers.find(
        (u) => u.email.toLowerCase() === currentUser.email.toLowerCase()
      );
      const logEntry = {
        id: `log-${Date.now()}-selfupd`,
        userEmail: currentUser.email,
        actionType: 'USER_UPDATE_PROFILE',
        details: `Updated own account profile (${updates.fullName}).`,
        createdAt: new Date().toISOString(),
      };
      if (updatedUser) {
        void pushUserProfileAndAuditToSupabase(updatedUser, logEntry);
      }
      setState((prev) => ({
        ...prev,
        users: nextUsers,
        logs: [logEntry, ...prev.logs],
      }));
      showToast('Profile information updated.');
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Unable to update profile.';
    }
  };

  const handleDeleteOwnAccount = (currentPassword: string): string | null => {
    if (!currentUser) {
      return 'You must be signed in to delete your account.';
    }
    const targetEmail = currentUser.email;
    try {
      const nextUsers = deleteOwnAccount(state.users, targetEmail, currentPassword);
      const logEntry = {
        id: `log-${Date.now()}-selfdel`,
        userEmail: targetEmail,
        actionType: 'USER_DELETE_OWN_ACCOUNT',
        details: `User permanently deleted their own account (${targetEmail}).`,
        createdAt: new Date().toISOString(),
      };
      void deleteUserFromSupabase(targetEmail, logEntry);
      setPendingProductAfterAuth(null);
      setState((prev) => ({
        ...prev,
        users: nextUsers,
        currentUserEmail: '',
        logs: [logEntry, ...prev.logs],
      }));
      showToast(`Account ${targetEmail} deleted permanently.`);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Unable to delete account.';
    }
  };

  const handleChangeOwnPassword = (
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
  ): string | null => {
    if (!currentUser) {
      return 'You must be signed in to change your password.';
    }
    try {
      const nextUsers = changeOwnPassword(
        state.users,
        currentUser.email,
        currentPassword,
        newPassword,
        confirmPassword
      );
      const updatedUser = nextUsers.find(
        (u) => u.email.toLowerCase() === currentUser.email.toLowerCase()
      );
      const logEntry = {
        id: `log-${Date.now()}-cpwd`,
        userEmail: currentUser.email,
        actionType: 'USER_CHANGE_PASSWORD',
        details: `User rotated account password securely.`,
        createdAt: new Date().toISOString(),
      };
      if (updatedUser) {
        void pushUserProfileAndAuditToSupabase(updatedUser, logEntry);
      }
      if (currentUser.role === 'admin' && adminBearerToken) {
        void fetch('/api/auth/admin-password', {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${adminBearerToken}`,
          },
          body: JSON.stringify({ email: currentUser.email, newPassword }),
        });
      }
      setState((prev) => ({
        ...prev,
        users: nextUsers,
        logs: [logEntry, ...prev.logs],
      }));
      showToast('Your password has been updated securely.');
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Unable to update password.';
    }
  };

  const handleSignIn = (email: string, password: string): string | null => {
    if (lockoutUntilMs > Date.now()) {
      return `Too many failed attempts. Try again in ${Math.ceil(
        (lockoutUntilMs - Date.now()) / 1000
      )}s.`;
    }

    const result = authenticateCredentials(state.users, email, password);
    const nowIso = new Date().toISOString();

    if (!result.user) {
      const nextFails = failedLoginCount + 1;
      setFailedLoginCount(nextFails);
      if (nextFails >= 5) {
        setLockoutUntilMs(Date.now() + 60_000);
        setNowMs(Date.now());
      }
      const failLog = {
        id: `log-${Date.now()}-fail`,
        userEmail: email.trim().toLowerCase() || 'unknown',
        actionType: nextFails >= 5 ? 'AUTH_LOCKOUT' : 'LOGIN_FAILED',
        details: `Failed sign-in attempt (${nextFails}/5).`,
        createdAt: nowIso,
      };
      setState((prev) => ({ ...prev, logs: [failLog, ...prev.logs] }));
      return result.error || 'Invalid credentials.';
    }

    setFailedLoginCount(0);
    setLockoutUntilMs(0);
    const signedInUser = result.user;
    const loginLog = {
      id: `log-${Date.now()}-login`,
      userEmail: signedInUser.email,
      actionType: 'LOGIN_SUCCESS',
      details: `Authenticated as ${signedInUser.role.toUpperCase()} (${signedInUser.status}).`,
      createdAt: nowIso,
    };

    setState((prev) => ({
      ...prev,
      currentUserEmail: signedInUser.email,
      users: prev.users.map((u) =>
        u.email.toLowerCase() === signedInUser.email.toLowerCase()
          ? { ...u, lastLoginAt: nowIso }
          : u
      ),
      logs: [loginLog, ...prev.logs],
    }));

    if (signedInUser.role === 'admin' && signedInUser.status === 'approved') {
      void (async () => {
        try {
          const authRes = await fetch('/api/auth/admin-session', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email: signedInUser.email, password }),
          });
          if (authRes.ok) {
            const authData = (await authRes.json()) as { token?: string };
            if (authData.token) {
              setAdminBearerToken(authData.token);
              void refreshAggregatorOverview(authData.token);
            }
          }
        } catch {
          // Non-blocking fallback
        }
      })();
    } else {
      setAdminBearerToken(null);
      setAggregatorOverview(null);
    }

    if (pendingProductAfterAuth) {
      setCheckoutProduct(pendingProductAfterAuth);
      setPendingProductAfterAuth(null);
    }
    showToast(`Signed in securely as ${signedInUser.fullName}.`);
    return null;
  };

  const handleSignOut = () => {
    const actor = currentUser?.email || 'guest';
    setPendingProductAfterAuth(null);
    setAdminBearerToken(null);
    setAggregatorOverview(null);
    setState((prev) => ({
      ...prev,
      currentUserEmail: '',
      logs: [
        {
          id: `log-${Date.now()}-logout`,
          userEmail: actor,
          actionType: 'LOGOUT',
          details: `Signed out from ${actor}.`,
          createdAt: new Date().toISOString(),
        },
        ...prev.logs,
      ],
    }));
    showToast('You have signed out.');
  };

  const handleRegister = (userInput: {
    email: string;
    fullName: string;
    companyName?: string;
    tinNumber?: string;
    phone: string;
    role: 'seeker' | 'employer';
    password: string;
    confirmPassword: string;
  }): string | null => {
    try {
      const newProfile = registerVerifiedRoleAccount(state.users, userInput.role, userInput);
      const regLog = {
        id: `log-${Date.now()}-reg`,
        userEmail: newProfile.email,
        actionType:
          newProfile.role === 'employer' ? 'REGISTER_EMPLOYER' : 'REGISTER_SEEKER',
        details:
          newProfile.role === 'employer'
            ? `Registered Employer "${newProfile.companyName}" (TIN: ${newProfile.tinNumber}) — pending Admin verification.`
            : `Registered Job Seeker & Digital Store account.`,
        createdAt: new Date().toISOString(),
      };

      void pushUserProfileAndAuditToSupabase(newProfile, regLog);

      setState((prev) => ({
        ...prev,
        users: [...prev.users, newProfile],
        currentUserEmail: newProfile.email,
        logs: [regLog, ...prev.logs],
      }));

      if (pendingProductAfterAuth) {
        setCheckoutProduct(pendingProductAfterAuth);
        setPendingProductAfterAuth(null);
      }

      showToast(
        newProfile.role === 'employer'
          ? 'Employer registered. Awaiting Administrator verification before posting jobs.'
          : `Account registered and signed in as ${newProfile.email}.`
      );
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Unable to register account.';
    }
  };

  const handleExportCsv = () => {
    if (!canAccessActivity(currentUser, 'admin_console').allowed) {
      showToast('Administrator authentication required.', true);
      return;
    }
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

  const handleSubmitTrainingRequest = (input: CreateTrainingRequestInput): string | null => {
    try {
      const created = createTailoredTrainingRequest(state.trainingPrograms, currentUser, input);
      const logEntry = {
        id: `log-${Date.now()}-trnreq`,
        userEmail: created.requesterEmail,
        actionType: 'TRAINING_REQUEST_SUBMITTED',
        details: `Requested tailored "${created.programTitle}" for ${created.organizationName} (${created.teamSize} participants, ETB ${created.estimatedFeeEtb}).`,
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        trainingRequests: [created, ...prev.trainingRequests],
        logs: [logEntry, ...prev.logs],
      }));
      showToast(`Tailored training proposal submitted for ${created.organizationName}.`);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Unable to submit training request.';
    }
  };

  const handleUpdateTrainingRequestStatus = (
    requestId: string,
    updates: {
      status: TrainingProposalStatus;
      trainerAssigned?: string;
      estimatedFeeEtb?: number;
      proposalNotes?: string;
    }
  ): string | null => {
    try {
      const nextRequests = adminUpdateTrainingRequestStatus(
        state.trainingRequests,
        currentUser,
        requestId,
        updates
      );
      const target = nextRequests.find((r) => r.id === requestId);
      const logEntry = {
        id: `log-${Date.now()}-trnevt`,
        userEmail: currentUser?.email || 'admin@tatari.et',
        actionType: 'ADMIN_UPDATE_TRAINING_PROPOSAL',
        details: `Updated training proposal for "${target?.organizationName || requestId}" to ${updates.status}.`,
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        trainingRequests: nextRequests,
        logs: [logEntry, ...prev.logs],
      }));
      showToast(`Training proposal updated to ${updates.status}.`);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Unable to update training proposal.';
    }
  };

  const handleCreateTrainingProgram = (input: TrainingProgramInput): string | null => {
    try {
      const { programs: nextPrograms, created } = adminCreateTrainingProgram(
        state.trainingPrograms,
        currentUser,
        input
      );
      const logEntry = {
        id: `log-${Date.now()}-trnadd`,
        userEmail: currentUser?.email || 'admin@tatari.et',
        actionType: 'ADMIN_CREATE_TRAINING_PROGRAM',
        details: `Published training track "${created.titleEn}" (ETB ${created.feePerCohortEtb}).`,
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        trainingPrograms: nextPrograms,
        logs: [logEntry, ...prev.logs],
      }));
      showToast(`Training track "${created.titleEn}" published to TATARI Academy.`);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Unable to add training track.';
    }
  };

  const handleUpdateTrainingProgram = (
    programId: string,
    updates: TrainingProgramInput
  ): string | null => {
    try {
      const nextPrograms = adminUpdateTrainingProgram(
        state.trainingPrograms,
        currentUser,
        programId,
        updates
      );
      const logEntry = {
        id: `log-${Date.now()}-trnupd`,
        userEmail: currentUser?.email || 'admin@tatari.et',
        actionType: 'ADMIN_UPDATE_TRAINING_PROGRAM',
        details: `Updated training track "${updates.titleEn}".`,
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        trainingPrograms: nextPrograms,
        logs: [logEntry, ...prev.logs],
      }));
      showToast(`Training track "${updates.titleEn}" updated.`);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Unable to update training track.';
    }
  };

  const handleDeleteTrainingProgram = (programId: string): string | null => {
    try {
      const existing = state.trainingPrograms.find((p) => p.id === programId);
      const nextPrograms = adminDeleteTrainingProgram(
        state.trainingPrograms,
        currentUser,
        programId
      );
      const logEntry = {
        id: `log-${Date.now()}-trndel`,
        userEmail: currentUser?.email || 'admin@tatari.et',
        actionType: 'ADMIN_DELETE_TRAINING_PROGRAM',
        details: `Deleted training track "${existing?.titleEn || programId}".`,
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        trainingPrograms: nextPrograms,
        logs: [logEntry, ...prev.logs],
      }));
      showToast(`Training track "${existing?.titleEn || programId}" deleted.`);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Unable to delete training track.';
    }
  };

  const handleToggleTrainingProgramActive = (programId: string) => {
    if (!canAccessActivity(currentUser, 'admin_console').allowed) {
      showToast('Administrator authentication required.', true);
      return;
    }
    setState((prev) => ({
      ...prev,
      trainingPrograms: prev.trainingPrograms.map((p) =>
        p.id === programId ? { ...p, active: !p.active } : p
      ),
    }));
  };

  const handleDownloadTrainingProposal = (request: TrainingRequest) => {
    const program = state.trainingPrograms.find((p) => p.id === request.programId);
    const file = buildTrainingProposalHtml(request, program);
    const blob = new Blob([file.content], { type: file.mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast(`Tailored proposal ${file.filename} downloaded.`);
  };

  const handleTriggerAggregatorSync = async (
    scope: 'all' | 'jobs' | 'fx' | 'opportunities' | 'single',
    sourceId?: string
  ) => {
    if (!isAdmin || !adminBearerToken) {
      showToast('Administrator authentication required.', true);
      return;
    }
    setIsSyncingAggregator(true);
    try {
      const res = await fetch('/api/aggregator/sync', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${adminBearerToken}`,
        },
        body: JSON.stringify({ scope, sourceId }),
      });
      if (!res.ok) {
        throw new Error(`Sync failed (${res.status})`);
      }
      const data = (await res.json()) as { ok: boolean; overview?: AggregatorOverviewResponse };
      if (data.overview) setAggregatorOverview(data.overview);

      if (scope === 'all' || scope === 'jobs') await syncExternalJobs(false, false);
      if (scope === 'all' || scope === 'fx') await fetchFxRates(false, false);
      if (scope === 'all' || scope === 'opportunities' || scope === 'single') {
        await fetchOpportunities(false, false);
      }
      await refreshAggregatorOverview();
      showToast('Live Ethiopian source collection completed.');
    } catch {
      showToast('Aggregator sync failed for one or more sources.', true);
    } finally {
      setIsSyncingAggregator(false);
    }
  };

  const handleAddCustomSource = async (payload: {
    name: string;
    url: string;
    feedUrl: string;
    module: OpportunityModuleType;
    method: 'wp_rest_json' | 'rss_xml';
  }): Promise<string | null> => {
    if (!isAdmin || !adminBearerToken) {
      return 'Administrator authentication required.';
    }
    try {
      const res = await fetch('/api/aggregator/sources', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${adminBearerToken}`,
        },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        error?: string;
        itemsAdded?: number;
        overview?: AggregatorOverviewResponse;
      };
      if (!res.ok) {
        return data.error || `Failed to register source (HTTP ${res.status}).`;
      }
      if (data.overview) setAggregatorOverview(data.overview);
      await fetchOpportunities(false, false);
      await refreshAggregatorOverview();
      showToast(
        `Registered source "${payload.name}" (${data.itemsAdded ?? 0} verified items collected).`
      );
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Unable to register custom source.';
    }
  };

  const handleToggleSourceActive = async (sourceId: string, nextActive: boolean) => {
    if (!isAdmin || !adminBearerToken) {
      showToast('Administrator authentication required.', true);
      return;
    }
    try {
      const res = await fetch(`/api/aggregator/sources/${encodeURIComponent(sourceId)}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${adminBearerToken}`,
        },
        body: JSON.stringify({ active: nextActive }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { overview?: AggregatorOverviewResponse };
      if (data.overview) setAggregatorOverview(data.overview);
      await fetchOpportunities(false, false);
      showToast(`Source ${nextActive ? 'activated' : 'paused'}.`);
    } catch {
      showToast('Unable to update source state.', true);
    }
  };

  const handleReviewFxRate = async (
    rateId: string,
    buyingRate: number | null,
    sellingRate: number | null
  ) => {
    if (!isAdmin || !adminBearerToken) {
      showToast('Administrator authentication required.', true);
      return;
    }
    try {
      const res = await fetch(`/api/aggregator/fx/${encodeURIComponent(rateId)}/review`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${adminBearerToken}`,
        },
        body: JSON.stringify({ buyingRate, sellingRate }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { ok: boolean; rate?: BankFxApiResponse['rates'][number] };
      if (data.rate) {
        setFxData((prev) =>
          prev
            ? {
                ...prev,
                rates: prev.rates.map((r) => (r.id === rateId ? data.rate! : r)),
              }
            : prev
        );
      }
      await refreshAggregatorOverview();
      showToast('FX rate verified and anomaly cleared.');
    } catch {
      showToast('Failed to review FX rate.', true);
    }
  };

  const handleVerifyOpportunity = async (
    oppId: string,
    updates: { title: string; organization: string; deadline: string }
  ) => {
    if (!isAdmin || !adminBearerToken) {
      showToast('Administrator authentication required.', true);
      return;
    }
    try {
      const res = await fetch(`/api/aggregator/listings/${encodeURIComponent(oppId)}/verify`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${adminBearerToken}`,
        },
        body: JSON.stringify(updates),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { ok: boolean; item?: AggregatedOpportunity };
      if (data.item) {
        setOppData((prev) =>
          prev
            ? {
                ...prev,
                items: prev.items.map((o) => (o.id === oppId ? data.item! : o)),
              }
            : prev
        );
      }
      await refreshAggregatorOverview();
      showToast('Listing verified with original source preservation.');
    } catch {
      showToast('Failed to verify aggregated listing.', true);
    }
  };

  const navigateView = (view: AppView) => {
    if (view === 'admin' && !isAdmin) {
      showToast('Administrator console is restricted to authorized administrators.', true);
      return;
    }
    if (view !== 'admin') {
      setAdminRequestedTab(undefined);
    }
    setActiveView(view);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  };

  const openAdminSourcesPanel = () => {
    if (!isAdmin) return;
    setAdminRequestedTab('sources');
    navigateView('admin');
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F8FA] text-slate-900">
      <Header
        activeView={activeView}
        onNavigate={navigateView}
        currentUser={currentUser}
        pendingApprovalCount={pendingApprovalCount}
        language={state.language}
        onOpenAuth={() => openAuthModal({ mode: currentUser ? 'profile' : 'signin' })}
        onOpenHelp={() => setHelpModalOpen(true)}
      />

      <div className="flex-1">
        {activeView === 'jobs' && (
          <JobBoardView
            jobs={state.jobs}
            savedJobIds={currentSavedJobIds}
            applications={state.applications}
            currentUserEmail={state.currentUserEmail}
            language={state.language}
            externalSources={externalSources}
            isSyncingExternal={isSyncingExternal}
            lastExternalSyncAt={lastExternalSyncAt}
            externalSyncError={externalJobsError}
            onSyncExternalJobs={() => void syncExternalJobs(true, true)}
            onToggleLanguage={handleToggleLanguage}
            onToggleSaveJob={handleToggleSaveJob}
            onOpenApplyModal={(job) => setApplyModalJob(job)}
            onNavigateEmployer={() => setActiveView('employer')}
          />
        )}

        {activeView === 'fx' && (
          <BankFxDashboardView
            rates={fxData?.rates || []}
            history={fxData?.history || []}
            bankStatuses={fxData?.bankStatuses || []}
            nbeIndicativeMid={fxData?.nbeIndicativeMid || null}
            syncedAt={fxData?.syncedAt || null}
            isSyncing={isSyncingFx}
            isAdmin={isAdmin}
            errorMessage={fxError}
            onRefresh={() => void fetchFxRates(true, true)}
            onOpenAdminSources={openAdminSourcesPanel}
          />
        )}

        {activeView === 'opportunities' && (
          <OpportunitiesHubView
            opportunities={oppData?.items || []}
            sources={oppData?.sources || aggregatorOverview?.opportunitySources || []}
            jobs={state.jobs}
            fxRates={fxData?.rates || []}
            trainingPrograms={state.trainingPrograms}
            products={state.products}
            savedOpportunityIds={currentSavedOpportunityIds}
            syncedAt={oppData?.syncedAt || null}
            isSyncing={isSyncingOpp}
            isAdmin={isAdmin}
            errorMessage={oppError}
            onRefresh={() => void fetchOpportunities(true, true)}
            onToggleSaveOpportunity={handleToggleSaveOpportunity}
            onNavigateView={navigateView}
            onOpenAdminSources={openAdminSourcesPanel}
          />
        )}

        {activeView === 'training' && (
          <TrainingServicesView
            programs={state.trainingPrograms}
            requests={state.trainingRequests}
            externalCourses={(oppData?.items || []).filter(
              (o) => o.module === 'training_external' || o.module === 'scholarships'
            )}
            currentUser={currentUser}
            language={state.language}
            onToggleLanguage={handleToggleLanguage}
            onSubmitTrainingRequest={handleSubmitTrainingRequest}
            onDownloadProposal={handleDownloadTrainingProposal}
            onRequireAuth={() =>
              openAuthModal({
                mode: 'signup',
                role: 'employer',
                notice:
                  'Sign in or register an organization/user account to submit a tailored training request.',
              })
            }
          />
        )}

        {activeView === 'store' && (
          <DigitalStoreView
            products={state.products}
            orders={state.orders}
            reviews={state.reviews}
            currentUserEmail={state.currentUserEmail}
            language={state.language}
            onBuyProduct={handleRequestBuyProduct}
            onDownloadMaterial={handleDownloadMaterial}
            onSubmitProductReview={handleSubmitProductReview}
          />
        )}

        {activeView === 'activity' && (
          <MyActivityView
            currentUserEmail={state.currentUserEmail}
            jobs={state.jobs}
            savedJobIds={currentSavedJobIds}
            opportunities={oppData?.items || []}
            savedOpportunityIds={currentSavedOpportunityIds}
            applications={state.applications}
            orders={state.orders}
            products={state.products}
            receipts={state.receipts}
            trainingRequests={state.trainingRequests}
            onToggleSaveJob={handleToggleSaveJob}
            onToggleSaveOpportunity={handleToggleSaveOpportunity}
            onApplyJob={(job) => setApplyModalJob(job)}
            onDownloadMaterial={handleDownloadMaterial}
            onDownloadInvoice={handleDownloadInvoice}
            onDownloadTrainingProposal={handleDownloadTrainingProposal}
            onBrowseJobs={() => navigateView('jobs')}
            onBrowseOpportunities={() => navigateView('opportunities')}
            onBrowseStore={() => navigateView('store')}
            onBrowseTraining={() => navigateView('training')}
            onRequireAuth={() =>
              openAuthModal({
                mode: 'signin',
                notice:
                  'Sign in or register to view saved jobs, application status, and digital store downloads.',
              })
            }
          />
        )}

        {activeView === 'employer' && (
          <EmployerHubView
            currentUser={currentUser}
            jobs={state.jobs}
            applications={state.applications}
            receipts={state.receipts}
            onSubmitJobWithPayment={handleSubmitJobWithPayment}
            onUpdateJob={handleUpdateEmployerJob}
            onDeleteJob={handleDeleteEmployerJob}
            onUpdateApplicationStage={handleUpdateApplicationStage}
            onToggleJobActiveStatus={handleEmployerToggleJobPause}
            onDownloadInvoice={handleDownloadInvoice}
            onRequireAuth={(opts) => openAuthModal(opts)}
          />
        )}

        {activeView === 'admin' && isAdmin && (
          <AdminConsoleView
            currentUser={currentUser}
            receipts={state.receipts}
            jobs={state.jobs}
            products={state.products}
            applications={state.applications}
            orders={state.orders}
            users={state.users}
            logs={state.logs}
            trainingPrograms={state.trainingPrograms}
            trainingRequests={state.trainingRequests}
            externalSources={externalSources}
            isSyncingExternal={isSyncingExternal}
            lastExternalSyncAt={lastExternalSyncAt}
            aggregatorOverview={aggregatorOverview}
            fxRates={fxData?.rates || []}
            opportunities={oppData?.items || []}
            isSyncingAggregator={isSyncingAggregator}
            requestedTab={adminRequestedTab}
            onSyncExternalJobs={() => void syncExternalJobs(true, true)}
            onTriggerAggregatorSync={handleTriggerAggregatorSync}
            onAddCustomSource={handleAddCustomSource}
            onToggleSourceActive={handleToggleSourceActive}
            onReviewFxRate={handleReviewFxRate}
            onVerifyOpportunity={handleVerifyOpportunity}
            onApproveReceipt={handleApproveReceipt}
            onRejectReceipt={handleRejectReceipt}
            onSetJobStatus={handleSetJobStatus}
            onToggleProductActive={handleToggleProductActive}
            onOpenAddProduct={() => {
              setEditingProduct(null);
              setAddProductModalOpen(true);
            }}
            onOpenEditProduct={(prod) => {
              setEditingProduct(prod);
              setAddProductModalOpen(true);
            }}
            onDeleteProduct={handleDeleteProduct}
            onSetUserStatus={handleSetUserStatus}
            onCreateUser={handleAdminCreateUser}
            onUpdateUser={handleAdminUpdateUser}
            onDeleteUser={handleAdminDeleteUser}
            onUpdateUserRole={handleAdminUpdateUserRole}
            onResetUserPassword={handleAdminResetUserPassword}
            onCreateTrainingProgram={handleCreateTrainingProgram}
            onUpdateTrainingProgram={handleUpdateTrainingProgram}
            onDeleteTrainingProgram={handleDeleteTrainingProgram}
            onToggleTrainingProgramActive={handleToggleTrainingProgramActive}
            onUpdateTrainingRequestStatus={handleUpdateTrainingRequestStatus}
            onDownloadTrainingProposal={handleDownloadTrainingProposal}
            onDownloadInvoice={handleDownloadInvoice}
            onExportCsv={handleExportCsv}
            onOpenAdminSignIn={() =>
              openAuthModal({
                mode: 'signin',
                notice:
                  'Sign in with Administrator credentials to access payment approvals and user governance.',
              })
            }
          />
        )}
      </div>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="font-display text-sm font-extrabold text-[#10243B]">TATARI</span>
            <span aria-hidden="true">·</span>
            <span>Addis Ababa, Ethiopia · Ethiopian Opportunity, FX, Training &amp; Store</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-5">
            <button
              type="button"
              onClick={() => navigateView('jobs')}
              className="hover:text-slate-900"
            >
              Find Jobs
            </button>
            <button
              type="button"
              onClick={() => navigateView('fx')}
              className="hover:text-slate-900"
            >
              Bank FX
            </button>
            <button
              type="button"
              onClick={() => navigateView('opportunities')}
              className="hover:text-slate-900"
            >
              Opportunities
            </button>
            <button
              type="button"
              onClick={() => navigateView('training')}
              className="hover:text-slate-900"
            >
              Training Services
            </button>
            <button
              type="button"
              onClick={() => navigateView('store')}
              className="hover:text-slate-900"
            >
              Digital Store
            </button>
            <button
              type="button"
              onClick={() => navigateView('employer')}
              className="hover:text-slate-900"
            >
              Post a Job
            </button>
            <button
              type="button"
              onClick={() => setHelpModalOpen(true)}
              className="font-semibold text-[#164081] hover:underline"
            >
              Help Center
            </button>
            {isAdmin && (
              <a
                href="/TATARI_Implementation_and_Administration_Guide.docx"
                download="TATARI_Implementation_and_Administration_Guide.docx"
                className="hover:text-slate-900 hover:underline"
              >
                Admin Guide (.docx)
              </a>
            )}
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
          onOpenSignIn={() =>
            openAuthModal({
              mode: 'signin',
              notice: 'Sign in with your Job Seeker account to apply with your saved profile.',
            })
          }
          onSubmit={handleSubmitApplication}
        />
      )}

      {checkoutProduct && currentUser && (
        <PaymentCheckoutModal
          product={checkoutProduct}
          currentUser={currentUser}
          onClose={() => setCheckoutProduct(null)}
          onSubmitPayment={handleBuyProductWithReceipt}
        />
      )}

      {authConfig.open && (
        <AuthModal
          currentUser={currentUser}
          initialMode={authConfig.mode}
          initialRole={authConfig.role}
          contextNotice={authConfig.notice}
          lockoutSecondsRemaining={lockoutSecondsRemaining}
          onClose={() => {
            setAuthConfig((prev) => ({ ...prev, open: false }));
            setPendingProductAfterAuth(null);
          }}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
          onRegister={handleRegister}
          onChangePassword={handleChangeOwnPassword}
          onUpdateProfile={handleUpdateOwnProfile}
          onDeleteOwnAccount={handleDeleteOwnAccount}
        />
      )}

      {addProductModalOpen && (
        <AddProductModal
          editingProduct={editingProduct}
          onClose={() => {
            setAddProductModalOpen(false);
            setEditingProduct(null);
          }}
          onAddProduct={handleAddProduct}
          onUpdateProduct={handleUpdateProduct}
        />
      )}

      {helpModalOpen && (
        <HelpModal
          currentUser={currentUser}
          language={state.language}
          onClose={() => setHelpModalOpen(false)}
          onNavigate={navigateView}
          onOpenAuth={(mode, role) => openAuthModal({ mode, role })}
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
