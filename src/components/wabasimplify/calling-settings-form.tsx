

'use client';

import { useState, useEffect, useTransition, useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import type { WithId, Project, PhoneNumber, CallingSettings } from '@/lib/definitions';
import { getPhoneNumberCallingSettings, savePhoneNumberCallingSettings } from '@/app/actions/calling.actions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LoaderCircle, Save, AlertCircle, Phone, Video, Router, Key } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

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
                    <CardTitle>Call Types & Inbound Control</CardTitle>
                    <CardDescription>Enable or disable voice/video calling and manage how incoming calls are handled.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label htmlFor="is_calling_enabled" className="text-base font-semibold flex items-center gap-2"><Phone className="h-4 w-4"/>Enable Voice & Video Calls</Label>
                            <p className="text-sm text-muted-foreground">Master switch to allow any calls to this number.</p>
                        </div>
                        <Switch id="is_calling_enabled" name="is_calling_enabled" defaultChecked={settings.is_calling_enabled || false} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="inbound_call_control">Inbound Call Handling</Label>
                        <Select name="inbound_call_control" defaultValue={settings.inbound_call_control || 'DISABLED'}>
                             <SelectTrigger id="inbound_call_control"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="DISABLED">Prevent incoming calls</SelectItem>
                                <SelectItem value="CALLBACK_REQUEST">Show "Request a callback" button</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <Separator className="my-6" />
            
            <div className="flex justify-end mt-8">
                <SaveButton />
            </div>
        </form>
    );
}
