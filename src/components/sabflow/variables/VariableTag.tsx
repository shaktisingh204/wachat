'use client';

import type { Variable } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';

/* ── VariableTag ────────────────────────────────────────── */
/**
 * A small inline pill that displays `{{variableName}}`.
 *
 * Usage:
 *   - In block settings to show which variable is referenced.
 *   - In a variable picker list; pass `onClick` to insert `{{name}}` into a field.
 *
 * Props:
 *   variable   — The Variable object to display.
 *   onClick    — Called with the `{{name}}` token string when the tag is clicked.
 *   active     — Highlights the tag (e.g. currently selected).
 *   className  — Extra tailwind classes.
 */

interface Props {
  variable: Pick<Variable, 'id' | 'name'>;
  onClick?: (token: string) => void;
  active?: boolean;
  className?: string;
}

export function VariableTag({ variable, onClick, active, className }: Props) {
  const token = `{{${variable.name}}}`;

  const inner = (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5',
        'font-mono text-[11px] font-medium leading-none',
        'border select-none',
        active
          ? 'border-[#f76808]/60 bg-[#f76808]/10 text-[#f76808]'
          : 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-300',
        onClick && 'cursor-pointer transition-colors hover:border-[#f76808]/60 hover:bg-[#f76808]/10 hover:text-[#f76808]',
        className,
      )}
    >
      {/* Double-brace decoration */}
      <span className="opacity-50">{'{'}</span>
      <span className="opacity-50">{'{'}</span>
      <span className="mx-0.5">{variable.name}</span>
      <span className="opacity-50">{'}'}</span>
      <span className="opacity-50">{'}'}</span>
    </span>
  );

  if (!onClick) return inner;

  return (
    <button
      type="button"
      onClick={() => onClick(token)}
      title={`Insert ${token}`}
      className="inline-flex appearance-none bg-transparent border-none p-0 m-0"
    >
      {inner}
    </button>
  );
}

/* ── VariableTagList ────────────────────────────────────── */
/**
 * Renders a compact row of VariableTags for all variables in the flow.
 * Clicking a tag fires `onInsert(token)` — the consumer inserts it into
 * whatever textarea / input is currently focused.
 */

interface ListProps {
  variables: Pick<Variable, 'id' | 'name'>[];
  onInsert: (token: string) => void;
  className?: string;
}

export function VariableTagList({ variables, onInsert, className }: ListProps) {
  if (variables.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {variables.map((v) => (
        <VariableTag key={v.id} variable={v} onClick={onInsert} />
      ))}
    </div>
  );
}
