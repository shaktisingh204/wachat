
'use client';

import { useState, useEffect, useTransition, useActionState, useCallback } from 'react';
import { useFormStatus } from 'react-dom';
import type { WithId, Project, PhoneNumber, CallingSettings, WeeklyOperatingHours, HolidaySchedule } from '@/lib/definitions';
import { getPhoneNumberCallingSettings, savePhoneNumberCallingSettings } from '@/app/actions/calling.actions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LoaderCircle, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { WeeklyHoursEditor } from './weekly-hours-editor';
import { HolidayScheduleEditor } from './holiday-schedule-editor';
import { timezones } from '@/lib/timezones';
import { Textarea } from '../ui/textarea';

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
    onSuccess: () => void;
}

export function CallingSettingsForm({ project, phone, onSuccess }: CallingSettingsFormProps) {
    const [settings, setSettings] = useState<Partial<CallingSettings>>({});
    const [isLoading, startLoading] = useTransition();
    const [saveState, formAction] = useActionState(savePhoneNumberCallingSettings, saveInitialState);
    const { toast } = useToast();
    
    const [weeklyHours, setWeeklyHours] = useState<WeeklyOperatingHours[]>([]);
    const [holidaySchedule, setHolidaySchedule] = useState<HolidaySchedule[]>([]);
    
    const fetchSettings = useCallback(() => {
        startLoading(async () => {
            const result = await getPhoneNumberCallingSettings(project._id.toString(), phone.id);
            if (result.error) {
                toast({ title: "Error", description: `Could not fetch settings: ${result.error}`, variant: 'destructive' });
            } else {
                setSettings(result.settings || {});
                setWeeklyHours(result.settings?.call_hours?.weekly_operating_hours || []);
                setHolidaySchedule(result.settings?.call_hours?.holiday_schedule || []);
            }
        });
    }, [project, phone, toast]);
    
    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);
    
    useEffect(() => {
        if (saveState.success) {
            toast({ title: 'Success!', description: 'Calling settings saved successfully.' });
            onSuccess();
        }
        if (saveState.error) {
            toast({ title: 'Error Saving Settings', description: saveState.error, variant: 'destructive' });
        }
    }, [saveState, toast, onSuccess]);


    if (isLoading) {
        return <Skeleton className="h-96 w-full" />;
    }

    return (
        <form action={formAction}>
            <input type="hidden" name="projectId" value={project._id.toString()} />
            <input type="hidden" name="phoneNumberId" value={phone.id} />
            <input type="hidden" name="weekly_operating_hours" value={JSON.stringify(weeklyHours)} />
            <input type="hidden" name="holiday_schedule" value={JSON.stringify(holidaySchedule)} />
            
            <Accordion type="multiple" defaultValue={['general']} className="w-full space-y-4">
                <AccordionItem value="general">
                    <AccordionTrigger>General Settings</AccordionTrigger>
                    <AccordionContent className="pt-2">
                        <Card>
                            <CardContent className="pt-6 space-y-6">
                                <div className="space-y-2"><Label>Calling Status</Label><Select name="status" defaultValue={settings.status || 'DISABLED'}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="ENABLED">Enabled</SelectItem><SelectItem value="DISABLED">Disabled</SelectItem></SelectContent></Select></div>
                                <div className="space-y-2">
                                    <Label>Call Icon Visibility</Label>
                                    <Select name="call_icon_visibility" defaultValue={settings.call_icon_visibility || 'DEFAULT'}>
                                        <SelectTrigger><SelectValue/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="DEFAULT">Default (Visible to all)</SelectItem>
                                            <SelectItem value="DISABLE_ALL">Disable All (Hidden for all)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                 <div className="space-y-2">
                                    <Label htmlFor="restrict_to_user_countries">Restrict to Countries (Optional)</Label>
                                    <Input id="restrict_to_user_countries" name="restrict_to_user_countries" defaultValue={settings.call_icons?.restrict_to_user_countries?.join(', ')} placeholder="e.g. US, BR, IN" />
                                    <p className="text-xs text-muted-foreground">Comma-separated list of ISO 3166-1 alpha-2 country codes where the call icon should appear.</p>
                                </div>
                                <div className="space-y-2"><Label>Callback Permission</Label><Select name="callback_permission_status" defaultValue={settings.callback_permission_status || 'DISABLED'}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="ENABLED">Enabled</SelectItem><SelectItem value="DISABLED">Disabled</SelectItem></SelectContent></Select></div>
                            </CardContent>
                        </Card>
                    </AccordionContent>
                </AccordionItem>

                 <AccordionItem value="hours">
                    <AccordionTrigger>Business Hours</AccordionTrigger>
                    <AccordionContent className="pt-2">
                         <Card>
                             <CardContent className="pt-6 space-y-6">
                                <div className="space-y-2"><Label>Business Hours Status</Label><Select name="call_hours_status" defaultValue={settings.call_hours?.status || 'DISABLED'}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="ENABLED">Enabled</SelectItem><SelectItem value="DISABLED">Disabled</SelectItem></SelectContent></Select></div>
                                <div className="space-y-2"><Label>Timezone</Label><Select name="timezone_id" defaultValue={settings.call_hours?.timezone_id}><SelectTrigger><SelectValue placeholder="Select a timezone..."/></SelectTrigger><SelectContent>{timezones.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}</SelectContent></Select></div>
                                <WeeklyHoursEditor hours={weeklyHours} onChange={setWeeklyHours} />
                                <HolidayScheduleEditor schedule={holidaySchedule} onChange={setHolidaySchedule} />
                             </CardContent>
                         </Card>
                    </AccordionContent>
                </AccordionItem>
                
                 <AccordionItem value="sip">
                    <AccordionTrigger>SIP Integration</AccordionTrigger>
                    <AccordionContent className="pt-2">
                        <Card>
                             <CardContent className="pt-6 space-y-6">
                                <div className="space-y-2"><Label>SIP Status</Label><Select name="sip_status" defaultValue={settings.sip?.status || 'DISABLED'}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="ENABLED">Enabled</SelectItem><SelectItem value="DISABLED">Disabled</SelectItem></SelectContent></Select></div>
                                <div className="space-y-2"><Label>SIP Hostname</Label><Input name="sip_hostname" defaultValue={settings.sip?.servers?.[0]?.hostname || ''}/></div>
                                <div className="space-y-2"><Label>SIP Port</Label><Input type="number" name="sip_port" defaultValue={settings.sip?.servers?.[0]?.port || ''}/></div>
                                <div className="space-y-2"><Label>SIP URI Params (JSON)</Label><Textarea name="sip_params" placeholder='{ "transport": "tcp" }' defaultValue={settings.sip?.servers?.[0]?.request_uri_user_params ? JSON.stringify(settings.sip.servers[0].request_uri_user_params, null, 2) : ''}/></div>
                             </CardContent>
                        </Card>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
            
            <div className="flex justify-end mt-8">
                <SaveButton />
            </div>
        </form>
    );
}
