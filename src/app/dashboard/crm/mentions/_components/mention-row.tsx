'use client';

import { Button, Badge, useZoruToast } from '@/components/sabcrm/20ui/compat';
import * as React from 'react';
import { AtSign, Check } from 'lucide-react';

import { markMentionRead } from '@/app/actions/worksuite/chat.actions';
import type { WsMentionUser } from '@/lib/worksuite/chat-types';

export interface MentionRowProps {
  mention: WsMentionUser & { _id: string };
}

function formatStamp(value?: string | Date | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MentionRow({ mention }: MentionRowProps) {
  const { toast } = useZoruToast();
  const [read, setRead] = React.useState(Boolean(mention.read_at));
  const [busy, setBusy] = React.useState(false);

  const onMarkRead = async () => {
    if (read) return;
    setBusy(true);
    const res = await markMentionRead(mention._id);
    setBusy(false);
    if (res.success) setRead(true);
    else toast({ title: 'Error', description: res.error, variant: 'destructive' });
  };

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--st-bg-muted)]">
        <AtSign className="h-4 w-4 text-[var(--st-text)]" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-medium text-[var(--st-text)]">
            {mention.mentioner_user_id}
          </span>
          <span className="text-[12px] text-[var(--st-text-secondary)]">
            mentioned you in
          </span>
          <Badge variant="ghost">{mention.resource_type}</Badge>
          {!read ? <Badge variant="danger">Unread</Badge> : null}
        </div>
        {mention.body ? (
          <p className="mt-1 whitespace-pre-wrap text-[13px] text-[var(--st-text)]">
            {mention.body}
          </p>
        ) : null}
        <p className="mt-1 text-[11.5px] text-[var(--st-text-secondary)]">
          {formatStamp(mention.createdAt)}
        </p>
      </div>
      {!read ? (
        <Button
          size="sm"
          variant="pill"
          onClick={onMarkRead}
          disabled={busy}
          leading={<Check className="h-3.5 w-3.5" />}
        >
          Mark read
        </Button>
      ) : null}
    </li>
  );
}
