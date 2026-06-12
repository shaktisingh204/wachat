'use client';

/**
 * SabCRM — Forecast client (`/sabcrm/forecast`), 20ui.
 *
 * Weighted forecast + goals for one pipeline:
 *
 *   - period selector (this/next month/quarter) + pipeline selector — every
 *     change recomputes the series via the gated `computeSabcrmForecast`
 *     action (sum of open-lead `amount × stage probability`, bucketed by
 *     close-date period; probability = stage governance `probability` or
 *     the documented position-ramp default — see
 *     `sabcrm-forecast.actions.types.ts`);
 *   - KPI tiles: weighted pipeline, won so far, target and attainment %
 *     for the selected period;
 *   - weighted-by-stage horizontal bar chart + per-period forecast trend;
 *   - sales-targets table with create / edit / delete (per-member or
 *     whole-team quotas) via the `*SalesTargetTw` actions.
 *
 * Data flows down from the server page (`page.tsx`); after a target
 * mutation the client calls `router.refresh()` so the table re-renders
 * from fresh server props. Forecast recomputes live in client state.
 *
 * ONLY `@/components/sabcrm/20ui` barrel + charts-composites imports
 * (repo rule); auth / onboarding / RBAC are enforced by the SabCRM layout,
 * and every action re-runs the full session → project → RBAC → plan gate.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Target, Trash2, Trophy } from 'lucide-react';

import {
  Alert,
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  SelectField,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  type BadgeTone,
  type SelectOption,
} from '@/components/sabcrm/20ui';
import {
  BarChart,
  KpiCard,
  LineChart,
} from '@/components/sabcrm/20ui/composites/charts';

import { computeSabcrmForecast } from '@/app/actions/sabcrm-forecast.actions';
import {
  createSalesTargetTw,
  deleteSalesTargetTw,
  updateSalesTargetTw,
} from '@/app/actions/sabcrm-targets.actions';
import type {
  SabcrmQuotaMetric,
  SabcrmQuotaPeriod,
  SabcrmRustQuota,
} from '@/app/actions/sabcrm-targets.actions.types';
import type {
  SabcrmForecastPeriodKind,
  SabcrmForecastResult,
} from '@/app/actions/sabcrm-forecast.actions.types';

import '@/components/sabcrm/20ui/surface-crm-base.css';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** Pipeline option narrowed by the server page. */
export interface ForecastPipelineOption {
  id: string;
  name: string;
  isDefault: boolean;
}

/** Member option narrowed by the server page. */
export interface ForecastMemberOption {
  userId: string;
  label: string;
}

interface ForecastClientProps {
  initialForecast: SabcrmForecastResult | null;
  initialError: string | null;
  initialTargets: SabcrmRustQuota[];
  pipelines: ForecastPipelineOption[];
  members: ForecastMemberOption[];
}

// ---------------------------------------------------------------------------
// Period choices
// ---------------------------------------------------------------------------

type PeriodChoice = 'this-month' | 'next-month' | 'this-quarter' | 'next-quarter';

const PERIOD_OPTIONS: SelectOption[] = [
  { value: 'this-month', label: 'This month' },
  { value: 'next-month', label: 'Next month' },
  { value: 'this-quarter', label: 'This quarter' },
  { value: 'next-quarter', label: 'Next quarter' },
];

function periodKindOf(choice: PeriodChoice): SabcrmForecastPeriodKind {
  return choice.endsWith('quarter') ? 'quarter' : 'month';
}

function periodIndexOf(choice: PeriodChoice): number {
  return choice.startsWith('next') ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Compact amount — "1.2M", "48.5K", "920". */
function formatAmount(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);
}

