

'use server';

import { getSession } from '@/app/actions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId, type WithId, Filter } from 'mongodb';
import type { CrmAccount, CrmContact, CrmDeal, CrmPipeline, User } from '@/lib/definitions';

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
        
        const baseDealFilter: Filter<CrmDeal> = { userId };
        if (filters.leadSource) baseDealFilter.leadSource = filters.leadSource;
        if (filters.assigneeId) baseDealFilter.ownerId = new ObjectId(filters.assigneeId);
        if (filters.createdFrom && filters.createdTo) {
            baseDealFilter.createdAt = { $gte: filters.createdFrom, $lte: filters.createdTo };
        }
        
        const deals = await db.collection<CrmDeal>('crm_deals').find(baseDealFilter).toArray();

        const newLeads = deals.filter(d => d.stage === 'New' || d.stage === 'Open').length;
        const closedLeads = deals.filter(d => d.stage === 'Won' || d.stage === 'Lost').length;
        const scheduledLeads = 0; 
        const overdueLeads = 0;

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

        const allUsersUnderAccount = await db.collection<User>('users').find({}).project({ name: 1 }).toArray();

        const leadSources = (await db.collection('crm_deals').distinct('leadSource', { userId })) as string[];

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
                assignees: allUsersUnderAccount.map(u => ({_id: u._id.toString(), name: u.name })),
            }
        };

    } catch (e) {
        console.error("Failed to fetch leads summary data:", e);
        return null;
    }
}


export async function generateTeamSalesReportData(filters: {
    createdFrom?: Date;
    createdTo?: Date;
    pipelineId?: string;
    leadSource?: string;
    assigneeId?: string;
}): Promise<{data: any[], users: any[]}> {
    const session = await getSession();
    if (!session?.user) {
        return { data: [], users: [] };
    }

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const currentUser = await db.collection<User>('users').findOne({ _id: userId }, { projection: { name: 1, email: 1 } });
        const users = currentUser ? [currentUser] : [];

        const dealsFilter: Filter<CrmDeal> = { userId };
        if (filters.createdFrom && filters.createdTo) {
            dealsFilter.createdAt = { $gte: filters.createdFrom, $lte: filters.createdTo };
        }
        if (filters.assigneeId) {
            dealsFilter.ownerId = new ObjectId(filters.assigneeId);
        }
        
        const deals = await db.collection<CrmDeal>('crm_deals').find(dealsFilter).toArray();

        const report = users.map(user => {
            const userDeals = deals.filter(d => d.ownerId?.toString() === user._id.toString());
            const totalLeads = userDeals.length;
            const openLeads = userDeals.filter(d => !['Won', 'Lost', 'Not Serviceable'].includes(d.stage)).length;
            const closedLeads = userDeals.filter(d => d.stage === 'Won').length;
            const lostLeads = userDeals.filter(d => d.stage === 'Lost').length;
            const notServiceable = userDeals.filter(d => d.stage === 'Not Serviceable').length;
            const totalRevenue = closedLeads > 0 ? userDeals.filter(d => d.stage === 'Won').reduce((sum, d) => sum + d.value, 0) : 0;

            return {
                salespersonId: user._id.toString(),
                salespersonName: user.name,
                salespersonEmail: user.email,
                totalLeads,
                openLeads,
                closedLeads,
                lostLeads,
                notServiceable,
                conversionRate: (closedLeads + lostLeads) > 0 ? (closedLeads / (closedLeads + lostLeads)) * 100 : 0,
                avgClosureTime: 0, // Placeholder
                firstResponseMedian: 0, // Placeholder
                totalRevenue,
                avgDealValue: closedLeads > 0 ? totalRevenue / closedLeads : 0,
            };
        });

        return { data: JSON.parse(JSON.stringify(report)), users: JSON.parse(JSON.stringify(users)) };
    } catch (e) {
        console.error("Error generating team sales report:", e);
        return { data: [], users: [] };
    }
}

