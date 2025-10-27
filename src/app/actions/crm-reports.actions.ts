

'use server';

import { getSession } from '@/app/actions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId, type WithId } from 'mongodb';
import type { CrmAccount, CrmContact, CrmDeal, CrmPipeline } from '@/lib/definitions';

export async function generateClientReportData(): Promise<{ success: boolean; data?: any[]; error?: string }> {
    const session = await getSession();
    if (!session?.user) {
        return { success: false, error: 'Authentication required.' };
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const accounts = await db.collection<CrmAccount>('crm_accounts').find({ userId: userObjectId }).toArray();
        const contacts = await db.collection<CrmContact>('crm_contacts').find({ userId: userObjectId }).toArray();
        
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


export async function getLeadsSummaryData(filters: {
    pipelineId?: string;
    leadSource?: string;
    assigneeId?: string;
    createdFrom?: Date;
    createdTo?: Date;
}): Promise<any> {
    const session = await getSession();
    if (!session?.user) return null;

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        
        // Base filters for all queries
        const baseDealFilter: any = { userId };

        // For now, we are not applying the filters from the UI, but this is where they would go.
        // if (filters.pipelineId) ...
        // if (filters.leadSource) ...
        // etc.
        
        const deals = await db.collection<CrmDeal>('crm_deals').find(baseDealFilter).toArray();

        // 1. Summary Cards Data
        const newLeads = deals.filter(d => d.stage === 'New' || d.stage === 'Open').length;
        const closedLeads = deals.filter(d => d.stage === 'Won' || d.stage === 'Lost').length;
        // Mocking scheduled/overdue as they depend on Tasks which are not linked yet.
        const scheduledLeads = 0; 
        const overdueLeads = 0;

        // 2. Pipeline Stage Summary & Chart Data
        const pipelines = session.user.crmPipelines || [{ id: 'default', name: 'Sales Pipeline', stages: [{id: '1', name:'Open', chance: 10}, {id: '2', name:'Contacted', chance: 20}, {id: '3', name:'Proposal Sent', chance: 50}, {id: '4', name:'Deal Done', chance: 100}, {id: '5', name:'Lost', chance: 0}, {id: '6', name:'Not Serviceable', chance: 0}] }];
        const activePipeline = pipelines.find(p => p.id === (filters.pipelineId || pipelines[0].id)) || pipelines[0];

        const pipelineSummary = activePipeline.stages.map(stage => {
            const dealsInStage = deals.filter(d => d.stage === stage.name);
            const totalValue = dealsInStage.reduce((sum, d) => sum + d.value, 0);
            const weightedValue = totalValue * (stage.chance / 100);
            return {
                name: stage.name,
                leadCount: dealsInStage.length,
                totalValue,
                weightedValue,
            };
        });

        // 3. Data for filters
        const leadSources = [...new Set(deals.map(d => d.leadSource).filter(Boolean))];
        const assignees = [...new Set(deals.map(d => d.ownerId).filter(Boolean))]; // Needs user collection join to get names

        return {
            summary: {
                newLeads,
                scheduledLeads,
                overdueLeads,
                closedLeads,
            },
            pipelineSummary,
            filtersData: {
                pipelines,
                leadSources,
                assignees: [{_id: session.user._id, name: "You"}] // Mocked
            }
        };

    } catch (e) {
        console.error("Failed to fetch leads summary data:", e);
        return null;
    }
}

