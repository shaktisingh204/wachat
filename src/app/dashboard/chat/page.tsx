
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ChatClient } from '@/components/wabasimplify/chat-client';
import { Skeleton } from '@/components/ui/skeleton';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Live Chat | Wachat',
};

function ChatPageSkeleton() {
    return <div className="flex h-full"><Skeleton className="h-full w-full" /></div>;
}

// This is a server component that uses Suspense to handle client-side parameter reading
export default function ChatPage() {
    return (
        <div className="h-full flex flex-col flex-1 min-h-0">
            <Suspense fallback={<ChatPageSkeleton />}>
                <ChatClient />
            </Suspense>
        </div>
    );
}
