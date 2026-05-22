import { Card } from '@/components/zoruui';
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
import { ItcClient } from './_components/itc-client';

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
            {/* KPI strip */}
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

            {/* Import prompt */}
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

            {/* Three-table client shell (selection, bulk reconcile, export per section) */}
            <ItcClient
                recon={recon}
                bookData={bookRes.ok ? bookRes.data : null}
                period={period}
            />
        </EntityListShell>
    );
}
