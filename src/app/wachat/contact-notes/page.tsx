'use client';

/**
 * Wachat Contact Notes — rebuilt on ZoruUI primitives (phase 2).
 *
 * Same data, same handlers. Visual primitives swapped to ZoruUI.
 */

import * as React from 'react';
import { useState, useTransition, useCallback, useActionState } from 'react';
import { Search, Loader2, StickyNote, Trash2, Plus } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import {
  getContactNotes,
  addContactNote,
  deleteContactNote,
} from '@/app/actions/wachat-features.actions';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  ZoruSkeleton,
  ZoruTextarea,
} from '@/components/zoruui';

export default function ContactNotesPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();

  const [contactId, setContactId] = useState('');
  const [notes, setNotes] = useState<any[]>([]);
  const [isSearching, startSearching] = useTransition();
  const [hasSearched, setHasSearched] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formState, formAction, isPending] = useActionState(
    addContactNote,
    null,
  );

  const fetchNotes = useCallback(
    (cid: string) => {
      startSearching(async () => {
        setHasSearched(true);
        const res = await getContactNotes(cid);
        if (res.error) {
          toast({
            title: 'Error',
            description: res.error,
            variant: 'destructive',
          });
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
      toast({
        title: 'Error',
        description: formState.error,
        variant: 'destructive',
      });
    }
  }, [formState, toast, contactId, fetchNotes]);

  const handleDelete = async (noteId: string) => {
    setDeletingId(noteId);
    const res = await deleteContactNote(noteId);
    setDeletingId(null);
    if (res.error) {
      toast({
        title: 'Error',
        description: res.error,
        variant: 'destructive',
      });
    } else {
      setNotes((prev) => prev.filter((n) => n._id !== noteId));
      toast({ title: 'Deleted', description: 'Note removed.' });
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat/contacts">
              Contacts
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Notes</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div className="min-w-0">
        <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
          Contact Notes
        </h1>
        <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
          Look up a contact by ID or phone number and manage private notes.
        </p>
      </div>

      {/* Search */}
      <ZoruCard className="p-6">
        <h2 className="mb-4 text-[15px] text-zoru-ink">Look up contact</h2>
        <form
          onSubmit={handleSearch}
          className="flex max-w-md items-end gap-3"
        >
          <div className="flex flex-1 flex-col gap-1.5">
            <ZoruLabel htmlFor="cn-contact">
              Contact ID or phone number
            </ZoruLabel>
            <ZoruInput
              id="cn-contact"
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              placeholder="Contact ID or phone number"
              required
            />
          </div>
          <ZoruButton
            type="submit"
            disabled={isSearching || !contactId.trim()}
          >
            {isSearching ? <Loader2 className="animate-spin" /> : <Search />}
            {isSearching ? 'Searching…' : 'Search'}
          </ZoruButton>
        </form>
      </ZoruCard>

      {/* Notes list */}
      {hasSearched && (
        <ZoruCard className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] text-zoru-ink">
              Notes for {contactId} ({notes.length})
            </h2>
          </div>

          {isSearching ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <ZoruSkeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : notes.length === 0 ? (
            <ZoruEmptyState
              icon={<StickyNote />}
              title="No notes yet"
              description="Add your first note below."
              compact
              className="mb-6"
            />
          ) : (
            <div className="mb-6 flex flex-col gap-3">
              {notes.map((note) => (
                <div
                  key={note._id}
                  className="flex items-start justify-between gap-3 rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-surface p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-wrap text-[13px] text-zoru-ink">
                      {note.text}
                    </p>
                    <p className="mt-1.5 text-[11px] text-zoru-ink-muted">
                      {new Date(note.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <ZoruAlertDialog>
                    <ZoruAlertDialogTrigger asChild>
                      <ZoruButton
                        variant="ghost"
                        size="icon-sm"
                        disabled={deletingId === note._id}
                        aria-label="Delete note"
                        className="text-zoru-danger hover:bg-zoru-danger/10"
                      >
                        <Trash2 />
                      </ZoruButton>
                    </ZoruAlertDialogTrigger>
                    <ZoruAlertDialogContent>
                      <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>
                          Delete note?
                        </ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                          This note will be permanently removed.
                        </ZoruAlertDialogDescription>
                      </ZoruAlertDialogHeader>
                      <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction
                          destructive
                          onClick={() => handleDelete(note._id)}
                        >
                          Delete
                        </ZoruAlertDialogAction>
                      </ZoruAlertDialogFooter>
                    </ZoruAlertDialogContent>
                  </ZoruAlertDialog>
                </div>
              ))}
            </div>
          )}

          {/* Add note form */}
          <div className="border-t border-zoru-line pt-4">
            <h3 className="mb-3 text-[14px] text-zoru-ink">Add a note</h3>
            <form
              action={formAction}
              className="flex max-w-lg flex-col gap-3"
            >
              <input type="hidden" name="contactId" value={contactId} />
              <input
                type="hidden"
                name="projectId"
                value={projectId || ''}
              />
              <ZoruTextarea
                name="text"
                placeholder="Write a note…"
                rows={3}
                required
              />
              <div>
                <ZoruButton type="submit" disabled={isPending}>
                  {isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Plus />
                  )}
                  {isPending ? 'Adding…' : 'Add note'}
                </ZoruButton>
              </div>
            </form>
          </div>
        </ZoruCard>
      )}

      <div className="h-6" />
    </div>
  );
}
