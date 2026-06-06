'use client';

import { useEffect } from 'react';
import { Button } from '@/components/sabcrm/20ui';
import { Card, CardBody as ZoruCardContent, CardHeader as ZoruCardHeader, CardTitle as ZoruCardTitle } from '@/components/sabcrm/20ui';
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
            <Card className="border-[var(--st-border)] dark:border-[var(--st-border)]">
                <ZoruCardHeader>
                    <ZoruCardTitle className="flex items-center gap-2 text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">
                        <AlertTriangle className="h-5 w-5" />
                        Something went wrong
                    </ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-4">
                    <p className="text-sm text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">
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
