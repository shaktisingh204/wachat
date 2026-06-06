'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui';
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from '@/components/sabcrm/20ui';
import { AlertCircle } from 'lucide-react';

export default function EstimatesError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="flex h-[50vh] items-center justify-center">
            <Card className="max-w-md w-full border-[var(--st-border)]">
                <CardHeader>
                    <div className="flex items-center gap-2 text-[var(--st-text)]">
                        <AlertCircle className="h-5 w-5" />
                        <CardTitle>Something went wrong!</CardTitle>
                    </div>
                    <CardDescription>
                        We encountered an error while trying to load your estimates.
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
