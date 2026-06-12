'use client';

/**
 * RecordPanel — the left field panel of the RecordSurface detail page
 * (composites/record).
 *
 * Presentational: the caller owns the record + persistence; this component
 * owns rendering every non-system field as a calm label-over-value row with
 * click-to-edit. Each value renders through {@link RecordCell} (display mode),
 * flips to the field's editor on click / Enter, and commits through
 * `onFieldCommit`. While a commit promise is pending the panel shows the
 * OPTIMISTIC next value (plus a tiny spinner on the row); when the promise
 * settles the row falls back to `record.data` — so a rejected commit reverts
 * automatically once the parent leaves the data untouched.
 *
 * Gotchas honoured: 20ui primitives are imported RELATIVELY (never the
 * barrel — self-cycle), icons render via `renderIcon`, and all styling rides
 * `--st-*` / `--u-*` tokens (see record-detail.css) so dark mode is automatic.
 */

import * as React from 'react';
import { Loader2 } from 'lucide-react';

import type { CrmRecord, FieldMetadata, ObjectMetadata } from '@/lib/sabcrm/types';
import { Skeleton } from '../../loading';
import { cn } from '../lib/cn';
import {
  RecordCell,
  type RecordCellFmt,
  type RelationResolver,
} from './record-cell';

import './record-detail.css';

/* ----------------------------------------------------------------- types */

export interface RecordPanelProps {
  /** Drives accessible names; field metadata lives in `fields`. */
  object: ObjectMetadata;
  record: CrmRecord;
  /** Ordered field list — the panel renders every NON-system entry. */
  fields: FieldMetadata[];
  /** Persist one field. A returned promise drives the optimistic display. */
  onFieldCommit: (key: string, next: unknown) => void | Promise<void>;
  /** Resolves RELATION labels + search options (forwarded to RecordCell). */
  relationResolver?: RelationResolver;
  /** Optional formatter overrides (forwarded to RecordCell). */
  fmt?: RecordCellFmt;
  /** Field keys to omit (e.g. the title field already shown in the header). */
  excludeKeys?: string[];
  loading?: boolean;
  className?: string;
}

/* ------------------------------------------------------------- internals */

const SKELETON_ROWS = 7;

interface PanelRowProps {
  field: FieldMetadata;
  value: unknown;
  record: CrmRecord;
  editing: boolean;
  saving: boolean;
  onStartEdit: (key: string) => void;
  onCommit: (key: string, next: unknown) => void;
  onCancel: () => void;
  relationResolver?: RelationResolver;
  fmt?: RecordCellFmt;
}

/**
 * One label-over-value row. The value area is a `role="button"` div (NOT a
 * `<button>` — display cells may contain real links/anchors and nesting
 * interactive elements is invalid HTML); clicks that originate on an inner
 * anchor pass through to the link instead of opening the editor.
 */
function PanelRow({
  field,
  value,
  record,
  editing,
  saving,
  onStartEdit,
  onCommit,
  onCancel,
  relationResolver,
  fmt,
}: PanelRowProps): React.JSX.Element {
  const commit = React.useCallback(
    (next: unknown) => onCommit(field.key, next),
    [onCommit, field.key],
  );

  const startEdit = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Let inner links (email / url / phone displays) behave like links.
      if ((e.target as HTMLElement).closest('a, button')) return;
      onStartEdit(field.key);
    },
    [onStartEdit, field.key],
  );

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        if ((e.target as HTMLElement).closest('a, button')) return;
        e.preventDefault();
        onStartEdit(field.key);
      }
    },
    [onStartEdit, field.key],
  );

  return (
    <div className={cn('rd-row', editing && 'is-editing')}>
      <div className="rd-row__label" id={`rd-label-${field.key}`}>
        <span className="rd-row__label-text">{field.label}</span>
        {saving ? (
          <Loader2 size={11} className="rd-row__saving" aria-label="Saving" />
        ) : null}
      </div>
      {editing ? (
        <div className="rd-row__editor">
          <RecordCell
            field={field}
            value={value}
            record={record}
            mode="edit"
            onCommit={commit}
            onCancel={onCancel}
            relationResolver={relationResolver}
            fmt={fmt}
          />
        </div>
      ) : (
        <div
          className="rd-row__value"
          role="button"
          tabIndex={0}
          aria-labelledby={`rd-label-${field.key}`}
          onClick={startEdit}
          onKeyDown={onKeyDown}
        >
          <RecordCell
            field={field}
            value={value}
            record={record}
            relationResolver={relationResolver}
            fmt={fmt}
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- component */

export function RecordPanel({
  object,
  record,
  fields,
  onFieldCommit,
  relationResolver,
  fmt,
  excludeKeys,
  loading = false,
  className,
}: RecordPanelProps): React.JSX.Element {
  const [editingKey, setEditingKey] = React.useState<string | null>(null);
  /** Optimistic values shown while their commit promise is in flight. */
  const [pending, setPending] = React.useState<Record<string, unknown>>({});

  const visible = React.useMemo(() => {
    const skip = new Set(excludeKeys ?? []);
    return fields.filter((f) => !f.system && !skip.has(f.key));
  }, [fields, excludeKeys]);

  const startEdit = React.useCallback((key: string) => setEditingKey(key), []);
  const cancelEdit = React.useCallback(() => setEditingKey(null), []);

  const commit = React.useCallback(
    (key: string, next: unknown) => {
      setEditingKey(null);
      setPending((p) => ({ ...p, [key]: next }));
      void Promise.resolve(onFieldCommit(key, next))
        .catch(() => {
          /* Parent surfaces errors; the row simply reverts below. */
        })
        .finally(() => {
          setPending((p) => {
            const { [key]: _, ...rest } = p;
            return rest;
          });
        });
    },
    [onFieldCommit],
  );

  if (loading) {
    return (
      <div
        className={cn('rd-panel', className)}
        aria-busy="true"
        aria-label={`${object.labelSingular} fields loading`}
      >
        <div className="rd-panel__scroll">
          {Array.from({ length: SKELETON_ROWS }, (_, i) => (
            <div className="rd-row" key={i}>
              <Skeleton style={{ width: 72, height: 10 }} />
              <Skeleton style={{ width: i % 2 ? 150 : 190, height: 14 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn('rd-panel', className)}
      aria-label={`${object.labelSingular} fields`}
    >
      <div className="rd-panel__scroll">
        {visible.length === 0 ? (
          <p className="rd-panel__empty">No fields to show.</p>
        ) : (
          visible.map((field) => (
            <PanelRow
              key={field.key}
              field={field}
              value={
                field.key in pending ? pending[field.key] : record.data[field.key]
              }
              record={record}
              editing={editingKey === field.key}
              saving={field.key in pending}
              onStartEdit={startEdit}
              onCommit={commit}
              onCancel={cancelEdit}
              relationResolver={relationResolver}
              fmt={fmt}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default RecordPanel;
