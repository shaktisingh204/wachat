'use client';

import * as React from 'react';
import {
  Archive,
  CheckCircle2,
  CornerUpLeft,
  FileText,
  Loader2,
  MailOpen,
  Paperclip,
  Star,
  StarOff,
  Undo2,
} from 'lucide-react';

import {
  Avatar,
  ZoruAvatarFallback,
  Badge,
  Button,
  ScrollArea,
  Separator,
  cn,
} from '@/components/sabcrm/20ui/compat';
import type {
  EmailInboxMessageDoc,
  EmailInboxThreadDoc,
} from '@/app/actions/email/inbox.actions.types';

import { ReplyComposer, type ReplyComposerProps } from './reply-composer';

export interface ThreadViewProps {
  thread: EmailInboxThreadDoc | null;
  messages: EmailInboxMessageDoc[];
  loading: boolean;
  pendingThreadAction: boolean;
  onToggleStar: () => void;
  onToggleStatus: (next: EmailInboxThreadDoc['status']) => void;
  onToggleUnread: () => void;
  composer: ReplyComposerProps;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const u = ['KB', 'MB', 'GB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${u[i]}`;
}

function initialsForEmail(email: string | undefined): string {
  if (!email) return '?';
  const parts = email.split(/[@.]/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function ThreadView({
  thread,
  messages,
  loading,
  pendingThreadAction,
  onToggleStar,
  onToggleStatus,
  onToggleUnread,
  composer,
}: ThreadViewProps) {
  if (!thread) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-[var(--st-bg)] p-10 text-center text-sm text-[var(--st-text-secondary)]">
        <FileText className="h-7 w-7 text-[var(--st-text-secondary)]/70" />
        <div className="font-medium text-[var(--st-text)]">No conversation selected</div>
        <div className="max-w-sm text-xs">
          Pick a conversation from the list to read it and reply here.
        </div>
      </div>
    );
  }

  const isArchived = thread.status === 'archived';
  const isClosed = thread.status === 'closed';

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--st-bg)]">
      <header className="flex items-start gap-3 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-semibold text-[var(--st-text)]">
              {thread.subject || '(no subject)'}
            </h2>
            <Badge variant="outline" className="text-[10px] uppercase">
              {thread.status}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--st-text-secondary)]">
            <span>
              {thread.messageCount} message
              {thread.messageCount === 1 ? '' : 's'}
            </span>
            <span>·</span>
            <span>{thread.participants.length} participants</span>
            {(thread.labels ?? []).map((l) => (
              <span
                key={l}
                className="rounded-full border border-[var(--st-border)] bg-[var(--st-bg)] px-1.5 py-px text-[10px]"
              >
                {l}
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={thread.starred ? 'Unstar' : 'Star'}
            disabled={pendingThreadAction}
            onClick={onToggleStar}
          >
            {thread.starred ? (
              <Star className="fill-[var(--st-text-secondary)] text-[var(--st-text)]" />
            ) : (
              <StarOff />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={thread.unread ? 'Mark read' : 'Mark unread'}
            disabled={pendingThreadAction}
            onClick={onToggleUnread}
          >
            <MailOpen />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pendingThreadAction}
            onClick={() =>
              onToggleStatus(isArchived || isClosed ? 'open' : 'closed')
            }
          >
            {isClosed ? (
              <>
                <Undo2 /> Reopen
              </>
            ) : (
              <>
                <CheckCircle2 /> Close
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pendingThreadAction}
            onClick={() => onToggleStatus(isArchived ? 'open' : 'archived')}
          >
            <Archive /> {isArchived ? 'Unarchive' : 'Archive'}
          </Button>
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 p-4">
          {loading && messages.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-[var(--st-text-secondary)]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading
              messages…
            </div>
          ) : messages.length === 0 ? (
            <div className="rounded-[var(--zoru-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-secondary)]/40 p-6 text-center text-sm text-[var(--st-text-secondary)]">
              No messages in this thread yet.
            </div>
          ) : (
            messages.map((m) => (
              <MessageBubble key={m._id} message={m} />
            ))
          )}
        </div>
      </ScrollArea>

      <Separator />
      <div className="border-t border-[var(--st-border)] bg-[var(--st-bg-secondary)]/40">
        <ReplyComposer {...composer} />
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: EmailInboxMessageDoc }) {
  const outbound = message.direction === 'outbound';
  return (
    <div
      className={cn(
        'flex w-full gap-3',
        outbound ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      <Avatar className="mt-1 h-8 w-8 shrink-0">
        <ZoruAvatarFallback className="text-[10px]">
          {initialsForEmail(message.from?.email)}
        </ZoruAvatarFallback>
      </Avatar>
      <div
        className={cn(
          'max-w-[75%] rounded-[var(--zoru-radius-lg)] border px-3 py-2 shadow-sm',
          outbound
            ? 'border-[var(--st-border)] bg-[var(--st-text)] text-[var(--st-text-inverted)]'
            : 'border-[var(--st-border)] bg-zoru-surface-raised text-[var(--st-text)]',
        )}
      >
        <div
          className={cn(
            'flex items-baseline gap-2 text-[11px]',
            outbound ? 'text-[var(--st-text-inverted)]/80' : 'text-[var(--st-text-secondary)]',
          )}
        >
          <span className="truncate font-medium">
            {message.from?.name || message.from?.email || '(unknown)'}
          </span>
          <span>·</span>
          <span>{formatTime(message.createdAt)}</span>
        </div>
        {message.bodyHtml ? (
          <div
            className={cn(
              'prose prose-sm mt-1 max-w-none break-words text-sm',
              outbound
                ? 'prose-invert text-[var(--st-text-inverted)]'
                : 'text-[var(--st-text)]',
            )}
            // The Rust backend is responsible for storing only sanitised
            // HTML; inbound MIME parsing strips scripts before insert. We
            // render here without re-sanitising to preserve formatting.
            dangerouslySetInnerHTML={{ __html: message.bodyHtml }}
          />
        ) : (
          <div
            className={cn(
              'mt-1 whitespace-pre-wrap text-sm',
              outbound ? 'text-[var(--st-text-inverted)]' : 'text-[var(--st-text)]',
            )}
          >
            {message.bodyText ?? ''}
          </div>
        )}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((a, idx) => (
              <a
                key={`${a.url}-${idx}`}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'inline-flex max-w-[14rem] items-center gap-2 truncate rounded-[var(--zoru-radius-sm)] border px-2 py-1.5 text-xs transition-colors',
                  outbound
                    ? 'border-[var(--st-text-inverted)]/30 bg-[var(--st-text-inverted)]/10 text-[var(--st-text-inverted)] hover:bg-[var(--st-text-inverted)]/20'
                    : 'border-[var(--st-border)] bg-[var(--st-bg)] text-[var(--st-text)] hover:bg-[var(--st-bg-secondary)]',
                )}
              >
                <Paperclip className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate font-medium">{a.filename}</span>
                <span
                  className={cn(
                    'shrink-0 text-[10px]',
                    outbound ? 'text-[var(--st-text-inverted)]/70' : 'text-[var(--st-text-secondary)]',
                  )}
                >
                  {fmtBytes(a.size)}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
      {outbound ? null : (
        <div className="hidden shrink-0 self-end text-[10px] text-[var(--st-text-secondary)] sm:block">
          <CornerUpLeft className="h-3 w-3" />
        </div>
      )}
    </div>
  );
}
