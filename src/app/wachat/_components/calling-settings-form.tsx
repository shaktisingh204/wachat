'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Card,
  Field,
  Input,
  Select,
  Skeleton,
  Textarea,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
  } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2,
  Save } from 'lucide-react';

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

/**
 * CallingSettingsForm (wachat-local, 20ui).
 *
 * Replaces the legacy calling-settings-form. Same server
 * actions (getPhoneNumberCallingSettings, savePhoneNumberCallingSettings),
 * same hidden form fields, same recordApiCall side-effects.
 *
 * The 20ui Select is a custom button-based widget (not a native <select>), so
 * each select is driven by controlled state and mirrored into a hidden <input>
 * to preserve the exact form-submission contract of the original.
 */

import * as React from 'react';

import { HolidayScheduleEditor } from './holiday-schedule-editor';
import { WeeklyHoursEditor } from './weekly-hours-editor';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

const saveInitialState: { success: boolean; error?: string } = {
  success: false,
  error: undefined,
};

const STATUS_OPTIONS = [
  { value: 'ENABLED', label: 'Enabled' },
  { value: 'DISABLED', label: 'Disabled' },
];

const CALL_ICON_VISIBILITY_OPTIONS = [
  { value: 'DEFAULT', label: 'Default (Visible to all)' },
  { value: 'DISABLE_ALL', label: 'Disable All (Hidden)' },
];

const CALLBACK_PERMISSION_OPTIONS = [
  { value: 'ENABLED', label: 'Enabled (Show Prompt)' },
  { value: 'DISABLED', label: 'Disabled' },
];

