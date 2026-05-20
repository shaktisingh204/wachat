'use client';

/**
 * Inventory — Party Transactions deep view.
 *
 * Top-of-page KPI tiles summarise dr/cr exposure across every party,
 * a top-N bar chart highlights the heaviest movers, and the existing
 * party drill-down table below keeps the report flow intact. Multi-tenant
 * via the server actions.
 */

import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { format } from 'date-fns';
import {
    ArrowDownToLine,
    ArrowUpToLine,
    Crown,
    Download,
    LoaderCircle,
    Users,
} from 'lucide-react';
import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    useTransition,
} from 'react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityPicker } from '@/components/crm/entity-picker';
import { EnumFormField } from '@/components/crm/enum-form-field';
import {
    ZoruButton,
    ZoruCard,
    ZoruDatePicker,
    ZoruLabel,
    ZoruTable,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
    useZoruToast,
} from '@/components/zoruui';
import { generatePartyTransactionReport } from '@/app/actions/crm-reports.actions';
import {
    getPartyTransactionsDeepKpis,
    type PartyTransactionsDeepKpis,
} from '@/app/actions/crm-inventory.actions';
import {
    dateStamp,
    downloadCsv,
    downloadXlsx,
    type ExportRow,
} from '@/lib/crm-list-export';

type PartyTransaction = {
    date: Date;
    type: string;
    reference: string;
    itemName: string;
    quantity: number;
    rate: number;
};

const fmtCurrency = (amount: number): string =>
    new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(amount);

const KPI_EMPTY: PartyTransactionsDeepKpis = {
    totalParties: 0,
    topParty: null,
    totalDebit: 0,
    totalCredit: 0,
    outstandingBalance: 0,
    topN: [],
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
        <ZoruCard>
            <div className="flex items-center justify-between">
                <p className="text-[12.5px] font-medium text-muted-foreground">{label}</p>
                <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <p className="mt-2 truncate text-[22px] font-semibold text-foreground">{value}</p>
            {sub ? <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{sub}</p> : null}
        </ZoruCard>
    );
}

export default function PartyTransactionsDeepPage(): React.JSX.Element {
    const { toast } = useZoruToast();
    const [reportData, setReportData] = useState<PartyTransaction[]>([]);
    const [kpis, setKpis] = useState<PartyTransactionsDeepKpis>(KPI_EMPTY);
    const [isLoading, startTransition] = useTransition();
    const [isKpisLoading, startKpiTransition] = useTransition();

    const [partyType, setPartyType] = useState<'customer' | 'vendor'>('customer');
    const [partyId, setPartyId] = useState<string>('');
    const [startDate, setStartDate] = useState<Date | undefined>();
    const [endDate, setEndDate] = useState<Date | undefined>();

    // Load aggregate KPIs once on mount — independent of the per-party report.
    useEffect(() => {
        startKpiTransition(async () => {
            setKpis(await getPartyTransactionsDeepKpis());
        });
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
                Date: format(new Date(d.date), 'PPP'),
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

    return (
        <EntityListShell
            title="Party transactions"
            subtitle="Inventory + receivable exposure for every customer and vendor."
            primaryAction={
                <div className="flex items-center gap-2">
                    <ZoruButton
                        variant="outline"
                        onClick={handleCsv}
                        disabled={exportRows.length === 0}
                    >
                        <Download className="mr-2 h-4 w-4" />
                        CSV
                    </ZoruButton>
                    <ZoruButton
                        variant="outline"
                        onClick={handleXlsx}
                        disabled={exportRows.length === 0}
                    >
                        XLSX
                    </ZoruButton>
                </div>
            }
        >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <KpiTile
                    label="Total parties"
                    value={kpis.totalParties.toLocaleString('en-IN')}
                    sub={isKpisLoading ? 'Computing…' : 'Across all customers'}
                    icon={Users}
                />
                <KpiTile
                    label="Top party by volume"
                    value={kpis.topParty ? kpis.topParty.name : '—'}
                    sub={kpis.topParty ? fmtCurrency(kpis.topParty.volume) : 'No data'}
                    icon={Crown}
                />
                <KpiTile
                    label="Total debit / credit"
                    value={`${fmtCurrency(kpis.totalDebit)} / ${fmtCurrency(kpis.totalCredit)}`}
                    icon={ArrowUpToLine}
                />
                <KpiTile
                    label="Outstanding balance"
                    value={fmtCurrency(kpis.outstandingBalance)}
                    sub="Unpaid invoice total"
                    icon={ArrowDownToLine}
                />
            </div>

            <ZoruCard className="mt-4">
                <h2 className="text-[16px] font-semibold text-foreground">Top 10 parties by volume</h2>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                    Combined invoice + credit-note exposure, descending.
                </p>
                <div className="mt-4 h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={kpis.topN} layout="vertical" margin={{ left: 80 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis type="number" tick={{ fontSize: 11 }} />
                            <YAxis
                                dataKey="name"
                                type="category"
                                tick={{ fontSize: 11 }}
                                width={120}
                            />
                            <Tooltip
                                cursor={{ opacity: 0.1 }}
                                formatter={(value) => fmtCurrency(Number(value))}
                            />
                            <Bar dataKey="volume" fill="hsl(var(--primary))" name="Volume" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </ZoruCard>

            <ZoruCard className="mt-4">
                <h2 className="text-[16px] font-semibold text-foreground">Per-party drilldown</h2>
                <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div className="space-y-1">
                        <ZoruLabel>Party type</ZoruLabel>
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
                        <ZoruLabel>Select party</ZoruLabel>
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
                        <ZoruLabel>Start date</ZoruLabel>
                        <ZoruDatePicker value={startDate} onChange={setStartDate} />
                    </div>
                    <div className="space-y-1">
                        <ZoruLabel>End date</ZoruLabel>
                        <ZoruDatePicker value={endDate} onChange={setEndDate} />
                    </div>
                </div>
                <div className="mt-4">
                    <ZoruButton
                        onClick={handleGenerateReport}
                        disabled={isLoading || !partyId}
                    >
                        {isLoading ? (
                            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Generate report
                    </ZoruButton>
                </div>

                <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-border hover:bg-transparent">
                                <ZoruTableHead className="text-muted-foreground">Date</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Type</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Reference</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Item</ZoruTableHead>
                                <ZoruTableHead className="text-right text-muted-foreground">Qty</ZoruTableHead>
                                <ZoruTableHead className="text-right text-muted-foreground">Rate</ZoruTableHead>
                                <ZoruTableHead className="text-right text-muted-foreground">Total</ZoruTableHead>
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
                                        <ZoruTableCell className="text-foreground">
                                            {format(new Date(row.date), 'PPP')}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">{row.type}</ZoruTableCell>
                                        <ZoruTableCell className="font-mono text-[11.5px] text-foreground">
                                            {row.reference}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="font-medium text-foreground">
                                            {row.itemName}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right text-foreground">
                                            {row.quantity}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right text-foreground">
                                            {fmtCurrency(row.rate)}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right font-semibold text-foreground">
                                            {fmtCurrency(row.quantity * row.rate)}
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
                    </ZoruTable>
                </div>
            </ZoruCard>
        </EntityListShell>
    );
}
