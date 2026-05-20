'use client';

import * as React from 'react';
import { ZoruTextarea } from '@/components/zoruui';
import { cn } from '@/components/zoruui/lib/cn';

export type MentionUser = {
  id: string;
  name: string;
  avatar?: string;
};

export type ParsedMention = {
  userId: string;
  name: string;
  position: number;
};

export interface MentionTextareaProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  users: MentionUser[];
  className?: string;
  rows?: number;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
}

/**
 * Token format: `@[Name](user:USER_ID)`
 *
 * Detection: a `@` followed by zero or more non-whitespace, non-`@` chars,
 * starting at line start or after whitespace, ending at the caret.
 *
 * Use `parseMentions(text)` to extract `{ userId, name, position }[]` after
 * persisting — see `mentions.actions.ts` for notification fan-out.
 */
const MENTION_TOKEN_RE = /@\[([^\]]+)\]\(user:([a-zA-Z0-9_-]+)\)/g;
const ACTIVE_TRIGGER_RE = /(?:^|\s)@([^\s@]*)$/;

export function parseMentions(text: string): ParsedMention[] {
  if (!text) return [];
  const out: ParsedMention[] = [];
  for (const match of text.matchAll(MENTION_TOKEN_RE)) {
    out.push({
      name: match[1],
      userId: match[2],
      position: match.index ?? 0,
    });
  }
  return out;
}

export function MentionTextarea({
  value,
  onChange,
  placeholder,
  users,
  className,
  rows = 4,
  disabled,
  id,
  ...rest
}: MentionTextareaProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [highlight, setHighlight] = React.useState(0);
  const [triggerStart, setTriggerStart] = React.useState(-1);

  const filtered = React.useMemo(() => {
    if (!open) return [];
    const q = query.toLowerCase();
    return users
      .filter((u) => u.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [open, query, users]);

  const reset = () => {
    setOpen(false);
    setQuery('');
    setHighlight(0);
    setTriggerStart(-1);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    onChange(next);
    const caret = e.target.selectionStart ?? next.length;
    const before = next.slice(0, caret);
    const m = before.match(ACTIVE_TRIGGER_RE);
    if (m) {
      const matchedLen = m[0].length;
      // triggerStart points at the `@`
      const atIndex = caret - matchedLen + (m[0].startsWith('@') ? 0 : 1);
      setTriggerStart(atIndex);
      setQuery(m[1] ?? '');
      setOpen(true);
      setHighlight(0);
    } else {
      reset();
    }
  };

  const insertMention = (user: MentionUser) => {
    const el = textareaRef.current;
    if (!el || triggerStart < 0) return;
    const caret = el.selectionStart ?? value.length;
    const before = value.slice(0, triggerStart);
    const after = value.slice(caret);
    const token = `@[${user.name}](user:${user.id}) `;
    const next = `${before}${token}${after}`;
    onChange(next);
    reset();
    // restore focus + caret after React commits
    requestAnimationFrame(() => {
      el.focus();
      const pos = (before + token).length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open || filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertMention(filtered[highlight]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      reset();
    }
  };

  return (
    <div className={cn('relative', className)}>
      <ZoruTextarea
        id={id}
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          // delay so click on dropdown still registers
          window.setTimeout(reset, 120);
        }}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={rest['aria-label']}
      />
      {open && filtered.length > 0 && (
        <div
          role="listbox"
          aria-label="Mention suggestions"
          className="absolute left-2 right-2 top-full z-30 mt-1 max-h-60 overflow-auto rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-1 shadow-[var(--zoru-shadow-md)]"
        >
          {filtered.map((u, i) => (
            <button
              key={u.id}
              type="button"
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(u);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                'flex w-full items-center gap-2 rounded-[var(--zoru-radius-sm)] px-2 py-1.5 text-left text-sm',
                i === highlight
                  ? 'bg-zoru-surface-2 text-zoru-ink'
                  : 'text-zoru-ink hover:bg-zoru-surface-2',
              )}
            >
              {u.avatar ? (
                <img
                  src={u.avatar}
                  alt=""
                  className="h-5 w-5 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zoru-surface-2 text-[10px] text-zoru-ink-muted">
                  {u.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="truncate">{u.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
