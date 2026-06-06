import Link from 'next/link';

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
} from '@/components/sabcrm/20ui/compat';
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
        <ZoruPageHeading>
          <ZoruPageTitle>SabLens</ZoruPageTitle>
          <ZoruPageDescription>
            Live AR remote support — the customer points a phone, you see
            their world and draw on it.
          </ZoruPageDescription>
        </ZoruPageHeading>
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
          <ZoruCardHeader>
            <ZoruCardTitle>Couldn't load sessions</ZoruCardTitle>
            <ZoruCardDescription>{result.error}</ZoruCardDescription>
          </ZoruCardHeader>
        </Card>
      ) : sessions.length === 0 ? (
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle className="flex items-center gap-2">
              <Hammer className="size-5" /> No sessions yet
            </ZoruCardTitle>
            <ZoruCardDescription>
              Create a session, send the customer a join link, and start
              drawing on their camera feed in real time.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            <Button asChild>
              <Link href="/dashboard/sablens/new">
                <CirclePlus className="size-4" /> Create your first session
              </Link>
            </Button>
          </ZoruCardContent>
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
                <ZoruCardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <ZoruCardTitle className="line-clamp-1">
                      {s.customerName || 'Untitled customer'}
                    </ZoruCardTitle>
                    <Badge variant={STATUS_VARIANT[s.status]}>{s.status}</Badge>
                  </div>
                  <ZoruCardDescription>
                    {s.customerEmail || '—'}
                  </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="flex items-center justify-between text-xs text-[var(--st-text-secondary)]">
                  <span className="inline-flex items-center gap-1">
                    <Video className="size-3" />
                    {s.mode === 'live_call' ? 'Live call' : 'Async recorded'}
                  </span>
                  <span>
                    {s.startedAt
                      ? new Date(s.startedAt).toLocaleString()
                      : 'not started'}
                  </span>
                </ZoruCardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
