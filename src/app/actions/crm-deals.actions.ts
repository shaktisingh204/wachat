'use server';

/**
 * CRM Deal server actions.
 *
 * **Dual implementation:**
 *  - When `USE_RUST_CRM === 'true'`, the core mutations delegate to the Rust
 *    BFF (`/v1/crm/deals`) via `src/lib/rust-client/crm-deals.ts`.
 *  - Otherwise (default), the legacy direct-Mongo path runs.
 *
 * Export shapes are identical across both paths so existing consumer pages
 * keep working without changes.
 */

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { CrmDeal, CrmContact, CrmAccount, User, CrmTask, LineageKind, LineageRef } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { getDealStagesForIndustry } from '@/lib/crm-industry-stages';
import { appendLineage, buildLineageFromParent } from '@/lib/lineage';
import { applyCustomFieldsToEntity } from '@/app/actions/worksuite/meta.actions';
import { requirePermission } from '@/lib/rbac-server';
import { writeAuditEntry } from '@/lib/audit-log';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmDealsApi, type CrmDealDoc, type CrmDealCreateInput, type CrmDealUpdateInput } from '@/lib/rust-client/crm-deals';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { dispatchAutomations } from '@/lib/automations/dispatch';
import { sendSlackNotification } from '@/lib/integrations/slack';

async function maybeNotifySlackDealWon(
    dealId: string,
    newStage: string,
    fallbackName?: string,
    fallbackValue?: number | string,
    fallbackCurrency?: string,
): Promise<void> {
    if ((newStage || '').toLowerCase() !== 'won' && (newStage || '').toLowerCase() !== 'closed-won' && (newStage || '').toLowerCase() !== 'closed_won') {
        return;
    }
    try {
        let name = fallbackName ?? 'Deal';
        let value: number | string | undefined = fallbackValue;
        let currency = fallbackCurrency ?? 'INR';
        if (ObjectId.isValid(dealId)) {
            const { db } = await connectToDatabase();
            const doc = await db.collection('crm_deals').findOne(
                { _id: new ObjectId(dealId) },
                { projection: { name: 1, title: 1, value: 1, amount: 1, currency: 1 } as any },
            );
            if (doc) {
                name = (doc as any).name ?? (doc as any).title ?? name;
                value = (doc as any).value ?? (doc as any).amount ?? value;
                currency = (doc as any).currency ?? currency;
            }
        }
        const valStr = typeof value === 'number' || typeof value === 'string'
            ? `${currency} ${value}`
            : 'value unknown';
        await sendSlackNotification(`Deal won: ${name} - ${valStr}`);
    } catch (err) {
        console.warn('[crm-deals] slack notify (won) failed:', err);
    }
}

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

function revalidateDealSurfaces(dealId?: string): void {
    revalidatePath('/dashboard/crm/sales-crm/deals');
    revalidatePath('/dashboard/crm/deals');
    if (dealId) {
        revalidatePath(`/dashboard/crm/sales-crm/deals/${dealId}`);
        revalidatePath(`/dashboard/crm/sales-crm/deals/${dealId}/edit`);
        revalidatePath(`/dashboard/crm/sales-crm/deals/${dealId}/activity`);
    }
}

/* ─── Rust-shape → legacy TS-shape adapter ────────────────────────────── */

function rustDocToLegacy(doc: CrmDealDoc): WithId<CrmDeal> {
    const partyId = doc.party?.id;
    const ownerRaw = doc.ownerId;
    const out: any = {
        ...(doc as unknown as Record<string, unknown>),
        _id: doc._id ? (doc._id as unknown as ObjectId) : (undefined as unknown as ObjectId),
        userId: (doc.identity?.userId ?? '') as unknown as ObjectId,
        name: doc.title,
        value: doc.amount ?? 0,
        currency: doc.currency ?? 'INR',
        stage: doc.stageId ?? doc.status,
        probability: doc.probabilityPct,
        closeDate: doc.expectedClose ? new Date(doc.expectedClose) : undefined,
        accountId:
            doc.party?.kind === 'client' && partyId && ObjectId.isValid(partyId)
                ? (new ObjectId(partyId) as unknown as ObjectId)
                : undefined,
        assignedTo:
            typeof ownerRaw === 'string' && ObjectId.isValid(ownerRaw)
                ? (new ObjectId(ownerRaw) as unknown as ObjectId)
                : undefined,
        createdAt: doc.createdAt ? new Date(doc.createdAt) : doc.audit?.createdAt ? new Date(doc.audit.createdAt) : new Date(),
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt) : doc.audit?.updatedAt ? new Date(doc.audit.updatedAt) : undefined,
    };
    return out as WithId<CrmDeal>;
}

