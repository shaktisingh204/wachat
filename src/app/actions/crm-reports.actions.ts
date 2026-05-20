'use server';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId, type WithId, Filter } from 'mongodb';
import type { CrmAccount, CrmContact, CrmDeal, CrmPipeline, User, EcommProduct, CrmInvoice, CrmCreditNote, CrmWarehouse, ProductBatch, CrmSalesOrder, CrmStockAdjustment } from '@/lib/definitions';

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

        const baseDealFilter: any = { userId };
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

        const pipelines = session.user.crmPipelines || [{ id: 'default', name: 'Sales Pipeline', stages: [{ id: '1', name: 'Open', chance: 10 }, { id: '2', name: 'Contacted', chance: 20 }, { id: '3', name: 'Proposal Sent', chance: 50 }, { id: '4', name: 'Deal Done', chance: 100 }, { id: '5', name: 'Lost', chance: 0 }, { id: '6', name: 'Not Serviceable', chance: 0 }] }];
        const activePipeline = pipelines.find((p: any) => p.id === (filters.pipelineId || pipelines[0].id)) || pipelines[0];

        const pipelineSummary = activePipeline.stages.map((stage: any) => {
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
                assignees: allUsersUnderAccount.map(u => ({ _id: u._id.toString(), name: u.name })),
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
}): Promise<{ data: any[], users: any[] }> {
    const session = await getSession();
    if (!session?.user) {
        return { data: [], users: [] };
    }

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const currentUser = await db.collection<User>('users').findOne({ _id: userId }, { projection: { name: 1, email: 1 } });
        const users = currentUser ? [currentUser] : [];

        const dealsFilter: any = { userId };
        if (filters.createdFrom || filters.createdTo) {
            dealsFilter.createdAt = {};
            if (filters.createdFrom) dealsFilter.createdAt.$gte = filters.createdFrom;
            if (filters.createdTo) {
                const end = new Date(filters.createdTo);
                end.setHours(23, 59, 59, 999);
                dealsFilter.createdAt.$lte = end;
            }
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

        const dealsFilter: any = { userId, accountId: { $in: accountIds } };
        if (filters.createdFrom || filters.createdTo) {
            dealsFilter.createdAt = {};
            if (filters.createdFrom) dealsFilter.createdAt.$gte = filters.createdFrom;
            if (filters.createdTo) {
                const end = new Date(filters.createdTo);
                end.setHours(23, 59, 59, 999);
                dealsFilter.createdAt.$lte = end;
            }
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

        const dealsFilter: any = { userId };
        if (filters.createdFrom || filters.createdTo) {
            dealsFilter.createdAt = {};
            if (filters.createdFrom) dealsFilter.createdAt.$gte = filters.createdFrom;
            if (filters.createdTo) {
                const end = new Date(filters.createdTo);
                end.setHours(23, 59, 59, 999);
                dealsFilter.createdAt.$lte = end;
            }
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

export async function generateProductPnlData(filters?: any): Promise<{ data: any[], error?: string }> {
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
        for (const invoice of invoices) {
            for (const item of invoice.lineItems) {
                // Assuming item.name is unique for now. A product ID would be better.
                if (!salesData[item.name]) salesData[item.name] = { totalSoldQty: 0, totalRevenue: 0 };
                salesData[item.name].totalSoldQty += item.quantity;
                salesData[item.name].totalRevenue += item.quantity * item.rate;
            }
        }

        const returnData: Record<string, { totalReturnedQty: number }> = {};
        for (const note of creditNotes) {
            for (const item of note.lineItems) {
                if (!returnData[item.name]) returnData[item.name] = { totalReturnedQty: 0 };
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
    } catch (e: any) {
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
            const valuationPrice = product.buyingPrice || product.price || 0;
            let productHasStock = false;
            if (product.inventory && product.inventory.length > 0) {
                for (const inv of product.inventory) {
                    if (inv.stock > 0) {
                        const stockValue = inv.stock * valuationPrice;
                        reportData.push({
                            productId: product._id.toString(),
                            productName: product.name,
                            sku: product.sku,
                            warehouseId: inv.warehouseId.toString(),
                            warehouseName: warehouseMap.get(inv.warehouseId.toString()) || 'Unknown',
                            stock: inv.stock,
                            unitCost: valuationPrice,
                            stockValue,
                        });
                        totalValue += stockValue;
                        totalUnits += inv.stock;
                        productHasStock = true;
                    }
                }
            } else if ((product.stock || 0) > 0) {
                // Fallback for legacy stock field
                const stockValue = (product.stock || 0) * valuationPrice;
                reportData.push({
                    productId: product._id.toString(),
                    productName: product.name,
                    sku: product.sku,
                    warehouseName: 'Default',
                    stock: product.stock,
                    unitCost: valuationPrice,
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

export async function getCrmAccountsForSelection(): Promise<{ _id: string, name: string }[]> {
    const session = await getSession();
    if (!session?.user) return [];
    const { db } = await connectToDatabase();
    const accounts = await db.collection('crm_accounts').find({ userId: new ObjectId(session.user._id) }, { projection: { name: 1 } }).toArray();
    return JSON.parse(JSON.stringify(accounts));
}

export async function getCrmVendorsForSelection(): Promise<{ _id: string, name: string }[]> {
    const session = await getSession();
    if (!session?.user) return [];
    const { db } = await connectToDatabase();
    const vendors = await db.collection('crm_vendors').find({ userId: new ObjectId(session.user._id) }, { projection: { name: 1 } }).toArray();
    return JSON.parse(JSON.stringify(vendors));
}

export async function generatePartyTransactionReport(partyId: string, partyType: 'customer' | 'vendor', startDate?: Date, endDate?: Date): Promise<{ data: any[], error?: string }> {
    const session = await getSession();
    if (!session?.user) return { data: [], error: 'Authentication required.' };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const partyObjectId = new ObjectId(partyId);

        let transactions: any[] = [];

        // Correct date query construction
        const dateQuery: any = {};
        if (startDate) {
            dateQuery.$gte = startDate;
        }
        if (endDate) {
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59, 999);
            dateQuery.$lte = endOfDay;
        }

        const hasDateFilter = Object.keys(dateQuery).length > 0;

        if (partyType === 'customer') {
            const invoiceFilter: any = { userId, accountId: partyObjectId };
            if (hasDateFilter) {
                invoiceFilter.invoiceDate = dateQuery;
            }

            const creditNoteFilter: any = { userId, accountId: partyObjectId };
            if (hasDateFilter) {
                creditNoteFilter.creditNoteDate = dateQuery;
            }

            const invoices = await db.collection<CrmInvoice>('crm_invoices').find(invoiceFilter).toArray();
            const creditNotes = await db.collection<CrmCreditNote>('crm_credit_notes').find(creditNoteFilter).toArray();

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

export async function generateAllTransactionsReport(filters: {
    startDate?: Date;
    endDate?: Date;
    type?: string;
}): Promise<{ data: any[], error?: string }> {
    const session = await getSession();
    if (!session?.user) return { data: [], error: 'Authentication required.' };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        let transactions: any[] = [];

        const dateFilter = (filters.startDate || filters.endDate) ? {
            date: {
                ...(filters.startDate && { $gte: new Date(filters.startDate) }),
                ...(filters.endDate && { $lte: new Date(filters.endDate) }),
            },
        } : {};

        const [invoices, creditNotes, adjustments, accounts, warehouses] = await Promise.all([
            db.collection<CrmInvoice>('crm_invoices').find({ userId, ...(dateFilter.date && { invoiceDate: dateFilter.date }) }).toArray(),
            db.collection<CrmCreditNote>('crm_credit_notes').find({ userId, ...(dateFilter.date && { creditNoteDate: dateFilter.date }) }).toArray(),
            db.collection<CrmStockAdjustment>('crm_stock_adjustments').find({ userId, ...dateFilter }).toArray(),
            db.collection<CrmAccount>('crm_accounts').find({ userId }).project({ name: 1 }).toArray(),
            db.collection<CrmWarehouse>('crm_warehouses').find({ userId }).project({ name: 1 }).toArray(),
        ]);

        const accountsMap = new Map(accounts.map(a => [a._id.toString(), a.name]));
        const warehouseMap = new Map(warehouses.map(w => [w._id.toString(), w.name]));

        if (!filters.type || filters.type === 'Sale') {
            invoices.forEach(inv => inv.lineItems.forEach(item => {
                transactions.push({ date: inv.invoiceDate, type: 'Sale', itemName: item.name, quantity: -item.quantity, reference: inv.invoiceNumber, partyName: accountsMap.get(inv.accountId.toString()) });
            }));
        }

        if (!filters.type || filters.type === 'Sales Return') {
            creditNotes.forEach(note => note.lineItems.forEach(item => {
                transactions.push({ date: note.creditNoteDate, type: 'Sales Return', itemName: item.name, quantity: item.quantity, reference: note.creditNoteNumber, partyName: accountsMap.get(note.accountId.toString()) });
            }));
        }

        if (!filters.type || filters.type === 'Stock Adjustment') {
            adjustments.forEach(adj => {
                // We need to fetch the product name for the adjustment
                transactions.push({
                    date: adj.date,
                    type: 'Stock Adjustment',
                    itemName: `Product ID: ${adj.productId.toString()}`, // Placeholder
                    quantity: adj.quantity,
                    reference: adj.reason,
                    warehouseName: warehouseMap.get(adj.warehouseId.toString()),
                    partyName: null,
                });
            });
        }

        transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return { data: JSON.parse(JSON.stringify(transactions)) };

    } catch (e: any) {
        console.error("Error generating all transactions report:", e);
        return { data: [], error: 'Failed to generate report.' };
    }
}

/* ════════════════════════════════════════════════════════════════════════
 *  §6.8 Unified Reports Engine — definitions, runs, and dispatch.
 *
 *  Backs `src/lib/reports/engine.ts`. Two collections:
 *
 *    • `crm_report_definitions` — saved configs (filters, schedule,
 *      delivery). One per `{ userId, name }`. Created on demand.
 *    • `crm_report_runs`         — append-only audit log of executions
 *      with captured columns/rows + delivery outcome.
 *
 *  RBAC: gated on `crm_reports` (plural) — the existing permission
 *  module key registered in `src/lib/permission-modules.ts:45`. The
 *  singular `crm_report` key referenced in the §6.8 spec does not yet
 *  exist; documenting and using the plural to avoid silently allowing
 *  unauthorized access.
 * ════════════════════════════════════════════════════════════════════════
 */

import { requirePermission as requirePermissionUnified } from '@/lib/rbac-server';
import {
    runReport as engineRunReport,
    reportResultToCsv,
} from '@/lib/reports/engine';
import type {
    ReportDefinition,
    ReportKind,
    ReportFilter,
    ReportSchedule,
    ReportDelivery,
    ReportRun,
    ReportRunResult,
    ReportRecipient,
} from '@/lib/reports/types';
import { REPORT_KINDS } from '@/lib/reports/types';

/** Plural permission key — see §6.8 RBAC note in the file header. */
const REPORTS_PERMISSION_KEY = 'crm_reports';

/** Trimmed-down doc shape persisted in `crm_report_definitions`. */
export interface ReportDefinitionDoc {
    _id: string;
    userId: string;
    kind: ReportKind;
    name: string;
    description?: string;
    filters?: ReportFilter;
    schedule?: ReportSchedule | null;
    delivery?: ReportDelivery | null;
    recipients?: ReportRecipient[];
    lastRunAt?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface ReportRunDoc {
    _id: string;
    definitionId: string;
    userId: string;
    kind: ReportKind;
    status: ReportRun['status'];
    trigger: ReportRun['trigger'];
    startedAt: string;
    finishedAt?: string | null;
    result?: ReportRunResult;
    error?: string | null;
    delivered?: ReportRun['delivered'];
    rowCount?: number;
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getReportDefinitions(filters?: {
    kind?: ReportKind;
    q?: string;
}): Promise<ReportDefinitionDoc[]> {
    const session = await getSession();
    if (!session?.user) return [];
    const guard = await requirePermissionUnified(REPORTS_PERMISSION_KEY, 'view');
    if (!guard.ok) return [];

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const q: Record<string, unknown> = { userId };
        if (filters?.kind) q.kind = filters.kind;
        if (filters?.q) q.name = { $regex: filters.q, $options: 'i' };

        const docs = await db
            .collection('crm_report_definitions')
            .find(q)
            .sort({ updatedAt: -1 })
            .limit(200)
            .toArray();
        return JSON.parse(JSON.stringify(docs));
    } catch (e) {
        console.error('[getReportDefinitions] failed:', e);
        return [];
    }
}

export async function getReportDefinitionById(
    id: string,
): Promise<ReportDefinitionDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!ObjectId.isValid(id)) return null;
    const guard = await requirePermissionUnified(REPORTS_PERMISSION_KEY, 'view');
    if (!guard.ok) return null;

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_report_definitions').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });
        return doc ? JSON.parse(JSON.stringify(doc)) : null;
    } catch (e) {
        console.error('[getReportDefinitionById] failed:', e);
        return null;
    }
}

export async function getReportRunsForDefinition(
    definitionId: string,
    limit = 50,
): Promise<ReportRunDoc[]> {
    const session = await getSession();
    if (!session?.user) return [];
    if (!ObjectId.isValid(definitionId)) return [];
    const guard = await requirePermissionUnified(REPORTS_PERMISSION_KEY, 'view');
    if (!guard.ok) return [];

    try {
        const { db } = await connectToDatabase();
        const docs = await db
            .collection('crm_report_runs')
            .find({
                definitionId: new ObjectId(definitionId),
                userId: new ObjectId(session.user._id),
            })
            .sort({ startedAt: -1 })
            .limit(Math.min(Math.max(1, limit), 500))
            .toArray();
        return JSON.parse(JSON.stringify(docs));
    } catch (e) {
        console.error('[getReportRunsForDefinition] failed:', e);
        return [];
    }
}

export async function getReportRun(runId: string): Promise<ReportRunDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!ObjectId.isValid(runId)) return null;
    const guard = await requirePermissionUnified(REPORTS_PERMISSION_KEY, 'view');
    if (!guard.ok) return null;

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_report_runs').findOne({
            _id: new ObjectId(runId),
            userId: new ObjectId(session.user._id),
        });
        return doc ? JSON.parse(JSON.stringify(doc)) : null;
    } catch (e) {
        console.error('[getReportRun] failed:', e);
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

function parseJsonField<T>(raw: FormDataEntryValue | null, fallback: T): T {
    if (raw == null) return fallback;
    const s = String(raw).trim();
    if (!s) return fallback;
    try {
        return JSON.parse(s) as T;
    } catch {
        return fallback;
    }
}

export async function saveReportDefinition(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const id = (formData.get('id') as string) || '';
    const isEditing = !!id && ObjectId.isValid(id);
    const guard = await requirePermissionUnified(
        REPORTS_PERMISSION_KEY,
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const kind = String(formData.get('kind') ?? '') as ReportKind;
    const name = String(formData.get('name') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim() || undefined;

    if (!REPORT_KINDS.includes(kind)) return { error: 'Unknown report kind.' };
    if (!name) return { error: 'Name is required.' };

    const filters = parseJsonField<ReportFilter | undefined>(
        formData.get('filters'),
        undefined,
    );
    const schedule = parseJsonField<ReportSchedule | null>(
        formData.get('schedule'),
        null,
    );
    const delivery = parseJsonField<ReportDelivery | null>(
        formData.get('delivery'),
        null,
    );
    const recipients = parseJsonField<ReportRecipient[]>(
        formData.get('recipients'),
        [],
    );

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const now = new Date();

        if (isEditing) {
            await db.collection('crm_report_definitions').updateOne(
                { _id: new ObjectId(id), userId },
                {
                    $set: {
                        kind,
                        name,
                        description,
                        filters,
                        schedule,
                        delivery,
                        recipients,
                        updatedAt: now,
                        updatedBy: userId,
                    },
                },
            );
            return { message: 'Report definition updated.', id };
        }

        const res = await db.collection('crm_report_definitions').insertOne({
            userId,
            kind,
            name,
            description,
            filters,
            schedule,
            delivery,
            recipients,
            lastRunAt: null,
            createdAt: now,
            updatedAt: now,
            createdBy: userId,
            updatedBy: userId,
        } as any);
        return { message: 'Report saved.', id: String(res.insertedId) };
    } catch (e: any) {
        console.error('[saveReportDefinition] failed:', e);
        return { error: 'Failed to save report definition.' };
    }
}

export async function deleteReportDefinition(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!ObjectId.isValid(id))
        return { success: false, error: 'Invalid id.' };
    const guard = await requirePermissionUnified(
        REPORTS_PERMISSION_KEY,
        'delete',
    );
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        await db.collection('crm_report_definitions').deleteOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });
        return { success: true };
    } catch (e: any) {
        console.error('[deleteReportDefinition] failed:', e);
        return { success: false, error: 'Failed to delete.' };
    }
}

/* ─── Run + delivery ─────────────────────────────────────────────────── */

const MAX_PERSISTED_ROWS = 5000;

/**
 * Internal helper — actually runs the definition and writes the result
 * row to `crm_report_runs`. Used by `runReportById` (manual) AND the
 * scheduler (cron).
 */
export async function executeReportDefinition(opts: {
    definition: ReportDefinitionDoc;
    tenantUserId: string;
    trigger: ReportRun['trigger'];
}): Promise<{ runId: string; result: ReportRunResult; delivered: ReportRun['delivered'] }> {
    const { db } = await connectToDatabase();
    const startedAt = new Date();

    // Pre-insert a "running" run doc so concurrent dispatches don't
    // double-execute the same definition (cron + manual race).
    const userObjId = new ObjectId(opts.tenantUserId);
    const defObjId = new ObjectId(String(opts.definition._id));

    const insert = await db.collection('crm_report_runs').insertOne({
        definitionId: defObjId,
        userId: userObjId,
        kind: opts.definition.kind,
        status: 'running',
        trigger: opts.trigger,
        startedAt,
    } as any);
    const runId = String(insert.insertedId);

    const defForEngine: ReportDefinition = {
        _id: String(opts.definition._id),
        userId: opts.tenantUserId,
        kind: opts.definition.kind,
        name: opts.definition.name,
        filters: opts.definition.filters,
        schedule: opts.definition.schedule,
        delivery: opts.definition.delivery,
        recipients: opts.definition.recipients,
    };

    let result: ReportRunResult;
    try {
        result = await engineRunReport(defForEngine, {
            tenantUserId: opts.tenantUserId,
        });
    } catch (e: any) {
        result = {
            columns: [],
            rows: [],
            kind: opts.definition.kind,
            error: e?.message ?? 'engine_threw',
        };
    }

    const finishedAt = new Date();
    const status: ReportRun['status'] = result.error ? 'failed' : 'succeeded';
    const trimmedResult: ReportRunResult = {
        ...result,
        rows: result.rows.slice(0, MAX_PERSISTED_ROWS),
    };

    // Delivery (best-effort; failures are captured in the run doc but
    // don't poison the run itself).
    const delivered = await dispatchDelivery({
        definition: opts.definition,
        result: trimmedResult,
        runId,
    });

    await db.collection('crm_report_runs').updateOne(
        { _id: insert.insertedId },
        {
            $set: {
                status,
                finishedAt,
                result: trimmedResult,
                rowCount: result.rows.length,
                error: result.error ?? null,
                delivered,
            },
        },
    );

    if (status === 'succeeded') {
        await db.collection('crm_report_definitions').updateOne(
            { _id: defObjId, userId: userObjId },
            { $set: { lastRunAt: finishedAt } },
        );
    }

    return { runId, result: trimmedResult, delivered };
}

export async function runReportById(
    id: string,
): Promise<{ runId?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };
    if (!ObjectId.isValid(id)) return { error: 'Invalid id.' };

    const guard = await requirePermissionUnified(
        REPORTS_PERMISSION_KEY,
        'view',
    );
    if (!guard.ok) return { error: guard.error };

    const def = await getReportDefinitionById(id);
    if (!def) return { error: 'Definition not found.' };

    try {
        const { runId } = await executeReportDefinition({
            definition: def,
            tenantUserId: String(session.user._id),
            trigger: 'manual',
        });
        return { runId };
    } catch (e: any) {
        console.error('[runReportById] failed:', e);
        return { error: 'Failed to execute report.' };
    }
}

/* ─── Delivery dispatch ──────────────────────────────────────────────── */

/**
 * Fan-out delivery. `email` is structured-logged + flagged in the run
 * doc as a TODO — no generic transactional-email helper exists yet in
 * this codebase, so a future PR wires in a real transport without
 * touching the engine. `webhook` is fully wired (HTTP POST with JSON).
 */
async function dispatchDelivery(opts: {
    definition: ReportDefinitionDoc;
    result: ReportRunResult;
    runId: string;
}): Promise<ReportRun['delivered']> {
    const delivered: ReportRun['delivered'] = {};
    const d = opts.definition.delivery;
    if (!d) return delivered;

    // ── email (stubbed — no global mailer in this codebase) ──────────
    if (d.email && Array.isArray(d.email.to) && d.email.to.length > 0) {
        try {
            const csv = reportResultToCsv(opts.result);
            // Intentional: structured log only. A future
            // `dispatchReportEmail()` helper will pick this up via the
            // run doc and re-send through a real transport.
            console.log(
                '[reports.delivery.email] TODO mailer not wired — would send',
                {
                    runId: opts.runId,
                    kind: opts.definition.kind,
                    to: d.email.to,
                    subject:
                        d.email.subject ??
                        `[SabNode CRM] ${opts.definition.name}`,
                    csvBytes: csv.length,
                    rowCount: opts.result.rows.length,
                },
            );
            delivered.email = {
                ok: false,
                recipients: d.email.to,
                error: 'mailer_not_configured',
            };
        } catch (e: any) {
            delivered.email = {
                ok: false,
                recipients: d.email.to,
                error: e?.message ?? 'email_dispatch_threw',
            };
        }
    }

    // ── webhook (real HTTP POST) ─────────────────────────────────────
    if (d.webhook && typeof d.webhook.url === 'string' && d.webhook.url.length > 0) {
        try {
            const headers: Record<string, string> = {
                'content-type': 'application/json',
                'x-sabnode-report-run': opts.runId,
                'x-sabnode-report-kind': opts.definition.kind,
                ...(d.webhook.headers ?? {}),
            };
            const body = JSON.stringify({
                runId: opts.runId,
                definitionId: String(opts.definition._id),
                kind: opts.definition.kind,
                name: opts.definition.name,
                columns: opts.result.columns,
                rows: opts.result.rows,
                summary: opts.result.summary,
                error: opts.result.error ?? null,
            });
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15_000);
            try {
                const res = await fetch(d.webhook.url, {
                    method: 'POST',
                    headers,
                    body,
                    signal: controller.signal,
                });
                delivered.webhook = {
                    ok: res.ok,
                    status: res.status,
                };
            } finally {
                clearTimeout(timeout);
            }
        } catch (e: any) {
            delivered.webhook = {
                ok: false,
                error: e?.message ?? 'webhook_dispatch_failed',
            };
        }
    }

    return delivered;
}

