import { ZoruCard, ZoruPageDescription, ZoruPageHeader, ZoruPageHeading, ZoruPageTitle } from '@/components/zoruui';
import {
  MessageSquare } from 'lucide-react';

import { listConversations } from '@/app/actions/worksuite/chat.actions';

import { ConversationsPane } from './_components/conversations-pane';

/**
 * Messages — 2-column layout.
 *
 * The left pane lists all conversations (peers + last message) and
 * deep-links to `/dashboard/crm/messages/[peerId]` for the active thread.
 * On this index route we render an empty-state on the right.
 */
export default async function MessagesPage() {
  const conversations = await listConversations();

  return (
    <div className="flex w-full flex-col gap-6">
      <ZoruPageHeader>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zoru-surface-2">
            <MessageSquare className="h-5 w-5 text-zoru-ink" strokeWidth={1.75} />
          </div>
          <ZoruPageHeading>
            <ZoruPageTitle>Messages</ZoruPageTitle>
            <ZoruPageDescription>Chat directly with your teammates.</ZoruPageDescription>
          </ZoruPageHeading>
        </div>
      </ZoruPageHeader>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <ConversationsPane conversations={conversations} activePeerId={null} />
        <ZoruCard className="flex min-h-[480px] items-center justify-center p-6">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-zoru-surface-2">
              <MessageSquare className="h-6 w-6 text-zoru-ink" strokeWidth={1.75} />
            </div>
            <p className="text-[14px] text-zoru-ink">Select a conversation</p>
            <p className="mt-1 text-[12.5px] text-zoru-ink-muted">
              Pick a teammate on the left to open the thread.
            </p>
          </div>
        </ZoruCard>
      </div>
    </div>
  );
}
