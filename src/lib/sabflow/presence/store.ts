/**
 * In-memory presence store for the flow editor.
 *
 * Per-process map of `flowId → Map<userId, PresenceEntry>`.  Entries expire
 * 15 s after their last heartbeat — that's enough headroom for a 5 s client
 * heartbeat interval to keep the entry alive while marking stale tabs as
 * offline quickly.
 *
 * Single-instance only.  Multi-instance Vercel deployments would benefit
 * from Redis (the same pattern as the trace bus) — leaving that as a swap
 * point.  For "is anyone else here" UX a 1-instance limitation is fine.
 */

export type PresenceEntry = {
  userId: string;
  /** Display name shown next to the avatar; falls back to the user id. */
  name?: string;
  /** Optional avatar URL. */
  avatarUrl?: string;
  /** Optional cursor coordinates inside the canvas. */
  cursor?: { x: number; y: number };
  /** Wall-clock timestamp of the most recent heartbeat. */
  lastSeen: number;
};

const TTL_MS = 15_000;
const presence = new Map<string, Map<string, PresenceEntry>>();

function gc(flowMap: Map<string, PresenceEntry>): void {
  const now = Date.now();
  for (const [uid, entry] of flowMap) {
    if (now - entry.lastSeen > TTL_MS) flowMap.delete(uid);
  }
}

export function heartbeat(flowId: string, entry: PresenceEntry): void {
  let flowMap = presence.get(flowId);
  if (!flowMap) {
    flowMap = new Map();
    presence.set(flowId, flowMap);
  }
  flowMap.set(entry.userId, { ...entry, lastSeen: Date.now() });
  gc(flowMap);
}

export function leave(flowId: string, userId: string): void {
  const flowMap = presence.get(flowId);
  if (!flowMap) return;
  flowMap.delete(userId);
  if (flowMap.size === 0) presence.delete(flowId);
}

export function listPresence(
  flowId: string,
  excludeUserId?: string,
): PresenceEntry[] {
  const flowMap = presence.get(flowId);
  if (!flowMap) return [];
  gc(flowMap);
  const out: PresenceEntry[] = [];
  for (const entry of flowMap.values()) {
    if (excludeUserId && entry.userId === excludeUserId) continue;
    out.push(entry);
  }
  return out;
}
