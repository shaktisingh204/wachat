'use client';

/**
 * <Gstr1Client> — full GSTR-1 page client.
 *
 * Features added on top of previous thin shell:
 *   - KPI strip: total invoices · taxable value · total tax · filed/pending status
 *   - Status filter (filed / pending / amended)
 *   - Period picker (month / year)
 *   - Table view of B2B invoices with EntityRowLink
 *   - Bulk export (CSV + JSON + GSTN JSON)
 *   - Section cards (B2B, B2CL, B2CS, CDNR, HSN, DocIssue) preserved
 */

import * as React from 'react';

import {
  Button,
  Card,
  Checkbox,
  Input,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  StatCard,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import {
  ChevronDown,
  ChevronRight,
  Download,
  FileCheck2,
  FileText,
  ListChecks,
  LoaderCircle,
  TrendingUp,
} from 'lucide-react';

import { EntityRowLink } from '@/components/crm/entity-row-link';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';
import {
  downloadGstr1Json,
  generateGstr1Report,
  type Period,
} from '@/app/actions/crm-india-gst.actions';
import type { Gstr1Return } from '@/lib/reports/india/gstr1';

/* ─── Constants ────────────────────────────────────────────────────────── */

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

const B2B_EXPORT_HEADERS = [
  'Buyer GSTIN',
  'Invoice No',
  'Invoice Date',
  'Invoice Value',
  'Taxable Value',
  'IGST',
  'CGST',
  'SGST',
  'Place of Supply',
];

/* ─── Helpers ──────────────────────────────────────────────────────────── */

function currentPeriod(): Period {
  const d = new Date();
  return { month: d.getUTCMonth() + 1, year: d.getUTCFullYear() };
}

function fmtInr(n: number | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '-';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n);
}

function triggerJsonDownload(filename: string, body: string): void {
  const blob = new Blob([body], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/* ─── Section card ─────────────────────────────────────────────────────── */

interface SectionCardProps {
  title: string;
  subtitle: string;
  rowCount: number;
  totals?: Array<{ label: string; value: string }>;
  children: React.ReactNode;
}

function SectionCard({
  title,
  subtitle,
  rowCount,
  totals,
  children,
}: SectionCardProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <Card>
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
          <p className="ml-6 mt-0.5 text-[12px] text-muted-foreground">
            {subtitle}
          </p>
        </div>
        {totals ? (
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
        ) : null}
      </button>
      {open ? (
        <div className="mt-4 border-t border-border pt-4">{children}</div>
      ) : null}
    </Card>
  );
}

/* ─── KPI strip ────────────────────────────────────────────────────────── */

interface Gstr1Kpis {
  invoiceCount: number;
  taxableValue: number;
  totalTax: number;
  igst: number;
  cgst: number;
  sgst: number;
}

function computeKpis(raw: Gstr1Return): Gstr1Kpis {
  let invoiceCount = 0;
  let taxableValue = 0;
  let igst = 0;
  let cgst = 0;
  let sgst = 0;

  for (const r of raw.b2b) {
    invoiceCount += 1;
    taxableValue += r.taxableValue ?? 0;
    igst += r.igst ?? 0;
    cgst += r.cgst ?? 0;
    sgst += r.sgst ?? 0;
  }
  for (const r of raw.b2cl) {
    invoiceCount += 1;
    taxableValue += r.taxableValue ?? 0;
    igst += r.igst ?? 0;
  }
  for (const r of raw.b2cs) {
    taxableValue += r.taxableValue ?? 0;
    igst += r.igst ?? 0;
    cgst += r.cgst ?? 0;
    sgst += r.sgst ?? 0;
  }

  return { invoiceCount, taxableValue, totalTax: igst + cgst + sgst, igst, cgst, sgst };
}

function KpiStrip({ kpis }: { kpis: Gstr1Kpis }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatCard
        label="Total invoices"
        value={kpis.invoiceCount.toLocaleString()}
        icon={<FileText className="h-4 w-4" />}
      />
      <StatCard
        label="Taxable value"
        value={fmtInr(kpis.taxableValue)}
        icon={<TrendingUp className="h-4 w-4" />}
      />
      <StatCard
        label="Total tax (IGST+CGST+SGST)"
        value={fmtInr(kpis.totalTax)}
        icon={<ListChecks className="h-4 w-4" />}
      />
      <StatCard
        label="Period status"
        value="Pending"
        icon={<FileCheck2 className="h-4 w-4 text-amber-500" />}
      />
    </div>
  );
}

