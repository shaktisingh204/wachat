'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import {
  FileText,
  LoaderCircle,
  FileInput } from 'lucide-react';

/**
 * GSTR-2B viewer — `CRM_REBUILD_PLAN.md` §6.10.
 *
 * Workflow:
 *   1. User downloads GSTR-2B JSON from the GST portal manually.
 *   2. They upload it via `<SabFilePickerButton accept="document">`.
 *   3. We fetch the file, parse + validate, persist to
 *      `crm_gstr2b_imports`, and surface a per-supplier breakdown.
 *
 * Matching against `crm_bills` (ITC reconciliation) is §6.10c's job
 * and lives on a separate page; this page is read-only viewing.
 */

import * as React from 'react';

import { SabFilePickerButton } from '@/components/sabfiles';

import { CrmPageHeader } from '../../_components/crm-page-header';
import {
    getGstr2bImport,
    importGstr2b,
    type Period,
} from '@/app/actions/crm-india-gst.actions';
import type { Gstr2bReturn } from '@/lib/reports/india/gstr2b';

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Date(2026, i, 1).toLocaleString('en-US', { month: 'long' }),
}));

function currentPeriod(): Period {
    const d = new Date();
    return { month: d.getUTCMonth() + 1, year: d.getUTCFullYear() };
}

function fmtInr(n: number | undefined): string {
    if (typeof n !== 'number' || !Number.isFinite(n)) return '-';
    return `INR ${n.toFixed(2)}`;
}

