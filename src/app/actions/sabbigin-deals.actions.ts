'use server';

/**
 * SabBigin deal-stage enforcement.
 *
 * `moveSabbiginDealStage` is the single chokepoint the SabBigin board/detail
 * call when a deal changes stage. It layers Bigin-beating governance on top of
 * the base `updateCrmDealStage`:
 *   1. required-field gates (a deal can't enter a gated stage with blanks),
 *   2. approval gates (freeze the move, raise a `crm_approvals` request),
 *   3. connected pipelines (auto-spawn a linked deal in another pipeline),
 *   4. automation dispatch (`stage_changed`).
 *
 * Stage governance is read from the `sabbigin_pipeline_config` sidecar.
 */

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { updateCrmDealStage } from '@/app/actions/crm-deals.actions';
import { getSabbiginPipelineConfig } from '@/app/actions/sabbigin-pipeline-config.actions';
import {
  missingRequiredFields,
  matchingConnections,
} from '@/lib/sabbigin/booking-logic';

export type DealFieldPatch = Record<string, string | number | null>;

export interface MoveResult {
  success: boolean;
  error?: string;
  /** Field keys that must be filled before the move can proceed. */
  requiredFields?: string[];
  /** The move was frozen pending an approval. */
  pendingApproval?: boolean;
  approvalId?: string;
}

const DEAL_FIELD_COERCERS: Record<string, (v: unknown) => unknown> = {
  value: (v) => Number(v) || 0,
  probability: (v) => Number(v) || 0,
  closeDate: (v) => (v ? new Date(String(v)) : undefined),
};

/**
 * The actual move — applies the field patch, writes the stage, spawns
 * connected-pipeline deals, and dispatches automations. No approval gate
 * (callers that reach here are already cleared, e.g. an approved request).
 */
