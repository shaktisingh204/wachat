
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { FacebookChatClient } from '@/components/wabasimplify/facebook-chat-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Facebook Messages | SabNode',
};

function ChatPageSkeleton() {
    return <Skeleton className="h-full w-full rounded-xl" />;
}

export default function FacebookMessagesPage() {
    return (
        <div className="h-full flex flex-col p-0 m-0">
            <Suspense fallback={<ChatPageSkeleton />}>
                <FacebookChatClient />
            </Suspense>
        </div>
    );
}
