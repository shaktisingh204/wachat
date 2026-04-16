import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import type { Collection } from 'mongodb';
import type { SabFlowDoc } from './types';

export async function getSabFlowCollection(): Promise<Collection<SabFlowDoc>> {
  const { db } = await connectToDatabase();
  return db.collection<SabFlowDoc>('sabflows');
}

// ── getSabFlowsByUserId ────────────────────────────────────────────────────

/**
 * Returns all SabFlowDocs owned by the given user, sorted by last updated.
 * Full documents are returned (caller can project if needed).
 */
export async function getSabFlowsByUserId(userId: string): Promise<SabFlowDoc[]> {
  const col = await getSabFlowCollection();
  return col.find({ userId }).sort({ updatedAt: -1 }).toArray();
}

// ── getSabFlowById ─────────────────────────────────────────────────────────

/**
 * Returns a single SabFlowDoc by its MongoDB ObjectId string.
 * Returns null when the id is invalid or the document does not exist.
 */
export async function getSabFlowById(id: string): Promise<SabFlowDoc | null> {
  if (!ObjectId.isValid(id)) return null;
  const col = await getSabFlowCollection();
  return col.findOne({ _id: new ObjectId(id) });
}

// ── saveSabFlow ────────────────────────────────────────────────────────────

/**
 * Upserts a SabFlowDoc into the collection.
 * When `flow._id` is present the document is replaced in-place;
 * otherwise a new document is inserted.
 */
export async function saveSabFlow(flow: SabFlowDoc): Promise<void> {
  const col = await getSabFlowCollection();

  if (flow._id) {
    const { _id, ...rest } = flow;
    await col.replaceOne(
      { _id },
      { _id, ...rest, updatedAt: new Date() } as SabFlowDoc,
      { upsert: true },
    );
  } else {
    const now = new Date();
    await col.insertOne({
      ...flow,
      createdAt: flow.createdAt ?? now,
      updatedAt: now,
    } as SabFlowDoc);
  }
}

// ── deleteSabFlow ──────────────────────────────────────────────────────────

/**
 * Deletes a SabFlowDoc by its MongoDB ObjectId string.
 * Silently does nothing when the id is invalid or the document is missing.
 */
export async function deleteSabFlow(id: string): Promise<void> {
  if (!ObjectId.isValid(id)) return;
  const col = await getSabFlowCollection();
  await col.deleteOne({ _id: new ObjectId(id) });
}
