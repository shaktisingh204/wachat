'use server';

/**
 * CRM Assignment — generic reassign + employee lookup server actions.
 *
 * Powers `<AssignmentControl>` and the "Assigned to me" filter chip on
 * every CRM list page. All queries are scoped by tenant `userId` from
 * `getSession()`. The current-user employee record is resolved by email
 * match against `crm_employees`.
 *
 * Returns `{ ok, error? }` for mutations so callers can render a
 * consistent toast regardless of entity type.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getErrorMessage } from '@/lib/utils';

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type AssignableEntity =
  | 'task'
  | 'lead'
  | 'deal'
  | 'project'
  | 'ticket'
  | 'invoice'
  | 'contract'
  | 'estimate';

export interface Employee {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  designation?: string;
  department?: string;
  avatar?: string;
}

export interface EmployeeFilter {
  departmentId?: string;
  activeOnly?: boolean;
}

export interface AssignmentStats {
  openTasks: number;
  openLeads: number;
  openDeals: number;
  openTickets: number;
}

export interface AssignmentResult {
  ok: boolean;
  error?: string;
}

/* ─── Entity → collection / field map ────────────────────────────────────── */

interface EntityConfig {
  collection: string;
  field: string;
}

// Field map per entity. Note: the original spec called for `agentId`
// on tickets, but the live `crm_tickets` collection (and Rust client)
// uses `assigneeId` — we honor the runtime truth here.
const ENTITY_MAP: Record<AssignableEntity, EntityConfig> = {
  task: { collection: 'crm_tasks', field: 'assignedTo' },
  lead: { collection: 'crm_leads', field: 'assignedTo' },
  deal: { collection: 'crm_deals', field: 'assignedTo' },
  project: { collection: 'crm_projects', field: 'projectAdminId' },
  ticket: { collection: 'crm_tickets', field: 'assigneeId' },
  invoice: { collection: 'crm_invoices', field: 'assignedTo' },
  contract: { collection: 'crm_contracts', field: 'assignedTo' },
  estimate: { collection: 'crm_estimates', field: 'assignedTo' },
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

interface SessionUser {
  _id: string;
  email?: string | null;
}

async function requireSession(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session?.user?._id) return null;
  return {
    _id: String(session.user._id),
    email: session.user.email ? String(session.user.email) : null,
  };
}

/* ─── List employees ─────────────────────────────────────────────────────── */

/**
 * Returns up to 200 employees in the current tenant. Optionally filtered
 * by department and/or status. Hydrates `designation` and `department`
 * display names via batched lookups.
 */
export async function getAssignableEmployees(
  filter?: EmployeeFilter,
): Promise<Employee[]> {
  const session = await requireSession();
  if (!session) return [];

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session._id);

    const match: Record<string, unknown> = { userId };
    if (filter?.departmentId && ObjectId.isValid(filter.departmentId)) {
      match.departmentId = new ObjectId(filter.departmentId);
    }
    if (filter?.activeOnly) {
      match.status = 'Active';
    }

    const docs = await db
      .collection('crm_employees')
      .find(match, {
        projection: {
          firstName: 1,
          lastName: 1,
          email: 1,
          designationId: 1,
          departmentId: 1,
          avatar: 1,
          imageUrl: 1,
        },
      })
      .sort({ firstName: 1, lastName: 1 })
      .limit(200)
      .toArray();

    if (docs.length === 0) return [];

    const desigIds = [
      ...new Set(
        docs
          .map((d) => (d.designationId ? String(d.designationId) : null))
          .filter((v): v is string => !!v && ObjectId.isValid(v)),
      ),
    ];
    const deptIds = [
      ...new Set(
        docs
          .map((d) => (d.departmentId ? String(d.departmentId) : null))
          .filter((v): v is string => !!v && ObjectId.isValid(v)),
      ),
    ];

    const [desigDocs, deptDocs] = await Promise.all([
      desigIds.length
        ? db
            .collection('crm_designations')
            .find(
              { _id: { $in: desigIds.map((id) => new ObjectId(id)) } },
              { projection: { name: 1 } },
            )
            .toArray()
        : Promise.resolve([]),
      deptIds.length
        ? db
            .collection('crm_departments')
            .find(
              { _id: { $in: deptIds.map((id) => new ObjectId(id)) } },
              { projection: { name: 1 } },
            )
            .toArray()
        : Promise.resolve([]),
    ]);

    const desigMap = new Map(
      desigDocs.map((d) => [String(d._id), String(d.name ?? '')]),
    );
    const deptMap = new Map(
      deptDocs.map((d) => [String(d._id), String(d.name ?? '')]),
    );

    return docs.map((d) => ({
      _id: String(d._id),
      firstName: String(d.firstName ?? ''),
      lastName: String(d.lastName ?? ''),
      email: String(d.email ?? ''),
      designation: d.designationId
        ? desigMap.get(String(d.designationId)) || undefined
        : undefined,
      department: d.departmentId
        ? deptMap.get(String(d.departmentId)) || undefined
        : undefined,
      avatar: d.avatar
        ? String(d.avatar)
        : d.imageUrl
          ? String(d.imageUrl)
          : undefined,
    }));
  } catch (e) {
    console.error('[getAssignableEmployees] failed:', getErrorMessage(e));
    return [];
  }
}

