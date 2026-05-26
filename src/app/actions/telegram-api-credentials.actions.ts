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
 *
 * Each read/mutation also has a direct-Mongo fallback wired through
 * `withRustFallback` — when the Rust BFF is missing (404) or down
 * (5xx/network), we read/write the relevant Mongo collection directly
 * so the dashboard still functions. The login flow stays Rust-only —
 * it can't be served from Mongo because it needs the MTProto worker.
 */

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { rustClient, RustApiError } from '@/lib/rust-client';
import type {
    AckResult,
    AuditListResp,
    AuditQuery,
    AuditRow,
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
import { isRustUnavailable, withRustFallback } from '@/lib/telegram/rust-fallback';

import { getProjectById } from './project.actions';
import { getSession } from './user.actions';

const MTPROTO_UNAVAILABLE_MSG =
    'MTProto login flow needs the Telegram backend to be deployed.';

function asErr(e: unknown): AckResult {
    const msg = e instanceof RustApiError ? e.message : String(e);
    return { success: false, error: msg };
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

function isoOf(v: unknown): string {
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'string') return v;
    return '';
}

function toCredentialRow(d: any): CredentialRow {
    return {
        _id: d._id?.toString?.() ?? String(d._id ?? ''),
        projectId: d.projectId?.toString?.() ?? String(d.projectId ?? ''),
        userId: d.userId?.toString?.() ?? String(d.userId ?? ''),
        label: d.label,
        apiId: Number(d.apiId ?? 0),
        apiHashMasked: maskHash(d.apiHash ?? ''),
        phoneNumberMasked: maskPhone(d.phoneNumber ?? ''),
        testMode: Boolean(d.testMode),
        status: d.status ?? 'unverified',
        sessionState: d.sessionState ?? 'none',
        lastVerifiedAt: d.lastVerifiedAt ? isoOf(d.lastVerifiedAt) : undefined,
        lastUsedAt: d.lastUsedAt ? isoOf(d.lastUsedAt) : undefined,
        notes: d.notes,
        createdAt: isoOf(d.createdAt),
        updatedAt: isoOf(d.updatedAt),
    };
}

/**
 * Centralised access check for fallback paths: require an authenticated
 * session + that the user can see the project. Returns the resolved
 * ObjectId, or an error string.
 */
async function assertProjectAccess(
    projectId: string,
): Promise<
    | { ok: true; projectOid: ObjectId; userOid: ObjectId }
    | { ok: false; error: string }
> {
    if (!projectId || !ObjectId.isValid(projectId)) {
        return { ok: false, error: 'Invalid project id.' };
    }
    const session = await getSession();
    if (!session?.user?._id) {
        return { ok: false, error: 'Not authenticated.' };
    }
    const project = await getProjectById(projectId);
    if (!project) {
        return { ok: false, error: 'Project not found.' };
    }
    return {
        ok: true,
        projectOid: new ObjectId(projectId),
        userOid: new ObjectId(String(session.user._id)),
    };
}

async function writeAudit(opts: {
    projectId: ObjectId;
    credentialId: ObjectId | null;
    action: string;
    actorUserId: ObjectId;
}) {
    try {
        const { db } = await connectToDatabase();
        await db.collection('telegram_api_credentials_audit').insertOne({
            projectId: opts.projectId,
            credentialId: opts.credentialId,
            action: opts.action,
            actorUserId: opts.actorUserId,
            at: new Date(),
        });
    } catch {
        // Audit is best-effort in the fallback path.
    }
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
        if (isRustUnavailable(e)) {
            try {
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
                const credentials = docs.map(toCredentialRow);
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

export async function getTelegramApiCredentialAction(
    credentialId: string,
    projectId: string,
): Promise<DetailResp> {
    try {
        return await withRustFallback<DetailResp>(
            () => rustClient.telegramApiCredentials.detail(credentialId, projectId),
            async () => {
                if (!ObjectId.isValid(credentialId) || !ObjectId.isValid(projectId)) {
                    return { error: 'Invalid id.' };
                }
                const access = await assertProjectAccess(projectId);
                if (!access.ok) return { error: access.error };
                const { db } = await connectToDatabase();
                const doc = await db
                    .collection('telegram_api_credentials')
                    .findOne({
                        _id: new ObjectId(credentialId),
                        projectId: access.projectOid,
                    });
                if (!doc) return { error: 'Credential not found.' };
                return { credential: toCredentialRow(doc) };
            },
        );
    } catch (e) {
        return { error: e instanceof RustApiError ? e.message : String(e) };
    }
}

// -- Write -------------------------------------------------------------

const HEX32_RE = /^[a-f0-9]{32}$/i;
const E164_RE = /^\+[1-9]\d{6,14}$/;

export async function createTelegramApiCredentialAction(
    body: CreateBody,
): Promise<AckResult> {
    try {
        return await withRustFallback<AckResult>(
            () => rustClient.telegramApiCredentials.create(body),
            async () => {
                const access = await assertProjectAccess(body.projectId);
                if (!access.ok) return { success: false, error: access.error };
                if (!Number.isFinite(body.apiId) || body.apiId <= 0) {
                    return { success: false, error: 'apiId must be a positive integer.' };
                }
                if (!body.apiHash || !HEX32_RE.test(body.apiHash)) {
                    return {
                        success: false,
                        error: 'apiHash must be 32 hexadecimal characters.',
                    };
                }
                if (!body.phoneNumber || !E164_RE.test(body.phoneNumber)) {
                    return {
                        success: false,
                        error: 'phoneNumber must be in E.164 format (e.g. +14155550123).',
                    };
                }
                const { db } = await connectToDatabase();
                const now = new Date();
                const ins = await db
                    .collection('telegram_api_credentials')
                    .insertOne({
                        projectId: access.projectOid,
                        userId: access.userOid,
                        label: body.label ?? null,
                        apiId: body.apiId,
                        apiHash: body.apiHash.toLowerCase(),
                        phoneNumber: body.phoneNumber,
                        testMode: Boolean(body.testMode),
                        notes: body.notes ?? null,
                        status: 'unverified',
                        sessionState: 'none',
                        createdAt: now,
                        updatedAt: now,
                    });
                const credentialId = ins.insertedId;
                await writeAudit({
                    projectId: access.projectOid,
                    credentialId,
                    action: 'create',
                    actorUserId: access.userOid,
                });
                return {
                    success: true,
                    message: 'Credentials saved.',
                    credentialId: credentialId.toString(),
                };
            },
        );
    } catch (e) {
        return asErr(e);
    }
}

export async function updateTelegramApiCredentialAction(
    credentialId: string,
    body: UpdateBody,
): Promise<AckResult> {
    try {
        return await withRustFallback<AckResult>(
            () => rustClient.telegramApiCredentials.update(credentialId, body),
            async () => {
                if (!ObjectId.isValid(credentialId)) {
                    return { success: false, error: 'Invalid credential id.' };
                }
                const access = await assertProjectAccess(body.projectId);
                if (!access.ok) return { success: false, error: access.error };
                if (
                    body.phoneNumber !== undefined &&
                    body.phoneNumber !== null &&
                    body.phoneNumber !== '' &&
                    !E164_RE.test(body.phoneNumber)
                ) {
                    return {
                        success: false,
                        error: 'phoneNumber must be in E.164 format (e.g. +14155550123).',
                    };
                }
                const { db } = await connectToDatabase();
                const now = new Date();
                const set: Record<string, unknown> = { updatedAt: now };
                if (body.label !== undefined) set.label = body.label;
                if (body.phoneNumber !== undefined) set.phoneNumber = body.phoneNumber;
                if (body.testMode !== undefined) set.testMode = Boolean(body.testMode);
                if (body.notes !== undefined) set.notes = body.notes;
                const credentialOid = new ObjectId(credentialId);
                const res = await db
                    .collection('telegram_api_credentials')
                    .updateOne(
                        { _id: credentialOid, projectId: access.projectOid },
                        { $set: set },
                    );
                if (res.matchedCount === 0) {
                    return { success: false, error: 'Credential not found.' };
                }
                await writeAudit({
                    projectId: access.projectOid,
                    credentialId: credentialOid,
                    action: 'update',
                    actorUserId: access.userOid,
                });
                return { success: true, message: 'Credentials updated.' };
            },
        );
    } catch (e) {
        return asErr(e);
    }
}

export async function revokeTelegramApiCredentialAction(
    credentialId: string,
    projectId: string,
): Promise<AckResult> {
    try {
        return await withRustFallback<AckResult>(
            () => rustClient.telegramApiCredentials.delete(credentialId, projectId),
            async () => softRevokeFallback(credentialId, projectId),
        );
    } catch (e) {
        return asErr(e);
    }
}

export async function deleteTelegramApiCredentialAction(
    credentialId: string,
    projectId: string,
): Promise<AckResult> {
    try {
        return await withRustFallback<AckResult>(
            () =>
                rustClient.telegramApiCredentials.delete(
                    credentialId,
                    projectId,
                    'DELETE',
                ),
            async () => hardDeleteFallback(credentialId, projectId),
        );
    } catch (e) {
        return asErr(e);
    }
}

async function softRevokeFallback(
    credentialId: string,
    projectId: string,
): Promise<AckResult> {
    if (!ObjectId.isValid(credentialId)) {
        return { success: false, error: 'Invalid credential id.' };
    }
    const access = await assertProjectAccess(projectId);
    if (!access.ok) return { success: false, error: access.error };
    const { db } = await connectToDatabase();
    const credentialOid = new ObjectId(credentialId);
    const res = await db.collection('telegram_api_credentials').updateOne(
        { _id: credentialOid, projectId: access.projectOid },
        {
            $set: {
                status: 'revoked',
                sessionState: 'none',
                updatedAt: new Date(),
            },
        },
    );
    if (res.matchedCount === 0) {
        return { success: false, error: 'Credential not found.' };
    }
    await writeAudit({
        projectId: access.projectOid,
        credentialId: credentialOid,
        action: 'revoke',
        actorUserId: access.userOid,
    });
    return { success: true, message: 'Credentials revoked.' };
}

async function hardDeleteFallback(
    credentialId: string,
    projectId: string,
): Promise<AckResult> {
    if (!ObjectId.isValid(credentialId)) {
        return { success: false, error: 'Invalid credential id.' };
    }
    const access = await assertProjectAccess(projectId);
    if (!access.ok) return { success: false, error: access.error };
    const { db } = await connectToDatabase();
    const credentialOid = new ObjectId(credentialId);
    const res = await db.collection('telegram_api_credentials').deleteOne({
        _id: credentialOid,
        projectId: access.projectOid,
    });
    if (res.deletedCount === 0) {
        return { success: false, error: 'Credential not found.' };
    }
    // Best-effort cleanup of dependent rows.
    try {
        const { db: db2 } = await connectToDatabase();
        await db2
            .collection('telegram_api_credentials_sessions')
            .deleteMany({ credentialId: credentialOid });
    } catch {
        // ignore
    }
    await writeAudit({
        projectId: access.projectOid,
        credentialId: credentialOid,
        action: 'delete',
        actorUserId: access.userOid,
    });
    return { success: true, message: 'Credentials deleted.' };
}

// -- Verify & login flow ----------------------------------------------

export async function verifyTelegramApiCredentialAction(
    credentialId: string,
    body: VerifyBody,
): Promise<AckResult> {
    try {
        return await withRustFallback<AckResult>(
            () => rustClient.telegramApiCredentials.verify(credentialId, body),
            async () => {
                if (!ObjectId.isValid(credentialId)) {
                    return { success: false, error: 'Invalid credential id.' };
                }
                const access = await assertProjectAccess(body.projectId);
                if (!access.ok) return { success: false, error: access.error };
                const { db } = await connectToDatabase();
                const credentialOid = new ObjectId(credentialId);
                const doc = await db
                    .collection('telegram_api_credentials')
                    .findOne({
                        _id: credentialOid,
                        projectId: access.projectOid,
                    });
                if (!doc) {
                    return { success: false, error: 'Credential not found.' };
                }
                const hashOk =
                    typeof doc.apiHash === 'string' && HEX32_RE.test(doc.apiHash);
                const phoneOk =
                    typeof doc.phoneNumber === 'string' && E164_RE.test(doc.phoneNumber);
                const apiIdOk = Number.isFinite(doc.apiId) && Number(doc.apiId) > 0;
                if (!hashOk || !phoneOk || !apiIdOk) {
                    await db.collection('telegram_api_credentials').updateOne(
                        { _id: credentialOid },
                        { $set: { status: 'unverified', updatedAt: new Date() } },
                    );
                    return {
                        success: false,
                        error: 'Stored credentials are malformed.',
                    };
                }
                const now = new Date();
                await db.collection('telegram_api_credentials').updateOne(
                    { _id: credentialOid },
                    {
                        $set: {
                            status:
                                doc.status === 'active' ? 'active' : 'verified',
                            lastVerifiedAt: now,
                            updatedAt: now,
                        },
                    },
                );
                await writeAudit({
                    projectId: access.projectOid,
                    credentialId: credentialOid,
                    action: 'verify',
                    actorUserId: access.userOid,
                });
                return {
                    success: true,
                    message: 'Soft verification passed (Rust BFF unavailable).',
                };
            },
        );
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
        if (isRustUnavailable(e)) {
            return { success: false, error: MTPROTO_UNAVAILABLE_MSG };
        }
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
        if (isRustUnavailable(e)) {
            return { success: false, error: MTPROTO_UNAVAILABLE_MSG };
        }
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
        if (isRustUnavailable(e)) {
            return { success: false, error: MTPROTO_UNAVAILABLE_MSG };
        }
        return asErr(e);
    }
}

export async function logoutTelegramApiCredentialAction(
    credentialId: string,
    body: LogoutBody,
): Promise<AckResult> {
    try {
        return await withRustFallback<AckResult>(
            () => rustClient.telegramApiCredentials.logout(credentialId, body),
            async () => {
                if (!ObjectId.isValid(credentialId)) {
                    return { success: false, error: 'Invalid credential id.' };
                }
                const access = await assertProjectAccess(body.projectId);
                if (!access.ok) return { success: false, error: access.error };
                const { db } = await connectToDatabase();
                const credentialOid = new ObjectId(credentialId);
                const res = await db.collection('telegram_api_credentials').updateOne(
                    { _id: credentialOid, projectId: access.projectOid },
                    {
                        $set: {
                            sessionState: 'none',
                            status: 'verified',
                            updatedAt: new Date(),
                        },
                    },
                );
                if (res.matchedCount === 0) {
                    return { success: false, error: 'Credential not found.' };
                }
                try {
                    await db
                        .collection('telegram_api_credentials_sessions')
                        .deleteMany({ credentialId: credentialOid });
                } catch {
                    // ignore
                }
                await writeAudit({
                    projectId: access.projectOid,
                    credentialId: credentialOid,
                    action: 'logout',
                    actorUserId: access.userOid,
                });
                return { success: true, message: 'Session cleared.' };
            },
        );
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
        return await withRustFallback<ListSessionsResp>(
            () =>
                rustClient.telegramApiCredentials.listSessions(
                    credentialId,
                    projectId,
                ),
            async () => {
                if (!ObjectId.isValid(credentialId) || !ObjectId.isValid(projectId)) {
                    return { sessions: [] };
                }
                const { db } = await connectToDatabase();
                const docs = await db
                    .collection('telegram_api_credentials_sessions')
                    .find({
                        credentialId: new ObjectId(credentialId),
                        projectId: new ObjectId(projectId),
                    })
                    .sort({ startedAt: -1 })
                    .limit(50)
                    .toArray();
                const sessions: LoginSessionRow[] = docs.map((d: any) => ({
                    _id: d._id?.toString?.() ?? String(d._id ?? ''),
                    credentialId:
                        d.credentialId?.toString?.() ?? String(d.credentialId ?? ''),
                    projectId:
                        d.projectId?.toString?.() ?? String(d.projectId ?? ''),
                    status: d.status ?? 'unknown',
                    placeholder: Boolean(d.placeholder),
                    startedAt: isoOf(d.startedAt),
                    updatedAt: isoOf(d.updatedAt),
                    completedAt: d.completedAt ? isoOf(d.completedAt) : undefined,
                }));
                return { sessions };
            },
        );
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
        return await withRustFallback<AuditListResp>(
            () => rustClient.telegramApiCredentials.audit(q),
            async () => {
                if (!ObjectId.isValid(q.projectId)) {
                    return { items: [] };
                }
                const { db } = await connectToDatabase();
                const filter: Record<string, unknown> = {
                    projectId: new ObjectId(q.projectId),
                };
                if (q.credentialId && ObjectId.isValid(q.credentialId)) {
                    filter.credentialId = new ObjectId(q.credentialId);
                }
                if (q.cursor && ObjectId.isValid(q.cursor)) {
                    filter._id = { $lt: new ObjectId(q.cursor) };
                }
                const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 200);
                const docs = await db
                    .collection('telegram_api_credentials_audit')
                    .find(filter)
                    .sort({ _id: -1 })
                    .limit(limit + 1)
                    .toArray();
                const hasMore = docs.length > limit;
                const trimmed = hasMore ? docs.slice(0, limit) : docs;
                const items: AuditRow[] = trimmed.map((d: any) => ({
                    _id: d._id?.toString?.() ?? String(d._id ?? ''),
                    credentialId:
                        d.credentialId?.toString?.() ?? String(d.credentialId ?? ''),
                    projectId:
                        d.projectId?.toString?.() ?? String(d.projectId ?? ''),
                    actorId:
                        d.actorUserId?.toString?.() ??
                        d.actorId?.toString?.() ??
                        String(d.actorUserId ?? d.actorId ?? ''),
                    action: d.action ?? '',
                    detail: typeof d.detail === 'string' ? d.detail : '',
                    at: isoOf(d.at ?? d.createdAt),
                }));
                return {
                    items,
                    nextCursor: hasMore
                        ? trimmed[trimmed.length - 1]?._id?.toString?.()
                        : undefined,
                };
            },
        );
    } catch (e) {
        return {
            items: [],
            error: e instanceof RustApiError ? e.message : String(e),
        };
    }
}

/* Types are available from '@/lib/rust-client/telegram-api-credentials' directly. */
