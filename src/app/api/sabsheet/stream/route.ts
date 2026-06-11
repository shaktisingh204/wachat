/**
 * SabSheet collaboration push — Server-Sent Events.
 *
 * The grid already syncs collaborators' edits by replaying the ordered op log (`opsSince`). This route
 * turns the client's 3s poll into a near-instant push: it server-side watches the op log for a
 * workbook and emits the new seq whenever it advances. The browser's EventSource triggers a single
 * `sync.poll()` on each event.
 *
 * MVP uses a 1.5s server-side poll of `opsSince`; the scale upgrade is a Redis pub/sub fanned out from
 * the Rust apply path (so no per-client DB polling). Authenticated via the session cookie.
 */
import { getSession } from "@/app/actions/user.actions";
import { opsSince } from "@/lib/rust-client/sabsheet-ops";
import { listPresence } from "@/lib/sabsheet/collab/presence-store.server";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session?.user?._id) return new Response("unauthorized", { status: 401 });
  const userId = String(session.user._id);

  const url = new URL(req.url);
  const workbookId = url.searchParams.get("workbookId");
  if (!workbookId) return new Response("workbookId required", { status: 400 });
  let since = Number(url.searchParams.get("since") ?? "0");

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (line: string) => {
        try {
          controller.enqueue(encoder.encode(line));
        } catch {
          /* stream closed */
        }
      };
      send(": connected\n\n");

      const tick = async () => {
        try {
          const { ops } = await opsSince(workbookId, since);
          if (ops.length) {
            since = ops[ops.length - 1].seq;
            send(`data: ${since}\n\n`);
          } else {
            send(": keepalive\n\n");
          }
        } catch {
          /* transient — try again next tick */
        }
        // Fan out collaborators' cursors (best-effort).
        try {
          const cursors = await listPresence(workbookId, userId);
          send(`event: presence\ndata: ${JSON.stringify(cursors)}\n\n`);
        } catch {
          /* best-effort */
        }
      };

      const interval = setInterval(() => void tick(), 1500);
      const stop = () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener("abort", stop);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
