import * as React from 'react';
import {
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    Card,
    Skeleton,
} from '@/components/sabcrm/20ui';

export default function WhatsappChatbotsLoading(): React.JSX.Element {
    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>WhatsApp Chatbots</PageTitle>
                    <PageDescription>Manage your WhatsApp Chatbots seamlessly.</PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            {/* Toolbar skeleton: search + primary action */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Skeleton className="h-9 w-full sm:w-64" />
                <Skeleton className="h-9 w-32" />
            </div>

            {/* List skeleton */}
            <Card padding="none">
                <div
                    className="flex flex-col"
                    role="status"
                    aria-live="polite"
                    aria-busy="true"
                    aria-label="Loading WhatsApp Chatbots"
                >
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-4 border-b border-[var(--st-border)] px-4 py-3 last:border-b-0"
                        >
                            <Skeleton circle width={36} />
                            <div className="flex min-w-0 flex-1 flex-col gap-2">
                                <Skeleton className="h-4 w-40" />
                                <Skeleton className="h-3 w-64" />
                            </div>
                            <Skeleton className="hidden h-6 w-20 sm:block" />
                            <Skeleton className="h-8 w-8" radius={8} />
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}
