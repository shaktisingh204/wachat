export const dynamic = 'force-dynamic';

import { UserCog } from 'lucide-react';
import { ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import {
  ReportToolbar,
  StatCard,
  fmtMinutes,
} from '../_components/report-toolbar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

      <ClayCard>
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Agent</TableHead>
                <TableHead className="text-right text-muted-foreground">
                  Total
                </TableHead>
                <TableHead className="text-right text-muted-foreground">
                  Resolved
                </TableHead>
                <TableHead className="text-right text-muted-foreground">
                  Resolution rate
                </TableHead>
                <TableHead className="text-right text-muted-foreground">
                  Avg resolution
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow className="border-border">
                  <TableCell
                    colSpan={5}
                    className="h-20 text-center text-[13px] text-muted-foreground"
                  >
                    No tickets in this range.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => {
                  const rate = r.total ? (r.resolved / r.total) * 100 : 0;
                  return (
                    <TableRow key={r.agent} className="border-border">
                      <TableCell className="font-medium text-foreground">
                        {r.agent}
                      </TableCell>
                      <TableCell className="text-right text-[13px] text-foreground">
                        {r.total}
                      </TableCell>
                      <TableCell className="text-right text-[13px] text-emerald-500">
                        {r.resolved}
                      </TableCell>
                      <TableCell
                        className={`text-right text-[13px] ${
                          rate >= 70 ? 'text-emerald-500' : 'text-amber-500'
                        }`}
                      >
                        {rate.toFixed(0)}%
                      </TableCell>
                      <TableCell className="text-right text-[13px] text-sky-500">
                        {fmtMinutes(r.avgResolutionMinutes)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </ClayCard>
    </div>
  );
}
