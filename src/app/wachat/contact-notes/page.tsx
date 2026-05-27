'use client';

import { fmtDate } from '@/lib/utils';

import {
  useZoruToast,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  Input,
  Label,
  Textarea,
} from '@/components/zoruui';
import {
  useState,
  useTransition,
  useCallback,
  useActionState,
} from 'react';
import { Search, Loader2, StickyNote, Trash2, Plus } from 'lucide-react';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';

import { useProject } from '@/context/project-context';
import {
  getContactNotes,
  addContactNote,
  deleteContactNote,
} from '@/app/actions/wachat-features.actions';

import {
  WaPage,
  PageHeader,
  WaButton,
  Section,
  EmptyState,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

import * as React from 'react';

export default function ContactNotesPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();
  const reduceMotion = useReducedMotion();

  const [contactId, setContactId] = useState('');
  const [notes, setNotes] = useState<any[]>([]);
  const [isSearching, startSearching] = useTransition();
  const [hasSearched, setHasSearched] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formState, formAction, isPending] = useActionState(addContactNote, null);

  const fetchNotes = useCallback(
    (cid: string) => {
      startSearching(async () => {
        setHasSearched(true);
        const res = await getContactNotes(cid);
        if (res.error) {
          toast({ title: 'Error', description: res.error, variant: 'destructive' });
          setNotes([]);
        } else {
          setNotes(res.notes || []);
        }
      });
    },
    [toast],
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (contactId.trim()) fetchNotes(contactId.trim());
  };

  React.useEffect(() => {
    if (formState?.message) {
      toast({ title: 'Success', description: formState.message });
      if (contactId.trim()) fetchNotes(contactId.trim());
    }
    if (formState?.error) {
      toast({ title: 'Error', description: formState.error, variant: 'destructive' });
    }
  }, [formState, toast, contactId, fetchNotes]);

  const handleDelete = async (noteId: string) => {
    setDeletingId(noteId);
    const res = await deleteContactNote(noteId);
    setDeletingId(null);
    if (res.error) {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    } else {
      setNotes((prev) => prev.filter((n) => n._id !== noteId));
      toast({ title: 'Deleted', description: 'Note removed.' });
    }
  };

  const stagger = reduceMotion ? 0 : 0.04;

  return (
    <WaPage>
      <PageHeader
        title="Contact notes"
        description="Look up a contact by ID or phone number and manage private notes."
        kicker="Wachat · contacts"
        backHref="/wachat/contacts"
      />

      {/* Search */}
      <Section title="Look up contact" className="mb-6">
        <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[260px] flex-1 flex-col gap-1.5">
            <Label htmlFor="cn-contact">Contact ID or phone number</Label>
            <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 focus-within:border-zinc-400">
              <Search className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} aria-hidden />
              <Input
                id="cn-contact"
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                placeholder="Contact ID or phone number"
                required
                className="h-7 border-0 bg-transparent px-0 text-[13px] shadow-none focus-visible:ring-0"
              />
            </div>
          </div>
          <WaButton type="submit" disabled={isSearching || !contactId.trim()} leftIcon={isSearching ? Loader2 : Search}>
            {isSearching ? 'Searching...' : 'Search'}
          </WaButton>
        </form>
      </Section>

      {hasSearched && (
        <Section
          title={`Notes for ${contactId}`}
          description={`${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`}
          padded={false}
        >
          {isSearching ? (
            <div className="divide-y divide-zinc-100">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-5 py-3">
                  <div className="h-3 w-64 animate-pulse rounded-full bg-zinc-100" />
                  <div className="mt-2 h-2.5 w-32 animate-pulse rounded-full bg-zinc-100" />
                </div>
              ))}
            </div>
          ) : notes.length === 0 ? (
            <div className="px-5 py-12">
              <EmptyState icon={StickyNote} title="No notes yet" description="Add your first note below." />
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              <AnimatePresence initial={false}>
                {notes.map((note, i) => (
                  <m.li
                    key={note._id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.25, delay: i * stagger, ease: EASE_OUT }}
                    className="flex items-start gap-3 px-5 py-3.5"
                  >
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-600">
                      <StickyNote className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-900">{note.text}</p>
                      <p className="mt-1.5 text-[11px] text-zinc-500 tabular-nums">{fmtDate(note.createdAt)}</p>
                    </div>
                    <ZoruAlertDialog>
                      <ZoruAlertDialogTrigger asChild>
                        <button
                          type="button"
                          disabled={deletingId === note._id}
                          aria-label="Delete note"
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600 active:scale-[0.97]"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                        </button>
                      </ZoruAlertDialogTrigger>
                      <ZoruAlertDialogContent>
                        <ZoruAlertDialogHeader>
                          <ZoruAlertDialogTitle>Delete note?</ZoruAlertDialogTitle>
                          <ZoruAlertDialogDescription>This note will be permanently removed.</ZoruAlertDialogDescription>
                        </ZoruAlertDialogHeader>
                        <ZoruAlertDialogFooter>
                          <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                          <ZoruAlertDialogAction destructive onClick={() => handleDelete(note._id)}>
                            Delete
                          </ZoruAlertDialogAction>
                        </ZoruAlertDialogFooter>
                      </ZoruAlertDialogContent>
                    </ZoruAlertDialog>
                  </m.li>
                ))}
              </AnimatePresence>
            </ul>
          )}

          <div className="border-t border-zinc-100 bg-zinc-50/40 px-5 py-4">
            <h3 className="mb-2.5 text-[12.5px] font-semibold text-zinc-900">Add a note</h3>
            <form action={formAction} className="flex max-w-lg flex-col gap-3">
              <input type="hidden" name="contactId" value={contactId} />
              <input type="hidden" name="projectId" value={projectId || ''} />
              <Textarea name="text" placeholder="Write a note..." rows={3} required />
              <div>
                <WaButton type="submit" disabled={isPending} leftIcon={isPending ? Loader2 : Plus}>
                  {isPending ? 'Adding...' : 'Add note'}
                </WaButton>
              </div>
            </form>
          </div>
        </Section>
      )}
    </WaPage>
  );
}
