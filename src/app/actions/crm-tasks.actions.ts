'use server';

/**
 * Task server actions (CRM Sales).
 *
 * Mirrors the leads.actions shape: list + KPI + getById + add + update +
 * status / snooze / assign / complete / archive / delete + bulk.
 *
 * Every mutation writes `crm_audit_log` via `writeAuditEntry({ entityKind: 'task', ... })`.
 * RBAC gates use the `crm_task` module key.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { CrmTask } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { z } from 'zod';
import { writeAuditEntry } from '@/lib/audit-log';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmTasksApi } from '@/lib/rust-client/crm-tasks';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { dispatchAutomations } from '@/lib/automations/dispatch';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

/** Linked entity discriminator — closed enum the form picker depends on. */
export type TaskLinkedKind =
    | 'lead'
    | 'deal'
    | 'client'
    | 'contact'
    | 'ticket'
    | 'invoice'
    | 'none';

const LINKED_KINDS: TaskLinkedKind[] = [
    'lead', 'deal', 'client', 'contact', 'ticket', 'invoice', 'none',
];

function revalidateTaskSurfaces(taskId?: string): void {
    revalidatePath('/dashboard/crm/sales-crm/tasks');
    if (taskId) {
        revalidatePath(`/dashboard/crm/sales-crm/tasks/${taskId}`);
        revalidatePath(`/dashboard/crm/sales-crm/tasks/${taskId}/edit`);
        revalidatePath(`/dashboard/crm/sales-crm/tasks/${taskId}/activity`);
    }
}

/* ─── Validation ──────────────────────────────────────────────────────── */

const taskSchema = z.object({
    title: z.string().min(1, 'Task title is required.'),
    description: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional().nullable()),
    type: z.preprocess(
        (v) => (v === '' ? undefined : v),
        z.string().optional().nullable(),
    ),
    priority: z.preprocess(
        (v) => (v === '' ? undefined : v),
        z.enum(['Low', 'Medium', 'High']).optional().nullable(),
    ),
    status: z.preprocess(
        (v) => (v === '' ? undefined : v),
        z.enum(['To-Do', 'In Progress', 'Completed']).optional().nullable(),
    ),
    dueDate: z.preprocess(
        (v) => (v ? new Date(v as string) : undefined),
        z.date().optional().nullable(),
    ),
    reminders: z.preprocess(
        (v) => {
            if (typeof v !== 'string' || !v) return [];
            return v
                .split(/[,;]\s*/)
                .map((x) => x.trim())
                .filter(Boolean)
                .map((x) => new Date(x))
                .filter((d) => !Number.isNaN(d.getTime()));
        },
        z.array(z.date()).optional(),
    ),
    recurringFrequency: z.preprocess(
        (v) => (v === '' || v == null ? undefined : v),
        z.enum(['daily', 'weekly', 'monthly', 'yearly']).optional().nullable(),
    ),
    recurringEndDate: z.preprocess(
        (v) => (v ? new Date(v as string) : undefined),
        z.date().optional().nullable(),
    ),
    checklist: z.preprocess(
        (v) => {
            if (typeof v !== 'string' || !v) return [];
            return v
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean)
                .map((label) => ({ label, done: false }));
        },
        z.array(z.object({ label: z.string(), done: z.boolean() })).optional(),
    ),
    attachments: z.preprocess(
        (v) => {
            if (typeof v !== 'string' || !v) return [];
            try {
                const parsed = JSON.parse(v);
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [];
            }
        },
        z.array(z.unknown()).optional(),
    ),
});

/* ─── Filters / KPIs ──────────────────────────────────────────────────── */

export interface CrmTaskListFilters {
    query?: string;
    status?: string | string[];
    priority?: string | string[];
    type?: string | string[];
    assignedTo?: string;
    linkedKind?: TaskLinkedKind;
    linkedId?: string;
    dueAfter?: string | Date;
    dueBefore?: string | Date;
}

