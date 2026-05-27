'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { requireClient, clientIdFilter, asNumber, asString, toIso } from '@/lib/client-portal/db';
import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

type EstimateItem = {
    _id?: string;
    description: string;
    quantity: number;
    rate: number;
    total: number;
};

export async function getEstimateItems(estimateId: string): Promise<EstimateItem[]> {
    const ctx = await requireClient();
    if (!ctx) return [];
    const { db } = await connectToDatabase();
    
    const doc = await db.collection('crm_estimates').findOne({
        _id: new ObjectId(estimateId),
        ...clientIdFilter(ctx),
    });

    if (!doc || !doc.items) return [];

    return doc.items.map((it: any) => ({
        _id: asString(it._id) || new ObjectId().toHexString(),
        description: asString(it.description) || '',
        quantity: asNumber(it.quantity) || 1,
        rate: asNumber(it.rate) || 0,
        total: asNumber(it.total) || 0,
    }));
}

export async function requestEstimateRevision(estimateId: string, message: string, itemComments: Record<string, string>) {
    const ctx = await requireClient();
    if (!ctx) throw new Error('Unauthorized');
    const { db } = await connectToDatabase();

    const doc = await db.collection('crm_estimates').findOne({
        _id: new ObjectId(estimateId),
        ...clientIdFilter(ctx),
    });

    if (!doc) throw new Error('Estimate not found');

    // Store the revision request
    await db.collection('crm_estimate_revisions').insertOne({
        estimateId: new ObjectId(estimateId),
        clientId: ctx.user._id,
        message,
        itemComments,
        createdAt: new Date(),
    });

    // Optionally update status to "revision_requested" or something similar
    await db.collection('crm_estimates').updateOne(
        { _id: new ObjectId(estimateId) },
        { $set: { status: 'revision-requested', updatedAt: new Date() } }
    );

    revalidatePath('/portal/client/estimates');
    return { success: true };
}
