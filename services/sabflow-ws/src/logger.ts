/**
 * Pino logger + OTEL tracer bootstrap for the SabFlow WS gateway.
 *
 * Standard SabNode sidecar logging shape (JSON in prod, `pino-pretty` in TTY
 * dev) and the observability contract in
 * `docs/adr/sabflow-executor-observability.md` (mandatory tenant fields, no
 * payload logging, redaction of credential-shaped keys).
 *
 * Span helpers wrap connection lifecycle, room broadcast, and CRDT sync
 * operations so dashboards can filter by `sabflow.ws.*` span name.
 *
 * Dependencies (declared by sibling sub-task #1 in `services/sabflow-ws/package.json`):
 *   - `pino` ^9.3.2
 *   - `pino-pretty` ^11        (dev-only)
 *   - `@opentelemetry/api` ^1.9.1
 *   - `@opentelemetry/sdk-node` ^0.218.0
 *   - `@opentelemetry/exporter-trace-otlp-http` ^0.214.0
 *   - `@opentelemetry/resources` ^1.30.0
 *   - `@opentelemetry/semantic-conventions` ^1.30.0
 */

import pino from 'pino';
import {
  context,
  trace,
  SpanStatusCode,
  type Span,
  type Tracer,
} from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

// ---------------------------------------------------------------------------
// Mandatory log context (ADR §4) — every line emitted by `loggerFor(ctx)` is
// guaranteed to carry these fields. Missing `workspaceId` is a release blocker.
// ---------------------------------------------------------------------------

export interface LogContext {
  workspaceId: string;
  userId: string;
  docId: string;
  connectionId: string;
}

const SERVICE_NAME = 'sabflow-ws';

const isProduction = process.env.NODE_ENV === 'production';
const level = process.env.LOG_LEVEL ?? 'info';

// ---------------------------------------------------------------------------
// Pino root logger
// ---------------------------------------------------------------------------
// Privacy guardrails (ADR §6.3): the `redact` config strips credential-shaped
// fields anywhere in the log object. Frame payloads (binary buffers) and raw
// token strings must never be passed to the logger in the first place — these
// rules are the safety net, not the primary defense.

const REDACT_PATHS = [
  'token',
  '*.token',
  'password',
  '*.password',
  'secret',
  '*.secret',
  'authorization',
  '*.authorization',
  'Authorization',
  '*.Authorization',
  'headers.authorization',
  'headers.Authorization',
  'headers.cookie',
  'headers.Cookie',
  'apiKey',
  '*.apiKey',
  'api_key',
  '*.api_key',
];

export const log = pino({
  level,
  base: { svc: SERVICE_NAME },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
    remove: false,
  },
  transport:
    !isProduction && process.stdout.isTTY
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname,svc',
          },
        }
      : undefined,
});

export type Logger = typeof log;

/**
 * Returns a child logger with the mandatory tenant + session fields bound.
 * Use this for every log line emitted inside a connection's scope so the
 * `workspaceId` invariant from ADR §4 is enforced by construction.
 *
 * If an active trace context exists, `traceId` is included for log-to-trace
 * pivot in Grafana / Tempo.
 */
export function loggerFor(ctx: LogContext): Logger {
  const active = trace.getSpan(context.active());
  const traceId = active?.spanContext().traceId;
  return log.child({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    docId: ctx.docId,
    connectionId: ctx.connectionId,
    ...(traceId ? { traceId } : {}),
  });
}

// ---------------------------------------------------------------------------
// OTEL tracer bootstrap
// ---------------------------------------------------------------------------
// Initializes the Node SDK once per process. Idempotent: subsequent calls are
// no-ops so test harnesses and the bin entry can both invoke it safely.

const TRACER_NAME = 'sabnode/sabflow-ws';
let sdkStarted = false;
let sdkInstance: NodeSDK | null = null;

export function initTracing(): void {
  if (sdkStarted) return;
  sdkStarted = true;

  const endpoint =
    process.env.OTLP_ENDPOINT ??
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
    undefined;

  sdkInstance = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
    }),
    traceExporter: new OTLPTraceExporter(
      endpoint ? { url: `${endpoint.replace(/\/$/, '')}/v1/traces` } : {},
    ),
  });

  try {
    sdkInstance.start();
    log.info({ endpoint: endpoint ?? '(default)' }, 'otel tracer initialized');
  } catch (err) {
    log.error({ err }, 'otel tracer failed to initialize');
  }

  // Flush spans on shutdown so the batch processor doesn't drop the tail.
  const shutdown = async () => {
    try {
      await sdkInstance?.shutdown();
    } catch (err) {
      log.error({ err }, 'otel tracer shutdown failed');
    }
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

function tracer(): Tracer {
  return trace.getTracer(TRACER_NAME);
}

// ---------------------------------------------------------------------------
// Span helpers
// ---------------------------------------------------------------------------

interface SpanOpts {
  /** Extra attributes layered on top of the mandatory tenant fields. */
  attributes?: Record<string, string | number | boolean>;
}

async function runInSpan<T>(
  name: string,
  ctx: LogContext,
  fn: (span: Span) => Promise<T> | T,
  opts: SpanOpts = {},
): Promise<T> {
  return tracer().startActiveSpan(
    name,
    {
      attributes: {
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        docId: ctx.docId,
        connectionId: ctx.connectionId,
        ...(opts.attributes ?? {}),
      },
    },
    async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (err as Error)?.name ?? 'error',
        });
        throw err;
      } finally {
        span.end();
      }
    },
  );
}

/** Wraps a connection's lifecycle (`sabflow.ws.connection`). */
export function withConnectionSpan<T>(
  ctx: LogContext,
  fn: (span: Span) => Promise<T> | T,
  opts?: SpanOpts,
): Promise<T> {
  return runInSpan('sabflow.ws.connection', ctx, fn, opts);
}

/** Wraps a room fan-out broadcast (`sabflow.ws.broadcast`). */
export function withRoomBroadcastSpan<T>(
  ctx: LogContext,
  fn: (span: Span) => Promise<T> | T,
  opts?: SpanOpts,
): Promise<T> {
  return runInSpan('sabflow.ws.broadcast', ctx, fn, opts);
}

/** Wraps a CRDT sync exchange (`sabflow.ws.sync`). */
export function withSyncSpan<T>(
  ctx: LogContext,
  fn: (span: Span) => Promise<T> | T,
  opts?: SpanOpts,
): Promise<T> {
  return runInSpan('sabflow.ws.sync', ctx, fn, opts);
}
