'use client';

import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from 'react';
import { Clock, LoaderCircle } from 'lucide-react';

import { ClayButton, ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  getAttendanceSettings,
  saveAttendanceSettings,
} from '@/app/actions/worksuite/module-settings.actions';
import type { WsAttendanceSetting } from '@/lib/worksuite/module-settings-types';

type FormState = { message?: string; error?: string; id?: string };
const initialState: FormState = {};

const inputClass =
  'h-10 rounded-lg border-border bg-card text-[13px]';

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
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card/50 px-4 py-3">
      <div className="flex-1">
        <Label htmlFor={name} className="text-[13px] font-medium text-foreground">
          {label}
        </Label>
        {description ? (
          <p className="mt-0.5 text-[12px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <Switch id={name} checked={checked} onCheckedChange={setChecked} />
      <input type="hidden" name={name} value={checked ? 'yes' : 'no'} />
    </div>
  );
}

export default function AttendanceSettingsPage() {
  const { toast } = useToast();
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
        <ClayCard>
          <Skeleton className="h-[520px] w-full" />
        </ClayCard>
      ) : (
        <ClayCard>
          <form action={formAction} className="space-y-6">
            <section className="space-y-4">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                Office Hours
              </h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="office_start_time" className="text-[13px] text-foreground">
                    Start Time
                  </Label>
                  <Input
                    id="office_start_time"
                    name="office_start_time"
                    type="time"
                    defaultValue={settings?.office_start_time ?? '09:00'}
                    className={`mt-1.5 ${inputClass}`}
                  />
                </div>
                <div>
                  <Label htmlFor="office_end_time" className="text-[13px] text-foreground">
                    End Time
                  </Label>
                  <Input
                    id="office_end_time"
                    name="office_end_time"
                    type="time"
                    defaultValue={settings?.office_end_time ?? '18:00'}
                    className={`mt-1.5 ${inputClass}`}
                  />
                </div>
                <div>
                  <Label htmlFor="office_hours" className="text-[13px] text-foreground">
                    Office Hours
                  </Label>
                  <Input
                    id="office_hours"
                    name="office_hours"
                    type="number"
                    step="0.25"
                    defaultValue={String(settings?.office_hours ?? 8)}
                    className={`mt-1.5 ${inputClass}`}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                Lateness & Half-day Rules
              </h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="late_mark_after" className="text-[13px] text-foreground">
                    Late After (minutes)
                  </Label>
                  <Input
                    id="late_mark_after"
                    name="late_mark_after"
                    type="number"
                    min={0}
                    defaultValue={String(settings?.late_mark_after ?? 10)}
                    className={`mt-1.5 ${inputClass}`}
                  />
                </div>
                <div>
                  <Label
                    htmlFor="early_clock_in_allowed"
                    className="text-[13px] text-foreground"
                  >
                    Early Clock-in (minutes)
                  </Label>
                  <Input
                    id="early_clock_in_allowed"
                    name="early_clock_in_allowed"
                    type="number"
                    min={0}
                    defaultValue={String(settings?.early_clock_in_allowed ?? 30)}
                    className={`mt-1.5 ${inputClass}`}
                  />
                </div>
                <div>
                  <Label htmlFor="half_day_after" className="text-[13px] text-foreground">
                    Half-day After (hours)
                  </Label>
                  <Input
                    id="half_day_after"
                    name="half_day_after"
                    type="number"
                    step="0.25"
                    min={0}
                    defaultValue={String(settings?.half_day_after ?? 4)}
                    className={`mt-1.5 ${inputClass}`}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
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
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                IP Whitelist
              </h3>
              <Label
                htmlFor="allowed_ip_addresses"
                className="text-[13px] text-foreground"
              >
                Allowed IP addresses
              </Label>
              <Textarea
                id="allowed_ip_addresses"
                name="allowed_ip_addresses"
                rows={4}
                placeholder="One IP per line, or comma-separated&#10;203.0.113.42&#10;203.0.113.43"
                defaultValue={ipListInitial}
                className="mt-1.5 rounded-lg border-border bg-card text-[13px] font-mono"
              />
              <p className="text-[12px] text-muted-foreground">
                Leave empty to allow check-in from any network.
              </p>
            </section>

            <div className="flex justify-end">
              <ClayButton
                type="submit"
                variant="obsidian"
                disabled={isSaving}
                leading={
                  isSaving ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : undefined
                }
              >
                Save Attendance Settings
              </ClayButton>
            </div>
          </form>
        </ClayCard>
      )}
    </div>
  );
}
