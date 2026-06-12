'use client';

/**
 * SabCRM — Assignment routing client (`/sabcrm/routing`), 20ui.
 *
 * Ordered, condition-gated assignment rules: as records arrive
 * (`record.created` / `form.submission`) the FIRST active matching rule picks
 * an assignee (`round_robin` / `least_assigned` / `fixed`) and writes it onto
 * the record's `data.<assignField>` (default `owner`). This client renders:
 *   - the priority-ordered rules table (position up/down persisted, active
 *     switch, object / trigger / strategy / assignees summary, edit,
 *     delete-confirm)
 *   - the editor dialog (name, object Select, trigger, strategy, assignees
 *     multi-select from workspace members, assignField, flat condition rows
 *     with field / operator / value)
 *
 * Conditions use the workflow condition vocabulary (`evalCondition` in
 * `src/lib/sabcrm/runtime.ts`): `eq` / `ne` / `in` / `nin` / `contains` /
 * `notContains` / `gt` / `gte` / `lt` / `lte` / `isEmpty` / `isNotEmpty`.
 *
 * Data flows down from the server page (`page.tsx`); after a mutation the
 * action revalidates `/sabcrm` and the client calls `router.refresh()` so
 * the table re-renders from fresh server props.
 *
 * ONLY `@/components/sabcrm/20ui` barrel imports (repo rule); auth /
 * onboarding / RBAC are enforced by the SabCRM layout, and every action
 * re-runs the full session → project → RBAC → plan gate.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  Pencil,
  Plus,
  Trash2,
  Waypoints,
} from 'lucide-react';

import {
  Alert,
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  IconButton,
  Input,
  MultiSelect,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  SelectField,
  Switch,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  type SelectOption,
} from '@/components/sabcrm/20ui';

import {
  createSabcrmRoutingRule,
  deleteSabcrmRoutingRule,
  updateSabcrmRoutingRule,
} from '@/app/actions/sabcrm-routing.actions';
import type {
  SabcrmRoutingCondition,
  SabcrmRoutingStrategy,
  SabcrmRoutingTrigger,
  SabcrmRustRoutingRule,
} from '@/lib/rust-client/sabcrm-routing';

import '@/components/sabcrm/20ui/surface-crm-base.css';

// ---------------------------------------------------------------------------
// Shapes passed down from the server page
// ---------------------------------------------------------------------------

/** Lightweight workspace-member option for the assignees multi-select. */
export interface RoutingMemberOption {
  userId: string;
  /** Display name (falls back to email server-side). */
  label: string;
}

/** One CRM object (with its fields) for the object / condition-field Selects. */
export interface RoutingObjectOption {
  slug: string;
  label: string;
  fields: Array<{ key: string; label: string }>;
}

