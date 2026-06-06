import Link from 'next/link';

import { Badge, Button, Card, CardBody, CardDescription, CardHeader, CardTitle, PageDescription, PageHeader, PageHeading, PageTitle } from '@/components/sabcrm/20ui';
import { listSablensSessions } from '@/app/actions/sablens.actions';
import { CirclePlus, Hammer, Smartphone, Video } from 'lucide-react';

export const dynamic = 'force-dynamic';

const STATUS_VARIANT = {
  scheduled: 'secondary',
  waiting: 'outline',
  active: 'default',
  ended: 'secondary',
} as const;

export default async function SablensPage() {
  const result = await listSablensSessions({ limit: 50 });
  const sessions = result.ok ? result.data.items : [];

  return (
    <div className="zoruui flex flex-col gap-6 p-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>SabLens</PageTitle>
          <PageDescription>
            Live AR remote support — the customer points a phone, you see
            their world and draw on it.
          </PageDescription>
        </PageHeading>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/sablens/devices">
              <Smartphone className="size-4" /> Registered devices
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/sablens/new">
              <CirclePlus className="size-4" /> New session
            </Link>
          </Button>
        </div>
      </PageHeader>

      {!result.ok ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>Couldn't load sessions</CardTitle>
            <CardDescription>{result.error}</CardDescription>
          </CardHeader>
        </Card>
      ) : sessions.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hammer className="size-5" /> No sessions yet
            </CardTitle>
            <CardDescription>
              Create a session, send the customer a join link, and start
              drawing on their camera feed in real time.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <Button asChild>
              <Link href="/dashboard/sablens/new">
                <CirclePlus className="size-4" /> Create your first session
              </Link>
            </Button>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sessions.map((s) => (
            <Link
              key={s._id}
              href={`/dashboard/sablens/${s._id}`}
              className="block"
            >
              <Card className="h-full transition hover:border-primary/50">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="line-clamp-1">
                      {s.customerName || 'Untitled customer'}
                    </CardTitle>
                    <Badge variant={STATUS_VARIANT[s.status]}>{s.status}</Badge>
                  </div>
                  <CardDescription>
                    {s.customerEmail || '—'}
                  </CardDescription>
                </CardHeader>
                <CardBody className="flex items-center justify-between text-xs text-[var(--st-text-secondary)]">
                  <span className="inline-flex items-center gap-1">
                    <Video className="size-3" />
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
