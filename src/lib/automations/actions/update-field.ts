/**
 * `update_field` action handler.
 *
 * Patches one top-level field on the triggering entity. Implementation
 * is intentionally narrow — nested dotted paths, conditional updates,
 * and computed values are out of scope for the MVP.
 *
 * Safety: we refuse to touch a small allow-list of "sensitive" fields
 * (userId, _id, createdAt) to prevent automations from silently breaking
 * tenancy or audit trails.
 */

import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { writeAuditEntry } from '@/lib/audit-log';

import type { UpdateFieldActionConfig, AutomationEntityKind } from '../types';
import type { ActionContext } from './index';

const SENSITIVE_FIELDS = new Set([
    '_id',
    'userId',
    'createdAt',
    'lineage',
    'audit',
]);

const ENTITY_COLLECTION: Record<AutomationEntityKind, string | null> = {
    lead: 'crm_leads',
    deal: 'crm_deals',
    task: 'crm_tasks',
    contact: 'crm_contacts',
    account: 'crm_accounts',
    invoice: 'crm_invoices',
    form_submission: 'crm_form_submissions',
};

export async function updateFieldAction(
    cfg: UpdateFieldActionConfig,
    ctx: ActionContext,
): Promise<string> {
    if (!cfg.field) throw new Error('update_field: field is required');
    if (SENSITIVE_FIELDS.has(cfg.field)) {
        throw new Error(
            `update_field: refusing to overwrite protected field "${cfg.field}"`,
        );
    }

    const collection = ENTITY_COLLECTION[ctx.event.entityKind];
    if (!collection) {
        throw new Error(
            `update_field: no Mongo collection mapping for entityKind "${ctx.event.entityKind}"`,
        );
    }

    if (!ObjectId.isValid(ctx.event.entityId)) {
        throw new Error('update_field: invalid entityId');
    }
    if (!ObjectId.isValid(ctx.automation.userId)) {
        throw new Error('update_field: invalid tenant userId');
    }

    const { db } = await connectToDatabase();
    const filter = {
        _id: new ObjectId(ctx.event.entityId),
        userId: new ObjectId(ctx.automation.userId),
    };

    const update = {
        $set: {
            [cfg.field]: cfg.value,
            updatedAt: new Date(),
        },
    };

    const result = await db.collection(collection).updateOne(filter, update);
    if (result.matchedCount === 0) {
        throw new Error(
            `update_field: entity ${ctx.event.entityKind}/${ctx.event.entityId} not found for tenant`,
        );
    }

    try {
        await writeAuditEntry({
            tenantUserId: ctx.automation.userId,
            actorId: ctx.automation.userId,
            action: 'update',
            entityKind: ctx.event.entityKind,
            entityId: ctx.event.entityId,
            diff: { [cfg.field]: { after: cfg.value } },
            reason: `automation:${ctx.automation._id}`,
        });
    } catch {
        /* non-fatal */
    }

    return `Set ${ctx.event.entityKind}.${cfg.field} on ${ctx.event.entityId}`;
}
