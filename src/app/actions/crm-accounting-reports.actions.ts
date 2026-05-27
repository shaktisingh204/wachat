'use server';

import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getErrorMessage } from '@/lib/utils';
import { startOfDay, endOfDay } from 'date-fns';

type DayBookTransaction = {
    id: string;
    flow: 'In' | 'Out';
    date: Date;
    type: 'Invoice' | 'Bill' | 'Expense' | 'Payout' | 'Receipt';
    number: string;
    partyName: string;
    amount: number;
    status: string;
};

export async function getDayBookTransactions(date: Date): Promise<{ transactions: DayBookTransaction[]; totalIn: number; totalOut: number }> {
    const session = await getSession();
    if (!session?.user) return { transactions: [], totalIn: 0, totalOut: 0 };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const start = startOfDay(date);
        const end = endOfDay(date);

        // Fetch concurrently
        // 1. Invoices (Created on date)
        const invoicesPromise = db.collection('crm_invoices').find({
            userId: userObjectId,
            invoiceDate: { $gte: start, $lte: end }
        }).toArray();

        // 2. Receipts (Money In)
        const receiptsPromise = db.collection('crm_payment_receipts').find({
            userId: userObjectId,
            receiptDate: { $gte: start, $lte: end }
        }).toArray();

        // 3. Purchases/Bills (Created on date)
        const purchasesPromise = db.collection('crm_purchases').find({
            userId: userObjectId,
            orderDate: { $gte: start, $lte: end } // Assuming orderDate is bill date
        }).toArray();

        // 4. Payouts (Money Out)
        const payoutsPromise = db.collection('crm_payouts').find({
            userId: userObjectId,
            paymentDate: { $gte: start, $lte: end }
        }).toArray();

        // 5. Expenses (Money Out directly)
        const expensesPromise = db.collection('crm_expenses').find({
            userId: userObjectId,
            expenseDate: { $gte: start, $lte: end }
        }).toArray();

        const [invoices, receipts, purchases, payouts, expenses] = await Promise.all([
            invoicesPromise, receiptsPromise, purchasesPromise, payoutsPromise, expensesPromise
        ]);

        const transactions: DayBookTransaction[] = [];

        // Map and Push
        invoices.forEach((inv: any) => {
            transactions.push({
                id: inv._id.toString(),
                flow: 'In', // Technically Accrual, but Day Book usually shows all activity
                date: new Date(inv.invoiceDate),
                type: 'Invoice',
                number: inv.invoiceNumber,
                partyName: 'Client', // Needs lookup ideally, simplified for now
                amount: inv.total,
                status: inv.status
            });
        });

        receipts.forEach((rec: any) => {
            transactions.push({
                id: rec._id.toString(),
                flow: 'In',
                date: new Date(rec.receiptDate),
                type: 'Receipt',
                number: rec.receiptNumber,
                partyName: 'Client',
                amount: rec.totalAmountReceived,
                status: 'Paid'
            });
        });

        purchases.forEach((pur: any) => {
            transactions.push({
                id: pur._id.toString(),
                flow: 'Out',
                date: new Date(pur.orderDate),
                type: 'Bill',
                number: pur.orderNumber,
                partyName: 'Vendor',
                amount: pur.total,
                status: pur.status
            });
        });

        payouts.forEach((pay: any) => {
            transactions.push({
                id: pay._id.toString(),
                flow: 'Out',
                date: new Date(pay.paymentDate),
                type: 'Payout',
                number: pay.referenceNumber || '-',
                partyName: 'Vendor',
                amount: pay.amount,
                status: 'Paid'
            });
        });

        expenses.forEach((exp: any) => {
            transactions.push({
                id: exp._id.toString(),
                flow: 'Out',
                date: new Date(exp.expenseDate),
                type: 'Expense',
                number: exp.referenceNumber || '-',
                partyName: exp.description || 'Expense',
                amount: exp.amount,
                status: 'Paid'
            });
        });

        // Calculate Totals (Cash Flow only usually counts Receipts/Payouts/Expenses, but Day Book lists all)
        // Let's create specific totals for Money In/Out based on Types
        const totalIn = receipts.reduce((sum: number, r: any) => sum + r.totalAmountReceived, 0);
        const totalOut = payouts.reduce((sum: number, p: any) => sum + p.amount, 0) + expenses.reduce((sum: number, e: any) => sum + e.amount, 0);

        return {
            transactions: transactions.sort((a, b) => b.date.getTime() - a.date.getTime()),
            totalIn,
            totalOut
        };

    } catch (e: any) {
        console.error("Failed to fetch Day Book:", e);
        return { transactions: [], totalIn: 0, totalOut: 0 };
    }
}

