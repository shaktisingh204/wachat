'use client';

/**
 * SabCRM — Twenty-faithful record DETAIL (client runtime).
 *
 * Renders one record in Twenty's record-page layout (NO ZoruUI; `.st-*` classes
 * + the twenty kit only):
 *   - a header with the object icon + the record's label value,
 *   - a back link to the index,
 *   - a left/main panel: the field list as label→value rows, each value inline-
 *     editable and persisted through `updateSabcrmRecordTw` (optimistic),
 *   - a right rail: a "Timeline" panel placeholder (empty state for now).
 *
 * The server page hands in already-gated initial data. Edits call the gated
 * action; a failure rolls the value back and shows an inline error banner — the
 * Rust engine may be down, so this never crashes.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  AlertTriangle,
  Building2,
  Users,
  Briefcase,
  StickyNote,
  CheckCircle2,
  Database,
  Star,
  Plus,
  Loader2,
  type LucideIcon,
} from 'lucide-react';

import { TwentyFieldValue } from '@/components/sabcrm/twenty/twenty-field';
import {
  TwentyTimeline,
  type TimelineItem,
} from '@/components/sabcrm/twenty/twenty-timeline';
import '@/components/sabcrm/twenty/twenty-activity.css';
import {
  updateSabcrmRecordTw,
  listSabcrmActivitiesTw,
  createSabcrmActivityTw,
  listSabcrmFavoritesTw,
  addSabcrmFavoriteTw,
  removeSabcrmFavoriteTw,
} from '@/app/actions/sabcrm-twenty.actions';
import type {
  SabcrmRustRecord,
  SabcrmRustActivity,
  SabcrmActivityKind,
} from '@/app/actions/sabcrm-twenty.actions.types';
import type { ObjectMetadata, FieldMetadata } from '@/lib/sabcrm/types';

/** Map a known object slug to a Twenty sidebar icon (best-effort). */
const SLUG_ICON: Record<string, LucideIcon> = {
  companies: Building2,
  people: Users,
  opportunities: Briefcase,
  notes: StickyNote,
  tasks: CheckCircle2,
};

const INLINE_EDITABLE: ReadonlySet<FieldMetadata['type']> = new Set<
  FieldMetadata['type']
>(['TEXT', 'EMAIL', 'PHONE', 'LINK', 'NUMBER', 'CURRENCY', 'RATING', 'SELECT']);

function recordLabel(object: ObjectMetadata, record: SabcrmRustRecord): string {
  const field =
    object.fields.find((f) => f.isLabel) ??
    object.fields.find((f) => f.type === 'TEXT' || f.type === 'EMAIL') ??
    object.fields[0];
  if (field) {
    const raw = record.data[field.key];
    if (typeof raw === 'string' && raw.trim()) return raw;
    if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
  }
  return `${object.labelSingular} ${record.id.slice(-6)}`;
}

