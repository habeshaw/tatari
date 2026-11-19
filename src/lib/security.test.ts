import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adminUpdateAccountStatus,
  authenticateCredentials,
  canAccessActivity,
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
