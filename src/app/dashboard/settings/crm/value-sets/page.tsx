'use client';

/**
 * SabCRM — Global value sets (`/dashboard/settings/crm/value-sets`).
 *
 * Reusable, centrally-managed picklist option lists that many SELECT /
 * MULTI_SELECT fields share (Salesforce "global value sets"). Manage the sets
 * and their values here; add new values, or deprecate stale ones (deprecated
 * values stay for historical records but disappear from new picks).
 *
 * A SELECT field opts in by storing this set's id under its field metadata's
 * `settings.valueSetId` (Data model → field → settings); the record form then
 * resolves the field's options from the set's active values.
 *
 * Pure 20ui; auth/RBAC/project enforced by the layout + re-checked per action.
 */

import * as React from 'react';
import { Plus, Trash2, ListChecks, Save, Ban, RotateCcw } from 'lucide-react';

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
  Badge,
  Alert,
  EmptyState,
  Skeleton,
  Separator,
  useToast,
} from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import {
  listValueSetsTw,
  saveValueSetTw,
  deleteValueSetTw,
  addValueTw,
  deprecateValueTw,
} from '@/app/actions/sabcrm-valuesets.actions';
import type { GlobalValueSet, ValueSetValue } from '@/lib/sabcrm/value-sets.server';

interface Row extends GlobalValueSet {
  _dirty?: boolean;
  _isNew?: boolean;
  _key: string;
}

function genKey(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID?.() ?? `k_${Math.random().toString(36).slice(2, 10)}`;
}

