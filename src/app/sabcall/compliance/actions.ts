'use server';

/**
 * SabCall — compliance & trust settings.
 *
 * A single settings doc per SabCall project, stored in `sabcall_compliance`
 * and keyed by `userId = workspaceId` (the selected `kind:'call'` project id),
 * exactly like every other SabCall collection. Direct Mongo is the primary
 * path (mirrors `sabcall.actions.ts`).
 *
 * These settings drive carrier-trust posture: STIR/SHAKEN attestation level,
 * CNAM display name, E911 registered address, call-recording consent policy,
 * and the messaging/voice campaign registration ids (US A2P 10DLC brand +
 * campaign, India DLT entity).
 */

import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { getSabcallWorkspaceId } from '@/lib/sabcall/workspace';
import { getErrorMessage } from '@/lib/utils';

const COLLECTION = 'sabcall_compliance';

export interface ComplianceSettings {
  stirShakenAttestation: 'A' | 'B' | 'C';
  cnamName?: string;
  e911: {
    street?: string;
    city?: string;
    state?: string;
    postal?: string;
    country?: string;
  };
  recordingConsent: 'none' | 'one_party' | 'all_party';
  a2pBrandId?: string;
  a2pCampaignId?: string;
  dltEntityId?: string;
}

/** Sane defaults for a project that has never saved compliance settings. */
function defaults(): ComplianceSettings {
  return {
    stirShakenAttestation: 'A',
    cnamName: '',
    e911: { street: '', city: '', state: '', postal: '', country: '' },
    recordingConsent: 'one_party',
    a2pBrandId: '',
    a2pCampaignId: '',
    dltEntityId: '',
  };
}

/**
 * The active SabCall tenant = the selected `kind:'call'` project `_id`.
 * Throws when no project is selected (the layout gate normally prevents this).
 */
async function tenantId(): Promise<string> {
  const id = await getSabcallWorkspaceId();
  if (!id) throw new Error('No SabCall project selected.');
  return id;
}

/** Load the project's compliance settings, or sane defaults when unset. */
export async function getCompliance(): Promise<ComplianceSettings> {
  const userId = await tenantId();
  const { db } = await connectToDatabase();
  const doc = await db.collection(COLLECTION).findOne({ userId });
  if (!doc) return defaults();
  const base = defaults();
  return {
    stirShakenAttestation:
      (doc.stirShakenAttestation as ComplianceSettings['stirShakenAttestation']) ??
      base.stirShakenAttestation,
    cnamName: (doc.cnamName as string) ?? base.cnamName,
    e911: {
      street: (doc.e911?.street as string) ?? '',
      city: (doc.e911?.city as string) ?? '',
      state: (doc.e911?.state as string) ?? '',
      postal: (doc.e911?.postal as string) ?? '',
      country: (doc.e911?.country as string) ?? '',
    },
    recordingConsent:
      (doc.recordingConsent as ComplianceSettings['recordingConsent']) ??
      base.recordingConsent,
    a2pBrandId: (doc.a2pBrandId as string) ?? base.a2pBrandId,
    a2pCampaignId: (doc.a2pCampaignId as string) ?? base.a2pCampaignId,
    dltEntityId: (doc.dltEntityId as string) ?? base.dltEntityId,
  };
}

/** Upsert the project's compliance settings. */
export async function saveCompliance(
  input: ComplianceSettings,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const userId = await tenantId();
    const { db } = await connectToDatabase();
    await db.collection(COLLECTION).updateOne(
      { userId },
      { $set: { ...input, userId, updatedAt: new Date() } },
      { upsert: true },
    );
    revalidatePath('/sabcall/compliance');
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}
