'use server';

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { randomBytes } from 'node:crypto';
import { crmPortalUsersApi } from '@/lib/rust-client/crm-portal-users';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';

function useRustCrm(): boolean {
  return process.env.USE_RUST_CRM === 'true';
}

export async function savePortalUser(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user?._id) {
    return { error: 'Unauthorized.' };
  }

  try {
    const name = (formData.get('name') as string || '').trim();
    const email = (formData.get('email') as string || '').trim();
    const portalType = (formData.get('portalType') as string || 'customer').trim();
    const capabilitiesRaw = (formData.get('capabilities') as string || '').trim();
    const linkedEntityId = (formData.get('linkedEntityId') as string || '').trim();
    const notes = (formData.get('notes') as string || '').trim();

    if (!name) {
      return { error: 'Full name is required.' };
    }
    if (!email || !email.includes('@')) {
      return { error: 'A valid email address is required.' };
    }

    let capabilities: string[] = ['view_invoices', 'raise_tickets', 'view_documents'];
    if (capabilitiesRaw) {
      try {
        const parsed = JSON.parse(capabilitiesRaw);
        if (Array.isArray(parsed)) {
          capabilities = parsed;
        }
      } catch {
        // fallback to defaults
      }
    }

    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(session.user._id as string);

    const doc: Record<string, any> = {
      userId: userObjectId,
      name,
      email,
      portalType,
      capabilities,
      notes,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (linkedEntityId && ObjectId.isValid(linkedEntityId)) {
      doc.linkedEntityId = new ObjectId(linkedEntityId);
    }

    const result = await db.collection('crm_portal_users').insertOne(doc);

    revalidatePath('/dashboard/crm/portal');
    return { message: 'Portal user created successfully.', id: result.insertedId.toString() };
  } catch (e: any) {
    console.error('Failed to save portal user:', e);
    return { error: e?.message ?? 'An unexpected error occurred.' };
  }
}

export async function updatePortalUser(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user?._id) {
    return { error: 'Unauthorized.' };
  }

  const id = (formData.get('id') as string || '').trim();
  if (!id || !ObjectId.isValid(id)) {
    return { error: 'Invalid portal user ID.' };
  }

  try {
    const name = (formData.get('name') as string || '').trim();
    const email = (formData.get('email') as string || '').trim();
    const phone = (formData.get('phone') as string || '').trim();
    const portalType = (formData.get('portalType') as string || 'customer').trim();
    const role = (formData.get('role') as string || '').trim();
    const capabilitiesRaw = (formData.get('capabilities') as string || '').trim();
    const linkedEntityId = (formData.get('linkedEntityId') as string || '').trim();
    const linkedEntityName = (formData.get('linkedEntityName') as string || '').trim();
    const notes = (formData.get('notes') as string || '').trim();
    const status = (formData.get('status') as string || 'pending').trim();
    const brandColor = (formData.get('brandColor') as string || '').trim();
    const welcomeMessage = (formData.get('welcomeMessage') as string || '').trim();
    const logoFileId = (formData.get('logoFileId') as string || '').trim();
    const logoFileUrl = (formData.get('logoFileUrl') as string || '').trim();
    const logoFileName = (formData.get('logoFileName') as string || '').trim();

    if (!name) {
      return { error: 'Full name is required.' };
    }
    if (!email || !email.includes('@')) {
      return { error: 'A valid email address is required.' };
    }
    if (brandColor && !/^#[0-9a-fA-F]{6}$/.test(brandColor)) {
      return { error: 'Brand colour must be a 6-digit hex code.' };
    }

    let capabilities: string[] | undefined;
    if (capabilitiesRaw) {
      try {
        const parsed = JSON.parse(capabilitiesRaw);
        if (Array.isArray(parsed)) {
          capabilities = parsed.filter((c: unknown): c is string => typeof c === 'string');
        }
      } catch {
        // ignore
      }
    }

    const { db } = await connectToDatabase();

    const setDoc: Record<string, any> = {
      name,
      email,
      phone,
      portalType,
      notes,
      status,
      welcomeMessage,
      updatedAt: new Date(),
    };

    if (role) setDoc.role = role;
    if (brandColor) setDoc.brandColor = brandColor;
    if (linkedEntityName) setDoc.linkedEntityName = linkedEntityName;
    if (logoFileId) {
      setDoc.logoFileId = logoFileId;
      setDoc.logoFileUrl = logoFileUrl;
      setDoc.logoFileName = logoFileName;
    } else {
      setDoc.logoFileId = null;
      setDoc.logoFileUrl = null;
      setDoc.logoFileName = null;
    }

    if (capabilities) setDoc.capabilities = capabilities;
    if (linkedEntityId && ObjectId.isValid(linkedEntityId)) {
      setDoc.linkedEntityId = new ObjectId(linkedEntityId);
    }

    const result = await db.collection('crm_portal_users').updateOne(
      {
        _id: new ObjectId(id),
        userId: new ObjectId(session.user._id as string),
      },
      { $set: setDoc },
    );

    if (result.matchedCount === 0) {
      return { error: 'Portal user not found or permission denied.' };
    }

    revalidatePath('/dashboard/crm/portal');
    revalidatePath(`/dashboard/crm/portal/${id}`);
    return { message: 'Portal user updated.', id };
  } catch (e: any) {
    console.error('Failed to update portal user:', e);
    return { error: e?.message ?? 'An unexpected error occurred.' };
  }
}

