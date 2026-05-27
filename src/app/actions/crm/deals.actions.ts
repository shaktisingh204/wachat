'use server';

/**
 * CRM Deal server actions (Rust-backed).
 *
 * The Deal Rust endpoint requires `party.{kind,id}`, `pipelineId`,
 * `stageId`, `ownerId`, `amount`, and `expectedClose`. The form
 * captures `party` as two hidden inputs (`partyKind`, `partyId`).
 */

import { revalidatePath } from 'next/cache';
import { RustApiError } from '@/lib/rust-client';
import {
  crmDealsApi,
  type CrmDealCreateInput,
  type CrmDealDoc,
  type CrmDealListParams,
  type CrmDealParty,
  type CrmDealUpdateInput,
} from '@/lib/rust-client/crm-deals';
import { applyCustomFieldsToEntity } from '@/app/actions/worksuite/meta.actions';
import { recordFlowAction } from '@/lib/sabflow/audit/middleware';
import { getSession } from '@/app/actions/user.actions';

async function _crmDealActorId(): Promise<string | null> {
  try {
    const session = await getSession();
    const u = (session as { user?: { _id?: unknown; id?: unknown } } | null)?.user;
    const raw = u?._id ?? u?.id;
    if (!raw) return null;
    return typeof raw === 'string' ? raw : String(raw);
  } catch {
    return null;
  }
}

const LIST_PATH = '/dashboard/crm/deals';

function err(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error.';
}

function pickStr(fd: FormData, k: string): string | undefined {
  const v = fd.get(k);
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}

function pickNum(fd: FormData, k: string): number | undefined {
  const v = fd.get(k);
  if (typeof v !== 'string' || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function parseCustomFields(fd: FormData): Record<string, unknown> | null {
  const raw = fd.get('customFields');
  if (typeof raw !== 'string' || raw.length === 0 || raw === '{}') return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

interface DealListResult {
  deals: CrmDealDoc[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  error?: string;
}

export async function listDeals(params: CrmDealListParams = {}): Promise<DealListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(Math.max(1, params.limit ?? 20), 100);
  try {
    const res = await crmDealsApi.list({ ...params, page, limit });
    return {
      deals: res.deals,
      page: res.page,
      limit: res.limit,
      total: res.total,
      hasMore: res.page * res.limit < res.total,
    };
  } catch (e) {
    return { deals: [], page, limit, total: 0, hasMore: false, error: err(e) };
  }
}

export async function getDeal(id: string): Promise<{ deal: CrmDealDoc | null; error?: string }> {
  try {
    const { deal } = await crmDealsApi.getById(id);
    return { deal };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) return { deal: null, error: 'Deal not found.' };
    return { deal: null, error: err(e) };
  }
}

export async function saveDealAction(
  _prev: unknown,
  fd: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const id = pickStr(fd, '_id');
  const title = pickStr(fd, 'title');
  const pipelineId = pickStr(fd, 'pipelineId');
  const stageId = pickStr(fd, 'stageId');
  const ownerId = pickStr(fd, 'ownerId');
  const amount = pickNum(fd, 'amount');
  const expectedClose = pickStr(fd, 'expectedClose');

  // Party — two hidden inputs encode kind+id.
  const partyKind = pickStr(fd, 'partyKind');
  const partyId = pickStr(fd, 'partyId');

  if (!id) {
    // Create — full validation.
    if (!title) return { error: 'Title is required.' };
    if (!pipelineId || !stageId) return { error: 'Pipeline and stage are required.' };
    if (!ownerId) return { error: 'Owner is required.' };
    if (amount == null) return { error: 'Amount is required.' };
    if (!expectedClose) return { error: 'Expected close date is required.' };
    if (!partyKind || !partyId) return { error: 'Counter-party (client or lead) is required.' };
    if (partyKind !== 'client' && partyKind !== 'lead') {
      return { error: 'Party kind must be "client" or "lead".' };
    }
  }

  const party: CrmDealParty | undefined =
    partyKind && partyId
      ? { kind: partyKind as 'client' | 'lead', id: partyId }
      : undefined;

  // Convert expectedClose (YYYY-MM-DD) to ISO at end-of-day UTC so the
  // Rust DateTime<Utc> parser accepts it.
  const expectedIso = expectedClose ? new Date(`${expectedClose}T00:00:00Z`).toISOString() : undefined;

  try {
    if (id) {
      const patch: CrmDealUpdateInput = {
        title,
        pipelineId,
        stageId,
        ownerId,
        amount,
        currency: pickStr(fd, 'currency'),
        probabilityPct: pickNum(fd, 'probabilityPct'),
        expectedClose: expectedIso,
        status: pickStr(fd, 'status'),
        wonLostReason: pickStr(fd, 'wonLostReason'),
        party,
      };
      // Strip undefineds so we don't overwrite with nulls.
      const clean = Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== undefined),
      ) as CrmDealUpdateInput;
      await crmDealsApi.update(id, clean);

      const cf = parseCustomFields(fd);
      if (cf) {
        try {
          await applyCustomFieldsToEntity('deal', id, cf);
        } catch (e) {
          console.error('[saveDealAction] custom fields apply failed:', e);
        }
      }

      revalidatePath(LIST_PATH);
      revalidatePath(`${LIST_PATH}/${id}`);
      const actorId = await _crmDealActorId();
      if (actorId) {
        const statusV = pickStr(fd, 'status');
        let action: 'crm.deal.stageChanged' | 'crm.deal.closed.won' | 'crm.deal.closed.lost' | null = null;
        if (statusV === 'won') action = 'crm.deal.closed.won';
        else if (statusV === 'lost') action = 'crm.deal.closed.lost';
        else if (stageId) action = 'crm.deal.stageChanged';
        if (action) {
          void recordFlowAction(action, {
            userId: actorId,
            target: id,
            metadata: { stageId, status: statusV },
          });
        }
      }
      return { message: 'Deal updated.', id };
    }

    const draft: CrmDealCreateInput = {
      title: title!,
      pipelineId: pipelineId!,
      stageId: stageId!,
      ownerId: ownerId!,
      party: party!,
      amount: amount!,
      currency: pickStr(fd, 'currency') ?? 'INR',
      probabilityPct: pickNum(fd, 'probabilityPct'),
      expectedClose: expectedIso!,
      status: pickStr(fd, 'status') ?? 'open',
      wonLostReason: pickStr(fd, 'wonLostReason'),
    };
    const { dealId } = await crmDealsApi.create(draft);

    const cf = parseCustomFields(fd);
    if (cf && dealId) {
      try {
        await applyCustomFieldsToEntity('deal', dealId, cf);
      } catch (e) {
        console.error('[saveDealAction] custom fields apply failed:', e);
      }
    }

    revalidatePath(LIST_PATH);
    const actorId = await _crmDealActorId();
    if (actorId) {
      void recordFlowAction('crm.deal.created', {
        userId: actorId,
        target: dealId,
        metadata: { title: draft.title, amount: draft.amount, pipelineId: draft.pipelineId },
      });
    }
    return { message: 'Deal created.', id: dealId };
  } catch (e) {
    return { error: err(e) };
  }
}

export async function deleteDealAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await crmDealsApi.delete(id);
    revalidatePath(LIST_PATH);
    const actorId = await _crmDealActorId();
    if (actorId) {
      void recordFlowAction('crm.deal.deleted', {
        userId: actorId,
        target: id,
      });
    }
    return { success: true };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) return { success: false, error: 'Deal not found.' };
    return { success: false, error: err(e) };
  }
}
