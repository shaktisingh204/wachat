'use client';
import { useRef, useState, useCallback, useId } from 'react';
import { cn } from '@/lib/utils';
import { LuBraces } from 'react-icons/lu';

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Known variable names (without braces) for autocomplete */
  variables?: string[];
  multiline?: boolean;
  className?: string;
};

/**
 * A text input (or textarea) that supports `{{variableName}}` interpolation.
 * Shows an autocomplete dropdown of known variables when the user types `{{`.
 */
export function VariableInput({
  value,
  onChange,
  placeholder = '{{variableName}}',
  variables = [],
  multiline = false,
  className,
}: Props) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  /** Cursor position just before the open `{{` token being typed */
  const tokenStartRef = useRef<number>(-1);

  const resolveToken = (text: string, cursor: number) => {
    const before = text.slice(0, cursor);
    const lastOpen = before.lastIndexOf('{{');
    if (lastOpen === -1) return null;
    // Only suggest when we're still inside an unclosed `{{`
    const afterOpen = before.slice(lastOpen + 2);
    if (afterOpen.includes('}}')) return null;
    return { start: lastOpen, partial: afterOpen };
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const text = e.target.value;
    onChange(text);

    const cursor = e.target.selectionStart ?? text.length;
    const token = resolveToken(text, cursor);

    if (token && variables.length > 0) {
      tokenStartRef.current = token.start;
      const partial = token.partial.toLowerCase();
      const matches = variables.filter((v) => v.toLowerCase().startsWith(partial));
      setSuggestions(matches);
      setActiveIndex(0);
    } else {
      setSuggestions([]);
      tokenStartRef.current = -1;
    }
  };

  const applySuggestion = useCallback(
    (varName: string) => {
      const el = inputRef.current;
      if (!el) return;
      const cursor = el.selectionStart ?? value.length;
      const before = value.slice(0, tokenStartRef.current);
      const after = value.slice(cursor);
      const newValue = `${before}{{${varName}}}${after}`;
      onChange(newValue);
      setSuggestions([]);
      tokenStartRef.current = -1;
      // Restore focus & move cursor after the inserted variable
      requestAnimationFrame(() => {
        el.focus();
        const pos = before.length + varName.length + 4; // +4 for {{ and }}
        el.setSelectionRange(pos, pos);
      });
    },
    [value, onChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      applySuggestion(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setSuggestions([]);
    }
  };

  const sharedInputClass = cn(
    'w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)]',
    'px-3 py-2 text-[13px] text-[var(--gray-12)]',
    'outline-none focus:border-[#f76808]',
    'placeholder:text-[var(--gray-8)]',
    'transition-colors',
    className,
  );

  return (
    <div className="relative">
      {multiline ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          id={id}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={3}
          className={cn(sharedInputClass, 'resize-y min-h-[76px]')}
        />
      ) : (
        <div className="relative flex items-center">
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            id={id}
            type="text"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn(sharedInputClass, 'pr-8')}
          />
          <LuBraces
            className="absolute right-2.5 h-3.5 w-3.5 text-[var(--gray-7)] pointer-events-none"
            strokeWidth={1.8}
          />
        </div>
      )}

      {/* Autocomplete dropdown */}
      {suggestions.length > 0 && (
        <ul
          role="listbox"
          className={cn(
            'absolute z-50 mt-1 w-full rounded-lg border border-[var(--gray-5)]',
            'bg-[var(--gray-2)] shadow-lg overflow-hidden',
          )}
        >
          {suggestions.map((varName, idx) => (
            <li
              key={varName}
              role="option"
              aria-selected={idx === activeIndex}
              onMouseDown={(e) => {
                e.preventDefault(); // keep focus on input
                applySuggestion(varName);
              }}
              onMouseEnter={() => setActiveIndex(idx)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 text-[12px] cursor-pointer',
                'transition-colors',
                idx === activeIndex
                  ? 'bg-[var(--gray-4)] text-[var(--gray-12)]'
                  : 'text-[var(--gray-11)] hover:bg-[var(--gray-3)]',
              )}
            >
              <LuBraces className="h-3 w-3 shrink-0 text-[var(--gray-9)]" strokeWidth={1.8} />
              <span className="font-mono">{`{{${varName}}}`}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
