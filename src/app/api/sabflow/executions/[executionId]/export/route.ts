/**
 * SabFlow — Trace export ZIP
 *
 * GET /api/sabflow/executions/[executionId]/export
 *
 * Exports all persisted trace events for a single execution as a ZIP
 * archive containing:
 *
 *   manifest.json          — { executionId, exportedAt, eventCount, nodeIds[], duration }
 *   events.ndjson          — one TraceEvent JSON per line (NDJSON)
 *   nodes/<nodeId>.json    — per-node aggregated summary
 *
 * Implementation notes:
 *   - No archiver / jszip dep — ZIP is built manually with Node's built-in
 *     `zlib.deflateRawSync` (DEFLATE without the zlib wrapper). This avoids
 *     any new npm dependency while remaining fully compliant with the ZIP spec.
 *   - All file entries use compression method 8 (DEFLATE); directory entries
 *     use method 0 (stored).
 *   - CRC-32 is computed with a table-based algorithm (same as every ZIP tool).
 *
 * Auth: requires a valid session + (`sabflow.execution.read` OR
 * `sabflow.workflow.read` OR `sabflow.execution.admin`) RBAC permission.
 * The specific key `sabflow:execution:read` is translated to the canonical
 * dot-form `sabflow.execution.read` used in `rbac-keys.ts`.
 *
 * Limits: max 10,000 events per export; returns 413 with a message
 * directing the caller to use pinned exports if exceeded.
 *
 * Phase C · Task 9 · sub-task #9.
 */

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { deflateRawSync } from 'zlib';
import { ObjectId } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { canServer } from '@/lib/rbac-server';
import { getExecutionById } from '@/lib/sabflow/db';
import { getTrace } from '@/lib/sabflow/persistence/executionTraces';
import type { TraceEvent } from '@/lib/sabflow/persistence/executionTraces';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/* ──────────────────────────────────────────────────────────────────────────
   Constants
   ────────────────────────────────────────────────────────────────────────── */

const MAX_EVENTS = 10_000;

/* ──────────────────────────────────────────────────────────────────────────
   RBAC helpers
   ────────────────────────────────────────────────────────────────────────── */

function resolveWorkspaceId(session: { user: unknown } | null): string {
  const u = (session?.user ?? {}) as {
    activeProjectId?: string;
    _id?: string | { toString(): string };
    id?: string;
  };
  return String(
    u.activeProjectId
      ?? (typeof u._id === 'string' ? u._id : u._id?.toString())
      ?? u.id
      ?? '',
  );
}

/**
 * Returns true when the caller has any read-level grant over SabFlow
 * executions. Accepts the specific `sabflow.execution.read` key, the
 * broader `sabflow.workflow.read` (execution history is part of workflow
 * read), or the catch-all `sabflow.execution.admin`.
 */
async function hasExecutionReadPermission(workspaceId: string): Promise<boolean> {
  const [okExecRead, okWorkflowRead, okAdmin] = await Promise.all([
    canServer('sabflow.execution.read', 'view', workspaceId),
    canServer('sabflow.workflow.read', 'view', workspaceId),
    canServer('sabflow.execution.admin', 'edit', workspaceId),
  ]);
  return okExecRead || okWorkflowRead || okAdmin;
}

/* ──────────────────────────────────────────────────────────────────────────
   Authorisation helper (mirrors pin/route.ts pattern)
   ────────────────────────────────────────────────────────────────────────── */

type AuthOk = {
  ok: true;
  executionId: string;
  flowId: string;
  workspaceId: string;
  userId: string;
};
type AuthErr = { ok: false; status: number; error: string };

async function authoriseExecution(
  executionIdRaw: string | undefined,
): Promise<AuthOk | AuthErr> {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, status: 401, error: 'Authentication required' };
  }

  if (!executionIdRaw) {
    return { ok: false, status: 400, error: 'Missing executionId' };
  }
  if (!ObjectId.isValid(executionIdRaw)) {
    return { ok: false, status: 400, error: 'Invalid executionId' };
  }

  const userId = String(
    (session.user as { _id?: string | { toString(): string } })._id?.toString()
      ?? (session.user as { id?: string }).id
      ?? '',
  );
  if (!userId) {
    return { ok: false, status: 401, error: 'Authentication required' };
  }

  const workspaceId = resolveWorkspaceId(session);
  if (!workspaceId) {
    return { ok: false, status: 400, error: 'Workspace scope missing' };
  }

  const execution = await getExecutionById(executionIdRaw);
  if (!execution) {
    return { ok: false, status: 404, error: 'Execution not found' };
  }

  if (!ObjectId.isValid(execution.flowId)) {
    return { ok: false, status: 400, error: 'Invalid flow id on execution' };
  }

  const { db } = await connectToDatabase();
  const flow = await db.collection('sabflow_flows').findOne(
    { _id: new ObjectId(execution.flowId) },
    { projection: { projectId: 1, userId: 1 } },
  );
  if (!flow) {
    return { ok: false, status: 404, error: 'Flow not found' };
  }
  if (flow.projectId !== workspaceId && flow.userId !== workspaceId && flow.userId !== userId) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }

  return { ok: true, executionId: executionIdRaw, flowId: execution.flowId, workspaceId, userId };
}

