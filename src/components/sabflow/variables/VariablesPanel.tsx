'use client';

import { useState, useRef, useCallback, useId } from 'react';
import { createId } from '@paralleldrive/cuid2';
import type { Variable } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import {
  LuPlus,
  LuTrash2,
  LuPencil,
  LuCheck,
  LuX,
  LuVariable,
} from 'react-icons/lu';

/* ── Types ──────────────────────────────────────────────── */

export type VariableType = 'text' | 'number' | 'boolean' | 'object';

interface RichVariable extends Variable {
  varType?: VariableType;
}

interface Props {
  variables: Variable[];
  onUpdate: (variables: Variable[]) => void;
}

/* ── Type badge colours ─────────────────────────────────── */

const TYPE_STYLES: Record<VariableType, { bg: string; text: string; label: string }> = {
  text:    { bg: 'bg-blue-50 dark:bg-blue-950/40',    text: 'text-blue-600 dark:text-blue-400',   label: 'Text' },
  number:  { bg: 'bg-violet-50 dark:bg-violet-950/40', text: 'text-violet-600 dark:text-violet-400', label: 'Num' },
  boolean: { bg: 'bg-green-50 dark:bg-green-950/40',  text: 'text-green-600 dark:text-green-400',  label: 'Bool' },
  object:  { bg: 'bg-amber-50 dark:bg-amber-950/40',  text: 'text-amber-600 dark:text-amber-400',  label: 'Obj' },
};

/* ── Inline editable row ────────────────────────────────── */

interface RowProps {
  variable: RichVariable;
  onSave: (updated: RichVariable) => void;
  onDelete: (id: string) => void;
}

function VariableRow({ variable, onSave, onDelete }: RowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<RichVariable>({ ...variable });
  const nameInputRef = useRef<HTMLInputElement>(null);
  const labelId = useId();

  const startEdit = () => {
    setDraft({ ...variable });
    setEditing(true);
    // Focus the name input after paint
    requestAnimationFrame(() => nameInputRef.current?.focus());
  };

  const commit = useCallback(() => {
    const trimmed = draft.name.trim();
    if (!trimmed) return; // don't save empty names
    onSave({ ...draft, name: trimmed });
    setEditing(false);
  }, [draft, onSave]);

  const discard = () => {
    setDraft({ ...variable });
    setEditing(false);
  };

  const type: VariableType = (variable as RichVariable).varType ?? 'text';
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
        /* ── Edit mode ─────────────────────────────────── */
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
                if (e.key === 'Enter') commit();
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
              onChange={(e) => setDraft((v) => ({ ...v, varType: e.target.value as VariableType }))}
              className={cn(
                'rounded-lg border border-[var(--gray-5)] bg-[var(--gray-3)]',
                'px-2 py-1.5 text-[11.5px] text-[var(--gray-11)]',
                'outline-none focus:border-[#f76808] transition-colors cursor-pointer',
              )}
            >
              {(Object.keys(TYPE_STYLES) as VariableType[]).map((t) => (
                <option key={t} value={t}>{TYPE_STYLES[t].label}</option>
              ))}
            </select>
          </div>

          {/* Default value */}
          <input
            type="text"
            value={draft.value ?? ''}
            onChange={(e) => setDraft((v) => ({ ...v, value: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') discard();
            }}
            placeholder="Default value (optional)"
            className={cn(
              'w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-3)]',
              'px-2.5 py-1.5 text-[12px] text-[var(--gray-11)]',
              'outline-none focus:border-[#f76808] focus:ring-1 focus:ring-[#f76808]/20 transition-colors',
            )}
          />

          {/* Actions */}
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
        /* ── View mode ─────────────────────────────────── */
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

          {/* Name + default value */}
          <div className="flex-1 min-w-0">
            <p className="truncate text-[12.5px] font-mono font-medium text-[var(--gray-12)]">
              {variable.name}
            </p>
            {variable.value && (
              <p className="truncate text-[11px] text-[var(--gray-9)] mt-0.5">
                = {variable.value}
              </p>
            )}
          </div>

          {/* Actions — revealed on hover */}
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
      )}
    </div>
  );
}

/* ── VariablesPanel ─────────────────────────────────────── */

export function VariablesPanel({ variables, onUpdate }: Props) {
  const [search, setSearch] = useState('');

  const filtered = variables.filter((v) =>
    !search.trim() || v.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleAdd = () => {
    const newVar: RichVariable = {
      id: createId(),
      name: `variable${variables.length + 1}`,
      value: '',
      varType: 'text',
    };
    onUpdate([...variables, newVar]);
  };

  const handleSave = useCallback(
    (updated: RichVariable) => {
      onUpdate(variables.map((v) => (v.id === updated.id ? updated : v)));
    },
    [variables, onUpdate],
  );

  const handleDelete = useCallback(
    (id: string) => {
      onUpdate(variables.filter((v) => v.id !== id));
    },
    [variables, onUpdate],
  );

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[var(--gray-4)] shrink-0">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400 shrink-0">
          <LuVariable className="h-3.5 w-3.5" strokeWidth={2} />
        </div>
        <span className="flex-1 text-[13px] font-semibold text-[var(--gray-12)]">Variables</span>
        <span className="text-[11px] tabular-nums text-[var(--gray-9)] font-medium">
          {variables.length}
        </span>
      </div>

      {/* ── Search + Add ────────────────────────────────── */}
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

      {/* ── Variable list ───────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-1.5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--gray-3)] text-[var(--gray-8)]">
              <LuVariable className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[12.5px] font-medium text-[var(--gray-11)]">
                {search ? 'No variables match' : 'No variables yet'}
              </p>
              {!search && (
                <p className="text-[11.5px] text-[var(--gray-9)] mt-0.5">
                  Add variables to store user responses
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
          </div>
        ) : (
          filtered.map((v) => (
            <VariableRow
              key={v.id}
              variable={v as RichVariable}
              onSave={handleSave}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {/* ── Footer hint ─────────────────────────────────── */}
      {variables.length > 0 && (
        <div className="px-4 py-2.5 border-t border-[var(--gray-4)] shrink-0">
          <p className="text-[11px] text-[var(--gray-9)]">
            Reference with{' '}
            <code className="rounded bg-[var(--gray-3)] px-1 py-0.5 font-mono text-[10px] text-[var(--gray-11)]">
              {'{{variableName}}'}
            </code>{' '}
            in block settings.
          </p>
        </div>
      )}
    </div>
  );
}
