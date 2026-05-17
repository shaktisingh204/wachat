/**
 * Outbound webhook dispatcher (Phase 4 wiring).
 *
 * Single entry point for "send an HTTP POST somewhere external" that needs
 * to be tied back to a specific tenant / source object (an automation, a
 * dunning step, a report run). Wraps `fetch` with:
 *
 *   - sensible timeout (15s — matches the existing reports webhook helper)
 *   - JSON serialisation when `body` is a non-string object
 *   - SabNode correlation headers (`x-sabnode-source`, `x-sabnode-tenant`,
 *     `x-sabnode-source-id`) so receivers can correlate without spelunking
 *     payloads
 *   - structured failure objects (never throws)
 *
 * Signing / retries / dead-letter routing remain TODO: this dispatcher
 * intentionally stays thin so a future PR can swap in a real queue-backed
 * implementation without changing call sites.
 */
import 'server-only';

export interface DispatchOutboundWebhookInput {
    /** Owning tenant userId, used for correlation headers + audit. */
    tenantUserId?: string;
    /** Where this dispatch originated (automation / dunning / reports). */
    source?: { kind: string; id?: string };
    url: string;
    method?: 'POST' | 'PUT' | 'PATCH' | 'GET' | 'DELETE';
    headers?: Record<string, string>;
    /** If an object/array, serialised as JSON and `content-type` defaults
     *  to `application/json`. Strings are sent verbatim. */
    body?: unknown;
    /** Override the default 15s timeout. */
    timeoutMs?: number;
}

export interface DispatchOutboundWebhookResult {
    ok: boolean;
    status?: number;
    /** Up to 1KiB of the response body — for diagnostics only. */
    responseBodyPreview?: string;
    /** Machine-readable reason when `ok === false`. */
    error?: string;
}

const DEFAULT_TIMEOUT_MS = 15_000;

export async function dispatchOutboundWebhook(
    input: DispatchOutboundWebhookInput,
): Promise<DispatchOutboundWebhookResult> {
    const url = (input.url ?? '').trim();
    if (!url) return { ok: false, error: 'url_missing' };
    if (!/^https?:\/\//i.test(url)) {
        return { ok: false, error: 'url_invalid_scheme' };
    }

    const method = input.method ?? 'POST';
    const isStringBody = typeof input.body === 'string';
    const headers: Record<string, string> = {
        ...(isStringBody ? {} : { 'content-type': 'application/json' }),
        ...(input.tenantUserId ? { 'x-sabnode-tenant': input.tenantUserId } : {}),
        ...(input.source?.kind ? { 'x-sabnode-source': input.source.kind } : {}),
        ...(input.source?.id ? { 'x-sabnode-source-id': input.source.id } : {}),
        ...(input.headers ?? {}),
    };

    const body =
        input.body == null
            ? undefined
            : isStringBody
              ? (input.body as string)
              : JSON.stringify(input.body);

    const timeout = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
        const res = await fetch(url, {
            method,
            headers,
            body: method === 'GET' || method === 'DELETE' ? undefined : body,
            signal: controller.signal,
        });
        let preview: string | undefined;
        try {
            const text = await res.text();
            preview = text.length > 1024 ? `${text.slice(0, 1024)}…` : text;
        } catch {
            preview = undefined;
        }
        return {
            ok: res.ok,
            status: res.status,
            responseBodyPreview: preview,
            error: res.ok ? undefined : `http_${res.status}`,
        };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('[webhook-dispatcher] dispatch failed', {
            url,
            source: input.source,
            tenantUserId: input.tenantUserId,
            error: msg,
        });
        return {
            ok: false,
            error:
                (e as Error)?.name === 'AbortError'
                    ? 'timeout'
                    : `fetch_failed: ${msg}`,
        };
    } finally {
        clearTimeout(timer);
    }
}
