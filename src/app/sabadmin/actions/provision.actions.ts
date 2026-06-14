'use server';

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import {
  hashPassword,
  isHostedAuthConfigured,
  createFirebaseAuthUser,
  getFirebaseAuthUserByEmail,
  setFirebaseAuthUserDisabled,
  setFirebaseAuthUserPassword,
  deleteFirebaseAuthUser,
  revokeAllSessionsForUser,
} from '@/lib/auth';
import { isStalwartEnabled } from '@/lib/sabmail/hosted-provider';
import {
  generateStrongMailboxPassword,
  provisionHostedMailboxForWorkspace,
  resetHostedMailboxPasswordForWorkspace,
  setHostedMailboxStatusForWorkspace,
  deleteHostedMailboxForWorkspace,
} from '@/lib/sabmail/hosted-core';
import {
  getSabAdminContext,
  getOrInitSabAdminSettings,
  resolveMailWorkspaceId,
  type SabAdminContext,
} from '@/lib/sabadmin/tenant';
import { getSabAdminCollections, ensureSabAdminIndexes } from '@/lib/sabadmin/db/collections';
import {
  buildPermissionMapForApps,
  clampToGranter,
  mergePermissionMaps,
  appsFromPermissionMap,
} from '@/lib/sabadmin/access-catalog';
import { writeSabAdminAudit } from '@/lib/sabadmin/audit';
import type { EffectivePermissionMap } from '@/lib/rbac';
import type {
  ActionResult,
  OnboardEmployeeInput,
  OnboardCredentials,
} from '@/lib/sabadmin/dto';

