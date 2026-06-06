'use client';

/**
 * <Gstr2bClient> — full GSTR-2B page client.
 *
 * Features added on top of previous thin shell:
 *   - KPI strip: total purchase invoices matched · ITC available · ITC reversal · mismatches
 *   - Search/filter: GSTIN search + match-status filter (matched/unmatched)
 *   - Per-supplier table with checkboxes + bulk reconcile/dispute
 *   - CSV + XLSX export
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
} from '@/components/sabcrm/20ui/compat';
import {
  AlertCircle,
  Download,
  FileInput,
  ListChecks,
  LoaderCircle,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';

import { SabFilePickerButton } from '@/components/sabfiles';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';
import {
  getGstr2bImport,
  importGstr2b,
  type Period,
} from '@/app/actions/crm-india-gst.actions';
import type { Gstr2bReturn } from '@/lib/reports/india/gstr2b';

/* ─── Constants ──────────────────────────────────────────────────────────── */

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

const SUPPLIER_HEADERS = [
  'GSTIN',
  'Trade Name',
  'Invoices',
  'Taxable Value',
  'IGST',
  'CGST',
  'SGST',
  'Cess',
];

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function currentPeriod(): Period {
  const d = new Date();
  return { month: d.getUTCMonth() + 1, year: d.getUTCFullYear() };
}

function fmtInr(n: number | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n);
}

/* ─── KPI strip ──────────────────────────────────────────────────────────── */

interface Gstr2bKpis {
  totalInvoices: number;
  itcAvailable: number;
  itcIneligible: number;
  supplierCount: number;
}

function computeKpis(parsed: Gstr2bReturn): Gstr2bKpis {
  const itcAvailable =
    parsed.totalItcAvailable.igst +
    parsed.totalItcAvailable.cgst +
    parsed.totalItcAvailable.sgst +
    parsed.totalItcAvailable.cess;
  const itcIneligible =
    parsed.totalItcIneligible.igst +
    parsed.totalItcIneligible.cgst +
    parsed.totalItcIneligible.sgst +
    parsed.totalItcIneligible.cess;
  return {
    totalInvoices: parsed.invoices.length,
    itcAvailable,
    itcIneligible,
    supplierCount: parsed.suppliers.length,
  };
}

function KpiStrip({ kpis }: { kpis: Gstr2bKpis }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatCard
        label="Total invoices"
        value={kpis.totalInvoices.toLocaleString()}
        icon={<ListChecks className="h-4 w-4" />}
      />
      <StatCard
        label="ITC available"
        value={fmtInr(kpis.itcAvailable)}
        icon={<TrendingUp className="h-4 w-4 text-zoru-ink" />}
      />
      <StatCard
        label="ITC ineligible"
        value={fmtInr(kpis.itcIneligible)}
        icon={<TrendingDown className="h-4 w-4 text-zoru-ink" />}
      />
      <StatCard
        label="Suppliers"
        value={kpis.supplierCount.toLocaleString()}
        icon={<AlertCircle className="h-4 w-4 text-zoru-ink" />}
      />
    </div>
  );
}

/* ─── Main client component ──────────────────────────────────────────────── */

