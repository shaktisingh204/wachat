'use client';

/**
 * CallingSettingsForm (wachat-local, ZoruUI).
 *
 * Replaces @/components/wabasimplify/calling-settings-form. Same server
 * actions (getPhoneNumberCallingSettings, savePhoneNumberCallingSettings),
 * same hidden form fields, same recordApiCall side-effects.
 */

import * as React from 'react';
import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2, Save } from 'lucide-react';

import {
  getPhoneNumberCallingSettings,
  savePhoneNumberCallingSettings,
} from '@/app/actions/calling.actions';
import type {
  CallingSettings,
  HolidaySchedule,
  PhoneNumber,
  Project,
  WeeklyOperatingHours,
  WithId,
} from '@/lib/definitions';
import { recordApiCall } from '@/lib/calls/api-log';
import { timezones } from '@/lib/timezones';

import {
  ZoruAccordion,
  ZoruAccordionContent,
  ZoruAccordionItem,
  ZoruAccordionTrigger,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSkeleton,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';

import { HolidayScheduleEditor } from './holiday-schedule-editor';
import { WeeklyHoursEditor } from './weekly-hours-editor';

const saveInitialState: { success: boolean; error?: string } = {
  success: false,
  error: undefined,
};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" size="lg" disabled={pending}>
      {pending ? (
        <Loader2 className="animate-spin" />
      ) : (
        <Save />
      )}
      Save Calling Settings
    </ZoruButton>
  );
}

interface CallingSettingsFormProps {
  project: WithId<Project>;
  phone: PhoneNumber;
  onSuccess: () => void;
}