export async function getPortalUserById(id: string): Promise<any | null> {
  const session = await getSession();
  if (!session?.user?._id) return null;
  if (!ObjectId.isValid(id)) return null;

  if (useRustCrm()) {
    try {
      const doc = await crmPortalUsersApi.getById(id);
      return JSON.parse(JSON.stringify(doc));
    } catch (e) {
      console.error('[getPortalUserById] rust path failed; falling back:', e);
      recordRustFallback({
        entity: 'portal_user',
        op: 'get',
        errorCode: e instanceof RustApiError ? e.code : undefined,
        status: e instanceof RustApiError ? e.status : undefined,
      });
    }
  }

  try {
    const { db } = await connectToDatabase();
    const doc = await db.collection('crm_portal_users').findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(session.user._id as string),
    });
    if (!doc) return null;
    return JSON.parse(JSON.stringify(doc));
  } catch (e) {
    console.error('Failed to fetch portal user by id:', e);
    return null;
  }
}

/* ─── Lifecycle ───────────────────────────────────────────────── */

async function setPortalField(
  portalUserId: string,
  set: Record<string, unknown>,
  audit: { action: string; reason?: string; diff?: Record<string, { before?: unknown; after?: unknown }> },
): Promise<{ success: boolean; error?: string; magicLink?: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Unauthorized.' };
  if (!ObjectId.isValid(portalUserId)) {
    return { success: false, error: 'Invalid portal user ID.' };
  }
  try {
    const { db } = await connectToDatabase();
    const res = await db.collection('crm_portal_users').updateOne(
      {
        _id: new ObjectId(portalUserId),
        userId: new ObjectId(session.user._id as string),
      },
      { $set: { ...set, updatedAt: new Date() } } as any,
    );
    if (res.matchedCount === 0) {
      return { success: false, error: 'Portal user not found.' };
    }
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: audit.action,
        entityKind: 'portal_user',
        entityId: portalUserId,
        reason: audit.reason,
        diff: audit.diff,
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(`/dashboard/crm/portal/${portalUserId}`);
    revalidatePath('/dashboard/crm/portal');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Update failed.' };
  }
}

export async function sendMagicLink(
  portalUserId: string,
): Promise<{ success: boolean; error?: string; magicLink?: string }> {
  const token = randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 3600_000);
  const result = await setPortalField(
    portalUserId,
    {
      magicLinkToken: token,
      magicLinkExpiresAt: expiresAt,
      lastMagicLinkAt: new Date(),
    },
    {
      action: 'send',
      reason: 'magic_link',
    },
  );
  if (!result.success) return result;
  /* TODO 1D.2: actually email the magic link via transactional sender. */
  return {
    success: true,
    magicLink: `/portal/auth?token=${token}`,
  };
}

export async function suspendPortalUser(portalUserId: string) {
  return setPortalField(
    portalUserId,
    { status: 'suspended', suspendedAt: new Date() },
    { action: 'archive', reason: 'suspended', diff: { status: { after: 'suspended' } } },
  );
}

export async function restorePortalUser(portalUserId: string) {
  return setPortalField(
    portalUserId,
    { status: 'active', restoredAt: new Date() },
    { action: 'restore', reason: 'restored', diff: { status: { after: 'active' } } },
  );
}

export async function deletePortalUser(
  portalUserId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Unauthorized.' };
  if (!ObjectId.isValid(portalUserId)) {
    return { success: false, error: 'Invalid portal user ID.' };
  }
  try {
    const { db } = await connectToDatabase();
    const res = await db.collection('crm_portal_users').deleteOne({
      _id: new ObjectId(portalUserId),
      userId: new ObjectId(session.user._id as string),
    });
    if (res.deletedCount === 0) {
      return { success: false, error: 'Portal user not found.' };
    }
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'delete',
        entityKind: 'portal_user',
        entityId: portalUserId,
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath('/dashboard/crm/portal');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Delete failed.' };
  }
}

export async function bulkRevokePortalUsers(ids: string[]): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Unauthorized.' };
  try {
    const { db } = await connectToDatabase();
    const objectIds = ids.map(id => new ObjectId(id));
    await db.collection('crm_portal_users').updateMany(
      { _id: { $in: objectIds }, userId: new ObjectId(session.user._id as string) },
      { $set: { status: 'suspended', suspendedAt: new Date(), sessionVersion: Date.now() } }
    );
    revalidatePath('/dashboard/crm/portal');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Bulk revoke failed.' };
  }
}

export async function forceLogoutPortalUser(id: string): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Unauthorized.' };
  try {
    const { db } = await connectToDatabase();
    await db.collection('crm_portal_users').updateOne(
      { _id: new ObjectId(id), userId: new ObjectId(session.user._id as string) },
      { $set: { sessionVersion: Date.now(), forceLogoutAt: new Date() } }
    );
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'force_logout',
        entityKind: 'portal_user',
        entityId: id,
      });
    } catch {}
    revalidatePath(`/dashboard/crm/portal/${id}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Force logout failed.' };
  }
}

export async function sendPasswordReset(id: string): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Unauthorized.' };
  try {
    const { db } = await connectToDatabase();
    await db.collection('crm_portal_users').updateOne(
      { _id: new ObjectId(id), userId: new ObjectId(session.user._id as string) },
      { $set: { resetToken: randomBytes(24).toString('hex'), resetTokenExpiresAt: new Date(Date.now() + 3600000) } }
    );
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'send_password_reset',
        entityKind: 'portal_user',
        entityId: id,
      });
    } catch {}
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Password reset failed.' };
  }
}
