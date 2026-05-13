import 'server-only';

/**
 * Counter helper for dual-impl actions that fell back from Rust → legacy Mongo.
 *
 * Today this just logs structured JSON to stderr (which Vercel ingests for
 * search-based alerting). A future iteration will swap to a real metrics
 * library (e.g. OpenTelemetry counter export to Vercel Observability).
 *
 * Callers should invoke `recordRustFallback({ entity, op, errorCode })`
 * inside the catch block AFTER `console.error('[entity] rust path failed; falling back', e)`
 * so the structured log lands AFTER the human-readable one.
 */
export interface RustFallbackEvent {
    entity: string;        // 'invoice', 'lead', etc.
    op: 'list' | 'get' | 'create' | 'update' | 'delete' | 'other';
    errorCode?: string;    // RustApiError.code when available
    status?: number;       // RustApiError.status when available
}

export function recordRustFallback(event: RustFallbackEvent): void {
    try {
        console.warn(JSON.stringify({
            event: 'rust_fallback',
            timestamp: new Date().toISOString(),
            ...event,
        }));
    } catch {
        // never throw from telemetry
    }
}
