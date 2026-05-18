/**
 * SabFlow — Cold-tier snapshot push/restore (SabFiles-routed).
 *
 * Track A · Phase 2 · sub-task #3.
 *
 * Per `docs/adr/sabflow-persistence.md` §4 and the project-wide SabFiles policy
 * in `CLAUDE.md`:
 *
 * - Snapshots older than 30 days move from Mongo `sabflow_docs.snapshot` to
 *   long-term storage **via SabFiles** (not via a direct R2 SDK call). The
 *   resulting `coldTier` pointer the doc carries is a SabFiles file id — the
 *   re-hydration path then asks SabFiles for the bytes, which keeps R2 lifecycle
 *   (immutability, versioning, replication) configured at the bucket level
 *   rather than per-object from app code.
 * - "NEVER expose a free-text URL paste for files." So this module never
 *   accepts or returns a raw R2 URL. Inputs are `Buffer`s of Yjs update bytes;
 *   outputs (and `coldPointer` values) are opaque SabFiles handles.
 * - Snapshot files are **not** user-visible — they belong to the platform, not
 *   the editor's owner. To keep them out of any user's "My files" surface
 *   while still using the SabFiles upload pipeline, every snapshot lands under
 *   the system tenant folder:
 *
 *     `__system/sabflow/<workspaceId>/<docId>/<version>.bin`
 *
 *   The leading `__system` is reserved (SabFiles list/search endpoints filter
 *   this prefix out of user-facing listings — owner stays a service principal,
 *   not a real user). Within `__system`, the `sabflow/` sub-tree is owned by
 *   this layer; nothing else should write there.
 *
 * - The key shape mirrors the ADR exactly so an audit can reverse a
 *   `coldPointer` back to `(workspaceId, docId, version)` even without Mongo.
 *
 * **Phase 2 wiring note.** This module deliberately does NOT import
 * `@/lib/rust-client/sabfiles` directly. The default export here uses a
 * pluggable {@link SabFilesClient} contract so:
 *   1. The compaction worker (Phase 2 sub-task #5) can run in a service
 *      context that holds the platform identity, not the editor's user
 *      session — `sabfilesApi` is user-scoped today and would otherwise upload
 *      the snapshot under whichever user happened to trigger the compaction.
 *   2. Phase 2 sub-task #7 (the repo layer) and #8 (multi-tenant guards) can
 *      inject a system-principal-bound client without this file growing more
 *      dependencies.
 *   3. Tests can swap in an in-memory client without touching the Rust BFF.
 *
 * No direct `@aws-sdk/client-s3`, no `process.env.R2_*`, no raw R2 URL fields
 * anywhere in the module — those couplings live behind the SabFiles BFF and
 * its bucket-level lifecycle config, by policy.
 */

import 'server-only';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** ObjectId hex string. ADR §2.1 stores both `workspaceId` and `docId` as ObjectIds. */
export type ObjectIdHex = string;

/**
 * Arguments accepted by {@link pushSnapshotToColdTier}.
 *
 * `snapshot` is a `Buffer` of raw Yjs update bytes
 * (`Y.encodeStateAsUpdate(doc)` output) — same wire format the WS gateway
 * already uses, and the same format `sabflow_docs.snapshot` holds before
 * archival. We never base64-encode or wrap it; SabFiles holds the binary
 * stream as-is.
 */
export interface PushSnapshotArgs {
  workspaceId: ObjectIdHex;
  docId: ObjectIdHex;
  /** Compaction generation integer (`sabflow_docs.version`). */
  version: number;
  /** Encoded Yjs update bytes. */
  snapshot: Buffer;
}

/**
 * The pointer the caller stores in `sabflow_docs.coldTier`. Opaque to the
 * editor / repo layer — they hand it straight back to
 * {@link restoreSnapshotFromColdTier}.
 *
 * `coldPointer` is the SabFiles file id (NOT a free-text R2 URL — that would
 * violate `CLAUDE.md`'s SabFiles policy).
 */
export interface PushSnapshotResult {
  coldPointer: string;
}

// ---------------------------------------------------------------------------
// Constants — exported so the worker, the repo layer, and tests can agree
// without re-deriving strings.
// ---------------------------------------------------------------------------

/**
 * Reserved root folder for non-user-visible files. SabFiles surfaces filter
 * this prefix out of every user-facing listing (library, recent, search) so
 * snapshot blobs never leak into a customer's UI.
 *
 * Underscore-prefixed because a real user can't create a folder starting with
 * `__` through the picker (the upload validator rejects it), making the
 * namespace squat-proof.
 */
export const SYSTEM_TENANT_FOLDER = '__system';

/**
 * Sub-tree owned by this layer. Anything under
 * `__system/sabflow/...` is managed by the cold-tier worker; nothing else
 * should write into it.
 */
export const SABFLOW_COLD_TIER_FOLDER = `${SYSTEM_TENANT_FOLDER}/sabflow`;

/** MIME we tag snapshot blobs with — purely informational; SabFiles stores bytes verbatim. */
export const SNAPSHOT_MIME = 'application/x.yjs-update';

// ---------------------------------------------------------------------------
// Pluggable SabFiles client contract (Phase 2 wires the impl)
// ---------------------------------------------------------------------------

