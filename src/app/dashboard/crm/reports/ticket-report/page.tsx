export const dynamic = 'force-dynamic';

import { Ticket } from 'lucide-react';
import { ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import {
  ReportToolbar,
  StatCard,
  BarRow,
  fmtMinutes,
} from '../_components/report-toolbar';
import { getTicketMetrics } from '@/app/actions/worksuite/reports.actions';

export default async function TicketReportPage(props: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await props.searchParams;
  const m = await getTicketMetrics(sp.from, sp.to);

  const maxStatus = m.byStatus.reduce((x, r) => Math.max(x, r.count), 0);
  const maxChannel = m.byChannel.reduce((x, r) => Math.max(x, r.count), 0);
  const maxAgent = m.byAgent.reduce((x, r) => Math.max(x, r.count), 0);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Ticket Report"
        subtitle="Tickets by status, channel, agent with SLA metrics."
        icon={Ticket}
        actions={<ReportToolbar from={sp.from} to={sp.to} />}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ClayCard>
          <div className="mb-3">
            <h2 className="text-[16px] font-semibold text-foreground">
              By status
            </h2>
          </div>
          {m.byStatus.length === 0 ? (
            <div className="py-6 text-center text-[13px] text-muted-foreground">
              No tickets.
            </div>
          ) : (
            m.byStatus.map((r) => (
              <BarRow
                key={r.status}
                label={r.status}
                value={r.count}
                max={maxStatus}
                rightLabel={String(r.count)}
                tone="obsidian"
              />
            ))
          )}
        </ClayCard>

        <ClayCard>
          <div className="mb-3">
            <h2 className="text-[16px] font-semibold text-foreground">
              By channel
            </h2>
          </div>
          {m.byChannel.map((r) => (
            <BarRow
              key={r.channel}
              label={r.channel}
              value={r.count}
              max={maxChannel}
              rightLabel={String(r.count)}
              tone="blue"
            />
          ))}
        </ClayCard>

        <ClayCard>
          <div className="mb-3">
            <h2 className="text-[16px] font-semibold text-foreground">
              By agent
            </h2>
          </div>
          {m.byAgent.map((r) => (
            <BarRow
              key={r.agent}
              label={r.agent}
              value={r.count}
              max={maxAgent}
              rightLabel={String(r.count)}
              tone="rose"
            />
          ))}
        </ClayCard>
      </div>
    </div>
  );
}
