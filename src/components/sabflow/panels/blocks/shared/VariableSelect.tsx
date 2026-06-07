'use client';

import { useState, useRef } from 'react';
import { createId } from '@paralleldrive/cuid2';
import { Plus, Check, X } from 'lucide-react';
import type { Variable } from '@/lib/sabflow/types';
import {
  Button,
  IconButton,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';

/* ─────────────────────────────────────────────────────────────────────────────
   Type-indicator character (single glyph shown next to variable name in the
   dropdown). Falls back gracefully for variables without a varType field.
   ──────────────────────────────────────────────────────────────────────────── */

const TYPE_GLYPHS: Record<string, string> = {
  text: 'T',
  number: '#',
  boolean: '?',
  object: '{}',
};

function typeGlyph(v: Variable): string | null {
  // varType is stored on the Variable shape by VariablesPanel
  const vt = (v as Variable & { varType?: string }).varType;
  return vt ? (TYPE_GLYPHS[vt] ?? null) : null;
}

/**
 * Sentinel value for the blank "none" option. Radix Select cannot use an empty
 * string as an item value, so we map this sentinel to/from `undefined`.
 */
const NONE_VALUE = '__none__';

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
   Inline create form - rendered below the select when triggered
   ──────────────────────────────────────────────────────────────────────────── */

interface InlineCreateProps {
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

function InlineCreate({ onConfirm, onCancel }: InlineCreateProps) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <div className="mt-1.5 flex items-center gap-1.5 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2.5 py-1.5">
      <Input
        ref={inputRef}
        autoFocus
        inputSize="sm"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="Variable name"
        aria-label="New variable name"
        className="flex-1 min-w-0 font-mono"
      />
      <IconButton
        label="Create variable"
        icon={Check}
        variant="primary"
        size="sm"
        onClick={submit}
        disabled={!name.trim()}
      />
      <IconButton
        label="Cancel"
        icon={X}
        variant="ghost"
        size="sm"
        onClick={onCancel}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   VariableSelect
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * A Select that lists all flow-level variables.
 *
 * - The first option is a blank "none" option.
 * - Each option renders a type-indicator glyph prefix when the variable
 *   carries a `varType` field.
 * - When no variables exist (or `onCreateVariable` is provided) a
 *   "Create variable" affordance appears beneath the select.
 */
export function VariableSelect({
  variables,
  value,
  onChange,
  onCreateVariable,
  placeholder = 'none',
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
      <Select
        value={value ?? NONE_VALUE}
        onValueChange={(next) => onChange(next === NONE_VALUE ? undefined : next)}
      >
        <SelectTrigger aria-label="Variable" className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>{placeholder}</SelectItem>
          {variables.map((v) => {
            const glyph = typeGlyph(v);
            const suffix = `${v.isSessionVariable ? ' (session)' : ''}${v.isHidden ? ' (hidden)' : ''}`;
            return (
              <SelectItem key={v.id} value={v.id}>
                {glyph ? `${glyph}  ${v.name}` : v.name}
                {suffix}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {/* ── Inline create ──────────────────────────────────── */}
      {creating && (
        <InlineCreate
          onConfirm={handleCreate}
          onCancel={() => setCreating(false)}
        />
      )}

      {showCreateTrigger && (
        <Button
          variant="outline"
          size="sm"
          block
          iconLeft={Plus}
          onClick={() => setCreating(true)}
          className="border-dashed"
        >
          {variables.length === 0 ? 'Create a variable' : 'Create variable'}
        </Button>
      )}
    </div>
  );
}
