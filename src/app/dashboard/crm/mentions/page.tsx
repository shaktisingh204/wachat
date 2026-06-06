import { Badge, Card } from '@/components/sabcrm/20ui/compat';
import { EntityListShell } from '@/components/crm/entity-list-shell';

import { getMentionsForMe } from '@/app/actions/worksuite/chat.actions';
import type { WsMentionUser } from '@/lib/worksuite/chat-types';
import { MentionRow } from './_components/mention-row';
import React from 'react';

async function MentionsList() {
  const mentions = (await getMentionsForMe()) as (WsMentionUser & { _id: string })[];
  
  if (mentions.length === 0) {
    return (
      <Card className="flex items-center justify-center p-6 py-12">
        <p className="text-[13px] text-zoru-ink-muted">No mentions yet.</p>
      </Card>
    );
  }

  return (
    <Card className="p-0">
      <ul className="divide-y divide-zoru-line">
        {mentions.map((m) => (
          <MentionRow key={m._id} mention={m} />
        ))}
      </ul>
    </Card>
  );
}

export default async function MentionsPage() {
  const mentions = (await getMentionsForMe()) as (WsMentionUser & { _id: string })[];
  const unread = mentions.filter((m) => !m.read_at).length;

  return (
    <EntityListShell
      title="Mentions"
      subtitle="Every time someone @-mentions you."
      primaryAction={
        unread > 0 ? (
          <Badge variant="danger">{unread} unread</Badge>
        ) : null
      }
    >
      <React.Suspense fallback={
        <Card className="flex items-center justify-center p-6 py-12">
          <p className="text-[13px] text-zoru-ink-muted">Loading...</p>
        </Card>
      }>
        <MentionsList />
      </React.Suspense>
    </EntityListShell>
  );
}
