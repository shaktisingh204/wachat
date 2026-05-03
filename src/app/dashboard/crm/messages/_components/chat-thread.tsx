'use client';

import * as React from 'react';
import { Paperclip, Send, LoaderCircle, Download } from 'lucide-react';

import { ClayCard, ClayButton } from '@/components/clay';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  sendMessage,
  getConversationWith,
  markAllChatsRead,
} from '@/app/actions/worksuite/chat.actions';
import type { WsUserChat, WsUserchatFile } from '@/lib/worksuite/chat-types';

type ThreadMessage = WsUserChat & { _id: string; files?: WsUserchatFile[] };

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
  const { toast } = useToast();
  const [messages, setMessages] = React.useState<ThreadMessage[]>(initialMessages);
  const [draft, setDraft] = React.useState('');
  const [fileUrl, setFileUrl] = React.useState('');
  const [fileName, setFileName] = React.useState('');
  const [pending, setPending] = React.useState<PendingFile[]>([]);
  const [sending, setSending] = React.useState(false);
  const endRef = React.useRef<HTMLDivElement | null>(null);

  const scrollToBottom = React.useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, []);

  React.useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  const refresh = React.useCallback(async () => {
    const data = await getConversationWith(peerUserId);
    setMessages(data as unknown as ThreadMessage[]);
  }, [peerUserId]);

  // Simple polling every 12s — keeps the thread reasonably fresh without sockets.
  React.useEffect(() => {
    const id = setInterval(() => {
      refresh().catch(() => {});
    }, 12000);
    return () => clearInterval(id);
  }, [refresh]);

  // Mark as read when opening
  React.useEffect(() => {
    markAllChatsRead(peerUserId).catch(() => {});
  }, [peerUserId]);

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
    setSending(true);
    const res = await sendMessage(peerUserId, draft, pending);
    setSending(false);
    if (res.error) {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
      return;
    }
    setDraft('');
    setPending([]);
    await refresh();
  };

  return (
    <ClayCard padded={false} className="flex min-h-[480px] flex-col">
      <div className="border-b border-border px-5 py-3">
        <p className="text-[12.5px] text-muted-foreground">Conversation with</p>
        <p className="truncate text-[14px] font-medium text-foreground">{peerUserId}</p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-[12.5px] text-muted-foreground">
            No messages yet. Say hi.
          </p>
        ) : (
          messages.map((m) => {
            const own = m.from_user_id === currentUserId;
            return (
              <div
                key={m._id}
                className={cn('flex flex-col', own ? 'items-end' : 'items-start')}
              >
                <div
                  className={cn(
                    'max-w-[80%] rounded-lg px-3 py-2 text-[13px] leading-snug',
                    own
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-secondary text-foreground',
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
                <span className="mt-1 px-1 text-[10.5px] text-muted-foreground">
                  {formatStamp(m.createdAt)}
                </span>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={handleSend}
        className="space-y-2 border-t border-border px-5 py-3"
      >
        {pending.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {pending.map((p, i) => (
              <li
                key={i}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-2 py-1 text-[11.5px] text-foreground"
              >
                <Paperclip className="h-3 w-3" />
                <span className="max-w-[160px] truncate">{p.filename}</span>
                <button
                  type="button"
                  onClick={() => removePending(i)}
                  className="text-destructive"
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
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a message…"
          rows={2}
          className="rounded-lg border-border bg-card text-[13px]"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="File name (optional)"
            className="h-8 w-44 rounded-lg border-border bg-card text-[12px]"
          />
          <Input
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
            placeholder="https://file-url"
            className="h-8 flex-1 min-w-[180px] rounded-lg border-border bg-card text-[12px]"
          />
          <ClayButton
            type="button"
            variant="pill"
            size="sm"
            onClick={addPendingFile}
            leading={<Paperclip className="h-3.5 w-3.5" />}
          >
            Attach
          </ClayButton>
          <ClayButton
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
          </ClayButton>
        </div>
      </form>
    </ClayCard>
  );
}