export default function ValueSetsPage(): React.ReactElement {
  const { activeProjectId, isLoadingProject } = useProject();
  const { toast } = useToast();

  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  // New-value draft per set, keyed by row._key.
  const [drafts, setDrafts] = React.useState<Record<string, { value: string; label: string }>>({});

  React.useEffect(() => {
    if (!activeProjectId) return;
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      const res = await listValueSetsTw(activeProjectId);
      if (!alive) return;
      if (res.ok) setRows(res.data.map((s) => ({ ...s, _key: s.id })));
      else setError(res.error);
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
      {
        id: '',
        name: '',
        values: [],
        _isNew: true,
        _dirty: true,
        _key: genKey(),
      },
      ...prev,
    ]);
  }

  async function save(row: Row): Promise<void> {
    if (!activeProjectId) return;
    if (!row.name.trim()) {
      toast({ title: 'A name is required.', tone: 'danger' });
      return;
    }
    setBusyKey(row._key);
    const res = await saveValueSetTw(
      {
        id: row._isNew ? undefined : row.id,
        name: row.name.trim(),
        values: row.values,
      },
      activeProjectId,
    );
    setBusyKey(null);
    if (!res.ok) {
      toast({ title: 'Could not save', description: res.error, tone: 'danger' });
      return;
    }
    setRows((prev) => prev.map((r) => (r._key === row._key ? { ...res.data, _key: r._key } : r)));
    toast({ title: 'Value set saved', tone: 'success' });
  }

  async function remove(row: Row): Promise<void> {
    if (row._isNew || !row.id) {
      setRows((prev) => prev.filter((r) => r._key !== row._key));
      return;
    }
    if (!activeProjectId) return;
    setBusyKey(row._key);
    const res = await deleteValueSetTw(row.id, activeProjectId);
    setBusyKey(null);
    if (!res.ok) {
      toast({ title: 'Could not delete', description: res.error, tone: 'danger' });
      return;
    }
    setRows((prev) => prev.filter((r) => r._key !== row._key));
    toast({ title: 'Value set deleted', tone: 'success' });
  }

  async function addValue(row: Row): Promise<void> {
    if (!activeProjectId) return;
    const draft = drafts[row._key];
    const value = draft?.value?.trim();
    if (!value) {
      toast({ title: 'A value is required.', tone: 'danger' });
      return;
    }
    if (row._isNew || !row.id) {
      // Unsaved set: mutate locally; the value persists on the next Save.
      const next = row.values.filter((v) => v.value !== value);
      next.push({ value, label: draft?.label?.trim() || value, active: true });
      patch(row._key, { values: next });
      setDrafts((d) => ({ ...d, [row._key]: { value: '', label: '' } }));
      return;
    }
    setBusyKey(row._key);
    const res = await addValueTw(
      row.id,
      { value, label: draft?.label?.trim() || value },
      activeProjectId,
    );
    setBusyKey(null);
    if (!res.ok) {
      toast({ title: 'Could not add value', description: res.error, tone: 'danger' });
      return;
    }
    setRows((prev) => prev.map((r) => (r._key === row._key ? { ...res.data, _key: r._key } : r)));
    setDrafts((d) => ({ ...d, [row._key]: { value: '', label: '' } }));
  }

  async function toggleDeprecate(row: Row, v: ValueSetValue): Promise<void> {
    if (row._isNew || !row.id) {
      // Unsaved: flip locally.
      const next = row.values.map((o) =>
        o.value === v.value ? { ...o, active: !o.active } : o,
      );
      patch(row._key, { values: next });
      return;
    }
    if (!activeProjectId) return;
    if (v.active) {
      setBusyKey(row._key);
      const res = await deprecateValueTw(row.id, v.value, activeProjectId);
      setBusyKey(null);
      if (!res.ok) {
        toast({ title: 'Could not deprecate', description: res.error, tone: 'danger' });
        return;
      }
      setRows((prev) => prev.map((r) => (r._key === row._key ? { ...res.data, _key: r._key } : r)));
    } else {
      // Re-activate by re-adding (addValue re-activates an existing value).
      setBusyKey(row._key);
      const res = await addValueTw(
        row.id,
        { value: v.value, label: v.label, color: v.color },
        activeProjectId,
      );
      setBusyKey(null);
      if (!res.ok) {
        toast({ title: 'Could not re-activate', description: res.error, tone: 'danger' });
        return;
      }
      setRows((prev) => prev.map((r) => (r._key === row._key ? { ...res.data, _key: r._key } : r)));
    }
  }

  return (
    <>
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Global value sets</PageTitle>
          <PageDescription>
            Reusable picklists shared by many SELECT fields. A field opts in by
            referencing a set (Data model → field → <code>settings.valueSetId</code>);
            deprecate a value to retire it from new picks while keeping it on
            historical records.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={add}>
            Add value set
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
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-[var(--st-space-5)]">
          <EmptyState
            icon={ListChecks}
            title="No value sets yet"
            description="Create a reusable picklist so multiple SELECT fields share one option list."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-[var(--st-space-3)]">
          {rows.map((row) => {
            const draft = drafts[row._key] ?? { value: '', label: '' };
            return (
              <Card key={row._key} className="flex flex-col gap-[var(--st-space-3)] p-[var(--st-space-3)]">
                <div className="flex flex-wrap items-end gap-[var(--st-space-2)]">
                  <Field label="Name" className="min-w-[200px] flex-1">
                    <Input
                      value={row.name}
                      onChange={(e) => patch(row._key, { name: e.target.value })}
                      placeholder="Lead sources"
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
                    label="Delete value set"
                    variant="ghost"
                    onClick={() => remove(row)}
                    disabled={busyKey === row._key}
                  />
                </div>

                <Separator />

                {row.values.length === 0 ? (
                  <p className="text-[length:var(--st-font-sm)] text-[color:var(--st-fg-muted)]">
                    No values yet. Add the first option below.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-[var(--st-space-1)]">
                    {row.values.map((v) => (
                      <li
                        key={v.value}
                        className="flex items-center gap-[var(--st-space-2)]"
                      >
                        <Badge tone={v.active ? 'neutral' : 'warning'}>
                          {v.label}
                        </Badge>
                        <code className="text-[length:var(--st-font-xs)] text-[color:var(--st-fg-muted)]">
                          {v.value}
                        </code>
                        {!v.active && (
                          <span className="text-[length:var(--st-font-xs)] text-[color:var(--st-fg-muted)]">
                            deprecated
                          </span>
                        )}
                        <span className="ms-auto" />
                        <IconButton
                          icon={v.active ? Ban : RotateCcw}
                          label={v.active ? 'Deprecate value' : 'Re-activate value'}
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleDeprecate(row, v)}
                          disabled={busyKey === row._key}
                        />
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex flex-wrap items-end gap-[var(--st-space-2)]">
                  <Field label="New value" className="w-[160px]">
                    <Input
                      value={draft.value}
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [row._key]: { ...draft, value: e.target.value },
                        }))
                      }
                      placeholder="web"
                    />
                  </Field>
                  <Field label="Label" className="min-w-[160px] flex-1">
                    <Input
                      value={draft.label}
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [row._key]: { ...draft, label: e.target.value },
                        }))
                      }
                      placeholder="Website"
                    />
                  </Field>
                  <Button
                    variant="secondary"
                    size="sm"
                    iconLeft={Plus}
                    onClick={() => addValue(row)}
                    disabled={busyKey === row._key || !draft.value.trim()}
                  >
                    Add value
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
