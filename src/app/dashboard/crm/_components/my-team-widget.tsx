/**
 * <MyTeamWidget /> — main dashboard widget.
 *
 * Server component. Lists the current user's direct reports (up to 5)
 * with their open-task count. Hides itself gracefully when the user has
 * no direct reports.
 */

import Link from 'next/link';
import { Users2 } from 'lucide-react';

import {
  Avatar,
  ZoruAvatarFallback,
  Badge,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
} from '@/components/sabcrm/20ui/compat';
import { getMyDirectReports } from '@/app/actions/hrm-portal.actions';
import { getEmployeeAssignmentStats } from '@/app/actions/crm-assignment.actions';

function initialsFromName(first: string, last: string): string {
  const f = first?.[0] ?? '';
  const l = last?.[0] ?? '';
  const out = `${f}${l}`.trim().toUpperCase();
  return out || '?';
}

interface TeamRow {
  _id: string;
  name: string;
  designation: string | null;
  status: string;
  openTasks: number;
}

export async function MyTeamWidget() {
  const reports = await getMyDirectReports();
  if (reports.length === 0) return null;

  const top = reports.slice(0, 5);

  const enriched: TeamRow[] = await Promise.all(
    top.map(async (r) => {
      const stats = await getEmployeeAssignmentStats(r._id);
      return {
        _id: r._id,
        name: `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim() || r.email,
        designation: r.designationName,
        status: r.status,
        openTasks: stats.openTasks,
      };
    }),
  );

  return (
    <Card className="p-0">
      <ZoruCardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <ZoruCardTitle className="flex items-center gap-2 text-[14px] text-[var(--st-text)]">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--st-bg-muted)]">
              <Users2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            </span>
            My team
          </ZoruCardTitle>
          <Badge variant="ghost">{reports.length}</Badge>
        </div>
      </ZoruCardHeader>
      <ZoruCardContent className="pt-2">
        <ul className="flex flex-col gap-2">
          {enriched.map((r) => {
            const [first, ...rest] = r.name.split(' ');
            return (
              <li
                key={r._id}
                className="flex items-center gap-3 rounded-[var(--zoru-radius-sm)] px-2 py-1.5 hover:bg-[var(--st-bg-muted)]"
              >
                <Avatar className="h-8 w-8">
                  <ZoruAvatarFallback>
                    {initialsFromName(first ?? '', rest.join(' '))}
                  </ZoruAvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13px] font-medium text-[var(--st-text)]">
                    {r.name}
                  </span>
                  <span className="truncate text-[11.5px] text-[var(--st-text-secondary)]">
                    {r.designation ?? r.status}
                  </span>
                </div>
                <Badge variant="ghost">
                  {r.openTasks} {r.openTasks === 1 ? 'task' : 'tasks'}
                </Badge>
              </li>
            );
          })}
        </ul>
      </ZoruCardContent>
      <div className="border-t border-[var(--st-border)] px-5 py-2">
        <Link
          href="/dashboard/hrm/portal#team"
          className="text-[12px] text-[var(--st-text-secondary)] hover:text-[var(--st-text)] hover:underline"
        >
          Open team portal
        </Link>
      </div>
    </Card>
  );
}

export default MyTeamWidget;
