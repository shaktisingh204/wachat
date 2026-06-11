'use server';

/**
 * SabBigin contact server actions.
 *
 * Thin, typed helpers for the native SabBigin contact detail island:
 *   - `patchSabbiginContact` — inline scalar edits (name/email/phone/…)
 *     without the FormData contract of the full-CRM `updateCrmContact`.
 *   - `getSabbiginContactDeals` — the contact's related deals, mapped to a
 *     plain serialisable shape for the related-deals list.
 *
 * Both write/read the same `crm_contacts` / `crm_deals` collections the
 * rest of the CRM uses, scoped to the tenant.
 */

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

const CONTACT_STRING_FIELDS = new Set([
  'name',
  'email',
  'phone',
  'company',
  'jobTitle',
  'status',
  'leadSource',
  'linkedinUrl',
  'twitterHandle',
  'lifecycleStage',
  'source',
  'owner',
  'timezone',
]);

export type ContactFieldPatch = Record<string, string | null>;

export async function patchSabbiginContact(
  contactId: string,
  patch: ContactFieldPatch,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Access denied' };
  if (!contactId || !ObjectId.isValid(contactId)) {
    return { success: false, error: 'Invalid contact id' };
  }

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id);

    const set: Record<string, unknown> = { updatedAt: new Date() };
    for (const [k, v] of Object.entries(patch)) {
      if (!CONTACT_STRING_FIELDS.has(k)) continue;
      set[k] = v == null ? '' : String(v);
    }

    // Name + email are required — never blank them out.
    if ('name' in set && !String(set.name).trim()) {
      return { success: false, error: 'Name cannot be empty.' };
    }
    if ('email' in set && !String(set.email).trim()) {
      return { success: false, error: 'Email cannot be empty.' };
    }

    const res = await db
      .collection('crm_contacts')
      .updateOne({ _id: new ObjectId(contactId), userId }, { $set: set });
    if (res.matchedCount === 0) {
      return { success: false, error: 'Contact not found' };
    }

    revalidatePath('/dashboard/sabbigin/contacts');
    revalidatePath(`/dashboard/sabbigin/contacts/${contactId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Failed to update contact' };
  }
}

export interface SabbiginContactDeal {
  _id: string;
  name: string;
  stage: string;
  value: number;
  currency: string;
  pipelineId: string | null;
}

export async function getSabbiginContactDeals(
  contactId: string,
): Promise<SabbiginContactDeal[]> {
  const session = await getSession();
  if (!session?.user?._id) return [];
  if (!contactId || !ObjectId.isValid(contactId)) return [];

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id);
    const oid = new ObjectId(contactId);

    const docs = await db
      .collection('crm_deals')
      .find({
        userId,
        $or: [
          { contactIds: oid },
          { contactId: oid },
          { contactIds: contactId },
          { contactId: contactId },
        ],
      } as Record<string, unknown>)
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(50)
      .toArray();

    return docs.map((d) => ({
      _id: String(d._id),
      name: String(d.name ?? 'Untitled deal'),
      stage: String(d.stage ?? 'New'),
      value: typeof d.value === 'number' ? d.value : 0,
      currency: String(d.currency ?? 'INR'),
      pipelineId: d.pipelineId ? String(d.pipelineId) : null,
    }));
  } catch (e) {
    console.error('[getSabbiginContactDeals] failed:', e);
    return [];
  }
}
