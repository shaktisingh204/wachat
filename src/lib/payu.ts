/**
 * PayU Biz (India) server-side helpers.
 *
 * PayU's standard integration is a form-POST redirect flow — not a JS
 * SDK — so we build the payload + SHA-512 hash on the server, let the
 * browser auto-submit a hidden form to `secure.payu.in` (or the test
 * host), and then PayU POSTs the user back to our `surl` / `furl` with
 * a reverse-hash that we re-verify.
 *
 * Env:
 *   PAYU_MERCHANT_KEY       — merchant key from PayU dashboard
 *   PAYU_MERCHANT_SALT      — merchant salt from PayU dashboard
 *   PAYU_MODE               — 'test' | 'production' (default: 'test')
 */

import crypto from 'crypto';

export type PayuMode = 'test' | 'production';

export const PAYU_ENDPOINTS: Record<PayuMode, string> = {
    test: 'https://test.payu.in/_payment',
    production: 'https://secure.payu.in/_payment',
};

export function getPayuConfig(): {
    key: string;
    salt: string;
    mode: PayuMode;
    action: string;
} | null {
    const key = process.env.PAYU_MERCHANT_KEY;
    const salt = process.env.PAYU_MERCHANT_SALT;
    const mode = (process.env.PAYU_MODE as PayuMode) || 'test';
    if (!key || !salt) return null;
    return {
        key,
        salt,
        mode,
        action: PAYU_ENDPOINTS[mode] ?? PAYU_ENDPOINTS.test,
    };
}

export interface PayuRequestFields {
    key: string;
    txnid: string;
    amount: string; // stringified, 2 decimals
    productinfo: string;
    firstname: string;
    email: string;
    phone?: string;
    surl: string;
    furl: string;
    udf1?: string;
    udf2?: string;
    udf3?: string;
    udf4?: string;
    udf5?: string;
}

/**
 * Request hash (forward):
 *   sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt)
 *
 * PayU spec: after udf5 there are 6 pipe characters before salt,
 * representing empty udf6–udf10 placeholders. With .join('|') that
 * means 5 empty strings between udf5 and salt:
 *   [udf5, '', '', '', '', '', salt].join('|') → "udf5||||||salt"
 */
export function buildPayuRequestHash(
    fields: PayuRequestFields,
    salt: string
): string {
    const {
        key,
        txnid,
        amount,
        productinfo,
        firstname,
        email,
        udf1 = '',
        udf2 = '',
        udf3 = '',
        udf4 = '',
        udf5 = '',
    } = fields;

    const hashString = [
        key,
        txnid,
        amount,
        productinfo,
        firstname,
        email,
        udf1,
        udf2,
        udf3,
        udf4,
        udf5,
        '',   // udf6
        '',   // udf7
        '',   // udf8
        '',   // udf9
        '',   // udf10
        salt,
    ].join('|');

    return crypto.createHash('sha512').update(hashString).digest('hex');
}

export interface PayuResponseFields {
    status: string;
    key: string;
    txnid: string;
    amount: string;
    productinfo: string;
    firstname: string;
    email: string;
    udf1?: string;
    udf2?: string;
    udf3?: string;
    udf4?: string;
    udf5?: string;
    udf6?: string;
    udf7?: string;
    udf8?: string;
    udf9?: string;
    udf10?: string;
}

/**
 * Response hash (reverse):
 *   sha512(salt|status|udf10|udf9|udf8|udf7|udf6|udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
 *
 * We recompute this and compare against the `hash` field in PayU's
 * posted response. Any mismatch means the response was tampered with
 * and must be rejected.
 */
export function buildPayuResponseHash(
    fields: PayuResponseFields,
    salt: string
): string {
    const {
        status,
        key,
        txnid,
        amount,
        productinfo,
        firstname,
        email,
        udf1 = '',
        udf2 = '',
        udf3 = '',
        udf4 = '',
        udf5 = '',
        udf6 = '',
        udf7 = '',
        udf8 = '',
        udf9 = '',
        udf10 = '',
    } = fields;

    const hashString = [
        salt,
        status,
        udf10,
        udf9,
        udf8,
        udf7,
        udf6,
        udf5,
        udf4,
        udf3,
        udf2,
        udf1,
        email,
        firstname,
        productinfo,
        amount,
        txnid,
        key,
    ].join('|');

    return crypto.createHash('sha512').update(hashString).digest('hex');
}

export function verifyPayuResponseHash(
    fields: PayuResponseFields & { hash: string },
    salt: string
): boolean {
    const expected = buildPayuResponseHash(fields, salt);
    const received = (fields.hash || '').toLowerCase();
    // Timing-safe compare (both buffers must be the same length)
    if (expected.length !== received.length) return false;
    try {
        return crypto.timingSafeEqual(
            Buffer.from(expected, 'utf8'),
            Buffer.from(received, 'utf8')
        );
    } catch {
        return false;
    }
}

/**
 * Generates a PayU-friendly txnid. PayU limits txnid to 25 chars and
 * it must be unique per request. We combine a short timestamp with
 * some randomness.
 */
export function generatePayuTxnId(prefix = 'sn'): string {
    const ts = Date.now().toString(36);
    const rand = crypto.randomBytes(4).toString('hex');
    return `${prefix}${ts}${rand}`.slice(0, 25);
}

/**
 * Formats an amount to PayU's expected string form (2 decimal places).
 */
export function formatPayuAmount(amount: number): string {
    return (Math.round(amount * 100) / 100).toFixed(2);
}
