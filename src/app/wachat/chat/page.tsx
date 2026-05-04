/**
 * /wachat/chat — Live chat workspace.
 *
 * The 3-pane chat UI lives inside `ZoruChatClient` which manages its
 * own conversations list / thread / contact panel internally. This
 * page is just the route entry — it renders a Suspense boundary with
 * a Zoru skeleton fallback.
 */

import { Suspense } from 'react';
import { ZoruChatClient } from '@/app/wachat/_components/zoru-chat-client';
import { ZoruSkeleton } from '@/components/zoruui';

export const dynamic = 'force-dynamic';

function ChatPageSkeleton() {
  return (
    <div className="flex h-full w-full gap-3 p-3">
      <ZoruSkeleton className="h-full w-[320px] shrink-0" />
      <ZoruSkeleton className="h-full flex-1" />
      <ZoruSkeleton className="h-full w-[300px] shrink-0" />
    </div>
  );
}

export default function ChatPage() {
  return (
    <div className="h-full">
      <Suspense fallback={<ChatPageSkeleton />}>
        <ZoruChatClient />
      </Suspense>
    </div>
  );
}
