
'use server';

import { assertSafeOutboundUrl } from './url-guard';

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const REQUEST_TIMEOUT_MS = 15_000;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

function parseMaybeJson(raw: any) {
    if (raw === undefined || raw === null) return undefined;
    if (typeof raw !== 'string') return raw;
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    try {
        return JSON.parse(trimmed);
    } catch {
        return raw;
    }
}

export async function executeHookAction(
    actionName: string,
    inputs: any,
    _user: any,
    logger: any
) {
    try {
        switch (actionName) {
            case 'sendWebhook': {
                const rawUrl = String(inputs.url ?? '').trim();
                if (!rawUrl) throw new Error('url is required.');
                const safeUrl = await assertSafeOutboundUrl(rawUrl);
                const url = safeUrl.toString();
                const methodRaw = String(inputs.method ?? 'POST').toUpperCase().trim();
                const method = ALLOWED_METHODS.has(methodRaw) ? methodRaw : 'POST';

                const headers: Record<string, string> = {};
                const parsedHeaders = parseMaybeJson(inputs.headers);
                if (parsedHeaders && typeof parsedHeaders === 'object' && !Array.isArray(parsedHeaders)) {
                    for (const [k, v] of Object.entries(parsedHeaders)) {
                        headers[k] = String(v);
                    }
                }

                let body: string | undefined;
                if (method !== 'GET' && inputs.body !== undefined && inputs.body !== null && inputs.body !== '') {
                    const parsedBody = parseMaybeJson(inputs.body);
                    if (typeof parsedBody === 'object') {
                        body = JSON.stringify(parsedBody);
                        if (!headers['Content-Type'] && !headers['content-type']) {
                            headers['Content-Type'] = 'application/json';
                        }
                    } else {
                        body = String(parsedBody);
                    }
                }

                logger.log(`[Hook] ${method} ${url}`);
                const res = await fetchWithTimeout(url, { method, headers, body }, REQUEST_TIMEOUT_MS);
                const text = await res.text();
                let responseBody: any = text;
                try { responseBody = JSON.parse(text); } catch { /* keep as text */ }

                return {
                    output: {
                        status: res.status,
                        ok: String(res.ok),
                        response: responseBody,
                    },
                };
            }

            case 'pingUrl': {
                const rawUrl = String(inputs.url ?? '').trim();
                if (!rawUrl) throw new Error('url is required.');
                const safeUrl = await assertSafeOutboundUrl(rawUrl);
                const url = safeUrl.toString();
                const started = Date.now();
                try {
                    const res = await fetchWithTimeout(url, { method: 'GET' }, REQUEST_TIMEOUT_MS);
                    const durationMs = Date.now() - started;
                    logger.log(`[Hook] pinged ${url} → ${res.status} in ${durationMs}ms`);
                    return {
                        output: {
                            status: res.status,
                            ok: String(res.ok),
                            durationMs,
                        },
                    };
                } catch (err: any) {
                    const durationMs = Date.now() - started;
                    return {
                        output: { status: 0, ok: 'false', durationMs },
                        error: `Ping failed: ${err.message || err}`,
                    };
                }
            }

            default:
                return { error: `Hook action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Hook action failed.' };
    }
}
