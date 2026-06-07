'use client';

/**
 * NotebookShell — the 3-pane notebook surface.
 *
 *   ┌──────────┬──────────────────┬─────────────────────────────┐
 *   │ Sections │ Note list        │ Note editor                 │
 *   │ (left)   │ (centre)         │ (right)                     │
 *   └──────────┴──────────────────┴─────────────────────────────┘
 *
 * Loads notes for the selected section and full text-search results when
 * the search box has a non-empty query. Selection survives navigation via
 * `?note=<id>` so deep links work.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ChevronRight } from 'lucide-react';

import { Button, EmptyState } from '@/components/sabcrm/20ui';
import {
  getSabnotebookNote,
  listSabnotebookNotes,
  listSabnotebookSections,
  searchSabnotebookNotes,
} from '@/app/actions/sabnotebook.actions';
import type { SabnotebookNotebook } from '@/lib/rust-client/sabnotebook-notebooks';
import type { SabnotebookSection } from '@/lib/rust-client/sabnotebook-sections';
import type { SabnotebookNote } from '@/lib/rust-client/sabnotebook-notes';

import { SectionList } from './section-list';
import { NoteList } from './note-list';
import { NoteEditor } from './note-editor';

const BASE = '/dashboard/crm/workspace/sticky-notes';

interface NotebookShellProps {
  notebook: SabnotebookNotebook;
  initialSections: SabnotebookSection[];
  initialNotes: SabnotebookNote[];
  initialSelectedNote: SabnotebookNote | null;
}

export function NotebookShell({
  notebook,
  initialSections,
  initialNotes,
  initialSelectedNote,
}: NotebookShellProps): React.JSX.Element {
  const router = useRouter();
  const sp = useSearchParams();

  const [sections, setSections] =
    React.useState<SabnotebookSection[]>(initialSections);
  const [selectedSectionId, setSelectedSectionId] = React.useState<
    string | null
  >(
    initialSelectedNote?.sectionId ??
      initialSections[0]?._id ??
      null,
  );
  const [notes, setNotes] = React.useState<SabnotebookNote[]>(initialNotes);
  const [selectedNote, setSelectedNote] = React.useState<SabnotebookNote | null>(
    initialSelectedNote,
  );
  const [query, setQuery] = React.useState('');
  const [tagFilter, setTagFilter] = React.useState<string | null>(null);
  const [showArchived, setShowArchived] = React.useState(false);

  // Reload notes whenever the section, query, archived toggle, or tag changes.
  const reloadNotes = React.useCallback(async () => {
    if (query.trim()) {
      const res = await searchSabnotebookNotes({
        q: query.trim(),
        notebookId: notebook._id,
        tag: tagFilter ?? undefined,
        limit: 100,
      });
      setNotes(res.items);
      return;
    }
    if (!selectedSectionId) {
      setNotes([]);
      return;
    }
    const res = await listSabnotebookNotes({
      sectionId: selectedSectionId,
      notebookId: notebook._id,
      tag: tagFilter ?? undefined,
      status: showArchived ? 'archived' : 'active',
      limit: 100,
    });
    setNotes(res.items);
  }, [notebook._id, selectedSectionId, query, tagFilter, showArchived]);

  React.useEffect(() => {
    reloadNotes();
  }, [reloadNotes]);

  const reloadSections = React.useCallback(async () => {
    const res = await listSabnotebookSections({
      notebookId: notebook._id,
      limit: 200,
      status: 'active',
    });
    setSections(res.items);
    if (selectedSectionId && !res.items.some((s) => s._id === selectedSectionId)) {
      setSelectedSectionId(res.items[0]?._id ?? null);
    }
  }, [notebook._id, selectedSectionId]);

  // When a note is selected, push it to the URL and load full data.
  const handleSelectNote = React.useCallback(
    async (id: string) => {
      const params = new URLSearchParams(sp.toString());
      params.set('note', id);
      router.replace(`${BASE}/${notebook._id}?${params.toString()}`, {
        scroll: false,
      });
      const full = await getSabnotebookNote(id);
      if (full) setSelectedNote(full);
    },
    [notebook._id, router, sp],
  );

  const handleNoteSaved = React.useCallback(
    (next: SabnotebookNote) => {
      setSelectedNote(next);
      setNotes((cur) =>
        cur.map((n) => (n._id === next._id ? { ...n, ...next } : n)),
      );
    },
    [],
  );

  const handleNoteDeleted = React.useCallback(
    (id: string) => {
      setSelectedNote(null);
      setNotes((cur) => cur.filter((n) => n._id !== id));
      const params = new URLSearchParams(sp.toString());
      params.delete('note');
      router.replace(
        `${BASE}/${notebook._id}${params.toString() ? `?${params.toString()}` : ''}`,
        { scroll: false },
      );
    },
    [notebook._id, router, sp],
  );

  const allTags = React.useMemo(() => {
    const s = new Set<string>();
    for (const n of notes) for (const t of n.tags ?? []) s.add(t);
    return Array.from(s).sort();
  }, [notes]);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <header className="flex items-center gap-2 border-b border-[var(--st-border)] px-4 py-2 text-sm">
        <Link href={BASE}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" /> Notes
          </Button>
        </Link>
        <ChevronRight className="h-3 w-3 text-[var(--st-text-secondary)]" />
        <span
          className="inline-block h-3 w-3 rounded-full"
          style={{ backgroundColor: notebook.color ?? '#6366f1' }}
          aria-hidden
        />
        <span className="font-medium">{notebook.name}</span>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[220px_320px_1fr]">
        <aside className="hidden border-r border-[var(--st-border)] md:block">
          <SectionList
            notebookId={notebook._id}
            sections={sections}
            selectedId={selectedSectionId}
            onSelect={(id) => {
              setSelectedSectionId(id);
              setQuery('');
            }}
            onChanged={reloadSections}
          />
        </aside>
        <section className="hidden border-r border-[var(--st-border)] md:block">
          <NoteList
            notebookId={notebook._id}
            sectionId={selectedSectionId}
            notes={notes}
            selectedNoteId={selectedNote?._id ?? null}
            onSelect={handleSelectNote}
            onChanged={reloadNotes}
            query={query}
            onQueryChange={setQuery}
            tagFilter={tagFilter}
            allTags={allTags}
            onTagFilterChange={setTagFilter}
            showArchived={showArchived}
            onShowArchivedChange={setShowArchived}
          />
        </section>
        <section className="min-w-0 p-4">
          {selectedNote ? (
            <NoteEditor
              key={selectedNote._id}
              note={selectedNote}
              onSaved={handleNoteSaved}
              onDeleted={handleNoteDeleted}
            />
          ) : (
            <EmptyState
              title="No note selected"
              description="Pick a note from the list, or create a new one to start writing."
            />
          )}
        </section>
      </div>
    </div>
  );
}
