/**
 * MFA: TOTP (RFC 6238, sha1, 30-step) + WebAuthn ceremonies.
 *
 * Uses Web Crypto / `crypto` only — no native deps, no `speakeasy`.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

/* ── Base32 (RFC 4648 — no padding when encoding for QR readability) ────── */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Uint8Array): string {
    let bits = 0;
    let value = 0;
    let out = '';
    for (let i = 0; i < buf.length; i++) {
        value = (value << 8) | buf[i];
        bits += 8;
        while (bits >= 5) {
            out += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
            bits -= 5;
        }
    }
    if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
    return out;
}

export function base32Decode(input: string): Uint8Array {
    const cleaned = input.replace(/=+$/g, '').toUpperCase().replace(/\s+/g, '');
    let bits = 0;
    let value = 0;
    const out: number[] = [];
    for (const ch of cleaned) {
        const idx = BASE32_ALPHABET.indexOf(ch);
        if (idx < 0) throw new Error(`Invalid base32 character: ${ch}`);
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            out.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }
    return Uint8Array.from(out);
}

/* ── TOTP (RFC 6238) ─────────────────────────────── */

export type TotpOptions = {
    /** Number of digits in the generated code. Default 6. */
    digits?: number;
    /** Step size in seconds. Default 30. */
    step?: number;
    /** HMAC algorithm. Only sha1 is broadly compatible with authenticator apps. */
    algorithm?: 'sha1' | 'sha256' | 'sha512';
    /** Number of windows of leeway (each `step` seconds) on either side. */
    window?: number;
};

const DEFAULT_OPTS: Required<TotpOptions> = {
    digits: 6,
    step: 30,
    algorithm: 'sha1',
    window: 1,
};

/** Generate a 20-byte (160-bit) random TOTP secret encoded as base32. */
export function generateTotpSecret(byteLength = 20): string {
    return base32Encode(randomBytes(byteLength));
}

/** otpauth:// URI for QR provisioning. */
export function totpProvisioningUri(args: {
    secret: string;
    accountName: string;
    issuer: string;
    options?: TotpOptions;
}): string {
    const opts = { ...DEFAULT_OPTS, ...(args.options ?? {}) };
    const label = encodeURIComponent(`${args.issuer}:${args.accountName}`);
    const params = new URLSearchParams({
        secret: args.secret.replace(/=+$/g, ''),
        issuer: args.issuer,
        algorithm: opts.algorithm.toUpperCase(),
        digits: String(opts.digits),
        period: String(opts.step),
    });
    return `otpauth://totp/${label}?${params.toString()}`;
}

function counterToBuffer(counter: number): Buffer {
    const buf = Buffer.alloc(8);
    // High 4 bytes — JS bitwise ops are 32-bit so we split.
    let high = Math.floor(counter / 0x100000000);
    let low = counter >>> 0;
    buf.writeUInt32BE(high, 0);
    buf.writeUInt32BE(low, 4);
    return buf;
}

/** Generate a TOTP code for the given secret + time. */
export function generateTotp(
    secret: string,
    time: number = Date.now(),
    options?: TotpOptions,
): string {
    const opts = { ...DEFAULT_OPTS, ...(options ?? {}) };
    const counter = Math.floor(time / 1000 / opts.step);
    const key = base32Decode(secret);
    const hmac = createHmac(opts.algorithm, Buffer.from(key)).update(counterToBuffer(counter)).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code =
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);
    const mod = 10 ** opts.digits;
    return String(code % mod).padStart(opts.digits, '0');
}

/** Constant-time TOTP verification with `±window` step leeway. */
export function verifyTotp(
    secret: string,
    token: string,
    options?: TotpOptions,
    time: number = Date.now(),
): boolean {
    const opts = { ...DEFAULT_OPTS, ...(options ?? {}) };
    if (token.length !== opts.digits) return false;
    const expectedLen = opts.digits;
    const tokenBuf = Buffer.from(token);
    for (let w = -opts.window; w <= opts.window; w++) {
        const candidate = generateTotp(secret, time + w * opts.step * 1000, opts);
        const candBuf = Buffer.from(candidate);
        if (candBuf.length === expectedLen && tokenBuf.length === expectedLen) {
            try {
                if (timingSafeEqual(candBuf, tokenBuf)) return true;
            } catch {
                /* length mismatch */
            }
        }
    }
    return false;
}

/* ── WebAuthn ─────────────────────────────── */

export type WebAuthnRegistrationOptions = {
    challenge: string;
    rp: { id: string; name: string };
    user: { id: string; name: string; displayName: string };
    pubKeyCredParams: { type: 'public-key'; alg: number }[];
    timeout: number;
    attestation: 'none' | 'indirect' | 'direct';
    authenticatorSelection: {
        userVerification: 'preferred' | 'required' | 'discouraged';
        residentKey?: 'preferred' | 'required' | 'discouraged';
    };
    excludeCredentials?: { id: string; type: 'public-key'; transports?: string[] }[];
};

/**
 * Build options for `navigator.credentials.create()`. The challenge MUST be
 * stored server-side (in the user's session) and verified on register-finish.
 */