export async function applySabbiginStageMove(
  dealId: string,
  toStage: string,
  patch?: DealFieldPatch,
): Promise<MoveResult> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Access denied' };
  if (!dealId || !ObjectId.isValid(dealId))
    return { success: false, error: 'Invalid deal id' };

  const { db } = await connectToDatabase();
  const userId = new ObjectId(session.user._id);
  const dealOid = new ObjectId(dealId);

  const deal = await db.collection('crm_deals').findOne({ _id: dealOid, userId });
  if (!deal) return { success: false, error: 'Deal not found' };
  const fromStage = String(deal.stage ?? '');

  // 1. apply the field patch (so required-field values land before the move)
  if (patch && Object.keys(patch).length) {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    for (const [k, v] of Object.entries(patch)) {
      const coerce = DEAL_FIELD_COERCERS[k];
      set[k] = coerce ? coerce(v) : v;
    }
    await db.collection('crm_deals').updateOne({ _id: dealOid, userId }, { $set: set });
  }

  // 2. write the stage (delegates to the dual-path base action)
  const moved = await updateCrmDealStage(dealId, toStage);
  if (!moved.success) return { success: false, error: moved.error };

  // 3. connected pipelines — spawn linked deals on enter/won/lost
  try {
    const cfg = deal.pipelineId
      ? await getSabbiginPipelineConfig(String(deal.pipelineId))
      : null;
    if (cfg?.connections?.length) {
      for (const conn of matchingConnections(cfg.connections, toStage)) {
        // loop guard: don't re-spawn into a pipeline already linked from here
        const existing = await db.collection('crm_deals').findOne({
          userId,
          pipelineId: conn.targetPipelineId,
          'lineage.id': dealId,
        });
        if (existing) continue;
        await db.collection('crm_deals').insertOne({
          userId,
          name: deal.name,
          value: deal.value ?? 0,
          currency: deal.currency ?? 'INR',
          stage: conn.targetStage,
          pipelineId: conn.targetPipelineId,
          accountId: deal.accountId,
          contactIds: deal.contactIds ?? [],
          ownerId: deal.ownerId,
          lineage: [
            { kind: 'deal', id: dealId, no: deal.name, createdAt: new Date().toISOString() },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  } catch (e) {
    console.warn('[applySabbiginStageMove] connection spawn failed:', e);
  }

  // 4. dispatch automations (stage_changed)
  try {
    const { dispatchAutomations } = await import('@/lib/automations/dispatch');
    await dispatchAutomations({
      type: 'stage_changed',
      entityKind: 'deal',
      entityId: dealId,
      tenantUserId: String(userId),
      entity: { ...deal, _id: dealId, stage: toStage } as any,
      fieldName: 'stage',
      fromValue: fromStage,
      toValue: toStage,
      occurredAt: Date.now(),
    });
  } catch (e) {
    console.warn('[applySabbiginStageMove] automation dispatch failed:', e);
  }

  revalidatePath('/dashboard/sabbigin/deals');
  revalidatePath(`/dashboard/sabbigin/deals/${dealId}`);
  return { success: true };
}

/**
 * Inline field patch for the sheet/detail views. Stage changes are NOT
 * accepted here — route those through `moveSabbiginDealStage` so governance
 * runs. Other scalar fields (name, value, probability, closeDate, …) are
 * written directly.
 */
export async function patchSabbiginDeal(
  dealId: string,
  patch: DealFieldPatch,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Access denied' };
  if (!dealId || !ObjectId.isValid(dealId))
    return { success: false, error: 'Invalid deal id' };
  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id);
    const set: Record<string, unknown> = { updatedAt: new Date() };
    for (const [k, v] of Object.entries(patch)) {
      if (k === 'stage') continue; // governance only
      const coerce = DEAL_FIELD_COERCERS[k];
      set[k] = coerce ? coerce(v) : v;
    }
    const res = await db
      .collection('crm_deals')
      .updateOne({ _id: new ObjectId(dealId), userId }, { $set: set });
    if (res.matchedCount === 0) return { success: false, error: 'Deal not found' };
    revalidatePath('/dashboard/sabbigin/deals');
    revalidatePath(`/dashboard/sabbigin/deals/${dealId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Failed to update deal' };
  }
}

export interface CreateSabbiginDealInput {
  name: string;
  value?: number | null;
  currency?: string | null;
  stage: string;
  pipelineId: string;
  probability?: number | null;
  closeDate?: string | null;
  description?: string | null;
  nextStep?: string | null;
  priority?: 'low' | 'medium' | 'high' | 'critical' | null;
  contactId?: string | null;
  accountId?: string | null;
}

export interface CreateSabbiginDealResult {
  success: boolean;
  error?: string;
  dealId?: string;
}

/**
 * Typed create used by the SabBigin "New deal" form. Returns the new
 * `dealId` so the client can redirect straight to the detail page — the
 * FormData-based `createCrmDeal` doesn't surface the inserted id, which
 * makes that contract awkward for this flow.
 */
export async function createSabbiginDeal(
  input: CreateSabbiginDealInput,
): Promise<CreateSabbiginDealResult> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Access denied' };

  const name = (input.name ?? '').trim();
  const stage = (input.stage ?? '').trim();
  const pipelineId = (input.pipelineId ?? '').trim();
  if (!name) return { success: false, error: 'Deal name is required.' };
  if (!stage) return { success: false, error: 'Stage is required.' };
  if (!pipelineId) return { success: false, error: 'Pipeline is required.' };

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id);

    const doc: Record<string, unknown> = {
      userId,
      name,
      value: Number.isFinite(Number(input.value)) ? Number(input.value) : 0,
      currency: (input.currency || 'INR').trim() || 'INR',
      stage,
      pipelineId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (
      input.probability != null &&
      Number.isFinite(Number(input.probability))
    ) {
      doc.probability = Number(input.probability);
    }
    if (input.closeDate) {
      const d = new Date(input.closeDate);
      if (!Number.isNaN(d.getTime())) doc.closeDate = d;
    }
    if (input.description) doc.description = input.description;
    if (input.nextStep) doc.nextStep = input.nextStep;
    if (input.priority) doc.priority = input.priority;
    if (input.contactId && ObjectId.isValid(input.contactId)) {
      doc.contactIds = [new ObjectId(input.contactId)];
    }
    if (input.accountId && ObjectId.isValid(input.accountId)) {
      doc.accountId = new ObjectId(input.accountId);
    }

    const res = await db.collection('crm_deals').insertOne(doc);
    const dealId = res.insertedId.toHexString();

    // best-effort automation dispatch (entity_created)
    try {
      const { dispatchAutomations } = await import('@/lib/automations/dispatch');
      await dispatchAutomations({
        type: 'entity_created',
        entityKind: 'deal',
        entityId: dealId,
        tenantUserId: String(userId),
        entity: { ...doc, _id: dealId } as any,
        occurredAt: Date.now(),
      });
    } catch (e) {
      console.warn('[createSabbiginDeal] automation dispatch failed:', e);
    }

    revalidatePath('/dashboard/sabbigin/deals');
    revalidatePath(`/dashboard/sabbigin/deals/${dealId}`);
    return { success: true, dealId };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Failed to create deal' };
  }
}

/**
 * Public entry — runs the required-field + approval gates before moving.
 */
export async function moveSabbiginDealStage(
  dealId: string,
  toStage: string,
  patch?: DealFieldPatch,
): Promise<MoveResult> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Access denied' };
  if (!dealId || !ObjectId.isValid(dealId))
    return { success: false, error: 'Invalid deal id' };

  const { db } = await connectToDatabase();
  const userId = new ObjectId(session.user._id);
  const deal = await db
    .collection('crm_deals')
    .findOne({ _id: new ObjectId(dealId), userId });
  if (!deal) return { success: false, error: 'Deal not found' };

  const cfg = deal.pipelineId
    ? await getSabbiginPipelineConfig(String(deal.pipelineId))
    : null;
  const rule = cfg?.stageRules?.[toStage];

  // required-field gate
  const missing = missingRequiredFields(
    deal as Record<string, unknown>,
    rule?.requiredFields,
    patch as Record<string, unknown> | undefined,
  );
  if (missing.length) return { success: false, requiredFields: missing };

  // approval gate
  if (rule?.approvalRequired) {
    const already = await db.collection('crm_approvals').findOne({
      userId,
      dealId,
      toStage,
      status: 'approved',
    });
    if (!already) {
      const approvers = rule.approverIds?.length
        ? rule.approverIds
        : [String(userId)];
      const ins = await db.collection('crm_approvals').insertOne({
        userId,
        dealId,
        dealName: deal.name ?? 'Deal',
        pipelineId: String(deal.pipelineId ?? ''),
        fromStage: String(deal.stage ?? ''),
        toStage,
        patch: patch ?? null,
        requestedBy: String(userId),
        approverIds: approvers,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      // best-effort notify
      try {
        const { notifyDealApprovalRequested } = await import(
          '@/lib/sabbigin/notify'
        );
        await notifyDealApprovalRequested({
          approverIds: approvers,
          dealName: String(deal.name ?? 'Deal'),
          toStage,
          approvalId: ins.insertedId.toHexString(),
        });
      } catch {
        /* notification is best-effort */
      }
      revalidatePath('/dashboard/sabbigin/approvals');
      return {
        success: false,
        pendingApproval: true,
        approvalId: ins.insertedId.toHexString(),
      };
    }
  }

  return applySabbiginStageMove(dealId, toStage, patch);
}
