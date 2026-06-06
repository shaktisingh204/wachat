export const dynamic = 'force-dynamic';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
    ReportToolbar,
    StatCard,
    fmtMinutes,
} from '../_components/report-toolbar';
import {
    getTicketMetrics,
    listTicketReportRows,
} from '@/app/actions/worksuite/reports.actions';
import { TicketReportClient } from './_components/ticket-report-client';
import { TicketFilters } from './_components/ticket-filters';

/**
 * Ticket Report - server page.
 *
 * Aggregates ticket metrics + a paged ticket list for the table, then
 * delegates rendering of the charts/table/export controls to the
 * `TicketReportClient`. Tenant scoping happens inside the actions
 * (`requireSession`).
 */
export default async function TicketReportPage(props: {
    searchParams: Promise<{
        from?: string;
        to?: string;
        priority?: string;
        channel?: string;
        status?: string;
        page?: string;
        limit?: string;
    }>;
}) {
    const sp = await props.searchParams;
    const page = Math.max(1, Number(sp.page ?? 1));
    const limit = Math.min(Math.max(1, Number(sp.limit ?? 20)), 100);

    const filters = {
        priority: sp.priority || undefined,
        channel: sp.channel || undefined,
        status: sp.status || undefined,
    };

    const [m, list] = await Promise.all([
        getTicketMetrics(sp.from, sp.to, filters),
        listTicketReportRows(sp.from, sp.to, filters, page, limit),
    ]);

    const topPriority = m.byPriority[0]?.priority ?? '-';
    const topPriorityCount = m.byPriority[0]?.count ?? 0;

    return (
        <EntityListShell
            title="Ticket Report"
            subtitle="Tickets opened vs closed, SLA timings, priority breakdown and per-agent volume."
            primaryAction={
                <ReportToolbar
                    from={sp.from}
                    to={sp.to}
                    extra={
                        <TicketFilters
                            priority={sp.priority}
                            channel={sp.channel}
                            status={sp.status}
                        />
                    }
                />
            }
        >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Total tickets" value={String(m.total)} />
                <StatCard label="Open" value={String(m.open)} tone="amber" />
                <StatCard
                    label="Avg first response"
                    value={fmtMinutes(m.avgFirstResponseMinutes)}
                    tone="blue"
                />
                <StatCard
                    label="Avg resolution"
                    value={fmtMinutes(m.avgResolutionMinutes)}
                    tone="green"
                />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    label="Top priority"
                    value={topPriority}
                    hint={`${topPriorityCount} tickets`}
                />
                <StatCard label="Resolved" value={String(m.resolved)} tone="green" />
                <StatCard
                    label="Channels in use"
                    value={String(m.byChannel.length)}
                />
                <StatCard
                    label="Agents handling"
                    value={String(m.byAgent.length)}
                />
            </div>

            <TicketReportClient
                metrics={m}
                rows={list.rows}
                total={list.total}
                page={page}
                limit={limit}
            />
        </EntityListShell>
    );
}
