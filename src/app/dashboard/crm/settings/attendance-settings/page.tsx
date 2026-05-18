'use client';

import { ZoruButton, ZoruCard, ZoruInput, ZoruLabel, ZoruSkeleton, ZoruSwitch, ZoruTextarea, useZoruToast } from '@/components/zoruui';
import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
  } from 'react';
import { Clock,
  LoaderCircle } from 'lucide-react';

import { CrmPageHeader } from '../../_components/crm-page-header';
import {
  getAttendanceSettings,
  saveAttendanceSettings,
} from '@/app/actions/worksuite/module-settings.actions';
import type { WsAttendanceSetting } from '@/lib/worksuite/module-settings-types';

type FormState = { message?: string; error?: string; id?: string };
const initialState: FormState = {};

function ToggleRow({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: string;
  description?: string;
  defaultChecked?: boolean;
}) {
  const [checked, setChecked] = useState<boolean>(!!defaultChecked);
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-zoru-line bg-zoru-surface px-4 py-3">
      <div className="flex-1">
        <ZoruLabel htmlFor={name} className="text-[13px] text-zoru-ink">
          {label}
        </ZoruLabel>
        {description ? (
          <p className="mt-0.5 text-[12px] text-zoru-ink-muted">{description}</p>
        ) : null}
      </div>
      <ZoruSwitch id={name} checked={checked} onCheckedChange={setChecked} />
      <input type="hidden" name={name} value={checked ? 'yes' : 'no'} />
    </div>
  );
}

export default function AttendanceSettingsPage() {
  const { toast } = useZoruToast();
  const [settings, setSettings] = useState<WsAttendanceSetting | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [saveState, formAction, isSaving] = useActionState(
    saveAttendanceSettings,
    initialState,
  );

  const refresh = useCallback(() => {
    startLoading(async () => {
      const s = await getAttendanceSettings();
      setSettings(s);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (saveState?.message) {
      toast({ title: 'Saved', description: saveState.message });
      refresh();
    }
    if (saveState?.error) {
      toast({
        title: 'Error',
        description: saveState.error,
        variant: 'destructive',
      });
    }
  }, [saveState, toast, refresh]);

  const ipListInitial = (settings?.allowed_ip_addresses ?? []).join('\n');

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Attendance Settings"
        subtitle="Office hours, check-in methods, lateness rules, and location/IP constraints."
        icon={Clock}
      />

      {isLoading && !settings ? (
        <ZoruCard className="p-6">
          <ZoruSkeleton className="h-[520px] w-full" />
        </ZoruCard>
      ) : (
        <ZoruCard className="p-6">
          <form action={formAction} className="space-y-6">
            <section className="space-y-4">
              <h3 className="text-[13px] uppercase tracking-wide text-zoru-ink-muted">
                Office Hours
              </h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <ZoruLabel htmlFor="office_start_time" className="text-[13px] text-zoru-ink">
                    Start Time
                  </ZoruLabel>
                  <ZoruInput
                    id="office_start_time"
                    name="office_start_time"
                    type="time"
                    defaultValue={settings?.office_start_time ?? '09:00'}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <ZoruLabel htmlFor="office_end_time" className="text-[13px] text-zoru-ink">
                    End Time
                  </ZoruLabel>
                  <ZoruInput
                    id="office_end_time"
                    name="office_end_time"
                    type="time"
                    defaultValue={settings?.office_end_time ?? '18:00'}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <ZoruLabel htmlFor="office_hours" className="text-[13px] text-zoru-ink">
                    Office Hours
                  </ZoruLabel>
                  <ZoruInput
                    id="office_hours"
                    name="office_hours"
                    type="number"
                    step="0.25"
                    defaultValue={String(settings?.office_hours ?? 8)}
                    className="mt-1.5"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-[13px] uppercase tracking-wide text-zoru-ink-muted">
                Lateness & Half-day Rules
              </h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <ZoruLabel htmlFor="late_mark_after" className="text-[13px] text-zoru-ink">
                    Late After (minutes)
                  </ZoruLabel>
                  <ZoruInput
                    id="late_mark_after"
                    name="late_mark_after"
                    type="number"
                    min={0}
                    defaultValue={String(settings?.late_mark_after ?? 10)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <ZoruLabel
                    htmlFor="early_clock_in_allowed"
                    className="text-[13px] text-zoru-ink"
                  >
                    Early Clock-in (minutes)
                  </ZoruLabel>
                  <ZoruInput
                    id="early_clock_in_allowed"
                    name="early_clock_in_allowed"
                    type="number"
                    min={0}
                    defaultValue={String(settings?.early_clock_in_allowed ?? 30)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <ZoruLabel htmlFor="half_day_after" className="text-[13px] text-zoru-ink">
                    Half-day After (hours)
                  </ZoruLabel>
                  <ZoruInput
                    id="half_day_after"
                    name="half_day_after"
                    type="number"
                    step="0.25"
                    min={0}
                    defaultValue={String(settings?.half_day_after ?? 4)}
                    className="mt-1.5"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-[13px] uppercase tracking-wide text-zoru-ink-muted">
                Check-in Methods
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                <ToggleRow
                  name="allow_web_checkin"
                  label="Allow web check-in"
                  defaultChecked={settings?.allow_web_checkin ?? true}
                />
                <ToggleRow
                  name="allow_mobile_checkin"
                  label="Allow mobile check-in"
                  defaultChecked={settings?.allow_mobile_checkin ?? true}
                />
                <ToggleRow
                  name="require_location"
                  label="Require GPS location"
                  defaultChecked={settings?.require_location ?? false}
                />
                <ToggleRow
                  name="work_from_home_allowed"
                  label="Allow work-from-home"
                  defaultChecked={settings?.work_from_home_allowed ?? true}
                />
                <ToggleRow
                  name="require_approval"
                  label="Require manager approval"
                  defaultChecked={settings?.require_approval ?? false}
                />
                <ToggleRow
                  name="auto_clock_out"
                  label="Auto clock-out at end of day"
                  defaultChecked={settings?.auto_clock_out ?? false}
                />
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-[13px] uppercase tracking-wide text-zoru-ink-muted">
                IP Whitelist
              </h3>
              <ZoruLabel
                htmlFor="allowed_ip_addresses"
                className="text-[13px] text-zoru-ink"
              >
                Allowed IP addresses
              </ZoruLabel>
              <ZoruTextarea
                id="allowed_ip_addresses"
                name="allowed_ip_addresses"
                rows={4}
                placeholder="One IP per line, or comma-separated&#10;203.0.113.42&#10;203.0.113.43"
                defaultValue={ipListInitial}
                className="mt-1.5 font-mono"
              />
              <p className="text-[12px] text-zoru-ink-muted">
                Leave empty to allow check-in from any network.
              </p>
            </section>

            <div className="flex justify-end">
              <ZoruButton type="submit" disabled={isSaving}>
                {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                Save Attendance Settings
              </ZoruButton>
            </div>
          </form>
        </ZoruCard>
      )}
    </div>
  );
}