// cronMatchesHour moved to `@/lib/crm/cron-match` — Server Action files
// may only export async functions, so the pure helper lives elsewhere.

/* ════════════════════════════════════════════════════════════════════════
 *  §6.9 Reports hub overview — KPIs + recently-viewed for the landing
 *  page at `/dashboard/crm/reports`. Multi-tenant; gated on `crm_reports`.
 * ════════════════════════════════════════════════════════════════════════
 */

export interface ReportsHubOverview {
    totalRunsThisMonth: number;
    scheduledExportsCount: number;
    topViewedReportKind: string | null;
    topViewedReportLabel: string | null;
    lastRefreshAt: string | null;
    categoryStats: Record<string, { lastRefreshAt: string | null; runs: number }>;
}

export interface ReportsHubRecentRun {
    runId: string;
    definitionId: string;
    kind: string;
    name: string;
    status: string;
    rowCount: number;
    startedAt: string;
}

export async function getReportsHubOverview(): Promise<ReportsHubOverview> {
    const empty: ReportsHubOverview = {
        totalRunsThisMonth: 0,
        scheduledExportsCount: 0,
        topViewedReportKind: null,
        topViewedReportLabel: null,
        lastRefreshAt: null,
        categoryStats: {},
    };
    const session = await getSession();
    if (!session?.user) return empty;
    const guard = await requirePermissionUnified(REPORTS_PERMISSION_KEY, 'view');
    if (!guard.ok) return empty;

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const [totalRunsThisMonth, scheduledExportsCount, topAgg, lastRun, byKind] =
            await Promise.all([
                db.collection('crm_report_runs').countDocuments({
                    userId,
                    startedAt: { $gte: monthStart },
                }),
                db.collection('crm_report_definitions').countDocuments({
                    userId,
                    schedule: { $ne: null },
                }),
                db
                    .collection('crm_report_runs')
                    .aggregate([
                        { $match: { userId, startedAt: { $gte: monthStart } } },
                        { $group: { _id: '$kind', count: { $sum: 1 } } },
                        { $sort: { count: -1 } },
                        { $limit: 1 },
                    ])
                    .toArray(),
                db
                    .collection('crm_report_runs')
                    .find({ userId })
                    .sort({ startedAt: -1 })
                    .limit(1)
                    .project({ startedAt: 1 })
                    .toArray(),
                db
                    .collection('crm_report_runs')
                    .aggregate([
                        { $match: { userId } },
                        {
                            $group: {
                                _id: '$kind',
                                runs: { $sum: 1 },
                                lastRefreshAt: { $max: '$startedAt' },
                            },
                        },
                    ])
                    .toArray(),
            ]);

        const categoryStats: Record<string, { lastRefreshAt: string | null; runs: number }> = {};
        for (const row of byKind as Array<{
            _id: string;
            runs: number;
            lastRefreshAt: Date | string | null;
        }>) {
            categoryStats[row._id] = {
                runs: row.runs,
                lastRefreshAt: row.lastRefreshAt
                    ? new Date(row.lastRefreshAt as Date).toISOString()
                    : null,
            };
        }

        const topKind = (topAgg[0] as { _id?: string } | undefined)?._id ?? null;
        const lastRefreshRaw = (lastRun[0] as { startedAt?: Date | string } | undefined)
            ?.startedAt;

        return {
            totalRunsThisMonth,
            scheduledExportsCount,
            topViewedReportKind: topKind,
            topViewedReportLabel: topKind,
            lastRefreshAt: lastRefreshRaw
                ? new Date(lastRefreshRaw as Date).toISOString()
                : null,
            categoryStats,
        };
    } catch (e) {
        console.error('[getReportsHubOverview] failed:', e);
        return empty;
    }
}

