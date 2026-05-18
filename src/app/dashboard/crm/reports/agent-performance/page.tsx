import { ZoruCard, ZoruTable, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow } from '@/components/zoruui';
import {
  UserCog } from 'lucide-react';

export const dynamic = 'force-dynamic';

import { CrmPageHeader } from '../../_components/crm-page-header';
import {
  ReportToolbar,
  StatCard,
  fmtMinutes,
} from '../_components/report-toolbar';
import { getAgentPerformance } from '@/app/actions/worksuite/reports.actions';

export default async function AgentPerformancePage(props: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await props.searchParams;
  const rows = await getAgentPerformance(sp.from, sp.to);

  const totalTickets = rows.reduce((s, r) => s + r.total, 0);
  const totalResolved = rows.reduce((s, r) => s + r.resolved, 0);
  const avgRes = rows.length
    ? Math.round(
        rows.reduce((s, r) => s + r.avgResolutionMinutes * r.resolved, 0) /
          Math.max(1, totalResolved),
      )
    : 0;

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Agent Performance"
        subtitle="Per-agent tickets closed and average resolution."
        icon={UserCog}
        actions={<ReportToolbar from={sp.from} to={sp.to} />}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Tickets" value={String(totalTickets)} />
        <StatCard label="Resolved" value={String(totalResolved)} tone="green" />
        <StatCard label="Avg resolution" value={fmtMinutes(avgRes)} tone="blue" />
      </div>

      <ZoruCard className="p-6">
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">Agent</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">
                  Total
                </ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">
                  Resolved
                </ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">
                  Resolution rate
                </ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">
                  Avg resolution
                </ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {rows.length === 0 ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={5}
                    className="h-20 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No tickets in this range.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                rows.map((r) => {
                  const rate = r.total ? (r.resolved / r.total) * 100 : 0;
                  return (
                    <ZoruTableRow key={r.agent} className="border-zoru-line">
                      <ZoruTableCell className="font-medium text-zoru-ink">
                        {r.agent}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right text-[13px] text-zoru-ink">
                        {r.total}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right text-[13px] text-zoru-success-ink">
                        {r.resolved}
                      </ZoruTableCell>
                      <ZoruTableCell
                        className={`text-right text-[13px] ${
                          rate >= 70 ? 'text-zoru-success-ink' : 'text-zoru-warning-ink'
                        }`}
                      >
                        {rate.toFixed(0)}%
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right text-[13px] text-zoru-info-ink">
                        {fmtMinutes(r.avgResolutionMinutes)}
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>
    </div>
  );
}