export async function getCrmDeals(
    page: number = 1,
    limit: number = 20,
    query?: string
): Promise<{ deals: WithId<CrmDeal>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { deals: [], total: 0 };

    const guard = await requirePermission('crm_deal', 'view');
    if (!guard.ok) return { deals: [], total: 0 };

    if (useRustCrm()) {
        try {
            const resp = await crmDealsApi.list({
                page: Math.max(0, page - 1),
                limit,
                q: query || undefined,
            });
            return {
                deals: (resp.deals ?? []).map(rustDocToLegacy),
                total: resp.total ?? (resp.deals ?? []).length,
            };
        } catch (e) {
            console.error('[getCrmDeals] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'deal', op: 'list', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const filter: any = { userId: userObjectId };
        if (query) {
            const queryRegex = { $regex: query, $options: 'i' };

            const matchingContacts = await db.collection('crm_contacts').find({ userId: userObjectId, name: queryRegex }).project({ _id: 1 }).toArray();
            const contactIds = matchingContacts.map(c => c._id);

            const matchingAccounts = await db.collection('crm_accounts').find({ userId: userObjectId, name: queryRegex }).project({ _id: 1 }).toArray();
            const accountIds = matchingAccounts.map(a => a._id);

            filter.$or = [
                { name: queryRegex },
                { contactIds: { $in: contactIds } },
                { accountId: { $in: accountIds } }
            ];
        }

        const skip = (page - 1) * limit;

        const [deals, total] = await Promise.all([
            db.collection<CrmDeal>('crm_deals').find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
            db.collection('crm_deals').countDocuments(filter)
        ]);

        return {
            deals: JSON.parse(JSON.stringify(deals)),
            total
        };
    } catch (e: any) {
        console.error("Failed to fetch CRM deals:", e);
        return { deals: [], total: 0 };
    }
}

export async function getCrmDealById(dealId: string): Promise<WithId<CrmDeal> | null> {
    if (!dealId) return null;

    const session = await getSession();
    if (!session?.user) return null;

    const guard = await requirePermission('crm_deal', 'view');
    if (!guard.ok) return null;

    if (useRustCrm()) {
        try {
            const resp = await crmDealsApi.getById(dealId);
            const deal = resp?.deal;
            return deal ? rustDocToLegacy(deal) : null;
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) return null;
            console.error('[getCrmDealById] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'deal', op: 'get', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    if (!ObjectId.isValid(dealId)) return null;

    try {
        const { db } = await connectToDatabase();
        const deal = await db.collection<CrmDeal>('crm_deals').findOne({
            _id: new ObjectId(dealId),
            userId: new ObjectId(session.user._id)
        });

        return deal ? JSON.parse(JSON.stringify(deal)) : null;
    } catch (e) {
        return null;
    }
}

export async function createCrmDeal(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied" };

    const guard = await requirePermission('crm_deal', 'create');
    if (!guard.ok) return { error: guard.error };

    const dealName = formData.get('name') as string;
    const dealStage = formData.get('stage') as string;
    const dealValueRaw = formData.get('value');
    const dealValue = Number(dealValueRaw);
    if (!dealName || !dealStage || isNaN(dealValue)) {
        return { error: 'Deal Name, Stage, and Value are required.' };
    }

    if (useRustCrm()) {
        try {
            const accountId = formData.get('accountId') as string | null;
            const contactId = formData.get('contactId') as string | null;
            const closeDate = (formData.get('closeDate') as string | null) || undefined;
            const probabilityRaw = formData.get('probability') as string | null;
            const fromKind = (formData.get('fromKind') as string | null) || undefined;
            const fromId = (formData.get('fromId') as string | null) || undefined;

            const partyId = (accountId && ObjectId.isValid(accountId))
                ? accountId
                : (contactId && ObjectId.isValid(contactId))
                  ? contactId
                  : '';
            const partyKind: 'client' | 'lead' = fromKind === 'lead' ? 'lead' : 'client';

            const input: CrmDealCreateInput = {
                title: dealName,
                pipelineId: (formData.get('pipelineId') as string | null) || '',
                stageId: dealStage,
                ownerId: String(session.user._id),
                party: { kind: partyKind, id: partyId },
                amount: dealValue,
                currency: (formData.get('currency') as string | null) || 'INR',
                probabilityPct:
                    typeof probabilityRaw === 'string' && probabilityRaw.trim() !== ''
                        ? Number(probabilityRaw)
                        : undefined,
                expectedClose: closeDate ?? new Date().toISOString(),
                status: dealStage,
                wonLostReason: (formData.get('lossReason') as string | null) || undefined,
                fromKind: fromKind || undefined,
                fromId: fromId || undefined,
            };

            const created = await crmDealsApi.create(input);

            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'create',
                entityKind: 'deal',
                entityId: String(created.dealId ?? ''),
            });

            revalidateDealSurfaces();
            // Fire automations (best-effort).
            try {
                await dispatchAutomations({
                    type: 'entity_created',
                    entityKind: 'deal',
                    entityId: String(created.dealId ?? ''),
                    tenantUserId: String(session.user._id),
                    entity: (created as unknown as Record<string, unknown>) ?? {},
                    occurredAt: Date.now(),
                });
            } catch (err) {
                console.warn('[createCrmDeal] automation dispatch failed (non-fatal):', err);
            }
            return { message: 'Deal created successfully.' };
        } catch (e) {
            console.error('[createCrmDeal] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'deal', op: 'create', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    try {
        const newDeal: Partial<Omit<CrmDeal, '_id'>> = {
            userId: new ObjectId(session.user._id),
            name: dealName,
            value: dealValue,
            currency: formData.get('currency') as string,
            stage: dealStage,
            leadSource: formData.get('leadSource') as string,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const accountId = formData.get('accountId') as string;
        if (accountId && ObjectId.isValid(accountId)) newDeal.accountId = new ObjectId(accountId);

        const contactId = formData.get('contactId') as string;
        if (contactId && ObjectId.isValid(contactId)) newDeal.contactIds = [new ObjectId(contactId)];

        const closeDate = formData.get('closeDate') as string;
        if (closeDate) newDeal.closeDate = new Date(closeDate);

        const probabilityRaw = formData.get('probability') as string;
        if (probabilityRaw) {
            const p = Number(probabilityRaw);
            if (!isNaN(p)) newDeal.probability = p;
        }
        const priority = formData.get('priority') as string;
        if (priority) newDeal.priority = priority as CrmDeal['priority'];
        const lossReason = formData.get('lossReason') as string;
        if (lossReason) newDeal.lossReason = lossReason;
        const nextStep = formData.get('nextStep') as string;
        if (nextStep) newDeal.nextStep = nextStep;
        const campaign = formData.get('campaign') as string;
        if (campaign) newDeal.campaign = campaign;

        const { db } = await connectToDatabase();

        // Lineage seeding (crm_function_plan.md §13.5). A deal in the
        // §13.5 chain originates from a Lead, so only `fromKind: 'lead'`
        // is honoured here. Both fields are optional — existing
        // create-deal flows keep working unchanged.
        let lineage: LineageRef[] | undefined;
        let parentLead: { _id: ObjectId; lineage?: LineageRef[]; title?: string } | null = null;
        const fromKind = (formData.get('fromKind') as string | null) || null;
        const fromId = (formData.get('fromId') as string | null) || null;
        if (fromKind === 'lead' && fromId && ObjectId.isValid(fromId)) {
            try {
                const lead = await db.collection('crm_leads').findOne(
                    {
                        _id: new ObjectId(fromId),
                        userId: new ObjectId(session.user._id),
                    },
                    { projection: { _id: 1, lineage: 1, title: 1 } },
                );
                if (lead) {
                    parentLead = {
                        _id: lead._id,
                        lineage: (lead.lineage as LineageRef[] | undefined) ?? undefined,
                        title: (lead.title as string | undefined) || undefined,
                    };
                    lineage = buildLineageFromParent({
                        kind: 'lead' as LineageKind,
                        id: lead._id.toString(),
                        no: parentLead.title,
                        lineage: parentLead.lineage,
                    });
                }
            } catch {
                // ignore lineage seed failures — deal still saves
            }
        }

        const insertResult = await db.collection('crm_deals').insertOne({
            ...newDeal,
            ...(lineage ? { lineage } : {}),
        } as CrmDeal);

        // Custom fields (Worksuite §13). The dialog wires a JSON-encoded
        // map under `customFields`; persist via the shared upsert helper.
        const customFieldsRaw = formData.get('customFields') as string | null;
        if (customFieldsRaw) {
            let parsedValues: Record<string, unknown> = {};
            try {
                const parsed = JSON.parse(customFieldsRaw);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    parsedValues = parsed as Record<string, unknown>;
                }
            } catch {
                parsedValues = {};
            }
            try {
                await applyCustomFieldsToEntity('deal', insertResult.insertedId.toString(), parsedValues);
            } catch {
                // non-fatal — deal already saved
            }
        }

        // Best-effort back-link onto the parent lead.
        if (lineage && parentLead) {
            try {
                const updatedParentLineage = appendLineage(parentLead.lineage, {
                    kind: 'deal',
                    id: insertResult.insertedId.toString(),
                    no: newDeal.name,
                    status: newDeal.stage,
                    createdAt: new Date().toISOString(),
                });
                await db.collection('crm_leads').updateOne(
                    { _id: parentLead._id },
                    { $set: { lineage: updatedParentLineage, updatedAt: new Date() } },
                );
            } catch {
                // non-fatal
            }
        }

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'create',
            entityKind: 'deal',
            entityId: String(insertResult.insertedId),
        });

        revalidateDealSurfaces();
        // Fire automations (best-effort).
        try {
            await dispatchAutomations({
                type: 'entity_created',
                entityKind: 'deal',
                entityId: insertResult.insertedId.toString(),
                tenantUserId: String(session.user._id),
                entity: { ...(newDeal as Record<string, unknown>), _id: insertResult.insertedId },
                occurredAt: Date.now(),
            });
        } catch (err) {
            console.warn('[createCrmDeal] automation dispatch failed (non-fatal):', err);
        }
        return { message: 'Deal created successfully.' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function addCrmLeadAndDeal(
    prevState: any,
    formData: FormData,
    apiUser?: WithId<User>
): Promise<{ message?: string; error?: string, contactId?: string, dealId?: string }> {
    const session = apiUser ? { user: apiUser } : await getSession();
    if (!session?.user) return { error: "Access denied" };

    // Skip RBAC for API-key callers — those have their own scope checks upstream.
    // Both lead+deal are created in this one call, so gate on both. Lead is
    // created first, so its permission error wins when both are missing.
    if (!apiUser) {
        const leadGuard = await requirePermission('crm_lead', 'create');
        if (!leadGuard.ok) return { error: leadGuard.error };
        const dealGuard = await requirePermission('crm_deal', 'create');
        if (!dealGuard.ok) return { error: dealGuard.error };
    }

    const { db } = await connectToDatabase();

    // --- Contact Handling ---
    const contactName = formData.get('contactName') as string;
    const email = (formData.get('email') as string)?.toLowerCase();
    const phone = formData.get('phone') as string;
    const company = formData.get('company') as string;
    const jobTitle = formData.get('designation') as string;
    const tagIds = (formData.get('tagIds') as string)?.split(',').filter(Boolean);

    if (!contactName || !email) {
        return { error: 'Contact Name and Email are required to create a lead.' };
    }

    let contact: WithId<CrmContact> | null = null;
    try {
        const existingContact = await db.collection<CrmContact>('crm_contacts').findOne({ email: email, userId: new ObjectId(session.user._id) });

        if (existingContact) {
            contact = existingContact;
        } else {
            const newContactData: Omit<CrmContact, '_id'> = {
                userId: new ObjectId(session.user._id),
                name: contactName,
                email,
                phone,
                company,
                jobTitle,
                status: 'new_lead',
                leadSource: formData.get('leadSource') as string,
                tags: tagIds,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            const insertResult = await db.collection('crm_contacts').insertOne(newContactData as any);
            contact = { ...newContactData, _id: insertResult.insertedId };
        }
    } catch (e) {
        console.error("Error in find/create contact for lead:", e);
        return { error: `Database error during contact processing: ${getErrorMessage(e)}` };
    }

    if (!contact) {
        return { error: "Failed to create or find contact." };
    }

    // --- Deal Handling ---
    try {
        const dealName = formData.get('name') as string;
        const dealValue = Number(formData.get('value'));
        const dealStage = formData.get('stage') as string;

        if (!dealName || isNaN(dealValue) || !dealStage) {
            return { error: "Deal Name, Value, and Stage are required." };
        }

        const newDeal: Partial<Omit<CrmDeal, '_id'>> = {
            userId: session.user._id,
            name: dealName,
            value: dealValue,
            currency: 'INR',
            stage: dealStage,
            contactIds: [contact._id],
            accountId: contact.accountId,
            leadSource: formData.get('leadSource') as string,
            description: formData.get('description') as string,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const dealResult = await db.collection('crm_deals').insertOne(newDeal as any);

        revalidatePath('/dashboard/crm/deals');
        revalidatePath('/dashboard/crm/sales-crm/all-leads');

        return {
            message: 'Lead and deal created successfully.',
            contactId: contact._id.toString(),
            dealId: dealResult.insertedId.toString(),
        };

    } catch (e: any) {
        return { error: `Failed to create deal: ${getErrorMessage(e)}` };
    }
}

export async function updateCrmDealStage(dealId: string, newStage: string): Promise<{ success: boolean; error?: string }> {
    if (!dealId) {
        return { success: false, error: 'Invalid Deal ID.' };
    }

    const session = await getSession();
    if (!session?.user) {
        return { success: false, error: 'Authentication required.' };
    }

    const guard = await requirePermission('crm_deal', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    if (useRustCrm()) {
        try {
            const patch: CrmDealUpdateInput = { stageId: newStage, status: newStage };
            await crmDealsApi.update(dealId, patch);

            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'stage_change',
                entityKind: 'deal',
                entityId: dealId,
                diff: { stage: { after: newStage } },
            });

            revalidateDealSurfaces(dealId);
            void maybeNotifySlackDealWon(dealId, newStage);
            return { success: true };
        } catch (e) {
            console.error('[updateCrmDealStage] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'deal', op: 'update', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    if (!ObjectId.isValid(dealId)) return { success: false, error: 'Invalid Deal ID.' };

    try {
        const { db } = await connectToDatabase();

        const deal = await db.collection('crm_deals').findOne({ _id: new ObjectId(dealId), userId: new ObjectId(session.user._id) });
        if (!deal) {
            return { success: false, error: 'Deal not found or you do not have permission.' };
        }

        await db.collection('crm_deals').updateOne(
            { _id: new ObjectId(dealId) },
            { $set: { stage: newStage, updatedAt: new Date() } }
        );

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'status_change',
            entityKind: 'deal',
            entityId: dealId,
            diff: { stage: { before: (deal as any).stage, after: newStage } },
        });

        revalidateDealSurfaces(dealId);
        void maybeNotifySlackDealWon(dealId, newStage);
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/**
 * Generic deal patcher. Lets the detail page do inline quick-edits
 * (owner, status, expectedClose, wonLossReason, etc.) without needing a
 * full FormData submission. Caller passes a sparse patch — only known
 * keys are written.
 */
export async function updateCrmDeal(
    dealId: string,
    patch: Partial<{
        ownerId: string | null;
        stage: string;
        status: 'open' | 'won' | 'lost' | 'archived';
        expectedClose: string | null;
        probability: number | null;
        priority: CrmDeal['priority'];
        nextStep: string | null;
        wonLossReason: string | null;
        lossReason: string | null;
        labels: string[];
    }>,
): Promise<{ success: boolean; error?: string }> {
    if (!dealId) return { success: false, error: 'Invalid Deal ID.' };
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    const guard = await requirePermission('crm_deal', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    if (useRustCrm()) {
        try {
            const rustPatch: CrmDealUpdateInput = {};
            if ('ownerId' in patch) {
                if (patch.ownerId && ObjectId.isValid(patch.ownerId)) rustPatch.ownerId = patch.ownerId;
            }
            if (typeof patch.stage === 'string' && patch.stage) rustPatch.stageId = patch.stage;
            if (typeof patch.status === 'string' && patch.status) rustPatch.status = patch.status;
            if ('expectedClose' in patch && patch.expectedClose) rustPatch.expectedClose = patch.expectedClose;
            if ('probability' in patch && typeof patch.probability === 'number' && !Number.isNaN(patch.probability)) {
                rustPatch.probabilityPct = patch.probability;
            }
            if ('wonLossReason' in patch && patch.wonLossReason) rustPatch.wonLostReason = patch.wonLossReason;
            else if ('lossReason' in patch && patch.lossReason) rustPatch.wonLostReason = patch.lossReason;

            await crmDealsApi.update(dealId, rustPatch);

            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'update',
                entityKind: 'deal',
                entityId: dealId,
            });

            revalidateDealSurfaces(dealId);
            if (patch.status === 'won' || (typeof patch.stage === 'string' && patch.stage.toLowerCase() === 'won')) {
                void maybeNotifySlackDealWon(dealId, 'won');
            }
            return { success: true };
        } catch (e) {
            console.error('[updateCrmDeal] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'deal', op: 'update', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    if (!ObjectId.isValid(dealId)) return { success: false, error: 'Invalid Deal ID.' };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(String(session.user._id));
        const before = await db.collection('crm_deals').findOne({ _id: new ObjectId(dealId), userId });
        if (!before) return { success: false, error: 'Deal not found.' };

        const set: Record<string, unknown> = { updatedAt: new Date() };
        const unset: Record<string, unknown> = {};

        if ('ownerId' in patch) {
            if (patch.ownerId && ObjectId.isValid(patch.ownerId)) {
                set.ownerId = new ObjectId(patch.ownerId);
            } else {
                unset.ownerId = '';
            }
        }
        if (typeof patch.stage === 'string' && patch.stage) set.stage = patch.stage;
        if (typeof patch.status === 'string' && patch.status) set.status = patch.status;
        if ('expectedClose' in patch) {
            if (patch.expectedClose) {
                const d = new Date(patch.expectedClose);
                if (!Number.isNaN(d.getTime())) set.closeDate = d;
            } else {
                unset.closeDate = '';
            }
        }
        if ('probability' in patch) {
            if (typeof patch.probability === 'number' && !Number.isNaN(patch.probability)) {
                set.probability = patch.probability;
            } else {
                unset.probability = '';
            }
        }
        if (patch.priority) set.priority = patch.priority;
        if ('nextStep' in patch) {
            if (patch.nextStep) set.nextStep = patch.nextStep;
            else unset.nextStep = '';
        }
        if ('wonLossReason' in patch) {
            if (patch.wonLossReason) set.wonLossReason = patch.wonLossReason;
            else unset.wonLossReason = '';
        }
        if ('lossReason' in patch) {
            if (patch.lossReason) set.lossReason = patch.lossReason;
            else unset.lossReason = '';
        }
        if (Array.isArray(patch.labels)) set.labels = patch.labels;

        const op: Record<string, unknown> = { $set: set };
        if (Object.keys(unset).length) op.$unset = unset;

        const result = await db.collection('crm_deals').updateOne(
            { _id: new ObjectId(dealId), userId },
            op,
        );
        if (result.matchedCount === 0) return { success: false, error: 'Deal not found.' };

        const diff: Record<string, { before?: unknown; after?: unknown }> = {};
        for (const [k, after] of Object.entries(set)) {
            if (k === 'updatedAt') continue;
            const beforeV = (before as Record<string, unknown>)[k];
            if (JSON.stringify(beforeV) !== JSON.stringify(after)) {
                diff[k] = { before: beforeV, after };
            }
        }

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'update',
            entityKind: 'deal',
            entityId: dealId,
            diff: Object.keys(diff).length ? diff : undefined,
        });

        revalidateDealSurfaces(dealId);
        if (patch.status === 'won' || (typeof patch.stage === 'string' && patch.stage.toLowerCase() === 'won')) {
            void maybeNotifySlackDealWon(dealId, 'won');
        }
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/**
 * Soft-archive a deal. Sets `status: 'archived'` (and an `archivedAt`
 * timestamp) — does not hard-delete.
 */
export async function archiveCrmDeal(
    dealId: string,
): Promise<{ success: boolean; error?: string }> {
    if (!dealId) return { success: false, error: 'Invalid Deal ID.' };
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    const guard = await requirePermission('crm_deal', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    if (useRustCrm()) {
        try {
            await crmDealsApi.delete(dealId);

            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'archive',
                entityKind: 'deal',
                entityId: dealId,
            });

            revalidateDealSurfaces(dealId);
            return { success: true };
        } catch (e) {
            console.error('[archiveCrmDeal] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'deal', op: 'delete', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    if (!ObjectId.isValid(dealId)) return { success: false, error: 'Invalid Deal ID.' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_deals').updateOne(
            { _id: new ObjectId(dealId), userId: new ObjectId(session.user._id) },
            { $set: { status: 'archived', archivedAt: new Date(), updatedAt: new Date() } },
        );
        if (result.matchedCount === 0) return { success: false, error: 'Deal not found.' };

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'archive',
            entityKind: 'deal',
            entityId: dealId,
        });

        revalidateDealSurfaces(dealId);
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/**
 * Bulk archive a set of deals. Each id writes its own audit entry.
 */
export async function bulkArchiveDeals(
    ids: string[],
): Promise<{ success: boolean; processed: number; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, processed: 0, error: 'Access denied.' };
    const guard = await requirePermission('crm_deal', 'delete');
    if (!guard.ok) return { success: false, processed: 0, error: guard.error };

    const validIds = (ids ?? []).filter((id) => typeof id === 'string' && id.length > 0);
    if (validIds.length === 0) return { success: false, processed: 0, error: 'No valid deals selected.' };

    if (useRustCrm()) {
        try {
            let processed = 0;
            for (const id of validIds) {
                try {
                    await crmDealsApi.delete(id);
                    processed += 1;
                } catch (innerErr) {
                    console.error('[bulkArchiveDeals] per-row rust failure:', innerErr);
                }
            }
            for (const id of validIds) {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'archive',
                    entityKind: 'deal',
                    entityId: id,
                    reason: 'bulk:archive',
                });
            }
            revalidateDealSurfaces();
            return { success: true, processed };
        } catch (e) {
            console.error('[bulkArchiveDeals] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'deal', op: 'delete', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    const objectIds = validIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
    if (objectIds.length === 0) return { success: false, processed: 0, error: 'No valid deals selected.' };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(String(session.user._id));
        const result = await db.collection('crm_deals').updateMany(
            { _id: { $in: objectIds }, userId },
            { $set: { status: 'archived', archivedAt: new Date(), updatedAt: new Date() } },
        );
        for (const id of objectIds) {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'archive',
                entityKind: 'deal',
                entityId: String(id),
                reason: 'bulk:archive',
            });
        }
        revalidateDealSurfaces();
        return { success: true, processed: result.modifiedCount ?? 0 };
    } catch (e) {
        return { success: false, processed: 0, error: getErrorMessage(e) };
    }
}

/**
 * Hard-delete a set of deals. Caller must gate behind ConfirmDialog with
 * type-DELETE — this action does not double-check.
 */
export async function bulkDeleteDeals(
    ids: string[],
): Promise<{ success: boolean; processed: number; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, processed: 0, error: 'Access denied.' };
    const guard = await requirePermission('crm_deal', 'delete');
    if (!guard.ok) return { success: false, processed: 0, error: guard.error };

    const validIds = (ids ?? []).filter((id) => typeof id === 'string' && id.length > 0);
    if (validIds.length === 0) return { success: false, processed: 0, error: 'No valid deals selected.' };

    if (useRustCrm()) {
        try {
            let processed = 0;
            for (const id of validIds) {
                try {
                    await crmDealsApi.delete(id);
                    processed += 1;
                } catch (innerErr) {
                    console.error('[bulkDeleteDeals] per-row rust failure:', innerErr);
                }
            }
            for (const id of validIds) {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'delete',
                    entityKind: 'deal',
                    entityId: id,
                    reason: 'bulk:delete',
                });
            }
            revalidateDealSurfaces();
            return { success: true, processed };
        } catch (e) {
            console.error('[bulkDeleteDeals] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'deal', op: 'delete', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    const objectIds = validIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
    if (objectIds.length === 0) return { success: false, processed: 0, error: 'No valid deals selected.' };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(String(session.user._id));
        const result = await db.collection('crm_deals').deleteMany({ _id: { $in: objectIds }, userId });
        for (const id of objectIds) {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'delete',
                entityKind: 'deal',
                entityId: String(id),
                reason: 'bulk:delete',
            });
        }
        revalidateDealSurfaces();
        return { success: true, processed: result.deletedCount ?? 0 };
    } catch (e) {
        return { success: false, processed: 0, error: getErrorMessage(e) };
    }
}

/**
 * Bulk-assign a set of deals to an owner. Pass `null` to unassign.
 */
export async function bulkAssignDeals(
    ids: string[],
    ownerUserId: string | null,
): Promise<{ success: boolean; processed: number; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, processed: 0, error: 'Access denied.' };
    const guard = await requirePermission('crm_deal', 'edit');
    if (!guard.ok) return { success: false, processed: 0, error: guard.error };

    const validIds = (ids ?? []).filter((id) => typeof id === 'string' && id.length > 0);
    if (validIds.length === 0) return { success: false, processed: 0, error: 'No valid deals selected.' };

    if (useRustCrm()) {
        try {
            let processed = 0;
            const patch: CrmDealUpdateInput = ownerUserId && ObjectId.isValid(ownerUserId)
                ? { ownerId: ownerUserId }
                : {};
            for (const id of validIds) {
                try {
                    await crmDealsApi.update(id, patch);
                    processed += 1;
                } catch (innerErr) {
                    console.error('[bulkAssignDeals] per-row rust failure:', innerErr);
                }
            }
            for (const id of validIds) {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'assign',
                    entityKind: 'deal',
                    entityId: id,
                    reason: `bulk:assign:${ownerUserId ?? 'unassign'}`,
                    diff: { ownerId: { after: ownerUserId ?? null } },
                });
            }
            revalidateDealSurfaces();
            return { success: true, processed };
        } catch (e) {
            console.error('[bulkAssignDeals] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'deal', op: 'update', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    const objectIds = validIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
    if (objectIds.length === 0) return { success: false, processed: 0, error: 'No valid deals selected.' };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(String(session.user._id));
        const set: Record<string, unknown> = { updatedAt: new Date() };
        const unset: Record<string, unknown> = {};
        if (ownerUserId && ObjectId.isValid(ownerUserId)) {
            set.ownerId = new ObjectId(ownerUserId);
        } else {
            unset.ownerId = '';
        }
        const op: Record<string, unknown> = { $set: set };
        if (Object.keys(unset).length) op.$unset = unset;
        const result = await db.collection('crm_deals').updateMany(
            { _id: { $in: objectIds }, userId },
            op,
        );
        for (const id of objectIds) {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'assign',
                entityKind: 'deal',
                entityId: String(id),
                reason: `bulk:assign:${ownerUserId ?? 'unassign'}`,
                diff: { ownerId: { after: ownerUserId ?? null } },
            });
        }
        revalidateDealSurfaces();
        return { success: true, processed: result.modifiedCount ?? 0 };
    } catch (e) {
        return { success: false, processed: 0, error: getErrorMessage(e) };
    }
}

/**
 * Bulk stage-change. Optionally scopes by `pipelineId` so a deal in
 * pipeline-A doesn't get a stage from pipeline-B.
 */
export async function bulkChangeStage(
    ids: string[],
    stage: string,
    pipelineId?: string | null,
): Promise<{ success: boolean; processed: number; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, processed: 0, error: 'Access denied.' };
    const guard = await requirePermission('crm_deal', 'edit');
    if (!guard.ok) return { success: false, processed: 0, error: guard.error };

    if (!stage || !stage.trim()) return { success: false, processed: 0, error: 'Stage is required.' };
    const validIds = (ids ?? []).filter((id) => typeof id === 'string' && id.length > 0);
    if (validIds.length === 0) return { success: false, processed: 0, error: 'No valid deals selected.' };

    if (useRustCrm()) {
        try {
            let processed = 0;
            const patch: CrmDealUpdateInput = { stageId: stage, status: stage };
            for (const id of validIds) {
                try {
                    await crmDealsApi.update(id, patch);
                    processed += 1;
                } catch (innerErr) {
                    console.error('[bulkChangeStage] per-row rust failure:', innerErr);
                }
            }
            for (const id of validIds) {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'status_change',
                    entityKind: 'deal',
                    entityId: id,
                    reason: `bulk:stage:${stage}`,
                });
            }
            revalidateDealSurfaces();
            return { success: true, processed };
        } catch (e) {
            console.error('[bulkChangeStage] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'deal', op: 'update', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    const objectIds = validIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
    if (objectIds.length === 0) return { success: false, processed: 0, error: 'No valid deals selected.' };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(String(session.user._id));
        const filter: Record<string, unknown> = { _id: { $in: objectIds }, userId };
        if (pipelineId) filter.pipelineId = pipelineId;
        const result = await db.collection('crm_deals').updateMany(filter, {
            $set: { stage, updatedAt: new Date() },
        });
        for (const id of objectIds) {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'status_change',
                entityKind: 'deal',
                entityId: String(id),
                reason: `bulk:stage:${stage}`,
            });
        }
        revalidateDealSurfaces();
        return { success: true, processed: result.modifiedCount ?? 0 };
    } catch (e) {
        return { success: false, processed: 0, error: getErrorMessage(e) };
    }
}

