import type { PresenceCursor } from "./presence.ts";

/**
 * Client consumer for the SabSheet collaboration SSE push (`/api/sabsheet/stream`). Calls `onAdvance`
 * with the new seq whenever a collaborator's edit lands (so the grid can `sync.poll()` immediately),
 * and `onPresence` with the live cursors of everyone else. EventSource auto-reconnects on drop.
 */
export function openOpStream(
  workbookId: string,
  since: number,
  onAdvance: (seq: number) => void,
  onPresence?: (cursors: PresenceCursor[]) => void,
): () => void {
  if (typeof EventSource === "undefined") return () => {};
  const sp = new URLSearchParams({ workbookId, since: String(since) });
  const es = new EventSource(`/api/sabsheet/stream?${sp.toString()}`);
  es.onmessage = (e) => {
    const seq = Number(e.data);
    if (Number.isFinite(seq)) onAdvance(seq);
  };
  if (onPresence) {
    es.addEventListener("presence", (e) => {
      try {
        onPresence(JSON.parse((e as MessageEvent).data) as PresenceCursor[]);
      } catch {
        /* ignore malformed */
      }
    });
  }
  // onerror is non-fatal — EventSource reconnects automatically.
  return () => es.close();
}
