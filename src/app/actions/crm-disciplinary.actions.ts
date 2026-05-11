'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

export async function saveDisciplinaryCase(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

  const employeeName = (formData.get('employeeName') as string | null)?.trim() || '';
  if (!employeeName) return { error: 'Employee name is required.' };

  const caseType = (formData.get('caseType') as string | null)?.trim() || 'misconduct';
  const severity = (formData.get('severity') as string | null)?.trim() || 'minor';
  const raisedBy = (formData.get('raisedBy') as string | null)?.trim() || undefined;
  const incidentDateRaw = (formData.get('incidentDate') as string | null)?.trim() || '';
  const description = (formData.get('description') as string | null)?.trim() || undefined;
  const notes = (formData.get('notes') as string | null)?.trim() || undefined;

  try {
    const { db } = await connectToDatabase();
    const result = await db.collection('crm_disciplinary_cases').insertOne({
      userId: new ObjectId(session.user._id as string),
      employeeName,
      caseType,
      severity,
      ...(raisedBy ? { raisedBy } : {}),
      ...(incidentDateRaw ? { incidentDate: new Date(incidentDateRaw) } : {}),
      ...(description ? { description } : {}),
      ...(notes ? { notes } : {}),
      evidence: [],
      hearings: [],
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    revalidatePath('/dashboard/hrm/hr/disciplinary');
    return { message: 'Disciplinary case created.', id: result.insertedId.toString() };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { error: `Failed to create case: ${msg}` };
  }
}

/**
 * Fetch a single disciplinary case document scoped to the current user.
 *
 * Mirrors the canonical loader shape used elsewhere in the CRM.
 */
export async function getDisciplinaryCaseById(
    caseId: string,
): Promise<WithId<Record<string, unknown>> | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!ObjectId.isValid(caseId)) return null;

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_disciplinary_cases').findOne({
            _id: new ObjectId(caseId),
            userId: new ObjectId(session.user._id),
        });
        if (!doc) return null;
        return JSON.parse(JSON.stringify(doc));
    } catch (e) {
        console.error('Failed to fetch disciplinary case by id:', e);
        return null;
    }
}