const TIMEZONE_OPTIONS = timezones.map((tz) => ({ value: tz, label: tz }));

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" variant="primary" disabled={pending}>
      {pending ? (
        <Loader2 className="animate-spin" />
      ) : (
        <Save />
      )}
      Save Calling Settings
    </Button>
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
  const { toast } = useToast();

  const [weeklyHours, setWeeklyHours] = useState<WeeklyOperatingHours[]>([]);
  const [holidaySchedule, setHolidaySchedule] = useState<HolidaySchedule[]>([]);

  // Controlled values for the 20ui Select widgets (which don't post via `name`).
  // Each is mirrored into a hidden <input> below to preserve the form contract.
  const [status, setStatus] = useState<string>('DISABLED');
  const [callIconVisibility, setCallIconVisibility] = useState<string>('DEFAULT');
  const [callbackPermissionStatus, setCallbackPermissionStatus] =
    useState<string>('DISABLED');
  const [callHoursStatus, setCallHoursStatus] = useState<string>('DISABLED');
  const [timezoneId, setTimezoneId] = useState<string>('');
  const [sipStatus, setSipStatus] = useState<string>('DISABLED');

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
          tone: 'danger',
        });
        recordApiCall({
          method: 'GET',
          status: 'ERROR',
          summary: `Fetch settings for ${phone.display_phone_number}`,
          errorMessage: result.error,
        });
      } else {
        const s = result.settings || {};
        setSettings(s);
        setWeeklyHours(s.call_hours?.weekly_operating_hours || []);
        setHolidaySchedule(s.call_hours?.holiday_schedule || []);
        setStatus(s.status || 'DISABLED');
        setCallIconVisibility(s.call_icon_visibility || 'DEFAULT');
        setCallbackPermissionStatus(s.callback_permission_status || 'DISABLED');
        setCallHoursStatus(s.call_hours?.status || 'DISABLED');
        setTimezoneId(s.call_hours?.timezone_id || '');
        setSipStatus(s.sip?.status || 'DISABLED');
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
        tone: 'success',
      });
      onSuccess();
    }
    if (saveState.error) {
      toast({
        title: 'Error Saving Settings',
        description: saveState.error,
        tone: 'danger',
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
    return <Skeleton className="h-96 w-full" height="24rem" width="100%" />;
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
      <input type="hidden" name="status" value={status} />
      <input
        type="hidden"
        name="call_icon_visibility"
        value={callIconVisibility}
      />
      <input
        type="hidden"
        name="callback_permission_status"
        value={callbackPermissionStatus}
      />
      <input type="hidden" name="call_hours_status" value={callHoursStatus} />
      <input type="hidden" name="timezone_id" value={timezoneId} />
      <input type="hidden" name="sip_status" value={sipStatus} />

      <Accordion
        type="multiple"
        defaultValue={['general']}
        className="flex w-full flex-col gap-4"
      >
        <AccordionItem value="general">
          <AccordionTrigger>General Settings</AccordionTrigger>
          <AccordionContent className="pt-2">
            <Card className="p-5">
              <div className="flex flex-col gap-5">
                <Field label="Calling Status">
                  <Select
                    aria-label="Calling Status"
                    value={status}
                    onChange={(v) => setStatus(v ?? 'DISABLED')}
                    options={STATUS_OPTIONS}
                  />
                </Field>
                <Field label="Call Icon Visibility">
                  <Select
                    aria-label="Call Icon Visibility"
                    value={callIconVisibility}
                    onChange={(v) => setCallIconVisibility(v ?? 'DEFAULT')}
                    options={CALL_ICON_VISIBILITY_OPTIONS}
                  />
                </Field>
                <Field
                  label="Restrict to Countries (Optional)"
                  help="Comma-separated list of ISO 3166-1 alpha-2 country codes where the call icon should appear."
                >
                  <Input
                    id="restrict_to_user_countries"
                    name="restrict_to_user_countries"
                    defaultValue={settings.call_icons?.restrict_to_user_countries?.join(
                      ', ',
                    )}
                    placeholder="e.g. US, BR, IN"
                  />
                </Field>
                <Field label="Callback Permission Prompt">
                  <Select
                    aria-label="Callback Permission Prompt"
                    value={callbackPermissionStatus}
                    onChange={(v) =>
                      setCallbackPermissionStatus(v ?? 'DISABLED')
                    }
                    options={CALLBACK_PERMISSION_OPTIONS}
                  />
                </Field>
              </div>
            </Card>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="hours">
          <AccordionTrigger>Business Hours</AccordionTrigger>
          <AccordionContent className="pt-2">
            <Card className="p-5">
              <div className="flex flex-col gap-5">
                <Field label="Business Hours Status">
                  <Select
                    aria-label="Business Hours Status"
                    value={callHoursStatus}
                    onChange={(v) => setCallHoursStatus(v ?? 'DISABLED')}
                    options={STATUS_OPTIONS}
                  />
                </Field>
                <Field label="Timezone">
                  <Select
                    aria-label="Timezone"
                    value={timezoneId || null}
                    onChange={(v) => setTimezoneId(v ?? '')}
                    placeholder="Select a timezone..."
                    searchable
                    options={TIMEZONE_OPTIONS}
                  />
                </Field>
                <WeeklyHoursEditor
                  hours={weeklyHours}
                  onChange={setWeeklyHours}
                />
                <HolidayScheduleEditor
                  schedule={holidaySchedule}
                  onChange={setHolidaySchedule}
                />
              </div>
            </Card>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="sip">
          <AccordionTrigger>SIP Integration</AccordionTrigger>
          <AccordionContent className="pt-2">
            <Card className="p-5">
              <div className="flex flex-col gap-5">
                <Field label="SIP Status">
                  <Select
                    aria-label="SIP Status"
                    value={sipStatus}
                    onChange={(v) => setSipStatus(v ?? 'DISABLED')}
                    options={STATUS_OPTIONS}
                  />
                </Field>
                <Field label="SIP Hostname">
                  <Input
                    name="sip_hostname"
                    defaultValue={settings.sip?.servers?.[0]?.hostname || ''}
                  />
                </Field>
                <Field label="SIP Port">
                  <Input
                    type="number"
                    name="sip_port"
                    defaultValue={settings.sip?.servers?.[0]?.port || ''}
                  />
                </Field>
                <Field label="SIP URI Params (JSON)">
                  <Textarea
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
                </Field>
              </div>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className={cx('mt-8', 'flex', 'justify-end')}>
        <SaveButton />
      </div>
    </form>
  );
}
