'use client';

import { useEffect, useState, useTransition } from 'react';
import { Badge } from '@/components/sabcrm/20ui/compat';
import { getIntegrationById } from '@/app/actions/crm-integrations.actions';

export function SyncStatusMonitor({
    integrationId,
    initialStatus,
}: {
    integrationId: string;
    initialStatus?: string;
}) {
    const [status, setStatus] = useState(initialStatus);

    useEffect(() => {
        // Poll every 5 seconds for status changes
        const interval = setInterval(async () => {
            const doc = await getIntegrationById(integrationId);
            if (doc && doc.syncStatus !== status) {
                setStatus(doc.syncStatus);
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [integrationId, status]);

    if (!status) return null;

    return (
        <Badge variant="info" className="capitalize">
            Sync: {status}
        </Badge>
    );
}
