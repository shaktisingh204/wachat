
'use client';

import { useState, useEffect, useTransition } from 'react';
import { getWebhookProcessingStatus, setWebhookProcessingStatus } from '@/app/actions/admin.actions';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { LoaderCircle } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

export function WebhookProcessingToggle() {
    const [isEnabled, setIsEnabled] = useState(true);
    const [isLoading, startLoadingTransition] = useTransition();
    const [isUpdating, startUpdateTransition] = useTransition();
    const { toast } = useToast();

    useEffect(() => {
        startLoadingTransition(async () => {
            const { enabled } = await getWebhookProcessingStatus();
            setIsEnabled(enabled);
        });
    }, []);

    const onCheckedChange = async (checked: boolean) => {
        setIsEnabled(checked); // Optimistic update
        startUpdateTransition(async () => {
            const result = await setWebhookProcessingStatus(checked);
            if (result.success) {
                toast({ title: 'Success', description: `Webhook processing has been ${checked ? 'enabled' : 'disabled'}.` });
            } else {
                toast({ title: 'Error', description: 'Failed to update setting.', variant: 'destructive' });
                setIsEnabled(!checked); // Revert on failure
            }
        });
    };
    
    if(isLoading) {
        return <Skeleton className="h-10 w-full" />
    }

    return (
        <div className="flex items-center justify-between rounded-lg border p-4 shadow-sm">
            <div className="space-y-0.5">
                <Label htmlFor="webhook-switch" className="text-base font-semibold">Webhook Processing</Label>
                <p className="text-sm text-muted-foreground">
                    Globally enable or disable processing of incoming webhooks from Meta.
                </p>
            </div>
            <div className="flex items-center gap-2">
                 {(isLoading || isUpdating) && <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" />}
                <Switch
                    id="webhook-switch"
                    checked={isEnabled}
                    onCheckedChange={onCheckedChange}
                    disabled={isUpdating}
                />
            </div>
        </div>
    );
}
