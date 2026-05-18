'use client';

import { ZoruCard, ZoruButton, ZoruInput, ZoruLabel, ZoruSwitch, useZoruToast } from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition } from 'react';
import {
  LoaderCircle,
  Save } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
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
  const { toast } = useZoruToast();
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
    <EntityListShell
      title="Leave Settings"
      subtitle="Configure how leave applications behave across the organization."
    >
      <ZoruCard className="p-6">
        {isLoading ? (
          <div className="py-12 text-center text-[13px] text-zoru-ink-muted">
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
              <ZoruButton
                type="submit"
                disabled={isSaving}
              >
                {isSaving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Settings
              </ZoruButton>
            </div>
          </form>
        )}
      </ZoruCard>
    </EntityListShell>
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
      <ZoruLabel className="text-zoru-ink">{label}</ZoruLabel>
      <ZoruInput
        type="number"
        min="0"
        value={value ?? 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
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
    <div className="flex items-center justify-between rounded-lg border border-zoru-line bg-zoru-surface-2 px-3 py-2.5">
      <ZoruLabel className="text-[13px] text-zoru-ink">{label}</ZoruLabel>
      <ZoruSwitch checked={Boolean(checked)} onCheckedChange={onChange} />
    </div>
  );
}
