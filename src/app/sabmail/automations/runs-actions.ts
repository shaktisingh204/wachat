'use server';

import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';
import { getSabmailWorkspaceId } from '@/lib/sabmail/workspace';
import type {
  SabmailJourneyRunDoc,
  SabmailJourneyRunHistoryEntry,
  SabmailJourneyRunStatus,
} from '@/lib/sabmail/journey-engine';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail Automations — PER-RUN journey analytics (read-only).
 *
 * Each enrolled person gets an independent per-person FSM "run" persisted in
 * `SABMAIL_COLLECTIONS.journeyRuns` (see `src/lib/sabmail/journey-engine.ts`).
 * Every run carries a rich `history[]` (enrolled / sent / waited / branched /
 * skipped / completed / failed entries) that the engine writes but no surface
 * has ever read back. This module surfaces that telemetry.
 *
 * Both actions are workspace-scoped (every run keys off `workspaceId`, the
 * `kind:'mail'` project `_id` string) and return ONLY serialisable rows —
 * ObjectIds are stringified and Dates are emitted as ISO strings so the
 * payloads cross the server→client boundary cleanly.
 *
 * This is a NEW, isolated actions file: it never touches
 * `automations/actions.ts` so the two surfaces can't collide on exports.
 * ──────────────────────────────────────────────────────────────────── */

/** A run's history rolled up to the fields the runs table renders. */
export interface SabmailJourneyRunHistorySummary {
  /** Total history entries recorded for this run. */
  count: number;
  /** The most recent action verb (e.g. `sent`, `waited`, `completed`). */
  lastAction: string | null;
  /** ISO timestamp of the most recent history entry. */
  lastAt: string | null;
  /** The most recent entry's detail string, when present. */
  lastDetail: string | null;
}

/** One serialisable history entry (Dates already ISO on the engine side). */
export interface SabmailJourneyRunHistoryRow {
  nodeId: string;
  type: string;
  action: string;
  at: string;
  detail: string | null;
}

/** A serialisable per-run row for the runs table + detail timeline. */
export interface SabmailJourneyRunRow {
  id: string;
  personEmail: string;
  status: SabmailJourneyRunStatus;
  currentNodeId: string | null;
  /** Wake time (ISO) — `null` once the run is terminal. */
  nextRunAt: string | null;
  /** Enrolled-at (ISO). */
  createdAt: string;
  /** Last activity (ISO). */
  updatedAt: string;
  /** Rolled-up history headline for the table. */
  history: SabmailJourneyRunHistorySummary;
  /** Full ordered timeline for the expandable detail view. */
  timeline: SabmailJourneyRunHistoryRow[];
}

/** Status counts for the KPI row. */
export interface SabmailJourneyRunStats {
  active: number;
  completed: number;
  failed: number;
  total: number;
}

/** Cap on runs returned to the surface — keeps the payload bounded. */
const RUNS_LIMIT = 500;
/** Cap on timeline entries serialised per run — newest-relevant slice. */
const TIMELINE_LIMIT = 200;

async function runsCollection() {
  const { db } = await connectToDatabase();
  return db.collection<SabmailJourneyRunDoc>(SABMAIL_COLLECTIONS.journeyRuns);
}

/** Coerce any stored Date | string | number into an ISO string, or `null`. */
function toIso(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const d = new Date(value as string | number);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Normalise a single (defensively-typed) history entry to a serialisable row. */
function toHistoryRow(entry: SabmailJourneyRunHistoryEntry): SabmailJourneyRunHistoryRow {
  return {
    nodeId: typeof entry?.nodeId === 'string' ? entry.nodeId : String(entry?.nodeId ?? ''),
    type: typeof entry?.type === 'string' ? entry.type : String(entry?.type ?? 'unknown'),
    action: typeof entry?.action === 'string' ? entry.action : String(entry?.action ?? ''),
    at: toIso(entry?.at) ?? '',
    detail: typeof entry?.detail === 'string' && entry.detail ? entry.detail : null,
  };
}

function toRow(doc: WithId<SabmailJourneyRunDoc>): SabmailJourneyRunRow {
  const history = Array.isArray(doc.history) ? doc.history : [];
  const timeline = history.map(toHistoryRow);
  const last = timeline.length ? timeline[timeline.length - 1] : null;

  const status: SabmailJourneyRunStatus =
    doc.status === 'completed' || doc.status === 'failed' ? doc.status : 'active';

  return {
    id: String(doc._id),
    personEmail: String(doc.personEmail ?? ''),
    status,
    currentNodeId:
      typeof doc.currentNodeId === 'string' && doc.currentNodeId ? doc.currentNodeId : null,
    nextRunAt: toIso(doc.nextRunAt),
    createdAt: toIso(doc.createdAt) ?? '',
    updatedAt: toIso(doc.updatedAt) ?? '',
    history: {
      count: timeline.length,
      lastAction: last?.action || null,
      lastAt: last?.at || null,
      lastDetail: last?.detail ?? null,
    },
    // Cap the serialised timeline to the most recent slice (chronological order
    // preserved) so a very long-lived run can't bloat the client payload.
    timeline: timeline.length > TIMELINE_LIMIT ? timeline.slice(-TIMELINE_LIMIT) : timeline,
  };
}

/**
 * Every per-person run for one journey, newest-activity first, workspace-scoped.
 * Returns `[]` (never throws) when there is no active mail project, the id is
 * malformed, or the query fails — the surface renders an empty state.
 */
export async function listSabmailJourneyRuns(
  journeyId: string,
): Promise<SabmailJourneyRunRow[]> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return [];
    if (!journeyId || !ObjectId.isValid(journeyId)) return [];

    const col = await runsCollection();
    const docs = (await col
      .find({ workspaceId, journeyId })
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(RUNS_LIMIT)
      .toArray()) as WithId<SabmailJourneyRunDoc>[];

    return docs.map(toRow);
  } catch (err) {
    console.error('[sabmail] listSabmailJourneyRuns failed:', err);
    return [];
  }
}

/**
 * Status rollup for one journey's runs (active / completed / failed / total),
 * computed in a single `$group` aggregation. Returns all-zero on any failure.
 */
export async function getSabmailJourneyRunStats(
  journeyId: string,
): Promise<SabmailJourneyRunStats> {
  const empty: SabmailJourneyRunStats = { active: 0, completed: 0, failed: 0, total: 0 };
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return empty;
    if (!journeyId || !ObjectId.isValid(journeyId)) return empty;

    const col = await runsCollection();
    const grouped = (await col
      .aggregate([
        { $match: { workspaceId, journeyId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ])
      .toArray()) as Array<{ _id: string; count: number }>;

    const out: SabmailJourneyRunStats = { ...empty };
    for (const g of grouped) {
      const count = Number(g.count) || 0;
      out.total += count;
      if (g._id === 'completed') out.completed += count;
      else if (g._id === 'failed') out.failed += count;
      else out.active += count; // 'active' + any unexpected status bucket
    }
    return out;
  } catch (err) {
    console.error('[sabmail] getSabmailJourneyRunStats failed:', err);
    return empty;
  }
}
