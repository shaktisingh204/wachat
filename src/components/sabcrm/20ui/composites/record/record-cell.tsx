'use client';

/**
 * RecordCell — the single entry point of the RecordSurface field system.
 *
 * Resolves the right display / editor component for a field's type via the
 * `./fields` registry and hands it the shared contract props. Grids, detail
 * panels and boards render every value through this one component:
 *
 *   <RecordCell field={field} value={record.data[field.key]} />
 *   <RecordCell field={field} value={v} mode="edit" onCommit={save} onCancel={stop} />
 *
 * Unknown / future field types degrade to the TEXT pair, so a cell never
 * fails to render.
 */

import * as React from 'react';

import './record-cell.css';

import type { CrmRecord, FieldMetadata } from '@/lib/sabcrm/types';
import {
  getFieldDisplay,
  getFieldEditor,
  resolveFmt,
  type RecordCellFmt,
  type RelationResolver,
  type ResolvedFmt,
} from './fields';

export interface RecordCellProps {
  /** Field definition (drives which display/editor renders). */
  field: FieldMetadata;
  /** The stored value for this field (usually `record.data[field.key]`). */
  value: unknown;
  /** The full record, for field components that need sibling context. */
  record?: CrmRecord;
  /**
   * `display` renders the read view; `edit` mounts the field's editor.
   * Defaults to `display`.
   */
  mode?: 'display' | 'edit';
  /** Commit the next value (Enter / blur / pick). Required to actually edit. */
  onCommit?: (next: unknown) => void;
  /** Abandon the edit (Escape). */
  onCancel?: () => void;
  /** Resolves RELATION labels + search options. No server calls inside. */
  relationResolver?: RelationResolver;
  /** Optional formatter overrides (date / number / currency). */
  fmt?: RecordCellFmt;
  /**
   * Force the read view even in `edit` mode. System fields
   * (`field.system`) are always read-only.
   */
  readOnly?: boolean;
}

const noop = (): void => {};

export function RecordCell({
  field,
  value,
  record,
  mode = 'display',
  onCommit,
  onCancel,
  relationResolver,
  fmt,
  readOnly = false,
}: RecordCellProps): React.JSX.Element {
  const resolvedFmt: ResolvedFmt = React.useMemo(() => resolveFmt(fmt), [fmt]);

  const editing = mode === 'edit' && !readOnly && !field.system;

  if (editing) {
    const Editor = getFieldEditor(field.type);
    return (
      <Editor
        field={field}
        value={value}
        record={record}
        fmt={resolvedFmt}
        relationResolver={relationResolver}
        onCommit={onCommit ?? noop}
        onCancel={onCancel ?? noop}
      />
    );
  }

  const Display = getFieldDisplay(field.type);
  return (
    <Display
      field={field}
      value={value}
      record={record}
      fmt={resolvedFmt}
      relationResolver={relationResolver}
    />
  );
}

// Convenience re-exports so consumers can import the whole field-system
// surface from this one entry point.
export {
  getFieldDisplay,
  getFieldEditor,
  resolveFmt,
  DEFAULT_FMT,
  type RecordCellFmt,
  type RelationResolver,
  type ResolvedFmt,
  type FieldDisplayProps,
  type FieldEditorProps,
} from './fields';
