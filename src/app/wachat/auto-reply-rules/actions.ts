'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

export async function updateAutoReplyRuleOrder(ruleIds: string[]) {
    try {
        const { db } = await connectToDatabase();
        
        // Update the priority of each rule based on its index
        const bulkOps = ruleIds.map((id, index) => ({
            updateOne: {
                filter: { _id: new ObjectId(id) },
                update: { $set: { priority: index } }
            }
        }));

        if (bulkOps.length > 0) {
            await db.collection('wa_auto_reply_rules').bulkWrite(bulkOps);
        }

        revalidatePath('/wachat/auto-reply-rules');
        return { success: true };
    } catch (e: any) {
        console.error('Failed to update rule order:', e);
        return { success: false, error: e.message };
    }
}
