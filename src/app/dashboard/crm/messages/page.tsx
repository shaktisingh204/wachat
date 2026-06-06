import { Card } from '@/components/sabcrm/20ui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { MessageSquare } from 'lucide-react';
import React from 'react';

import { listConversations } from '@/app/actions/worksuite/chat.actions';

import { ConversationsPane } from './_components/conversations-pane';

async function MessagesContent() {
  const conversations = await listConversations();

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <ConversationsPane conversations={conversations} activePeerId={null} />
      <Card className="flex min-h-[480px] items-center justify-center p-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--st-bg-muted)]">
            <MessageSquare className="h-6 w-6 text-[var(--st-text)]" strokeWidth={1.75} />
          </div>
          <p className="text-[14px] text-[var(--st-text)]">Select a conversation</p>
          <p className="mt-1 text-[12.5px] text-[var(--st-text-secondary)]">
            Pick a teammate on the left to open the thread.
          </p>
        </div>
      </Card>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <EntityListShell
      title="Messages"
      subtitle="Chat directly with your teammates."
    >
      <React.Suspense fallback={
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="space-y-2 animate-pulse bg-[var(--st-bg-muted)] rounded-md h-[480px]"></div>
          <Card className="flex min-h-[480px] items-center justify-center p-6">
            <p className="text-[13px] text-[var(--st-text-secondary)]">Loading...</p>
          </Card>
        </div>
      }>
        <MessagesContent />
      </React.Suspense>
    </EntityListShell>
  );
}
