'use client';

/**
 * FilterBuilder — recursive AND/OR filter-tree editor (RecordSurface
 * composite, 20ui).
 *
 * Owns the CANONICAL client-side filter model for the record engine — the
 * exact tree shape the legacy `/sabcrm/[objectSlug]/view-bar.tsx` established
 * and the Rust engine already accepts (`{ op, conditions: [...] }` with
 * `{ field, op, value }` leaves):
 *
 *   - node  = {@link FilterGroup} (AND|OR over children)
 *           | {@link FilterCondition} (fieldKey / op / value leaf)
 *   - ops   = the 9 engine comparators ({@link FilterOp}); per-field-type
 *     subsets + labels via {@link opsForField} / {@link opLabel}.
 *
 * Purely presentational + controlled: `value` in, `onChange` out on every
 * edit. No server calls, no draft/apply semantics — hosts (e.g. the ViewBar's
 * Filter popover) own draft state and call {@link pruneFilterGroup} before
 * committing so half-typed rows never filter everything out.
 *
 * Gotchas honoured: 20ui primitives imported RELATIVELY (never the barrel),
 * styling rides `--st-*` tokens (see view-bar.css) so dark mode is free.
 */

import * as React from 'react';
import { FolderPlus, Plus, X } from 'lucide-react';

import type { FieldMetadata } from '@/lib/sabcrm/types';
import { Button, IconButton } from '../../button';
import { Input } from '../../field';
import { Select, type SelectOption } from '../../select';
import { DatePicker } from '../../datepicker';
import { SegmentedControl } from '../../segmented';
import { cn } from '../lib/cn';

import './view-bar.css';

/* ------------------------------------------------------------------------ */
/* Canonical filter-tree model (ported from the legacy view-bar)            */
/* ------------------------------------------------------------------------ */

/**
 * Comparison operators threaded to the engine's structured `filters`.
 * EXACTLY the legacy set — every member round-trips through the Rust engine's
 * widened tree shape and the legacy field-keyed map.
 */
export type FilterOp =
  | 'eq'
  | 'ne'
  | 'contains'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'isEmpty'
  | 'isNotEmpty';

/** One leaf condition in the filter tree. */
export interface FilterCondition {
  fieldKey: string;
  op: FilterOp;
  /** Absent for the unary `isEmpty` / `isNotEmpty` operators. */
  value?: string;
}

/** Boolean conjunction joining the members of a {@link FilterGroup}. */
export type FilterConjunction = 'and' | 'or';

/** A node — either a leaf condition or a nested group. */
export type FilterNode = FilterCondition | FilterGroup;

/** An AND/OR group over child nodes (conditions and/or nested sub-groups). */
export interface FilterGroup {
  op: FilterConjunction;
  conditions: FilterNode[];
}

/** Discriminate a {@link FilterGroup} from a leaf {@link FilterCondition}. */
export function isFilterGroup(node: FilterNode): node is FilterGroup {
  return (
    typeof (node as FilterGroup).op === 'string' &&
    Array.isArray((node as FilterGroup).conditions)
  );
}

/** An empty root group (AND over no conditions). */
export const EMPTY_FILTER_GROUP: FilterGroup = { op: 'and', conditions: [] };

/** Every recognised operator (validates persisted / URL-decoded values). */
export const FILTER_OPS: ReadonlySet<string> = new Set<FilterOp>([
  'eq',
  'ne',
  'contains',
  'gt',
  'lt',
  'gte',
  'lte',
  'isEmpty',
  'isNotEmpty',
]);

/** Operators that take no operand. */
export function isUnaryOp(op: FilterOp): boolean {
  return op === 'isEmpty' || op === 'isNotEmpty';
}

/** Total leaf-condition count in a tree (drives "active" badges). */
export function countConditions(group: FilterGroup): number {
  let n = 0;
  for (const node of group.conditions) {
    if (isFilterGroup(node)) n += countConditions(node);
    else n += 1;
  }
  return n;
}

/**
 * Drop incomplete leaves (binary op without a value) and any sub-group they
 * empty out, so a half-typed row never silently filters everything away.
 */
export function pruneFilterGroup(group: FilterGroup): FilterGroup {
  const conditions: FilterNode[] = [];
  for (const node of group.conditions) {
    if (isFilterGroup(node)) {
      const sub = pruneFilterGroup(node);
      if (sub.conditions.length > 0) conditions.push(sub);
    } else if (
      node.fieldKey &&
      (isUnaryOp(node.op) || (node.value ?? '').trim() !== '')
    ) {
      conditions.push(node);
    }
  }
  return { op: group.op, conditions };
}

