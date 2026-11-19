import type {
  AccountStatus,
  JobApplication,
  JobListing,
  UserProfile,
} from '../types/domain';

export type ProtectedActivity =
  | 'browse_jobs'
  | 'apply_job'
  | 'save_job'
  | 'store_checkout'
  | 'store_download'
  | 'my_activity'
  | 'employer_hub'
  | 'admin_console';

/**
 * Synchronous, dependency-free SHA-256 implementation so password hashing
 * works identically in Node tests, Vite dev, and HTTPS production browsers.
 */
function sha256Hex(ascii: string): string {
  const rightRotate = (value: number, amount: number) =>
    (value >>> amount) | (value << (32 - amount));

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, boolean> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) {
        isComposite[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  let padded = ascii + '\x80';
  while ((padded.length % 64) - 56) padded += '\x00';
  for (let i = 0; i < padded.length; i++) {
    const j = padded.charCodeAt(i);
    if (j >> 8) throw new Error('Invalid ASCII character in hash input');
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);

    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];

      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);

      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash.unshift((temp1 + temp2) | 0);
      hash.pop();
      hash[4] = (hash[4] + temp1) | 0;
    }

    for (let i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

export function hashUserPassword(email: string, password: string): string {
  const normalizedEmail = email.trim().toLowerCase();
  const encoded = encodeURIComponent(password);
  return sha256Hex(`tatari-auth-v2:${normalizedEmail}:${encoded}`);
}

export function verifyUserPassword(user: UserProfile, password: string): boolean {
  if (!user.passwordHash) return false;
  return user.passwordHash === hashUserPassword(user.email, password);
}

export function validateEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must contain at least one letter and one number.';
  }
  return null;
}

export function canAccessActivity(
  user: UserProfile | null,
  activity: ProtectedActivity
): { allowed: boolean; reason?: string } {
  if (activity === 'browse_jobs' || activity === 'apply_job') {
    if (user && user.status === 'suspended') {
      return {
        allowed: false,
        reason: 'Your account has been suspended by the Administrator.',
      };
    }
    return { allowed: true };
  }

  if (!user) {
    return {
      allowed: false,
      reason: 'Registration and sign-in are required before performing this activity.',
    };
  }

  if (user.status === 'suspended') {
    return {
      allowed: false,
      reason: 'Your account is suspended. Contact TATARI Administrator.',
    };
  }

  if (activity === 'admin_console') {
    if (user.role !== 'admin' || user.status !== 'approved') {
      return {
        allowed: false,
        reason: 'Only an authenticated, approved Administrator can access this console.',
      };
    }
    return { allowed: true };
  }

  if (activity === 'employer_hub') {
    if (user.role !== 'employer' && user.role !== 'admin') {
      return {
        allowed: false,
        reason: 'An Employer account is required to post jobs or manage applicants.',
      };
    }
    if (user.role === 'employer' && user.status !== 'approved') {
      return {
        allowed: false,
        reason: 'Your Employer registration is pending Administrator verification.',
      };
    }
    return { allowed: true };
  }

  // save_job, store_checkout, store_download, my_activity
  if (user.role === 'employer' && user.status === 'pending' && activity === 'store_checkout') {
    return { allowed: true };
  }

  return { allowed: true };
}

export interface SeekerApplyRegistrationInput {
  job: JobListing;
  applicantName: string;
  applicantEmail: string;
  phone: string;
  resumeUrl: string;
  yearsExperience: string;
  coverNote: string;
  password?: string;
  confirmPassword?: string;
}

