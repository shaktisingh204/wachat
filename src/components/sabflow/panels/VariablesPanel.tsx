'use client';

import { useState, useCallback, useMemo } from 'react';
import { createId } from '@paralleldrive/cuid2';
import type { Variable, SabFlowDoc } from '@/lib/sabflow/types';
import { extractVariableUsages } from '@/lib/sabflow/variableHelpers';
import {
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Variable as VariableIcon,
  EyeOff,
  RefreshCw,
  ChevronRight,
  Info,
} from 'lucide-react';
import {
  Button,
  IconButton,
  Card,
  Badge,
  type BadgeTone,
  Field,
  Input,
  Switch,
  EmptyState,
  Callout,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/sabcrm/20ui';

/* ─────────────────────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────────────────────── */

export type VariableVarType = 'text' | 'number' | 'boolean' | 'object';

interface RichVariable extends Variable {
  varType?: VariableVarType;
}

export interface Props {
  variables: Variable[];
  onVariablesChange: (vars: Variable[]) => void;
  /** Pass the full flow so the panel can compute "used in N blocks". */
  flow?: Pick<SabFlowDoc, 'groups' | 'variables'>;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Type badge meta
   ──────────────────────────────────────────────────────────────────────────── */

const TYPE_META: Record<VariableVarType, { tone: BadgeTone; label: string }> = {
  text: { tone: 'neutral', label: 'Text' },
  number: { tone: 'info', label: 'Num' },
  boolean: { tone: 'accent', label: 'Bool' },
  object: { tone: 'warning', label: 'Obj' },
};

/* ─────────────────────────────────────────────────────────────────────────────
   "Used in blocks" expander
   ──────────────────────────────────────────────────────────────────────────── */

interface UsageChipProps {
  blockIds: string[];
  groups: SabFlowDoc['groups'];
}

function UsageChip({ blockIds, groups }: UsageChipProps) {
  const blockNames = useMemo(() => {
    const allBlocks = groups.flatMap((g) =>
      g.blocks.map((b) => ({ id: b.id, label: `${g.title} / ${b.type}` })),
    );
    return blockIds.map((id) => {
      const found = allBlocks.find((b) => b.id === id);
      return found?.label ?? id;
    });
  }, [blockIds, groups]);

  if (blockIds.length === 0) return null;

  return (
    <Collapsible className="mt-1">
      <CollapsibleTrigger
        hideChevron
        className="flex items-center gap-1 text-[10.5px] text-[var(--st-text-secondary)] hover:text-[var(--st-text)] transition-colors"
      >
        <ChevronRight className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden="true" />
        Used in {blockIds.length} {blockIds.length === 1 ? 'block' : 'blocks'}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="mt-1 space-y-0.5 pl-3.5">
          {blockNames.map((name, i) => (
            <li
              key={blockIds[i]}
              className="truncate text-[10.5px] text-[var(--st-text-tertiary)] before:content-['·'] before:mr-1"
            >
              {name}
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Inline-editable variable row
   ──────────────────────────────────────────────────────────────────────────── */

interface RowProps {
  variable: RichVariable;
  usedInBlockIds: string[];
  groups: SabFlowDoc['groups'];
  onSave: (updated: RichVariable) => void;
  onDelete: (id: string) => void;
}

function VariableRow({ variable, usedInBlockIds, groups, onSave, onDelete }: RowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<RichVariable>({ ...variable });

  const startEdit = () => {
    setDraft({ ...variable });
    setEditing(true);
  };

  const commit = useCallback(() => {
    const trimmed = draft.name.trim();
    if (!trimmed) return;
    onSave({ ...draft, name: trimmed });
    setEditing(false);
  }, [draft, onSave]);

  const discard = () => {
    setDraft({ ...variable });
    setEditing(false);
  };

  const type: VariableVarType = (variable as RichVariable).varType ?? 'text';
  const meta = TYPE_META[type];

  if (editing) {
    /* ── Edit mode ─────────────────────────────────────────── */
    return (
      <Card padding="sm" className="flex flex-col gap-2">
        {/* Name + type row */}
        <div className="flex items-center gap-2">
          <Field label="Variable name" className="flex-1 min-w-0">
            <Input
              autoFocus
              inputSize="sm"
              value={draft.name}
              onChange={(e) => setDraft((v) => ({ ...v, name: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') discard();
              }}
              placeholder="Variable name"
              className="font-mono"
            />
          </Field>
          <Field label="Type" className="w-[88px] shrink-0">
            <Select
              value={draft.varType ?? 'text'}
              onValueChange={(val) =>
                setDraft((v) => ({ ...v, varType: val as VariableVarType }))
              }
            >
              <SelectTrigger aria-label="Variable type">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_META) as VariableVarType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_META[t].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {/* Default value */}
        <Field label="Default value">
          <Input
            inputSize="sm"
            value={
              draft.defaultValue !== undefined
                ? String(draft.defaultValue)
                : (draft.value ?? '')
            }
            onChange={(e) =>
              setDraft((v) => ({ ...v, defaultValue: e.target.value, value: e.target.value }))
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') discard();
            }}
            placeholder="Default value (optional)"
          />
        </Field>

        {/* Flags row */}
        <div className="flex items-center gap-4 flex-wrap">
          <Switch
            size="sm"
            checked={Boolean(draft.isSessionVariable)}
            onCheckedChange={(v) => setDraft((d) => ({ ...d, isSessionVariable: v }))}
            label="Session"
          />
          <Switch
            size="sm"
            checked={Boolean(draft.isHidden)}
            onCheckedChange={(v) => setDraft((d) => ({ ...d, isHidden: v }))}
            label="Hidden"
          />
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-1.5">
          <Button size="sm" variant="ghost" iconLeft={X} onClick={discard}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            iconLeft={Check}
            onClick={commit}
            disabled={!draft.name.trim()}
          >
            Save
          </Button>
        </div>
      </Card>
    );
  }

  /* ── View mode ─────────────────────────────────────────── */
  return (
    <Card variant="interactive" padding="sm" className="group flex flex-col gap-1 min-w-0">
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Type badge */}
        <Badge tone={meta.tone} className="shrink-0 uppercase">
          {meta.label}
        </Badge>

        {/* Name */}
        <p className="flex-1 truncate text-[12.5px] font-mono font-medium text-[var(--st-text)]">
          {variable.name}
        </p>

        {/* Flag icons */}
        <div className="flex items-center gap-1 shrink-0">
          {variable.isSessionVariable && (
            <span
              title="Session variable - not persisted across sessions"
              className="flex items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-accent-soft)] px-1 py-0.5"
            >
              <RefreshCw className="h-2.5 w-2.5 text-[var(--st-accent)]" strokeWidth={2.5} aria-hidden="true" />
            </span>
          )}
          {variable.isHidden && (
            <span
              title="Hidden - not shown in results"
              className="flex items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] px-1 py-0.5"
            >
              <EyeOff className="h-2.5 w-2.5 text-[var(--st-text-secondary)]" strokeWidth={2.5} aria-hidden="true" />
            </span>
          )}
        </div>

        {/* Hover actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <IconButton size="sm" label="Edit variable" icon={Pencil} onClick={startEdit} />
          <IconButton
            size="sm"
            variant="danger"
            label="Delete variable"
            icon={Trash2}
            onClick={() => onDelete(variable.id)}
          />
        </div>
      </div>

      {/* Default value preview */}
      {(variable.defaultValue !== undefined || variable.value) && (
        <p className="truncate text-[11px] text-[var(--st-text-secondary)] pl-[3.25rem]">
          ={' '}
          {variable.defaultValue !== undefined
            ? String(variable.defaultValue)
            : variable.value}
        </p>
      )}

      {/* Usage expander */}
      {groups.length > 0 && (
        <div className="pl-[3.25rem]">
          <UsageChip blockIds={usedInBlockIds} groups={groups} />
        </div>
      )}
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   VariablesPanel
   ──────────────────────────────────────────────────────────────────────────── */

export function VariablesPanel({ variables, onVariablesChange, flow }: Props) {
  const [search, setSearch] = useState('');

  const filtered = variables.filter(
    (v) => !search.trim() || v.name.toLowerCase().includes(search.toLowerCase()),
  );

  /* Build usage map, only when `flow` is provided */
  const usageMap = useMemo<Map<string, string[]>>(() => {
    if (!flow) return new Map();
    // extractVariableUsages needs the full SabFlowDoc shape; we only have a
    // partial, so build a minimal compatible object.
    return extractVariableUsages({
      groups: flow.groups,
      variables: flow.variables,
      // unused fields, safe stubs
      _id: undefined,
      userId: '',
      name: '',
      events: [],
      edges: [],
      theme: {},
      settings: {},
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }, [flow]);

  const groups = flow?.groups ?? [];

  const handleAdd = () => {
    const newVar: RichVariable = {
      id: createId(),
      name: `variable${variables.length + 1}`,
      value: '',
      varType: 'text',
    };
    onVariablesChange([...variables, newVar]);
  };

  const handleSave = useCallback(
    (updated: RichVariable) => {
      onVariablesChange(variables.map((v) => (v.id === updated.id ? updated : v)));
    },
    [variables, onVariablesChange],
  );

  const handleDelete = useCallback(
    (id: string) => {
      onVariablesChange(variables.filter((v) => v.id !== id));
    },
    [variables, onVariablesChange],
  );

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[var(--st-border)] shrink-0">
        <div className="flex h-7 w-7 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-[var(--st-accent)] shrink-0">
          <VariableIcon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        </div>
        <span className="flex-1 text-[13px] font-semibold text-[var(--st-text)]">Variables</span>
        <span className="text-[11px] tabular-nums text-[var(--st-text-secondary)] font-medium">
          {variables.length}
        </span>
      </div>

      {/* ── Search + Add ──────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--st-border)] shrink-0">
        <Input
          inputSize="sm"
          aria-label="Filter variables"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter variables..."
          className="flex-1 min-w-0"
        />
        <IconButton
          label="Add variable"
          icon={Plus}
          variant="primary"
          onClick={handleAdd}
        />
      </div>

      {/* ── Variable list ────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-1.5">
        {filtered.length === 0 ? (
          /* ── Empty state ──────────────────────────────────── */
          <div className="flex flex-col items-center gap-3 py-8">
            <EmptyState
              icon={VariableIcon}
              title={search ? 'No variables match' : 'No variables yet'}
              description={
                search
                  ? undefined
                  : 'Variables store user answers and computed values across your flow.'
              }
              action={
                search ? undefined : (
                  <Button size="sm" variant="primary" iconLeft={Plus} onClick={handleAdd}>
                    Add variable
                  </Button>
                )
              }
            />
            {!search && (
              <Callout tone="info" icon={Info} className="max-w-[220px] text-left">
                Use{' '}
                <code className="rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] px-0.5 font-mono text-[9.5px] text-[var(--st-text)]">
                  {'{{name}}'}
                </code>{' '}
                in any block to inject a variable&apos;s value.
              </Callout>
            )}
          </div>
        ) : (
          filtered.map((v) => (
            <VariableRow
              key={v.id}
              variable={v as RichVariable}
              usedInBlockIds={usageMap.get(v.id) ?? []}
              groups={groups}
              onSave={handleSave}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {/* ── Legend row ───────────────────────────────────────── */}
      {variables.length > 0 && (
        <div className="flex flex-col gap-1.5 px-4 py-2.5 border-t border-[var(--st-border)] shrink-0">
          <p className="text-[11px] text-[var(--st-text-secondary)]">
            Reference with{' '}
            <code className="rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] px-1 py-0.5 font-mono text-[10px] text-[var(--st-text)]">
              {'{{variableName}}'}
            </code>{' '}
            in block settings.
          </p>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[10px] text-[var(--st-text-tertiary)]">
              <RefreshCw className="h-2.5 w-2.5 text-[var(--st-accent)]" strokeWidth={2.5} aria-hidden="true" />
              Session, cleared per session
            </span>
            <span className="flex items-center gap-1 text-[10px] text-[var(--st-text-tertiary)]">
              <EyeOff className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden="true" />
              Hidden from results
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
