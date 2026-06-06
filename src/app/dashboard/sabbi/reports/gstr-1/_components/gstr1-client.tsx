'use client';

/**
 * GSTR-1 — client wrapper.
 *
 * Renders the export dropdown (CSV / XLSX / GSTN-portal JSON), the
 * outward-supplies breakdown chart, and the invoice table. JSON export
 * calls `downloadGstr1Json` on demand so we don't ship the GSTN payload
 * to the client when the user isn't downloading.
 */

import * as React from 'react';
import { format } from 'date-fns';
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { Download, FileJson, FileSpreadsheet } from 'lucide-react';

import {
    Button,
    Card,
    DropdownMenu,
    ZoruDropdownMenuContent,
    ZoruDropdownMenuItem,
    ZoruDropdownMenuTrigger,
    Table,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
    useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import {
    downloadCsv,
    downloadXlsx,
    dateStamp,
    type ExportRow,
} from '@/lib/crm-list-export';
import { downloadGstr1Json, syncWithGstPortal } from '@/app/actions/crm-india-gst.actions';

export interface Gstr1InvoiceRow {
    id: string;
    invoiceNumber: string;
    invoiceDate: string;
    accountId: string;
    clientName: string;
    subtotal: number;
    total: number;
    currency: string;
    status: string;
}

export interface Gstr1ChartDatum {
    name: string;
    taxable: number;
    tax: number;
}

export interface Gstr1ClientProps {
    month: number;
    year: number;
    rows: Gstr1InvoiceRow[];
    total: number;
    page: number;
    limit: number;
    chart: Gstr1ChartDatum[];
}

export function Gstr1Client({
    month,
    year,
    rows,
    total,
    page,
    limit,
    chart,
}: Gstr1ClientProps) {
    const { toast } = useZoruToast();
    const [isExportingJson, startTransition] = React.useTransition();

    const exportHeaders = [
        'Invoice No.',
        'Date',
        'Client',
        'Taxable Value',
        'Total',
        'Currency',
        'Status',
    ];

    const exportRows: ExportRow[] = React.useMemo(
        () =>
            rows.map((r) => ({
                'Invoice No.': r.invoiceNumber,
                Date: r.invoiceDate,
                Client: r.clientName,
                'Taxable Value': r.subtotal,
                Total: r.total,
                Currency: r.currency,
                Status: r.status,
            })),
        [rows],
    );

    const handleCsv = (): void => {
        downloadCsv(
            `gstr1-${year}-${String(month).padStart(2, '0')}-${dateStamp()}.csv`,
            exportHeaders,
            exportRows,
        );
    };

    const handleXlsx = (): void => {
        void downloadXlsx(
            `gstr1-${year}-${String(month).padStart(2, '0')}-${dateStamp()}.xlsx`,
            exportHeaders,
            exportRows,
            'GSTR-1',
        );
    };

    const handleJson = (): void => {
        startTransition(async () => {
            const res = await downloadGstr1Json({ month, year });
            if (res.error || !res.json) {
                toast({
                    title: 'GSTR-1 JSON unavailable',
                    description: res.error ?? 'Unknown error.',
                    variant: 'destructive',
                });
                return;
            }
            const blob = new Blob([res.json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = res.filename ?? `GSTR1-${year}-${month}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });
    };

    const hasMore = page * limit < total;

    return (
        <>
            <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={handleSync} disabled={isSyncing}>
                    {isSyncing ? 'Syncing...' : 'Sync Portal'}
                </Button>
                <DropdownMenu>
                    <ZoruDropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={isExportingJson}
                        >
                            <Download className="mr-1.5 h-3.5 w-3.5" /> Export
                        </Button>
                    </ZoruDropdownMenuTrigger>
                    <ZoruDropdownMenuContent align="end">
                        <ZoruDropdownMenuItem onClick={handleCsv}>
                            <FileSpreadsheet className="mr-2 h-4 w-4" /> CSV
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem onClick={handleXlsx}>
                            <FileSpreadsheet className="mr-2 h-4 w-4" /> XLSX
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem
                            onClick={handleJson}
                            disabled={isExportingJson}
                        >
                            <FileJson className="mr-2 h-4 w-4" /> GSTN JSON
                        </ZoruDropdownMenuItem>
                    </ZoruDropdownMenuContent>
                </DropdownMenu>
            </div>

            <Card>
                <div className="mb-3">
                    <h2 className="text-[16px] font-semibold text-zoru-ink">
                        Outward supplies by type
                    </h2>
                    <p className="text-[12.5px] text-zoru-ink-muted">
                        B2B, B2C-large, B2C summary, and credit/debit notes.
                    </p>
                </div>
                <div className="h-[280px] w-full">
                    {chart.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-[13px] text-zoru-ink-muted">
                            No outward supplies in this period.
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chart}>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="hsl(var(--border))"
                                />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Bar
                                    dataKey="taxable"
                                    name="Taxable value"
                                    fill="hsl(var(--primary))"
                                    radius={[4, 4, 0, 0]}
                                />
                                <Bar
                                    dataKey="tax"
                                    name="Tax"
                                    fill="hsl(38 92% 50%)"
                                    radius={[4, 4, 0, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </Card>

            <Card>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-zoru-ink">
                        Sales Invoices
                    </h2>
                    <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                        All recorded sales invoices for GSTR-1 filing.
                    </p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <Table>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                <ZoruTableHead className="text-zoru-ink-muted">
                                    Date
                                </ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">
                                    Invoice
                                </ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">
                                    Customer
                                </ZoruTableHead>
                                <ZoruTableHead className="text-right text-zoru-ink-muted">
                                    Taxable Value
                                </ZoruTableHead>
                                <ZoruTableHead className="text-right text-zoru-ink-muted">
                                    Total
                                </ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">
                                    Status
                                </ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {rows.length === 0 ? (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell
                                        colSpan={6}
                                        className="h-24 text-center text-[13px] text-zoru-ink-muted"
                                    >
                                        No invoices found.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                rows.map((r) => (
                                    <ZoruTableRow
                                        key={r.id}
                                        className="border-zoru-line"
                                    >
                                        <ZoruTableCell className="text-[13px] text-zoru-ink">
                                            {format(new Date(r.invoiceDate), 'PP')}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="font-medium text-zoru-ink">
                                            <EntityRowLink
                                                href={`/dashboard/crm/sales/invoices/${r.id}`}
                                                label={r.invoiceNumber}
                                            />
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[13px] text-zoru-ink">
                                            {r.clientName}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right text-[13px] text-zoru-ink">
                                            {r.currency} {r.subtotal.toFixed(2)}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right text-[13px] text-zoru-ink">
                                            {r.currency} {r.total.toFixed(2)}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[13px] text-zoru-ink">
                                            {r.status}
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            )}
                        </ZoruTableBody>
                    </Table>
                </div>
                <PaginationBar
                    page={page}
                    limit={limit}
                    total={total}
                    hasMore={hasMore}
                />
            </Card>
        </>
    );
}
