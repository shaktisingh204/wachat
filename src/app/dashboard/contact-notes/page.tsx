'use client';

/**
 * Wachat Contact Notes — look up a contact and manage notes,
 * built on Clay primitives.
 */

import * as React from 'react';
import { useState, useTransition, useCallback, useActionState } from 'react';
import { LuSearch, LuLoader, LuStickyNote, LuTrash2, LuPlus } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  getContactNotes,
  addContactNote,
  deleteContactNote,
} from '@/app/actions/wachat-features.actions';

export default function ContactNotesPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();

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

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs
        items={[
          { label: 'Wachat', href: '/home' },
          { label: activeProject?.name || 'Project', href: '/dashboard' },
          { label: 'Contact Notes' },
        ]}
      />

      <div className="min-w-0">
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">
          Contact Notes
        </h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          Look up a contact by ID or phone number and manage private notes.
        </p>
      </div>

      {/* Search */}
      <ClayCard padded={false} className="p-6">
        <h2 className="text-[16px] font-semibold text-foreground mb-4">Look up contact</h2>
        <form onSubmit={handleSearch} className="flex items-center gap-3 max-w-md">
          <Input
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            placeholder="Contact ID or phone number"
            required
          />
          <ClayButton
            type="submit"
            variant="obsidian"
            size="md"
            disabled={isSearching || !contactId.trim()}
            leading={<LuSearch className="h-3.5 w-3.5" strokeWidth={2} />}
          >
            {isSearching ? 'Searching...' : 'Search'}
          </ClayButton>
        </form>
      </ClayCard>

      {/* Notes list */}
      {hasSearched && (
        <ClayCard padded={false} className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[16px] font-semibold text-foreground">
              Notes for {contactId} ({notes.length})
            </h2>
          </div>

          {isSearching ? (
            <div className="flex h-20 items-center justify-center">
              <LuLoader className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.75} />
            </div>
          ) : notes.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-secondary px-4 py-10 text-center mb-6">
              <LuStickyNote className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
              <div className="text-[13px] font-semibold text-foreground">No notes yet</div>
              <div className="text-[11.5px] text-muted-foreground">Add your first note below.</div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 mb-6">
              {notes.map((note) => (
                <div
                  key={note._id}
                  className="flex items-start justify-between gap-3 rounded-[12px] border border-border bg-secondary p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-foreground whitespace-pre-wrap">{note.text}</p>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      {new Date(note.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(note._id)}
                    disabled={deletingId === note._id}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-destructive hover:bg-rose-50 transition-colors shrink-0"
                    aria-label="Delete note"
                  >
                    <LuTrash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add note form */}
          <div className="border-t border-border pt-4">
            <h3 className="text-[14px] font-semibold text-foreground mb-3">Add a note</h3>
            <form action={formAction} className="flex flex-col gap-3 max-w-lg">
              <input type="hidden" name="contactId" value={contactId} />
              <input type="hidden" name="projectId" value={projectId || ''} />
              <Textarea name="text" placeholder="Write a note..." rows={3} required />
              <div>
                <ClayButton
                  type="submit"
                  variant="obsidian"
                  size="md"
                  disabled={isPending}
                  leading={<LuPlus className="h-3.5 w-3.5" strokeWidth={2.5} />}
                >
                  {isPending ? 'Adding...' : 'Add Note'}
                </ClayButton>
              </div>
            </form>
          </div>
        </ClayCard>
      )}

      <div className="h-6" />
    </div>
  );
}
