import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
  StatCard,
  EmptyState,
  Separator,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
} from '@/components/sabcrm/20ui';
import {
  ArrowLeft,
  Users,
  UserCheck,
  Activity,
  Clock,
  Video,
  BarChart3,
} from 'lucide-react';
import { getMeetRoom, getMeetRoomAnalytics } from '@/app/actions/sabmeet.actions';

interface PageProps {
  params: Promise<{ roomId: string }>;
}

function formatDuration(secs: number): string {
  if (!secs) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

export default async function AnalyticsPage({ params }: PageProps) {
  const { roomId } = await params;
  const { data: room } = await getMeetRoom(roomId);
  if (!room) notFound();
  const { data: stats } = await getMeetRoomAnalytics(roomId);

  const hasData = stats.totalAttendees > 0 || stats.totalRecordings > 0;

  return (
    <main className="space-y-6 p-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabMeet · Analytics</PageEyebrow>
          <PageTitle>{room.name}</PageTitle>
          <PageDescription>
            Attendance and engagement for this meeting room.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button asChild variant="outline">
            <Link href="/dashboard/meetings">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Back to meetings
            </Link>
          </Button>
        </PageActions>
      </PageHeader>

      {hasData ? (
        <>
          <section
            aria-label="Attendance metrics"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
          >
            <StatCard
              label="Total attendees"
              value={stats.totalAttendees}
              icon={Users}
              accent="#6366f1"
            />
            <StatCard
              label="Unique attendees"
              value={stats.uniqueAttendees}
              icon={UserCheck}
              accent="#0ea5e9"
            />
            <StatCard
              label="Peak concurrent"
              value={stats.peakConcurrent}
              icon={Activity}
              accent="#16a34a"
            />
            <StatCard
              label="Average duration"
              value={formatDuration(stats.avgDurationSecs)}
              icon={Clock}
              accent="#f59e0b"
            />
            <StatCard
              label="Recordings"
              value={stats.totalRecordings}
              icon={Video}
              accent="#ec4899"
            />
          </section>

          <Card>
            <CardHeader className="flex items-center gap-2">
              <BarChart3
                className="h-4 w-4 text-[var(--st-text-tertiary)]"
                aria-hidden="true"
              />
              <div>
                <CardTitle>Engagement summary</CardTitle>
                <CardDescription>
                  How attendance held up over the session.
                </CardDescription>
              </div>
            </CardHeader>
            <Separator />
            <CardBody>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                <SummaryRow
                  label="Returning vs unique"
                  value={`${stats.uniqueAttendees} of ${stats.totalAttendees} attendees were unique`}
                />
                <SummaryRow
                  label="Peak load"
                  value={`${stats.peakConcurrent} people in the room at once`}
                />
                <SummaryRow
                  label="Typical stay"
                  value={formatDuration(stats.avgDurationSecs)}
                />
                <SummaryRow
                  label="Recordings captured"
                  value={`${stats.totalRecordings} on file`}
                />
              </dl>
            </CardBody>
          </Card>
        </>
      ) : (
        <Card>
          <CardBody>
            <EmptyState
              icon={BarChart3}
              title="No analytics yet"
              description="Once people join this meeting, attendance and engagement metrics will appear here."
            />
          </CardBody>
        </Card>
      )}
    </main>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-[var(--st-text-tertiary)]">
        {label}
      </dt>
      <dd className="text-sm text-[var(--st-text)]">{value}</dd>
    </div>
  );
}
