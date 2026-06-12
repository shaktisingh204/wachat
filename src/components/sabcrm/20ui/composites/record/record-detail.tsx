'use client';

/**
 * RecordDetail — the RecordSurface detail layout (composites/record).
 *
 * Presentational: ALL data arrives via props, persistence happens through
 * `onFieldCommit`, and the tab bodies are pluggable ReactNodes — no server
 * calls inside. Composes:
 *
 *   ┌ header — back, breadcrumb, avatar + inline-editable TITLE (via
 *   │          RecordCell mode switching), favorite star, actions slot
 *   ├ left   — {@link RecordPanel}: every non-system field, click-to-edit,
 *   │          optimistic while the commit promise pends
 *   └ right  — {@link RecordTabs}: Timeline / Notes / Tasks / Files / …
 *
 * Under ~900px the panel collapses ABOVE the tabs (see record-detail.css).
 *
 * Gotchas honoured: 20ui primitives are imported RELATIVELY (never the
 * barrel — self-cycle), icons render via `renderIcon`, tokens only — dark
 * mode is free.
 */

import * as React from 'react';
import { ArrowLeft, Star } from 'lucide-react';

import type { CrmRecord, FieldMetadata, ObjectMetadata } from '@/lib/sabcrm/types';
import { IconButton } from '../../button';
import { Avatar } from '../../avatar';
import { Skeleton } from '../../loading';
import { cn } from '../lib/cn';
import {
  RecordCell,
  type RecordCellFmt,
  type RelationResolver,
} from './record-cell';
import { RecordPanel } from './record-panel';
import { RecordTabs, type RecordDetailTab } from './record-tabs';

import './record-detail.css';

/* ----------------------------------------------------------------- types */

