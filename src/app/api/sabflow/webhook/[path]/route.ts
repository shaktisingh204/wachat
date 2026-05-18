/**
 * SabFlow — Catch-all webhook receiver (Phase 6 sub-task #1 of 10).
 *
 * Route: `/api/sabflow/webhook/<path>[/extra/segments]`
 *
 * Routes inbound HTTP traffic to the workflow whose Webhook trigger node
 * registered the matching `(path, method)` pair in the `sabflow_webhooks`
 * Mongo collection. The collection's row shape is defined by sibling #2;
 * we forward-declare it here so this file can land first.
 *
 * Each persisted row carries:
 *   {
 *     workspaceId, workflowId, nodeId,
 *     path, method,
 *     authentication, allowedOrigins, rawBody, isActive,
 *     responseMode?, plan?, credentials?,
 *   }
 *
 * Three response modes (n8n parity — see `webhook-trigger.ts` §"Response Mode"):
 *
 *   - `onReceived`  — enqueue and reply 200 immediately.
 *   - `lastNode`    — block on Redis pub/sub for the execution's terminal
 *                       status frame (max 30 s); 202 + poll URL on timeout.
 *   - `responseNode`— same wait, but on the `SABFLOW_WEBHOOK_RESPONSE`
 *                       channel so the workflow's "Webhook Respond" node
 *                       sets the response.
 *
 * The dynamic segment is named `[path]` per file-ownership, but we
 * extract the full sub-path from `request.nextUrl.pathname` so future
 * multi-segment routing (`/sabflow/webhook/a/b/c`) can land without a
 * directory rename. CORS preflights are answered out-of-band — they
 * never touch Mongo when `OPTIONS` arrives on an unknown path.
 *
 * Per-webhook rate-limit: 60 req/min, fixed bucket per wall-clock minute
 * (mirrors `sabflow/queue/rate-limit.ts` and #7's claim-side counter).
 *
 * Runtime: Node.js (Vercel Functions). Default 300 s timeout is enough
 * headroom for the 30 s held-connection cap on `lastNode` / `responseNode`.
 */

import { NextResponse, type NextRequest } from 'next/server';
import type { Collection } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { enqueueExecution } from '@/lib/sabflow/queue/enqueue';
import {
    SABFLOW_EXEC_CHANNEL,
    SABFLOW_WEBHOOK_RESPONSE,
} from '@/lib/sabflow/worker/queues';
import {
    verifyAuth,
    type CredentialResolver,
    type WebhookAuthentication,
    type WebhookHttpMethod,
    type WebhookResponseMode,
    type WebhookTriggerPayload,
} from '@/lib/sabflow/executor/nodes/webhook-trigger';
import type { NodeCredentialRequest } from '@/lib/sabflow/executor/contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Held-connection ceiling for `lastNode` / `responseNode` modes. */
const HELD_CONNECTION_TIMEOUT_MS = 30_000;

/** Per-webhook rate-limit cap (req/min). */
const PER_WEBHOOK_RATE_LIMIT = 60;
const RATE_BUCKET_TTL_SEC = 65; // 60 s window + 5 s slack

/** Route-segment prefix stripped to derive the webhook subpath. */
const ROUTE_PREFIX = '/api/sabflow/webhook/';

// ---------------------------------------------------------------------------
// Forward-declared Mongo row (sibling #2 owns the canonical schema/types).
// ---------------------------------------------------------------------------

interface SabFlowWebhookRow {
    workspaceId: string;
    workflowId: string;
    nodeId: string;
    /** Subpath after `/api/sabflow/webhook/`, no leading slash. */
    path: string;
    /** HTTP method this row matches; '*' wildcards. */
    method: WebhookHttpMethod;
    authentication: WebhookAuthentication;
    /** CSV / `*` — same shape as `WebhookTriggerOptions.allowedOrigins`. */
    allowedOrigins?: string;
    /** Preserve raw body alongside parsed JSON. */
    rawBody?: boolean;
    isActive: boolean;
    /** Defaults to `onReceived` when missing (n8n parity). */
    responseMode?: WebhookResponseMode;
    /** Plan tier the enqueue path uses for concurrency caps. */
    plan?: string;
    /**
     * Resolved credentials snapshot (sibling #2 populates this; we keep the
     * lookup pure so `verifyAuth` is testable in isolation).
     */
    credentials?: {
        httpBasicAuth?: NodeCredentialRequest;
        httpHeaderAuth?: NodeCredentialRequest;
    };
}

// ---------------------------------------------------------------------------
// Method dispatch — Next.js wants one export per verb.
// ---------------------------------------------------------------------------

type RouteCtx = { params: Promise<{ path: string }> };