/**
 * Minimal SabFiles surface the cold-tier needs. Defined here, re-exported,
 * and consumed by the default helpers below; Phase 2 sub-task #7 supplies the
 * real implementation that's bound to the platform service principal.
 *
 * Methods:
 *
 *  - `uploadSystemFile(opts)` — write bytes into the system tenant folder
 *    using the SabFiles upload pipeline (presign → PUT → confirm, all behind
 *    the BFF). Implementations MUST refuse paths that do not start with
 *    {@link SYSTEM_TENANT_FOLDER}. Returns the SabFiles file id used as the
 *    `coldPointer`.
 *
 *  - `downloadSystemFile(coldPointer)` — fetch the raw bytes for an existing
 *    snapshot file. Implementations MUST verify the file lives under
 *    {@link SABFLOW_COLD_TIER_FOLDER} before returning bytes (defense in depth
 *    so a stray pointer can't be used to exfiltrate user files). The returned
 *    buffer is the same byte sequence that was uploaded — no transcoding.
 */
export interface SabFilesClient {
  uploadSystemFile(opts: {
    /**
     * Path inside the system tenant tree. MUST start with `__system/`.
     * Example: `__system/sabflow/<workspaceId>/<docId>/<version>.bin`.
     */
    path: string;
    /** Display name (last segment of `path`). */
    name: string;
    /** Raw bytes — Yjs update buffer. */
    bytes: Buffer;
    /** Optional MIME hint; defaults to {@link SNAPSHOT_MIME} when omitted. */
    mime?: string;
  }): Promise<{ coldPointer: string }>;

  downloadSystemFile(coldPointer: string): Promise<Buffer>;
}

// ---------------------------------------------------------------------------
// Client injection — Phase 2 wiring point
// ---------------------------------------------------------------------------

let injectedClient: SabFilesClient | null = null;

/**
 * Phase 2 integration calls this once at boot with the service-principal-bound
 * SabFiles client. Tests call it with an in-memory fake. Unset by passing
 * `null`.
 */
export function setSabFilesClient(client: SabFilesClient | null): void {
  injectedClient = client;
}

function requireClient(): SabFilesClient {
  if (!injectedClient) {
    throw new Error(
      'sabflow/cold-tier: SabFilesClient not configured. ' +
        'Phase 2 wiring must call setSabFilesClient() before the compaction worker runs.',
    );
  }
  return injectedClient;
}

// ---------------------------------------------------------------------------
// Key derivation
// ---------------------------------------------------------------------------

const OBJECT_ID_HEX = /^[a-f0-9]{24}$/i;

function assertObjectIdHex(label: string, value: string): void {
  if (!OBJECT_ID_HEX.test(value)) {
    throw new Error(`sabflow/cold-tier: ${label} is not a 24-char ObjectId hex string`);
  }
}

function assertVersion(version: number): void {
  if (!Number.isInteger(version) || version < 0) {
    throw new Error(
      `sabflow/cold-tier: version must be a non-negative integer (got ${String(version)})`,
    );
  }
}

/**
 * Builds the canonical cold-tier path. Exported so the repo layer and the
 * compaction worker can derive the same path during reconciliation /
 * back-fill without re-encoding the rule.
 *
 * Shape (per ADR §4):
 *
 *   `__system/sabflow/<workspaceId>/<docId>/<version>.bin`
 */
export function buildColdTierPath(args: {
  workspaceId: ObjectIdHex;
  docId: ObjectIdHex;
  version: number;
}): string {
  assertObjectIdHex('workspaceId', args.workspaceId);
  assertObjectIdHex('docId', args.docId);
  assertVersion(args.version);
  return `${SABFLOW_COLD_TIER_FOLDER}/${args.workspaceId}/${args.docId}/${args.version}.bin`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Push a compacted snapshot to cold tier via SabFiles.
 *
 * Caller persists the returned `coldPointer` on `sabflow_docs.coldTier` (see
 * ADR §2.1). The Mongo `snapshot` field is then cleared by the compaction
 * worker in a separate step — this function does NOT touch Mongo.
 */
export async function pushSnapshotToColdTier(
  args: PushSnapshotArgs,
): Promise<PushSnapshotResult> {
  const path = buildColdTierPath({
    workspaceId: args.workspaceId,
    docId: args.docId,
    version: args.version,
  });
  if (!Buffer.isBuffer(args.snapshot)) {
    throw new Error('sabflow/cold-tier: snapshot must be a Buffer of Yjs update bytes');
  }
  if (args.snapshot.length === 0) {
    throw new Error('sabflow/cold-tier: snapshot Buffer is empty — refusing to archive');
  }

  const client = requireClient();
  const name = `${args.version}.bin`;
  const { coldPointer } = await client.uploadSystemFile({
    path,
    name,
    bytes: args.snapshot,
    mime: SNAPSHOT_MIME,
  });
  return { coldPointer };
}

/**
 * Restore a snapshot from cold tier.
 *
 * `coldPointer` is whatever {@link pushSnapshotToColdTier} returned — the
 * caller (repo layer) does not interpret it. The returned `Buffer` is the
 * exact byte sequence originally uploaded; pass it to
 * `Y.applyUpdate(doc, buffer)` to rehydrate a Y.Doc.
 *
 * Per ADR §4, re-hydration is a one-shot warm-up: the repo writes the bytes
 * back into Mongo and clears `coldTier` after a successful restore. That
 * Mongo step belongs to the repo layer and is intentionally NOT performed
 * here.
 */
export async function restoreSnapshotFromColdTier(
  coldPointer: string,
): Promise<Buffer> {
  if (typeof coldPointer !== 'string' || coldPointer.length === 0) {
    throw new Error('sabflow/cold-tier: coldPointer must be a non-empty string');
  }
  const client = requireClient();
  const bytes = await client.downloadSystemFile(coldPointer);
  if (!Buffer.isBuffer(bytes)) {
    throw new Error('sabflow/cold-tier: SabFilesClient.downloadSystemFile must return a Buffer');
  }
  if (bytes.length === 0) {
    throw new Error(
      `sabflow/cold-tier: empty snapshot for pointer ${coldPointer} — refusing to return zero-byte rehydrate`,
    );
  }
  return bytes;
}
