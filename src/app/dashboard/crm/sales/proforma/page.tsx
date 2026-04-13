import { getProformaInvoices } from '@/app/actions/crm-proforma-invoices.actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, FileText } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { MonthPicker } from '@/components/crm/month-picker';

import { ClayButton, ClayCard, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

export default async function ProformaInvoicesPage({
    searchParams,
}: {
    searchParams?: Promise<{
        query?: string;
        page?: string;
        month?: string;
        year?: string;
    }>;
}) {
    const params = await searchParams;
    const query = params?.query || '';
    const currentPage = Number(params?.page) || 1;
    const month = params?.month ? parseInt(params.month) : undefined;
    const year = params?.year ? parseInt(params.year) : undefined;

    const { invoices, total } = await getProformaInvoices(currentPage, 20, { query, month, year });

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Proforma Invoices"
                subtitle="Manage your proforma invoices."
                icon={FileText}
                actions={
                    <>
                        <MonthPicker />
                        <Link href="/dashboard/crm/sales/proforma/new">
                            <ClayButton variant="obsidian" leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}>
                                New Proforma
                            </ClayButton>
                        </Link>
                    </>
                }
            />

            <ClayCard>
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h2 className="text-[16px] font-semibold text-clay-ink">All Proforma Invoices</h2>
                    </div>
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-clay-ink-muted" />
                        <Input
                            type="search"
                            placeholder="Search proforma..."
                            className="h-10 rounded-clay-md border-clay-border bg-clay-surface pl-9 text-[13px]"
                            defaultValue={query}
                        />
                    </div>
                </div>
                <div className="overflow-x-auto rounded-clay-md border border-clay-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-clay-border hover:bg-transparent">
                                <TableHead className="text-clay-ink-muted">Proforma #</TableHead>
                                <TableHead className="text-clay-ink-muted">Date</TableHead>
                                <TableHead className="text-clay-ink-muted">Client</TableHead>
                                <TableHead className="text-clay-ink-muted">Status</TableHead>
                                <TableHead className="text-clay-ink-muted text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {invoices.length === 0 ? (
                                <TableRow className="border-clay-border">
                                    <TableCell colSpan={5} className="h-24 text-center text-[13px] text-clay-ink-muted">
                                        No proforma invoices found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                invoices.map((inv) => (
                                    <TableRow key={inv._id.toString()} className="border-clay-border">
                                        <TableCell className="font-medium text-clay-ink">{inv.proformaNumber}</TableCell>
                                        <TableCell className="text-clay-ink">{format(new Date(inv.proformaDate), 'PP')}</TableCell>
                                        <TableCell className="text-clay-ink">Client</TableCell>
                                        <TableCell>
                                            <ClayBadge tone="rose-soft">{inv.status}</ClayBadge>
                                        </TableCell>
                                        <TableCell className="text-right font-medium text-clay-ink">
                                            {inv.currency} {inv.total.toFixed(2)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
                <div className="mt-4 text-[11.5px] text-clay-ink-muted">
                    Showing {invoices.length} of {total} records
                </div>
            </ClayCard>
        </div>
    );
}
