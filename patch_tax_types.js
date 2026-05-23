const fs = require('fs');

const typesFile = 'src/lib/worksuite/report-types.ts';
let typesContent = fs.readFileSync(typesFile, 'utf8');
typesContent = typesContent.replace(
  'export interface TaxMonthlyRow {\n  period: string;\n  collected: number;\n  paid: number;\n  net: number;\n}',
  'export interface TaxMonthlyRow {\n  period: string;\n  taxType: string;\n  collected: number;\n  paid: number;\n  net: number;\n}'
);
fs.writeFileSync(typesFile, typesContent);

const actionsFile = 'src/app/actions/worksuite/reports.actions.ts';
let actionsContent = fs.readFileSync(actionsFile, 'utf8');
const oldAgg = `
  const [invRows, expRows, pendingFilings] = await Promise.all([
    db.collection('crm_invoices').aggregate([
      {
        $match: {
          userId: toOid(user),
          invoiceDate: { $gte: fy.start, $lte: fy.end },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$invoiceDate' } },
          subtotal: { $sum: { $ifNull: ['$subtotal', 0] } },
          total: { $sum: { $ifNull: ['$total', 0] } },
        },
      },
    ]).toArray(),
    db.collection('crm_expenses').aggregate([
      {
        $match: {
          userId: toOid(user),
          expenseDate: { $gte: fy.start, $lte: fy.end },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$expenseDate' } },
          taxAmount: { $sum: { $ifNull: ['$taxAmount', 0] } },
        },
      },
    ]).toArray(),
`;

const newAgg = `
  const [invRows, expRows, pendingFilings] = await Promise.all([
    db.collection('crm_invoices').aggregate([
      {
        $match: {
          userId: toOid(user),
          invoiceDate: { $gte: fy.start, $lte: fy.end },
        },
      },
      {
        $group: {
          _id: {
            period: { $dateToString: { format: '%Y-%m', date: '$invoiceDate' } },
            taxType: { $ifNull: ['$taxType', 'GST'] },
          },
          subtotal: { $sum: { $ifNull: ['$subtotal', 0] } },
          total: { $sum: { $ifNull: ['$total', 0] } },
        },
      },
    ]).toArray(),
    db.collection('crm_expenses').aggregate([
      {
        $match: {
          userId: toOid(user),
          expenseDate: { $gte: fy.start, $lte: fy.end },
        },
      },
      {
        $group: {
          _id: {
            period: { $dateToString: { format: '%Y-%m', date: '$expenseDate' } },
            taxType: { $ifNull: ['$taxType', 'GST'] },
          },
          taxAmount: { $sum: { $ifNull: ['$taxAmount', 0] } },
        },
      },
    ]).toArray(),
`;
actionsContent = actionsContent.replace(oldAgg.trim(), newAgg.trim());

const oldLoop = `
  const byPeriod = new Map<string, TaxMonthlyRow>();
  for (const r of invRows as Array<{ _id: string; subtotal: number; total: number }>) {
    const collected = Math.max(0, (r.total || 0) - (r.subtotal || 0));
    byPeriod.set(r._id, { period: r._id, collected, paid: 0, net: collected });
  }
  for (const r of expRows as Array<{ _id: string; taxAmount: number }>) {
    const row = byPeriod.get(r._id) || { period: r._id, collected: 0, paid: 0, net: 0 };
    row.paid = r.taxAmount || 0;
    row.net = row.collected - row.paid;
    byPeriod.set(r._id, row);
  }
  const monthly = Array.from(byPeriod.values()).sort((a, b) => a.period.localeCompare(b.period));
`;

const newLoop = `
  const byKey = new Map<string, TaxMonthlyRow>();
  for (const r of invRows as Array<{ _id: { period: string, taxType: string }; subtotal: number; total: number }>) {
    const collected = Math.max(0, (r.total || 0) - (r.subtotal || 0));
    const key = \`\${r._id.period}-\${r._id.taxType}\`;
    byKey.set(key, { period: r._id.period, taxType: r._id.taxType, collected, paid: 0, net: collected });
  }
  for (const r of expRows as Array<{ _id: { period: string, taxType: string }; taxAmount: number }>) {
    const key = \`\${r._id.period}-\${r._id.taxType}\`;
    const row = byKey.get(key) || { period: r._id.period, taxType: r._id.taxType, collected: 0, paid: 0, net: 0 };
    row.paid = r.taxAmount || 0;
    row.net = row.collected - row.paid;
    byKey.set(key, row);
  }
  const monthly = Array.from(byKey.values()).sort((a, b) => {
    if (a.period === b.period) return a.taxType.localeCompare(b.taxType);
    return a.period.localeCompare(b.period);
  });
`;
actionsContent = actionsContent.replace(oldLoop.trim(), newLoop.trim());

fs.writeFileSync(actionsFile, actionsContent);