export function CallingSettingsForm({
  project,
  phone,
  onSuccess,
}: CallingSettingsFormProps) {
  const [settings, setSettings] = useState<Partial<CallingSettings>>({});
  const [isLoading, startLoading] = useTransition();
  const [saveState, formAction] = useActionState(
    savePhoneNumberCallingSettings,
    saveInitialState,
  );
  const { toast } = useZoruToast();

  const [weeklyHours, setWeeklyHours] = useState<WeeklyOperatingHours[]>([]);
  const [holidaySchedule, setHolidaySchedule] = useState<HolidaySchedule[]>([]);

  const fetchSettings = useCallback(() => {
    startLoading(async () => {
      const result = await getPhoneNumberCallingSettings(
        project._id.toString(),
        phone.id,
      );
      if (result.error) {
        toast({
          title: 'Error',
          description: `Could not fetch settings: ${result.error}`,
          variant: 'destructive',
        });
        recordApiCall({
          method: 'GET',
          status: 'ERROR',
          summary: `Fetch settings for ${phone.display_phone_number}`,
          errorMessage: result.error,
        });
      } else {
        setSettings(result.settings || {});
        setWeeklyHours(
          result.settings?.call_hours?.weekly_operating_hours || [],
        );
        setHolidaySchedule(
          result.settings?.call_hours?.holiday_schedule || [],
        );
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
      toast({
        title: 'Success!',
        description: 'Calling settings saved successfully.',
      });
      onSuccess();
    }
    if (saveState.error) {
      toast({
        title: 'Error Saving Settings',
        description: saveState.error,
        variant: 'destructive',
      });
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
      <input
        type="hidden"
        name="weekly_operating_hours"
        value={JSON.stringify(weeklyHours)}
      />
      <input
        type="hidden"
        name="holiday_schedule"
        value={JSON.stringify(holidaySchedule)}
      />

      <ZoruAccordion
        type="multiple"
        defaultValue={['general']}
        className="flex w-full flex-col gap-4"
      >
        <ZoruAccordionItem value="general">
          <ZoruAccordionTrigger>General Settings</ZoruAccordionTrigger>
          <ZoruAccordionContent className="pt-2">
            <ZoruCard className="p-5">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <ZoruLabel>Calling Status</ZoruLabel>
                  <ZoruSelect
                    name="status"
                    defaultValue={settings.status || 'DISABLED'}
                  >
                    <ZoruSelectTrigger>
                      <ZoruSelectValue />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                      <ZoruSelectItem value="ENABLED">Enabled</ZoruSelectItem>
                      <ZoruSelectItem value="DISABLED">Disabled</ZoruSelectItem>
                    </ZoruSelectContent>
                  </ZoruSelect>
                </div>
                <div className="flex flex-col gap-1.5">
                  <ZoruLabel>Call Icon Visibility</ZoruLabel>
                  <ZoruSelect
                    name="call_icon_visibility"
                    defaultValue={settings.call_icon_visibility || 'DEFAULT'}
                  >
                    <ZoruSelectTrigger>
                      <ZoruSelectValue />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                      <ZoruSelectItem value="DEFAULT">
                        Default (Visible to all)
                      </ZoruSelectItem>
                      <ZoruSelectItem value="DISABLE_ALL">
                        Disable All (Hidden)
                      </ZoruSelectItem>
                    </ZoruSelectContent>
                  </ZoruSelect>
                </div>
                <div className="flex flex-col gap-1.5">
                  <ZoruLabel htmlFor="restrict_to_user_countries">
                    Restrict to Countries (Optional)
                  </ZoruLabel>
                  <ZoruInput
                    id="restrict_to_user_countries"
                    name="restrict_to_user_countries"
                    defaultValue={settings.call_icons?.restrict_to_user_countries?.join(
                      ', ',
                    )}
                    placeholder="e.g. US, BR, IN"
                  />
                  <p className="text-[11.5px] text-zoru-ink-muted">
                    Comma-separated list of ISO 3166-1 alpha-2 country codes
                    where the call icon should appear.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <ZoruLabel>Callback Permission Prompt</ZoruLabel>
                  <ZoruSelect
                    name="callback_permission_status"
                    defaultValue={
                      settings.callback_permission_status || 'DISABLED'
                    }
                  >
                    <ZoruSelectTrigger>
                      <ZoruSelectValue />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                      <ZoruSelectItem value="ENABLED">
                        Enabled (Show Prompt)
                      </ZoruSelectItem>
                      <ZoruSelectItem value="DISABLED">Disabled</ZoruSelectItem>
                    </ZoruSelectContent>
                  </ZoruSelect>
                </div>
              </div>
            </ZoruCard>
          </ZoruAccordionContent>
        </ZoruAccordionItem>

        <ZoruAccordionItem value="hours">
          <ZoruAccordionTrigger>Business Hours</ZoruAccordionTrigger>
          <ZoruAccordionContent className="pt-2">
            <ZoruCard className="p-5">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <ZoruLabel>Business Hours Status</ZoruLabel>
                  <ZoruSelect
                    name="call_hours_status"
                    defaultValue={settings.call_hours?.status || 'DISABLED'}
                  >
                    <ZoruSelectTrigger>
                      <ZoruSelectValue />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                      <ZoruSelectItem value="ENABLED">Enabled</ZoruSelectItem>
                      <ZoruSelectItem value="DISABLED">Disabled</ZoruSelectItem>
                    </ZoruSelectContent>
                  </ZoruSelect>
                </div>
                <div className="flex flex-col gap-1.5">
                  <ZoruLabel>Timezone</ZoruLabel>
                  <ZoruSelect
                    name="timezone_id"
                    defaultValue={settings.call_hours?.timezone_id}
                  >
                    <ZoruSelectTrigger>
                      <ZoruSelectValue placeholder="Select a timezone..." />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                      {timezones.map((tz) => (
                        <ZoruSelectItem key={tz} value={tz}>
                          {tz}
                        </ZoruSelectItem>
                      ))}
                    </ZoruSelectContent>
                  </ZoruSelect>
                </div>
                <WeeklyHoursEditor
                  hours={weeklyHours}
                  onChange={setWeeklyHours}
                />
                <HolidayScheduleEditor
                  schedule={holidaySchedule}
                  onChange={setHolidaySchedule}
                />
              </div>
            </ZoruCard>
          </ZoruAccordionContent>
        </ZoruAccordionItem>

        <ZoruAccordionItem value="sip">
          <ZoruAccordionTrigger>SIP Integration</ZoruAccordionTrigger>
          <ZoruAccordionContent className="pt-2">
            <ZoruCard className="p-5">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <ZoruLabel>SIP Status</ZoruLabel>
                  <ZoruSelect
                    name="sip_status"
                    defaultValue={settings.sip?.status || 'DISABLED'}
                  >
                    <ZoruSelectTrigger>
                      <ZoruSelectValue />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                      <ZoruSelectItem value="ENABLED">Enabled</ZoruSelectItem>
                      <ZoruSelectItem value="DISABLED">Disabled</ZoruSelectItem>
                    </ZoruSelectContent>
                  </ZoruSelect>
                </div>
                <div className="flex flex-col gap-1.5">
                  <ZoruLabel>SIP Hostname</ZoruLabel>
                  <ZoruInput
                    name="sip_hostname"
                    defaultValue={settings.sip?.servers?.[0]?.hostname || ''}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <ZoruLabel>SIP Port</ZoruLabel>
                  <ZoruInput
                    type="number"
                    name="sip_port"
                    defaultValue={settings.sip?.servers?.[0]?.port || ''}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <ZoruLabel>SIP URI Params (JSON)</ZoruLabel>
                  <ZoruTextarea
                    name="sip_params"
                    placeholder='{ "transport": "tcp" }'
                    defaultValue={
                      settings.sip?.servers?.[0]?.request_uri_user_params
                        ? JSON.stringify(
                            settings.sip.servers[0].request_uri_user_params,
                            null,
                            2,
                          )
                        : ''
                    }
                  />
                </div>
              </div>
            </ZoruCard>
          </ZoruAccordionContent>
        </ZoruAccordionItem>
      </ZoruAccordion>

      <div className="mt-8 flex justify-end">
        <SaveButton />
      </div>
    </form>
  );
}
