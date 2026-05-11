'use server';

import { revalidatePath } from 'next/cache';
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

/**
 * Create a new booking document in `crm_bookings`.
 *
 * Validates required fields and ensures slotEnd > slotStart before insert.
 */
export async function saveBooking(
    _prev: any,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const resourceName = (formData.get('resourceName') as string | null)?.trim() ?? '';
    const customerName = (formData.get('customerName') as string | null)?.trim() ?? '';
    const slotStartRaw = formData.get('slotStart') as string | null;
    const slotEndRaw = formData.get('slotEnd') as string | null;

    if (!resourceName) return { error: 'Resource / staff name is required.' };
    if (!customerName) return { error: 'Customer name is required.' };
    if (!slotStartRaw) return { error: 'Slot start date/time is required.' };
    if (!slotEndRaw) return { error: 'Slot end date/time is required.' };

    const slotStart = new Date(slotStartRaw);
    const slotEnd = new Date(slotEndRaw);

    if (isNaN(slotStart.getTime())) return { error: 'Invalid slot start date/time.' };
    if (isNaN(slotEnd.getTime())) return { error: 'Invalid slot end date/time.' };
    if (slotEnd <= slotStart) return { error: 'Slot end must be after slot start.' };

    try {
        const { db } = await connectToDatabase();
        const now = new Date();
        const userId = new ObjectId(session.user._id);

        const doc = {
            userId,
            resourceName,
            serviceName: (formData.get('serviceName') as string | null)?.trim() || undefined,
            customerName,
            customerEmail: (formData.get('customerEmail') as string | null)?.trim() || undefined,
            customerPhone: (formData.get('customerPhone') as string | null)?.trim() || undefined,
            slotStart,
            slotEnd,
            notes: (formData.get('notes') as string | null)?.trim() || undefined,
            paymentStatus: 'pending' as const,
            status: 'confirmed' as const,
            createdAt: now,
            updatedAt: now,
        };

        const result = await db.collection('crm_bookings').insertOne(doc);

        revalidatePath('/dashboard/crm/bookings');

        return {
            message: 'Booking created successfully.',
            id: result.insertedId.toString(),
        };
    } catch (e) {
        console.error('Failed to save booking:', e);
        return { error: 'Failed to save booking. Please try again.' };
    }
}
