import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Card } from '@/components/sabcrm/20ui/compat';
import { MessageSquare } from 'lucide-react';
import React from 'react';

import {
  listConversations,
  getConversationWith,
} from '@/app/actions/worksuite/chat.actions';
import { getSession } from '@/app/actions/user.actions';
import { ObjectId } from 'mongodb';

import { ConversationsPane } from '../_components/conversations-pane';
import { ChatThread } from '../_components/chat-thread';
import type { WsUserChat, WsUserchatFile } from '@/lib/worksuite/chat-types';

async function ConversationContent({ peerId }: { peerId: string }) {
  const session = await getSession();
  
  if (!ObjectId.isValid(peerId)) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border border-zoru-line rounded-lg bg-zoru-surface">
        <MessageSquare className="h-10 w-10 text-zoru-ink-muted mb-4" />
        <h3 className="text-lg font-medium">Invalid User ID</h3>
        <p className="text-sm text-zoru-ink-muted mt-1">The user you are trying to message does not exist or the ID is invalid.</p>
      </div>
    );
  }
  const currentUserId = session?.user ? String(session.user._id) : '';

  const [conversations, thread] = await Promise.all([
    listConversations(),
    getConversationWith(peerId),
  ]);

  type ThreadMessage = WsUserChat & { _id: string; files?: WsUserchatFile[] };
  const initialMessages = thread as unknown as ThreadMessage[];

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <ConversationsPane conversations={conversations} activePeerId={peerId} />
      <ChatThread
        peerUserId={peerId}
        currentUserId={currentUserId}
        initialMessages={initialMessages}
      />
    </div>
  );
}

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ peerId: string }>;
}) {
  const { peerId } = await params;

  return (
    <EntityListShell
      title="Messages"
      subtitle="Chat directly with your teammates."
    >
      <React.Suspense fallback={
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="space-y-2 animate-pulse bg-zoru-surface-2 rounded-md h-[480px]"></div>
          <Card className="flex min-h-[480px] items-center justify-center p-6">
            <p className="text-[13px] text-zoru-ink-muted">Loading...</p>
          </Card>
        </div>
      }>
        <ConversationContent peerId={peerId} />
      </React.Suspense>
    </EntityListShell>
  );
}
