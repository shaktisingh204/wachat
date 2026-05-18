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
  LoaderCircle } from 'lucide-react';

/**
 * GSTR-3B page — `CRM_REBUILD_PLAN.md` §6.10.
 *
 * Period picker → "Generate" → 9 sections rendered as a one-page
 * summary table. Each row carries the standard tax-head columns
 * (taxable, IGST, CGST, SGST, Cess).
 */

import * as React from 'react';

import { CrmPageHeader } from '../../_components/crm-page-header';
import {
    generateGstr3bReport,
    type Period,
} from '@/app/actions/crm-india-gst.actions';
import type { ReportRunResult } from '@/lib/reports/types';

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Date(2026, i, 1).toLocaleString('en-US', { month: 'long' }),
}));

function currentPeriod(): Period {
    const d = new Date();
    return { month: d.getUTCMonth() + 1, year: d.getUTCFullYear() };
}

function fmtInr(n: unknown): string {
    const num = Number(n);
    if (!Number.isFinite(num)) return '-';
    return `INR ${num.toFixed(2)}`;
}

export default function Gstr3bPage() {
    const { toast } = useZoruToast();
    const [period, setPeriod] = React.useState<Period>(currentPeriod);
    const [loading, setLoading] = React.useState(false);
    const [result, setResult] = React.useState<ReportRunResult | null>(null);

    const handleGenerate = React.useCallback(async () => {
        setLoading(true);
        try {
            const res = await generateGstr3bReport(period);
            if (res.error) {
                toast({ title: 'Could not generate GSTR-3B', description: res.error });
                setResult(null);
                return;
            }
            setResult(res.result ?? null);
        } finally {
            setLoading(false);
        }
    }, [period, toast]);

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="GSTR-3B"
                subtitle="Monthly summary return — outward, ITC, RCM, tax payable."
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
                    <ZoruButton onClick={handleGenerate} disabled={loading}>
                        {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : 'Generate'}
                    </ZoruButton>
                </div>
            </ZoruCard>

            {result?.summary && (
                <ZoruCard>
                    <h2 className="text-[15px] font-semibold text-foreground">Summary</h2>
                    <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                        <StatBox
                            label="Outward Taxable"
                            value={fmtInr(result.summary.outward_taxable)}
                        />
                        <StatBox
                            label="Outward Tax"
                            value={fmtInr(result.summary.outward_total_tax)}
                        />
                        <StatBox label="ITC" value={fmtInr(result.summary.itc_total)} />
                        <StatBox
                            label="Net Payable"
                            value={fmtInr(result.summary.net_payable)}
                        />
                        <StatBox label="RCM Taxable" value={fmtInr(result.summary.rcm_taxable)} />
                    </div>
                </ZoruCard>
            )}

            {result && result.rows.length > 0 && (
                <ZoruCard>
                    <h2 className="text-[15px] font-semibold text-foreground">Sections</h2>
                    <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-border hover:bg-transparent">
                                    {result.columns.map((c) => (
                                        <ZoruTableHead key={c} className="text-muted-foreground">
                                            {c.replace(/_/g, ' ')}
                                        </ZoruTableHead>
                                    ))}
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {result.rows.map((row, i) => (
                                    <ZoruTableRow key={i} className="border-border">
                                        {row.map((cell, j) => (
                                            <ZoruTableCell
                                                key={j}
                                                className={
                                                    j === 0
                                                        ? 'text-foreground'
                                                        : 'text-right font-mono text-foreground'
                                                }
                                            >
                                                {j === 0
                                                    ? String(cell)
                                                    : typeof cell === 'number'
                                                      ? cell.toFixed(2)
                                                      : String(cell ?? '')}
                                            </ZoruTableCell>
                                        ))}
                                    </ZoruTableRow>
                                ))}
                            </ZoruTableBody>
                        </ZoruTable>
                    </div>
                </ZoruCard>
            )}

            {!result && !loading && (
                <ZoruCard>
                    <p className="text-[13px] text-muted-foreground">
                        Pick a period and click Generate to build this month&apos;s GSTR-3B.
                    </p>
                </ZoruCard>
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
