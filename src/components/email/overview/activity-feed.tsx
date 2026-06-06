'use client';

import { formatDistanceToNow } from 'date-fns';
import { Send } from 'lucide-react';
import Link from 'next/link';
import { Button, Card, CardBody, CardDescription, CardFooter, CardHeader, CardTitle, Badge } from '@/components/sabcrm/20ui/compat';
import type { WithId, EmailCampaign } from '@/lib/definitions';

interface EmailActivityFeedProps {
  campaigns: WithId<EmailCampaign>[];
  accountId?: string;
}

const STATUS_COLOR: Record<EmailCampaign['status'], 'default' | 'secondary' | 'outline'> = {
  draft: 'outline',
  scheduled: 'secondary',
  sending: 'default',
  sent: 'default',
};

export function EmailActivityFeed({ campaigns, accountId }: EmailActivityFeedProps) {
  const qs = accountId ? `?accountId=${accountId}` : '';

  return (
    <Card className="p-0">
      <CardHeader>
        <CardTitle>Recent campaigns</CardTitle>
        <CardDescription>Your most recent sends and drafts.</CardDescription>
      </CardHeader>
      <CardBody>
        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-[var(--st-text-secondary)]">
            <Send className="h-6 w-6" />
            <p className="text-sm">No campaigns yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--st-border)]">
            {campaigns.map((c) => (
              <li
                key={c._id.toString()}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0 gap-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--st-text)]">{c.name}</p>
                  <p className="truncate text-xs text-[var(--st-text-secondary)]">{c.subject}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={STATUS_COLOR[c.status] ?? 'outline'}>{c.status}</Badge>
                  <span className="text-xs text-[var(--st-text-secondary)] hidden md:inline">
                    {c.sentAt
                      ? formatDistanceToNow(new Date(c.sentAt), { addSuffix: true })
                      : 'Draft'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
      <CardFooter>
        <Button asChild variant="outline" className="w-full">
          <Link href={`/dashboard/email/campaigns${qs}`}>View all campaigns</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
