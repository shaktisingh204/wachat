/**
 * SabFlow executor — pin-data store.
 *
 * Pin data is n8n's manual-run testing aid: an author can "pin" the output of
 * any node so that, during a manual editor run, the executor short-circuits
 * that node and surfaces the pinned items as if the node had just produced
 * them.  This lets a designer iterate on a single downstream node without
 * re-firing upstream HTTP / DB calls every time.
 *
 * Track B Phase 7 sub-task #5 of 10 — pinData parity.
 *
 * Reference: docs/adr/sabflow-executor-n8n-survey.md
 *   - line 105: "The editor POSTs the current workflow JSON … along with
 *               optional pinned data."
 *   - line 108: "Pinned data per node short-circuits upstream execution: a
 *               downstream node reads the pinned items as if its parent had
 *               just produced them."
 *
 * Storage model
 * -------------
 * Collection: `sabflow_pin_data`.
 * Key:        `(workflowId, nodeId)` — unique, one pin per node per workflow.
 * Scope:      per workflow, NOT per execution.  Pinned values survive runs
 *             so the editor keeps showing them across reloads until the
 *             author explicitly clears them.
 *
 * Size cap
 * --------
 * Each pin is capped at 256 KiB of JSON-serialised payload to keep the
 * editor responsive and to avoid bloating the Mongo doc beyond the index
 * working set.  Oversized payloads are rejected with a `PinDataTooLargeError`
 * — they almost always indicate the author should be using a real fixture
 * source (SabFiles, credential-backed mock) rather than inline JSON.
 *
 * Executor contract
 * -----------------
 * The dispatcher consults `getPinData(workflowId, nodeId)` BEFORE invoking a
 * node's `execute()` when the run satisfies BOTH:
 *   - `execution.mode === 'manual'`     (editor-initiated run)
 *   - `execution.usePinData === true`   (toggle exposed in the editor toolbar)
 *
 * When both are true and pinned items exist, the node is short-circuited and
 * the pinned items are emitted on output port 0 verbatim, with each item's
 * `pinned` flag forced to `true` so downstream lineage views can distinguish
 * a real run from a pinned substitution.
 */

import { ObjectId, type Collection } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type { NodeExecutionItem } from '../contract';

/* ──────────────────────────────────────────────────────────────────────────
   Constants
   ──────────────────────────────────────────────────────────────────────── */

/** Maximum size of the serialised `items` payload per pin (256 KiB). */
export const PIN_DATA_MAX_BYTES = 256 * 1024;

/** Mongo collection name. */
const COLLECTION = 'sabflow_pin_data';

/* ──────────────────────────────────────────────────────────────────────────
   Errors
   ──────────────────────────────────────────────────────────────────────── */

/**
 * Thrown by {@link setPinData} when the serialised payload exceeds
 * {@link PIN_DATA_MAX_BYTES}.  Surfaced to the editor as a 413-style toast.
 */
export class PinDataTooLargeError extends Error {
  readonly code = 'PIN_DATA_TOO_LARGE' as const;
  readonly nodeId: string;
  readonly byteSize: number;
  readonly limit = PIN_DATA_MAX_BYTES;