type CashFlowEntry = {
    month: string; // "Jan 2024"
    inflow: number;
    outflow: number;
    net: number;
};

export async function getCashFlowStatement(year: number): Promise<{ monthly: CashFlowEntry[]; totalIn: number; totalOut: number }> {
    const session = await getSession();
    if (!session?.user) return { monthly: [], totalIn: 0, totalOut: 0 };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const start = new Date(year, 0, 1);
        const end = new Date(year, 11, 31, 23, 59, 59);

        // Fetch Inflows (Receipts)
        const receipts = await db.collection('crm_payment_receipts').find({
            userId: userObjectId,
            receiptDate: { $gte: start, $lte: end }
        }).toArray();

        // Fetch Outflows (Payouts + Expenses)
        const payoutsPromise = db.collection('crm_payouts').find({
            userId: userObjectId,
            paymentDate: { $gte: start, $lte: end }
        }).toArray();

        const expensesPromise = db.collection('crm_expenses').find({
            userId: userObjectId,
            expenseDate: { $gte: start, $lte: end }
        }).toArray();

        const [payouts, expenses] = await Promise.all([payoutsPromise, expensesPromise]);

        // Aggregate by month
        const monthlyData = new Map<string, { in: number; out: number }>();
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // Initialize
        months.forEach(m => monthlyData.set(m, { in: 0, out: 0 }));

        receipts.forEach((r: any) => {
            const m = months[new Date(r.receiptDate).getMonth()];
            const curr = monthlyData.get(m)!;
            curr.in += (r.totalAmountReceived || 0);
        });

        payouts.forEach((p: any) => {
            const m = months[new Date(p.paymentDate).getMonth()];
            const curr = monthlyData.get(m)!;
            curr.out += (p.amount || 0);
        });

        expenses.forEach((e: any) => {
            const m = months[new Date(e.expenseDate).getMonth()];
            const curr = monthlyData.get(m)!;
            curr.out += (e.amount || 0);
        });

        const result: CashFlowEntry[] = [];
        let totalIn = 0;
        let totalOut = 0;

        months.forEach(m => {
            const data = monthlyData.get(m)!;
            result.push({
                month: `${m} ${year}`,
                inflow: data.in,
                outflow: data.out,
                net: data.in - data.out
            });
            totalIn += data.in;
            totalOut += data.out;
        });

        return { monthly: result, totalIn, totalOut };

    } catch (e: any) {
        console.error("Failed to fetch Cash Flow:", e);
        return { monthly: [], totalIn: 0, totalOut: 0 };
    }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Extended reports (range + categorised) used by the deeper accounting views.
 * Additive — pre-existing callers (day-book/cash-flow legacy paths) untouched.
 * ────────────────────────────────────────────────────────────────────────── */

type DayBookRangeResult = {
    transactions: DayBookTransaction[];
    totalIn: number;
    totalOut: number;
    countsByType: Record<string, number>;
};

/**
 * Range-based day book (used by the deep day-book page when the user picks
 * a custom Apr-Mar FY window or multi-day range).
 */
