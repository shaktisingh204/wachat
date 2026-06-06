'use client';

/**
 * Client shell for the ITC Reconciliation page.
 *
 * Provides:
 *  - Checkbox row selection on the Mismatched table
 *  - Bulk reconcile action (moves onlyInBooks rows to matched)
 *  - Export CSV / XLSX for each of the three table sections
 *  - EntityRowLink on supplier name → vendor detail page
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Download, Loader2, X } from 'lucide-react';

import {
    Button,
    Checkbox,
    Table,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
} from '@/components/sabcrm/20ui/compat';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { downloadCsv, downloadXlsx, dateStamp, type ExportRow } from '@/lib/crm-list-export';
import { bulkReconcileMismatched } from '@/app/actions/crm-india-itc.actions';
import type {
    ItcReconciliationResult,
    ItcReconciliationMatched,
    ItcReconciliationRow,
    BookItcResult,
} from '@/lib/india-tax/itc-ledger';

/* ─── helpers ─────────────────────────────────────────────────────── */

function fmtMoney(n: number): string {
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(n);
    } catch {
        return `₹${n}`;
    }
}

function vendorHref(supplierGstin: string | null): string | null {
    // We link by GSTIN search because BookItcRow has no vendorId
    if (!supplierGstin) return null;
    return `/dashboard/crm/purchases/vendors?gstin=${encodeURIComponent(supplierGstin)}`;
}

/* ─── Matched table ───────────────────────────────────────────────── */

function MatchedTable({ rows, period }: { rows: ItcReconciliationMatched[]; period: string }) {
    function handleCsv() {
        const headers = ['Supplier', 'GSTIN', 'Invoice #', 'Book ITC', '2B ITC', 'Delta', 'Match'];
        const data: ExportRow[] = rows.map((m) => ({
            Supplier: m.supplierName,
            GSTIN: m.supplierGstin,
            'Invoice #': m.invoiceNumber,
            'Book ITC': m.bookItc,
            '2B ITC': m.gstr2bItc,
            Delta: m.bookItc - m.gstr2bItc,
            Match: m.matchType,
        }));
        downloadCsv(`itc-matched-${period}-${dateStamp()}.csv`, headers, data);
    }

    async function handleXlsx() {
        const headers = ['Supplier', 'GSTIN', 'Invoice #', 'Book ITC', '2B ITC', 'Delta', 'Match'];
        const data: ExportRow[] = rows.map((m) => ({
            Supplier: m.supplierName,
            GSTIN: m.supplierGstin,
            'Invoice #': m.invoiceNumber,
            'Book ITC': m.bookItc,
            '2B ITC': m.gstr2bItc,
            Delta: m.bookItc - m.gstr2bItc,
            Match: m.matchType,
        }));
        await downloadXlsx(
            `itc-matched-${period}-${dateStamp()}.xlsx`,
            headers,
            data,
            'Matched',
        );
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-[15px] font-semibold text-zoru-ink">
                        Matched ({rows.length})
                    </h2>
                    <p className="text-[12px] text-zoru-ink-muted">
                        Bills aligned with GSTR-2B; mismatched ITC delta highlighted.
                    </p>
                </div>
                {rows.length > 0 && (
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={handleCsv}>
                            <Download className="h-3.5 w-3.5" />
                            CSV
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleXlsx}>
                            <Download className="h-3.5 w-3.5" />
                            XLSX
                        </Button>
                    </div>
                )}
            </div>
            <div className="overflow-x-auto rounded-lg border border-zoru-line">
                <Table>
                    <ZoruTableHeader>
                        <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                            <ZoruTableHead className="text-zoru-ink-muted">Supplier</ZoruTableHead>
                            <ZoruTableHead className="text-zoru-ink-muted">Invoice #</ZoruTableHead>
                            <ZoruTableHead className="text-right text-zoru-ink-muted">Book ITC</ZoruTableHead>
                            <ZoruTableHead className="text-right text-zoru-ink-muted">2B ITC</ZoruTableHead>
                            <ZoruTableHead className="text-right text-zoru-ink-muted">Delta</ZoruTableHead>
                            <ZoruTableHead className="text-zoru-ink-muted">Match</ZoruTableHead>
                        </ZoruTableRow>
                    </ZoruTableHeader>
                    <ZoruTableBody>
                        {rows.length === 0 ? (
                            <ZoruTableRow className="border-zoru-line">
                                <ZoruTableCell colSpan={6} className="h-20 text-center text-[13px] text-zoru-ink-muted">
                                    No matches yet.
                                </ZoruTableCell>
                            </ZoruTableRow>
                        ) : (
                            rows.map((m) => {
                                const delta = m.bookItc - m.gstr2bItc;
                                const deltaClass =
                                    Math.abs(delta) < 0.5
                                        ? 'text-zoru-ink'
                                        : 'text-zoru-ink';
                                const href = vendorHref(m.supplierGstin);
                                return (
                                    <ZoruTableRow
                                        key={`${m.supplierGstin}-${m.invoiceNumber}`}
                                        className="border-zoru-line"
                                    >
                                        <ZoruTableCell className="text-[13px] text-zoru-ink">
                                            {href ? (
                                                <EntityRowLink
                                                    href={href}
                                                    label={m.supplierName}
                                                    subtitle={m.supplierGstin}
                                                />
                                            ) : (
                                                <div>
                                                    <div className="font-medium">{m.supplierName}</div>
                                                    <div className="text-[11px] text-zoru-ink-muted">{m.supplierGstin}</div>
                                                </div>
                                            )}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[13px] text-zoru-ink">
                                            {m.invoiceNumber}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right text-[13px] text-zoru-ink">
                                            {fmtMoney(m.bookItc)}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right text-[13px] text-zoru-ink">
                                            {fmtMoney(m.gstr2bItc)}
                                        </ZoruTableCell>
                                        <ZoruTableCell className={`text-right text-[13px] ${deltaClass}`}>
                                            {fmtMoney(delta)}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[12px] uppercase tracking-wide text-zoru-ink-muted">
                                            {m.matchType}
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                );
                            })
                        )}
                    </ZoruTableBody>
                </Table>
            </div>
        </div>
    );
}