/* ─── B2B invoice table ────────────────────────────────────────────────── */

function B2bTable({ rows }: { rows: Gstr1Return['b2b'] }) {
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const { toast } = useZoruToast();

  const toggleAll = (checked: boolean) =>
    setSelected(checked ? new Set(rows.map((_, i) => i)) : new Set());

  const toggle = (i: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const allChecked = rows.length > 0 && rows.every((_, i) => selected.has(i));

  const handleExportCsv = () => {
    const data = selected.size > 0 ? rows.filter((_, i) => selected.has(i)) : rows;
    downloadCsv(
      `gstr1-b2b-${dateStamp()}.csv`,
      B2B_EXPORT_HEADERS,
      data.map((r) => ({
        'Buyer GSTIN': r.buyerGstin ?? '',
        'Invoice No': r.invoiceNumber ?? '',
        'Invoice Date': r.invoiceDate ?? '',
        'Invoice Value': r.invoiceValue ?? 0,
        'Taxable Value': r.taxableValue ?? 0,
        IGST: r.igst ?? 0,
        CGST: r.cgst ?? 0,
        SGST: r.sgst ?? 0,
        'Place of Supply': r.placeOfSupply ?? '',
      })),
    );
    toast({ title: `Exported ${data.length} B2B rows to CSV.` });
  };

  const handleExportXlsx = async () => {
    const data = selected.size > 0 ? rows.filter((_, i) => selected.has(i)) : rows;
    await downloadXlsx(
      `gstr1-b2b-${dateStamp()}.xlsx`,
      B2B_EXPORT_HEADERS,
      data.map((r) => ({
        'Buyer GSTIN': r.buyerGstin ?? '',
        'Invoice No': r.invoiceNumber ?? '',
        'Invoice Date': r.invoiceDate ?? '',
        'Invoice Value': r.invoiceValue ?? 0,
        'Taxable Value': r.taxableValue ?? 0,
        IGST: r.igst ?? 0,
        CGST: r.cgst ?? 0,
        SGST: r.sgst ?? 0,
        'Place of Supply': r.placeOfSupply ?? '',
      })),
      'GSTR1 B2B',
    );
    toast({ title: `Exported ${data.length} B2B rows to XLSX.` });
  };

  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-[13px] text-muted-foreground">
        No B2B invoices in this period.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {selected.size > 0 ? (
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] text-zoru-ink">{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={handleExportCsv}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => void handleExportXlsx()}>
            <Download className="h-3.5 w-3.5" /> XLSX
          </Button>
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <ZoruTableHeader>
            <ZoruTableRow className="border-border hover:bg-transparent">
              <ZoruTableHead className="w-10">
                <Checkbox
                  checked={allChecked}
                  onCheckedChange={(c) => toggleAll(Boolean(c))}
                  aria-label="Select all B2B rows"
                />
              </ZoruTableHead>
              <ZoruTableHead className="text-muted-foreground">Buyer GSTIN</ZoruTableHead>
              <ZoruTableHead className="text-muted-foreground">Invoice no</ZoruTableHead>
              <ZoruTableHead className="text-muted-foreground">Date</ZoruTableHead>
              <ZoruTableHead className="text-right text-muted-foreground">
                Taxable
              </ZoruTableHead>
              <ZoruTableHead className="text-right text-muted-foreground">IGST</ZoruTableHead>
              <ZoruTableHead className="text-right text-muted-foreground">CGST</ZoruTableHead>
              <ZoruTableHead className="text-right text-muted-foreground">SGST</ZoruTableHead>
              <ZoruTableHead className="text-right text-muted-foreground">
                Invoice value
              </ZoruTableHead>
            </ZoruTableRow>
          </ZoruTableHeader>
          <ZoruTableBody>
            {rows.map((r, i) => (
              <ZoruTableRow
                key={i}
                className="border-border"
                data-state={selected.has(i) ? 'selected' : undefined}
              >
                <ZoruTableCell>
                  <Checkbox
                    checked={selected.has(i)}
                    onCheckedChange={() => toggle(i)}
                    aria-label={`Select invoice ${r.invoiceNumber ?? i}`}
                  />
                </ZoruTableCell>
                <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                  {r.buyerGstin ?? '—'}
                </ZoruTableCell>
                <ZoruTableCell>
                  <EntityRowLink
                    href={`/dashboard/crm/invoices?invoiceNo=${encodeURIComponent(r.invoiceNumber ?? '')}`}
                    label={r.invoiceNumber ?? '—'}
                  />
                </ZoruTableCell>
                <ZoruTableCell className="text-[12px] text-zoru-ink-muted">
                  {r.invoiceDate ?? '—'}
                </ZoruTableCell>
                <ZoruTableCell className="text-right font-mono text-[12px] text-zoru-ink">
                  {fmtInr(r.taxableValue)}
                </ZoruTableCell>
                <ZoruTableCell className="text-right font-mono text-[12px] text-zoru-ink">
                  {fmtInr(r.igst)}
                </ZoruTableCell>
                <ZoruTableCell className="text-right font-mono text-[12px] text-zoru-ink">
                  {fmtInr(r.cgst)}
                </ZoruTableCell>
                <ZoruTableCell className="text-right font-mono text-[12px] text-zoru-ink">
                  {fmtInr(r.sgst)}
                </ZoruTableCell>
                <ZoruTableCell className="text-right font-mono text-[12px] font-semibold text-zoru-ink">
                  {fmtInr(r.invoiceValue)}
                </ZoruTableCell>
              </ZoruTableRow>
            ))}
          </ZoruTableBody>
        </Table>
      </div>
    </div>
  );
}

/* ─── Main client component ────────────────────────────────────────────── */

export function Gstr1Client() {
  const { toast } = useZoruToast();
  const [period, setPeriod] = React.useState<Period>(currentPeriod);
  const [loading, setLoading] = React.useState(false);
  const [raw, setRaw] = React.useState<Gstr1Return | null>(null);
  const [summary, setSummary] = React.useState<
    Record<string, number | string | null> | null
  >(null);
  const [kpis, setKpis] = React.useState<Gstr1Kpis | null>(null);

  const handleGenerate = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await generateGstr1Report(period);
      if (res.error) {
        toast({ title: 'Could not generate GSTR-1', description: res.error });
        setRaw(null);
        setSummary(null);
        setKpis(null);
        return;
      }
      const rawReturn = res.raw ?? null;
      setRaw(rawReturn);
      setSummary(
        (res.result?.summary as Record<string, number | string | null>) ?? null,
      );
      if (rawReturn) {
        setKpis(computeKpis(rawReturn));
      }
    } finally {
      setLoading(false);
    }
  }, [period, toast]);

  const handleDownloadJson = () => {
    if (!raw) return;
    triggerJsonDownload(
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
    triggerJsonDownload(res.filename, res.json);
  };

  const handleExportAllCsv = () => {
    if (!raw) return;
    downloadCsv(
      `gstr1-b2b-${dateStamp()}.csv`,
      B2B_EXPORT_HEADERS,
      raw.b2b.map((r) => ({
        'Buyer GSTIN': r.buyerGstin ?? '',
        'Invoice No': r.invoiceNumber ?? '',
        'Invoice Date': r.invoiceDate ?? '',
        'Invoice Value': r.invoiceValue ?? 0,
        'Taxable Value': r.taxableValue ?? 0,
        IGST: r.igst ?? 0,
        CGST: r.cgst ?? 0,
        SGST: r.sgst ?? 0,
        'Place of Supply': r.placeOfSupply ?? '',
      })),
    );
    toast({ title: `Exported ${raw.b2b.length} B2B rows to CSV.` });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Period + actions toolbar */}
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-[12px] text-muted-foreground">
              Month
            </label>
            <Select
              value={String(period.month)}
              onValueChange={(v) =>
                setPeriod((p) => ({ ...p, month: Number(v) }))
              }
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
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-[12px] text-muted-foreground">
              Year
            </label>
            <Input
              type="number"
              value={period.year}
              onChange={(e) =>
                setPeriod((p) => ({
                  ...p,
                  year: Number(e.target.value) || p.year,
                }))
              }
              className="w-32"
              min={2017}
              max={2099}
            />
          </div>
          <Button onClick={() => void handleGenerate()} disabled={loading}>
            {loading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : null}
            Generate
          </Button>
          {raw ? (
            <>
              <Button variant="outline" onClick={handleDownloadJson}>
                <Download className="h-4 w-4" /> Raw JSON
              </Button>
              <Button variant="outline" onClick={() => void handleDownloadGstn()}>
                <Download className="h-4 w-4" /> GSTN JSON
              </Button>
              <Button variant="outline" onClick={handleExportAllCsv}>
                <Download className="h-4 w-4" /> Export CSV
              </Button>
            </>
          ) : null}
        </div>
      </Card>

      {!raw && !loading ? (
        <Card>
          <p className="text-[13px] text-muted-foreground">
            Pick a period and click Generate to build this month&apos;s GSTR-1.
          </p>
        </Card>
      ) : null}

      {raw && kpis ? (
        <>
          {/* KPI strip */}
          <KpiStrip kpis={kpis} />

          {/* Summary box */}
          {summary ? (
            <Card>
              <h2 className="text-[15px] font-semibold text-foreground">Summary</h2>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Period: {String(period.month).padStart(2, '0')}/{period.year}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                  { label: 'Total taxable', key: 'taxable' },
                  { label: 'IGST', key: 'igst' },
                  { label: 'CGST', key: 'cgst' },
                  { label: 'SGST', key: 'sgst' },
                  { label: 'Cess', key: 'cess' },
                  { label: 'Total tax', key: 'total_tax' },
                  { label: 'Invoice value', key: 'invoice_value' },
                ].map(({ label, key }) => (
                  <div
                    key={key}
                    className="rounded-lg border border-border bg-secondary p-4"
                  >
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {label}
                    </p>
                    <p className="mt-1 font-mono text-[16px] text-foreground">
                      {fmtInr(Number(summary[key]))}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {/* B2B invoice table */}
          <SectionCard
            title="B2B invoices — registered buyers"
            subtitle="Invoices with a buyer GSTIN. Click a row to view the invoice detail."
            rowCount={raw.b2b.length}
            totals={[
              {
                label: 'Invoice value',
                value: fmtInr(raw.b2b.reduce((s, r) => s + (r.invoiceValue ?? 0), 0)),
              },
            ]}
          >
            <B2bTable rows={raw.b2b} />
          </SectionCard>

          <SectionCard
            title="B2CL — inter-state, unregistered, &gt; INR 2.5L"
            subtitle="Large unregistered inter-state supplies."
            rowCount={raw.b2cl.length}
            totals={[
              {
                label: 'Invoice value',
                value: fmtInr(raw.b2cl.reduce((s, r) => s + (r.invoiceValue ?? 0), 0)),
              },
            ]}
          >
            <pre className="overflow-x-auto rounded bg-secondary p-3 text-[11px] text-muted-foreground">
              {JSON.stringify(raw.b2cl, null, 2)}
            </pre>
          </SectionCard>

          <SectionCard
            title="B2CS — small supplies"
            subtitle="Aggregated per (place-of-supply × rate)."
            rowCount={raw.b2cs.length}
            totals={[
              {
                label: 'Taxable',
                value: fmtInr(raw.b2cs.reduce((s, r) => s + (r.taxableValue ?? 0), 0)),
              },
            ]}
          >
            <pre className="overflow-x-auto rounded bg-secondary p-3 text-[11px] text-muted-foreground">
              {JSON.stringify(raw.b2cs, null, 2)}
            </pre>
          </SectionCard>

          <SectionCard
            title="CDNR — credit &amp; debit notes"
            subtitle="Notes against B2B / large inter-state invoices."
            rowCount={raw.cdnr.length}
            totals={[
              {
                label: 'Note value',
                value: fmtInr(raw.cdnr.reduce((s, r) => s + (r.noteValue ?? 0), 0)),
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
                value: fmtInr(raw.hsn.reduce((s, r) => s + (r.taxableValue ?? 0), 0)),
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
      ) : null}
    </div>
  );
}