/* ─── Resolve "my" employee id ───────────────────────────────────────────── */

/**
 * Resolves the calling user's `crm_employees._id` by matching email
 * within the tenant. Returns `null` when the user has no linked
 * employee record (common for admins).
 */
export async function getMyEmployeeId(): Promise<string | null> {
  const session = await requireSession();
  if (!session?.email) return null;

  try {
    const { db } = await connectToDatabase();
    const doc = await db.collection('crm_employees').findOne(
      {
        userId: new ObjectId(session._id),
        email: session.email,
      },
      { projection: { _id: 1 } },
    );
    return doc ? String(doc._id) : null;
  } catch (e) {
    console.error('[getMyEmployeeId] failed:', getErrorMessage(e));
    return null;
  }
}

/* ─── Reassign entity ────────────────────────────────────────────────────── */

const REVALIDATE_PATHS: Record<AssignableEntity, string[]> = {
  task: ['/dashboard/crm/tasks'],
  lead: ['/dashboard/crm/sales-crm/all-leads', '/dashboard/crm/sales-crm/leads'],
  deal: ['/dashboard/crm/sales-crm/pipelines', '/dashboard/crm/deals'],
  project: ['/dashboard/crm/projects'],
  ticket: ['/dashboard/crm/tickets'],
  invoice: ['/dashboard/crm/sales/invoices'],
  contract: ['/dashboard/crm/contracts'],
  estimate: ['/dashboard/crm/sales/estimates'],
};

/**
 * Reassigns `entityId` (of `entityType`) to `newAssigneeId`. Pass
 * `null` to clear the assignee. Tenant-scoped — only entities owned by
 * the caller's `userId` can be reassigned.
 *
 * Also stamps `assignedBy` (current user) and `assignedAt` (now) so
 * audit trails work consistently.
 */
