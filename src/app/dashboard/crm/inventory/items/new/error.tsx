'use client';

import { useEffect } from 'react';
import { Button, Card, CardBody, CardHeader, CardTitle, CardDescription } from '@/components/sabcrm/20ui';
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
            <Card className="max-w-md w-full border-[var(--st-border)]">
                <CardHeader>
                    <div className="flex items-center gap-2 text-[var(--st-text)]">
                        <AlertCircle className="h-5 w-5" />
                        <CardTitle>Failed to load</CardTitle>
                    </div>
                    <CardDescription>
                        We encountered an error while loading the source item.
                    </CardDescription>
                </CardHeader>
                <CardBody>
                    <Button onClick={() => reset()} variant="outline" className="w-full">
                        Try again
                    </Button>
                </CardBody>
            </Card>
        </div>
    );
}
