'use client';

import { Button, EmptyState } from '@/components/zoruui';
import { AlertTriangle } from 'lucide-react';
import * as React from 'react';

export default function NewBankAccountError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    React.useEffect(() => {
        console.error('NewBankAccount Error:', error);
    }, [error]);

    return (
        <div className="mx-auto w-full max-w-[1180px] px-6 pt-6 pb-10">
            <EmptyState
                icon={<AlertTriangle />}
                title="Something went wrong"
                description={
                    error?.message?.length && error.message.length < 200
                        ? error.message
                        : 'Failed to load the new bank account page. Please try again.'
                }
                action={
                    <div className="flex items-center gap-2">
                        <Button size="md" onClick={() => reset()}>
                            Try again
                        </Button>
                        <Button size="md" variant="outline" onClick={() => window.history.back()}>
                            Go back
                        </Button>
                    </div>
                }
            />
        </div>
    );
}
