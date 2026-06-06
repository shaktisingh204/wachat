'use client';

import { Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, Button } from '@/components/sabcrm/20ui/compat';
import { AlertCircle } from 'lucide-react';

export default function InventoryItemDetailError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="flex h-[50vh] w-full items-center justify-center p-6">
            <Card className="max-w-md w-full border-[var(--st-danger)]/20">
                <ZoruCardHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-danger)]/10">
                        <AlertCircle className="h-6 w-6 text-[var(--st-danger)]" />
                    </div>
                    <ZoruCardTitle className="text-lg">Item Error</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent className="text-center space-y-4">
                    <p className="text-sm text-[var(--st-text-secondary)]">
                        We couldn't load the inventory item details.
                    </p>
                    <Button onClick={() => reset()} variant="outline">
                        Try again
                    </Button>
                </ZoruCardContent>
            </Card>
        </div>
    );
}
