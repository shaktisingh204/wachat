

'use client';

import { useState, useEffect, useTransition, useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import type { WithId, Project, PhoneNumber, CallingSettings } from '@/lib/definitions';
import { getPhoneNumberCallingSettings, savePhoneNumberCallingSettings } from '@/app/actions/whatsapp.actions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LoaderCircle, Save, AlertCircle, Phone, Video, Key, Router } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Input } from '../ui/input';

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
    const [settings, setSettings] = useState<Partial<CallingSettings>>({});
    const [isLoading, startLoading] = useTransition();
    const [saveState, formAction] = useActionState(savePhoneNumberCallingSettings, saveInitialState);
    const { toast } = useToast();
    
    useEffect(() => {
        startLoading(async () => {
            const result = await getPhoneNumberCallingSettings(project._id.toString(), phone.id);
            if (result.error) {
                toast({ title: "Error", description: `Could not fetch settings: ${result.error}`, variant: 'destructive' });
            } else {
                setSettings(result.settings || {});
            }
        });
    }, [project, phone, toast]);
    
    useEffect(() => {
        if (saveState.success) {
            toast({ title: 'Success!', description: 'Calling settings have been updated.' });
            startLoading(async () => {
                const result = await getPhoneNumberCallingSettings(project._id.toString(), phone.id);
                setSettings(result.settings || {});
            });
        }
        if (saveState.error) {
            toast({ title: 'Error', description: saveState.error, variant: 'destructive' });
        }
    }, [saveState, toast, project, phone]);

    if (isLoading) {
        return <Skeleton className="h-96 w-full" />;
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
                <CardContent className="space-y-4">
                     <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label htmlFor="voice_enabled" className="text-base font-semibold flex items-center gap-2"><Phone className="h-4 w-4"/>Enable Voice Calls</Label>
                        </div>
                        <Switch id="voice_enabled" name="voice_enabled" defaultChecked={settings.voice?.enabled || false} />
                    </div>
                     <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label htmlFor="video_enabled" className="text-base font-semibold flex items-center gap-2"><Video className="h-4 w-4"/>Enable Video Calls</Label>
                        </div>
                        <Switch id="video_enabled" name="video_enabled" defaultChecked={settings.video?.enabled || false} />
                    </div>
                </CardContent>
            </Card>

            <Separator className="my-6" />

            <Card>
                <CardHeader>
                    <CardTitle>SIP Integration</CardTitle>
                    <CardDescription>Route WhatsApp calls to your external telephony system via SIP.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label htmlFor="sip_enabled" className="text-base font-semibold flex items-center gap-2"><Router className="h-4 w-4"/>Enable SIP</Label>
                        </div>
                        <Switch id="sip_enabled" name="sip_enabled" defaultChecked={settings.sip?.enabled || false} />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="sip_uri">SIP URI</Label>
                        <Input id="sip_uri" name="sip_uri" defaultValue={settings.sip?.uri} placeholder="e.g., sip.example.com" />
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <Label htmlFor="sip_username">SIP Username</Label>
                            <Input id="sip_username" name="sip_username" defaultValue={settings.sip?.username} />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="sip_password">SIP Password</Label>
                            <Input id="sip_password" name="sip_password" type="password" defaultValue={settings.sip?.password} />
                        </div>
                    </div>
                </CardContent>
            </Card>
            
            <div className="flex justify-end mt-8">
                <SaveButton />
            </div>
        </form>
    );
}
