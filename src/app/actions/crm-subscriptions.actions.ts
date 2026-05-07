'use server';

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
