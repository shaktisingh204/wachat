/**
 * Pure unit tests for `src/lib/compliance/dlp.ts`.  Runs with Node's
 * built-in `node:test` + `tsx`:
 *
 *   npx tsx --test src/lib/compliance/__tests__/dlp.test.ts
 *
 * Coverage targets:
 *   1. Email detection + false-positive on lone "@".
 *   2. Phone detection + false-positive on bare integers.
 *   3. Credit-card detection requires Luhn — Visa test card matches,
 *      same-length non-Luhn string does not.
 *   4. AWS access-key detection.
 *   5. JWT detection requires structural validity.
 *   6. Generic API-key detection requires entropy threshold.
 *   7. `redact()` masks every finding.
 *   8. Empty / harmless text yields no findings.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
    DEFAULT_RULES,
    looksLikeJwt,
    luhn,
    redact,
    scan,
    shannonEntropy,
} from '../dlp';

test('detects a real email and ignores stray @', () => {
    const text = 'Contact: alice@example.com — but @handle is not an email.';
    const findings = scan(text, DEFAULT_RULES.filter((r) => r.id === 'email'));
    assert.equal(findings.length, 1);
    assert.equal(findings[0].match, 'alice@example.com');
});

test('detects an E.164 phone number and ignores short integers', () => {
    const text = 'Order #42 — call +1 415-555-0132 for support.';
    const findings = scan(text, DEFAULT_RULES.filter((r) => r.id === 'phone'));
    assert.ok(findings.length >= 1, 'expected at least one phone match');
    assert.ok(
        findings.some((f) => f.match.includes('415')),
        'expected the phone match to include 415',
    );
    // The bare "42" must not become a phone match.
    assert.ok(
        !findings.some((f) => f.match.trim() === '42'),
        '"42" should not match phone',
    );
});

test('credit-card detection rejects non-Luhn 16-digit strings', () => {
    // 4111 1111 1111 1111 is the canonical Visa test PAN — passes Luhn.
    const valid = '4111 1111 1111 1111';
    // Same length, but flips one digit so Luhn fails.
    const invalid = '4111 1111 1111 1112';
    const ccRules = DEFAULT_RULES.filter((r) => r.id === 'credit_card');

    const validFindings = scan(`PAN ${valid}`, ccRules);
    const invalidFindings = scan(`PAN ${invalid}`, ccRules);

    assert.equal(validFindings.length, 1, 'valid PAN should match');
    assert.equal(validFindings[0].category, 'credit_card');
    assert.equal(invalidFindings.length, 0, 'non-Luhn PAN should not match');

    // Sanity-check the helper.
    assert.equal(luhn('4111111111111111'), true);
    assert.equal(luhn('4111111111111112'), false);
});

test('detects AWS access-key IDs', () => {
    const text = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE rest of file';
    const findings = scan(
        text,
        DEFAULT_RULES.filter((r) => r.id === 'aws_access_key'),
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].match, 'AKIAIOSFODNN7EXAMPLE');
    assert.equal(findings[0].severity, 'critical');
});

test('JWT detection requires a structurally-valid token', () => {
    // Real-shape JWT with `alg` in the header.
    const realHeader = Buffer.from(
        JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
    )
        .toString('base64')
        .replace(/=+$/, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
    const realPayload = 'eyJzdWIiOiIxMjM0NTY3ODkwIn0';
    const realSig = 'abc123def456';
    const real = `${realHeader}.${realPayload}.${realSig}`;
    // Structurally a JWT but the header isn't valid JSON / no alg.
    const fake = 'eyJBQkM.notarealjwt.xxxxx';

    const jwtRules = DEFAULT_RULES.filter((r) => r.id === 'jwt');
    assert.equal(scan(`token=${real}`, jwtRules).length, 1);
    assert.equal(scan(`token=${fake}`, jwtRules).length, 0);

    assert.equal(looksLikeJwt(real), true);
    assert.equal(looksLikeJwt(fake), false);
});

test('generic API-key rule respects entropy threshold', () => {
    const lowEntropy = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; // 34x 'a'
    const highEntropy = 'sk_live_4eC39HqLyjWDarjtT1zdp7dcEXAMPLE12';
    const apiKeyRule = DEFAULT_RULES.filter((r) => r.id === 'generic_api_key');

    assert.equal(scan(lowEntropy, apiKeyRule).length, 0);
    assert.ok(scan(highEntropy, apiKeyRule).length >= 1);

    // Sanity-check the entropy helper.
    assert.ok(shannonEntropy(highEntropy) > shannonEntropy(lowEntropy));
});

test('redact() masks every finding without breaking surrounding text', () => {
    const text = 'mail alice@example.com please';
    const findings = scan(text, DEFAULT_RULES.filter((r) => r.id === 'email'));
    const masked = redact(text, findings);
    assert.equal(masked, 'mail ***************** please');
    assert.ok(!masked.includes('alice'));
    assert.ok(masked.startsWith('mail '));
    assert.ok(masked.endsWith(' please'));
});

test('empty / harmless text produces no findings', () => {
    assert.deepEqual(scan(''), []);
    assert.deepEqual(scan('the quick brown fox'), []);
});