function coerceInput(field: FieldMetadata, raw: string): unknown {
  if (raw === '') return '';
  if (field.type === 'NUMBER' || field.type === 'CURRENCY' || field.type === 'RATING') {
    const n = Number(raw);
    return Number.isNaN(n) ? raw : n;
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Activity timeline helpers
// ---------------------------------------------------------------------------

/** The activity kinds the composer offers. */
const ACTIVITY_KINDS: readonly { value: SabcrmActivityKind; label: string }[] = [
  { value: 'NOTE', label: 'Note' },
  { value: 'TASK', label: 'Task' },
  { value: 'CALL', label: 'Call' },
  { value: 'MEETING', label: 'Meeting' },
  { value: 'EMAIL', label: 'Email' },
] as const;

/** Map a raw engine activity to the presentational timeline item. */
function activityToItem(a: SabcrmRustActivity): TimelineItem {
  return {
    id: a.id,
    type: a.type,
    title: a.title,
    body: a.body || undefined,
    createdAt: a.createdAt,
    authorName: a.authorId || undefined,
  };
}

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

interface ComposerProps {
  onAdd: (
    type: SabcrmActivityKind,
    title: string,
    body: string,
  ) => Promise<boolean>;
}

function Composer({ onAdd }: ComposerProps) {
  const [type, setType] = React.useState<SabcrmActivityKind>('NOTE');
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving || !title.trim()) return;
    setSaving(true);
    setError(null);
    const ok = await onAdd(type, title.trim(), body.trim());
    setSaving(false);
    if (ok) {
      setTitle('');
      setBody('');
    } else {
      setError('Could not add activity.');
    }
  };

  return (
    <form className="st-composer" onSubmit={submit}>
      <div className="st-composer__row">
        <select
          className="st-composer__type"
          value={type}
          onChange={(e) => setType(e.target.value as SabcrmActivityKind)}
          aria-label="Activity type"
        >
          {ACTIVITY_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        <input
          className="st-composer__title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a title…"
          aria-label="Activity title"
        />
      </div>
      <textarea
        className="st-composer__body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a note (optional)…"
        aria-label="Activity body"
      />
      <div className="st-composer__footer">
        {error && <span className="st-composer__error">{error}</span>}
        <button
          type="submit"
          className="st-composer__add"
          disabled={saving || !title.trim()}
        >
          {saving ? <Loader2 size={13} className="st-spin" /> : <Plus size={13} />}
          Add
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Favorite star
// ---------------------------------------------------------------------------

interface StarToggleProps {
  active: boolean;
  busy?: boolean;
  onToggle: () => void;
  className?: string;
}

function StarToggle({ active, busy, onToggle, className }: StarToggleProps) {
  return (
    <button
      type="button"
      className={`st-star${active ? ' active' : ''}${className ? ` ${className}` : ''}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      disabled={busy}
      aria-pressed={active}
      aria-label={active ? 'Remove from favorites' : 'Add to favorites'}
      title={active ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Star size={15} fill={active ? 'currentColor' : 'none'} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Inline-editable field value
// ---------------------------------------------------------------------------

interface EditableValueProps {
  field: FieldMetadata;
  value: unknown;
  onCommit: (value: unknown) => void;
}

function EditableValue({ field, value, onCommit }: EditableValueProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');

  if (!INLINE_EDITABLE.has(field.type)) {
    return <TwentyFieldValue field={field} value={value} />;
  }

  const begin = () => {
    setDraft(value === null || value === undefined ? '' : String(value));
    setEditing(true);
  };
  const commit = (next: string) => {
    setEditing(false);
    const coerced = coerceInput(field, next);
    if (coerced !== value) onCommit(coerced);
  };

  if (!editing) {
    return (
      <span
        className="st-cell-editable"
        role="button"
        tabIndex={0}
        onClick={begin}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            begin();
          }
        }}
      >
        <TwentyFieldValue field={field} value={value} />
      </span>
    );
  }

  if (field.type === 'SELECT') {
    return (
      <select
        className="st-cell-select"
        autoFocus
        value={draft}
        onChange={(e) => commit(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
      >
        <option value="">—</option>
        {(field.options ?? []).map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      className="st-cell-input"
      autoFocus
      type={
        field.type === 'NUMBER' || field.type === 'CURRENCY' || field.type === 'RATING'
          ? 'number'
          : 'text'
      }
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit((e.target as HTMLInputElement).value);
        } else if (e.key === 'Escape') {
          setEditing(false);
        }
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface RecordDetailTwProps {
  object: ObjectMetadata;
  record: SabcrmRustRecord;
  projectId: string | null;
}

export function RecordDetailTw({
  object,
  record: initialRecord,
  projectId,
}: RecordDetailTwProps): React.JSX.Element {
  const [record, setRecord] = React.useState<SabcrmRustRecord>(initialRecord);
  const [error, setError] = React.useState<string | null>(null);

  // Timeline state.
  const [activities, setActivities] = React.useState<SabcrmRustActivity[]>([]);
  const [loadingTimeline, setLoadingTimeline] = React.useState(true);

  // Favorite state.
  const [favorite, setFavorite] = React.useState(false);
  const [favBusy, setFavBusy] = React.useState(false);

  const ObjectIcon = SLUG_ICON[object.slug] ?? Database;
  const editableFields = React.useMemo(
    () => object.fields.filter((f) => !f.system && f.type !== 'RELATION'),
    [object],
  );

  const handleCommit = React.useCallback(
    async (key: string, value: unknown) => {
      const prev = record;
      setError(null);
      setRecord((r) => ({ ...r, data: { ...r.data, [key]: value } }));
      const res = await updateSabcrmRecordTw(
        object.slug,
        record.id,
        { [key]: value },
        projectId ?? undefined,
      );
      if (!res.ok) {
        setRecord(prev);
        setError(res.error);
      } else {
        setRecord(res.data);
      }
    },
    [record, object.slug, projectId],
  );

  // Load the record's timeline (graceful: empty on failure / engine down).
  React.useEffect(() => {
    let cancelled = false;
    setLoadingTimeline(true);
    (async () => {
      const res = await listSabcrmActivitiesTw(
        object.slug,
        record.id,
        {},
        projectId ?? undefined,
      );
      if (cancelled) return;
      if (res.ok) setActivities(res.data);
      else setActivities([]);
      setLoadingTimeline(false);
    })();
    return () => {
      cancelled = true;
    };
    // Only re-run when the record identity changes (not on every edit).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [object.slug, record.id, projectId]);

  // Load whether this record is favorited.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await listSabcrmFavoritesTw(projectId ?? undefined);
      if (cancelled) return;
      if (res.ok) {
        setFavorite(
          res.data.some(
            (f) => f.object === object.slug && f.recordId === record.id,
          ),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [object.slug, record.id, projectId]);

  const handleAddActivity = React.useCallback(
    async (type: SabcrmActivityKind, title: string, body: string) => {
      const res = await createSabcrmActivityTw(
        {
          targetObject: object.slug,
          targetRecordId: record.id,
          type,
          title,
          body: body || undefined,
        },
        projectId ?? undefined,
      );
      if (!res.ok) return false;
      // Prepend (timeline is newest-first).
      setActivities((prev) => [res.data, ...prev]);
      return true;
    },
    [object.slug, record.id, projectId],
  );

  const handleToggleFavorite = React.useCallback(async () => {
    if (favBusy) return;
    const next = !favorite;
    setFavBusy(true);
    setFavorite(next); // optimistic
    const res = next
      ? await addSabcrmFavoriteTw(object.slug, record.id, projectId ?? undefined)
      : await removeSabcrmFavoriteTw(
          object.slug,
          record.id,
          projectId ?? undefined,
        );
    if (!res.ok) {
      setFavorite(!next); // rollback
      setError(res.error);
    }
    setFavBusy(false);
  }, [favBusy, favorite, object.slug, record.id, projectId]);

  const timelineItems = React.useMemo<TimelineItem[]>(
    () => activities.map(activityToItem),
    [activities],
  );

  return (
    <div className="st-page">
      <Link href={`/sabcrm/${object.slug}`} className="st-back">
        <ArrowLeft size={14} />
        {object.labelPlural}
      </Link>

      <div className="st-detail-header">
        <span className="st-page-header__icon" aria-hidden="true">
          <ObjectIcon size={16} />
        </span>
        <h1 className="st-page-header__title">{recordLabel(object, record)}</h1>
        <StarToggle
          active={favorite}
          busy={favBusy}
          onToggle={handleToggleFavorite}
        />
      </div>

      {error && (
        <div className="st-banner" role="alert">
          <AlertTriangle className="st-banner__icon" size={15} />
          <span>{error}</span>
        </div>
      )}

      <div className="st-detail-grid">
        {/* Main column — field list */}
        <section className="st-panel" aria-label="Record fields">
          <div className="st-panel__head">Details</div>
          <div className="st-panel__body">
            {editableFields.map((field) => (
              <div className="st-field-row" key={field.key}>
                <span className="st-field-row__key">{field.label}</span>
                <span className="st-field-row__val">
                  <EditableValue
                    field={field}
                    value={record.data[field.key]}
                    onCommit={(v) => handleCommit(field.key, v)}
                  />
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Right rail — live timeline + composer */}
        <aside className="st-panel" aria-label="Activity timeline">
          <div className="st-panel__head">Timeline</div>
          <div className="st-panel__body">
            <Composer onAdd={handleAddActivity} />
            <TwentyTimeline
              activities={timelineItems}
              loading={loadingTimeline}
              emptyLabel="No activity yet"
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

export default RecordDetailTw;
