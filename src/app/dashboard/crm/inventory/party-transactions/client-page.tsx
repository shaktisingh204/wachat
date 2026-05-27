'use client';

import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import {
    ArrowDownToLine,
    ArrowUpToLine,
    Crown,
    Download,
    LoaderCircle,
    Users,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityPicker } from '@/components/crm/entity-picker';
import { EnumFormField } from '@/components/crm/enum-form-field';
import {
    Button,
    Card,
    DatePicker,
    Label,
    Table,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
    useZoruToast,
} from '@/components/zoruui';
import { generatePartyTransactionReport } from '@/app/actions/crm-reports.actions';
import type { PartyTransactionsDeepKpis } from '@/app/actions/crm-inventory.actions.types';
import {
    dateStamp,
    downloadCsv,
    downloadXlsx,
    type ExportRow,
} from '@/lib/crm-list-export';
import { fmtINR, fmtDate } from '@/lib/utils';

type PartyTransaction = {
    date: Date;
    type: string;
    reference: string;
    itemName: string;
    quantity: number;
    rate: number;
};

function KpiTile({
    label,
    value,
    sub,
    icon: Icon,
}: {
    label: string;
    value: string;
    sub?: string;
    icon: React.ElementType;
}): React.JSX.Element {
    return (
        <Card className="p-4">
            <div className="flex items-center justify-between">
                <p className="text-[12.5px] font-medium text-muted-foreground">{label}</p>
                <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <p className="mt-2 truncate text-[22px] font-semibold text-foreground">{value}</p>
            {sub ? <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{sub}</p> : null}
        </Card>
    );
}

