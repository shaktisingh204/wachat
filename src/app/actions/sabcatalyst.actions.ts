/**
 * SabCatalyst server actions.
 *
 * Admin-facing endpoints are scoped to the authenticated SabNode user
 * via `getSession()`. Runtime endpoints (`/api/catalyst/<slug>/...`)
 * authenticate via API key — see `src/app/api/catalyst/.../route.ts`.
 *
 * Every Rust call goes through the per-crate rust-client wrappers under
 * `@/lib/rust-client/sabcatalyst-*` so this file stays I/O-thin.
 */
'use server';

import { revalidatePath } from 'next/cache';

// Use the canonical, C4-gated getSession (the one 607 call sites use) instead of
// the legacy pure-Mongo `@/lib/actions/user.actions` variant. Same `{ user }` shape.
import { getSession } from '@/app/actions/user.actions';
import { generateApiKeySecret, generateSessionToken, sha256Hex } from '@/lib/sabcatalyst/hash';
import { getFunctionExecutor } from '@/lib/sabcatalyst/executor';

import {
    sabcatalystProjectsApi,
    type CreateProjectInput,
    type UpdateProjectInput,
    type SabcatalystProject,
} from '@/lib/rust-client/sabcatalyst-projects';
import {
    sabcatalystFunctionsApi,
    type CreateFunctionInput,
    type UpdateFunctionInput,
    type FunctionKind,
} from '@/lib/rust-client/sabcatalyst-functions';
import { sabcatalystInvocationsApi } from '@/lib/rust-client/sabcatalyst-function-invocations';
import {
    sabcatalystTablesApi,
    type TableSchema,
} from '@/lib/rust-client/sabcatalyst-tables';
import { sabcatalystRecordsApi } from '@/lib/rust-client/sabcatalyst-records';
import { sabcatalystAuthUsersApi } from '@/lib/rust-client/sabcatalyst-auth-users';
import { sabcatalystAuthSessionsApi } from '@/lib/rust-client/sabcatalyst-auth-sessions';
import { sabcatalystFileStoreApi } from '@/lib/rust-client/sabcatalyst-file-store';
import {
    sabcatalystApiKeysApi,
    type ApiKeyScope,
} from '@/lib/rust-client/sabcatalyst-api-keys';
import { sabcatalystDomainsApi } from '@/lib/rust-client/sabcatalyst-domains';
import {
    sabcatalystUsageApi,
    type UsagePeriod,
} from '@/lib/rust-client/sabcatalyst-usage';

async function requireUser(): Promise<{ userId: string }> {
    const session = await getSession();
    if (!session?.user?._id) {
        throw new Error('Not authenticated');
    }
    return { userId: String(session.user._id) };
}

function currentMonthKey(d = new Date()): string {
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
}

/* ─── Projects ───────────────────────────────────────────────────── */

export async function listSabcatalystProjects(q?: string) {
    await requireUser();
    return sabcatalystProjectsApi.list({ q, limit: 50 });
}

export async function getSabcatalystProject(id: string) {
    await requireUser();
    return sabcatalystProjectsApi.get(id);
}

export async function createSabcatalystProject(input: CreateProjectInput) {
    await requireUser();
    const out = await sabcatalystProjectsApi.create(input);
    revalidatePath('/dashboard/sabcatalyst');
    return out;
}

export async function updateSabcatalystProject(id: string, patch: UpdateProjectInput) {
    await requireUser();
    const out = await sabcatalystProjectsApi.update(id, patch);
    revalidatePath('/dashboard/sabcatalyst');
    revalidatePath(`/dashboard/sabcatalyst/${id}`);
    return out;
}

export async function deleteSabcatalystProject(id: string) {
    await requireUser();
    await sabcatalystProjectsApi.delete(id);
    revalidatePath('/dashboard/sabcatalyst');
}

/* ─── Functions ──────────────────────────────────────────────────── */

export async function listSabcatalystFunctions(projectId: string, kind?: FunctionKind) {
    await requireUser();
    return sabcatalystFunctionsApi.list({ projectId, kind });
}

export async function getSabcatalystFunction(id: string) {
    await requireUser();
    return sabcatalystFunctionsApi.get(id);
}

export async function createSabcatalystFunction(input: CreateFunctionInput) {
    await requireUser();
    const out = await sabcatalystFunctionsApi.create(input);
    revalidatePath(`/dashboard/sabcatalyst/${input.projectId}`);
    return out;
}

export async function updateSabcatalystFunction(id: string, patch: UpdateFunctionInput) {
    await requireUser();
    return sabcatalystFunctionsApi.update(id, patch);
}

