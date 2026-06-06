/**
 * Scheduled reports — CRUD.
 */
import Link from 'next/link';

import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Table, TBody, THead } from '@/components/sabcrm/20ui/compat';
import {
  listSchedulesAction,
  listWorkbooksAction,
} from '@/app/actions/analytics-bi.actions';

import { NewSchedulePanel } from './new-schedule-panel';

export const dynamic = 'force-dynamic';

export default async function SchedulesPage() {
  const [schedulesRes, workbooksRes] = await Promise.all([
    listSchedulesAction({ limit: 200 }).catch(() => ({ items: [] })),
    listWorkbooksAction({ limit: 500 }).catch(() => ({ items: [] })),
  ]);
  const schedules = 'items' in schedulesRes ? schedulesRes.items : [];
  const workbooks = 'items' in workbooksRes ? workbooksRes.items : [];

  return (
    <div className="zoruui flex flex-col gap-6 p-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--st-text)]">Scheduled reports</h1>
          <p className="text-sm text-[var(--st-text-secondary)]">
            Email a workbook on a cron schedule. PDF / CSV / inline body.
          </p>
        </div>
        <Button asChild variant="ghost">
          <Link href="/dashboard/analytics-workspace">Workbooks</Link>
        </Button>
      </header>

      <NewSchedulePanel
        workbooks={workbooks.map((w) => ({ id: w._id, name: w.name }))}
      />

      <Card>
        <CardHeader>
          <CardTitle>Active schedules</CardTitle>
          <CardDescription>
            Cron evaluation runs in the BI worker; next-run timestamps are
            populated after the first tick.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {schedules.length === 0 ? (
            <p className="text-sm text-[var(--st-text-secondary)]">No scheduled reports.</p>
          ) : (
            <Table>
              <THead>
                <tr>
                  <th className="text-left">Name</th>
                  <th className="text-left">Workbook</th>
                  <th className="text-left">Cron</th>
                  <th className="text-left">Format</th>
                  <th className="text-left">Status</th>
                  <th className="text-left">Last run</th>
                </tr>
              </THead>
              <TBody>
                {schedules.map((s) => (
                  <tr key={s._id} className="border-t border-[var(--st-border)]">
                    <td className="py-2">{s.name}</td>
                    <td className="py-2 text-[var(--st-text-secondary)]">{s.workbookId}</td>
                    <td className="py-2 font-mono text-xs">{s.cron}</td>
                    <td className="py-2">
                      <Badge variant="outline">{s.format}</Badge>
                    </td>
                    <td className="py-2">
                      <Badge variant="outline">{s.status}</Badge>
                    </td>
                    <td className="py-2 text-[var(--st-text-secondary)]">{s.lastRunAt ?? '—'}</td>
                  </tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