export interface CrmTaskKpis {
    total: number;
    open: number;
    overdue: number;
    dueToday: number;
    completedThisWeek: number;
}

const EMPTY_KPIS: CrmTaskKpis = {
    total: 0,
    open: 0,
    overdue: 0,
    dueToday: 0,
    completedThisWeek: 0,
};

/* ─── Reads ───────────────────────────────────────────────────────────── */

export async function getCrmTasks(
    page: number = 1,
    limit: number = 20,
    query?: string,
    filters: CrmTaskListFilters = {},
): Promise<{ tasks: WithId<CrmTask>[]; total: number }> {
    const session = await getSession();
    if (!session?.user) return { tasks: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const filter: Record<string, unknown> = { userId };
        const text = (query ?? filters.query ?? '').trim();
        if (text) {
            const rgx = { $regex: text, $options: 'i' };
            filter.$or = [{ title: rgx }, { description: rgx }];
        }
        if (filters.status) {
            (filter as any).status = Array.isArray(filters.status)
                ? { $in: filters.status }
                : filters.status;
        }
        if (filters.priority) {
            (filter as any).priority = Array.isArray(filters.priority)
                ? { $in: filters.priority }
                : filters.priority;
        }
        if (filters.type) {
            (filter as any).type = Array.isArray(filters.type)
                ? { $in: filters.type }
                : filters.type;
        }
        if (filters.assignedTo && ObjectId.isValid(filters.assignedTo)) {
            (filter as any).assignedTo = new ObjectId(filters.assignedTo);
        }
        if (filters.linkedKind && filters.linkedKind !== 'none') {
            (filter as any).linkedKind = filters.linkedKind;
            if (filters.linkedId && ObjectId.isValid(filters.linkedId)) {
                (filter as any).linkedId = new ObjectId(filters.linkedId);
            }
        }
        if (filters.dueAfter || filters.dueBefore) {
            (filter as any).dueDate = {} as Record<string, Date>;
            if (filters.dueAfter)
                ((filter as any).dueDate as any).$gte = new Date(filters.dueAfter);
            if (filters.dueBefore)
                ((filter as any).dueDate as any).$lte = new Date(filters.dueBefore);
        }

        const skip = Math.max(0, (page - 1) * limit);

        const [tasks, total] = await Promise.all([
            db
                .collection<CrmTask>('crm_tasks')
                .find(filter as any)
                .sort({ dueDate: 1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            db.collection('crm_tasks').countDocuments(filter as any),
        ]);

        return { tasks: JSON.parse(JSON.stringify(tasks)), total };
    } catch (e) {
        console.error('[getCrmTasks] failed:', e);
        return { tasks: [], total: 0 };
    }
}

export async function getCrmTaskKpis(): Promise<CrmTaskKpis> {
    const session = await getSession();
    if (!session?.user) return EMPTY_KPIS;

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(
            startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1,
        );
        const startOfWeek = new Date(startOfToday);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

        const [total, open, overdue, dueToday, completedThisWeek] = await Promise.all([
            db.collection('crm_tasks').countDocuments({ userId } as any),
            db
                .collection('crm_tasks')
                .countDocuments({ userId, status: { $ne: 'Completed' } } as any),
            db.collection('crm_tasks').countDocuments({
                userId,
                status: { $ne: 'Completed' },
                dueDate: { $lt: startOfToday },
            } as any),
            db.collection('crm_tasks').countDocuments({
                userId,
                status: { $ne: 'Completed' },
                dueDate: { $gte: startOfToday, $lte: endOfToday },
            } as any),
            db.collection('crm_tasks').countDocuments({
                userId,
                status: 'Completed',
                updatedAt: { $gte: startOfWeek },
            } as any),
        ]);

        return { total, open, overdue, dueToday, completedThisWeek };
    } catch (e) {
        console.error('[getCrmTaskKpis] failed:', e);
        return EMPTY_KPIS;
    }
}

export async function getCrmTaskById(
    taskId: string,
): Promise<WithId<CrmTask> | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!taskId || !ObjectId.isValid(taskId)) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmTasksApi.getById(taskId);
            return JSON.parse(JSON.stringify(doc));
        } catch (e) {
            console.error('[getCrmTaskById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'task',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const task = await db.collection<CrmTask>('crm_tasks').findOne({
            _id: new ObjectId(taskId),
            userId: new ObjectId(session.user._id),
        });
        if (!task) return null;
        return JSON.parse(JSON.stringify(task));
    } catch (e) {
        console.error('[getCrmTaskById] failed:', e);
        return null;
    }
}