export async function GET(req: NextRequest, ctx: RouteCtx) {
    return handle(req, ctx, 'GET');
}
export async function POST(req: NextRequest, ctx: RouteCtx) {
    return handle(req, ctx, 'POST');
}
export async function PUT(req: NextRequest, ctx: RouteCtx) {
    return handle(req, ctx, 'PUT');
}
export async function PATCH(req: NextRequest, ctx: RouteCtx) {
    return handle(req, ctx, 'PATCH');
}
export async function DELETE(req: NextRequest, ctx: RouteCtx) {
    return handle(req, ctx, 'DELETE');
}
export async function HEAD(req: NextRequest, ctx: RouteCtx) {
    return handle(req, ctx, 'HEAD');
}

/**
 * CORS preflight. We don't know which webhook (if any) the eventual request
 * targets until the actual verb arrives, so we answer permissively for the
 * preflight and re-check `allowedOrigins` on the real request. This matches
 * how Fetch's CORS spec lets the browser decide based on the preflight's
 * Access-Control-Allow-* headers — the server enforces the actual policy on
 * the real call.
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

// ---------------------------------------------------------------------------
// Core handler.
// ---------------------------------------------------------------------------

async function handle(
    req: NextRequest,
    _ctx: RouteCtx,
    method: Exclude<WebhookHttpMethod, '*'>,
): Promise<NextResponse> {
    const t0 = Date.now();
    const subpath = extractSubpath(req.nextUrl.pathname);
    if (!subpath) {
        logEvent('webhook.miss', { reason: 'bad_prefix', method, ms: Date.now() - t0 });
        return jsonError(404, 'Webhook not found', null);
    }

    // Lookup. Method '*' rows match any verb (n8n parity).
    let webhook: SabFlowWebhookRow | null = null;
    try {
        webhook = await lookupWebhook(subpath, method);
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

    // CORS origin gate for the actual request. Preflights handled in OPTIONS().
    const origin = req.headers.get('origin');
    const corsHeaders = buildCorsHeaders(origin, webhook.allowedOrigins);
    if (origin && corsHeaders === null) {
        // Allow-list miss: short-circuit before doing any work.
        logEvent('webhook.cors_denied', {
            subpath,
            method,
            origin,
            workspaceId: webhook.workspaceId,
            workflowId: webhook.workflowId,
        });
        return jsonError(403, 'Origin not allowed', null);
    }

    // Per-webhook rate-limit (60/min, sliding window via fixed minute bucket).
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

    // Auth.
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

    // Build the synthetic payload (`WebhookTriggerPayload`).
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

    // Enqueue. `mode: 'webhook'` maps to the dispatcher's webhook entry path.
    const responseMode: WebhookResponseMode = webhook.responseMode ?? 'onReceived';
    const idempotencyKey = req.headers.get('x-idempotency-key') ?? undefined;
    let executionId: string;
    try {
        const result = await enqueueExecution({
            workspaceId: webhook.workspaceId,
            workflowId: webhook.workflowId,
            mode: 'webhook',
            triggerData: { nodeId: webhook.nodeId, payload },
            plan: webhook.plan ?? 'free',
            ...(idempotencyKey ? { idempotencyKey } : {}),
        });
        executionId = result.jobId;
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

    // Response by mode.
    if (responseMode === 'onReceived') {
        return jsonOk({ executionId, status: 'queued' }, 200, corsHeaders);
    }

    const channel =
        responseMode === 'responseNode'
            ? SABFLOW_WEBHOOK_RESPONSE(executionId)
            : SABFLOW_EXEC_CHANNEL(executionId);

    const result = await waitForExecution(channel, HELD_CONNECTION_TIMEOUT_MS);
    if (!result) {
        // Timed out — caller polls for the result. 202 + poll URL.
        const pollUrl = `${req.nextUrl.origin}/api/sabflow/executions/${executionId}`;
        return jsonOk(
            { executionId, status: 'running', pollUrl },
            202,
            corsHeaders,
        );
    }

    if (responseMode === 'responseNode') {
        // The Respond-to-Webhook node owns the response envelope: status,
        // headers, body. The frame mirrors `enqueueWebhookDelivery`'s target.
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

    // lastNode — emit the run's terminal frame.
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

// ---------------------------------------------------------------------------
// Helpers — kept private to this route file.
// ---------------------------------------------------------------------------

/** Strip the route prefix from `pathname` and trim slashes. Empty → null. */
function extractSubpath(pathname: string): string | null {
    if (!pathname.startsWith(ROUTE_PREFIX)) return null;
    const tail = pathname.slice(ROUTE_PREFIX.length).replace(/^\/+/, '').replace(/\/+$/, '');
    return tail.length > 0 ? decodeURIComponent(tail) : null;
}