export interface RoutingClientProps {
  /** Rules in priority order (`position` asc) from the server page. */
  initialRules: SabcrmRustRoutingRule[];
  members: RoutingMemberOption[];
  objects: RoutingObjectOption[];
  /** Non-null when the list fetch failed (e.g. the Rust engine is down). */
  initialError: string | null;
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

const TRIGGER_LABEL: Record<SabcrmRoutingTrigger, string> = {
  'record.created': 'Record created',
  'form.submission': 'Form submission',
};

const TRIGGER_OPTIONS: SelectOption[] = [
  { value: 'record.created', label: 'Record created' },
  { value: 'form.submission', label: 'Form submission' },
];

const STRATEGY_LABEL: Record<SabcrmRoutingStrategy, string> = {
  round_robin: 'Round robin',
  least_assigned: 'Least assigned',
  fixed: 'Fixed',
};

const STRATEGY_OPTIONS: SelectOption[] = [
  { value: 'round_robin', label: 'Round robin — rotate through the roster' },
  { value: 'least_assigned', label: 'Least assigned — pick the lightest load' },
  { value: 'fixed', label: 'Fixed — always the first assignee' },
];

/**
 * Workflow condition operator vocabulary (`evalCondition` in
 * `src/lib/sabcrm/runtime.ts`).
 */
const OPERATOR_OPTIONS: SelectOption[] = [
  { value: 'eq', label: 'equals' },
  { value: 'ne', label: 'not equals' },
  { value: 'in', label: 'is any of' },
  { value: 'nin', label: 'is none of' },
  { value: 'contains', label: 'contains' },
  { value: 'notContains', label: "doesn't contain" },
  { value: 'gt', label: 'greater than' },
  { value: 'gte', label: 'greater or equal' },
  { value: 'lt', label: 'less than' },
  { value: 'lte', label: 'less or equal' },
  { value: 'isEmpty', label: 'is empty' },
  { value: 'isNotEmpty', label: 'is not empty' },
];

/** Operators that take no right-hand value. */
const VALUELESS_OPERATORS = new Set(['isEmpty', 'isNotEmpty']);

/** Operators whose value is a comma-separated list → array on the wire. */
const LIST_OPERATORS = new Set(['in', 'nin']);

/** Operators whose value is numeric when it parses as a number. */
const NUMERIC_OPERATORS = new Set(['gt', 'gte', 'lt', 'lte']);

/** "Ana, Ben +2" — first two assignee names, then a count. */
function assigneeSummary(
  assignees: string[],
  nameById: Map<string, string>,
): string {
  if (assignees.length === 0) return '—';
  const names = assignees.map((id) => nameById.get(id) ?? `…${id.slice(-4)}`);
  if (names.length <= 2) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
}

// ---------------------------------------------------------------------------
// Editor state
// ---------------------------------------------------------------------------

interface ConditionState {
  /** Local list key only. */
  uid: number;
  field: string;
  operator: string;
  /** Raw text; parsed per-operator on submit (CSV for in/nin, number for gt…). */
  value: string;
}

interface EditorState {
  /** Set when editing an existing rule. */
  id?: string;
  name: string;
  objectSlug: string;
  trigger: SabcrmRoutingTrigger;
  strategy: SabcrmRoutingStrategy;
  assignees: string[];
  assignField: string;
  active: boolean;
  conditions: ConditionState[];
}

let nextUid = 1;

function emptyCondition(): ConditionState {
  return { uid: nextUid++, field: '', operator: 'eq', value: '' };
}

function emptyEditor(defaultObjectSlug: string): EditorState {
  return {
    name: '',
    objectSlug: defaultObjectSlug,
    trigger: 'record.created',
    strategy: 'round_robin',
    assignees: [],
    assignField: 'owner',
    active: true,
    conditions: [],
  };
}

/** Wire condition value → editable text (arrays back to CSV). */
function conditionValueToText(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map((v) => String(v)).join(', ');
  return String(value);
}

/** Hydrates the editor from a wire rule (the edit path). */
function editorFromRule(rule: SabcrmRustRoutingRule): EditorState {
  return {
    id: rule.id,
    name: rule.name,
    objectSlug: rule.objectSlug,
    trigger: rule.trigger,
    strategy: rule.strategy,
    assignees: rule.assignees,
    assignField: rule.assignField || 'owner',
    active: rule.active,
    conditions: rule.conditions.map((c) => ({
      uid: nextUid++,
      field: c.field,
      operator: c.operator || 'eq',
      value: conditionValueToText(c.value),
    })),
  };
}

/** Editor condition rows → wire conditions (per-operator value parsing). */
function conditionsToWire(conditions: ConditionState[]): SabcrmRoutingCondition[] {
  return conditions.map((c) => {
    const operator = c.operator || 'eq';
    if (VALUELESS_OPERATORS.has(operator)) {
      return { field: c.field, operator };
    }
    const raw = c.value.trim();
    if (LIST_OPERATORS.has(operator)) {
      const list = raw
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v !== '');
      return { field: c.field, operator, value: list };
    }
    if (NUMERIC_OPERATORS.has(operator)) {
      const n = Number(raw);
      return {
        field: c.field,
        operator,
        value: raw !== '' && Number.isFinite(n) ? n : raw,
      };
    }
    return { field: c.field, operator, value: raw };
  });
}

// ---------------------------------------------------------------------------
// Editor dialog
// ---------------------------------------------------------------------------

interface RuleEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-populated when editing; null for "New rule". */
  initial: EditorState | null;
  members: RoutingMemberOption[];
  objects: RoutingObjectOption[];
  /** Position appended to a NEW rule (max existing position + 1). */
  nextPosition: number;
  onSaved: () => void;
}

