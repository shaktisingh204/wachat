'use client';

import { useEffect } from 'react';
import { AmErrorAlert } from '@/app/dashboard/ad-manager/_components/am-page-shell';
import { Button } from '@/components/sabcrm/20ui/compat';
import { RefreshCw } from 'lucide-react';

export default function ConversionFunnelError({
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
        <div className="space-y-4">
            <AmErrorAlert 
                title="Something went wrong!" 
                description={error.message || "Failed to load the conversion funnel data."}
            />
            <Button onClick={() => reset()} variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" /> Try again
            </Button>
        </div>
    );
}
