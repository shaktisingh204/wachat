import { ZoruBadge, ZoruButton, ZoruCard, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import { Plus } from 'lucide-react';

/**
 * E-way bills list — `/dashboard/crm/tax/eway-bills`.
 *
 * Server component. KPI strip (Active · Expired · Cancelled) + a client
 * shell that provides:
 *   - Filter row (search, status, date range)
 *   - ZoruCheckbox row selection
 *   - Bulk cancel with confirm dialog
 *   - Export CSV / XLSX
 *   - Per-row actions (delegated to <EWayBillRowActions>)
 */

import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { listEWayBills } from '@/app/actions/crm-india-eway.actions';
import { EWayBillsClient } from './_components/eway-bills-client';

export const dynamic = 'force-dynamic';

export default async function EWayBillsPage() {
    const bills = await listEWayBills();

    const counts = {
        active: bills.filter((b) => b.status === 'active').length,
        expired: bills.filter((b) => b.status === 'expired').length,
        cancelled: bills.filter((b) => b.status === 'cancelled').length,
    };

    return (
        <EntityListShell
            title="E-way bills"
            subtitle="Generate, cancel, extend and update e-way bills for goods movement."
            primaryAction={
                <ZoruButton asChild>
                    <Link href="/dashboard/crm/tax/eway-bills/new">
                        <Plus className="h-4 w-4" />
                        Generate e-way bill
                    </Link>
                </ZoruButton>
            }
        >
            {/* KPI strip */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Kpi label="Active" value={counts.active} variant="success" />
                <Kpi label="Expired" value={counts.expired} variant="warning" />
                <Kpi label="Cancelled" value={counts.cancelled} variant="danger" />
            </div>

            {/* Table card — delegated to client for filter + selection + export */}
            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>All e-way bills</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <EWayBillsClient bills={bills} />
                </ZoruCardContent>
            </ZoruCard>
        </EntityListShell>
    );
}

function Kpi({
    label,
    value,
    variant,
}: {
    label: string;
    value: number;
    variant: 'success' | 'warning' | 'danger';
}) {
    return (
        <ZoruCard>
            <ZoruCardContent className="flex items-center justify-between py-4">
                <div className="flex flex-col gap-1">
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {label}
                    </span>
                    <span className="text-2xl font-semibold">{value}</span>
                </div>
                <ZoruBadge variant={variant}>{label}</ZoruBadge>
            </ZoruCardContent>
        </ZoruCard>
    );
}
