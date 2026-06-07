'use client';

import { useCallback } from 'react';
import { createId } from '@paralleldrive/cuid2';
import { Plus, X, GitBranch } from 'lucide-react';
import type { Block, Variable, ConditionOptions, ConditionGroup, Comparison, ComparisonOperator } from '@/lib/sabflow/types';
import {
  Button,
  IconButton,
  Card,
  CardHeader,
  Callout,
  Field,
  Input,
  SegmentedControl,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';
import { PanelHeader } from '../shared/primitives';
import { VariableSelect } from '../shared/VariableSelect';

// ── Constants ─────────────────────────────────────────────────────────────────

const COMPARISON_OPERATORS: ComparisonOperator[] = [
  'Equal to',
  'Not equal to',
  'Contains',
  'Does not contain',
  'Starts with',
  'Ends with',
  'Greater than',
  'Less than',
  'Greater than or equal',
  'Less than or equal',
  'Is empty',
  'Is not empty',
  'Matches regex',
];

/** Operators that do not require a right-hand value input */
const VALUE_LESS_OPERATORS = new Set<ComparisonOperator>(['Is empty', 'Is not empty']);

const LOGIC_ITEMS = [
  { value: 'AND' as const, label: 'AND' },
  { value: 'OR' as const, label: 'OR' },
];

// ── Factories ─────────────────────────────────────────────────────────────────

function makeComparison(): Comparison {
  return { id: createId(), operator: 'Equal to' };
}

function makeGroup(): ConditionGroup {
  return { id: createId(), logicalOperator: 'AND', comparisons: [makeComparison()] };
}

function defaultOptions(): ConditionOptions {
  return { logicalOperator: 'AND', conditionGroups: [makeGroup()] };
}

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables: Variable[];
};

// ── Main component ────────────────────────────────────────────────────────────

export function ConditionSettings({ block, onBlockChange, variables }: Props) {
  const rawOpts = block.options as ConditionOptions | undefined;

  // Migrate or default: ensure we always have the new grouped shape
  const options: ConditionOptions =
    rawOpts?.conditionGroups != null
      ? rawOpts
      : defaultOptions();

  const { logicalOperator, conditionGroups } = options;

  // ── Mutators ───────────────────────────────────────────────────────────────

  const commitOptions = useCallback(
    (patch: Partial<ConditionOptions>) => {
      onBlockChange({
        ...block,
        options: { ...options, ...patch },
      });
    },
    [block, options, onBlockChange],
  );

  const setTopOperator = useCallback(
    (op: 'AND' | 'OR') => commitOptions({ logicalOperator: op }),
    [commitOptions],
  );

  const updateGroup = useCallback(
    (groupId: string, patch: Partial<ConditionGroup>) => {
      commitOptions({
        conditionGroups: conditionGroups.map((g) =>
          g.id === groupId ? { ...g, ...patch } : g,
        ),
      });
    },
    [conditionGroups, commitOptions],
  );

  const deleteGroup = useCallback(
    (groupId: string) => {
      const next = conditionGroups.filter((g) => g.id !== groupId);
      commitOptions({ conditionGroups: next.length > 0 ? next : [makeGroup()] });
    },
    [conditionGroups, commitOptions],
  );

  const addGroup = useCallback(() => {
    commitOptions({ conditionGroups: [...conditionGroups, makeGroup()] });
  }, [conditionGroups, commitOptions]);

  const addComparison = useCallback(
    (groupId: string) => {
      updateGroup(groupId, {
        comparisons: [
          ...(conditionGroups.find((g) => g.id === groupId)?.comparisons ?? []),
          makeComparison(),
        ],
      });
    },
    [conditionGroups, updateGroup],
  );

  const updateComparison = useCallback(
    (groupId: string, compId: string, patch: Partial<Comparison>) => {
      const group = conditionGroups.find((g) => g.id === groupId);
      if (!group) return;
      updateGroup(groupId, {
        comparisons: group.comparisons.map((c) =>
          c.id === compId ? { ...c, ...patch } : c,
        ),
      });
    },
    [conditionGroups, updateGroup],
  );

  const deleteComparison = useCallback(
    (groupId: string, compId: string) => {
      const group = conditionGroups.find((g) => g.id === groupId);
      if (!group) return;
      const next = group.comparisons.filter((c) => c.id !== compId);
      updateGroup(groupId, {
        comparisons: next.length > 0 ? next : [makeComparison()],
      });
    },
    [conditionGroups, updateGroup],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <PanelHeader icon={GitBranch} title="Condition" />

      {/* ── IF header ────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--st-text-secondary)]">
          If
        </span>
        <div className="flex-1 h-px bg-[var(--st-border)]" />
      </div>

      {/* ── Condition groups ──────────────────────────────── */}
      <div className="space-y-3">
        {conditionGroups.map((group, groupIndex) => (
          <div key={group.id}>
            {/* Between-group logical operator badge */}
            {groupIndex > 0 && (
              <div className="flex items-center gap-2 my-2 px-1">
                <div className="flex-1 h-px bg-[var(--st-border)]" />
                <SegmentedControl
                  items={LOGIC_ITEMS}
                  value={logicalOperator}
                  onChange={setTopOperator}
                  size="sm"
                  aria-label="Logical operator between groups"
                />
                <div className="flex-1 h-px bg-[var(--st-border)]" />
              </div>
            )}

            {/* Group card */}
            <ConditionGroupCard
              group={group}
              variables={variables}
              canDelete={conditionGroups.length > 1}
              onGroupOperatorChange={(op) => updateGroup(group.id, { logicalOperator: op })}
              onDeleteGroup={() => deleteGroup(group.id)}
              onAddComparison={() => addComparison(group.id)}
              onUpdateComparison={(compId, patch) => updateComparison(group.id, compId, patch)}
              onDeleteComparison={(compId) => deleteComparison(group.id, compId)}
            />
          </div>
        ))}
      </div>

      {/* ── Add group button ──────────────────────────────── */}
      <Button variant="outline" block iconLeft={Plus} onClick={addGroup}>
        Add condition group
      </Button>

      {/* ── Then hint ─────────────────────────────────────── */}
      <Callout tone="info" title="Then">
        Connect the output edges from this block to define which path to follow when the condition passes or falls through.
      </Callout>
    </div>
  );
}

