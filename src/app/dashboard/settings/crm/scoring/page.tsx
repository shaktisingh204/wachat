'use client';

/**
 * SabCRM — Lead/Deal scoring settings (`/dashboard/settings/crm/scoring`).
 *
 * A two-pane editor (mirrors `../pipelines/page.tsx`):
 *
 *   LEFT  — the project's scoring rule sets. Each row shows the name, the
 *           object it scores, its rule count and an enabled/off badge. "New"
 *           starts a draft.
 *
 *   RIGHT — the editor for the selected set: name, target object, enabled
 *           switch, an ordered list of RULES (each = a field condition reusing
 *           the records-engine operator vocabulary + a points delta), and a
 *           list of TIERS (score band → label + color). Saving provisions a
 *           `score` (NUMBER) + `scoreTier` (SELECT) field on the object and
 *           re-scores existing records via the gated `saveScoringRulesTw`.
 *
 * Pure 20ui. Auth/RBAC/project are enforced by `../../layout.tsx`; every action
 * independently re-runs the full gate. Degrades to loading / empty / error and
 * never crashes when the engine is unreachable.
 */

import * as React from 'react';
import { Plus, Trash2, Target, RefreshCw, Save, X } from 'lucide-react';

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
import { useProject } from '@/context/project-context';
import {
  listScoringRulesTw,
  saveScoringRulesTw,
  deleteScoringRulesTw,
  recomputeScoresTw,
} from '@/app/actions/sabcrm-scoring.actions';
import { listObjectsTw, getObjectTw } from '@/app/actions/sabcrm-objects.actions';
import type {
  ScoringRule,
  ScoreTier,
  ScoringRuleSet,
} from '@/lib/sabcrm/scoring';
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

/** An editable rule set draft — `id` absent until first saved. */
interface DraftRuleSet {
  id?: string;
  objectSlug: string;
  name: string;
  enabled: boolean;
  rules: ScoringRule[];
  tiers: ScoreTier[];
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

function genId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID?.() ?? `r_${Math.random().toString(36).slice(2, 12)}`;
}

function newRule(): ScoringRule {
  return { id: genId(), label: '', condition: { field: '', op: 'eq', value: '' }, points: 10 };
}
function newTier(): ScoreTier {
  return { min: 0, label: '', color: '' };
}
function emptyDraft(objectSlug = ''): DraftRuleSet {
  return {
    objectSlug,
    name: 'New scoring',
    enabled: true,
    rules: [newRule()],
    tiers: [
      { min: 0, label: 'Cold', color: 'neutral' },
      { min: 30, label: 'Warm', color: 'warning' },
      { min: 60, label: 'Hot', color: 'success' },
    ],
  };
}

/** Normalize a draft for persistence (in/notIn → array; valueless → no value). */
function normalizeForSave(draft: DraftRuleSet): DraftRuleSet {
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
        points: Number.isFinite(r.points) ? Number(r.points) : 0,
      } as ScoringRule;
    });
  const tiers = draft.tiers
    .filter((t) => t.label.trim())
    .map((t) => ({
      min: Number.isFinite(t.min) ? Number(t.min) : 0,
      label: t.label.trim(),
      color: t.color?.trim() || undefined,
    }))
    .sort((a, b) => a.min - b.min);
  return { ...draft, rules, tiers };
}

