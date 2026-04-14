import { MessageSquare } from 'lucide-react';

import { CrmPageHeader } from '../../_components/crm-page-header';
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
      <CrmPageHeader
        title="Messages"
        subtitle="Chat directly with your teammates."
        icon={MessageSquare}
      />

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
