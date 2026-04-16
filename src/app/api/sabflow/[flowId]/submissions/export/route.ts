/**
 * GET /api/sabflow/[flowId]/submissions/export
 *
 * Streams all submissions for the given flow as a CSV download.
 *
 * Response headers:
 *   Content-Type: text/csv
 *   Content-Disposition: attachment; filename="submissions-{flowId}.csv"
 *
 * CSV columns:
 *   Submission ID, Session ID, Started At, Completed At, Is Complete,
 *   …one column per unique variable key found across all submissions
 *
 * Auth: session cookie ownership check.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSabFlowCollection } from '@/lib/sabflow/db';
import { getSession } from '@/app/actions/user.actions';

export const dynamic = 'force-dynamic';

const SUBMISSIONS_COLLECTION = 'sabflow_submissions';

/* ── ownership guard ──────────────────────────────────────── */

async function assertOwnsFlow(flowId: string): Promise<boolean> {
  const session = await getSession();
  if (!session?.user) return false;
  if (!ObjectId.isValid(flowId)) return false;

  const flows = await getSabFlowCollection();
  const flow = await flows.findOne(
    { _id: new ObjectId(flowId), userId: session.user._id.toString() },
    { projection: { _id: 1 } },
  );
  return flow !== null;
}

/* ── CSV helpers ──────────────────────────────────────────── */

function escapeCsvCell(value: unknown): string {
  const str = value == null ? '' : String(value);
  // Wrap in quotes and escape inner quotes per RFC 4180
  return `"${str.replace(/"/g, '""')}"`;
}

function buildCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.map(escapeCsvCell).join(',');
  const body = rows
    .map((row) => columns.map((col) => escapeCsvCell(row[col])).join(','))
    .join('\r\n');
  return `${header}\r\n${body}`;
}

/* ── GET ──────────────────────────────────────────────────── */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ flowId: string }> },
) {
  const { flowId } = await params;

  const owns = await assertOwnsFlow(flowId);
  if (!owns) {
    return NextResponse.json({ error: 'Not found or access denied' }, { status: 404 });
  }

  try {
    const { db } = await connectToDatabase();
    const col = db.collection(SUBMISSIONS_COLLECTION);

    // Fetch all submissions for this flow (no pagination — export is full)
    const docs = await col
      .find({ flowId })
      .sort({ completedAt: -1, _id: -1 })
      .toArray();

    // Collect every unique variable key across all submissions
    const varKeys = new Set<string>();
    for (const doc of docs) {
      const variables = (doc.variables ?? {}) as Record<string, unknown>;
      for (const key of Object.keys(variables)) {
        varKeys.add(key);
      }
    }
    const sortedVarKeys = Array.from(varKeys).sort();

    // Fixed columns first, then one column per variable
    const fixedCols = ['Submission ID', 'Session ID', 'Started At', 'Completed At', 'Is Complete'];
    const allColumns = [...fixedCols, ...sortedVarKeys];

    const rows = docs.map((doc) => {
      const variables = (doc.variables ?? {}) as Record<string, unknown>;
      const completedAt =
        doc.completedAt instanceof Date
          ? doc.completedAt.toISOString()
          : (doc.completedAt as string | null) ?? '';
      const startedAt =
        doc.startedAt instanceof Date
          ? doc.startedAt.toISOString()
          : (doc.startedAt as string | null) ?? '';

      const row: Record<string, unknown> = {
        'Submission ID': doc._id?.toString() ?? '',
        'Session ID': (doc.sessionId as string) ?? '',
        'Started At': startedAt,
        'Completed At': completedAt,
        'Is Complete': String((doc.isComplete as boolean) ?? (doc.completedAt != null)),
      };

      for (const key of sortedVarKeys) {
        row[key] = variables[key] ?? '';
      }

      return row;
    });

    const csv = buildCsv(rows, allColumns);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="submissions-${flowId}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    console.error('[SABFLOW SUBMISSIONS EXPORT] GET error:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