/* ------------------------------------------------------------------------ */
/* Field-type → operator mapping (ported, with date/boolean labelling)      */
/* ------------------------------------------------------------------------ */

const TEXTUAL: ReadonlySet<FieldMetadata['type']> = new Set<
  FieldMetadata['type']
>(['TEXT', 'EMAIL', 'PHONE', 'LINK']);

const NUMERIC: ReadonlySet<FieldMetadata['type']> = new Set<
  FieldMetadata['type']
>(['NUMBER', 'NUMERIC', 'CURRENCY', 'RATING']);

const DATEISH: ReadonlySet<FieldMetadata['type']> = new Set<
  FieldMetadata['type']
>(['DATE', 'DATE_TIME']);

/** Generic operator labels (overridden per type by {@link opLabel}). */
export const OP_LABEL: Record<FilterOp, string> = {
  eq: 'is',
  ne: 'is not',
  contains: 'contains',
  gt: '>',
  lt: '<',
  gte: '≥',
  lte: '≤',
  isEmpty: 'is empty',
  isNotEmpty: 'is not empty',
};

/** Date fields reuse the comparison ops with calendar-flavoured labels. */
const DATE_OP_LABEL: Partial<Record<FilterOp, string>> = {
  eq: 'is',
  ne: 'is not',
  gt: 'is after',
  lt: 'is before',
  gte: 'is on or after',
  lte: 'is on or before',
};

