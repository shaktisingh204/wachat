'use client';

import { useState, useEffect } from 'react';
import {
  Button,
  IconButton,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Textarea,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  EmptyState,
} from '@/components/sabcrm/20ui';
import { Trash2, Paperclip, MessageSquare, StickyNote } from 'lucide-react';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';

export interface CommentsNotesPanelProps {
  entityId: string;
  entityType: 'url' | 'qr';
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type Comment = { id: string; text: string; createdAt: string };
type Attachment = { id: string; name: string; url: string; addedAt: string };

type TabKey = 'notes' | 'comments' | 'attachments';

export function CommentsNotesPanel({ entityId, entityType, open, onOpenChange }: CommentsNotesPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('notes');

  const noteKey = `note-${entityId}`;
  const commentsKey = `comments-${entityId}`;
  const attachmentsKey = `attachments-${entityId}`;

  const [note, setNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentDraft, setCommentDraft] = useState('');

  const [attachments, setAttachments] = useState<Attachment[]>([]);

  useEffect(() => {
    if (!open) return;
    try {
      setNote(localStorage.getItem(noteKey) ?? '');
      const rawComments = localStorage.getItem(commentsKey);
      setComments(rawComments ? JSON.parse(rawComments) : []);
      const rawAttachments = localStorage.getItem(attachmentsKey);
      setAttachments(rawAttachments ? JSON.parse(rawAttachments) : []);
    } catch { /* ignore */ }
  }, [open, noteKey, commentsKey, attachmentsKey]);

  const saveNote = () => {
    localStorage.setItem(noteKey, note);
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 1500);
  };

  const persistComments = (next: Comment[]) => {
    setComments(next);
    localStorage.setItem(commentsKey, JSON.stringify(next));
  };

  const postComment = () => {
    const text = commentDraft.trim();
    if (!text) return;
    persistComments([
      ...comments,
      { id: crypto.randomUUID(), text, createdAt: new Date().toISOString() },
    ]);
    setCommentDraft('');
  };

  const deleteComment = (id: string) => persistComments(comments.filter((c) => c.id !== id));

  const persistAttachments = (next: Attachment[]) => {
    setAttachments(next);
    localStorage.setItem(attachmentsKey, JSON.stringify(next));
  };

  const handleAttachPick = (pick: SabFilePick) => {
    persistAttachments([
      ...attachments,
      { id: crypto.randomUUID(), name: pick.name ?? pick.url, url: pick.url, addedAt: new Date().toISOString() },
    ]);
  };

  const removeAttachment = (id: string) => persistAttachments(attachments.filter((a) => a.id !== id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
            Notes and Comments
            <span className="ml-1 text-[11px] text-[var(--st-text-secondary)] font-normal capitalize">{entityType}</span>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
          <TabsList>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="comments">
              <span className="flex items-center gap-1.5">
                Comments
                {comments.length > 0 ? (
                  <Badge tone="neutral" kind="soft" className="text-[10px]">{comments.length}</Badge>
                ) : null}
              </span>
            </TabsTrigger>
            <TabsTrigger value="attachments">
              <span className="flex items-center gap-1.5">
                Attachments
                {attachments.length > 0 ? (
                  <Badge tone="neutral" kind="soft" className="text-[10px]">{attachments.length}</Badge>
                ) : null}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notes" className="min-h-[240px] pt-2">
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-[12px] text-[var(--st-text-secondary)]">
                <StickyNote className="h-3.5 w-3.5" aria-hidden="true" />
                Private note. Only visible to you
              </div>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={2000}
                rows={7}
                placeholder="Write a private note..."
                aria-label="Private note"
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[var(--st-text-secondary)]">{note.length}/2000</span>
                <Button variant="primary" size="sm" onClick={saveNote}>
                  {noteSaved ? 'Saved!' : 'Save Note'}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="comments" className="min-h-[240px] pt-2">
            <div className="flex flex-col gap-3">
              {comments.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  size="sm"
                  title="No comments yet"
                  description="Add the first comment below."
                />
              ) : (
                <ul className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                  {comments.map((c) => (
                    <li key={c.id} className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[11.5px] font-medium text-[var(--st-text)]">You</span>
                            <span className="text-[10.5px] text-[var(--st-text-secondary)]">
                              {new Date(c.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-[12.5px] text-[var(--st-text)] whitespace-pre-wrap break-words">{c.text}</p>
                        </div>
                        <IconButton
                          label="Delete comment"
                          icon={Trash2}
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteComment(c.id)}
                          className="shrink-0"
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="space-y-2 border-t border-[var(--st-border)] pt-3">
                <Textarea
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Add a comment..."
                  aria-label="Add a comment"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--st-text-secondary)]">{commentDraft.length}/500</span>
                  <Button variant="primary" size="sm" onClick={postComment} disabled={!commentDraft.trim()}>
                    Post
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="attachments" className="min-h-[240px] pt-2">
            <div className="flex flex-col gap-3">
              {attachments.length === 0 ? (
                <EmptyState
                  icon={Paperclip}
                  size="sm"
                  title="No attachments yet"
                  description="Attach a file from your library below."
                />
              ) : (
                <ul className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                  {attachments.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <Paperclip className="h-3.5 w-3.5 text-[var(--st-text-secondary)] shrink-0" aria-hidden="true" />
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-[12.5px] text-[var(--st-text)] hover:underline"
                        >
                          {a.name}
                        </a>
                        <span className="text-[10.5px] text-[var(--st-text-secondary)] whitespace-nowrap">
                          {new Date(a.addedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <IconButton
                        label="Remove attachment"
                        icon={Trash2}
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAttachment(a.id)}
                        className="shrink-0"
                      />
                    </li>
                  ))}
                </ul>
              )}
              <div className="border-t border-[var(--st-border)] pt-3">
                <SabFilePickerButton onPick={handleAttachPick} variant="outline">
                  <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                  Attach File
                </SabFilePickerButton>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
