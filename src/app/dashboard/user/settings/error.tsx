'use client';

import { useEffect } from 'react';
import { Card, ZoruCardHeader, ZoruCardTitle, ZoruCardDescription, ZoruCardContent, Button } from '@/components/sabcrm/20ui/compat';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

export default function SettingsError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Settings page error:', error);
    }, [error]);

    return (
        <div className="flex h-[50vh] items-center justify-center">
            <Card className="max-w-md w-full border-destructive/50">
                <ZoruCardHeader>
                    <div className="flex items-center gap-2 text-zoru-ink mb-2">
                        <AlertTriangle className="h-5 w-5" />
                        <ZoruCardTitle>Something went wrong!</ZoruCardTitle>
                    </div>
                    <ZoruCardDescription>
                        An error occurred while loading your settings.
                    </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-4">
                    <div className="p-3 bg-zoru-surface-2 rounded-md text-sm font-mono text-zoru-ink-muted break-all">
                        {error.message || 'Unknown error'}
                    </div>
                    <Button onClick={() => reset()} className="w-full">
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Try again
                    </Button>
                </ZoruCardContent>
            </Card>
        </div>
    );
}
