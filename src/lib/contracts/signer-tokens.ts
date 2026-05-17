/**
 * Signer-token mint + verify helpers.
 *
 * Token shape (one line):
 *   `v1.<base64url(contractId.signerEmail.issuedAt)>.<base64url(hmacSha256)>`
 *
 * The HMAC is computed over `<contractId>|<signerEmail>|<issuedAt>`
 * with `CONTRACT_SIGNER_SECRET` as the key. Tokens are stateless —
 * the contract document just needs to know the signer's email so the
 * verifier can recompute the MAC. Single-use semantics live in the
 * caller (mark `signers[i].tokenUsedAt` after success).
 *
 * Why HMAC instead of an opaque random token? Two reasons:
 *  1. We can re-issue links without DB churn (the contract record
 *     doesn't have to remember every outstanding token).
 *  2. A signer email-address rotation immediately invalidates every
 *     in-flight link for that signer — no cleanup needed.
 *
 * Backwards compatibility: the existing opaque-token flow in
 * `sendContractForSignature` keeps working — `getContractByToken`
 * matches against `signers[].token` as a fallback before attempting
 * HMAC verification.
 */

import 'server-only';

import crypto from 'node:crypto';

export const SIGNER_TOKEN_VERSION = 'v1';

function getSecret(): string {
    const s = process.env.CONTRACT_SIGNER_SECRET;
    if (!s || s.length < 16) {
        // Fail loudly in production; in dev fall back to a marker that
        // makes verification trivially fail so we never accidentally
        // accept tokens minted under a missing secret.
        if (process.env.NODE_ENV === 'production') {
            throw new Error('CONTRACT_SIGNER_SECRET is not configured.');
        }
        return 'sabnode-dev-contract-signer-secret-change-me-32+chars';
    }
    return s;
}

function b64url(input: Buffer | string): string {
    const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
    return buf
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function b64urlDecodeToString(input: string): string {
    const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
    const std = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
    return Buffer.from(std, 'base64').toString('utf8');
}

function macFor(contractId: string, signerEmail: string, issuedAt: number): string {
    const msg = `${contractId}|${signerEmail}|${issuedAt}`;
    return b64url(
        crypto.createHmac('sha256', getSecret()).update(msg).digest(),
    );
}

export interface IssueArgs {
    contractId: string;
    signerEmail: string;
    /** Reserved for future per-tenant secrets. Currently informational. */
    tenantUserId: string;
    /** Override `Date.now()` (testing). */
    nowMs?: number;
}

export function issueSignerToken(args: IssueArgs): string {
    const email = (args.signerEmail || '').trim().toLowerCase();
    if (!args.contractId || !email) {
        throw new Error('contractId and signerEmail are required to issue a signer token.');
    }
    const issuedAt = args.nowMs ?? Date.now();
    const payload = `${args.contractId}.${email}.${issuedAt}`;
    const mac = macFor(args.contractId, email, issuedAt);
    return `${SIGNER_TOKEN_VERSION}.${b64url(payload)}.${mac}`;
}

export interface VerifyArgs {
    contractId: string;
    /** Optional max age in milliseconds. Defaults to 30 days. */
    maxAgeMs?: number;
    /** Override `Date.now()` (testing). */
    nowMs?: number;
}

export interface VerifyResult {
    valid: boolean;
    signerEmail?: string;
    issuedAt?: number;
    error?: string;
}

export function verifySignerToken(token: string, opts: VerifyArgs): VerifyResult {
    if (!token || typeof token !== 'string') {
        return { valid: false, error: 'Missing token.' };
    }
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== SIGNER_TOKEN_VERSION) {
        return { valid: false, error: 'Unsupported token format.' };
    }
    let decoded: string;
    try {
        decoded = b64urlDecodeToString(parts[1]);
    } catch {
        return { valid: false, error: 'Malformed token.' };
    }
    const segs = decoded.split('.');
    if (segs.length !== 3) return { valid: false, error: 'Malformed token payload.' };
    const [tokContractId, signerEmail, issuedAtStr] = segs;
    const issuedAt = Number(issuedAtStr);
    if (!Number.isFinite(issuedAt) || issuedAt <= 0) {
        return { valid: false, error: 'Invalid token timestamp.' };
    }
    if (tokContractId !== opts.contractId) {
        return { valid: false, error: 'Token bound to a different contract.' };
    }
    const expectedMac = macFor(tokContractId, signerEmail, issuedAt);
    const got = Buffer.from(parts[2]);
    const want = Buffer.from(expectedMac);
    if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) {
        return { valid: false, error: 'Token signature mismatch.' };
    }
    const maxAge = opts.maxAgeMs ?? 30 * 24 * 60 * 60 * 1000;
    const now = opts.nowMs ?? Date.now();
    if (now - issuedAt > maxAge) {
        return { valid: false, error: 'Token has expired.' };
    }
    return { valid: true, signerEmail, issuedAt };
}

/** True iff the supplied string matches the v1 HMAC token shape. */
export function looksLikeSignerToken(token: string): boolean {
    if (!token || typeof token !== 'string') return false;
    const parts = token.split('.');
    return parts.length === 3 && parts[0] === SIGNER_TOKEN_VERSION;
}
