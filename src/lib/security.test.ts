import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adminCreateUserAccount,
  adminResetUserPassword,
  adminUpdateAccountStatus,
  adminUpdateUserRole,
  authenticateCredentials,
  canAccessActivity,
  changeOwnPassword,
  filterUsersForAdmin,
  hashUserPassword,
  registerSeekerAndCreateApplication,
  registerVerifiedRoleAccount,
  verifyUserPassword,
} from './security';
import { SEED_JOBS, SEED_USERS } from '../data/seedData';

test('password hashing verifies matching credentials and rejects wrong passwords', () => {
  const admin = SEED_USERS.find((u) => u.email === 'admin@tatari.et')!;
  assert.equal(verifyUserPassword(admin, 'TatariAdmin#2026'), true);
  assert.equal(verifyUserPassword(admin, 'wrong-password'), false);
  assert.notEqual(
    hashUserPassword('user1@tatari.et', 'Secret123'),
    hashUserPassword('user2@tatari.et', 'Secret123')
  );
});

test('unauthenticated guest can browse and apply to jobs, but is blocked from all other activities', () => {
  assert.equal(canAccessActivity(null, 'browse_jobs').allowed, true);
  assert.equal(canAccessActivity(null, 'apply_job').allowed, true);
  assert.equal(canAccessActivity(null, 'save_job').allowed, false);
  assert.equal(canAccessActivity(null, 'store_checkout').allowed, false);
  assert.equal(canAccessActivity(null, 'my_activity').allowed, false);
  assert.equal(canAccessActivity(null, 'employer_hub').allowed, false);
  assert.equal(canAccessActivity(null, 'admin_console').allowed, false);
});

test('job seeker is registered automatically while applying for a specific job', () => {
  const result = registerSeekerAndCreateApplication(SEED_USERS, null, {
    job: SEED_JOBS[0],
    applicantName: 'Dawit Tesfaye',
    applicantEmail: 'dawit.new@tatari.et',
    phone: '+251911778899',
    resumeUrl: 'https://drive.google.com/dawit-cv',
    yearsExperience: '3-5 years',
    coverNote: 'Strong Excel and payroll background.',
    password: 'SeekerPass123',
    confirmPassword: 'SeekerPass123',
  });

  assert.ok(result.newUser);
  assert.equal(result.newUser.role, 'seeker');
  assert.equal(result.newUser.status, 'approved');
  assert.equal(verifyUserPassword(result.newUser, 'SeekerPass123'), true);
  assert.equal(result.application.applicantEmail, 'dawit.new@tatari.et');
  assert.equal(result.application.jobId, SEED_JOBS[0].id);

  // Duplicate email during guest apply must prompt sign-in rather than hijacking account
  assert.throws(() =>
    registerSeekerAndCreateApplication(SEED_USERS, null, {
      job: SEED_JOBS[0],
      applicantName: 'Imposter',
      applicantEmail: 'abebe@tatari.et',
      phone: '+251911000000',
      resumeUrl: 'https://drive.google.com/cv',
      yearsExperience: '1-3 years',
      coverNote: '',
      password: 'Password123',
      confirmPassword: 'Password123',
    })
  );
});

test('new employer registration requires Company + TIN and starts pending until Admin approves', () => {
  const newEmployer = registerVerifiedRoleAccount(SEED_USERS, 'employer', {
    email: 'talent@ethiocorp.et',
    fullName: 'Sara Kebede',
    companyName: 'EthioCorp Logistics PLC',
    tinNumber: '0099887766',
    phone: '+251911445566',
    password: 'EmployerPass123',
    confirmPassword: 'EmployerPass123',
  });

  assert.equal(newEmployer.role, 'employer');
  assert.equal(newEmployer.status, 'pending');
  assert.equal(canAccessActivity(newEmployer, 'employer_hub').allowed, false);
  assert.equal(canAccessActivity(newEmployer, 'admin_console').allowed, false);

  const admin = SEED_USERS.find((u) => u.role === 'admin')!;
  const updatedUsers = adminUpdateAccountStatus(
    [...SEED_USERS, newEmployer],
    admin,
    newEmployer.email,
    'approved'
  );
  const approvedEmployer = updatedUsers.find((u) => u.email === newEmployer.email)!;
  assert.equal(approvedEmployer.status, 'approved');
  assert.equal(canAccessActivity(approvedEmployer, 'employer_hub').allowed, true);
});

