'use client';

/**
 * RecordDetailSurface — the flagged NEW record DETAIL experience for
 * `/sabcrm/[objectSlug]/[recordId]`, built on the 20ui RecordSurface detail
 * composites (`@/components/sabcrm/20ui/composites/record`: RecordDetail =
 * header + RecordPanel + RecordTabs/TimelineList) and wired to the SAME gated
 * server actions the legacy Twenty-styled detail page uses:
 *
 *   - object metadata ........ `listSabcrmObjectsTw`
 *   - the record (enriched) .. `getSabcrmRecordTw` (enrich → relation labels)
 *   - inline field edit ...... `updateSabcrmRecordTw` (optimistic, rollback)
 *   - timeline / notes / tasks `listSabcrmActivitiesTw` /
 *                              `createSabcrmActivityTw` /
 *                              `updateSabcrmActivityTw` (task done-toggle)
 *   - files .................. activity `attachments` (SabFiles refs; the
 *                              attach affordance is `SabFilePickerButton`)
 *   - related records ........ `getRecordRelationsTw`
 *   - favorite star .......... `listSabcrmFavoritesTw` /
 *                              `addSabcrmFavoriteTw` / `removeSabcrmFavoriteTw`
 *   - delete → trash ......... `trashSabcrmRecordTw` (confirm dialog, then
 *                              back to the object index)
 *
 * Relation labels follow the list-surface convention: harvested from the
 * enriched record's `__relations`/`__actors` hints into an id → label cache,
 * with `listSabcrmRecordsTw` powering the relation editor's search.
 *
 * Rendered by the legacy `[recordId]/page.tsx` when the
 * `NEXT_PUBLIC_SABCRM_RECORD_SURFACE` flag matches the active slug (the exact
 * gate the list cutover uses).
 */

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Activity,
  CheckCircle2,
  Database,
  Link2,
  Mail,
  MessageCircle,
  Paperclip,
  Plus,
  RefreshCw,
  StickyNote,
  Trash2,
} from 'lucide-react';

import {
  RecordDetail,
  TimelineList,
  type RecordDetailTab,
  type TimelineItem,
  type TimelineItemKind,
  type RecordCellProps,
} from '@/components/sabcrm/20ui/composites/record';
import { Button, IconButton } from '@/components/sabcrm/20ui/button';
import { Select } from '@/components/sabcrm/20ui/select';
import { Input, Textarea } from '@/components/sabcrm/20ui/field';
import { Checkbox } from '@/components/sabcrm/20ui/choice';
import { Alert, EmptyState } from '@/components/sabcrm/20ui/feedback';
import { Spinner } from '@/components/sabcrm/20ui/loading';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/sabcrm/20ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/sabcrm/20ui/dropdown';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';

import { useProject } from '@/context/project-context';
import { sabcrmRecordLabel } from '@/lib/sabcrm/record-label';
import type { ObjectMetadata, CrmRecord, FieldMetadata } from '@/lib/sabcrm/types';
import { recomputeAiFieldTw } from '@/app/actions/sabcrm-ai.actions';
import {
  listSabcrmObjectsTw,
  listSabcrmRecordsTw,
  getSabcrmRecordTw,
  updateSabcrmRecordTw,
  trashSabcrmRecordTw,
  getRecordRelationsTw,
  listSabcrmActivitiesTw,
  createSabcrmActivityTw,
  updateSabcrmActivityTw,
  listSabcrmFavoritesTw,
  addSabcrmFavoriteTw,
  removeSabcrmFavoriteTw,
} from '@/app/actions/sabcrm-twenty.actions';
import type {
  SabcrmRustRecord,
  SabcrmRustActivity,
  SabcrmActivityKind,
  SabcrmAttachment,
  RecordRelation,
} from '@/app/actions/sabcrm-twenty.actions.types';

import {
  rustRecordToCrm,
  collectRelationLabels,
} from '../record-surface-adapter';
import { RecordDetailWhatsappTab } from './record-detail-whatsapp-tab';
import { RecordDetailEmailTab } from './record-detail-email-tab';

/* -------------------------------------------------------------- constants */

type RelationResolver = NonNullable<RecordCellProps['relationResolver']>;

/** Engine activity `type` → TimelineList kind. */
const ACTIVITY_TIMELINE_KIND: Record<string, TimelineItemKind> = {
  NOTE: 'note',
  TASK: 'task',
  CALL: 'call',
  MEETING: 'meeting',
  EMAIL: 'email',
  COMMENT: 'event',
  WHATSAPP: 'event',
};

