'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

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
    const frequency = (formData.get('frequency') as string | null)?.trim() ?? 'monthly';
    const billingAmount = parseFloat((formData.get('billingAmount') as string | null) ?? '0');
    const currency = (formData.get('currency') as string | null)?.trim() || 'INR';
    const trialDays = parseInt((formData.get('trialDays') as string | null) ?? '0', 10) || 0;
    const startDate = (formData.get('startDate') as string | null)?.trim() ?? '';
    const notes = (formData.get('notes') as string | null)?.trim() ?? '';

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
        revalidatePath('/dashboard/crm/sales/subscriptions');
        return { message: 'Subscription created.', id: result.insertedId.toString() };
    } catch (e) {
        console.error('Failed to save subscription:', e);
        return { error: 'Failed to save subscription. Please try again.' };
    }
}
