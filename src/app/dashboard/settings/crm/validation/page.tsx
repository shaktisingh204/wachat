'use client';

/**
 * SabCRM — Validation rules settings (`/dashboard/settings/crm/validation`).
 *
 * Two-pane editor (mirrors `../scoring/page.tsx`). A rule set targets one
 * object; each rule is a VIOLATION condition (reusing the records-engine
 * operator vocabulary), a severity (block / warn) and a message. On save,
 * `block` rules reject an invalid record create/update at the action layer;
 * `warn` rules are advisory. Pure 20ui; auth/RBAC/project enforced by the
 * parent layout and re-checked in every action.
 */

import * as React from 'react';
import { Plus, Trash2, ShieldCheck, Save } from 'lucide-react';

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
  listValidationRulesTw,
  saveValidationRulesTw,
  deleteValidationRulesTw,
} from '@/app/actions/sabcrm-validation.actions';
import { listObjectsTw, getObjectTw } from '@/app/actions/sabcrm-objects.actions';
import type {
  ValidationRule,
  ValidationRuleSet,
  ValidationSeverity,
} from '@/lib/sabcrm/validation';
import type { FilterOperator } from '@/lib/sabcrm/records-filter';

interface ObjectOption {
  value: string;
  label: string;
}
interface FieldOption {
  key: string;
  label: string;
}

interface DraftRuleSet {
  id?: string;
  objectSlug: string;
  name: string;
  enabled: boolean;
  rules: ValidationRule[];
}

const OPERATORS: ReadonlyArray<{ value: FilterOperator; label: string }> = [
  { value: 'isEmpty', label: 'is empty (required)' },
  { value: 'isNotEmpty', label: 'is not empty' },
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
];

const VALUELESS_OPS = new Set<FilterOperator>(['isEmpty', 'isNotEmpty']);
const LIST_OPS = new Set<FilterOperator>(['in', 'notIn']);

function genId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID?.() ?? `v_${Math.random().toString(36).slice(2, 12)}`;
}

function newRule(): ValidationRule {
  return {
    id: genId(),
    condition: { field: '', op: 'isEmpty' },
    severity: 'block',
    message: '',
  };
}
function emptyDraft(objectSlug = ''): DraftRuleSet {
  return { objectSlug, name: 'New rules', enabled: true, rules: [newRule()] };
}

function normalizeForSave(draft: DraftRuleSet): DraftRuleSet {
  const rules = draft.rules
    .filter((r) => r.condition.field)
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
        severity: r.severity,
        message: r.message?.trim() || 'Validation failed.',
        enabled: r.enabled,
      } as ValidationRule;
    });
  return { ...draft, rules };
}

