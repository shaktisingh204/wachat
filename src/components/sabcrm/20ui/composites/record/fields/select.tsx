'use client';

/**
 * RecordSurface fields — SELECT / MULTI_SELECT.
 *
 * Display: colour-dotted 20ui Tags using each option's colour token.
 * Edit: SELECT opens the 20ui Select (pick = commit); MULTI_SELECT opens the
 * 20ui TagPicker (every toggle commits the next id list).
 */

import * as React from 'react';

import { Tag } from '../../../badge';
import { Select } from '../../../select';
import { TagPicker, type TagOption } from '../../../tagpicker';
import {
  EmptyValue,
  isEmpty,
  optionColor,
  type FieldDisplayProps,
  type FieldEditorProps,
} from './shared';

export function SelectDisplay({ field, value }: FieldDisplayProps): React.JSX.Element {
  if (isEmpty(value)) return <EmptyValue />;
  const opt = field.options?.find((o) => o.value === value);
  return (
    <Tag color={optionColor(opt?.color)} className="rc-tag">
      {opt?.label ?? String(value)}
    </Tag>
  );
}

export function MultiSelectDisplay({
  field,
  value,
}: FieldDisplayProps): React.JSX.Element {
  const arr = Array.isArray(value) ? value : isEmpty(value) ? [] : [value];
  if (arr.length === 0) return <EmptyValue />;
  return (
    <span className="rc-chips">
      {arr.map((v) => {
        const opt = field.options?.find((o) => o.value === v);
        return (
          <Tag key={String(v)} color={optionColor(opt?.color)} className="rc-tag">
            {opt?.label ?? String(v)}
          </Tag>
        );
      })}
    </span>
  );
}

export function SelectEditor({
  field,
  value,
  onCommit,
  onCancel,
}: FieldEditorProps): React.JSX.Element {
  const options = React.useMemo(
    () =>
      (field.options ?? []).map((o) => ({ value: o.value, label: o.label })),
    [field.options],
  );
  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <span
      className="rc-editor-row"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <Select
        ref={ref}
        size="sm"
        block={false}
        clearable
        value={isEmpty(value) ? null : String(value)}
        onChange={(next) => onCommit(next)}
        options={options}
        placeholder={`Select ${field.label.toLowerCase()}`}
        aria-label={field.label}
      />
    </span>
  );
}

export function MultiSelectEditor({
  field,
  value,
  onCommit,
  onCancel,
}: FieldEditorProps): React.JSX.Element {
  const options: TagOption[] = React.useMemo(
    () =>
      (field.options ?? []).map((o) => ({
        id: o.value,
        label: o.label,
        color: optionColor(o.color),
      })),
    [field.options],
  );
  const selected = React.useMemo(() => {
    const arr = Array.isArray(value) ? value : isEmpty(value) ? [] : [value];
    return arr.map((v) => String(v));
  }, [value]);
  const rootRef = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    rootRef.current
      ?.querySelector<HTMLElement>('button, [tabindex]:not([tabindex="-1"])')
      ?.focus();
  }, []);
  return (
    <span
      ref={rootRef}
      className="rc-editor-row"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <TagPicker
        options={options}
        value={selected}
        onChange={(ids) => onCommit(ids)}
        placeholder={`Add ${field.label.toLowerCase()}`}
        aria-label={field.label}
      />
    </span>
  );
}
