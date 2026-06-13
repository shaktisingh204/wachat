'use client';

/**
 * SabCRM — Lookup fields (`/dashboard/settings/crm/lookups`).
 *
 * Define fields that MIRROR a value from a related (parent) record and keep it
 * in sync (the Salesforce "lookup field"). Each row binds a child object + the
 * RELATION field that points at the parent + the parent object + the parent
 * source field + a new target field key on the child. Saving provisions the
 * target field (mirroring the parent field's type) and backfills the object's
 * records; the value then re-syncs on every record create/update.
 *
 * Pure 20ui; auth/RBAC/project enforced by the layout + re-checked per action.
 */

import * as React from 'react';
import { Plus, Trash2, Link2, Save } from 'lucide-react';

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
  listLookupsTw,
  saveLookupTw,
  deleteLookupTw,
} from '@/app/actions/sabcrm-lookup.actions';
import { listObjectsTw } from '@/app/actions/sabcrm-objects.actions';
import type { LookupField } from '@/lib/sabcrm/lookup.server';

interface Row extends LookupField {
  _dirty?: boolean;
  _isNew?: boolean;
  _key: string;
}

function genKey(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID?.() ?? `k_${Math.random().toString(36).slice(2, 10)}`;
}

export default function LookupsPage(): React.ReactElement {
  const { activeProjectId, isLoadingProject } = useProject();
  const { toast } = useToast();

  const [rows, setRows] = React.useState<Row[]>([]);
  const [objects, setObjects] = React.useState<
    Array<{ value: string; label: string }>
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!activeProjectId) return;
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      const [lRes, oRes] = await Promise.all([
        listLookupsTw(activeProjectId),
        listObjectsTw(activeProjectId),
      ]);
      if (!alive) return;
      if (lRes.ok) setRows(lRes.data.map((l) => ({ ...l, _key: l.id })));
      else setError(lRes.error);
      if (oRes.ok) {
        setObjects(
          oRes.data.map((o) => ({ value: o.slug, label: o.labelPlural || o.slug })),
        );
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [activeProjectId]);

  function patch(key: string, p: Partial<Row>): void {
    setRows((prev) =>
      prev.map((r) => (r._key === key ? { ...r, ...p, _dirty: true } : r)),
    );
  }
  function add(): void {
    setRows((prev) => [
      ...prev,
      {
        id: '',
        projectId: activeProjectId ?? '',
        objectSlug: objects[0]?.value ?? '',
        relationField: '',
        parentObject: objects[0]?.value ?? '',
        sourceKey: '',
        targetKey: '',
        name: '',
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
    if (
      !row.objectSlug ||
      !row.relationField.trim() ||
      !row.parentObject ||
      !row.sourceKey.trim() ||
      !row.targetKey.trim()
    ) {
      toast({
        title: 'Object, relation field, parent, source and target are required.',
        tone: 'danger',
      });
      return;
    }
    setBusyKey(row._key);
    const res = await saveLookupTw(
      {
        id: row._isNew ? undefined : row.id,
        objectSlug: row.objectSlug,
        relationField: row.relationField.trim(),
        parentObject: row.parentObject,
        sourceKey: row.sourceKey.trim(),
        targetKey: row.targetKey.trim(),
        name: row.name?.trim() || row.targetKey.trim(),
        enabled: row.enabled,
      },
      activeProjectId,
    );
    setBusyKey(null);
    if (!res.ok) {
      toast({ title: 'Could not save', description: res.error, tone: 'danger' });
      return;
    }
    setRows((prev) =>
      prev.map((r) => (r._key === row._key ? { ...res.data, _key: r._key } : r)),
    );
    toast({
      title: 'Lookup field saved',
      description: 'Records were re-synced.',
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
    const res = await deleteLookupTw(row.id, activeProjectId);
    setBusyKey(null);
    if (!res.ok) {
      toast({ title: 'Could not delete', description: res.error, tone: 'danger' });
      return;
    }
    setRows((prev) => prev.filter((r) => r._key !== row._key));
    toast({ title: 'Lookup field deleted', tone: 'success' });
  }

  return (
    <>
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Lookup fields</PageTitle>
          <PageDescription>
            Mirror a value from a related parent record and keep it in sync. Pick
            the relation field that points at the parent, the parent field to
            copy, and a new field on this object to write it to.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="primary"
            iconLeft={Plus}
            onClick={add}
            disabled={objects.length === 0}
          >
            Add lookup
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
            icon={Link2}
            title="No lookup fields yet"
            description="Add a lookup to mirror a parent record's value onto this object."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-[var(--st-space-2)]">
          {rows.map((row) => (
            <Card
              key={row._key}
              className="flex flex-wrap items-end gap-[var(--st-space-2)] p-[var(--st-space-3)]"
            >
              <Field label="Object" className="min-w-[130px] flex-1">
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
              <Field label="Relation field" className="w-[140px]">
                <Input
                  value={row.relationField}
                  onChange={(e) =>
                    patch(row._key, { relationField: e.target.value })
                  }
                  placeholder="company"
                />
              </Field>
              <Field label="Parent object" className="min-w-[130px] flex-1">
                <Select
                  value={row.parentObject}
                  onValueChange={(parentObject) =>
                    patch(row._key, { parentObject })
                  }
                >
                  <SelectTrigger aria-label="Parent object">
                    <SelectValue placeholder="Parent" />
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
              <Field label="Source field" className="w-[140px]">
                <Input
                  value={row.sourceKey}
                  onChange={(e) => patch(row._key, { sourceKey: e.target.value })}
                  placeholder="industry"
                />
              </Field>
              <Field label="Target key" className="w-[140px]">
                <Input
                  value={row.targetKey}
                  onChange={(e) => patch(row._key, { targetKey: e.target.value })}
                  placeholder="companyIndustry"
                  disabled={!row._isNew}
                />
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
                label="Delete lookup field"
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
