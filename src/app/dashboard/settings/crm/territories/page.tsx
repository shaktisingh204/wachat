'use client';

/**
 * SabCRM — Territory management settings (`/dashboard/settings/crm/territories`).
 *
 * A two-pane editor (mirrors `../scoring/page.tsx`):
 *
 *   LEFT  — the territory TREE for the project (built client-side from the flat
 *           list via the pure `buildTerritoryTree`). Each row is indented by its
 *           depth and shows the name, an enabled/off badge and rule count.
 *           "New" starts a draft.
 *
 *   RIGHT — the editor for the selected territory: name, target object, parent,
 *           enabled switch, match mode (ALL/ANY), an ordered list of RULES (each
 *           = a field condition reusing the records-engine operator vocabulary)
 *           and a comma list of manager user-ids. Saving provisions a
 *           `territoryId` SELECT field on the object and re-stamps existing
 *           records via the gated `saveTerritoryTw`.
 *
 *   A SECURITY card exposes the DEFAULT-OFF access enforcement flag with an
 *   explicit warning that enabling it can hide records and needs a review.
 *
 * Pure 20ui; lucide icons via `renderIcon`. Auth/RBAC/project are enforced by
 * `../../layout.tsx`; every action independently re-runs the full gate. Degrades
 * to loading / empty / error and never crashes when the engine is unreachable.
 */

import * as React from 'react';
import {
  Plus,
  Trash2,
  Map as MapIcon,
  RefreshCw,
  Save,
  ShieldAlert,
} from 'lucide-react';

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
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
  useToast,
} from '@/components/sabcrm/20ui';
import { renderIcon } from '@/components/sabcrm/20ui/_icon';
import { useProject } from '@/context/project-context';
import {
  listTerritoriesTw,
  saveTerritoryTw,
  deleteTerritoryTw,
  reassignTerritoriesTw,
  getTerritoryEnforcementTw,
  setTerritoryEnforcementTw,
} from '@/app/actions/sabcrm-territory.actions';
import { listObjectsTw, getObjectTw } from '@/app/actions/sabcrm-objects.actions';
import {
  buildTerritoryTree,
  type Territory,
  type TerritoryRule,
  type TerritoryMatchMode,
  type TerritoryTreeNode,
} from '@/lib/sabcrm/territory';
import type { FilterOperator } from '@/lib/sabcrm/records-filter';

// ---------------------------------------------------------------------------
// Local wire shapes (kept free of any server-only import)
// ---------------------------------------------------------------------------

interface ObjectOption {
  value: string;
  label: string;
}
interface FieldOption {
  key: string;
  label: string;
  type: string;
}

/** An editable territory draft — `id` absent until first saved. */
interface DraftTerritory {
  id?: string;
  objectSlug: string;
  name: string;
  parentId: string | null;
  enabled: boolean;
  match: TerritoryMatchMode;
  rules: TerritoryRule[];
  managerUserIds: string[];
  order: number;
}

const OPERATORS: ReadonlyArray<{ value: FilterOperator; label: string }> = [
  { value: 'eq', label: 'equals' },
  { value: 'neq', label: 'does not equal' },
  { value: 'contains', label: 'contains' },
  { value: 'notContains', label: 'does not contain' },
  { value: 'gt', label: 'greater than' },
  { value: 'gte', label: 'greater or equal' },
  { value: 'lt', label: 'less than' },
  { value: 'lte', label: 'less or equal' },
  { value: 'in', label: 'is any of (comma list)' },
  { value: 'notIn', label: 'is none of (comma list)' },
  { value: 'isEmpty', label: 'is empty' },
  { value: 'isNotEmpty', label: 'is not empty' },
];

const VALUELESS_OPS = new Set<FilterOperator>(['isEmpty', 'isNotEmpty']);
const LIST_OPS = new Set<FilterOperator>(['in', 'notIn']);
const NO_PARENT = '__root__';

function genId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID?.() ?? `t_${Math.random().toString(36).slice(2, 12)}`;
}

function newRule(): TerritoryRule {
  return { id: genId(), label: '', condition: { field: '', op: 'eq', value: '' } };
}

function emptyDraft(objectSlug = '', parentId: string | null = null): DraftTerritory {
  return {
    objectSlug,
    name: 'New territory',
    parentId,
    enabled: true,
    match: 'all',
    rules: [newRule()],
    managerUserIds: [],
    order: 0,
  };
}

