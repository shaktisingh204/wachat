'use server';

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getSabsignWorkspaceId } from '@/lib/sabsign/workspace';

/**
 * SabSign notary journal — the legally-required record of notarial acts.
 * Stored in `esign_notary_journal`, scoped per workspace. (The live remote-
 * online-notarization session — A/V + government-ID verification — needs
 * external infra: a TURN/WebRTC server and an ID-verification provider; this
 * is the in-house record-keeping half.)
 */

export type NotaryActType =
  | 'acknowledgment'
  | 'jurat'
  | 'oath_affirmation'
  | 'copy_certification'
  | 'signature_witnessing';

export interface NotaryJournalEntry {
  id: string;
  envelopeId?: string;
  signerName: string;
  signerEmail?: string;
  actType: NotaryActType;
  notaryName: string;
  notaryCommissionId?: string;
  jurisdiction?: string;
  idVerified: boolean;
  idMethod?: string;
  witnessedAt: string;
  ipAddress?: string;
  notes?: string;
  createdAt: string;
}

async function ctx(): Promise<{ workspaceId: string; userId: string }> {
  const session = await getSession();
  const userId = (session?.user as { _id?: unknown } | undefined)?._id;
  if (!userId) throw new Error('Unauthorized');
  const workspaceId = (await getSabsignWorkspaceId()) ?? String(userId);
  return { workspaceId, userId: String(userId) };
}

export async function getNotaryJournal(limit = 200): Promise<NotaryJournalEntry[]> {
  try {
    const { workspaceId } = await ctx();
    const { db } = await connectToDatabase();
    const docs = await db
      .collection('esign_notary_journal')
      .find({ workspaceId })
      .sort({ witnessedAt: -1 })
      .limit(limit)
      .toArray();
    return docs.map((d) => ({
      id: String(d._id),
      envelopeId: d.envelopeId,
      signerName: d.signerName,
      signerEmail: d.signerEmail,
      actType: d.actType,
      notaryName: d.notaryName,
      notaryCommissionId: d.notaryCommissionId,
      jurisdiction: d.jurisdiction,
      idVerified: !!d.idVerified,
      idMethod: d.idMethod,
      witnessedAt: d.witnessedAt,
      ipAddress: d.ipAddress,
      notes: d.notes,
      createdAt: d.createdAt,
    }));
  } catch (err) {
    console.error('[sabsign] getNotaryJournal failed:', err);
    return [];
  }
}

export async function recordNotaryAct(input: {
  envelopeId?: string;
  signerName: string;
  signerEmail?: string;
  actType: NotaryActType;
  notaryName: string;
  notaryCommissionId?: string;
  jurisdiction?: string;
  idVerified?: boolean;
  idMethod?: string;
  notes?: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { workspaceId, userId } = await ctx();
  if (!input.signerName?.trim() || !input.notaryName?.trim()) {
    return { ok: false, error: 'Signer and notary names are required.' };
  }
  const now = new Date().toISOString();
  const { db } = await connectToDatabase();
  const res = await db.collection('esign_notary_journal').insertOne({
    _id: new ObjectId(),
    workspaceId,
    userId,
    envelopeId: input.envelopeId,
    signerName: input.signerName.trim(),
    signerEmail: input.signerEmail?.trim(),
    actType: input.actType,
    notaryName: input.notaryName.trim(),
    notaryCommissionId: input.notaryCommissionId?.trim(),
    jurisdiction: input.jurisdiction?.trim(),
    idVerified: !!input.idVerified,
    idMethod: input.idMethod?.trim(),
    notes: input.notes?.trim(),
    witnessedAt: now,
    createdAt: now,
  } as never);
  revalidatePath('/sabsign/notary');
  return { ok: true, id: res.insertedId.toString() };
}
