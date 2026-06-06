'use client';

import * as React from 'react';
import { Button, Card, ZoruCardContent } from '@/components/sabcrm/20ui/compat';
import { AlertCircle, RotateCcw } from 'lucide-react';

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    React.useEffect(() => {
        // Log the error to an error reporting service
        console.error('Dashboard Error Boundary caught an error:', error);
    }, [error]);

    return (
        <div className="flex h-[80vh] w-full items-center justify-center p-6">
            <Card className="w-full max-w-md shadow-sm border-[var(--st-danger)]/30">
                <ZoruCardContent className="flex flex-col items-center p-8 text-center space-y-4">
                    <div className="rounded-full bg-[var(--st-danger-soft)] p-3">
                        <AlertCircle className="h-6 w-6 text-[var(--st-danger)]" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-lg font-semibold tracking-tight text-[var(--st-text)]">
                            Dashboard Error
                        </h2>
                        <p className="text-sm text-[var(--st-text-secondary)]">
                            {error.message || 'We encountered a problem loading this dashboard.'}
                        </p>
                    </div>
                    <Button 
                        onClick={() => reset()} 
                        variant="default"
                        className="mt-4 gap-2"
                    >
                        <RotateCcw className="h-4 w-4" />
                        Try again
                    </Button>
                </ZoruCardContent>
            </Card>
        </div>
    );
}
