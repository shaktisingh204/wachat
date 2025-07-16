
'use client';

import { useState, useEffect, useTransition, useActionState, useRef } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { WeeklyHoursEditor } from './weekly-hours-editor';
import { HolidayScheduleEditor } from './holiday-schedule-editor';
import { timezones } from '@/lib/timezones';
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
        return <Skeleton className="h-96 w-full" />;
    }

    return (
        <form action={formAction}>
            <input type="hidden" name="projectId" value={project._id.toString()} />
            <input type="hidden" name="phoneNumberId" value={phone.id} />
            
             <Card>
                <CardHeader>
                    <CardTitle>Global Calling Settings</CardTitle>
                    <CardDescription>Master controls for the calling feature on this number.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label htmlFor="status" className="text-base font-semibold">Enable Calling</Label>
                            <p className="text-sm text-muted-foreground">Master switch to enable or disable all calling features.</p>
                        </div>
                        <input type="hidden" name="status" value={settings.status === 'ENABLED' ? 'ENABLED' : 'DISABLED'} />
                        <Switch id="status" checked={settings.status === 'ENABLED'} onCheckedChange={(checked) => setSettings(s => ({...s, status: checked ? 'ENABLED' : 'DISABLED'}))} />
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="call_icon_visibility">Call Icon Visibility</Label>
                            <Select name="call_icon_visibility" value={settings.call_icon_visibility || 'DEFAULT'} onValueChange={(val) => setSettings(s => ({...s, call_icon_visibility: val as any}))}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="DEFAULT">Default (Visible)</SelectItem>
                                    <SelectItem value="DISABLE_ALL">Disable All (Hidden)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="callback_permission_status">Callback Requests</Label>
                             <Select name="callback_permission_status" value={settings.callback_permission_status || 'DISABLED'} onValueChange={(val) => setSettings(s => ({...s, callback_permission_status: val as any}))}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ENABLED">Enabled</SelectItem>
                                    <SelectItem value="DISABLED">Disabled</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Separator className="my-6" />
            
            <Card>
                 <CardHeader>
                    <CardTitle>Business Hours</CardTitle>
                    <CardDescription>Define when your business is available for calls. Outside these hours, users will see the next available slot.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label htmlFor="call_hours_status" className="text-base font-semibold">Enforce Business Hours</Label>
                        </div>
                        <input type="hidden" name="call_hours_status" value={settings.call_hours?.status === 'ENABLED' ? 'ENABLED' : 'DISABLED'} />
                        <Switch id="call_hours_status" checked={settings.call_hours?.status === 'ENABLED'} onCheckedChange={(checked) => setSettings(s => ({...s, call_hours: {...s.call_hours, status: checked ? 'ENABLED' : 'DISABLED'} as any}))} />
                    </div>

                    {settings.call_hours?.status === 'ENABLED' && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="timezone_id">Timezone</Label>
                                <Select name="timezone_id" value={settings.call_hours?.timezone_id} onValueChange={(val) => setSettings(s => ({...s, call_hours: {...s.call_hours, timezone_id: val} as any}))}>
                                    <SelectTrigger searchable><SelectValue placeholder="Select a timezone..."/></SelectTrigger>
                                    <SelectContent>
                                        {timezones.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <WeeklyHoursEditor
                                hours={settings.call_hours?.weekly_operating_hours || []}
                                onChange={(newHours) => setSettings(s => ({...s, call_hours: {...s.call_hours, weekly_operating_hours: newHours} as any}))}
                            />
                             <input type="hidden" name="weeklyHours" value={JSON.stringify(settings.call_hours?.weekly_operating_hours || [])} />
                            
                             <HolidayScheduleEditor
                                schedule={settings.call_hours?.holiday_schedule || []}
                                onChange={(newSchedule) => setSettings(s => ({...s, call_hours: {...s.call_hours, holiday_schedule: newSchedule} as any}))}
                             />
                             <input type="hidden" name="holidaySchedule" value={JSON.stringify(settings.call_hours?.holiday_schedule || [])} />
                        </>
                    )}
                </CardContent>
            </Card>

            <div className="flex justify-end mt-8">
                <SaveButton />
            </div>
        </form>
    );
}
