'use client';

import { useEffect } from 'react';
import { Button, EmptyState } from '@/components/zoruui';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function AccountsNewError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('[CRM Accounts New Error]', error);
    }, [error]);

    return (
        <div className="w-full px-6 pt-6 pb-10">
            <EmptyState
                icon={<AlertTriangle />}
                title="Something went wrong"
                description={
                    error?.message?.length && error.message.length < 200
                        ? error.message
                        : 'An unexpected error occurred while loading this page. Try again or head back to accounts.'
                }
                action={
                    <div className="flex items-center gap-2">
                        <Button size="md" onClick={() => reset()}>
                            Try again
                        </Button>
                        <Link href="/dashboard/crm/accounts">
                            <Button size="md" variant="outline">
                                Back to Accounts
                            </Button>
                        </Link>
                    </div>
                }
            />
        </div>
    );
}
