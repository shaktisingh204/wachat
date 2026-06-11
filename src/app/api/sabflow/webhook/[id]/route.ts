/**
 * SabFlow — Unified inbound webhook receiver.
 *
 * Route: `/api/sabflow/webhook/<id>`
 *
 * `<id>` is dispatched by shape:
 *   - UUIDv4 → legacy webhookId lookup (UUID-as-secret, `sabflow_webhooks`
 *     row keyed by `webhookId`). This branch preserves the older trigger
 *     subscription flow and per-flow filter evaluation.
 *   - Anything else → Phase 6 n8n-parity path lookup (row keyed by `path`),
 *     with CORS allow-list, per-webhook rate-limit, raw-body capture, and
 *     `onReceived` / `lastNode` / `responseNode` response modes.
 *
 * The two branches diverge enough (different lookup keys, different
 * enqueue paths, different feature sets) that we keep them as separate
 * internal handlers and dispatch at the verb-export boundary. Shared
 * concerns (Redis subscriber for `waitForExecution`, log shape, CORS
 * preflight) are centralised at the bottom of the file.
 */

import { NextResponse, type NextRequest } from 'next/server';
import type { Collection } from 'mongodb';
import { ObjectId } from 'mongodb';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { connectToDatabase } from '@/lib/mongodb';
import { enqueueWorkerExecution } from '@/lib/sabflow/queue/enqueue-worker';
import {
    SABFLOW_QUEUE,
    SABFLOW_EXEC_CHANNEL,
    SABFLOW_WEBHOOK_RESPONSE,
} from '@/lib/sabflow/worker/queues';
import { getWebhookByWebhookId } from '@/lib/sabflow/db';
import {
    verifyAuth,
    type CredentialResolver,
    type WebhookAuthentication,
    type WebhookHttpMethod,
    type WebhookResponseMode,
    type WebhookTriggerPayload,
} from '@/lib/sabflow/executor/nodes/webhook-trigger';
import type { NodeCredentialRequest } from '@/lib/sabflow/executor/contract';
import { evaluateFilter } from '@/lib/sabflow/docs/triggerFilters';
import type { EventFilter, SabFlowEvent, WebhookEventOptions } from '@/lib/sabflow/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HELD_CONNECTION_TIMEOUT_MS = 30_000;
const PER_WEBHOOK_RATE_LIMIT = 60;
const RATE_BUCKET_TTL_SEC = 65;
const ROUTE_PREFIX = '/api/sabflow/webhook/';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteCtx = { params: Promise<{ id: string }> };

// ── Verb exports ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, ctx: RouteCtx) {
    return dispatch(req, ctx, 'GET');
}
export async function POST(req: NextRequest, ctx: RouteCtx) {
    return dispatch(req, ctx, 'POST');
}
export async function PUT(req: NextRequest, ctx: RouteCtx) {
    return dispatch(req, ctx, 'PUT');
}
export async function PATCH(req: NextRequest, ctx: RouteCtx) {
    return dispatch(req, ctx, 'PATCH');
}
export async function DELETE(req: NextRequest, ctx: RouteCtx) {
    return dispatch(req, ctx, 'DELETE');
}
export async function HEAD(req: NextRequest, ctx: RouteCtx) {
    return dispatch(req, ctx, 'HEAD');
}

/**
 * CORS preflight. Permissive at the preflight stage — the real request
 * re-checks `allowedOrigins` (path branch) or method/auth (UUID branch).
 */
export async function OPTIONS(req: NextRequest) {
    const origin = req.headers.get('origin') ?? '*';
    const reqMethod = req.headers.get('access-control-request-method') ?? '*';
    const reqHeaders =
        req.headers.get('access-control-request-headers') ?? 'content-type,authorization';
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': `${reqMethod}, GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS`,
            'Access-Control-Allow-Headers': reqHeaders,
            'Access-Control-Max-Age': '600',
            Vary: 'Origin',
        },
    });
}

async function dispatch(
    req: NextRequest,
    ctx: RouteCtx,
    method: Exclude<WebhookHttpMethod, '*'>,
): Promise<NextResponse> {
    const { id } = await ctx.params;
    if (UUID_RE.test(id)) {
        return handleByWebhookId(req, id, method);
    }
    return handleByPath(req, method);
}

// ===========================================================================
// Branch A — Legacy UUID-keyed webhook receiver.
// ===========================================================================