/**
 * Placeholder email-send action — writes an audit entry but does NOT
 * actually relay through SMTP yet. The Email composition flow uses this
 * as the canonical landing slot so the swap-in is purely server-side
 * when the comms sweep lands.
 */
export async function sendDealEmail(args: {
    dealId: string;
    to: string;
    subject: string;
    body: string;
}): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    const guard = await requirePermission('crm_deal', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };
    if (!args.dealId || !ObjectId.isValid(args.dealId)) {
        return { success: false, error: 'Invalid deal id.' };
    }
    if (!args.to || !args.subject) return { success: false, error: 'To and subject are required.' };

    try {
        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'send',
            entityKind: 'deal',
            entityId: args.dealId,
            reason: `email:to=${args.to}`,
            diff: { subject: { after: args.subject } },
        });
        revalidateDealSurfaces(args.dealId);
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/**
 * Live related-entity counts for the detail page right rail. Mirrors
 * the legacy server-component helper so client islands can call it.
 */
export async function getCrmDealRelatedCounts(
    dealId: string,
): Promise<{ quotations: number; invoices: number; tasks: number; tickets: number; contacts: number }> {
    const empty = { quotations: 0, invoices: 0, tasks: 0, tickets: 0, contacts: 0 };
    if (!ObjectId.isValid(dealId)) return empty;
    const session = await getSession();
    if (!session?.user) return empty;

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(String(session.user._id));
        const dealObjectId = new ObjectId(dealId);

        const deal = await db.collection('crm_deals').findOne(
            { _id: dealObjectId, userId },
            { projection: { accountId: 1 } },
        );
        const accountId = (deal as any)?.accountId
            ? new ObjectId(String((deal as any).accountId))
            : null;

        const [quotations, invoices, tasks, tickets, contacts] = await Promise.all([
            db.collection('crm_quotations').countDocuments({
                userId,
                $or: [{ dealId: dealObjectId }, { dealId: dealId }],
            } as Record<string, unknown>).catch(() => 0),
            db.collection('crm_invoices').countDocuments({
                userId,
                $or: [{ dealId: dealObjectId }, { dealId: dealId }],
            } as Record<string, unknown>).catch(() => 0),
            db.collection('crm_tasks').countDocuments({
                userId,
                $or: [{ dealId: dealObjectId }, { dealId: dealId }],
            } as Record<string, unknown>).catch(() => 0),
            db.collection('crm_tickets').countDocuments({
                userId,
                $or: [{ dealId: dealObjectId }, { dealId: dealId }],
            } as Record<string, unknown>).catch(() => 0),
            accountId
                ? db.collection('crm_contacts').countDocuments({
                      userId,
                      accountId,
                  } as Record<string, unknown>).catch(() => 0)
                : Promise.resolve(0),
        ]);

        return {
            quotations: Number(quotations) || 0,
            invoices: Number(invoices) || 0,
            tasks: Number(tasks) || 0,
            tickets: Number(tickets) || 0,
            contacts: Number(contacts) || 0,
        };
    } catch (e) {
        console.error('[getCrmDealRelatedCounts] failed:', e);
        return empty;
    }
}

