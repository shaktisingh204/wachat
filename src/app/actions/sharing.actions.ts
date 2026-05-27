'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';

type ShareRole = 'viewer' | 'editor';

interface ResourceShare {
    _id: string;
    resourceType: 'url' | 'qr';
    resourceId: string;
    ownerId: string;
    sharedWithEmail: string;
    role: ShareRole;
    createdAt: string;
}

const COLL = 'resource_shares';

export async function getShares(
    resourceType: 'url' | 'qr',
    resourceId: string,
): Promise<ResourceShare[]> {
    const session = await getSession();
    if (!session?.user) return [];
    try {
        const { db } = await connectToDatabase();
        const docs = await db.collection(COLL).find({
            resourceType,
            resourceId,
            ownerId: (session.user as any)._id?.toString(),
        }).sort({ createdAt: -1 }).toArray();
        return docs.map((d: any) => ({
            _id: d._id.toString(),
            resourceType: d.resourceType,
            resourceId: d.resourceId,
            ownerId: d.ownerId,
            sharedWithEmail: d.sharedWithEmail,
            role: d.role,
            createdAt: d.createdAt?.toISOString?.() ?? new Date().toISOString(),
        }));
    } catch { return []; }
}

export async function createShare(
    resourceType: 'url' | 'qr',
    resourceId: string,
    email: string,
    role: ShareRole,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    const emailLower = email.trim().toLowerCase();
    if (!emailLower || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
        return { success: false, error: 'Invalid email address.' };
    }

    try {
        const { db } = await connectToDatabase();
        const ownerId = (session.user as any)._id?.toString();

        const existing = await db.collection(COLL).findOne({
            resourceType, resourceId, ownerId,
            sharedWithEmail: emailLower,
        });
        if (existing) {
            await db.collection(COLL).updateOne(
                { _id: existing._id },
                { $set: { role } }
            );
        } else {
            await db.collection(COLL).insertOne({
                resourceType, resourceId, ownerId,
                sharedWithEmail: emailLower,
                role,
                createdAt: new Date(),
            });
        }
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e?.message ?? 'Failed.' };
    }
}

export async function revokeShare(shareId: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        await db.collection(COLL).deleteOne({
            _id: new ObjectId(shareId),
            ownerId: (session.user as any)._id?.toString(),
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e?.message ?? 'Failed.' };
    }
}

export async function updateShareRole(
    shareId: string, role: ShareRole
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        await db.collection(COLL).updateOne(
            { _id: new ObjectId(shareId), ownerId: (session.user as any)._id?.toString() },
            { $set: { role } }
        );
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e?.message ?? 'Failed.' };
    }
}
