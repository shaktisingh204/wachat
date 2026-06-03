'use client';

export const dynamic = 'force-dynamic';

/**
 * SabCRM — top-level "Notes" surface (`/sabcrm/notes`), Twenty-faithful.
 *
 * A standalone feed over the standard `notes` object, rendered in Twenty's
 * visual language (`.st-*` classes + the `@/components/sabcrm/twenty` kit + the
 * sibling `../tasks-notes.css` — NO ZoruUI / Tailwind / clay).
 *
 * Why `notes` records (not activities)?
 * -------------------------------------
 * `listSabcrmActivitiesTw` in the actions file is RECORD-scoped — it requires a
 * concrete `targetObject` + `recordId` — so there is no whole-project NOTE
 * activity feed to read. Per the brief we therefore fall back to listing the
 * `notes` object's records via `listSabcrmRecordsTw('notes', …)`, and the
 * composer adds a note with `createSabcrmRecordTw('notes', …)`.
 *
 * The feed is a Twenty card list (newest first). Every data call is a gated
 * server action returning an `ActionResult`; the Rust engine may be DOWN, so
 * failures degrade to inline banners / empty states — the page never crashes.
 */

import * as React from 'react';
import { Plus, AlertTriangle, Loader2, StickyNote } from 'lucide-react';

import { TwentyPageHeader, TwentyButton } from '@/components/sabcrm/twenty';
import { useProject } from '@/context/project-context';
import {
  listSabcrmRecordsTw,
  createSabcrmRecordTw,
} from '@/app/actions/sabcrm-twenty.actions';
import type { SabcrmRustRecord } from '@/app/actions/sabcrm-twenty.actions.types';

import '@/styles/sabcrm-twenty.css';
import '../tasks-notes.css';

// ---------------------------------------------------------------------------
// Constants / helpers
// ---------------------------------------------------------------------------

/** The standard `notes` object slug this feed surfaces. */
const NOTES_OBJECT = 'notes';

const PAGE_LIMIT = 100;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** Compact relative time — "just now", "5m ago", "3h ago", else a short date. */
function relativeTime(value: string | undefined): string {
  if (!value) return '';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < WEEK) return `${Math.floor(diff / DAY)}d ago`;
  return new Date(then).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

/** A note's display title — its `title` field, else the first line of its body. */
function noteTitle(record: SabcrmRustRecord): string {
  const title = asText(record.data.title).trim();
  if (title) return title;
  const body = asText(record.data.body).trim();
  if (body) {
    const firstLine = body.split('\n')[0]!.trim();
    return firstLine.length > 80 ? `${firstLine.slice(0, 80)}…` : firstLine;
  }
  return 'Untitled note';
}

/** A note's body, only if it differs from the derived title. */
function noteBody(record: SabcrmRustRecord, title: string): string {
  const body = asText(record.data.body).trim();
  return body && body !== title ? body : '';
}

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

interface ComposerProps {
  projectId: string | null;
  onCreated: () => void;
}

function Composer({ projectId, onCreated }: ComposerProps) {
  const [body, setBody] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async () => {
    const text = body.trim();
    if (!text) {
      setError('Write something first.');
      return;
    }
    if (saving) return;
    setSaving(true);
    setError(null);

    // Derive a short title from the first line; store the full text as body.
    const firstLine = text.split('\n')[0]!.trim();
    const title = firstLine.length > 80 ? `${firstLine.slice(0, 80)}…` : firstLine;

    const res = await createSabcrmRecordTw(
      NOTES_OBJECT,
      { title, body: text },
      projectId ?? undefined,
    );
    setSaving(false);
    if (res.ok) {
      setBody('');
      onCreated();
    } else {
      setError(res.error);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void submit();
  };

  return (
    <form className="stn-composer" onSubmit={handleSubmit}>
      <textarea
        className="st-textarea"
        value={body}
        rows={3}
        placeholder="Add a note…"
        aria-label="Add a note"
        disabled={saving}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          // ⌘/Ctrl + Enter to post.
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            void submit();
          }
        }}
      />
      {error ? <span className="stn-inline-error">{error}</span> : null}
      <div className="stn-composer__row">
        <span className="stn-composer__hint">⌘ + Enter to post</span>
        <button
          type="submit"
          className="st-btn st-btn--primary"
          disabled={saving || !body.trim()}
        >
          {saving ? <Loader2 size={14} className="st-spin" /> : <Plus size={14} />}
          Add note
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Note card + skeleton
// ---------------------------------------------------------------------------

function NoteCard({ record }: { record: SabcrmRustRecord }) {
  const title = noteTitle(record);
  const body = noteBody(record, title);
  return (
    <li className="stn-note">
      <div className="stn-note__head">
        <span className="stn-note__title">
          <StickyNote size={14} aria-hidden="true" />
          {title}
        </span>
        <time className="stn-note__time" dateTime={record.createdAt}>
          {relativeTime(record.createdAt)}
        </time>
      </div>
      {body ? <p className="stn-note__body">{body}</p> : null}
    </li>
  );
}

function NotesSkeleton() {
  return (
    <ul className="stn-notes-list" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="st-skeleton" style={{ height: 78, borderRadius: 8 }} />
      ))}
    </ul>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="st-banner" role="alert">
      <AlertTriangle className="st-banner__icon" size={15} />
      <span>{message}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmNotesPage(): React.JSX.Element {
  const { activeProjectId } = useProject();

  const [notes, setNotes] = React.useState<SabcrmRustRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshTick, setRefreshTick] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const res = await listSabcrmRecordsTw(
        NOTES_OBJECT,
        { limit: PAGE_LIMIT, sortBy: 'createdAt', sortDir: 'desc' },
        activeProjectId ?? undefined,
      );
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error);
        setNotes([]);
      } else {
        setNotes(res.data.records);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProjectId, refreshTick]);

  const refresh = React.useCallback(() => setRefreshTick((t) => t + 1), []);

  const isEmpty = !loading && notes.length === 0;

  return (
    <div className="st-page">
      <TwentyPageHeader title="Notes" icon={StickyNote} />

      <div className="stn-feed">
        <Composer projectId={activeProjectId} onCreated={refresh} />

        {error ? <ErrorBanner message={error} /> : null}

        {loading ? (
          <NotesSkeleton />
        ) : isEmpty ? (
          <div className="st-empty">
            <span className="st-empty__icon">
              <StickyNote size={20} />
            </span>
            <h2 className="st-empty__title">No notes yet</h2>
            <p className="st-empty__desc">
              Notes you add here are kept together in one feed, newest first.
            </p>
          </div>
        ) : (
          <ul className="stn-notes-list">
            {notes.map((record) => (
              <NoteCard key={record.id} record={record} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
