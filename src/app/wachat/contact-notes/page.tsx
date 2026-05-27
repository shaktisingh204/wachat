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
  cn,
} from '@/components/zoruui';
import {
  useState,
  useTransition,
  useCallback,
  useActionState,
  useEffect,
  useMemo,
} from 'react';
import {
  Search,
  Loader2,
  StickyNote,
  Trash2,
  Plus,
  Pin,
  Star,
  User,
  Hash,
} from 'lucide-react';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';

import { useProject } from '@/context/project-context';
import {
  getContactNotes,
  addContactNote,
  deleteContactNote,
} from '@/app/actions/wachat-features.actions';
import { getContactsPageData } from '@/app/actions/contact.actions';

import {
  WaPage,
  PageHeader,
  WaButton,
  Section,
  EmptyState,
  StatusPill,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

import * as React from 'react';

const WA_GREEN = '#25D366';

function monogram(name: string | undefined | null): string {
  const s = (name || '').trim();
  if (!s) return '??';
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

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
  const [recentContacts, setRecentContacts] = useState<any[]>([]);

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

  // Load recent contacts for side rail
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const data = await getContactsPageData(projectId, undefined, 1, '', []);
        setRecentContacts((data.contacts || []).slice(0, 8));
      } catch {
        // best-effort only
      }
    })();
  }, [projectId]);

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

  const stats = useMemo(() => {
    const pinned = notes.filter((n) => n.isPinned || n.pinned).length;
    const starred = notes.filter((n) => n.isStarred || n.starred).length;
    return { total: notes.length, pinned, starred };
  }, [notes]);

  const stagger = reduceMotion ? 0 : 0.03;

  return (
    <WaPage>
      <PageHeader
        title="Contact notes"
        description="Look up a contact by ID or phone number and manage private notes."
        kicker="Wachat · contacts"
        backHref="/wachat/contacts"
      />

      {/* Search */}
      <Section title="Look up contact" className="mb-4">
        <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[260px] flex-1 flex-col gap-1.5">
            <Label htmlFor="cn-contact">Contact ID or phone number</Label>
            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 focus-within:border-zinc-400">
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

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-4">
          {hasSearched && (
            <Section
              title={`Notes for ${contactId}`}
              description={`${stats.total} ${stats.total === 1 ? 'note' : 'notes'} · ${stats.pinned} pinned · ${stats.starred} starred`}
              padded={false}
            >
              {isSearching ? (
                <div className="divide-y divide-zinc-100">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="px-4 py-3">
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
                    {notes.map((note, i) => {
                      const isPinned = note.isPinned || note.pinned;
                      const isStarred = note.isStarred || note.starred;
                      const tags = Array.isArray(note.tags) ? note.tags : [];
                      const author = note.authorName || note.createdBy || note.userEmail || 'system';
                      return (
                        <m.li
                          key={note._id}
                          initial={{ opacity: 0, y: 3 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -6 }}
                          transition={{ duration: 0.22, delay: i * stagger, ease: EASE_OUT }}
                          className={cn(
                            'flex items-start gap-3 px-4 py-3 transition-colors hover:bg-zinc-50/70',
                            isPinned && 'bg-amber-50/30',
                          )}
                        >
                          <span
                            className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-semibold text-white"
                            style={{ backgroundColor: WA_GREEN }}
                            title={author}
                          >
                            {monogram(author)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[11.5px] font-semibold text-zinc-900">{author}</span>
                              <span className="text-[10.5px] tabular-nums text-zinc-500">{fmtDate(note.createdAt)}</span>
                              {note.updatedAt && note.updatedAt !== note.createdAt && (
                                <span className="text-[10px] uppercase tracking-wider text-amber-600">
                                  edited {fmtDate(note.updatedAt)}
                                </span>
                              )}
                              {isPinned && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-amber-700">
                                  <Pin className="h-2.5 w-2.5" strokeWidth={2.5} />
                                  Pinned
                                </span>
                              )}
                              {isStarred && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-yellow-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-yellow-700">
                                  <Star className="h-2.5 w-2.5" strokeWidth={2.5} />
                                  Starred
                                </span>
                              )}
                            </div>
                            <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-zinc-900">
                              {note.text}
                            </p>
                            {tags.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {tags.map((t: string) => (
                                  <span
                                    key={t}
                                    className="inline-flex items-center gap-0.5 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600"
                                  >
                                    <Hash className="h-2 w-2" strokeWidth={2.5} />
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <ZoruAlertDialog>
                            <ZoruAlertDialogTrigger asChild>
                              <button
                                type="button"
                                disabled={deletingId === note._id}
                                aria-label="Delete note"
                                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600 active:scale-[0.97]"
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
                      );
                    })}
                  </AnimatePresence>
                </ul>
              )}

              <div className="border-t border-zinc-100 bg-zinc-50/40 px-4 py-3">
                <h3 className="mb-2 text-[11.5px] font-semibold uppercase tracking-wider text-zinc-700">Add a note</h3>
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

          {!hasSearched && (
            <EmptyState
              icon={StickyNote}
              title="Enter a contact"
              description="Look up a contact by ID or phone number to view and add private notes."
            />
          )}
        </div>

        {/* Recent contacts rail */}
        <aside className="rounded-xl border border-zinc-200 bg-white">
          <header className="flex items-center justify-between border-b border-zinc-100 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-700">
              <User className="mr-1 inline-block h-3 w-3" strokeWidth={2.5} aria-hidden />
              Recent contacts
            </p>
            <StatusPill tone="draft">{recentContacts.length}</StatusPill>
          </header>
          {recentContacts.length === 0 ? (
            <div className="px-3 py-6 text-center text-[11.5px] text-zinc-500">No recent contacts.</div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {recentContacts.map((c) => (
                <li key={c._id.toString()}>
                  <button
                    type="button"
                    onClick={() => {
                      const id = c._id.toString();
                      setContactId(id);
                      fetchNotes(id);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-zinc-50/70"
                  >
                    <span
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[9.5px] font-semibold text-white"
                      style={{ backgroundColor: WA_GREEN }}
                    >
                      {monogram(c.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11.5px] font-medium text-zinc-900">{c.name || 'Unknown'}</p>
                      <p className="truncate font-mono text-[10px] tabular-nums text-zinc-500">{c.waId}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </WaPage>
  );
}
