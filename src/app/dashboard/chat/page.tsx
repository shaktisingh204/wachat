

import { Suspense } from 'react';
import { ChatClient } from '@/components/wabasimplify/chat-client';
import { Skeleton } from '@/components/ui/skeleton';

export const dynamic = 'force-dynamic';

function ChatPageSkeleton() {
    return <Skeleton className="h-full w-full rounded-xl" />;
}

// This is a server component that uses Suspense to handle client-side parameter reading
export default function ChatPage() {
    return (
        <div className="h-full p-0 m-0">
            <Suspense fallback={<ChatPageSkeleton />}>
                <ChatClient />
            </Suspense>
        </div>
    );
}

    