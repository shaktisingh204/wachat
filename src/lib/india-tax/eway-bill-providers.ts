/**
 * Pluggable e-way-bill provider adapter (§6.10).
 *
 * Same shape as `e-invoice-providers.ts`. E-way bills are required for
 * inter-/intra-state goods movement with consignment value > ₹50k. They
 * carry transporter id, vehicle number, distance and validity (1 day
 * per 200 km).
 *
 * Real backends: NIC EWB portal (`ewaybillgst.gov.in` /
 * `ewaybillapi.nic.in`), Cleartax, Masters India. The internal provider
 * is a deterministic mock with no network — use it everywhere in dev
 * and tests.
 *
 * NOTE: pure module (no Mongo / no fs / no network in the shipped
 * path) — `server-only` is enforced at the action layer instead.
 */

import crypto from 'node:crypto';

// ──────────────────────────────────────────────────────────────────
// Public types
// ──────────────────────────────────────────────────────────────────

export type EWayBillProviderId =
    | 'internal'
    | 'nic'
    | 'cleartax'
    | 'mastersindia';

export interface EWayBillRequest {
    /** Source invoice id (Mongo). */
    invoiceId?: string;
    /** GSTIN of the supplier. */
    fromGstin: string;
    /** GSTIN of the consignee (`URP` for unregistered). */
    toGstin?: string;
    /** Source pincode / state. */
    fromPincode: string;
    fromStateCode: string;
    /** Destination pincode / state. */
    toPincode: string;
    toStateCode: string;
    /** Total invoice value (₹). */
    totalValue: number;
    /** Distance in km (drives validity — 1 day per 200 km). */
    distanceKm: number;
    /** Transporter id (GSTIN-shaped, 15 char). */
    transporterId?: string;
    /** Vehicle number (e.g. `KA01AB1234`). */
    vehicleNumber?: string;
    /** `1`=Regular, `2`=Bill-To-Ship-To, `3`=Bill-From-Dispatch, `4`=combo. */
    transactionType?: number;
    /** Raw payload assembled by the caller (Items, HSN, …). */
    raw?: Record<string, unknown>;
}

export interface EWayBillCredentials {
    ewbUsername: string;
    ewbPassword: string;
    gstin: string;
    sandboxMode?: boolean;
}

export interface EWayBillResponse {
    /** 12-digit e-way bill number (`ewbNo`). */
    ewbNo: string;
    /** Generated-at timestamp (ISO). */
    ewbDate: string;
    /** Validity expires-at (ISO). 1 day per 200 km, min 1 day. */
    validUpto: string;
    /** Status: `success` | `failed`. */
    status: 'success' | 'failed';
    /** Raw provider response. */
    rawResponse: any;
}

export interface CancelResult {
    ok: boolean;
    cancelledAt?: string;
    rawResponse?: any;
    error?: string;
}

export interface UpdateVehicleArgs {
    ewbNo: string;
    vehicleNumber: string;
    reason: string;
    reasonCode?: string;
    placeOfChange?: string;
}

export interface ExtendValidityArgs {
    ewbNo: string;
    additionalKm: number;
    reason: string;
    reasonCode?: string;
    remainingDistance?: number;
}

export interface EWayBillProvider {
    id: EWayBillProviderId;
    generate(
        billRequest: EWayBillRequest,
        credentials: EWayBillCredentials | null,
    ): Promise<EWayBillResponse>;
    cancel(
        ewbNo: string,
        reason: string,
        credentials: EWayBillCredentials | null,
    ): Promise<CancelResult>;
    updateVehicle(
        args: UpdateVehicleArgs,
        credentials: EWayBillCredentials | null,
    ): Promise<CancelResult>;
    extendValidity(
        args: ExtendValidityArgs,
        credentials: EWayBillCredentials | null,
    ): Promise<CancelResult>;
}

// ──────────────────────────────────────────────────────────────────
// Internal provider — deterministic mock
// ──────────────────────────────────────────────────────────────────

function deterministicEwbNo(seed: string): string {
    const h = crypto.createHash('sha256').update(`ewb:${seed}`).digest('hex');
    const big = BigInt('0x' + h.slice(0, 16));
    const mod = BigInt('1000000000000'); // 12 digits
    return (big % mod).toString().padStart(12, '0');
}

/** E-way bill validity: 1 day per 200 km, with minimum of 1 day. */
function computeValidUpto(distanceKm: number, from: Date = new Date()): Date {
    const days = Math.max(1, Math.ceil((distanceKm || 0) / 200));
    const expires = new Date(from.getTime());
    expires.setDate(expires.getDate() + days);
    return expires;
}

