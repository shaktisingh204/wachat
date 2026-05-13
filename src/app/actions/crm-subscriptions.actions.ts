'use server';

/**
 * CRM Subscription server actions.
 *
 * **Dual implementation:**
 *  - When `USE_RUST_CRM === 'true'`, the read/save delegate to
 *    `/v1/crm/subscriptions` on the Rust BFF via
 *    `src/lib/rust-client/crm-subscriptions.ts`.
 *  - Otherwise (default), the legacy direct-Mongo path runs.
 *
 * Export shapes are identical across both paths so the pages at
 * `/dashboard/crm/sales/subscriptions/**` keep working without changes.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { connectToDatabase } from '@/lib/mongodb';
import {
    crmSubscriptionsApi,
    type CrmSubBillingFrequency,
} from '@/lib/rust-client/crm-subscriptions';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { getErrorMessage } from '@/lib/utils';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

/**
 * Subscription detail loader.
 *
 * Mirrors the canonical `getInvoiceById` / `getCreditNoteById` shape:
 * `getSession` guard + `ObjectId.isValid` + scoped `findOne` by `_id`
 * and `userId` against the `crm_subscriptions` collection (the same
 * collection the Rust `crm-subscriptions` crate operates on — see
 * §12.1 in `crm_function_plan.md`).
 *
 * Return type is intentionally loose. The detail page (`SubscriptionLike`)
 * already reads the document defensively because the canonical Rust DTO
 * (`crm_extras_types::Subscription`) and the legacy `commerce_subscriptions`
 * shape differ in field names; both round-trip through JSON cleanly.
 */
export async function getSubscriptionById(
    subscriptionId: string,
): Promise<WithId<Record<string, unknown>> | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!subscriptionId) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmSubscriptionsApi.getById(subscriptionId);
            return doc ? (JSON.parse(JSON.stringify(doc)) as WithId<Record<string, unknown>>) : null;
        } catch (e) {
            if (e instanceof RustApiError && e.code === 'NOT_FOUND') return null;
            console.error('[getSubscriptionById] rust path failed; falling back:', e);
            // fall through
        }
    }

    if (!ObjectId.isValid(subscriptionId)) return null;

    try {
        const { db } = await connectToDatabase();
        const sub = await db.collection('crm_subscriptions').findOne({
            _id: new ObjectId(subscriptionId),
            userId: new ObjectId(session.user._id),
        });
        if (!sub) return null;
        return JSON.parse(JSON.stringify(sub));
    } catch (e) {
        console.error('Failed to fetch subscription by id:', e);
        return null;
    }
}

export async function saveSubscription(
    _prev: any,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Not authenticated.' };

    const planName = (formData.get('planName') as string | null)?.trim() ?? '';
    if (!planName) return { error: 'Plan name is required.' };

    const accountId = (formData.get('accountId') as string | null)?.trim() ?? '';
    const customerName = (formData.get('customerName') as string | null)?.trim() ?? '';
    const frequency = ((formData.get('frequency') as string | null)?.trim() ?? 'monthly') as CrmSubBillingFrequency;
    const billingAmount = parseFloat((formData.get('billingAmount') as string | null) ?? '0');
    const currency = (formData.get('currency') as string | null)?.trim() || 'INR';
    const trialDays = parseInt((formData.get('trialDays') as string | null) ?? '0', 10) || 0;
    const startDate = (formData.get('startDate') as string | null)?.trim() ?? '';
    const notes = (formData.get('notes') as string | null)?.trim() ?? '';

    if (useRustCrm()) {
        try {
            const startedAtIso = startDate
                ? new Date(startDate).toISOString()
                : new Date().toISOString();
            const trialUntilIso =
                trialDays > 0
                    ? new Date(
                          Date.parse(startedAtIso) + trialDays * 24 * 60 * 60 * 1000,
                      ).toISOString()
                    : undefined;

            const customerIdResolved =
                accountId && ObjectId.isValid(accountId) ? accountId : customerName || planName;

            const created = await crmSubscriptionsApi.create({
                customerId: customerIdResolved,
                planId: planName,
                frequency,
                startedAt: startedAtIso,
                renewalMode: 'auto',
                trialUntil: trialUntilIso,
                items: [
                    {
                        itemId: planName,
                        qty: 1,
                        rate: isNaN(billingAmount) ? 0 : billingAmount,
                        currency,
                    },
                ],
            });
            const id = (created as any)._id?.toString() || '';
            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'create',
                    entityKind: 'subscription',
                    entityId: id,
                });
            } catch {
                /* non-fatal */
            }
            revalidatePath('/dashboard/crm/sales/subscriptions');
            return { message: 'Subscription created.', id };
        } catch (e) {
            console.error('[saveSubscription] rust path failed; falling back:', e);
            // fall through
            void notes;
        }
    }

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_subscriptions').insertOne({
            userId: new ObjectId(session.user._id),
            planName,
            accountId:
                accountId && ObjectId.isValid(accountId)
                    ? new ObjectId(accountId)
                    : undefined,
            customerName,
            frequency,
            billingAmount,
            currency,
            trialDays,
            startDate: startDate ? new Date(startDate) : undefined,
            status: 'active',
            notes,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'create',
                entityKind: 'subscription',
                entityId: result.insertedId.toString(),
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/crm/sales/subscriptions');
        return { message: 'Subscription created.', id: result.insertedId.toString() };
    } catch (e) {
        console.error('Failed to save subscription:', e);
        return { error: getErrorMessage(e) || 'Failed to save subscription. Please try again.' };
    }
}
