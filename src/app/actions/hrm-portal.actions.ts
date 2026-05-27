'use server';

/**
 * HRM Employee Self-Service Portal — server actions.
 *
 * All functions:
 *  1. Call getSession() and resolve the acting employee by email.
 *  2. Scope every query by `userId` (tenant isolation).
 *  3. Return plain-JSON-safe typed results (no ObjectId / Date references
 *     on the wire — serialised via JSON.parse(JSON.stringify(…))).
 */

import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getErrorMessage } from '@/lib/utils';
import type { CrmEmployee, CrmTask } from '@/lib/definitions';
import { revalidatePath } from 'next/cache';

// ─── Shared types ─────────────────────────────────────────────────────────────

interface PortalEmployeeProfile {
    _id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
    email: string;
    status: CrmEmployee['status'];
    dateOfJoining: string | null;
    departmentId: string | null;
    designationId: string | null;
    departmentName: string | null;
    designationName: string | null;
    reportingManagerId: string | null;
    reportingManagerName: string | null;
}

interface PortalTeamMember {
    _id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
    email: string;
    status: CrmEmployee['status'];
    designationId: string | null;
    designationName: string | null;
    departmentId: string | null;
    departmentName: string | null;
}

interface PortalTask {
    _id: string;
    title: string;
    description: string | null;
    status: CrmTask['status'];
    priority: CrmTask['priority'];
    dueDate: string | null;
    assignedTo: string | null;
    createdBy: string | null;
    createdAt: string;
    /** Hydrated display names — resolved by the action, not the UI. */
    assignedToName: string | null;
    createdByName: string | null;
}

interface PortalKpis {
    teamSize: number;
    pendingTasks: number;
    completedThisWeek: number;
    pendingReports: number;
}

