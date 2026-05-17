/**
 * Pluggable signature-provider adapter (§6.2).
 *
 * Distinct from `./esign-providers.ts`, which models the *outbound*
 * "send for signature" email-delivery side already wired into
 * `sendContractForSignature`. THIS file models the higher-level
 * provider contract used by the new signature pipeline:
 *
 *   • `send(contractId, signers)`       — kick off the signing flow
 *     for one-or-many signers. The internal provider builds a magic
 *     link per signer (HMAC token) and emails it. External providers
 *     (Digio, DocuSign, Aadhaar) hand the document off to their own
 *     envelope/document API and return their provider reference.
 *
 *   • `verify(payload)`                  — validate an inbound webhook
 *     or callback. The internal provider verifies our own HMAC token
 *     shape; external providers verify their own signed payloads.
 *
 * Adapters are deliberately thin. They DO NOT mutate the contract
 * directly — they return a result the caller persists.
 */

import 'server-only';

import { buildMagicLink, getProvider as getEsignProvider } from './esign-providers';
import { issueSignerToken, verifySignerToken } from './signer-tokens';

// ──────────────────────────────────────────────────────────────────
// Public types
// ──────────────────────────────────────────────────────────────────

export type SignatureProviderId =
    | 'internal'
    | 'digio'
    | 'docusign'
    | 'aadhaar';

export interface SignerInput {
    name: string;
    email: string;
    role?: string;
    /** Optional sequence number; lower = signs first. */
    order?: number;
}

export interface SendResult {
    /** True if at least one signer was successfully notified. */
    ok: boolean;
    /** Provider-side reference (envelope id, document id, etc.). */
    providerRef?: string;
    /** Per-signer outcome — internal provider populates this; external
     *  providers may aggregate into `providerRef` instead. */
    signers?: Array<{
        email: string;
        magicLinkUrl?: string;
        ok: boolean;
        error?: string;
    }>;
    error?: string;
}

export interface VerifyArgs {
    /** Contract id from the URL/webhook. */
    contractId: string;
    /** The provider-issued (or our own) token to verify. */
    token: string;
    /** Optional raw body for HMAC-signed webhook payloads. */
    rawBody?: string;
    /** Optional headers for webhook signature verification. */
    headers?: Record<string, string>;
}

export interface VerifyResult {
    valid: boolean;
    signerEmail?: string;
    /** Reason for invalid result. */
    error?: string;
}

export interface SignatureProvider {
    id: SignatureProviderId;
    send(
        contractId: string,
        signers: SignerInput[],
        ctx: { tenantUserId: string; contractTitle: string },
    ): Promise<SendResult>;
    verify(args: VerifyArgs): Promise<VerifyResult>;
}

// ──────────────────────────────────────────────────────────────────
// Internal provider — HMAC token flow + tenant mailer
// ──────────────────────────────────────────────────────────────────

export const InternalProvider: SignatureProvider = {
    id: 'internal',
    async send(contractId, signers, { tenantUserId, contractTitle }) {
        // Use the tenant-mailer-backed `internal` esign provider for
        // actual email dispatch; we own the magic-link minting here so
        // both `requestContractSignature` and `send` share the exact
        // same token shape.
        const esign = getEsignProvider('internal');
        const results: NonNullable<SendResult['signers']> = [];
        let anyOk = false;
        for (const s of signers) {
            const email = (s.email || '').trim().toLowerCase();
            if (!email || !email.includes('@')) {
                results.push({ email: s.email, ok: false, error: 'Invalid email' });
                continue;
            }
            const token = issueSignerToken({
                contractId,
                signerEmail: email,
                tenantUserId,
            });
            const magicLinkUrl = buildMagicLink(contractId, token);
            try {
                const r = await esign.sendForSignature({
                    contractId,
                    contractTitle,
                    signerEmail: email,
                    signerName: s.name?.trim() || email,
                    magicLinkUrl,
                    tenantUserId,
                });
                if (r.ok) anyOk = true;
                results.push({
                    email,
                    magicLinkUrl,
                    ok: r.ok,
                    error: r.ok ? undefined : (r.error || 'Send failed'),
                });
            } catch (e: any) {
                results.push({
                    email,
                    magicLinkUrl,
                    ok: false,
                    error: e?.message || 'Send failed',
                });
            }
        }
        return {
            ok: anyOk,
            providerRef: 'internal-hmac',
            signers: results,
        };
    },
    async verify({ contractId, token }) {
        const v = verifySignerToken(token, { contractId });
        if (!v.valid) return { valid: false, error: v.error };
        return { valid: true, signerEmail: v.signerEmail };
    },
};

// ──────────────────────────────────────────────────────────────────
// External provider stubs — wired into the adapter map so the UI can
// surface them as selectable, but every operation throws "not
// configured" with a TODO marker until real integrations land.
// ──────────────────────────────────────────────────────────────────

function notConfigured(provider: string): never {
    // TODO(esign): wire real integration. See https://github.com/sabnode/sabnode/issues
    throw new Error(`${provider} signature provider is not configured.`);
}

export const DigioProvider: SignatureProvider = {
    id: 'digio',
    async send() {
        // TODO(esign): POST document to Digio /v3/client/document/upload
        // and create a signer-request envelope; return `providerRef`
        // as the Digio document id.
        notConfigured('Digio');
    },
    async verify() {
        // TODO(esign): verify Digio webhook signature using the
        // workspace API key + payload HMAC header.
        notConfigured('Digio');
    },
};

export const DocuSignProvider: SignatureProvider = {
    id: 'docusign',
    async send() {
        // TODO(esign): create a DocuSign envelope via the eSignature
        // REST API (POST /v2.1/accounts/{accountId}/envelopes) and
        // return the envelope id as `providerRef`.
        notConfigured('DocuSign');
    },
    async verify() {
        // TODO(esign): validate the DocuSign Connect webhook HMAC and
        // map envelope events → signer email.
        notConfigured('DocuSign');
    },
};

export const AadhaarProvider: SignatureProvider = {
    id: 'aadhaar',
    async send() {
        // TODO(esign): integrate NSDL/UIDAI Aadhaar e-Sign gateway.
        // Requires an ASP licence and a tenant-level KYC flow.
        notConfigured('Aadhaar');
    },
    async verify() {
        // TODO(esign): verify Aadhaar e-Sign success payload signature.
        notConfigured('Aadhaar');
    },
};

const PROVIDERS: Record<SignatureProviderId, SignatureProvider> = {
    internal: InternalProvider,
    digio: DigioProvider,
    docusign: DocuSignProvider,
    aadhaar: AadhaarProvider,
};

/**
 * Resolve a `SignatureProvider` by id. Unknown / `'none'` / undefined
 * falls back to the internal provider so callers always get a working
 * adapter object.
 */
export function getSignatureProvider(id?: string | null): SignatureProvider {
    if (!id) return InternalProvider;
    const key = id.toLowerCase() as SignatureProviderId;
    return PROVIDERS[key] ?? InternalProvider;
}
