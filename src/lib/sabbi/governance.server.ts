import 'server-only';

/**
 * SabBI governance — "Verified" status for semantic models.
 *
 * Stored alongside (not inside) the Rust model doc, in `sabbi_governance`,
 * project-scoped. Verifying a model marks its logic as confirmed; editing the
 * model's measures/dimensions/collection auto-strips verification (see
 * `updateModelAction`), so a "Verified" badge always reflects the current logic.
 */
import { connectToDatabase } from '@/lib/mongodb';

import { getSabbiWorkspaceId } from './workspace';

const COLL = 'sabbi_governance';

export interface Governance {
  modelId: string;
  verified: boolean;
  verifiedAt?: string;
}

async function scope() {
  const projectId = await getSabbiWorkspaceId();
  if (!projectId) throw new Error('No active SabBI workspace');
  const { db } = await connectToDatabase();
  return { db, projectId };
}

export async function getGovernanceMap(): Promise<Record<string, Governance>> {
  const { db, projectId } = await scope();
  const rows = await db.collection(COLL).find({ projectId }).toArray();
  const out: Record<string, Governance> = {};
  for (const r of rows) {
    out[String(r.modelId)] = {
      modelId: String(r.modelId),
      verified: !!r.verified,
      verifiedAt: r.verifiedAt instanceof Date ? r.verifiedAt.toISOString() : r.verifiedAt,
    };
  }
  return out;
}

export async function getGovernance(modelId: string): Promise<Governance> {
  const { db, projectId } = await scope();
  const r = await db.collection(COLL).findOne({ projectId, modelId });
  return {
    modelId,
    verified: !!r?.verified,
    verifiedAt: r?.verifiedAt instanceof Date ? r.verifiedAt.toISOString() : r?.verifiedAt,
  };
}

export async function setVerified(modelId: string, verified: boolean): Promise<void> {
  const { db, projectId } = await scope();
  await db.collection(COLL).updateOne(
    { projectId, modelId },
    { $set: { verified, verifiedAt: verified ? new Date() : null } },
    { upsert: true },
  );
}

/** Strip verification (called when a model's logic changes). */
export async function clearVerified(modelId: string): Promise<void> {
  const { db, projectId } = await scope();
  await db
    .collection(COLL)
    .updateOne({ projectId, modelId }, { $set: { verified: false, verifiedAt: null } }, { upsert: false });
}
