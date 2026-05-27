'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import {
  crmHireApi,
  type CrmHireCreateInput,
  type CrmHireUpdateInput,
} from '@/lib/rust-client/crm-hire';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
  return process.env.USE_RUST_CRM === 'true';
}

/**
 * Shape returned by `getCrmHireById`. Mirrors the Mongo document for the
 * `crm_purchase_leads` collection. All fields except `_id`/`userId` are
 * optional because hire requests are progressively enriched.
 */
interface CrmHireDoc {
  _id: ObjectId | string;
  userId: ObjectId | string;
  title?: string;
  category?: string;
  vendorCandidate?: string;
  requiredBy?: Date | string;
  quantity?: number;
  estimatedBudget?: number;
  specs?: string;
  owner?: string;
  stage?: string;
  status?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

/**
 * Fetch a single hire request (purchase lead) by id, scoped to the
 * current tenant. Returns `null` if the id is malformed, the doc doesn't
 * exist, or it lives under a different user.
 */
export async function getCrmHireById(
  hireId: string,
): Promise<WithId<CrmHireDoc> | null> {
  const session = await getSession();
  if (!session?.user) return null;
  if (!hireId || !ObjectId.isValid(hireId)) return null;

  if (useRustCrm()) {
    try {
      const doc = await crmHireApi.getById(hireId);
      return JSON.parse(JSON.stringify(doc)) as WithId<CrmHireDoc>;
    } catch (e) {
      if (e instanceof RustApiError && e.status === 404) return null;
      console.error('[getCrmHireById] rust path failed; falling back:', e);
      recordRustFallback({
        entity: 'purchase_lead',
        op: 'get',
        errorCode: e instanceof RustApiError ? e.code : undefined,
        status: e instanceof RustApiError ? e.status : undefined,
      });
    }
  }

  try {
    const { db } = await connectToDatabase();
    const doc = await db
      .collection('crm_purchase_leads')
      .findOne({
        _id: new ObjectId(hireId),
        userId: new ObjectId(session.user._id as string),
      } as any);
    if (!doc) return null;
    return JSON.parse(JSON.stringify(doc)) as WithId<CrmHireDoc>;
  } catch (e) {
    console.error('Failed to fetch CRM hire request:', e);
    return null;
  }
}

/**
 * Update an existing hire request. Mirrors the field set of
 * `savePurchaseLead` but operates on a doc identified by `hireId`.
 * Returns the same `{ message?, error?, id? }` shape so callers can
 * share toast/redirect handlers between create and edit.
 */
export async function updateCrmHire(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

  const hireId = (formData.get('hireId') as string | null)?.trim() || '';
  if (!hireId || !ObjectId.isValid(hireId)) {
    return { error: 'Invalid hire id.' };
  }

  const title = (formData.get('title') as string | null)?.trim() || '';
  if (!title) return { error: 'Lead title is required.' };

  const category = (formData.get('category') as string | null)?.trim() || undefined;
  const vendorCandidate = (formData.get('vendorCandidate') as string | null)?.trim() || undefined;
  const requiredByRaw = (formData.get('requiredBy') as string | null)?.trim() || '';
  const qtyRaw = formData.get('quantity');
  const qty = qtyRaw ? parseFloat(qtyRaw as string) : undefined;
  const estimatedBudgetRaw = formData.get('estimatedBudget');
  const estimatedBudget = estimatedBudgetRaw
    ? parseFloat(estimatedBudgetRaw as string)
    : undefined;
  const specs = (formData.get('specs') as string | null)?.trim() || undefined;
  const owner = (formData.get('owner') as string | null)?.trim() || undefined;
  const stage = (formData.get('stage') as string | null)?.trim() || undefined;
  const status = (formData.get('status') as string | null)?.trim() || undefined;

  if (useRustCrm()) {
    try {
      const patch: CrmHireUpdateInput = {
        title,
        ...(category !== undefined ? { category } : {}),
        ...(vendorCandidate !== undefined ? { vendorCandidate } : {}),
        ...(requiredByRaw
          ? { requiredBy: new Date(requiredByRaw).toISOString() }
          : {}),
        ...(qty !== undefined && !isNaN(qty) ? { quantity: qty } : {}),
        ...(estimatedBudget !== undefined && !isNaN(estimatedBudget)
          ? { estimatedBudget }
          : {}),
        ...(specs !== undefined ? { specs } : {}),
        ...(owner !== undefined ? { owner } : {}),
        ...(stage ? { stage } : {}),
        ...(status ? { status } : {}),
      };
      await crmHireApi.update(hireId, patch);
      revalidatePath('/dashboard/crm/purchases/hire');
      revalidatePath(`/dashboard/crm/purchases/hire/${hireId}`);
      return { message: 'Hire request updated.', id: hireId };
    } catch (e) {
      if (e instanceof RustApiError && e.status === 404) {
        return { error: 'Hire request not found.' };
      }
      console.error('[updateCrmHire] rust path failed; falling back:', e);
      recordRustFallback({
        entity: 'purchase_lead',
        op: 'update',
        errorCode: e instanceof RustApiError ? e.code : undefined,
        status: e instanceof RustApiError ? e.status : undefined,
      });
    }
  }

  try {
    const { db } = await connectToDatabase();
    const result = await db.collection('crm_purchase_leads').updateOne(
      {
        _id: new ObjectId(hireId),
        userId: new ObjectId(session.user._id as string),
      } as any,
      {
        $set: {
          title,
          ...(category ? { category } : { category: '' }),
          ...(vendorCandidate ? { vendorCandidate } : { vendorCandidate: '' }),
          ...(requiredByRaw ? { requiredBy: new Date(requiredByRaw) } : {}),
          ...(qty !== undefined && !isNaN(qty) ? { quantity: qty } : {}),
          ...(estimatedBudget !== undefined && !isNaN(estimatedBudget)
            ? { estimatedBudget }
            : {}),
          ...(specs ? { specs } : { specs: '' }),
          ...(owner ? { owner } : { owner: '' }),
          ...(stage ? { stage } : {}),
          ...(status ? { status } : {}),
          updatedAt: new Date(),
        },
      },
    );

    if (result.matchedCount === 0) {
      return { error: 'Hire request not found.' };
    }

    revalidatePath('/dashboard/crm/purchases/hire');
    revalidatePath(`/dashboard/crm/purchases/hire/${hireId}`);
    return { message: 'Hire request updated.', id: hireId };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { error: `Failed to update hire request: ${msg}` };
  }
}

export async function savePurchaseLead(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

  const title = (formData.get('title') as string | null)?.trim() || '';
  if (!title) return { error: 'Lead title is required.' };

  const category = (formData.get('category') as string | null)?.trim() || undefined;
  const vendorCandidate = (formData.get('vendorCandidate') as string | null)?.trim() || undefined;
  const requiredByRaw = (formData.get('requiredBy') as string | null)?.trim() || '';
  const qtyRaw = formData.get('quantity');
  const qty = qtyRaw ? parseFloat(qtyRaw as string) : undefined;
  const estimatedBudgetRaw = formData.get('estimatedBudget');
  const estimatedBudget = estimatedBudgetRaw
    ? parseFloat(estimatedBudgetRaw as string)
    : undefined;
  const specs = (formData.get('specs') as string | null)?.trim() || undefined;
  const owner = (formData.get('owner') as string | null)?.trim() || undefined;

  if (useRustCrm()) {
    try {
      const input: CrmHireCreateInput = {
        title,
        ...(category ? { category } : {}),
        ...(vendorCandidate ? { vendorCandidate } : {}),
        ...(requiredByRaw
          ? { requiredBy: new Date(requiredByRaw).toISOString() }
          : {}),
        ...(qty !== undefined && !isNaN(qty) ? { quantity: qty } : {}),
        ...(estimatedBudget !== undefined && !isNaN(estimatedBudget)
          ? { estimatedBudget }
          : {}),
        ...(specs ? { specs } : {}),
        ...(owner ? { owner } : {}),
        stage: 'sourcing',
        status: 'open',
      };
      const created = await crmHireApi.create(input);
      revalidatePath('/dashboard/crm/purchases/hire');
      return { message: 'Hire request created.', id: created.id };
    } catch (e) {
      console.error('[savePurchaseLead] rust path failed; falling back:', e);
      recordRustFallback({
        entity: 'purchase_lead',
        op: 'create',
        errorCode: e instanceof RustApiError ? e.code : undefined,
        status: e instanceof RustApiError ? e.status : undefined,
      });
    }
  }

  try {
    const { db } = await connectToDatabase();
    const result = await db.collection('crm_purchase_leads').insertOne({
      userId: new ObjectId(session.user._id as string),
      title,
      ...(category ? { category } : {}),
      ...(vendorCandidate ? { vendorCandidate } : {}),
      ...(requiredByRaw ? { requiredBy: new Date(requiredByRaw) } : {}),
      ...(qty !== undefined && !isNaN(qty) ? { quantity: qty } : {}),
      ...(estimatedBudget !== undefined && !isNaN(estimatedBudget) ? { estimatedBudget } : {}),
      ...(specs ? { specs } : {}),
      ...(owner ? { owner } : {}),
      stage: 'sourcing',
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    revalidatePath('/dashboard/crm/purchases/hire');
    return { message: 'Hire request created.', id: result.insertedId.toString() };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { error: `Failed to create hire request: ${msg}` };
  }
}