/**
 * Find duplicate deals — groups by (clientId, value within ±5%,
 * expectedClose within ±7d). Returns groups sized >= 2.
 */
export interface DealDuplicateGroup {
    /** Identifier label (mostly for debug). */
    key: string;
    /** Member deals in the cluster. */
    members: Array<{
        _id: string;
        name: string;
        value: number;
        currency?: string;
        clientLabel?: string;
        clientId?: string;
        expectedClose?: string | null;
        stage?: string;
        createdAt?: string;
    }>;
}

export async function findCrmDealDuplicates(): Promise<DealDuplicateGroup[]> {
    const session = await getSession();
    if (!session?.user) return [];
    const guard = await requirePermission('crm_deal', 'view');
    if (!guard.ok) return [];

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(String(session.user._id));
        const docs = await db
            .collection<CrmDeal>('crm_deals')
            .find({ userId } as Record<string, unknown>)
            .project({ name: 1, value: 1, currency: 1, accountId: 1, contactIds: 1, closeDate: 1, stage: 1, createdAt: 1 })
            .toArray();

        const accountIds = Array.from(
            new Set(
                docs
                    .map((d: any) => (d.accountId ? String(d.accountId) : ''))
                    .filter((s) => Boolean(s)),
            ),
        );
        const accountDocs = accountIds.length
            ? await db
                  .collection('crm_accounts')
                  .find(
                      { userId, _id: { $in: accountIds.map((id) => new ObjectId(id)) } } as Record<string, unknown>,
                      { projection: { name: 1 } },
                  )
                  .toArray()
            : [];
        const accountNames = new Map<string, string>();
        for (const a of accountDocs) accountNames.set(String((a as any)._id), String((a as any).name ?? ''));

        // Cluster: same clientId, value within ±5%, expectedClose within ±7d.
        type Row = {
            _id: string;
            name: string;
            value: number;
            currency?: string;
            clientId?: string;
            clientLabel?: string;
            expectedClose?: string | null;
            stage?: string;
            createdAt?: string;
        };
        const rows: Row[] = docs.map((d: any) => ({
            _id: String(d._id),
            name: String(d.name ?? 'Untitled'),
            value: typeof d.value === 'number' ? d.value : 0,
            currency: d.currency,
            clientId: d.accountId ? String(d.accountId) : (d.contactIds?.[0] ? String(d.contactIds[0]) : undefined),
            clientLabel: d.accountId ? accountNames.get(String(d.accountId)) : undefined,
            expectedClose: d.closeDate ? new Date(d.closeDate).toISOString() : null,
            stage: d.stage,
            createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : undefined,
        }));

        const sevenDaysMs = 7 * 86_400_000;
        const groups: Row[][] = [];
        const used = new Set<string>();
        for (let i = 0; i < rows.length; i++) {
            const a = rows[i];
            if (used.has(a._id)) continue;
            if (!a.clientId) continue;
            const cluster: Row[] = [a];
            for (let j = i + 1; j < rows.length; j++) {
                const b = rows[j];
                if (used.has(b._id)) continue;
                if (!b.clientId || b.clientId !== a.clientId) continue;
                // Value within ±5%.
                const ref = Math.max(Math.abs(a.value), Math.abs(b.value), 1);
                if (Math.abs(a.value - b.value) / ref > 0.05) continue;
                // Expected close within ±7d.
                if (a.expectedClose && b.expectedClose) {
                    const dt = Math.abs(new Date(a.expectedClose).getTime() - new Date(b.expectedClose).getTime());
                    if (dt > sevenDaysMs) continue;
                } else if (a.expectedClose !== b.expectedClose) {
                    // One has a date, the other doesn't → skip
                    continue;
                }
                cluster.push(b);
                used.add(b._id);
            }
            if (cluster.length >= 2) {
                used.add(a._id);
                groups.push(cluster);
            }
        }

        return groups.map((cluster, idx) => ({
            key: `${cluster[0].clientId ?? 'no-client'}-${idx}`,
            members: cluster,
        }));
    } catch (e) {
        console.error('[findCrmDealDuplicates] failed:', e);
        return [];
    }
}

