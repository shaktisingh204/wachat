
'use server';

import { getSession } from '@/app/actions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId, type WithId, Filter } from 'mongodb';
import type { CrmAccount, CrmContact, CrmDeal, CrmPipeline, User, EcommProduct, CrmInvoice, CrmCreditNote, CrmWarehouse, ProductBatch, CrmSalesOrder } from '@/lib/definitions';

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

export async function generateProductPnlData(filters?: any): Promise<{data: any[], error?: string}> {
    const session = await getSession();
    if (!session?.user) return { data: [], error: 'Authentication required.' };
    
    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const [products, invoices, creditNotes] = await Promise.all([
            db.collection<EcommProduct>('crm_products').find({ userId }).toArray(),
            db.collection<CrmInvoice>('crm_invoices').find({ userId }).toArray(),
            db.collection<CrmCreditNote>('crm_credit_notes').find({ userId }).toArray(),
        ]);
        
        const salesData: Record<string, { totalSoldQty: number; totalRevenue: number; }> = {};
        for(const invoice of invoices) {
            for(const item of invoice.lineItems) {
                // Assuming item.name is unique for now. A product ID would be better.
                if(!salesData[item.name]) salesData[item.name] = { totalSoldQty: 0, totalRevenue: 0 };
                salesData[item.name].totalSoldQty += item.quantity;
                salesData[item.name].totalRevenue += item.quantity * item.rate;
            }
        }
        
        const returnData: Record<string, { totalReturnedQty: number }> = {};
        for(const note of creditNotes) {
            for(const item of note.lineItems) {
                 if(!returnData[item.name]) returnData[item.name] = { totalReturnedQty: 0 };
                 returnData[item.name].totalReturnedQty += item.quantity;
            }
        }

        const report = products.map(product => {
            const sale = salesData[product.name] || { totalSoldQty: 0, totalRevenue: 0 };
            const returns = returnData[product.name] || { totalReturnedQty: 0 };
            const netSoldQty = sale.totalSoldQty - returns.totalReturnedQty;
            const totalCogs = netSoldQty * (product.buyingPrice || 0);
            const grossProfit = sale.totalRevenue - totalCogs; // Simplified: ignores returns for now
            
            return {
                productId: product._id.toString(),
                productName: product.name,
                sku: product.sku || 'N/A',
                totalSoldQty: sale.totalSoldQty,
                totalReturnedQty: returns.totalReturnedQty,
                netSoldQty: netSoldQty,
                totalRevenue: sale.totalRevenue,
                avgSellingPrice: netSoldQty > 0 ? sale.totalRevenue / netSoldQty : 0,
                totalCogs,
                grossProfit,
                grossMargin: sale.totalRevenue > 0 ? (grossProfit / sale.totalRevenue) * 100 : 0
            }
        }).filter(item => item.totalSoldQty > 0 || item.totalReturnedQty > 0);

        return { data: JSON.parse(JSON.stringify(report)) };
    } catch(e: any) {
        console.error("Error generating product P&L report:", e);
        return { data: [], error: 'Failed to generate report.' };
    }
}

export async function generateStockValueReport(): Promise<{ data: any[], summary: any, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { data: [], summary: {}, error: 'Authentication required.' };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const [products, warehouses] = await Promise.all([
            db.collection<EcommProduct>('crm_products').find({ userId, manageStock: true }).toArray(),
            db.collection<CrmWarehouse>('crm_warehouses').find({ userId }).toArray()
        ]);
        
        const warehouseMap = new Map(warehouses.map(w => [w._id.toString(), w.name]));
        
        const reportData: any[] = [];
        let totalValue = 0;
        let totalUnits = 0;
        let uniqueProductCount = 0;

        for (const product of products) {
            const buyingPrice = product.buyingPrice || 0;
            let productHasStock = false;
            if (product.inventory && product.inventory.length > 0) {
                for (const inv of product.inventory) {
                    if (inv.stock > 0) {
                        const stockValue = inv.stock * buyingPrice;
                        reportData.push({
                            productId: product._id.toString(),
                            productName: product.name,
                            sku: product.sku,
                            warehouseId: inv.warehouseId.toString(),
                            warehouseName: warehouseMap.get(inv.warehouseId.toString()) || 'Unknown',
                            stock: inv.stock,
                            buyingPrice,
                            stockValue,
                        });
                        totalValue += stockValue;
                        totalUnits += inv.stock;
                        productHasStock = true;
                    }
                }
            } else if ((product.stock || 0) > 0) {
                // Fallback for legacy stock field
                const stockValue = (product.stock || 0) * buyingPrice;
                reportData.push({
                    productId: product._id.toString(),
                    productName: product.name,
                    sku: product.sku,
                    warehouseName: 'Default',
                    stock: product.stock,
                    buyingPrice,
                    stockValue,
                });
                totalValue += stockValue;
                totalUnits += product.stock!;
                productHasStock = true;
            }
            if (productHasStock) {
                uniqueProductCount++;
            }
        }
        
        return {
            data: JSON.parse(JSON.stringify(reportData)),
            summary: {
                totalValue,
                totalUnits,
                productCount: uniqueProductCount,
            },
        };

    } catch (e: any) {
        console.error("Error generating stock value report:", e);
        return { data: [], summary: {}, error: 'Failed to generate report.' };
    }
}

