'use client';

/**
 * SabCRM — Field dependencies (`/dashboard/settings/crm/field-dependencies`).
 *
 * Salesforce-style dependent picklists: the allowed options of a controlled
 * SELECT field depend on the value of a controlling SELECT field. Pick an
 * object → a controlling field → a dependent field, then toggle, in a matrix of
 * controlling-value × dependent-value, which dependent options are allowed for
 * each controlling value. Saving makes the record form filter the dependent
 * SELECT live and blocks invalid combos on save.
 *
 * Pure 20ui; auth/RBAC/project enforced by the layout + re-checked per action.
 */

import * as React from 'react';
import { Plus, Trash2, Network, Save, Pencil } from 'lucide-react';

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
  listFieldDependenciesTw,
  saveFieldDependencyTw,
  deleteFieldDependencyTw,
} from '@/app/actions/sabcrm-fielddeps.actions';
import { listObjectsTw, getObjectTw } from '@/app/actions/sabcrm-objects.actions';
import type { FieldDependency } from '@/lib/sabcrm/field-deps.server';

interface FieldOpt {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

interface ObjOpt {
  slug: string;
  label: string;
}

/** The matrix editor state: object + the two fields + the allow-map. */
interface Draft {
  id?: string;
  objectSlug: string;
  controllingField: string;
  dependentField: string;
  name: string;
  enabled: boolean;
  /** controlling value → set of allowed dependent values. */
  map: Record<string, Set<string>>;
}

function emptyDraft(objectSlug: string): Draft {
  return {
    objectSlug,
    controllingField: '',
    dependentField: '',
    name: '',
    enabled: true,
    map: {},
  };
}

function mapToSets(m: Record<string, string[]>): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {};
  for (const [k, v] of Object.entries(m)) out[k] = new Set(v);
  return out;
}
function setsToMap(m: Record<string, Set<string>>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(m)) {
    const arr = [...v];
    if (arr.length > 0) out[k] = arr;
  }
  return out;
}

