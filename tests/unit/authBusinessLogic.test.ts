import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { signToken, AuthUser } from '../../server/src/middleware/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'slothify-jwt-secure-super-secret-key-2026';

describe('Authentication & Token Business Logic', () => {
  describe('JWT Token Generation & Validation', () => {
    it('generates a valid signed JWT containing userId and username', () => {
      const user: AuthUser = {
        userId: 'local_user_test_dev',
        username: 'TestDevUser'
      };

      const token = signToken(user);
      assert.ok(token, 'Token string must be generated');

      const decoded = jwt.verify(token, JWT_SECRET) as any;
      assert.equal(decoded.userId, user.userId);
      assert.equal(decoded.username, user.username);
    });

    it('sets a 30-day token expiration window', () => {
      const user: AuthUser = {
        userId: 'exp_user',
        username: 'expUser'
      };

      const token = signToken(user);
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const expectedDuration = 30 * 24 * 60 * 60; // 30 days in seconds
      const actualDuration = decoded.exp - decoded.iat;

      assert.equal(actualDuration, expectedDuration);
    });

    it('rejects tampered tokens', () => {
      const user: AuthUser = { userId: 'u1', username: 'u1' };
      const token = signToken(user);
      const tampered = token.slice(0, -5) + 'abcde';

      assert.throws(() => {
        jwt.verify(tampered, JWT_SECRET);
      }, /invalid signature/i);
    });

    it('rejects tokens signed with an untrusted secret', () => {
      const forgedToken = jwt.sign({ userId: 'hacker', username: 'admin' }, 'wrong_secret_123');
      assert.throws(() => {
        jwt.verify(forgedToken, JWT_SECRET);
      }, /invalid signature/i);
    });
  });

  describe('Username & Passkey Sanitization Logic', () => {
    it('escapes regex metacharacters in username lookups to prevent regex injection', () => {
      const maliciousUsername = 'user.*+?^${}()|[]\\test';
      const escaped = maliciousUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      assert.equal(
        escaped,
        'user\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\test'
      );

      // Verify that RegExp compilation succeeds and matches literally without wildcard expansion
      const regex = new RegExp(`^${escaped}$`, 'i');
      assert.ok(regex.test(maliciousUsername));
      assert.equal(regex.test('user_arbitrary_wildcard_test'), false);
    });

    it('normalizes recovery passphrases (trims whitespace, converts to lowercase)', () => {
      const rawInput = '   Beacon Coral Dragon Echo Ember Falcon Feather Frost Glow Leaf Lotus Lunar   ';
      const normalized = rawInput.trim().toLowerCase();

      assert.equal(
        normalized,
        'beacon coral dragon echo ember falcon feather frost glow leaf lotus lunar'
      );
      assert.equal(normalized.split(/\s+/).length, 12);
    });

    it('validates username constraints (trimming, length bounds 3-30)', () => {
      const isValid = (u: string) => {
        const clean = (u || '').trim();
        return clean.length >= 3 && clean.length <= 30;
      };

      assert.equal(isValid('ab'), false, 'Too short');
      assert.equal(isValid('abc'), true, 'Minimum length');
      assert.equal(isValid('purvesh'), true, 'Normal length');
      assert.equal(isValid('  valid_spaced  '), true, 'Trimmed to valid');
      assert.equal(isValid('a'.repeat(31)), false, 'Too long');
    });
  });
});