// ── ConditionGroupCard ────────────────────────────────────────────────────────

type GroupCardProps = {
  group: ConditionGroup;
  variables: Variable[];
  canDelete: boolean;
  onGroupOperatorChange: (op: 'AND' | 'OR') => void;
  onDeleteGroup: () => void;
  onAddComparison: () => void;
  onUpdateComparison: (compId: string, patch: Partial<Comparison>) => void;
  onDeleteComparison: (compId: string) => void;
};

function ConditionGroupCard({
  group,
  variables,
  canDelete,
  onGroupOperatorChange,
  onDeleteGroup,
  onAddComparison,
  onUpdateComparison,
  onDeleteComparison,
}: GroupCardProps) {
  return (
    <Card padding="none" className="overflow-hidden">
      {/* Group header */}
      <CardHeader className="flex items-center gap-2 px-3 py-2 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
        <span className="text-[10.5px] font-semibold uppercase tracking-widest text-[var(--st-text-secondary)] flex-1">
          Group
        </span>
        {canDelete && (
          <IconButton
            icon={X}
            label="Delete group"
            size="sm"
            onClick={onDeleteGroup}
          />
        )}
      </CardHeader>

      {/* Comparisons */}
      <div className="p-3 space-y-2">
        {group.comparisons.map((comp, idx) => (
          <div key={comp.id}>
            {/* Between-comparison logical operator badge */}
            {idx > 0 && (
              <div className="flex items-center gap-2 my-2">
                <div className="flex-1 h-px bg-[var(--st-border)]" />
                <SegmentedControl
                  items={LOGIC_ITEMS}
                  value={group.logicalOperator}
                  onChange={onGroupOperatorChange}
                  size="sm"
                  aria-label="Logical operator between comparisons"
                />
                <div className="flex-1 h-px bg-[var(--st-border)]" />
              </div>
            )}

            <ComparisonRow
              comparison={comp}
              variables={variables}
              canDelete={group.comparisons.length > 1}
              onUpdate={(patch) => onUpdateComparison(comp.id, patch)}
              onDelete={() => onDeleteComparison(comp.id)}
            />
          </div>
        ))}
      </div>

      {/* Add comparison footer */}
      <div className="px-3 pb-3">
        <Button variant="ghost" block iconLeft={Plus} onClick={onAddComparison}>
          Add comparison
        </Button>
      </div>
    </Card>
  );
}

// ── ComparisonRow ─────────────────────────────────────────────────────────────

type ComparisonRowProps = {
  comparison: Comparison;
  variables: Variable[];
  canDelete: boolean;
  onUpdate: (patch: Partial<Comparison>) => void;
  onDelete: () => void;
};

function ComparisonRow({
  comparison,
  variables,
  canDelete,
  onUpdate,
  onDelete,
}: ComparisonRowProps) {
  const operator = comparison.operator ?? 'Equal to';
  const needsValue = !VALUE_LESS_OPERATORS.has(operator);

  return (
    <Card variant="outlined" padding="sm" className="space-y-2">
      {/* Variable + delete row */}
      <div className="flex items-center gap-1.5">
        <div className="flex-1 min-w-0">
          <VariableSelect
            variables={variables}
            value={comparison.variableId}
            onChange={(variableId) => onUpdate({ variableId })}
            placeholder="Pick a variable"
          />
        </div>
        {canDelete && (
          <IconButton
            icon={X}
            label="Remove comparison"
            size="sm"
            onClick={onDelete}
            className="shrink-0"
          />
        )}
      </div>

      {/* Operator select */}
      <Field label="Operator">
        <Select
          value={operator}
          onValueChange={(val) => onUpdate({ operator: val as ComparisonOperator })}
        >
          <SelectTrigger aria-label="Comparison operator">
            <SelectValue placeholder="Pick an operator" />
          </SelectTrigger>
          <SelectContent>
            {COMPARISON_OPERATORS.map((op) => (
              <SelectItem key={op} value={op}>
                {op}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {/* Value input (hidden for valueless operators) */}
      {needsValue && (
        <Field label="Value">
          <Input
            type="text"
            value={comparison.value ?? ''}
            onChange={(e) => onUpdate({ value: e.target.value })}
            placeholder={
              operator === 'Matches regex'
                ? '/pattern/flags or plain pattern'
                : 'value or {{variable}}'
            }
          />
        </Field>
      )}
    </Card>
  );
}
