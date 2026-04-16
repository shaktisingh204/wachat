'use client';

import { useState, useRef, useCallback, useId, useMemo } from 'react';
import { createId } from '@paralleldrive/cuid2';
import type { Variable, SabFlowDoc } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import { extractVariableUsages } from '@/lib/sabflow/variableHelpers';
import {
  LuPlus,
  LuTrash2,
  LuPencil,
  LuCheck,
  LuX,
  LuVariable,
  LuEyeOff,
  LuRefreshCw,
  LuChevronDown,
  LuChevronRight,
  LuInfo,
} from 'react-icons/lu';

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
   Type badge colours
   ──────────────────────────────────────────────────────────────────────────── */

const TYPE_STYLES: Record<VariableVarType, { bg: string; text: string; label: string }> = {
  text:    { bg: 'bg-blue-50 dark:bg-blue-950/40',     text: 'text-blue-600 dark:text-blue-400',    label: 'Text' },
  number:  { bg: 'bg-violet-50 dark:bg-violet-950/40', text: 'text-violet-600 dark:text-violet-400', label: 'Num'  },
  boolean: { bg: 'bg-green-50 dark:bg-green-950/40',   text: 'text-green-600 dark:text-green-400',  label: 'Bool' },
  object:  { bg: 'bg-amber-50 dark:bg-amber-950/40',   text: 'text-amber-600 dark:text-amber-400',  label: 'Obj'  },
};

/* ─────────────────────────────────────────────────────────────────────────────
   Tiny toggle pill component
   ──────────────────────────────────────────────────────────────────────────── */

function TogglePill({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-medium border transition-colors',
        checked
          ? 'bg-[#f76808]/10 border-[#f76808]/30 text-[#f76808]'
          : 'bg-[var(--gray-2)] border-[var(--gray-5)] text-[var(--gray-9)] hover:border-[var(--gray-7)] hover:text-[var(--gray-11)]',
      )}
    >
      <span
        className={cn(
          'h-2 w-2 rounded-full transition-colors shrink-0',
          checked ? 'bg-[#f76808]' : 'bg-[var(--gray-6)]',
        )}
      />
      {label}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   "Used in blocks" expander
   ──────────────────────────────────────────────────────────────────────────── */

interface UsageChipProps {
  blockIds: string[];
  groups: SabFlowDoc['groups'];
}

