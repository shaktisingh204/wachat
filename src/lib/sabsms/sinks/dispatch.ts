/**
 * SabSMS v3.7 — sink delivery.
 *
 * Routes a built envelope to each matching sink: signed HTTP POST for the
 * HTTP kinds (reusing the `webhooks-out` HMAC signing + backoff schedule),
 * or a streaming transport for kafka/kinesis. All IO is injected, so the
 * routing + retry-classification logic is unit-tested with no network.
 *
 * The live consumer worker (read `sabsms:events` Redis stream → buildEnvelope
 * → fanOut → persist deliveries) and the config UI are the V3.7 remainder.
 */

import type { SabsmsEventSink, SabsmsEventSinkKind } from '../types';
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  nextAttemptAt,
  signWebhookBody,
} from '../webhooks-out/core';
import {
  isHttpSink,
  serializeEnvelope,
  type EventEnvelope,
} from './sinks-core';

export interface SinkTransport {
  /** Push the serialized envelope to a streaming destination. */
  publish(
    sink: SabsmsEventSink,
    body: string,
  ): Promise<{ ok: boolean; retryable?: boolean; error?: string }>;
}

export interface SinkDeliveryDeps {
  /** HTTP POST. Resolves with the status; rejects on a network error. */
  httpPost?: (
    url: string,
    headers: Record<string, string>,
    body: string,
  ) => Promise<{ status: number }>;
  /** Streaming transports keyed by sink kind. */
  transports?: Partial<Record<SabsmsEventSinkKind, SinkTransport>>;
  now?: () => Date;
}

export interface SinkDeliveryResult {
  kind: SabsmsEventSinkKind;
  ok: boolean;
  /** Worth retrying (5xx / network / transport-retryable). */
  retryable: boolean;
  error?: string;
  /** When the next retry should run, or null if terminal/succeeded. */
  nextRetryAt: Date | null;
}

function httpHeaders(sink: SabsmsEventSink, body: string, now: Date): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (sink.secret) {
    headers[SIGNATURE_HEADER] = signWebhookBody(sink.secret, body);
    headers[TIMESTAMP_HEADER] = String(now.getTime());
  }
  return headers;
}

/** Deliver one envelope to one sink. `attemptsSoFar` counts prior failed
 *  attempts (0 on the first try) and drives the retry schedule. */
export async function deliverToSink(
  sink: SabsmsEventSink,
  env: EventEnvelope,
  attemptsSoFar: number,
  deps: SinkDeliveryDeps = {},
): Promise<SinkDeliveryResult> {
  const now = deps.now ? deps.now() : new Date();
  const body = serializeEnvelope(env);

  const settle = (ok: boolean, retryable: boolean, error?: string): SinkDeliveryResult => ({
    kind: sink.kind,
    ok,
    retryable,
    error,
    nextRetryAt: ok || !retryable ? null : nextAttemptAt(attemptsSoFar + 1, now),
  });

  if (isHttpSink(sink.kind)) {
    const url = typeof sink.config.url === 'string' ? sink.config.url : '';
    if (!url) return settle(false, false, 'sink has no url');
    const httpPost = deps.httpPost;
    if (!httpPost) return settle(false, false, 'no http transport configured');
    try {
      const { status } = await httpPost(url, httpHeaders(sink, body, now), body);
      if (status >= 200 && status < 300) return settle(true, false);
      // 5xx is transient; 4xx is the customer's misconfiguration (terminal).
      return settle(false, status >= 500, `http ${status}`);
    } catch (err) {
      return settle(false, true, err instanceof Error ? err.message : String(err));
    }
  }

  // Streaming kinds (kafka / kinesis).
  const transport = deps.transports?.[sink.kind];
  if (!transport) return settle(false, false, `no transport for "${sink.kind}"`);
  try {
    const r = await transport.publish(sink, body);
    return settle(r.ok, r.ok ? false : r.retryable ?? true, r.error);
  } catch (err) {
    return settle(false, true, err instanceof Error ? err.message : String(err));
  }
}

/** Deliver an envelope to every matching sink (first-attempt fan-out). */
export async function fanOut(
  env: EventEnvelope,
  sinks: readonly SabsmsEventSink[],
  deps: SinkDeliveryDeps = {},
): Promise<SinkDeliveryResult[]> {
  return Promise.all(sinks.map((s) => deliverToSink(s, env, 0, deps)));
}
