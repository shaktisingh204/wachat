'use server';

import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

export async function logExportHistory(entityKind: string, rowCount: number) {
    const session = await getSession();
    if (!session?.user?._id) return;
    
    try {
        const { db } = await connectToDatabase();
        await db.collection('crm_audit_log').insertOne({
            userId: new ObjectId(session.user._id as string),
            action: `bulk_export_${entityKind}`,
            status: 'success',
            metadata: { rowCount },
            createdAt: new Date(),
        });
    } catch (e) {
        console.error('[logExportHistory] failed:', e);
    }
}

export async function getExportHistory(entityKind: string) {
    const session = await getSession();
    if (!session?.user?._id) return [];

    try {
        const { db } = await connectToDatabase();
        const logs = await db.collection('crm_audit_log')
            .find({
                userId: new ObjectId(session.user._id as string),
                action: `bulk_export_${entityKind}`
            })
            .sort({ createdAt: -1 })
            .limit(10)
            .toArray();
            
        return logs.map(l => ({
            id: l._id.toString(),
            rowCount: l.metadata?.rowCount ?? 0,
            createdAt: l.createdAt,
        }));
    } catch {
        return [];
    }
}
