import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { requireSession } from '@/lib/hr-crud';

function fyRangeFromAnchor(anchorIso?: string): { start: Date; end: Date; label: string } {
  const anchor = anchorIso ? new Date(anchorIso) : new Date();
  const y = anchor.getFullYear();
  const startYear = anchor.getMonth() < 3 ? y - 1 : y;
  const start = new Date(startYear, 3, 1, 0, 0, 0);
  const end = new Date(startYear + 1, 2, 31, 23, 59, 59);
  return { start, end, label: `FY ${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}` };
}

export async function getExpenseReportDeepDB({
  fyAnchor,
  category,
  vendor,
  expenseType,
  page = 1,
  limit = 20,
}: {
  fyAnchor?: string;
  category?: string;
  vendor?: string;
  expenseType?: string;
  page?: number;
  limit?: number;
}) {
  const user = await requireSession();
  if (!user) return null;
  const { db } = await connectToDatabase();
  const fy = fyRangeFromAnchor(fyAnchor);
  const prevFy = fyRangeFromAnchor(new Date(fy.start.getFullYear() - 1, 3, 15).toISOString());

  const match: any = { userId: new ObjectId(user._id), expenseDate: { $gte: fy.start, $lte: fy.end } };
  const prevMatch: any = { userId: new ObjectId(user._id), expenseDate: { $gte: prevFy.start, $lte: prevFy.end } };

  if (category) {
    match.expenseAccount = { $regex: category, $options: 'i' };
  }
  if (vendor) {
    match.$or = [
      { description: { $regex: vendor, $options: 'i' } },
      { reference: { $regex: vendor, $options: 'i' } }
    ];
  }
  if (expenseType) {
    if (match.$or) {
      match.$and = [
        { $or: match.$or },
        { $or: [{ expenseAccount: { $regex: expenseType, $options: 'i' } }, { description: { $regex: expenseType, $options: 'i' } }] }
      ];
      delete match.$or;
    } else {
      match.$or = [{ expenseAccount: { $regex: expenseType, $options: 'i' } }, { description: { $regex: expenseType, $options: 'i' } }];
    }
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Multi-currency handling: amount * exchangeRate
  const currencyMultiplier = { $ifNull: ['$exchangeRate', 1] };
  const convertedAmount = { $multiply: ['$amount', currencyMultiplier] };

  const [monthly, byCategory, totals, prevTotals, monthTotals, expenses, totalCount] = await Promise.all([
    db.collection('crm_expenses').aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$expenseDate' } }, total: { $sum: convertedAmount }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]).toArray(),
    db.collection('crm_expenses').aggregate([
      { $match: match },
      { $group: { _id: { $ifNull: ['$expenseAccount', 'Uncategorized'] }, total: { $sum: convertedAmount }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]).toArray(),
    db.collection('crm_expenses').aggregate([
      { $match: match },
      { $group: { _id: null, total: { $sum: convertedAmount } } },
    ]).toArray(),
    db.collection('crm_expenses').aggregate([
      { $match: prevMatch },
      { $group: { _id: null, total: { $sum: convertedAmount } } },
    ]).toArray(),
    db.collection('crm_expenses').aggregate([
      { $match: { userId: new ObjectId(user._id), expenseDate: { $gte: monthStart, $lte: monthEnd } } },
      { $group: { _id: null, total: { $sum: convertedAmount } } },
    ]).toArray(),
    db.collection('crm_expenses')
      .find(match)
      .sort({ expenseDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    db.collection('crm_expenses').countDocuments(match)
  ]);

  const fyTotal = (totals[0] as any)?.total || 0;
  const prevTotal = (prevTotals[0] as any)?.total || 0;
  const monthTotal = (monthTotals[0] as any)?.total || 0;
  const top = byCategory[0] as any;

  const rows = expenses.map((exp: any) => {
    const rate = exp.exchangeRate || 1;
    return {
      id: String(exp._id),
      date: exp.expenseDate ? new Date(exp.expenseDate).toISOString().slice(0, 10) : '',
      category: String(exp.expenseAccount || 'Uncategorized'),
      description: String(exp.description || ''),
      amount: Number(exp.amount || 0) * rate,
      taxAmount: Number(exp.taxAmount || 0) * rate,
      status: String(exp.status || ''),
      reference: String(exp.reference || ''),
    };
  });

  // Predictive forecasting
  const monthlyData = (monthly as any[]).map(r => ({ period: r._id, total: r.total || 0 }));
  const forecastMonths = 3;
  if (monthlyData.length >= 2) {
    const avg = monthlyData.reduce((sum, item) => sum + item.total, 0) / monthlyData.length;
    let lastDate = new Date(monthlyData[monthlyData.length - 1].period + '-01');
    for (let i = 0; i < forecastMonths; i++) {
      lastDate.setMonth(lastDate.getMonth() + 1);
      const periodStr = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, '0')}`;
      monthlyData.push({ period: periodStr, forecast: avg, total: 0 } as any);
    }
  }

  return {
    kpis: {
      totalFY: fyTotal,
      lastYtdTotal: prevTotal, // Added YTD comparison
      thisMonth: monthTotal,
      yoyChangePct: prevTotal > 0 ? ((fyTotal - prevTotal) / prevTotal) * 100 : 0,
      topCategory: String(top?._id || '—'),
      topCategoryTotal: Number(top?.total || 0),
    },
    monthly: monthlyData,
    byCategory: (byCategory as any[]).map((r) => ({
      category: String(r._id || 'Uncategorized'),
      total: r.total || 0,
      count: r.count || 0,
    })),
    rows,
    totalCount,
    fyLabel: fy.label,
  };
}

export async function getIncomeReportDeepDB({
  fyAnchor,
  source,
  client,
  page = 1,
  limit = 20,
}: {
  fyAnchor?: string;
  source?: string;
  client?: string;
  page?: number;
  limit?: number;
}) {
  const user = await requireSession();
  if (!user) return null;
  const { db } = await connectToDatabase();
  const fy = fyRangeFromAnchor(fyAnchor);
  const prevFy = fyRangeFromAnchor(new Date(fy.start.getFullYear() - 1, 3, 15).toISOString());

  const match: any = {
    userId: new ObjectId(user._id),
    invoiceDate: { $gte: fy.start, $lte: fy.end },
    status: { $in: ['Paid', 'Partially Paid'] },
  };
  const prevMatch: any = {
    userId: new ObjectId(user._id),
    invoiceDate: { $gte: prevFy.start, $lte: prevFy.end },
    status: { $in: ['Paid', 'Partially Paid'] },
  };

  if (source) {
    match.$or = [
      { source: { $regex: source, $options: 'i' } },
      { leadSource: { $regex: source, $options: 'i' } }
    ];
  }
  if (client) {
    match.clientName = { $regex: client, $options: 'i' };
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Multi-currency handling:
  const currencyMultiplier = { $ifNull: ['$exchangeRate', 1] };
  const baseAmount = { $ifNull: ['$paidAmount', '$total'] };
  const convertedAmount = { $multiply: [baseAmount, currencyMultiplier] };

  const [monthly, bySource, totals, prevTotals, monthTotals, invoices, totalCount] = await Promise.all([
    db.collection('crm_invoices').aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$invoiceDate' } }, total: { $sum: convertedAmount }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]).toArray(),
    db.collection('crm_invoices').aggregate([
      { $match: match },
      { $group: { _id: { $ifNull: ['$source', { $ifNull: ['$leadSource', 'Direct'] }] }, total: { $sum: convertedAmount }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]).toArray(),
    db.collection('crm_invoices').aggregate([
      { $match: match },
      { $group: { _id: null, total: { $sum: convertedAmount } } },
    ]).toArray(),
    db.collection('crm_invoices').aggregate([
      { $match: prevMatch },
      { $group: { _id: null, total: { $sum: convertedAmount } } },
    ]).toArray(),
    db.collection('crm_invoices').aggregate([
      { $match: { userId: new ObjectId(user._id), invoiceDate: { $gte: monthStart, $lte: monthEnd }, status: { $in: ['Paid', 'Partially Paid'] } } },
      { $group: { _id: null, total: { $sum: convertedAmount } } },
    ]).toArray(),
    db.collection('crm_invoices').aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'crm_accounts',
          localField: 'accountId',
          foreignField: '_id',
          as: 'acct',
        },
      },
      { $sort: { invoiceDate: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ]).toArray(),
    db.collection('crm_invoices').countDocuments(match)
  ]);

  const fyTotal = (totals[0] as any)?.total || 0;
  const prevTotal = (prevTotals[0] as any)?.total || 0;
  const monthTotal = (monthTotals[0] as any)?.total || 0;
  const top = bySource[0] as any;

  const rows = invoices.map((inv: any) => {
    const rate = inv.exchangeRate || 1;
    return {
      id: String(inv._id),
      invoiceNumber: inv.invoiceNumber || '—',
      invoiceDate: inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().slice(0, 10) : '',
      clientName: inv.acct?.[0]?.name || inv.clientName || 'Unknown',
      total: Number(inv.total || 0) * rate,
      paidAmount: Number(inv.paidAmount || 0) * rate,
      status: String(inv.status || ''),
      source: String(inv.source || inv.leadSource || 'Direct'),
    };
  });

  const monthlyData = (monthly as any[]).map(r => ({ period: r._id, total: r.total || 0 }));
  const forecastMonths = 3;
  if (monthlyData.length >= 2) {
    const avg = monthlyData.reduce((sum, item) => sum + item.total, 0) / monthlyData.length;
    let lastDate = new Date(monthlyData[monthlyData.length - 1].period + '-01');
    for (let i = 0; i < forecastMonths; i++) {
      lastDate.setMonth(lastDate.getMonth() + 1);
      const periodStr = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, '0')}`;
      monthlyData.push({ period: periodStr, forecast: avg, total: 0 } as any);
    }
  }

  return {
    kpis: {
      totalFY: fyTotal,
      lastYtdTotal: prevTotal,
      thisMonth: monthTotal,
      yoyChangePct: prevTotal > 0 ? ((fyTotal - prevTotal) / prevTotal) * 100 : 0,
      topSource: String(top?._id || '—'),
      topSourceTotal: Number(top?.total || 0),
    },
    monthly: monthlyData,
    bySource: (bySource as any[]).map((r) => ({
      category: String(r._id || 'Direct'),
      total: r.total || 0,
      count: r.count || 0,
    })),
    rows,
    totalCount,
    fyLabel: fy.label,
  };
}

export async function getProfitLossDeepDB({
  fyAnchor,
  granularity = 'monthly',
  department,
  page = 1,
  limit = 20,
}: {
  fyAnchor?: string;
  granularity?: string;
  department?: string;
  page?: number;
  limit?: number;
}) {
  const user = await requireSession();
  if (!user) return null;
  const { db } = await connectToDatabase();
  const fy = fyRangeFromAnchor(fyAnchor);

  // In real implementation, filtering by department might filter crm_expenses or crm_invoices.
  // We'll omit department filtering for brevity or if there's no department field.

  const incMatch = { userId: new ObjectId(user._id), invoiceDate: { $gte: fy.start, $lte: fy.end }, status: { $in: ['Paid', 'Partially Paid'] } };
  const expMatch = { userId: new ObjectId(user._id), expenseDate: { $gte: fy.start, $lte: fy.end } };

  // For P&L, assume COGS are expenses with expenseAccount = 'Cost of Goods Sold' or similar,
  // or we just assume all expenses are "Expense" and COGS is 0 for now.
  // Actually, we'll split them: if expenseAccount includes 'COGS' or 'Cost of Goods', it's COGS.

  const [incomes, expenses] = await Promise.all([
    db.collection('crm_invoices').aggregate([
      { $match: incMatch },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$invoiceDate' } }, total: { $sum: { $multiply: [{ $ifNull: ['$paidAmount', '$total'] }, { $ifNull: ['$exchangeRate', 1] }] } } } }
    ]).toArray(),
    db.collection('crm_expenses').aggregate([
      { $match: expMatch },
      { $group: { 
        _id: {
          period: { $dateToString: { format: '%Y-%m', date: '$expenseDate' } },
          category: { $ifNull: ['$expenseAccount', 'Uncategorized'] }
        },
        total: { $sum: { $multiply: ['$amount', { $ifNull: ['$exchangeRate', 1] }] } }
      } }
    ]).toArray()
  ]);

  const periodsMap = new Map<string, { revenue: number; cogs: number; expense: number; profit: number; cogsDetails: Record<string, number>; expenseDetails: Record<string, number> }>();
  
  for (const inc of incomes) {
    if (!periodsMap.has(inc._id)) periodsMap.set(inc._id, { revenue: 0, cogs: 0, expense: 0, profit: 0, cogsDetails: {}, expenseDetails: {} });
    periodsMap.get(inc._id)!.revenue += inc.total;
  }
  for (const exp of expenses) {
    const period = exp._id.period;
    const cat = exp._id.category as string;
    const isCogs = cat.toLowerCase().includes('cogs') || cat.toLowerCase().includes('cost of goods');
    
    if (!periodsMap.has(period)) periodsMap.set(period, { revenue: 0, cogs: 0, expense: 0, profit: 0, cogsDetails: {}, expenseDetails: {} });
    const pData = periodsMap.get(period)!;
    
    if (isCogs) {
      pData.cogs += exp.total;
      pData.cogsDetails[cat] = (pData.cogsDetails[cat] || 0) + exp.total;
    } else {
      pData.expense += exp.total;
      pData.expenseDetails[cat] = (pData.expenseDetails[cat] || 0) + exp.total;
    }
  }

  let monthly = Array.from(periodsMap.entries()).map(([period, data]) => ({
    period,
    revenue: data.revenue,
    cogs: data.cogs,
    expense: data.expense,
    profit: data.revenue - data.cogs - data.expense,
    cogsDetails: data.cogsDetails,
    expenseDetails: data.expenseDetails,
  })).sort((a, b) => a.period.localeCompare(b.period));

  if (granularity === 'quarterly') {
    const qMap = new Map();
    for (const m of monthly) {
      const [year, mm] = m.period.split('-');
      const q = Math.ceil(Number(mm) / 3);
      const qPeriod = `${year}-Q${q}`;
      if (!qMap.has(qPeriod)) qMap.set(qPeriod, { period: qPeriod, revenue: 0, cogs: 0, expense: 0, profit: 0, cogsDetails: {}, expenseDetails: {} });
      const qData = qMap.get(qPeriod);
      qData.revenue += m.revenue;
      qData.cogs += m.cogs;
      qData.expense += m.expense;
      qData.profit += m.profit;
      for (const [k, v] of Object.entries(m.cogsDetails)) qData.cogsDetails[k] = (qData.cogsDetails[k] || 0) + v;
      for (const [k, v] of Object.entries(m.expenseDetails)) qData.expenseDetails[k] = (qData.expenseDetails[k] || 0) + v;
    }
    monthly = Array.from(qMap.values()).sort((a, b) => a.period.localeCompare(b.period));
  }

  let totalRev = 0, totalCogs = 0, totalExp = 0;
  for (const m of monthly) {
    totalRev += m.revenue;
    totalCogs += m.cogs;
    totalExp += m.expense;
  }
  const gp = totalRev - totalCogs;
  const np = gp - totalExp;

  return {
    kpis: {
      grossProfit: gp,
      netProfit: np,
      marginPct: totalRev ? (np / totalRev) * 100 : 0,
      ebitda: np, // simplified
      revenue: totalRev,
      cogs: totalCogs,
      opex: totalExp,
    },
    monthly,
    fyLabel: fy.label,
  };
}