/** Related tasks on the same linked entity (excluding the current task). */
export async function getCrmTasksByLinkedEntity(
    linkedKind: TaskLinkedKind,
    linkedId: string,
    excludeId?: string,
): Promise<WithId<CrmTask>[]> {
    const session = await getSession();
    if (!session?.user) return [];
    if (!linkedKind || linkedKind === 'none') return [];
    if (!linkedId || !ObjectId.isValid(linkedId)) return [];

    try {
        const { db } = await connectToDatabase();
        const filter: Record<string, unknown> = {
            userId: new ObjectId(session.user._id),
            linkedKind,
            linkedId: new ObjectId(linkedId),
        };
        if (excludeId && ObjectId.isValid(excludeId)) {
            (filter as any)._id = { $ne: new ObjectId(excludeId) };
        }
        const docs = await db
            .collection<CrmTask>('crm_tasks')
            .find(filter as any)
            .sort({ dueDate: 1, createdAt: -1 })
            .limit(10)
            .toArray();
        return JSON.parse(JSON.stringify(docs));
    } catch (e) {
        console.error('[getCrmTasksByLinkedEntity] failed:', e);
        return [];
    }
}

/* ─── Writes ──────────────────────────────────────────────────────────── */

export async function createCrmTask(
    prevState: unknown,
    formData: FormData,
): Promise<{ message?: string; error?: string; taskId?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const rawData = {
        title: formData.get('title'),
        description: formData.get('description'),
        type: formData.get('type'),
        priority: formData.get('priority'),
        status: formData.get('status'),
        dueDate: formData.get('dueDate') || undefined,
        reminders: formData.get('reminders'),
        recurringFrequency: formData.get('recurringFrequency'),
        recurringEndDate: formData.get('recurringEndDate') || undefined,
        checklist: formData.get('checklist'),
        attachments: formData.get('attachments'),
    };
    const parsed = taskSchema.safeParse(rawData);
    if (!parsed.success) {
        const flat = parsed.error.flatten().fieldErrors;
        const msg = Object.entries(flat).map(([k, v]) => `${k}: ${v?.join(', ')}`).join('; ');
        return { error: `Invalid data provided. Errors: ${msg}` };
    }

    try {
        const { db } = await connectToDatabase();
        const linkedKindRaw = String(formData.get('linkedKind') ?? '');
        const linkedKind: TaskLinkedKind = LINKED_KINDS.includes(
            linkedKindRaw as TaskLinkedKind,
        )
            ? (linkedKindRaw as TaskLinkedKind)
            : 'none';
        const linkedIdRaw = String(formData.get('linkedId') ?? '');
        const assignedToRaw = String(formData.get('assignedTo') ?? '');

        const intent = String(formData.get('intent') ?? 'save');

        const newDoc: Record<string, unknown> = {
            userId: new ObjectId(session.user._id),
            createdAt: new Date(),
            updatedAt: new Date(),
            title: parsed.data.title,
            description: parsed.data.description ?? undefined,
            type: parsed.data.type ?? 'Follow-up',
            priority: parsed.data.priority ?? 'Medium',
            status: intent === 'save_complete'
                ? 'Completed'
                : (parsed.data.status ?? 'To-Do'),
            dueDate: parsed.data.dueDate ?? undefined,
            reminders: parsed.data.reminders ?? [],
            recurring:
                parsed.data.recurringFrequency
                    ? {
                          frequency: parsed.data.recurringFrequency,
                          endDate: parsed.data.recurringEndDate ?? null,
                      }
                    : undefined,
            checklist: parsed.data.checklist ?? [],
            attachments: parsed.data.attachments ?? [],
            createdBy: new ObjectId(session.user._id),
        };

        if (assignedToRaw && ObjectId.isValid(assignedToRaw)) {
            newDoc.assignedTo = new ObjectId(assignedToRaw);
        } else {
            // Default assignee = current user.
            newDoc.assignedTo = new ObjectId(session.user._id);
        }

        // Linked entity discriminator + id (kept polymorphic; the action-side
        // mirrors legacy contactId/dealId for backwards compat with the older
        // crm-tasks consumers).
        if (linkedKind !== 'none' && linkedIdRaw && ObjectId.isValid(linkedIdRaw)) {
            newDoc.linkedKind = linkedKind;
            newDoc.linkedId = new ObjectId(linkedIdRaw);
            if (linkedKind === 'contact') newDoc.contactId = new ObjectId(linkedIdRaw);
            if (linkedKind === 'deal') newDoc.dealId = new ObjectId(linkedIdRaw);
        }

        const result = await db.collection('crm_tasks').insertOne(newDoc as any);

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'create',
            entityKind: 'task',
            entityId: String(result.insertedId),
            reason: intent === 'save_complete' ? 'created-as-completed' : undefined,
        });

        revalidateTaskSurfaces(result.insertedId.toString());
        // Fire automations (best-effort).
        try {
            await dispatchAutomations({
                type: 'entity_created',
                entityKind: 'task',
                entityId: result.insertedId.toString(),
                tenantUserId: String(session.user._id),
                entity: { ...newDoc, _id: result.insertedId },
                occurredAt: Date.now(),
            });
        } catch (err) {
            console.warn('[createCrmTask] automation dispatch failed (non-fatal):', err);
        }
        return { message: 'Task created.', taskId: result.insertedId.toString() };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function updateCrmTask(
    prevState: unknown,
    formData: FormData,
): Promise<{ message?: string; error?: string; taskId?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const taskId = String(formData.get('taskId') ?? '');
    if (!taskId || !ObjectId.isValid(taskId)) {
        return { error: 'Invalid task id.' };
    }

    const rawData = {
        title: formData.get('title'),
        description: formData.get('description'),
        type: formData.get('type'),
        priority: formData.get('priority'),
        status: formData.get('status'),
        dueDate: formData.get('dueDate') || undefined,
        reminders: formData.get('reminders'),
        recurringFrequency: formData.get('recurringFrequency'),
        recurringEndDate: formData.get('recurringEndDate') || undefined,
        checklist: formData.get('checklist'),
        attachments: formData.get('attachments'),
    };
    const parsed = taskSchema.safeParse(rawData);
    if (!parsed.success) {
        const flat = parsed.error.flatten().fieldErrors;
        const msg = Object.entries(flat).map(([k, v]) => `${k}: ${v?.join(', ')}`).join('; ');
        return { error: `Invalid data provided. Errors: ${msg}` };
    }

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const linkedKindRaw = String(formData.get('linkedKind') ?? '');
        const linkedKind: TaskLinkedKind = LINKED_KINDS.includes(
            linkedKindRaw as TaskLinkedKind,
        )
            ? (linkedKindRaw as TaskLinkedKind)
            : 'none';
        const linkedIdRaw = String(formData.get('linkedId') ?? '');
        const assignedToRaw = String(formData.get('assignedTo') ?? '');

        const before = await db.collection('crm_tasks').findOne({
            _id: new ObjectId(taskId),
            userId,
        });
        if (!before) return { error: 'Task not found.' };

        const set: Record<string, unknown> = {
            title: parsed.data.title,
            description: parsed.data.description ?? undefined,
            type: parsed.data.type ?? 'Follow-up',
            priority: parsed.data.priority ?? 'Medium',
            status: parsed.data.status ?? 'To-Do',
            dueDate: parsed.data.dueDate ?? undefined,
            reminders: parsed.data.reminders ?? [],
            recurring: parsed.data.recurringFrequency
                ? {
                      frequency: parsed.data.recurringFrequency,
                      endDate: parsed.data.recurringEndDate ?? null,
                  }
                : null,
            attachments: parsed.data.attachments ?? [],
            updatedAt: new Date(),
        };
        // Only replace checklist if the form supplied one — preserves per-item
        // `done` flips that came from the detail-page interactive checkbox.
        if (parsed.data.checklist && parsed.data.checklist.length > 0) {
            set.checklist = parsed.data.checklist;
        }

        if (assignedToRaw && ObjectId.isValid(assignedToRaw)) {
            set.assignedTo = new ObjectId(assignedToRaw);
        }

        const unset: Record<string, unknown> = {};
        if (linkedKind === 'none') {
            unset.linkedKind = '';
            unset.linkedId = '';
        } else if (linkedIdRaw && ObjectId.isValid(linkedIdRaw)) {
            set.linkedKind = linkedKind;
            set.linkedId = new ObjectId(linkedIdRaw);
        }

        const mongoOp: Record<string, unknown> = { $set: set };
        if (Object.keys(unset).length) mongoOp.$unset = unset;

        const result = await db.collection('crm_tasks').updateOne(
            { _id: new ObjectId(taskId), userId },
            mongoOp,
        );
        if (result.matchedCount === 0) return { error: 'Task not found.' };

        const diff: Record<string, { before?: unknown; after?: unknown }> = {};
        for (const [k, after] of Object.entries(set)) {
            const beforeV = (before as Record<string, unknown>)[k];
            if (JSON.stringify(beforeV) !== JSON.stringify(after)) {
                diff[k] = { before: beforeV, after };
            }
        }

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'update',
            entityKind: 'task',
            entityId: taskId,
            diff: Object.keys(diff).length ? diff : undefined,
        });

        revalidateTaskSurfaces(taskId);
        return { message: 'Task updated.', taskId };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function updateCrmTaskStatus(
    taskId: string,
    status: CrmTask['status'],
): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(taskId)) return { success: false, error: 'Invalid Task ID.' };
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const before = await db.collection('crm_tasks').findOne({ _id: new ObjectId(taskId), userId });
        if (!before) return { success: false, error: 'Task not found.' };

        await db.collection('crm_tasks').updateOne(
            { _id: new ObjectId(taskId), userId },
            { $set: { status, updatedAt: new Date() } },
        );

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'status_change',
            entityKind: 'task',
            entityId: taskId,
            diff: { status: { before: (before as any).status, after: status } },
        });

        revalidateTaskSurfaces(taskId);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function completeCrmTask(
    taskId: string,
): Promise<{ success: boolean; error?: string }> {
    return updateCrmTaskStatus(taskId, 'Completed');
}

