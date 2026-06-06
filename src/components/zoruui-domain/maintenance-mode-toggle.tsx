'use client';

import { Switch, Label, Skeleton, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/sabcrm/20ui';
import { useState, useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import { LoaderCircle } from 'lucide-react';

export function MaintenanceModeToggle() {
    const [isEnabled, setIsEnabled] = useState(false);
    const [isUpdating, startUpdateTransition] = useTransition();
    const [showConfirm, setShowConfirm] = useState(false);
    const [pendingState, setPendingState] = useState(false);
    const { toast } = useToast();

    const onCheckedChange = (checked: boolean) => {
        setPendingState(checked);
        setShowConfirm(true);
    };
    
    const handleConfirm = () => {
        setShowConfirm(false);
        setIsEnabled(pendingState); // Optimistic update
        
        startUpdateTransition(async () => {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            toast({ 
                title: 'Success', 
                description: `Maintenance mode has been ${pendingState ? 'enabled' : 'disabled'}.` 
            });
        });
    };

    const handleCancel = () => {
        setShowConfirm(false);
    };

    return (
        <>
            <div className="flex items-center justify-between rounded-lg border p-4 shadow-sm">
                <div className="space-y-0.5">
                    <Label htmlFor="maintenance-switch" className="text-base font-semibold">Maintenance Mode</Label>
                    <p className="text-sm text-[var(--st-text-secondary)]">
                        Put the system into maintenance mode. Regular users will see a maintenance page.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {isUpdating && <LoaderCircle className="h-4 w-4 animate-spin text-[var(--st-text-secondary)]" />}
                    <Switch
                        id="maintenance-switch"
                        checked={isEnabled}
                        onCheckedChange={onCheckedChange}
                        disabled={isUpdating}
                    />
                </div>
            </div>

            <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{pendingState ? 'Enable' : 'Disable'} Maintenance Mode?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingState 
                                ? 'Are you sure you want to enable maintenance mode? All regular users will be logged out and presented with a maintenance screen.' 
                                : 'Are you sure you want to disable maintenance mode? The system will become available to all users again.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirm}>
                            Continue
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
