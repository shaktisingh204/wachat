'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmAwardProgramsApi } from '@/lib/rust-client/crm-awards';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
  return process.env.USE_RUST_CRM === 'true';
}

export async function saveAwardProgram(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

  const guard = await requirePermission('hrm_award', 'create');
  if (!guard.ok) return { error: guard.error };

  const name = (formData.get('name') as string | null)?.trim() || '';
  if (!name) return { error: 'Program name is required.' };

  const programType = (formData.get('programType') as string | null)?.trim() || 'recognition';
  const frequency = (formData.get('frequency') as string | null)?.trim() || 'monthly';
  const periodStartRaw = (formData.get('periodStart') as string | null)?.trim() || '';
  const periodEndRaw = (formData.get('periodEnd') as string | null)?.trim() || '';
  const criteria = (formData.get('criteria') as string | null)?.trim() || undefined;
  const pointsValue = formData.get('pointsValue');
  const cashValue = formData.get('cashValue');
  const description = (formData.get('description') as string | null)?.trim() || undefined;

  try {
    const { db } = await connectToDatabase();
    const result = await db.collection('crm_award_programs').insertOne({
      userId: new ObjectId(session.user._id as string),
      name,
      programType,
      frequency,
      ...(periodStartRaw ? { periodStart: new Date(periodStartRaw) } : {}),
      ...(periodEndRaw ? { periodEnd: new Date(periodEndRaw) } : {}),
      ...(criteria ? { criteria } : {}),
      ...(pointsValue ? { pointsValue: parseFloat(pointsValue as string) } : {}),
      ...(cashValue ? { cashValue: parseFloat(cashValue as string) } : {}),
      ...(description ? { description } : {}),
      nominations: [],
      winners: [],
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    revalidatePath('/dashboard/hrm/hr/awards');
    return { message: 'Award program created.', id: result.insertedId.toString() };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { error: `Failed to create award program: ${msg}` };
  }
}

/**
 * Fetch a single award program document scoped to the current user.
 *
 * Mirrors the canonical loader shape used elsewhere in the CRM.
 */
export async function getAwardProgramById(
    programId: string,
): Promise<WithId<Record<string, unknown>> | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!ObjectId.isValid(programId)) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmAwardProgramsApi.getById(programId);
            return JSON.parse(JSON.stringify(doc));
        } catch (e) {
            console.error('[getAwardProgramById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'award_program',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_award_programs').findOne({
            _id: new ObjectId(programId),
            userId: new ObjectId(session.user._id),
        });
        if (!doc) return null;
        return JSON.parse(JSON.stringify(doc));
    } catch (e) {
        console.error('Failed to fetch award program by id:', e);
        return null;
    }
}
