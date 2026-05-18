import { cn } from '@/components/zoruui';
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

