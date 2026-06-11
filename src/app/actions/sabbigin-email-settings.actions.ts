'use server';

/**
 * SabBigin — email settings server actions.
 *
 * SabBigin reuses the existing tenant `email_settings` document (the same row
 * the wider CRM email features read) but adds two SabBigin-facing presentation
 * fields — `fromName` (already on the schema) and `signature` (additive, set
 * via `$set` so it never disturbs the typed connection fields).
 *
 * This is intentionally narrow: it never touches SMTP / OAuth credentials, so a
 * SabBigin user can set their display name + signature without re-entering a
 * mail connection. Connecting a provider stays in the dedicated CRM email
 * settings surface (`saveCrmEmailSettings`).
 */

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getErrorMessage } from '@/lib/utils';

export interface SabbiginEmailStatus {
  /** A mail connection (SMTP or OAuth) exists for this tenant. */
  connected: boolean;
  provider: string | null;
  fromName: string;
  fromEmail: string | null;
  signature: string;
}

/** Read the tenant's email connection status + SabBigin presentation fields. */
export async function getSabbiginEmailStatus(): Promise<SabbiginEmailStatus> {
  const empty: SabbiginEmailStatus = {
    connected: false,
    provider: null,
    fromName: '',
    fromEmail: null,
    signature: '',
  };

  const session = await getSession();
  if (!session?.user?._id) return empty;

  try {
    const { db } = await connectToDatabase();
    const doc = await db
      .collection<Record<string, unknown>>('email_settings')
      .findOne({ userId: new ObjectId(session.user._id) });
    if (!doc) return empty;

    const provider = typeof doc.provider === 'string' ? doc.provider : null;
    const hasSmtp = Boolean(doc.smtp);
    const hasGoogle = Boolean(doc.googleOAuth);
    const hasOutlook = Boolean(doc.outlookOAuth);

    return {
      connected: hasSmtp || hasGoogle || hasOutlook,
      provider,
      fromName: typeof doc.fromName === 'string' ? doc.fromName : '',
      fromEmail: typeof doc.fromEmail === 'string' ? doc.fromEmail : null,
      signature: typeof doc.signature === 'string' ? doc.signature : '',
    };
  } catch (e) {
    console.error('[getSabbiginEmailStatus] failed:', e);
    return empty;
  }
}

/** Persist the SabBigin-facing from-name + signature onto `email_settings`. */
export async function saveSabbiginEmailPresentation(patch: {
  fromName?: string;
  signature?: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Access denied' };

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id);
    const set: Record<string, unknown> = { userId, updatedAt: new Date() };
    if (patch.fromName !== undefined) set.fromName = patch.fromName.trim();
    if (patch.signature !== undefined) set.signature = patch.signature;

    await db
      .collection('email_settings')
      .updateOne({ userId }, { $set: set }, { upsert: true });

    revalidatePath('/dashboard/sabbigin/settings/email');
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}
