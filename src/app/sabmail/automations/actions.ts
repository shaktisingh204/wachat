'use server';

import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';
import { getSabmailWorkspaceId } from '@/lib/sabmail/workspace';
import { getErrorMessage } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail Automations / Journeys — visual builder + persistence.
 *
 * A journey is a workspace-scoped React Flow graph ({ nodes, edges }). This
 * surface ONLY builds + persists the graph; the execution engine is out of
 * scope (the editor shows a "runs when the engine is enabled" note).
 *
 * Stored in SABMAIL_COLLECTIONS.journeys, scoped by `workspaceId`. We type the
 * collection locally (the shared accessor only types accounts + settings).
 * ──────────────────────────────────────────────────────────────────── */

/** Persisted journey document (Mongo shape). */
interface SabmailJourneyDoc {
  _id?: ObjectId;
  workspaceId: string;
  name: string;
  enabled: boolean;
  /** React Flow graph — typed loosely on the persistence boundary. */
  nodes: unknown[];
  edges: unknown[];
  createdAt: Date;
  updatedAt: Date;
}

/** Lightweight row for the list view. */
export interface SabmailJourneyRow {
  id: string;
  name: string;
  enabled: boolean;
  nodeCount: number;
  edgeCount: number;
  updatedAt: string;
  createdAt: string;
}

/** Full journey (with the graph) for the editor. */
export interface SabmailJourneyDetail {
  id: string;
  name: string;
  enabled: boolean;
  nodes: unknown[];
  edges: unknown[];
  updatedAt: string;
  createdAt: string;
}

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };
type VoidResult = { ok: true } | { ok: false; error: string };

function toRow(doc: WithId<SabmailJourneyDoc>): SabmailJourneyRow {
  return {
    id: String(doc._id),
    name: doc.name,
    enabled: !!doc.enabled,
    nodeCount: Array.isArray(doc.nodes) ? doc.nodes.length : 0,
    edgeCount: Array.isArray(doc.edges) ? doc.edges.length : 0,
    updatedAt: new Date(doc.updatedAt ?? doc.createdAt ?? new Date()).toISOString(),
    createdAt: new Date(doc.createdAt ?? new Date()).toISOString(),
  };
}

function toDetail(doc: WithId<SabmailJourneyDoc>): SabmailJourneyDetail {
  return {
    id: String(doc._id),
    name: doc.name,
    enabled: !!doc.enabled,
    nodes: Array.isArray(doc.nodes) ? doc.nodes : [],
    edges: Array.isArray(doc.edges) ? doc.edges : [],
    updatedAt: new Date(doc.updatedAt ?? doc.createdAt ?? new Date()).toISOString(),
    createdAt: new Date(doc.createdAt ?? new Date()).toISOString(),
  };
}

async function journeysCollection() {
  const { db } = await connectToDatabase();
  return db.collection<SabmailJourneyDoc>(SABMAIL_COLLECTIONS.journeys);
}

/* ── list ─────────────────────────────────────────────────────────────── */

export async function listSabmailJourneys(): Promise<SabmailJourneyRow[]> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return [];
    const col = await journeysCollection();
    const docs = await col
      .find({ workspaceId })
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(200)
      .toArray();
    return docs.map((d) => toRow(d as WithId<SabmailJourneyDoc>));
  } catch (err) {
    console.error('[sabmail] listSabmailJourneys failed:', err);
    return [];
  }
}

/* ── get one ──────────────────────────────────────────────────────────── */

export async function getSabmailJourney(
  id: string,
): Promise<SabmailJourneyDetail | null> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return null;
    if (!id || !ObjectId.isValid(id)) return null;
    const col = await journeysCollection();
    const doc = await col.findOne({ _id: new ObjectId(id), workspaceId });
    return doc ? toDetail(doc as WithId<SabmailJourneyDoc>) : null;
  } catch (err) {
    console.error('[sabmail] getSabmailJourney failed:', err);
    return null;
  }
}

/* ── create ───────────────────────────────────────────────────────────── */

export async function createSabmailJourney(input: {
  name: string;
}): Promise<Result<{ id: string }>> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };

    const name = input.name?.trim();
    if (!name) return { ok: false, error: 'Journey name is required.' };
    if (name.length > 120) {
      return { ok: false, error: 'Journey name is too long (max 120 chars).' };
    }

    const col = await journeysCollection();
    const now = new Date();
    const ins = await col.insertOne({
      workspaceId,
      name,
      enabled: false,
      nodes: [],
      edges: [],
      createdAt: now,
      updatedAt: now,
    });
    return { ok: true, id: String(ins.insertedId) };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}

/* ── save (name / enabled / graph) ────────────────────────────────────── */

export async function saveSabmailJourney(
  id: string,
  patch: {
    name?: string;
    enabled?: boolean;
    nodes?: unknown[];
    edges?: unknown[];
  },
): Promise<VoidResult> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
    if (!id || !ObjectId.isValid(id)) {
      return { ok: false, error: 'Invalid journey id.' };
    }

    const set: Partial<SabmailJourneyDoc> = { updatedAt: new Date() };
    if (typeof patch.name === 'string') {
      const name = patch.name.trim();
      if (!name) return { ok: false, error: 'Journey name cannot be empty.' };
      if (name.length > 120) {
        return { ok: false, error: 'Journey name is too long (max 120 chars).' };
      }
      set.name = name;
    }
    if (typeof patch.enabled === 'boolean') set.enabled = patch.enabled;
    if (Array.isArray(patch.nodes)) set.nodes = patch.nodes;
    if (Array.isArray(patch.edges)) set.edges = patch.edges;

    const col = await journeysCollection();
    const res = await col.updateOne(
      { _id: new ObjectId(id), workspaceId },
      { $set: set },
    );
    if (res.matchedCount === 0) {
      return { ok: false, error: 'Journey not found.' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}

/* ── delete ───────────────────────────────────────────────────────────── */

export async function deleteSabmailJourney(id: string): Promise<VoidResult> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
    if (!id || !ObjectId.isValid(id)) {
      return { ok: false, error: 'Invalid journey id.' };
    }
    const col = await journeysCollection();
    const res = await col.deleteOne({ _id: new ObjectId(id), workspaceId });
    if (res.deletedCount === 0) {
      return { ok: false, error: 'Journey not found.' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}
