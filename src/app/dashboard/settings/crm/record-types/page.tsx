'use client';

/**
 * SabCRM — Record types (`/dashboard/settings/crm/record-types`).
 *
 * Per-object variants (Salesforce "record types"): each constrains an object's
 * picklist (SELECT / MULTI_SELECT) values, maps to a page layout, and seeds
 * default field values on create. Saving the first record type for an object
 * provisions the `recordTypeId` SELECT field (whose options are the variants);
 * record forms then filter picklist options + pick the layout by the chosen
 * variant.
 *
 * Pure 20ui; auth/RBAC/project enforced by the layout + re-checked per action.
 */

import * as React from 'react';
import { Plus, Trash2, Boxes, Save } from 'lucide-react';

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
  Textarea,
  Switch,
  Badge,
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
  listRecordTypesTw,
  saveRecordTypeTw,
  deleteRecordTypeTw,
} from '@/app/actions/sabcrm-recordtypes.actions';
import { listObjectsTw } from '@/app/actions/sabcrm-objects.actions';
import type { RecordType } from '@/lib/sabcrm/record-types.server';

interface Row extends RecordType {
  _dirty?: boolean;
  _isNew?: boolean;
  _key: string;
  /** Raw textarea text for the restrictions JSON (parsed on save). */
  _restrictionsText: string;
  /** Raw textarea text for the defaults JSON (parsed on save). */
  _defaultsText: string;
}

function genKey(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID?.() ?? `k_${Math.random().toString(36).slice(2, 10)}`;
}

function prettyJson(obj: unknown): string {
  try {
    if (!obj || (typeof obj === 'object' && Object.keys(obj).length === 0)) return '';
    return JSON.stringify(obj, null, 2);
  } catch {
    return '';
  }
}

function toRow(rt: RecordType): Row {
  return {
    ...rt,
    _key: rt.id,
    _restrictionsText: prettyJson(rt.restrictedPicklists),
    _defaultsText: prettyJson(rt.defaultValues),
  };
}

