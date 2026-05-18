import { ZoruCard, ZoruTable, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow } from '@/components/zoruui';
export const dynamic = 'force-dynamic';

import { Banknote, CheckCircle2, AlertTriangle } from 'lucide-react';

import { CrmPageHeader } from '../../_components/crm-page-header';
import { fmtMoney } from '../../reports/_components/report-toolbar';
import {
    getTds194qStatus,
    getTds194qVendorTracker,
} from '@/app/actions/crm-india-tds194q.actions';
import { RecordDeductionButton } from './_components/record-deduction-button';

function currentFy(): string {
    const d = new Date();
    const startYear = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
    return `${startYear}-${(startYear + 1).toString().slice(-2)}`;
}

function FyForm({ fy }: { fy: string }) {
    return (
        <form
            method="get"
            className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card px-3 py-2"
        >
            <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Financial Year (YYYY-YY)
                </span>
                <input
                    type="text"
                    name="fy"
                    defaultValue={fy}
                    pattern="\d{4}-\d{2}"
                    placeholder="2026-27"
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

function ThresholdBar({ value, max }: { value: number; max: number }) {
    const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
    const tone =
        pct >= 100 ? 'bg-emerald-500' : pct >= 75 ? 'bg-amber-500' : 'bg-sky-500';
    return (
        <div className="flex flex-col gap-1 min-w-[140px]">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[10.5px] text-muted-foreground">
                {pct}% of ₹50L
            </span>
        </div>
    );
}

function StatusPill({ status }: { status: string }) {
    const map: Record<string, { label: string; cls: string }> = {
        threshold_not_crossed: {
            label: 'Below threshold',
            cls: 'bg-secondary text-foreground',
        },
        deduct_on_next_bill: {
            label: 'Deduct on next bill',
            cls: 'bg-amber-500/15 text-amber-500',
        },
        deducted: {
            label: 'Deducted',
            cls: 'bg-emerald-500/15 text-emerald-500',
        },
    };
    const c = map[status] ?? { label: status, cls: 'bg-secondary text-foreground' };
    return (
        <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${c.cls}`}
        >
            {c.label}
        </span>
    );
}

export default async function Tds194qPage(props: {
    searchParams: Promise<{ fy?: string }>;
}) {
    const sp = await props.searchParams;
    const fy = sp.fy && /^\d{4}-\d{2}$/.test(sp.fy) ? sp.fy : currentFy();

    const [statusRes, trackerRes] = await Promise.all([
        getTds194qStatus(fy),
        getTds194qVendorTracker(fy),
    ]);

    const status = statusRes.ok ? statusRes.data : null;
    const tracker = trackerRes.ok ? trackerRes.data : null;
    const applicable = status?.applicable === true;

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="TDS u/s 194Q tracker"
                subtitle="0.1% TDS on purchases above ₹50 lakh per seller (when buyer's prior-FY turnover > ₹10 cr)."
                icon={Banknote}
                actions={<FyForm fy={fy} />}
            />

            <ZoruCard>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                        {applicable ? (
                            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" />
                        ) : (
                            <AlertTriangle className="mt-0.5 h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                            <h2 className="text-[15px] font-semibold text-foreground">
                                {applicable
                                    ? `§194Q applies for FY ${fy}`
                                    : `§194Q does not apply for FY ${fy}`}
                            </h2>
                            <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">
                                {statusRes.ok
                                    ? statusRes.data.reason
                                    : statusRes.error}
                            </p>
                        </div>
                    </div>
                    {status ? (
                        <div className="grid grid-cols-2 gap-3 text-right">
                            <div>
                                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                    Prior FY turnover
                                </div>
                                <div className="text-[15px] font-semibold text-foreground">
                                    {fmtMoney(status.priorYearTurnover)}
                                </div>
                            </div>
                            <div>
                                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                    Threshold
                                </div>
                                <div className="text-[15px] font-semibold text-foreground">
                                    {fmtMoney(status.threshold)}
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>
            </ZoruCard>

            <ZoruCard>
                <div className="mb-3">
                    <h2 className="text-[15px] font-semibold text-foreground">
                        Vendor tracker
                    </h2>
                    <p className="text-[12px] text-muted-foreground">
                        YTD purchases per vendor against the ₹50 lakh per-seller threshold.
                    </p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-border hover:bg-transparent">
                                <ZoruTableHead className="text-muted-foreground">Vendor</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">GSTIN</ZoruTableHead>
                                <ZoruTableHead className="text-right text-muted-foreground">YTD purchases</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Threshold</ZoruTableHead>
                                <ZoruTableHead className="text-right text-muted-foreground">Deductible</ZoruTableHead>
                                <ZoruTableHead className="text-right text-muted-foreground">TDS to deduct</ZoruTableHead>
                                <ZoruTableHead className="text-right text-muted-foreground">TDS deducted</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Status</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Action</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {!tracker || tracker.byVendor.length === 0 ? (
                                <ZoruTableRow className="border-border">
                                    <ZoruTableCell colSpan={9} className="h-24 text-center text-[13px] text-muted-foreground">
                                        {trackerRes.ok
                                            ? 'No vendor purchases recorded for this FY.'
                                            : trackerRes.error}
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                tracker.byVendor.map((row) => {
                                    const remaining = Math.max(0, row.tdsToDeduct - row.tdsDeducted);
                                    return (
                                        <ZoruTableRow key={row.vendorId} className="border-border">
                                            <ZoruTableCell className="text-[13px] font-medium text-foreground">
                                                {row.vendorName}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-[12.5px] text-muted-foreground">
                                                {row.gstin ?? '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right text-[13px] text-foreground">
                                                {fmtMoney(row.totalPurchases)}
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                <ThresholdBar value={row.totalPurchases} max={5_000_000} />
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right text-[13px] text-foreground">
                                                {fmtMoney(row.deductibleAmount)}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right text-[13px] text-foreground">
                                                {fmtMoney(row.tdsToDeduct)}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right text-[13px] text-foreground">
                                                {fmtMoney(row.tdsDeducted)}
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                <StatusPill status={row.status} />
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                <RecordDeductionButton
                                                    suggestedAmount={remaining}
                                                    vendorName={row.vendorName}
                                                />
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    );
                                })
                            )}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
                {applicable ? null : (
                    <p className="mt-3 text-[12px] text-muted-foreground">
                        §194Q does not apply for this FY — the tracker is shown for
                        informational purposes only.
                    </p>
                )}
            </ZoruCard>
        </div>
    );
}
