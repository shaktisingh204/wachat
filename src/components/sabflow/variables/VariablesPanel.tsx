'use client';

import { useState, useRef, useCallback } from 'react';
import { createId } from '@paralleldrive/cuid2';
import type { Variable } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import { Plus, Trash2, Pencil, Variable as VariableIcon } from 'lucide-react';
import {
  Button,
  IconButton,
  Input,
  Badge,
  EmptyState,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';

/* ── Types ──────────────────────────────────────────────── */

export type VariableType = 'text' | 'number' | 'boolean' | 'object';

interface RichVariable extends Variable {
  varType?: VariableType;
}

interface Props {
  variables: Variable[];
  onUpdate: (variables: Variable[]) => void;
}

/* ── Type labels ────────────────────────────────────────── */

const TYPE_LABELS: Record<VariableType, string> = {
  text: 'Text',
  number: 'Num',
  boolean: 'Bool',
  object: 'Obj',
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

  return (
    <div
      className={cn(
        'group flex flex-col gap-1.5 rounded-[var(--st-radius)] border px-3 py-2.5 transition-shadow',
        editing
          ? 'border-[var(--st-accent)] bg-[var(--st-bg)]'
          : 'border-[var(--st-border)] bg-[var(--st-bg-secondary)] hover:border-[var(--st-border-strong)] hover:bg-[var(--st-bg)]',
      )}
    >
      {editing ? (
        /* ── Edit mode ─────────────────────────────────── */
        <div className="flex flex-col gap-2">
          {/* Name + type row */}
          <div className="flex items-center gap-2">
            <Input
              ref={nameInputRef}
              inputSize="sm"
              value={draft.name}
              onChange={(e) => setDraft((v) => ({ ...v, name: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') discard();
              }}
              placeholder="Variable name"
              aria-label="Variable name"
              className="flex-1 min-w-0 font-mono"
            />
            <Select
              value={draft.varType ?? 'text'}
              onValueChange={(val) => setDraft((v) => ({ ...v, varType: val as VariableType }))}
            >
              <SelectTrigger aria-label="Variable type" className="w-[88px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_LABELS) as VariableType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Default value */}
          <Input
            inputSize="sm"
            value={draft.value ?? ''}
            onChange={(e) => setDraft((v) => ({ ...v, value: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') discard();
            }}
            placeholder="Default value (optional)"
            aria-label="Default value"
          />

          {/* Actions */}
          <div className="flex items-center justify-end gap-1.5">
            <Button variant="ghost" size="sm" onClick={discard}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={commit} disabled={!draft.name.trim()}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        /* ── View mode ─────────────────────────────────── */
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Type badge */}
          <Badge tone="neutral" kind="soft" className="shrink-0 uppercase">
            {TYPE_LABELS[type]}
          </Badge>

          {/* Name + default value */}
          <div className="flex-1 min-w-0">
            <p className="truncate text-[12.5px] font-mono font-medium text-[var(--st-text)]">
              {variable.name}
            </p>
            {variable.value && (
              <p className="truncate text-[11px] text-[var(--st-text-secondary)] mt-0.5">
                = {variable.value}
              </p>
            )}
          </div>

          {/* Actions - revealed on hover */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <IconButton label="Edit variable" icon={Pencil} size="sm" variant="ghost" onClick={startEdit} />
            <IconButton
              label="Delete variable"
              icon={Trash2}
              size="sm"
              variant="ghost"
              onClick={() => onDelete(variable.id)}
            />
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
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[var(--st-border)] shrink-0">
        <span className="flex h-7 w-7 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)] shrink-0">
          <VariableIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <span className="flex-1 text-[13px] font-semibold text-[var(--st-text)]">Variables</span>
        <Badge tone="neutral" kind="soft" className="tabular-nums">
          {variables.length}
        </Badge>
      </div>

      {/* ── Search + Add ────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--st-border)] shrink-0">
        <Input
          inputSize="sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter variables..."
          aria-label="Filter variables"
          className="flex-1 min-w-0"
        />
        <IconButton label="Add variable" icon={Plus} size="sm" variant="primary" onClick={handleAdd} />
      </div>

      {/* ── Variable list ───────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-1.5">
        {filtered.length === 0 ? (
          <EmptyState
            icon={VariableIcon}
            title={search ? 'No variables match' : 'No variables yet'}
            description={search ? undefined : 'Add variables to store user responses'}
            size="sm"
            action={
              !search ? (
                <Button variant="primary" size="sm" iconLeft={Plus} onClick={handleAdd}>
                  Add variable
                </Button>
              ) : undefined
            }
          />
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
        <div className="px-4 py-2.5 border-t border-[var(--st-border)] shrink-0">
          <p className="text-[11px] text-[var(--st-text-secondary)]">
            Reference with{' '}
            <code className="rounded bg-[var(--st-bg-secondary)] px-1 py-0.5 font-mono text-[10px] text-[var(--st-text)]">
              {'{{variableName}}'}
            </code>{' '}
            in block settings.
          </p>
        </div>
      )}
    </div>
  );
}