export async function getReportsHubRecentRuns(
    limit = 8,
): Promise<ReportsHubRecentRun[]> {
    const session = await getSession();
    if (!session?.user) return [];
    const guard = await requirePermissionUnified(REPORTS_PERMISSION_KEY, 'view');
    if (!guard.ok) return [];

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const docs = await db
            .collection('crm_report_runs')
            .aggregate([
                { $match: { userId } },
                { $sort: { startedAt: -1 } },
                { $limit: Math.min(Math.max(1, limit), 50) },
                {
                    $lookup: {
                        from: 'crm_report_definitions',
                        localField: 'definitionId',
                        foreignField: '_id',
                        as: 'def',
                    },
                },
                { $unwind: { path: '$def', preserveNullAndEmptyArrays: true } },
                {
                    $project: {
                        kind: 1,
                        status: 1,
                        rowCount: 1,
                        startedAt: 1,
                        definitionId: 1,
                        name: '$def.name',
                    },
                },
            ])
            .toArray();

        return docs.map((d) => ({
            runId: String(d._id),
            definitionId: String(d.definitionId ?? ''),
            kind: String(d.kind ?? ''),
            name: String(d.name ?? d.kind ?? 'Untitled report'),
            status: String(d.status ?? ''),
            rowCount: Number(d.rowCount ?? 0),
            startedAt: d.startedAt
                ? new Date(d.startedAt as Date).toISOString()
                : new Date().toISOString(),
        }));
    } catch (e) {
        console.error('[getReportsHubRecentRuns] failed:', e);
        return [];
    }
}