/** Snooze a task by pushing its dueDate forward by N hours. */
export async function snoozeCrmTask(
    taskId: string,
    hours: number,
): Promise<{ success: boolean; error?: string; newDueDate?: string }> {
    if (!ObjectId.isValid(taskId)) return { success: false, error: 'Invalid Task ID.' };
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!Number.isFinite(hours) || hours <= 0) {
        return { success: false, error: 'Snooze duration must be a positive number of hours.' };
    }

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const existing = await db.collection('crm_tasks').findOne({
            _id: new ObjectId(taskId),
            userId,
        });
        if (!existing) return { success: false, error: 'Task not found.' };

        const base = (existing as any).dueDate
            ? new Date((existing as any).dueDate)
            : new Date();
        const next = new Date(base.getTime() + hours * 60 * 60 * 1000);

        await db.collection('crm_tasks').updateOne(
            { _id: new ObjectId(taskId), userId },
            { $set: { dueDate: next, updatedAt: new Date() } },
        );

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'snooze',
            entityKind: 'task',
            entityId: taskId,
            reason: `+${hours}h`,
            diff: { dueDate: { before: (existing as any).dueDate, after: next } },
        });

        revalidateTaskSurfaces(taskId);
        return { success: true, newDueDate: next.toISOString() };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function assignCrmTask(
    taskId: string,
    userId: string | null,
): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(taskId)) return { success: false, error: 'Invalid Task ID.' };
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    try {
        const { db } = await connectToDatabase();
        const tenantId = new ObjectId(session.user._id);
        const set: Record<string, unknown> = { updatedAt: new Date() };
        const unset: Record<string, unknown> = {};
        if (userId && ObjectId.isValid(userId)) {
            set.assignedTo = new ObjectId(userId);
        } else {
            unset.assignedTo = '';
        }
        const mongoOp: Record<string, unknown> = { $set: set };
        if (Object.keys(unset).length) mongoOp.$unset = unset;
        const result = await db.collection('crm_tasks').updateOne(
            { _id: new ObjectId(taskId), userId: tenantId },
            mongoOp,
        );
        if (result.matchedCount === 0) return { success: false, error: 'Task not found.' };

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'assign',
            entityKind: 'task',
            entityId: taskId,
            reason: userId || 'unassigned',
        });

        // Notify the assignee via the `task_assigned` template (if a user
        // was actually assigned, and we can resolve their email).
        if (userId && ObjectId.isValid(userId)) {
            try {
                const [task, assignee] = await Promise.all([
                    db.collection('crm_tasks').findOne(
                        { _id: new ObjectId(taskId), userId: tenantId },
                        { projection: { title: 1, dueDate: 1 } },
                    ),
                    db.collection('users').findOne(
                        { _id: new ObjectId(userId) },
                        { projection: { email: 1, name: 1 } },
                    ),
                ]);
                if (assignee?.email) {
                    const { dispatchTransactionalEmail } = await import(
                        '@/lib/email-dispatcher'
                    );
                    const { renderEffectiveTemplate } = await import(
                        '@/lib/email-templates/render'
                    );
                    const rendered = await renderEffectiveTemplate(
                        String(session.user._id),
                        'task_assigned',
                        {
                            assigneeName: (assignee.name as string | undefined) ?? '',
                            assignerName: session.user.name ?? '',
                            taskTitle: (task?.title as string | undefined) ?? '',
                            dueDate: task?.dueDate
                                ? new Date(task.dueDate as string | Date)
                                      .toISOString()
                                      .slice(0, 10)
                                : '',
                            taskUrl: `/dashboard/crm/tasks/${taskId}`,
                        },
                    );
                    await dispatchTransactionalEmail({
                        tenantUserId: String(session.user._id),
                        to: assignee.email as string,
                        subject: rendered.subject,
                        html: rendered.html,
                        templateId: 'event:task_assigned',
                    });
                }
            } catch (notifyErr) {
                console.warn('[crm-tasks] task_assigned notify failed', notifyErr);
            }
        }

        revalidateTaskSurfaces(taskId);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/** Toggle one checklist item by index. Persists immediately. */