function UsageChip({ blockIds, groups }: UsageChipProps) {
  const [open, setOpen] = useState(false);

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
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[10.5px] text-[var(--gray-9)] hover:text-[var(--gray-11)] transition-colors"
      >
        {open
          ? <LuChevronDown className="h-2.5 w-2.5" strokeWidth={2.5} />
          : <LuChevronRight className="h-2.5 w-2.5" strokeWidth={2.5} />}
        Used in {blockIds.length} {blockIds.length === 1 ? 'block' : 'blocks'}
      </button>
      {open && (
        <ul className="mt-1 space-y-0.5 pl-3.5">
          {blockNames.map((name, i) => (
            <li
              key={blockIds[i]}
              className="truncate text-[10.5px] text-[var(--gray-8)] before:content-['·'] before:mr-1"
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Inline-editable variable row
   ──────────────────────────────────────────────────────────────────────────── */

interface RowProps {
  variable: RichVariable;
  usedInBlockIds: string[];
  groups: SabFlowDoc['groups'];
  onSave:   (updated: RichVariable) => void;
  onDelete: (id: string) => void;
}

function VariableRow({ variable, usedInBlockIds, groups, onSave, onDelete }: RowProps) {
  const [editing, setEditing]   = useState(false);
  const [draft, setDraft]       = useState<RichVariable>({ ...variable });
  const nameInputRef            = useRef<HTMLInputElement>(null);
  const labelId                 = useId();

  const startEdit = () => {
    setDraft({ ...variable });
    setEditing(true);
    requestAnimationFrame(() => nameInputRef.current?.focus());
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
  const style = TYPE_STYLES[type];

  return (
    <div
      className={cn(
        'group flex flex-col gap-1.5 rounded-xl border px-3 py-2.5 transition-shadow',
        editing
          ? 'border-[#f76808] shadow-[0_0_0_2px_rgba(247,104,8,0.15)] bg-[var(--gray-1)]'
          : 'border-[var(--gray-5)] bg-[var(--gray-2)] hover:border-[var(--gray-7)] hover:bg-[var(--gray-1)]',
      )}
    >
      {editing ? (
        /* ── Edit mode ─────────────────────────────────────────── */
        <div className="flex flex-col gap-2">
          {/* Name + type row */}
          <div className="flex items-center gap-2">
            <input
              ref={nameInputRef}
              id={labelId}
              type="text"
              value={draft.name}
              onChange={(e) => setDraft((v) => ({ ...v, name: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter')  commit();
                if (e.key === 'Escape') discard();
              }}
              placeholder="Variable name"
              className={cn(
                'flex-1 min-w-0 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-3)]',
                'px-2.5 py-1.5 text-[12.5px] font-mono text-[var(--gray-12)]',
                'outline-none focus:border-[#f76808] focus:ring-1 focus:ring-[#f76808]/20 transition-colors',
              )}
            />
            <select
              value={draft.varType ?? 'text'}
              onChange={(e) =>
                setDraft((v) => ({ ...v, varType: e.target.value as VariableVarType }))
              }
              className={cn(
                'rounded-lg border border-[var(--gray-5)] bg-[var(--gray-3)]',
                'px-2 py-1.5 text-[11.5px] text-[var(--gray-11)]',
                'outline-none focus:border-[#f76808] transition-colors cursor-pointer',
              )}
            >
              {(Object.keys(TYPE_STYLES) as VariableVarType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_STYLES[t].label}
                </option>
              ))}
            </select>
          </div>

          {/* Default value */}
          <input
            type="text"
            value={
              draft.defaultValue !== undefined
                ? String(draft.defaultValue)
                : (draft.value ?? '')
            }
            onChange={(e) =>
              setDraft((v) => ({ ...v, defaultValue: e.target.value, value: e.target.value }))
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter')  commit();
              if (e.key === 'Escape') discard();
            }}
            placeholder="Default value (optional)"
            className={cn(
              'w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-3)]',
              'px-2.5 py-1.5 text-[12px] text-[var(--gray-11)]',
              'outline-none focus:border-[#f76808] focus:ring-1 focus:ring-[#f76808]/20 transition-colors',
            )}
          />

          {/* Flags row */}
          <div className="flex items-center gap-2 flex-wrap">
            <TogglePill
              checked={Boolean(draft.isSessionVariable)}
              onChange={(v) => setDraft((d) => ({ ...d, isSessionVariable: v }))}
              label="Session"
            />
            <TogglePill
              checked={Boolean(draft.isHidden)}
              onChange={(v) => setDraft((d) => ({ ...d, isHidden: v }))}
              label="Hidden"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={discard}
              className="flex items-center gap-1 rounded-lg border border-[var(--gray-5)] px-2.5 py-1 text-[11.5px] text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] transition-colors"
            >
              <LuX className="h-3 w-3" strokeWidth={2.5} /> Cancel
            </button>
            <button
              onClick={commit}
              disabled={!draft.name.trim()}
              className={cn(
                'flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition-colors',
                draft.name.trim()
                  ? 'bg-[#f76808] text-white hover:bg-[#e25c00]'
                  : 'bg-[var(--gray-4)] text-[var(--gray-8)] cursor-not-allowed',
              )}
            >
              <LuCheck className="h-3 w-3" strokeWidth={2.5} /> Save
            </button>
          </div>
        </div>
      ) : (
        /* ── View mode ─────────────────────────────────────────── */
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Type badge */}
            <span
              className={cn(
                'shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                style.bg,
                style.text,
              )}
            >
              {style.label}
            </span>

            {/* Name */}
            <p className="flex-1 truncate text-[12.5px] font-mono font-medium text-[var(--gray-12)]">
              {variable.name}
            </p>

            {/* Flag icons */}
            <div className="flex items-center gap-1 shrink-0">
              {variable.isSessionVariable && (
                <span
                  title="Session variable — not persisted across sessions"
                  className="flex items-center justify-center rounded bg-blue-50 dark:bg-blue-950/40 px-1 py-0.5"
                >
                  <LuRefreshCw className="h-2.5 w-2.5 text-blue-500" strokeWidth={2.5} />
                </span>
              )}
              {variable.isHidden && (
                <span
                  title="Hidden — not shown in results"
                  className="flex items-center justify-center rounded bg-[var(--gray-3)] px-1 py-0.5"
                >
                  <LuEyeOff className="h-2.5 w-2.5 text-[var(--gray-9)]" strokeWidth={2.5} />
                </span>
              )}
            </div>

            {/* Hover actions */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                onClick={startEdit}
                title="Edit variable"
                className="flex h-6 w-6 items-center justify-center rounded text-[var(--gray-9)] hover:bg-[var(--gray-4)] hover:text-[var(--gray-12)] transition-colors"
              >
                <LuPencil className="h-3 w-3" strokeWidth={2} />
              </button>
              <button
                onClick={() => onDelete(variable.id)}
                title="Delete variable"
                className="flex h-6 w-6 items-center justify-center rounded text-[var(--gray-9)] hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                <LuTrash2 className="h-3 w-3" strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* Default value preview */}
          {(variable.defaultValue !== undefined || variable.value) && (
            <p className="truncate text-[11px] text-[var(--gray-9)] pl-[3.25rem]">
              = {variable.defaultValue !== undefined
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
        </div>
      )}
    </div>
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

  /* Build usage map — only when `flow` is provided */
  const usageMap = useMemo<Map<string, string[]>>(() => {
    if (!flow) return new Map();
    // extractVariableUsages needs the full SabFlowDoc shape; we only have a
    // partial, so build a minimal compatible object.
    return extractVariableUsages({
      groups: flow.groups,
      variables: flow.variables,
      // unused fields — safe stubs
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
      id:      createId(),
      name:    `variable${variables.length + 1}`,
      value:   '',
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
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[var(--gray-4)] shrink-0">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 text-[#f76808] dark:bg-orange-950/40 shrink-0">
          <LuVariable className="h-3.5 w-3.5" strokeWidth={2} />
        </div>
        <span className="flex-1 text-[13px] font-semibold text-[var(--gray-12)]">Variables</span>
        <span className="text-[11px] tabular-nums text-[var(--gray-9)] font-medium">
          {variables.length}
        </span>
      </div>

      {/* ── Search + Add ──────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--gray-4)] shrink-0">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter variables…"
          className={cn(
            'flex-1 min-w-0 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)]',
            'px-2.5 py-1.5 text-[12px] text-[var(--gray-12)] placeholder:text-[var(--gray-9)]',
            'outline-none focus:border-[#f76808] focus:ring-1 focus:ring-[#f76808]/20 transition-colors',
          )}
        />
        <button
          onClick={handleAdd}
          title="Add variable"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f76808] text-white hover:bg-[#e25c00] transition-colors"
        >
          <LuPlus className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      </div>

      {/* ── Variable list ────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-1.5">
        {filtered.length === 0 ? (
          /* ── Empty state ──────────────────────────────────── */
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--gray-3)] text-[var(--gray-8)]">
              <LuVariable className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[12.5px] font-medium text-[var(--gray-11)]">
                {search ? 'No variables match' : 'No variables yet'}
              </p>
              {!search && (
                <p className="text-[11.5px] text-[var(--gray-9)] mt-0.5 max-w-[200px]">
                  Variables store user answers and computed values across your flow.
                </p>
              )}
            </div>
            {!search && (
              <button
                onClick={handleAdd}
                className="flex items-center gap-1.5 rounded-lg bg-[#f76808] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#e25c00] transition-colors"
              >
                <LuPlus className="h-3 w-3" strokeWidth={2.5} /> Add variable
              </button>
            )}
            {!search && (
              <div className="flex items-start gap-1.5 rounded-xl border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2.5 text-left max-w-[220px]">
                <LuInfo className="h-3 w-3 shrink-0 mt-0.5 text-[var(--gray-8)]" strokeWidth={2} />
                <p className="text-[10.5px] text-[var(--gray-9)] leading-relaxed">
                  Use{' '}
                  <code className="rounded bg-[var(--gray-4)] px-0.5 font-mono text-[9.5px] text-[var(--gray-11)]">
                    {'{{name}}'}
                  </code>{' '}
                  in any block to inject a variable's value.
                </p>
              </div>
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
        <div className="flex flex-col gap-1.5 px-4 py-2.5 border-t border-[var(--gray-4)] shrink-0">
          <p className="text-[11px] text-[var(--gray-9)]">
            Reference with{' '}
            <code className="rounded bg-[var(--gray-3)] px-1 py-0.5 font-mono text-[10px] text-[var(--gray-11)]">
              {'{{variableName}}'}
            </code>{' '}
            in block settings.
          </p>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[10px] text-[var(--gray-8)]">
              <LuRefreshCw className="h-2.5 w-2.5 text-blue-500" strokeWidth={2.5} />
              Session — cleared per session
            </span>
            <span className="flex items-center gap-1 text-[10px] text-[var(--gray-8)]">
              <LuEyeOff className="h-2.5 w-2.5" strokeWidth={2.5} />
              Hidden from results
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
