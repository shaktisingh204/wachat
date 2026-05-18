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
  useZoruToast,
} from '@/components/zoruui';
import {
  Download,
  ChevronDown,
  ChevronRight,
  LoaderCircle } from 'lucide-react';

/**
 * GSTR-1 generation page — `CRM_REBUILD_PLAN.md` §6.10.
 *
 * Period picker (month/year) → "Generate" → 6 collapsible section
 * cards (B2B, B2CL, B2CS, CDNR, HSN, DocIssue) with row counts +
 * totals. Two download buttons:
 *
 *   - JSON (raw engine output) — handy for debugging.
 *   - GSTN JSON — the upload shape the user submits on the portal.
 */

import * as React from 'react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
    downloadGstr1Json,
    generateGstr1Report,
    type Period,
} from '@/app/actions/crm-india-gst.actions';
import type { Gstr1Return } from '@/lib/reports/india/gstr1';

const MONTHS = [
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
];

function currentPeriod(): Period {
    const d = new Date();
    return { month: d.getUTCMonth() + 1, year: d.getUTCFullYear() };
}

function triggerDownload(filename: string, body: string): void {
    const blob = new Blob([body], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function fmtInr(n: number | undefined): string {
    if (typeof n !== 'number' || !Number.isFinite(n)) return '-';
    return `INR ${n.toFixed(2)}`;
}

interface SectionCardProps {
    title: string;
    subtitle: string;
    rowCount: number;
    totals?: Array<{ label: string; value: string }>;
    children: React.ReactNode;
}

function SectionCard({ title, subtitle, rowCount, totals, children }: SectionCardProps) {
    const [open, setOpen] = React.useState(false);
    return (
        <ZoruCard>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex w-full items-center justify-between text-left"
                aria-expanded={open}
            >
                <div>
                    <div className="flex items-center gap-2">
                        {open ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                            {rowCount} rows
                        </span>
                    </div>
                    <p className="ml-6 mt-0.5 text-[12px] text-muted-foreground">{subtitle}</p>
                </div>
                {totals && (
                    <div className="flex items-center gap-4">
                        {totals.map((t) => (
                            <div key={t.label} className="text-right">
                                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                    {t.label}
                                </p>
                                <p className="font-mono text-[13px] text-foreground">{t.value}</p>
                            </div>
                        ))}
                    </div>
                )}
            </button>
            {open && <div className="mt-4 border-t border-border pt-4">{children}</div>}
        </ZoruCard>
    );
}

export default function Gstr1Page() {
    const { toast } = useZoruToast();
    const [period, setPeriod] = React.useState<Period>(currentPeriod);
    const [loading, setLoading] = React.useState(false);
    const [raw, setRaw] = React.useState<Gstr1Return | null>(null);
    const [summary, setSummary] = React.useState<Record<string, number | string | null> | null>(
        null,
    );

    const handleGenerate = React.useCallback(async () => {
        setLoading(true);
        try {
            const res = await generateGstr1Report(period);
            if (res.error) {
                toast({ title: 'Could not generate GSTR-1', description: res.error });
                setRaw(null);
                setSummary(null);
                return;
            }
            setRaw(res.raw ?? null);
            setSummary((res.result?.summary as Record<string, number | string | null>) ?? null);
        } finally {
            setLoading(false);
        }
    }, [period, toast]);

    const handleDownloadJson = () => {
        if (!raw) return;
        triggerDownload(
            `GSTR1-${String(period.month).padStart(2, '0')}-${period.year}.json`,
            JSON.stringify(raw, null, 2),
        );
    };

    const handleDownloadGstn = async () => {
        const res = await downloadGstr1Json(period);
        if (res.error || !res.json || !res.filename) {
            toast({
                title: 'GSTN JSON unavailable',
                description: res.error ?? 'Unknown error',
            });
            return;
        }
        triggerDownload(res.filename, res.json);
    };

    return (
        <EntityListShell
            title="GSTR-1"
            subtitle="Outward supplies — generate the monthly return JSON for the GST portal."
        >

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
                    {raw && (
                        <>
                            <ZoruButton variant="outline" onClick={handleDownloadJson}>
                                <Download className="h-4 w-4" /> Raw JSON
                            </ZoruButton>
                            <ZoruButton variant="outline" onClick={handleDownloadGstn}>
                                <Download className="h-4 w-4" /> GSTN JSON
                            </ZoruButton>
                        </>
                    )}
                </div>
            </ZoruCard>

            {!raw && !loading && (
                <ZoruCard>
                    <p className="text-[13px] text-muted-foreground">
                        Pick a period and click Generate to build this month&apos;s GSTR-1.
                    </p>
                </ZoruCard>
            )}

            {raw && summary && (
                <>
                    <ZoruCard>
                        <h2 className="text-[15px] font-semibold text-foreground">Summary</h2>
                        <p className="mt-0.5 text-[12px] text-muted-foreground">
                            Period: {String(period.month).padStart(2, '0')}/{period.year}
                        </p>
                        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                            <StatBox label="Total Taxable" value={fmtInr(Number(summary.taxable))} />
                            <StatBox label="IGST" value={fmtInr(Number(summary.igst))} />
                            <StatBox label="CGST" value={fmtInr(Number(summary.cgst))} />
                            <StatBox label="SGST" value={fmtInr(Number(summary.sgst))} />
                            <StatBox label="Cess" value={fmtInr(Number(summary.cess))} />
                            <StatBox
                                label="Total Tax"
                                value={fmtInr(Number(summary.total_tax))}
                            />
                            <StatBox
                                label="Invoice Value"
                                value={fmtInr(Number(summary.invoice_value))}
                            />
                        </div>
                    </ZoruCard>

                    <SectionCard
                        title="B2B — Registered buyers"
                        subtitle="Invoices with a buyer GSTIN."
                        rowCount={raw.b2b.length}
                        totals={[
                            {
                                label: 'Invoice Value',
                                value: fmtInr(raw.b2b.reduce((s, r) => s + r.invoiceValue, 0)),
                            },
                        ]}
                    >
                        <pre className="overflow-x-auto rounded bg-secondary p-3 text-[11px] text-muted-foreground">
                            {JSON.stringify(raw.b2b, null, 2)}
                        </pre>
                    </SectionCard>

                    <SectionCard
                        title="B2CL — Inter-state, unregistered, > INR 2.5L"
                        subtitle="Large unregistered inter-state supplies."
                        rowCount={raw.b2cl.length}
                        totals={[
                            {
                                label: 'Invoice Value',
                                value: fmtInr(raw.b2cl.reduce((s, r) => s + r.invoiceValue, 0)),
                            },
                        ]}
                    >
                        <pre className="overflow-x-auto rounded bg-secondary p-3 text-[11px] text-muted-foreground">
                            {JSON.stringify(raw.b2cl, null, 2)}
                        </pre>
                    </SectionCard>

                    <SectionCard
                        title="B2CS — Small supplies"
                        subtitle="Aggregated per (place-of-supply x rate)."
                        rowCount={raw.b2cs.length}
                        totals={[
                            {
                                label: 'Taxable',
                                value: fmtInr(raw.b2cs.reduce((s, r) => s + r.taxableValue, 0)),
                            },
                        ]}
                    >
                        <pre className="overflow-x-auto rounded bg-secondary p-3 text-[11px] text-muted-foreground">
                            {JSON.stringify(raw.b2cs, null, 2)}
                        </pre>
                    </SectionCard>

                    <SectionCard
                        title="CDNR — Credit & debit notes"
                        subtitle="Notes against B2B / large inter-state invoices."
                        rowCount={raw.cdnr.length}
                        totals={[
                            {
                                label: 'Note Value',
                                value: fmtInr(raw.cdnr.reduce((s, r) => s + r.noteValue, 0)),
                            },
                        ]}
                    >
                        <pre className="overflow-x-auto rounded bg-secondary p-3 text-[11px] text-muted-foreground">
                            {JSON.stringify(raw.cdnr, null, 2)}
                        </pre>
                    </SectionCard>

                    <SectionCard
                        title="HSN summary"
                        subtitle="Per HSN code (mandatory for the return)."
                        rowCount={raw.hsn.length}
                        totals={[
                            {
                                label: 'Taxable',
                                value: fmtInr(raw.hsn.reduce((s, r) => s + r.taxableValue, 0)),
                            },
                        ]}
                    >
                        <pre className="overflow-x-auto rounded bg-secondary p-3 text-[11px] text-muted-foreground">
                            {JSON.stringify(raw.hsn, null, 2)}
                        </pre>
                    </SectionCard>

                    <SectionCard
                        title="Documents issued"
                        subtitle="Number-series counts for invoices and credit notes."
                        rowCount={raw.docIssue.length}
                    >
                        <pre className="overflow-x-auto rounded bg-secondary p-3 text-[11px] text-muted-foreground">
                            {JSON.stringify(raw.docIssue, null, 2)}
                        </pre>
                    </SectionCard>
                </>
            )}
        </EntityListShell>
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
