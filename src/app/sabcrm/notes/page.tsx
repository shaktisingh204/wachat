'use client';

export const dynamic = 'force-dynamic';

/**
 * SabCRM — top-level "Notes" surface (`/sabcrm/notes`), Twenty-faithful.
 *
 * A standalone screen over the standard `notes` object, rendered in Twenty's
 * visual language (`.st-*` classes + the `@/components/sabcrm/twenty` kit + the
 * sibling `../tasks-notes.css` — NO ZoruUI / Tailwind / clay).
 *
 * Layout parity with Twenty's `NoteList` / `NoteTile`:
 *   - A responsive GRID of fixed-height note tiles (title + body preview),
 *     newest first, each linking to `/sabcrm/notes/{id}`.
 *   - A header "New note" button that opens a Twenty-style dialog (title + body)
 *     backed by `createSabcrmRecordTw`.
 *   - A toolbar search box (debounced) + live record count.
 *
 * Why `notes` records (not activities)?
 * -------------------------------------
 * `listSabcrmActivitiesTw` in the actions file is RECORD-scoped — it requires a
 * concrete `targetObject` + `recordId` — so there is no whole-project NOTE
 * activity feed to read. Per the brief we therefore list the `notes` object's
 * records via `listSabcrmRecordsTw('notes', …)`, and the composer adds a note
 * with `createSabcrmRecordTw('notes', …)`.
 *
 * Every data call is a gated server action returning an `ActionResult`; the
 * Rust engine may be DOWN, so failures degrade to inline banners / empty
 * states — the page never crashes.
 */

import * as React from 'react';
import Link from 'next/link';
import { Plus, AlertTriangle, Loader2, StickyNote, Search, X } from 'lucide-react';

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

/** The standard `notes` object slug this screen surfaces. */
const NOTES_OBJECT = 'notes';

const PAGE_LIMIT = 100;
const SEARCH_DEBOUNCE_MS = 250;

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

/** A note's body preview, only if it differs from the derived title. */
function noteBody(record: SabcrmRustRecord, title: string): string {
  const body = asText(record.data.body).trim();
  return body && body !== title ? body : '';
}

// ---------------------------------------------------------------------------
// Note tile (Twenty NoteTile parity — fixed-height card, title + preview)
// ---------------------------------------------------------------------------

function NoteTile({ record }: { record: SabcrmRustRecord }) {
  const title = noteTitle(record);
  const body = noteBody(record, title);
  return (
    <Link href={`/sabcrm/notes/${record.id}`} className="stn-note-tile">
      <div className="stn-note-tile__body">
        <div className="stn-note-tile__title">
          <StickyNote size={14} aria-hidden="true" />
          <span className="stn-note-tile__title-text">{title}</span>
        </div>
        {body ? <p className="stn-note-tile__content">{body}</p> : null}
      </div>
    </Link>
  );
}

function NotesSkeleton() {
  return (
    <div className="stn-notes-grid" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="st-skeleton" style={{ height: 180, borderRadius: 8 }} />
      ))}
    </div>
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
// Create dialog (Twenty-style — title + body)
// ---------------------------------------------------------------------------

interface CreateDialogProps {
  projectId: string | null;
  onClose: () => void;
  onCreated: () => void;
}

function CreateDialog({ projectId, onClose, onCreated }: CreateDialogProps) {
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return;

    const t = title.trim();
    const b = body.trim();
    if (!t && !b) {
      setError('Write a title or some body text first.');
      return;
    }
    setSaving(true);
    setError(null);

    // If no explicit title, derive a short one from the first body line.
    let finalTitle = t;
    if (!finalTitle && b) {
      const firstLine = b.split('\n')[0]!.trim();
      finalTitle = firstLine.length > 80 ? `${firstLine.slice(0, 80)}…` : firstLine;
    }

    const payload: Record<string, unknown> = { title: finalTitle };
    if (b) payload.body = b;

    const res = await createSabcrmRecordTw(NOTES_OBJECT, payload, projectId ?? undefined);
    setSaving(false);
    if (res.ok) {
      onCreated();
      onClose();
    } else {
      setError(res.error);
    }
  };

  return (
    <div className="st-dialog-overlay" onClick={onClose} role="presentation">
      <div
        className="st-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="New note"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div className="st-dialog__header">
            <h2 className="st-dialog__title">New note</h2>
            <button
              type="button"
              className="st-dialog__close"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          <div className="st-dialog__body">
            <div className="st-field">
              <span className="st-field__label">Title</span>
              <input
                className="st-input"
                value={title}
                autoFocus
                placeholder="Note title"
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="st-field">
              <span className="st-field__label">Body</span>
              <textarea
                className="st-textarea"
                value={body}
                rows={6}
                placeholder="Write your note…"
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  // ⌘/Ctrl + Enter submits.
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
                  }
                }}
              />
            </div>

            {error ? (
              <div className="st-banner">
                <AlertTriangle className="st-banner__icon" size={15} />
                <span>{error}</span>
              </div>
            ) : null}
          </div>

          <div className="st-dialog__footer">
            <TwentyButton variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </TwentyButton>
            <button type="submit" className="st-btn st-btn--primary" disabled={saving}>
              {saving ? <Loader2 size={14} className="st-spin" /> : null}
              Create note
            </button>
          </div>
        </form>
      </div>
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

  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [createOpen, setCreateOpen] = React.useState(false);

  // Debounce the search box so we don't hammer the engine per keystroke.
  React.useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [search]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const res = await listSabcrmRecordsTw(
        NOTES_OBJECT,
        {
          limit: PAGE_LIMIT,
          sortBy: 'createdAt',
          sortDir: 'desc',
          q: debouncedSearch || undefined,
        },
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
  }, [activeProjectId, refreshTick, debouncedSearch]);

  const refresh = React.useCallback(() => setRefreshTick((t) => t + 1), []);

  const isEmpty = !loading && notes.length === 0;
  const isSearching = debouncedSearch.length > 0;

  return (
    <div className="st-page">
      <TwentyPageHeader
        title="Notes"
        icon={StickyNote}
        actions={
          <TwentyButton variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
            New note
          </TwentyButton>
        }
      />

      <div className="st-toolbar">
        <div className="st-search">
          <Search className="st-search__icon" size={14} />
          <input
            className="st-search__input"
            type="search"
            value={search}
            placeholder="Search notes…"
            aria-label="Search notes"
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="st-toolbar__spacer" />
        {!loading ? (
          <span className="st-count">
            {notes.length} {notes.length === 1 ? 'note' : 'notes'}
          </span>
        ) : null}
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      {loading ? (
        <NotesSkeleton />
      ) : isEmpty ? (
        <div className="st-empty">
          <span className="st-empty__icon">
            <StickyNote size={20} />
          </span>
          <h2 className="st-empty__title">
            {isSearching ? 'No matching notes' : 'No notes yet'}
          </h2>
          <p className="st-empty__desc">
            {isSearching
              ? 'Try a different search term, or clear the search to see every note.'
              : 'Notes you add here are kept together, newest first. Create your first note to get started.'}
          </p>
          {!isSearching ? (
            <TwentyButton variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
              New note
            </TwentyButton>
          ) : null}
        </div>
      ) : (
        <div className="stn-notes-grid">
          {notes.map((record) => (
            <NoteTile key={record.id} record={record} />
          ))}
        </div>
      )}

      {createOpen ? (
        <CreateDialog
          projectId={activeProjectId}
          onClose={() => setCreateOpen(false)}
          onCreated={refresh}
        />
      ) : null}
    </div>
  );
}
