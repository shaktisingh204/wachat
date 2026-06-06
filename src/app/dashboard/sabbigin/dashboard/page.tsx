/**
 * SabBigin dashboard — single-tile KPI page.
 *
 *   • Deals open
 *   • Won this month (value sum)
 *   • Contacts added this month
 *   • Activities completed this month
 *
 * All counts are tenant-scoped via `sabbiginCount` / `sabbiginSum`.
 */

import {
    CalendarCheck,
    Contact as ContactIcon,
    Handshake,
    Trophy,
} from 'lucide-react';

import { Card } from '@/components/sabcrm/20ui/compat';
import { EntityListShell } from '@/components/crm/entity-list-shell';

import {
    sabbiginCount,
    sabbiginSum,
    formatCurrency,
    startOfMonth,
} from '../_components/sabbigin-data';
import { SabbiginNav } from '../_components/sabbigin-shell';

export const dynamic = 'force-dynamic';

export default async function SabbiginDashboardPage() {
    const monthStart = startOfMonth();

    const [openDeals, wonThisMonth, contactsThisMonth, activitiesCompleted] =
        await Promise.all([
            sabbiginCount('crm_deals', { status: { $nin: ['won', 'lost'] } }),
            sabbiginSum('crm_deals', 'value', {
                stage: { $regex: /won/i },
                updatedAt: { $gte: monthStart },
            }),
            sabbiginCount('crm_contacts', { createdAt: { $gte: monthStart } }),
            sabbiginCount('crm_activities', {
                status: 'completed',
                updatedAt: { $gte: monthStart },
            }),
        ]);

    return (
        <EntityListShell
            title="Dashboard"
            subtitle="This month at a glance."
        >
            <div className="flex flex-col gap-4">
                <SabbiginNav active="/dashboard/sabbigin/dashboard" />

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Tile label="Deals open" value={openDeals} icon={Handshake} />
                    <Tile label="Won this month" value={formatCurrency(wonThisMonth)} icon={Trophy} />
                    <Tile label="Contacts added" value={contactsThisMonth} icon={ContactIcon} />
                    <Tile label="Activities completed" value={activitiesCompleted} icon={CalendarCheck} />
                </div>
            </div>
        </EntityListShell>
    );
}

function Tile({
    label,
    value,
    icon: Icon,
}: {
    label: string;
    value: number | string;
    icon: React.ElementType;
}) {
    return (
        <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
                <p className="text-[12px] font-medium uppercase tracking-wide text-[var(--st-text-tertiary)]">{label}</p>
                <span className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] text-[var(--st-text)]">
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
            </div>
            <p className="mt-3 text-[24px] font-semibold leading-none tracking-tight text-[var(--st-text)]">{value}</p>
        </Card>
    );
}