export default function RecordTypesPage(): React.ReactElement {
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
        listRecordTypesTw(activeProjectId),
        listObjectsTw(activeProjectId),
      ]);
      if (!alive) return;
      if (rRes.ok) setRows(rRes.data.map(toRow));
      else setError(rRes.error);
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
        object: objects[0]?.value ?? '',
        name: '',
        active: true,
        layoutId: undefined,
        restrictedPicklists: {},
        defaultValues: {},
        _restrictionsText: '',
        _defaultsText: '',
        _isNew: true,
        _dirty: true,
        _key: genKey(),
      },
    ]);
  }

  function parseObj(text: string): Record<string, unknown> | null {
    const t = text.trim();
    if (!t) return {};
    try {
      const parsed = JSON.parse(t);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }

  async function save(row: Row): Promise<void> {
    if (!activeProjectId) return;
    if (!row.object || !row.name.trim()) {
      toast({ title: 'Object and name are required.', tone: 'danger' });
      return;
    }
    const restrictions = parseObj(row._restrictionsText);
    if (restrictions === null) {
      toast({ title: 'Restricted picklists is not valid JSON.', tone: 'danger' });
      return;
    }
    const defaults = parseObj(row._defaultsText);
    if (defaults === null) {
      toast({ title: 'Default values is not valid JSON.', tone: 'danger' });
      return;
    }
    // Coerce restriction values to string[] (the model expects allowed-value lists).
    const restrictedPicklists: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(restrictions)) {
      if (Array.isArray(v)) restrictedPicklists[k] = v.map((x) => String(x));
    }

    setBusyKey(row._key);
    const res = await saveRecordTypeTw(
      {
        id: row._isNew ? undefined : row.id,
        object: row.object,
        name: row.name.trim(),
        active: row.active,
        layoutId: row.layoutId?.trim() || undefined,
        restrictedPicklists,
        defaultValues: defaults,
      },
      activeProjectId,
    );
    setBusyKey(null);
    if (!res.ok) {
      toast({ title: 'Could not save', description: res.error, tone: 'danger' });
      return;
    }
    setRows((prev) =>
      prev.map((r) => (r._key === row._key ? { ...toRow(res.data), _key: r._key } : r)),
    );
    toast({
      title: 'Record type saved',
      description: 'The recordTypeId field was provisioned.',
      tone: 'success',
    });
  }

  async function remove(row: Row): Promise<void> {
    if (row._isNew || !row.id) {
      setRows((prev) => prev.filter((r) => r._key !== row._key));
      return;
    }
    if (!activeProjectId) return;
    setBusyKey(row._key);
    const res = await deleteRecordTypeTw(row.id, row.object, activeProjectId);
    setBusyKey(null);
    if (!res.ok) {
      toast({ title: 'Could not delete', description: res.error, tone: 'danger' });
      return;
    }
    setRows((prev) => prev.filter((r) => r._key !== row._key));
    toast({ title: 'Record type deleted', tone: 'success' });
  }

  return (
    <>
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Record types</PageTitle>
          <PageDescription>
            Per-object variants that constrain picklist values, map to a page
            layout, and seed default values on create. Record forms filter their
            picklists and pick a layout by the chosen variant.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="primary"
            iconLeft={Plus}
            onClick={add}
            disabled={objects.length === 0}
          >
            Add record type
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
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-[var(--st-space-5)]">
          <EmptyState
            icon={Boxes}
            title="No record types yet"
            description="Add a per-object variant to constrain picklists and seed defaults."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-[var(--st-space-3)]">
          {rows.map((row) => (
            <Card
              key={row._key}
              className="flex flex-col gap-[var(--st-space-3)] p-[var(--st-space-4)]"
            >
              <div className="flex flex-wrap items-end gap-[var(--st-space-2)]">
                <Field label="Object" className="min-w-[160px] flex-1">
                  <Select
                    value={row.object}
                    onValueChange={(object) => patch(row._key, { object })}
                    disabled={!row._isNew}
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
                <Field label="Name" className="min-w-[180px] flex-1">
                  <Input
                    value={row.name}
                    onChange={(e) => patch(row._key, { name: e.target.value })}
                    placeholder="Enterprise deal"
                  />
                </Field>
                <Field label="Layout id" className="w-[200px]">
                  <Input
                    value={row.layoutId ?? ''}
                    onChange={(e) => patch(row._key, { layoutId: e.target.value })}
                    placeholder="(default layout)"
                  />
                </Field>
                <Field label="Active" className="w-[64px]">
                  <Switch
                    checked={row.active}
                    aria-label="Active"
                    onCheckedChange={(active) => patch(row._key, { active })}
                  />
                </Field>
              </div>

              <div className="flex flex-wrap gap-[var(--st-space-3)]">
                <Field
                  label="Restricted picklists (JSON)"
                  className="min-w-[260px] flex-1"
                  help='e.g. {"stage": ["qualified", "proposal", "won"]}'
                >
                  <Textarea
                    value={row._restrictionsText}
                    onChange={(e) => patch(row._key, { _restrictionsText: e.target.value })}
                    rows={4}
                    placeholder='{ "stage": ["qualified", "won"] }'
                    spellCheck={false}
                  />
                </Field>
                <Field
                  label="Default values (JSON)"
                  className="min-w-[260px] flex-1"
                  help='e.g. {"stage": "qualified", "priority": "high"}'
                >
                  <Textarea
                    value={row._defaultsText}
                    onChange={(e) => patch(row._key, { _defaultsText: e.target.value })}
                    rows={4}
                    placeholder='{ "stage": "qualified" }'
                    spellCheck={false}
                  />
                </Field>
              </div>

              <div className="flex items-center justify-between gap-[var(--st-space-2)]">
                <div className="flex items-center gap-[var(--st-space-2)]">
                  {!row._isNew && row.id ? (
                    <Badge tone={row.active ? 'success' : 'neutral'}>
                      {row.active ? 'Active' : 'Inactive'}
                    </Badge>
                  ) : (
                    <Badge tone="info">New</Badge>
                  )}
                </div>
                <div className="flex items-center gap-[var(--st-space-2)]">
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
                    label="Delete record type"
                    variant="ghost"
                    onClick={() => remove(row)}
                    disabled={busyKey === row._key}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
