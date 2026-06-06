import React from "react";
import { fmtINR } from "@/lib/utils";
/**
 * /portal/client/invoices — invoice list with KPI strip and Pay Now CTA.
 */

export const dynamic = 'force-dynamic';

import { getClientInvoices } from '@/app/actions/client-portal.actions';
import { Card, ZoruCardContent } from '@/components/sabcrm/20ui/compat';
import { ClientInvoicesView } from './client-invoices-view';
import { EmptyState } from '@/components/sabcrm/20ui/compat';


async function ClientInvoicesPageContent() {
    const invoices = await getClientInvoices();
    const now = new Date();
    const ytdStart = new Date(now.getFullYear(), 0, 1);

    let outstanding = 0;
    let paidYtd = 0;
    let overdueCount = 0;
    let currency = 'USD';
    for (const inv of invoices) {
        if (inv.currency) currency = inv.currency;
        const balance = inv.total - (inv.paidAmount ?? 0);
        if (['Sent', 'Overdue', 'Partially Paid'].includes(inv.status)) {
            outstanding += Math.max(0, balance);
        }
        if (inv.status.toLowerCase() === 'overdue') overdueCount += 1;
        if (inv.status.toLowerCase() === 'paid' && inv.invoiceDate) {
            const d = new Date(inv.invoiceDate);
            if (d >= ytdStart) paidYtd += inv.total;
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-semibold text-zoru-ink">Invoices</h1>
                <p className="text-sm text-zoru-ink-muted">
                    Pay outstanding invoices and review past billing.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Card>
                    <ZoruCardContent className="p-4">
                        <div className="text-xs text-zoru-ink-muted">Total Outstanding</div>
                        <div className="mt-1 text-2xl font-semibold text-zoru-ink">{fmtINR(outstanding, currency)}</div>
                    </ZoruCardContent>
                </Card>
                <Card>
                    <ZoruCardContent className="p-4">
                        <div className="text-xs text-zoru-ink-muted">Paid YTD</div>
                        <div className="mt-1 text-2xl font-semibold text-zoru-ink">{fmtINR(paidYtd, currency)}</div>
                    </ZoruCardContent>
                </Card>
                <Card>
                    <ZoruCardContent className="p-4">
                        <div className="text-xs text-zoru-ink-muted">Overdue</div>
                        <div className="mt-1 text-2xl font-semibold text-zoru-ink">{overdueCount}</div>
                    </ZoruCardContent>
                </Card>
            </div>

            {invoices.length === 0 ? (
                <EmptyState
                    title="No invoices yet"
                    description="Invoices issued to you will appear here."
                />
            ) : (
                <ClientInvoicesView invoices={invoices} />
            )}
        </div>
    );
}


export default function ClientInvoicesPage() {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <ClientInvoicesPageContent  />
    </React.Suspense>
  );
}
