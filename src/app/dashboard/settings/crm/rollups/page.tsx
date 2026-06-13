'use client';

/**
 * SabCRM — Rollup fields (`/dashboard/settings/crm/rollups`).
 *
 * A rollup writes an aggregate of CHILD records onto a PARENT field — e.g.
 * "number of deals on a company" or "sum of order totals". Each row: parent
 * object + new field key + child object + the child field that holds the parent
 * id + the operation (+ child field to aggregate). Saving provisions the parent
 * field and recomputes; values then update as children change.
 */

import * as React from 'react';
import { Plus, Trash2, Sigma, Save } from 'lucide-react';

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
  Switch,
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
  listRollupsTw,
  saveRollupTw,
  deleteRollupTw,
} from '@/app/actions/sabcrm-rollups.actions';
import { listObjectsTw } from '@/app/actions/sabcrm-objects.actions';
import type { RollupField, RollupOp } from '@/lib/sabcrm/rollup.server';

interface Row extends RollupField {
  _dirty?: boolean;
  _isNew?: boolean;
  _key: string;
}

const OPS: ReadonlyArray<{ value: RollupOp; label: string }> = [
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
];

function genKey(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID?.() ?? `k_${Math.random().toString(36).slice(2, 10)}`;
}

export default function RollupsPage(): React.ReactElement {
  const { activeProjectId, isLoadingProject } = useProject();
  const { toast } = useToast();

  const [rows, setRows] = React.useState<Row[]>([]);
  const [objects, setObjects] = React.useState<Array<{ value: string; label: string }>>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!activeProjectId) return;
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      const [rRes, oRes] = await Promise.all([
        listRollupsTw(activeProjectId),
        listObjectsTw(activeProjectId),
      ]);
      if (!alive) return;
      if (rRes.ok) setRows(rRes.data.map((r) => ({ ...r, _key: r.id })));
      else setError(rRes.error);
      if (oRes.ok) setObjects(oRes.data.map((o) => ({ value: o.slug, label: o.labelPlural || o.slug })));
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
        id: '', projectId: activeProjectId ?? '', objectSlug: objects[0]?.value ?? '',
        fieldKey: '', name: '', childObject: objects[0]?.value ?? '', childRelationField: '',
        op: 'count', childTargetField: '', enabled: true, createdAt: '', updatedAt: '',
        _isNew: true, _dirty: true, _key: genKey(),
      },
    ]);
  }

  async function save(row: Row): Promise<void> {
    if (!activeProjectId) return;
    if (!row.objectSlug || !row.fieldKey.trim() || !row.childObject || !row.childRelationField.trim()) {
      toast({ title: 'Parent, field key, child object and relation field are required.', tone: 'danger' });
      return;
    }
    setBusyKey(row._key);
    const res = await saveRollupTw(
      {
        id: row._isNew ? undefined : row.id,
        objectSlug: row.objectSlug,
        fieldKey: row.fieldKey.trim(),
        name: row.name?.trim() || row.fieldKey.trim(),
        childObject: row.childObject,
        childRelationField: row.childRelationField.trim(),
        op: row.op,
        childTargetField: row.childTargetField?.trim() || undefined,
        enabled: row.enabled,
      },
      activeProjectId,
    );
    setBusyKey(null);
    if (!res.ok) { toast({ title: 'Could not save', description: res.error, tone: 'danger' }); return; }
    setRows((prev) => prev.map((r) => (r._key === row._key ? { ...res.data, _key: r._key } : r)));
    toast({ title: 'Rollup saved', description: 'Parents were recomputed.', tone: 'success' });
  }

  async function remove(row: Row): Promise<void> {
    if (row._isNew || !row.id) { setRows((prev) => prev.filter((r) => r._key !== row._key)); return; }
    if (!activeProjectId) return;
    setBusyKey(row._key);
    const res = await deleteRollupTw(row.id, activeProjectId);
    setBusyKey(null);
    if (!res.ok) { toast({ title: 'Could not delete', description: res.error, tone: 'danger' }); return; }
    setRows((prev) => prev.filter((r) => r._key !== row._key));
    toast({ title: 'Rollup deleted', tone: 'success' });
  }

  return (
    <>
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Rollup fields</PageTitle>
          <PageDescription>
            Aggregate child records onto a parent — e.g. count of deals per
            company, or sum of order totals. Recomputes as children change.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={add} disabled={objects.length === 0}>
            Add rollup
          </Button>
        </PageActions>
      </PageHeader>

      {error && <Alert tone="danger" className="mb-[var(--st-space-3)]">{error}</Alert>}

      {loading || isLoadingProject ? (
        <div className="flex flex-col gap-[var(--st-space-2)]">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-[var(--st-space-5)]">
          <EmptyState icon={Sigma} title="No rollup fields yet" description="Aggregate related records onto a parent field." />
        </Card>
      ) : (
        <div className="flex flex-col gap-[var(--st-space-2)]">
          {rows.map((row) => (
            <Card key={row._key} className="flex flex-wrap items-end gap-[var(--st-space-2)] p-[var(--st-space-3)]">
              <Field label="Parent object" className="min-w-[130px] flex-1">
                <Select value={row.objectSlug} onValueChange={(v) => patch(row._key, { objectSlug: v })}>
                  <SelectTrigger aria-label="Parent object"><SelectValue placeholder="Parent" /></SelectTrigger>
                  <SelectContent>
                    {objects.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Field key" className="w-[120px]">
                <Input value={row.fieldKey} onChange={(e) => patch(row._key, { fieldKey: e.target.value })} placeholder="dealCount" disabled={!row._isNew} />
              </Field>
              <Field label="Child object" className="min-w-[130px] flex-1">
                <Select value={row.childObject} onValueChange={(v) => patch(row._key, { childObject: v })}>
                  <SelectTrigger aria-label="Child object"><SelectValue placeholder="Child" /></SelectTrigger>
                  <SelectContent>
                    {objects.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Child→parent field" className="w-[150px]">
                <Input value={row.childRelationField} onChange={(e) => patch(row._key, { childRelationField: e.target.value })} placeholder="companyId" />
              </Field>
              <Field label="Op" className="w-[100px]">
                <Select value={row.op} onValueChange={(v) => patch(row._key, { op: v as RollupOp })}>
                  <SelectTrigger aria-label="Operation"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OPS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              {row.op !== 'count' && (
                <Field label="Child field" className="w-[120px]">
                  <Input value={row.childTargetField ?? ''} onChange={(e) => patch(row._key, { childTargetField: e.target.value })} placeholder="amount" />
                </Field>
              )}
              <Field label="On" className="w-[56px]">
                <Switch checked={row.enabled} aria-label="Enabled" onCheckedChange={(enabled) => patch(row._key, { enabled })} />
              </Field>
              <Button variant="primary" size="sm" iconLeft={Save} onClick={() => save(row)} disabled={busyKey === row._key || !row._dirty} loading={busyKey === row._key}>
                Save
              </Button>
              <IconButton icon={Trash2} label="Delete rollup" variant="ghost" onClick={() => remove(row)} disabled={busyKey === row._key} />
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