/* ─── Duplicate-cluster resolution ────────────────────────────────────
 *
 * Mirrors `crm-leads.actions.ts`. Cluster status is persisted in
 * `crm_deal_duplicate_resolutions` keyed by the cluster signature
 * (`<clientId>:<amount-bucket>:<close-bucket>` — the natural identity
 * for a deal-dedupe match).
 */

export type DealDuplicateClusterStatus = 'pending' | 'ignored' | 'resolved';

export interface DealDuplicateResolution {
    signature: string;
    status: DealDuplicateClusterStatus;
    survivorId?: string;
    mergedIds?: string[];
    updatedAt: string;
}

const DEAL_DUP_RESOLUTIONS_COLLECTION = 'crm_deal_duplicate_resolutions';

export async function getDealDuplicateResolutions(): Promise<DealDuplicateResolution[]> {
    const session = await getSession();
    if (!session?.user) return [];
    const guard = await requirePermission('crm_deal', 'view');
    if (!guard.ok) return [];
    try {
        const { db } = await connectToDatabase();
        const docs = await db
            .collection(DEAL_DUP_RESOLUTIONS_COLLECTION)
            .find({ userId: new ObjectId(String(session.user._id)) })
            .toArray();
        return docs.map((d) => ({
            signature: String((d as any).signature ?? ''),
            status: ((d as any).status as DealDuplicateClusterStatus) ?? 'pending',
            survivorId: (d as any).survivorId ? String((d as any).survivorId) : undefined,
            mergedIds: Array.isArray((d as any).mergedIds)
                ? ((d as any).mergedIds as unknown[]).map((x) => String(x))
                : undefined,
            updatedAt: (d as any).updatedAt
                ? new Date((d as any).updatedAt).toISOString()
                : new Date().toISOString(),
        }));
    } catch (e) {
        console.error('[getDealDuplicateResolutions] failed:', e);
        return [];
    }
}

