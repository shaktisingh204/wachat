'use client';

/**
 * SectionList — left pane of the notebook shell.
 *
 * Lists the notebook's sections; the selected section drives the centre
 * NoteList. Add-section input lives at the bottom.
 */

import * as React from 'react';
import { Hash, Plus, Trash2 } from 'lucide-react';

import {
  Button,
  Input,
  ScrollArea,
  zoruSonnerToast,
} from '@/components/zoruui';
import {
  createSabnotebookSection,
  deleteSabnotebookSection,
} from '@/app/actions/sabnotebook.actions';
import type { SabnotebookSection } from '@/lib/rust-client/sabnotebook-sections';

interface SectionListProps {
  notebookId: string;
  sections: SabnotebookSection[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChanged: () => void;
}

export function SectionList({
  notebookId,
  sections,
  selectedId,
  onSelect,
  onChanged,
}: SectionListProps) {
  const [draft, setDraft] = React.useState('');
  const [adding, setAdding] = React.useState(false);

  const handleAdd = React.useCallback(async () => {
    const name = draft.trim();
    if (!name) return;
    setAdding(true);
    const res = await createSabnotebookSection({
      notebookId,
      name,
      order: sections.length,
    });
    setAdding(false);
    if (res.error) {
      zoruSonnerToast.error(res.error);
      return;
    }
    setDraft('');
    onChanged();
    if (res.id) onSelect(res.id);
  }, [draft, notebookId, sections.length, onChanged, onSelect]);

  const handleDelete = React.useCallback(
    async (id: string) => {
      if (!confirm('Delete this section and all its notes?')) return;
      const res = await deleteSabnotebookSection(id, notebookId);
      if (res.error) {
        zoruSonnerToast.error(res.error);
        return;
      }
      onChanged();
    },
    [notebookId, onChanged],
  );

  return (
    <div className="flex h-full flex-col gap-2">
      <header className="px-2 pt-2 text-xs font-semibold uppercase tracking-wide text-[var(--zoru-muted-foreground)]">
        Sections
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <ul className="flex flex-col gap-0.5 px-1">
          {sections.map((s) => {
            const active = s._id === selectedId;
            return (
              <li key={s._id}>
                <button
                  type="button"
                  onClick={() => onSelect(s._id)}
                  className={[
                    'group flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                    active
                      ? 'bg-[var(--zoru-accent)] text-[var(--zoru-accent-foreground)]'
                      : 'hover:bg-[var(--zoru-muted)]',
                  ].join(' ')}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Hash className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    <span className="truncate">{s.name}</span>
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(s._id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        handleDelete(s._id);
                      }
                    }}
                    className="invisible rounded p-1 hover:bg-[var(--zoru-muted)] group-hover:visible"
                    aria-label={`Delete section ${s.name}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </span>
                </button>
              </li>
            );
          })}
          {sections.length === 0 && (
            <li className="px-2 py-1.5 text-sm text-[var(--zoru-muted-foreground)]">
              No sections yet.
            </li>
          )}
        </ul>
      </ScrollArea>
      <div className="flex items-center gap-1 border-t border-[var(--zoru-border)] p-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="New section…"
          className="h-8 text-sm"
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={handleAdd}
          disabled={adding || !draft.trim()}
          aria-label="Add section"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
