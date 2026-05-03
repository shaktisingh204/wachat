'use client';

import { useEffect, useState, useTransition } from 'react';
import { Settings, LoaderCircle, Save } from 'lucide-react';
import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  getLeaveSettings,
  saveLeaveSettings,
} from '@/app/actions/worksuite/leave.actions';
import type { WsLeaveSetting } from '@/lib/worksuite/leave-types';

const DEFAULT: Partial<WsLeaveSetting> = {
  monthly_leaves_allowed: 2,
  allowed_leaves_per_week: 1,
  require_approval: true,
  allow_half_day: true,
  allow_hourly: false,
  allow_future_leave: true,
  max_days_advance: 365,
  hours_per_day: 8,
};

export default function LeaveSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Partial<WsLeaveSetting>>(DEFAULT);
  const [isLoading, startLoading] = useTransition();
  const [isSaving, startSave] = useTransition();

  useEffect(() => {
    startLoading(async () => {
      const s = await getLeaveSettings();
      setSettings({ ...DEFAULT, ...s });
    });
  }, []);

  const update = <K extends keyof WsLeaveSetting>(key: K, value: WsLeaveSetting[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    startSave(async () => {
      const r = await saveLeaveSettings(settings);
      if (r.success) {
        toast({ title: 'Saved', description: 'Leave settings updated.' });
      } else {
        toast({ title: 'Error', description: r.error, variant: 'destructive' });
      }
    });
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Leave Settings"
        subtitle="Configure how leave applications behave across the organization."
        icon={Settings}
      />
      <ClayCard>
        {isLoading ? (
          <div className="py-12 text-center text-[13px] text-muted-foreground">
            Loading…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-5 md:grid-cols-2">
            <Numeric
              label="Monthly leaves allowed"
              value={settings.monthly_leaves_allowed}
              onChange={(v) => update('monthly_leaves_allowed', v)}
            />
            <Numeric
              label="Allowed leaves per week"
              value={settings.allowed_leaves_per_week}
              onChange={(v) => update('allowed_leaves_per_week', v)}
            />
            <Numeric
              label="Max days in advance"
              value={settings.max_days_advance}
              onChange={(v) => update('max_days_advance', v)}
            />
            <Numeric
              label="Hours per day (for hourly leave)"
              value={settings.hours_per_day}
              onChange={(v) => update('hours_per_day', v)}
            />

            <Toggle
              label="Require approval"
              checked={settings.require_approval}
              onChange={(v) => update('require_approval', v)}
            />
            <Toggle
              label="Allow half-day leaves"
              checked={settings.allow_half_day}
              onChange={(v) => update('allow_half_day', v)}
            />
            <Toggle
              label="Allow hourly leaves"
              checked={settings.allow_hourly}
              onChange={(v) => update('allow_hourly', v)}
            />
            <Toggle
              label="Allow future leave applications"
              checked={settings.allow_future_leave}
              onChange={(v) => update('allow_future_leave', v)}
            />

            <div className="flex justify-end md:col-span-2">
              <ClayButton
                type="submit"
                variant="obsidian"
                disabled={isSaving}
                leading={
                  isSaving ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                  ) : (
                    <Save className="h-4 w-4" strokeWidth={1.75} />
                  )
                }
              >
                Save Settings
              </ClayButton>
            </div>
          </form>
        )}
      </ClayCard>
    </div>
  );
}

function Numeric({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <Label className="text-foreground">{label}</Label>
      <Input
        type="number"
        min="0"
        value={value ?? 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]"
      />
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean | undefined;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-secondary px-3 py-2.5">
      <Label className="text-[13px] text-foreground">{label}</Label>
      <Switch checked={Boolean(checked)} onCheckedChange={onChange} />
    </div>
  );
}
