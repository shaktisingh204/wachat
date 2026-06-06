'use client';

/**
 * Legacy sticky-notes board.
 *
 * This is the original sticky-notes module surface, preserved verbatim so
 * existing users keep their notes. It is rendered inline on the sticky-notes
 * hub page as the "Quick Notes" tab and reads/writes the legacy
 * `worksuite/knowledge.actions` sticky-note Mongo collection.
 *
 * Newer notebook features (sections, kind-aware notes, attachments) live in
 * the sibling `notebook-*.tsx` components and write to the
 * `sabnotebook_notebooks/sections/notes/attachments` collections via the
 * Rust crates.
 */

import * as React from 'react';
import { useDebouncedCallback } from 'use-debounce';
import {
  Clock,
  Download,
  Palette,
  Pin,
  Plus,
  StickyNote as StickyIcon,
  Trash2,
  X,
} from 'lucide-react';

import { Badge, Button, Card, Checkbox, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatCard, Textarea, useToast } from '@/components/sabcrm/20ui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { downloadCsv, downloadXlsx, type ExportRow } from '@/lib/crm-list-export';
import {
  deleteStickyNote,
  getStickyNotes,
  saveStickyNote,
  togglePinStickyNote,
} from '@/app/actions/worksuite/knowledge.actions';
import type {
  WsStickyNote,
  WsStickyNoteColour,
} from '@/lib/worksuite/knowledge-types';

const COLORS: {
  key: WsStickyNoteColour;
  bg: string;
  border: string;
  label: string;
}[] = [
  { key: 'yellow', bg: 'bg-[var(--st-bg-muted)]', border: 'border-[var(--st-border)]', label: 'Yellow' },
  { key: 'rose', bg: 'bg-[var(--st-bg-muted)]', border: 'border-[var(--st-border)]', label: 'Rose' },
  { key: 'blue', bg: 'bg-[var(--st-bg-muted)]', border: 'border-[var(--st-border)]', label: 'Blue' },
  { key: 'green', bg: 'bg-[var(--st-bg-muted)]', border: 'border-[var(--st-border)]', label: 'Green' },
];

type ColourFilter = 'all' | WsStickyNoteColour;
type PinnedFilter = 'all' | 'pinned' | 'unpinned';
type OwnerFilter = 'all' | 'mine';

const NEW_CARD = '__new__';

interface FilterState {
  search: string;
  colour: ColourFilter;
  pinned: PinnedFilter;
  owner: OwnerFilter;
}

const INITIAL: FilterState = {
  search: '',
  colour: 'all',
  pinned: 'all',
  owner: 'all',
};

function daysAgo(d: unknown): number {
  if (!d) return Infinity;
  const date = new Date(d as string | Date);
  if (!Number.isFinite(date.getTime())) return Infinity;
  return (Date.now() - date.getTime()) / (24 * 60 * 60 * 1000);
}

