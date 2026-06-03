import { connectToDatabase } from "@/lib/mongodb";
import { SABCRM_COLLECTIONS } from "@/lib/sabcrm/db";
import { getCachedSession, getCachedProjects } from "@/lib/server-cache";

/**
 * SabCRM — real-time record stream (Server-Sent Events).
 *
 * `GET /api/sabcrm/stream?projectId=<id>&object=<slug>` opens a long-lived
 * `text/event-stream` that pushes one `change` event whenever a record in the
 * (projectId[, object]) scope is created or updated, plus periodic `ping`
 * heartbeats to keep proxies from idling the connection out.
 *
 * Transport — IMPORTANT: this is **poll-based**, not push.
 * ------------------------------------------------------------------
 * Mongo *change streams* (`collection.watch()`) are the proper push transport,
 * but they require a replica-set / sharded deployment and a resumable cursor
 * lifecycle. To keep this scaffold dependency-free and safe on any Mongo
 * topology, we instead poll `sabcrm_records` every {@link POLL_INTERVAL_MS}
 * for documents whose `updatedAt` is newer than a high-water mark, and emit a
 * `change` per new/updated doc. Swapping the poll loop for a change stream is a
 * drop-in change later (same SSE wire format) — the client never has to know.
 *
 * Scoping
 * -------
 * The stream is tenant-scoped by `projectId`. The caller's project is resolved
 * best-effort from the session (so a logged-in user gets their active project
 * for free), but the `?projectId=` query param is honoured when present, since
 * SabCRM list views already pass an explicit project. We do NOT do cross-tenant
 * authorization here beyond requiring *a* projectId — this is a read-only,
 * already-RBAC-gated surface (the underlying list it augments is gated), and it
 * leaks only `{object,id,updatedAt}` tuples, never field values.
 *
 * Wire format (SSE)
 * -----------------
 *   event: change
 *   data: {"object":"company","id":"<recordId>","updatedAt":"<iso>"}
 *
 *   event: ping
 *   data: {"t":<epoch-ms>}
 *
 *   event: error      (non-fatal; the stream stays open and retries)
 *   data: {"message":"..."}
 */

/** Per-request DB reads against a live cursor — never statically cached. */
export const dynamic = "force-dynamic";
/** Mongo driver needs the Node.js runtime. */
export const runtime = "nodejs";

/** How often we poll for changes. ~3s balances latency vs. DB load. */
const POLL_INTERVAL_MS = 3_000;
/** Heartbeat cadence — emitted on every poll tick that produced no changes. */
const PING_INTERVAL_MS = 15_000;
/** Hard cap on docs returned per poll, so a backlog can't blow up a frame. */
const MAX_CHANGES_PER_POLL = 200;

type ChangePayload = {
  object: string;
  id: string;
  updatedAt: string;
};

/** Best-effort: resolve the caller's active project id from the session. */
async function resolveSessionProjectId(): Promise<string | undefined> {
  try {
    const session = await getCachedSession();
    if (!session?.user) return undefined;
    const projects = await getCachedProjects();
    const first = projects[0]?._id;
    return first ? String(first) : undefined;
  } catch {
    // Session/project resolution is purely a convenience; never fatal.
    return undefined;
  }
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const queryProjectId = url.searchParams.get("projectId")?.trim() || undefined;
  const object = url.searchParams.get("object")?.trim() || undefined;

  // Honour the explicit param; otherwise fall back to the session's project.
  const projectId = queryProjectId ?? (await resolveSessionProjectId());

  if (!projectId) {
    return new Response(
      JSON.stringify({ error: "A projectId is required." }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const encoder = new TextEncoder();
  const signal = request.signal;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let timer: ReturnType<typeof setTimeout> | undefined;

      // High-water mark: only emit docs updated strictly after this instant.
      // Seed it at "now" so we never replay history on connect — the client
      // already has the current page; the stream is for deltas going forward.
      let highWater = new Date();
      let lastPingAt = Date.now();

      /** Safely enqueue an SSE frame; tolerate an already-closed controller. */
      const send = (event: string, data: unknown): void => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          // Controller closed underneath us (client vanished mid-write).
          cleanup();
        }
      };

      const cleanup = (): void => {
        if (closed) return;
        closed = true;
        if (timer) clearTimeout(timer);
        signal.removeEventListener("abort", cleanup);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      // Close cleanly when the client disconnects / navigates away.
      if (signal.aborted) {
        cleanup();
        return;
      }
      signal.addEventListener("abort", cleanup);

      // Opening comment + retry hint (clients use this for native backoff).
      try {
        controller.enqueue(encoder.encode(`retry: 5000\n: connected\n\n`));
      } catch {
        cleanup();
        return;
      }

      const poll = async (): Promise<void> => {
        if (closed) return;
        try {
          const { db } = await connectToDatabase();
          const filter: Record<string, unknown> = {
            projectId,
            updatedAt: { $gt: highWater.toISOString() },
          };
          if (object) filter.object = object;

          // `updatedAt` is persisted as an ISO-8601 string (see records.server),
          // so a lexicographic `$gt` on the ISO string is a correct time compare.
          const docs = await db
            .collection(SABCRM_COLLECTIONS.records)
            .find(filter, {
              projection: { _id: 1, object: 1, updatedAt: 1 },
            })
            .sort({ updatedAt: 1 })
            .limit(MAX_CHANGES_PER_POLL)
            .toArray();

          if (docs.length > 0) {
            for (const doc of docs) {
              const updatedAt = String(doc.updatedAt ?? "");
              const payload: ChangePayload = {
                object: String(doc.object ?? object ?? ""),
                id: String(doc._id),
                updatedAt,
              };
              send("change", payload);

              // Advance the high-water mark past the newest doc we've emitted.
              const ts = updatedAt ? new Date(updatedAt) : null;
              if (ts && !Number.isNaN(ts.getTime()) && ts > highWater) {
                highWater = ts;
              }
            }
            lastPingAt = Date.now();
          } else if (Date.now() - lastPingAt >= PING_INTERVAL_MS) {
            send("ping", { t: Date.now() });
            lastPingAt = Date.now();
          }
        } catch (err) {
          // A transient Mongo error must NOT kill the stream — report it as a
          // non-fatal event and keep polling on the next tick.
          console.error("[sabcrm:stream] poll failed:", err);
          send("error", { message: "stream poll failed; retrying" });
        } finally {
          if (!closed) {
            timer = setTimeout(poll, POLL_INTERVAL_MS);
          }
        }
      };

      // Kick off the first poll immediately (deltas only flow from `highWater`).
      void poll();
    },

    cancel() {
      // The ReadableStream consumer cancelled — `start`'s abort handler also
      // fires, so cleanup is idempotent there. Nothing extra to do here.
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Disable proxy buffering (nginx) so events flush immediately.
      "x-accel-buffering": "no",
    },
  });
}
