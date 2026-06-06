'use client';

/**
 * GSTR-2B — client wrapper.
 *
 * Renders the per-vendor inward-supplies bar chart, the monthly ITC
 * trend line, the purchase document table with `EntityRowLink`s, and
 * the CSV/XLSX/JSON exporters.
 */

import * as React from 'react';
import { format } from 'date-fns';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    Line,
    LineChart,
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
} from '@/components/sabcrm/20ui/compat';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { syncWithGstPortal, reconcileGstr2bVsLocal } from '@/app/actions/crm-india-gst.actions';
import { useZoruToast } from '@/components/sabcrm/20ui/compat';
import { PaginationBar } from '@/components/crm/pagination-bar';
import {
    downloadCsv,
    downloadXlsx,
    dateStamp,
    type ExportRow,
} from '@/lib/crm-list-export';

export interface Gstr2bVendorDatum {
    name: string;
    taxable: number;
    itc: number;
}

export interface Gstr2bTrendDatum {
    period: string;
    itcAvailable: number;
    itcReversed: number;
}

export interface Gstr2bPurchaseRow {
    id: string;
    orderNumber: string;
    orderDate: string;
    vendorName: string;
    total: number;
    currency: string;
    status: string;
    itcEligible: string;
}

export interface Gstr2bClientProps {
    month: number;
    year: number;
    vendorChart: Gstr2bVendorDatum[];
    trend: Gstr2bTrendDatum[];
    rows: Gstr2bPurchaseRow[];
    total: number;
    page: number;
    limit: number;
    /** Pre-built GSTR-2B JSON for offline download (when an import exists). */
    gstr2bJson?: string;
    /** Filename for the JSON download. */
    gstr2bJsonFilename?: string;
}