export default function PartyTransactionsDeepClient({
    initialKpis,
}: {
    initialKpis: PartyTransactionsDeepKpis;
}): React.JSX.Element {
    const { toast } = useZoruToast();
    const [reportData, setReportData] = useState<PartyTransaction[]>([]);
    const [isLoading, startTransition] = useTransition();

    const [partyType, setPartyType] = useState<'customer' | 'vendor'>('customer');
    const [partyId, setPartyId] = useState<string>('');
    const [startDate, setStartDate] = useState<Date | undefined>();
    const [endDate, setEndDate] = useState<Date | undefined>();

    // For hydration stability
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Reset selected party + report when toggling between customer/vendor.
    useEffect(() => {
        setPartyId('');
        setReportData([]);
    }, [partyType]);

    const handleGenerateReport = useCallback(() => {
        if (!partyId) {
            toast({ title: 'Please select a party', variant: 'destructive' });
            return;
        }
        startTransition(async () => {
            const result = await generatePartyTransactionReport(
                partyId,
                partyType,
                startDate,
                endDate,
            );
            if (result.error) {
                toast({
                    title: 'Error generating report',
                    description: result.error,
                    variant: 'destructive',
                });
            } else {
                setReportData((result.data as PartyTransaction[]) ?? []);
            }
        });
    }, [partyId, partyType, startDate, endDate, toast]);

    const exportRows = useMemo<ExportRow[]>(
        () =>
            reportData.map((d) => ({
                Date: fmtDate(d.date),
                Type: d.type,
                Reference: d.reference,
                'Item Name': d.itemName,
                Quantity: d.quantity,
                Rate: d.rate.toFixed(2),
                Total: (d.quantity * d.rate).toFixed(2),
            })),
        [reportData],
    );

    const exportHeaders = ['Date', 'Type', 'Reference', 'Item Name', 'Quantity', 'Rate', 'Total'];

    const handleCsv = useCallback(() => {
        if (exportRows.length === 0) {
            toast({ title: 'No data', description: 'Run a report first.' });
            return;
        }
        downloadCsv(
            `party_transactions_${partyId}_${dateStamp()}.csv`,
            exportHeaders,
            exportRows,
        );
    }, [exportRows, partyId, toast]);

    const handleXlsx = useCallback(() => {
        if (exportRows.length === 0) {
            toast({ title: 'No data', description: 'Run a report first.' });
            return;
        }
        void downloadXlsx(
            `party_transactions_${partyId}_${dateStamp()}.xlsx`,
            exportHeaders,
            exportRows,
            'PartyTxns',
        );
    }, [exportRows, partyId, toast]);

    if (!mounted) {
        return (
            <EntityListShell
                title="Party transactions"
                subtitle="Inventory + receivable exposure for every customer and vendor."
            >
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Card key={i} className="h-[104px] animate-pulse bg-muted/20" />
                    ))}
                </div>
            </EntityListShell>
        );
    }

    return (
        <EntityListShell
            title="Party transactions"
            subtitle="Inventory + receivable exposure for every customer and vendor."
            primaryAction={
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={handleCsv}
                        disabled={exportRows.length === 0}
                    >
                        <Download className="mr-2 h-4 w-4" />
                        CSV
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleXlsx}
                        disabled={exportRows.length === 0}
                    >
                        XLSX
                    </Button>
                </div>
            }
        >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <KpiTile
                    label="Total parties"
                    value={initialKpis.totalParties.toLocaleString('en-IN')}
                    sub="Across all customers"
                    icon={Users}
                />
                <KpiTile
                    label="Top party by volume"
                    value={initialKpis.topParty ? initialKpis.topParty.name : '—'}
                    sub={initialKpis.topParty ? fmtINR(initialKpis.topParty.volume) : 'No data'}
                    icon={Crown}
                />
                <KpiTile
                    label="Total debit / credit"
                    value={`${fmtINR(initialKpis.totalDebit)} / ${fmtINR(initialKpis.totalCredit)}`}
                    icon={ArrowUpToLine}
                />
                <KpiTile
                    label="Outstanding balance"
                    value={fmtINR(initialKpis.outstandingBalance)}
                    sub="Unpaid invoice total"
                    icon={ArrowDownToLine}
                />
            </div>

            <Card className="mt-4 p-4">
                <h2 className="text-[16px] font-semibold text-foreground">Top 10 parties by volume</h2>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                    Combined invoice + credit-note exposure, descending.
                </p>
                <div className="mt-4 h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={initialKpis.topN} layout="vertical" margin={{ left: 80, right: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} horizontal={false} />
                            <XAxis type="number" tick={{ fontSize: 11 }} />
                            <YAxis
                                dataKey="name"
                                type="category"
                                tick={{ fontSize: 11 }}
                                width={120}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip
                                cursor={{ opacity: 0.1 }}
                                formatter={(value) => fmtINR(Number(value))}
                            />
                            <Bar dataKey="volume" fill="hsl(var(--primary))" name="Volume" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            <Card className="mt-4 p-4">
                <h2 className="text-[16px] font-semibold text-foreground">Per-party drilldown</h2>
                <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div className="space-y-1">
                        <Label>Party type</Label>
                        <EnumFormField
                            enumName="partyTypeReport"
                            name="partyType"
                            initialId={partyType}
                            onChange={(v) =>
                                setPartyType((v ?? 'customer') as 'customer' | 'vendor')
                            }
                        />
                    </div>
                    <div className="space-y-1">
                        <Label>Select party</Label>
                        {partyType === 'customer' ? (
                            <EntityPicker
                                entity="client"
                                value={partyId || null}
                                placeholder="Select customer…"
                                onChange={(next) =>
                                    setPartyId(Array.isArray(next) ? (next[0] ?? '') : (next ?? ''))
                                }
                            />
                        ) : (
                            <EntityPicker
                                entity="vendor"
                                value={partyId || null}
                                placeholder="Select vendor…"
                                onChange={(next) =>
                                    setPartyId(Array.isArray(next) ? (next[0] ?? '') : (next ?? ''))
                                }
                            />
                        )}
                    </div>
                    <div className="space-y-1">
                        <Label>Start date</Label>
                        <DatePicker value={startDate} onChange={setStartDate} />
                    </div>
                    <div className="space-y-1">
                        <Label>End date</Label>
                        <DatePicker value={endDate} onChange={setEndDate} />
                    </div>
                </div>
                <div className="mt-4">
                    <Button
                        onClick={handleGenerateReport}
                        disabled={isLoading || !partyId}
                    >
                        {isLoading ? (
                            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Generate report
                    </Button>
                </div>

                <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                    <Table>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-border hover:bg-transparent">
                                <ZoruTableHead className="text-muted-foreground whitespace-nowrap">Date</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground whitespace-nowrap">Type</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground whitespace-nowrap">Reference</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground whitespace-nowrap">Item</ZoruTableHead>
                                <ZoruTableHead className="text-right text-muted-foreground whitespace-nowrap">Qty</ZoruTableHead>
                                <ZoruTableHead className="text-right text-muted-foreground whitespace-nowrap">Rate</ZoruTableHead>
                                <ZoruTableHead className="text-right text-muted-foreground whitespace-nowrap">Total</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {isLoading ? (
                                <ZoruTableRow className="border-border">
                                    <ZoruTableCell colSpan={7} className="h-24 text-center">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : reportData.length > 0 ? (
                                reportData.map((row, index) => (
                                    <ZoruTableRow
                                        key={`${row.reference}-${index}`}
                                        className="border-border"
                                    >
                                        <ZoruTableCell className="text-foreground whitespace-nowrap">
                                            {fmtDate(row.date)}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-foreground whitespace-nowrap">
                                            {row.type}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="font-mono text-[11.5px] text-foreground whitespace-nowrap">
                                            {row.reference}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="font-medium text-foreground whitespace-nowrap">
                                            {row.itemName}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right text-foreground whitespace-nowrap">
                                            {row.quantity}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right text-foreground whitespace-nowrap">
                                            {fmtINR(row.rate)}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right font-semibold text-foreground whitespace-nowrap">
                                            {fmtINR(row.quantity * row.rate)}
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            ) : (
                                <ZoruTableRow className="border-border">
                                    <ZoruTableCell
                                        colSpan={7}
                                        className="h-24 text-center text-muted-foreground"
                                    >
                                        {partyId ? 'No transactions match the selected criteria.' : 'Select a party above to load transactions.'}
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            )}
                        </ZoruTableBody>
                    </Table>
                </div>
            </Card>
        </EntityListShell>
    );
}