/* ════════════════════════════════════════════════════════════════════════
 *  HR People Reports — extra aggregations powering the deepened
 *  agent-performance / attendance / leave / leave-balance / birthday pages.
 *
 *  All queries are tenant-scoped via the session userId. They read
 *  `crm_employees`, `crm_attendance`, `crm_leaves` (legacy leave-request
 *  collection), `crm_leave_types`, `crm_leads`, `crm_deals` and
 *  `crm_departments`. Each helper accepts an optional `departmentId` so
 *  the report toolbar's department filter narrows the dataset.
 * ════════════════════════════════════════════════════════════════════════ */

export interface HrReportDepartment {
    id: string;
    name: string;
}

export async function getHrReportDepartments(): Promise<HrReportDepartment[]> {
    const session = await getSession();
    if (!session?.user) return [];
    try {
        const { db } = await connectToDatabase();
        const rows = await db
            .collection('crm_departments')
            .find({ userId: new ObjectId(session.user._id) })
            .project({ _id: 1, name: 1 })
            .sort({ name: 1 })
            .toArray();
        return rows.map((r) => ({
            id: r._id.toString(),
            name: String((r as any).name || 'Unnamed'),
        }));
    } catch (e) {
        console.error('[getHrReportDepartments] failed:', e);
        return [];
    }
}

async function employeeIdsForDepartment(
    db: Awaited<ReturnType<typeof connectToDatabase>>['db'],
    userId: ObjectId,
    departmentId?: string,
): Promise<ObjectId[] | null> {
    if (!departmentId || !ObjectId.isValid(departmentId)) return null;
    const rows = await db
        .collection('crm_employees')
        .find({ userId, departmentId: new ObjectId(departmentId) })
        .project({ _id: 1 })
        .toArray();
    return rows.map((r) => r._id as ObjectId);
}

/* ─── Agent performance (sales) ────────────────────────────────────── */

export interface SalesAgentPerformanceRow {
    employeeId: string;
    employeeName: string;
    department: string;
    leadsHandled: number;
    dealsWon: number;
    dealsLost: number;
    revenueClosed: number;
    avgDealSize: number;
}

export interface SalesAgentPerformanceReport {
    rows: SalesAgentPerformanceRow[];
    totals: {
        totalAgents: number;
        leadsHandled: number;
        dealsWon: number;
        revenueClosed: number;
        avgDealSize: number;
        topPerformer: string;
    };
}

export async function getSalesAgentPerformance(
    from?: string,
    to?: string,
    departmentId?: string,
): Promise<SalesAgentPerformanceReport> {
    const empty: SalesAgentPerformanceReport = {
        rows: [],
        totals: {
            totalAgents: 0,
            leadsHandled: 0,
            dealsWon: 0,
            revenueClosed: 0,
            avgDealSize: 0,
            topPerformer: '—',
        },
    };
    const session = await getSession();
    if (!session?.user) return empty;

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const start = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
        const end = to ? new Date(to) : new Date();

        const empMatch: Record<string, unknown> = { userId };
        if (departmentId && ObjectId.isValid(departmentId)) {
            empMatch.departmentId = new ObjectId(departmentId);
        }

        const employees = await db
            .collection('crm_employees')
            .aggregate([
                { $match: empMatch },
                {
                    $lookup: {
                        from: 'crm_departments',
                        localField: 'departmentId',
                        foreignField: '_id',
                        as: 'dept',
                    },
                },
                { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
                {
                    $project: {
                        _id: 1,
                        firstName: 1,
                        lastName: 1,
                        email: 1,
                        deptName: '$dept.name',
                    },
                },
            ])
            .toArray();

        if (employees.length === 0) return empty;
        const empIds = employees.map((e) => e._id as ObjectId);

        const [leadAgg, dealAgg] = await Promise.all([
            db
                .collection('crm_leads')
                .aggregate([
                    {
                        $match: {
                            userId,
                            assigneeId: { $in: empIds },
                            createdAt: { $gte: start, $lte: end },
                        },
                    },
                    { $group: { _id: '$assigneeId', count: { $sum: 1 } } },
                ])
                .toArray(),
            db
                .collection('crm_deals')
                .aggregate([
                    {
                        $match: {
                            userId,
                            ownerId: { $in: empIds },
                            updatedAt: { $gte: start, $lte: end },
                        },
                    },
                    {
                        $group: {
                            _id: '$ownerId',
                            won: {
                                $sum: { $cond: [{ $eq: ['$stage', 'Won'] }, 1, 0] },
                            },
                            lost: {
                                $sum: { $cond: [{ $eq: ['$stage', 'Lost'] }, 1, 0] },
                            },
                            wonValue: {
                                $sum: {
                                    $cond: [
                                        { $eq: ['$stage', 'Won'] },
                                        { $ifNull: ['$value', 0] },
                                        0,
                                    ],
                                },
                            },
                        },
                    },
                ])
                .toArray(),
        ]);

        const leadMap = new Map<string, number>();
        leadAgg.forEach((r) => leadMap.set(String(r._id), Number(r.count || 0)));
        const dealMap = new Map<
            string,
            { won: number; lost: number; wonValue: number }
        >();
        dealAgg.forEach((r) =>
            dealMap.set(String(r._id), {
                won: Number(r.won || 0),
                lost: Number(r.lost || 0),
                wonValue: Number(r.wonValue || 0),
            }),
        );

        const rows: SalesAgentPerformanceRow[] = employees.map((e) => {
            const id = String(e._id);
            const leadsHandled = leadMap.get(id) ?? 0;
            const d = dealMap.get(id) ?? { won: 0, lost: 0, wonValue: 0 };
            return {
                employeeId: id,
                employeeName:
                    `${(e as any).firstName || ''} ${(e as any).lastName || ''}`.trim() ||
                    String((e as any).email || 'Unknown'),
                department: String((e as any).deptName || '—'),
                leadsHandled,
                dealsWon: d.won,
                dealsLost: d.lost,
                revenueClosed: d.wonValue,
                avgDealSize: d.won > 0 ? Math.round(d.wonValue / d.won) : 0,
            };
        });

        rows.sort((a, b) => b.revenueClosed - a.revenueClosed || b.leadsHandled - a.leadsHandled);

        const leadsHandled = rows.reduce((s, r) => s + r.leadsHandled, 0);
        const dealsWon = rows.reduce((s, r) => s + r.dealsWon, 0);
        const revenueClosed = rows.reduce((s, r) => s + r.revenueClosed, 0);
        return {
            rows,
            totals: {
                totalAgents: rows.length,
                leadsHandled,
                dealsWon,
                revenueClosed,
                avgDealSize: dealsWon > 0 ? Math.round(revenueClosed / dealsWon) : 0,
                topPerformer: rows[0]?.employeeName ?? '—',
            },
        };
    } catch (e) {
        console.error('[getSalesAgentPerformance] failed:', e);
        return empty;
    }
}

