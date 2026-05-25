'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getAdminSession } from '@/lib/admin-session';
import { getErrorMessage } from '@/lib/utils';

type Result = { success: boolean; error?: string };

async function requireAdmin(): Promise<Result | null> {
    const s = await getAdminSession();
    if (!s.isAdmin) return { success: false, error: 'Permission denied.' };
    return null;
}

export async function bulkApproveLibraryTemplates(
    templateIds: string[],
): Promise<Result & { approved?: number }> {
    const auth = await requireAdmin();
    if (auth) return auth;

    if (!Array.isArray(templateIds) || templateIds.length === 0) {
        return { success: false, error: 'No templates selected.' };
    }

    const oids: ObjectId[] = [];
    for (const id of templateIds) {
        try {
            oids.push(new ObjectId(id));
        } catch {
            return { success: false, error: `Invalid template id: ${id}` };
        }
    }

    try {
        const { db } = await connectToDatabase();
        const res = await db.collection('library_templates').updateMany({
            _id: { $in: oids },
        }, {
            $set: { isCustom: false }
        });
        revalidatePath('/admin/dashboard/template-library');
        return { success: true, approved: res.modifiedCount };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function reorderLibraryTemplates(
    orderedIds: string[]
): Promise<Result> {
    const auth = await requireAdmin();
    if (auth) return auth;

    if (!Array.isArray(orderedIds)) return { success: false, error: 'Invalid payload.' };

    try {
        const { db } = await connectToDatabase();
        const bulk = db.collection('library_templates').initializeUnorderedBulkOp();
        orderedIds.forEach((id, index) => {
            try {
                bulk.find({ _id: new ObjectId(id) }).updateOne({ $set: { order: index } });
            } catch (e) {
                // Ignore invalid ids
            }
        });
        if (bulk.batches.length > 0) {
            await bulk.execute();
        }
        revalidatePath('/admin/dashboard/template-library');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