export async function generateClientPerformanceReportData(filters: {
    createdFrom?: Date;
    createdTo?: Date;
    pipelineId?: string;
    assigneeId?: string;
}): Promise<any[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const accounts = await db.collection<CrmAccount>('crm_accounts').find({ userId }).toArray();
        const accountIds = accounts.map(a => a._id);

        const dealsFilter: Filter<CrmDeal> = { userId, accountId: { $in: accountIds } };
        if (filters.createdFrom && filters.createdTo) {
            dealsFilter.createdAt = { $gte: filters.createdFrom, $lte: filters.createdTo };
        }
        if (filters.assigneeId) {
            dealsFilter.ownerId = new ObjectId(filters.assigneeId);
        }

        const deals = await db.collection<CrmDeal>('crm_deals').find(dealsFilter).toArray();
        
        const report = accounts.map(account => {
            const accountDeals = deals.filter(d => d.accountId?.equals(account._id));
            
            const totalLeads = accountDeals.length;
            const openLeads = accountDeals.filter(d => !['Won', 'Lost', 'Not Serviceable'].includes(d.stage)).length;
            const closedLeads = accountDeals.filter(d => d.stage === 'Won').length;
            const lostLeads = accountDeals.filter(d => d.stage === 'Lost').length;
            const notServiceable = accountDeals.filter(d => d.stage === 'Not Serviceable').length;
            
            const totalRevenue = closedLeads > 0 
                ? accountDeals.filter(d => d.stage === 'Won').reduce((sum, d) => sum + d.value, 0) 
                : 0;

            const conversionRate = (closedLeads + lostLeads) > 0 ? (closedLeads / (closedLeads + lostLeads)) * 100 : 0;
            const avgDealValue = closedLeads > 0 ? totalRevenue / closedLeads : 0;
            const lastLeadActivityOn = accountDeals.length > 0 
                ? new Date(Math.max(...accountDeals.map(d => new Date(d.updatedAt || d.createdAt).getTime()))) 
                : null;
            
            return {
                clientId: account._id.toString(),
                clientName: account.name,
                totalRevenue,
                leadConversionRate: conversionRate,
                leadsGenerated: totalLeads,
                openLeads,
                closedLeads,
                lostLeads,
                notServiceable,
                avgDealValue,
                lastLeadActivityOn,
            };
        });

        return JSON.parse(JSON.stringify(report));

    } catch (e) {
        console.error("Error generating client performance report:", e);
        return [];
    }
}

export async function generateLeadSourceReportData(filters: {
    createdFrom?: Date;
    createdTo?: Date;
    pipelineId?: string;
    assigneeId?: string;
}): Promise<any[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const dealsFilter: Filter<CrmDeal> = { userId };
        if (filters.createdFrom && filters.createdTo) {
            dealsFilter.createdAt = { $gte: filters.createdFrom, $lte: filters.createdTo };
        }
        if (filters.assigneeId) {
            dealsFilter.ownerId = new ObjectId(filters.assigneeId);
        }

        const deals = await db.collection<CrmDeal>('crm_deals').find(dealsFilter).toArray();
        
        const reportMap = new Map<string, any>();

        for (const deal of deals) {
            const source = deal.leadSource || 'Unknown';
            if (!reportMap.has(source)) {
                reportMap.set(source, {
                    leadSource: source,
                    totalRevenue: 0,
                    leadsGenerated: 0,
                    openLeads: 0,
                    closedLeads: 0,
                    lostLeads: 0,
                    notServiceable: 0,
                });
            }

            const entry = reportMap.get(source);
            entry.leadsGenerated++;

            if (deal.stage === 'Won') {
                entry.closedLeads++;
                entry.totalRevenue += deal.value;
            } else if (deal.stage === 'Lost') {
                entry.lostLeads++;
            } else if (deal.stage === 'Not Serviceable') {
                entry.notServiceable++;
            } else {
                entry.openLeads++;
            }
        }

        const report = Array.from(reportMap.values()).map(entry => ({
            ...entry,
            leadConversionRate: (entry.closedLeads + entry.lostLeads) > 0 ? (entry.closedLeads / (entry.closedLeads + entry.lostLeads)) * 100 : 0,
            avgDealValue: entry.closedLeads > 0 ? entry.totalRevenue / entry.closedLeads : 0,
            avgLeadClosureTime: 0 // Placeholder
        }));

        return JSON.parse(JSON.stringify(report));

    } catch (e) {
        console.error("Error generating lead source report:", e);
        return [];
    }
}
