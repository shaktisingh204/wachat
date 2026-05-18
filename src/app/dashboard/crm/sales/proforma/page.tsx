import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import {
  getProformaInvoices } from '@/app/actions/crm-proforma-invoices.actions';
import { Plus,
  Search,
  FileText } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { MonthPicker } from '@/components/crm/month-picker';

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
                            <ZoruButton>
                                <Plus className="h-4 w-4" strokeWidth={1.75} />
                                New Proforma
                            </ZoruButton>
                        </Link>
                    </>
                }
            />

            <ZoruCard className="p-6">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h2 className="text-[16px] text-zoru-ink">All Proforma Invoices</h2>
                    </div>
                    <div className="relative w-full max-w-sm">
                        <ZoruInput
                            type="search"
                            placeholder="Search proforma..."
                            defaultValue={query}
                            leadingSlot={<Search />}
                        />
                    </div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                <ZoruTableHead className="text-zoru-ink-muted">Proforma #</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Date</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Client</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted text-right">Amount</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {invoices.length === 0 ? (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell colSpan={5} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                                        No proforma invoices found.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                invoices.map((inv) => (
                                    <ZoruTableRow key={inv._id.toString()} className="border-zoru-line">
                                        <ZoruTableCell className="text-zoru-ink">{inv.proformaNumber}</ZoruTableCell>
                                        <ZoruTableCell className="text-zoru-ink">{format(new Date(inv.proformaDate), 'PP')}</ZoruTableCell>
                                        <ZoruTableCell className="text-zoru-ink">Client</ZoruTableCell>
                                        <ZoruTableCell>
                                            <ZoruBadge variant="danger">{inv.status}</ZoruBadge>
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right text-zoru-ink">
                                            {inv.currency} {inv.total.toFixed(2)}
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            )}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
                <div className="mt-4 text-[11.5px] text-zoru-ink-muted">
                    Showing {invoices.length} of {total} records
                </div>
            </ZoruCard>
        </div>
    );
}
