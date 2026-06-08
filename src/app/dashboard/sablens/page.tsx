import Link from 'next/link';

import {
  Alert,
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
  PageEyebrow,
  PageHeader,
  PageHeading,
  PageTitle,
  StatCard,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import { listSablensSessions } from '@/app/actions/sablens.actions';
import {
  CirclePlus,
  Hammer,
  Radio,
  Smartphone,
  Sparkles,
  Video,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, BadgeTone> = {
  scheduled: 'info',
  waiting: 'warning',
  active: 'success',
  ended: 'neutral',
};

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled',
  waiting: 'Waiting',
  active: 'Active',
  ended: 'Ended',
};

export default async function SablensPage() {
  const result = await listSablensSessions({ limit: 50 });
  const sessions = result.ok ? result.data.items : [];

  const active = sessions.filter((s) => s.status === 'active').length;
  const waiting = sessions.filter(
    (s) => s.status === 'waiting' || s.status === 'scheduled',
  ).length;
  const liveCalls = sessions.filter((s) => s.mode === 'live_call').length;

  return (
    <div className="20ui flex flex-col gap-6 p-6">
      <PageHeader>
        <PageHeading>
          <PageEyebrow>SabLens</PageEyebrow>
          <PageTitle>Remote AR support</PageTitle>
          <PageDescription>
            The customer points a phone, you see their world and draw on it in
            real time.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button asChild variant="outline">
            <Link href="/dashboard/sablens/devices">
              <Smartphone className="size-4" aria-hidden="true" />
              Registered devices
            </Link>
          </Button>
          <Button asChild variant="primary">
            <Link href="/dashboard/sablens/new">
              <CirclePlus className="size-4" aria-hidden="true" />
              New session
            </Link>
          </Button>
        </PageActions>
      </PageHeader>

      {result.ok && sessions.length > 0 ? (
        <section
          aria-label="Session overview"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <StatCard
            label="Total sessions"
            value={sessions.length}
            icon={Sparkles}
            accent="#3b7af5"
          />
          <StatCard
            label="Active now"
            value={active}
            icon={Radio}
            accent="#1f9d55"
          />
          <StatCard
            label="Awaiting customer"
            value={waiting}
            icon={Hammer}
            accent="#d97706"
          />
          <StatCard
            label="Live calls"
            value={liveCalls}
            icon={Video}
            accent="#7c3aed"
          />
        </section>
      ) : null}

      {!result.ok ? (
        <Alert tone="danger" title="Couldn't load sessions">
          {result.error}
        </Alert>
      ) : sessions.length === 0 ? (
        <Card variant="outlined">
          <EmptyState
            icon={Hammer}
            title="No sessions yet"
            description="Create a session, send the customer a join link, and start drawing on their camera feed in real time."
            action={
              <Button asChild variant="primary">
                <Link href="/dashboard/sablens/new">
                  <CirclePlus className="size-4" aria-hidden="true" />
                  Create your first session
                </Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <section
          aria-label="Sessions"
          className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {sessions.map((s) => (
            <Link
              key={s._id}
              href={`/dashboard/sablens/${s._id}`}
              className="block rounded-[var(--st-radius-lg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--st-bg)]"
            >
              <Card variant="interactive" className="h-full">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="line-clamp-1">
                      {s.customerName || 'Untitled customer'}
                    </CardTitle>
                    <Badge tone={STATUS_TONE[s.status] ?? 'neutral'} dot>
                      {STATUS_LABEL[s.status] ?? s.status}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-1">
                    {s.customerEmail || 'No email on file'}
                  </CardDescription>
                </CardHeader>
                <CardBody className="flex items-center justify-between text-xs text-[var(--st-text-secondary)]">
                  <span className="inline-flex items-center gap-1.5">
                    <Video className="size-3.5" aria-hidden="true" />
                    {s.mode === 'live_call' ? 'Live call' : 'Async recorded'}
                  </span>
                  <span className="tabular-nums">
                    {s.startedAt
                      ? new Date(s.startedAt).toLocaleString()
                      : 'Not started'}
                  </span>
                </CardBody>
              </Card>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