/* ─── Attendance — daily series + KPIs ─────────────────────────────── */

export interface AttendanceDailyDatum {
    date: string;
    present: number;
    absent: number;
    leave: number;
    halfDay: number;
}

export interface AttendanceReportData {
    rows: Array<{
        employeeId: string;
        employeeName: string;
        department: string;
        present: number;
        absent: number;
        late: number;
        leave: number;
        attendancePct: number;
    }>;
    daily: AttendanceDailyDatum[];
    totals: {
        totalEmployees: number;
        avgAttendancePct: number;
        lateCount: number;
        absentCount: number;
        presentCount: number;
        leaveCount: number;
    };
}

export async function getAttendanceReportData(
    month: number,
    year: number,
    departmentId?: string,
    graceMinutes = 15,
    shiftStartHour = 9,
): Promise<AttendanceReportData> {
    const empty: AttendanceReportData = {
        rows: [],
        daily: [],
        totals: {
            totalEmployees: 0,
            avgAttendancePct: 0,
            lateCount: 0,
            absentCount: 0,
            presentCount: 0,
            leaveCount: 0,
        },
    };

    const session = await getSession();
    if (!session?.user) return empty;

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0, 23, 59, 59);
        const daysInMonth = end.getDate();

        const empMatch: Record<string, unknown> = { userId, status: 'Active' };
        if (departmentId && ObjectId.isValid(departmentId)) {
            empMatch.departmentId = new ObjectId(departmentId);
        }
        const employees = await db
            .collection('crm_employees')
            .aggregate([
                { $match: empMatch },
                {
                    $lookup: {
                        from: 'crm_departments',
                        localField: 'departmentId',
                        foreignField: '_id',
                        as: 'dept',
                    },
                },
                { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
            ])
            .toArray();

        if (employees.length === 0) return empty;

        const empIds = employees.map((e) => e._id as ObjectId);
        const attendance = await db
            .collection('crm_attendance')
            .find({
                userId,
                employeeId: { $in: empIds },
                date: { $gte: start, $lte: end },
            })
            .toArray();

        // Daily series
        const dailyMap = new Map<string, AttendanceDailyDatum>();
        for (let d = 1; d <= daysInMonth; d++) {
            const key = new Date(year, month - 1, d).toISOString().slice(0, 10);
            dailyMap.set(key, { date: key, present: 0, absent: 0, leave: 0, halfDay: 0 });
        }

        // Per-employee tallies
        type Tally = {
            present: number;
            absent: number;
            late: number;
            leave: number;
            halfDay: number;
        };
        const perEmp = new Map<string, Tally>();
        for (const e of employees) {
            perEmp.set(String(e._id), { present: 0, absent: 0, late: 0, leave: 0, halfDay: 0 });
        }

        for (const a of attendance) {
            const rec = a as any;
            const eid = rec.employeeId?.toString?.();
            if (!eid || !perEmp.has(eid)) continue;
            const dt = new Date(rec.date);
            const key = dt.toISOString().slice(0, 10);
            const tally = perEmp.get(eid)!;
            const status = String(rec.status || '');
            const slot = dailyMap.get(key);
            if (status === 'Present') {
                tally.present++;
                if (slot) slot.present++;
                if (rec.checkIn) {
                    const ci = new Date(rec.checkIn);
                    const shift = new Date(ci);
                    shift.setHours(shiftStartHour, graceMinutes, 0, 0);
                    if (ci.getTime() > shift.getTime()) tally.late++;
                }
            } else if (status === 'Absent') {
                tally.absent++;
                if (slot) slot.absent++;
            } else if (status === 'Leave') {
                tally.leave++;
                if (slot) slot.leave++;
            } else if (status === 'Half Day') {
                tally.halfDay++;
                if (slot) slot.halfDay++;
            }
        }

        const rows = employees.map((e) => {
            const id = String(e._id);
            const t = perEmp.get(id)!;
            const totalDays = t.present + t.absent + t.leave + t.halfDay;
            const effective = t.present + t.halfDay * 0.5;
            return {
                employeeId: id,
                employeeName:
                    `${(e as any).firstName || ''} ${(e as any).lastName || ''}`.trim() ||
                    String((e as any).email || 'Unknown'),
                department: String((e as any).dept?.name || '—'),
                present: t.present,
                absent: t.absent,
                late: t.late,
                leave: t.leave,
                attendancePct: totalDays > 0 ? (effective / totalDays) * 100 : 0,
            };
        });

        rows.sort((a, b) => b.attendancePct - a.attendancePct);

        const daily = Array.from(dailyMap.values());
        const lateCount = rows.reduce((s, r) => s + r.late, 0);
        const absentCount = rows.reduce((s, r) => s + r.absent, 0);
        const presentCount = rows.reduce((s, r) => s + r.present, 0);
        const leaveCount = rows.reduce((s, r) => s + r.leave, 0);
        const avgAttendancePct = rows.length
            ? rows.reduce((s, r) => s + r.attendancePct, 0) / rows.length
            : 0;

        return {
            rows,
            daily,
            totals: {
                totalEmployees: rows.length,
                avgAttendancePct,
                lateCount,
                absentCount,
                presentCount,
                leaveCount,
            },
        };
    } catch (e) {
        console.error('[getAttendanceReportData] failed:', e);
        return empty;
    }
}

/* ─── Leave report — KPIs + by-type + monthly trend + rows ────────── */

export interface LeaveReportDeepRow {
    employeeId: string;
    employeeName: string;
    leaveTypeName: string;
    reason: string;
    days: number;
    status: 'approved' | 'pending' | 'rejected' | 'cancelled';
    leaveDate: string | null;
    department: string;
}

export interface LeaveReportDeep {
    rows: LeaveReportDeepRow[];
    byType: Array<{ label: string; value: number }>;
    byMonth: Array<{ period: string; days: number }>;
    totals: {
        totalLeaves: number;
        approved: number;
        pending: number;
        rejected: number;
        topReason: string;
    };
}

