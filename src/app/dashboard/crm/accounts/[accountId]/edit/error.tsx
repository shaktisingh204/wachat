'use client';

import { Button, EmptyState } from '@/components/sabcrm/20ui/compat';
import { AlertTriangle } from 'lucide-react';
import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function AccountEditError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const params = useParams();

    React.useEffect(() => {
        console.error('[CRM Account Edit] route error', error);
    }, [error]);

    const accountId = params?.accountId as string | undefined;

    return (
        <div className="flex w-full flex-col items-center justify-center py-20 px-6">
            <EmptyState
                icon={<AlertTriangle />}
                title="Failed to Load Account for Editing"
                description={
                    error?.message?.length && error.message.length < 200
                        ? error.message
                        : 'An unexpected error occurred while loading the account details. Please try again or return to the account page.'
                }
                action={
                    <div className="flex items-center gap-3">
                        <Button size="md" onClick={() => reset()}>
                            Try Again
                        </Button>
                        {accountId && (
                            <Link href={`/dashboard/crm/accounts/${accountId}`}>
                                <Button size="md" variant="outline">
                                    Back to Account
                                </Button>
                            </Link>
                        )}
                        <Link href="/dashboard/crm/accounts">
                            <Button size="md" variant="ghost">
                                Accounts List
                            </Button>
                        </Link>
                    </div>
                }
            />
        </div>
    );
}