function RuleEditorDialog({
  open,
  onOpenChange,
  initial,
  members,
  objects,
  nextPosition,
  onSaved,
}: RuleEditorDialogProps): React.JSX.Element {
  const defaultObjectSlug = objects[0]?.slug ?? '';
  const [state, setState] = React.useState<EditorState>(() =>
    emptyEditor(defaultObjectSlug),
  );
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setState(initial ?? emptyEditor(defaultObjectSlug));
      setError(null);
    }
  }, [open, initial, defaultObjectSlug]);

  const objectOptions: SelectOption[] = React.useMemo(
    () => objects.map((o) => ({ value: o.slug, label: o.label })),
    [objects],
  );

  const memberOptions: SelectOption[] = React.useMemo(
    () => members.map((m) => ({ value: m.userId, label: m.label })),
    [members],
  );

  const fieldOptions: SelectOption[] = React.useMemo(() => {
    const object = objects.find((o) => o.slug === state.objectSlug);
    return (object?.fields ?? []).map((f) => ({
      value: f.key,
      label: f.label,
    }));
  }, [objects, state.objectSlug]);

  const patchCondition = (uid: number, p: Partial<ConditionState>): void =>
    setState((s) => ({
      ...s,
      conditions: s.conditions.map((c) =>
        c.uid === uid ? { ...c, ...p } : c,
      ),
    }));

  const removeCondition = (uid: number): void =>
    setState((s) => ({
      ...s,
      conditions: s.conditions.filter((c) => c.uid !== uid),
    }));

  const addCondition = (): void =>
    setState((s) => ({ ...s, conditions: [...s.conditions, emptyCondition()] }));

  const handleSubmit = (): void => {
    if (!state.name.trim()) {
      setError('A rule name is required.');
      return;
    }
    if (!state.objectSlug) {
      setError('Pick the object this rule routes.');
      return;
    }
    if (state.assignees.length === 0) {
      setError('Pick at least one assignee.');
      return;
    }
    for (const [i, c] of state.conditions.entries()) {
      const n = i + 1;
      if (!c.field) {
        setError(`Condition ${n} needs a field.`);
        return;
      }
      if (!VALUELESS_OPERATORS.has(c.operator) && c.value.trim() === '') {
        setError(`Condition ${n} needs a value.`);
        return;
      }
    }
    setError(null);

    const payload = {
      name: state.name.trim(),
      objectSlug: state.objectSlug,
      trigger: state.trigger,
      conditions: conditionsToWire(state.conditions),
      strategy: state.strategy,
      assignees: state.assignees,
      assignField: state.assignField.trim() || 'owner',
      active: state.active,
    };

    const editingId = state.id;
    startTransition(async () => {
      const res = editingId
        ? await updateSabcrmRoutingRule(editingId, payload)
        : await createSabcrmRoutingRule({ ...payload, position: nextPosition });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onOpenChange(false);
      onSaved();
    });
  };

  const editing = !!state.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby="routing-editor-desc"
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit rule' : 'New routing rule'}</DialogTitle>
          <DialogDescription id="routing-editor-desc">
            {editing
              ? 'Update who gets assigned and when. Changes apply to the next records routed.'
              : 'Pick an owner for incoming records — the first active matching rule wins.'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <div className="flex flex-col gap-3 pb-2 pt-1">
            <Field label="Rule name" required>
              <Input
                value={state.name}
                onChange={(e) =>
                  setState((s) => ({ ...s, name: e.target.value }))
                }
                placeholder="Inbound leads — sales team"
                autoFocus
                disabled={pending}
              />
            </Field>

            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-12 sm:col-span-6">
                <Field label="Object" required>
                  <SelectField
                    value={state.objectSlug || null}
                    onChange={(v) =>
                      setState((s) => ({ ...s, objectSlug: v ?? '' }))
                    }
                    options={objectOptions}
                    placeholder="Pick an object"
                    searchable
                    disabled={pending}
                  />
                </Field>
              </div>
              <div className="col-span-12 sm:col-span-6">
                <Field label="Trigger">
                  <SelectField
                    value={state.trigger}
                    onChange={(v) =>
                      setState((s) => ({
                        ...s,
                        trigger: (v as SabcrmRoutingTrigger) ?? 'record.created',
                      }))
                    }
                    options={TRIGGER_OPTIONS}
                    disabled={pending}
                  />
                </Field>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-12 sm:col-span-6">
                <Field label="Strategy">
                  <SelectField
                    value={state.strategy}
                    onChange={(v) =>
                      setState((s) => ({
                        ...s,
                        strategy: (v as SabcrmRoutingStrategy) ?? 'round_robin',
                      }))
                    }
                    options={STRATEGY_OPTIONS}
                    disabled={pending}
                  />
                </Field>
              </div>
              <div className="col-span-12 sm:col-span-6">
                <Field
                  label="Assign field"
                  help="Record data key the assignee is written to"
                >
                  <Input
                    value={state.assignField}
                    onChange={(e) =>
                      setState((s) => ({ ...s, assignField: e.target.value }))
                    }
                    placeholder="owner"
                    disabled={pending}
                  />
                </Field>
              </div>
            </div>

            <Field
              label="Assignees"
              required
              help={
                state.strategy === 'fixed'
                  ? 'Fixed strategy always assigns the first member picked'
                  : 'Assignment rotates over these members'
              }
            >
              <MultiSelect
                value={state.assignees}
                onChange={(values) =>
                  setState((s) => ({ ...s, assignees: values }))
                }
                options={memberOptions}
                placeholder={
                  members.length === 0
                    ? 'No workspace members found'
                    : 'Pick members'
                }
                searchable
                disabled={pending || members.length === 0}
                aria-label="Assignees"
              />
            </Field>

            <div className="mt-2 flex items-center justify-between">
              <p className="text-sm font-medium">Conditions</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                iconLeft={Plus}
                onClick={addCondition}
                disabled={pending}
              >
                Add condition
              </Button>
            </div>

            {state.conditions.length === 0 ? (
              <p className="text-sm text-[var(--st-text-secondary)]">
                No conditions — the rule matches every{' '}
                {TRIGGER_LABEL[state.trigger].toLowerCase()} on this object.
              </p>
            ) : null}

            <div className="flex flex-col gap-2">
              {state.conditions.map((c, idx) => (
                <div
                  key={c.uid}
                  className="grid grid-cols-12 items-end gap-2 rounded-md border border-[var(--st-border)] p-2"
                >
                  <div className="col-span-12 sm:col-span-4">
                    <Field label={idx === 0 ? 'Field' : undefined}>
                      <SelectField
                        value={c.field || null}
                        onChange={(v) =>
                          patchCondition(c.uid, { field: v ?? '' })
                        }
                        options={fieldOptions}
                        placeholder="Field"
                        searchable
                        disabled={pending}
                        aria-label={`Condition ${idx + 1} field`}
                      />
                    </Field>
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <Field label={idx === 0 ? 'Operator' : undefined}>
                      <SelectField
                        value={c.operator}
                        onChange={(v) =>
                          patchCondition(c.uid, { operator: v ?? 'eq' })
                        }
                        options={OPERATOR_OPTIONS}
                        disabled={pending}
                        aria-label={`Condition ${idx + 1} operator`}
                      />
                    </Field>
                  </div>
                  <div className="col-span-6 sm:col-span-4">
                    {!VALUELESS_OPERATORS.has(c.operator) ? (
                      <Field
                        label={idx === 0 ? 'Value' : undefined}
                        help={
                          LIST_OPERATORS.has(c.operator)
                            ? 'Comma-separated values'
                            : undefined
                        }
                      >
                        <Input
                          value={c.value}
                          onChange={(e) =>
                            patchCondition(c.uid, { value: e.target.value })
                          }
                          placeholder={
                            LIST_OPERATORS.has(c.operator)
                              ? 'a, b, c'
                              : 'Value'
                          }
                          disabled={pending}
                          aria-label={`Condition ${idx + 1} value`}
                        />
                      </Field>
                    ) : null}
                  </div>
                  <div className="col-span-12 flex justify-end sm:col-span-1">
                    <IconButton
                      icon={Trash2}
                      label={`Remove condition ${idx + 1}`}
                      size="sm"
                      onClick={() => removeCondition(c.uid)}
                      disabled={pending}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-2 rounded-md border border-[var(--st-border)] p-3">
              <Switch
                checked={state.active}
                onCheckedChange={(checked) =>
                  setState((s) => ({ ...s, active: checked }))
                }
                label="Active — the rule participates in routing"
                disabled={pending}
              />
            </div>

            {error ? (
              <Alert tone="danger" role="alert">
                {error}
              </Alert>
            ) : null}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="primary" loading={pending}>
              {editing ? 'Save changes' : 'Create rule'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Page client
// ---------------------------------------------------------------------------

export function RoutingClient({
  initialRules,
  members,
  objects,
  initialError,
}: RoutingClientProps): React.JSX.Element {
  const router = useRouter();
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editorInitial, setEditorInitial] = React.useState<EditorState | null>(
    null,
  );
  const [rowError, setRowError] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] =
    React.useState<SabcrmRustRoutingRule | null>(null);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [movingId, setMovingId] = React.useState<string | null>(null);
  const [deleting, startDelete] = React.useTransition();
  const [, startToggle] = React.useTransition();
  const [, startMove] = React.useTransition();

  const memberNameById = React.useMemo(
    () => new Map(members.map((m) => [m.userId, m.label])),
    [members],
  );

  const objectLabelBySlug = React.useMemo(
    () => new Map(objects.map((o) => [o.slug, o.label])),
    [objects],
  );

  const nextPosition = React.useMemo(
    () =>
      initialRules.reduce((max, r) => Math.max(max, r.position), -1) + 1,
    [initialRules],
  );

  const refresh = React.useCallback(() => {
    router.refresh();
  }, [router]);

  const openNew = (): void => {
    setRowError(null);
    setEditorInitial(null);
    setEditorOpen(true);
  };

  const openEdit = (rule: SabcrmRustRoutingRule): void => {
    setRowError(null);
    setEditorInitial(editorFromRule(rule));
    setEditorOpen(true);
  };

  const toggleActive = (rule: SabcrmRustRoutingRule): void => {
    setRowError(null);
    setTogglingId(rule.id);
    startToggle(async () => {
      const res = await updateSabcrmRoutingRule(rule.id, {
        active: !rule.active,
      });
      setTogglingId(null);
      if (!res.ok) {
        setRowError(res.error);
        return;
      }
      refresh();
    });
  };

  /**
   * Swaps the rule at `idx` with its neighbour: both rules get their NEW
   * array index persisted as `position` (two PATCHes — there is no batch
   * reorder endpoint), which also self-heals duplicate/stale positions.
   */
  const moveRule = (idx: number, dir: -1 | 1): void => {
    const to = idx + dir;
    if (to < 0 || to >= initialRules.length) return;
    const a = initialRules[idx];
    const b = initialRules[to];
    if (!a || !b) return;
    setRowError(null);
    setMovingId(a.id);
    startMove(async () => {
      const resA = await updateSabcrmRoutingRule(a.id, { position: to });
      const resB = await updateSabcrmRoutingRule(b.id, { position: idx });
      setMovingId(null);
      if (!resA.ok || !resB.ok) {
        setRowError(
          (!resA.ok ? resA.error : null) ??
            (!resB.ok ? resB.error : null) ??
            'Failed to reorder.',
        );
      }
      refresh();
    });
  };

  const handleDelete = (): void => {
    const target = confirmDelete;
    if (!target) return;
    setRowError(null);
    startDelete(async () => {
      const res = await deleteSabcrmRoutingRule(target.id);
      if (!res.ok) {
        setRowError(res.error);
        return;
      }
      setConfirmDelete(null);
      refresh();
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1120px] px-6 pb-12 pt-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Assignment routing</PageTitle>
          <PageDescription>
            Ordered rules that pick an owner for incoming records — the first
            active matching rule wins, top to bottom.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={openNew}>
            New rule
          </Button>
        </PageActions>
      </PageHeader>

      {initialError ? (
        <div className="my-4">
          <Alert tone="danger" role="alert">
            Couldn&apos;t load routing rules: {initialError}
          </Alert>
        </div>
      ) : null}

      {rowError ? (
        <div className="my-4">
          <Alert tone="danger" role="alert">
            {rowError}
          </Alert>
        </div>
      ) : null}

      {!initialError && initialRules.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            icon={Waypoints}
            title="No routing rules yet"
            description="Create your first rule to auto-assign an owner to records as they're created or submitted through forms."
            action={
              <Button variant="primary" iconLeft={Plus} onClick={openNew}>
                New rule
              </Button>
            }
          />
        </div>
      ) : null}

      {initialRules.length > 0 ? (
        <div className="mt-4">
          <Table hover>
            <THead>
              <Tr>
                <Th width={96}>Order</Th>
                <Th>Name</Th>
                <Th>Object</Th>
                <Th>Trigger</Th>
                <Th>Strategy</Th>
                <Th>Assignees</Th>
                <Th>Active</Th>
                <Th align="right" width={140}>
                  <span className="sr-only">Actions</span>
                </Th>
              </Tr>
            </THead>
            <TBody>
              {initialRules.map((rule, idx) => (
                <Tr key={rule.id}>
                  <Td>
                    <div className="flex items-center gap-1">
                      <span className="w-5 text-xs text-[var(--st-text-secondary)]">
                        {idx + 1}
                      </span>
                      <IconButton
                        icon={ArrowUp}
                        label={`Move rule ${rule.name} up`}
                        size="sm"
                        onClick={() => moveRule(idx, -1)}
                        disabled={movingId !== null || idx === 0}
                      />
                      <IconButton
                        icon={ArrowDown}
                        label={`Move rule ${rule.name} down`}
                        size="sm"
                        onClick={() => moveRule(idx, 1)}
                        disabled={
                          movingId !== null || idx === initialRules.length - 1
                        }
                      />
                    </div>
                  </Td>
                  <Td>
                    <span className="font-medium">{rule.name}</span>
                    {rule.conditions.length > 0 ? (
                      <span className="ml-2 text-xs text-[var(--st-text-secondary)]">
                        {rule.conditions.length}{' '}
                        {rule.conditions.length === 1
                          ? 'condition'
                          : 'conditions'}
                      </span>
                    ) : null}
                  </Td>
                  <Td>{objectLabelBySlug.get(rule.objectSlug) ?? rule.objectSlug}</Td>
                  <Td>
                    <Badge tone="neutral">
                      {TRIGGER_LABEL[rule.trigger] ?? rule.trigger}
                    </Badge>
                  </Td>
                  <Td>{STRATEGY_LABEL[rule.strategy] ?? rule.strategy}</Td>
                  <Td>
                    <span title={rule.assignees
                      .map((id) => memberNameById.get(id) ?? id)
                      .join(', ')}
                    >
                      {assigneeSummary(rule.assignees, memberNameById)}
                    </span>
                  </Td>
                  <Td>
                    <Switch
                      size="sm"
                      checked={rule.active}
                      onCheckedChange={() => toggleActive(rule)}
                      disabled={togglingId === rule.id}
                      aria-label={
                        rule.active
                          ? `Deactivate rule ${rule.name}`
                          : `Activate rule ${rule.name}`
                      }
                    />
                  </Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        iconLeft={Pencil}
                        aria-label={`Edit rule ${rule.name}`}
                        onClick={() => openEdit(rule)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        iconLeft={Trash2}
                        aria-label={`Delete rule ${rule.name}`}
                        onClick={() => {
                          setRowError(null);
                          setConfirmDelete(rule);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
      ) : null}

      <RuleEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initial={editorInitial}
        members={members}
        objects={objects}
        nextPosition={nextPosition}
        onSaved={refresh}
      />

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(next) => {
          if (!next && !deleting) {
            setConfirmDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {confirmDelete?.name ?? 'this rule'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              New records will no longer be routed by this rule. Records it
              already assigned keep their owner.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="secondary" disabled={deleting}>
                Cancel
              </Button>
            </AlertDialogCancel>
            <Button variant="danger" loading={deleting} onClick={handleDelete}>
              Delete rule
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