export default function FieldDependenciesPage(): React.ReactElement {
  const { activeProjectId, isLoadingProject } = useProject();
  const { toast } = useToast();

  const [rows, setRows] = React.useState<FieldDependency[]>([]);
  const [objects, setObjects] = React.useState<ObjOpt[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  // The matrix editor (null = closed).
  const [draft, setDraft] = React.useState<Draft | null>(null);
  // SELECT fields of the draft's object.
  const [selectFields, setSelectFields] = React.useState<FieldOpt[]>([]);
  const [fieldsLoading, setFieldsLoading] = React.useState(false);

  React.useEffect(() => {
    if (!activeProjectId) return;
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      const [dRes, oRes] = await Promise.all([
        listFieldDependenciesTw(activeProjectId),
        listObjectsTw(activeProjectId),
      ]);
      if (!alive) return;
      if (dRes.ok) setRows(dRes.data);
      else setError(dRes.error);
      if (oRes.ok) {
        setObjects(
          oRes.data.map((o) => ({ slug: o.slug, label: o.labelPlural || o.slug })),
        );
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [activeProjectId]);

  // Load the SELECT fields of the draft's object whenever it changes.
  React.useEffect(() => {
    if (!activeProjectId || !draft?.objectSlug) {
      setSelectFields([]);
      return;
    }
    let alive = true;
    setFieldsLoading(true);
    (async () => {
      const res = await getObjectTw(draft.objectSlug, activeProjectId);
      if (!alive) return;
      if (res.ok) {
        setSelectFields(
          res.data.fields
            .filter((f) => f.type === 'SELECT' || f.type === 'MULTI_SELECT')
            .map((f) => ({
              key: f.key,
              label: f.label || f.key,
              options: (f.options ?? []).map((o) => ({
                value: String(o.value),
                label: o.label || String(o.value),
              })),
            })),
        );
      } else {
        setSelectFields([]);
      }
      setFieldsLoading(false);
    })();
    return () => {
      alive = false;
    };
    // Only re-fetch on object change, not on every keystroke in the draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId, draft?.objectSlug]);

  const objLabel = (slug: string) =>
    objects.find((o) => o.slug === slug)?.label ?? slug;

  function startNew(): void {
    setDraft(emptyDraft(objects[0]?.slug ?? ''));
  }

  function startEdit(dep: FieldDependency): void {
    setDraft({
      id: dep.id,
      objectSlug: dep.objectSlug,
      controllingField: dep.controllingField,
      dependentField: dep.dependentField,
      name: dep.name ?? '',
      enabled: dep.enabled,
      map: mapToSets(dep.map),
    });
  }

  const controllingFieldDef = selectFields.find(
    (f) => f.key === draft?.controllingField,
  );
  const dependentFieldDef = selectFields.find(
    (f) => f.key === draft?.dependentField,
  );

  function toggleCell(controlVal: string, depVal: string): void {
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d.map };
      const set = new Set(next[controlVal] ?? []);
      if (set.has(depVal)) set.delete(depVal);
      else set.add(depVal);
      next[controlVal] = set;
      return { ...d, map: next };
    });
  }

  async function save(): Promise<void> {
    if (!activeProjectId || !draft) return;
    if (!draft.objectSlug || !draft.controllingField || !draft.dependentField) {
      toast({
        title: 'Object, controlling and dependent fields are required.',
        tone: 'danger',
      });
      return;
    }
    if (draft.controllingField === draft.dependentField) {
      toast({
        title: 'Controlling and dependent fields must differ.',
        tone: 'danger',
      });
      return;
    }
    setSaving(true);
    const res = await saveFieldDependencyTw(
      {
        id: draft.id,
        objectSlug: draft.objectSlug,
        controllingField: draft.controllingField,
        dependentField: draft.dependentField,
        name: draft.name.trim() || undefined,
        enabled: draft.enabled,
        map: setsToMap(draft.map),
      },
      activeProjectId,
    );
    setSaving(false);
    if (!res.ok) {
      toast({ title: 'Could not save', description: res.error, tone: 'danger' });
      return;
    }
    setRows((prev) => {
      const i = prev.findIndex((r) => r.id === res.data.id);
      if (i === -1) return [res.data, ...prev];
      const copy = [...prev];
      copy[i] = res.data;
      return copy;
    });
    setDraft(null);
    toast({ title: 'Dependency saved', tone: 'success' });
  }

  async function remove(dep: FieldDependency): Promise<void> {
    if (!activeProjectId) return;
    setBusyId(dep.id);
    const res = await deleteFieldDependencyTw(dep.id, activeProjectId);
    setBusyId(null);
    if (!res.ok) {
      toast({ title: 'Could not delete', description: res.error, tone: 'danger' });
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== dep.id));
    if (draft?.id === dep.id) setDraft(null);
    toast({ title: 'Dependency deleted', tone: 'success' });
  }

  return (
    <>
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Field dependencies</PageTitle>
          <PageDescription>
            Dependent picklists — the options of a controlled SELECT field depend
            on the value of a controlling field. Invalid combinations are blocked
            on save and the dependent field is filtered live in the record form.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="primary"
            iconLeft={Plus}
            onClick={startNew}
            disabled={objects.length === 0}
          >
            Add dependency
          </Button>
        </PageActions>
      </PageHeader>

      {error && (
        <Alert tone="danger" className="mb-[var(--st-space-3)]">
          {error}
        </Alert>
      )}

      {/* Matrix editor */}
      {draft && (
        <Card className="mb-[var(--st-space-3)] flex flex-col gap-[var(--st-space-3)] p-[var(--st-space-4)]">
          <div className="flex flex-wrap items-end gap-[var(--st-space-2)]">
            <Field label="Object" className="min-w-[160px] flex-1">
              <Select
                value={draft.objectSlug}
                onValueChange={(objectSlug) =>
                  setDraft((d) =>
                    d
                      ? {
                          ...d,
                          objectSlug,
                          controllingField: '',
                          dependentField: '',
                          map: {},
                        }
                      : d,
                  )
                }
              >
                <SelectTrigger aria-label="Object">
                  <SelectValue placeholder="Object" />
                </SelectTrigger>
                <SelectContent>
                  {objects.map((o) => (
                    <SelectItem key={o.slug} value={o.slug}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Controlling field" className="min-w-[160px] flex-1">
              <Select
                value={draft.controllingField}
                onValueChange={(controllingField) =>
                  setDraft((d) => (d ? { ...d, controllingField, map: {} } : d))
                }
              >
                <SelectTrigger aria-label="Controlling field">
                  <SelectValue placeholder="Pick a SELECT field" />
                </SelectTrigger>
                <SelectContent>
                  {selectFields.map((f) => (
                    <SelectItem key={f.key} value={f.key}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Dependent field" className="min-w-[160px] flex-1">
              <Select
                value={draft.dependentField}
                onValueChange={(dependentField) =>
                  setDraft((d) => (d ? { ...d, dependentField } : d))
                }
              >
                <SelectTrigger aria-label="Dependent field">
                  <SelectValue placeholder="Pick a SELECT field" />
                </SelectTrigger>
                <SelectContent>
                  {selectFields
                    .filter((f) => f.key !== draft.controllingField)
                    .map((f) => (
                      <SelectItem key={f.key} value={f.key}>
                        {f.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="On" className="w-[60px]">
              <Switch
                checked={draft.enabled}
                aria-label="Enabled"
                onCheckedChange={(enabled) =>
                  setDraft((d) => (d ? { ...d, enabled } : d))
                }
              />
            </Field>
          </div>

          <Field label="Name (optional)" className="max-w-[360px]">
            <Input
              value={draft.name}
              onChange={(e) =>
                setDraft((d) => (d ? { ...d, name: e.target.value } : d))
              }
              placeholder="Country → State"
            />
          </Field>

          {fieldsLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : controllingFieldDef && dependentFieldDef ? (
            controllingFieldDef.options.length === 0 ||
            dependentFieldDef.options.length === 0 ? (
              <Alert tone="warning">
                Both fields must define at least one option to map a dependency.
              </Alert>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[var(--st-font-size-sm)]">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-[1] bg-[var(--st-color-surface)] p-[var(--st-space-2)] text-left font-[var(--st-font-weight-medium)]">
                        {controllingFieldDef.label} \ {dependentFieldDef.label}
                      </th>
                      {dependentFieldDef.options.map((dep) => (
                        <th
                          key={dep.value}
                          className="p-[var(--st-space-2)] text-center font-[var(--st-font-weight-medium)]"
                        >
                          {dep.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {controllingFieldDef.options.map((ctrl) => (
                      <tr
                        key={ctrl.value}
                        className="border-t border-[var(--st-color-border)]"
                      >
                        <td className="sticky left-0 z-[1] bg-[var(--st-color-surface)] p-[var(--st-space-2)] font-[var(--st-font-weight-medium)]">
                          {ctrl.label}
                        </td>
                        {dependentFieldDef.options.map((dep) => (
                          <td
                            key={dep.value}
                            className="p-[var(--st-space-2)] text-center"
                          >
                            <Switch
                              checked={
                                draft.map[ctrl.value]?.has(dep.value) ?? false
                              }
                              aria-label={`Allow ${dep.label} when ${ctrl.label}`}
                              onCheckedChange={() =>
                                toggleCell(ctrl.value, dep.value)
                              }
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-[var(--st-space-2)] text-[var(--st-font-size-xs)] text-[var(--st-color-text-muted)]">
                  A controlling value with no toggles is unrestricted — every
                  dependent option is allowed.
                </p>
              </div>
            )
          ) : (
            <Alert tone="info">
              Pick a controlling and a dependent SELECT field to map their values.
            </Alert>
          )}

          <div className="flex gap-[var(--st-space-2)]">
            <Button
              variant="primary"
              iconLeft={Save}
              onClick={save}
              loading={saving}
              disabled={saving}
            >
              Save dependency
            </Button>
            <Button variant="ghost" onClick={() => setDraft(null)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Existing dependencies */}
      {loading || isLoadingProject ? (
        <div className="flex flex-col gap-[var(--st-space-2)]">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-[var(--st-space-5)]">
          <EmptyState
            icon={Network}
            title="No field dependencies yet"
            description="Make a SELECT field's options depend on the value of another field."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-[var(--st-space-2)]">
          {rows.map((dep) => (
            <Card
              key={dep.id}
              className="flex flex-wrap items-center gap-[var(--st-space-2)] p-[var(--st-space-3)]"
            >
              <div className="min-w-[180px] flex-1">
                <div className="flex items-center gap-[var(--st-space-2)]">
                  <span className="font-[var(--st-font-weight-medium)]">
                    {dep.name ||
                      `${dep.controllingField} → ${dep.dependentField}`}
                  </span>
                  {!dep.enabled && <Badge tone="neutral">Off</Badge>}
                </div>
                <div className="text-[var(--st-font-size-xs)] text-[var(--st-color-text-muted)]">
                  {objLabel(dep.objectSlug)} · {dep.controllingField} controls{' '}
                  {dep.dependentField} · {Object.keys(dep.map).length} mapped value
                  {Object.keys(dep.map).length === 1 ? '' : 's'}
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                iconLeft={Pencil}
                onClick={() => startEdit(dep)}
              >
                Edit
              </Button>
              <IconButton
                icon={Trash2}
                label="Delete dependency"
                variant="ghost"
                onClick={() => remove(dep)}
                disabled={busyId === dep.id}
              />
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
