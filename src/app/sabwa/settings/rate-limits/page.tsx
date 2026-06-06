'use client';

import {
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Button,
  Switch,
  Label,
  Input,
  Badge,
  RadioGroup,
  ZoruRadioGroupItem,
  Separator,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  EmptyState,
} from '@/components/sabcrm/20ui/compat';
import { ZoruChartContainer, ZoruChartTooltip, ZoruChart, ZORU_CHART_PALETTE } from '@/components/sabcrm/20ui/compat';
import {
  Gauge,
  AlertTriangle,
  Flame,
  Leaf,
  Activity,
  Smartphone } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';

import * as React from 'react';
import Link from 'next/link';

import { SettingsTabs } from '../_components/settings-tabs';
import { setRateLimitProfile, getRateLimitProfile } from '@/app/actions/sabwa.actions';
import type { SabwaRateLimitProfile } from '@/lib/sabwa/types';
import { useSabwaSession } from '@/lib/sabwa/session-context';

interface ProfileCard {
  value: SabwaRateLimitProfile;
  title: string;
  perMin: number;
  dailyCap: number;
  jitter: string;
  icon: React.ComponentType<{ className?: string }>;
  recommended?: boolean;
  warning?: string;
  description: string;
}

const PROFILES: ProfileCard[] = [
  {
    value: 'safe',
    title: 'Safe',
    perMin: 8,
    dailyCap: 500,
    jitter: '±4s',
    icon: Leaf,
    description: 'Lowest ban risk. Best for personal numbers and first-time bulk users.',
  },
  {
    value: 'normal',
    title: 'Normal',
    perMin: 15,
    dailyCap: 2000,
    jitter: '±3s',
    icon: Activity,
    recommended: true,
    description: 'Balanced throughput for seasoned numbers (>30 days old, prior outbound traffic).',
  },
  {
    value: 'aggressive',
    title: 'Aggressive',
    perMin: 30,
    dailyCap: 10000,
    jitter: '±2s',
    icon: Flame,
    warning: 'High ban risk. Only for well-warmed business numbers with prior delivery history.',
    description: 'Maximum throughput. Velocity guard still pauses on stream errors.',
  },
];

interface ActionOverride {
  key: 'broadcast' | 'bulk' | 'auto-reply' | 'scheduler';
  label: string;
  defaultCap: number;
}

const ACTION_ROWS: ActionOverride[] = [
  { key: 'broadcast', label: 'Broadcast', defaultCap: 12 },
  { key: 'bulk', label: 'Bulk send', defaultCap: 15 },
  { key: 'auto-reply', label: 'Auto-reply', defaultCap: 60 },
  { key: 'scheduler', label: 'Scheduler', defaultCap: 15 },
];

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
  { value: 'America/New_York', label: 'America/New_York (ET)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PT)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST)' },
];

const MOCK_USAGE_DATA = [
  { date: 'Mon', sent: 120, cap: 500 },
  { date: 'Tue', sent: 340, cap: 500 },
  { date: 'Wed', sent: 210, cap: 500 },
  { date: 'Thu', sent: 480, cap: 500 },
  { date: 'Fri', sent: 890, cap: 2000 },
  { date: 'Sat', sent: 1500, cap: 2000 },
  { date: 'Sun', sent: 1100, cap: 2000 },
];

