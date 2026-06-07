import { Suspense } from 'react';

import { Skeleton } from '@/components/sabcrm/20ui';
import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { Ui20ChatClient } from '../_components/ui20-chat-client';

/**
 * /wachat/chat — Live chat workspace.
 *
 * The 3-pane chat UI lives inside `Ui20ChatClient` which manages its
 * own conversations list / thread / contact panel internally. This
 * page is just the route entry — it renders a full-bleed app frame with
 * a Suspense boundary and a 20ui skeleton fallback. `Ui20ChatClient`
 * owns the whole frame, so this page uses `WachatPage variant="app"`.
 */

export const dynamic = 'force-dynamic';

function ChatPageSkeleton() {
  return (
    <div className="flex h-full w-full gap-3 p-3">
      <Skeleton className="block h-full w-[320px] shrink-0" />
      <Skeleton className="block h-full flex-1" />
      <Skeleton className="block h-full w-[300px] shrink-0" />
    </div>
  );
}

export default function ChatPage() {
  return (
    <WachatPage variant="app">
      <Suspense fallback={<ChatPageSkeleton />}>
        <Ui20ChatClient />
      </Suspense>
    </WachatPage>
  );
}
