'use client';

import { useEffect } from 'react';
import { Button } from '@/components/zoruui';
import { AlertCircle } from 'lucide-react';

export default function ErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('WhatsApp Projects Admin page error:', error);
    }, [error]);

    return (
        <div className="flex h-[400px] w-full flex-col items-center justify-center space-y-4 rounded-xl border border-slate-200 bg-slate-50 px-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <div className="space-y-1">
                <h2 className="text-lg font-semibold text-slate-900">Something went wrong!</h2>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                    {error.message || 'An unexpected error occurred while loading the WhatsApp projects.'}
                </p>
            </div>
            <Button
                onClick={() => reset()}
                variant="outline"
                className="mt-4 border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
            >
                Try again
            </Button>
        </div>
    );
}
