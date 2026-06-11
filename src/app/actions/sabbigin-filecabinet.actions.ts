'use server';

/**
 * SabBigin File Cabinet — per-contact document collection, built on **SabFiles**.
 *
 * Each contact gets a dedicated SabFiles folder (stored as `cabinetFolderId` on
 * the `crm_contacts` doc). Files attached through the SabBigin UI upload into
 * that folder; "Share upload link" mints a public SabFiles share token so the
 * customer can view/collect documents at `/share/[token]` — no SabBigin login.
 */

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { createFolder, listNodes, createShare } from '@/app/actions/sabfiles.actions';

export interface CabinetFile {
  id: string;
  name: string;
  url?: string | null;
  mime?: string | null;
  size?: number | null;
  createdAt?: string | null;
}

export interface ContactCabinet {
  folderId: string | null;
  files: CabinetFile[];
  shareUrl?: string | null;
  error?: string;
}

async function loadContact(crmContactId: string) {
  const session = await getSession();
  if (!session?.user?._id) return null;
  if (!crmContactId || !ObjectId.isValid(crmContactId)) return null;
  const { db } = await connectToDatabase();
  const userId = new ObjectId(session.user._id);
  const contact = await db
    .collection('crm_contacts')
    .findOne({ _id: new ObjectId(crmContactId), userId });
  return contact ? { db, userId, contact } : null;
}

/** Ensure the contact's cabinet folder exists, then list its files. */
export async function getContactCabinet(
  crmContactId: string,
): Promise<ContactCabinet> {
  const loaded = await loadContact(crmContactId);
  if (!loaded) return { folderId: null, files: [], error: 'Contact not found' };
  const { db, userId, contact } = loaded;

  let folderId: string | null = contact.cabinetFolderId
    ? String(contact.cabinetFolderId)
    : null;

  if (!folderId) {
    const res = await createFolder(null, `${contact.name ?? 'Contact'} — Files`);
    if ('error' in res || !res.node) {
      return { folderId: null, files: [], error: 'Could not create folder' };
    }
    folderId = String((res.node as { id: string }).id);
    await db
      .collection('crm_contacts')
      .updateOne(
        { _id: new ObjectId(crmContactId), userId },
        { $set: { cabinetFolderId: folderId, updatedAt: new Date() } },
      );
  }

  const { nodes } = await listNodes({ parent: folderId });
  const files: CabinetFile[] = (nodes ?? [])
    .filter((n) => n.type === 'file' && !n.trashed)
    .map((n) => ({
      id: n.id,
      name: n.name,
      url: n.url ?? null,
      mime: n.mime ?? null,
      size: n.size ?? null,
      createdAt: n.createdAt ?? null,
    }));

  return {
    folderId,
    files,
    shareUrl: contact.cabinetShareUrl ? String(contact.cabinetShareUrl) : null,
  };
}

/** Mint (or return) a public share link for the contact's cabinet folder. */
export async function shareContactCabinet(
  crmContactId: string,
): Promise<{ success: boolean; url?: string; error?: string }> {
  const loaded = await loadContact(crmContactId);
  if (!loaded) return { success: false, error: 'Contact not found' };
  const { db, userId, contact } = loaded;

  const folderId = contact.cabinetFolderId
    ? String(contact.cabinetFolderId)
    : (await getContactCabinet(crmContactId)).folderId;
  if (!folderId) return { success: false, error: 'No cabinet folder' };

  const res = await createShare(folderId, { download_enabled: true }, null);
  if ('error' in res) return { success: false, error: res.error };

  const url = (res as { url?: string; token?: string }).url
    ?? ((res as { token?: string }).token
      ? `/share/${(res as { token?: string }).token}`
      : undefined);
  if (!url) return { success: false, error: 'No share URL returned' };

  await db
    .collection('crm_contacts')
    .updateOne(
      { _id: new ObjectId(crmContactId), userId },
      { $set: { cabinetShareUrl: url, updatedAt: new Date() } },
    );
  revalidatePath(`/dashboard/sabbigin/contacts/${crmContactId}`);
  return { success: true, url };
}

/** Record an uploaded/picked SabFiles node in the activity trail (light). */
export async function noteCabinetUpload(
  crmContactId: string,
  fileName: string,
): Promise<{ success: boolean }> {
  const loaded = await loadContact(crmContactId);
  if (!loaded) return { success: false };
  const { db, userId } = loaded;
  await db.collection('crm_activities').insertOne({
    userId,
    type: 'note',
    typeLabel: 'Note',
    subject: `File added: ${fileName}`,
    title: `File added: ${fileName}`,
    status: 'completed',
    contactId: crmContactId,
    createdAt: new Date(),
  });
  revalidatePath(`/dashboard/sabbigin/contacts/${crmContactId}`);
  return { success: true };
}
