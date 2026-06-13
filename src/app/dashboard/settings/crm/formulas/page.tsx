'use client';

/**
 * SabCRM — Formula fields (`/dashboard/settings/crm/formulas`).
 *
 * Define spreadsheet-style computed fields. Each row binds an object + a new
 * field key + an expression over sibling fields (e.g. `amount * 0.1`,
 * `quantity * unitPrice`). Saving provisions the field and recomputes the
 * object's records; the value then recomputes on every record create/update.
 *
 * Pure 20ui; auth/RBAC/project enforced by the layout + re-checked per action.
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
  listFormulasTw,
  saveFormulaTw,
  deleteFormulaTw,
} from '@/app/actions/sabcrm-formulas.actions';
import { listObjectsTw } from '@/app/actions/sabcrm-objects.actions';
import type { FormulaField, FormulaOutputType } from '@/lib/sabcrm/formula.server';

interface Row extends FormulaField {
  _dirty?: boolean;
  _isNew?: boolean;
  _key: string;
}

const OUTPUTS: ReadonlyArray<{ value: FormulaOutputType; label: string }> = [
  { value: 'NUMBER', label: 'Number' },
  { value: 'TEXT', label: 'Text' },
  { value: 'BOOLEAN', label: 'Boolean' },
];

function genKey(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID?.() ?? `k_${Math.random().toString(36).slice(2, 10)}`;
}

export default function FormulasPage(): React.ReactElement {
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
      const [fRes, oRes] = await Promise.all([
        listFormulasTw(activeProjectId),
        listObjectsTw(activeProjectId),
      ]);
      if (!alive) return;
      if (fRes.ok) setRows(fRes.data.map((f) => ({ ...f, _key: f.id })));
      else setError(fRes.error);
      if (oRes.ok) {
        setObjects(oRes.data.map((o) => ({ value: o.slug, label: o.labelPlural || o.slug })));
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [activeProjectId]);

  function patch(key: string, p: Partial<Row>): void {
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, ...p, _dirty: true } : r)));
  }
  function add(): void {
    setRows((prev) => [
      ...prev,
      {
        id: '',
        projectId: activeProjectId ?? '',
        objectSlug: objects[0]?.value ?? '',
        fieldKey: '',
        name: '',
        expression: '',
        outputType: 'NUMBER',
        enabled: true,
        createdAt: '',
        updatedAt: '',
        _isNew: true,
        _dirty: true,
        _key: genKey(),
      },
    ]);
  }

  async function save(row: Row): Promise<void> {
    if (!activeProjectId) return;
    if (!row.objectSlug || !row.fieldKey.trim() || !row.expression.trim()) {
      toast({ title: 'Object, field key and expression are required.', tone: 'danger' });
      return;
    }
    setBusyKey(row._key);
    const res = await saveFormulaTw(
      {
        id: row._isNew ? undefined : row.id,
        objectSlug: row.objectSlug,
        fieldKey: row.fieldKey.trim(),
        name: row.name?.trim() || row.fieldKey.trim(),
        expression: row.expression.trim(),
        outputType: row.outputType,
        enabled: row.enabled,
      },
      activeProjectId,
    );
    setBusyKey(null);
    if (!res.ok) {
      toast({ title: 'Could not save', description: res.error, tone: 'danger' });
      return;
    }
    setRows((prev) => prev.map((r) => (r._key === row._key ? { ...res.data, _key: r._key } : r)));
    toast({ title: 'Formula saved', description: 'Records were recomputed.', tone: 'success' });
  }

  async function remove(row: Row): Promise<void> {
    if (row._isNew || !row.id) {
      setRows((prev) => prev.filter((r) => r._key !== row._key));
      return;
    }
    if (!activeProjectId) return;
    setBusyKey(row._key);
    const res = await deleteFormulaTw(row.id, activeProjectId);
    setBusyKey(null);
    if (!res.ok) {
      toast({ title: 'Could not delete', description: res.error, tone: 'danger' });
      return;
    }
    setRows((prev) => prev.filter((r) => r._key !== row._key));
    toast({ title: 'Formula deleted', tone: 'success' });
  }

  return (
    <>
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Formula fields</PageTitle>
          <PageDescription>
            Computed fields evaluated from sibling fields, e.g.{' '}
            <code>amount * 0.1</code> or <code>quantity * unitPrice</code>.
            Recomputes on every record create/update.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={add} disabled={objects.length === 0}>
            Add formula
          </Button>
        </PageActions>
      </PageHeader>

      {error && (
        <Alert tone="danger" className="mb-[var(--st-space-3)]">
          {error}
        </Alert>
      )}

      {loading || isLoadingProject ? (
        <div className="flex flex-col gap-[var(--st-space-2)]">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-[var(--st-space-5)]">
          <EmptyState
            icon={Sigma}
            title="No formula fields yet"
            description="Add a computed field to derive values from other fields."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-[var(--st-space-2)]">
          {rows.map((row) => (
            <Card
              key={row._key}
              className="flex flex-wrap items-end gap-[var(--st-space-2)] p-[var(--st-space-3)]"
            >
              <Field label="Object" className="min-w-[140px] flex-1">
                <Select
                  value={row.objectSlug}
                  onValueChange={(objectSlug) => patch(row._key, { objectSlug })}
                >
                  <SelectTrigger aria-label="Object">
                    <SelectValue placeholder="Object" />
                  </SelectTrigger>
                  <SelectContent>
                    {objects.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Field key" className="w-[140px]">
                <Input
                  value={row.fieldKey}
                  onChange={(e) => patch(row._key, { fieldKey: e.target.value })}
                  placeholder="commission"
                  disabled={!row._isNew}
                />
              </Field>
              <Field label="Expression" className="min-w-[180px] flex-[2]">
                <Input
                  value={row.expression}
                  onChange={(e) => patch(row._key, { expression: e.target.value })}
                  placeholder="amount * 0.1"
                />
              </Field>
              <Field label="Type" className="w-[110px]">
                <Select
                  value={row.outputType}
                  onValueChange={(v) => patch(row._key, { outputType: v as FormulaOutputType })}
                >
                  <SelectTrigger aria-label="Output type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OUTPUTS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="On" className="w-[60px]">
                <Switch
                  checked={row.enabled}
                  aria-label="Enabled"
                  onCheckedChange={(enabled) => patch(row._key, { enabled })}
                />
              </Field>
              <Button
                variant="primary"
                size="sm"
                iconLeft={Save}
                onClick={() => save(row)}
                disabled={busyKey === row._key || !row._dirty}
                loading={busyKey === row._key}
              >
                Save
              </Button>
              <IconButton
                icon={Trash2}
                label="Delete formula"
                variant="ghost"
                onClick={() => remove(row)}
                disabled={busyKey === row._key}
              />
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