export async function toggleCrmTaskChecklist(
    taskId: string,
    index: number,
    done: boolean,
): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(taskId)) return { success: false, error: 'Invalid Task ID.' };
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!Number.isInteger(index) || index < 0) {
        return { success: false, error: 'Invalid checklist index.' };
    }

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const set: Record<string, unknown> = {
            [`checklist.${index}.done`]: !!done,
            updatedAt: new Date(),
        };
        const result = await db.collection('crm_tasks').updateOne(
            { _id: new ObjectId(taskId), userId },
            { $set: set },
        );
        if (result.matchedCount === 0) return { success: false, error: 'Task not found.' };

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'update',
            entityKind: 'task',
            entityId: taskId,
            reason: `checklist[${index}]=${done ? 'done' : 'todo'}`,
        });

        revalidateTaskSurfaces(taskId);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function bulkCrmTaskAction(
    taskIds: string[],
    op: 'complete' | 'delete' | 'snooze_day' | 'snooze_week' | 'assign' | 'status',
    payload?: string,
): Promise<{ success: boolean; processed: number; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, processed: 0, error: 'Access denied' };

    const ids = (taskIds ?? []).filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
    if (ids.length === 0) {
        return { success: false, processed: 0, error: 'No valid tasks selected.' };
    }

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const baseFilter = { _id: { $in: ids }, userId } as any;

        let processed = 0;
        if (op === 'delete') {
            const r = await db.collection('crm_tasks').deleteMany(baseFilter);
            processed = r.deletedCount ?? 0;
        } else if (op === 'complete') {
            const r = await db
                .collection('crm_tasks')
                .updateMany(baseFilter, { $set: { status: 'Completed', updatedAt: new Date() } });
            processed = r.modifiedCount ?? 0;
        } else if (op === 'snooze_day' || op === 'snooze_week') {
            const hours = op === 'snooze_day' ? 24 : 24 * 7;
            // Per-row snooze so dueDate offsets the existing value.
            const docs = await db.collection('crm_tasks').find(baseFilter).toArray();
            for (const d of docs) {
                const base = (d as any).dueDate ? new Date((d as any).dueDate) : new Date();
                const next = new Date(base.getTime() + hours * 60 * 60 * 1000);
                await db
                    .collection('crm_tasks')
                    .updateOne(
                        { _id: (d as any)._id, userId },
                        { $set: { dueDate: next, updatedAt: new Date() } },
                    );
                processed += 1;
            }
        } else if (op === 'assign') {
            if (!payload || !ObjectId.isValid(payload)) {
                return { success: false, processed: 0, error: 'Pick an assignee.' };
            }
            const r = await db
                .collection('crm_tasks')
                .updateMany(baseFilter, {
                    $set: { assignedTo: new ObjectId(payload), updatedAt: new Date() },
                });
            processed = r.modifiedCount ?? 0;
        } else if (op === 'status') {
            const status = String(payload ?? '').trim();
            if (!status) return { success: false, processed: 0, error: 'Status is required.' };
            const r = await db
                .collection('crm_tasks')
                .updateMany(baseFilter, { $set: { status, updatedAt: new Date() } });
            processed = r.modifiedCount ?? 0;
        }

        for (const id of ids) {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action:
                    op === 'delete'
                        ? 'delete'
                        : op === 'assign'
                        ? 'assign'
                        : op === 'status'
                        ? 'status_change'
                        : op === 'complete'
                        ? 'status_change'
                        : 'snooze',
                entityKind: 'task',
                entityId: String(id),
                reason: payload ? `bulk:${op}:${payload}` : `bulk:${op}`,
            });
        }

        revalidateTaskSurfaces();
        return { success: true, processed };
    } catch (e: any) {
        return { success: false, processed: 0, error: getErrorMessage(e) };
    }
}

export async function deleteCrmTask(
    taskId: string,
): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(taskId)) return { success: false, error: 'Invalid Task ID.' };
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const result = await db.collection('crm_tasks').deleteOne({
            _id: new ObjectId(taskId),
            userId,
        });
        if (result.deletedCount === 0) return { success: false, error: 'Task not found.' };

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'delete',
            entityKind: 'task',
            entityId: taskId,
        });

        revalidateTaskSurfaces(taskId);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}
