'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/index';
import { ObjectId } from 'mongodb';
import { startOfYear, endOfYear, subMonths, startOfMonth, endOfMonth, format } from 'date-fns';

export async function getAnalyticsData(year: number) {
    const session = await getSession();
    if (!session?.user) return null;

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        const start = new Date(year, 0, 1);
        const end = new Date(year, 11, 31, 23, 59, 59);

        // 1. Financial Trends (Revenue vs Expense)
        // Group invoices (Revenue) and Expenses+Payouts (Expense) by month
        const invoices = await db.collection('crm_invoices').find({
            userId: userObjectId,
            invoiceDate: { $gte: start, $lte: end },
            status: { $ne: 'Draft' } // Exclude drafts
        }).toArray();

        const expenses = await db.collection('crm_expenses').find({
            userId: userObjectId,
            expenseDate: { $gte: start, $lte: end }
        }).toArray();

        const payouts = await db.collection('crm_payouts').find({
            userId: userObjectId,
            paymentDate: { $gte: start, $lte: end }
        }).toArray();

        // 2. Data Aggregation
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthlyData = months.map(m => ({ name: m, revenue: 0, expense: 0 }));

        invoices.forEach((inv: any) => {
            const mIndex = new Date(inv.invoiceDate).getMonth();
            monthlyData[mIndex].revenue += (inv.total || 0);
        });

        expenses.forEach((exp: any) => {
            const mIndex = new Date(exp.expenseDate).getMonth();
            monthlyData[mIndex].expense += (exp.amount || 0);
        });

        payouts.forEach((pay: any) => {
            const mIndex = new Date(pay.paymentDate).getMonth();
            monthlyData[mIndex].expense += (pay.amount || 0);
        });

        // 3. Lead Funnel (All time for now, or filtered if needed)
        const leads = await db.collection('crm_leads').find({
            userId: userObjectId
        }).toArray();

        const funnelData: { [key: string]: number } = {};
        leads.forEach((l: any) => {
            const status = l.status || "New";
            funnelData[status] = (funnelData[status] || 0) + 1;
        });

        const funnelChart = Object.keys(funnelData).map(key => ({
            name: key,
            value: funnelData[key]
        }));

        // 4. KPIs
        const totalRevenue = monthlyData.reduce((acc, curr) => acc + curr.revenue, 0);
        const totalExpense = monthlyData.reduce((acc, curr) => acc + curr.expense, 0);
        const netProfit = totalRevenue - totalExpense;
        const totalLeads = leads.length;

        return {
            financials: monthlyData,
            funnel: funnelChart,
            kpis: {
                totalRevenue,
                totalExpense,
                netProfit,
                totalLeads
            }
        };

    } catch (e) {
        console.error("Analytics Error:", e);
        return null;
    }
}