test('suspended accounts are rejected at login and non-admins cannot modify user statuses', () => {
  const seeker = SEED_USERS.find((u) => u.role === 'seeker')!;
  const admin = SEED_USERS.find((u) => u.role === 'admin')!;

  assert.throws(() =>
    adminUpdateAccountStatus(SEED_USERS, seeker, 'hr@addistech.et', 'suspended')
  );

  const suspendedList = adminUpdateAccountStatus(SEED_USERS, admin, seeker.email, 'suspended');
  const authResult = authenticateCredentials(suspendedList, seeker.email, 'Seeker@2026');
  assert.equal(authResult.user, undefined);
  assert.match(authResult.error || '', /suspended/i);
});

test('admin search, direct user creation, role change, and admin password reset enforce governance rules', () => {
  const admin = SEED_USERS.find((u) => u.email === 'admin@tatari.et')!;
  const seeker = SEED_USERS.find((u) => u.role === 'seeker')!;

  // Search by company / TIN / email
  const employerMatches = filterUsersForAdmin(SEED_USERS, { query: 'addis', role: 'employer' });
  assert.equal(employerMatches.length, 1);
  assert.equal(employerMatches[0].email, 'hr@addistech.et');

  // Non-admin cannot create users directly
  assert.throws(() =>
    adminCreateUserAccount(SEED_USERS, seeker, {
      email: 'unauth@tatari.et',
      fullName: 'Unauth User',
      role: 'employer',
      status: 'approved',
      phone: '+251911223344',
      companyName: 'Test Co',
      tinNumber: '1234567',
      password: 'Password123',
      confirmPassword: 'Password123',
    })
  );

  // Admin creates verified employer
  const { users: withNewEmp, createdUser } = adminCreateUserAccount(SEED_USERS, admin, {
    email: 'hr@habeshabank.et',
    fullName: 'Mekdes Alemu',
    role: 'employer',
    status: 'approved',
    phone: '+251911554433',
    companyName: 'Habesha Bank S.C.',
    tinNumber: '0011223344',
    password: 'BankPass#2026',
    confirmPassword: 'BankPass#2026',
  });
  assert.equal(createdUser.status, 'approved');
  assert.equal(verifyUserPassword(createdUser, 'BankPass#2026'), true);

  // Admin updates user role & blocks primary admin role change
  const roleUpdated = adminUpdateUserRole(withNewEmp, admin, 'abebe@tatari.et', 'employer');
  assert.equal(roleUpdated.find((u) => u.email === 'abebe@tatari.et')?.role, 'employer');
  assert.throws(() => adminUpdateUserRole(roleUpdated, admin, 'admin@tatari.et', 'seeker'));

  // Admin resets user password
  const resetList = adminResetUserPassword(
    roleUpdated,
    admin,
    'abebe@tatari.et',
    'ResetPass#99',
    'ResetPass#99'
  );
  const authNew = authenticateCredentials(resetList, 'abebe@tatari.et', 'ResetPass#99');
  assert.ok(authNew.user);
});

test('self-service password rotation validates current password and strength', () => {
  assert.throws(() =>
    changeOwnPassword(SEED_USERS, 'abebe@tatari.et', 'WrongCurrent1', 'NewPass#123', 'NewPass#123')
  );
  assert.throws(() =>
    changeOwnPassword(SEED_USERS, 'abebe@tatari.et', 'Seeker@2026', 'weak', 'weak')
  );
  const rotated = changeOwnPassword(
    SEED_USERS,
    'abebe@tatari.et',
    'Seeker@2026',
    'AbebeNew#2026',
    'AbebeNew#2026'
  );
  assert.equal(authenticateCredentials(rotated, 'abebe@tatari.et', 'Seeker@2026').user, undefined);
  assert.ok(authenticateCredentials(rotated, 'abebe@tatari.et', 'AbebeNew#2026').user);
});

