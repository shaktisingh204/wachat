'use client';

/**
 * SabCRM — Forecast adjustments (`/dashboard/settings/crm/forecast-adjustments`).
 *
 * Manager judgment overlay on the computed forecast: add/subtract an amount to
 * a pipeline's Commit / Best-case / Pipeline total. Applied additively by
 * `computeSabcrmForecast` (gross figures stay untouched).
 */

import * as React from 'react';
import { Plus, Trash2, SlidersHorizontal, Save } from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  IconButton,
  Card,
  Field,
  Input,
  Alert,
  EmptyState,
  Skeleton,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  useToast,
} from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import {
  listForecastAdjustmentsTw,
  saveForecastAdjustmentTw,
  deleteForecastAdjustmentTw,
} from '@/app/actions/sabcrm-forecast-adjustments.actions';
import { listPipelinesTw } from '@/app/actions/sabcrm-pipelines.actions';
import type { ForecastAdjustment, ForecastAdjustmentCategory } from '@/lib/sabcrm/forecast-adjustments.server';

interface Row extends ForecastAdjustment {
  _dirty?: boolean;
  _isNew?: boolean;
  _key: string;
}

const CATEGORIES: ReadonlyArray<{ value: ForecastAdjustmentCategory; label: string }> = [
  { value: 'commit', label: 'Commit' },
  { value: 'bestCase', label: 'Best case' },
  { value: 'pipeline', label: 'Pipeline' },
];

function genKey(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID?.() ?? `k_${Math.random().toString(36).slice(2, 10)}`;
}

export default function ForecastAdjustmentsPage(): React.ReactElement {
  const { activeProjectId, isLoadingProject } = useProject();
  const { toast } = useToast();

  const [rows, setRows] = React.useState<Row[]>([]);
  const [pipelines, setPipelines] = React.useState<Array<{ value: string; label: string }>>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!activeProjectId) return;
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      const [aRes, pRes] = await Promise.all([
        listForecastAdjustmentsTw(activeProjectId),
        listPipelinesTw(activeProjectId),
      ]);
      if (!alive) return;
      if (aRes.ok) setRows(aRes.data.map((a) => ({ ...a, _key: a.id })));
      else setError(aRes.error);
      if (pRes.ok) setPipelines(pRes.data.map((p) => ({ value: p.id, label: p.name })));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [activeProjectId]);

  function patch(key: string, p: Partial<Row>): void {
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, ...p, _dirty: true } : r)));
  }
  function add(): void {
    setRows((prev) => [
      ...prev,
      {
        id: '', projectId: activeProjectId ?? '', pipelineId: pipelines[0]?.value ?? '',
        periodStart: '', category: 'commit', amount: 0, note: '', createdAt: '', updatedAt: '',
        _isNew: true, _dirty: true, _key: genKey(),
      },
    ]);
  }

  async function save(row: Row): Promise<void> {
    if (!activeProjectId) return;
    if (!row.pipelineId) { toast({ title: 'Pick a pipeline.', tone: 'danger' }); return; }
    setBusyKey(row._key);
    const res = await saveForecastAdjustmentTw(
      {
        id: row._isNew ? undefined : row.id,
        pipelineId: row.pipelineId,
        periodStart: row.periodStart || undefined,
        category: row.category,
        amount: Number(row.amount) || 0,
        note: row.note?.trim() || undefined,
      },
      activeProjectId,
    );
    setBusyKey(null);
    if (!res.ok) { toast({ title: 'Could not save', description: res.error, tone: 'danger' }); return; }
    setRows((prev) => prev.map((r) => (r._key === row._key ? { ...res.data, _key: r._key } : r)));
    toast({ title: 'Adjustment saved', tone: 'success' });
  }

  async function remove(row: Row): Promise<void> {
    if (row._isNew || !row.id) { setRows((prev) => prev.filter((r) => r._key !== row._key)); return; }
    if (!activeProjectId) return;
    setBusyKey(row._key);
    const res = await deleteForecastAdjustmentTw(row.id, activeProjectId);
    setBusyKey(null);
    if (!res.ok) { toast({ title: 'Could not delete', description: res.error, tone: 'danger' }); return; }
    setRows((prev) => prev.filter((r) => r._key !== row._key));
    toast({ title: 'Adjustment deleted', tone: 'success' });
  }

  return (
    <>
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Forecast adjustments</PageTitle>
          <PageDescription>
            Add or subtract an amount from a pipeline&rsquo;s Commit / Best-case /
            Pipeline forecast. Applied on top of the computed figures.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={add} disabled={pipelines.length === 0}>
            Add adjustment
          </Button>
        </PageActions>
      </PageHeader>

      {error && <Alert tone="danger" className="mb-[var(--st-space-3)]">{error}</Alert>}

      {loading || isLoadingProject ? (
        <div className="flex flex-col gap-[var(--st-space-2)]">
          <Skeleton className="h-16 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-[var(--st-space-5)]">
          <EmptyState icon={SlidersHorizontal} title="No adjustments" description="Overlay manager judgment on the forecast." />
        </Card>
      ) : (
        <div className="flex flex-col gap-[var(--st-space-2)]">
          {rows.map((row) => (
            <Card key={row._key} className="flex flex-wrap items-end gap-[var(--st-space-2)] p-[var(--st-space-3)]">
              <Field label="Pipeline" className="min-w-[150px] flex-1">
                <Select value={row.pipelineId} onValueChange={(v) => patch(row._key, { pipelineId: v })}>
                  <SelectTrigger aria-label="Pipeline"><SelectValue placeholder="Pipeline" /></SelectTrigger>
                  <SelectContent>
                    {pipelines.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Category" className="w-[130px]">
                <Select value={row.category} onValueChange={(v) => patch(row._key, { category: v as ForecastAdjustmentCategory })}>
                  <SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Amount (±)" className="w-[120px]">
                <Input type="number" inputMode="numeric" value={Number.isFinite(row.amount) ? row.amount : 0} onChange={(e) => patch(row._key, { amount: Number(e.target.value) })} />
              </Field>
              <Field label="Note" className="min-w-[140px] flex-1">
                <Input value={row.note ?? ''} onChange={(e) => patch(row._key, { note: e.target.value })} placeholder="Reason (optional)" />
              </Field>
              <Button variant="primary" size="sm" iconLeft={Save} onClick={() => save(row)} disabled={busyKey === row._key || !row._dirty} loading={busyKey === row._key}>
                Save
              </Button>
              <IconButton icon={Trash2} label="Delete adjustment" variant="ghost" onClick={() => remove(row)} disabled={busyKey === row._key} />
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
