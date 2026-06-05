'use client';
import { fmtDate } from "@/lib/utils";

import {
  useToast,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  IconButton,
  Card,
  EmptyState,
  Field,
  Input,
  Skeleton,
  Textarea,
} from '@/components/sabcrm/20ui';
import { WachatPage } from '@/app/wachat/_components/wachat-page';
import {
  useState,
  useTransition,
  useCallback,
  useActionState } from 'react';
import { Search,
  Loader2,
  StickyNote,
  Trash2,
  Plus } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getContactNotes, addContactNote, deleteContactNote } from '@/app/actions/wachat-features.actions';

/**
 * Wachat Contact Notes — rebuilt on 20ui primitives.
 *
 * Same data, same handlers. Visual primitives swapped to 20ui.
 */

import * as React from 'react';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

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
            tone: 'danger',
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
      toast({ title: 'Success', description: formState.message, tone: 'success' });
      if (contactId.trim()) fetchNotes(contactId.trim());
    }
    if (formState?.error) {
      toast({
        title: 'Error',
        description: formState.error,
        tone: 'danger',
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
        tone: 'danger',
      });
    } else {
      setNotes((prev) => prev.filter((n) => n._id !== noteId));
      toast({ title: 'Deleted', description: 'Note removed.', tone: 'success' });
    }
  };

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Contacts', href: '/wachat/contacts' },
        { label: 'Notes' },
      ]}
      title="Contact Notes"
      description="Look up a contact by ID or phone number and manage private notes."
      width="narrow"
    >
      <div className="flex flex-col gap-6">
        {/* Search */}
        <Card padding="lg">
          <h2 className="mb-4 text-[15px]" style={{ color: 'var(--st-text)' }}>
            Look up contact
          </h2>
          <form
            onSubmit={handleSearch}
            className="flex max-w-md items-end gap-3"
          >
            <Field label="Contact ID or phone number" className="flex-1">
              <Input
                id="cn-contact"
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                placeholder="Contact ID or phone number"
                required
              />
            </Field>
            <Button
              type="submit"
              variant="primary"
              iconLeft={isSearching ? Loader2 : Search}
              disabled={isSearching || !contactId.trim()}
            >
              {isSearching ? 'Searching…' : 'Search'}
            </Button>
          </form>
        </Card>

        {/* Notes list */}
        {hasSearched && (
          <Card padding="lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px]" style={{ color: 'var(--st-text)' }}>
                Notes for {contactId} ({notes.length})
              </h2>
            </div>

            {isSearching ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} height={64} width="100%" />
                ))}
              </div>
            ) : notes.length === 0 ? (
              <div className="mb-6">
                <EmptyState
                  icon={StickyNote}
                  title="No notes yet"
                  description="Add your first note below."
                  size="sm"
                />
              </div>
            ) : (
              <div className="mb-6 flex flex-col gap-3">
                {notes.map((note) => (
                  <div
                    key={note._id}
                    className="flex items-start justify-between gap-3 p-4"
                    style={{
                      borderRadius: 'var(--st-radius-lg)',
                      border: '1px solid var(--st-border)',
                      background: 'var(--st-bg-secondary)',
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className="whitespace-pre-wrap text-[13px]"
                        style={{ color: 'var(--st-text)' }}
                      >
                        {note.text}
                      </p>
                      <p
                        className="mt-1.5 text-[11px]"
                        style={{ color: 'var(--st-text-tertiary)' }}
                      >
                        {fmtDate(note.createdAt)}
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <IconButton
                          label="Delete note"
                          icon={Trash2}
                          variant="ghost"
                          size="sm"
                          disabled={deletingId === note._id}
                        />
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete note?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This note will be permanently removed.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            intent="danger"
                            onClick={() => handleDelete(note._id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            )}

            {/* Add note form */}
            <div
              className="pt-4"
              style={{ borderTop: '1px solid var(--st-border)' }}
            >
              <h3 className="mb-3 text-[14px]" style={{ color: 'var(--st-text)' }}>
                Add a note
              </h3>
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
                <Textarea
                  name="text"
                  placeholder="Write a note…"
                  rows={3}
                  required
                />
                <div>
                  <Button
                    type="submit"
                    variant="primary"
                    iconLeft={isPending ? Loader2 : Plus}
                    disabled={isPending}
                  >
                    {isPending ? 'Adding…' : 'Add note'}
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        )}
      </div>
    </WachatPage>
  );
}
