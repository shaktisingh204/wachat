/**
 * Thin wrapper around `@opentelemetry/api` so the rest of the app doesn't have
 * to depend on it directly. Two helpers:
 *
 *   - `withSpan(name, fn)` — wraps a callback in a span, recording exceptions
 *     and propagating the error.
 *   - `currentTraceId()`   — returns the active trace id (or undefined when no
 *     tracing context is active).
 *
 * The OTel API is loaded lazily so importing this file in edge / no-OTel
 * environments doesn't blow up.
 */

import { SpanStatusCode, trace, type Span, type Tracer } from '@opentelemetry/api';

const DEFAULT_TRACER_NAME = 'sabnode/ops';

let cachedTracer: Tracer | undefined;
function getTracer(): Tracer {
    if (!cachedTracer) cachedTracer = trace.getTracer(DEFAULT_TRACER_NAME);
    return cachedTracer;
}

export interface WithSpanOptions {
    /**
     * Static attributes attached to the span. Dynamic attributes can still be
     * added inside the callback via the provided `Span` argument.
     */
    attributes?: Record<string, string | number | boolean>;
    /** Override tracer name. */
    tracerName?: string;
}

/**
 * Run `fn` inside an OpenTelemetry span. Records exceptions and re-throws.
 * Returns whatever the callback returns.
 */
export async function withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T> | T,
    options: WithSpanOptions = {},
): Promise<T> {
    const tracer = options.tracerName ? trace.getTracer(options.tracerName) : getTracer();
    return tracer.startActiveSpan(name, async (span) => {
        try {
            if (options.attributes) {
                for (const [key, value] of Object.entries(options.attributes)) {
                    span.setAttribute(key, value);
                }
            }
            const result = await fn(span);
            span.setStatus({ code: SpanStatusCode.OK });
            return result;
        } catch (err) {
            span.setStatus({
                code: SpanStatusCode.ERROR,
                message: err instanceof Error ? err.message : String(err),
            });
            if (err instanceof Error) span.recordException(err);
            throw err;
        } finally {
            span.end();
        }
    });
}

/** Current trace id, or undefined when no span is active. */
export function currentTraceId(): string | undefined {
    const span = trace.getActiveSpan();
    if (!span) return undefined;
    const ctx = span.spanContext();
    if (!ctx || !ctx.traceId || ctx.traceId === '00000000000000000000000000000000') {
        return undefined;
    }
    return ctx.traceId;
}

/** Current span id, or undefined when no span is active. */
export function currentSpanId(): string | undefined {
    const span = trace.getActiveSpan();
    if (!span) return undefined;
    const ctx = span.spanContext();
    if (!ctx || !ctx.spanId) return undefined;
    return ctx.spanId;
}

/** Record an attribute on the current active span (no-op when none active). */
export function setSpanAttribute(key: string, value: string | number | boolean): void {
    const span = trace.getActiveSpan();
    span?.setAttribute(key, value);
}