/** Full integer amount — "48,500". */
function formatFull(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Quota period display — "Jun 2026" / "Q3 2026" from `periodStart`. */
function quotaPeriodLabel(period: SabcrmQuotaPeriod, periodStart: string): string {
  const [y, m] = periodStart.split('-');
  const month = Number(m) - 1;
  if (!y || Number.isNaN(month)) return periodStart;
  if (period === 'quarter') return `Q${Math.floor(month / 3) + 1} ${y}`;
  return `${MONTH_NAMES[month] ?? m} ${y}`;
}

const METRIC_OPTIONS: SelectOption[] = [
  { value: 'revenue', label: 'Revenue' },
  { value: 'count', label: 'Deals won (count)' },
];

const QUOTA_PERIOD_OPTIONS: SelectOption[] = [
  { value: 'month', label: 'Monthly' },
  { value: 'quarter', label: 'Quarterly' },
];

// ---------------------------------------------------------------------------
// Target dialog state
// ---------------------------------------------------------------------------

interface QuotaFormState {
  id?: string;
  name: string;
  period: SabcrmQuotaPeriod;
  /** `YYYY-MM` for monthly quotas. */
  startMonth: string;
  /** `YYYY-MM-DD` (quarter first day) for quarterly quotas. */
  startQuarter: string;
  metric: SabcrmQuotaMetric;
  amount: string;
  memberId: string;
  pipelineId: string;
}

/** Current `YYYY-MM` (local clock — quota entry is a human pick anyway). */
function currentMonthValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Current quarter's first day, `YYYY-MM-DD`. */
function currentQuarterValue(): string {
  const d = new Date();
  const qm = Math.floor(d.getMonth() / 3) * 3 + 1;
  return `${d.getFullYear()}-${String(qm).padStart(2, '0')}-01`;
}

/** Quarter-start options spanning this year and the next. */
function quarterOptions(extra?: string): SelectOption[] {
  const year = new Date().getFullYear();
  const opts: SelectOption[] = [];
  for (const y of [year, year + 1]) {
    for (let q = 0; q < 4; q++) {
      const value = `${y}-${String(q * 3 + 1).padStart(2, '0')}-01`;
      opts.push({ value, label: `Q${q + 1} ${y}` });
    }
  }
  if (extra && !opts.some((o) => o.value === extra)) {
    opts.unshift({ value: extra, label: quotaPeriodLabel('quarter', extra) });
  }
  return opts;
}

function emptyQuota(): QuotaFormState {
  return {
    name: '',
    period: 'month',
    startMonth: currentMonthValue(),
    startQuarter: currentQuarterValue(),
    metric: 'revenue',
    amount: '',
    memberId: '',
    pipelineId: '',
  };
}

function quotaToForm(q: SabcrmRustQuota): QuotaFormState {
  return {
    id: q.id,
    name: q.name,
    period: q.period,
    startMonth: q.period === 'month' ? q.periodStart.slice(0, 7) : currentMonthValue(),
    startQuarter: q.period === 'quarter' ? q.periodStart : currentQuarterValue(),
    metric: q.metric,
    amount: String(q.amount),
    memberId: q.memberId ?? '',
    pipelineId: q.pipelineId ?? '',
  };
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export function ForecastClient({
  initialForecast,
  initialError,
  initialTargets,
  pipelines,
  members,
}: ForecastClientProps): React.JSX.Element {
  const router = useRouter();

  const [forecast, setForecast] = React.useState<SabcrmForecastResult | null>(
    initialForecast,
  );
  const [error, setError] = React.useState<string | null>(initialError);
  const [choice, setChoice] = React.useState<PeriodChoice>('this-month');
  const [pipelineId, setPipelineId] = React.useState<string>(
    initialForecast?.pipelineId ?? '',
  );
  const [recomputing, startRecompute] = React.useTransition();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<QuotaFormState>(emptyQuota);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, startSave] = React.useTransition();

  const [confirmDelete, setConfirmDelete] =
    React.useState<SabcrmRustQuota | null>(null);
  const [deleting, startDelete] = React.useTransition();
  const [rowError, setRowError] = React.useState<string | null>(null);

  // -- recompute on selector change -----------------------------------------

  const recompute = React.useCallback(
    (nextPipelineId: string, nextChoice: PeriodChoice): void => {
      startRecompute(async () => {
        const res = await computeSabcrmForecast({
          pipelineId: nextPipelineId || undefined,
          period: periodKindOf(nextChoice),
        });
        if (res.ok) {
          setForecast(res.data);
          setPipelineId(res.data.pipelineId);
          setError(null);
        } else {
          setError(res.error);
        }
      });
    },
    [],
  );

  const handlePipelineChange = (v: string | null): void => {
    const next = v ?? '';
    setPipelineId(next);
    recompute(next, choice);
  };

  const handleChoiceChange = (v: string | null): void => {
    const next = (v ?? 'this-month') as PeriodChoice;
    setChoice(next);
    if (periodKindOf(next) !== forecast?.periodKind) {
      recompute(pipelineId, next);
    }
  };

  // -- selected-period derivations -------------------------------------------

  const selected = forecast?.periods[periodIndexOf(choice)];
  const selectedLabel = selected?.label ?? '—';

  // Targets matching the selected period + pipeline. Team-wide quotas win;
  // when none exist, per-member quotas are summed instead (avoids double
  // counting a team goal that is also split per member).
  const matching = React.useMemo(() => {
    if (!forecast || !selected) {
      return { revenue: 0, count: 0, hasRevenue: false, hasCount: false };
    }
    const rows = initialTargets.filter(
      (t) =>
        t.period === forecast.periodKind &&
        t.periodStart === selected.start &&
        (!t.pipelineId || t.pipelineId === forecast.pipelineId),
    );
    const pick = (metric: SabcrmQuotaMetric): { sum: number; has: boolean } => {
      const ofMetric = rows.filter((t) => t.metric === metric);
      if (ofMetric.length === 0) return { sum: 0, has: false };
      const team = ofMetric.filter((t) => !t.memberId);
      const used = team.length > 0 ? team : ofMetric;
      return { sum: used.reduce((s, t) => s + t.amount, 0), has: true };
    };
    const revenue = pick('revenue');
    const count = pick('count');
    return {
      revenue: revenue.sum,
      count: count.sum,
      hasRevenue: revenue.has,
      hasCount: count.has,
    };
  }, [forecast, selected, initialTargets]);

  const usingCountTarget = !matching.hasRevenue && matching.hasCount;
  const targetValue = usingCountTarget ? matching.count : matching.revenue;
  const hasTarget = matching.hasRevenue || matching.hasCount;
  const attained = usingCountTarget
    ? (selected?.wonCount ?? 0)
    : (selected?.won ?? 0);
  const attainmentPct =
    hasTarget && targetValue > 0 ? (attained / targetValue) * 100 : null;

  // -- chart rows -------------------------------------------------------------

  const stageRows = React.useMemo(
    () =>
      (forecast?.byStage ?? []).map((s) => ({
        label: `${s.label} · ${s.probabilityPct}%`,
        value: Math.round(s.weighted),
        color: s.color,
      })),
    [forecast],
  );

  const trendRows = React.useMemo(
    () =>
      (forecast?.periods ?? []).map((p) => ({
        label: p.label,
        value: Math.round(p.forecast),
      })),
    [forecast],
  );

  // -- target CRUD ------------------------------------------------------------

  const openNew = (): void => {
    setForm(emptyQuota());
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (q: SabcrmRustQuota): void => {
    setForm(quotaToForm(q));
    setFormError(null);
    setDialogOpen(true);
  };

  const patch = (p: Partial<QuotaFormState>): void =>
    setForm((s) => ({ ...s, ...p }));

  const handleSave = (): void => {
    if (!form.name.trim()) {
      setFormError('A target name is required.');
      return;
    }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      setFormError('Amount must be a non-negative number.');
      return;
    }
    const periodStart =
      form.period === 'month' ? `${form.startMonth}-01` : form.startQuarter;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart)) {
      setFormError('Pick a period start.');
      return;
    }
    setFormError(null);

    startSave(async () => {
      const res = form.id
        ? await updateSalesTargetTw(form.id, {
            name: form.name.trim(),
            period: form.period,
            periodStart,
            metric: form.metric,
            amount,
            // '' clears the scope back to team-wide / all-pipelines.
            memberId: form.memberId,
            pipelineId: form.pipelineId,
          })
        : await createSalesTargetTw({
            name: form.name.trim(),
            period: form.period,
            periodStart,
            metric: form.metric,
            amount,
            memberId: form.memberId || undefined,
            pipelineId: form.pipelineId || undefined,
          });
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      setDialogOpen(false);
      router.refresh();
    });
  };

  const handleDelete = (): void => {
    const target = confirmDelete;
    if (!target) return;
    setRowError(null);
    startDelete(async () => {
      const res = await deleteSalesTargetTw(target.id);
      if (!res.ok) {
        setRowError(res.error);
        return;
      }
      setConfirmDelete(null);
      router.refresh();
    });
  };

  // -- option lists -----------------------------------------------------------

  const pipelineOptions: SelectOption[] = pipelines.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  const memberOptions: SelectOption[] = [
    { value: '', label: 'Whole team' },
    ...members.map((m) => ({ value: m.userId, label: m.label })),
  ];

  const targetPipelineOptions: SelectOption[] = [
    { value: '', label: 'All pipelines' },
    ...pipelineOptions,
  ];

  const memberLabelById = React.useMemo(
    () => new Map(members.map((m) => [m.userId, m.label])),
    [members],
  );
  const pipelineNameById = React.useMemo(
    () => new Map(pipelines.map((p) => [p.id, p.name])),
    [pipelines],
  );

  /** Per-row attainment when the quota's period sits inside the loaded series. */
  const rowAttainment = (q: SabcrmRustQuota): number | null => {
    if (!forecast || q.period !== forecast.periodKind || q.amount <= 0) {
      return null;
    }
    if (q.pipelineId && q.pipelineId !== forecast.pipelineId) return null;
    const period = forecast.periods.find((p) => p.start === q.periodStart);
    if (!period) return null;
    const attainedValue = q.metric === 'count' ? period.wonCount : period.won;
    return (attainedValue / q.amount) * 100;
  };

  const attainmentTone = (pct: number): BadgeTone =>
    pct >= 100 ? 'success' : pct >= 60 ? 'info' : 'neutral';

  // -- render -------------------------------------------------------------------

  return (
    <div className="mx-auto w-full max-w-[1040px] px-6 pb-12 pt-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Forecast</PageTitle>
          <PageDescription>
            Probability-weighted pipeline by close date, plus sales targets and
            attainment for this workspace.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <SelectField
            aria-label="Pipeline"
            value={pipelineId || null}
            onChange={handlePipelineChange}
            options={pipelineOptions}
            placeholder="Pipeline"
            disabled={recomputing || pipelineOptions.length === 0}
          />
          <SelectField
            aria-label="Period"
            value={choice}
            onChange={handleChoiceChange}
            options={PERIOD_OPTIONS}
            disabled={recomputing}
          />
          <Button variant="primary" iconLeft={Plus} onClick={openNew}>
            New target
          </Button>
        </PageActions>
      </PageHeader>

      {error ? (
        <div className="my-4">
          <Alert tone="danger" role="alert">
            Couldn&apos;t load the forecast: {error}
          </Alert>
        </div>
      ) : null}

      {forecast?.truncated ? (
        <div className="my-4">
          <Alert tone="warning">
            This pipeline holds more records than the forecast loads at once —
            numbers may undercount.
          </Alert>
        </div>
      ) : null}

      {!forecast && !error ? (
        <div className="mt-12">
          <EmptyState
            icon={Target}
            title="No pipeline to forecast"
            description="Create a sales pipeline with stages to see the weighted forecast."
          />
        </div>
      ) : null}

      {forecast ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Weighted pipeline"
              icon={Target}
              value={formatAmount(forecast.totals.weightedPipeline)}
              delta={`${formatAmount(selected?.weighted ?? 0)} expected in ${selectedLabel}`}
            />
            <KpiCard
              label={`Won — ${selectedLabel}`}
              icon={Trophy}
              value={formatAmount(selected?.won ?? 0)}
              delta={`${selected?.wonCount ?? 0} deals closed`}
              deltaTone={(selected?.wonCount ?? 0) > 0 ? 'up' : 'neutral'}
            />
            <KpiCard
              label={`Target — ${selectedLabel}`}
              value={
                hasTarget
                  ? `${formatAmount(targetValue)}${usingCountTarget ? ' deals' : ''}`
                  : '—'
              }
              delta={hasTarget ? undefined : 'No target set for this period'}
            />
            <KpiCard
              label="Attainment"
              value={attainmentPct === null ? '—' : `${Math.round(attainmentPct)}%`}
              delta={
                attainmentPct === null
                  ? 'Set a target to track attainment'
                  : `${formatFull(attained)} of ${formatFull(targetValue)}`
              }
              deltaTone={
                attainmentPct !== null && attainmentPct >= 100 ? 'up' : 'neutral'
              }
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section aria-label="Weighted value by stage">
              <h2 className="mb-2 text-sm font-medium">
                Weighted value by stage
              </h2>
              <BarChart
                data={stageRows}
                layout="horizontal"
                seriesLabel="Weighted"
                formatValue={formatAmount}
                emptyLabel="No open deals in this pipeline yet."
              />
            </section>
            <section aria-label="Forecast trend">
              <h2 className="mb-2 text-sm font-medium">
                Forecast by {forecast.periodKind}
              </h2>
              <LineChart
                data={trendRows}
                seriesLabel="Forecast"
                formatValue={formatAmount}
                emptyLabel="Nothing scheduled to close yet."
              />
              {forecast.unscheduled.count > 0 ? (
                <p className="mt-2 text-xs text-[var(--st-text-muted,inherit)]">
                  {forecast.unscheduled.count} open deal
                  {forecast.unscheduled.count === 1 ? '' : 's'} without a close
                  date ({formatAmount(forecast.unscheduled.weighted)} weighted)
                  are excluded from the trend.
                </p>
              ) : null}
            </section>
          </div>
        </>
      ) : null}

      <div className="mt-10">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium">Sales targets</h2>
        </div>

        {rowError ? (
          <div className="my-3">
            <Alert tone="danger" role="alert">
              {rowError}
            </Alert>
          </div>
        ) : null}

        {initialTargets.length === 0 ? (
          <EmptyState
            icon={Target}
            title="No targets yet"
            description="Set a monthly or quarterly goal for the team or a member to track attainment here."
            action={
              <Button variant="primary" iconLeft={Plus} onClick={openNew}>
                New target
              </Button>
            }
          />
        ) : (
          <Table hover>
            <THead>
              <Tr>
                <Th>Name</Th>
                <Th>Owner</Th>
                <Th>Pipeline</Th>
                <Th>Period</Th>
                <Th>Metric</Th>
                <Th align="right">Target</Th>
                <Th align="right">Attainment</Th>
                <Th aria-label="Actions" />
              </Tr>
            </THead>
            <TBody>
              {initialTargets.map((q) => {
                const pct = rowAttainment(q);
                return (
                  <Tr key={q.id}>
                    <Td>{q.name}</Td>
                    <Td>
                      {q.memberId
                        ? (memberLabelById.get(q.memberId) ?? 'Member')
                        : 'Whole team'}
                    </Td>
                    <Td>
                      {q.pipelineId
                        ? (pipelineNameById.get(q.pipelineId) ?? '—')
                        : 'All pipelines'}
                    </Td>
                    <Td>{quotaPeriodLabel(q.period, q.periodStart)}</Td>
                    <Td>{q.metric === 'count' ? 'Deals won' : 'Revenue'}</Td>
                    <Td align="right">{formatFull(q.amount)}</Td>
                    <Td align="right">
                      {pct === null ? (
                        '—'
                      ) : (
                        <Badge tone={attainmentTone(pct)}>
                          {Math.round(pct)}%
                        </Badge>
                      )}
                    </Td>
                    <Td align="right">
                      <span className="inline-flex items-center gap-1">
                        <IconButton
                          icon={Pencil}
                          label={`Edit ${q.name}`}
                          onClick={() => openEdit(q)}
                        />
                        <IconButton
                          icon={Trash2}
                          label={`Delete ${q.name}`}
                          onClick={() => setConfirmDelete(q)}
                        />
                      </span>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        )}
      </div>

      {/* ----------------------------- target dialog ----------------------------- */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          aria-describedby="forecast-target-desc"
          className="w-full max-w-lg"
        >
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit target' : 'New target'}</DialogTitle>
            <DialogDescription id="forecast-target-desc">
              A revenue or deal-count goal for one period — for the whole team
              or a single member.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <div className="flex flex-col gap-3 pb-2 pt-1">
              <Field label="Name" required>
                <Input
                  value={form.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="June team quota"
                  autoFocus
                  disabled={saving}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Period">
                  <SelectField
                    value={form.period}
                    onChange={(v) =>
                      patch({ period: (v ?? 'month') as SabcrmQuotaPeriod })
                    }
                    options={QUOTA_PERIOD_OPTIONS}
                    disabled={saving}
                  />
                </Field>
                <Field label="Starts">
                  {form.period === 'month' ? (
                    <Input
                      type="month"
                      value={form.startMonth}
                      onChange={(e) => patch({ startMonth: e.target.value })}
                      disabled={saving}
                    />
                  ) : (
                    <SelectField
                      value={form.startQuarter}
                      onChange={(v) =>
                        patch({ startQuarter: v ?? currentQuarterValue() })
                      }
                      options={quarterOptions(
                        form.id ? form.startQuarter : undefined,
                      )}
                      disabled={saving}
                    />
                  )}
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Metric">
                  <SelectField
                    value={form.metric}
                    onChange={(v) =>
                      patch({ metric: (v ?? 'revenue') as SabcrmQuotaMetric })
                    }
                    options={METRIC_OPTIONS}
                    disabled={saving}
                  />
                </Field>
                <Field
                  label={form.metric === 'count' ? 'Deals to win' : 'Amount'}
                  required
                >
                  <Input
                    type="number"
                    min={0}
                    step={form.metric === 'count' ? 1 : 'any'}
                    value={form.amount}
                    onChange={(e) => patch({ amount: e.target.value })}
                    placeholder={form.metric === 'count' ? '10' : '50000'}
                    disabled={saving}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Owner">
                  <SelectField
                    value={form.memberId}
                    onChange={(v) => patch({ memberId: v ?? '' })}
                    options={memberOptions}
                    disabled={saving}
                  />
                </Field>
                <Field label="Pipeline">
                  <SelectField
                    value={form.pipelineId}
                    onChange={(v) => patch({ pipelineId: v ?? '' })}
                    options={targetPipelineOptions}
                    disabled={saving}
                  />
                </Field>
              </div>

              {formError ? (
                <Alert tone="danger" role="alert">
                  {formError}
                </Alert>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={saving}>
                {form.id ? 'Save target' : 'Create target'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ----------------------------- delete confirm ---------------------------- */}
      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(next) => {
          if (!next && !deleting) {
            setConfirmDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {confirmDelete?.name ?? 'this target'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The target is removed from attainment tracking. Deals and
              pipelines are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="secondary" disabled={deleting}>
                Cancel
              </Button>
            </AlertDialogCancel>
            <Button variant="danger" loading={deleting} onClick={handleDelete}>
              Delete target
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
