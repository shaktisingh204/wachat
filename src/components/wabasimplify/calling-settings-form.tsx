'use client';

import {
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  Button,
  Skeleton,
  Label,
  Input,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Accordion,
  ZoruAccordionContent,
  ZoruAccordionItem,
  ZoruAccordionTrigger,
  Textarea,
} from '@/components/zoruui';
import {
  useState,
  useEffect,
  useTransition,
  useActionState,
  useCallback } from 'react';
import { useFormStatus } from 'react-dom';
import type { WithId,
  Project,
  PhoneNumber,
  CallingSettings,
  WeeklyOperatingHours,
  HolidaySchedule } from '@/lib/definitions';
import { getPhoneNumberCallingSettings,
  savePhoneNumberCallingSettings } from '@/app/actions/calling.actions';
import { LoaderCircle, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { WeeklyHoursEditor } from './weekly-hours-editor';
import { HolidayScheduleEditor } from './holiday-schedule-editor';
import { timezones } from '@/lib/timezones';

import { recordApiCall } from '@/lib/calls/api-log';

const saveInitialState = { success: false, error: undefined };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" size="lg" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Calling Settings
    </ZoruButton>
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
                recordApiCall({
                    method: 'GET',
                    status: 'ERROR',
                    summary: `Fetch settings for ${phone.display_phone_number}`,
                    errorMessage: result.error,
                });
            } else {
                setSettings(result.settings || {});
                setWeeklyHours(result.settings?.call_hours?.weekly_operating_hours || []);
                setHolidaySchedule(result.settings?.call_hours?.holiday_schedule || []);
                recordApiCall({
                    method: 'GET',
                    status: 'SUCCESS',
                    summary: `Fetched settings for ${phone.display_phone_number}`,
                });
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
            recordApiCall({
                method: 'POST',
                status: 'ERROR',
                summary: `Save settings for ${phone.display_phone_number}`,
                errorMessage: saveState.error,
            });
        }
    }, [saveState, toast, onSuccess, phone.display_phone_number]);

    if (isLoading) {
        return <ZoruSkeleton className="h-96 w-full" />;
    }

    return (
        <form action={formAction}>
            <input type="hidden" name="projectId" value={project._id.toString()} />
            <input type="hidden" name="phoneNumberId" value={phone.id} />
            <input type="hidden" name="weekly_operating_hours" value={JSON.stringify(weeklyHours)} />
            <input type="hidden" name="holiday_schedule" value={JSON.stringify(holidaySchedule)} />
            
            <ZoruAccordion type="multiple" defaultValue={['general']} className="w-full space-y-4">
                <ZoruAccordionItem value="general">
                    <ZoruAccordionTrigger>General Settings</ZoruAccordionTrigger>
                    <ZoruAccordionContent className="pt-2">
                        <ZoruCard>
                            <ZoruCardContent className="pt-6 space-y-6">
                                <div className="space-y-2"><ZoruLabel>Calling Status</ZoruLabel><ZoruSelect name="status" defaultValue={settings.status || 'DISABLED'}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="ENABLED">Enabled</ZoruSelectItem><ZoruSelectItem value="DISABLED">Disabled</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                                <div className="space-y-2">
                                    <ZoruLabel>Call Icon Visibility</ZoruLabel>
                                    <ZoruSelect name="call_icon_visibility" defaultValue={settings.call_icon_visibility || 'DEFAULT'}>
                                        <ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger>
                                        <ZoruSelectContent>
                                            <ZoruSelectItem value="DEFAULT">Default (Visible to all)</ZoruSelectItem>
                                            <ZoruSelectItem value="DISABLE_ALL">Disable All (Hidden)</ZoruSelectItem>
                                        </ZoruSelectContent>
                                    </ZoruSelect>
                                </div>
                                 <div className="space-y-2">
                                    <ZoruLabel htmlFor="restrict_to_user_countries">Restrict to Countries (Optional)</ZoruLabel>
                                    <ZoruInput id="restrict_to_user_countries" name="restrict_to_user_countries" defaultValue={settings.call_icons?.restrict_to_user_countries?.join(', ')} placeholder="e.g. US, BR, IN" />
                                    <p className="text-xs text-muted-foreground">Comma-separated list of ISO 3166-1 alpha-2 country codes where the call icon should appear.</p>
                                </div>
                                <div className="space-y-2"><ZoruLabel>Callback Permission Prompt</ZoruLabel><ZoruSelect name="callback_permission_status" defaultValue={settings.callback_permission_status || 'DISABLED'}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="ENABLED">Enabled (Show Prompt)</ZoruSelectItem><ZoruSelectItem value="DISABLED">Disabled</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                            </ZoruCardContent>
                        </ZoruCard>
                    </ZoruAccordionContent>
                </ZoruAccordionItem>

                 <ZoruAccordionItem value="hours">
                    <ZoruAccordionTrigger>Business Hours</ZoruAccordionTrigger>
                    <ZoruAccordionContent className="pt-2">
                         <ZoruCard>
                             <ZoruCardContent className="pt-6 space-y-6">
                                <div className="space-y-2"><ZoruLabel>Business Hours Status</ZoruLabel><ZoruSelect name="call_hours_status" defaultValue={settings.call_hours?.status || 'DISABLED'}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="ENABLED">Enabled</ZoruSelectItem><ZoruSelectItem value="DISABLED">Disabled</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                                <div className="space-y-2"><ZoruLabel>Timezone</ZoruLabel><ZoruSelect name="timezone_id" defaultValue={settings.call_hours?.timezone_id}><ZoruSelectTrigger><ZoruSelectValue placeholder="Select a timezone..."/></ZoruSelectTrigger><ZoruSelectContent>{timezones.map(tz => <ZoruSelectItem key={tz} value={tz}>{tz}</ZoruSelectItem>)}</ZoruSelectContent></ZoruSelect></div>
                                <WeeklyHoursEditor hours={weeklyHours} onChange={setWeeklyHours} />
                                <HolidayScheduleEditor schedule={holidaySchedule} onChange={setHolidaySchedule} />
                             </ZoruCardContent>
                         </ZoruCard>
                    </ZoruAccordionContent>
                </ZoruAccordionItem>
                
                 <ZoruAccordionItem value="sip">
                    <ZoruAccordionTrigger>SIP Integration</ZoruAccordionTrigger>
                    <ZoruAccordionContent className="pt-2">
                        <ZoruCard>
                             <ZoruCardContent className="pt-6 space-y-6">
                                <div className="space-y-2"><ZoruLabel>SIP Status</ZoruLabel><ZoruSelect name="sip_status" defaultValue={settings.sip?.status || 'DISABLED'}><ZoruSelectTrigger><ZoruSelectValue/></ZoruSelectTrigger><ZoruSelectContent><ZoruSelectItem value="ENABLED">Enabled</ZoruSelectItem><ZoruSelectItem value="DISABLED">Disabled</ZoruSelectItem></ZoruSelectContent></ZoruSelect></div>
                                <div className="space-y-2"><ZoruLabel>SIP Hostname</ZoruLabel><ZoruInput name="sip_hostname" defaultValue={settings.sip?.servers?.[0]?.hostname || ''}/></div>
                                <div className="space-y-2"><ZoruLabel>SIP Port</ZoruLabel><ZoruInput type="number" name="sip_port" defaultValue={settings.sip?.servers?.[0]?.port || ''}/></div>
                                <div className="space-y-2"><ZoruLabel>SIP URI Params (JSON)</ZoruLabel><ZoruTextarea name="sip_params" placeholder='{ "transport": "tcp" }' defaultValue={settings.sip?.servers?.[0]?.request_uri_user_params ? JSON.stringify(settings.sip.servers[0].request_uri_user_params, null, 2) : ''}/></div>
                             </ZoruCardContent>
                        </ZoruCard>
                    </ZoruAccordionContent>
                </ZoruAccordionItem>
            </ZoruAccordion>
            
            <div className="flex justify-end mt-8">
                <SaveButton />
            </div>
        </form>
    );
}
