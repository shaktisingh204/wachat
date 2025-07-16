
'use client';

import { useState, useTransition, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { savePhoneNumberCallingSettings, getPhoneNumberCallingSettings } from '@/app/actions/calling.actions';
import type { CallingSettings, PhoneNumber } from '@/lib/definitions';
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

    useEffect(() => {
        // Fetch initial settings to ensure we have the full object
        getPhoneNumberCallingSettings(projectId, phone.id).then(result => {
            if (result.settings) {
                setSettings(result.settings);
            } else {
                 setSettings({ voice: { enabled: false }, video: { enabled: false } });
            }
        });
    }, [projectId, phone.id]);

    const handleToggle = (checked: boolean) => {
        startTransition(async () => {
            const formData = new FormData();
            formData.append('projectId', projectId);
            formData.append('phoneNumberId', phone.id);
            formData.append('voice_enabled', checked ? 'on' : 'off');
            // Preserve other settings
            formData.append('video_enabled', settings.video?.enabled ? 'on' : 'off');
            if (settings.sip?.enabled) {
                formData.append('sip_enabled', 'on');
                formData.append('sip_uri', settings.sip.uri || '');
                formData.append('sip_username', settings.sip.username || '');
                formData.append('sip_password', settings.sip.password || '');
            }

            const result = await savePhoneNumberCallingSettings(null, formData);
            if (result.success) {
                toast({ title: 'Success', description: `Calling has been ${checked ? 'enabled' : 'disabled'}.` });
                onUpdate(); // Re-fetch data on parent
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    };

    return (
        <div className="flex items-center gap-2">
            {isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
            <Switch
                id={`calling-switch-${phone.id}`}
                checked={settings.voice?.enabled || false}
                onCheckedChange={handleToggle}
                disabled={isPending}
            />
        </div>
    );
}