interface LegacyWebhookRow {
    isActive: boolean;
    flowId: string;
    userId: string;
    method: string;
    authentication: string;
    authHeaderName?: string;
    authHeaderValue?: string;
    responseMode?: 'immediately' | 'lastNode' | 'responseNode';
    appEvent?: string;
}

let _bullQueue: Queue | null = null;
function getBullQueue(): Queue {
    if (_bullQueue) return _bullQueue;
    const redisConn = {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
        ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
    };
    _bullQueue = new Queue(SABFLOW_QUEUE, { connection: redisConn });
    return _bullQueue;
}

function pickTriggerEvent(
    flow: { events?: SabFlowEvent[] },
    appEvent: string | undefined,
): SabFlowEvent | undefined {
    const events = flow.events ?? [];
    if (events.length === 0) return undefined;
    if (appEvent) {
        const match = events.find((event) => event.appEvent === appEvent);
        if (match) return match;
    }
    return events.find((event) => event.type === 'webhook');
}

function legacyCheckAuth(req: NextRequest, webhook: LegacyWebhookRow): boolean {
    if (webhook.authentication === 'none') return true;
    if (webhook.authentication === 'header') {
        const name = (webhook.authHeaderName ?? 'Authorization').toLowerCase();
        return req.headers.get(name) === webhook.authHeaderValue;
    }
    if (webhook.authentication === 'query') {
        const token = new URL(req.url).searchParams.get('token');
        return token === webhook.authHeaderValue;
    }
    if (webhook.authentication === 'basic') {
        const header = req.headers.get('authorization') ?? '';
        if (!header.startsWith('Basic ')) return false;
        const decoded = Buffer.from(header.slice(6), 'base64').toString();
        const [user, pass] = decoded.split(':', 2);
        const [expectedUser, expectedPass] = (webhook.authHeaderValue ?? ':').split(':', 2);
        return user === expectedUser && pass === expectedPass;
    }
    return false;
}

