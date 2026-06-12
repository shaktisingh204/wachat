/**
 * Unit tests for the OTP/Verify pure helpers (`../otp.ts`, V2.7).
 *
 *   npx tsx --test src/lib/sabsms/__tests__/otp.test.ts
 *
 * These mirror the Rust engine's clamps (`OtpConfig::from_doc`) and
 * template rendering (`render_template`) — if either side drifts, a
 * dashboard preview stops matching what the engine actually sends.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  SABSMS_OTP_CONFIG_DEFAULTS,
  clampOtpConfig,
  formatConversionRate,
  normalizeBlockPrefix,
  previewOtpTemplate,
} from '../otp';

test('defaults match the engine OtpConfig::default()', () => {
  assert.deepEqual(SABSMS_OTP_CONFIG_DEFAULTS, {
    codeLength: 6,
    ttlSecs: 300,
    maxAttempts: 5,
    maxResends: 3,
    resendCooldownSecs: 30,
    templateBody: 'Your verification code is {#code#}',
  });
});

test('clampOtpConfig passes valid values through', () => {
  const cfg = clampOtpConfig({
    codeLength: 8,
    ttlSecs: 120,
    maxAttempts: 3,
    maxResends: 1,
    resendCooldownSecs: 60,
    templateBody: '{#brand#} code: {#code#}',
    senderId: 'SABNDE',
    brandName: 'SabNode',
  });
  assert.equal(cfg.codeLength, 8);
  assert.equal(cfg.ttlSecs, 120);
  assert.equal(cfg.maxAttempts, 3);
  assert.equal(cfg.maxResends, 1);
  assert.equal(cfg.resendCooldownSecs, 60);
  assert.equal(cfg.templateBody, '{#brand#} code: {#code#}');
  assert.equal(cfg.senderId, 'SABNDE');
  assert.equal(cfg.brandName, 'SabNode');
});

test('clampOtpConfig clamps out-of-range values like the engine', () => {
  const cfg = clampOtpConfig({
    codeLength: 99,
    ttlSecs: 1,
    maxAttempts: 0,
    maxResends: 50,
    resendCooldownSecs: 100_000,
  });
  assert.equal(cfg.codeLength, 8); // clamp 4–8
  assert.equal(cfg.ttlSecs, 30); // clamp 30–3600
  assert.equal(cfg.maxAttempts, 1); // clamp 1–20
  assert.equal(cfg.maxResends, 10); // clamp 0–10
  assert.equal(cfg.resendCooldownSecs, 600); // clamp 5–600
});

test('clampOtpConfig falls back to defaults on junk input', () => {
  const cfg = clampOtpConfig({
    codeLength: 'banana',
    ttlSecs: NaN,
    templateBody: '   ',
    senderId: '',
    brandName: '  ',
  });
  assert.equal(cfg.codeLength, 6);
  assert.equal(cfg.ttlSecs, 300);
  assert.equal(cfg.templateBody, 'Your verification code is {#code#}');
  assert.equal(cfg.senderId, undefined);
  assert.equal(cfg.brandName, undefined);
});

test('clampOtpConfig accepts numeric strings (HTML form values)', () => {
  const cfg = clampOtpConfig({ codeLength: '4', ttlSecs: '600' });
  assert.equal(cfg.codeLength, 4);
  assert.equal(cfg.ttlSecs, 600);
});

test('normalizeBlockPrefix accepts E.164 prefixes', () => {
  assert.equal(normalizeBlockPrefix('+1415555'), '+1415555');
  assert.equal(normalizeBlockPrefix('+91'), '+91');
  // Missing plus is added; separators and whitespace are stripped.
  assert.equal(normalizeBlockPrefix('1415555'), '+1415555');
  assert.equal(normalizeBlockPrefix('  +1 415-555 '), '+1415555');
});

test('normalizeBlockPrefix rejects invalid input', () => {
  assert.equal(normalizeBlockPrefix(''), null);
  assert.equal(normalizeBlockPrefix('+'), null);
  assert.equal(normalizeBlockPrefix('abc'), null);
  assert.equal(normalizeBlockPrefix('+1415x555'), null);
  // 15 digits exceeds the E.164 maximum.
  assert.equal(normalizeBlockPrefix('+123456789012345'), null);
  assert.equal(normalizeBlockPrefix('+12345678901234'), '+12345678901234');
});

test('formatConversionRate formats percentages and guards zero volume', () => {
  assert.equal(formatConversionRate(0, 0), '—');
  assert.equal(formatConversionRate(-5, 2), '—');
  assert.equal(formatConversionRate(100, 80), '80.0%');
  assert.equal(formatConversionRate(8, 7), '87.5%');
  // converted can never display above 100%.
  assert.equal(formatConversionRate(10, 99), '100.0%');
});

test('previewOtpTemplate substitutes code and brand like the engine', () => {
  assert.equal(
    previewOtpTemplate('Your verification code is {#code#}', '482915'),
    'Your verification code is 482915',
  );
  assert.equal(
    previewOtpTemplate('{#brand#}: code {#code#}', '1234', 'SabNode'),
    'SabNode: code 1234',
  );
  // Brand placeholder without a configured brand collapses cleanly.
  assert.equal(previewOtpTemplate('{#brand#} code {#code#}', '1234'), 'code 1234');
  // A template missing {#code#} still delivers the code.
  assert.equal(previewOtpTemplate('Hello from SabNode', '987654'), 'Hello from SabNode 987654');
});
