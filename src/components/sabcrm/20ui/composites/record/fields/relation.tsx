'use client';

/**
 * RecordSurface fields — RELATION + ACTOR.
 *
 * RELATION display: avatar + label chips (company favicons square, people
 * round, initials fallback — Twenty's RecordChip look). Labels come from the
 * injected `relationResolver` (no server calls inside).
 *
 * RELATION edit: a Combobox fed by `relationResolver.search`. Picking commits
 * the record id (MANY_TO_ONE) or appends it to the id list (ONE_TO_MANY).
 *
 * ACTOR is an audit composite (created-by / updated-by) — display only; its
 * editor renders the read-only display.
 */

import * as React from 'react';

import { Avatar } from '../../../avatar';
import { Combobox, type ComboboxOption } from '../../../combobox';
import {
  EmptyValue,
  actorAvatar,
  isEmpty,
  parseActor,
  relationId,
  resolveRelationDisplay,
  type FieldDisplayProps,
  type FieldEditorProps,
} from './shared';

/* =========================================================================
   RELATION
   ========================================================================= */

export function RelationDisplay({
  field,
  value,
  relationResolver,
}: FieldDisplayProps): React.JSX.Element {
  const arr = Array.isArray(value) ? value : isEmpty(value) ? [] : [value];
  if (arr.length === 0) return <EmptyValue />;
  return (
    <span className="rc-chips">
      {arr.map((v, i) => {
        const { label, src, shape } = resolveRelationDisplay(
          field,
          v,
          relationResolver,
        );
        return (
          <span key={`${label}-${i}`} className="rc-chip">
            <Avatar name={label || 'Record'} src={src} shape={shape} size="xs" />
            <span className="rc-chip__label">{label}</span>
          </span>
        );
      })}
    </span>
  );
}

export function RelationEditor({
  field,
  value,
  relationResolver,
  onCommit,
  onCancel,
}: FieldEditorProps): React.JSX.Element {
  const isMany = field.relation?.kind === 'ONE_TO_MANY';
  const currentIds = React.useMemo(() => {
    const arr = Array.isArray(value) ? value : isEmpty(value) ? [] : [value];
    return arr.map(relationId).filter(Boolean);
  }, [value]);

  const search = relationResolver?.search;
  const onSearch = React.useMemo(() => {
    if (!search) return undefined;
    return async (q: string): Promise<ComboboxOption[]> => {
      const results = await search(field, q);
      return results.map((r) => ({ value: r.id, label: r.label }));
    };
  }, [search, field]);

  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    inputRef.current?.focus();
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
      <Combobox
        ref={inputRef}
        value={isMany ? null : currentIds[0] ?? null}
        onSearch={onSearch}
        options={onSearch ? undefined : []}
        emptyText={onSearch ? 'No matches' : 'No resolver provided'}
        placeholder={`Search ${field.relation?.targetObject ?? 'records'}...`}
        onChange={(id) => {
          if (!id) return;
          if (isMany) {
            onCommit(currentIds.includes(id) ? currentIds : [...currentIds, id]);
          } else {
            onCommit(id);
          }
        }}
        aria-label={field.label}
      />
    </span>
  );
}

/* =========================================================================
   ACTOR
   ========================================================================= */

export function ActorDisplay({ value }: FieldDisplayProps): React.JSX.Element {
  // Without the actors context, an id-only actor degrades to showing the id;
  // callers can pre-resolve names server-side before passing the value.
  const actor = parseActor(value);
  if (!actor || (!actor.name && !actor.source)) return <EmptyValue />;
  const displayName = actor.name || actor.source || 'Unknown';
  const src = actorAvatar(value);
  return (
    <span className="rc-actor">
      <Avatar name={displayName} src={src} shape="round" size="xs" />
      <span className="rc-actor__name">{displayName}</span>
      {actor.source ? (
        <span className="rc-actor__source">{actor.source}</span>
      ) : null}
    </span>
  );
}

/** ACTOR is system-written (audit trail) — editing renders the display. */
export function ActorEditor(props: FieldEditorProps): React.JSX.Element {
  return <ActorDisplay {...props} />;
}
