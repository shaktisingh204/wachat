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

import { StatCard } from '@/components/sabcrm/20ui';
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
                    <StatCard label="Deals open" value={openDeals} icon={Handshake} />
                    <StatCard label="Won this month" value={formatCurrency(wonThisMonth)} icon={Trophy} />
                    <StatCard label="Contacts added" value={contactsThisMonth} icon={ContactIcon} />
                    <StatCard label="Activities completed" value={activitiesCompleted} icon={CalendarCheck} />
                </div>
            </div>
        </EntityListShell>
    );
}
