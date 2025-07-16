

'use client';

import { useState, useEffect, useTransition, useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import type { WithId, Project, PhoneNumber, CallingSettings } from '@/lib/definitions';
import { getPhoneNumberCallingSettings, savePhoneNumberCallingSettings } from '@/app/actions/calling.actions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LoaderCircle, Save, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

const saveInitialState = { success: false, error: undefined };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Calling Settings
    </Button>
  );
}

interface CallingSettingsFormProps {
    project: WithId<Project>;
    phone: PhoneNumber;
}

export function CallingSettingsForm({ project, phone }: CallingSettingsFormProps) {
    const [settings, setSettings] = useState<Partial<CallingSettings>>({
        voice: { enabled: false },
        video: { enabled: false }
    });
    const [isLoading, startLoading] = useTransition();
    const [saveState, formAction] = useActionState(savePhoneNumberCallingSettings, saveInitialState);
    const { toast } = useToast();
    
    useEffect(() => {
        startLoading(async () => {
            const result = await getPhoneNumberCallingSettings(project._id.toString(), phone.id);
            if (result.error) {
                toast({ title: "Error", description: `Could not fetch settings: ${result.error}`, variant: 'destructive' });
            } else {
                setSettings(result.settings || { voice: { enabled: false }, video: { enabled: false } });
            }
        });
    }, [project, phone, toast]);
    
    useEffect(() => {
        if (saveState.success) {
            toast({ title: 'Success!', description: 'Calling settings have been updated.' });
        }
        if (saveState.error) {
            toast({ title: 'Error', description: saveState.error, variant: 'destructive' });
        }
    }, [saveState, toast]);

    if (isLoading) {
        return <Skeleton className="h-64 w-full" />;
    }

    return (
        <form action={formAction}>
            <input type="hidden" name="projectId" value={project._id.toString()} />
            <input type="hidden" name="phoneNumberId" value={phone.id} />
            
             <Card>
                <CardHeader>
                    <CardTitle>Call Types</CardTitle>
                    <CardDescription>Enable or disable voice and video calling for this number.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label htmlFor="voice_enabled" className="text-base font-semibold">Enable Voice Calls</Label>
                            <p className="text-sm text-muted-foreground">Allow users to place voice calls to this number.</p>
                        </div>
                        <input type="hidden" name="voice_enabled" value={settings.voice?.enabled ? 'on' : 'off'} />
                        <Switch id="voice_enabled" checked={settings.voice?.enabled || false} onCheckedChange={(checked) => setSettings(s => ({...s, voice: { ...s.voice, enabled: checked }}))} />
                    </div>
                     <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label htmlFor="video_enabled" className="text-base font-semibold">Enable Video Calls</Label>
                            <p className="text-sm text-muted-foreground">Allow users to place video calls to this number.</p>
                        </div>
                        <input type="hidden" name="video_enabled" value={settings.video?.enabled ? 'on' : 'off'} />
                        <Switch id="video_enabled" checked={settings.video?.enabled || false} onCheckedChange={(checked) => setSettings(s => ({...s, video: { ...s.video, enabled: checked }}))} />
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end mt-8">
                <SaveButton />
            </div>
        </form>
    );
}
