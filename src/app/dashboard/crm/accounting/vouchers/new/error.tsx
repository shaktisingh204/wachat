'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui/compat';
import { Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, ZoruCardDescription } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from 'lucide-react';

export default function VouchersError({
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
                <ZoruCardHeader>
                    <div className="flex items-center gap-2 text-[var(--st-text)]">
                        <AlertCircle className="h-5 w-5" />
                        <ZoruCardTitle>Something went wrong!</ZoruCardTitle>
                    </div>
                    <ZoruCardDescription>
                        We encountered an error while trying to load the voucher page.
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