export function LegacyStickyBoard(): React.JSX.Element {
  const { toast } = useToast();
  const [notes, setNotes] = React.useState<(WsStickyNote & { _id: string })[]>([]);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [loading, startTransition] = React.useTransition();
  const [filters, setFilters] = React.useState<FilterState>(INITIAL);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editText, setEditText] = React.useState('');
  const [editColour, setEditColour] = React.useState<WsStickyNoteColour>('yellow');
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [bulkConfirm, setBulkConfirm] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const fetchData = React.useCallback(() => {
    startTransition(async () => {
      try {
        const r = (await getStickyNotes()) as (WsStickyNote & { _id: string })[];
        setNotes(r);
        if (r.length > 0 && !currentUserId) {
          const counts = new Map<string, number>();
          for (const n of r) {
            counts.set(
              n.belongs_to_user_id,
              (counts.get(n.belongs_to_user_id) ?? 0) + 1,
            );
          }
          let best: string | null = null;
          let bestCount = -1;
          for (const [id, c] of counts) {
            if (c > bestCount) {
              best = id;
              bestCount = c;
            }
          }
          if (best) setCurrentUserId(best);
        }
      } catch (err) {
        toast({
          title: 'Could not load notes',
          description: err instanceof Error ? err.message : 'Unknown',
          variant: 'destructive',
        });
      }
    });
  }, [toast, currentUserId]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = useDebouncedCallback(
    (v: string) => setFilters((p) => ({ ...p, search: v })),
    200,
  );

  const visible = React.useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return notes.filter((n) => {
      if (q && !(n.note_text ?? '').toLowerCase().includes(q)) return false;
      if (filters.colour !== 'all' && n.colour !== filters.colour) return false;
      if (filters.pinned === 'pinned' && !n.pinned) return false;
      if (filters.pinned === 'unpinned' && n.pinned) return false;
      if (filters.owner === 'mine' && n.belongs_to_user_id !== currentUserId) return false;
      return true;
    });
  }, [notes, filters, currentUserId]);

  const byColour = React.useMemo(() => {
    const c: Record<WsStickyNoteColour, number> = {
      yellow: 0,
      rose: 0,
      blue: 0,
      green: 0,
    };
    for (const n of notes) c[n.colour] = (c[n.colour] ?? 0) + 1;
    return c;
  }, [notes]);

  const recentCount = React.useMemo(
    () => notes.filter((n) => daysAgo(n.updatedAt ?? n.createdAt) <= 7).length,
    [notes],
  );

  const allVisibleIds = React.useMemo(() => visible.map((n) => n._id), [visible]);
  const allSelected =
    allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id));
  const someSelected = allVisibleIds.some((id) => selected.has(id));

  const toggleAll = React.useCallback(() => {
    setSelected((cur) => {
      if (allSelected) {
        const n = new Set(cur);
        for (const id of allVisibleIds) n.delete(id);
        return n;
      }
      const n = new Set(cur);
      for (const id of allVisibleIds) n.add(id);
      return n;
    });
  }, [allSelected, allVisibleIds]);

  const toggleOne = React.useCallback((id: string) => {
    setSelected((cur) => {
      const n = new Set(cur);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const startNew = React.useCallback(() => {
    setEditingId(NEW_CARD);
    setEditText('');
    setEditColour('yellow');
  }, []);

  const startEdit = React.useCallback((n: WsStickyNote & { _id: string }) => {
    setEditingId(n._id);
    setEditText(n.note_text);
    setEditColour(n.colour);
  }, []);

  const cancelEdit = React.useCallback(() => {
    setEditingId(null);
    setEditText('');
  }, []);

  const handleSave = React.useCallback(async () => {
    if (!editText.trim()) {
      cancelEdit();
      return;
    }
    const fd = new FormData();
    fd.set('note_text', editText.trim());
    fd.set('colour', editColour);
    if (editingId && editingId !== NEW_CARD) {
      fd.set('id', editingId);
    }
    const res = await saveStickyNote(null, fd);
    if (res.message) {
      cancelEdit();
      fetchData();
    } else if (res.error) {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    }
  }, [editText, editColour, editingId, fetchData, toast, cancelEdit]);

  const handleDelete = React.useCallback(async () => {
    if (!deleteId) return;
    const r = await deleteStickyNote(deleteId);
    if (r.success) {
      toast({ title: 'Deleted' });
      setSelected((cur) => {
        const n = new Set(cur);
        n.delete(deleteId);
        return n;
      });
      fetchData();
    } else {
      toast({ title: 'Error', description: r.error, variant: 'destructive' });
    }
    setDeleteId(null);
  }, [deleteId, fetchData, toast]);

  const handleBulkDelete = React.useCallback(async () => {
    const ids = Array.from(selected);
    let ok = 0;
    let fail = 0;
    for (const id of ids) {
      const r = await deleteStickyNote(id);
      if (r.success) ok += 1;
      else fail += 1;
    }
    toast({
      title: fail === 0 ? 'Deleted' : 'Partial delete',
      description: `${ok} deleted, ${fail} failed.`,
      variant: fail === 0 ? undefined : 'destructive',
    });
    setSelected(new Set());
    setBulkConfirm(false);
    fetchData();
  }, [selected, fetchData, toast]);

  const handlePin = React.useCallback(
    async (id: string) => {
      const r = await togglePinStickyNote(id);
      if (r.success) fetchData();
      else toast({ title: 'Error', description: r.error, variant: 'destructive' });
    },
    [fetchData, toast],
  );

  const buildExportRows = React.useCallback((): ExportRow[] => {
    return visible.map((n) => ({
      Text: n.note_text ?? '',
      Colour: n.colour,
      Pinned: n.pinned ? 'yes' : 'no',
      Owner: n.belongs_to_user_id,
      Updated: n.updatedAt ? new Date(n.updatedAt as string).toISOString() : '',
    }));
  }, [visible]);

  const headers = ['Text', 'Colour', 'Pinned', 'Owner', 'Updated'];
  const stamp = new Date().toISOString().slice(0, 10);
  const exportCsv = React.useCallback(
    () => downloadCsv(`sticky-notes-${stamp}.csv`, headers, buildExportRows()),
    [buildExportRows, stamp],
  );
  const exportXlsx = React.useCallback(
    () =>
      downloadXlsx(`sticky-notes-${stamp}.xlsx`, headers, buildExportRows(), 'Notes'),
    [buildExportRows, stamp],
  );

  const filtersActive =
    filters.search !== '' ||
    filters.colour !== 'all' ||
    filters.pinned !== 'all' ||
    filters.owner !== 'all';

  return (
    <div className="zoruui flex w-full flex-col gap-6">
      <EntityListShell
        title="Quick Notes"
        subtitle="Personal, colourful reminders. Click a card to edit in place."
        search={{
          value: filters.search,
          onChange: (v) => handleSearch(v),
          placeholder: 'Search notes…',
        }}
        primaryAction={
          <Button onClick={startNew}>
            <Plus className="h-4 w-4" /> New note
          </Button>
        }
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={filters.colour}
              onValueChange={(v) =>
                setFilters((p) => ({ ...p, colour: v as ColourFilter }))
              }
            >
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue placeholder="Colour" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any colour</SelectItem>
                {COLORS.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.pinned}
              onValueChange={(v) =>
                setFilters((p) => ({ ...p, pinned: v as PinnedFilter }))
              }
            >
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue placeholder="Pinned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pinned">Pinned only</SelectItem>
                <SelectItem value="unpinned">Not pinned</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.owner}
              onValueChange={(v) =>
                setFilters((p) => ({ ...p, owner: v as OwnerFilter }))
              }
            >
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue placeholder="Owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All owners</SelectItem>
                <SelectItem value="mine" disabled={!currentUserId}>
                  Mine
                </SelectItem>
              </SelectContent>
            </Select>
            {filtersActive ? (
              <Button variant="ghost" size="sm" onClick={() => setFilters(INITIAL)}>
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            ) : null}
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={toggleAll}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] px-2 py-1 text-[12px] text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
              >
                <Checkbox
                  checked={
                    allSelected
                      ? true
                      : someSelected
                        ? 'indeterminate'
                        : false
                  }
                  onCheckedChange={toggleAll}
                  aria-label="Select all visible"
                />
                <span>Select all</span>
              </button>
              <Button variant="ghost" size="sm" onClick={exportCsv}>
                <Download className="h-3.5 w-3.5" /> CSV
              </Button>
              <Button variant="ghost" size="sm" onClick={exportXlsx}>
                <Download className="h-3.5 w-3.5" /> XLSX
              </Button>
            </div>
          </div>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-[var(--st-text)]">
                {selected.size} selected
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected(new Set())}
                >
                  Clear
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setBulkConfirm(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </div>
          ) : null
        }
        empty={
          !loading && notes.length === 0 && editingId === null ? (
            <div className="flex flex-col items-center gap-2 p-4">
              <StickyIcon className="h-6 w-6 text-[var(--st-text-secondary)]" />
              <p className="text-sm text-[var(--st-text-secondary)]">
                No sticky notes yet — jot one down with the +&nbsp;New&nbsp;note
                button above.
              </p>
            </div>
          ) : null
        }
        loading={loading && notes.length === 0}
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Total"
              value={notes.length}
              icon={<StickyIcon className="h-4 w-4" />}
            />
            <StatCard
              label="Pinned"
              value={notes.filter((n) => n.pinned).length}
              icon={<Pin className="h-4 w-4" />}
            />
            <StatCard
              label="By colour"
              value={`${byColour.yellow} · ${byColour.rose} · ${byColour.blue} · ${byColour.green}`}
              icon={<Palette className="h-4 w-4" />}
            />
            <StatCard
              label="Updated (7d)"
              value={recentCount}
              icon={<Clock className="h-4 w-4" />}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {editingId === NEW_CARD ? (
              <NoteEditorCard
                text={editText}
                onTextChange={setEditText}
                colour={editColour}
                onColourChange={setEditColour}
                onSave={handleSave}
                onCancel={cancelEdit}
              />
            ) : null}

            {visible.map((n) => {
              const meta = COLORS.find((x) => x.key === n.colour) ?? COLORS[0];
              if (editingId === n._id) {
                return (
                  <NoteEditorCard
                    key={n._id}
                    text={editText}
                    onTextChange={setEditText}
                    colour={editColour}
                    onColourChange={setEditColour}
                    onSave={handleSave}
                    onCancel={cancelEdit}
                  />
                );
              }
              const isSelected = selected.has(n._id);
              return (
                <Card
                  key={n._id}
                  className={`flex flex-col gap-2 shadow-md ${meta.bg} ${meta.border} ${
                    isSelected ? 'ring-2 ring-[var(--st-text)]' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleOne(n._id)}
                        aria-label="Select note"
                      />
                      {n.pinned ? (
                        <Badge variant="warning">
                          <Pin className="h-3 w-3" /> Pinned
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex gap-0.5">
                      <button
                        type="button"
                        onClick={() => handlePin(n._id)}
                        className="rounded p-1 text-[var(--st-text-secondary)] hover:bg-white/40"
                        aria-label="Toggle pin"
                      >
                        <Pin className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(n)}
                        className="rounded p-1 text-[var(--st-text-secondary)] hover:bg-white/40"
                        aria-label="Edit"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteId(n._id)}
                        className="rounded p-1 text-[var(--st-text-secondary)] hover:bg-white/40"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p
                    className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-[var(--st-text)]"
                    onDoubleClick={() => startEdit(n)}
                  >
                    {n.note_text}
                  </p>
                </Card>
              );
            })}
          </div>
        </div>
      </EntityListShell>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete this note?"
        description="The sticky note will be permanently removed."
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={bulkConfirm}
        onOpenChange={setBulkConfirm}
        title={`Delete ${selected.size} notes?`}
        description="The selected sticky notes will be permanently removed."
        requireTyped="DELETE"
        confirmLabel="Delete all"
        onConfirm={handleBulkDelete}
      />
    </div>
  );
}

function NoteEditorCard({
  text,
  onTextChange,
  colour,
  onColourChange,
  onSave,
  onCancel,
}: {
  text: string;
  onTextChange: (v: string) => void;
  colour: WsStickyNoteColour;
  onColourChange: (c: WsStickyNoteColour) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const meta = COLORS.find((x) => x.key === colour) ?? COLORS[0];
  return (
    <Card className={`flex flex-col gap-2 shadow-md ${meta.bg} ${meta.border}`}>
      <Textarea
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        rows={4}
        placeholder="Write a sticky note…"
        className="bg-white/60"
      />
      <div className="flex flex-wrap items-center gap-1">
        {COLORS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => onColourChange(c.key)}
            aria-label={c.label}
            className={[
              'h-5 w-5 rounded-full border-2 transition',
              c.bg,
              colour === c.key ? 'border-[var(--st-text)]' : c.border,
            ].join(' ')}
          />
        ))}
        <div className="ml-auto flex gap-1">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSave} disabled={!text.trim()}>
            Save
          </Button>
        </div>
      </div>
    </Card>
  );
}