export async function reassignEntity(
  entityType: AssignableEntity,
  entityId: string,
  newAssigneeId: string | null,
): Promise<AssignmentResult> {
  const session = await requireSession();
  if (!session) return { ok: false, error: 'Access denied.' };

  const cfg = ENTITY_MAP[entityType];
  if (!cfg) return { ok: false, error: 'Unknown entity type.' };

  if (!ObjectId.isValid(entityId)) {
    return { ok: false, error: 'Invalid entity ID.' };
  }
  if (newAssigneeId !== null && !ObjectId.isValid(newAssigneeId)) {
    return { ok: false, error: 'Invalid assignee ID.' };
  }

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session._id);

    // Verify assignee exists in tenant (when not clearing).
    if (newAssigneeId) {
      const emp = await db.collection('crm_employees').findOne(
        { _id: new ObjectId(newAssigneeId), userId },
        { projection: { _id: 1 } },
      );
      if (!emp) return { ok: false, error: 'Assignee not found in tenant.' };
    }

    const $set: Record<string, unknown> = {
      [cfg.field]: newAssigneeId,
      assignedBy: session._id,
      assignedAt: new Date(),
      updatedAt: new Date(),
    };

    const res = await db.collection(cfg.collection).updateOne(
      { _id: new ObjectId(entityId), userId },
      { $set },
    );

    if (res.matchedCount === 0) {
      return { ok: false, error: 'Entity not found.' };
    }

    for (const path of REVALIDATE_PATHS[entityType] ?? []) {
      revalidatePath(path);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Failed to reassign: ${getErrorMessage(e)}` };
  }
}

/* ─── Assignment stats for an employee ───────────────────────────────────── */

/**
 * Returns counts of currently-open work assigned to `employeeId`.
 * Used by the "My Team" dashboard widget.
 */
export async function getEmployeeAssignmentStats(
  employeeId: string,
): Promise<AssignmentStats> {
  const empty: AssignmentStats = {
    openTasks: 0,
    openLeads: 0,
    openDeals: 0,
    openTickets: 0,
  };

  const session = await requireSession();
  if (!session) return empty;
  if (!ObjectId.isValid(employeeId)) return empty;

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session._id);
    const assignedStr = employeeId;

    const [openTasks, openLeads, openDeals, openTickets] = await Promise.all([
      db.collection('crm_tasks').countDocuments({
        userId,
        assignedTo: assignedStr,
        status: { $ne: 'Completed' },
      }),
      db.collection('crm_leads').countDocuments({
        userId,
        assignedTo: assignedStr,
        status: { $nin: ['Won', 'Lost', 'Closed'] },
      }),
      db.collection('crm_deals').countDocuments({
        userId,
        assignedTo: assignedStr,
        status: { $nin: ['Won', 'Lost', 'Closed'] },
      }),
      db.collection('crm_tickets').countDocuments({
        userId,
        assigneeId: assignedStr,
        status: { $nin: ['Resolved', 'Closed'] },
      }),
    ]);

    return { openTasks, openLeads, openDeals, openTickets };
  } catch (e) {
    console.error('[getEmployeeAssignmentStats] failed:', getErrorMessage(e));
    return empty;
  }
}

/* ─── Single-employee lookup (for widget hydration) ──────────────────────── */

/**
 * Fetches a single employee by id, scoped to the current tenant.
 * Used to render the current-assignee chip without re-querying the
 * whole employee list.
 */
export async function getEmployeeById(
  employeeId: string,
): Promise<Employee | null> {
  const session = await requireSession();
  if (!session) return null;
  if (!ObjectId.isValid(employeeId)) return null;

  try {
    const { db } = await connectToDatabase();
    const doc = await db.collection('crm_employees').findOne({
      _id: new ObjectId(employeeId),
      userId: new ObjectId(session._id),
    });
    if (!doc) return null;

    let designation: string | undefined;
    if (doc.designationId && ObjectId.isValid(String(doc.designationId))) {
      const d = await db
        .collection('crm_designations')
        .findOne(
          { _id: new ObjectId(String(doc.designationId)) },
          { projection: { name: 1 } },
        );
      designation = d?.name ? String(d.name) : undefined;
    }
    let department: string | undefined;
    if (doc.departmentId && ObjectId.isValid(String(doc.departmentId))) {
      const d = await db
        .collection('crm_departments')
        .findOne(
          { _id: new ObjectId(String(doc.departmentId)) },
          { projection: { name: 1 } },
        );
      department = d?.name ? String(d.name) : undefined;
    }

    return {
      _id: String(doc._id),
      firstName: String(doc.firstName ?? ''),
      lastName: String(doc.lastName ?? ''),
      email: String(doc.email ?? ''),
      designation,
      department,
      avatar: doc.avatar
        ? String(doc.avatar)
        : doc.imageUrl
          ? String(doc.imageUrl)
          : undefined,
    };
  } catch (e) {
    console.error('[getEmployeeById] failed:', getErrorMessage(e));
    return null;
  }
}
