'use server';

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { getSabAdminContext } from '@/lib/sabadmin/tenant';
import { getSabAdminCollections, ensureSabAdminIndexes } from '@/lib/sabadmin/db/collections';
import {
  buildPermissionMapForApps,
  grantableApps,
} from '@/lib/sabadmin/access-catalog';
import { writeSabAdminAudit } from '@/lib/sabadmin/audit';
import type { ActionResult, PackageRow, GrantableAppOption } from '@/lib/sabadmin/dto';

/** Apps the acting admin is allowed to hand out (granter-bounded). */
export async function getGrantableApps(): Promise<GrantableAppOption[]> {
  const ctxRes = await getSabAdminContext();
  if (!ctxRes.ok) return [];
  return grantableApps(ctxRes.ctx.effective).map((a) => ({ appId: a.appId, label: a.label }));
}

/** List the org's Access Packages. */
export async function listAccessPackages(): Promise<PackageRow[]> {
  const ctxRes = await getSabAdminContext();
  if (!ctxRes.ok) return [];
  const { cols } = await getSabAdminCollections();
  const docs = await cols.packages
    .find({ ownerUserId: ctxRes.ctx.ownerUserId })
    .sort({ name: 1 })
    .toArray();
  return docs.map((d) => ({
    id: String(d._id),
    name: d.name,
    description: d.description ?? null,
    apps: d.apps ?? [],
    permissions: d.permissions ?? {},
    createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
  }));
}

/** Create a package = a named bundle of apps, permissions clamped to the creator. */
export async function createAccessPackage(input: {
  name: string;
  description?: string;
  appIds: string[];
}): Promise<ActionResult<{ id: string }>> {
  const ctxRes = await getSabAdminContext();
  if (!ctxRes.ok) return { ok: false, error: ctxRes.error };
  const ctx = ctxRes.ctx;

  const name = (input.name || '').trim();
  if (!name) return { ok: false, error: 'Name the package.' };

  const permissions = buildPermissionMapForApps(input.appIds ?? [], ctx.effective);

  await ensureSabAdminIndexes();
  const { cols } = await getSabAdminCollections();
  const now = new Date();
  try {
    const ins = await cols.packages.insertOne({
      ownerUserId: ctx.ownerUserId,
      name,
      description: input.description?.trim() || undefined,
      apps: input.appIds ?? [],
      permissions,
      createdBy: ctx.actorUserId,
      createdAt: now,
      updatedAt: now,
    });
    await writeSabAdminAudit(ctx, 'package_create', `Created package "${name}"`, undefined, { apps: input.appIds });
    revalidatePath('/sabadmin/access');
    return { ok: true, id: String(ins.insertedId) };
  } catch (err) {
    const isDup = typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
    if (isDup) return { ok: false, error: `A package named "${name}" already exists.` };
    return { ok: false, error: err instanceof Error ? err.message : 'Could not create package.' };
  }
}

/** Update a package's name / description / apps (permissions re-clamped). */
export async function updateAccessPackage(
  id: string,
  input: { name?: string; description?: string; appIds?: string[] },
): Promise<ActionResult> {
  const ctxRes = await getSabAdminContext();
  if (!ctxRes.ok) return { ok: false, error: ctxRes.error };
  const ctx = ctxRes.ctx;
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid package id.' };

  const { cols } = await getSabAdminCollections();
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof input.name === 'string') set.name = input.name.trim();
  if (typeof input.description === 'string') set.description = input.description.trim();
  if (input.appIds) {
    set.apps = input.appIds;
    set.permissions = buildPermissionMapForApps(input.appIds, ctx.effective);
  }

  const res = await cols.packages.updateOne(
    { _id: new ObjectId(id), ownerUserId: ctx.ownerUserId },
    { $set: set },
  );
  if (res.matchedCount === 0) return { ok: false, error: 'Package not found.' };

  await writeSabAdminAudit(ctx, 'package_update', `Updated a package`, undefined, { id });
  revalidatePath('/sabadmin/access');
  return { ok: true };
}

/** Delete a package. */
export async function deleteAccessPackage(id: string): Promise<ActionResult> {
  const ctxRes = await getSabAdminContext();
  if (!ctxRes.ok) return { ok: false, error: ctxRes.error };
  const ctx = ctxRes.ctx;
  if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid package id.' };

  const { cols } = await getSabAdminCollections();
  const res = await cols.packages.deleteOne({ _id: new ObjectId(id), ownerUserId: ctx.ownerUserId });
  if (res.deletedCount === 0) return { ok: false, error: 'Package not found.' };

  await writeSabAdminAudit(ctx, 'package_delete', `Deleted a package`, undefined, { id });
  revalidatePath('/sabadmin/access');
  return { ok: true };
}