/** Kinds the quick "log activity" composer offers. */
const LOG_KINDS: { value: SabcrmActivityKind; label: string }[] = [
  { value: 'NOTE', label: 'Note' },
  { value: 'TASK', label: 'Task' },
  { value: 'CALL', label: 'Call' },
  { value: 'MEETING', label: 'Meeting' },
  { value: 'EMAIL', label: 'Email' },
];

const EXCERPT_MAX = 140;

/* ---------------------------------------------------------------- helpers */

/**
 * Best-effort plain-text excerpt from an activity body. Bodies may be plain
 * text or rich-text JSON (BlockNote-ish) — for JSON we collect `text` string
 * leaves; unparseable JSON degrades to an empty excerpt.
 */
function bodyExcerpt(body?: string): string {
  if (!body) return '';
  const trimmed = body.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const collected: string[] = [];
      const walk = (node: unknown): void => {
        if (collected.join(' ').length > EXCERPT_MAX) return;
        if (typeof node === 'string') return;
        if (Array.isArray(node)) {
          for (const child of node) walk(child);
          return;
        }
        if (node && typeof node === 'object') {
          const rec = node as Record<string, unknown>;
          if (typeof rec.text === 'string' && rec.text.trim()) {
            collected.push(rec.text.trim());
          }
          for (const value of Object.values(rec)) {
            if (typeof value === 'object' && value !== null) walk(value);
          }
        }
      };
      walk(JSON.parse(trimmed));
      const text = collected.join(' ').trim();
      return text.length > EXCERPT_MAX ? `${text.slice(0, EXCERPT_MAX)}…` : text;
    } catch {
      return '';
    }
  }
  return trimmed.length > EXCERPT_MAX
    ? `${trimmed.slice(0, EXCERPT_MAX)}…`
    : trimmed;
}

/** Map a SabFiles pick onto the engine's attachment ref shape. */
function pickToAttachment(pick: SabFilePick): SabcrmAttachment {
  return {
    fileId: pick.id,
    name: pick.name,
    contentType: pick.mime,
    size: pick.size,
    url: pick.url,
  };
}

function fmtBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null) return '';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

/** The payload the tabs hand back when creating an activity. */
interface NewActivityInput {
  type: string;
  title: string;
  body?: string;
  status?: string;
  attachments?: SabcrmAttachment[];
}

/* --------------------------------------------------------- shared styles */

const stackStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--st-space-3, 12px)',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--st-space-2, 8px)',
};

const mutedStyle: React.CSSProperties = {
  fontSize: 'var(--st-font-size-sm, 12px)',
  color: 'var(--st-text-secondary, var(--st-text))',
};

/* ------------------------------------------------------ log-activity form */

interface ActivityComposerProps {
  /** Returns `true` when the create landed (the form then resets). */
  onCreate: (input: NewActivityInput) => Promise<boolean>;
}

/** Quick "log activity" mini-form: kind select + text → create activity. */
function ActivityComposer({ onCreate }: ActivityComposerProps): React.JSX.Element {
  const [kind, setKind] = React.useState<SabcrmActivityKind>('NOTE');
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const submit = React.useCallback(() => {
    const title = text.trim();
    if (!title || busy) return;
    setBusy(true);
    void (async () => {
      const ok = await onCreate({
        type: kind,
        title,
        status: kind === 'TASK' ? 'TODO' : undefined,
      });
      setBusy(false);
      if (ok) setText('');
    })();
  }, [text, busy, kind, onCreate]);

  return (
    <div style={rowStyle}>
      <Select
        size="sm"
        value={kind}
        onChange={(v) => {
          if (v) setKind(v as SabcrmActivityKind);
        }}
        options={LOG_KINDS}
        aria-label="Activity kind"
      />
      <span style={{ flex: 1, minWidth: 0 }}>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Log an activity…"
          aria-label="Activity title"
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />
      </span>
      <Button
        size="sm"
        variant="primary"
        iconLeft={Plus}
        loading={busy}
        disabled={!text.trim()}
        onClick={submit}
      >
        Log
      </Button>
    </div>
  );
}

/* --------------------------------------------------------------- notes tab */

interface NotesTabProps {
  notes: SabcrmRustActivity[];
  onCreate: (input: NewActivityInput) => Promise<boolean>;
}