/* ──────────────────────────────────────────────────────────────────────────
   CRC-32 (table-driven, standard polynomial 0xEDB88320)
   ────────────────────────────────────────────────────────────────────────── */

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/* ──────────────────────────────────────────────────────────────────────────
   Minimal ZIP builder (DEFLATE entries, no Zip64)
   ────────────────────────────────────────────────────────────────────────── */

interface ZipEntry {
  name: string;       // UTF-8 file name
  data: Buffer;       // uncompressed content
}

/**
 * Produces a valid ZIP archive buffer from a list of entries.
 *
 * Each entry is stored with DEFLATE compression (method 8).  The central
 * directory and end-of-central-directory record follow the local file data.
 */
function buildZip(entries: ZipEntry[]): Buffer {
  const localHeaders: Buffer[] = [];
  const centralDirHeaders: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name, 'utf8');
    const compressed = deflateRawSync(entry.data, { level: 6 });
    const crc = crc32(entry.data);
    const compSize = compressed.length;
    const uncompSize = entry.data.length;

    // ── Local file header (30 bytes + name) ──
    const local = Buffer.alloc(30 + nameBytes.length);
    local.writeUInt32LE(0x04034b50, 0);   // signature
    local.writeUInt16LE(20, 4);           // version needed: 2.0
    local.writeUInt16LE(0x0800, 6);       // flags: UTF-8
    local.writeUInt16LE(8, 8);            // compression: DEFLATE
    local.writeUInt16LE(0, 10);           // last mod time
    local.writeUInt16LE(0, 12);           // last mod date
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compSize, 18);
    local.writeUInt32LE(uncompSize, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);           // extra field length
    nameBytes.copy(local, 30);

    localHeaders.push(local);
    localHeaders.push(compressed);

    // ── Central directory file header (46 bytes + name) ──
    const central = Buffer.alloc(46 + nameBytes.length);
    central.writeUInt32LE(0x02014b50, 0);   // signature
    central.writeUInt16LE(20, 4);           // version made by
    central.writeUInt16LE(20, 6);           // version needed
    central.writeUInt16LE(0x0800, 8);       // flags: UTF-8
    central.writeUInt16LE(8, 10);           // compression
    central.writeUInt16LE(0, 12);           // last mod time
    central.writeUInt16LE(0, 14);           // last mod date
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compSize, 20);
    central.writeUInt32LE(uncompSize, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30);           // extra field length
    central.writeUInt16LE(0, 32);           // file comment length
    central.writeUInt16LE(0, 34);           // disk number start
    central.writeUInt16LE(0, 36);           // internal file attributes
    central.writeUInt32LE(0, 38);           // external file attributes
    central.writeUInt32LE(offset, 42);      // relative offset of local header
    nameBytes.copy(central, 46);

    centralDirHeaders.push(central);
    offset += local.length + compressed.length;
  }

  const centralDir = Buffer.concat(centralDirHeaders);
  const centralDirSize = centralDir.length;
  const centralDirOffset = offset;

  // ── End of central directory record (22 bytes) ──
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);              // signature
  eocd.writeUInt16LE(0, 4);                       // disk number
  eocd.writeUInt16LE(0, 6);                       // disk with start of CD
  eocd.writeUInt16LE(entries.length, 8);          // entries on this disk
  eocd.writeUInt16LE(entries.length, 10);         // total entries
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(centralDirOffset, 16);
  eocd.writeUInt16LE(0, 20);                      // comment length

  return Buffer.concat([...localHeaders, centralDir, eocd]);
}

/* ──────────────────────────────────────────────────────────────────────────
   Per-node summary aggregation
   ────────────────────────────────────────────────────────────────────────── */

interface NodeSummary {
  nodeId: string;
  itemCount: number;
  errorCount: number;
  avgDurationMs: number | null;
  minDurationMs: number | null;
  maxDurationMs: number | null;
}

