'use server';

import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

/**
 * Fetch a single booking document scoped to the current user.
 *
 * Mirrors the canonical loader shape used elsewhere in the CRM:
 * session guard -> ObjectId validity -> userId+_id scoped findOne ->
 * JSON-clone for safe Server -> Client passing.
 */
export async function getBookingById(
    bookingId: string,
): Promise<WithId<Record<string, unknown>> | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!ObjectId.isValid(bookingId)) return null;

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_bookings').findOne({
            _id: new ObjectId(bookingId),
            userId: new ObjectId(session.user._id),
        });
        if (!doc) return null;
        return JSON.parse(JSON.stringify(doc));
    } catch (e) {
        console.error('Failed to fetch booking by id:', e);
        return null;
    }
}
