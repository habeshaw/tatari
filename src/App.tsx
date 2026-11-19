/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { AdminConsoleView } from './components/AdminConsoleView';
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
import {
  getInitialPlatformState,
  persistPlatformState,
  pushReceiptAndAuditToSupabase,
  pushUserProfileAndAuditToSupabase,
  syncWithSupabaseIfAvailable,
  type PlatformState,
} from './lib/repository';
import {
  adminCreateUserAccount,
  adminResetUserPassword,
  adminUpdateAccountStatus,
  adminUpdateUserRole,
  authenticateCredentials,
  canAccessActivity,
  changeOwnPassword,
  registerSeekerAndCreateApplication,
  registerVerifiedRoleAccount,
  type AdminCreateUserInput,
} from './lib/security';
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
  JobListing,
  JobModerationStatus,
  Language,
  MaterialOrder,
  UserRole,
} from './types/domain';

interface AuthModalConfig {
  open: boolean;
  mode: 'signin' | 'signup' | 'password';
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
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [failedLoginCount, setFailedLoginCount] = useState(0);
  const [lockoutUntilMs, setLockoutUntilMs] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
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
    state.currentUserEmail
      ? state.users.find(
          (u) => u.email.toLowerCase() === state.currentUserEmail.toLowerCase()
        ) || null
      : null;

  const currentSavedJobIds = currentUser
    ? state.savedJobIdsByUser[currentUser.email.toLowerCase()] || []
    : [];

  const pendingApprovalCount =
    currentUser?.role === 'admin'
      ? state.receipts.filter((r) => r.status === 'pending_verification').length
      : 0;

  const lockoutSecondsRemaining = Math.max(0, Math.ceil((lockoutUntilMs - nowMs) / 1000));

  const openAuthModal = (options?: {
    mode?: 'signin' | 'signup' | 'password';
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
      const result = registerSeekerAndCreateApplication(state.users, currentUser, payload);
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
  ) => {
    const access = canAccessActivity(currentUser, 'store_checkout');
    if (!access.allowed || !currentUser) {
      showToast('Please register and sign in before submitting payment.', true);
      return;
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

  const handleSubmitJobWithPayment = (
    draft: JobDraftInput,
    payment: PaymentSubmissionInput
  ) => {
    const access = canAccessActivity(currentUser, 'employer_hub');
    if (!access.allowed || !currentUser) {
      showToast(access.reason || 'Verified Employer account required.', true);
      return;
    }

    const { job, receipt } = createJobPostingWithPayment(
      { ...draft, employerEmail: currentUser.email },
      { ...payment, payerEmail: currentUser.email }
    );
    const logEntry = {
      id: `log-${Date.now()}`,
      userEmail: currentUser.email,
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
    setState((prev) => ({
      ...prev,
      applications: prev.applications.map((a) =>
        a.id === appId ? { ...a, status: stage } : a
      ),
    }));
    showToast(`Candidate stage updated to ${stage}.`);
  };

  const handleSetJobStatus = (jobId: string, status: JobModerationStatus) => {
    if (!canAccessActivity(currentUser, 'admin_console').allowed) {
      showToast('Administrator authentication required.', true);
      return;
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

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F8FA] text-slate-900">
      <Header
        activeView={activeView}
        onNavigate={setActiveView}
        currentUser={currentUser}
        pendingApprovalCount={pendingApprovalCount}
        language={state.language}
        onOpenAuth={() => openAuthModal({ mode: 'signin' })}
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
            onBuyProduct={handleRequestBuyProduct}
            onDownloadMaterial={handleDownloadMaterial}
          />
        )}

        {activeView === 'activity' && (
          <MyActivityView
            currentUserEmail={state.currentUserEmail}
            jobs={state.jobs}
            savedJobIds={currentSavedJobIds}
            applications={state.applications}
            orders={state.orders}
            products={state.products}
            receipts={state.receipts}
            onToggleSaveJob={handleToggleSaveJob}
            onApplyJob={(job) => setApplyModalJob(job)}
            onDownloadMaterial={handleDownloadMaterial}
            onBrowseJobs={() => setActiveView('jobs')}
            onBrowseStore={() => setActiveView('store')}
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
            onUpdateApplicationStage={handleUpdateApplicationStage}
            onRequireAuth={(opts) => openAuthModal(opts)}
          />
        )}

        {activeView === 'admin' && (
          <AdminConsoleView
            currentUser={currentUser}
            receipts={state.receipts}
            jobs={state.jobs}
            products={state.products}
            applications={state.applications}
            orders={state.orders}
            users={state.users}
            logs={state.logs}
            onApproveReceipt={handleApproveReceipt}
            onRejectReceipt={handleRejectReceipt}
            onSetJobStatus={handleSetJobStatus}
            onToggleProductActive={handleToggleProductActive}
            onOpenAddProduct={() => setAddProductModalOpen(true)}
            onSetUserStatus={handleSetUserStatus}
            onCreateUser={handleAdminCreateUser}
            onUpdateUserRole={handleAdminUpdateUserRole}
            onResetUserPassword={handleAdminResetUserPassword}
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
            <span>Addis Ababa, Ethiopia · Job Portal &amp; Digital Store</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-5">
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
            <button
              type="button"
              onClick={() => setHelpModalOpen(true)}
              className="font-semibold text-[#164081] hover:underline"
            >
              Help Center
            </button>
            <a
              href="/TATARI_Implementation_and_Administration_Guide.docx"
              download="TATARI_Implementation_and_Administration_Guide.docx"
              className="hover:text-slate-900 hover:underline"
            >
              Admin Guide (.docx)
            </a>
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
        />
      )}

      {addProductModalOpen && (
        <AddProductModal
          onClose={() => setAddProductModalOpen(false)}
          onAddProduct={handleAddProduct}
        />
      )}

      {helpModalOpen && (
        <HelpModal
          currentUser={currentUser}
          language={state.language}
          onClose={() => setHelpModalOpen(false)}
          onNavigate={setActiveView}
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
