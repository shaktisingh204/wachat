/**
 * Scheduled reports. CRUD.
 */
import Link from 'next/link';
import { CalendarClock } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Table,
  TBody,
  Td,
  THead,
  Th,
  Tr,
} from '@/components/sabcrm/20ui';
import {
  listSchedulesAction,
  listWorkbooksAction,
} from '@/app/actions/analytics-bi.actions';

import { NewSchedulePanel } from './new-schedule-panel';

export const dynamic = 'force-dynamic';

type ScheduleStatus = string | undefined | null;

function statusTone(status: ScheduleStatus): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'active':
    case 'enabled':
      return 'success';
    case 'paused':
    case 'pending':
      return 'warning';
    case 'failed':
    case 'error':
      return 'danger';
    default:
      return 'neutral';
  }
}

export default async function SchedulesPage() {
  const [schedulesRes, workbooksRes] = await Promise.all([
    listSchedulesAction({ limit: 200 }).catch(() => ({ items: [] })),
    listWorkbooksAction({ limit: 500 }).catch(() => ({ items: [] })),
  ]);
  const schedules = 'items' in schedulesRes ? schedulesRes.items : [];
  const workbooks = 'items' in workbooksRes ? workbooksRes.items : [];

  return (
    <div className="20ui flex flex-col gap-6 p-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Scheduled reports</PageTitle>
          <PageDescription>
            Email a workbook on a cron schedule. PDF, CSV, or inline body.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="ghost">
            <Link href="/dashboard/analytics-workspace">Workbooks</Link>
          </Button>
        </PageActions>
      </PageHeader>

      <NewSchedulePanel
        workbooks={workbooks.map((w) => ({ id: w._id, name: w.name }))}
      />

      <Card>
        <CardHeader>
          <CardTitle>Active schedules</CardTitle>
          <CardDescription>
            Cron evaluation runs in the BI worker. Next-run timestamps are
            populated after the first tick.
          </CardDescription>
        </CardHeader>
        <CardBody>
          {schedules.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="No scheduled reports"
              description="Create a schedule above to email a workbook on a recurring cadence."
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Workbook</Th>
                  <Th>Cron</Th>
                  <Th>Format</Th>
                  <Th>Status</Th>
                  <Th>Last run</Th>
                </Tr>
              </THead>
              <TBody>
                {schedules.map((s) => (
                  <Tr key={s._id}>
                    <Td>{s.name}</Td>
                    <Td className="text-[var(--st-text-secondary)]">{s.workbookId}</Td>
                    <Td className="font-mono text-xs">{s.cron}</Td>
                    <Td>
                      <Badge tone="accent">{s.format}</Badge>
                    </Td>
                    <Td>
                      <Badge tone={statusTone(s.status)} dot>
                        {s.status}
                      </Badge>
                    </Td>
                    <Td className="text-[var(--st-text-secondary)]">
                      {s.lastRunAt ?? '-'}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
