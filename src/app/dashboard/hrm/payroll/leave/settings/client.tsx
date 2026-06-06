'use client';

import { Card, Button, Input, Label, Switch, useToast } from '@/components/sabcrm/20ui';
import { useOptimistic, useEffect, useState, useTransition } from 'react';
import { LoaderCircle, Save } from 'lucide-react';

import {
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
  include_weekends: false,
  include_holidays: false,
};

export default function LeaveSettingsClient({
  initialSettings,
}: {
  initialSettings: Partial<WsLeaveSetting>;
}) {
  const { toast } = useToast();
  const [originalSettings, setOriginalSettings] = useState<Partial<WsLeaveSetting>>({
    ...DEFAULT,
    ...initialSettings,
  });
  
  const [optimisticSettings, addOptimisticSetting] = useOptimistic(
    originalSettings,
    (state, updatedSettings: Partial<WsLeaveSetting>) => ({ ...state, ...updatedSettings })
  );
  
  const [pendingSettings, setPendingSettings] = useState<Partial<WsLeaveSetting>>({});
  const [isLoading, startLoading] = useTransition();
  const [isSaving, startSave] = useTransition();

  const currentSettings = { ...optimisticSettings, ...pendingSettings };

  // Data loaded via props

  const update = <K extends keyof WsLeaveSetting>(key: K, value: WsLeaveSetting[K]) => {
    setPendingSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startSave(async () => {
      const settingsToSave = { ...originalSettings, ...pendingSettings };
      addOptimisticSetting(pendingSettings);
      setPendingSettings({}); // Clear pending to allow optimistic state to take over
      
      const r = await saveLeaveSettings(settingsToSave);
      if (r.success) {
        setOriginalSettings(settingsToSave);
        toast({ title: 'Saved', description: 'Leave settings updated.' });
      } else {
        // On failure, the transition ends, useOptimistic reverts, and we visually revert
        toast({ title: 'Error', description: r.error || 'Failed to save settings', variant: 'destructive' });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-5 md:grid-cols-2">
      <Numeric
              label="Monthly leaves allowed"
              value={currentSettings.monthly_leaves_allowed}
              onChange={(v) => update('monthly_leaves_allowed', v)}
            />
            <Numeric
              label="Allowed leaves per week"
              value={currentSettings.allowed_leaves_per_week}
              onChange={(v) => update('allowed_leaves_per_week', v)}
            />
            <Numeric
              label="Max days in advance"
              value={currentSettings.max_days_advance}
              onChange={(v) => update('max_days_advance', v)}
            />
            <Numeric
              label="Hours per day (for hourly leave)"
              value={currentSettings.hours_per_day}
              onChange={(v) => update('hours_per_day', v)}
            />

            <Toggle
              label="Require approval"
              checked={currentSettings.require_approval}
              onChange={(v) => update('require_approval', v)}
            />
            <Toggle
              label="Allow half-day leaves"
              checked={currentSettings.allow_half_day}
              onChange={(v) => update('allow_half_day', v)}
            />
            <Toggle
              label="Allow hourly leaves"
              checked={currentSettings.allow_hourly}
              onChange={(v) => update('allow_hourly', v)}
            />
            <Toggle
              label="Allow future leave applications"
              checked={currentSettings.allow_future_leave}
              onChange={(v) => update('allow_future_leave', v)}
            />
            <Toggle
              label="Include weekends in leave duration"
              checked={currentSettings.include_weekends}
              onChange={(v) => update('include_weekends', v)}
            />
            <Toggle
              label="Include holidays in leave duration"
              checked={currentSettings.include_holidays}
              onChange={(v) => update('include_holidays', v)}
            />

      <div className="flex justify-end md:col-span-2">
        <Button
          type="submit"
          disabled={isSaving}
        >
          {isSaving ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Settings
        </Button>
      </div>
    </form>
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
      <Label className="text-[var(--st-text)]">{label}</Label>
      <Input
        type="number"
        min="0"
        value={value ?? 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
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
    <div className="flex items-center justify-between rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2.5">
      <Label className="text-[13px] text-[var(--st-text)]">{label}</Label>
      <Switch checked={Boolean(checked)} onCheckedChange={onChange} />
    </div>
  );
}