export default function ScoringSettingsPage(): React.ReactElement {
  const { activeProjectId, isLoadingProject } = useProject();
  const { toast } = useToast();

  const [ruleSets, setRuleSets] = React.useState<ScoringRuleSet[]>([]);
  const [objects, setObjects] = React.useState<ObjectOption[]>([]);
  const [fields, setFields] = React.useState<FieldOption[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<DraftRuleSet | null>(null);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  // Load rule sets + object list.
  React.useEffect(() => {
    if (!activeProjectId) return;
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      const [setsRes, objsRes] = await Promise.all([
        listScoringRulesTw(activeProjectId),
        listObjectsTw(activeProjectId),
      ]);
      if (!alive) return;
      if (setsRes.ok) setRuleSets(setsRes.data);
      else setError(setsRes.error);
      if (objsRes.ok) {
        setObjects(
          objsRes.data.map((o) => ({ value: o.slug, label: o.labelPlural || o.slug })),
        );
      }
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

  function selectSet(rs: ScoringRuleSet): void {
    setSelectedId(rs.id);
    setDraft({
      id: rs.id,
      objectSlug: rs.objectSlug,
      name: rs.name,
      enabled: rs.enabled,
      rules: rs.rules.length ? rs.rules.map((r) => ({ ...r })) : [newRule()],
      tiers: rs.tiers.map((t) => ({ ...t })),
    });
  }
  function startNew(): void {
    setSelectedId(null);
    setDraft(emptyDraft(objects[0]?.value ?? ''));
  }
  function patchDraft(patch: Partial<DraftRuleSet>): void {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  }
  function patchRule(idx: number, patch: Partial<ScoringRule>): void {
    setDraft((d) =>
      d ? { ...d, rules: d.rules.map((r, i) => (i === idx ? { ...r, ...patch } : r)) } : d,
    );
  }
  function patchCondition(idx: number, patch: Partial<ScoringRule['condition']>): void {
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
  function patchTier(idx: number, patch: Partial<ScoreTier>): void {
    setDraft((d) =>
      d ? { ...d, tiers: d.tiers.map((t, i) => (i === idx ? { ...t, ...patch } : t)) } : d,
    );
  }

  async function save(): Promise<void> {
    if (!draft || !activeProjectId) return;
    if (!draft.objectSlug) {
      toast({ title: 'Pick an object to score.', tone: 'danger' });
      return;
    }
    setSaving(true);
    const input = normalizeForSave(draft);
    const res = await saveScoringRulesTw(
      {
        id: input.id,
        objectSlug: input.objectSlug,
        name: input.name,
        enabled: input.enabled,
        rules: input.rules,
        tiers: input.tiers,
      },
      activeProjectId,
    );
    setSaving(false);
    if (!res.ok) {
      toast({ title: 'Could not save', description: res.error, tone: 'danger' });
      return;
    }
    toast({ title: 'Scoring saved', description: 'Existing records were re-scored.', tone: 'success' });
    const listRes = await listScoringRulesTw(activeProjectId);
    if (listRes.ok) setRuleSets(listRes.data);
    selectSet(res.data);
  }

  async function remove(): Promise<void> {
    if (!draft?.id || !activeProjectId) return;
    setConfirmDelete(false);
    setBusy(true);
    const res = await deleteScoringRulesTw(draft.id, activeProjectId);
    setBusy(false);
    if (!res.ok) {
      toast({ title: 'Could not delete', description: res.error, tone: 'danger' });
      return;
    }
    setRuleSets((prev) => prev.filter((r) => r.id !== draft.id));
    setDraft(null);
    setSelectedId(null);
    toast({ title: 'Scoring deleted', tone: 'success' });
  }

  async function recomputeNow(): Promise<void> {
    if (!draft?.objectSlug || !activeProjectId) return;
    setBusy(true);
    const res = await recomputeScoresTw(draft.objectSlug, activeProjectId);
    setBusy(false);
    if (!res.ok) {
      toast({ title: 'Recompute failed', description: res.error, tone: 'danger' });
      return;
    }
    toast({
      title: 'Scores recomputed',
      description: `${res.data.updated} of ${res.data.scanned} records updated.`,
      tone: 'success',
    });
  }

  return (
    <>
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Lead scoring</PageTitle>
          <PageDescription>
            Rule-based scoring for any object. Each rule adds points when its
            condition matches; the total maps to a tier.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={startNew}>
            New scoring
          </Button>
        </PageActions>
      </PageHeader>

      {error && (
        <Alert tone="danger" className="mb-[var(--st-space-3)]">
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-[var(--st-space-4)] lg:grid-cols-[280px_1fr]">
        {/* LEFT — list */}
        <div className="flex flex-col gap-[var(--st-space-2)]">
          {loading || isLoadingProject ? (
            <>
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </>
          ) : ruleSets.length === 0 ? (
            <EmptyState
              icon={Target}
              title="No scoring yet"
              description="Create a rule set to start scoring records."
            />
          ) : (
            ruleSets.map((rs) => (
              <button
                key={rs.id}
                type="button"
                onClick={() => selectSet(rs)}
                className={`flex flex-col gap-1 rounded-[var(--st-radius)] border px-[var(--st-space-3)] py-[var(--st-space-2)] text-left transition-colors ${
                  selectedId === rs.id
                    ? 'border-[var(--st-accent)] bg-[var(--st-bg-secondary)]'
                    : 'border-[var(--st-border)] hover:bg-[var(--st-bg-secondary)]'
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-[var(--st-text)]">
                    {rs.name}
                  </span>
                  <Badge tone={rs.enabled ? 'success' : 'neutral'} kind="soft">
                    {rs.enabled ? 'On' : 'Off'}
                  </Badge>
                </span>
                <span className="text-[12px] text-[var(--st-text-secondary)]">
                  {rs.objectSlug} · {rs.rules.length} rule
                  {rs.rules.length === 1 ? '' : 's'}
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
                icon={Target}
                title="Select or create a scoring rule set"
                description="Rules add points when their condition matches; tiers turn the total into a label."
              />
            </Card>
          ) : (
            <Card className="flex flex-col gap-[var(--st-space-4)] p-[var(--st-space-4)]">
              <div className="grid grid-cols-1 gap-[var(--st-space-3)] sm:grid-cols-2">
                <Field label="Name">
                  <Input
                    value={draft.name}
                    onChange={(e) => patchDraft({ name: e.target.value })}
                    placeholder="e.g. Inbound lead score"
                  />
                </Field>
                <Field label="Object to score">
                  <Select
                    value={draft.objectSlug}
                    onValueChange={(objectSlug) => patchDraft({ objectSlug })}
                  >
                    <SelectTrigger aria-label="Object to score">
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

              <div className="flex items-center gap-[var(--st-space-3)]">
                <Switch
                  checked={draft.enabled}
                  aria-label="Enable scoring"
                  onCheckedChange={(enabled) => patchDraft({ enabled })}
                />
                <span className="text-[13px] text-[var(--st-text)]">
                  Enabled — recompute on every record create/update
                </span>
              </div>

              {/* Rules */}
              <div className="flex flex-col gap-[var(--st-space-2)]">
                <span className="text-[13px] font-semibold text-[var(--st-text)]">
                  Rules
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
                      <Field label="Points" className="w-[90px]">
                        <Input
                          type="number"
                          inputMode="numeric"
                          value={Number.isFinite(rule.points) ? rule.points : 0}
                          onChange={(e) =>
                            patchRule(i, { points: Number(e.target.value) })
                          }
                        />
                      </Field>
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

              {/* Tiers */}
              <div className="flex flex-col gap-[var(--st-space-2)]">
                <span className="text-[13px] font-semibold text-[var(--st-text)]">
                  Tiers
                </span>
                {draft.tiers.map((tier, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-end gap-[var(--st-space-2)] rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-[var(--st-space-2)]"
                  >
                    <Field label="Score ≥" className="w-[110px]">
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={Number.isFinite(tier.min) ? tier.min : 0}
                        onChange={(e) => patchTier(i, { min: Number(e.target.value) })}
                      />
                    </Field>
                    <Field label="Label" className="min-w-[140px] flex-1">
                      <Input
                        value={tier.label}
                        onChange={(e) => patchTier(i, { label: e.target.value })}
                        placeholder="e.g. Hot"
                      />
                    </Field>
                    <Field label="Color" className="min-w-[120px] flex-1">
                      <Input
                        value={tier.color ?? ''}
                        onChange={(e) => patchTier(i, { color: e.target.value })}
                        placeholder="success / warning / #22c55e"
                      />
                    </Field>
                    <IconButton
                      icon={X}
                      label="Remove tier"
                      variant="ghost"
                      onClick={() =>
                        patchDraft({ tiers: draft.tiers.filter((_, j) => j !== i) })
                      }
                    />
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={Plus}
                  onClick={() => patchDraft({ tiers: [...draft.tiers, newTier()] })}
                >
                  Add tier
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
                      onClick={recomputeNow}
                      disabled={busy}
                    >
                      Recompute now
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
            <AlertDialogTitle>Delete this scoring rule set?</AlertDialogTitle>
            <AlertDialogDescription>
              Existing score values on records are left as-is. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