export default function Gstr2bPage() {
    const { toast } = useZoruToast();
    const [period, setPeriod] = React.useState<Period>(currentPeriod);
    const [loading, setLoading] = React.useState(false);
    const [parsed, setParsed] = React.useState<Gstr2bReturn | null>(null);

    const loadExisting = React.useCallback(async () => {
        setLoading(true);
        try {
            const res = await getGstr2bImport(period);
            if (res.error) {
                toast({ title: 'Could not load import', description: res.error });
                setParsed(null);
                return;
            }
            setParsed(res.parsed ?? null);
        } finally {
            setLoading(false);
        }
    }, [period, toast]);

    // Auto-load whenever the period changes.
    React.useEffect(() => {
        void loadExisting();
    }, [loadExisting]);

    const handlePicked = React.useCallback(
        async (pick: { url: string; name: string }) => {
            if (!pick.name.toLowerCase().endsWith('.json')) {
                toast({
                    title: 'Wrong file type',
                    description: 'GSTR-2B import expects a .json file from the GST portal.',
                });
                return;
            }
            setLoading(true);
            try {
                const fileResp = await fetch(pick.url, { credentials: 'include' });
                if (!fileResp.ok) {
                    toast({
                        title: 'Could not read file',
                        description: `HTTP ${fileResp.status}`,
                    });
                    return;
                }
                const text = await fileResp.text();
                const formData = new FormData();
                formData.set('month', String(period.month));
                formData.set('year', String(period.year));
                formData.set('payload', text);
                const res = await importGstr2b(formData);
                if (res.error) {
                    toast({ title: 'GSTR-2B import failed', description: res.error });
                    return;
                }
                setParsed(res.parsed ?? null);
                toast({
                    title: 'GSTR-2B imported',
                    description: `${res.summary?.invoiceCount ?? 0} invoices across ${
                        res.summary?.suppliers ?? 0
                    } suppliers.`,
                });
            } catch (e) {
                toast({
                    title: 'Import error',
                    description: e instanceof Error ? e.message : 'unknown',
                });
            } finally {
                setLoading(false);
            }
        },
        [period, toast],
    );

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="GSTR-2B"
                subtitle="Auto-drafted ITC statement — upload the JSON exported from the GST portal."
                icon={FileText}
            />

            <ZoruCard>
                <div className="flex flex-wrap items-end gap-3">
                    <div>
                        <label className="mb-1 block text-[12px] text-muted-foreground">Month</label>
                        <ZoruSelect
                            value={String(period.month)}
                            onValueChange={(v) => setPeriod((p) => ({ ...p, month: Number(v) }))}
                        >
                            <ZoruSelectTrigger className="w-40">
                                <ZoruSelectValue />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {MONTHS.map((m) => (
                                    <ZoruSelectItem key={m.value} value={m.value}>
                                        {m.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                    <div>
                        <label className="mb-1 block text-[12px] text-muted-foreground">Year</label>
                        <ZoruInput
                            type="number"
                            value={period.year}
                            onChange={(e) =>
                                setPeriod((p) => ({ ...p, year: Number(e.target.value) || p.year }))
                            }
                            className="w-32"
                            min={2017}
                            max={2099}
                        />
                    </div>
                    <SabFilePickerButton accept="document" onPick={handlePicked}>
                        <FileInput className="h-4 w-4" /> Upload GSTR-2B JSON
                    </SabFilePickerButton>
                    {loading && (
                        <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                </div>
            </ZoruCard>

            {!parsed && !loading && (
                <ZoruCard>
                    <p className="text-[13px] text-muted-foreground">
                        No GSTR-2B import on file for this period. Download the JSON from the GST
                        portal and upload it above.
                    </p>
                </ZoruCard>
            )}

            {parsed && (
                <>
                    <ZoruCard>
                        <h2 className="text-[15px] font-semibold text-foreground">Summary</h2>
                        <p className="mt-0.5 text-[12px] text-muted-foreground">
                            GSTIN {parsed.gstin} - Period {parsed.period}
                        </p>
                        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                            <StatBox
                                label="Total ITC Available"
                                value={fmtInr(
                                    parsed.totalItcAvailable.igst +
                                        parsed.totalItcAvailable.cgst +
                                        parsed.totalItcAvailable.sgst +
                                        parsed.totalItcAvailable.cess,
                                )}
                            />
                            <StatBox
                                label="IGST"
                                value={fmtInr(parsed.totalItcAvailable.igst)}
                            />
                            <StatBox
                                label="CGST"
                                value={fmtInr(parsed.totalItcAvailable.cgst)}
                            />
                            <StatBox
                                label="SGST"
                                value={fmtInr(parsed.totalItcAvailable.sgst)}
                            />
                            <StatBox
                                label="Total Ineligible"
                                value={fmtInr(
                                    parsed.totalItcIneligible.igst +
                                        parsed.totalItcIneligible.cgst +
                                        parsed.totalItcIneligible.sgst +
                                        parsed.totalItcIneligible.cess,
                                )}
                            />
                            <StatBox label="Invoices" value={String(parsed.invoices.length)} />
                            <StatBox label="Suppliers" value={String(parsed.suppliers.length)} />
                        </div>
                    </ZoruCard>

                    <ZoruCard>
                        <h2 className="text-[15px] font-semibold text-foreground">
                            Per-supplier breakdown
                        </h2>
                        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                            <ZoruTable>
                                <ZoruTableHeader>
                                    <ZoruTableRow className="border-border hover:bg-transparent">
                                        <ZoruTableHead className="text-muted-foreground">
                                            GSTIN
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-muted-foreground">
                                            Trade name
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-muted-foreground text-right">
                                            Invoices
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-muted-foreground text-right">
                                            Taxable
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-muted-foreground text-right">
                                            IGST
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-muted-foreground text-right">
                                            CGST
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-muted-foreground text-right">
                                            SGST
                                        </ZoruTableHead>
                                    </ZoruTableRow>
                                </ZoruTableHeader>
                                <ZoruTableBody>
                                    {parsed.suppliers.map((s) => (
                                        <ZoruTableRow key={s.gstin} className="border-border">
                                            <ZoruTableCell className="font-mono text-foreground">
                                                {s.gstin}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-foreground">
                                                {s.tradeName ?? '-'}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right text-foreground">
                                                {s.invoiceCount}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right font-mono text-foreground">
                                                {s.taxableValue.toFixed(2)}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right font-mono text-foreground">
                                                {s.igst.toFixed(2)}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right font-mono text-foreground">
                                                {s.cgst.toFixed(2)}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right font-mono text-foreground">
                                                {s.sgst.toFixed(2)}
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    ))}
                                </ZoruTableBody>
                            </ZoruTable>
                        </div>
                    </ZoruCard>
                </>
            )}
        </div>
    );
}

function StatBox({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border border-border bg-secondary p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 font-mono text-[16px] text-foreground">{value}</p>
        </div>
    );
}