export const InternalProvider: EWayBillProvider = {
    id: 'internal',
    async generate(req, _credentials) {
        const seed = `${req.invoiceId ?? ''}|${req.fromGstin}|${req.toPincode}|${req.vehicleNumber ?? ''}`;
        const ewbNo = deterministicEwbNo(seed);
        const now = new Date();
        return {
            ewbNo,
            ewbDate: now.toISOString(),
            validUpto: computeValidUpto(req.distanceKm, now).toISOString(),
            status: 'success',
            rawResponse: { mock: true, provider: 'internal' },
        };
    },
    async cancel(ewbNo, reason, _credentials) {
        return {
            ok: true,
            cancelledAt: new Date().toISOString(),
            rawResponse: { mock: true, provider: 'internal', ewbNo, reason },
        };
    },
    async updateVehicle(args, _credentials) {
        return {
            ok: true,
            cancelledAt: new Date().toISOString(),
            rawResponse: { mock: true, provider: 'internal', op: 'updateVehicle', ...args },
        };
    },
    async extendValidity(args, _credentials) {
        return {
            ok: true,
            cancelledAt: new Date().toISOString(),
            rawResponse: { mock: true, provider: 'internal', op: 'extendValidity', ...args },
        };
    },
};

// ──────────────────────────────────────────────────────────────────
// External provider stubs
// ──────────────────────────────────────────────────────────────────

function notConfigured(provider: string, envVar: string): never {
    throw new Error(
        `${provider} e-way bill provider is not configured. Set ${envVar}.`,
    );
}

/**
 * NIC EWB portal — `ewaybillapi.nic.in` (prod) / sandbox same host.
 *
 * Real call shape (documented for when sandbox creds land):
 *  1. POST `/ewayapi/v1.03/dec/ewayapi` with `{ action: 'GENEWAYBILL', data: encrypted }`.
 *  2. Cancel: `{ action: 'CANEWB' }`, Update vehicle: `{ action: 'VEHEWB' }`,
 *     Extend validity: `{ action: 'EXTEWB' }`.
 *  3. Auth model: same Sek-based handshake as the IRP — see NicProvider
 *     in `e-invoice-providers.ts` for the full envelope.
 */
export const NicProvider: EWayBillProvider = {
    id: 'nic',
    async generate(_req, _credentials) {
        // TODO when sandbox creds are wired: NIC `/ewayapi/v1.03/dec/ewayapi`.
        notConfigured('NIC EWB', 'NIC_EWB_CLIENT_ID');
    },
    async cancel(_ewbNo, _reason, _credentials) {
        notConfigured('NIC EWB', 'NIC_EWB_CLIENT_ID');
    },
    async updateVehicle(_args, _credentials) {
        notConfigured('NIC EWB', 'NIC_EWB_CLIENT_ID');
    },
    async extendValidity(_args, _credentials) {
        notConfigured('NIC EWB', 'NIC_EWB_CLIENT_ID');
    },
};

export const CleartaxProvider: EWayBillProvider = {
    id: 'cleartax',
    async generate(_req, _credentials) {
        // TODO when sandbox creds are wired: POST /eway/v1/generate.
        notConfigured('Cleartax', 'CLEARTAX_API_TOKEN');
    },
    async cancel(_ewbNo, _reason, _credentials) {
        notConfigured('Cleartax', 'CLEARTAX_API_TOKEN');
    },
    async updateVehicle(_args, _credentials) {
        notConfigured('Cleartax', 'CLEARTAX_API_TOKEN');
    },
    async extendValidity(_args, _credentials) {
        notConfigured('Cleartax', 'CLEARTAX_API_TOKEN');
    },
};

export const MastersIndiaProvider: EWayBillProvider = {
    id: 'mastersindia',
    async generate(_req, _credentials) {
        // TODO when sandbox creds are wired: POST /eway/v1/generate.
        notConfigured('Masters India', 'MASTERS_INDIA_CLIENT_ID');
    },
    async cancel(_ewbNo, _reason, _credentials) {
        notConfigured('Masters India', 'MASTERS_INDIA_CLIENT_ID');
    },
    async updateVehicle(_args, _credentials) {
        notConfigured('Masters India', 'MASTERS_INDIA_CLIENT_ID');
    },
    async extendValidity(_args, _credentials) {
        notConfigured('Masters India', 'MASTERS_INDIA_CLIENT_ID');
    },
};

// ──────────────────────────────────────────────────────────────────
// Factory
// ──────────────────────────────────────────────────────────────────

const PROVIDERS: Record<EWayBillProviderId, EWayBillProvider> = {
    internal: InternalProvider,
    nic: NicProvider,
    cleartax: CleartaxProvider,
    mastersindia: MastersIndiaProvider,
};

export function getEWayBillProvider(
    id?: string | null,
): EWayBillProvider {
    if (!id) return InternalProvider;
    const key = id.toLowerCase() as EWayBillProviderId;
    return PROVIDERS[key] ?? InternalProvider;
}

export { computeValidUpto };
