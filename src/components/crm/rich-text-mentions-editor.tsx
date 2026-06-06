'use client';

import * as React from 'react';
import { Bold, Italic, List, LoaderCircle } from 'lucide-react';
import { lookupEntity } from '@/app/actions/crm-lookup.actions';
import type { LookupItem } from '@/lib/lookup-registry';

interface RichTextMentionsEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextMentionsEditor({
  value,
  onChange,
  placeholder,
  className,
}: RichTextMentionsEditorProps) {
  const [mentionQuery, setMentionQuery] = React.useState<{ start: number; query: string } | null>(null);
  const [users, setUsers] = React.useState<LookupItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (!mentionQuery) {
      setUsers([]);
      return;
    }
    const q = mentionQuery.query;
    let cancelled = false;
    setLoading(true);
    lookupEntity('employee', { q })
      .then((res) => {
        if (!cancelled) {
          setUsers(res.items.slice(0, 5));
          setSelectedIndex(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mentionQuery?.query]);

  const insertText = (before: string, after: string = '') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const current = value;
    const next = current.slice(0, start) + before + current.slice(start, end) + after + current.slice(end);
    onChange(next);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + (end - start));
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, users.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (users.length > 0) {
          e.preventDefault();
          const user = users[selectedIndex];
          const start = mentionQuery.start;
          const end = textareaRef.current?.selectionEnd ?? start;
          const current = value;
          const mentionText = `**@${user.chip.primary}** `;
          const next = current.slice(0, start) + mentionText + current.slice(end);
          onChange(next);
          setMentionQuery(null);
          setTimeout(() => {
            const el = textareaRef.current;
            if (el) {
              el.focus();
              const newPos = start + mentionText.length;
              el.setSelectionRange(newPos, newPos);
            }
          }, 0);
        }
      } else if (e.key === 'Escape') {
        setMentionQuery(null);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    onChange(next);

    const pos = e.target.selectionStart;
    const textBefore = next.slice(0, pos);
    
    // Find the last @ that doesn't have a space before the cursor
    const lastAtIndex = textBefore.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const textAfterAt = textBefore.slice(lastAtIndex + 1);
      // If there's no space in the query and it's less than 20 chars
      if (!/\s/.test(textAfterAt) && textAfterAt.length < 20) {
        // Also ensure @ is at start of line or preceded by space
        const charBeforeAt = textBefore.charAt(lastAtIndex - 1);
        if (lastAtIndex === 0 || /\s/.test(charBeforeAt)) {
          setMentionQuery({ start: lastAtIndex, query: textAfterAt });
          return;
        }
      }
    }
    setMentionQuery(null);
  };

  return (
    <div className={`relative flex flex-col rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] ${className || ''}`}>
      <div className="flex items-center gap-1 border-b border-[var(--st-border)] px-2 py-1.5 bg-[var(--st-bg-muted)] rounded-t-md">
        <button
          type="button"
          onClick={() => insertText('**', '**')}
          className="p-1.5 hover:bg-[var(--st-bg)] rounded text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => insertText('_', '_')}
          className="p-1.5 hover:bg-[var(--st-bg)] rounded text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => insertText('\n- ')}
          className="p-1.5 hover:bg-[var(--st-bg)] rounded text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </button>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full resize-y min-h-[120px] bg-transparent p-3 text-[13px] text-[var(--st-text)] outline-none"
      />
      
      {mentionQuery && (
        <div className="absolute left-4 bottom-full mb-1 w-64 rounded-md border border-[var(--st-border)] bg-white shadow-lg shadow-black/5 z-10 overflow-hidden">
          <div className="px-3 py-2 text-[11px] font-semibold text-[var(--st-text-secondary)] bg-[var(--st-bg-muted)] border-b border-[var(--st-border)] flex items-center justify-between">
            <span>People</span>
            {loading && <LoaderCircle className="h-3 w-3 animate-spin" />}
          </div>
          {users.length > 0 ? (
            <div className="max-h-48 overflow-y-auto p-1">
              {users.map((u, i) => (
                <div
                  key={u.id}
                  className={`px-3 py-2 text-[12.5px] cursor-pointer rounded-sm ${
                    i === selectedIndex ? 'bg-[var(--st-text)]/10 text-[var(--st-text)]' : 'text-[var(--st-text)] hover:bg-[var(--st-bg)]'
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault(); // keep focus
                    setSelectedIndex(i);
                    const start = mentionQuery.start;
                    const end = textareaRef.current?.selectionEnd ?? start;
                    const mentionText = `**@${u.chip.primary}** `;
                    onChange(value.slice(0, start) + mentionText + value.slice(end));
                    setMentionQuery(null);
                  }}
                >
                  <div className="font-medium">{u.chip.primary}</div>
                  {u.chip.secondary && <div className="text-[11px] opacity-70">{u.chip.secondary}</div>}
                </div>
              ))}
            </div>
          ) : !loading ? (
            <div className="px-3 py-3 text-[12.5px] text-[var(--st-text-secondary)] text-center">No users found</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
