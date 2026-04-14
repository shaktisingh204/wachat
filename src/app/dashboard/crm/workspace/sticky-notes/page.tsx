'use client';

import * as React from 'react';
import { StickyNote, Plus, Pin, Trash2, LoaderCircle } from 'lucide-react';

import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  getStickyNotes,
  saveStickyNote,
  deleteStickyNote,
  togglePinStickyNote,
} from '@/app/actions/worksuite/knowledge.actions';
import type {
  WsStickyNote,
  WsStickyNoteColour,
} from '@/lib/worksuite/knowledge-types';

const COLORS: { key: WsStickyNoteColour; bg: string; border: string; label: string }[] = [
  { key: 'yellow', bg: 'bg-amber-100', border: 'border-amber-300', label: 'Yellow' },
  { key: 'rose', bg: 'bg-rose-100', border: 'border-rose-300', label: 'Rose' },
  { key: 'blue', bg: 'bg-sky-100', border: 'border-sky-300', label: 'Blue' },
  { key: 'green', bg: 'bg-emerald-100', border: 'border-emerald-300', label: 'Green' },
];

export default function StickyNotesPage() {
  const { toast } = useToast();
  const [notes, setNotes] = React.useState<(WsStickyNote & { _id: string })[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [text, setText] = React.useState('');
  const [colour, setColour] = React.useState<WsStickyNoteColour>('yellow');
  const [submitting, setSubmitting] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await getStickyNotes();
      setNotes(r as any);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    const fd = new FormData();
    fd.set('note_text', text.trim());
    fd.set('colour', colour);
    const res = await saveStickyNote(null, fd);
    setSubmitting(false);
    if (res.message) {
      setText('');
      refresh();
    } else if (res.error) {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    const r = await deleteStickyNote(id);
    if (r.success) refresh();
    else toast({ title: 'Error', description: r.error, variant: 'destructive' });
  };

  const handlePin = async (id: string) => {
    const r = await togglePinStickyNote(id);
    if (r.success) refresh();
  };

  const colourMeta = (c?: string) => COLORS.find((x) => x.key === c) || COLORS[0];

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Sticky Notes"
        subtitle="Personal, colorful reminders."
        icon={StickyNote}
      />

      <ClayCard>
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a sticky note…"
            rows={3}
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-clay-ink-muted">Colour:</span>
            {COLORS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setColour(c.key)}
                aria-label={c.label}
                className={
                  'h-6 w-6 rounded-full border-2 transition ' +
                  c.bg +
                  ' ' +
                  (colour === c.key ? 'border-clay-ink' : c.border)
                }
              />
            ))}
            <div className="ml-auto">
              <ClayButton
                type="submit"
                variant="obsidian"
                disabled={submitting || !text.trim()}
                leading={
                  submitting ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" strokeWidth={1.75} />
                  )
                }
              >
                Add note
              </ClayButton>
            </div>
          </div>
        </form>
      </ClayCard>

      {loading ? (
        <ClayCard className="flex items-center justify-center py-10">
          <LoaderCircle className="h-5 w-5 animate-spin text-clay-ink-muted" />
        </ClayCard>
      ) : notes.length === 0 ? (
        <ClayCard>
          <p className="text-center text-[13px] text-clay-ink-muted">
            No sticky notes yet — jot one down above.
          </p>
        </ClayCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {notes.map((n, i) => {
            const meta = colourMeta(n.colour);
            const rotate = i % 2 === 0 ? 'rotate-1' : '-rotate-1';
            return (
              <ClayCard
                key={n._id}
                className={
                  'flex flex-col gap-2 shadow-clay-float transform ' +
                  rotate +
                  ' ' +
                  meta.bg +
                  ' ' +
                  meta.border
                }
              >
                <div className="flex items-start justify-between">
                  {n.pinned ? (
                    <ClayBadge tone="rose-soft">
                      <Pin className="h-3 w-3" /> Pinned
                    </ClayBadge>
                  ) : (
                    <span />
                  )}
                  <div className="flex gap-0.5">
                    <button
                      type="button"
                      onClick={() => handlePin(n._id)}
                      className="rounded p-1 text-clay-ink-muted hover:bg-white/40"
                      aria-label="Toggle pin"
                    >
                      <Pin className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(n._id)}
                      className="rounded p-1 text-clay-ink-muted hover:bg-white/40"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-clay-ink">
                  {n.note_text}
                </p>
              </ClayCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
