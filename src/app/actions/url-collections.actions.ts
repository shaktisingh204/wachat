'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';

const COLL = 'url_collections';

interface UrlCollectionDoc {
    _id: string;
    userId: string;
    name: string;
    color: string;
    linkIds: string[];
    createdAt: string;
}

export async function getCollections(): Promise<UrlCollectionDoc[]> {
    const session = await getSession();
    if (!session?.user) return [];
    try {
        const { db } = await connectToDatabase();
        const docs = await db.collection(COLL)
            .find({ userId: new ObjectId((session.user as any)._id) })
            .sort({ createdAt: -1 })
            .toArray();
        return docs.map((d: any) => ({
            _id: d._id.toString(),
            userId: d.userId.toString(),
            name: d.name,
            color: d.color ?? '#6366f1',
            linkIds: (d.linkIds ?? []).map(String),
            createdAt: d.createdAt?.toISOString?.() ?? new Date().toISOString(),
        }));
    } catch { return []; }
}

export async function createCollection(
    name: string, color: string
): Promise<{ success: boolean; id?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!name.trim()) return { success: false, error: 'Name is required.' };
    try {
        const { db } = await connectToDatabase();
        const res = await db.collection(COLL).insertOne({
            userId: new ObjectId((session.user as any)._id),
            name: name.trim(),
            color,
            linkIds: [],
            createdAt: new Date(),
        });
        revalidatePath('/dashboard/url-shortener');
        return { success: true, id: res.insertedId.toString() };
    } catch (e: any) {
        return { success: false, error: e?.message ?? 'Failed.' };
    }
}

export async function deleteCollection(id: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        await db.collection(COLL).deleteOne({
            _id: new ObjectId(id),
            userId: new ObjectId((session.user as any)._id),
        });
        revalidatePath('/dashboard/url-shortener');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e?.message ?? 'Failed.' };
    }
}

export async function addLinkToCollection(
    collectionId: string, linkId: string
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        await db.collection(COLL).updateOne(
            { _id: new ObjectId(collectionId), userId: new ObjectId((session.user as any)._id) },
            { $addToSet: { linkIds: linkId } }
        );
        revalidatePath('/dashboard/url-shortener');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e?.message ?? 'Failed.' };
    }
}

export async function removeLinkFromCollection(
    collectionId: string, linkId: string
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    try {
        const { db } = await connectToDatabase();
        await db.collection(COLL).updateOne(
            { _id: new ObjectId(collectionId), userId: new ObjectId((session.user as any)._id) },
            { $pull: { linkIds: linkId } }
        );
        revalidatePath('/dashboard/url-shortener');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e?.message ?? 'Failed.' };
    }
}
