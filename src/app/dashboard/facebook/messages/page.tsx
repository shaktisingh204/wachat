

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { FacebookChatClient } from '@/components/wabasimplify/facebook-chat-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Facebook Messages | SabNode',
};

function ChatPageSkeleton() {
    return <div className="h-full w-full"><Skeleton className="h-full w-full" /></div>;
}

export default function FacebookMessagesPage() {
    return (
        <div className="h-full flex flex-col">
            <div className="flex-shrink-0 p-4 border-b">
                 <h1 className="text-3xl font-bold font-headline">Facebook Messenger</h1>
                 <p className="text-muted-foreground">Respond to messages from your connected Facebook Page.</p>
            </div>
            <div className="flex-1 overflow-hidden h-full">
                <Suspense fallback={<ChatPageSkeleton />}>
                    <FacebookChatClient />
                </Suspense>
            </div>
        </div>
    );
}