export default function ValidationSettingsPage(): React.ReactElement {
  const { activeProjectId, isLoadingProject } = useProject();
  const { toast } = useToast();

  const [ruleSets, setRuleSets] = React.useState<ValidationRuleSet[]>([]);
  const [objects, setObjects] = React.useState<ObjectOption[]>([]);
  const [fields, setFields] = React.useState<FieldOption[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<DraftRuleSet | null>(null);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    if (!activeProjectId) return;
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      const [setsRes, objsRes] = await Promise.all([
        listValidationRulesTw(activeProjectId),
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
            .map((f) => ({ key: f.key, label: f.label || f.key })),
        );
      } else setFields([]);
    })();
    return () => {
      alive = false;
    };
  }, [draft?.objectSlug, activeProjectId]);

  function selectSet(rs: ValidationRuleSet): void {
    setSelectedId(rs.id);
    setDraft({
      id: rs.id,
      objectSlug: rs.objectSlug,
      name: rs.name,
      enabled: rs.enabled,
      rules: rs.rules.length ? rs.rules.map((r) => ({ ...r })) : [newRule()],
    });
  }
  function startNew(): void {
    setSelectedId(null);
    setDraft(emptyDraft(objects[0]?.value ?? ''));
  }
  function patchDraft(patch: Partial<DraftRuleSet>): void {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  }
  function patchRule(idx: number, patch: Partial<ValidationRule>): void {
    setDraft((d) =>
      d ? { ...d, rules: d.rules.map((r, i) => (i === idx ? { ...r, ...patch } : r)) } : d,
    );
  }
  function patchCondition(
    idx: number,
    patch: Partial<ValidationRule['condition']>,
  ): void {
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
      toast({ title: 'Pick an object to validate.', tone: 'danger' });
      return;
    }
    setSaving(true);
    const input = normalizeForSave(draft);
    const res = await saveValidationRulesTw(
      {
        id: input.id,
        objectSlug: input.objectSlug,
        name: input.name,
        enabled: input.enabled,
        rules: input.rules,
      },
      activeProjectId,
    );
    setSaving(false);
    if (!res.ok) {
      toast({ title: 'Could not save', description: res.error, tone: 'danger' });
      return;
    }
    toast({ title: 'Validation rules saved', tone: 'success' });
    const listRes = await listValidationRulesTw(activeProjectId);
    if (listRes.ok) setRuleSets(listRes.data);
    selectSet(res.data);
  }

  async function remove(): Promise<void> {
    if (!draft?.id || !activeProjectId) return;
    setConfirmDelete(false);
    setBusy(true);
    const res = await deleteValidationRulesTw(draft.id, activeProjectId);
    setBusy(false);
    if (!res.ok) {
      toast({ title: 'Could not delete', description: res.error, tone: 'danger' });
      return;
    }
    setRuleSets((prev) => prev.filter((r) => r.id !== draft.id));
    setDraft(null);
    setSelectedId(null);
    toast({ title: 'Validation rules deleted', tone: 'success' });
  }

  return (
    <>
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Validation rules</PageTitle>
          <PageDescription>
            Block or warn when a record is saved with invalid data. Each rule
            fires when its condition matches — e.g. &ldquo;Email is empty&rdquo;
            with severity Block makes email required.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={startNew}>
            New rule set
          </Button>
        </PageActions>
      </PageHeader>

      {error && (
        <Alert tone="danger" className="mb-[var(--st-space-3)]">
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-[var(--st-space-4)] lg:grid-cols-[280px_1fr]">
        <div className="flex flex-col gap-[var(--st-space-2)]">
          {loading || isLoadingProject ? (
            <>
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </>
          ) : ruleSets.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No validation yet"
              description="Create a rule set to guard record data."
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

        <div>
          {!draft ? (
            <Card className="p-[var(--st-space-5)]">
              <EmptyState
                icon={ShieldCheck}
                title="Select or create a rule set"
                description="Rules fire when their condition matches; Block rejects the save, Warn is advisory."
              />
            </Card>
          ) : (
            <Card className="flex flex-col gap-[var(--st-space-4)] p-[var(--st-space-4)]">
              <div className="grid grid-cols-1 gap-[var(--st-space-3)] sm:grid-cols-2">
                <Field label="Name">
                  <Input
                    value={draft.name}
                    onChange={(e) => patchDraft({ name: e.target.value })}
                    placeholder="e.g. Required contact fields"
                  />
                </Field>
                <Field label="Object to validate">
                  <Select
                    value={draft.objectSlug}
                    onValueChange={(objectSlug) => patchDraft({ objectSlug })}
                  >
                    <SelectTrigger aria-label="Object to validate">
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
                  aria-label="Enable validation"
                  onCheckedChange={(enabled) => patchDraft({ enabled })}
                />
                <span className="text-[13px] text-[var(--st-text)]">
                  Enabled — enforce on every record create/update
                </span>
              </div>

              <div className="flex flex-col gap-[var(--st-space-2)]">
                <span className="text-[13px] font-semibold text-[var(--st-text)]">
                  Rules
                </span>
                {draft.rules.map((rule, i) => {
                  const valueless = VALUELESS_OPS.has(rule.condition.op);
                  return (
                    <div
                      key={rule.id}
                      className="flex flex-col gap-[var(--st-space-2)] rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-[var(--st-space-2)]"
                    >
                      <div className="flex flex-wrap items-end gap-[var(--st-space-2)]">
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
                        <Field label="Fails when" className="min-w-[160px] flex-1">
                          <Select
                            value={rule.condition.op}
                            onValueChange={(op) =>
                              patchCondition(i, { op: op as FilterOperator })
                            }
                          >
                            <SelectTrigger aria-label="Condition">
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
                        <Field label="Severity" className="w-[120px]">
                          <Select
                            value={rule.severity}
                            onValueChange={(s) =>
                              patchRule(i, { severity: s as ValidationSeverity })
                            }
                          >
                            <SelectTrigger aria-label="Severity">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="block">Block</SelectItem>
                              <SelectItem value="warn">Warn</SelectItem>
                            </SelectContent>
                          </Select>
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
                      <Field label="Message">
                        <Input
                          value={rule.message}
                          onChange={(e) => patchRule(i, { message: e.target.value })}
                          placeholder="Shown to the user, e.g. “Email is required.”"
                        />
                      </Field>
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

              <div className="flex items-center justify-between gap-[var(--st-space-2)] border-t border-[var(--st-border)] pt-[var(--st-space-3)]">
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
            <AlertDialogTitle>Delete this rule set?</AlertDialogTitle>
            <AlertDialogDescription>
              Records will no longer be validated by these rules. This cannot be
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
