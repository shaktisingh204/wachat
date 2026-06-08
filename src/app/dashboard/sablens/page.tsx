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
  PageDescription,
  PageHeader,
  PageHeading,
  PageTitle,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import { listSablensSessions } from '@/app/actions/sablens.actions';
import { CirclePlus, Hammer, Smartphone, Video } from 'lucide-react';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, BadgeTone> = {
  scheduled: 'info',
  waiting: 'warning',
  active: 'success',
  ended: 'neutral',
};

export default async function SablensPage() {
  const result = await listSablensSessions({ limit: 50 });
  const sessions = result.ok ? result.data.items : [];

  return (
    <div className="20ui flex flex-col gap-6 p-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>SabLens</PageTitle>
          <PageDescription>
            Live AR remote support. The customer points a phone, you see their
            world and draw on it.
          </PageDescription>
        </PageHeading>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/sablens/devices">
            <Button variant="outline" iconLeft={Smartphone}>
              Registered devices
            </Button>
          </Link>
          <Link href="/dashboard/sablens/new">
            <Button variant="primary" iconLeft={CirclePlus}>
              New session
            </Button>
          </Link>
        </div>
      </PageHeader>

      {!result.ok ? (
        <Alert tone="danger" title="Couldn't load sessions">
          {result.error}
        </Alert>
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={Hammer}
          title="No sessions yet"
          description="Create a session, send the customer a join link, and start drawing on their camera feed in real time."
          action={
            <Link href="/dashboard/sablens/new">
              <Button variant="primary" iconLeft={CirclePlus}>
                Create your first session
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sessions.map((s) => (
            <Link
              key={s._id}
              href={`/dashboard/sablens/${s._id}`}
              className="block"
            >
              <Card variant="interactive" className="h-full">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="line-clamp-1">
                      {s.customerName || 'Untitled customer'}
                    </CardTitle>
                    <Badge tone={STATUS_TONE[s.status] ?? 'neutral'}>
                      {s.status}
                    </Badge>
                  </div>
                  <CardDescription>
                    {s.customerEmail || 'No email on file'}
                  </CardDescription>
                </CardHeader>
                <CardBody className="flex items-center justify-between text-xs text-[var(--st-text-secondary)]">
                  <span className="inline-flex items-center gap-1">
                    <Video className="size-3" aria-hidden="true" />
                    {s.mode === 'live_call' ? 'Live call' : 'Async recorded'}
                  </span>
                  <span>
                    {s.startedAt
                      ? new Date(s.startedAt).toLocaleString()
                      : 'not started'}
                  </span>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
