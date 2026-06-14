import 'server-only';

/**
 * SabBI boards — model-backed cross-filter dashboards.
 *
 * A board is a set of cards; each card is a `MetricQuery` (model + selected
 * measures/dimensions/segments) rendered as a chart. Boards are SabBI's own
 * data, stored in the `sabbi_boards` collection and tenant-scoped by the active
 * project (string `projectId`, resolved the same way as every other SabBI
 * surface via {@link getSabbiWorkspaceId}). Direct Mongo (no Rust crate) keeps
 * the cross-filter dashboard iteration fast.
 */
import { randomUUID } from 'crypto';

import { ObjectId, type Document } from 'mongodb';

import { runWithRustTenantAs } from '@/lib/rust-client/fetcher';
import { runBiMetricQuery, type MetricQueryInput } from '@/lib/rust-client/bi-models';
import type { BiChartRunResponse } from '@/lib/rust-client/bi-charts';
import { connectToDatabase } from '@/lib/mongodb';

import { getSabbiWorkspaceId } from './workspace';

/** A forced row-level-security filter applied to every card of a public board. */
export interface BoardRls {
  column: string;
  op: string;
  value: unknown;
}

export interface BoardCard {
  id: string;
  title: string;
  modelId: string;
  measures: string[];
  dimensions: string[];
  segments: string[];
  /** Visual type (matches ResultChartType). */
  chartType: string;
  /** Grid column span, 1–12 (defaults to 6). */
  w?: number;
}

export interface BoardDoc {
  _id: string;
  projectId: string;
  name: string;
  description?: string;
  cards: BoardCard[];
  /** Public read-only share. */
  isPublic?: boolean;
  shareToken?: string;
  /** Forced filters applied to every card when viewed via the public link. */
  rls?: BoardRls[];
  createdAt?: string;
  updatedAt?: string;
}

const COLL = 'sabbi_boards';

async function scope(): Promise<{ db: Awaited<ReturnType<typeof connectToDatabase>>['db']; projectId: string }> {
  const projectId = await getSabbiWorkspaceId();
  if (!projectId) throw new Error('No active SabBI workspace');
  const { db } = await connectToDatabase();
  return { db, projectId };
}

function serialize(doc: Document): BoardDoc {
  return {
    _id: String(doc._id),
    projectId: String(doc.projectId),
    name: doc.name,
    description: doc.description ?? undefined,
    cards: Array.isArray(doc.cards) ? (doc.cards as BoardCard[]) : [],
    isPublic: !!doc.isPublic,
    shareToken: doc.shareToken ?? undefined,
    rls: Array.isArray(doc.rls) ? (doc.rls as BoardRls[]) : [],
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
  };
}

export async function listBoards(): Promise<BoardDoc[]> {
  const { db, projectId } = await scope();
  const rows = await db
    .collection(COLL)
    .find({ projectId })
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(200)
    .toArray();
  return rows.map(serialize);
}

export async function getBoard(id: string): Promise<BoardDoc | null> {
  if (!ObjectId.isValid(id)) return null;
  const { db, projectId } = await scope();
  const row = await db.collection(COLL).findOne({ _id: new ObjectId(id), projectId });
  return row ? serialize(row) : null;
}

export async function createBoard(input: { name: string; description?: string }): Promise<{ id: string }> {
  const { db, projectId } = await scope();
  const now = new Date();
  const res = await db.collection(COLL).insertOne({
    projectId,
    name: input.name.trim() || 'Untitled board',
    description: input.description?.trim() || undefined,
    cards: [],
    createdAt: now,
    updatedAt: now,
  });
  return { id: String(res.insertedId) };
}

export async function updateBoard(
  id: string,
  patch: Partial<Pick<BoardDoc, 'name' | 'description' | 'cards'>>,
): Promise<void> {
  if (!ObjectId.isValid(id)) throw new Error('Invalid board id');
  const { db, projectId } = await scope();
  const set: Document = { updatedAt: new Date() };
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.cards !== undefined) set.cards = patch.cards;
  await db.collection(COLL).updateOne({ _id: new ObjectId(id), projectId }, { $set: set });
}

export async function deleteBoard(id: string): Promise<void> {
  if (!ObjectId.isValid(id)) return;
  const { db, projectId } = await scope();
  await db.collection(COLL).deleteOne({ _id: new ObjectId(id), projectId });
}

/* ─── Public sharing + RLS ───────────────────────────────────────────────── */

/**
 * Toggle a board's public share + set its row-level-security filters. Returns
 * the share token (minted on first publish). Owner-scoped.
 */
export async function setBoardShare(
  id: string,
  opts: { isPublic: boolean; rls?: BoardRls[] },
): Promise<{ shareToken: string | null }> {
  if (!ObjectId.isValid(id)) throw new Error('Invalid board id');
  const { db, projectId } = await scope();
  const existing = await db.collection(COLL).findOne({ _id: new ObjectId(id), projectId });
  if (!existing) throw new Error('Board not found');
  const shareToken = opts.isPublic ? existing.shareToken ?? randomUUID().replace(/-/g, '') : existing.shareToken;
  await db.collection(COLL).updateOne(
    { _id: new ObjectId(id), projectId },
    { $set: { isPublic: opts.isPublic, shareToken, rls: opts.rls ?? existing.rls ?? [], updatedAt: new Date() } },
  );
  return { shareToken: opts.isPublic ? shareToken : null };
}

/**
 * Resolve a public board by its share token — NO session/project scope (the
 * token is the capability). Returns null unless the board is currently public.
 */
export async function getBoardByToken(token: string): Promise<BoardDoc | null> {
  if (!token) return null;
  const { db } = await connectToDatabase();
  const row = await db.collection(COLL).findOne({ shareToken: token, isPublic: true });
  return row ? serialize(row) : null;
}

const PUBLIC_SERVER_TYPE: Record<string, MetricQueryInput['chartType']> = {
  table: 'table', kpi: 'table', bar: 'bar', stacked: 'bar', line: 'line', area: 'line', pie: 'pie', donut: 'pie',
};

/**
 * Run one card of a PUBLIC board for an anonymous viewer. Scopes the Rust call
 * to the board's project via {@link runWithRustTenantAs} (no cookie needed) and
 * force-applies the board's RLS filters, so a public viewer can never widen the
 * data beyond what the owner shared.
 */
export async function runPublicBoardCard(
  projectId: string,
  card: BoardCard,
  rls: BoardRls[],
): Promise<BiChartRunResponse> {
  const query: MetricQueryInput = {
    modelId: card.modelId,
    measures: card.measures,
    dimensions: card.dimensions,
    segments: card.segments,
    filters: rls.map((f) => ({ column: f.column, op: f.op, value: f.value })),
    chartType: PUBLIC_SERVER_TYPE[card.chartType] ?? 'bar',
    limit: 100,
  };
  return runWithRustTenantAs(projectId, projectId, () => runBiMetricQuery(query));
}
