/**
 * SabCatalyst runtime route — `/api/catalyst/[projectSlug]/functions/[functionName]`.
 *
 * Authenticates via API key (NOT user session). Looks up the project
 * by slug, validates the `Authorization: Bearer sabk_…` (or
 * `x-sabcatalyst-key`) header against `sabcatalyst-api-keys`, finds the
 * named function under that project, and hands the request to
 * `IFunctionExecutor.invokeHttp`.
 *
 * The mock executor returns `{ executed: true, mocked: true, … }` with
 * HTTP 200 — wired so the whole stack is testable end-to-end before the
 * real container runtime lands.
 */
import { NextRequest, NextResponse } from 'next/server';

import { sabcatalystProjectsApi } from '@/lib/rust-client/sabcatalyst-projects';
import { sabcatalystFunctionsApi } from '@/lib/rust-client/sabcatalyst-functions';
import { sabcatalystApiKeysApi } from '@/lib/rust-client/sabcatalyst-api-keys';
import { sabcatalystInvocationsApi } from '@/lib/rust-client/sabcatalyst-function-invocations';
import { sabcatalystUsageApi } from '@/lib/rust-client/sabcatalyst-usage';
import { sha256Hex } from '@/lib/sabcatalyst/hash';
import { getFunctionExecutor } from '@/lib/sabcatalyst/executor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function unauthorized(message: string) {
    return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message } }, { status: 401 });
}
function notFound(message: string) {
    return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message } }, { status: 404 });
}

function extractApiKey(req: NextRequest): string | null {
    const auth = req.headers.get('authorization');
    if (auth) {
        const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
        if (m && m[1]) return m[1].trim();
    }
    return req.headers.get('x-sabcatalyst-key') || null;
}

function currentMonthKey(): string {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function handle(
    req: NextRequest,
    ctx: { params: Promise<{ projectSlug: string; functionName: string }> },
) {
    const { projectSlug, functionName } = await ctx.params;

    const plaintextKey = extractApiKey(req);
    if (!plaintextKey) {
        return unauthorized('Missing API key (Authorization: Bearer … or x-sabcatalyst-key).');
    }

    // 1. Resolve project by slug. The Rust list endpoint is scoped by
    //    SabNode user, but the runtime call has no user JWT. For the
    //    mock path we resolve via the slug + an in-band key lookup.
    //    Wiring TODO: add `/v1/sabcatalyst/projects/by-slug/{slug}` to
    //    the projects crate so this lookup doesn't need a user list.
    const projects = await sabcatalystProjectsApi.list({ q: projectSlug, limit: 50 }).catch(
        () => ({ items: [] as Awaited<ReturnType<typeof sabcatalystProjectsApi.list>>['items'] }),
    );
    const project = projects.items.find((p) => p.slug === projectSlug && p.status !== 'deleted');
    if (!project) return notFound(`Project '${projectSlug}' not found or deleted.`);

    // 2. Validate API key against the project (hashed compare).
    const keyHash = sha256Hex(plaintextKey);
    const apiKey = await sabcatalystApiKeysApi.lookup({ projectId: project._id, keyHash })
        .catch(() => null);
    if (!apiKey || apiKey.status !== 'active') {
        return unauthorized('Invalid or revoked API key.');
    }

    // 3. Find the function. Same wiring TODO as above — a
    //    `/by-name?projectId=&name=` endpoint would skip the list.
    const fns = await sabcatalystFunctionsApi.list({ projectId: project._id, limit: 100 });
    const fn = fns.items.find((f) => f.name === functionName && f.status === 'active');
    if (!fn) return notFound(`Function '${functionName}' not found or paused.`);

    // 4. Read body + headers + query, hand off to executor.
    const bodyText = ['GET', 'HEAD'].includes(req.method) ? '' : await req.text();
    const headers: Record<string, string> = {};
    req.headers.forEach((v, k) => { headers[k] = v; });
    const url = new URL(req.url);
    const query: Record<string, string> = {};
    url.searchParams.forEach((v, k) => { query[k] = v; });

    const t0 = Date.now();
    const executor = getFunctionExecutor();
    let result;
    try {
        result = await executor.invokeHttp({
            func: fn,
            method: req.method,
            path: url.pathname,
            headers,
            query,
            bodyText,
            sourceIp: req.headers.get('x-forwarded-for') || undefined,
        });
    } catch (err: unknown) {
        const durationMs = Date.now() - t0;
        const message = err instanceof Error ? err.message : String(err);
        await sabcatalystInvocationsApi
            .record({
                functionId: fn._id,
                projectId: fn.projectId,
                durationMs,
                status: 'error',
                requestSizeBytes: bodyText.length,
                responseSizeBytes: 0,
                errorMessage: message,
                billableMs: durationMs,
            })
            .catch(() => {});
        return NextResponse.json(
            { ok: false, error: { code: 'EXECUTOR_ERROR', message } },
            { status: 500 },
        );
    }

    // 5. Record invocation + bump usage (fire-and-forget on errors).
    await Promise.allSettled([
        sabcatalystInvocationsApi.record({
            functionId: fn._id,
            projectId: fn.projectId,
            durationMs: result.durationMs,
            status: result.invocationStatus,
            requestSizeBytes: bodyText.length,
            responseSizeBytes: result.bodyText.length,
            errorMessage: result.errorMessage,
            billableMs: result.billableMs,
        }),
        sabcatalystUsageApi.increment({
            projectId: fn.projectId,
            period: 'monthly',
            periodKey: currentMonthKey(),
            functionInvocations: 1,
            functionBillableMs: result.billableMs,
            bandwidthBytes: bodyText.length + result.bodyText.length,
        }),
    ]);

    return new NextResponse(result.bodyText, {
        status: result.status,
        headers: result.headers,
    });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
