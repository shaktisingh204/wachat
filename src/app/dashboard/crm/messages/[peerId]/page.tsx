import { ZoruPageDescription, PageHeader, ZoruPageHeading, ZoruPageTitle } from '@/components/zoruui';
import {
  MessageSquare } from 'lucide-react';

import {
  listConversations,
  getConversationWith,
} from '@/app/actions/worksuite/chat.actions';
import { getSession } from '@/app/actions/user.actions';

import { ConversationsPane } from '../_components/conversations-pane';
import { ChatThread } from '../_components/chat-thread';
import type { WsUserChat, WsUserchatFile } from '@/lib/worksuite/chat-types';

/**
 * Conversation detail — loads the full thread with a given peer on the
 * server, then hands it to a client component that handles the input
 * form and light polling for fresh messages.
 */
export default async function ConversationPage({
  params,
}: {
  params: Promise<{ peerId: string }>;
}) {
  const { peerId } = await params;
  const session = await getSession();
  const currentUserId = session?.user ? String(session.user._id) : '';

  const [conversations, thread] = await Promise.all([
    listConversations(),
    getConversationWith(peerId),
  ]);

  type ThreadMessage = WsUserChat & { _id: string; files?: WsUserchatFile[] };
  const initialMessages = thread as unknown as ThreadMessage[];

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
        <ConversationsPane conversations={conversations} activePeerId={peerId} />
        <ChatThread
          peerUserId={peerId}
          currentUserId={currentUserId}
          initialMessages={initialMessages}
        />
      </div>
    </div>
  );
}
