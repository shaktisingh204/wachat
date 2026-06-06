'use client';

import { useEffect } from 'react';
import { Button, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, ZoruCardDescription } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from 'lucide-react';

export default function NewItemError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('[NewItemError]', error);
    }, [error]);

    return (
        <div className="flex h-[50vh] items-center justify-center p-6">
            <Card className="max-w-md w-full border-zoru-line">
                <ZoruCardHeader>
                    <div className="flex items-center gap-2 text-zoru-ink">
                        <AlertCircle className="h-5 w-5" />
                        <ZoruCardTitle>Failed to load</ZoruCardTitle>
                    </div>
                    <ZoruCardDescription>
                        We encountered an error while loading the source item.
                    </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <Button onClick={() => reset()} variant="outline" className="w-full">
                        Try again
                    </Button>
                </ZoruCardContent>
            </Card>
        </div>
    );
}