/* ─── Mismatched table (with selection + bulk reconcile) ─────────── */

function MismatchedTable({
    onlyInBooks,
    onlyInGstr2b,
    period,
}: {
    onlyInBooks: ItcReconciliationRow[];
    onlyInGstr2b: ItcReconciliationRow[];
    period: string;
}) {
    const router = useRouter();

    // Selection applies only to onlyInBooks rows (those we can reconcile)
    const [selected, setSelected] = React.useState<Set<number>>(new Set());
    const [reconciling, setReconciling] = React.useState(false);
    const [reconcileError, setReconcileError] = React.useState<string | null>(null);
    const [reconcileSuccess, setReconcileSuccess] = React.useState<string | null>(null);

    const allBooks = onlyInBooks.length;
    const allSelected = allBooks > 0 && selected.size === allBooks;
    const someSelected = selected.size > 0 && !allSelected;

    function toggleAll() {
        if (allSelected) {
            setSelected(new Set());
        } else {
            setSelected(new Set(onlyInBooks.map((_, i) => i)));
        }
    }

    function toggleRow(i: number) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(i)) next.delete(i);
            else next.add(i);
            return next;
        });
    }

    async function handleBulkReconcile() {
        const invoices = [...selected].map((i) => ({
            supplierGstin: onlyInBooks[i].supplierGstin,
            invoiceNumber: onlyInBooks[i].invoiceNumber,
        }));
        setReconciling(true);
        setReconcileError(null);
        setReconcileSuccess(null);
        const res = await bulkReconcileMismatched({ invoices, period });
        setReconciling(false);
        if (!res.ok) {
            setReconcileError(res.error);
            return;
        }
        setReconcileSuccess(
            `${res.reconciled} bill${res.reconciled !== 1 ? 's' : ''} marked as manually reconciled.`,
        );
        setSelected(new Set());
        router.refresh();
    }

    function exportAll(format: 'csv' | 'xlsx') {
        const headers = ['Side', 'Supplier', 'GSTIN', 'Invoice #', 'Amount', 'ITC'];
        const data: ExportRow[] = [
            ...onlyInBooks.map((r) => ({
                Side: 'Only in books',
                Supplier: r.supplierName,
                GSTIN: r.supplierGstin ?? '',
                'Invoice #': r.invoiceNumber || '',
                Amount: r.amount,
                ITC: r.itc,
            })),
            ...onlyInGstr2b.map((r) => ({
                Side: 'Only in 2B',
                Supplier: r.supplierName,
                GSTIN: r.supplierGstin ?? '',
                'Invoice #': r.invoiceNumber || '',
                Amount: r.amount,
                ITC: r.itc,
            })),
        ];
        const filename = `itc-mismatched-${period}-${dateStamp()}`;
        if (format === 'csv') {
            downloadCsv(`${filename}.csv`, headers, data);
        } else {
            void downloadXlsx(`${filename}.xlsx`, headers, data, 'Mismatched');
        }
    }

    const hasRows = onlyInBooks.length > 0 || onlyInGstr2b.length > 0;

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <h2 className="text-[15px] font-semibold text-zoru-ink">Mismatched</h2>
                    <p className="text-[12px] text-zoru-ink-muted">
                        Invoices that appear in only one side of the reconciliation.
                    </p>
                </div>
                {hasRows && (
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => exportAll('csv')}>
                            <Download className="h-3.5 w-3.5" />
                            CSV
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => exportAll('xlsx')}>
                            <Download className="h-3.5 w-3.5" />
                            XLSX
                        </Button>
                    </div>
                )}
            </div>

            {/* Bulk action bar */}
            {selected.size > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zoru-line bg-zoru-surface-2/40 px-3 py-2 text-[13px]">
                    <span className="font-medium">{selected.size} row{selected.size !== 1 ? 's' : ''} selected (only-in-books)</span>
                    <Button
                        size="sm"
                        onClick={handleBulkReconcile}
                        disabled={reconciling}
                    >
                        {reconciling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        Mark reconciled
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelected(new Set())}
                        disabled={reconciling}
                    >
                        <X className="h-3.5 w-3.5" />
                        Clear
                    </Button>
                </div>
            )}

            {reconcileError && (
                <p className="text-[12.5px] text-zoru-ink">{reconcileError}</p>
            )}
            {reconcileSuccess && (
                <p className="text-[12.5px] text-zoru-ink">{reconcileSuccess}</p>
            )}

            <div className="overflow-x-auto rounded-lg border border-zoru-line">
                <Table>
                    <ZoruTableHeader>
                        <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                            <ZoruTableHead className="w-8">
                                <Checkbox
                                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                                    onCheckedChange={toggleAll}
                                    aria-label="Select all only-in-books rows"
                                    disabled={allBooks === 0}
                                />
                            </ZoruTableHead>
                            <ZoruTableHead className="text-zoru-ink-muted">Side</ZoruTableHead>
                            <ZoruTableHead className="text-zoru-ink-muted">Supplier</ZoruTableHead>
                            <ZoruTableHead className="text-zoru-ink-muted">Invoice #</ZoruTableHead>
                            <ZoruTableHead className="text-right text-zoru-ink-muted">Amount</ZoruTableHead>
                            <ZoruTableHead className="text-right text-zoru-ink-muted">ITC</ZoruTableHead>
                        </ZoruTableRow>
                    </ZoruTableHeader>
                    <ZoruTableBody>
                        {!hasRows ? (
                            <ZoruTableRow className="border-zoru-line">
                                <ZoruTableCell colSpan={6} className="h-20 text-center text-[13px] text-zoru-ink-muted">
                                    Nothing to chase — books and 2B agree.
                                </ZoruTableCell>
                            </ZoruTableRow>
                        ) : (
                            <>
                                {onlyInBooks.map((r, i) => {
                                    const href = vendorHref(r.supplierGstin);
                                    return (
                                        <ZoruTableRow
                                            key={`books-${i}`}
                                            className={`border-zoru-line ${selected.has(i) ? 'bg-zoru-surface-2/30' : ''}`}
                                        >
                                            <ZoruTableCell>
                                                <Checkbox
                                                    checked={selected.has(i)}
                                                    onCheckedChange={() => toggleRow(i)}
                                                    aria-label={`Select ${r.invoiceNumber}`}
                                                />
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-[12px] font-medium text-zoru-ink">
                                                Only in books
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-[13px] text-zoru-ink">
                                                {href ? (
                                                    <EntityRowLink
                                                        href={href}
                                                        label={r.supplierName}
                                                        subtitle={r.supplierGstin ?? undefined}
                                                    />
                                                ) : (
                                                    <div>
                                                        <div>{r.supplierName}</div>
                                                        <div className="text-[11px] text-zoru-ink-muted">{r.supplierGstin ?? '—'}</div>
                                                    </div>
                                                )}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-[13px] text-zoru-ink">
                                                {r.invoiceNumber || '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right text-[13px] text-zoru-ink">
                                                {fmtMoney(r.amount)}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right text-[13px] text-zoru-ink">
                                                {fmtMoney(r.itc)}
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    );
                                })}
                                {onlyInGstr2b.map((r, i) => {
                                    const href = vendorHref(r.supplierGstin);
                                    return (
                                        <ZoruTableRow key={`gstr2b-${i}`} className="border-zoru-line">
                                            <ZoruTableCell>
                                                {/* GSTR-2B rows are not selectable — cannot reconcile from portal side */}
                                                <span className="inline-block h-4 w-4" />
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-[12px] font-medium text-zoru-ink">
                                                Only in 2B
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-[13px] text-zoru-ink">
                                                {href ? (
                                                    <EntityRowLink
                                                        href={href}
                                                        label={r.supplierName}
                                                        subtitle={r.supplierGstin ?? undefined}
                                                    />
                                                ) : (
                                                    <div>
                                                        <div>{r.supplierName}</div>
                                                        <div className="text-[11px] text-zoru-ink-muted">{r.supplierGstin ?? '—'}</div>
                                                    </div>
                                                )}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-[13px] text-zoru-ink">
                                                {r.invoiceNumber || '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right text-[13px] text-zoru-ink">
                                                {fmtMoney(r.amount)}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right text-[13px] text-zoru-ink">
                                                {fmtMoney(r.itc)}
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    );
                                })}
                            </>
                        )}
                    </ZoruTableBody>
                </Table>
            </div>
        </div>
    );
}

