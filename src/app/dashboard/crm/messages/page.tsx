import { MessageSquare } from 'lucide-react';

import { ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../_components/crm-page-header';
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
      <CrmPageHeader
        title="Messages"
        subtitle="Chat directly with your teammates."
        icon={MessageSquare}
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <ConversationsPane conversations={conversations} activePeerId={null} />
        <ClayCard className="flex min-h-[480px] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-clay-md bg-clay-rose-soft">
              <MessageSquare className="h-6 w-6 text-clay-rose-ink" strokeWidth={1.75} />
            </div>
            <p className="text-[14px] font-medium text-clay-ink">Select a conversation</p>
            <p className="mt-1 text-[12.5px] text-clay-ink-muted">
              Pick a teammate on the left to open the thread.
            </p>
          </div>
        </ClayCard>
      </div>
    </div>
  );
}
