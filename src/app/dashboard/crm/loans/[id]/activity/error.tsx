'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

export default function ActivityError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('[Loan Activity Error]', error);
    }, [error]);

    return (
        <EntityDetailShell
            title="Activity Error"
            eyebrow="LOAN ACTIVITY"
        >
            <Card className="border-red-200 dark:border-red-900">
                <ZoruCardHeader>
                    <ZoruCardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                        <AlertTriangle className="h-5 w-5" />
                        Something went wrong
                    </ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-4">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        We couldn't load the activity log for this loan. {error.message}
                    </p>
                    <Button onClick={() => reset()} variant="outline">
                        Try again
                    </Button>
                </ZoruCardContent>
            </Card>
        </EntityDetailShell>
    );
}
