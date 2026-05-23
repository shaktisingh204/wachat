import { NextResponse } from 'next/server';
import { htmlToPdf } from '@/lib/pdf-service';
import {
    getCrmChartOfAccountById,
    getVoucherEntriesForAccount,
} from '@/app/actions/crm-accounting.actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ accountId: string }> },
): Promise<Response> {
    const { accountId } = await params;
    
    try {
        const account = await getCrmChartOfAccountById(accountId);
        if (!account) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }
        
        const entries = await getVoucherEntriesForAccount(accountId);
        
        const openingBalance = account.balanceType === 'Cr' ? -(account.openingBalance || 0) : (account.openingBalance || 0);
        let totalDebit = 0;
        let totalCredit = 0;
        for (const entry of entries) {
            for (const d of entry.debitEntries) {
                if (d.accountId.toString() === account._id.toString()) totalDebit += d.amount;
            }
            for (const c of entry.creditEntries) {
                if (c.accountId.toString() === account._id.toString()) totalCredit += c.amount;
            }
        }
        const currentBalance = openingBalance + totalDebit - totalCredit;
        const currentType = currentBalance >= 0 ? 'Dr' : 'Cr';

        let transactionsHtml = '';
        const recent = entries.slice(-50).reverse();
        
        if (recent.length === 0) {
            transactionsHtml = '<tr><td colspan="5" style="text-align:center;padding:12px;">No transactions posted yet.</td></tr>';
        } else {
            recent.forEach(entry => {
                let debit = 0;
                let credit = 0;
                for (const d of entry.debitEntries) {
                    if (d.accountId.toString() === account._id.toString()) debit += d.amount;
                }
                for (const c of entry.creditEntries) {
                    if (c.accountId.toString() === account._id.toString()) credit += c.amount;
                }
                
                transactionsHtml += `
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${new Date(entry.date).toLocaleDateString()}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #ddd; font-family: monospace;">${entry.voucherNumber}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${entry.note || ''}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${debit > 0 ? debit.toFixed(2) : '-'}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${credit > 0 ? credit.toFixed(2) : '-'}</td>
                    </tr>
                `;
            });
        }

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Account Ledger - ${account.name}</title>
            <style>
                body { font-family: sans-serif; color: #333; }
                h1 { margin-bottom: 5px; }
                .summary { display: flex; gap: 20px; margin-bottom: 30px; }
                .summary-item { border: 1px solid #ddd; padding: 15px; border-radius: 8px; flex: 1; }
                .summary-item label { display: block; font-size: 12px; color: #666; margin-bottom: 5px; }
                .summary-item div { font-size: 20px; font-weight: bold; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
                th { text-align: left; padding: 10px 8px; border-bottom: 2px solid #ddd; color: #666; }
                th.right { text-align: right; }
            </style>
        </head>
        <body>
            <h1>Account Ledger: ${account.name}</h1>
            <p>Currency: ${account.currency}</p>
            
            <div class="summary">
                <div class="summary-item">
                    <label>Opening Balance</label>
                    <div>${Math.abs(account.openingBalance || 0).toFixed(2)} ${account.balanceType}</div>
                </div>
                <div class="summary-item">
                    <label>Total Debit</label>
                    <div>${totalDebit.toFixed(2)}</div>
                </div>
                <div class="summary-item">
                    <label>Total Credit</label>
                    <div>${totalCredit.toFixed(2)}</div>
                </div>
                <div class="summary-item" style="background:#f9f9f9;">
                    <label>Current Balance</label>
                    <div>${Math.abs(currentBalance).toFixed(2)} ${currentType}</div>
                </div>
            </div>
            
            <h3>Recent Transactions (Last 50)</h3>
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Voucher #</th>
                        <th>Note</th>
                        <th class="right">Debit</th>
                        <th class="right">Credit</th>
                    </tr>
                </thead>
                <tbody>
                    ${transactionsHtml}
                </tbody>
            </table>
        </body>
        </html>
        `;
        
        const pdf = await htmlToPdf(html);
        return new NextResponse(new Uint8Array(pdf), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="ledger-${account.name.replace(/\s+/g, '-')}.pdf"`,
                'Cache-Control': 'private, no-store',
            },
        });
    } catch (e) {
        console.error('[api/pdf/account-ledger] render failed:', e);
        return NextResponse.json({ error: 'PDF generation failed.' }, { status: 500 });
    }
}
