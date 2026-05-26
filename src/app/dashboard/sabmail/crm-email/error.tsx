'use client';

import { useEffect } from 'react';
import { Button, Card } from '@/components/zoruui';
import { AlertCircle, RefreshCcw } from 'lucide-react';

export default function CrmEmailError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('CRM Email error:', error);
    }, [error]);

    return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
            <Card className="max-w-md w-full p-6 text-center space-y-4">
                <div className="flex justify-center">
                    <div className="bg-red-100 p-3 rounded-full">
                        <AlertCircle className="h-6 w-6 text-red-600" />
                    </div>
                </div>
                <div className="space-y-2">
                    <h2 className="text-xl font-semibold text-zoru-ink">
                        Failed to load Email module
                    </h2>
                    <p className="text-[14px] text-zoru-ink-muted">
                        {error.message || 'An unexpected error occurred while loading the email hub.'}
                    </p>
                </div>
                <div className="pt-4">
                    <Button onClick={reset} className="w-full">
                        <RefreshCcw className="h-4 w-4 mr-2" />
                        Try again
                    </Button>
                </div>
            </Card>
        </div>
    );
}
