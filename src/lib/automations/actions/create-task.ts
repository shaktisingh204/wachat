/**
 * `create_task` action handler.
 *
 * Writes a `crm_tasks` row directly. We could route through
 * `createCrmTask` from `crm-tasks.actions.ts`, but that action expects a
 * FormData payload built by the UI and a real session — not a fit for
 * background workflow execution. The shape we write matches the
 * createCrmTask insert (see crm-tasks.actions.ts:379) so reads via the
 * existing list/detail actions Just Work.
 */

import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { writeAuditEntry } from '@/lib/audit-log';

import type { CreateTaskActionConfig } from '../types';
import type { ActionContext } from './index';

export async function createTaskAction(
    cfg: CreateTaskActionConfig,
    ctx: ActionContext,
): Promise<string> {
    if (!cfg.title) throw new Error('create_task: title is required');

    const { db } = await connectToDatabase();

    const userIdRaw = ctx.automation.userId;
    if (!userIdRaw || !ObjectId.isValid(userIdRaw)) {
        throw new Error('create_task: tenant userId is missing or invalid');
    }
    const userId = new ObjectId(userIdRaw);

    const now = new Date();
    const dueDate = typeof cfg.dueInDays === 'number'
        ? new Date(now.getTime() + cfg.dueInDays * 24 * 60 * 60 * 1000)
        : undefined;

    const assignedTo = cfg.assignedTo && ObjectId.isValid(cfg.assignedTo)
        ? new ObjectId(cfg.assignedTo)
        : userId;

    const linkedKind = cfg.linkedKind ?? deriveLinkedKind(ctx);
    const linkedIdStr = cfg.linkedId ?? ctx.event.entityId;
    const linkedId = ObjectId.isValid(linkedIdStr) ? new ObjectId(linkedIdStr) : undefined;

    const doc: Record<string, unknown> = {
        userId,
        createdAt: now,
        updatedAt: now,
        title: renderTemplate(cfg.title, ctx),
        description: cfg.description ? renderTemplate(cfg.description, ctx) : undefined,
        type: cfg.type ?? 'Follow-up',
        priority: cfg.priority ?? 'Medium',
        status: 'To-Do',
        dueDate,
        assignedTo,
        createdBy: userId,
        // Tag the task with its origin so operators can debug.
        source: {
            kind: 'automation',
            automationId: ctx.automation._id,
            entityKind: ctx.event.entityKind,
            entityId: ctx.event.entityId,
        },
    };

    if (linkedKind && linkedId) {
        doc.linkedKind = linkedKind;
        doc.linkedId = linkedId;
        if (linkedKind === 'contact') doc.contactId = linkedId;
        if (linkedKind === 'deal') doc.dealId = linkedId;
    }

    const result = await db.collection('crm_tasks').insertOne(doc);

    try {
        await writeAuditEntry({
            tenantUserId: userIdRaw,
            actorId: userIdRaw,
            action: 'create',
            entityKind: 'task',
            entityId: result.insertedId.toString(),
            reason: `automation:${ctx.automation._id}`,
        });
    } catch {
        /* non-fatal */
    }

    return `Created task ${result.insertedId.toString()} ("${doc.title}")`;
}

function deriveLinkedKind(
    ctx: ActionContext,
): 'lead' | 'deal' | 'contact' | undefined {
    switch (ctx.event.entityKind) {
        case 'lead':
            return 'lead';
        case 'deal':
            return 'deal';
        case 'contact':
            return 'contact';
        default:
            return undefined;
    }
}

function renderTemplate(tpl: string, ctx: ActionContext): string {
    if (!tpl) return '';
    return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => {
        const segs = String(path).split('.');
        let cur: unknown = ctx.entity;
        for (const seg of segs) {
            if (cur == null || typeof cur !== 'object') {
                cur = undefined;
                break;
            }
            cur = (cur as Record<string, unknown>)[seg];
        }
        return cur == null ? '' : String(cur);
    });
}
