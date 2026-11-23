import crypto from 'node:crypto';

export interface AdminTokenPayload {
  email: string;
  role: 'admin';
  iat: number;
  exp: number;
}

const DEFAULT_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function toBase64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromBase64Url(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64');
}

export function createAdminSessionToken(
  email: string,
  secret: string,
  ttlMs: number = DEFAULT_TOKEN_TTL_MS,
  nowMs: number = Date.now()
): { token: string; expiresAt: string } {
  const payload: AdminTokenPayload = {
    email: email.trim().toLowerCase(),
    role: 'admin',
    iat: nowMs,
    exp: nowMs + ttlMs,
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest();
  const token = `${encodedPayload}.${toBase64Url(signature)}`;
  return {
    token,
    expiresAt: new Date(payload.exp).toISOString(),
  };
}

export function verifyAdminSessionToken(
  token: string | undefined | null,
  secret: string,
  nowMs: number = Date.now()
): AdminTokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, encodedSig] = parts;
  if (!encodedPayload || !encodedSig) return null;

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest();

  let actualSig: Buffer;
  try {
    actualSig = fromBase64Url(encodedSig);
  } catch {
    return null;
  }

  if (actualSig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(actualSig, expectedSig)) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(encodedPayload).toString('utf8')) as Partial<AdminTokenPayload>;
    if (
      parsed.role !== 'admin' ||
      typeof parsed.email !== 'string' ||
      typeof parsed.exp !== 'number' ||
      parsed.exp <= nowMs
    ) {
      return null;
    }
    return {
      email: parsed.email,
      role: 'admin',
      iat: Number(parsed.iat || 0),
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

export function extractBearerToken(authHeader: string | undefined | null): string | null {
  if (!authHeader || typeof authHeader !== 'string') return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}
