'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui';
import { useT } from '@/lib/i18n/client';

export default function PayrollError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const { t } = useT();

    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="flex h-full flex-col items-center justify-center space-y-4 p-8">
            <h2 className="text-xl font-semibold text-[var(--st-text)]">Something went wrong!</h2>
            <p className="text-sm text-[var(--st-text-secondary)]">{error.message}</p>
            <Button onClick={() => reset()} variant="default">
                Try again
            </Button>
        </div>
    );
}
