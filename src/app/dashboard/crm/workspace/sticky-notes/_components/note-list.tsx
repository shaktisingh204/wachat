'use client';

/**
 * NoteList — centre pane of the notebook shell.
 *
 * Filters: search (title/preview/tag), pinned-only chip, archived toggle.
 * Add-note button creates a blank text note in the active section.
 */

import * as React from 'react';
import {
  Archive,
  CheckSquare,
  FileText,
  Image as ImageIcon,
  Mic,
  Paperclip,
  Pin,
  Plus,
  Search,
} from 'lucide-react';

import { Badge, Button, Input, ScrollArea, toast } from '@/components/sabcrm/20ui';
import { createSabnotebookNote } from '@/app/actions/sabnotebook.actions';
import type {
  SabnotebookNote,
  SabnotebookNoteKind,
} from '@/lib/rust-client/sabnotebook-notes';

interface NoteListProps {
  notebookId: string;
  sectionId: string | null;
  notes: SabnotebookNote[];
  selectedNoteId: string | null;
  onSelect: (id: string) => void;
  onChanged: () => void;
  query: string;
  onQueryChange: (q: string) => void;
  tagFilter: string | null;
  allTags: string[];
  onTagFilterChange: (t: string | null) => void;
  showArchived: boolean;
  onShowArchivedChange: (v: boolean) => void;
}

function kindIcon(kind: SabnotebookNoteKind | string): React.ReactElement {
  switch (kind) {
    case 'checklist':
      return <CheckSquare className="h-3.5 w-3.5" />;
    case 'audio':
      return <Mic className="h-3.5 w-3.5" />;
    case 'sketch':
      return <ImageIcon className="h-3.5 w-3.5" />;
    case 'file':
      return <Paperclip className="h-3.5 w-3.5" />;
    default:
      return <FileText className="h-3.5 w-3.5" />;
  }
}

export function NoteList({
  notebookId,
  sectionId,
  notes,
  selectedNoteId,
  onSelect,
  onChanged,
  query,
  onQueryChange,
  tagFilter,
  allTags,
  onTagFilterChange,
  showArchived,
  onShowArchivedChange,
}: NoteListProps) {
  const [adding, setAdding] = React.useState(false);

  const handleAdd = React.useCallback(async () => {
    if (!sectionId) {
      toast.error('Pick a section first');
      return;
    }
    setAdding(true);
    const res = await createSabnotebookNote({
      sectionId,
      notebookId,
      kind: 'text',
      title: 'Untitled',
      blocksJson: JSON.stringify({ kind: 'text', body: '' }),
      preview: '',
    });
    setAdding(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    onChanged();
    if (res.id) onSelect(res.id);
  }, [sectionId, notebookId, onChanged, onSelect]);

  // Sort: pinned first, then most recently updated.
  const sorted = React.useMemo(() => {
    return [...notes].sort((a, b) => {
      if ((a.pinned ? 1 : 0) !== (b.pinned ? 1 : 0)) {
        return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      }
      const at = a.updatedAt ?? a.createdAt ?? '';
      const bt = b.updatedAt ?? b.createdAt ?? '';
      return bt.localeCompare(at);
    });
  }, [notes]);

  return (
    <div className="flex h-full flex-col gap-2">
      <header className="flex flex-col gap-2 border-b border-[var(--st-border)] p-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--st-text-secondary)]" />
            <Input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search notes…"
              className="h-8 pl-7 text-sm"
            />
          </div>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={adding || !sectionId}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => onTagFilterChange(null)}
              className={[
                'rounded-full px-2 py-0.5 text-[11px]',
                tagFilter === null
                  ? 'bg-[var(--st-text)] text-[var(--st-bg)]'
                  : 'bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]',
              ].join(' ')}
            >
              All
            </button>
            {allTags.slice(0, 10).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() =>
                  onTagFilterChange(tagFilter === t ? null : t)
                }
                className={[
                  'rounded-full px-2 py-0.5 text-[11px]',
                  tagFilter === t
                    ? 'bg-[var(--st-text)] text-[var(--st-bg)]'
                    : 'bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]',
                ].join(' ')}
              >
                #{t}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onShowArchivedChange(!showArchived)}
              className={[
                'ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]',
                showArchived
                  ? 'bg-[var(--st-text)] text-[var(--st-bg)]'
                  : 'bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]',
              ].join(' ')}
              aria-pressed={showArchived}
            >
              <Archive className="h-3 w-3" />
              Archived
            </button>
          </div>
        )}
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <ul className="flex flex-col">
          {sorted.map((n) => {
            const active = n._id === selectedNoteId;
            return (
              <li key={n._id}>
                <button
                  type="button"
                  onClick={() => onSelect(n._id)}
                  className={[
                    'flex w-full flex-col gap-1 border-b border-[var(--st-border)] px-3 py-2 text-left',
                    active
                      ? 'bg-[var(--st-accent)] text-[var(--st-text-inverted)]'
                      : 'hover:bg-[var(--st-bg-muted)]',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-1.5">
                    {kindIcon(n.kind)}
                    <span className="truncate text-sm font-medium">
                      {n.title?.trim() || 'Untitled'}
                    </span>
                    {n.pinned && (
                      <Pin className="ml-auto h-3 w-3 text-[var(--st-text)]" />
                    )}
                  </div>
                  {n.preview && (
                    <p className="line-clamp-2 text-xs text-[var(--st-text-secondary)]">
                      {n.preview}
                    </p>
                  )}
                  {(n.tags?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {n.tags!.slice(0, 4).map((t) => (
                        <Badge
                          key={t}
                          variant="secondary"
                          className="text-[10px]"
                        >
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                </button>
              </li>
            );
          })}
          {sorted.length === 0 && (
            <li className="p-4 text-center text-sm text-[var(--st-text-secondary)]">
              {sectionId
                ? 'No notes here yet.'
                : 'Pick a section to see its notes.'}
            </li>
          )}
        </ul>
      </ScrollArea>
    </div>
  );
}
