'use client';

import * as React from 'react';
import { Loader2, Paperclip, Send, X } from 'lucide-react';

import { Button, IconButton, Textarea, cn } from '@/components/sabcrm/20ui';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import type { EmailAttachment } from '@/lib/rust-client/email-inbox';

export interface ReplyComposerProps {
  /**
   * Pre-filled `To` line shown above the composer. Comes from the
   * parent based on the active thread's participants.
   */
  toEmails: string[];
  /** Submit handler. Returns once the send action resolves. */
  onSend: (input: {
    bodyHtml: string;
    bodyText: string;
    attachments: EmailAttachment[];
  }) => Promise<void>;
  /** Disabled when there's no thread selected. */
  disabled?: boolean;
  pending: boolean;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function plainTextToHtml(s: string): string {
  // Preserve newlines as <br/>. Email-inbox stores sanitised HTML;
  // for the composer we keep it simple and let inbound rendering
  // continue to look right.
  return escapeHtml(s).replace(/\n/g, '<br/>');
}

interface DraftAttachment extends EmailAttachment {
  /** Local key so React keys stay stable across re-renders. */
  _key: string;
}

export function ReplyComposer({
  toEmails,
  onSend,
  disabled,
  pending,
}: ReplyComposerProps) {
  const [body, setBody] = React.useState('');
  const [attachments, setAttachments] = React.useState<DraftAttachment[]>([]);

  const reset = React.useCallback(() => {
    setBody('');
    setAttachments([]);
  }, []);

  const onPick = React.useCallback((pick: SabFilePick) => {
    setAttachments((curr) => [
      ...curr,
      {
        _key: `${pick.id}-${Date.now()}`,
        filename: pick.name,
        contentType: pick.mime ?? 'application/octet-stream',
        size: pick.size ?? 0,
        url: pick.url,
      },
    ]);
  }, []);

  const removeAttachment = React.useCallback((key: string) => {
    setAttachments((curr) => curr.filter((a) => a._key !== key));
  }, []);

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const trimmed = body.trim();
      if (!trimmed) return;
      const cleanAttachments: EmailAttachment[] = attachments.map(
        ({ _key, ...rest }) => rest,
      );
      await onSend({
        bodyHtml: plainTextToHtml(trimmed),
        bodyText: trimmed,
        attachments: cleanAttachments,
      });
      reset();
    },
    [attachments, body, onSend, reset],
  );

  const canSend = !pending && !disabled && body.trim().length > 0;

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'flex flex-col gap-2 p-3',
        disabled && 'pointer-events-none opacity-60',
      )}
    >
      <div className="flex items-center gap-2 text-xs text-[var(--st-text-secondary)]">
        <span className="font-semibold uppercase tracking-wide">To</span>
        <span className="truncate">
          {toEmails.length > 0 ? toEmails.join(', ') : '(no recipients)'}
        </span>
      </div>

      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a reply..."
        rows={4}
        disabled={disabled || pending}
      />

      {attachments.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {attachments.map((a) => (
            <li
              key={a._key}
              className="inline-flex items-center gap-1.5 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-2 py-0.5 text-[11px] text-[var(--st-text)]"
            >
              <Paperclip className="h-3 w-3" aria-hidden="true" />
              <span className="max-w-[10rem] truncate">{a.filename}</span>
              <IconButton
                size="sm"
                variant="ghost"
                icon={X}
                label={`Remove ${a.filename}`}
                onClick={() => removeAttachment(a._key)}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-2">
        <SabFilePickerButton
          variant="ghost"
          onPick={onPick}
          title="Attach a file"
        >
          <Paperclip aria-hidden="true" /> Attach
        </SabFilePickerButton>
        <Button type="submit" disabled={!canSend}>
          {pending ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Send aria-hidden="true" />
          )}
          {pending ? 'Sending...' : 'Send reply'}
        </Button>
      </div>
    </form>
  );
}
