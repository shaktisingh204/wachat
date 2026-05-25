'use client';

import { ErrorBoundaryWrapper } from '@/components/crm/error-boundary-wrapper';

export default function AccountDetailError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <ErrorBoundaryWrapper
            title="Account Error"
            message="We couldn't load the account details."
            error={error}
            reset={reset}
        />
    );
}
