import { ZoruBadge, ZoruButton, ZoruCard, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import { Plus } from 'lucide-react';

/**
 * E-way bills list — `/dashboard/crm/tax/eway-bills`.
 *
 * Server component. KPI strip (Active · Expired · Cancelled) + a simple
 * table with per-row actions. Mutations live in `<EWayBillRowActions>`.
 */

import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { listEWayBills } from '@/app/actions/crm-india-eway.actions';
import { EWayBillRowActions } from './_components/row-actions';

export const dynamic = 'force-dynamic';

function statusVariant(s: string): 'success' | 'danger' | 'warning' {
    if (s === 'cancelled') return 'danger';
    if (s === 'expired') return 'warning';
    return 'success';
}

function fmtMoney(n: number) {
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

function fmtDate(iso: string) {
    try {
        return new Date(iso).toISOString().slice(0, 10);
    } catch {
        return iso;
    }
}

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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Kpi label="Active" value={counts.active} variant="success" />
                <Kpi label="Expired" value={counts.expired} variant="warning" />
                <Kpi label="Cancelled" value={counts.cancelled} variant="danger" />
            </div>

            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>All e-way bills</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    {bills.length === 0 ? (
                        <p className="text-[13px] text-muted-foreground">
                            No e-way bills yet. Generate one for a consignment greater than
                            ₹50,000.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-[13px]">
                                <thead>
                                    <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                                        <th className="px-2 py-2">EWB No</th>
                                        <th className="px-2 py-2">From → To</th>
                                        <th className="px-2 py-2">Value</th>
                                        <th className="px-2 py-2">Vehicle</th>
                                        <th className="px-2 py-2">Valid till</th>
                                        <th className="px-2 py-2">Status</th>
                                        <th className="px-2 py-2 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bills.map((b) => (
                                        <tr key={b._id} className="border-b border-border/60">
                                            <td className="px-2 py-2 font-mono text-[12px]">
                                                <EntityRowLink
                                                    href={`/dashboard/crm/tax/eway-bills/${b._id}`}
                                                    label={b.ewbNo}
                                                    subtitle={`${b.fromGstin} → ${b.toGstin ?? 'URP'}`}
                                                />
                                            </td>
                                            <td className="px-2 py-2">
                                                <span className="font-mono text-[11px]">
                                                    {b.fromGstin}
                                                </span>
                                                {' → '}
                                                <span className="font-mono text-[11px]">
                                                    {b.toGstin ?? 'URP'}
                                                </span>
                                            </td>
                                            <td className="px-2 py-2">{fmtMoney(b.totalValue)}</td>
                                            <td className="px-2 py-2 font-mono text-[12px]">
                                                {b.vehicleNumber ?? '—'}
                                            </td>
                                            <td className="px-2 py-2">{fmtDate(b.validUpto)}</td>
                                            <td className="px-2 py-2">
                                                <ZoruBadge variant={statusVariant(b.status)}>
                                                    {b.status}
                                                </ZoruBadge>
                                            </td>
                                            <td className="px-2 py-2">
                                                <EWayBillRowActions
                                                    id={b._id}
                                                    status={b.status}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
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
