import { ZoruCard } from '@/components/zoruui';
export const dynamic = 'force-dynamic';

import { CheckCircle2, AlertTriangle } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { fmtMoney } from '../../reports/_components/report-toolbar';
import {
    getTds194qStatus,
    getTds194qVendorTracker,
} from '@/app/actions/crm-india-tds194q.actions';
import { Tds194qClient } from './_components/tds-194q-client';

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
        <EntityListShell
            title="TDS u/s 194Q tracker"
            subtitle="0.1% TDS on purchases above ₹50 lakh per seller (when buyer's prior-FY turnover > ₹10 cr)."
            primaryAction={<FyForm fy={fy} />}
        >
            {/* Applicability card */}
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

            {/* Vendor tracker — client shell for selection, export, bulk deduction */}
            <ZoruCard>
                <div className="mb-3">
                    <h2 className="text-[15px] font-semibold text-foreground">
                        Vendor tracker
                    </h2>
                    <p className="text-[12px] text-muted-foreground">
                        YTD purchases per vendor against the ₹50 lakh per-seller threshold.
                    </p>
                </div>
                <Tds194qClient
                    rows={tracker?.byVendor ?? []}
                    fy={fy}
                    applicable={applicable}
                />
                {!trackerRes.ok && (
                    <p className="mt-3 text-[12.5px] text-destructive">{trackerRes.error}</p>
                )}
            </ZoruCard>
        </EntityListShell>
    );
}
