'use client';

import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/zoruui';

export default function EntityErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
            <div className="rounded-full bg-zoru-danger/10 p-3 text-zoru-danger">
                <AlertCircle className="h-6 w-6" />
            </div>
            <div>
                <h2 className="text-lg font-semibold text-zoru-ink">
                    {error.message.includes('permission') ? 'Access Denied' : 'Unsupported Entity'}
                </h2>
                <p className="text-sm text-zoru-ink-muted mt-1">{error.message || 'The requested entity kind is not supported.'}</p>
            </div>
            <Button onClick={() => window.history.back()} variant="outline">
                Go back
            </Button>
        </div>
    );
}