export async function generateBatchExpiryReportData(): Promise<{ data?: any, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const products = await db.collection<EcommProduct>('crm_products')
            .find({ userId, batchTracking: true, batches: { $exists: true, $ne: [] } })
            .toArray();

        const now = new Date();
        const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const sixtyDays = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
        const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
        
        const report = {
            expired: [] as any[],
            expiringIn30: [] as any[],
            expiringIn60: [] as any[],
            expiringIn90: [] as any[],
            safe: [] as any[],
        };

        for (const product of products) {
            for (const batch of product.batches || []) {
                if (!batch.expiryDate) continue;

                const expiry = new Date(batch.expiryDate);
                const baseInfo = {
                    productId: product._id.toString(),
                    productName: product.name,
                    sku: product.sku,
                    batchId: batch.id,
                    batchNumber: batch.batchNumber,
                    stock: batch.stock,
                    expiryDate: expiry,
                };
                
                if (expiry < now) {
                    report.expired.push(baseInfo);
                } else if (expiry <= thirtyDays) {
                    report.expiringIn30.push(baseInfo);
                } else if (expiry <= sixtyDays) {
                    report.expiringIn60.push(baseInfo);
                } else if (expiry <= ninetyDays) {
                    report.expiringIn90.push(baseInfo);
                } else {
                    report.safe.push(baseInfo);
                }
            }
        }
        
        return { data: JSON.parse(JSON.stringify(report)) };

    } catch (e: any) {
        console.error("Error generating batch expiry report:", e);
        return { error: 'Failed to generate report data.' };
    }
}

export async function getCrmAccountsForSelection(): Promise<{_id: string, name: string}[]> {
    const session = await getSession();
    if (!session?.user) return [];
    const { db } = await connectToDatabase();
    const accounts = await db.collection('crm_accounts').find({ userId: new ObjectId(session.user._id) }, { projection: { name: 1 } }).toArray();
    return JSON.parse(JSON.stringify(accounts));
}

export async function getCrmVendorsForSelection(): Promise<{_id: string, name: string}[]> {
    const session = await getSession();
    if (!session?.user) return [];
    const { db } = await connectToDatabase();
    const vendors = await db.collection('crm_vendors').find({ userId: new ObjectId(session.user._id) }, { projection: { name: 1 } }).toArray();
    return JSON.parse(JSON.stringify(vendors));
}

export async function generatePartyTransactionReport(partyId: string, partyType: 'customer' | 'vendor', startDate?: Date, endDate?: Date): Promise<{data: any[], error?: string}> {
    const session = await getSession();
    if (!session?.user) return { data: [], error: 'Authentication required.' };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const partyObjectId = new ObjectId(partyId);

        let transactions: any[] = [];
        const dateFilter = (startDate || endDate) ? { 
            date: { 
                ...(startDate && { $gte: startDate }),
                ...(endDate && { $lte: endDate })
            }
        } : {};

        if (partyType === 'customer') {
            const invoices = await db.collection<CrmInvoice>('crm_invoices').find({ userId, accountId: partyObjectId, ...dateFilter }).toArray();
            const creditNotes = await db.collection<CrmCreditNote>('crm_credit_notes').find({ userId, accountId: partyObjectId, ...dateFilter }).toArray();
            
            invoices.forEach(inv => {
                inv.lineItems.forEach(item => {
                    transactions.push({ date: inv.invoiceDate, type: 'Sale', reference: inv.invoiceNumber, itemName: item.name, quantity: item.quantity, rate: item.rate });
                });
            });
            creditNotes.forEach(cn => {
                cn.lineItems.forEach(item => {
                    transactions.push({ date: cn.creditNoteDate, type: 'Sales Return', reference: cn.creditNoteNumber, itemName: item.name, quantity: -item.quantity, rate: item.rate });
                });
            });

        } else { // partyType === 'vendor'
            // Placeholder for when Purchase Orders and Bills are implemented
        }

        transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        return { data: JSON.parse(JSON.stringify(transactions)) };

    } catch (e: any) {
        console.error("Error generating party transaction report:", e);
        return { data: [], error: 'Failed to generate report.' };
    }
}

    