export async function getLeaveReportDeep(
    from?: string,
    to?: string,
    departmentId?: string,
): Promise<LeaveReportDeep> {
    const empty: LeaveReportDeep = {
        rows: [],
        byType: [],
        byMonth: [],
        totals: { totalLeaves: 0, approved: 0, pending: 0, rejected: 0, topReason: '—' },
    };
    const session = await getSession();
    if (!session?.user) return empty;

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const start = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
        const end = to ? new Date(to) : new Date();

        const allowedEmpIds = await employeeIdsForDepartment(db, userId, departmentId);

        const match: Record<string, unknown> = {
            userId,
            leave_date: { $gte: start, $lte: end },
        };
        if (allowedEmpIds) {
            match.user_id = { $in: allowedEmpIds };
        }

        const leaves = await db.collection('crm_leaves').find(match).toArray();
        if (leaves.length === 0) return empty;

        const empIds = new Set<string>();
        const typeIds = new Set<string>();
        leaves.forEach((l) => {
            const lr = l as any;
            if (lr.user_id) empIds.add(lr.user_id.toString());
            if (lr.leave_type_id) typeIds.add(lr.leave_type_id.toString());
        });

        const [employees, types] = await Promise.all([
            empIds.size
                ? db
                      .collection('crm_employees')
                      .aggregate([
                          {
                              $match: {
                                  userId,
                                  _id: {
                                      $in: Array.from(empIds)
                                          .filter(ObjectId.isValid)
                                          .map((id) => new ObjectId(id)),
                                  },
                              },
                          },
                          {
                              $lookup: {
                                  from: 'crm_departments',
                                  localField: 'departmentId',
                                  foreignField: '_id',
                                  as: 'dept',
                              },
                          },
                          { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
                      ])
                      .toArray()
                : [],
            typeIds.size
                ? db
                      .collection('crm_leave_types')
                      .find({
                          userId,
                          _id: {
                              $in: Array.from(typeIds)
                                  .filter(ObjectId.isValid)
                                  .map((id) => new ObjectId(id)),
                          },
                      })
                      .toArray()
                : [],
        ]);

        const empMeta = new Map<string, { name: string; department: string }>();
        employees.forEach((e) => {
            const er = e as any;
            empMeta.set(String(er._id), {
                name:
                    `${er.firstName || ''} ${er.lastName || ''}`.trim() ||
                    String(er.email || 'Unknown'),
                department: String(er.dept?.name || '—'),
            });
        });
        const typeName = new Map<string, string>();
        types.forEach((t) => typeName.set(String((t as any)._id), String((t as any).type_name)));

        const rows: LeaveReportDeepRow[] = leaves.map((l) => {
            const lr = l as any;
            const eid = lr.user_id?.toString?.() || '';
            const tid = lr.leave_type_id?.toString?.() || '';
            const meta = empMeta.get(eid) ?? { name: '—', department: '—' };
            return {
                employeeId: eid,
                employeeName: meta.name,
                leaveTypeName: typeName.get(tid) || 'Unknown',
                reason: String(lr.reason || '—'),
                days: Number(lr.days_count || 0),
                status: (lr.status || 'pending') as LeaveReportDeepRow['status'],
                leaveDate: lr.leave_date ? new Date(lr.leave_date).toISOString() : null,
                department: meta.department,
            };
        });

        // KPI counts (number of leave requests, not days)
        let approved = 0;
        let pending = 0;
        let rejected = 0;
        const reasonCount = new Map<string, number>();
        const typeDays = new Map<string, number>();
        const monthDays = new Map<string, number>();
        for (const r of rows) {
            if (r.status === 'approved') approved++;
            else if (r.status === 'pending') pending++;
            else if (r.status === 'rejected') rejected++;
            reasonCount.set(r.reason, (reasonCount.get(r.reason) || 0) + 1);
            typeDays.set(r.leaveTypeName, (typeDays.get(r.leaveTypeName) || 0) + r.days);
            if (r.leaveDate) {
                const k = r.leaveDate.slice(0, 7);
                monthDays.set(k, (monthDays.get(k) || 0) + r.days);
            }
        }
        let topReason = '—';
        let topReasonCount = 0;
        reasonCount.forEach((v, k) => {
            if (v > topReasonCount) {
                topReason = k || '—';
                topReasonCount = v;
            }
        });

        const byType = Array.from(typeDays.entries())
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value);
        const byMonth = Array.from(monthDays.entries())
            .map(([period, days]) => ({ period, days }))
            .sort((a, b) => a.period.localeCompare(b.period));

        rows.sort((a, b) =>
            (b.leaveDate || '').localeCompare(a.leaveDate || ''),
        );

        return {
            rows,
            byType,
            byMonth,
            totals: { totalLeaves: rows.length, approved, pending, rejected, topReason },
        };
    } catch (e) {
        console.error('[getLeaveReportDeep] failed:', e);
        return empty;
    }
}

/* ─── Leave balance — extra KPIs + per-employee stacked ──────────── */

export interface LeaveBalanceDeepRow {
    employeeId: string;
    employeeName: string;
    department: string;
    leaveTypeName: string;
    allocated: number;
    used: number;
    remaining: number;
    expiresAt: string | null;
}

export interface LeaveBalanceDeep {
    rows: LeaveBalanceDeepRow[];
    stacked: Array<Record<string, string | number>>;
    typeKeys: string[];
    totals: {
        employees: number;
        totalRemaining: number;
        byType: Array<{ label: string; value: number }>;
        lowBalanceCount: number;
        expiringSoonCount: number;
    };
}

export async function getLeaveBalanceDeep(
    departmentId?: string,
): Promise<LeaveBalanceDeep> {
    const empty: LeaveBalanceDeep = {
        rows: [],
        stacked: [],
        typeKeys: [],
        totals: {
            employees: 0,
            totalRemaining: 0,
            byType: [],
            lowBalanceCount: 0,
            expiringSoonCount: 0,
        },
    };
    const session = await getSession();
    if (!session?.user) return empty;

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const empMatch: Record<string, unknown> = { userId, status: 'Active' };
        if (departmentId && ObjectId.isValid(departmentId)) {
            empMatch.departmentId = new ObjectId(departmentId);
        }

        const [employees, types, leaves] = await Promise.all([
            db
                .collection('crm_employees')
                .aggregate([
                    { $match: empMatch },
                    {
                        $lookup: {
                            from: 'crm_departments',
                            localField: 'departmentId',
                            foreignField: '_id',
                            as: 'dept',
                        },
                    },
                    { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
                ])
                .toArray(),
            db.collection('crm_leave_types').find({ userId }).toArray(),
            db
                .collection('crm_leaves')
                .find({ userId, status: 'approved' })
                .toArray(),
        ]);

        if (employees.length === 0 || types.length === 0) return empty;

        const usedByKey = new Map<string, number>();
        for (const l of leaves) {
            const lr = l as any;
            const eid = lr.user_id?.toString?.() || '';
            const tid = lr.leave_type_id?.toString?.() || '';
            if (!eid || !tid) continue;
            const k = `${eid}|${tid}`;
            usedByKey.set(k, (usedByKey.get(k) || 0) + Number(lr.days_count || 0));
        }

        const now = Date.now();
        const ninetyDaysMs = 90 * 86400000;

        const rows: LeaveBalanceDeepRow[] = [];
        const stacked: Array<Record<string, string | number>> = [];
        const typeKeys = types.map((t) => String((t as any).type_name));
        const byTypeTotals = new Map<string, number>();
        let lowBalanceCount = 0;
        let expiringSoonCount = 0;

        for (const e of employees) {
            const er = e as any;
            const id = String(er._id);
            const employeeName =
                `${er.firstName || ''} ${er.lastName || ''}`.trim() ||
                String(er.email || 'Unknown');
            const department = String(er.dept?.name || '—');
            const row: Record<string, string | number> = { label: employeeName };
            let anyLow = false;
            for (const t of types) {
                const tr = t as any;
                const tid = String(tr._id);
                const typeName = String(tr.type_name);
                const allocated = Number(tr.no_of_leaves || 0);
                const used = usedByKey.get(`${id}|${tid}`) || 0;
                const remaining = Math.max(0, allocated - used);
                const expiresAt = tr.expiresAt
                    ? new Date(tr.expiresAt).toISOString()
                    : null;
                rows.push({
                    employeeId: id,
                    employeeName,
                    department,
                    leaveTypeName: typeName,
                    allocated,
                    used,
                    remaining,
                    expiresAt,
                });
                row[typeName] = remaining;
                byTypeTotals.set(typeName, (byTypeTotals.get(typeName) || 0) + remaining);
                if (allocated > 0 && remaining / allocated < 0.2) anyLow = true;
                if (
                    expiresAt &&
                    remaining > 0 &&
                    new Date(expiresAt).getTime() - now <= ninetyDaysMs
                ) {
                    expiringSoonCount++;
                }
            }
            if (anyLow) lowBalanceCount++;
            stacked.push(row);
        }

        const byType = Array.from(byTypeTotals.entries())
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value);
        const totalRemaining = byType.reduce((s, r) => s + r.value, 0);

        return {
            rows,
            stacked,
            typeKeys,
            totals: {
                employees: employees.length,
                totalRemaining,
                byType,
                lowBalanceCount,
                expiringSoonCount,
            },
        };
    } catch (e) {
        console.error('[getLeaveBalanceDeep] failed:', e);
        return empty;
    }
}

