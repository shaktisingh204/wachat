
'use client';

import { useState, useTransition, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { updatePhoneNumberCallingSettings } from '@/app/actions/whatsapp.actions';
import type { PhoneNumber } from '@/lib/definitions';
import { LoaderCircle } from 'lucide-react';

interface CallingToggleSwitchProps {
    projectId: string;
    phone: PhoneNumber;
    onUpdate: () => void;
}

export function CallingToggleSwitch({ projectId, phone, onUpdate }: CallingToggleSwitchProps) {
    const [isEnabled, setIsEnabled] = useState(phone.is_calling_enabled ?? false);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    useEffect(() => {
        setIsEnabled(phone.is_calling_enabled ?? false);
    }, [phone.is_calling_enabled]);

    const handleToggle = (checked: boolean) => {
        setIsEnabled(checked); // Optimistic update
        startTransition(async () => {
            const result = await updatePhoneNumberCallingSettings(projectId, phone.id, checked);
            if (result.success) {
                toast({ title: 'Success', description: `Calling has been ${checked ? 'enabled' : 'disabled'}.` });
                onUpdate(); // Re-fetch data on parent
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
                setIsEnabled(!checked); // Revert on failure
            }
        });
    };

    return (
        <div className="flex items-center gap-2">
            {isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
            <Switch
                id={`calling-switch-${phone.id}`}
                checked={isEnabled}
                onCheckedChange={handleToggle}
                disabled={isPending}
            />
        </div>
    );
}
