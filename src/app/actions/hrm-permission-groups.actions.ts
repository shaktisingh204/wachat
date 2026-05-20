'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete';

export interface ModulePermission {
  module: string;
  actions: PermissionAction[];
}

export interface HrmPermissionGroup {
  _id: string;
  userId: string;
  name: string;
  description?: string;
  permissions: ModulePermission[];
  createdAt: string;
  updatedAt: string;
}

export interface HrmEmployeeGroup {
  _id: string;
  userId: string;
  employeeId: string;
  groupId: string;
  assignedAt: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

const GROUPS_COL = 'hrm_permission_groups';
const EMP_GROUPS_COL = 'hrm_employee_groups';

function serializeGroup(doc: Record<string, unknown>): HrmPermissionGroup {
  return {
    _id: String(doc._id),
    userId: String(doc.userId),
    name: String(doc.name ?? ''),
    description: doc.description ? String(doc.description) : undefined,
    permissions: Array.isArray(doc.permissions)
      ? (doc.permissions as ModulePermission[])
      : [],
    createdAt: doc.createdAt
      ? new Date(doc.createdAt as string | Date).toISOString()
      : new Date().toISOString(),
    updatedAt: doc.updatedAt
      ? new Date(doc.updatedAt as string | Date).toISOString()
      : new Date().toISOString(),
  };
}

function serializeEmployeeGroup(doc: Record<string, unknown>): HrmEmployeeGroup {
  return {
    _id: String(doc._id),
    userId: String(doc.userId),
    employeeId: String(doc.employeeId),
    groupId: String(doc.groupId),
    assignedAt: doc.assignedAt
      ? new Date(doc.assignedAt as string | Date).toISOString()
      : new Date().toISOString(),
  };
}

/* ─── List all groups ────────────────────────────────────────────────────── */

export async function getPermissionGroups(): Promise<HrmPermissionGroup[]> {
  const session = await getSession();
  if (!session?.user) return [];

  const { db } = await connectToDatabase();
  const docs = await db
    .collection(GROUPS_COL)
    .find({ userId: new ObjectId(session.user._id as string) })
    .sort({ createdAt: -1 })
    .toArray();

  return docs.map((d) => serializeGroup(d as unknown as Record<string, unknown>));
}

/* ─── Get single group ───────────────────────────────────────────────────── */

export async function getPermissionGroupById(
  id: string,
): Promise<HrmPermissionGroup | null> {
  const session = await getSession();
  if (!session?.user) return null;
  if (!ObjectId.isValid(id)) return null;

  const { db } = await connectToDatabase();
  const doc = await db.collection(GROUPS_COL).findOne({
    _id: new ObjectId(id),
    userId: new ObjectId(session.user._id as string),
  });

  if (!doc) return null;
  return serializeGroup(doc as unknown as Record<string, unknown>);
}

/* ─── Create group ───────────────────────────────────────────────────────── */

export async function createPermissionGroup(data: {
  name: string;
  description?: string;
  permissions: ModulePermission[];
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };

  const name = data.name.trim();
  if (!name) return { success: false, error: 'Group name is required.' };

  try {
    const { db } = await connectToDatabase();
    const now = new Date();
    const result = await db.collection(GROUPS_COL).insertOne({
      userId: new ObjectId(session.user._id as string),
      name,
      description: data.description?.trim() || undefined,
      permissions: data.permissions,
      createdAt: now,
      updatedAt: now,
    });

    revalidatePath('/dashboard/hrm/permission-groups');
    return { success: true, id: result.insertedId.toString() };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { success: false, error: `Failed to create group: ${msg}` };
  }
}

/* ─── Update group ───────────────────────────────────────────────────────── */

export async function updatePermissionGroup(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    permissions: ModulePermission[];
  }>,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };
  if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid group ID.' };

  const $set: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) $set.name = data.name.trim();
  if (data.description !== undefined) $set.description = data.description.trim();
  if (data.permissions !== undefined) $set.permissions = data.permissions;

  try {
    const { db } = await connectToDatabase();
    const res = await db.collection(GROUPS_COL).updateOne(
      {
        _id: new ObjectId(id),
        userId: new ObjectId(session.user._id as string),
      },
      { $set },
    );

    if (res.matchedCount === 0) return { success: false, error: 'Group not found.' };
    revalidatePath('/dashboard/hrm/permission-groups');
    revalidatePath(`/dashboard/hrm/permission-groups/${id}`);
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { success: false, error: `Failed to update group: ${msg}` };
  }
}

/* ─── Delete group ───────────────────────────────────────────────────────── */

export async function deletePermissionGroup(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };
  if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid group ID.' };

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id as string);
    const groupOid = new ObjectId(id);

    await db
      .collection(EMP_GROUPS_COL)
      .deleteMany({ userId, groupId: groupOid.toString() });

    const res = await db
      .collection(GROUPS_COL)
      .deleteOne({ _id: groupOid, userId });

    if (res.deletedCount === 0) return { success: false, error: 'Group not found.' };
    revalidatePath('/dashboard/hrm/permission-groups');
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { success: false, error: `Failed to delete group: ${msg}` };
  }
}

/* ─── Assign group to employee ───────────────────────────────────────────── */

