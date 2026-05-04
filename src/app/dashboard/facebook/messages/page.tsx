"use client";

/**
 * /dashboard/facebook/messages — Messenger inbox.
 *
 * ZoruUI three-pane workspace (list / thread / contact info).
 * Same data, same handlers as the legacy FacebookChatClient — only the
 * visual layer changed. See zoru-fb-chat-client.tsx for details.
 */

import { Suspense } from "react";

import { ZoruSkeleton } from "@/components/zoruui";

import { ZoruFacebookChatClient } from "../_components/zoru-fb-chat-client";

function ChatPageFallback() {
  return (
    <div className="flex h-full w-full gap-3 p-3">
      <ZoruSkeleton className="h-full w-full md:w-[320px] md:shrink-0" />
      <ZoruSkeleton className="hidden h-full flex-1 md:block" />
      <ZoruSkeleton className="hidden h-full w-[300px] shrink-0 lg:block" />
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