  constructor(nodeId: string, byteSize: number) {
    super(
      `Pin data for node "${nodeId}" is ${byteSize} bytes; ` +
        `maximum allowed is ${PIN_DATA_MAX_BYTES} bytes (256 KiB).`,
    );
    this.name = 'PinDataTooLargeError';
    this.nodeId = nodeId;
    this.byteSize = byteSize;
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   Mongo doc + collection
   ──────────────────────────────────────────────────────────────────────── */

interface PinDataDoc {
  _id: ObjectId;
  workspaceId: string;
  workflowId: string;
  nodeId: string;
  /** Serialised items kept intact; nodes are free to embed arbitrary JSON. */
  items: NodeExecutionItem[];
  /** Cached byteSize to support cheap listing without re-serialising. */
  byteSize: number;
  createdAt: Date;
  updatedAt: Date;
}

async function getPinDataCollection(): Promise<Collection<PinDataDoc>> {
  const { db } = await connectToDatabase();
  const col = db.collection<PinDataDoc>(COLLECTION);
  // Unique per (workflowId, nodeId).  workspaceId is on the doc for RBAC /
  // tenant deletion scans but does not participate in the primary key.
  await col.createIndex(
    { workflowId: 1, nodeId: 1 },
    { unique: true, background: true },
  );
  await col.createIndex({ workspaceId: 1 }, { background: true });
  return col;
}

/* ──────────────────────────────────────────────────────────────────────────
   Public API
   ──────────────────────────────────────────────────────────────────────── */

export interface SetPinDataArgs {
  workspaceId: string;
  workflowId: string;
  nodeId: string;
  items: NodeExecutionItem[];
}

/**
 * Persist (or replace) the pinned output for a single node.
 *
 * The payload is JSON-serialised to measure its true on-the-wire size and
 * rejected with {@link PinDataTooLargeError} when it exceeds
 * {@link PIN_DATA_MAX_BYTES}.
 *
 * The on-disk shape mirrors {@link NodeExecutionItem} verbatim so the
 * dispatcher can emit pinned items without any per-load transformation.
 */
export async function setPinData(args: SetPinDataArgs): Promise<void> {
  const { workspaceId, workflowId, nodeId, items } = args;

  // Buffer.byteLength is the authoritative wire-size metric (handles
  // multi-byte unicode that JSON.stringify().length does not).
  const serialised = JSON.stringify(items);
  const byteSize = Buffer.byteLength(serialised, 'utf8');
  if (byteSize > PIN_DATA_MAX_BYTES) {
    throw new PinDataTooLargeError(nodeId, byteSize);
  }

  const col = await getPinDataCollection();
  const now = new Date();
  await col.updateOne(
    { workflowId, nodeId },
    {
      $set: {
        workspaceId,
        items,
        byteSize,
        updatedAt: now,
      },
      $setOnInsert: {
        _id: new ObjectId(),
        workflowId,
        nodeId,
        createdAt: now,
      },
    },
    { upsert: true },
  );
}

/**
 * Returns the pinned items for `(workflowId, nodeId)`, or `null` when no
 * pin is set.  Called by the executor in manual + usePinData mode BEFORE
 * dispatching the node's `execute()`.
 *
 * The returned array is a deep copy in the sense that Mongo deserialises
 * fresh objects per call; callers may freely mutate the result without
 * worrying about cross-execution aliasing.
 */
export async function getPinData(
  workflowId: string,
  nodeId: string,
): Promise<NodeExecutionItem[] | null> {
  const col = await getPinDataCollection();
  const doc = await col.findOne(
    { workflowId, nodeId },
    { projection: { items: 1 } },
  );
  if (!doc) return null;
  // Force `pinned: true` on each item so downstream lineage / inspector
  // panels can distinguish a substituted item from an organically produced
  // one.  This mirrors n8n's behaviour where the item carries the pin flag.
  return doc.items.map((it) => ({ ...it, pinned: true }));
}

/**
 * Remove the pin for `(workflowId, nodeId)`.  No-ops when the pin is absent.
 */
export async function clearPinData(
  workflowId: string,
  nodeId: string,
): Promise<void> {
  const col = await getPinDataCollection();
  await col.deleteOne({ workflowId, nodeId });
}

/**
 * Lightweight summary entry returned by {@link listPinnedNodes}.
 *
 * `itemsPreview` is the first item's JSON payload truncated to a single
 * object so the editor can render a node-list badge without fetching the
 * full pin (which may approach the 256 KiB cap).
 */
export interface PinnedNodeSummary {
  nodeId: string;
  itemsPreview: Record<string, unknown> | null;
  itemCount: number;
  byteSize: number;
  updatedAt: Date;
}

/**
 * List every pinned node in a workflow.  Returns a compact summary suitable
 * for the editor's "Pinned nodes" panel; the full payload is only fetched
 * lazily via {@link getPinData} when the author opens the inspector.
 */
export async function listPinnedNodes(
  workflowId: string,
): Promise<PinnedNodeSummary[]> {
  const col = await getPinDataCollection();
  const docs = await col
    .find(
      { workflowId },
      {
        projection: {
          nodeId: 1,
          byteSize: 1,
          updatedAt: 1,
          // Only ship the first item back; trim to its `json` payload below.
          'items': { $slice: 1 },
        },
      },
    )
    .sort({ updatedAt: -1 })
    .toArray();

  return docs.map((doc) => {
    const first = doc.items?.[0];
    return {
      nodeId: doc.nodeId,
      itemsPreview: first ? (first.json as Record<string, unknown>) : null,
      itemCount: doc.items?.length ?? 0,
      byteSize: doc.byteSize,
      updatedAt: doc.updatedAt,
    };
  });
}
