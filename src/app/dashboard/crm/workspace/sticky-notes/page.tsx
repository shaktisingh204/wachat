'use client';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruStatCard,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  Pin,
  Plus,
  StickyNote as StickyIcon,
  Trash2 } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';

/**
 * Sticky Notes — card-grid view (§1D.1, no detail page).
 *
 * Inline create via a "+" button → blank card in edit mode. Inline edit
 * on each card (textarea + colour swatches + pin toggle). Delete with
 * dialog.
 *
 * KPI strip: Total · Pinned · By colour. Filter chips: colour, pinned.
 */

import * as React from 'react';

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
    { key: 'yellow', bg: 'bg-amber-100', border: 'border-amber-300', label: 'Yellow' },
    { key: 'rose', bg: 'bg-rose-100', border: 'border-rose-300', label: 'Rose' },
    { key: 'blue', bg: 'bg-sky-100', border: 'border-sky-300', label: 'Blue' },
    { key: 'green', bg: 'bg-emerald-100', border: 'border-emerald-300', label: 'Green' },
];

type ColourFilter = 'all' | WsStickyNoteColour;
type PinnedFilter = 'all' | 'pinned' | 'unpinned';

const NEW_CARD = '__new__';

export default function StickyNotesPage() {
    const { toast } = useZoruToast();
    const [notes, setNotes] = React.useState<(WsStickyNote & { _id: string })[]>([]);
    const [loading, startTransition] = React.useTransition();
    const [colourFilter, setColourFilter] = React.useState<ColourFilter>('all');
    const [pinnedFilter, setPinnedFilter] = React.useState<PinnedFilter>('all');
    const [editingId, setEditingId] = React.useState<string | null>(null);
    const [editText, setEditText] = React.useState('');
    const [editColour, setEditColour] = React.useState<WsStickyNoteColour>('yellow');
    const [deleteId, setDeleteId] = React.useState<string | null>(null);

    const fetchData = React.useCallback(() => {
        startTransition(async () => {
            const r = (await getStickyNotes()) as (WsStickyNote & { _id: string })[];
            setNotes(r);
        });
    }, []);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const visible = React.useMemo(() => {
        return notes.filter((n) => {
            if (colourFilter !== 'all' && n.colour !== colourFilter) return false;
            if (pinnedFilter === 'pinned' && !n.pinned) return false;
            if (pinnedFilter === 'unpinned' && n.pinned) return false;
            return true;
        });
    }, [notes, colourFilter, pinnedFilter]);

    const byColour = React.useMemo(() => {
        const c = { yellow: 0, rose: 0, blue: 0, green: 0 } as Record<WsStickyNoteColour, number>;
        for (const n of notes) c[n.colour] = (c[n.colour] ?? 0) + 1;
        return c;
    }, [notes]);

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
            fetchData();
        } else {
            toast({ title: 'Error', description: r.error, variant: 'destructive' });
        }
        setDeleteId(null);
    }, [deleteId, fetchData, toast]);

    const handlePin = React.useCallback(
        async (id: string) => {
            const r = await togglePinStickyNote(id);
            if (r.success) fetchData();
            else toast({ title: 'Error', description: r.error, variant: 'destructive' });
        },
        [fetchData, toast],
    );

    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <EntityListShell
                title="Sticky notes"
                subtitle="Personal, colourful reminders. Click a card to edit in place."
                primaryAction={
                    <ZoruButton onClick={startNew}>
                        <Plus className="h-4 w-4" /> New note
                    </ZoruButton>
                }
                filters={
                    <div className="flex flex-wrap items-center gap-2">
                        <ZoruSelect
                            value={colourFilter}
                            onValueChange={(v) => setColourFilter(v as ColourFilter)}
                        >
                            <ZoruSelectTrigger className="h-9 w-[140px]">
                                <ZoruSelectValue placeholder="Colour" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="all">Any colour</ZoruSelectItem>
                                {COLORS.map((c) => (
                                    <ZoruSelectItem key={c.key} value={c.key}>
                                        {c.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                        <ZoruSelect
                            value={pinnedFilter}
                            onValueChange={(v) => setPinnedFilter(v as PinnedFilter)}
                        >
                            <ZoruSelectTrigger className="h-9 w-[140px]">
                                <ZoruSelectValue placeholder="Pinned" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="all">All</ZoruSelectItem>
                                <ZoruSelectItem value="pinned">Pinned only</ZoruSelectItem>
                                <ZoruSelectItem value="unpinned">Not pinned</ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                }
                empty={
                    !loading && notes.length === 0 && editingId === null ? (
                        <div className="flex flex-col items-center gap-2 p-4">
                            <StickyIcon className="h-6 w-6 text-zoru-ink-muted" />
                            <p className="text-sm text-zoru-ink-muted">
                                No sticky notes yet — jot one down with the +&nbsp;New&nbsp;note
                                button above.
                            </p>
                        </div>
                    ) : null
                }
                loading={loading && notes.length === 0}
            >
                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <ZoruStatCard
                            label="Total"
                            value={notes.length}
                            icon={<StickyIcon className="h-4 w-4" />}
                        />
                        <ZoruStatCard
                            label="Pinned"
                            value={notes.filter((n) => n.pinned).length}
                            icon={<Pin className="h-4 w-4" />}
                        />
                        <ZoruStatCard
                            label="By colour"
                            value={`${byColour.yellow} · ${byColour.rose} · ${byColour.blue} · ${byColour.green}`}
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
                            return (
                                <ZoruCard
                                    key={n._id}
                                    className={`flex flex-col gap-2 shadow-md ${meta.bg} ${meta.border}`}
                                >
                                    <div className="flex items-start justify-between">
                                        {n.pinned ? (
                                            <ZoruBadge variant="warning">
                                                <Pin className="h-3 w-3" /> Pinned
                                            </ZoruBadge>
                                        ) : (
                                            <span />
                                        )}
                                        <div className="flex gap-0.5">
                                            <button
                                                type="button"
                                                onClick={() => handlePin(n._id)}
                                                className="rounded p-1 text-zoru-ink-muted hover:bg-white/40"
                                                aria-label="Toggle pin"
                                            >
                                                <Pin className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => startEdit(n)}
                                                className="rounded p-1 text-zoru-ink-muted hover:bg-white/40"
                                                aria-label="Edit"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDeleteId(n._id)}
                                                className="rounded p-1 text-zoru-ink-muted hover:bg-white/40"
                                                aria-label="Delete"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                    <p
                                        className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-zoru-ink"
                                        onDoubleClick={() => startEdit(n)}
                                    >
                                        {n.note_text}
                                    </p>
                                </ZoruCard>
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
        <ZoruCard className={`flex flex-col gap-2 shadow-md ${meta.bg} ${meta.border}`}>
            <ZoruTextarea
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
                            colour === c.key ? 'border-zoru-ink' : c.border,
                        ].join(' ')}
                    />
                ))}
                <div className="ml-auto flex gap-1">
                    <ZoruButton variant="ghost" size="sm" onClick={onCancel}>
                        Cancel
                    </ZoruButton>
                    <ZoruButton size="sm" onClick={onSave} disabled={!text.trim()}>
                        Save
                    </ZoruButton>
                </div>
            </div>
        </ZoruCard>
    );
}