export interface RecordDetailHeader {
  /** Renders a back chevron when given. */
  onBack?: () => void;
  /** Breadcrumb slot shown above the title (e.g. 20ui <Breadcrumb>). */
  breadcrumb?: React.ReactNode;
  /** Right-aligned actions slot (buttons / dropdown menu). */
  actions?: React.ReactNode;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

export interface RecordDetailProps {
  object: ObjectMetadata;
  record: CrmRecord;
  /** Ordered; the panel renders all non-system entries. */
  fields: FieldMetadata[];
  /** The label-identifier field. Defaults to `isLabel`, then the first field. */
  titleFieldKey?: string;
  /** Persist one field. A returned promise drives the optimistic display. */
  onFieldCommit: (key: string, next: unknown) => void | Promise<void>;
  relationResolver?: RelationResolver;
  fmt?: RecordCellFmt;
  /** Pluggable right-hand tabs. */
  tabs: RecordDetailTab[];
  defaultTabId?: string;
  header?: RecordDetailHeader;
  loading?: boolean;
  className?: string;
}

/* --------------------------------------------------------------- helpers */

/** Best-effort plain-text title from a (possibly composite) field value. */
function titleText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const rec = value as Record<string, unknown>;
    const composed = [rec.firstName, rec.lastName]
      .filter((p): p is string => typeof p === 'string' && p.trim() !== '')
      .join(' ')
      .trim();
    if (composed) return composed;
    for (const k of ['name', 'label', 'title']) {
      const v = rec[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
  }
  return '';
}

/* ------------------------------------------------------------- component */

export function RecordDetail({
  object,
  record,
  fields,
  titleFieldKey,
  onFieldCommit,
  relationResolver,
  fmt,
  tabs,
  defaultTabId,
  header,
  loading = false,
  className,
}: RecordDetailProps): React.JSX.Element {
  const titleField = React.useMemo<FieldMetadata | undefined>(() => {
    if (titleFieldKey) {
      const exact = fields.find((f) => f.key === titleFieldKey);
      if (exact) return exact;
    }
    return fields.find((f) => f.isLabel) ?? fields.find((f) => !f.system);
  }, [fields, titleFieldKey]);

  /* ----- Inline-editable title (RecordCell mode switching + optimistic). */
  const [editingTitle, setEditingTitle] = React.useState(false);
  const [pendingTitle, setPendingTitle] = React.useState<{ value: unknown } | null>(
    null,
  );

  const titleValue = titleField
    ? pendingTitle
      ? pendingTitle.value
      : record.data[titleField.key]
    : undefined;
  const title = titleText(titleValue) || `Untitled ${object.labelSingular.toLowerCase()}`;

  const commitTitle = React.useCallback(
    (next: unknown) => {
      if (!titleField) return;
      setEditingTitle(false);
      setPendingTitle({ value: next });
      void Promise.resolve(onFieldCommit(titleField.key, next))
        .catch(() => {
          /* Parent surfaces errors; the title reverts below. */
        })
        .finally(() => setPendingTitle(null));
    },
    [titleField, onFieldCommit],
  );

  const cancelTitle = React.useCallback(() => setEditingTitle(false), []);

  const startTitleEdit = React.useCallback(() => {
    if (titleField && !titleField.system) setEditingTitle(true);
  }, [titleField]);

  const onTitleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLSpanElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        startTitleEdit();
      }
    },
    [startTitleEdit],
  );

  /* ----------------------------------------------------------- loading */
  if (loading) {
    return (
      <div className={cn('rd', className)} aria-busy="true">
        <header className="rd-header">
          <Skeleton style={{ width: 24, height: 24, borderRadius: 6 }} />
          <Skeleton style={{ width: 28, height: 28, borderRadius: 8 }} />
          <Skeleton style={{ width: 200, height: 18 }} />
        </header>
        <div className="rd-body">
          <RecordPanel
            object={object}
            record={record}
            fields={[]}
            onFieldCommit={onFieldCommit}
            loading
          />
          <div className="rd-tabs" aria-hidden="true">
            <div className="rd-tabs__skeleton">
              <Skeleton style={{ width: 90, height: 14 }} />
              <Skeleton style={{ width: 70, height: 14 }} />
              <Skeleton style={{ width: 60, height: 14 }} />
            </div>
            <div className="rd-tabs__skeleton-body">
              <Skeleton style={{ width: '70%', height: 12 }} />
              <Skeleton style={{ width: '50%', height: 12 }} />
              <Skeleton style={{ width: '60%', height: 12 }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rd', className)}>
      <header className="rd-header">
        {header?.onBack ? (
          <IconButton
            label="Back"
            icon={ArrowLeft}
            size="sm"
            onClick={header.onBack}
            className="rd-header__back"
          />
        ) : null}

        <div className="rd-header__main">
          {header?.breadcrumb ? (
            <div className="rd-header__crumb">{header.breadcrumb}</div>
          ) : null}
          <div className="rd-header__titlerow">
            <Avatar name={title} size="sm" shape="square" />
            {titleField && editingTitle ? (
              <span className="rd-header__title-editor">
                <RecordCell
                  field={titleField}
                  value={titleValue}
                  record={record}
                  mode="edit"
                  onCommit={commitTitle}
                  onCancel={cancelTitle}
                  relationResolver={relationResolver}
                  fmt={fmt}
                />
              </span>
            ) : (
              <span
                className={cn(
                  'rd-header__title',
                  titleField && !titleField.system && 'is-editable',
                )}
                role={titleField && !titleField.system ? 'button' : undefined}
                tabIndex={titleField && !titleField.system ? 0 : undefined}
                title={
                  titleField && !titleField.system
                    ? `Edit ${titleField.label.toLowerCase()}`
                    : undefined
                }
                onClick={startTitleEdit}
                onKeyDown={onTitleKeyDown}
              >
                {title}
                {pendingTitle ? (
                  <span className="rd-header__title-saving" aria-label="Saving" />
                ) : null}
              </span>
            )}
            {header?.onToggleFavorite ? (
              <IconButton
                label={header.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                icon={Star}
                size="sm"
                onClick={header.onToggleFavorite}
                aria-pressed={header.isFavorite ?? false}
                className={cn('rd-header__fav', header.isFavorite && 'is-active')}
              />
            ) : null}
          </div>
        </div>

        {header?.actions ? (
          <div className="rd-header__actions">{header.actions}</div>
        ) : null}
      </header>

      <div className="rd-body">
        <RecordPanel
          object={object}
          record={record}
          fields={fields}
          onFieldCommit={onFieldCommit}
          relationResolver={relationResolver}
          fmt={fmt}
        />
        <RecordTabs tabs={tabs} defaultTabId={defaultTabId} />
      </div>
    </div>
  );
}

export default RecordDetail;
