import 'server-only';

/**
 * SabWriter presence client — wraps `/v1/sabwriter/presence`.
 *
 * Ephemeral collab presence (cursors / heartbeats). Rows expire via a
 * TTL index on `lastSeenAt`; clients should heartbeat ~every 15s while
 * the editor is open.
 */
import { rustFetch } from './fetcher';

export interface PresenceCursor {
  anchor: number;
  head: number;
}

export interface SabwriterPresenceDoc {
  _id?: string;
  documentId: string;
  userId: string;
  cursor?: PresenceCursor;
  color: string;
  displayName?: string;
  lastSeenAt: string;
}

export interface PresenceListResponse {
  items: SabwriterPresenceDoc[];
}

export interface HeartbeatInput {
  documentId: string;
  cursor?: PresenceCursor;
  color?: string;
  displayName?: string;
}

export const sabwriterPresenceApi = {
  list: (documentId: string, cutoffSeconds = 60) => {
    const u = new URLSearchParams({
      documentId,
      cutoffSeconds: String(cutoffSeconds),
    });
    return rustFetch<PresenceListResponse>(
      `/v1/sabwriter/presence?${u.toString()}`,
    );
  },
  heartbeat: (input: HeartbeatInput) =>
    rustFetch<{ ok: boolean }>('/v1/sabwriter/presence/heartbeat', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  leave: (documentId: string) => {
    const u = new URLSearchParams({ documentId });
    return rustFetch<{ ok: boolean }>(
      `/v1/sabwriter/presence/leave?${u.toString()}`,
      { method: 'DELETE' },
    );
  },
};
