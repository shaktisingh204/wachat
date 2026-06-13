'use client';

export const dynamic = 'force-dynamic';

/**
 * SabCRM — top-level "Notes" surface (`/sabcrm/notes`), 20ui.
 *
 * A standalone screen over the standard `notes` object, rendered on the 20ui
 * design system (`@/components/sabcrm/20ui` + the page-local `./notes.css`,
 * scoped to the 20ui root).
 *
 * Layout parity with Twenty's `NoteList` / `NoteTile`:
 *   - A responsive GRID of fixed-height note tiles (title + body preview),
 *     newest first, each linking to `/sabcrm/notes/{id}`.
 *   - A header "New note" button that opens a dialog (title + body) backed by
 *     `createSabcrmRecordTw`.
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
import { Plus, StickyNote } from 'lucide-react';

import {
  Modal,
  Field,
  Input,
  Button,
  Alert,
  EmptyState,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Skeleton,
  SearchInput,
} from '@/components/sabcrm/20ui';
// Editor composite — imported by its direct path on purpose (NOT through the
// 20ui barrel index; barrel self-cycle gotcha).
import {
  RichTextEditor,
  isRichTextEmpty,
  plainTextOfBody,
} from '@/components/sabcrm/20ui/composites/editor/rich-text';
import { RecordRelationPicker } from '@/components/sabcrm/pickers/record-relation-picker';
import { useProject } from '@/context/project-context';
import {
  listSabcrmRecordsTw,
  createSabcrmRecordTw,
} from '@/app/actions/sabcrm-twenty.actions';
import type { SabcrmRustRecord } from '@/app/actions/sabcrm-twenty.actions.types';

import '@/components/sabcrm/20ui/surface-crm-base.css';
import './notes.css';

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
  // Bodies may be sanitized rich-text HTML (RichTextEditor) — strip to plain
  // text before deriving a one-line title.
  const body = plainTextOfBody(asText(record.data.body)).trim();
  if (body) {
    const firstLine = body.split('\n')[0]!.trim();
    return firstLine.length > 80 ? `${firstLine.slice(0, 80)}…` : firstLine;
  }
  return 'Untitled note';
}

/** A note's plain-text body preview, only if it differs from the derived title. */
function noteBody(record: SabcrmRustRecord, title: string): string {
  // HTML bodies must never render as raw markup text — project to plain text.
  const body = plainTextOfBody(asText(record.data.body)).trim();
  return body && body !== title ? body : '';
}

// ---------------------------------------------------------------------------
// Note tile (Twenty NoteTile parity — fixed-height card, title + preview)
// ---------------------------------------------------------------------------

function NoteTile({ record }: { record: SabcrmRustRecord }) {
  const title = noteTitle(record);
  const body = noteBody(record, title);
  return (
    <Link href={`/sabcrm/notes/${record.id}`} className="nts-tile">
      <div className="nts-tile__body">
        <div className="nts-tile__title">
          <StickyNote size={14} aria-hidden="true" />
          <span className="nts-tile__title-text">{title}</span>
        </div>
        {body ? <p className="nts-tile__content">{body}</p> : null}
      </div>
    </Link>
  );
}

function NotesSkeleton() {
  return (
    <div className="nts-grid" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} height={180} radius={8} />
      ))}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return <Alert tone="danger">{message}</Alert>;
}

// ---------------------------------------------------------------------------
// Create dialog (title + body)
// ---------------------------------------------------------------------------

interface CreateDialogProps {
  projectId: string | null;
  onClose: () => void;
  onCreated: () => void;
}

/** A picked relation record (id + cached label for closed-state display). */
interface RelationRef {
  id: string;
  label: string;
}

