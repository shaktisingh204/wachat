'use server';

import { ObjectId, type Filter, type Document } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { requireClient } from '@/lib/client-portal/db';

export async function submitArticleFeedback(articleId: string, helpful: boolean) {
    const ctx = await requireClient();
    if (!ctx) return { error: 'Access denied.' };

    try {
        const { db } = await connectToDatabase();
        const articleObjId = new ObjectId(articleId);
        
        await db.collection('crm_kb_article_feedback').updateOne(
            { articleId: articleObjId, clientId: ctx.userId },
            { 
                $set: { 
                    helpful, 
                    updatedAt: new Date() 
                },
                $setOnInsert: {
                    createdAt: new Date()
                }
            },
            { upsert: true }
        );
        
        return { ok: true };
    } catch (e) {
        return { error: 'Failed to submit feedback' };
    }
}
