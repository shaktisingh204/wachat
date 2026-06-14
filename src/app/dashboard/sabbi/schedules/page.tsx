/**
 * Scheduled reports. CRUD.
 */
import Link from 'next/link';
import {
  CalendarClock,
  CircleCheck,
  FileText,
  LayoutDashboard,
  ListChecks,
  Timer,
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  PageActions,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  StatCard,
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

  const workbookNames = new Map(workbooks.map((w) => [w._id, w.name]));
  const activeCount = schedules.filter(
    (s) => statusTone(s.status) === 'success',
  ).length;
  const formatCount = new Set(schedules.map((s) => s.format)).size;

  return (
    <div className="20ui flex flex-col gap-[var(--st-space-5)] p-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabBI</PageEyebrow>
          <PageTitle>Scheduled reports</PageTitle>
          <PageDescription>
            Email a workbook on a cron schedule. PDF, CSV, or inline body.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="ghost" asChild>
            <Link href="/dashboard/sabbi/workbooks">
              <LayoutDashboard size={16} aria-hidden="true" />
              Workbooks
            </Link>
          </Button>
        </PageActions>
      </PageHeader>

      <div className="grid grid-cols-1 gap-[var(--st-space-4)] sm:grid-cols-3">
        <StatCard
          label="Schedules"
          value={schedules.length}
          icon={CalendarClock}
          accent="var(--st-accent)"
        />
        <StatCard label="Active" value={activeCount} icon={CircleCheck} />
        <StatCard label="Formats" value={formatCount} icon={FileText} />
      </div>

      <NewSchedulePanel
        workbooks={workbooks.map((w) => ({ id: w._id, name: w.name }))}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks size={16} aria-hidden="true" />
            Active schedules
          </CardTitle>
        </CardHeader>
        <CardBody>
          {schedules.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              tone="info"
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
                    <Td className="font-medium text-[var(--st-text)]">{s.name}</Td>
                    <Td className="text-[var(--st-text-secondary)]">
                      {workbookNames.get(s.workbookId) ?? s.workbookId}
                    </Td>
                    <Td>
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs text-[var(--st-text-secondary)]">
                        <Timer
                          size={13}
                          className="text-[var(--st-text-tertiary)]"
                          aria-hidden="true"
                        />
                        {s.cron}
                      </span>
                    </Td>
                    <Td>
                      <Badge tone="info">{s.format}</Badge>
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
