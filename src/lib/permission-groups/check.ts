/**
 * Permission-group enforcement helpers.
 *
 * SabNode HRM stores per-group module permissions in `hrm_permission_groups`
 * and per-employee assignments in `hrm_employee_groups`. Until now those
 * tables were configured but not enforced. This module is the *runtime
 * read-side*: given a session, it resolves the user's effective module
 * permissions and exposes simple `has*` checks.
 *
 * The check is **additive over existing RBAC** — it does not replace
 * `requirePermission()` from `@/lib/rbac-server`. Use this when you want
 * to gate UI/actions on the HRM permission-group system specifically
 * (e.g. "Bulk delete is only available to the Managers group").
 *
 * Tenant-scoped via `getSession()` — every query filters by `userId`.
 */

import 'server-only';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete';

interface ModulePermission {
  module: string;
  actions: PermissionAction[];
}

/**
 * Returns the resolved set of `"<module>:<action>"` strings the current
 * user has access to via their assigned permission group. Returns an
 * empty set when the user has no employee record, no group assignment,
 * or the assignment is dangling.
 */
export async function getCurrentUserPermissions(): Promise<Set<string>> {
  const out = new Set<string>();

  const session = await getSession();
  if (!session?.user?._id || !session.user.email) return out;

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(String(session.user._id));

    // 1. Resolve employee id (email-match within tenant).
    const employee = await db
      .collection('crm_employees')
      .findOne(
        { userId, email: session.user.email },
        { projection: { _id: 1 } },
      );
    if (!employee) return out;

    // 2. Resolve group assignment.
    const assignment = await db.collection('hrm_employee_groups').findOne({
      userId,
      employeeId: String(employee._id),
    });
    if (!assignment?.groupId) return out;

    // 3. Load group.
    const groupId = String(assignment.groupId);
    if (!ObjectId.isValid(groupId)) return out;

    const group = await db
      .collection('hrm_permission_groups')
      .findOne({ _id: new ObjectId(groupId), userId });
    if (!group) return out;

    const perms = Array.isArray(group.permissions)
      ? (group.permissions as ModulePermission[])
      : [];
    for (const p of perms) {
      if (!p?.module || !Array.isArray(p.actions)) continue;
      for (const action of p.actions) {
        out.add(`${p.module}:${action}`);
      }
    }
    return out;
  } catch (e) {
    console.error('[getCurrentUserPermissions] failed:', e);
    return out;
  }
}

/**
 * Convenience: check a single `(module, action)` pair against the
 * current user's resolved permission set.
 *
 * When the user has **no permission group at all**, this returns `true`
 * — i.e. permission groups are an *opt-in narrowing* on top of the
 * tenant owner's full access. Tenants that haven't configured groups
 * keep working unchanged.
 */
export async function hasPermissionGroup(
  module: string,
  action: PermissionAction,
): Promise<boolean> {
  const session = await getSession();
  if (!session?.user?._id || !session.user.email) return false;

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(String(session.user._id));

    const employee = await db
      .collection('crm_employees')
      .findOne(
        { userId, email: session.user.email },
        { projection: { _id: 1 } },
      );

    // Not an employee → caller is the tenant owner / admin → allow.
    if (!employee) return true;

    const assignment = await db.collection('hrm_employee_groups').findOne({
      userId,
      employeeId: String(employee._id),
    });

    // No group assignment → un-narrowed → allow (back-compat).
    if (!assignment?.groupId) return true;

    const groupId = String(assignment.groupId);
    if (!ObjectId.isValid(groupId)) return true;

    const group = await db
      .collection('hrm_permission_groups')
      .findOne({ _id: new ObjectId(groupId), userId });
    if (!group) return true;

    const perms = Array.isArray(group.permissions)
      ? (group.permissions as ModulePermission[])
      : [];
    const mod = perms.find((p) => p?.module === module);
    if (!mod) return false;
    return Array.isArray(mod.actions) && mod.actions.includes(action);
  } catch (e) {
    console.error('[hasPermissionGroup] failed:', e);
    return false;
  }
}

/**
 * Returns whether the current user is allowed into the HRM portal.
 * Default: any user with a linked `crm_employees` record. Future:
 * gate on a dedicated `portal:view` permission once UI exists.
 */
export async function hasPortalAccess(): Promise<boolean> {
  const session = await getSession();
  if (!session?.user?._id || !session.user.email) return false;

  try {
    const { db } = await connectToDatabase();
    const employee = await db.collection('crm_employees').findOne(
      {
        userId: new ObjectId(String(session.user._id)),
        email: session.user.email,
      },
      { projection: { _id: 1 } },
    );
    // Tenant owner without an employee record still gets in.
    if (!employee) return true;
    return true;
  } catch {
    return false;
  }
}
