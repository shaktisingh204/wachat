import { ZoruCard, ZoruTable, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow } from '@/components/zoruui';
export const dynamic = 'force-dynamic';

import { FileDown } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
    StatCard,
    fmtMoney,
} from '../../reports/_components/report-toolbar';
import {
    getBookItc,
    getItcReconciliation,
} from '@/app/actions/crm-india-itc.actions';

function currentPeriod(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function PeriodForm({ period }: { period: string }) {
    return (
        <form
            method="get"
            className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card px-3 py-2"
        >
            <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Period (YYYY-MM)
                </span>
                <input
                    type="month"
                    name="period"
                    defaultValue={period}
                    className="h-9 rounded-lg border border-border bg-card px-2 text-[13px] text-foreground"
                />
            </label>
            <button
                type="submit"
                className="h-9 rounded-lg bg-primary px-3 text-[13px] font-medium text-primary-foreground hover:opacity-90"
            >
                Apply
            </button>
        </form>
    );
}

export default async function ItcReconciliationPage(props: {
    searchParams: Promise<{ period?: string }>;
}) {
    const sp = await props.searchParams;
    const period = sp.period && /^\d{4}-\d{2}$/.test(sp.period) ? sp.period : currentPeriod();

    const [bookRes, reconRes] = await Promise.all([
        getBookItc(period),
        getItcReconciliation(period),
    ]);

    const totalBookItc = bookRes.ok
        ? bookRes.data.bySupplier.reduce(
              (s, r) => s + r.igst + r.cgst + r.sgst + r.cess,
              0,
          )
        : 0;
    const recon = reconRes.ok ? reconRes.data : null;
    const needsImport = !reconRes.ok && 'needsImport' in reconRes && reconRes.needsImport;

    return (
        <EntityListShell
            title="ITC Reconciliation"
            subtitle="Books vs GSTR-2B — claimable Input Tax Credit per supplier."
            primaryAction={<PeriodForm period={period} />}
        >

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <StatCard
                    label="Total book ITC"
                    value={fmtMoney(totalBookItc)}
                    tone="blue"
                    hint="From approved / paid bills"
                />
                <StatCard
                    label="Total GSTR-2B ITC"
                    value={fmtMoney(recon?.summary.totalGstr2bItc ?? 0)}
                    tone="default"
                    hint={needsImport ? 'Import GSTR-2B first' : 'From portal snapshot'}
                />
                <StatCard
                    label="Matched ITC"
                    value={fmtMoney(recon?.summary.totalMatched ?? 0)}
                    tone="green"
                    hint={recon ? `${recon.matched.length} invoices` : ''}
                />
                <StatCard
                    label="Only in books"
                    value={fmtMoney(recon?.summary.totalOnlyInBooks ?? 0)}
                    tone="amber"
                    hint={recon ? `${recon.onlyInBooks.length} invoices` : ''}
                />
                <StatCard
                    label="Only in GSTR-2B"
                    value={fmtMoney(recon?.summary.totalOnlyInGstr2b ?? 0)}
                    tone="red"
                    hint={recon ? `${recon.onlyInGstr2b.length} invoices` : ''}
                />
            </div>

            {needsImport ? (
                <ZoruCard>
                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-[15px] font-semibold text-foreground">
                                GSTR-2B import required
                            </h2>
                            <p className="mt-1 text-[13px] text-muted-foreground">
                                No GSTR-2B snapshot has been imported for{' '}
                                <span className="font-medium text-foreground">{period}</span>{' '}
                                yet. Reconciliation is unavailable until you upload one.
                            </p>
                        </div>
                        <a
                            href="/dashboard/crm/tax/gstr2b"
                            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-[13px] font-medium text-primary-foreground hover:opacity-90"
                        >
                            <FileDown className="h-4 w-4" />
                            Import GSTR-2B
                        </a>
                    </div>
                </ZoruCard>
            ) : !reconRes.ok ? (
                <ZoruCard>
                    <p className="text-[13px] text-destructive">{reconRes.error}</p>
                </ZoruCard>
            ) : null}

            {recon ? (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <ZoruCard>
                        <div className="mb-3">
                            <h2 className="text-[15px] font-semibold text-foreground">
                                Matched ({recon.matched.length})
                            </h2>
                            <p className="text-[12px] text-muted-foreground">
                                Bills aligned with GSTR-2B; mismatched ITC delta highlighted.
                            </p>
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-border">
                            <ZoruTable>
                                <ZoruTableHeader>
                                    <ZoruTableRow className="border-border hover:bg-transparent">
                                        <ZoruTableHead className="text-muted-foreground">Supplier</ZoruTableHead>
                                        <ZoruTableHead className="text-muted-foreground">Invoice #</ZoruTableHead>
                                        <ZoruTableHead className="text-right text-muted-foreground">Book ITC</ZoruTableHead>
                                        <ZoruTableHead className="text-right text-muted-foreground">2B ITC</ZoruTableHead>
                                        <ZoruTableHead className="text-right text-muted-foreground">Δ</ZoruTableHead>
                                        <ZoruTableHead className="text-muted-foreground">Match</ZoruTableHead>
                                    </ZoruTableRow>
                                </ZoruTableHeader>
                                <ZoruTableBody>
                                    {recon.matched.length === 0 ? (
                                        <ZoruTableRow className="border-border">
                                            <ZoruTableCell colSpan={6} className="h-20 text-center text-[13px] text-muted-foreground">
                                                No matches yet.
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    ) : (
                                        recon.matched.map((m) => {
                                            const delta = m.bookItc - m.gstr2bItc;
                                            const deltaClass =
                                                Math.abs(delta) < 0.5
                                                    ? 'text-emerald-500'
                                                    : 'text-amber-500';
                                            return (
                                                <ZoruTableRow
                                                    key={`${m.supplierGstin}-${m.invoiceNumber}`}
                                                    className="border-border"
                                                >
                                                    <ZoruTableCell className="text-[13px] text-foreground">
                                                        <div className="font-medium">{m.supplierName}</div>
                                                        <div className="text-[11px] text-muted-foreground">{m.supplierGstin}</div>
                                                    </ZoruTableCell>
                                                    <ZoruTableCell className="text-[13px] text-foreground">
                                                        {m.invoiceNumber}
                                                    </ZoruTableCell>
                                                    <ZoruTableCell className="text-right text-[13px] text-foreground">
                                                        {fmtMoney(m.bookItc)}
                                                    </ZoruTableCell>
                                                    <ZoruTableCell className="text-right text-[13px] text-foreground">
                                                        {fmtMoney(m.gstr2bItc)}
                                                    </ZoruTableCell>
                                                    <ZoruTableCell className={`text-right text-[13px] ${deltaClass}`}>
                                                        {fmtMoney(delta)}
                                                    </ZoruTableCell>
                                                    <ZoruTableCell className="text-[12px] uppercase tracking-wide text-muted-foreground">
                                                        {m.matchType}
                                                    </ZoruTableCell>
                                                </ZoruTableRow>
                                            );
                                        })
                                    )}
                                </ZoruTableBody>
                            </ZoruTable>
                        </div>
                    </ZoruCard>

                    <ZoruCard>
                        <div className="mb-3">
                            <h2 className="text-[15px] font-semibold text-foreground">
                                Mismatched
                            </h2>
                            <p className="text-[12px] text-muted-foreground">
                                Invoices that appear in only one side of the reconciliation.
                            </p>
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-border">
                            <ZoruTable>
                                <ZoruTableHeader>
                                    <ZoruTableRow className="border-border hover:bg-transparent">
                                        <ZoruTableHead className="text-muted-foreground">Side</ZoruTableHead>
                                        <ZoruTableHead className="text-muted-foreground">Supplier</ZoruTableHead>
                                        <ZoruTableHead className="text-muted-foreground">Invoice #</ZoruTableHead>
                                        <ZoruTableHead className="text-right text-muted-foreground">Amount</ZoruTableHead>
                                        <ZoruTableHead className="text-right text-muted-foreground">ITC</ZoruTableHead>
                                    </ZoruTableRow>
                                </ZoruTableHeader>
                                <ZoruTableBody>
                                    {recon.onlyInBooks.length === 0 && recon.onlyInGstr2b.length === 0 ? (
                                        <ZoruTableRow className="border-border">
                                            <ZoruTableCell colSpan={5} className="h-20 text-center text-[13px] text-muted-foreground">
                                                Nothing to chase — books and 2B agree.
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    ) : (
                                        <>
                                            {recon.onlyInBooks.map((r, i) => (
                                                <ZoruTableRow key={`books-${i}`} className="border-border">
                                                    <ZoruTableCell className="text-[12px] font-medium text-amber-500">
                                                        Only in books
                                                    </ZoruTableCell>
                                                    <ZoruTableCell className="text-[13px] text-foreground">
                                                        <div>{r.supplierName}</div>
                                                        <div className="text-[11px] text-muted-foreground">{r.supplierGstin ?? '—'}</div>
                                                    </ZoruTableCell>
                                                    <ZoruTableCell className="text-[13px] text-foreground">{r.invoiceNumber || '—'}</ZoruTableCell>
                                                    <ZoruTableCell className="text-right text-[13px] text-foreground">
                                                        {fmtMoney(r.amount)}
                                                    </ZoruTableCell>
                                                    <ZoruTableCell className="text-right text-[13px] text-foreground">
                                                        {fmtMoney(r.itc)}
                                                    </ZoruTableCell>
                                                </ZoruTableRow>
                                            ))}
                                            {recon.onlyInGstr2b.map((r, i) => (
                                                <ZoruTableRow key={`gstr2b-${i}`} className="border-border">
                                                    <ZoruTableCell className="text-[12px] font-medium text-destructive">
                                                        Only in 2B
                                                    </ZoruTableCell>
                                                    <ZoruTableCell className="text-[13px] text-foreground">
                                                        <div>{r.supplierName}</div>
                                                        <div className="text-[11px] text-muted-foreground">{r.supplierGstin ?? '—'}</div>
                                                    </ZoruTableCell>
                                                    <ZoruTableCell className="text-[13px] text-foreground">{r.invoiceNumber || '—'}</ZoruTableCell>
                                                    <ZoruTableCell className="text-right text-[13px] text-foreground">
                                                        {fmtMoney(r.amount)}
                                                    </ZoruTableCell>
                                                    <ZoruTableCell className="text-right text-[13px] text-foreground">
                                                        {fmtMoney(r.itc)}
                                                    </ZoruTableCell>
                                                </ZoruTableRow>
                                            ))}
                                        </>
                                    )}
                                </ZoruTableBody>
                            </ZoruTable>
                        </div>
                    </ZoruCard>
                </div>
            ) : null}

            {bookRes.ok && bookRes.data.bySupplier.length > 0 ? (
                <ZoruCard>
                    <div className="mb-3">
                        <h2 className="text-[15px] font-semibold text-foreground">
                            Book ITC by supplier
                        </h2>
                        <p className="text-[12px] text-muted-foreground">
                            Aggregated from approved / paid bills for {period} (excludes RCM).
                        </p>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-border">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-border hover:bg-transparent">
                                    <ZoruTableHead className="text-muted-foreground">Supplier</ZoruTableHead>
                                    <ZoruTableHead className="text-muted-foreground">GSTIN</ZoruTableHead>
                                    <ZoruTableHead className="text-right text-muted-foreground">IGST</ZoruTableHead>
                                    <ZoruTableHead className="text-right text-muted-foreground">CGST</ZoruTableHead>
                                    <ZoruTableHead className="text-right text-muted-foreground">SGST</ZoruTableHead>
                                    <ZoruTableHead className="text-right text-muted-foreground">Cess</ZoruTableHead>
                                    <ZoruTableHead className="text-right text-muted-foreground"># Bills</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {bookRes.data.bySupplier.map((r, i) => (
                                    <ZoruTableRow key={i} className="border-border">
                                        <ZoruTableCell className="text-[13px] text-foreground">
                                            {r.supplierName}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[13px] text-foreground">
                                            {r.gstin ?? '—'}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right text-[13px] text-foreground">{fmtMoney(r.igst)}</ZoruTableCell>
                                        <ZoruTableCell className="text-right text-[13px] text-foreground">{fmtMoney(r.cgst)}</ZoruTableCell>
                                        <ZoruTableCell className="text-right text-[13px] text-foreground">{fmtMoney(r.sgst)}</ZoruTableCell>
                                        <ZoruTableCell className="text-right text-[13px] text-foreground">{fmtMoney(r.cess)}</ZoruTableCell>
                                        <ZoruTableCell className="text-right text-[13px] text-foreground">{r.invoiceCount}</ZoruTableCell>
                                    </ZoruTableRow>
                                ))}
                            </ZoruTableBody>
                        </ZoruTable>
                    </div>
                </ZoruCard>
            ) : null}
        </EntityListShell>
    );
}