function NotesTab({ notes, onCreate }: NotesTabProps): React.JSX.Element {
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const submit = React.useCallback(() => {
    const body = text.trim();
    if (!body || busy) return;
    const firstLine = body.split('\n', 1)[0].slice(0, 80) || 'Note';
    setBusy(true);
    void (async () => {
      const ok = await onCreate({ type: 'NOTE', title: firstLine, body });
      setBusy(false);
      if (ok) setText('');
    })();
  }, [text, busy, onCreate]);

  const items = React.useMemo<TimelineItem[]>(
    () =>
      notes.map((a) => ({
        id: a.id,
        kind: 'note',
        title: a.title,
        meta: bodyExcerpt(a.body) || undefined,
        at: a.createdAt,
      })),
    [notes],
  );

  return (
    <div style={stackStyle}>
      <div style={stackStyle}>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a note…"
          aria-label="New note"
          rows={3}
        />
        <div style={{ ...rowStyle, justifyContent: 'flex-end' }}>
          <Button
            size="sm"
            variant="primary"
            iconLeft={Plus}
            loading={busy}
            disabled={!text.trim()}
            onClick={submit}
          >
            Add note
          </Button>
        </div>
      </div>
      <TimelineList
        items={items}
        emptyState={
          <EmptyState
            size="sm"
            icon={StickyNote}
            title="No notes yet"
            description="Capture context, meeting recaps and reminders here."
          />
        }
      />
    </div>
  );
}

/* --------------------------------------------------------------- tasks tab */

interface TasksTabProps {
  tasks: SabcrmRustActivity[];
  onCreate: (input: NewActivityInput) => Promise<boolean>;
  onToggle: (task: SabcrmRustActivity) => void;
}