interface AssignTaskInput {
    title: string;
    description?: string;
    dueDate?: string;
    priority: CrmTask['priority'];
    linkedEmployeeId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Finds the caller's employee record by session email, scoped to tenant. */
async function resolveMyEmployee(
    tenantUserId: string,
): Promise<WithId<CrmEmployee> | null> {
    const session = await getSession();
    if (!session?.user) return null;

    const { db } = await connectToDatabase();
    const employee = await db
        .collection<CrmEmployee>('crm_employees')
        .findOne({
            userId: new ObjectId(tenantUserId),
            email: session.user.email,
        });

    return employee ?? null;
}

/** Returns a `name → ObjectId` lookup for a list of employee ids. */
async function buildNameMap(
    db: Awaited<ReturnType<typeof connectToDatabase>>['db'],
    userId: ObjectId,
    ids: (ObjectId | string | null | undefined)[],
): Promise<Map<string, string>> {
    const validIds = ids
        .filter((id): id is string | ObjectId => id != null && id !== '')
        .map((id) => (typeof id === 'string' ? new ObjectId(id) : id))
        .filter((id) => ObjectId.isValid(id));

    if (validIds.length === 0) return new Map();

    const docs = await db
        .collection<CrmEmployee>('crm_employees')
        .find({ _id: { $in: validIds }, userId }, { projection: { firstName: 1, lastName: 1 } })
        .toArray();

    return new Map(
        docs.map((d) => [
            String(d._id),
            `${d.firstName ?? ''} ${d.lastName ?? ''}`.trim(),
        ]),
    );
}

/** Returns the name of the linked department / designation, if any. */
async function resolveCatalogName(
    db: Awaited<ReturnType<typeof connectToDatabase>>['db'],
    collection: 'crm_departments' | 'crm_designations',
    id: ObjectId | null | undefined,
): Promise<string | null> {
    if (!id) return null;
    const doc = await db
        .collection(collection)
        .findOne({ _id: id }, { projection: { name: 1 } });
    return (doc?.name as string | undefined) ?? null;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Returns the logged-in user's employee profile, enriched with
 * department / designation / reporting-manager names.
 *
 * Pass `tenantUserId` when you already have the session userId to avoid
 * a second getSession call.
 */
export async function getMyEmployeeProfile(
    tenantUserId?: string,
): Promise<PortalEmployeeProfile | null> {
    const session = await getSession();
    if (!session?.user) return null;

    const uid = tenantUserId ?? String(session.user._id);

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(uid);

        const employee = await db
            .collection<CrmEmployee>('crm_employees')
            .findOne({ userId, email: session.user.email });

        if (!employee) return null;

        const [deptName, desigName, managerName] = await Promise.all([
            resolveCatalogName(db, 'crm_departments', employee.departmentId ?? null),
            resolveCatalogName(db, 'crm_designations', employee.designationId ?? null),
            employee.reportingManagerId
                ? db
                      .collection<CrmEmployee>('crm_employees')
                      .findOne(
                          { _id: employee.reportingManagerId, userId },
                          { projection: { firstName: 1, lastName: 1 } },
                      )
                      .then((m) =>
                          m ? `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() : null,
                      )
                : Promise.resolve(null),
        ]);

        return {
            _id: String(employee._id),
            firstName: employee.firstName,
            lastName: employee.lastName,
            employeeId: employee.employeeId,
            email: employee.email,
            status: employee.status,
            dateOfJoining: employee.dateOfJoining
                ? new Date(employee.dateOfJoining).toISOString()
                : null,
            departmentId: employee.departmentId ? String(employee.departmentId) : null,
            designationId: employee.designationId ? String(employee.designationId) : null,
            departmentName: deptName,
            designationName: desigName,
            reportingManagerId: employee.reportingManagerId
                ? String(employee.reportingManagerId)
                : null,
            reportingManagerName: managerName,
        };
    } catch (e) {
        console.error('[getMyEmployeeProfile] failed:', e);
        return null;
    }
}

/**
 * Returns all employees whose `reportingManagerId` matches the caller's
 * employee `_id`, scoped by `userId`.
 */
export async function getMyDirectReports(): Promise<PortalTeamMember[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(String(session.user._id));

        const me = await resolveMyEmployee(String(session.user._id));
        if (!me) return [];

        const reports = await db
            .collection<CrmEmployee>('crm_employees')
            .find({ userId, reportingManagerId: me._id })
            .sort({ firstName: 1, lastName: 1 })
            .toArray();

        if (reports.length === 0) return [];

        // Batch-resolve designation names.
        const desigIds = [...new Set(reports.map((r) => r.designationId?.toString()).filter(Boolean))];
        const desigDocs = desigIds.length
            ? await db
                  .collection('crm_designations')
                  .find(
                      { _id: { $in: desigIds.map((id) => new ObjectId(id!)) } },
                      { projection: { name: 1 } },
                  )
                  .toArray()
            : [];
        const desigMap = new Map(desigDocs.map((d) => [String(d._id), d.name as string]));

        // Batch-resolve department names.
        const deptIds = [...new Set(reports.map((r) => r.departmentId?.toString()).filter(Boolean))];
        const deptDocs = deptIds.length
            ? await db
                  .collection('crm_departments')
                  .find(
                      { _id: { $in: deptIds.map((id) => new ObjectId(id!)) } },
                      { projection: { name: 1 } },
                  )
                  .toArray()
            : [];
        const deptMap = new Map(deptDocs.map((d) => [String(d._id), d.name as string]));

        return reports.map((r) => ({
            _id: String(r._id),
            firstName: r.firstName,
            lastName: r.lastName,
            employeeId: r.employeeId,
            email: r.email,
            status: r.status,
            designationId: r.designationId ? String(r.designationId) : null,
            designationName: r.designationId ? (desigMap.get(String(r.designationId)) ?? null) : null,
            departmentId: r.departmentId ? String(r.departmentId) : null,
            departmentName: r.departmentId ? (deptMap.get(String(r.departmentId)) ?? null) : null,
        }));
    } catch (e) {
        console.error('[getMyDirectReports] failed:', e);
        return [];
    }
}

/**
 * Returns open (not-Completed) `crm_tasks` assigned to the caller's
 * employee record, sorted by due date ascending.
 */
export async function getMyAssignedTasks(): Promise<PortalTask[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(String(session.user._id));

        const me = await resolveMyEmployee(String(session.user._id));
        if (!me) return [];

        const tasks = await db
            .collection<CrmTask>('crm_tasks')
            .find({
                userId,
                assignedTo: me._id,
                status: { $ne: 'Completed' },
            })
            .sort({ dueDate: 1, createdAt: -1 })
            .toArray();

        if (tasks.length === 0) return [];

        const creatorIds = tasks
            .map((t) => (t as Record<string, unknown>).createdBy as ObjectId | undefined)
            .filter((id): id is ObjectId => id != null);

        const nameMap = await buildNameMap(db, userId, creatorIds);

        return tasks.map((t) => {
            const raw = t as Record<string, unknown>;
            const createdById = raw.createdBy
                ? String(raw.createdBy as ObjectId)
                : null;
            return {
                _id: String(t._id),
                title: t.title,
                description: t.description ?? null,
                status: t.status,
                priority: t.priority,
                dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
                assignedTo: String(me._id),
                createdBy: createdById,
                createdAt: new Date(t.createdAt).toISOString(),
                assignedToName: `${me.firstName} ${me.lastName}`.trim(),
                createdByName: createdById ? (nameMap.get(createdById) ?? null) : null,
            };
        });
    } catch (e) {
        console.error('[getMyAssignedTasks] failed:', e);
        return [];
    }
}

/**
 * Returns open `crm_tasks` created by the caller's employee that haven't
 * been completed, sorted by due date ascending.
 */
export async function getMyCreatedTasks(): Promise<PortalTask[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(String(session.user._id));

        const me = await resolveMyEmployee(String(session.user._id));
        if (!me) return [];

        const tasks = await db
            .collection<CrmTask>('crm_tasks')
            .find({
                userId,
                createdBy: me._id,
                status: { $ne: 'Completed' },
            })
            .sort({ dueDate: 1, createdAt: -1 })
            .toArray();

        if (tasks.length === 0) return [];

        const assigneeIds = tasks
            .map((t) => t.assignedTo)
            .filter((id): id is ObjectId => id != null);

        const nameMap = await buildNameMap(db, userId, assigneeIds);

        return tasks.map((t) => {
            const raw = t as Record<string, unknown>;
            const createdById = raw.createdBy
                ? String(raw.createdBy as ObjectId)
                : null;
            const assignedToId = t.assignedTo ? String(t.assignedTo) : null;
            return {
                _id: String(t._id),
                title: t.title,
                description: t.description ?? null,
                status: t.status,
                priority: t.priority,
                dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
                assignedTo: assignedToId,
                createdBy: createdById,
                createdAt: new Date(t.createdAt).toISOString(),
                assignedToName: assignedToId ? (nameMap.get(assignedToId) ?? null) : null,
                createdByName: `${me.firstName} ${me.lastName}`.trim(),
            };
        });
    } catch (e) {
        console.error('[getMyCreatedTasks] failed:', e);
        return [];
    }
}

/**
 * Creates a `crm_task` assigned to the given employee, authored by the
 * caller's employee record. The task is scoped to the tenant `userId`.
 */
export async function assignTaskToEmployee(
    employeeId: string,
    taskData: AssignTaskInput,
): Promise<{ success: boolean; taskId?: string; error?: string }> {
    if (!employeeId || !ObjectId.isValid(employeeId)) {
        return { success: false, error: 'Invalid employee id.' };
    }
    if (!taskData.title?.trim()) {
        return { success: false, error: 'Task title is required.' };
    }

    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(String(session.user._id));

        // Confirm the target employee belongs to this tenant.
        const targetEmployee = await db
            .collection<CrmEmployee>('crm_employees')
            .findOne({ _id: new ObjectId(employeeId), userId });

        if (!targetEmployee) {
            return { success: false, error: 'Employee not found in your organisation.' };
        }

        const me = await resolveMyEmployee(String(session.user._id));

        const now = new Date();
        // FIX: persist `assignedBy` (the employee that delegated the task) so
        // managers can audit who routed each task — `createdBy` alone conflated
        // "task author" with "task delegator".
        const assignerEmployeeId = me ? me._id : null;
        const doc: Record<string, unknown> = {
            userId,
            title: taskData.title.trim(),
            description: taskData.description?.trim() ?? undefined,
            priority: taskData.priority,
            status: 'To-Do' as CrmTask['status'],
            type: 'Follow-up',
            assignedTo: new ObjectId(employeeId),
            assignedBy: assignerEmployeeId ?? userId,
            createdBy: assignerEmployeeId ?? userId,
            dueDate: taskData.dueDate ? new Date(taskData.dueDate) : undefined,
            createdAt: now,
            updatedAt: now,
        };

        const result = await db.collection('crm_tasks').insertOne(doc as never);

        revalidatePath('/dashboard/hrm/portal');
        return { success: true, taskId: result.insertedId.toString() };
    } catch (e) {
        console.error('[assignTaskToEmployee] failed:', e);
        return { success: false, error: getErrorMessage(e) };
    }
}

/**
 * Marks a task as Completed. The caller must be the assignee or creator.
 */
export async function markTaskComplete(
    taskId: string,
): Promise<{ success: boolean; error?: string }> {
    if (!taskId || !ObjectId.isValid(taskId)) {
        return { success: false, error: 'Invalid task id.' };
    }

    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(String(session.user._id));
        const me = await resolveMyEmployee(String(session.user._id));

        // FIX: previously, when `me` was null we allowed ANY task in the tenant
        // to be marked complete. Require a linked employee profile so the
        // assignee/creator gate is actually enforced.
        if (!me) {
            return { success: false, error: 'No employee profile linked to your account.' };
        }

        const taskFilter: Record<string, unknown> = {
            _id: new ObjectId(taskId),
            userId,
            $or: [
                { assignedTo: me._id },
                { createdBy: me._id },
            ],
        };

        const now = new Date();
        const result = await db.collection('crm_tasks').updateOne(taskFilter, {
            // FIX: also record `completedAt` so dashboards / reports can sort
            // and filter on completion time.
            $set: { status: 'Completed', completedAt: now, updatedAt: now },
        });

        if (result.matchedCount === 0) {
            return { success: false, error: 'Task not found or permission denied.' };
        }

        revalidatePath('/dashboard/hrm/portal');
        return { success: true };
    } catch (e) {
        console.error('[markTaskComplete] failed:', e);
        return { success: false, error: getErrorMessage(e) };
    }
}

/**
 * Portal KPI strip:
 *  - teamSize          — direct-report count
 *  - pendingTasks      — open tasks assigned to me
 *  - completedThisWeek — tasks I or my reports completed since Mon
 *  - pendingReports    — tasks I assigned that are now Completed
 *                        (awaiting my acknowledgement / review)
 */
export async function getPortalKpis(): Promise<PortalKpis> {
    const session = await getSession();
    if (!session?.user) return { teamSize: 0, pendingTasks: 0, completedThisWeek: 0, pendingReports: 0 };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(String(session.user._id));

        const me = await resolveMyEmployee(String(session.user._id));
        if (!me) return { teamSize: 0, pendingTasks: 0, completedThisWeek: 0, pendingReports: 0 };

        const now = new Date();
        const startOfWeek = new Date(now);
        const day = startOfWeek.getDay(); // 0 = Sun
        startOfWeek.setDate(startOfWeek.getDate() - (day === 0 ? 6 : day - 1));
        startOfWeek.setHours(0, 0, 0, 0);

        const [teamSize, pendingTasks, completedThisWeek, pendingReports] =
            await Promise.all([
                db
                    .collection('crm_employees')
                    .countDocuments({ userId, reportingManagerId: me._id }),
                db
                    .collection('crm_tasks')
                    .countDocuments({ userId, assignedTo: me._id, status: { $ne: 'Completed' } }),
                db.collection('crm_tasks').countDocuments({
                    userId,
                    $or: [{ assignedTo: me._id }, { createdBy: me._id }],
                    status: 'Completed',
                    updatedAt: { $gte: startOfWeek },
                }),
                // FIX: previously this counted completed crm_tasks I created,
                // but the Reports Inbox lives in `hrm_task_reports`. The KPI
                // should reflect *unacknowledged* reports waiting for me as
                // the manager, mirroring the filter used by getReportKpis.
                db.collection('hrm_task_reports').countDocuments({
                    userId,
                    assignerId: String(me._id),
                    $or: [
                        { acknowledgedAt: { $exists: false } },
                        { acknowledgedAt: null },
                    ],
                }),
            ]);

        return { teamSize, pendingTasks, completedThisWeek, pendingReports };
    } catch (e) {
        console.error('[getPortalKpis] failed:', e);
        return { teamSize: 0, pendingTasks: 0, completedThisWeek: 0, pendingReports: 0 };
    }
}