/** Operators offered for a given field type (legacy semantics, verbatim). */
export function opsForField(field: FieldMetadata): FilterOp[] {
  if (field.type === 'AI') {
    // AI fields store a plain scalar; operators follow settings.ai.outputType.
    const out = String(
      (field.settings as { ai?: { outputType?: unknown } } | undefined)?.ai
        ?.outputType ?? 'TEXT',
    );
    if (out === 'NUMBER' || out === 'RATING')
      return ['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'isEmpty', 'isNotEmpty'];
    if (out === 'SELECT' || out === 'BOOLEAN')
      return ['eq', 'ne', 'isEmpty', 'isNotEmpty'];
    return ['contains', 'eq', 'ne', 'isEmpty', 'isNotEmpty'];
  }
  if (field.type === 'SELECT' || field.type === 'MULTI_SELECT') {
    return ['eq', 'ne', 'isEmpty', 'isNotEmpty'];
  }
  if (NUMERIC.has(field.type)) {
    return ['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'isEmpty', 'isNotEmpty'];
  }
  if (DATEISH.has(field.type)) {
    return ['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'isEmpty', 'isNotEmpty'];
  }
  if (TEXTUAL.has(field.type)) {
    return ['contains', 'eq', 'ne', 'isEmpty', 'isNotEmpty'];
  }
  // BOOLEAN + every other type (composites, arrays, …).
  return ['eq', 'ne', 'isEmpty', 'isNotEmpty'];
}

/** Human label for an operator in the context of a field's type. */
export function opLabel(field: FieldMetadata | undefined, op: FilterOp): string {
  if (field && DATEISH.has(field.type)) return DATE_OP_LABEL[op] ?? OP_LABEL[op];
  return OP_LABEL[op];
}

/** Fields a user may filter by (relations + files are not queryable). */
export function filterableFields(fields: FieldMetadata[]): FieldMetadata[] {
  return fields.filter((f) => f.type !== 'RELATION' && f.type !== 'FILE');
}

/** A fresh condition seeded on the first filterable field + its default op. */
export function defaultCondition(fields: FieldMetadata[]): FilterCondition {
  const field = filterableFields(fields)[0];
  if (!field) return { fieldKey: '', op: 'eq', value: '' };
  const op = opsForField(field)[0] ?? 'eq';
  return { fieldKey: field.key, op, value: isUnaryOp(op) ? undefined : '' };
}

/** A fresh sub-group (AND, seeded with one condition). */
function defaultGroup(fields: FieldMetadata[]): FilterGroup {
  return { op: 'and', conditions: [defaultCondition(fields)] };
}

/* ------------------------------------------------------------------------ */
/* Date helpers (condition values are ISO `yyyy-MM-dd` strings)             */
/* ------------------------------------------------------------------------ */

function isoToDate(v: string | undefined): Date | undefined {
  if (!v) return undefined;
  const d = new Date(`${v.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function dateToIso(d: Date | undefined): string {
  if (!d) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* ------------------------------------------------------------------------ */
/* Value editor — per field type                                            */
/* ------------------------------------------------------------------------ */

const BOOLEAN_OPTIONS: SelectOption[] = [
  { value: 'true', label: 'True' },
  { value: 'false', label: 'False' },
];

function ValueEditor({
  field,
  condition,
  onValue,
}: {
  field: FieldMetadata | undefined;
  condition: FilterCondition;
  onValue: (value: string) => void;
}): React.JSX.Element {
  const value = condition.value ?? '';

  if (field?.type === 'SELECT' || field?.type === 'MULTI_SELECT') {
    const options: SelectOption[] = (field.options ?? []).map((o) => ({
      value: o.value,
      label: o.label,
    }));
    return (
      <Select
        className="fb-row__value"
        size="sm"
        value={value || null}
        onChange={(v) => onValue(v ?? '')}
        options={options}
        placeholder="Select…"
        searchable={options.length > 8}
        aria-label="Filter value"
      />
    );
  }

  if (field?.type === 'BOOLEAN') {
    return (
      <Select
        className="fb-row__value"
        size="sm"
        value={value || null}
        onChange={(v) => onValue(v ?? '')}
        options={BOOLEAN_OPTIONS}
        placeholder="Select…"
        aria-label="Filter value"
      />
    );
  }

  if (field && DATEISH.has(field.type)) {
    return (
      <DatePicker
        className="fb-row__value"
        value={isoToDate(value)}
        onChange={(d) => onValue(dateToIso(d))}
        placeholder="Pick a date"
        aria-label="Filter value"
      />
    );
  }

  return (
    <Input
      className="fb-row__value"
      inputSize="sm"
      type={field && NUMERIC.has(field.type) ? 'number' : 'text'}
      value={value}
      placeholder="Value"
      onChange={(e) => onValue(e.target.value)}
      aria-label="Filter value"
    />
  );
}

/* ------------------------------------------------------------------------ */
/* Condition row                                                            */
/* ------------------------------------------------------------------------ */

function ConditionRow({
  fields,
  condition,
  lead,
  onChange,
  onRemove,
}: {
  fields: FieldMetadata[];
  condition: FilterCondition;
  /** Leading label: "Where" for the first row, else the parent conjunction. */
  lead: string;
  onChange: (next: FilterCondition) => void;
  onRemove: () => void;
}): React.JSX.Element {
  const field = fields.find((f) => f.key === condition.fieldKey);
  const ops = field ? opsForField(field) : (['eq'] as FilterOp[]);
  const unary = isUnaryOp(condition.op);

  const fieldOptions: SelectOption[] = fields.map((f) => ({
    value: f.key,
    label: f.label,
  }));
  const opOptions: SelectOption[] = ops.map((o) => ({
    value: o,
    label: opLabel(field, o),
  }));

  const setField = (key: string) => {
    const nextField = fields.find((f) => f.key === key);
    const nextOps = nextField ? opsForField(nextField) : (['eq'] as FilterOp[]);
    const nextOp = nextOps.includes(condition.op)
      ? condition.op
      : (nextOps[0] ?? 'eq');
    onChange({
      fieldKey: key,
      op: nextOp,
      value: isUnaryOp(nextOp) ? undefined : '',
    });
  };

  const setOp = (op: FilterOp) => {
    onChange({
      fieldKey: condition.fieldKey,
      op,
      value: isUnaryOp(op) ? undefined : (condition.value ?? ''),
    });
  };

  return (
    <div className="fb-row">
      <span className="fb-row__lead" aria-hidden="true">
        {lead}
      </span>
      <Select
        className="fb-row__field"
        size="sm"
        value={condition.fieldKey || null}
        onChange={(v) => {
          if (v) setField(v);
        }}
        options={fieldOptions}
        placeholder="Field"
        searchable={fields.length > 8}
        aria-label="Filter field"
      />
      <Select
        className="fb-row__op"
        size="sm"
        value={condition.op}
        onChange={(v) => {
          if (v && FILTER_OPS.has(v)) setOp(v as FilterOp);
        }}
        options={opOptions}
        aria-label="Filter operator"
      />
      {!unary && (
        <ValueEditor
          field={field}
          condition={condition}
          onValue={(value) =>
            onChange({ fieldKey: condition.fieldKey, op: condition.op, value })
          }
        />
      )}
      <IconButton
        className="fb-row__remove"
        label="Remove condition"
        icon={X}
        variant="ghost"
        size="sm"
        onClick={onRemove}
      />
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Recursive group editor                                                   */
/* ------------------------------------------------------------------------ */

const CONJUNCTION_ITEMS = [
  { value: 'and' as FilterConjunction, label: 'And' },
  { value: 'or' as FilterConjunction, label: 'Or' },
];

function GroupEditor({
  fields,
  group,
  depth,
  maxDepth,
  onChange,
  onRemove,
}: {
  fields: FieldMetadata[];
  group: FilterGroup;
  depth: number;
  maxDepth: number;
  onChange: (next: FilterGroup) => void;
  onRemove?: () => void;
}): React.JSX.Element {
  const conjLabel = group.op === 'and' ? 'And' : 'Or';

  const replaceChild = (idx: number, node: FilterNode) =>
    onChange({
      ...group,
      conditions: group.conditions.map((c, i) => (i === idx ? node : c)),
    });

  const removeChild = (idx: number) =>
    onChange({
      ...group,
      conditions: group.conditions.filter((_, i) => i !== idx),
    });

  return (
    <div className={cn('fb-group', depth > 0 && 'fb-group--nested')}>
      <div className="fb-group__head">
        <SegmentedControl
          size="sm"
          items={CONJUNCTION_ITEMS}
          value={group.op}
          onChange={(op) => onChange({ ...group, op })}
          aria-label="Match conjunction"
        />
        <span className="fb-group__lead">
          {depth === 0 ? 'Match conditions' : 'Group'}
        </span>
        {onRemove && (
          <IconButton
            className="fb-group__remove"
            label="Remove group"
            icon={X}
            variant="ghost"
            size="sm"
            onClick={onRemove}
          />
        )}
      </div>

      {group.conditions.length === 0 && (
        <div className="fb-empty">No conditions yet.</div>
      )}

      {group.conditions.map((node, idx) =>
        isFilterGroup(node) ? (
          <GroupEditor
            key={idx}
            fields={fields}
            group={node}
            depth={depth + 1}
            maxDepth={maxDepth}
            onChange={(next) => replaceChild(idx, next)}
            onRemove={() => removeChild(idx)}
          />
        ) : (
          <ConditionRow
            key={idx}
            fields={fields}
            condition={node}
            lead={idx === 0 ? 'Where' : conjLabel}
            onChange={(next) => replaceChild(idx, next)}
            onRemove={() => removeChild(idx)}
          />
        ),
      )}

      <div className="fb-adds">
        <Button
          variant="ghost"
          size="sm"
          iconLeft={Plus}
          onClick={() =>
            onChange({
              ...group,
              conditions: [...group.conditions, defaultCondition(fields)],
            })
          }
        >
          Add condition
        </Button>
        {depth < maxDepth && (
          <Button
            variant="ghost"
            size="sm"
            iconLeft={FolderPlus}
            onClick={() =>
              onChange({
                ...group,
                conditions: [...group.conditions, defaultGroup(fields)],
              })
            }
          >
            Add group
          </Button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* FilterBuilder                                                            */
/* ------------------------------------------------------------------------ */

export interface FilterBuilderProps {
  /** Field metadata of the active object (RELATION/FILE are skipped). */
  fields: FieldMetadata[];
  /** The canonical filter tree being edited (root group). */
  value: FilterGroup;
  /** Fired with the full next tree on EVERY edit (controlled). */
  onChange: (next: FilterGroup) => void;
  /** Nesting cap for "Add group" (legacy depth cap; default 3). */
  maxDepth?: number;
  className?: string;
}

/**
 * The recursive AND/OR tree editor. Controlled and presentational — hosts own
 * draft/apply semantics ({@link pruneFilterGroup} before committing).
 */
export function FilterBuilder({
  fields,
  value,
  onChange,
  maxDepth = 3,
  className,
}: FilterBuilderProps): React.JSX.Element {
  const usable = React.useMemo(() => filterableFields(fields), [fields]);

  if (usable.length === 0) {
    return <div className={cn('fb-empty', className)}>No filterable fields.</div>;
  }

  return (
    <div className={cn('fb', className)}>
      <GroupEditor
        fields={usable}
        group={value}
        depth={0}
        maxDepth={maxDepth}
        onChange={onChange}
      />
    </div>
  );
}

export default FilterBuilder;
