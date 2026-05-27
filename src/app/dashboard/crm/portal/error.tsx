'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/zoruui';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

export default function PortalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Portal Error:', error);
    }, [error]);

    return (
        <EntityDetailShell
            eyebrow="ERROR"
            title="Portal Access Error"
            back={{ href: '/dashboard/crm/portal', label: 'Back to Customer Portal' }}
        >
            <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-zoru-line bg-zoru-surface p-8 text-center animate-in fade-in-50">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zoru-ink/10 text-zoru-ink">
                    <AlertCircle className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                    <h3 className="text-lg font-semibold tracking-tight text-zoru-ink">Portal Error</h3>
                    <p className="text-sm text-zoru-ink-muted max-w-[400px]">
                        {error.message || 'We encountered a problem loading the customer portal page.'}
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={reset}
                    className="mt-4 gap-2"
                >
                    <RefreshCcw className="h-4 w-4" />
                    Try again
                </Button>
            </div>
        </EntityDetailShell>
    );
}
