'use client';

/**
 * SabCRM — Sharing rules settings (`/dashboard/settings/crm/sharing-rules`).
 *
 * Salesforce-style criteria / ownership SHARING rules that GRANT extra read
 * access on top of owner scope. A two-pane editor (mirrors `../scoring/page.tsx`):
 *
 *   LEFT  — the project's sharing rules. Each row shows the name, object, kind
 *           and an on/off badge. "New" starts a draft.
 *
 *   RIGHT — the editor for the selected rule: name, target object, kind
 *           (ownership / criteria), who it shares WITH (role or explicit users),
 *           and either the SOURCE owners (ownership) or the match CONDITIONS
 *           (criteria, reusing the records-engine operator vocabulary).
 *
 * A prominent, DEFAULT-OFF "Enforce sharing" switch controls whether rules
 * affect live reads. It carries an explicit security warning — enabling widens
 * visibility and should only be done after review.
 *
 * Pure 20ui. Auth/RBAC/project are enforced by `../../layout.tsx`; every action
 * independently re-runs the full gate. Degrades to loading / empty / error.
 */

import * as React from 'react';
import {
  Plus,
  Trash2,
  Share2,
  Save,
  X,
  ShieldAlert,
  Users,
  Filter as FilterIcon,
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
import { useProject } from '@/context/project-context';
import {
  listSharingRulesTw,
  saveSharingRuleTw,
  deleteSharingRuleTw,
  getSharingEnforcementTw,
  setSharingEnforcementTw,
} from '@/app/actions/sabcrm-sharing.actions';
import { listObjectsTw, getObjectTw } from '@/app/actions/sabcrm-objects.actions';
import type { SharingRule } from '@/lib/sabcrm/sharing-rules';
import type { FilterCondition, FilterOperator } from '@/lib/sabcrm/records-filter';

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
}

type RuleKind = 'owner' | 'criteria';

/** An editable rule draft — `id` absent until first saved. */
interface DraftRule {
  id?: string;
  object: string;
  name: string;
  type: RuleKind;
  enabled: boolean;
  /** Who gains access. */
  shareWithKind: 'role' | 'users';
  shareWithRoleId: string;
  /** Comma-separated user ids for the `users` target. */
  shareWithUsers: string;
  /** SOURCE owners (ownership kind) — comma-separated user ids. */
  ownerUsers: string;
  /** Match conditions (criteria kind). */
  criteria: FilterCondition[];
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

// Common CRM role slugs (free-text override also accepted via the users target).
const ROLE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'agent', label: 'Agent / member' },
];

const VALUELESS_OPS = new Set<FilterOperator>(['isEmpty', 'isNotEmpty']);
const LIST_OPS = new Set<FilterOperator>(['in', 'notIn']);

function genId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID?.() ?? `c_${Math.random().toString(36).slice(2, 12)}`;
}

function newCondition(): FilterCondition {
  return { field: '', op: 'eq', value: '' };
}

function emptyDraft(object = ''): DraftRule {
  return {
    object,
    name: 'New sharing rule',
    type: 'criteria',
    enabled: true,
    shareWithKind: 'role',
    shareWithRoleId: 'manager',
    shareWithUsers: '',
    ownerUsers: '',
    criteria: [newCondition()],
  };
}

