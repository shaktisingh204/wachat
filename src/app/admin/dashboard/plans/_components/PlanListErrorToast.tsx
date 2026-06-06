'use client';

import { useEffect } from 'react';
import { useToast } from '@/components/sabcrm/20ui';

export function PlanListErrorToast() {
    const { toast } = useToast();
    
    useEffect(() => {
        toast({
            title: 'Error',
            description: 'Failed to fetch subscription plans.',
            variant: 'destructive',
        });
    }, [toast]);

    return null;
}
