'use server';

import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

/**
 * Fetch a single fixed-asset document scoped to the current user.
 *
 * Mirrors the canonical loader shape used elsewhere in the CRM.
 */
export async function getFixedAssetById(
    assetId: string,
): Promise<WithId<Record<string, unknown>> | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!ObjectId.isValid(assetId)) return null;

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_fixed_assets').findOne({
            _id: new ObjectId(assetId),
            userId: new ObjectId(session.user._id),
        });
        if (!doc) return null;
        return JSON.parse(JSON.stringify(doc));
    } catch (e) {
        console.error('Failed to fetch fixed asset by id:', e);
        return null;
    }
}
