import 'server-only';

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';

/**
 * Per-project SabSign white-label branding. Stored on the project doc at
 * `sabsign.branding`. The logo is a SabFiles node (per the SabFiles policy —
 * never a free-text URL): `logoId` is the node id and `logoUrl` is its
 * resolved URL for rendering.
 */
export interface SabsignBranding {
  logoId?: string;
  logoUrl?: string;
  /** Accent colour (hex), applied to portal CTA + email button. */
  color?: string;
  /** Display name shown to signers + as the email "from" name. */
  senderName?: string;
}

export async function getBrandingByWorkspace(
  workspaceId: string,
): Promise<SabsignBranding | null> {
  if (!workspaceId || !ObjectId.isValid(workspaceId)) return null;
  const { db } = await connectToDatabase();
  const p = await db
    .collection('projects')
    .findOne({ _id: new ObjectId(workspaceId) }, { projection: { sabsign: 1 } });
  const branding = (p as { sabsign?: { branding?: SabsignBranding } } | null)?.sabsign?.branding;
  return branding ?? null;
}

/** Resolve branding from an envelope id (its `tenantId` is the workspace). */
export async function getBrandingByEnvelope(
  envelopeId: string,
): Promise<SabsignBranding | null> {
  const { db } = await connectToDatabase();
  const env = await db
    .collection('esign_envelopes')
    .findOne({ _id: envelopeId as never }, { projection: { tenantId: 1 } });
  const ws = (env as { tenantId?: string } | null)?.tenantId;
  return ws ? getBrandingByWorkspace(ws) : null;
}
