'use client';

import { LuGitFork, LuPlus, LuX, LuArrowRight } from 'react-icons/lu';
import { cn } from '@/lib/utils';
import {
  Button,
  IconButton,
  Card,
  Field,
  Input,
  Switch,
  ColorPicker,
  EmptyState,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';

/* ── Types ───────────────────────────────────────────────── */

export type SwitchOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'regex'
  | 'is_empty'
  | 'is_not_empty';

export interface SwitchCase {
  id: string;
  /** Human-friendly label shown on the output port */
  label: string;
  /** Value to test against (left-hand side), same for all cases */
  operator: SwitchOperator;
  /** Expected value for this case */
  value: string;
  /** Hex accent color for this branch port */
  color: string;
}

export interface SwitchNodeConfig {
  /** The variable/expression being switched on */
  switchValue: string;
  cases: SwitchCase[];
  /** Whether to add a default (fallthrough) output for unmatched items */
  hasDefault: boolean;
  /** Label for the default output */
  defaultLabel: string;
}

export type SwitchNodeProps = {
  config: SwitchNodeConfig;
  onChange: (config: SwitchNodeConfig) => void;
  className?: string;
};

/* ── Constants ───────────────────────────────────────────── */

const OPERATOR_LABELS: Record<SwitchOperator, string> = {
  equals:       '= equals',
  not_equals:   '≠ not equals',
  contains:     '∋ contains',
  not_contains: '∌ not contains',
  starts_with:  '^ starts with',
  ends_with:    '$ ends with',
  greater_than: '> greater than',
  less_than:    '< less than',
  regex:        '~ matches regex',
  is_empty:     '∅ is empty',
  is_not_empty: '◉ is not empty',
};

const UNARY_OPS: SwitchOperator[] = ['is_empty', 'is_not_empty'];

const BRANCH_COLORS = [
  '#6366f1', '#f97316', '#22c55e', '#ec4899',
  '#0ea5e9', '#a855f7', '#f59e0b', '#14b8a6',
];

let _id = 0;
function makeCase(idx: number): SwitchCase {
  return {
    id: `sw-${++_id}`,
    label: `Case ${idx + 1}`,
    operator: 'equals',
    value: '',
    color: BRANCH_COLORS[idx % BRANCH_COLORS.length],
  };
}

/* ── Component ───────────────────────────────────────────── */

export function SwitchNode({ config, onChange, className }: SwitchNodeProps) {
  const addCase = () =>
    onChange({ ...config, cases: [...config.cases, makeCase(config.cases.length)] });

  const removeCase = (id: string) =>
    onChange({ ...config, cases: config.cases.filter((c) => c.id !== id) });

  const updateCase = (id: string, field: keyof SwitchCase, val: string) =>
    onChange({
      ...config,
      cases: config.cases.map((c) => (c.id === id ? { ...c, [field]: val } : c)),
    });

  const portCount = config.cases.length + (config.hasDefault ? 1 : 0);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]">
          <LuGitFork className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </div>
        <div>
          <p className="text-[12.5px] font-semibold text-[var(--st-text)]">Switch</p>
          <p className="text-[11px] text-[var(--st-text-secondary)]">Route items to multiple branches</p>
        </div>
      </div>

      {/* Switch value */}
      <Field
        label="Switch On (value to test)"
        help="Each case below will be evaluated against this value in order."
      >
        <Input
          value={config.switchValue}
          onChange={(e) => onChange({ ...config, switchValue: e.target.value })}
          placeholder="{{data.status}} or {{trigger.type}}"
        />
      </Field>

      {/* Cases */}
      <div className="space-y-2">
        <p className="text-[11.5px] font-medium text-[var(--st-text-secondary)] uppercase tracking-wide">
          Cases
        </p>

        {config.cases.length === 0 && (
          <EmptyState
            icon={LuGitFork}
            size="sm"
            title="No cases yet"
            description="Add one below to start routing items."
          />
        )}

        {config.cases.map((c, idx) => (
          <CaseRow
            key={c.id}
            case_={c}
            index={idx}
            onChange={updateCase}
            onRemove={removeCase}
          />
        ))}

        <Button variant="ghost" size="sm" iconLeft={LuPlus} onClick={addCase}>
          Add case
        </Button>
      </div>

      {/* Default / fallthrough */}
      <Card variant="outlined" padding="sm" className="space-y-2 bg-[var(--st-bg-secondary)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[12.5px] font-semibold text-[var(--st-text)]">Default Output</p>
            <p className="text-[11px] text-[var(--st-text-secondary)]">Items that match no case go here</p>
          </div>
          <Switch
            checked={config.hasDefault}
            onCheckedChange={(v) => onChange({ ...config, hasDefault: v })}
            aria-label="Enable default output"
          />
        </div>

        {config.hasDefault && (
          <Input
            value={config.defaultLabel}
            onChange={(e) => onChange({ ...config, defaultLabel: e.target.value })}
            placeholder="Default"
            aria-label="Default output label"
          />
        )}
      </Card>

      {/* Output port summary */}
      <div className="space-y-1.5">
        <p className="text-[11.5px] font-medium text-[var(--st-text-secondary)] uppercase tracking-wide">
          Output Ports ({portCount} total)
        </p>
        <div className="space-y-1">
          {config.cases.map((c, idx) => (
            <div key={c.id} className="flex items-center gap-2 rounded-[var(--st-radius-sm)] px-2 py-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ background: c.color }}
              />
              <span className="text-[11.5px] font-medium text-[var(--st-text)]">{idx}</span>
              <LuArrowRight className="h-3 w-3 text-[var(--st-text-tertiary)]" strokeWidth={2} aria-hidden="true" />
              <span className="text-[11.5px] text-[var(--st-text-secondary)] truncate">{c.label || `Case ${idx + 1}`}</span>
            </div>
          ))}
          {config.hasDefault && (
            <div className="flex items-center gap-2 rounded-[var(--st-radius-sm)] px-2 py-1.5">
              <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-[var(--st-text-tertiary)]" />
              <span className="text-[11.5px] font-medium text-[var(--st-text)]">{config.cases.length}</span>
              <LuArrowRight className="h-3 w-3 text-[var(--st-text-tertiary)]" strokeWidth={2} aria-hidden="true" />
              <span className="text-[11.5px] text-[var(--st-text-secondary)]">{config.defaultLabel || 'Default'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Case row ────────────────────────────────────────────── */

function CaseRow({
  case_,
  index,
  onChange,
  onRemove,
}: {
  case_: SwitchCase;
  index: number;
  onChange: (id: string, field: keyof SwitchCase, val: string) => void;
  onRemove: (id: string) => void;
}) {
  const isUnary = UNARY_OPS.includes(case_.operator);

  return (
    <Card variant="outlined" padding="sm" className="space-y-2 bg-[var(--st-bg-secondary)]">
      {/* Case header */}
      <div className="flex items-center gap-2">
        {/* Branch color */}
        <ColorPicker
          value={case_.color}
          onChange={(color) => onChange(case_.id, 'color', color)}
          swatches={BRANCH_COLORS}
        />
        <span className="text-[10.5px] font-mono text-[var(--st-text-tertiary)] shrink-0">
          Output {index}
        </span>
        <Input
          className="flex-1"
          value={case_.label}
          onChange={(e) => onChange(case_.id, 'label', e.target.value)}
          placeholder={`Case ${index + 1}`}
          aria-label={`Case ${index + 1} label`}
        />
        <IconButton
          icon={LuX}
          label={`Remove case ${index + 1}`}
          size="sm"
          onClick={() => onRemove(case_.id)}
        />
      </div>

      {/* Operator */}
      <Select
        value={case_.operator}
        onValueChange={(val) => onChange(case_.id, 'operator', val)}
      >
        <SelectTrigger aria-label={`Operator for case ${index + 1}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(OPERATOR_LABELS) as SwitchOperator[]).map((op) => (
            <SelectItem key={op} value={op}>{OPERATOR_LABELS[op]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value (not shown for unary operators) */}
      {!isUnary && (
        <Input
          className={cn(case_.operator === 'regex' && 'font-mono')}
          value={case_.value}
          onChange={(e) => onChange(case_.id, 'value', e.target.value)}
          placeholder={case_.operator === 'regex' ? '^order_.*$' : 'expected value or {{variable}}'}
          aria-label={`Value for case ${index + 1}`}
        />
      )}
    </Card>
  );
}
