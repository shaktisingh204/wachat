/**
 * Pluggable e-invoice (IRN) provider adapter (§6.10).
 *
 * Mirrors the §6.2 signature-provider pattern: a small interface, an
 * always-working `InternalProvider` (deterministic mock — no network)
 * plus stubs for the external providers (Nic / Cleartax / Masters India)
 * that throw `Error("Provider not configured. Set …")` until real
 * credentials + HTTP plumbing land.
 *
 * The adapter is deliberately thin — it does NOT touch Mongo. Callers
 * (the `crm-india-einvoice.actions.ts` server actions) are responsible
 * for persisting the response on the invoice document.
 *
 * Threshold note: e-invoicing applies to GST-registered taxpayers above
 * the notified turnover (currently ₹5 cr AATO). The threshold check
 * lives at the calling layer; this module just executes the IRP call.
 *
 * NOTE: this module is pure (no Mongo / no fs / no network in the
 * shipped path) so node:test can exercise it via tsx. Do not add
 * `import 'server-only'` here — that constraint is enforced at the
 * action layer that uses these providers.
 */

import crypto from 'node:crypto';

// ──────────────────────────────────────────────────────────────────
// Public types
// ──────────────────────────────────────────────────────────────────

export type EInvoiceProviderId =
    | 'internal'
    | 'nic'
    | 'cleartax'
    | 'mastersindia';

/** Minimal subset of the IRN payload we send to a provider. Real IRP
 *  schema is far larger (40+ fields across `SellerDtls`, `BuyerDtls`,
 *  `ItemList`, `ValDtls`, …); we pass through what the caller built. */
export interface EInvoiceRequest {
    /** Mongo `_id` of the source invoice. */
    invoiceId: string;
    /** Seller GSTIN. */
    sellerGstin: string;
    /** Buyer GSTIN (or `URP` for unregistered). */
    buyerGstin?: string;
    /** Invoice number as printed. */
    invoiceNumber: string;
    /** ISO date of the invoice. */
    invoiceDate: string;
    /** Total invoice value (₹). */
    totalValue: number;
    /** Currency code (defaults to INR). */
    currency?: string;
    /** Raw payload assembled by the caller. Providers may pass-through
     *  this map; the InternalProvider ignores it. */
    raw?: Record<string, unknown>;
}

export interface EInvoiceCredentials {
    /** Per-tenant IRP credentials decrypted at the call site. */
    irpUsername: string;
    irpPassword: string;
    irpClientId?: string;
    irpClientSecret?: string;
    gstin: string;
    sandboxMode?: boolean;
}

export interface EInvoiceResponse {
    /** Invoice Reference Number — 64-char hash issued by the IRP. */
    irn: string;
    /** Acknowledgement number (14-digit numeric). */
    ackNo: string;
    /** Acknowledgement timestamp from the IRP (ISO). */
    ackDate: string;
    /** Base64-encoded QR-code payload. The IRP signs it; mock providers
     *  generate an unsigned placeholder. */
    qrCodeData: string;
    /** Base64-encoded JWT signed invoice (the SignedInvoice field). */
    signedInvoice: string;
    /** `success` or `failed`. */
    status: 'success' | 'failed';
    /** Raw provider response for debugging / audit. */
    rawResponse: any;
}

export interface CancelResult {
    ok: boolean;
    cancelledAt?: string;
    rawResponse?: any;
    error?: string;
}

export interface EInvoiceProvider {
    id: EInvoiceProviderId;
    generate(
        invoice: EInvoiceRequest,
        credentials: EInvoiceCredentials | null,
    ): Promise<EInvoiceResponse>;
    cancel(
        irn: string,
        reason: string,
        credentials: EInvoiceCredentials | null,
    ): Promise<CancelResult>;
}

// ──────────────────────────────────────────────────────────────────
// Internal provider — deterministic mock, no network
// ──────────────────────────────────────────────────────────────────

/** Deterministic 14-digit ack-no from the IRN. Same IRN → same ack-no,
 *  so dev and tests can assert exact values. */
function deterministicAckNo(seed: string): string {
    const h = crypto.createHash('sha256').update(`ack:${seed}`).digest('hex');
    // Take the first 16 hex chars, parse as bigint, mod 10^14 → 14 digits.
    const big = BigInt('0x' + h.slice(0, 16));
    const mod = BigInt('100000000000000');
    const n = big % mod;
    return n.toString().padStart(14, '0');
}

function deterministicIrn(invoiceId: string, gstin: string): string {
    const h = crypto
        .createHash('sha256')
        .update(`${invoiceId}|${gstin}`)
        .digest('hex');
    return `MOCK-${h.slice(0, 16)}`;
}

export const InternalProvider: EInvoiceProvider = {
    id: 'internal',
    async generate(invoice, _credentials) {
        const gstin = invoice.sellerGstin || 'NOGSTIN';
        const irn = deterministicIrn(invoice.invoiceId, gstin);
        const ackNo = deterministicAckNo(irn);
        const ackDate = new Date().toISOString();

        const qrPayload = {
            irn,
            gstin,
            invoiceNumber: invoice.invoiceNumber,
            total: invoice.totalValue,
            signed: false,
        };
        const qrCodeData = Buffer.from(JSON.stringify(qrPayload), 'utf8').toString(
            'base64',
        );
        // The IRP returns a JWS in `SignedInvoice`. Mock as a base64 JSON
        // blob so consumers can still decode + render.
        const signedInvoice = Buffer.from(
            JSON.stringify({ irn, ackNo, ackDate, mock: true }),
            'utf8',
        ).toString('base64');

        return {
            irn,
            ackNo,
            ackDate,
            qrCodeData,
            signedInvoice,
            status: 'success',
            rawResponse: { mock: true, provider: 'internal' },
        };
    },
    async cancel(irn, reason, _credentials) {
        return {
            ok: true,
            cancelledAt: new Date().toISOString(),
            rawResponse: { mock: true, provider: 'internal', irn, reason },
        };
    },
};

