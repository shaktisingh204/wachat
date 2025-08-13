
'use server';

import { getSession } from '@/app/actions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import type { CrmAccount, CrmContact } from '@/lib/definitions';

export async function generateClientReportData(): Promise<{ success: boolean; data?: any[]; error?: string }> {
    const session = await getSession();
    if (!session?.user) {
        return { success: false, error: 'Authentication required.' };
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const [accounts, contacts] = await Promise.all([
            db.collection<CrmAccount>('crm_accounts').find({ userId: userObjectId }).toArray(),
            db.collection<CrmContact>('crm_contacts').find({ userId: userObjectId }).toArray(),
        ]);
        
        const contactsByAccountId: { [key: string]: CrmContact[] } = {};
        for (const contact of contacts) {
            if (contact.accountId) {
                const accountIdStr = contact.accountId.toString();
                if (!contactsByAccountId[accountIdStr]) {
                    contactsByAccountId[accountIdStr] = [];
                }
                contactsByAccountId[accountIdStr].push(contact);
            }
        }

        const reportData = accounts.map(account => {
            const primaryContact = contactsByAccountId[account._id.toString()]?.[0];
            return {
                'Account Name': account.name,
                'Industry': account.industry,
                'Website': account.website,
                'Account Phone': account.phone,
                'Primary Contact Name': primaryContact?.name,
                'Primary Contact Email': primaryContact?.email,
                'Primary Contact Phone': primaryContact?.phone,
                'Account Created At': account.createdAt.toISOString(),
            };
        });
        
        return { success: true, data: reportData };
    } catch (e: any) {
        console.error("Failed to generate client report:", e);
        return { success: false, error: 'Failed to generate report data.' };
    }
}
