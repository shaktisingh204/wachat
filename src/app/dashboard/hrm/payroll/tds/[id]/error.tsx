'use client';

import { useEffect } from 'react';
import { Button, Card } from '@/components/zoruui';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function TdsDetailError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('TDS Detail Error:', error);
        toast.error('Failed to load TDS record details.');
    }, [error]);

    return (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
            <AlertTriangle className="mb-4 h-12 w-12 text-zoru-error" />
            <h2 className="mb-2 text-lg font-semibold text-zoru-ink">Something went wrong!</h2>
            <p className="mb-6 text-sm text-zoru-ink-muted">
                {error.message || 'An unexpected error occurred while loading the TDS record.'}
            </p>
            <Button onClick={() => reset()} variant="secondary">
                Try again
            </Button>
        </Card>
    );
}