export async function deleteSabcatalystFunction(id: string, projectId: string) {
    await requireUser();
    await sabcatalystFunctionsApi.delete(id);
    revalidatePath(`/dashboard/sabcatalyst/${projectId}`);
}

/**
 * Deploy a function. The ZIP must already be in SabFiles (`codeBlobFileId`).
 * The TS executor is responsible for shipping the bytes to the real runtime;
 * the rust-client mark-deployed call updates `codeBlobFileId` + `lastDeployedAt`.
 */
export async function deploySabcatalystFunction(args: {
    functionId: string;
    codeBlobFileId: string;
}) {
    await requireUser();
    const func = await sabcatalystFunctionsApi.get(args.functionId);
    const executor = getFunctionExecutor();
    const result = await executor.deployFunction({ func, codeBlobFileId: args.codeBlobFileId });
    if (!result.ok) {
        throw new Error(result.message || 'Deploy failed');
    }
    const updated = await sabcatalystFunctionsApi.markDeployed(
        args.functionId,
        args.codeBlobFileId,
    );
    revalidatePath(`/dashboard/sabcatalyst/${func.projectId}`);
    return { deployment: result, function: updated };
}

/**
 * Admin "Test invoke" — runs the function through the executor and
 * records an invocation. Used by the function-detail page.
 */
export async function invokeSabcatalystFunction(args: {
    functionId: string;
    method?: string;
    path?: string;
    bodyText?: string;
    headers?: Record<string, string>;
    query?: Record<string, string>;
}) {
    await requireUser();
    const func = await sabcatalystFunctionsApi.get(args.functionId);
    const executor = getFunctionExecutor();
    const res = await executor.invokeHttp({
        func,
        method: args.method || 'POST',
        path: args.path || '/',
        headers: args.headers || {},
        query: args.query || {},
        bodyText: args.bodyText || '',
    });
    await sabcatalystInvocationsApi.record({
        functionId: func._id,
        projectId: func.projectId,
        durationMs: res.durationMs,
        status: res.invocationStatus,
        requestSizeBytes: (args.bodyText || '').length,
        responseSizeBytes: res.bodyText.length,
        errorMessage: res.errorMessage,
        billableMs: res.billableMs,
    });
    await sabcatalystUsageApi.increment({
        projectId: func.projectId,
        period: 'monthly',
        periodKey: currentMonthKey(),
        functionInvocations: 1,
        functionBillableMs: res.billableMs,
    });
    return res;
}

export async function listSabcatalystInvocations(functionId: string, limit = 100) {
    await requireUser();
    return sabcatalystInvocationsApi.list({ functionId, limit });
}

/* ─── Datastore ──────────────────────────────────────────────────── */

export async function listSabcatalystTables(projectId: string) {
    await requireUser();
    return sabcatalystTablesApi.list({ projectId });
}
export async function createSabcatalystTable(input: {
    projectId: string;
    name: string;
    schemaJson: TableSchema;
}) {
    await requireUser();
    const out = await sabcatalystTablesApi.create(input);
    revalidatePath(`/dashboard/sabcatalyst/${input.projectId}`);
    return out;
}
export async function deleteSabcatalystTable(id: string, projectId: string) {
    await requireUser();
    await sabcatalystTablesApi.delete(id);
    revalidatePath(`/dashboard/sabcatalyst/${projectId}`);
}
export async function listSabcatalystRecords(tableId: string) {
    await requireUser();
    return sabcatalystRecordsApi.list({ tableId });
}
export async function createSabcatalystRecord(input: {
    tableId: string;
    projectId: string;
    dataJson: Record<string, unknown>;
}) {
    await requireUser();
    await sabcatalystUsageApi.increment({
        projectId: input.projectId,
        period: 'monthly',
        periodKey: currentMonthKey(),
        datastoreWrites: 1,
    });
    return sabcatalystRecordsApi.create(input);
}

/* ─── Auth users ─────────────────────────────────────────────────── */

export async function listSabcatalystAuthUsers(projectId: string, q?: string) {
    await requireUser();
    return sabcatalystAuthUsersApi.list({ projectId, q });
}

export async function signUpSabcatalystUser(
    projectId: string,
    email: string,
    password: string,
    metadataJson?: Record<string, unknown>,
) {
    await requireUser();
    if (!email || !password) throw new Error('email and password required');
    const hashedPassword = sha256Hex(password);
    return sabcatalystAuthUsersApi.create({
        projectId,
        email,
        hashedPassword,
        metadataJson,
    });
}