export async function assignGroupToEmployee(
  employeeId: string,
  groupId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };
  if (!ObjectId.isValid(groupId)) return { success: false, error: 'Invalid group ID.' };

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id as string);

    // Verify group belongs to tenant
    const group = await db
      .collection(GROUPS_COL)
      .findOne({ _id: new ObjectId(groupId), userId });
    if (!group) return { success: false, error: 'Group not found.' };

    // Upsert: one employee → one group at a time
    await db.collection(EMP_GROUPS_COL).updateOne(
      { userId, employeeId },
      {
        $set: {
          userId,
          employeeId,
          groupId,
          assignedAt: new Date(),
        },
      },
      { upsert: true },
    );

    revalidatePath('/dashboard/hrm/permission-groups');
    revalidatePath(`/dashboard/hrm/permission-groups/${groupId}`);
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { success: false, error: `Failed to assign group: ${msg}` };
  }
}

/* ─── Remove assignment ──────────────────────────────────────────────────── */

export async function removeGroupFromEmployee(
  employeeId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };

  try {
    const { db } = await connectToDatabase();
    await db.collection(EMP_GROUPS_COL).deleteOne({
      userId: new ObjectId(session.user._id as string),
      employeeId,
    });
    revalidatePath('/dashboard/hrm/permission-groups');
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { success: false, error: `Failed to remove assignment: ${msg}` };
  }
}

/* ─── Get employee's group ───────────────────────────────────────────────── */

export async function getEmployeeGroup(
  employeeId: string,
): Promise<HrmEmployeeGroup | null> {
  const session = await getSession();
  if (!session?.user) return null;

  const { db } = await connectToDatabase();
  const doc = await db.collection(EMP_GROUPS_COL).findOne({
    userId: new ObjectId(session.user._id as string),
    employeeId,
  });

  if (!doc) return null;
  return serializeEmployeeGroup(doc as unknown as Record<string, unknown>);
}

/* ─── Get employee's resolved permissions ────────────────────────────────── */

export async function getEmployeePermissions(
  employeeId: string,
): Promise<ModulePermission[]> {
  const session = await getSession();
  if (!session?.user) return [];

  const { db } = await connectToDatabase();
  const userId = new ObjectId(session.user._id as string);

  const assignment = await db
    .collection(EMP_GROUPS_COL)
    .findOne({ userId, employeeId });
  if (!assignment) return [];

  const group = await db
    .collection(GROUPS_COL)
    .findOne({ _id: new ObjectId(String(assignment.groupId)), userId });
  if (!group) return [];

  return Array.isArray(group.permissions)
    ? (group.permissions as ModulePermission[])
    : [];
}

/* ─── KPIs ───────────────────────────────────────────────────────────────── */

export async function getPermissionGroupKpis(): Promise<
  { label: string; value: number }[]
> {
  const session = await getSession();
  if (!session?.user)
    return [
      { label: 'Total Groups', value: 0 },
      { label: 'Employees Assigned', value: 0 },
      { label: 'Most-Used Group', value: 0 },
      { label: 'Custom Modules', value: 0 },
    ];

  const { db } = await connectToDatabase();
  const userId = new ObjectId(session.user._id as string);

  const [groups, assignments] = await Promise.all([
    db.collection(GROUPS_COL).find({ userId }).toArray(),
    db.collection(EMP_GROUPS_COL).find({ userId }).toArray(),
  ]);

  const totalGroups = groups.length;
  const employeesAssigned = new Set(
    assignments.map((a) => String(a.employeeId)),
  ).size;

  // Count assignments per groupId → find max
  const countMap = new Map<string, number>();
  for (const a of assignments) {
    const gid = String(a.groupId);
    countMap.set(gid, (countMap.get(gid) ?? 0) + 1);
  }
  const mostUsedCount = countMap.size > 0 ? Math.max(...countMap.values()) : 0;

  // Count unique module keys across all groups
  const moduleSet = new Set<string>();
  for (const g of groups) {
    if (Array.isArray(g.permissions)) {
      for (const p of g.permissions as ModulePermission[]) {
        moduleSet.add(p.module);
      }
    }
  }

  return [
    { label: 'Total Groups', value: totalGroups },
    { label: 'Employees Assigned', value: employeesAssigned },
    { label: 'Most-Used Group', value: mostUsedCount },
    { label: 'Custom Modules', value: moduleSet.size },
  ];
}

/* ─── Employees assigned to a specific group (for edit page) ─────────────── */

export async function getEmployeesInGroup(groupId: string): Promise<
  { employeeId: string; assignedAt: string }[]
> {
  const session = await getSession();
  if (!session?.user) return [];

  const { db } = await connectToDatabase();
  const docs = await db
    .collection(EMP_GROUPS_COL)
    .find({
      userId: new ObjectId(session.user._id as string),
      groupId,
    })
    .sort({ assignedAt: -1 })
    .toArray();

  return docs.map((d) => ({
    employeeId: String(d.employeeId),
    assignedAt: d.assignedAt
      ? new Date(d.assignedAt as string | Date).toISOString()
      : new Date().toISOString(),
  }));
}

/* ─── List employees for assignment dropdown ─────────────────────────────── */

export async function getHrmEmployeeList(): Promise<
  { _id: string; name: string; email?: string }[]
> {
  const session = await getSession();
  if (!session?.user) return [];

  const { db } = await connectToDatabase();
  const docs = await db
    .collection('crm_employees')
    .find(
      { userId: new ObjectId(session.user._id as string) },
      { projection: { _id: 1, name: 1, email: 1, firstName: 1, lastName: 1 } },
    )
    .sort({ name: 1 })
    .limit(500)
    .toArray();

  return docs.map((d) => ({
    _id: String(d._id),
    name:
      String(d.name ?? `${d.firstName ?? ''} ${d.lastName ?? ''}`.trim() || 'Unnamed'),
    email: d.email ? String(d.email) : undefined,
  }));
}