export function Gstr2bClient({

    month,
    year,
    vendorChart,
    trend,
    rows,
    total,
    page,
    limit,
    gstr2bJson,
    gstr2bJsonFilename,
}: Gstr2bClientProps) {
    const { toast } = useZoruToast();
    const [isSyncing, setIsSyncing] = React.useState(false);
    const [isReconciling, setIsReconciling] = React.useState(false);

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const res = await syncWithGstPortal({ month, year }, 'GSTR2B');
            toast({ description: res.message });
        } catch (e) {
            toast({ variant: 'destructive', description: 'Failed to sync with GST portal.' });
        } finally {
            setIsSyncing(false);
        }
    };

    const handleReconcile = async () => {
        setIsReconciling(true);
        try {
            const res = await reconcileGstr2bVsLocal({ month, year });
            toast({ description: `Reconciliation complete: ${res.totalMatched} matched, ${res.discrepancies} discrepancies.` });
        } catch (e) {
            toast({ variant: 'destructive', description: 'Failed to run reconciliation.' });
        } finally {
            setIsReconciling(false);
        }
    };

    const exportHeaders = [
        'Order No.',
        'Date',
        'Vendor',
        'Total',
        'Currency',
        'Status',
        'ITC Eligible',
    ];

    const exportRows: ExportRow[] = React.useMemo(
        () =>
            rows.map((r) => ({
                'Order No.': r.orderNumber,
                Date: r.orderDate,
                Vendor: r.vendorName,
                Total: r.total,
                Currency: r.currency,
                Status: r.status,
                'ITC Eligible': r.itcEligible,
            })),
        [rows],
    );

    const handleCsv = (): void => {
        downloadCsv(
            `gstr2b-${year}-${String(month).padStart(2, '0')}-${dateStamp()}.csv`,
            exportHeaders,
            exportRows,
        );
    };

    const handleXlsx = (): void => {
        void downloadXlsx(
            `gstr2b-${year}-${String(month).padStart(2, '0')}-${dateStamp()}.xlsx`,
            exportHeaders,
            exportRows,
            'GSTR-2B',
        );
    };

    const handleJson = (): void => {
        if (!gstr2bJson) return;
        const blob = new Blob([gstr2bJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download =
            gstr2bJsonFilename ??
            `GSTR2B-${year}-${String(month).padStart(2, '0')}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const hasMore = page * limit < total;

    return (
        <>
            <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={handleReconcile} disabled={isReconciling}>
                    {isReconciling ? 'Running...' : 'Reconcile'}
                </Button>
                <Button variant="outline" size="sm" onClick={handleSync} disabled={isSyncing}>
                    {isSyncing ? 'Syncing...' : 'Sync Portal'}
                </Button>
                <DropdownMenu>
                    <ZoruDropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
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
                            disabled={!gstr2bJson}
                        >
                            <FileJson className="mr-2 h-4 w-4" /> GSTN JSON
                        </ZoruDropdownMenuItem>
                    </ZoruDropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <div className="mb-3">
                        <h2 className="text-[16px] font-semibold text-[var(--st-text)]">
                            Inward supplies by vendor
                        </h2>
                        <p className="text-[12.5px] text-[var(--st-text-secondary)]">
                            Top suppliers ranked by taxable inward value.
                        </p>
                    </div>
                    <div className="h-[280px] w-full">
                        {vendorChart.length === 0 ? (
                            <div className="flex h-full items-center justify-center text-[13px] text-[var(--st-text-secondary)]">
                                No vendor data for this period.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={vendorChart}>
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="hsl(var(--border))"
                                    />
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fontSize: 11 }}
                                    />
                                    <YAxis tick={{ fontSize: 11 }} />
                                    <Tooltip />
                                    <Legend />
                                    <Bar
                                        dataKey="taxable"
                                        name="Taxable value"
                                        fill="hsl(var(--primary))"
                                        radius={[4, 4, 0, 0]}
                                    />
                                    <Bar
                                        dataKey="itc"
                                        name="ITC available"
                                        fill="hsl(142 71% 45%)"
                                        radius={[4, 4, 0, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </Card>

                <Card>
                    <div className="mb-3">
                        <h2 className="text-[16px] font-semibold text-[var(--st-text)]">
                            Monthly ITC trend
                        </h2>
                    </div>
                    <div className="h-[280px] w-full">
                        {trend.length === 0 ? (
                            <div className="flex h-full items-center justify-center text-[13px] text-[var(--st-text-secondary)]">
                                No ITC history.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={trend}>
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="hsl(var(--border))"
                                    />
                                    <XAxis
                                        dataKey="period"
                                        tick={{ fontSize: 11 }}
                                    />
                                    <YAxis tick={{ fontSize: 11 }} />
                                    <Tooltip />
                                    <Legend />
                                    <Line
                                        type="monotone"
                                        dataKey="itcAvailable"
                                        stroke="hsl(var(--primary))"
                                        strokeWidth={2}
                                        dot={false}
                                        name="ITC available"
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="itcReversed"
                                        stroke="hsl(0 84% 60%)"
                                        strokeWidth={2}
                                        dot={false}
                                        name="ITC reversed"
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </Card>
            </div>

            <Card>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-[var(--st-text)]">
                        Purchase Documents
                    </h2>
                    <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">
                        Eligible ITC from recorded purchase orders / bills.
                    </p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                    <Table>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-[var(--st-border)] hover:bg-transparent">
                                <ZoruTableHead className="text-[var(--st-text-secondary)]">
                                    Date
                                </ZoruTableHead>
                                <ZoruTableHead className="text-[var(--st-text-secondary)]">
                                    Order
                                </ZoruTableHead>
                                <ZoruTableHead className="text-[var(--st-text-secondary)]">
                                    Vendor
                                </ZoruTableHead>
                                <ZoruTableHead className="text-right text-[var(--st-text-secondary)]">
                                    Total
                                </ZoruTableHead>
                                <ZoruTableHead className="text-[var(--st-text-secondary)]">
                                    Status
                                </ZoruTableHead>
                                <ZoruTableHead className="text-[var(--st-text-secondary)]">
                                    ITC
                                </ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {rows.length === 0 ? (
                                <ZoruTableRow className="border-[var(--st-border)]">
                                    <ZoruTableCell
                                        colSpan={6}
                                        className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                                    >
                                        No documents found.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                rows.map((r) => (
                                    <ZoruTableRow
                                        key={r.id}
                                        className="border-[var(--st-border)]"
                                    >
                                        <ZoruTableCell className="text-[13px] text-[var(--st-text)]">
                                            {format(new Date(r.orderDate), 'PP')}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="font-medium text-[var(--st-text)]">
                                            <EntityRowLink
                                                href={`/dashboard/crm/purchase-orders/${r.id}`}
                                                label={r.orderNumber}
                                            />
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[13px] text-[var(--st-text)]">
                                            {r.vendorName}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right text-[13px] text-[var(--st-text)]">
                                            {r.currency} {r.total.toFixed(2)}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[13px] text-[var(--st-text)]">
                                            {r.status}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[13px] text-[var(--st-text)]">
                                            {r.itcEligible}
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