export async function ignoreDealDuplicateCluster(
    signature: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };
    const guard = await requirePermission('crm_deal', 'edit');
    if (!guard.ok) return { success: false, error: 'Permission denied' };
    if (!signature) return { success: false, error: 'signature required' };
    try {
        const { db } = await connectToDatabase();
        const userObjId = new ObjectId(String(session.user._id));
        await db.collection(DEAL_DUP_RESOLUTIONS_COLLECTION).updateOne(
            { userId: userObjId, signature },
            {
                $set: {
                    userId: userObjId,
                    signature,
                    status: 'ignored',
                    updatedAt: new Date(),
                },
            },
            { upsert: true },
        );
        revalidateDealSurfaces();
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/**
 * Merge a set of duplicate deals into one survivor. Backfills missing
 * scalar fields on the survivor from siblings, then archives the others
 * (`status='archived'`, `mergedInto=<survivor>`). Cluster signature is
 * marked `resolved`.
 */
export async function mergeCrmDeals(args: {
    survivorId: string;
    mergedIds: string[];
    signature: string;
}): Promise<{ success: boolean; merged?: number; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };
    const guard = await requirePermission('crm_deal', 'edit');
    if (!guard.ok) return { success: false, error: 'Permission denied' };

    const survivorId = String(args.survivorId ?? '').trim();
    const mergedIds = (args.mergedIds ?? [])
        .map((id) => String(id).trim())
        .filter((id) => id && id !== survivorId);
    if (!survivorId || mergedIds.length === 0) {
        return { success: false, error: 'survivor and at least one merged id required' };
    }
    if (!ObjectId.isValid(survivorId) || mergedIds.some((id) => !ObjectId.isValid(id))) {
        return { success: false, error: 'invalid deal id' };
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(String(session.user._id));
        const survivorObjId = new ObjectId(survivorId);
        const mergedObjIds = mergedIds.map((id) => new ObjectId(id));

        const allDocs = await db
            .collection('crm_deals')
            .find({ userId: userObjectId, _id: { $in: [survivorObjId, ...mergedObjIds] } })
            .toArray();
        if (allDocs.length < 2) {
            return { success: false, error: 'deals not found' };
        }
        const survivor = allDocs.find((d) => String(d._id) === survivorId);
        if (!survivor) return { success: false, error: 'survivor not found' };

        const backfillKeys = [
            'name', 'value', 'currency', 'accountId', 'contactIds',
            'closeDate', 'stage', 'notes', 'description', 'ownerId',
        ] as const;
        const survivorPatch: Record<string, unknown> = {};
        for (const k of backfillKeys) {
            const sv = (survivor as Record<string, unknown>)[k];
            if (sv != null && sv !== '' && !(Array.isArray(sv) && sv.length === 0)) continue;
            for (const d of allDocs) {
                if (String(d._id) === survivorId) continue;
                const v = (d as Record<string, unknown>)[k];
                if (v != null && v !== '' && !(Array.isArray(v) && v.length === 0)) {
                    survivorPatch[k] = v;
                    break;
                }
            }
        }
        if (Object.keys(survivorPatch).length > 0) {
            survivorPatch.updatedAt = new Date();
            await db.collection('crm_deals').updateOne(
                { _id: survivorObjId, userId: userObjectId },
                { $set: survivorPatch },
            );
        }

        await db.collection('crm_deals').updateMany(
            { _id: { $in: mergedObjIds }, userId: userObjectId },
            {
                $set: {
                    status: 'archived',
                    mergedInto: survivorObjId,
                    mergedAt: new Date(),
                    updatedAt: new Date(),
                },
            },
        );

        if (args.signature) {
            await db.collection(DEAL_DUP_RESOLUTIONS_COLLECTION).updateOne(
                { userId: userObjectId, signature: args.signature },
                {
                    $set: {
                        userId: userObjectId,
                        signature: args.signature,
                        status: 'resolved',
                        survivorId: survivorObjId,
                        mergedIds: mergedObjIds,
                        updatedAt: new Date(),
                    },
                },
                { upsert: true },
            );
        }

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'merge',
            entityKind: 'crm_deal',
            entityId: survivorId,
            reason: `Merged ${mergedIds.length} duplicate(s)`,
            diff: { mergedIds: { after: mergedIds }, signature: { after: args.signature ?? '' } },
        });

        revalidateDealSurfaces(survivorId);
        return { success: true, merged: mergedIds.length };
    } catch (e) {
        console.error('[mergeCrmDeals] failed:', e);
        return { success: false, error: getErrorMessage(e) };
    }
}