export function registerSeekerAndCreateApplication(
  existingUsers: UserProfile[],
  currentUser: UserProfile | null,
  input: SeekerApplyRegistrationInput,
  nowIso: string = new Date().toISOString()
): {
  application: JobApplication;
  newUser: UserProfile | null;
  actorEmail: string;
} {
  const cleanEmail = input.applicantEmail.trim().toLowerCase();
  const cleanName = input.applicantName.trim();
  const cleanPhone = input.phone.trim();
  const cleanResume = input.resumeUrl.trim();

  if (cleanName.length < 2) {
    throw new Error('Full name is required.');
  }
  if (!validateEmailFormat(cleanEmail)) {
    throw new Error('A valid email address is required.');
  }
  if (cleanPhone.length < 6) {
    throw new Error('A valid Ethiopian or international phone number is required.');
  }
  if (!cleanResume) {
    throw new Error('Please provide your CV / Resume link.');
  }

  if (currentUser) {
    if (currentUser.status === 'suspended') {
      throw new Error('Suspended accounts cannot submit job applications.');
    }
    const application: JobApplication = {
      id: `app-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      jobId: input.job.id,
      jobTitle: input.job.titleEn,
      companyName: input.job.companyName,
      applicantName: cleanName,
      applicantEmail: currentUser.email.toLowerCase(),
      phone: cleanPhone,
      resumeUrl: cleanResume,
      yearsExperience: input.yearsExperience,
      coverNote: input.coverNote.trim(),
      status: 'Submitted',
      createdAt: nowIso,
    };
    return { application, newUser: null, actorEmail: currentUser.email.toLowerCase() };
  }

  // Unauthenticated Job Seeker must register while applying for this specific job
  const existing = existingUsers.find((u) => u.email.toLowerCase() === cleanEmail);
  if (existing) {
    throw new Error(
      'An account with this email already exists. Please sign in with your password to apply.'
    );
  }

  const pwd = input.password || '';
  const pwdErr = validatePasswordStrength(pwd);
  if (pwdErr) throw new Error(pwdErr);

  if (input.confirmPassword !== undefined && pwd !== input.confirmPassword) {
    throw new Error('Passwords do not match.');
  }

  const newUser: UserProfile = {
    email: cleanEmail,
    fullName: cleanName,
    phone: cleanPhone,
    role: 'seeker',
    status: 'approved',
    passwordHash: hashUserPassword(cleanEmail, pwd),
    lastLoginAt: nowIso,
    createdAt: nowIso,
  };

  const application: JobApplication = {
    id: `app-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    jobId: input.job.id,
    jobTitle: input.job.titleEn,
    companyName: input.job.companyName,
    applicantName: cleanName,
    applicantEmail: cleanEmail,
    phone: cleanPhone,
    resumeUrl: cleanResume,
    yearsExperience: input.yearsExperience,
    coverNote: input.coverNote.trim(),
    status: 'Submitted',
    createdAt: nowIso,
  };

  return { application, newUser, actorEmail: cleanEmail };
}

export interface EmployerRegisterInput {
  email: string;
  fullName: string;
  companyName: string;
  tinNumber: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

export function registerVerifiedRoleAccount(
  existingUsers: UserProfile[],
  role: 'seeker' | 'employer',
  input: {
    email: string;
    fullName: string;
    companyName?: string;
    tinNumber?: string;
    phone: string;
    password: string;
    confirmPassword: string;
  },
  nowIso: string = new Date().toISOString()
): UserProfile {
  const cleanEmail = input.email.trim().toLowerCase();
  if (!validateEmailFormat(cleanEmail)) {
    throw new Error('Please enter a valid email address.');
  }
  if (cleanEmail === 'admin@tatari.et') {
    throw new Error('admin@tatari.et is reserved for the system administrator.');
  }
  if (existingUsers.some((u) => u.email.toLowerCase() === cleanEmail)) {
    throw new Error('An account with this email already exists. Please sign in instead.');
  }
  if (input.fullName.trim().length < 2) {
    throw new Error('Full name is required.');
  }
  if (input.phone.trim().length < 6) {
    throw new Error('A valid phone number is required.');
  }

  const pwdErr = validatePasswordStrength(input.password);
  if (pwdErr) throw new Error(pwdErr);
  if (input.password !== input.confirmPassword) {
    throw new Error('Passwords do not match.');
  }

  if (role === 'employer') {
    if (!input.companyName || input.companyName.trim().length < 2) {
      throw new Error('Registered company or organization name is required for employers.');
    }
    if (!input.tinNumber || input.tinNumber.trim().length < 5) {
      throw new Error('Business TIN / License number (min 5 characters) is required.');
    }
  }

  return {
    email: cleanEmail,
    fullName: input.fullName.trim(),
    companyName: role === 'employer' ? input.companyName?.trim() : undefined,
    tinNumber: role === 'employer' ? input.tinNumber?.trim() : undefined,
    phone: input.phone.trim(),
    role,
    // Employers require Administrator verification before posting vacancies
    status: role === 'employer' ? 'pending' : 'approved',
    passwordHash: hashUserPassword(cleanEmail, input.password),
    lastLoginAt: nowIso,
    createdAt: nowIso,
  };
}

export function authenticateCredentials(
  users: UserProfile[],
  email: string,
  password: string
): { user?: UserProfile; error?: string } {
  const cleanEmail = email.trim().toLowerCase();
  const user = users.find((u) => u.email.toLowerCase() === cleanEmail);
  if (!user) {
    return { error: 'Invalid email or password.' };
  }
  if (!verifyUserPassword(user, password)) {
    return { error: 'Invalid email or password.' };
  }
  if (user.status === 'suspended') {
    return { error: 'This account has been suspended by the Administrator.' };
  }
  return { user };
}

export function adminUpdateAccountStatus(
  users: UserProfile[],
  actor: UserProfile | null,
  targetEmail: string,
  nextStatus: AccountStatus
): UserProfile[] {
  if (!actor || actor.role !== 'admin' || actor.status !== 'approved') {
    throw new Error('Only an approved Administrator can change user account statuses.');
  }
  const cleanTarget = targetEmail.trim().toLowerCase();
  if (cleanTarget === 'admin@tatari.et') {
    throw new Error('Primary Administrator account status cannot be modified.');
  }
  return users.map((u) =>
    u.email.toLowerCase() === cleanTarget ? { ...u, status: nextStatus } : u
  );
}
