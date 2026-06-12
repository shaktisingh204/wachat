'use client';

/**
 * RecordSurface fields — BOOLEAN.
 *
 * Display: a check glyph (on) / muted dash (off), Twenty style.
 * Edit: a 20ui Checkbox — toggling commits immediately.
 */

import * as React from 'react';
import { Check } from 'lucide-react';

import { Checkbox } from '../../../choice';
import type { FieldDisplayProps, FieldEditorProps } from './shared';

export function BooleanDisplay({ value }: FieldDisplayProps): React.JSX.Element {
  const on = Boolean(value);
  return on ? (
    <span className="rc-bool is-on" aria-label="Yes">
      <Check size={14} strokeWidth={2.5} aria-hidden="true" />
    </span>
  ) : (
    <span className="rc-bool" aria-label="No">
      —
    </span>
  );
}

export function BooleanEditor({
  field,
  value,
  onCommit,
  onCancel,
}: FieldEditorProps): React.JSX.Element {
  return (
    <Checkbox
      autoFocus
      size="sm"
      defaultChecked={Boolean(value)}
      onChange={(e) => onCommit(e.target.checked)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          onCommit(!Boolean(value));
        }
      }}
      aria-label={field.label}
    />
  );
}
