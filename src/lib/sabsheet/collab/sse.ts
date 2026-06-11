/**
 * Client consumer for the SabSheet collaboration SSE push (`/api/sabsheet/stream`). Calls `onAdvance`
 * with the new seq whenever a collaborator's edit lands, so the grid can `sync.poll()` immediately
 * instead of waiting for the fallback timer. EventSource auto-reconnects on drop.
 */
export function openOpStream(
  workbookId: string,
  since: number,
  onAdvance: (seq: number) => void,
): () => void {
  if (typeof EventSource === "undefined") return () => {};
  const sp = new URLSearchParams({ workbookId, since: String(since) });
  const es = new EventSource(`/api/sabsheet/stream?${sp.toString()}`);
  es.onmessage = (e) => {
    const seq = Number(e.data);
    if (Number.isFinite(seq)) onAdvance(seq);
  };
  // onerror is non-fatal — EventSource reconnects automatically.
  return () => es.close();
}