/* ─── Birthdays & anniversaries — bucketed by time window ────────── */

export interface BirthdayAnnivDeepRow {
    employeeId: string;
    employeeName: string;
    department: string;
    kind: 'birthday' | 'anniversary';
    date: string;
    years?: number;
}

export interface BirthdayAnnivDeep {
    rows: BirthdayAnnivDeepRow[];
    today: BirthdayAnnivDeepRow[];
    thisWeek: BirthdayAnnivDeepRow[];
    thisMonth: BirthdayAnnivDeepRow[];
    totals: {
        todayBirthdays: number;
        weekBirthdays: number;
        monthBirthdays: number;
        monthAnniversaries: number;
    };
}

export async function getBirthdayAnniversaryDeep(
    days: number,
    departmentId?: string,
): Promise<BirthdayAnnivDeep> {
    const empty: BirthdayAnnivDeep = {
        rows: [],
        today: [],
        thisWeek: [],
        thisMonth: [],
        totals: {
            todayBirthdays: 0,
            weekBirthdays: 0,
            monthBirthdays: 0,
            monthAnniversaries: 0,
        },
    };
    const session = await getSession();
    if (!session?.user) return empty;

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const match: Record<string, unknown> = { userId, status: 'Active' };
        if (departmentId && ObjectId.isValid(departmentId)) {
            match.departmentId = new ObjectId(departmentId);
        }

        const employees = await db
            .collection('crm_employees')
            .aggregate([
                { $match: match },
                {
                    $lookup: {
                        from: 'crm_departments',
                        localField: 'departmentId',
                        foreignField: '_id',
                        as: 'dept',
                    },
                },
                { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
            ])
            .toArray();

        const now = new Date();
        const windowMs = Math.max(1, days) * 86400000;
        const startToday = new Date(now);
        startToday.setHours(0, 0, 0, 0);
        const endWeek = new Date(startToday.getTime() + 7 * 86400000);
        const endMonth = new Date(startToday);
        endMonth.setMonth(endMonth.getMonth() + 1);

        function nextOccurrence(src: Date): Date {
            const d = new Date(now.getFullYear(), src.getMonth(), src.getDate());
            if (d.getTime() < startToday.getTime()) {
                d.setFullYear(now.getFullYear() + 1);
            }
            return d;
        }

        const rows: BirthdayAnnivDeepRow[] = [];
        for (const e of employees) {
            const er = e as any;
            const employeeId = String(er._id);
            const employeeName =
                `${er.firstName || ''} ${er.lastName || ''}`.trim() ||
                String(er.email || 'Unknown');
            const department = String(er.dept?.name || '—');

            if (er.dateOfBirth) {
                const next = nextOccurrence(new Date(er.dateOfBirth));
                if (next.getTime() - startToday.getTime() <= windowMs) {
                    rows.push({
                        employeeId,
                        employeeName,
                        department,
                        kind: 'birthday',
                        date: next.toISOString(),
                    });
                }
            }
            if (er.dateOfJoining) {
                const joined = new Date(er.dateOfJoining);
                const next = nextOccurrence(joined);
                if (next.getTime() - startToday.getTime() <= windowMs) {
                    const years = next.getFullYear() - joined.getFullYear();
                    if (years >= 1) {
                        rows.push({
                            employeeId,
                            employeeName,
                            department,
                            kind: 'anniversary',
                            date: next.toISOString(),
                            years,
                        });
                    }
                }
            }
        }

        rows.sort((a, b) => a.date.localeCompare(b.date));

        const today: BirthdayAnnivDeepRow[] = [];
        const thisWeek: BirthdayAnnivDeepRow[] = [];
        const thisMonth: BirthdayAnnivDeepRow[] = [];
        for (const r of rows) {
            const t = new Date(r.date).getTime();
            if (t >= startToday.getTime() && t < startToday.getTime() + 86400000) {
                today.push(r);
            }
            if (t >= startToday.getTime() && t < endWeek.getTime()) {
                thisWeek.push(r);
            }
            if (t >= startToday.getTime() && t < endMonth.getTime()) {
                thisMonth.push(r);
            }
        }

        return {
            rows,
            today,
            thisWeek,
            thisMonth,
            totals: {
                todayBirthdays: today.filter((r) => r.kind === 'birthday').length,
                weekBirthdays: thisWeek.filter((r) => r.kind === 'birthday').length,
                monthBirthdays: thisMonth.filter((r) => r.kind === 'birthday').length,
                monthAnniversaries: thisMonth.filter((r) => r.kind === 'anniversary').length,
            },
        };
    } catch (e) {
        console.error('[getBirthdayAnniversaryDeep] failed:', e);
        return empty;
    }
}

/* ════════════════════════════════════════════════════════════════════════
 *  §TP — Late Report + Project Status Report
 * ════════════════════════════════════════════════════════════════════════ */

export type LateEntityKind = 'task' | 'project' | 'invoice';
export type ProjectRag = 'on-track' | 'at-risk' | 'blocked';

export interface TpReportProject { id: string; name: string }
export interface TpReportOwner  { id: string; name: string }

export async function getTpReportProjects(): Promise<TpReportProject[]> {
    const session = await getSession();
    if (!session?.user) return [];
    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const rows = await db.collection('crm_projects')
            .find({ userId }, { projection: { _id: 1, name: 1 } })
            .sort({ name: 1 })
            .toArray();
        return rows.map((r: any) => ({ id: r._id.toString(), name: String(r.name ?? 'Unnamed') }));
    } catch (e) {
        console.error('[getTpReportProjects] failed:', e);
        return [];
    }
}

