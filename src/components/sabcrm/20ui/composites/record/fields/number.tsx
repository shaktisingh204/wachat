'use client';

/**
 * RecordSurface fields — NUMBER / NUMERIC.
 *
 * NUMERIC is Twenty's high-precision numeric (string-backed); both render as
 * a thousands-separated number and edit through a decimal input.
 */

import * as React from 'react';

import { Input } from '../../../field';
import {
  EmptyValue,
  editorKeyHandler,
  isEmpty,
  type FieldDisplayProps,
  type FieldEditorProps,
} from './shared';

export function NumberDisplay({ value, fmt }: FieldDisplayProps): React.JSX.Element {
  if (isEmpty(value)) return <EmptyValue />;
  const n = Number(value);
  return Number.isNaN(n) ? (
    <span className="rc-text">{String(value)}</span>
  ) : (
    <span className="rc-num">{fmt.number(n)}</span>
  );
}

export function NumberEditor({
  field,
  value,
  onCommit,
  onCancel,
}: FieldEditorProps): React.JSX.Element {
  const [draft, setDraft] = React.useState(isEmpty(value) ? '' : String(value));
  const commit = (): void => {
    const text = draft.trim();
    if (text === '') {
      onCommit(null);
      return;
    }
    // NUMERIC stays string-backed (high precision); NUMBER commits a number.
    if (field.type === 'NUMERIC') {
      onCommit(text);
      return;
    }
    const n = Number(text);
    onCommit(Number.isNaN(n) ? text : n);
  };
  return (
    <Input
      autoFocus
      inputMode="decimal"
      inputSize="sm"
      className="rc-editor-input rc-editor-input--num"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={editorKeyHandler(commit, onCancel)}
      onBlur={commit}
      aria-label="Edit number"
    />
  );
}