export async function getDayBookRange(
    from: Date,
    to: Date,
): Promise<DayBookRangeResult> {
    const session = await getSession();
    if (!session?.user) {
        return { transactions: [], totalIn: 0, totalOut: 0, countsByType: {} };
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        const start = startOfDay(from);
        const end = endOfDay(to);

        const [invoices, receipts, purchases, payouts, expenses] = await Promise.all([
            db.collection('crm_invoices').find({
                userId: userObjectId,
                invoiceDate: { $gte: start, $lte: end },
            }).toArray(),
            db.collection('crm_payment_receipts').find({
                userId: userObjectId,
                receiptDate: { $gte: start, $lte: end },
            }).toArray(),
            db.collection('crm_purchases').find({
                userId: userObjectId,
                orderDate: { $gte: start, $lte: end },
            }).toArray(),
            db.collection('crm_payouts').find({
                userId: userObjectId,
                paymentDate: { $gte: start, $lte: end },
            }).toArray(),
            db.collection('crm_expenses').find({
                userId: userObjectId,
                expenseDate: { $gte: start, $lte: end },
            }).toArray(),
        ]);

        const transactions: DayBookTransaction[] = [];

        invoices.forEach((inv: any) => transactions.push({
            id: inv._id.toString(),
            flow: 'In',
            date: new Date(inv.invoiceDate),
            type: 'Invoice',
            number: inv.invoiceNumber || '-',
            partyName: inv.clientName || 'Client',
            amount: Number(inv.total) || 0,
            status: inv.status || 'Posted',
        }));

        receipts.forEach((rec: any) => transactions.push({
            id: rec._id.toString(),
            flow: 'In',
            date: new Date(rec.receiptDate),
            type: 'Receipt',
            number: rec.receiptNumber || '-',
            partyName: rec.clientName || 'Client',
            amount: Number(rec.totalAmountReceived) || 0,
            status: 'Paid',
        }));

        purchases.forEach((pur: any) => transactions.push({
            id: pur._id.toString(),
            flow: 'Out',
            date: new Date(pur.orderDate),
            type: 'Bill',
            number: pur.orderNumber || '-',
            partyName: pur.vendorName || 'Vendor',
            amount: Number(pur.total) || 0,
            status: pur.status || 'Posted',
        }));

        payouts.forEach((pay: any) => transactions.push({
            id: pay._id.toString(),
            flow: 'Out',
            date: new Date(pay.paymentDate),
            type: 'Payout',
            number: pay.referenceNumber || '-',
            partyName: pay.vendorName || 'Vendor',
            amount: Number(pay.amount) || 0,
            status: 'Paid',
        }));

        expenses.forEach((exp: any) => transactions.push({
            id: exp._id.toString(),
            flow: 'Out',
            date: new Date(exp.expenseDate),
            type: 'Expense',
            number: exp.referenceNumber || '-',
            partyName: exp.description || 'Expense',
            amount: Number(exp.amount) || 0,
            status: 'Paid',
        }));

        const countsByType: Record<string, number> = {};
        for (const t of transactions) {
            countsByType[t.type] = (countsByType[t.type] || 0) + 1;
        }

        const totalIn = receipts.reduce(
            (sum: number, r: any) => sum + (Number(r.totalAmountReceived) || 0),
            0,
        );
        const totalOut =
            payouts.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) +
            expenses.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);

        return {
            transactions: transactions.sort((a, b) => b.date.getTime() - a.date.getTime()),
            totalIn,
            totalOut,
            countsByType,
        };
    } catch (e) {
        console.error('Failed to fetch Day Book range:', e);
        return { transactions: [], totalIn: 0, totalOut: 0, countsByType: {} };
    }
}

type CashFlowCategoryEntry = {
    month: string;
    operating: number;
    investing: number;
    financing: number;
    inflow: number;
    outflow: number;
    net: number;
};

type CashFlowReportResult = {
    monthly: CashFlowCategoryEntry[];
    totalIn: number;
    totalOut: number;
    openingCash: number;
    closingCash: number;
};

/**
 * Categorised cash-flow report. Without a strict cash-flow classification on
 * source rows we fall back to a pragmatic mapping:
 *   - operating  → invoices, receipts, expenses
 *   - investing  → purchases (capital outflow proxy)
 *   - financing  → payouts (vendor settlements proxy)
 */
