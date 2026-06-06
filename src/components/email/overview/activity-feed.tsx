'use client';

import { formatDistanceToNow } from 'date-fns';
import { Send } from 'lucide-react';
import Link from 'next/link';
import {
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  Badge,
} from '@/components/sabcrm/20ui/compat';
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
      <ZoruCardHeader>
        <ZoruCardTitle>Recent campaigns</ZoruCardTitle>
        <ZoruCardDescription>Your most recent sends and drafts.</ZoruCardDescription>
      </ZoruCardHeader>
      <ZoruCardContent>
        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-zoru-ink-muted">
            <Send className="h-6 w-6" />
            <p className="text-sm">No campaigns yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-zoru-line">
            {campaigns.map((c) => (
              <li
                key={c._id.toString()}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0 gap-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zoru-ink">{c.name}</p>
                  <p className="truncate text-xs text-zoru-ink-muted">{c.subject}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={STATUS_COLOR[c.status] ?? 'outline'}>{c.status}</Badge>
                  <span className="text-xs text-zoru-ink-muted hidden md:inline">
                    {c.sentAt
                      ? formatDistanceToNow(new Date(c.sentAt), { addSuffix: true })
                      : 'Draft'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ZoruCardContent>
      <ZoruCardFooter>
        <Button asChild variant="outline" className="w-full">
          <Link href={`/dashboard/email/campaigns${qs}`}>View all campaigns</Link>
        </Button>
      </ZoruCardFooter>
    </Card>
  );
}
