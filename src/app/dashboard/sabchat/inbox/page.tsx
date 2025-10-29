
'use client';

import { Suspense } from 'react';
import { SabChatClient } from '@/components/wabasimplify/sabchat-client';
import { Skeleton } from '@/components/ui/skeleton';

function ChatPageSkeleton() {
    return <Skeleton className="h-full w-full rounded-xl" />;
}

export default function SabChatInboxPage() {
    return (
        <div className="h-full p-0 m-0">
             <Suspense fallback={<ChatPageSkeleton />}>
                <SabChatClient />
            </Suspense>
        </div>
    );
}