export async function signInSabcatalystUser(
    projectId: string,
    email: string,
    password: string,
    ctx?: { ip?: string; userAgent?: string },
): Promise<{ token: string; expiresAt: string }> {
    await requireUser();
    const wanted = sha256Hex(password);
    // Find candidate users by email and verify the hash matches.
    const list = await sabcatalystAuthUsersApi.list({ projectId, q: email });
    const match = list.items.find(
        (u) => u.email === email.toLowerCase() && u.hashedPassword === wanted,
    );
    if (!match) throw new Error('invalid credentials');
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await sabcatalystAuthSessionsApi.issue({
        authUserId: match._id,
        projectId,
        tokenHash: token.hash,
        expiresAt,
        ip: ctx?.ip,
        userAgent: ctx?.userAgent,
    });
    return { token: token.plaintext, expiresAt };
}

export async function revokeSabcatalystAuthSession(sessionId: string) {
    await requireUser();
    await sabcatalystAuthSessionsApi.revoke(sessionId);
}

/* ─── File store ─────────────────────────────────────────────────── */

export async function listSabcatalystFiles(projectId: string, keyPrefix?: string) {
    await requireUser();
    return sabcatalystFileStoreApi.list({ projectId, keyPrefix });
}

export async function registerSabcatalystFile(input: {
    projectId: string;
    key: string;
    sabfilesFileId: string;
    sizeBytes: number;
    contentType: string;
    public?: boolean;
}) {
    await requireUser();
    await sabcatalystUsageApi.increment({
        projectId: input.projectId,
        period: 'monthly',
        periodKey: currentMonthKey(),
        fileStorageBytes: input.sizeBytes,
    });
    const out = await sabcatalystFileStoreApi.create(input);
    revalidatePath(`/dashboard/sabcatalyst/${input.projectId}`);
    return out;
}

export async function deleteSabcatalystFile(id: string, projectId: string) {
    await requireUser();
    await sabcatalystFileStoreApi.delete(id);
    revalidatePath(`/dashboard/sabcatalyst/${projectId}`);
}

/* ─── API keys ───────────────────────────────────────────────────── */

export async function listSabcatalystApiKeys(projectId: string) {
    await requireUser();
    return sabcatalystApiKeysApi.list({ projectId });
}

/** Creates a new API key. The plaintext is returned exactly once. */
export async function createSabcatalystApiKey(input: {
    projectId: string;
    label: string;
    scope?: ApiKeyScope;
    expiresAt?: string;
}): Promise<{ secret: string; key: Awaited<ReturnType<typeof sabcatalystApiKeysApi.create>> }> {
    await requireUser();
    const { plaintext, hash } = generateApiKeySecret();
    const key = await sabcatalystApiKeysApi.create({
        projectId: input.projectId,
        label: input.label,
        keyHash: hash,
        scope: input.scope,
        expiresAt: input.expiresAt,
    });
    revalidatePath(`/dashboard/sabcatalyst/${input.projectId}`);
    return { secret: plaintext, key };
}

export async function revokeSabcatalystApiKey(id: string, projectId: string) {
    await requireUser();
    await sabcatalystApiKeysApi.revoke(id);
    revalidatePath(`/dashboard/sabcatalyst/${projectId}`);
}

/** Service-to-service: validate an API key plaintext for a given project. */
export async function lookupSabcatalystApiKey(projectId: string, plaintext: string) {
    await requireUser();
    return sabcatalystApiKeysApi.lookup({ projectId, keyHash: sha256Hex(plaintext) });
}

/* ─── Domains ────────────────────────────────────────────────────── */

export async function listSabcatalystDomains(projectId: string) {
    await requireUser();
    return sabcatalystDomainsApi.list(projectId);
}

export async function createSabcatalystDomain(input: { projectId: string; hostname: string }) {
    await requireUser();
    const out = await sabcatalystDomainsApi.create(input);
    revalidatePath(`/dashboard/sabcatalyst/${input.projectId}`);
    return out;
}

export async function deleteSabcatalystDomain(id: string, projectId: string) {
    await requireUser();
    await sabcatalystDomainsApi.delete(id);
    revalidatePath(`/dashboard/sabcatalyst/${projectId}`);
}

/* ─── Usage ──────────────────────────────────────────────────────── */

export async function getSabcatalystUsage(
    projectId: string,
    period: UsagePeriod = 'monthly',
    periodKey?: string,
) {
    await requireUser();
    return sabcatalystUsageApi.get({ projectId, period, periodKey });
}
