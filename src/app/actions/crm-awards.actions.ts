'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmAwardProgramsApi } from '@/lib/rust-client/crm-awards';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { awardProgramFormSchema } from '@/app/dashboard/hrm/hr/awards/schema';

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

  const parsed = awardProgramFormSchema.safeParse({
    name: formData.get('name'),
    programType: formData.get('programType'),
    frequency: formData.get('frequency'),
    periodStart: formData.get('periodStart'),
    periodEnd: formData.get('periodEnd'),
    criteria: formData.get('criteria'),
    description: formData.get('description'),
    pointsValue: formData.get('pointsValue') || undefined,
    cashValue: formData.get('cashValue') || undefined,
    status: formData.get('status'),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors.map(e => e.message).join(', ') };
  }

  const { name, programType, frequency, periodStart, periodEnd, criteria, description, pointsValue, cashValue, status } = parsed.data;

  try {
    const { db } = await connectToDatabase();
    const result = await db.collection('crm_award_programs').insertOne({
      userId: new ObjectId(session.user._id as string),
      name,
      programType,
      frequency,
      ...(periodStart ? { periodStart } : {}),
      ...(periodEnd ? { periodEnd } : {}),
      ...(criteria ? { criteria } : {}),
      ...(pointsValue ? { pointsValue } : {}),
      ...(cashValue ? { cashValue } : {}),
      ...(description ? { description } : {}),
      nominations: [],
      winners: [],
      status: status || 'draft',
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
 * Update an existing award program.
 *
 * Mirrors `saveAwardProgram` but issues an `updateOne` scoped to the
 * tenant. The `programId` is bound on the client via `.bind(null, id)`
 * so the signature stays `useActionState`-compatible.
 */
export async function updateAwardProgram(
  programId: string,
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

  const guard = await requirePermission('hrm_award', 'update');
  if (!guard.ok) return { error: guard.error };

  if (!ObjectId.isValid(programId)) return { error: 'Invalid program id.' };

  const parsed = awardProgramFormSchema.safeParse({
    name: formData.get('name'),
    programType: formData.get('programType'),
    frequency: formData.get('frequency'),
    periodStart: formData.get('periodStart'),
    periodEnd: formData.get('periodEnd'),
    criteria: formData.get('criteria'),
    description: formData.get('description'),
    pointsValue: formData.get('pointsValue') || undefined,
    cashValue: formData.get('cashValue') || undefined,
    status: formData.get('status'),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors.map(e => e.message).join(', ') };
  }

  const { name, programType, frequency, periodStart, periodEnd, criteria, description, pointsValue, cashValue, status } = parsed.data;

  try {
    const { db } = await connectToDatabase();
    const result = await db.collection('crm_award_programs').updateOne(
      {
        _id: new ObjectId(programId),
        userId: new ObjectId(session.user._id as string),
      },
      {
        $set: {
          name,
          programType,
          frequency,
          status,
          periodStart: periodStart || null,
          periodEnd: periodEnd || null,
          criteria: criteria || null,
          description: description || null,
          pointsValue: pointsValue || null,
          cashValue: cashValue || null,
          updatedAt: new Date(),
        },
      },
    );

    if (result.matchedCount === 0)
      return { error: 'Award program not found.' };

    revalidatePath('/dashboard/hrm/hr/awards');
    revalidatePath(`/dashboard/hrm/hr/awards/${programId}`);
    return { message: 'Award program updated.', id: programId };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { error: `Failed to update award program: ${msg}` };
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
