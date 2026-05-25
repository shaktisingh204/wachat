'use client';

import { ErrorBoundaryShell } from '@/components/crm/error-boundary-shell';
import * as React from 'react';

export default function EditBankAccountError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    React.useEffect(() => {
        console.error('Edit Bank Account Error:', error);
    }, [error]);

    return (
        <ErrorBoundaryShell
            title="Failed to load bank account editor"
            message={error.message || 'There was a problem loading the bank account details for editing. Please try again.'}
            onRetry={reset}
        />
    );
}
