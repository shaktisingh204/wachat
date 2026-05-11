'use server';

/**
 * Server-action wrappers for the Telegram MTProto API credentials BFF.
 *
 * Thin pass-through to `rustClient.telegramApiCredentials`. Errors are
 * normalised into `{ success, error }` (for ack-style endpoints) or a
 * stable empty-shape response (for list endpoints) so client components
 * never have to unwrap a `RustApiError`.
 *
 * The raw `api_hash` only flows **into** the system here (on create);
 * it is never returned by any action.
 */

import { rustClient, RustApiError } from '@/lib/rust-client';
import type {
    AckResult,
    AuditListResp,
    AuditQuery,
    CreateBody,
    DetailResp,
    ListResp,
    ListSessionsResp,
    LoginCodeBody,
    LoginPasswordBody,
    LoginStartBody,
    LogoutBody,
    UpdateBody,
    VerifyBody,
} from '@/lib/rust-client/telegram-api-credentials';

function asErr(e: unknown): AckResult {
    const msg = e instanceof RustApiError ? e.message : String(e);
    return { success: false, error: msg };
}

// -- Read --------------------------------------------------------------

export async function listTelegramApiCredentialsAction(
    projectId: string,
): Promise<ListResp> {
    try {
        return await rustClient.telegramApiCredentials.list(projectId);
    } catch (e) {
        // Rust route missing or backend down — read straight from Mongo
        // so the credentials section renders an empty/correct list
        // instead of a red error banner.
        if (
            e instanceof RustApiError &&
            (e.status === 404 || e.status >= 500 || e.status === 0)
        ) {
            try {
                const { ObjectId } = await import('mongodb');
                const { connectToDatabase } = await import('@/lib/mongodb');
                if (!ObjectId.isValid(projectId)) {
                    return { credentials: [], total: 0 };
                }
                const { db } = await connectToDatabase();
                const docs = await db
                    .collection('telegram_api_credentials')
                    .find({ projectId: new ObjectId(projectId) })
                    .sort({ createdAt: -1 })
                    .limit(50)
                    .toArray();
                const credentials = docs.map((d: any) => ({
                    _id: d._id.toString(),
                    label: d.label,
                    apiId: Number(d.apiId ?? 0),
                    phoneNumberMasked: maskPhone(d.phoneNumber ?? ''),
                    apiHashMasked: maskHash(d.apiHash ?? ''),
                    status: d.status ?? 'unverified',
                    testMode: Boolean(d.testMode),
                    createdAt:
                        d.createdAt instanceof Date
                            ? d.createdAt.toISOString()
                            : String(d.createdAt ?? ''),
                    updatedAt:
                        d.updatedAt instanceof Date
                            ? d.updatedAt.toISOString()
                            : String(d.updatedAt ?? ''),
                })) as any;
                return { credentials, total: credentials.length };
            } catch {
                return { credentials: [], total: 0 };
            }
        }
        return {
            credentials: [],
            total: 0,
            error: e instanceof RustApiError ? e.message : String(e),
        };
    }
}

function maskPhone(p: string): string {
    if (!p) return '';
    if (p.length <= 4) return p;
    return `${p.slice(0, 3)}…${p.slice(-2)}`;
}
function maskHash(h: string): string {
    if (!h) return '';
    if (h.length <= 8) return '…';
    return `${h.slice(0, 4)}…${h.slice(-4)}`;
}

export async function getTelegramApiCredentialAction(
    credentialId: string,
    projectId: string,
): Promise<DetailResp> {
    try {
        return await rustClient.telegramApiCredentials.detail(credentialId, projectId);
    } catch (e) {
        return { error: e instanceof RustApiError ? e.message : String(e) };
    }
}

// -- Write -------------------------------------------------------------

export async function createTelegramApiCredentialAction(
    body: CreateBody,
): Promise<AckResult> {
    try {
        return await rustClient.telegramApiCredentials.create(body);
    } catch (e) {
        return asErr(e);
    }
}

export async function updateTelegramApiCredentialAction(
    credentialId: string,
    body: UpdateBody,
): Promise<AckResult> {
    try {
        return await rustClient.telegramApiCredentials.update(credentialId, body);
    } catch (e) {
        return asErr(e);
    }
}

export async function revokeTelegramApiCredentialAction(
    credentialId: string,
    projectId: string,
): Promise<AckResult> {
    try {
        return await rustClient.telegramApiCredentials.delete(credentialId, projectId);
    } catch (e) {
        return asErr(e);
    }
}

export async function deleteTelegramApiCredentialAction(
    credentialId: string,
    projectId: string,
): Promise<AckResult> {
    try {
        return await rustClient.telegramApiCredentials.delete(
            credentialId,
            projectId,
            'DELETE',
        );
    } catch (e) {
        return asErr(e);
    }
}

// -- Verify & login flow ----------------------------------------------

export async function verifyTelegramApiCredentialAction(
    credentialId: string,
    body: VerifyBody,
): Promise<AckResult> {
    try {
        return await rustClient.telegramApiCredentials.verify(credentialId, body);
    } catch (e) {
        return asErr(e);
    }
}

export async function startTelegramApiLoginAction(
    credentialId: string,
    body: LoginStartBody,
): Promise<AckResult> {
    try {
        return await rustClient.telegramApiCredentials.loginStart(credentialId, body);
    } catch (e) {
        return asErr(e);
    }
}

export async function submitTelegramApiLoginCodeAction(
    credentialId: string,
    body: LoginCodeBody,
): Promise<AckResult> {
    try {
        return await rustClient.telegramApiCredentials.loginCode(credentialId, body);
    } catch (e) {
        return asErr(e);
    }
}

export async function submitTelegramApiLoginPasswordAction(
    credentialId: string,
    body: LoginPasswordBody,
): Promise<AckResult> {
    try {
        return await rustClient.telegramApiCredentials.loginPassword(credentialId, body);
    } catch (e) {
        return asErr(e);
    }
}

export async function logoutTelegramApiCredentialAction(
    credentialId: string,
    body: LogoutBody,
): Promise<AckResult> {
    try {
        return await rustClient.telegramApiCredentials.logout(credentialId, body);
    } catch (e) {
        return asErr(e);
    }
}

// -- Sessions & audit --------------------------------------------------

export async function listTelegramApiCredentialSessionsAction(
    credentialId: string,
    projectId: string,
): Promise<ListSessionsResp> {
    try {
        return await rustClient.telegramApiCredentials.listSessions(credentialId, projectId);
    } catch (e) {
        return {
            sessions: [],
            error: e instanceof RustApiError ? e.message : String(e),
        };
    }
}

export async function listTelegramApiCredentialAuditAction(
    q: AuditQuery,
): Promise<AuditListResp> {
    try {
        return await rustClient.telegramApiCredentials.audit(q);
    } catch (e) {
        return {
            items: [],
            error: e instanceof RustApiError ? e.message : String(e),
        };
    }
}

export type {
    AckResult,
    AuditListResp,
    AuditRow,
    AuditQuery,
    CreateBody,
    CredentialRow,
    DetailResp,
    ListResp,
    ListSessionsResp,
    LoginCodeBody,
    LoginPasswordBody,
    LoginSessionRow,
    LoginStartBody,
    LogoutBody,
    UpdateBody,
    VerifyBody,
} from '@/lib/rust-client/telegram-api-credentials';
