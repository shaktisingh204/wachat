/**
 * Typed client for the multi-tenant Telegram **MTProto** API credentials BFF.
 *
 * Mirrors the routes registered under `/v1/telegram/api-credentials` by
 * the `telegram-api-credentials` Rust crate.
 *
 * The raw `api_hash` is **never** returned by the server — every read
 * surface exposes only `apiHashMasked` (last 4 chars). The full hash is
 * accepted on create only and lives plain at rest until the platform
 * grows an envelope-encryption helper.
 *
 * Server-only — relies on the shared JWT-issuing fetcher.
 */
import 'server-only';

import { rustFetch } from './fetcher';

const BASE = '/v1/telegram/api-credentials';

// ---------------------------------------------------------------------------
//  Envelopes
// ---------------------------------------------------------------------------

export interface AckResult {
    success: boolean;
    error?: string;
    message?: string;
    credentialId?: string;
    sessionId?: string;
    sessionStatus?: string;
}

export type CredentialStatus =
    | 'unverified'
    | 'verified'
    | 'login_pending'
    | 'login_failed'
    | 'active'
    | 'revoked';

export type SessionState =
    | 'none'
    | 'waiting_for_code'
    | 'waiting_for_password'
    | 'logged_in';

export interface CredentialRow {
    _id: string;
    projectId: string;
    userId: string;
    label?: string;
    apiId: number;
    /** Masked representation (last 4 of api_hash visible). */
    apiHashMasked: string;
    phoneNumberMasked: string;
    testMode: boolean;
    status: CredentialStatus | string;
    sessionState: SessionState | string;
    lastVerifiedAt?: string;
    lastUsedAt?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface ListResp {
    credentials: CredentialRow[];
    total: number;
    error?: string;
}

export interface DetailResp {
    credential?: CredentialRow;
    error?: string;
}

export interface CreateBody {
    projectId: string;
    label?: string;
    apiId: number;
    apiHash: string;
    phoneNumber: string;
    testMode?: boolean;
    notes?: string;
}

export interface UpdateBody {
    projectId: string;
    label?: string;
    phoneNumber?: string;
    testMode?: boolean;
    notes?: string;
}

export interface VerifyBody {
    projectId: string;
}

export interface LoginStartBody {
    projectId: string;
}

export interface LoginCodeBody {
    projectId: string;
    sessionId: string;
    code: string;
}

export interface LoginPasswordBody {
    projectId: string;
    sessionId: string;
    password: string;
}

export interface LogoutBody {
    projectId: string;
}

export interface LoginSessionRow {
    _id: string;
    credentialId: string;
    projectId: string;
    status: string;
    placeholder?: boolean;
    startedAt: string;
    updatedAt: string;
    completedAt?: string;
}

export interface ListSessionsResp {
    sessions: LoginSessionRow[];
    error?: string;
}

export interface AuditRow {
    _id: string;
    credentialId: string;
    projectId: string;
    actorId: string;
    action: string;
    detail: string;
    at: string;
}

export interface AuditListResp {
    items: AuditRow[];
    nextCursor?: string;
    error?: string;
}

export interface AuditQuery {
    projectId: string;
    credentialId?: string;
    cursor?: string;
    limit?: number;
}

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

function qs(params: Record<string, string | number | undefined | null>): string {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === '') continue;
        usp.set(k, String(v));
    }
    const s = usp.toString();
    return s ? `?${s}` : '';
}

// ---------------------------------------------------------------------------
//  Public API surface
// ---------------------------------------------------------------------------

export const telegramApiCredentialsApi = {
    list: (projectId: string) =>
        rustFetch<ListResp>(`${BASE}/${qs({ projectId })}`),

    detail: (credentialId: string, projectId: string) =>
        rustFetch<DetailResp>(
            `${BASE}/${encodeURIComponent(credentialId)}${qs({ projectId })}`,
        ),

    create: (body: CreateBody) =>
        rustFetch<AckResult>(`${BASE}/`, {
            method: 'POST',
            body: JSON.stringify(body),
        }),

    update: (credentialId: string, body: UpdateBody) =>
        rustFetch<AckResult>(`${BASE}/${encodeURIComponent(credentialId)}`, {
            method: 'PUT',
            body: JSON.stringify(body),
        }),

    /**
     * Soft-revoke when `confirm` is omitted; hard-delete (after a
     * defensive revoke) when `confirm === 'DELETE'`.
     */
    delete: (credentialId: string, projectId: string, confirm?: 'DELETE') =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(credentialId)}${qs({ projectId, confirm })}`,
            { method: 'DELETE' },
        ),

    verify: (credentialId: string, body: VerifyBody) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(credentialId)}/verify`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    loginStart: (credentialId: string, body: LoginStartBody) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(credentialId)}/login/start`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    loginCode: (credentialId: string, body: LoginCodeBody) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(credentialId)}/login/code`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    loginPassword: (credentialId: string, body: LoginPasswordBody) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(credentialId)}/login/password`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    logout: (credentialId: string, body: LogoutBody) =>
        rustFetch<AckResult>(
            `${BASE}/${encodeURIComponent(credentialId)}/logout`,
            { method: 'POST', body: JSON.stringify(body) },
        ),

    listSessions: (credentialId: string, projectId: string) =>
        rustFetch<ListSessionsResp>(
            `${BASE}/${encodeURIComponent(credentialId)}/sessions${qs({ projectId })}`,
        ),

    audit: (q: AuditQuery) =>
        rustFetch<AuditListResp>(
            `${BASE}/audit${qs(q as unknown as Record<string, string | number | undefined>)}`,
        ),
};

export type TelegramApiCredentialsApi = typeof telegramApiCredentialsApi;