/* ─── Book ITC by supplier table ──────────────────────────────────── */

function BookItcTable({ rows, period }: { rows: BookItcResult['bySupplier']; period: string }) {
    function handleCsv() {
        const headers = ['Supplier', 'GSTIN', 'IGST', 'CGST', 'SGST', 'Cess', '# Bills'];
        const data: ExportRow[] = rows.map((r) => ({
            Supplier: r.supplierName,
            GSTIN: r.gstin ?? '',
            IGST: r.igst,
            CGST: r.cgst,
            SGST: r.sgst,
            Cess: r.cess,
            '# Bills': r.invoiceCount,
        }));
        downloadCsv(`itc-book-${period}-${dateStamp()}.csv`, headers, data);
    }

    async function handleXlsx() {
        const headers = ['Supplier', 'GSTIN', 'IGST', 'CGST', 'SGST', 'Cess', '# Bills'];
        const data: ExportRow[] = rows.map((r) => ({
            Supplier: r.supplierName,
            GSTIN: r.gstin ?? '',
            IGST: r.igst,
            CGST: r.cgst,
            SGST: r.sgst,
            Cess: r.cess,
            '# Bills': r.invoiceCount,
        }));
        await downloadXlsx(
            `itc-book-${period}-${dateStamp()}.xlsx`,
            headers,
            data,
            'Book ITC',
        );
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <h2 className="text-[15px] font-semibold text-zoru-ink">
                        Book ITC by supplier
                    </h2>
                    <p className="text-[12px] text-zoru-ink-muted">
                        Aggregated from approved / paid bills for {period} (excludes RCM).
                    </p>
                </div>
                {rows.length > 0 && (
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={handleCsv}>
                            <Download className="h-3.5 w-3.5" />
                            CSV
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleXlsx}>
                            <Download className="h-3.5 w-3.5" />
                            XLSX
                        </Button>
                    </div>
                )}
            </div>
            <div className="overflow-x-auto rounded-lg border border-zoru-line">
                <Table>
                    <ZoruTableHeader>
                        <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                            <ZoruTableHead className="text-zoru-ink-muted">Supplier</ZoruTableHead>
                            <ZoruTableHead className="text-zoru-ink-muted">GSTIN</ZoruTableHead>
                            <ZoruTableHead className="text-right text-zoru-ink-muted">IGST</ZoruTableHead>
                            <ZoruTableHead className="text-right text-zoru-ink-muted">CGST</ZoruTableHead>
                            <ZoruTableHead className="text-right text-zoru-ink-muted">SGST</ZoruTableHead>
                            <ZoruTableHead className="text-right text-zoru-ink-muted">Cess</ZoruTableHead>
                            <ZoruTableHead className="text-right text-zoru-ink-muted"># Bills</ZoruTableHead>
                        </ZoruTableRow>
                    </ZoruTableHeader>
                    <ZoruTableBody>
                        {rows.map((r, i) => {
                            const href = vendorHref(r.gstin);
                            return (
                                <ZoruTableRow key={i} className="border-zoru-line">
                                    <ZoruTableCell className="text-[13px] text-zoru-ink">
                                        {href ? (
                                            <EntityRowLink
                                                href={href}
                                                label={r.supplierName}
                                            />
                                        ) : (
                                            r.supplierName
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[13px] text-zoru-ink">
                                        {r.gstin ?? '—'}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right text-[13px] text-zoru-ink">
                                        {fmtMoney(r.igst)}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right text-[13px] text-zoru-ink">
                                        {fmtMoney(r.cgst)}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right text-[13px] text-zoru-ink">
                                        {fmtMoney(r.sgst)}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right text-[13px] text-zoru-ink">
                                        {fmtMoney(r.cess)}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right text-[13px] text-zoru-ink">
                                        {r.invoiceCount}
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            );
                        })}
                    </ZoruTableBody>
                </Table>
            </div>
        </div>
    );
}

/* ─── Top-level export ───────────────────────────────────────────── */

interface ItcClientProps {
    recon: ItcReconciliationResult | null;
    bookData: BookItcResult | null;
    period: string;
}

export function ItcClient({ recon, bookData, period }: ItcClientProps) {
    return (
        <div className="flex flex-col gap-4">
            {recon ? (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <MatchedTable rows={recon.matched} period={period} />
                    <MismatchedTable
                        onlyInBooks={recon.onlyInBooks}
                        onlyInGstr2b={recon.onlyInGstr2b}
                        period={period}
                    />
                </div>
            ) : null}

            {bookData && bookData.bySupplier.length > 0 ? (
                <BookItcTable rows={bookData.bySupplier} period={period} />
            ) : null}
        </div>
    );
}