function aggregateByNode(events: TraceEvent[]): Map<string, NodeSummary> {
  // Track per-node: start timestamps (keyed by optional itemIndex), error
  // count, and completed durations.
  const summaries = new Map<string, NodeSummary>();
  // nodeId → Map<itemIndex, startMs>  (itemIndex may be undefined → key 'solo')
  const starts = new Map<string, Map<string | number, number>>();

  const ensure = (nodeId: string): NodeSummary => {
    if (!summaries.has(nodeId)) {
      summaries.set(nodeId, {
        nodeId,
        itemCount: 0,
        errorCount: 0,
        avgDurationMs: null,
        minDurationMs: null,
        maxDurationMs: null,
      });
    }
    return summaries.get(nodeId)!;
  };

  const durations = new Map<string, number[]>();

  for (const ev of events) {
    const { nodeId, kind, itemIndex, at } = ev;
    const s = ensure(nodeId);

    if (kind === 'node_start') {
      if (!starts.has(nodeId)) starts.set(nodeId, new Map());
      starts.get(nodeId)!.set(itemIndex ?? 'solo', at.getTime());
    } else if (kind === 'node_end') {
      s.itemCount += 1;
      const startMs = starts.get(nodeId)?.get(itemIndex ?? 'solo');
      if (startMs !== undefined) {
        const dur = at.getTime() - startMs;
        if (!durations.has(nodeId)) durations.set(nodeId, []);
        durations.get(nodeId)!.push(dur);
        starts.get(nodeId)?.delete(itemIndex ?? 'solo');
      }
    } else if (kind === 'error') {
      s.errorCount += 1;
    }
  }

  // Compute avg / min / max per node from collected durations.
  for (const [nodeId, durs] of durations) {
    if (durs.length === 0) continue;
    const s = ensure(nodeId);
    const sum = durs.reduce((a, b) => a + b, 0);
    s.avgDurationMs = Math.round(sum / durs.length);
    s.minDurationMs = Math.min(...durs);
    s.maxDurationMs = Math.max(...durs);
  }

  return summaries;
}

/* ──────────────────────────────────────────────────────────────────────────
   GET handler
   ────────────────────────────────────────────────────────────────────────── */

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ executionId: string }> },
) {
  const { executionId } = await ctx.params;

  // ── 1. Auth ──
  const guard = await authoriseExecution(executionId);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  if (!(await hasExecutionReadPermission(guard.workspaceId))) {
    return NextResponse.json(
      { error: "You don't have permission to read execution traces." },
      { status: 403 },
    );
  }

  // ── 2. Fetch trace ──
  let traceDoc;
  try {
    traceDoc = await getTrace(guard.executionId, { workspaceId: guard.workspaceId });
  } catch (err) {
    console.error('[SABFLOW TRACE EXPORT] getTrace error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  if (!traceDoc) {
    return NextResponse.json({ error: 'Trace not found for this execution' }, { status: 404 });
  }

  // ── 3. Event cap ──
  const events = traceDoc.events ?? [];
  if (events.length > MAX_EVENTS) {
    return NextResponse.json(
      {
        error:
          `This execution has ${events.length.toLocaleString()} trace events, which exceeds ` +
          `the ${MAX_EVENTS.toLocaleString()}-event export limit. ` +
          'Pin the execution and use a targeted pinned export to retrieve large traces.',
      },
      { status: 413 },
    );
  }

  // ── 4. Build ZIP contents ──
  try {
    const exportedAt = new Date().toISOString();
    const nodeIds = [...new Set(events.map((e) => e.nodeId))];

    // Derive duration from the span between earliest and latest event timestamps.
    let durationMs: number | null = null;
    if (events.length > 0) {
      const timestamps = events.map((e) => e.at.getTime());
      durationMs = Math.max(...timestamps) - Math.min(...timestamps);
    }

    // manifest.json
    const manifest = {
      executionId: guard.executionId,
      exportedAt,
      eventCount: events.length,
      nodeIds,
      duration: durationMs,
    };
    const manifestBuf = Buffer.from(JSON.stringify(manifest, null, 2), 'utf8');

    // events.ndjson — one JSON line per event
    const ndjson = events
      .map((e) => JSON.stringify(e))
      .join('\n');
    const ndjsonBuf = Buffer.from(ndjson, 'utf8');

    // nodes/<nodeId>.json — per-node aggregated summaries
    const nodeSummaries = aggregateByNode(events);
    const nodeEntries: ZipEntry[] = [...nodeSummaries.values()].map((summary) => ({
      name: `nodes/${summary.nodeId}.json`,
      data: Buffer.from(JSON.stringify(summary, null, 2), 'utf8'),
    }));

    const zipEntries: ZipEntry[] = [
      { name: 'manifest.json', data: manifestBuf },
      { name: 'events.ndjson', data: ndjsonBuf },
      ...nodeEntries,
    ];

    const zipBuf = buildZip(zipEntries);

    console.log(
      `[SABFLOW TRACE EXPORT] user=${guard.userId} exec=${guard.executionId} ` +
      `events=${events.length} nodes=${nodeIds.length} zipBytes=${zipBuf.length}`,
    );

    return new Response(zipBuf, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="execution-${guard.executionId}-trace.zip"`,
        'Content-Length': String(zipBuf.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[SABFLOW TRACE EXPORT] build error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
