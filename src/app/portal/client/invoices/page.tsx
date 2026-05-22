/**
 * /portal/client/invoices — invoice list with KPI strip and Pay Now CTA.
 */

export const dynamic = 'force-dynamic';

import Link from 'next/link';

import { getClientInvoices } from '@/app/actions/client-portal.actions';
import { Badge } from '@/components/zoruui/badge';
import { Button } from '@/components/zoruui/button';
import {
    Card,
    ZoruCardContent,
} from '@/components/zoruui/card';
import {
    Table,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
} from '@/components/zoruui/table';
import { EmptyState } from '@/components/zoruui/empty-state';

function fmtDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString();
}

function fmtCurrency(n: number, ccy: string): string {
    try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency: ccy || 'USD' }).format(n);
    } catch {
        return String(n);
    }
}

function statusVariant(s: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    const v = s.toLowerCase();
    if (v === 'paid') return 'secondary';
    if (v === 'overdue') return 'destructive';
    if (v === 'draft') return 'outline';
    return 'default';
}

export default async function ClientInvoicesPage() {
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
        <div className="flex flex-col gap-4">
            <div>
                <h1 className="text-2xl font-semibold text-zoru-ink">Invoices</h1>
                <p className="text-sm text-zoru-ink-muted">
                    Pay outstanding invoices and review past billing.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <ZoruCard>
                    <ZoruCardContent className="p-4">
                        <div className="text-xs text-zoru-ink-muted">Total Outstanding</div>
                        <div className="mt-1 text-2xl font-semibold text-zoru-ink">{fmtCurrency(outstanding, currency)}</div>
                    </ZoruCardContent>
                </ZoruCard>
                <ZoruCard>
                    <ZoruCardContent className="p-4">
                        <div className="text-xs text-zoru-ink-muted">Paid YTD</div>
                        <div className="mt-1 text-2xl font-semibold text-zoru-ink">{fmtCurrency(paidYtd, currency)}</div>
                    </ZoruCardContent>
                </ZoruCard>
                <ZoruCard>
                    <ZoruCardContent className="p-4">
                        <div className="text-xs text-zoru-ink-muted">Overdue</div>
                        <div className="mt-1 text-2xl font-semibold text-zoru-ink">{overdueCount}</div>
                    </ZoruCardContent>
                </ZoruCard>
            </div>

            {invoices.length === 0 ? (
                <ZoruEmptyState
                    title="No invoices yet"
                    description="Invoices issued to you will appear here."
                />
            ) : (
                <ZoruCard>
                    <ZoruCardContent className="p-0">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow>
                                    <ZoruTableHead>Number</ZoruTableHead>
                                    <ZoruTableHead>Issue Date</ZoruTableHead>
                                    <ZoruTableHead>Due Date</ZoruTableHead>
                                    <ZoruTableHead>Total</ZoruTableHead>
                                    <ZoruTableHead>Status</ZoruTableHead>
                                    <ZoruTableHead className="text-right">Action</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {invoices.map((inv) => {
                                    const isUnpaid = ['Sent', 'Overdue', 'Partially Paid'].includes(inv.status);
                                    return (
                                        <ZoruTableRow key={inv._id}>
                                            <ZoruTableCell>
                                                <Link
                                                    href={`/portal/client/invoices/${inv._id}`}
                                                    className="font-medium text-zoru-ink hover:underline"
                                                >
                                                    {inv.invoiceNumber}
                                                </Link>
                                            </ZoruTableCell>
                                            <ZoruTableCell>{fmtDate(inv.invoiceDate)}</ZoruTableCell>
                                            <ZoruTableCell>{fmtDate(inv.dueDate)}</ZoruTableCell>
                                            <ZoruTableCell>{fmtCurrency(inv.total, inv.currency)}</ZoruTableCell>
                                            <ZoruTableCell>
                                                <ZoruBadge variant={statusVariant(inv.status)}>{inv.status}</ZoruBadge>
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right">
                                                {isUnpaid && inv.publicHash ? (
                                                    <ZoruButton asChild size="sm">
                                                        <a href={`/share/invoice/${inv.publicHash}`}>Pay Now</a>
                                                    </ZoruButton>
                                                ) : (
                                                    <ZoruButton asChild size="sm" variant="outline">
                                                        <Link href={`/portal/client/invoices/${inv._id}`}>View</Link>
                                                    </ZoruButton>
                                                )}
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    );
                                })}
                            </ZoruTableBody>
                        </ZoruTable>
                    </ZoruCardContent>
                </ZoruCard>
            )}
        </div>
    );
}
