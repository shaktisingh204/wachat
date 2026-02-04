'use server';

import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getErrorMessage } from '@/lib/utils';
import { startOfDay, endOfDay } from 'date-fns';

export type DayBookTransaction = {
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

export type CashFlowEntry = {
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