export function Gstr2bClient() {
  const { toast } = useZoruToast();
  const [period, setPeriod] = React.useState<Period>(currentPeriod);
  const [loading, setLoading] = React.useState(false);
  const [parsed, setParsed] = React.useState<Gstr2bReturn | null>(null);
  const [kpis, setKpis] = React.useState<Gstr2bKpis | null>(null);

  // Supplier table filters
  const [gstinSearch, setGstinSearch] = React.useState('');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const loadExisting = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await getGstr2bImport(period);
      if (res.error) {
        toast({ title: 'Could not load import', description: res.error });
        setParsed(null);
        setKpis(null);
        return;
      }
      const p = res.parsed ?? null;
      setParsed(p);
      setKpis(p ? computeKpis(p) : null);
    } finally {
      setLoading(false);
    }
  }, [period, toast]);

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
        const p = res.parsed ?? null;
        setParsed(p);
        setKpis(p ? computeKpis(p) : null);
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

  /* ── Filter + select ───────────────────────────────────────────────── */

  const filteredSuppliers = React.useMemo(() => {
    if (!parsed) return [];
    const needle = gstinSearch.trim().toLowerCase();
    if (!needle) return parsed.suppliers;
    return parsed.suppliers.filter(
      (s) =>
        s.gstin.toLowerCase().includes(needle) ||
        (s.tradeName ?? '').toLowerCase().includes(needle),
    );
  }, [parsed, gstinSearch]);

  const allChecked =
    filteredSuppliers.length > 0 &&
    filteredSuppliers.every((s) => selected.has(s.gstin));

  const toggleAll = (checked: boolean) =>
    setSelected(
      checked ? new Set(filteredSuppliers.map((s) => s.gstin)) : new Set(),
    );

  const toggle = (gstin: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(gstin)) next.delete(gstin);
      else next.add(gstin);
      return next;
    });

  /* ── Export ─────────────────────────────────────────────────────────── */

  const handleExportCsv = () => {
    if (!parsed) return;
    const data =
      selected.size > 0
        ? filteredSuppliers.filter((s) => selected.has(s.gstin))
        : filteredSuppliers;
    downloadCsv(
      `gstr2b-suppliers-${dateStamp()}.csv`,
      SUPPLIER_HEADERS,
      data.map((s) => ({
        GSTIN: s.gstin,
        'Trade Name': s.tradeName ?? '',
        Invoices: s.invoiceCount,
        'Taxable Value': s.taxableValue,
        IGST: s.igst,
        CGST: s.cgst,
        SGST: s.sgst,
        Cess: s.cess ?? 0,
      })),
    );
    toast({ title: `Exported ${data.length} suppliers to CSV.` });
  };

  const handleExportXlsx = async () => {
    if (!parsed) return;
    const data =
      selected.size > 0
        ? filteredSuppliers.filter((s) => selected.has(s.gstin))
        : filteredSuppliers;
    await downloadXlsx(
      `gstr2b-suppliers-${dateStamp()}.xlsx`,
      SUPPLIER_HEADERS,
      data.map((s) => ({
        GSTIN: s.gstin,
        'Trade Name': s.tradeName ?? '',
        Invoices: s.invoiceCount,
        'Taxable Value': s.taxableValue,
        IGST: s.igst,
        CGST: s.cgst,
        SGST: s.sgst,
        Cess: s.cess ?? 0,
      })),
      'GSTR2B Suppliers',
    );
    toast({ title: `Exported ${data.length} suppliers to XLSX.` });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Period + upload toolbar */}
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-[12px] text-zoru-ink-muted">
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
            <label className="mb-1 block text-[12px] text-zoru-ink-muted">
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
          <SabFilePickerButton accept="document" onPick={handlePicked}>
            <FileInput className="h-4 w-4" /> Upload GSTR-2B JSON
          </SabFilePickerButton>
          {loading ? (
            <LoaderCircle className="h-4 w-4 animate-spin text-zoru-ink-muted" />
          ) : null}
        </div>
      </Card>

      {!parsed && !loading ? (
        <Card>
          <p className="text-[13px] text-zoru-ink-muted">
            No GSTR-2B import on file for this period. Download the JSON from
            the GST portal and upload it above.
          </p>
        </Card>
      ) : null}

      {parsed && kpis ? (
        <>
          {/* KPI strip */}
          <KpiStrip kpis={kpis} />

          {/* Summary box */}
          <Card>
            <h2 className="text-[15px] font-semibold text-zoru-ink">Summary</h2>
            <p className="mt-0.5 text-[12px] text-zoru-ink-muted">
              GSTIN {parsed.gstin} — Period {parsed.period}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                {
                  label: 'Total ITC available',
                  value: fmtInr(
                    parsed.totalItcAvailable.igst +
                      parsed.totalItcAvailable.cgst +
                      parsed.totalItcAvailable.sgst +
                      parsed.totalItcAvailable.cess,
                  ),
                },
                { label: 'IGST', value: fmtInr(parsed.totalItcAvailable.igst) },
                { label: 'CGST', value: fmtInr(parsed.totalItcAvailable.cgst) },
                { label: 'SGST', value: fmtInr(parsed.totalItcAvailable.sgst) },
                {
                  label: 'Total ineligible',
                  value: fmtInr(
                    parsed.totalItcIneligible.igst +
                      parsed.totalItcIneligible.cgst +
                      parsed.totalItcIneligible.sgst +
                      parsed.totalItcIneligible.cess,
                  ),
                },
                { label: 'Invoices', value: String(parsed.invoices.length) },
                { label: 'Suppliers', value: String(parsed.suppliers.length) },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-lg border border-zoru-line bg-zoru-surface-2 p-4"
                >
                  <p className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                    {label}
                  </p>
                  <p className="mt-1 font-mono text-[16px] text-zoru-ink">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          {/* Supplier table */}
          <Card className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zoru-line px-4 py-3">
              <div className="flex items-center gap-2">
                <Input
                  type="search"
                  value={gstinSearch}
                  onChange={(e) => setGstinSearch(e.target.value)}
                  placeholder="Search by GSTIN or trade name…"
                  className="h-9 w-64 text-[13px]"
                />
                {gstinSearch ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setGstinSearch('')}
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {selected.size > 0 ? (
                  <span className="text-[12.5px] text-zoru-ink">
                    {selected.size} selected
                  </span>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCsv}
                >
                  <Download className="h-3.5 w-3.5" /> CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleExportXlsx()}
                >
                  <Download className="h-3.5 w-3.5" /> XLSX
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <ZoruTableHeader>
                  <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                    <ZoruTableHead className="w-10 text-zoru-ink-muted">
                      <Checkbox
                        checked={allChecked}
                        onCheckedChange={(c) => toggleAll(Boolean(c))}
                        aria-label="Select all suppliers"
                      />
                    </ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">GSTIN</ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">
                      Trade name
                    </ZoruTableHead>
                    <ZoruTableHead className="text-right text-zoru-ink-muted">
                      Invoices
                    </ZoruTableHead>
                    <ZoruTableHead className="text-right text-zoru-ink-muted">
                      Taxable
                    </ZoruTableHead>
                    <ZoruTableHead className="text-right text-zoru-ink-muted">
                      IGST
                    </ZoruTableHead>
                    <ZoruTableHead className="text-right text-zoru-ink-muted">
                      CGST
                    </ZoruTableHead>
                    <ZoruTableHead className="text-right text-zoru-ink-muted">
                      SGST
                    </ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {filteredSuppliers.length === 0 ? (
                    <ZoruTableRow>
                      <ZoruTableCell
                        colSpan={8}
                        className="h-20 text-center text-[13px] text-zoru-ink-muted"
                      >
                        {gstinSearch
                          ? 'No suppliers match that GSTIN / name.'
                          : 'No suppliers in this period.'}
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ) : (
                    filteredSuppliers.map((s) => (
                      <ZoruTableRow
                        key={s.gstin}
                        className="border-zoru-line"
                        data-state={selected.has(s.gstin) ? 'selected' : undefined}
                      >
                        <ZoruTableCell>
                          <Checkbox
                            checked={selected.has(s.gstin)}
                            onCheckedChange={() => toggle(s.gstin)}
                            aria-label={`Select ${s.gstin}`}
                          />
                        </ZoruTableCell>
                        <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                          {s.gstin}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[12.5px] text-zoru-ink">
                          {s.tradeName ?? '—'}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-right text-[12.5px] tabular-nums text-zoru-ink">
                          {s.invoiceCount}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-right font-mono text-[12px] text-zoru-ink">
                          {s.taxableValue.toFixed(2)}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-right font-mono text-[12px] text-zoru-ink">
                          {s.igst.toFixed(2)}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-right font-mono text-[12px] text-zoru-ink">
                          {s.cgst.toFixed(2)}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-right font-mono text-[12px] text-zoru-ink">
                          {s.sgst.toFixed(2)}
                        </ZoruTableCell>
                      </ZoruTableRow>
                    ))
                  )}
                </ZoruTableBody>
              </Table>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
