// @ts-check
/**
 * Line-delimited JSON protocol over stdin/stdout.
 *
 * The Rust parent process and this sidecar exchange newline-terminated JSON
 * objects. There is exactly **one** JSON object per line; no embedded
 * newlines, no chunked framing, no length prefix. This keeps both sides
 * trivially debuggable with `cat` and `jq` if needed.
 *
 * Request shape  (parent → sidecar):
 *   { "id": "<uuid>", "method": "<name>", "params": { ... } }
 *
 * Response shape (sidecar → parent, replying to a request):
 *   { "id": "<uuid>", "ok": true,  "result": { ... } }
 *   { "id": "<uuid>", "ok": false, "error":  "<message>" }
 *
 * Event shape   (sidecar → parent, unsolicited):
 *   { "event": "<name>", "sessionId": "<id>", "payload": { ... } }
 *
 * Events have **no `id` field** — that is how the parent distinguishes them
 * from responses.
 */

/**
 * Reads NDJSON requests from `stream` and invokes `onRequest` for each
 * fully-parsed object. Handles partial-line buffering across chunks.
 *
 * Malformed lines are silently dropped after being logged to stderr (the
 * caller can layer a logger in front if it wants stricter behaviour).
 *
 * @param {NodeJS.ReadableStream} stream
 * @param {(req: unknown) => void | Promise<void>} onRequest
 */
export function readRequests(stream, onRequest) {
  let buffer = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    buffer += chunk;
    let newlineIdx;
    while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIdx);
      buffer = buffer.slice(newlineIdx + 1);
      const trimmed = line.trim();
      if (!trimmed) continue;
      let parsed;
      try {
        parsed = JSON.parse(trimmed);
      } catch (err) {
        process.stderr.write(
          `[sabwa-sidecar] malformed JSON-RPC line dropped: ${
            err instanceof Error ? err.message : String(err)
          }\n`,
        );
        continue;
      }
      try {
        const result = onRequest(parsed);
        if (result && typeof (/** @type {Promise<unknown>} */ (result)).catch === 'function') {
          /** @type {Promise<unknown>} */ (result).catch((err) => {
            process.stderr.write(
              `[sabwa-sidecar] unhandled error in onRequest: ${
                err instanceof Error ? err.stack ?? err.message : String(err)
              }\n`,
            );
          });
        }
      } catch (err) {
        process.stderr.write(
          `[sabwa-sidecar] sync error in onRequest: ${
            err instanceof Error ? err.stack ?? err.message : String(err)
          }\n`,
        );
      }
    }
  });
}

/**
 * Serialise a single JSON value and write it to stdout with a trailing
 * newline. Used for both responses and events.
 *
 * @param {unknown} obj
 */
function writeLine(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

/**
 * Write a JSON-RPC response object.
 *
 * @param {{ id: string, ok: true, result?: unknown } | { id: string, ok: false, error: string }} res
 */
export function writeResponse(res) {
  writeLine(res);
}

/**
 * Write an unsolicited event object.
 *
 * @param {{ event: string, sessionId: string, payload?: unknown }} ev
 */
export function writeEvent(ev) {
  writeLine(ev);
}
