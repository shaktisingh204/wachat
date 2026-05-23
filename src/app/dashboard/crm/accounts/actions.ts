'use server';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

export async function getAccountScore(accountId: string) {
    const session = await getSession();
    if (!session?.user) return { score: 0, reason: 'unauthorized', totalDealValue: 0, interactionsCount: 0 };

    const { db } = await connectToDatabase();
    
    // open deal values
    const openDeals = await db.collection('crm_deals').find({
        accountId: new ObjectId(accountId),
        status: { $nin: ['won', 'lost'] }
    }).toArray();
    
    let totalDealValue = 0;
    openDeals.forEach(d => totalDealValue += (Number(d.amount) || 0));
    
    const account = await db.collection('crm_accounts').findOne({_id: new ObjectId(accountId)});
    const notesCount = Array.isArray(account?.notes) ? account.notes.length : 0;
    
    const tasksCount = await db.collection('crm_tasks').countDocuments({
         $or: [
             { 'linkedEntity.id': new ObjectId(accountId) },
             { 'linkedEntity.id': accountId },
             { accountId: new ObjectId(accountId) }
         ],
         status: 'completed'
    });
    
    let score = 0;
    score += notesCount * 5;
    score += tasksCount * 10;
    score += Math.floor(totalDealValue / 10000);
    
    return {
        score: Math.min(100, score),
        totalDealValue,
        interactionsCount: notesCount + tasksCount
    };
}

export async function getAccountOrgChart(accountId: string) {
    const session = await getSession();
    if (!session?.user) return [];

    const { db } = await connectToDatabase();
    const contacts = await db.collection('crm_contacts').find({
        accountId: new ObjectId(accountId)
    }).toArray();
    
    return JSON.parse(JSON.stringify(contacts));
}

export async function mergeAccounts(primaryId: string, secondaryId: string) {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Unauthorized' };

    try {
        const { db } = await connectToDatabase();
        const pId = new ObjectId(primaryId);
        const sId = new ObjectId(secondaryId);

        // Update all related entities
        await db.collection('crm_contacts').updateMany({ accountId: sId }, { $set: { accountId: pId } });
        await db.collection('crm_deals').updateMany({ accountId: sId }, { $set: { accountId: pId } });
        await db.collection('crm_invoices').updateMany({ accountId: sId }, { $set: { accountId: pId } });
        await db.collection('crm_invoices').updateMany({ clientId: sId }, { $set: { clientId: pId } });
        await db.collection('crm_quotations').updateMany({ accountId: sId }, { $set: { accountId: pId } });
        await db.collection('crm_quotations').updateMany({ clientId: sId }, { $set: { clientId: pId } });
        await db.collection('crm_tickets').updateMany({ accountId: sId }, { $set: { accountId: pId } });
        
        // Mark secondary as archived
        await db.collection('crm_accounts').updateOne(
            { _id: sId }, 
            { $set: { status: 'archived', mergedInto: pId, updatedAt: new Date() } }
        );
        
        revalidatePath('/dashboard/crm/accounts');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function enrichAccountData(accountId: string, domain: string) {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Unauthorized' };
    
    if (!domain) return { success: false, error: 'No website/domain provided' };

    try {
        const { db } = await connectToDatabase();
        
        // Mock enrichment implementation
        const enrichment = {
            logoUrl: `https://logo.clearbit.com/${domain}`,
            employeeCount: Math.floor(Math.random() * 500) + 10,
            annualRevenue: (Math.floor(Math.random() * 100) + 1) * 1000000,
            industry: 'Technology',
        };
        
        await db.collection('crm_accounts').updateOne(
            { _id: new ObjectId(accountId) },
            { $set: enrichment }
        );
        
        revalidatePath(`/dashboard/crm/accounts/${accountId}`);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
