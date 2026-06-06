'use client';

import * as React from 'react';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/sabcrm/20ui/compat';

import {
    acknowledgeSabmonitorIncident,
    resolveSabmonitorIncident,
} from '@/app/actions/sabmonitor.actions';
import type { SabmonitorIncidentDoc } from '@/lib/rust-client/sabmonitor-incidents';

export function IncidentActions({ incident }: { incident: SabmonitorIncidentDoc }): React.JSX.Element {
    const [pending, startTransition] = useTransition();
    const router = useRouter();
    if (incident.status === 'resolved') {
        return <span className="text-[12px] text-[var(--st-text-secondary)]">closed</span>;
    }
    return (
        <div className="flex items-center justify-end gap-2">
            {!incident.acknowledgedBy && (
                <Button
                    variant="outline"
                    onClick={() =>
                        startTransition(async () => {
                            if (!incident._id) return;
                            await acknowledgeSabmonitorIncident(incident._id);
                            router.refresh();
                        })
                    }
                    disabled={pending}
                >
                    Ack
                </Button>
            )}
            <Button
                onClick={() =>
                    startTransition(async () => {
                        if (!incident._id) return;
                        await resolveSabmonitorIncident(incident._id);
                        router.refresh();
                    })
                }
                disabled={pending}
            >
                Resolve
            </Button>
        </div>
    );
}