function csv(s: string): string[] {
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Map a persisted rule into an editable draft. */
function ruleToDraft(rule: SharingRule): DraftRule {
  const sw = rule.shareWith;
  return {
    id: rule.id,
    object: rule.object,
    name: rule.name ?? 'Sharing rule',
    type: rule.type,
    enabled: rule.enabled,
    shareWithKind: sw?.kind === 'users' ? 'users' : 'role',
    shareWithRoleId: sw?.roleId ?? 'manager',
    shareWithUsers: (sw?.userIds ?? []).join(', '),
    ownerUsers: (rule.ownerScope?.userIds ?? []).join(', '),
    criteria: rule.criteria?.length ? rule.criteria.map((c) => ({ ...c })) : [newCondition()],
  };
}

/** Normalize a draft into the save input. */
function draftToInput(draft: DraftRule) {
  const shareWith =
    draft.shareWithKind === 'role'
      ? { kind: 'role' as const, roleId: draft.shareWithRoleId.trim() }
      : { kind: 'users' as const, userIds: csv(draft.shareWithUsers) };

  const criteria =
    draft.type === 'criteria'
      ? draft.criteria
          .filter((c) => c.field || VALUELESS_OPS.has(c.op))
          .map((c) => {
            let value: unknown = c.value;
            if (VALUELESS_OPS.has(c.op)) value = undefined;
            else if (LIST_OPS.has(c.op)) value = csv(String(value ?? ''));
            return { field: c.field, op: c.op, value };
          })
      : [];

  return {
    id: draft.id,
    object: draft.object,
    name: draft.name.trim() || 'Sharing rule',
    type: draft.type,
    enabled: draft.enabled,
    shareWith,
    ownerScope:
      draft.type === 'owner'
        ? { kind: 'users' as const, userIds: csv(draft.ownerUsers) }
        : undefined,
    criteria,
  };
}

export default function SharingRulesSettingsPage(): React.ReactElement {
  const { activeProjectId, isLoadingProject } = useProject();
  const { toast } = useToast();

  const [rules, setRules] = React.useState<SharingRule[]>([]);
  const [objects, setObjects] = React.useState<ObjectOption[]>([]);
  const [fields, setFields] = React.useState<FieldOption[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<DraftRule | null>(null);
  const [enforced, setEnforced] = React.useState(false);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [confirmEnable, setConfirmEnable] = React.useState(false);

  // Load rules + enforcement state + object list.
  React.useEffect(() => {
    if (!activeProjectId) return;
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      const [rulesRes, objsRes, enfRes] = await Promise.all([
        listSharingRulesTw(activeProjectId),
        listObjectsTw(activeProjectId),
        getSharingEnforcementTw(activeProjectId),
      ]);
      if (!alive) return;
      if (rulesRes.ok) setRules(rulesRes.data);
      else setError(rulesRes.error);
      if (objsRes.ok) {
        setObjects(objsRes.data.map((o) => ({ value: o.slug, label: o.labelPlural || o.slug })));
      }
      if (enfRes.ok) setEnforced(enfRes.data.enabled);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [activeProjectId]);

  // Load the selected/draft object's fields for the condition picker.
  React.useEffect(() => {
    const slug = draft?.object;
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
  }, [draft?.object, activeProjectId]);

  function selectRule(rule: SharingRule): void {
    setSelectedId(rule.id);
    setDraft(ruleToDraft(rule));
  }
  function startNew(): void {
    setSelectedId(null);
    setDraft(emptyDraft(objects[0]?.value ?? ''));
  }
  function patchDraft(patch: Partial<DraftRule>): void {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  }
  function patchCondition(idx: number, patch: Partial<FilterCondition>): void {
    setDraft((d) =>
      d ? { ...d, criteria: d.criteria.map((c, i) => (i === idx ? { ...c, ...patch } : c)) } : d,
    );
  }

  async function save(): Promise<void> {
    if (!draft || !activeProjectId) return;
    if (!draft.object) {
      toast({ title: 'Pick an object to share.', tone: 'danger' });
      return;
    }
    setSaving(true);
    const res = await saveSharingRuleTw(draftToInput(draft), activeProjectId);
    setSaving(false);
    if (!res.ok) {
      toast({ title: 'Could not save', description: res.error, tone: 'danger' });
      return;
    }
    toast({ title: 'Sharing rule saved', tone: 'success' });
    const listRes = await listSharingRulesTw(activeProjectId);
    if (listRes.ok) setRules(listRes.data);
    selectRule(res.data);
  }

  async function remove(): Promise<void> {
    if (!draft?.id || !activeProjectId) return;
    setConfirmDelete(false);
    setBusy(true);
    const res = await deleteSharingRuleTw(draft.id, activeProjectId);
    setBusy(false);
    if (!res.ok) {
      toast({ title: 'Could not delete', description: res.error, tone: 'danger' });
      return;
    }
    setRules((prev) => prev.filter((r) => r.id !== draft.id));
    setDraft(null);
    setSelectedId(null);
    toast({ title: 'Sharing rule deleted', tone: 'success' });
  }

  // Enforcement toggle. Turning ON requires explicit confirmation (it widens
  // visibility); turning OFF is immediate (it only restores prior behaviour).
  function onToggleEnforce(next: boolean): void {
    if (next) {
      setConfirmEnable(true);
      return;
    }
    void applyEnforce(false);
  }
  async function applyEnforce(next: boolean): Promise<void> {
    if (!activeProjectId) return;
    setConfirmEnable(false);
    setBusy(true);
    const res = await setSharingEnforcementTw(next, activeProjectId);
    setBusy(false);
    if (!res.ok) {
      toast({ title: 'Could not update enforcement', description: res.error, tone: 'danger' });
      return;
    }
    setEnforced(res.data.enabled);
    toast({
      title: res.data.enabled ? 'Sharing enforcement ON' : 'Sharing enforcement OFF',
      description: res.data.enabled
        ? 'Rules now widen read access on the native record path.'
        : 'Reads behave as before — rules no longer apply.',
      tone: res.data.enabled ? 'success' : 'neutral',
    });
  }

  return (
    <>
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Sharing rules</PageTitle>
          <PageDescription>
            Grant extra read access on top of ownership. Ownership rules share a
            team&apos;s records with another user or role; criteria rules share
            records matching a condition. Rules are additive — they never hide a
            record you can already see.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={startNew}>
            New rule
          </Button>
        </PageActions>
      </PageHeader>

      {/* Enforcement flag — DEFAULT-OFF security gate. */}
      <Card className="mb-[var(--st-space-4)] flex flex-col gap-[var(--st-space-2)] p-[var(--st-space-4)]">
        <div className="flex items-start justify-between gap-[var(--st-space-3)]">
          <div className="flex items-start gap-[var(--st-space-2)]">
            <span className="mt-[2px] text-[var(--st-text-secondary)]" aria-hidden="true">
              <ShieldAlert size={18} />
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-[13px] font-semibold text-[var(--st-text)]">
                Enforce sharing on reads
              </span>
              <span className="text-[12px] text-[var(--st-text-secondary)]">
                Off by default. When on, the native record read path OR-extends
                each viewer&apos;s results with the rules below.
              </span>
            </div>
          </div>
          <Switch
            checked={enforced}
            disabled={busy || loading}
            aria-label="Enforce sharing on reads"
            onCheckedChange={onToggleEnforce}
          />
        </div>
        {enforced && (
          <Alert tone="warning">
            Enforcement is ON. Sharing rules now widen record visibility. Review
            your rules carefully — this is a security-significant setting.
          </Alert>
        )}
      </Card>

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
          ) : rules.length === 0 ? (
            <EmptyState
              icon={Share2}
              title="No sharing rules yet"
              description="Create a rule to grant extra read access."
            />
          ) : (
            rules.map((rule) => (
              <button
                key={rule.id}
                type="button"
                onClick={() => selectRule(rule)}
                className={`flex flex-col gap-1 rounded-[var(--st-radius)] border px-[var(--st-space-3)] py-[var(--st-space-2)] text-left transition-colors ${
                  selectedId === rule.id
                    ? 'border-[var(--st-accent)] bg-[var(--st-bg-secondary)]'
                    : 'border-[var(--st-border)] hover:bg-[var(--st-bg-secondary)]'
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-[var(--st-text)]">
                    {rule.name || 'Sharing rule'}
                  </span>
                  <Badge tone={rule.enabled ? 'success' : 'neutral'} kind="soft">
                    {rule.enabled ? 'On' : 'Off'}
                  </Badge>
                </span>
                <span className="text-[12px] text-[var(--st-text-secondary)]">
                  {rule.object} · {rule.type === 'owner' ? 'ownership' : 'criteria'}
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
                icon={Share2}
                title="Select or create a sharing rule"
                description="Ownership rules share by owner; criteria rules share by record condition."
              />
            </Card>
          ) : (
            <Card className="flex flex-col gap-[var(--st-space-4)] p-[var(--st-space-4)]">
              <div className="grid grid-cols-1 gap-[var(--st-space-3)] sm:grid-cols-2">
                <Field label="Name">
                  <Input
                    value={draft.name}
                    onChange={(e) => patchDraft({ name: e.target.value })}
                    placeholder="e.g. Share Closed Won with Finance"
                  />
                </Field>
                <Field label="Object to share">
                  <Select value={draft.object} onValueChange={(object) => patchDraft({ object })}>
                    <SelectTrigger aria-label="Object to share">
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
                <Field label="Rule type">
                  <Select
                    value={draft.type}
                    onValueChange={(t) => patchDraft({ type: t as RuleKind })}
                  >
                    <SelectTrigger aria-label="Rule type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Ownership-based</SelectItem>
                      <SelectItem value="criteria">Criteria-based</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <div className="flex items-center gap-[var(--st-space-3)] pt-[var(--st-space-5)]">
                  <Switch
                    checked={draft.enabled}
                    aria-label="Enable rule"
                    onCheckedChange={(enabled) => patchDraft({ enabled })}
                  />
                  <span className="text-[13px] text-[var(--st-text)]">Rule enabled</span>
                </div>
              </div>

              {/* Share with (target) */}
              <div className="flex flex-col gap-[var(--st-space-2)]">
                <span className="flex items-center gap-[var(--st-space-1)] text-[13px] font-semibold text-[var(--st-text)]">
                  <span aria-hidden="true">
                    <Users size={14} />
                  </span>
                  Share with
                </span>
                <div className="flex flex-wrap items-end gap-[var(--st-space-2)]">
                  <Field label="Target" className="min-w-[160px]">
                    <Select
                      value={draft.shareWithKind}
                      onValueChange={(k) =>
                        patchDraft({ shareWithKind: k as 'role' | 'users' })
                      }
                    >
                      <SelectTrigger aria-label="Share target">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="role">A role</SelectItem>
                        <SelectItem value="users">Specific users</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  {draft.shareWithKind === 'role' ? (
                    <Field label="Role" className="min-w-[180px] flex-1">
                      <Select
                        value={draft.shareWithRoleId}
                        onValueChange={(shareWithRoleId) => patchDraft({ shareWithRoleId })}
                      >
                        <SelectTrigger aria-label="Role">
                          <SelectValue placeholder="Pick a role" />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  ) : (
                    <Field label="User ids (comma-separated)" className="min-w-[220px] flex-1">
                      <Input
                        value={draft.shareWithUsers}
                        onChange={(e) => patchDraft({ shareWithUsers: e.target.value })}
                        placeholder="id1, id2"
                      />
                    </Field>
                  )}
                </div>
              </div>

              {/* Source / criteria depending on kind */}
              {draft.type === 'owner' ? (
                <Field label="Records owned by (user ids, comma-separated)">
                  <Input
                    value={draft.ownerUsers}
                    onChange={(e) => patchDraft({ ownerUsers: e.target.value })}
                    placeholder="ownerId1, ownerId2"
                  />
                </Field>
              ) : (
                <div className="flex flex-col gap-[var(--st-space-2)]">
                  <span className="flex items-center gap-[var(--st-space-1)] text-[13px] font-semibold text-[var(--st-text)]">
                    <span aria-hidden="true">
                      <FilterIcon size={14} />
                    </span>
                    Match conditions (all must match)
                  </span>
                  {draft.criteria.map((cond, i) => {
                    const valueless = VALUELESS_OPS.has(cond.op);
                    return (
                      <div
                        key={i}
                        className="flex flex-wrap items-end gap-[var(--st-space-2)] rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-[var(--st-space-2)]"
                      >
                        <Field label="Field" className="min-w-[150px] flex-1">
                          <Select
                            value={cond.field}
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
                            value={cond.op}
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
                              value={String(cond.value ?? '')}
                              onChange={(e) => patchCondition(i, { value: e.target.value })}
                              placeholder={LIST_OPS.has(cond.op) ? 'a, b, c' : 'value'}
                            />
                          </Field>
                        )}
                        <IconButton
                          icon={Trash2}
                          label="Remove condition"
                          variant="ghost"
                          onClick={() =>
                            patchDraft({ criteria: draft.criteria.filter((_, j) => j !== i) })
                          }
                        />
                      </div>
                    );
                  })}
                  <Button
                    variant="ghost"
                    size="sm"
                    iconLeft={Plus}
                    onClick={() => patchDraft({ criteria: [...draft.criteria, newCondition()] })}
                  >
                    Add condition
                  </Button>
                </div>
              )}

              {/* Footer actions */}
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
            <AlertDialogTitle>Delete this sharing rule?</AlertDialogTitle>
            <AlertDialogDescription>
              Viewers who relied on this rule for extra access will lose it. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmEnable} onOpenChange={setConfirmEnable}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enable sharing enforcement?</AlertDialogTitle>
            <AlertDialogDescription>
              This WIDENS record visibility: every enabled rule will start
              granting extra read access on the native record path. Review your
              rules first. You can turn this off again at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void applyEnforce(true)}>
              Enable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