export default function RateLimitsPage() {
  const { current: activeSession } = useSabwaSession();
  const sessionId = activeSession?.id ?? '';
  const [profile, setProfile] = React.useState<SabwaRateLimitProfile>('normal');
  const [warmupEnabled, setWarmupEnabled] = React.useState(false);
  const [sessionAgeDays, setSessionAgeDays] = React.useState(0);
  const [overrides, setOverrides] = React.useState<Record<string, number>>({});
  const [timezone, setTimezone] = React.useState('UTC');
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!sessionId) return;
    
    let active = true;
    startTransition(async () => {
      const res = await getRateLimitProfile(sessionId);
      if (active && res.ok && res.settings) {
        setProfile(res.settings.profile);
        setWarmupEnabled(res.settings.warmupEnabled);
        if (res.settings.dailyResetTimezone) {
          setTimezone(res.settings.dailyResetTimezone);
        }
        if (res.settings.overrides) {
          setOverrides(res.settings.overrides);
        }
        if (typeof res.settings.sessionAgeDays === 'number') {
          setSessionAgeDays(res.settings.sessionAgeDays);
        }
      }
    });
    
    return () => {
      active = false;
    };
  }, [sessionId]);

  // Linear ramp 5 → 30 over 7 days (matches anti-ban § 9.2).
  const effectiveRate = React.useMemo(() => {
    if (!warmupEnabled) return null;
    const d = Math.min(Math.max(sessionAgeDays, 0), 7);
    return Math.round(5 + ((30 - 5) * d) / 7);
  }, [warmupEnabled, sessionAgeDays]);

  const onSave = () => {
    startTransition(async () => {
      try {
        const res = await setRateLimitProfile({
          sessionId,
          profile,
          warmupEnabled,
          dailyResetTimezone: timezone,
          overrides,
        });
        if (res.ok) {
          toast.success('Rate-limit profile saved.');
        } else {
          toast.error(res.error || 'Save failed');
        }
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  };

  if (!sessionId) {
    return (
      <div className="mx-auto w-full max-w-[1180px] px-6 pt-6 pb-10">
        <EmptyState
          icon={<Smartphone />}
          title="No active WhatsApp account"
          description="Pick a connected account on the SabWa overview to start using this page."
          action={
            <Link href="/sabwa/overview">
              <Button size="md">Open accounts</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-[var(--st-bg-muted)] p-3">
          <Gauge className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings — Rate Limits</h1>
          <p className="text-sm text-[var(--st-text-secondary)] mt-1">
            Pick a sending profile and let SabWa pace outbound traffic to keep your personal number safe.
          </p>
        </div>
      </div>
      <SettingsTabs />

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Usage Activity</ZoruCardTitle>
          <ZoruCardDescription>
            Outbound messages sent over the last 7 days compared to your daily cap.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          <ZoruChartContainer height={240}>
            <ZoruChart.LineChart data={MOCK_USAGE_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <ZoruChart.CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--st-border)" />
              <ZoruChart.XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--st-text-secondary)', fontSize: 12 }}
                dy={10}
              />
              <ZoruChart.YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--st-text-secondary)', fontSize: 12 }}
              />
              <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
              <ZoruChart.Line 
                type="monotone" 
                dataKey="sent" 
                name="Messages Sent"
                stroke={ZORU_CHART_PALETTE[0]} 
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <ZoruChart.Line 
                type="stepAfter" 
                dataKey="cap" 
                name="Daily Cap"
                stroke={ZORU_CHART_PALETTE[2]} 
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
              />
            </ZoruChart.LineChart>
          </ZoruChartContainer>
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Sending profile</ZoruCardTitle>
          <ZoruCardDescription>
            Per-minute pacing, daily cap, and jitter are applied to every outbound message.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          <RadioGroup
            value={profile}
            onValueChange={(v) => setProfile(v as SabwaRateLimitProfile)}
            className="grid gap-3 md:grid-cols-3"
          >
            {PROFILES.map((p) => {
              const Icon = p.icon;
              const active = profile === p.value;
              return (
                <Label
                  key={p.value}
                  htmlFor={`profile-${p.value}`}
                  className={cn(
                    'cursor-pointer rounded-lg border p-4 transition-colors space-y-2',
                    active ? 'border-primary ring-2 ring-primary/30 bg-[var(--st-text)]/5' : 'hover:border-foreground/30',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5" />
                      <span className="font-semibold">{p.title}</span>
                      {p.recommended && <Badge variant="secondary">Recommended</Badge>}
                    </div>
                    <ZoruRadioGroupItem id={`profile-${p.value}`} value={p.value} />
                  </div>
                  <div className="text-2xl font-semibold tabular-nums">
                    {p.perMin}
                    <span className="ml-1 text-sm font-normal text-[var(--st-text-secondary)]">msgs/min</span>
                  </div>
                  <div className="text-xs text-[var(--st-text-secondary)] space-y-0.5">
                    <div>Daily cap: {p.dailyCap.toLocaleString()}</div>
                    <div>Jitter: {p.jitter}</div>
                  </div>
                  <p className="text-xs">{p.description}</p>
                  {p.warning && (
                    <div className="flex items-start gap-1.5 rounded-md bg-[var(--st-text)]/10 px-2 py-1.5 text-[11px] text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>{p.warning}</span>
                    </div>
                  )}
                </Label>
              );
            })}
          </RadioGroup>
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Warmup mode</ZoruCardTitle>
          <ZoruCardDescription>
            New numbers ramp from 5 to 30 msgs/min over 7 days to stay below WhatsApp&apos;s velocity flags.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Switch
              checked={warmupEnabled}
              onCheckedChange={setWarmupEnabled}
              aria-label="Toggle warmup mode"
            />
            <Label className="text-sm">Enable warmup ramp</Label>
          </div>
          {warmupEnabled && effectiveRate !== null && (
            <div className="rounded-md border bg-[var(--st-bg-muted)]/40 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[var(--st-text-secondary)]">
                  Session age: <strong className="text-[var(--st-text)]">{sessionAgeDays} day(s)</strong>
                </span>
                <span>
                  Current effective rate:{' '}
                  <strong className="text-[var(--st-text)] tabular-nums">{effectiveRate}/min</strong>
                </span>
              </div>
              <p className="mt-1.5 text-xs text-[var(--st-text-secondary)]">
                Warmup overrides the profile cap until 7 days have elapsed. After that, your selected profile
                takes over.
              </p>
            </div>
          )}
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Per-action overrides</ZoruCardTitle>
          <ZoruCardDescription>
            Tighten specific actions further than the profile baseline. Leave blank to inherit the profile cap.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead>Action</ZoruTableHead>
                <ZoruTableHead>Profile cap</ZoruTableHead>
                <ZoruTableHead>Custom per-min cap</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {ACTION_ROWS.map((row) => (
                <ZoruTableRow key={row.key}>
                  <ZoruTableCell className="font-medium">{row.label}</ZoruTableCell>
                  <ZoruTableCell className="text-sm text-[var(--st-text-secondary)] tabular-nums">
                    {row.defaultCap}/min
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={120}
                      placeholder={`${row.defaultCap}`}
                      className="max-w-28"
                      value={overrides[row.key] ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        setOverrides((o) => {
                          const next = { ...o };
                          if (v === '') {
                            delete next[row.key];
                          } else {
                            next[row.key] = Number(v);
                          }
                          return next;
                        });
                      }}
                    />
                  </ZoruTableCell>
                </ZoruTableRow>
              ))}
            </ZoruTableBody>
          </Table>
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Daily reset</ZoruCardTitle>
          <ZoruCardDescription>
            Daily caps roll over at midnight in the timezone you pick here.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          <Select value={timezone} onValueChange={setTimezone}>
            <ZoruSelectTrigger className="max-w-sm">
              <ZoruSelectValue />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {TIMEZONES.map((tz) => (
                <ZoruSelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </Select>
        </ZoruCardContent>
      </Card>

      <Separator />

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={pending}>
          Save rate-limit settings
        </Button>
      </div>
    </div>
  );
}
