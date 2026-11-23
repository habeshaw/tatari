import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  createAdminSessionToken,
  extractBearerToken,
  verifyAdminSessionToken,
} from './adminAuth';

const TEST_SECRET = crypto.randomBytes(32).toString('hex');

test('createAdminSessionToken and verifyAdminSessionToken succeed for valid admin token', () => {
  const now = 1_795_000_000_000;
  const { token, expiresAt } = createAdminSessionToken('admin@tatari.et', TEST_SECRET, 60_000, now);
  assert.ok(token.includes('.'));
  assert.equal(expiresAt, new Date(now + 60_000).toISOString());

  const verified = verifyAdminSessionToken(token, TEST_SECRET, now + 10_000);
  assert.equal(verified?.email, 'admin@tatari.et');
  assert.equal(verified?.role, 'admin');
});

test('verifyAdminSessionToken rejects tampered, wrong-secret, or expired tokens', () => {
  const now = 1_795_000_000_000;
  const { token } = createAdminSessionToken('admin@tatari.et', TEST_SECRET, 60_000, now);

  assert.equal(verifyAdminSessionToken(`${token}x`, TEST_SECRET, now + 1_000), null);
  assert.equal(
    verifyAdminSessionToken(token, crypto.randomBytes(32).toString('hex'), now + 1_000),
    null
  );
  assert.equal(verifyAdminSessionToken(token, TEST_SECRET, now + 61_000), null);
  assert.equal(verifyAdminSessionToken(null, TEST_SECRET, now), null);
});

test('extractBearerToken parses Bearer header cleanly', () => {
  assert.equal(extractBearerToken('Bearer abc.123'), 'abc.123');
  assert.equal(extractBearerToken('bearer   xyz.456  '), 'xyz.456');
  assert.equal(extractBearerToken('Basic abc'), null);
  assert.equal(extractBearerToken(undefined), null);
});
