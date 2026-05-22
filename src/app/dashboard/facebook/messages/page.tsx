"use client";

export const dynamic = 'force-dynamic';

import { Skeleton } from '@/components/zoruui';
import { ZoruFacebookChatClient } from '../_components/zoru-fb-chat-client';
import { Suspense } from "react";

/**
 * /dashboard/facebook/messages — Messenger inbox.
 *
 * ZoruUI three-pane workspace (list / thread / contact info).
 * Same data, same handlers as the legacy FacebookChatClient — only the
 * visual layer changed. See zoru-fb-chat-client.tsx for details.
 */

function ChatPageFallback() {
  return (
    <div className="flex h-full w-full gap-3 p-3">
      <Skeleton className="h-full w-full md:w-[320px] md:shrink-0" />
      <Skeleton className="hidden h-full flex-1 md:block" />
      <Skeleton className="hidden h-full w-[300px] shrink-0 lg:block" />
    </div>
  );
}

export default function FacebookMessagesPage() {
  return (
    <div className="flex h-full flex-col">
      <Suspense fallback={<ChatPageFallback />}>
        <ZoruFacebookChatClient />
      </Suspense>
    </div>
  );
}