export async function getTpReportOwners(): Promise<TpReportOwner[]> {
    const session = await getSession();
    if (!session?.user) return [];
    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const rows = await db.collection('crm_employees')
            .find({ userId, status: 'Active' }, { projection: { _id: 1, firstName: 1, lastName: 1 } })
            .sort({ firstName: 1 })
            .toArray();
        return rows.map((r: any) => ({
            id: r._id.toString(),
            name: `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim() || 'Unnamed',
        }));
    } catch (e) {
        console.error('[getTpReportOwners] failed:', e);
        return [];
    }
}

export interface LateReportRow {
    _id: string;
    kind: LateEntityKind;
    title: string;
    projectId?: string;
    projectName: string;
    ownerName: string;
    dueDate?: string;
    lateDays: number;
    status: string;
}

export interface LateReportDeep {
    rows: LateReportRow[];
    byKind: Array<{ kind: LateEntityKind; count: number; avgDays: number }>;
    stacked: Array<{ month: string; task: number; project: number; invoice: number }>;
    totals: { totalLate: number; avgLatenessDays: number; worstLatenessDays: number; kindCount: number };
}

export async function getLateReportDeep(
    from?: string,
    to?: string,
    projectId?: string,
    ownerId?: string,
): Promise<LateReportDeep> {
    const empty: LateReportDeep = {
        rows: [],
        byKind: [],
        stacked: [],
        totals: { totalLate: 0, avgLatenessDays: 0, worstLatenessDays: 0, kindCount: 0 },
    };
    const session = await getSession();
    if (!session?.user) return empty;
    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const now = new Date();
        const toDate = to ? new Date(to) : now;

        const baseFilter: any = { userId, dueDate: { $lt: toDate }, status: { $nin: ['Completed', 'Closed', 'Cancelled', 'Paid'] } };
        if (from) baseFilter.dueDate.$gte = new Date(from);
        if (projectId && ObjectId.isValid(projectId)) baseFilter.projectId = new ObjectId(projectId);
        if (ownerId && ObjectId.isValid(ownerId)) baseFilter.ownerId = new ObjectId(ownerId);

        const [rawTasks, rawProjects, rawInvoices] = await Promise.all([
            db.collection('crm_tasks').find({ ...baseFilter }, { projection: { _id: 1, title: 1, dueDate: 1, status: 1, projectId: 1, assigneeId: 1 } }).toArray(),
            db.collection('crm_projects').find({ userId, deadline: { $lt: toDate }, status: { $nin: ['Completed', 'Cancelled'] } }, { projection: { _id: 1, name: 1, deadline: 1, status: 1, clientId: 1 } }).toArray(),
            db.collection('crm_invoices').find({ userId, dueDate: { $lt: toDate }, status: { $nin: ['Paid', 'Cancelled'] } }, { projection: { _id: 1, invoiceNumber: 1, dueDate: 1, status: 1, clientName: 1 } }).toArray(),
        ]);

        const rows: LateReportRow[] = [
            ...rawTasks.map((t: any) => {
                const due = t.dueDate ? new Date(t.dueDate) : null;
                return {
                    _id: t._id.toString(),
                    kind: 'task' as LateEntityKind,
                    title: String(t.title ?? 'Untitled'),
                    projectId: t.projectId?.toString(),
                    projectName: '',
                    ownerName: '',
                    dueDate: due?.toISOString(),
                    lateDays: due ? Math.max(0, Math.floor((now.getTime() - due.getTime()) / 86400000)) : 0,
                    status: String(t.status ?? ''),
                };
            }),
            ...rawProjects.map((p: any) => {
                const due = p.deadline ? new Date(p.deadline) : null;
                return {
                    _id: p._id.toString(),
                    kind: 'project' as LateEntityKind,
                    title: String(p.name ?? 'Untitled'),
                    projectName: String(p.name ?? ''),
                    ownerName: '',
                    dueDate: due?.toISOString(),
                    lateDays: due ? Math.max(0, Math.floor((now.getTime() - due.getTime()) / 86400000)) : 0,
                    status: String(p.status ?? ''),
                };
            }),
            ...rawInvoices.map((inv: any) => {
                const due = inv.dueDate ? new Date(inv.dueDate) : null;
                return {
                    _id: inv._id.toString(),
                    kind: 'invoice' as LateEntityKind,
                    title: String(inv.invoiceNumber ?? 'Untitled'),
                    projectName: '',
                    ownerName: String(inv.clientName ?? ''),
                    dueDate: due?.toISOString(),
                    lateDays: due ? Math.max(0, Math.floor((now.getTime() - due.getTime()) / 86400000)) : 0,
                    status: String(inv.status ?? ''),
                };
            }),
        ].sort((a, b) => b.lateDays - a.lateDays);

        const kindMap: Record<LateEntityKind, { count: number; total: number }> = { task: { count: 0, total: 0 }, project: { count: 0, total: 0 }, invoice: { count: 0, total: 0 } };
        const monthMap: Record<string, { task: number; project: number; invoice: number }> = {};
        let worst = 0;
        for (const r of rows) {
            kindMap[r.kind].count++;
            kindMap[r.kind].total += r.lateDays;
            if (r.lateDays > worst) worst = r.lateDays;
            if (r.dueDate) {
                const m = r.dueDate.slice(0, 7);
                if (!monthMap[m]) monthMap[m] = { task: 0, project: 0, invoice: 0 };
                monthMap[m][r.kind]++;
            }
        }

        const byKind = (Object.entries(kindMap) as [LateEntityKind, { count: number; total: number }][])
            .filter(([, v]) => v.count > 0)
            .map(([kind, v]) => ({ kind, count: v.count, avgDays: Math.round(v.total / v.count) }));

        const stacked = Object.entries(monthMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, v]) => ({ month, ...v }));

        const totalLate = rows.length;
        const avgLatenessDays = totalLate ? Math.round(rows.reduce((s, r) => s + r.lateDays, 0) / totalLate) : 0;

        return {
            rows,
            byKind,
            stacked,
            totals: { totalLate, avgLatenessDays, worstLatenessDays: worst, kindCount: byKind.length },
        };
    } catch (e) {
        console.error('[getLateReportDeep] failed:', e);
        return empty;
    }
}

export interface ProjectStatusRow {
    _id: string;
    name: string;
    status: string;
    rag: ProjectRag;
    ownerName: string;
    completionPercent: number;
    tasksCount: number;
    overdueTasks: number;
    deadline?: string;
    daysToDeadline?: number;
}

export interface ProjectStatusReport {
    rows: ProjectStatusRow[];
    ragDistribution: Array<{ rag: string; count: number }>;
    velocity: Array<{ month: string; completed: number }>;
    totals: { totalActive: number; onTrack: number; atRisk: number; blocked: number };
}

export async function getProjectStatusDeep(
    projectId?: string,
    ownerId?: string,
): Promise<ProjectStatusReport> {
    const empty: ProjectStatusReport = {
        rows: [],
        ragDistribution: [],
        velocity: [],
        totals: { totalActive: 0, onTrack: 0, atRisk: 0, blocked: 0 },
    };
    const session = await getSession();
    if (!session?.user) return empty;
    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const now = new Date();

        const projectFilter: any = { userId, status: { $nin: ['Completed', 'Cancelled'] } };
        if (projectId && ObjectId.isValid(projectId)) projectFilter._id = new ObjectId(projectId);

        const projects = await db.collection('crm_projects')
            .find(projectFilter, { projection: { _id: 1, name: 1, status: 1, deadline: 1, clientId: 1 } })
            .toArray();

        const projectIds = projects.map((p: any) => p._id);

        const [allTasks, completedTasks] = await Promise.all([
            db.collection('crm_tasks').find({ userId, projectId: { $in: projectIds } }, { projection: { _id: 1, projectId: 1, status: 1, dueDate: 1, completedAt: 1 } }).toArray(),
            db.collection('crm_tasks').find({ userId, projectId: { $in: projectIds }, status: 'Completed' }, { projection: { _id: 1, projectId: 1, completedAt: 1 } }).toArray(),
        ]);

        const tasksByProject: Record<string, { total: number; overdue: number; completed: number }> = {};
        for (const p of projects) tasksByProject[p._id.toString()] = { total: 0, overdue: 0, completed: 0 };

        for (const t of allTasks as any[]) {
            const pid = t.projectId?.toString();
            if (!pid || !tasksByProject[pid]) continue;
            tasksByProject[pid].total++;
            if (t.status === 'Completed') tasksByProject[pid].completed++;
            else if (t.dueDate && new Date(t.dueDate) < now) tasksByProject[pid].overdue++;
        }

        const velocityMap: Record<string, number> = {};
        for (const t of completedTasks as any[]) {
            const m = t.completedAt ? new Date(t.completedAt).toISOString().slice(0, 7) : null;
            if (m) velocityMap[m] = (velocityMap[m] ?? 0) + 1;
        }

        function deriveRag(p: any, stats: { total: number; overdue: number; completed: number }): ProjectRag {
            if (p.status === 'On Hold' || stats.overdue > stats.total * 0.4) return 'blocked';
            if (stats.overdue > 0 || (p.deadline && new Date(p.deadline) < new Date(now.getTime() + 7 * 86400000))) return 'at-risk';
            return 'on-track';
        }

        const rows: ProjectStatusRow[] = projects.map((p: any) => {
            const stats = tasksByProject[p._id.toString()] ?? { total: 0, overdue: 0, completed: 0 };
            const rag = deriveRag(p, stats);
            const deadline = p.deadline ? new Date(p.deadline).toISOString() : undefined;
            const daysToDeadline = deadline ? Math.round((new Date(deadline).getTime() - now.getTime()) / 86400000) : undefined;
            return {
                _id: p._id.toString(),
                name: String(p.name ?? 'Untitled'),
                status: String(p.status ?? ''),
                rag,
                ownerName: '',
                completionPercent: stats.total ? Math.round((stats.completed / stats.total) * 100) : 0,
                tasksCount: stats.total,
                overdueTasks: stats.overdue,
                deadline,
                daysToDeadline,
            };
        });

        const ragCounts = { 'on-track': 0, 'at-risk': 0, blocked: 0 };
        for (const r of rows) ragCounts[r.rag]++;

        return {
            rows,
            ragDistribution: [
                { rag: 'on-track', count: ragCounts['on-track'] },
                { rag: 'at-risk', count: ragCounts['at-risk'] },
                { rag: 'blocked', count: ragCounts.blocked },
            ],
            velocity: Object.entries(velocityMap)
                .sort(([a], [b]) => a.localeCompare(b))
                .slice(-12)
                .map(([month, completed]) => ({ month, completed })),
            totals: {
                totalActive: rows.length,
                onTrack: ragCounts['on-track'],
                atRisk: ragCounts['at-risk'],
                blocked: ragCounts.blocked,
            },
        };
    } catch (e) {
        console.error('[getProjectStatusDeep] failed:', e);
        return empty;
    }
}
