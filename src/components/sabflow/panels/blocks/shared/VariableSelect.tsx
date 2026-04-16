'use client';

import { useState, useRef, useId } from 'react';
import { createId } from '@paralleldrive/cuid2';
import type { Variable } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import { selectClass } from './primitives';
import { LuPlus, LuCheck, LuX } from 'react-icons/lu';

/* ─────────────────────────────────────────────────────────────────────────────
   Type-indicator character (single glyph shown next to variable name in the
   dropdown).  Falls back gracefully for variables without a varType field.
   ──────────────────────────────────────────────────────────────────────────── */

const TYPE_GLYPHS: Record<string, string> = {
  text:    'T',
  number:  '#',
  boolean: '?',
  object:  '{}',
};

function typeGlyph(v: Variable): string | null {
  // varType is stored on the Variable shape by VariablesPanel
  const vt = (v as Variable & { varType?: string }).varType;
  return vt ? (TYPE_GLYPHS[vt] ?? null) : null;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Props
   ──────────────────────────────────────────────────────────────────────────── */

type Props = {
  variables: Variable[];
  value?: string;
  onChange: (variableId: string | undefined) => void;
  /**
   * Called when the user creates a new variable inline.
   * The parent is responsible for appending it to the flow's variables array
   * AND selecting it (by passing the new id as `value`).
   */
  onCreateVariable?: (variable: Variable) => void;
  placeholder?: string;
};

/* ─────────────────────────────────────────────────────────────────────────────
   Inline create form — rendered below the <select> when triggered
   ──────────────────────────────────────────────────────────────────────────── */

interface InlineCreateProps {
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

function InlineCreate({ onConfirm, onCancel }: InlineCreateProps) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <div className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-[#f76808]/40 bg-[#f76808]/5 px-2.5 py-1.5">
      <input
        ref={inputRef}
        id={inputId}
        autoFocus
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="Variable name…"
        className={cn(
          'flex-1 min-w-0 rounded-md border border-[var(--gray-5)] bg-[var(--gray-1)]',
          'px-2 py-1 text-[11.5px] font-mono text-[var(--gray-12)]',
          'outline-none focus:border-[#f76808] transition-colors',
        )}
      />
      <button
        type="button"
        onClick={submit}
        disabled={!name.trim()}
        title="Create variable"
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors',
          name.trim()
            ? 'bg-[#f76808] text-white hover:bg-[#e25c00]'
            : 'bg-[var(--gray-4)] text-[var(--gray-7)] cursor-not-allowed',
        )}
      >
        <LuCheck className="h-2.5 w-2.5" strokeWidth={3} />
      </button>
      <button
        type="button"
        onClick={onCancel}
        title="Cancel"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--gray-8)] hover:bg-[var(--gray-4)] hover:text-[var(--gray-11)] transition-colors"
      >
        <LuX className="h-2.5 w-2.5" strokeWidth={3} />
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   VariableSelect
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * A <select> that lists all flow-level variables.
 *
 * - The first option is a blank "— none —" option.
 * - Each option renders a type-indicator glyph prefix when the variable
 *   carries a `varType` field.
 * - When no variables exist (or `onCreateVariable` is provided) a
 *   "+ Create variable" affordance appears beneath the select.
 */
export function VariableSelect({
  variables,
  value,
  onChange,
  onCreateVariable,
  placeholder = '— none —',
}: Props) {
  const [creating, setCreating] = useState(false);

  const handleCreate = (name: string) => {
    if (!onCreateVariable) return;
    const newVar: Variable = { id: createId(), name };
    onCreateVariable(newVar);
    setCreating(false);
  };

  const showCreateTrigger = Boolean(onCreateVariable) && !creating;

  return (
    <div className="space-y-1">
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className={selectClass}
      >
        <option value="">{placeholder}</option>
        {variables.map((v) => {
          const glyph = typeGlyph(v);
          return (
            <option key={v.id} value={v.id}>
              {glyph ? `${glyph}  ${v.name}` : v.name}
              {v.isSessionVariable ? ' (session)' : ''}
              {v.isHidden ? ' (hidden)' : ''}
            </option>
          );
        })}
      </select>

      {/* ── Inline create ──────────────────────────────────── */}
      {creating && (
        <InlineCreate
          onConfirm={handleCreate}
          onCancel={() => setCreating(false)}
        />
      )}

      {showCreateTrigger && (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className={cn(
            'flex w-full items-center gap-1.5 rounded-lg border border-dashed border-[var(--gray-6)]',
            'px-2.5 py-1 text-[11.5px] text-[var(--gray-9)]',
            'hover:border-[#f76808]/40 hover:bg-[#f76808]/5 hover:text-[#f76808]',
            'transition-colors',
          )}
        >
          <LuPlus className="h-3 w-3 shrink-0" strokeWidth={2.5} />
          {variables.length === 0 ? 'Create a variable' : '+ Create variable'}
        </button>
      )}
    </div>
  );
}