async function handleByWebhookId(
    req: NextRequest,
    webhookId: string,
    method: Exclude<WebhookHttpMethod, '*'>,
): Promise<NextResponse> {
    const webhook = (await getWebhookByWebhookId(webhookId)) as LegacyWebhookRow | null;
    if (!webhook || !webhook.isActive) {
        return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    if (webhook.method !== 'ANY' && method !== webhook.method) {
        return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
    }

    if (!legacyCheckAuth(req, webhook)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let triggerData: unknown = null;
    const contentType = req.headers.get('content-type') ?? '';
    try {
        if (contentType.includes('application/json')) {
            triggerData = await req.json();
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
            const text = await req.text();
            triggerData = Object.fromEntries(new URLSearchParams(text));
        } else if (method !== 'GET' && method !== 'HEAD') {
            const text = await req.text();
            if (text) {
                try {
                    triggerData = JSON.parse(text);
                } catch {
                    triggerData = { raw: text };
                }
            }
        }
    } catch {
        /* ignore */
    }

    const queryParams = Object.fromEntries(new URL(req.url).searchParams);
    const payload = {
        body: triggerData,
        query: queryParams,
        headers: Object.fromEntries(req.headers),
        method,
    };

    const { db } = await connectToDatabase();
    const flow = await db.collection('sabflows').findOne(
        ObjectId.isValid(webhook.flowId)
            ? { _id: new ObjectId(webhook.flowId), userId: webhook.userId }
            : { userId: webhook.userId },
    );
    if (!flow) {
        return NextResponse.json({ error: 'Flow not found or inactive' }, { status: 404 });
    }

    const triggerEvent = pickTriggerEvent(flow as { events?: SabFlowEvent[] }, webhook.appEvent);
    const filters = ((triggerEvent?.options as WebhookEventOptions | undefined)?.filters ?? []) as EventFilter[];
    if (filters.length > 0) {
        const ok = filters.every((filter) => evaluateFilter(filter, payload));
        if (!ok) {
            return NextResponse.json(
                { status: 'filtered', reason: 'No trigger filter matched' },
                { status: 200 },
            );
        }
    }

    const executionId = new ObjectId().toHexString();
    const now = new Date();

    await db.collection('sabflow_executions').insertOne({
        executionId,
        flowId: webhook.flowId,
        projectId: webhook.userId,
        status: 'queued',
        triggerMode: 'webhook',
        startedAt: null,
        finishedAt: null,
        durationMs: null,
        error: null,
        createdAt: now,
        updatedAt: now,
    });

    await getBullQueue().add(
        'execute',
        {
            executionId,
            flowId: webhook.flowId,
            projectId: webhook.userId,
            flowSnapshot: flow,
            triggerMode: 'webhook',
            triggerData: payload,
            variables: {},
        },
        {
            removeOnComplete: { count: 1000 },
            removeOnFail: { count: 500 },
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
        },
    );

    if (webhook.responseMode === 'immediately' || !webhook.responseMode) {
        return NextResponse.json({ executionId, status: 'queued' }, { status: 200 });
    }

    const channel =
        webhook.responseMode === 'responseNode'
            ? SABFLOW_WEBHOOK_RESPONSE(executionId)
            : SABFLOW_EXEC_CHANNEL(executionId);

    const result = await waitForExecutionLegacy(channel, HELD_CONNECTION_TIMEOUT_MS);
    if (!result) {
        return NextResponse.json({ executionId, status: 'running' }, { status: 202 });
    }
    if (result.status === 'error') {
        return NextResponse.json(
            { executionId, status: 'error', error: result.error },
            { status: 500 },
        );
    }
    return NextResponse.json({ executionId, status: 'success', data: result.data ?? result });
}

async function waitForExecutionLegacy(
    channel: string,
    timeoutMs: number,
): Promise<Record<string, unknown> | null> {
    const redisConn = {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
        ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
    };
    return new Promise((resolve) => {
        let subscriber: Redis | null = null;
        const timer = setTimeout(() => {
            subscriber?.unsubscribe(channel).catch(() => {});
            subscriber?.disconnect();
            resolve(null);
        }, timeoutMs);

        try {
            subscriber = new Redis({ ...redisConn, lazyConnect: true, enableReadyCheck: false });
            subscriber
                .connect()
                .then(() => {
                    subscriber!.subscribe(channel, (err) => {
                        if (err) {
                            clearTimeout(timer);
                            resolve(null);
                            return;
                        }
                    });
                    subscriber!.on('message', (_ch: string, msg: string) => {
                        try {
                            const data = JSON.parse(msg) as Record<string, unknown>;
                            const status = data.status as string;
                            if (status === 'success' || status === 'error' || status === 'cancelled') {
                                clearTimeout(timer);
                                subscriber?.unsubscribe(channel).catch(() => {});
                                subscriber?.disconnect();
                                resolve(data);
                            }
                        } catch {
                            /* ignore malformed */
                        }
                    });
                })
                .catch(() => {
                    clearTimeout(timer);
                    resolve(null);
                });
        } catch {
            clearTimeout(timer);
            resolve(null);
        }
    });
}

// ===========================================================================
// Branch B — Phase 6 path-keyed n8n-parity receiver.
// ===========================================================================

interface SabFlowWebhookRow {
    workspaceId: string;
    workflowId: string;
    nodeId: string;
    path: string;
    method: WebhookHttpMethod;
    authentication: WebhookAuthentication;
    allowedOrigins?: string;
    rawBody?: boolean;
    isActive: boolean;
    responseMode?: WebhookResponseMode;
    plan?: string;
    credentials?: {
        httpBasicAuth?: NodeCredentialRequest;
        httpHeaderAuth?: NodeCredentialRequest;
    };
}

async function handleByPath(
    req: NextRequest,
    method: Exclude<WebhookHttpMethod, '*'>,
): Promise<NextResponse> {
    const t0 = Date.now();
    const subpath = extractSubpath(req.nextUrl.pathname);
    if (!subpath) {
        logEvent('webhook.miss', { reason: 'bad_prefix', method, ms: Date.now() - t0 });
        return jsonError(404, 'Webhook not found', null);
    }

    let webhook: SabFlowWebhookRow | null = null;
    try {
        webhook = await lookupWebhookByPath(subpath, method);
    } catch (err) {
        logEvent('webhook.lookup_error', {
            subpath,
            method,
            err: errMessage(err),
            ms: Date.now() - t0,
        });
        return jsonError(500, 'Internal error', null);
    }
    if (!webhook || !webhook.isActive) {
        logEvent('webhook.miss', { subpath, method, reason: 'no_row', ms: Date.now() - t0 });
        return jsonError(404, 'Webhook not found', null);
    }

    const origin = req.headers.get('origin');
    const corsHeaders = buildCorsHeaders(origin, webhook.allowedOrigins);
    if (origin && corsHeaders === null) {
        logEvent('webhook.cors_denied', {
            subpath,
            method,
            origin,
            workspaceId: webhook.workspaceId,
            workflowId: webhook.workflowId,
        });
        return jsonError(403, 'Origin not allowed', null);
    }

    const rate = await checkPerWebhookRate(webhook.workspaceId, webhook.workflowId, webhook.nodeId);
    if (!rate.allowed) {
        logEvent('webhook.rate_limited', {
            subpath,
            method,
            workspaceId: webhook.workspaceId,
            workflowId: webhook.workflowId,
            nodeId: webhook.nodeId,
            retryAfterSec: rate.retryAfterSec,
        });
        return new NextResponse(JSON.stringify({ error: 'Rate limit exceeded' }), {
            status: 429,
            headers: {
                'Content-Type': 'application/json',
                'Retry-After': String(rate.retryAfterSec),
                'X-RateLimit-Limit': String(PER_WEBHOOK_RATE_LIMIT),
                'X-RateLimit-Remaining': '0',
                ...(corsHeaders ?? {}),
            },
        });
    }

    const headerObj = headersToObject(req.headers);
    const credResolver = buildCredentialResolver(webhook);
    const authResult = await verifyAuth(
        headerObj as Record<string, string | undefined>,
        {},
        webhook.authentication,
        credResolver,
    );
    if (!authResult.ok) {
        logEvent('webhook.auth_failed', {
            subpath,
            method,
            workspaceId: webhook.workspaceId,
            workflowId: webhook.workflowId,
            nodeId: webhook.nodeId,
            scheme: webhook.authentication,
            reason: authResult.message,
        });
        return jsonError(authResult.status ?? 401, 'Unauthorized', corsHeaders);
    }

    const query = Object.fromEntries(req.nextUrl.searchParams.entries());
    const { parsed: body, raw: rawBody } = await parseBody(req);

    const payload: WebhookTriggerPayload = {
        headers: headerObj,
        params: { path: subpath },
        query,
        body,
        webhookUrl: `${req.nextUrl.origin}${ROUTE_PREFIX}${subpath}`,
        ...(webhook.rawBody && rawBody !== undefined ? { rawBody } : {}),
    };

    const responseMode: WebhookResponseMode = webhook.responseMode ?? 'onReceived';
    const idempotencyKey = req.headers.get('x-idempotency-key') ?? undefined;
    const executionId = new ObjectId().toHexString();
    try {
        // Idempotency: upstream providers (Stripe, Meta, …) retry deliveries.
        // First delivery claims the key → runs; retries get the original
        // executionId back without enqueueing a duplicate.
        if (idempotencyKey) {
            const idemKey = `sabflow:webhook:idem:${webhook.workflowId}:${idempotencyKey}`;
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { getRedisClient } = require('@/lib/redis') as {
                getRedisClient: () => Promise<{
                    set: (...args: unknown[]) => Promise<unknown>;
                    get: (key: string) => Promise<string | null>;
                }>;
            };
            const redis = await getRedisClient();
            const claimed = await redis.set(idemKey, executionId, 'EX', 86400, 'NX');
            if (!claimed) {
                const existing = await redis.get(idemKey);
                if (existing) {
                    return jsonOk({ executionId: existing, status: 'queued' }, 200, corsHeaders);
                }
            }
        }
        // Load the flow snapshot the worker executes. The webhook row is
        // server-registered, so the workflowId is trusted; still prefer the
        // owner-scoped lookup when the ids line up.
        const { db } = await connectToDatabase();
        const flow = ObjectId.isValid(webhook.workflowId)
            ? await db.collection('sabflows').findOne({ _id: new ObjectId(webhook.workflowId) })
            : null;
        if (!flow) {
            logEvent('webhook.flow_missing', {
                subpath,
                method,
                workspaceId: webhook.workspaceId,
                workflowId: webhook.workflowId,
            });
            return jsonError(410, 'Workflow no longer exists', corsHeaders);
        }

        const projectId = String(flow.userId ?? webhook.workspaceId);
        const now = new Date();
        await db.collection('sabflow_executions').insertOne({
            executionId,
            flowId: webhook.workflowId,
            projectId,
            status: 'queued',
            triggerMode: 'webhook',
            startedAt: null,
            finishedAt: null,
            durationMs: null,
            error: null,
            createdAt: now,
            updatedAt: now,
        });

        await enqueueWorkerExecution({
            executionId,
            flowId: webhook.workflowId,
            projectId,
            flowSnapshot: flow,
            triggerMode: 'webhook',
            triggerData: { nodeId: webhook.nodeId, payload },
            variables: {},
        });
    } catch (err) {
        logEvent('webhook.enqueue_error', {
            subpath,
            method,
            workspaceId: webhook.workspaceId,
            workflowId: webhook.workflowId,
            err: errMessage(err),
        });
        return jsonError(500, 'Failed to enqueue execution', corsHeaders);
    }
    logEvent('webhook.enqueued', {
        subpath,
        method,
        workspaceId: webhook.workspaceId,
        workflowId: webhook.workflowId,
        nodeId: webhook.nodeId,
        executionId,
        responseMode,
        ms: Date.now() - t0,
    });

    if (responseMode === 'onReceived') {
        return jsonOk({ executionId, status: 'queued' }, 200, corsHeaders);
    }

    const channel =
        responseMode === 'responseNode'
            ? SABFLOW_WEBHOOK_RESPONSE(executionId)
            : SABFLOW_EXEC_CHANNEL(executionId);

    const result = await waitForExecutionPath(channel, HELD_CONNECTION_TIMEOUT_MS);
    if (!result) {
        const pollUrl = `${req.nextUrl.origin}/api/sabflow/executions/${executionId}`;
        return jsonOk({ executionId, status: 'running', pollUrl }, 202, corsHeaders);
    }

    if (responseMode === 'responseNode') {
        const status = numberOr(result.status, 200);
        const respHeaders = isStringRecord(result.headers) ? result.headers : {};
        const body = result.body;
        return new NextResponse(typeof body === 'string' ? body : JSON.stringify(body ?? null), {
            status,
            headers: {
                'Content-Type':
                    respHeaders['Content-Type'] ?? respHeaders['content-type'] ?? 'application/json',
                ...respHeaders,
                ...(corsHeaders ?? {}),
            },
        });
    }

    if (result.status === 'error') {
        return jsonOk(
            { executionId, status: 'error', error: result.error ?? null },
            500,
            corsHeaders,
        );
    }
    return jsonOk(
        { executionId, status: 'success', data: result.data ?? result },
        200,
        corsHeaders,
    );
}

/** Strip the route prefix from `pathname` and trim slashes. Empty → null. */
function extractSubpath(pathname: string): string | null {
    if (!pathname.startsWith(ROUTE_PREFIX)) return null;
    const tail = pathname.slice(ROUTE_PREFIX.length).replace(/^\/+/, '').replace(/\/+$/, '');
    return tail.length > 0 ? decodeURIComponent(tail) : null;
}

async function lookupWebhookByPath(
    path: string,
    method: WebhookHttpMethod,
): Promise<SabFlowWebhookRow | null> {
    const { db } = await connectToDatabase();
    const col = db.collection('sabflow_webhooks') as unknown as Collection<SabFlowWebhookRow>;
    const exact = await col.findOne({ path, method, isActive: true });
    if (exact) return exact;
    return col.findOne({ path, method: '*', isActive: true });
}

function buildCredentialResolver(row: SabFlowWebhookRow): CredentialResolver {
    return async (type) => {
        const slot = row.credentials?.[type];
        if (!slot) {
            throw new Error(
                `sabflow.webhook: no credential snapshot for '${type}' on ${row.workspaceId}/${row.workflowId}/${row.nodeId}`,
            );
        }
        return slot;
    };
}

async function parseBody(
    req: NextRequest,
): Promise<{ parsed: unknown; raw: string | undefined }> {
    if (req.method === 'GET' || req.method === 'HEAD') {
        return { parsed: null, raw: undefined };
    }
    const contentType = (req.headers.get('content-type') ?? '').toLowerCase();
    try {
        const raw = await req.text();
        if (raw.length === 0) return { parsed: null, raw };
        if (contentType.includes('application/json')) {
            try {
                return { parsed: JSON.parse(raw), raw };
            } catch {
                return { parsed: { raw }, raw };
            }
        }
        if (contentType.includes('application/x-www-form-urlencoded')) {
            return { parsed: Object.fromEntries(new URLSearchParams(raw)), raw };
        }
        try {
            return { parsed: JSON.parse(raw), raw };
        } catch {
            return { parsed: { raw }, raw };
        }
    } catch {
        return { parsed: null, raw: undefined };
    }
}

function buildCorsHeaders(
    origin: string | null,
    allowedOrigins: string | undefined,
): Record<string, string> | null {
    if (!origin) return {};
    const list = (allowedOrigins ?? '*').trim();
    if (list === '' || list === '*') {
        return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
    }
    const allow = list
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    if (!allow.includes(origin.toLowerCase())) return null;
    return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
}

async function checkPerWebhookRate(
    workspaceId: string,
    workflowId: string,
    nodeId: string,
): Promise<{ allowed: boolean; retryAfterSec: number }> {
    const minute = Math.floor(Date.now() / 60_000);
    const key = `sabflow:webhook-rate:${workspaceId}:${workflowId}:${nodeId}:${minute}`;
    try {
        const client = await getWebhookRedis();
        const count = await client.incr(key);
        if (count === 1) {
            await client.expire(key, RATE_BUCKET_TTL_SEC);
        }
        if (count > PER_WEBHOOK_RATE_LIMIT) {
            await client.decr(key).catch(() => undefined);
            const retryAfterSec = Math.max(1, Math.ceil((60_000 - (Date.now() % 60_000)) / 1000));
            return { allowed: false, retryAfterSec };
        }
        return { allowed: true, retryAfterSec: 0 };
    } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[sabflow.webhook] rate-limit redis unavailable, failing open', err);
        return { allowed: true, retryAfterSec: 0 };
    }
}

interface WebhookRedisLike {
    incr(key: string): Promise<number>;
    decr(key: string): Promise<number>;
    expire(key: string, seconds: number): Promise<unknown>;
    subscribe(channel: string): Promise<unknown>;
    unsubscribe(channel: string): Promise<unknown>;
    on(event: 'message', cb: (channel: string, msg: string) => void): unknown;
    quit(): Promise<unknown>;
    duplicate(): WebhookRedisLike;
}

declare global {
    // eslint-disable-next-line no-var
    var __sabflowWebhookRedis: WebhookRedisLike | undefined;
}

async function getWebhookRedis(): Promise<WebhookRedisLike> {
    if (globalThis.__sabflowWebhookRedis) return globalThis.__sabflowWebhookRedis;
    const { default: IORedis } = await import('ioredis');
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    const client = new IORedis(url, {
        maxRetriesPerRequest: 2,
        enableReadyCheck: true,
        lazyConnect: false,
    }) as unknown as WebhookRedisLike;
    globalThis.__sabflowWebhookRedis = client;
    return client;
}

async function waitForExecutionPath(
    channel: string,
    timeoutMs: number,
): Promise<Record<string, unknown> | null> {
    let subscriber: WebhookRedisLike | null = null;
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            void subscriber?.unsubscribe(channel).catch(() => undefined);
            void subscriber?.quit().catch(() => undefined);
            resolve(null);
        }, timeoutMs);

        getWebhookRedis()
            .then((base) => {
                subscriber = base.duplicate();
                subscriber.on('message', (_ch: string, msg: string) => {
                    try {
                        const frame = JSON.parse(msg) as Record<string, unknown>;
                        const status = frame.status;
                        if (status === 'success' || status === 'error' || status === 'cancelled') {
                            clearTimeout(timer);
                            void subscriber?.unsubscribe(channel).catch(() => undefined);
                            void subscriber?.quit().catch(() => undefined);
                            resolve(frame);
                        }
                    } catch {
                        /* malformed frame — keep listening */
                    }
                });
                return subscriber.subscribe(channel);
            })
            .catch(() => {
                clearTimeout(timer);
                resolve(null);
            });
    });
}

// ===========================================================================
// Shared utilities.
// ===========================================================================

function headersToObject(h: Headers): Record<string, string> {
    const out: Record<string, string> = {};
    h.forEach((v, k) => {
        out[k] = v;
    });
    return out;
}

function isStringRecord(v: unknown): v is Record<string, string> {
    return !!v && typeof v === 'object' && !Array.isArray(v);
}

function numberOr(v: unknown, fallback: number): number {
    return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function jsonOk(
    body: unknown,
    status: number,
    cors: Record<string, string> | null,
): NextResponse {
    return NextResponse.json(body, { status, headers: { ...(cors ?? {}) } });
}

function jsonError(
    status: number,
    message: string,
    cors: Record<string, string> | null,
): NextResponse {
    return NextResponse.json({ error: message }, { status, headers: { ...(cors ?? {}) } });
}

function logEvent(event: string, fields: Record<string, unknown>): void {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ at: 'sabflow.webhook', event, ...fields }));
}

function errMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    try {
        return String(err);
    } catch {
        return '<unrepresentable error>';
    }
}