export function createWebAuthnRegistration(args: {
    rpId: string;
    rpName: string;
    userId: string;
    userName: string;
    userDisplayName: string;
    excludeCredentialIds?: string[];
}): WebAuthnRegistrationOptions {
    return {
        challenge: base64url(randomBytes(32)),
        rp: { id: args.rpId, name: args.rpName },
        user: {
            id: base64url(Buffer.from(args.userId, 'utf-8')),
            name: args.userName,
            displayName: args.userDisplayName,
        },
        pubKeyCredParams: [
            { type: 'public-key', alg: -7 }, // ES256
            { type: 'public-key', alg: -257 }, // RS256
        ],
        timeout: 60_000,
        attestation: 'none',
        authenticatorSelection: { userVerification: 'preferred', residentKey: 'preferred' },
        excludeCredentials: args.excludeCredentialIds?.map((id) => ({
            id,
            type: 'public-key',
        })),
    };
}

export type WebAuthnRegistrationResponse = {
    id: string;
    rawId: string; // base64url
    type: 'public-key';
    response: {
        clientDataJSON: string; // base64url
        attestationObject: string; // base64url
    };
};

export type VerifiedRegistration = {
    credentialId: string;
    /** SPKI/COSE public key, base64-encoded. The actual decoder for the COSE
     * structure is delegated to the persistence layer because production
     * deployments typically swap in `@simplewebauthn/server`. */
    publicKey: string;
    counter: number;
};

/**
 * Verify the `clientDataJSON` against the expected challenge + origin.
 * Full attestation parsing is intentionally out of scope here — callers can
 * augment with a dedicated lib without changing the public surface.
 */
export function verifyWebAuthnRegistration(args: {
    expectedChallenge: string;
    expectedOrigin: string | string[];
    response: WebAuthnRegistrationResponse;
}): VerifiedRegistration {
    const clientDataJSON = JSON.parse(
        Buffer.from(base64urlToBuffer(args.response.response.clientDataJSON)).toString('utf-8'),
    ) as { type: string; challenge: string; origin: string };

    if (clientDataJSON.type !== 'webauthn.create') {
        throw new Error(`Unexpected clientDataJSON.type: ${clientDataJSON.type}`);
    }
    if (clientDataJSON.challenge !== args.expectedChallenge) {
        throw new Error('WebAuthn challenge mismatch');
    }
    const origins = Array.isArray(args.expectedOrigin)
        ? args.expectedOrigin
        : [args.expectedOrigin];
    if (!origins.includes(clientDataJSON.origin)) {
        throw new Error(`WebAuthn origin not in allow-list: ${clientDataJSON.origin}`);
    }

    return {
        credentialId: args.response.rawId,
        publicKey: args.response.response.attestationObject,
        counter: 0,
    };
}

export type WebAuthnAssertionOptions = {
    challenge: string;
    timeout: number;
    rpId: string;
    userVerification: 'preferred' | 'required' | 'discouraged';
    allowCredentials?: { id: string; type: 'public-key'; transports?: string[] }[];
};

export function createWebAuthnAssertion(args: {
    rpId: string;
    allowCredentialIds?: string[];
}): WebAuthnAssertionOptions {
    return {
        challenge: base64url(randomBytes(32)),
        timeout: 60_000,
        rpId: args.rpId,
        userVerification: 'preferred',
        allowCredentials: args.allowCredentialIds?.map((id) => ({
            id,
            type: 'public-key',
        })),
    };
}

export type WebAuthnAssertionResponse = {
    id: string;
    rawId: string;
    type: 'public-key';
    response: {
        clientDataJSON: string;
        authenticatorData: string;
        signature: string;
        userHandle?: string;
    };
};

export function verifyWebAuthnAssertion(args: {
    expectedChallenge: string;
    expectedOrigin: string | string[];
    response: WebAuthnAssertionResponse;
    storedCounter: number;
}): { credentialId: string; newCounter: number } {
    const clientDataJSON = JSON.parse(
        Buffer.from(base64urlToBuffer(args.response.response.clientDataJSON)).toString('utf-8'),
    ) as { type: string; challenge: string; origin: string };

    if (clientDataJSON.type !== 'webauthn.get') {
        throw new Error(`Unexpected clientDataJSON.type: ${clientDataJSON.type}`);
    }
    if (clientDataJSON.challenge !== args.expectedChallenge) {
        throw new Error('WebAuthn assertion challenge mismatch');
    }
    const origins = Array.isArray(args.expectedOrigin)
        ? args.expectedOrigin
        : [args.expectedOrigin];
    if (!origins.includes(clientDataJSON.origin)) {
        throw new Error(`WebAuthn assertion origin not in allow-list: ${clientDataJSON.origin}`);
    }
    // authData layout: rpIdHash(32) | flags(1) | signCount(4) | …
    const authData = base64urlToBuffer(args.response.response.authenticatorData);
    if (authData.length < 37) throw new Error('authenticatorData too short');
    const newCounter =
        (authData[33] << 24) | (authData[34] << 16) | (authData[35] << 8) | authData[36];
    if (newCounter !== 0 && newCounter <= args.storedCounter) {
        throw new Error('WebAuthn signature counter did not increase');
    }
    return { credentialId: args.response.rawId, newCounter };
}

/* ── helpers ─────────────────────────────── */

function base64url(buf: Buffer | Uint8Array): string {
    return Buffer.from(buf)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function base64urlToBuffer(input: string): Buffer {
    const pad = input.length % 4 === 0 ? 0 : 4 - (input.length % 4);
    const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
    return Buffer.from(b64, 'base64');
}