export async function getCashFlowReport(
    fromYear: number,
    fromMonth: number,
    toYear: number,
    toMonth: number,
): Promise<CashFlowReportResult> {
    const session = await getSession();
    if (!session?.user) {
        return { monthly: [], totalIn: 0, totalOut: 0, openingCash: 0, closingCash: 0 };
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const start = new Date(fromYear, fromMonth, 1);
        const end = new Date(toYear, toMonth + 1, 0, 23, 59, 59);

        const [receipts, payouts, expenses, purchases] = await Promise.all([
            db.collection('crm_payment_receipts').find({
                userId: userObjectId,
                receiptDate: { $gte: start, $lte: end },
            }).toArray(),
            db.collection('crm_payouts').find({
                userId: userObjectId,
                paymentDate: { $gte: start, $lte: end },
            }).toArray(),
            db.collection('crm_expenses').find({
                userId: userObjectId,
                expenseDate: { $gte: start, $lte: end },
            }).toArray(),
            db.collection('crm_purchases').find({
                userId: userObjectId,
                orderDate: { $gte: start, $lte: end },
            }).toArray(),
        ]);

        // Pre-period inflows/outflows form opening cash position
        const [priorReceipts, priorPayouts, priorExpenses] = await Promise.all([
            db.collection('crm_payment_receipts')
                .aggregate([
                    { $match: { userId: userObjectId, receiptDate: { $lt: start } } },
                    { $group: { _id: null, total: { $sum: '$totalAmountReceived' } } },
                ])
                .toArray(),
            db.collection('crm_payouts')
                .aggregate([
                    { $match: { userId: userObjectId, paymentDate: { $lt: start } } },
                    { $group: { _id: null, total: { $sum: '$amount' } } },
                ])
                .toArray(),
            db.collection('crm_expenses')
                .aggregate([
                    { $match: { userId: userObjectId, expenseDate: { $lt: start } } },
                    { $group: { _id: null, total: { $sum: '$amount' } } },
                ])
                .toArray(),
        ]);

        const openingCash =
            (priorReceipts[0]?.total || 0) -
            (priorPayouts[0]?.total || 0) -
            (priorExpenses[0]?.total || 0);

        // Build the month buckets between start and end
        const buckets: CashFlowCategoryEntry[] = [];
        const cursor = new Date(start);
        while (cursor <= end) {
            const label = cursor.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
            buckets.push({
                month: label,
                operating: 0,
                investing: 0,
                financing: 0,
                inflow: 0,
                outflow: 0,
                net: 0,
            });
            cursor.setMonth(cursor.getMonth() + 1);
        }

        const bucketIndex = (d: Date): number => {
            const monthsFromStart =
                (d.getFullYear() - fromYear) * 12 + (d.getMonth() - fromMonth);
            return monthsFromStart >= 0 && monthsFromStart < buckets.length ? monthsFromStart : -1;
        };

        receipts.forEach((r: any) => {
            const idx = bucketIndex(new Date(r.receiptDate));
            if (idx < 0) return;
            const amt = Number(r.totalAmountReceived) || 0;
            buckets[idx].operating += amt;
            buckets[idx].inflow += amt;
        });

        expenses.forEach((e: any) => {
            const idx = bucketIndex(new Date(e.expenseDate));
            if (idx < 0) return;
            const amt = Number(e.amount) || 0;
            buckets[idx].operating -= amt;
            buckets[idx].outflow += amt;
        });

        purchases.forEach((p: any) => {
            const idx = bucketIndex(new Date(p.orderDate));
            if (idx < 0) return;
            const amt = Number(p.total) || 0;
            buckets[idx].investing -= amt;
            buckets[idx].outflow += amt;
        });

        payouts.forEach((p: any) => {
            const idx = bucketIndex(new Date(p.paymentDate));
            if (idx < 0) return;
            const amt = Number(p.amount) || 0;
            buckets[idx].financing -= amt;
            buckets[idx].outflow += amt;
        });

        let totalIn = 0;
        let totalOut = 0;
        for (const b of buckets) {
            b.net = b.inflow - b.outflow;
            totalIn += b.inflow;
            totalOut += b.outflow;
        }

        return {
            monthly: buckets,
            totalIn,
            totalOut,
            openingCash,
            closingCash: openingCash + totalIn - totalOut,
        };
    } catch (e) {
        console.error('Failed to fetch Cash Flow report:', e);
        return { monthly: [], totalIn: 0, totalOut: 0, openingCash: 0, closingCash: 0 };
    }
}

/**
 * Monthly revenue vs expense series — used by the Income Statement chart.
 */
type MonthlyPnLEntry = {
    month: string;
    revenue: number;
    expense: number;
    net: number;
};

export async function getMonthlyRevenueExpense(
    fromYear: number,
    fromMonth: number,
    toYear: number,
    toMonth: number,
): Promise<MonthlyPnLEntry[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const start = new Date(fromYear, fromMonth, 1);
        const end = new Date(toYear, toMonth + 1, 0, 23, 59, 59);

        const [invoices, expenses] = await Promise.all([
            db.collection('crm_invoices').find({
                userId: userObjectId,
                invoiceDate: { $gte: start, $lte: end },
            }).toArray(),
            db.collection('crm_expenses').find({
                userId: userObjectId,
                expenseDate: { $gte: start, $lte: end },
            }).toArray(),
        ]);

        const buckets: MonthlyPnLEntry[] = [];
        const cursor = new Date(start);
        while (cursor <= end) {
            buckets.push({
                month: cursor.toLocaleString('en-IN', { month: 'short', year: 'numeric' }),
                revenue: 0,
                expense: 0,
                net: 0,
            });
            cursor.setMonth(cursor.getMonth() + 1);
        }

        const bucketIndex = (d: Date): number => {
            const m = (d.getFullYear() - fromYear) * 12 + (d.getMonth() - fromMonth);
            return m >= 0 && m < buckets.length ? m : -1;
        };

        invoices.forEach((inv: any) => {
            const idx = bucketIndex(new Date(inv.invoiceDate));
            if (idx < 0) return;
            buckets[idx].revenue += Number(inv.total) || Number(inv.totalAmount) || 0;
        });

        expenses.forEach((e: any) => {
            const idx = bucketIndex(new Date(e.expenseDate));
            if (idx < 0) return;
            buckets[idx].expense += Number(e.amount) || 0;
        });

        for (const b of buckets) {
            b.net = b.revenue - b.expense;
        }
        return buckets;
    } catch (e) {
        console.error('Failed to fetch monthly revenue/expense:', e);
        return [];
    }
}
