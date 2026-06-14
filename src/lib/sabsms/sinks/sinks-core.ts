/**
 * SabSMS v3.7 — Event Streams + Sinks (pure core).
 *
 * Customers stream SabSMS events to their own data infra. This builds on
 * the existing `webhooks-out` machinery (signing + backoff + event naming)
 * and adds a VERSIONED envelope and multiple sink kinds. Pure logic only —
 * the transport lives in `./dispatch.ts`.
 */

import type { SabsmsEventSink, SabsmsEventSinkKind } from '../types';
import { eventMatchesFilter, publicEventName } from '../webhooks-out/events';

/** Bump when the envelope shape changes; consumers branch on this. */
export const EVENT_SCHEMA_VERSION = 1;

/** Sink kinds delivered over signed HTTP (vs. a streaming transport). */
export const HTTP_SINK_KINDS: ReadonlySet<SabsmsEventSinkKind> = new Set([
  'webhook',
  'http_batch',
  'segment',
]);

export interface EventEnvelope {
  /** Versioned schema marker. */
  v: number;
  /** Stable delivery/event id (constant across retries). */
  id: string;
  /** Public dotted event name, e.g. `message.delivered`. */
  type: string;
  /** Owning workspace. */
  workspaceId: string;
  /** Epoch ms the source event was stamped. */
  at: number;
  payload: Record<string, unknown>;
}

export interface RawEvent {
  id: string;
  /** Engine event kind (camelCase serde tag) OR an already-public name. */
  kind: string;
  workspaceId: string;
  at: number;
  payload: Record<string, unknown>;
}

/** Build the versioned, consistent envelope from a raw engine/stream event. */
export function buildEventEnvelope(e: RawEvent): EventEnvelope {
  return {
    v: EVENT_SCHEMA_VERSION,
    id: e.id,
    // Map engine kind → public dotted name (idempotent for already-public).
    type: publicEventName(e.kind) ?? e.kind,
    workspaceId: e.workspaceId,
    at: e.at,
    payload: e.payload,
  };
}

export function serializeEnvelope(env: EventEnvelope): string {
  return JSON.stringify(env);
}

/** Sinks (for one workspace) that should receive this envelope. */
export function matchingSinks(
  env: EventEnvelope,
  sinks: readonly SabsmsEventSink[],
): SabsmsEventSink[] {
  return sinks.filter(
    (s) =>
      s.enabled &&
      s.workspaceId === env.workspaceId &&
      eventMatchesFilter(env.type, s.events),
  );
}

export function isHttpSink(kind: SabsmsEventSinkKind): boolean {
  return HTTP_SINK_KINDS.has(kind);
}
