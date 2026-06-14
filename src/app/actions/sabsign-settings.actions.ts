'use server';

import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import {
  getActiveSabsignProject,
  getSabsignWorkspaceId,
} from '@/lib/sabsign/workspace';
import {
  getBrandingByWorkspace,
  getBrandingByEnvelope,
  type SabsignBranding,
} from '@/lib/sabsign/branding';

/** Current project's white-label branding (authed). */
export async function getSabsignBranding(): Promise<SabsignBranding | null> {
  const ws = await getSabsignWorkspaceId();
  return ws ? getBrandingByWorkspace(ws) : null;
}

/** Persist white-label branding on the active project. Logo = a SabFiles node. */
export async function saveSabsignBranding(
  input: SabsignBranding,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { ok: false, error: 'Unauthorized' };
  const project = await getActiveSabsignProject();
  if (!project) return { ok: false, error: 'Select a SabSign project first.' };

  const color = input.color?.trim();
  if (color && !/^#?[0-9a-fA-F]{3,8}$/.test(color)) {
    return { ok: false, error: 'Colour must be a hex value like #7c3aed.' };
  }
  const branding: SabsignBranding = {
    logoId: input.logoId?.trim() || undefined,
    logoUrl: input.logoUrl?.trim() || undefined,
    color: color ? (color.startsWith('#') ? color : `#${color}`) : undefined,
    senderName: input.senderName?.trim() || undefined,
  };

  const { db } = await connectToDatabase();
  await db
    .collection('projects')
    .updateOne({ _id: project._id }, { $set: { 'sabsign.branding': branding } });
  revalidatePath('/sabsign/settings');
  return { ok: true };
}

/** Public — branding for the signer portal (no session). */
export async function getPublicSignBranding(
  envelopeId: string,
): Promise<SabsignBranding | null> {
  return getBrandingByEnvelope(envelopeId);
}
