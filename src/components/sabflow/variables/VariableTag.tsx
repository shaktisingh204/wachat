'use client';

import type { Variable } from '@/lib/sabflow/types';
import { Button, cn } from '@/components/sabcrm/20ui';

/* VariableTag */
/**
 * A small inline pill that displays `{{variableName}}`.
 *
 * Usage:
 *   - In block settings to show which variable is referenced.
 *   - In a variable picker list. Pass `onClick` to insert `{{name}}` into a field.
 *
 * Props:
 *   variable   - The Variable object to display.
 *   onClick    - Called with the `{{name}}` token string when the tag is clicked.
 *   active     - Highlights the tag (e.g. currently selected).
 *   className  - Extra tailwind classes.
 */

interface Props {
  variable: Pick<Variable, 'id' | 'name'>;
  onClick?: (token: string) => void;
  active?: boolean;
  className?: string;
}

const pillBody = (name: string) => (
  <>
    {/* Double-brace decoration */}
    <span className="opacity-50" aria-hidden="true">{'{'}</span>
    <span className="opacity-50" aria-hidden="true">{'{'}</span>
    <span className="mx-0.5">{name}</span>
    <span className="opacity-50" aria-hidden="true">{'}'}</span>
    <span className="opacity-50" aria-hidden="true">{'}'}</span>
  </>
);

const PILL_BASE = cn(
  'inline-flex items-center gap-1 rounded-[var(--st-radius)] px-1.5 py-0.5',
  'font-mono text-[11px] font-medium leading-none',
  'border select-none',
);

export function VariableTag({ variable, onClick, active, className }: Props) {
  const token = `{{${variable.name}}}`;

  if (!onClick) {
    return (
      <span
        className={cn(
          PILL_BASE,
          active
            ? 'border-[var(--st-accent)] bg-[var(--st-accent-soft)] text-[var(--st-text)]'
            : 'border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]',
          className,
        )}
      >
        {pillBody(variable.name)}
      </span>
    );
  }

  return (
    <Button
      variant="ghost"
      onClick={() => onClick(token)}
      aria-label={`Insert ${token}`}
      title={`Insert ${token}`}
      className={cn(
        PILL_BASE,
        'h-auto min-h-0 cursor-pointer transition-colors',
        active
          ? 'border-[var(--st-accent)] bg-[var(--st-accent-soft)] text-[var(--st-text)]'
          : 'border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text)] hover:border-[var(--st-accent)] hover:bg-[var(--st-accent-soft)] hover:text-[var(--st-text)]',
        className,
      )}
    >
      {pillBody(variable.name)}
    </Button>
  );
}

/* VariableTagList */
/**
 * Renders a compact row of VariableTags for all variables in the flow.
 * Clicking a tag fires `onInsert(token)`. The consumer inserts it into
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