/** Normalize a draft for persistence (in/notIn → array; valueless → no value). */
function normalizeForSave(draft: DraftTerritory): DraftTerritory {
  const rules = draft.rules
    .filter((r) => r.condition.field || VALUELESS_OPS.has(r.condition.op))
    .map((r) => {
      const op = r.condition.op;
      let value: unknown = r.condition.value;
      if (VALUELESS_OPS.has(op)) value = undefined;
      else if (LIST_OPS.has(op)) {
        value = String(value ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
      return {
        id: r.id || genId(),
        label: r.label?.trim() || undefined,
        condition: { field: r.condition.field, op, value },
      } as TerritoryRule;
    });
  return { ...draft, rules };
}

/** Flatten the tree into ordered { node, depth } rows for the left rail. */
function flattenTree(
  nodes: TerritoryTreeNode[],
  depth = 0,
): Array<{ territory: Territory; depth: number }> {
  const out: Array<{ territory: Territory; depth: number }> = [];
  for (const n of nodes) {
    out.push({ territory: n.territory, depth });
    out.push(...flattenTree(n.children, depth + 1));
  }
  return out;
}

export default function TerritoriesSettingsPage(): React.ReactElement {
  const { activeProjectId, isLoadingProject } = useProject();
  const { toast } = useToast();

  const [territories, setTerritories] = React.useState<Territory[]>([]);
  const [objects, setObjects] = React.useState<ObjectOption[]>([]);
  const [fields, setFields] = React.useState<FieldOption[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<DraftTerritory | null>(null);
  const [enforcement, setEnforcement] = React.useState(false);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [confirmEnforce, setConfirmEnforce] = React.useState(false);

  // Load territories + objects + the enforcement flag.
  React.useEffect(() => {
    if (!activeProjectId) return;
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      const [terrRes, objsRes, flagRes] = await Promise.all([
        listTerritoriesTw(undefined, activeProjectId),
        listObjectsTw(activeProjectId),
        getTerritoryEnforcementTw(activeProjectId),
      ]);
      if (!alive) return;
      if (terrRes.ok) setTerritories(terrRes.data);
      else setError(terrRes.error);
      if (objsRes.ok) {
        setObjects(
          objsRes.data.map((o) => ({ value: o.slug, label: o.labelPlural || o.slug })),
        );
      }
      if (flagRes.ok) setEnforcement(flagRes.data.enabled);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [activeProjectId]);

  // Load the selected/draft object's fields for the condition picker.
  React.useEffect(() => {
    const slug = draft?.objectSlug;
    if (!slug || !activeProjectId) {
      setFields([]);
      return;
    }
    let alive = true;
    (async () => {
      const res = await getObjectTw(slug, activeProjectId);
      if (!alive) return;
      if (res.ok) {
        setFields(
          (res.data.fields ?? [])
            .filter((f) => !String(f.key).startsWith('__'))
            .map((f) => ({ key: f.key, label: f.label || f.key, type: String(f.type) })),
        );
      } else setFields([]);
    })();
    return () => {
      alive = false;
    };
  }, [draft?.objectSlug, activeProjectId]);

  const rows = React.useMemo(
    () => flattenTree(buildTerritoryTree(territories)),
    [territories],
  );

  // Valid parent options for the draft: same object, excluding self.
  const parentOptions = React.useMemo(() => {
    if (!draft) return [];
    return territories.filter(
      (t) => t.objectSlug === draft.objectSlug && t.id !== draft.id,
    );
  }, [territories, draft]);

  function selectTerritory(t: Territory): void {
    setSelectedId(t.id);
    setDraft({
      id: t.id,
      objectSlug: t.objectSlug,
      name: t.name,
      parentId: t.parentId ?? null,
      enabled: t.enabled,
      match: t.match,
      rules: t.rules.length ? t.rules.map((r) => ({ ...r })) : [newRule()],
      managerUserIds: [...t.managerUserIds],
      order: t.order,
    });
  }
  function startNew(): void {
    setSelectedId(null);
    setDraft(emptyDraft(objects[0]?.value ?? ''));
  }
  function patchDraft(patch: Partial<DraftTerritory>): void {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  }
  function patchRule(idx: number, patch: Partial<TerritoryRule>): void {
    setDraft((d) =>
      d ? { ...d, rules: d.rules.map((r, i) => (i === idx ? { ...r, ...patch } : r)) } : d,
    );
  }
  function patchCondition(idx: number, patch: Partial<TerritoryRule['condition']>): void {
    setDraft((d) =>
      d
        ? {
            ...d,
            rules: d.rules.map((r, i) =>
              i === idx ? { ...r, condition: { ...r.condition, ...patch } } : r,
            ),
          }
        : d,
    );
  }

  async function save(): Promise<void> {
    if (!draft || !activeProjectId) return;
    if (!draft.objectSlug) {
      toast({ title: 'Pick an object for this territory.', tone: 'danger' });
      return;
    }
    setSaving(true);
    const input = normalizeForSave(draft);
    const res = await saveTerritoryTw(
      {
        id: input.id,
        objectSlug: input.objectSlug,
        name: input.name,
        parentId: input.parentId,
        enabled: input.enabled,
        match: input.match,
        rules: input.rules,
        managerUserIds: input.managerUserIds,
        order: input.order,
      },
      activeProjectId,
    );
    setSaving(false);
    if (!res.ok) {
      toast({ title: 'Could not save', description: res.error, tone: 'danger' });
      return;
    }
    toast({
      title: 'Territory saved',
      description: 'Existing records were re-stamped.',
      tone: 'success',
    });
    const listRes = await listTerritoriesTw(undefined, activeProjectId);
    if (listRes.ok) setTerritories(listRes.data);
    selectTerritory(res.data);
  }

  async function remove(): Promise<void> {
    if (!draft?.id || !activeProjectId) return;
    setConfirmDelete(false);
    setBusy(true);
    const res = await deleteTerritoryTw(draft.id, activeProjectId);
    setBusy(false);
    if (!res.ok) {
      toast({ title: 'Could not delete', description: res.error, tone: 'danger' });
      return;
    }
    const listRes = await listTerritoriesTw(undefined, activeProjectId);
    if (listRes.ok) setTerritories(listRes.data);
    setDraft(null);
    setSelectedId(null);
    toast({ title: 'Territory deleted', tone: 'success' });
  }

  async function reassignNow(): Promise<void> {
    if (!draft?.objectSlug || !activeProjectId) return;
    setBusy(true);
    const res = await reassignTerritoriesTw(draft.objectSlug, activeProjectId);
    setBusy(false);
    if (!res.ok) {
      toast({ title: 'Reassign failed', description: res.error, tone: 'danger' });
      return;
    }
    toast({
      title: 'Territories reassigned',
      description: `${res.data.updated} of ${res.data.scanned} records updated.`,
      tone: 'success',
    });
  }

  async function toggleEnforcement(next: boolean): Promise<void> {
    if (!activeProjectId) return;
    // Turning ON is security-sensitive — confirm first.
    if (next && !enforcement) {
      setConfirmEnforce(true);
      return;
    }
    await applyEnforcement(false);
  }

  async function applyEnforcement(enable: boolean): Promise<void> {
    if (!activeProjectId) return;
    setConfirmEnforce(false);
    setBusy(true);
    const res = await setTerritoryEnforcementTw(enable, activeProjectId);
    setBusy(false);
    if (!res.ok) {
      toast({ title: 'Could not update', description: res.error, tone: 'danger' });
      return;
    }
    setEnforcement(res.data.enabled);
    toast({
      title: res.data.enabled
        ? 'Territory access enforcement ON'
        : 'Territory access enforcement OFF',
      tone: res.data.enabled ? 'success' : 'neutral',
    });
  }

  return (
    <>
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Territories</PageTitle>
          <PageDescription>
            Build a territory hierarchy and assignment rules. Each record is
            stamped with the first matching territory; access can roll up to the
            territory&apos;s managers.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={startNew}>
            New territory
          </Button>
        </PageActions>
      </PageHeader>

      {error && (
        <Alert tone="danger" className="mb-[var(--st-space-3)]">
          {error}
        </Alert>
      )}

      {/* SECURITY — DEFAULT-OFF access enforcement flag */}
      <Card className="mb-[var(--st-space-4)] flex flex-col gap-[var(--st-space-2)] p-[var(--st-space-4)]">
        <div className="flex items-start justify-between gap-[var(--st-space-3)]">
          <div className="flex items-start gap-[var(--st-space-2)]">
            <span className="mt-[2px] text-[var(--st-warning)]">
              {renderIcon(ShieldAlert, { size: 18 })}
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-[13px] font-semibold text-[var(--st-text)]">
                Territory access enforcement
              </span>
              <span className="max-w-[640px] text-[12px] text-[var(--st-text-secondary)]">
                Off by default. When ON, list/read results narrow so a manager
                sees the records in territories they manage in addition to their
                own. This can HIDE records and only applies to the in-app read
                path (the Rust read path is not covered). Enable deliberately,
                after a security review on a running app.
              </span>
            </div>
          </div>
          <Switch
            checked={enforcement}
            aria-label="Territory access enforcement"
            disabled={busy}
            onCheckedChange={toggleEnforcement}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-[var(--st-space-4)] lg:grid-cols-[300px_1fr]">
        {/* LEFT — tree */}
        <div className="flex flex-col gap-[var(--st-space-2)]">
          {loading || isLoadingProject ? (
            <>
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={MapIcon}
              title="No territories yet"
              description="Create one to start stamping records by region."
            />
          ) : (
            rows.map(({ territory: t, depth }) => (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTerritory(t)}
                style={{ marginLeft: depth * 16 }}
                className={`flex flex-col gap-1 rounded-[var(--st-radius)] border px-[var(--st-space-3)] py-[var(--st-space-2)] text-left transition-colors ${
                  selectedId === t.id
                    ? 'border-[var(--st-accent)] bg-[var(--st-bg-secondary)]'
                    : 'border-[var(--st-border)] hover:bg-[var(--st-bg-secondary)]'
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-[var(--st-text)]">
                    {t.name}
                  </span>
                  <Badge tone={t.enabled ? 'success' : 'neutral'} kind="soft">
                    {t.enabled ? 'On' : 'Off'}
                  </Badge>
                </span>
                <span className="text-[12px] text-[var(--st-text-secondary)]">
                  {t.objectSlug} · {t.rules.length} rule
                  {t.rules.length === 1 ? '' : 's'}
                  {t.managerUserIds.length > 0
                    ? ` · ${t.managerUserIds.length} mgr${
                        t.managerUserIds.length === 1 ? '' : 's'
                      }`
                    : ''}
                </span>
              </button>
            ))
          )}
        </div>

        {/* RIGHT — editor */}
        <div>
          {!draft ? (
            <Card className="p-[var(--st-space-5)]">
              <EmptyState
                icon={MapIcon}
                title="Select or create a territory"
                description="Rules stamp a record; managers can see everyone in their territory subtree."
              />
            </Card>
          ) : (
            <Card className="flex flex-col gap-[var(--st-space-4)] p-[var(--st-space-4)]">
              <div className="grid grid-cols-1 gap-[var(--st-space-3)] sm:grid-cols-2">
                <Field label="Name">
                  <Input
                    value={draft.name}
                    onChange={(e) => patchDraft({ name: e.target.value })}
                    placeholder="e.g. US West"
                  />
                </Field>
                <Field label="Object">
                  <Select
                    value={draft.objectSlug}
                    onValueChange={(objectSlug) =>
                      patchDraft({ objectSlug, parentId: null })
                    }
                  >
                    <SelectTrigger aria-label="Object">
                      <SelectValue placeholder="Select an object" />
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
              </div>

              <div className="grid grid-cols-1 gap-[var(--st-space-3)] sm:grid-cols-2">
                <Field label="Parent territory">
                  <Select
                    value={draft.parentId ?? NO_PARENT}
                    onValueChange={(v) =>
                      patchDraft({ parentId: v === NO_PARENT ? null : v })
                    }
                  >
                    <SelectTrigger aria-label="Parent territory">
                      <SelectValue placeholder="No parent (root)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_PARENT}>No parent (root)</SelectItem>
                      {parentOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Match mode">
                  <Select
                    value={draft.match}
                    onValueChange={(v) =>
                      patchDraft({ match: v as TerritoryMatchMode })
                    }
                  >
                    <SelectTrigger aria-label="Match mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Match ALL rules</SelectItem>
                      <SelectItem value="any">Match ANY rule</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-[var(--st-space-3)] sm:grid-cols-2">
                <Field
                  label="Evaluation order"
                  help="Lower wins when two territories both match."
                >
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={Number.isFinite(draft.order) ? draft.order : 0}
                    onChange={(e) => patchDraft({ order: Number(e.target.value) })}
                  />
                </Field>
                <Field
                  label="Manager user ids"
                  help="Comma-separated. Managers see this territory's subtree (when enforcement is on)."
                >
                  <Input
                    value={draft.managerUserIds.join(', ')}
                    onChange={(e) =>
                      patchDraft({
                        managerUserIds: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="userId1, userId2"
                  />
                </Field>
              </div>

              <div className="flex items-center gap-[var(--st-space-3)]">
                <Switch
                  checked={draft.enabled}
                  aria-label="Enable territory"
                  onCheckedChange={(enabled) => patchDraft({ enabled })}
                />
                <span className="text-[13px] text-[var(--st-text)]">
                  Enabled — stamp on every record create/update
                </span>
              </div>

              {/* Rules */}
              <div className="flex flex-col gap-[var(--st-space-2)]">
                <span className="text-[13px] font-semibold text-[var(--st-text)]">
                  Assignment rules
                </span>
                {draft.rules.map((rule, i) => {
                  const valueless = VALUELESS_OPS.has(rule.condition.op);
                  return (
                    <div
                      key={rule.id}
                      className="flex flex-wrap items-end gap-[var(--st-space-2)] rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-[var(--st-space-2)]"
                    >
                      <Field label="Field" className="min-w-[150px] flex-1">
                        <Select
                          value={rule.condition.field}
                          onValueChange={(field) => patchCondition(i, { field })}
                        >
                          <SelectTrigger aria-label="Field">
                            <SelectValue placeholder="Pick a field" />
                          </SelectTrigger>
                          <SelectContent>
                            {fields.map((f) => (
                              <SelectItem key={f.key} value={f.key}>
                                {f.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Operator" className="min-w-[150px] flex-1">
                        <Select
                          value={rule.condition.op}
                          onValueChange={(op) =>
                            patchCondition(i, { op: op as FilterOperator })
                          }
                        >
                          <SelectTrigger aria-label="Operator">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OPERATORS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      {!valueless && (
                        <Field label="Value" className="min-w-[120px] flex-1">
                          <Input
                            value={String(rule.condition.value ?? '')}
                            onChange={(e) =>
                              patchCondition(i, { value: e.target.value })
                            }
                            placeholder={
                              LIST_OPS.has(rule.condition.op) ? 'a, b, c' : 'value'
                            }
                          />
                        </Field>
                      )}
                      <IconButton
                        icon={Trash2}
                        label="Remove rule"
                        variant="ghost"
                        onClick={() =>
                          patchDraft({
                            rules: draft.rules.filter((_, j) => j !== i),
                          })
                        }
                      />
                    </div>
                  );
                })}
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={Plus}
                  onClick={() => patchDraft({ rules: [...draft.rules, newRule()] })}
                >
                  Add rule
                </Button>
              </div>

              {/* Footer actions */}
              <div className="flex items-center justify-between gap-[var(--st-space-2)] border-t border-[var(--st-border)] pt-[var(--st-space-3)]">
                <div className="flex items-center gap-[var(--st-space-2)]">
                  <Button
                    variant="primary"
                    iconLeft={Save}
                    onClick={save}
                    loading={saving}
                    disabled={saving}
                  >
                    Save
                  </Button>
                  {draft.id && (
                    <Button
                      variant="ghost"
                      iconLeft={RefreshCw}
                      onClick={reassignNow}
                      disabled={busy}
                    >
                      Reassign now
                    </Button>
                  )}
                </div>
                {draft.id && (
                  <Button
                    variant="ghost"
                    iconLeft={Trash2}
                    onClick={() => setConfirmDelete(true)}
                    disabled={busy}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this territory?</AlertDialogTitle>
            <AlertDialogDescription>
              Child territories re-parent to this one&apos;s parent. Stamped
              records keep their current value until re-stamped. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmEnforce} onOpenChange={setConfirmEnforce}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enable territory access enforcement?</AlertDialogTitle>
            <AlertDialogDescription>
              This NARROWS what users see: records will be filtered to the
              territories each manager is responsible for (plus their own). It
              can hide records and only covers the in-app read path. Confirm only
              after a security review on a running app.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => applyEnforcement(true)}>
              Enable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