function CreateDialog({ projectId, onClose, onCreated }: CreateDialogProps) {
  const [title, setTitle] = React.useState('');
  // Sanitized rich-text HTML from the editor composite.
  const [body, setBody] = React.useState('');
  const [person, setPerson] = React.useState<RelationRef | null>(null);
  const [company, setCompany] = React.useState<RelationRef | null>(null);
  const [lead, setLead] = React.useState<RelationRef | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const formId = React.useId();
  const formRef = React.useRef<HTMLFormElement | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return;

    const t = title.trim();
    const b = isRichTextEmpty(body) ? '' : body.trim();
    if (!t && !b) {
      setError('Write a title or some body text first.');
      return;
    }
    setSaving(true);
    setError(null);

    // If no explicit title, derive a short one from the first PLAIN-text
    // body line (the stored body is sanitized HTML).
    let finalTitle = t;
    if (!finalTitle && b) {
      const firstLine = plainTextOfBody(b).split('\n')[0]!.trim();
      finalTitle = firstLine.length > 80 ? `${firstLine.slice(0, 80)}…` : firstLine;
    }

    const payload: Record<string, unknown> = { title: finalTitle };
    if (b) payload.body = b;
    // Link the note to its target records (people / companies / leads).
    if (person) payload.targetPeople = person.id;
    if (company) payload.targetCompanies = company.id;
    if (lead) payload.targetOpportunities = lead.id;

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
    <Modal
      open
      onClose={onClose}
      title="New note"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={saving}>
            Create note
          </Button>
        </>
      }
    >
      <form id={formId} ref={formRef} onSubmit={handleSubmit} className="nts-form">
        <Field label="Title">
          <Input
            value={title}
            autoFocus
            placeholder="Note title"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              // Cmd/Ctrl + Enter submits.
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
        </Field>

        <Field label="Body">
          <RichTextEditor
            value={body}
            onChange={setBody}
            // The editor submits the parent on ⌘/Ctrl+Enter.
            onSubmit={() => formRef.current?.requestSubmit()}
            placeholder="Write your note…"
            ariaLabel="Note body"
            disabled={saving}
          />
        </Field>

        <div className="nts-relations">
          <Field label="Contact">
            <RecordRelationPicker
              object="people"
              value={person?.id ?? null}
              valueLabel={person?.label ?? null}
              projectId={projectId}
              placeholder="Link a person…"
              aria-label="Related contact"
              onChange={(opt) => setPerson(opt ? { id: opt.id, label: opt.label } : null)}
            />
          </Field>

          <Field label="Company">
            <RecordRelationPicker
              object="companies"
              value={company?.id ?? null}
              valueLabel={company?.label ?? null}
              projectId={projectId}
              placeholder="Link a company…"
              aria-label="Related company"
              onChange={(opt) => setCompany(opt ? { id: opt.id, label: opt.label } : null)}
            />
          </Field>

          <Field label="Deal / lead">
            <RecordRelationPicker
              object="leads"
              value={lead?.id ?? null}
              valueLabel={lead?.label ?? null}
              projectId={projectId}
              placeholder="Link a deal…"
              aria-label="Related deal or lead"
              onChange={(opt) => setLead(opt ? { id: opt.id, label: opt.label } : null)}
            />
          </Field>
        </div>

        {error ? <Alert tone="danger">{error}</Alert> : null}
      </form>
    </Modal>
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
    <div className="nts-page">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Notes</PageTitle>
          <PageDescription>
            Notes you add here are kept together, newest first.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={() => setCreateOpen(true)}>
            New note
          </Button>
        </PageActions>
      </PageHeader>

      <div className="nts-toolbar">
        <SearchInput
          value={search}
          placeholder="Search notes…"
          aria-label="Search notes"
          onValueChange={setSearch}
        />
        {!loading ? (
          <span className="nts-count">
            {notes.length} {notes.length === 1 ? 'note' : 'notes'}
          </span>
        ) : null}
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      {loading ? (
        <NotesSkeleton />
      ) : isEmpty ? (
        <EmptyState
          icon={StickyNote}
          title={isSearching ? 'No matching notes' : 'No notes yet'}
          description={
            isSearching
              ? 'Try a different search term, or clear the search to see every note.'
              : 'Notes you add here are kept together, newest first. Create your first note to get started.'
          }
          action={
            !isSearching ? (
              <Button
                variant="primary"
                iconLeft={Plus}
                onClick={() => setCreateOpen(true)}
              >
                New note
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="nts-grid">
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
