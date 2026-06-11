'use server';

/**
 * SabBigin pipeline-config sidecar.
 *
 * SabBigin's advanced pipeline metadata — per-stage rules (required fields,
 * approval gates), connected-pipeline routing, and win/lost stage marking —
 * lives in a dedicated `sabbigin_pipeline_config` collection keyed by
 * `{userId, pipelineId}` rather than embedded on `users.crmPipelines[]`. That
 * keeps the shared pipeline doc and the Rust `crm-pipelines` crate untouched
 * (no Rust/TS lock-step needed) while giving SabBigin Bigin-class pipeline
 * power. The base pipeline (name, stages, colours) is still owned by
 * `crm-pipelines.actions.ts`.
 */

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

const COLL = 'sabbigin_pipeline_config';

export type SabbiginStageRule = {
  /** Deal field keys that must be non-empty before ENTERING this stage. */
  requiredFields?: string[];
  /** Require an approval before a deal may enter this stage. */
  approvalRequired?: boolean;
  /** User ids who may approve. Empty = workspace owner. */
  approverIds?: string[];
};

export type SabbiginConnection = {
  id: string;
  fromStage: string;
  event: 'enter' | 'won' | 'lost';
  targetPipelineId: string;
  targetStage: string;
  active?: boolean;
};

export interface SabbiginPipelineConfigDoc {
  _id: string;
  userId: string;
  pipelineId: string;
  stageRules: Record<string, SabbiginStageRule>;
  connections: SabbiginConnection[];
  winStages: string[];
  lostStages: string[];
  updatedAt: string;
}

function emptyConfig(pipelineId: string, userId: string): SabbiginPipelineConfigDoc {
  return {
    _id: '',
    userId,
    pipelineId,
    stageRules: {},
    connections: [],
    winStages: [],
    lostStages: [],
    updatedAt: new Date().toISOString(),
  };
}

export async function getSabbiginPipelineConfig(
  pipelineId: string,
): Promise<SabbiginPipelineConfigDoc | null> {
  const session = await getSession();
  if (!session?.user?._id) return null;
  if (!pipelineId) return null;
  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id);
    const doc = await db
      .collection(COLL)
      .findOne({ userId, pipelineId });
    if (!doc) return emptyConfig(pipelineId, String(userId));
    return JSON.parse(JSON.stringify(doc)) as SabbiginPipelineConfigDoc;
  } catch (e) {
    console.error('[getSabbiginPipelineConfig] failed:', e);
    return emptyConfig(pipelineId, '');
  }
}

export async function saveSabbiginPipelineConfig(
  pipelineId: string,
  patch: {
    stageRules?: Record<string, SabbiginStageRule>;
    connections?: SabbiginConnection[];
    winStages?: string[];
    lostStages?: string[];
  },
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Access denied' };
  if (!pipelineId) return { success: false, error: 'Missing pipeline id' };
  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id);
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.stageRules) set.stageRules = patch.stageRules;
    if (patch.connections) set.connections = patch.connections;
    if (patch.winStages) set.winStages = patch.winStages;
    if (patch.lostStages) set.lostStages = patch.lostStages;
    await db.collection(COLL).updateOne(
      { userId, pipelineId },
      { $set: set, $setOnInsert: { userId, pipelineId } },
      { upsert: true },
    );
    revalidatePath('/dashboard/sabbigin/pipelines');
    revalidatePath('/dashboard/sabbigin/deals');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Failed to save pipeline config' };
  }
}