// ──────────────────────────────────────────────────────────────────
// External provider stubs — UI surfaces these but every operation
// throws "not configured" until real plumbing lands.
// ──────────────────────────────────────────────────────────────────

function notConfigured(provider: string, envVar: string): never {
    throw new Error(
        `${provider} e-invoice provider is not configured. Set ${envVar}.`,
    );
}

/**
 * NIC IRP (the official Invoice Registration Portal) — `einvoice1.gst.gov.in`
 * for production, `einv-apisandbox.nic.in` for sandbox.
 *
 * Real call shape (documented for when sandbox creds land):
 *  1. POST `/eivital/v1.04/auth` with `{ UserName, Password, AppKey, ForceRefresh }`
 *     where `AppKey` is a 32-byte AES-256 key the client generated, encrypted
 *     with the IRP RSA public key. Response: `{ Sek }` (session-encryption key,
 *     itself AES-encrypted with our AppKey).
 *  2. POST `/eicore/v1.03/Invoice` with the invoice JSON encrypted by Sek and
 *     headers `client_id`, `client_secret`, `Gstin`, `user_name`, `AuthToken`.
 *     Response (decrypt with Sek): `{ AckNo, AckDt, Irn, SignedInvoice,
 *     SignedQRCode, Status }`.
 *  3. Cancel: POST `/eicore/v1.03/Invoice/Cancel` with `{ Irn, CnlRsn, CnlRem }`.
 *
 * Errors from the IRP are returned with `{ Status: '0', ErrorDetails: [...] }`.
 */
export const NicProvider: EInvoiceProvider = {
    id: 'nic',
    async generate(_invoice, _credentials) {
        // TODO when sandbox creds are wired:
        //   const base = credentials.sandboxMode
        //     ? 'https://einv-apisandbox.nic.in'
        //     : 'https://einvoice1.gst.gov.in';
        //   const auth = await fetch(`${base}/eivital/v1.04/auth`, { … });
        //   const sek  = decryptAesKey(auth.Sek, appKey);
        //   const body = encryptWithSek(buildIrpInvoicePayload(invoice), sek);
        //   const res  = await fetch(`${base}/eicore/v1.03/Invoice`, {
        //     method: 'POST',
        //     headers: { client_id, client_secret, Gstin, user_name, AuthToken },
        //     body,
        //   });
        //   return decryptIrpResponse(await res.json(), sek);
        notConfigured('NIC IRP', 'NIC_IRP_CLIENT_ID');
    },
    async cancel(_irn, _reason, _credentials) {
        // TODO when sandbox creds are wired: see NIC `/Invoice/Cancel` above.
        notConfigured('NIC IRP', 'NIC_IRP_CLIENT_ID');
    },
};

/** Cleartax e-invoice — `https://api.cleartax.in/einv/v2/...`. ASP/GSP
 *  channel partner; auth is bearer-token. */
export const CleartaxProvider: EInvoiceProvider = {
    id: 'cleartax',
    async generate(_invoice, _credentials) {
        // TODO when sandbox creds are wired:
        //   POST https://api.cleartax.in/einv/v2/einvoice/generate
        //   Headers: Authorization: Bearer <CLEARTAX_API_TOKEN>, owner_id: <GSTIN>
        //   Body: standard IRP payload (Cleartax handles signing/IRP relay).
        notConfigured('Cleartax', 'CLEARTAX_API_TOKEN');
    },
    async cancel(_irn, _reason, _credentials) {
        // TODO when sandbox creds are wired: POST /einvoice/cancel
        notConfigured('Cleartax', 'CLEARTAX_API_TOKEN');
    },
};

/** Masters India e-invoice — `https://api.mastersindia.co/einvoice/...`.
 *  ASP/GSP channel partner; auth is OAuth2 client-credentials. */
export const MastersIndiaProvider: EInvoiceProvider = {
    id: 'mastersindia',
    async generate(_invoice, _credentials) {
        // TODO when sandbox creds are wired:
        //   1. POST https://api.mastersindia.co/oauth/token to mint access_token.
        //   2. POST https://api.mastersindia.co/einvoice/v1/generate with bearer
        //      token + `gstin` header.
        notConfigured('Masters India', 'MASTERS_INDIA_CLIENT_ID');
    },
    async cancel(_irn, _reason, _credentials) {
        // TODO when sandbox creds are wired: POST /einvoice/v1/cancel
        notConfigured('Masters India', 'MASTERS_INDIA_CLIENT_ID');
    },
};

// ──────────────────────────────────────────────────────────────────
// Factory
// ──────────────────────────────────────────────────────────────────

const PROVIDERS: Record<EInvoiceProviderId, EInvoiceProvider> = {
    internal: InternalProvider,
    nic: NicProvider,
    cleartax: CleartaxProvider,
    mastersindia: MastersIndiaProvider,
};

/** Resolve an `EInvoiceProvider` by id. Unknown / null / undefined falls
 *  back to `InternalProvider` — same pattern as `getSignatureProvider`. */
export function getEInvoiceProvider(
    id?: string | null,
): EInvoiceProvider {
    if (!id) return InternalProvider;
    const key = id.toLowerCase() as EInvoiceProviderId;
    return PROVIDERS[key] ?? InternalProvider;
}
