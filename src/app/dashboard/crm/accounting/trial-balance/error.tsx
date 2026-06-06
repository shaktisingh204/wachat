'use client';

import * as React from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { Button, Alert, ZoruAlertTitle, ZoruAlertDescription } from '@/components/sabcrm/20ui/compat';

export default function TrialBalanceError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    React.useEffect(() => {
        console.error('TrialBalance ErrorBoundary caught:', error);
    }, [error]);

    return (
        <div className="flex h-full w-full flex-col items-center justify-center p-8">
            <Alert variant="destructive" className="max-w-md">
                <AlertCircle className="h-4 w-4" />
                <ZoruAlertTitle>Failed to load Trial Balance</ZoruAlertTitle>
                <ZoruAlertDescription className="mt-2">
                    <p className="mb-4 text-sm">
                        {error.message || 'An unexpected error occurred while generating the trial balance report.'}
                    </p>
                    <Button onClick={reset} variant="outline" size="sm">
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Try again
                    </Button>
                </ZoruAlertDescription>
            </Alert>
        </div>
    );
}
