'use client';

/**
 * Leave Settings — tenant-level leave policy configuration.
 *
 * Multi-tenant via `getLeaveSettings` / `saveLeaveSettings` — server-side
 * scoped to current tenant.
 *
 * KPI strip (read-only summary of the *current* policy):
 *   - Carry-forward policy
 *   - Max accrual (per type)
 *   - Expiry rule
 *   - Last updated
 *
 * Layout: clean settings card with sectioned headers (General, Half-day &
 * Hourly, Future leaves, Accrual & carry-forward).
 */

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSwitch,
  useZoruToast,
} from '@/components/zoruui';
import { useEffect, useState, useTransition } from 'react';
import {
  CalendarClock,
  Clock,
  Hourglass,
  LoaderCircle,
  Save,
  Settings as SettingsIcon,
} from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getLeaveSettings,
  saveLeaveSettings,
} from '@/app/actions/worksuite/leave.actions';
import type { WsLeaveSetting } from '@/lib/worksuite/leave-types';

type ExpiryRule = NonNullable<WsLeaveSetting['expiry_rule']>;

export default function LeaveSettingsPage() {
  const { toast } = useZoruToast();
  const [settings, setSettings] = useState<WsLeaveSetting | null>(null);
  const [isLoading, startLoad] = useTransition();
  const [isSaving, startSave] = useTransition();

  // General
  const [monthlyAllowed, setMonthlyAllowed] = useState('2');
  const [perWeek, setPerWeek] = useState('1');
  const [requireApproval, setRequireApproval] = useState(true);

  // Half-day / hourly
  const [allowHalfDay, setAllowHalfDay] = useState(true);
  const [allowHourly, setAllowHourly] = useState(false);
  const [hoursPerDay, setHoursPerDay] = useState('8');

  // Future leaves
  const [allowFuture, setAllowFuture] = useState(true);
  const [maxDaysAdvance, setMaxDaysAdvance] = useState('365');

  // Accrual & carry-forward
  const [carryEnabled, setCarryEnabled] = useState(false);
  const [carryMaxDays, setCarryMaxDays] = useState('0');
  const [maxAccrual, setMaxAccrual] = useState('0');
  const [expiryRule, setExpiryRule] = useState<ExpiryRule>('end_of_year');
  const [expiryMonths, setExpiryMonths] = useState('12');

  const load = () => {
    startLoad(async () => {
      const s = await getLeaveSettings();
      setSettings(s);
      setMonthlyAllowed(String(s.monthly_leaves_allowed));
      setPerWeek(String(s.allowed_leaves_per_week));
      setRequireApproval(Boolean(s.require_approval));
      setAllowHalfDay(Boolean(s.allow_half_day));
      setAllowHourly(Boolean(s.allow_hourly));
      setHoursPerDay(String(s.hours_per_day));
      setAllowFuture(Boolean(s.allow_future_leave));
      setMaxDaysAdvance(String(s.max_days_advance));
      setCarryEnabled(Boolean(s.carry_forward_enabled));
      setCarryMaxDays(String(s.carry_forward_max_days ?? 0));
      setMaxAccrual(String(s.max_accrual_days ?? 0));
      setExpiryRule((s.expiry_rule ?? 'end_of_year') as ExpiryRule);
      setExpiryMonths(String(s.expiry_months ?? 12));
    });
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startSave(async () => {
      const res = await saveLeaveSettings({
        monthly_leaves_allowed: Number(monthlyAllowed),
        allowed_leaves_per_week: Number(perWeek),
        require_approval: requireApproval,
        allow_half_day: allowHalfDay,
        allow_hourly: allowHourly,
        hours_per_day: Number(hoursPerDay),
        allow_future_leave: allowFuture,
        max_days_advance: Number(maxDaysAdvance),
        carry_forward_enabled: carryEnabled,
        carry_forward_max_days: Number(carryMaxDays),
        max_accrual_days: Number(maxAccrual),
        expiry_rule: expiryRule,
        expiry_months: Number(expiryMonths),
      });
      if (res.success) {
        toast({ title: 'Saved', description: 'Leave settings updated.' });
        load();
      } else {
        toast({
          title: 'Error',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  const lastUpdated = settings?.updatedAt
    ? new Date(settings.updatedAt).toLocaleString()
    : '—';

  const expiryLabel = (() => {
    switch (expiryRule) {
      case 'never':
        return 'Never expires';
      case 'end_of_year':
        return 'End of leave year';
      case 'fixed_months':
        return `${expiryMonths} months after accrual`;
      default:
        return '—';
    }
  })();

  return (
    <EntityListShell
      title="Leave Settings"
      subtitle="Tenant-level leave policy — applies to every leave type and employee."
    >
      <div className="flex flex-col gap-4">
        {/* KPI strip */}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={<CalendarClock className="h-4 w-4" />}
            label="Carry-forward policy"
            value={carryEnabled ? 'Enabled' : 'Disabled'}
            hint={
              carryEnabled
                ? `Up to ${carryMaxDays} day(s)`
                : 'Unused balance forfeited at year-end'
            }
          />
          <KpiCard
            icon={<Hourglass className="h-4 w-4" />}
            label="Max accrual"
            value={
              Number(maxAccrual) > 0
                ? `${maxAccrual} days`
                : 'Unlimited'
            }
            hint="Per leave type"
          />
          <KpiCard
            icon={<Clock className="h-4 w-4" />}
            label="Expiry rule"
            value={expiryRule.replace(/_/g, ' ')}
            hint={expiryLabel}
          />
          <KpiCard
            icon={<SettingsIcon className="h-4 w-4" />}
            label="Last updated"
            value={lastUpdated === '—' ? '—' : 'Synced'}
            hint={lastUpdated}
          />
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {/* General */}
          <ZoruCard className="p-6">
            <SectionHeader
              title="General"
              description="Baseline rules applied to every employee leave request."
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Monthly leaves allowed">
                <ZoruInput
                  type="number"
                  min="0"
                  value={monthlyAllowed}
                  onChange={(e) => setMonthlyAllowed(e.target.value)}
                />
              </Field>
              <Field label="Allowed leaves per week">
                <ZoruInput
                  type="number"
                  min="0"
                  value={perWeek}
                  onChange={(e) => setPerWeek(e.target.value)}
                />
              </Field>
              <Field
                label="Require approval"
                description="Manager approval required before a leave is counted."
              >
                <ZoruSwitch
                  checked={requireApproval}
                  onCheckedChange={(c) => setRequireApproval(Boolean(c))}
                />
              </Field>
            </div>
          </ZoruCard>

          {/* Half-day / hourly */}
          <ZoruCard className="p-6">
            <SectionHeader
              title="Half-day & hourly"
              description="Granular leave units below a full day."
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Allow half-day leaves">
                <ZoruSwitch
                  checked={allowHalfDay}
                  onCheckedChange={(c) => setAllowHalfDay(Boolean(c))}
                />
              </Field>
              <Field label="Allow hourly leaves">
                <ZoruSwitch
                  checked={allowHourly}
                  onCheckedChange={(c) => setAllowHourly(Boolean(c))}
                />
              </Field>
              <Field label="Hours per working day">
                <ZoruInput
                  type="number"
                  min="1"
                  max="24"
                  value={hoursPerDay}
                  onChange={(e) => setHoursPerDay(e.target.value)}
                />
              </Field>
            </div>
          </ZoruCard>

          {/* Future leaves */}
          <ZoruCard className="p-6">
            <SectionHeader
              title="Future leaves"
              description="How far in advance employees may apply."
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Allow future-dated leave applications">
                <ZoruSwitch
                  checked={allowFuture}
                  onCheckedChange={(c) => setAllowFuture(Boolean(c))}
                />
              </Field>
              <Field label="Maximum days in advance">
                <ZoruInput
                  type="number"
                  min="0"
                  value={maxDaysAdvance}
                  onChange={(e) => setMaxDaysAdvance(e.target.value)}
                  disabled={!allowFuture}
                />
              </Field>
            </div>
          </ZoruCard>

          {/* Accrual & carry-forward */}
          <ZoruCard className="p-6">
            <SectionHeader
              title="Accrual & carry-forward"
              description="Year-end roll-over, expiry, and total-accrual caps."
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Carry-forward enabled">
                <ZoruSwitch
                  checked={carryEnabled}
                  onCheckedChange={(c) => setCarryEnabled(Boolean(c))}
                />
              </Field>
              <Field
                label="Carry-forward max days"
                description="Cap on what rolls into the next leave year."
              >
                <ZoruInput
                  type="number"
                  min="0"
                  value={carryMaxDays}
                  onChange={(e) => setCarryMaxDays(e.target.value)}
                  disabled={!carryEnabled}
                />
              </Field>
              <Field
                label="Max accrual days"
                description="Hard cap on accumulated balance per type. 0 = unlimited."
              >
                <ZoruInput
                  type="number"
                  min="0"
                  value={maxAccrual}
                  onChange={(e) => setMaxAccrual(e.target.value)}
                />
              </Field>
              <Field label="Expiry rule">
                <ZoruSelect
                  value={expiryRule}
                  onValueChange={(v) => setExpiryRule(v as ExpiryRule)}
                >
                  <ZoruSelectTrigger>
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="never">Never</ZoruSelectItem>
                    <ZoruSelectItem value="end_of_year">End of leave year</ZoruSelectItem>
                    <ZoruSelectItem value="fixed_months">Fixed months after accrual</ZoruSelectItem>
                  </ZoruSelectContent>
                </ZoruSelect>
              </Field>
              <Field
                label="Expiry months"
                description="Only used when rule is 'Fixed months'."
              >
                <ZoruInput
                  type="number"
                  min="1"
                  max="60"
                  value={expiryMonths}
                  onChange={(e) => setExpiryMonths(e.target.value)}
                  disabled={expiryRule !== 'fixed_months'}
                />
              </Field>
            </div>
          </ZoruCard>

          {/* Save */}
          <div className="flex items-center justify-between rounded-lg border border-zoru-line bg-zoru-surface-2 px-4 py-3">
            <div className="flex items-center gap-2 text-[12.5px] text-zoru-ink-muted">
              <ZoruBadge variant="outline">Last updated</ZoruBadge>
              <span>{lastUpdated}</span>
            </div>
            <div className="flex items-center gap-2">
              <ZoruButton type="button" variant="outline" onClick={load} disabled={isLoading}>
                Reset
              </ZoruButton>
              <ZoruButton type="submit" disabled={isSaving || isLoading}>
                {isSaving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                ) : (
                  <Save className="h-4 w-4" strokeWidth={1.75} />
                )}
                Save settings
              </ZoruButton>
            </div>
          </div>
        </form>
      </div>
    </EntityListShell>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5 border-b border-zoru-line pb-3">
      <h2 className="text-[15px] font-medium text-zoru-ink">{title}</h2>
      {description ? (
        <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">{description}</p>
      ) : null}
    </div>
  );
}

function Field({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <ZoruLabel className="text-[13px] text-zoru-ink">{label}</ZoruLabel>
      {description ? (
        <p className="text-[11.5px] text-zoru-ink-muted">{description}</p>
      ) : null}
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <ZoruCard className="p-5">
      <div className="flex items-center gap-2 text-zoru-ink-muted">
        {icon}
        <p className="text-[12.5px] font-medium">{label}</p>
      </div>
      <div className="mt-2 truncate text-xl capitalize text-zoru-ink">{value}</div>
      {hint ? (
        <p className="mt-1 truncate text-[11.5px] text-zoru-ink-muted" title={hint}>
          {hint}
        </p>
      ) : null}
    </ZoruCard>
  );
}
