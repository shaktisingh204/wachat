'use client';

import { Button, Textarea, Input, Card, useZoruToast } from '@/components/sabcrm/20ui/compat';
import { Paperclip, Send, LoaderCircle, Download, Check, CheckCheck } from 'lucide-react';

import * as React from 'react';

import { SabFileUrlInput } from '@/components/sabfiles';
import { cn } from '@/lib/utils';
import {
  sendMessage,
  getConversationWith,
  markAllChatsRead,
  pingTyping,
} from '@/app/actions/worksuite/chat.actions';
import type { WsUserChat, WsUserchatFile } from '@/lib/worksuite/chat-types';
import { useWorksuiteRealtime } from '../../_components/use-worksuite-realtime';

type ThreadMessage = WsUserChat & { _id: string; files?: WsUserchatFile[]; isOptimistic?: boolean };

export interface ChatThreadProps {
  peerUserId: string;
  currentUserId: string;
  initialMessages: ThreadMessage[];
}

function formatStamp(value?: string | Date): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface PendingFile {
  filename: string;
  url: string;
  size: number;
  mime_type?: string;
}

export function ChatThread({ peerUserId, currentUserId, initialMessages }: ChatThreadProps) {
  const { toast } = useZoruToast();
  const [messages, setMessages] = React.useState<ThreadMessage[]>(initialMessages);
  const [draft, setDraft] = React.useState('');
  const [fileUrl, setFileUrl] = React.useState('');
  const [fileName, setFileName] = React.useState('');
  const [pending, setPending] = React.useState<PendingFile[]>([]);
  const [sending, setSending] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(initialMessages.length === 50);
  const [loadingOlder, setLoadingOlder] = React.useState(false);
  const [typing, setTyping] = React.useState(false);

  const endRef = React.useRef<HTMLDivElement | null>(null);

  const scrollToBottom = React.useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, []);

  React.useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  // Mark as read when opening
  React.useEffect(() => {
    markAllChatsRead(peerUserId).catch(() => {});
  }, [peerUserId]);

  useWorksuiteRealtime((event) => {
    if (event.type === 'NEW_MESSAGE') {
      const msg = event.payload;
      if (msg.from_user_id === peerUserId || msg.to_user_id === peerUserId) {
        setMessages((prev) => {
          // avoid duplicates (optimistic UI)
          if (prev.some(m => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
        if (msg.from_user_id === peerUserId) {
          markAllChatsRead(peerUserId).catch(() => {});
        }
      }
    } else if (event.type === 'MESSAGE_READ' && event.payload.byUserId === peerUserId) {
      setMessages((prev) =>
        prev.map((m) =>
          m.to_user_id === peerUserId ? { ...m, is_read: true } : m
        )
      );
    } else if (event.type === 'TYPING' && event.payload.fromUserId === peerUserId) {
      setTyping(true);
      setTimeout(() => setTyping(false), 3000);
    }
  });

  const loadOlder = async () => {
    if (!messages.length) return;
    setLoadingOlder(true);
    try {
      const older = await getConversationWith(peerUserId, messages[0]._id, 50);
      if (older.length < 50) setHasMore(false);
      setMessages((prev) => [...(older as unknown as ThreadMessage[]), ...prev]);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to load older messages', variant: 'destructive' });
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value);
    pingTyping(peerUserId).catch(() => {});
  };

  const addPendingFile = () => {
    if (!fileUrl.trim()) return;
    setPending((prev) => [
      ...prev,
      {
        filename: fileName.trim() || fileUrl.trim(),
        url: fileUrl.trim(),
        size: 0,
      },
    ]);
    setFileUrl('');
    setFileName('');
  };

  const removePending = (i: number) =>
    setPending((prev) => prev.filter((_, idx) => idx !== i));

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() && pending.length === 0) return;
    
    // Optimistic UI
    const tempId = 'temp-' + Date.now();
    const newMsg: ThreadMessage = {
      _id: tempId,
      userId: currentUserId as any,
      from_user_id: currentUserId,
      to_user_id: peerUserId,
      message: draft,
      is_read: false,
      group_id: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      files: pending as any,
      isOptimistic: true,
    };
    setMessages((prev) => [...prev, newMsg]);
    
    const draftContent = draft;
    const pendingFiles = [...pending];
    
    setDraft('');
    setPending([]);
    setSending(true);

    const res = await sendMessage(peerUserId, draftContent, pendingFiles);
    setSending(false);

    if (res.error) {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
      setMessages((prev) => prev.filter(m => m._id !== tempId));
      setDraft(draftContent);
      setPending(pendingFiles);
      return;
    }
    
    setMessages((prev) => prev.map(m => m._id === tempId ? { ...res.finalMsg, isOptimistic: false } as any : m));
  };

  return (
    <Card className="flex min-h-[480px] flex-col p-0">
      <div className="border-b border-[var(--st-border)] px-5 py-3 flex justify-between items-center">
        <div>
          <p className="text-[12.5px] text-[var(--st-text-secondary)]">Conversation with</p>
          <p className="truncate text-[14px] font-medium text-[var(--st-text)] flex items-center gap-2">
            {peerUserId}
            <span className="w-2 h-2 rounded-full bg-[var(--st-status-ok)] inline-block" title="Online status indicator"></span>
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {hasMore && (
          <div className="text-center pb-2">
            <Button variant="ghost" size="sm" onClick={loadOlder} disabled={loadingOlder}>
              {loadingOlder ? <LoaderCircle className="h-4 w-4 animate-spin" /> : 'Load older messages'}
            </Button>
          </div>
        )}
        {messages.length === 0 ? (
          <p className="py-10 text-center text-[12.5px] text-[var(--st-text-secondary)]">
            No messages yet. Say hi.
          </p>
        ) : (
          messages.map((m) => {
            const own = m.from_user_id === currentUserId;
            return (
              <div
                key={m._id}
                className={cn('flex flex-col', own ? 'items-end' : 'items-start', m.isOptimistic ? 'opacity-60' : '')}
              >
                <div
                  className={cn(
                    'max-w-[80%] rounded-lg px-3 py-2 text-[13px] leading-snug',
                    own
                      ? 'bg-[var(--st-text)] text-white'
                      : 'bg-[var(--st-bg-muted)] text-[var(--st-text)]',
                  )}
                >
                  {m.message ? (
                    <p className="whitespace-pre-wrap break-words">{m.message}</p>
                  ) : null}
                  {m.files && m.files.length > 0 ? (
                    <ul className="mt-1.5 space-y-1 text-[12px]">
                      {m.files.map((f) => (
                        <li key={f._id} className="flex items-center gap-1.5">
                          <Download className="h-3 w-3" />
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noreferrer"
                            className="underline underline-offset-2"
                          >
                            {f.filename}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <div className="mt-1 px-1 flex items-center gap-1">
                  <span className="text-[10.5px] text-[var(--st-text-secondary)]">
                    {formatStamp(m.createdAt)}
                  </span>
                  {own && !m.isOptimistic && (
                    m.is_read ? <CheckCheck className="h-3 w-3 text-[var(--st-text)]" /> : <Check className="h-3 w-3 text-[var(--st-text-secondary)]" />
                  )}
                </div>
              </div>
            );
          })
        )}
        {typing && (
          <div className="flex flex-col items-start">
            <div className="bg-[var(--st-bg-muted)] text-[var(--st-text)] max-w-[80%] rounded-lg px-3 py-2 text-[13px] leading-snug">
              <span className="animate-pulse">Typing...</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={handleSend}
        className="space-y-2 border-t border-[var(--st-border)] px-5 py-3"
      >
        {pending.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {pending.map((p, i) => (
              <li
                key={i}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-2 py-1 text-[11.5px] text-[var(--st-text)]"
              >
                <Paperclip className="h-3 w-3" />
                <span className="max-w-[160px] truncate">{p.filename}</span>
                <button
                  type="button"
                  onClick={() => removePending(i)}
                  className="text-[var(--st-danger)]"
                  aria-label="Remove attachment"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <Textarea
          value={draft}
          onChange={handleTyping}
          placeholder="Write a message…"
          rows={2}
          className="rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="File name (optional)"
            className="h-8 w-44 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[12px]"
          />
          <SabFileUrlInput
            value={fileUrl}
            onChange={(v, pick) => {
              setFileUrl(v);
              if (pick && !fileName.trim()) {
                setFileName(pick.name);
              }
            }}
            accept="all"
            placeholder="https://file-url"
            className="flex-1 min-w-[180px]"
          />
          <Button
            type="button"
            variant="pill"
            size="sm"
            onClick={addPendingFile}
            leading={<Paperclip className="h-3.5 w-3.5" />}
          >
            Attach
          </Button>
          <Button
            type="submit"
            variant="obsidian"
            size="sm"
            disabled={sending || (!draft.trim() && pending.length === 0)}
            leading={
              sending ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )
            }
          >
            Send
          </Button>
        </div>
      </form>
    </Card>
  );
}
