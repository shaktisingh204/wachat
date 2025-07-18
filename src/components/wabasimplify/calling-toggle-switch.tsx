'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { getPhoneNumberCallingSettings } from '@/app/actions/calling.actions';
import { savePhoneNumberCallingSettings } from '@/app/actions/whatsapp.actions';
import type { CallingSettings, PhoneNumber, WithId, Project } from '@/lib/definitions';
import { LoaderCircle } from 'lucide-react';

interface CallingToggleSwitchProps {
    projectId: string;
    phone: PhoneNumber;
    onUpdate: () => void;
}

export function CallingToggleSwitch({ projectId, phone, onUpdate }: CallingToggleSwitchProps) {
    const [settings, setSettings] = useState<Partial<CallingSettings>>({});
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const fetchSettings = useCallback(() => {
        getPhoneNumberCallingSettings(projectId, phone.id).then(result => {
            if (result.settings) {
                setSettings(result.settings);
            }
        });
    }, [projectId, phone.id]);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const handleToggle = (checked: boolean) => {
        startTransition(async () => {
            const result = await savePhoneNumberCallingSettings(projectId, phone.id, checked, phone.inbound_call_control || 'DISABLED');
            if (result.success) {
                toast({ title: 'Success', description: `Calling has been ${checked ? 'enabled' : 'disabled'}.` });
                onUpdate();
                fetchSettings(); // Re-fetch to get the latest state
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    };
    
    const isChecked = phone.is_calling_enabled || false;

    return (
        <div className="flex items-center gap-2">
            {isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
            <Switch
                id={`calling-switch-${phone.id}`}
                checked={isChecked}
                onCheckedChange={handleToggle}
                disabled={isPending}
            />
        </div>
    );
}