/**
 * Look up `(path, method)` in `sabflow_webhooks`. Method '*' rows match any
 * verb. We use a single `findOne` with `$in` so exact-method wins over
 * wildcard via Mongo's natural ordering; sibling #2 may add an index on
 * `{ path: 1, method: 1, isActive: 1 }` once the schema lands.
 */
async function lookupWebhook(
    path: string,
    method: WebhookHttpMethod,
): Promise<SabFlowWebhookRow | null> {
    const { db } = await connectToDatabase();
    const col = db.collection('sabflow_webhooks') as unknown as Collection<SabFlowWebhookRow>;
    // Prefer exact-method row; fall back to wildcard '*' if no exact match.
    const exact = await col.findOne({ path, method, isActive: true });
    if (exact) return exact;
    return col.findOne({ path, method: '*', isActive: true });
}

/**
 * Build a `CredentialResolver` bound to the row's resolved credential
 * snapshot. Sibling #2 populates `credentials` from the workspace's
 * CredentialsHelper at activation time; we just hand the right slot to
 * `verifyAuth`.
 */
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

/**
 * Parse the inbound body. Returns the parsed form plus the raw text body
 * (always — the caller decides whether to surface it based on `rawBody`).
 */
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
        // Best-effort JSON sniffing for clients that omit Content-Type.
        try {
            return { parsed: JSON.parse(raw), raw };
        } catch {
            return { parsed: { raw }, raw };
        }
    } catch {
        return { parsed: null, raw: undefined };
    }
}

/**
 * Build CORS response headers. Returns `null` when an `origin` is present
 * and not on the allow-list; the caller short-circuits with 403.
 *
 * Allow-list grammar matches the trigger node's `WebhookTriggerOptions.allowedOrigins`:
 *   - `'*'` or empty → reflect any origin.
 *   - CSV of exact origins → match exact (case-insensitive scheme/host).
 */
function buildCorsHeaders(
    origin: string | null,
    allowedOrigins: string | undefined,
): Record<string, string> | null {
    // No origin header → not a CORS request; no headers needed.
    if (!origin) return {};
    const list = (allowedOrigins ?? '*').trim();
    if (list === '' || list === '*') {
        return {
            'Access-Control-Allow-Origin': origin,
            Vary: 'Origin',
        };
    }
    const allow = list
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    if (!allow.includes(origin.toLowerCase())) return null;
    return {
        'Access-Control-Allow-Origin': origin,
        Vary: 'Origin',
    };
}

/**
 * Per-webhook rate-limit. Mirrors `sabflow/queue/rate-limit.ts` strategy
 * (fixed bucket per wall-clock minute, INCR + EXPIRE on first hit) but
 * keyed on `(workspaceId, workflowId, nodeId)` so each webhook gets its
 * own 60/min budget, independent of plan-level execution caps.
 *
 * Fail-open on Redis errors: rate-limiting is a guard rail, not a
 * correctness invariant. The plan-level limiter inside `enqueueExecution`
 * (sibling #7, claim-side check) is the secondary line of defense.
 */
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
    /** ioredis: returns the active-subscription count once the SUBSCRIBE completes. */
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

/**
 * Lazy ioredis singleton (same convention as `queue/rate-limit.ts`). The
 * subscriber for `waitForExecution` is `duplicate()`d off this client so we
 * don't open a fresh TCP connection per request.
 */
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

/**
 * Block until a terminal frame lands on `channel`, or the timeout expires.
 * Returns `null` on timeout; the caller decides whether that's a 202 (poll
 * URL) or a different status.
 */
async function waitForExecution(
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
                        if (
                            status === 'success' ||
                            status === 'error' ||
                            status === 'cancelled'
                        ) {
                            clearTimeout(timer);
                            void subscriber?.unsubscribe(channel).catch(() => undefined);
                            void subscriber?.quit().catch(() => undefined);
                            resolve(frame);
                        }
                    } catch {
                        // malformed frame — ignore, keep listening
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

// ── Small utility helpers ─────────────────────────────────────────────────

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
    return NextResponse.json(body, {
        status,
        headers: { ...(cors ?? {}) },
    });
}

function jsonError(
    status: number,
    message: string,
    cors: Record<string, string> | null,
): NextResponse {
    return NextResponse.json({ error: message }, {
        status,
        headers: { ...(cors ?? {}) },
    });
}

/**
 * Structured log line. Centralised so operators can grep on `sabflow.webhook`
 * and pipe the JSON through their log aggregator (Datadog, Vercel Logs, etc.).
 * Kept dependency-free so the route file stays self-contained.
 */
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