const LOCAL_PART_RE =
  /^(?=.{1,64}$)[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;

/** Resolve the per-employee role id materialized on the owner's template map. */
function roleIdFor(empUserId: string): string {
  return `emp:${empUserId}`;
}

/** Compose the granted permission map from selected apps + packages, granter-clamped. */
async function resolveGrant(
  ctx: SabAdminContext,
  appIds: string[],
  packageIds: string[],
): Promise<{ permissions: EffectivePermissionMap; apps: string[] }> {
  let permissions = buildPermissionMapForApps(appIds, ctx.effective);

  if (packageIds.length > 0) {
    const { cols } = await getSabAdminCollections();
    const pkgs = await cols.packages
      .find({ ownerUserId: ctx.ownerUserId, _id: { $in: packageIds.filter(ObjectId.isValid).map((id) => new ObjectId(id)) } })
      .toArray();
    for (const pkg of pkgs) {
      // Clamp every package to what THIS admin currently holds (decision #3).
      permissions = mergePermissionMaps(permissions, clampToGranter(pkg.permissions, ctx.effective));
    }
  }

  const apps = Array.from(new Set([...appsFromPermissionMap(permissions), ...appIds]));
  return { permissions, apps };
}

/**
 * Materialize an access grant: store the permission template under the OWNER's
 * role map and (re)attach the employee as an agent (with that role) on every
 * project the owner owns — so `getEffectivePermissionsForProject` resolves it.
 * Returns the number of projects the employee is now an agent on.
 */
async function materializeAccess(
  ownerUserId: string,
  empUserId: string,
  roleId: string,
  permissions: EffectivePermissionMap,
): Promise<number> {
  const { db } = await connectToDatabase();
  const ownerOid = new ObjectId(ownerUserId);
  const empOid = new ObjectId(empUserId);

  await db
    .collection('users')
    .updateOne(
      { _id: ownerOid },
      { $set: { [`crm.permissions.${roleId}`]: permissions } },
    );

  // Idempotent: drop any existing agent entry for this employee, then add one
  // with the resolved role on every project the owner owns.
  await db.collection('projects').updateMany(
    { userId: ownerOid },
    { $pull: { agents: { userId: empOid } } } as never,
  );
  const push = await db.collection('projects').updateMany(
    { userId: ownerOid },
    { $push: { agents: { userId: empOid, role: roleId, addedAt: new Date() } } } as never,
  );
  return push.modifiedCount ?? 0;
}

/* ── Joiner: onboard an employee ───────────────────────────────────────── */

/**
 * The Microsoft-365-style "Add a user" flow. Atomically provisions, in order:
 * a hosted MAILBOX (the Outlook-style inbox), a Firebase LOGIN + Mongo `users`
 * doc (email = UPN), a `crm_employees` HR record (linked via `employeeUserId`),
 * and an ACCESS grant (role template + project agent rows). Any step failing
 * rolls back the artifacts already created, so we never leave a half-provisioned
 * person. Returns the one-time credentials for the admin to hand over.
 */
export async function onboardEmployee(
  input: OnboardEmployeeInput,
): Promise<ActionResult<{ credentials: OnboardCredentials }>> {
  const ctxRes = await getSabAdminContext();
  if (!ctxRes.ok) return { ok: false, error: ctxRes.error };
  const ctx = ctxRes.ctx;

  // Preconditions for the UPN model: hosted mail + login provisioning must work.
  if (!isStalwartEnabled()) {
    return { ok: false, error: 'Hosted mail is not configured. Set the Stalwart admin env vars to provision mailboxes.' };
  }
  if (!isHostedAuthConfigured()) {
    return { ok: false, error: 'Login provisioning is unavailable (Firebase Admin not configured).' };
  }

  const firstName = (input.firstName || '').trim();
  const lastName = (input.lastName || '').trim();
  if (!firstName && !lastName) return { ok: false, error: 'Enter the employee’s name.' };
  const displayName = [firstName, lastName].filter(Boolean).join(' ');

  const localPart = (input.localPart || '').trim().toLowerCase();
  if (!LOCAL_PART_RE.test(localPart)) {
    return { ok: false, error: 'Invalid mailbox name. Use letters, digits, dots, hyphens.' };
  }
  const domain = (input.domain || '').trim().toLowerCase().replace(/\.$/, '');
  if (!domain) return { ok: false, error: 'Pick a verified domain.' };
  const upn = `${localPart}@${domain}`;

  const settings = await getOrInitSabAdminSettings(ctx.ownerUserId);
  const mailWorkspaceId = await resolveMailWorkspaceId(ctx.ownerUserId, settings);
  if (!mailWorkspaceId) {
    return { ok: false, error: 'Link a SabMail mail workspace in Admin Center → Settings first.' };
  }

  const { db } = await connectToDatabase();
  await ensureSabAdminIndexes();

  // Pre-flight uniqueness across all three identity stores.
  const existingUser = await db.collection('users').findOne({ email: upn }, { projection: { _id: 1 } });
  if (existingUser) return { ok: false, error: `A SabNode account already uses ${upn}.` };
  const existingFb = await getFirebaseAuthUserByEmail(upn).catch(() => null);
  if (existingFb) return { ok: false, error: `A login already exists for ${upn}.` };

  // One credential for both the mailbox and the SabNode/Firebase login (UPN model).
  const password = input.password?.trim() || generateStrongMailboxPassword();

  const grant = await resolveGrant(ctx, input.appIds ?? [], input.packageIds ?? []);

  // Rollback stack — executed LIFO if a later step fails.
  const rollback: Array<() => Promise<void>> = [];
  const runRollback = async () => {
    for (const fn of rollback.reverse()) {
      try {
        await fn();
      } catch {
        /* best-effort cleanup */
      }
    }
  };

  try {
    // 1) Mailbox (Stalwart principal + sabmail_accounts row).
    const mb = await provisionHostedMailboxForWorkspace(mailWorkspaceId, {
      localPart,
      domain,
      displayName: displayName || undefined,
      password,
      quotaMb: input.quotaMb,
    });
    if (!mb.ok) return { ok: false, error: `Mailbox: ${mb.error}` };
    const mailboxAccountId = mb.mailbox.id;
    rollback.push(async () => {
      await deleteHostedMailboxForWorkspace(mailWorkspaceId, mailboxAccountId);
    });

    // 2) Firebase login.
    const fb = await createFirebaseAuthUser({ email: upn, password, displayName: displayName || undefined });
    rollback.push(async () => {
      await deleteFirebaseAuthUser(fb.uid);
    });

    // 3) Mongo `users` doc (email = UPN). onboarding is pre-completed so the
    //    employee lands straight in the app, not the signup wizard.
    const now = new Date();
    const passwordHash = await hashPassword(password);
    const userInsert = await db.collection('users').insertOne({
      name: displayName,
      email: upn,
      password: passwordHash,
      authProvider: 'password',
      emailVerified: now,
      firebaseUid: fb.uid,
      isProvisionedEmployee: true,
      provisionedByOwnerId: ctx.ownerUserId,
      mustChangePassword: true,
      onboarding: { status: 'complete', completedAt: now },
      createdAt: now,
    } as never);
    const empUserId = String(userInsert.insertedId);
    rollback.push(async () => {
      await db.collection('users').deleteOne({ _id: new ObjectId(empUserId) });
    });

    // 4) HR record in crm_employees (the link rbac-server keys on).
    const employeeCode = `EMP-${empUserId.slice(-6).toUpperCase()}`;
    const empInsert = await db.collection('crm_employees').insertOne({
      userId: new ObjectId(ctx.ownerUserId),
      employeeUserId: new ObjectId(empUserId),
      employeeId: employeeCode,
      firstName,
      lastName,
      email: upn,
      phone: input.phone || undefined,
      status: 'Active',
      dateOfJoining: input.dateOfJoining ? new Date(input.dateOfJoining) : now,
      departmentId: input.departmentId && ObjectId.isValid(input.departmentId) ? new ObjectId(input.departmentId) : undefined,
      designationId: input.designationId && ObjectId.isValid(input.designationId) ? new ObjectId(input.designationId) : undefined,
      reportingManagerId: input.reportingManagerId && ObjectId.isValid(input.reportingManagerId) ? new ObjectId(input.reportingManagerId) : undefined,
      createdAt: now,
      updatedAt: now,
    } as never);
    const employeeId = String(empInsert.insertedId);
    rollback.push(async () => {
      await db.collection('crm_employees').deleteOne({ _id: new ObjectId(employeeId) });
    });

    // 5) Access grant — role template + project agent rows.
    const roleId = roleIdFor(empUserId);
    const projectCount = await materializeAccess(ctx.ownerUserId, empUserId, roleId, grant.permissions);
    if (projectCount < 1) {
      // No project to anchor membership → the resolver would mis-treat the
      // employee as an owner. Refuse rather than over-grant.
      await runRollback();
      return { ok: false, error: 'Create at least one project (your mail workspace counts) before onboarding.' };
    }
    rollback.push(async () => {
      const ownerOid = new ObjectId(ctx.ownerUserId);
      await db.collection('projects').updateMany(
        { userId: ownerOid },
        { $pull: { agents: { userId: new ObjectId(empUserId) } } } as never,
      );
      await db.collection('users').updateOne(
        { _id: ownerOid },
        { $unset: { [`crm.permissions.${roleId}`]: '' } },
      );
    });

    // 6) Provision link record (governance source of truth for the console).
    const { cols } = await getSabAdminCollections();
    await cols.provisions.insertOne({
      ownerUserId: ctx.ownerUserId,
      employeeId,
      userId: empUserId,
      mailboxAccountId,
      upn,
      displayName,
      packageIds: input.packageIds ?? [],
      roleId,
      grantedPermissions: grant.permissions,
      grantedApps: grant.apps,
      status: 'active',
      credsIssuedAt: now,
      createdBy: ctx.actorUserId,
      createdAt: now,
      updatedAt: now,
    });

    await writeSabAdminAudit(ctx, 'onboard', `Onboarded ${displayName} (${upn})`, { userId: empUserId, upn }, { grantedApps: grant.apps });

    revalidatePath('/sabadmin/people');
    revalidatePath('/sabadmin');

    return {
      ok: true,
      credentials: {
        upn,
        oneTimePassword: password,
        displayName,
        userId: empUserId,
        employeeId,
        grantedApps: grant.apps,
      },
    };
  } catch (err) {
    await runRollback();
    return { ok: false, error: err instanceof Error ? err.message : 'Onboarding failed.' };
  }
}

/* ── Mover: update an employee's access ────────────────────────────────── */

export async function updateEmployeeAccess(
  userId: string,
  appIds: string[],
  packageIds: string[],
): Promise<ActionResult> {
  const ctxRes = await getSabAdminContext();
  if (!ctxRes.ok) return { ok: false, error: ctxRes.error };
  const ctx = ctxRes.ctx;

  const { cols } = await getSabAdminCollections();
  const prov = await cols.provisions.findOne({ ownerUserId: ctx.ownerUserId, userId });
  if (!prov) return { ok: false, error: 'Employee not found.' };

  const grant = await resolveGrant(ctx, appIds, packageIds);
  await materializeAccess(ctx.ownerUserId, userId, prov.roleId, grant.permissions);

  await cols.provisions.updateOne(
    { _id: prov._id },
    {
      $set: {
        grantedPermissions: grant.permissions,
        grantedApps: grant.apps,
        packageIds,
        updatedAt: new Date(),
      },
    },
  );

  await writeSabAdminAudit(ctx, 'update_access', `Updated access for ${prov.upn}`, { userId, upn: prov.upn }, { grantedApps: grant.apps });
  revalidatePath('/sabadmin/people');
  return { ok: true };
}

/* ── Mover: reset password (login + mailbox share the credential) ──────── */

export async function resetEmployeePassword(
  userId: string,
  newPassword?: string,
): Promise<ActionResult<{ oneTimePassword: string }>> {
  const ctxRes = await getSabAdminContext();
  if (!ctxRes.ok) return { ok: false, error: ctxRes.error };
  const ctx = ctxRes.ctx;

  const { cols } = await getSabAdminCollections();
  const prov = await cols.provisions.findOne({ ownerUserId: ctx.ownerUserId, userId });
  if (!prov) return { ok: false, error: 'Employee not found.' };

  const password = newPassword?.trim() || generateStrongMailboxPassword();

  // Login (Firebase + Mongo hash).
  const fb = await getFirebaseAuthUserByEmail(prov.upn).catch(() => null);
  if (fb) await setFirebaseAuthUserPassword(fb.uid, password);
  const { db } = await connectToDatabase();
  await db.collection('users').updateOne(
    { _id: new ObjectId(userId) },
    { $set: { password: await hashPassword(password), mustChangePassword: true, updatedAt: new Date() } },
  );

  // Mailbox (so IMAP/SMTP stays in sync with the single credential).
  if (prov.mailboxAccountId) {
    const settings = await getOrInitSabAdminSettings(ctx.ownerUserId);
    const mailWorkspaceId = await resolveMailWorkspaceId(ctx.ownerUserId, settings);
    if (mailWorkspaceId) {
      await resetHostedMailboxPasswordForWorkspace(mailWorkspaceId, prov.mailboxAccountId, password);
    }
  }

  await writeSabAdminAudit(ctx, 'reset_password', `Reset password for ${prov.upn}`, { userId, upn: prov.upn });
  revalidatePath('/sabadmin/people');
  return { ok: true, oneTimePassword: password };
}

/* ── Leaver / suspend / reactivate ─────────────────────────────────────── */

/** Suspend (block sign-in + suspend mailbox) or reactivate an employee. */
export async function setEmployeeSuspended(
  userId: string,
  suspended: boolean,
): Promise<ActionResult> {
  const ctxRes = await getSabAdminContext();
  if (!ctxRes.ok) return { ok: false, error: ctxRes.error };
  const ctx = ctxRes.ctx;

  const { cols } = await getSabAdminCollections();
  const prov = await cols.provisions.findOne({ ownerUserId: ctx.ownerUserId, userId });
  if (!prov) return { ok: false, error: 'Employee not found.' };

  const fb = await getFirebaseAuthUserByEmail(prov.upn).catch(() => null);
  if (fb) await setFirebaseAuthUserDisabled(fb.uid, suspended);
  if (suspended) await revokeAllSessionsForUser(userId);

  const { db } = await connectToDatabase();
  await db.collection('users').updateOne(
    { _id: new ObjectId(userId) },
    { $set: { blocked: suspended, updatedAt: new Date() } },
  );

  if (prov.mailboxAccountId) {
    const settings = await getOrInitSabAdminSettings(ctx.ownerUserId);
    const mailWorkspaceId = await resolveMailWorkspaceId(ctx.ownerUserId, settings);
    if (mailWorkspaceId) {
      await setHostedMailboxStatusForWorkspace(mailWorkspaceId, prov.mailboxAccountId, suspended ? 'suspended' : 'active');
    }
  }

  await cols.provisions.updateOne(
    { _id: prov._id },
    { $set: { status: suspended ? 'suspended' : 'active', updatedAt: new Date() } },
  );

  await writeSabAdminAudit(ctx, suspended ? 'suspend' : 'reactivate', `${suspended ? 'Suspended' : 'Reactivated'} ${prov.upn}`, { userId, upn: prov.upn });
  revalidatePath('/sabadmin/people');
  return { ok: true };
}

/**
 * Full offboard (Leaver): block sign-in everywhere, revoke all tool access,
 * suspend the mailbox, mark the HR record Terminated. The mailbox + accounts
 * are preserved (suspended, not deleted) for compliance — deletion is a
 * separate explicit step.
 */
export async function offboardEmployee(userId: string): Promise<ActionResult> {
  const ctxRes = await getSabAdminContext();
  if (!ctxRes.ok) return { ok: false, error: ctxRes.error };
  const ctx = ctxRes.ctx;

  const { cols } = await getSabAdminCollections();
  const prov = await cols.provisions.findOne({ ownerUserId: ctx.ownerUserId, userId });
  if (!prov) return { ok: false, error: 'Employee not found.' };

  const { db } = await connectToDatabase();
  const ownerOid = new ObjectId(ctx.ownerUserId);
  const empOid = new ObjectId(userId);

  // 1) Block sign-in: disable Firebase + revoke all live SabNode sessions.
  const fb = await getFirebaseAuthUserByEmail(prov.upn).catch(() => null);
  if (fb) await setFirebaseAuthUserDisabled(fb.uid, true);
  await revokeAllSessionsForUser(userId);
  await db.collection('users').updateOne({ _id: empOid }, { $set: { blocked: true, updatedAt: new Date() } });

  // 2) Revoke all tool access: drop agent rows + clear the role template.
  await db.collection('projects').updateMany(
    { userId: ownerOid },
    { $pull: { agents: { userId: empOid } } } as never,
  );
  await db.collection('users').updateOne(
    { _id: ownerOid },
    { $unset: { [`crm.permissions.${prov.roleId}`]: '' } },
  );

  // 3) Suspend the mailbox (preserve data for compliance).
  if (prov.mailboxAccountId) {
    const settings = await getOrInitSabAdminSettings(ctx.ownerUserId);
    const mailWorkspaceId = await resolveMailWorkspaceId(ctx.ownerUserId, settings);
    if (mailWorkspaceId) {
      await setHostedMailboxStatusForWorkspace(mailWorkspaceId, prov.mailboxAccountId, 'suspended');
    }
  }

  // 4) Mark the HR record Terminated.
  if (prov.employeeId && ObjectId.isValid(prov.employeeId)) {
    await db.collection('crm_employees').updateOne(
      { _id: new ObjectId(prov.employeeId) },
      { $set: { status: 'Terminated', updatedAt: new Date() } },
    );
  }

  await cols.provisions.updateOne(
    { _id: prov._id },
    { $set: { status: 'offboarded', offboardedAt: new Date(), updatedAt: new Date() } },
  );

  await writeSabAdminAudit(ctx, 'offboard', `Offboarded ${prov.upn}`, { userId, upn: prov.upn });
  revalidatePath('/sabadmin/people');
  revalidatePath('/sabadmin');
  return { ok: true };
}
