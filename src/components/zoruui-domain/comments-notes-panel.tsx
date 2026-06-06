'use client';

import { useState, useEffect } from 'react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Textarea, Badge } from '@/components/sabcrm/20ui/compat';
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

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'notes', label: 'Notes' },
    { key: 'comments', label: 'Comments', count: comments.length },
    { key: 'attachments', label: 'Attachments', count: attachments.length },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[var(--st-text-secondary)]" />
            Notes &amp; Comments
            <span className="ml-1 text-[11px] text-[var(--st-text-secondary)] font-normal capitalize">{entityType}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 border-b border-[var(--st-border)]">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-[12.5px] border-b-2 transition-colors -mb-px ${
                activeTab === tab.key
                  ? 'border-[var(--st-text)] text-[var(--st-text)]'
                  : 'border-transparent text-[var(--st-text-secondary)] hover:text-[var(--st-text)]'
              }`}
            >
              {tab.label}
              {tab.count != null && tab.count > 0 ? (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{tab.count}</Badge>
              ) : null}
            </button>
          ))}
        </div>

        <div className="min-h-[240px] pt-2">
          {activeTab === 'notes' ? (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-[12px] text-[var(--st-text-secondary)]">
                <StickyNote className="h-3.5 w-3.5" />
                Private note — only visible to you
              </div>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={2000}
                rows={7}
                placeholder="Write a private note..."
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[var(--st-text-secondary)]">{note.length}/2000</span>
                <Button size="sm" onClick={saveNote}>
                  {noteSaved ? 'Saved!' : 'Save Note'}
                </Button>
              </div>
            </div>
          ) : null}

          {activeTab === 'comments' ? (
            <div className="flex flex-col gap-3">
              {comments.length === 0 ? (
                <p className="py-6 text-center text-[12.5px] text-[var(--st-text-secondary)]">No comments yet.</p>
              ) : (
                <ul className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                  {comments.map((c) => (
                    <li key={c.id} className="rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2.5">
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
                        <button
                          type="button"
                          onClick={() => deleteComment(c.id)}
                          className="rounded p-1 text-[var(--st-text-secondary)] hover:bg-[var(--st-danger)]/10 hover:text-[var(--st-danger)] shrink-0"
                          aria-label="Delete comment"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
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
                />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--st-text-secondary)]">{commentDraft.length}/500</span>
                  <Button size="sm" onClick={postComment} disabled={!commentDraft.trim()}>
                    Post
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'attachments' ? (
            <div className="flex flex-col gap-3">
              {attachments.length === 0 ? (
                <p className="py-6 text-center text-[12.5px] text-[var(--st-text-secondary)]">No attachments yet.</p>
              ) : (
                <ul className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                  {attachments.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <Paperclip className="h-3.5 w-3.5 text-[var(--st-text-secondary)] shrink-0" />
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
                      <button
                        type="button"
                        onClick={() => removeAttachment(a.id)}
                        className="rounded p-1 text-[var(--st-text-secondary)] hover:bg-[var(--st-danger)]/10 hover:text-[var(--st-danger)] shrink-0"
                        aria-label="Remove attachment"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="border-t border-[var(--st-border)] pt-3">
                <SabFilePickerButton onPick={handleAttachPick} variant="outline">
                  <Paperclip className="h-3.5 w-3.5" />
                  Attach File
                </SabFilePickerButton>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
