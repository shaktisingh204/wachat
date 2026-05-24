'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/zoruui';

export function SyncGstnButton() {
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSync = async () => {
        setIsSyncing(true);
        // Simulate API call to sync with GSTN
        await new Promise((resolve) => setTimeout(resolve, 1500));
        setIsSyncing(false);
        alert('Successfully synced with GSTN Portal / E-invoicing APIs.');
    };

    return (
        <Button
            variant="outline"
            className="h-9 gap-2 text-[13px]"
            onClick={handleSync}
            disabled={isSyncing}
        >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync GSTN Portal'}
        </Button>
    );
}