function TasksTab({ tasks, onCreate, onToggle }: TasksTabProps): React.JSX.Element {
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const submit = React.useCallback(() => {
    const title = text.trim();
    if (!title || busy) return;
    setBusy(true);
    void (async () => {
      const ok = await onCreate({ type: 'TASK', title, status: 'TODO' });
      setBusy(false);
      if (ok) setText('');
    })();
  }, [text, busy, onCreate]);

  return (
    <div style={stackStyle}>
      <div style={rowStyle}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a task…"
            aria-label="New task"
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
          />
        </span>
        <Button
          size="sm"
          variant="primary"
          iconLeft={Plus}
          loading={busy}
          disabled={!text.trim()}
          onClick={submit}
        >
          Add task
        </Button>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          size="sm"
          icon={CheckCircle2}
          title="No tasks yet"
          description="Track follow-ups on this record with tasks."
        />
      ) : (
        <ul
          style={{
            ...stackStyle,
            gap: 'var(--st-space-2, 8px)',
            listStyle: 'none',
            margin: 0,
            padding: 0,
          }}
        >
          {tasks.map((task) => {
            const done = task.status === 'DONE';
            return (
              <li
                key={task.id}
                style={{
                  ...rowStyle,
                  padding: 'var(--st-space-2, 8px)',
                  border: '1px solid var(--st-border)',
                  borderRadius: 'var(--st-radius-md, 8px)',
                }}
              >
                <Checkbox
                  checked={done}
                  onChange={() => onToggle(task)}
                  aria-label={
                    done
                      ? `Mark "${task.title}" as to do`
                      : `Mark "${task.title}" as done`
                  }
                />
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textDecoration: done ? 'line-through' : undefined,
                    color: done
                      ? 'var(--st-text-secondary, var(--st-text))'
                      : 'var(--st-text)',
                  }}
                >
                  {task.title}
                </span>
                {task.dueAt ? (
                  <span style={mutedStyle}>
                    Due{' '}
                    {new Date(task.dueAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- files tab */

interface FilesTabProps {
  activities: SabcrmRustActivity[];
  onCreate: (input: NewActivityInput) => Promise<boolean>;
}

/**
 * Files = the SabFiles attachment refs riding this record's activities (the
 * legacy detail's model — there is no separate attachment store). The attach
 * affordance posts a NOTE activity carrying the picked file.
 */
function FilesTab({ activities, onCreate }: FilesTabProps): React.JSX.Element {
  const files = React.useMemo(
    () =>
      activities.flatMap((a) =>
        (a.attachments ?? []).map((att, i) => ({
          key: `${a.id}:${i}`,
          att,
          at: a.createdAt,
        })),
      ),
    [activities],
  );

  const attach = React.useCallback(
    (pick: SabFilePick) => {
      void onCreate({
        type: 'NOTE',
        title: `Attached ${pick.name}`,
        attachments: [pickToAttachment(pick)],
      });
    },
    [onCreate],
  );

  return (
    <div style={stackStyle}>
      <div>
        <SabFilePickerButton onPick={attach}>Attach file</SabFilePickerButton>
      </div>

      {files.length === 0 ? (
        <EmptyState
          size="sm"
          icon={Paperclip}
          title="No files yet"
          description="Files attached to this record's notes and activities show up here."
        />
      ) : (
        <ul
          style={{
            ...stackStyle,
            gap: 'var(--st-space-2, 8px)',
            listStyle: 'none',
            margin: 0,
            padding: 0,
          }}
        >
          {files.map(({ key, att, at }) => (
            <li
              key={key}
              style={{
                ...rowStyle,
                padding: 'var(--st-space-2, 8px)',
                border: '1px solid var(--st-border)',
                borderRadius: 'var(--st-radius-md, 8px)',
              }}
            >
              <Paperclip
                size={14}
                aria-hidden="true"
                style={{ color: 'var(--st-text-secondary, var(--st-text))', flex: 'none' }}
              />
              {att.url ? (
                <a
                  href={att.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: 'var(--st-text)',
                  }}
                >
                  {att.name}
                </a>
              ) : (
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {att.name}
                </span>
              )}
              {att.size !== undefined ? (
                <span style={mutedStyle}>{fmtBytes(att.size)}</span>
              ) : null}
              <span style={mutedStyle}>
                {new Date(at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- related tab */

interface RelatedTabProps {
  relations: RecordRelation[] | null;
  error: string | null;
  allObjects: ObjectMetadata[];
}

/** Related records, one section per RELATION field, rows linking out. */
function RelatedTab({
  relations,
  error,
  allObjects,
}: RelatedTabProps): React.JSX.Element {
  if (error) {
    return (
      <Alert tone="danger" title="Could not load related records">
        {error}
      </Alert>
    );
  }
  if (relations === null) {
    return (
      <div style={{ ...rowStyle, justifyContent: 'center', minHeight: 80 }}>
        <Spinner aria-label="Loading related records" />
      </div>
    );
  }

  const populated = relations.filter((rel) => rel.records.length > 0);
  if (populated.length === 0) {
    return (
      <EmptyState
        size="sm"
        icon={Link2}
        title="No related records"
        description="Records linked through this object's relation fields show up here."
      />
    );
  }

  return (
    <div style={{ ...stackStyle, gap: 'var(--st-space-4, 16px)' }}>
      {populated.map((rel) => {
        const targetMeta = allObjects.find((o) => o.slug === rel.targetObject);
        return (
          <section key={rel.field} style={{ ...stackStyle, gap: 'var(--st-space-2, 8px)' }}>
            <h3
              style={{
                margin: 0,
                fontSize: 'var(--st-font-size-sm, 12px)',
                fontWeight: 600,
                color: 'var(--st-text-secondary, var(--st-text))',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {rel.label}
              <span style={{ fontWeight: 400 }}> · {rel.records.length}</span>
            </h3>
            <ul
              style={{
                ...stackStyle,
                gap: 'var(--st-space-1, 4px)',
                listStyle: 'none',
                margin: 0,
                padding: 0,
              }}
            >
              {rel.records.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/sabcrm/${rel.targetObject}/${r.id}`}
                    style={{
                      ...rowStyle,
                      padding: 'var(--st-space-2, 8px)',
                      border: '1px solid var(--st-border)',
                      borderRadius: 'var(--st-radius-md, 8px)',
                      color: 'var(--st-text)',
                      textDecoration: 'none',
                    }}
                  >
                    <Link2
                      size={13}
                      aria-hidden="true"
                      style={{
                        color: 'var(--st-text-secondary, var(--st-text))',
                        flex: 'none',
                      }}
                    />
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {targetMeta
                        ? sabcrmRecordLabel(targetMeta, r)
                        : String(r.id)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------ RecordDetailSurface */

export function RecordDetailSurface(): React.JSX.Element {
  const params = useParams<{ objectSlug: string; recordId: string }>();
  const objectSlug = params?.objectSlug ?? '';
  const recordId = params?.recordId ?? '';
  const router = useRouter();
  const { activeProjectId } = useProject();

  /* ---- object metadata + record ------------------------------------------ */

  const [allObjects, setAllObjects] = React.useState<ObjectMetadata[]>([]);
  const [object, setObject] = React.useState<ObjectMetadata | null>(null);
  const [rustRecord, setRustRecord] = React.useState<SabcrmRustRecord | null>(
    null,
  );
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void (async () => {
      const objRes = await listSabcrmObjectsTw(activeProjectId ?? undefined);
      if (cancelled) return;
      if (!objRes.ok) {
        setLoadError(objRes.error);
        setObject(null);
        setRustRecord(null);
        setLoading(false);
        return;
      }
      setAllObjects(objRes.data);
      const found = objRes.data.find((o) => o.slug === objectSlug) ?? null;
      setObject(found);
      if (!found) {
        setRustRecord(null);
        setLoading(false);
        return;
      }
      const recRes = await getSabcrmRecordTw(
        objectSlug,
        recordId,
        activeProjectId ?? undefined,
        true, // enrich: resolve RELATION/ACTOR labels
      );
      if (cancelled) return;
      if (!recRes.ok) {
        setLoadError(recRes.error);
        setRustRecord(null);
      } else {
        setRustRecord(recRes.data);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [objectSlug, recordId, activeProjectId]);

  const record = React.useMemo<CrmRecord | null>(
    () => (rustRecord ? rustRecordToCrm(rustRecord) : null),
    [rustRecord],
  );

  /* ---- relation labels (list-surface convention) -------------------------- */

  const relationLabelsRef = React.useRef(new Map<string, string>());
  const [, bumpRelationLabels] = React.useReducer((n: number) => n + 1, 0);

  React.useEffect(() => {
    if (!rustRecord) return;
    const before = relationLabelsRef.current.size;
    collectRelationLabels([rustRecord], relationLabelsRef.current);
    if (relationLabelsRef.current.size !== before) bumpRelationLabels();
  }, [rustRecord]);

  const relationResolver = React.useMemo<RelationResolver>(
    () => ({
      label: (_field, value) => {
        if (value === null || value === undefined || value === '') return null;
        return relationLabelsRef.current.get(String(value)) ?? null;
      },
      search: async (field, query) => {
        const target = field.relation?.targetObject;
        if (!target) return [];
        const res = await listSabcrmRecordsTw(
          target,
          { q: query || undefined, limit: 10 },
          activeProjectId ?? undefined,
        );
        if (!res.ok) return [];
        const targetObject = allObjects.find((o) => o.slug === target);
        const options = res.data.records.map((r) => ({
          id: r.id,
          label: targetObject ? sabcrmRecordLabel(targetObject, r) : String(r.id),
        }));
        for (const o of options) relationLabelsRef.current.set(o.id, o.label);
        return options;
      },
    }),
    [activeProjectId, allObjects],
  );

  /* ---- field commit (optimistic via RecordPanel/RecordDetail) ------------- */

  const [mutationError, setMutationError] = React.useState<string | null>(null);

  // The composites show the optimistic value while this promise pends and
  // fall back to `record.data` when it settles — landing the patch into local
  // state on success (and rejecting on failure) gives commit + auto-rollback.
  const handleFieldCommit = React.useCallback(
    async (key: string, next: unknown) => {
      setMutationError(null);
      const res = await updateSabcrmRecordTw(
        objectSlug,
        recordId,
        { [key]: next },
        activeProjectId ?? undefined,
      );
      if (!res.ok) {
        setMutationError(res.error);
        throw new Error(res.error);
      }
      setRustRecord((prev) =>
        prev ? { ...prev, data: { ...prev.data, [key]: next } } : prev,
      );
    },
    [objectSlug, recordId, activeProjectId],
  );

  /* ---- AI field recompute (manual, gated server action) -------------------- */

  const [recomputingKey, setRecomputingKey] = React.useState<string | null>(
    null,
  );

  const handleRecomputeAiField = React.useCallback(
    (fieldKey: string) => {
      setRecomputingKey((current) => {
        if (current) return current; // one recompute at a time
        setMutationError(null);
        void (async () => {
          const res = await recomputeAiFieldTw(
            objectSlug,
            recordId,
            fieldKey,
            activeProjectId ?? undefined,
          );
          if (!res.ok) {
            setMutationError(res.error);
          } else {
            // Land the fresh value + a ready __ai meta into local state so
            // the cell flips out of any pending/failed affix immediately.
            setRustRecord((prev) => {
              if (!prev) return prev;
              const prevAi =
                prev.data?.__ai && typeof prev.data.__ai === 'object'
                  ? (prev.data.__ai as Record<string, unknown>)
                  : {};
              return {
                ...prev,
                data: {
                  ...prev.data,
                  [fieldKey]: res.data.value,
                  __ai: {
                    ...prevAi,
                    [fieldKey]: {
                      status: 'ready',
                      computedAt: res.data.computedAt,
                      error: null,
                    },
                  },
                },
              };
            });
          }
          setRecomputingKey(null);
        })();
        return fieldKey;
      });
    },
    [objectSlug, recordId, activeProjectId],
  );

  /** Trailing "Recompute" affordance, injected only on AI field rows. */
  const aiFieldRowTrailing = React.useCallback(
    (field: FieldMetadata): React.ReactNode => {
      if (field.type !== 'AI') return null;
      if (recomputingKey === field.key) {
        return <Spinner size="sm" aria-label={`Recomputing ${field.label}`} />;
      }
      return (
        <IconButton
          label="Recompute"
          icon={RefreshCw}
          size="sm"
          disabled={recomputingKey != null}
          onClick={() => handleRecomputeAiField(field.key)}
        />
      );
    },
    [recomputingKey, handleRecomputeAiField],
  );

  /* ---- favorite ------------------------------------------------------------ */

  const [isFavorite, setIsFavorite] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await listSabcrmFavoritesTw(activeProjectId ?? undefined);
      if (cancelled || !res.ok) return;
      setIsFavorite(
        res.data.some((f) => f.object === objectSlug && f.recordId === recordId),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [objectSlug, recordId, activeProjectId]);

  const toggleFavorite = React.useCallback(() => {
    setIsFavorite((prev) => {
      const next = !prev;
      setMutationError(null);
      void (async () => {
        const res = next
          ? await addSabcrmFavoriteTw(
              objectSlug,
              recordId,
              activeProjectId ?? undefined,
            )
          : await removeSabcrmFavoriteTw(
              objectSlug,
              recordId,
              activeProjectId ?? undefined,
            );
        if (!res.ok) {
          setIsFavorite(prev); // rollback
          setMutationError(res.error);
        }
      })();
      return next;
    });
  }, [objectSlug, recordId, activeProjectId]);

  /* ---- delete (trash) ------------------------------------------------------ */

  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const handleDelete = React.useCallback(() => {
    if (deleting) return;
    setDeleting(true);
    setMutationError(null);
    void (async () => {
      const res = await trashSabcrmRecordTw(
        objectSlug,
        recordId,
        activeProjectId ?? undefined,
      );
      if (!res.ok) {
        setDeleting(false);
        setConfirmDelete(false);
        setMutationError(res.error);
        return;
      }
      router.push(`/sabcrm/${objectSlug}`);
    })();
  }, [deleting, objectSlug, recordId, activeProjectId, router]);

  /* ---- activities (timeline / notes / tasks / files) ---------------------- */

  const [activities, setActivities] = React.useState<SabcrmRustActivity[]>([]);
  const [activitiesError, setActivitiesError] = React.useState<string | null>(
    null,
  );

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await listSabcrmActivitiesTw(
        objectSlug,
        recordId,
        {},
        activeProjectId ?? undefined,
      );
      if (cancelled) return;
      if (res.ok) {
        setActivities(res.data);
        setActivitiesError(null);
      } else {
        setActivities([]);
        setActivitiesError(res.error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [objectSlug, recordId, activeProjectId]);

  const createActivity = React.useCallback(
    async (input: NewActivityInput): Promise<boolean> => {
      setMutationError(null);
      const res = await createSabcrmActivityTw(
        {
          targetObject: objectSlug,
          targetRecordId: recordId,
          ...input,
        },
        activeProjectId ?? undefined,
      );
      if (!res.ok) {
        setMutationError(res.error);
        return false;
      }
      setActivities((prev) => [res.data, ...prev]);
      return true;
    },
    [objectSlug, recordId, activeProjectId],
  );

  const toggleTask = React.useCallback(
    (task: SabcrmRustActivity) => {
      const nextStatus = task.status === 'DONE' ? 'TODO' : 'DONE';
      // Optimistic flip, rollback on failure.
      setActivities((prev) =>
        prev.map((a) => (a.id === task.id ? { ...a, status: nextStatus } : a)),
      );
      setMutationError(null);
      void (async () => {
        const res = await updateSabcrmActivityTw(
          task.id,
          { status: nextStatus },
          activeProjectId ?? undefined,
        );
        if (!res.ok) {
          setActivities((prev) =>
            prev.map((a) =>
              a.id === task.id ? { ...a, status: task.status } : a,
            ),
          );
          setMutationError(res.error);
        } else {
          setActivities((prev) =>
            prev.map((a) => (a.id === task.id ? res.data : a)),
          );
        }
      })();
    },
    [activeProjectId],
  );

  /* ---- related records ----------------------------------------------------- */

  const [relations, setRelations] = React.useState<RecordRelation[] | null>(
    null,
  );
  const [relationsError, setRelationsError] = React.useState<string | null>(
    null,
  );

  React.useEffect(() => {
    let cancelled = false;
    setRelations(null);
    setRelationsError(null);
    void (async () => {
      const res = await getRecordRelationsTw(
        objectSlug,
        recordId,
        activeProjectId ?? undefined,
      );
      if (cancelled) return;
      if (res.ok) {
        setRelations(res.data);
      } else {
        setRelations([]);
        setRelationsError(res.error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [objectSlug, recordId, activeProjectId]);

  /* ---- tabs ----------------------------------------------------------------- */

  const notes = React.useMemo(
    () => activities.filter((a) => a.type === 'NOTE'),
    [activities],
  );
  const tasks = React.useMemo(
    () => activities.filter((a) => a.type === 'TASK'),
    [activities],
  );
  const fileCount = React.useMemo(
    () =>
      activities.reduce((n, a) => n + (a.attachments?.length ?? 0), 0),
    [activities],
  );

  /**
   * The WhatsApp tab only exists for objects that CAN hold a phone — i.e.
   * whose fields include a PHONE / PHONES type (people, leads, …).
   */
  const hasPhoneField = React.useMemo(
    () =>
      (object?.fields ?? []).some(
        (f) => f.type === 'PHONE' || f.type === 'PHONES',
      ),
    [object],
  );

  /**
   * The Email tab only exists for objects that CAN hold an email — i.e.
   * whose fields include an EMAIL / EMAILS type (people, leads, …).
   */
  const hasEmailField = React.useMemo(
    () =>
      (object?.fields ?? []).some(
        (f) => f.type === 'EMAIL' || f.type === 'EMAILS',
      ),
    [object],
  );

  /** Sends logged as WHATSAPP activities land on the Timeline immediately. */
  const handleWhatsappActivityLogged = React.useCallback(
    (activity: SabcrmRustActivity) => {
      setActivities((prev) => [activity, ...prev]);
    },
    [],
  );

  /** Sends logged as EMAIL activities land on the Timeline immediately. */
  const handleEmailActivityLogged = React.useCallback(
    (activity: SabcrmRustActivity) => {
      setActivities((prev) => [activity, ...prev]);
    },
    [],
  );

  const timelineItems = React.useMemo<TimelineItem[]>(
    () =>
      activities.map((a) => ({
        id: a.id,
        kind: ACTIVITY_TIMELINE_KIND[a.type] ?? 'system',
        title: a.title,
        meta: bodyExcerpt(a.body) || undefined,
        at: a.createdAt,
      })),
    [activities],
  );

  const tabs = React.useMemo<RecordDetailTab[]>(
    () => [
      {
        id: 'timeline',
        label: 'Timeline',
        icon: Activity,
        badge: activities.length > 0 ? activities.length : undefined,
        content: (
          <div style={stackStyle}>
            <ActivityComposer onCreate={createActivity} />
            {activitiesError ? (
              <Alert tone="danger" title="Could not load the timeline">
                {activitiesError}
              </Alert>
            ) : (
              <TimelineList items={timelineItems} />
            )}
          </div>
        ),
      },
      {
        id: 'notes',
        label: 'Notes',
        icon: StickyNote,
        badge: notes.length > 0 ? notes.length : undefined,
        content: <NotesTab notes={notes} onCreate={createActivity} />,
      },
      {
        id: 'tasks',
        label: 'Tasks',
        icon: CheckCircle2,
        badge: tasks.length > 0 ? tasks.length : undefined,
        content: (
          <TasksTab tasks={tasks} onCreate={createActivity} onToggle={toggleTask} />
        ),
      },
      {
        id: 'files',
        label: 'Files',
        icon: Paperclip,
        badge: fileCount > 0 ? fileCount : undefined,
        content: <FilesTab activities={activities} onCreate={createActivity} />,
      },
      {
        id: 'related',
        label: 'Related',
        icon: Link2,
        content: (
          <RelatedTab
            relations={relations}
            error={relationsError}
            allObjects={allObjects}
          />
        ),
      },
      ...(hasPhoneField
        ? [
            {
              id: 'whatsapp',
              label: 'WhatsApp',
              icon: MessageCircle,
              content: (
                <RecordDetailWhatsappTab
                  projectId={activeProjectId ?? undefined}
                  objectSlug={objectSlug}
                  recordId={recordId}
                  onActivityLogged={handleWhatsappActivityLogged}
                />
              ),
            } satisfies RecordDetailTab,
          ]
        : []),
      ...(hasEmailField
        ? [
            {
              id: 'email',
              label: 'Email',
              icon: Mail,
              content: (
                <RecordDetailEmailTab
                  projectId={activeProjectId ?? undefined}
                  objectSlug={objectSlug}
                  recordId={recordId}
                  onActivityLogged={handleEmailActivityLogged}
                />
              ),
            } satisfies RecordDetailTab,
          ]
        : []),
    ],
    [
      activities,
      activitiesError,
      timelineItems,
      notes,
      tasks,
      fileCount,
      relations,
      relationsError,
      allObjects,
      createActivity,
      toggleTask,
      hasPhoneField,
      hasEmailField,
      activeProjectId,
      objectSlug,
      recordId,
      handleWhatsappActivityLogged,
      handleEmailActivityLogged,
    ],
  );

  /* ---- render ---------------------------------------------------------------- */

  const rootStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--st-space-3, 12px)',
    padding: 'var(--st-space-4, 16px)',
    minHeight: 0,
    flex: 1,
    fontFamily: 'var(--st-font, inherit)',
    color: 'var(--st-text, inherit)',
  };

  if (loading) {
    return (
      <div className="20ui" style={rootStyle}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 240,
          }}
        >
          <Spinner aria-label="Loading record" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="20ui" style={rootStyle}>
        <Alert tone="danger" title="Could not load this record">
          {loadError}
        </Alert>
        <div>
          <Button
            variant="secondary"
            onClick={() => router.push(`/sabcrm/${objectSlug}`)}
          >
            Back
          </Button>
        </div>
      </div>
    );
  }

  if (!object || !record) {
    return (
      <div className="20ui" style={rootStyle}>
        <EmptyState
          icon={Database}
          title="Record not found"
          description="This record may have been removed, or you may not have access to it."
          action={
            <Button
              variant="secondary"
              onClick={() => router.push(`/sabcrm/${objectSlug}`)}
            >
              Back
            </Button>
          }
        />
      </div>
    );
  }

  const titleFieldKey = object.fields.find((f) => f.isLabel)?.key;

  return (
    <div className="20ui" style={rootStyle}>
      {mutationError ? (
        <Alert
          tone="danger"
          title="Change failed"
          onClose={() => setMutationError(null)}
        >
          {mutationError}
        </Alert>
      ) : null}

      <div style={{ flex: 1, minHeight: 0 }}>
        <RecordDetail
          object={object}
          record={record}
          fields={object.fields}
          titleFieldKey={titleFieldKey}
          onFieldCommit={handleFieldCommit}
          relationResolver={relationResolver}
          fieldRowTrailing={aiFieldRowTrailing}
          tabs={tabs}
          defaultTabId="timeline"
          header={{
            onBack: () => router.push(`/sabcrm/${objectSlug}`),
            breadcrumb: (
              <Link
                href={`/sabcrm/${objectSlug}`}
                style={{ color: 'inherit', textDecoration: 'none' }}
              >
                {object.labelPlural}
              </Link>
            ),
            isFavorite,
            onToggleFavorite: toggleFavorite,
            actions: (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="secondary">
                    Actions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    variant="danger"
                    iconLeft={Trash2}
                    onSelect={() => setConfirmDelete(true)}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          }}
        />
      </div>

      {confirmDelete ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !deleting) setConfirmDelete(false);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Delete this {object.labelSingular.toLowerCase()}?
              </DialogTitle>
              <DialogDescription>
                The record moves to the trash and disappears from views. You
                can restore it from the trash later.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="ghost"
                disabled={deleting}
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                iconLeft={Trash2}
                loading={deleting}
                onClick={handleDelete}
              >
                Move to trash
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

export default RecordDetailSurface;
