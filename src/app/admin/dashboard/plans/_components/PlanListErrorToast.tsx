'use client';

import { useEffect } from 'react';
import { useZoruToast } from '@/components/sabcrm/20ui/compat';

export function PlanListErrorToast() {
    const { toast } = useZoruToast();
    
    useEffect(() => {
        toast({
            title: 'Error',
            description: 'Failed to fetch subscription plans.',
            variant: 'destructive',
        });
    }, [toast]);

    return null;
}
