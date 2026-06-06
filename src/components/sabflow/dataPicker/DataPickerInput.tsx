'use client';

/**
 * DataPickerInput — drop-in replacement for the bare `<input>` / `<textarea>`
 * used throughout BlockSettingsPanel.
 *
 * Behaviour:
 *  - Visually identical to the existing inputs (same className signature).
 *  - Adds a small `{x}` button that opens an UpstreamDataPicker popover.
 *  - Typing `/` inside the field opens the same popover at the cursor.
 *  - When the picker emits a token, it's spliced into the current cursor
 *    position so users can mix literals + variables in one field.
 *  - When the value contains node-output tokens, a small "Expression" badge
 *    is shown next to the field label so the panel reader knows this is no
 *    longer a static literal.
 */

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { LuBraces } from 'react-icons/lu';
import { useDataPicker } from './DataPickerProvider';
import { UpstreamDataPicker } from './UpstreamDataPicker';
import { isNodeOutputToken } from '@/lib/sabflow/nodeOutputs';
import type { Variable } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';

type CommonProps = {
  value: string;
  onChange: (next: string) => void;
  variables?: Variable[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Picker hint — surfaces type-coercion suggestions for non-string fields. */
  expectedType?: 'string' | 'number';
  /** Render as multi-line textarea instead of single-line input. */
  multiline?: boolean;
  /** Number of textarea rows when `multiline` is true. */
  rows?: number;
  /** ARIA label / id linkage. */
  id?: string;
  /** Optional inputMode for soft-keyboards. */
  inputMode?: 'text' | 'numeric' | 'decimal' | 'email' | 'tel' | 'url' | 'search';
};

const baseClass =
  'w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 pr-9 text-[13px] text-[var(--gray-12)] placeholder:text-[var(--gray-8)] outline-none focus:border-[var(--st-border)] transition-colors';

export function DataPickerInput(props: CommonProps) {
  const {
    value,
    onChange,
    variables = [],
    placeholder,
    disabled,
    className,
    expectedType = 'string',
    multiline,
    rows,
    id,
    inputMode,
  } = props;

  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  const { upstream } = useDataPicker();
  const hasExpression = containsExpression(value);

  /* Close picker on outside click. */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const insertToken = useCallback(
    (token: string) => {
      const el = inputRef.current;
      if (!el) {
        onChange(`${value}${token}`);
        return;
      }
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      // If the user typed `/` to open the picker, strip that trailing slash
      // before the cursor so the inserted token replaces it.
      const before = value.slice(0, start).replace(/\/$/, '');
      const after = value.slice(end);
      const next = `${before}${token}${after}`;
      onChange(next);
      requestAnimationFrame(() => {
        const cursor = before.length + token.length;
        try {
          el.focus();
          el.setSelectionRange(cursor, cursor);
        } catch {
          /* ignore — old browsers */
        }
      });
    },
    [onChange, value],
  );

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === '/' && !open) {
      // Open picker — don't preventDefault so the slash still appears in the
      // input.  `insertToken` will strip it when a field is picked.
      setOpen(true);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      {multiline ? (
        <textarea
          id={fieldId}
          ref={inputRef as React.MutableRefObject<HTMLTextAreaElement>}
          value={value}
          rows={rows ?? 3}
          onChange={handleChange}
          onKeyDown={handleKey}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(baseClass, hasExpression && 'font-mono text-[12px]', className)}
        />
      ) : (
        <input
          id={fieldId}
          ref={inputRef as React.MutableRefObject<HTMLInputElement>}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKey}
          placeholder={placeholder}
          disabled={disabled}
          inputMode={inputMode}
          className={cn(baseClass, hasExpression && 'font-mono text-[12px]', className)}
        />
      )}

      <button
        type="button"
        title="Pick from previous node output"
        aria-label="Pick from previous node output"
        onClick={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
        className={cn(
          'absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-md border transition-colors',
          open
            ? 'border-[var(--st-border)] bg-[var(--st-text)]/10 text-[var(--st-text)]'
            : 'border-transparent text-[var(--gray-9)] hover:border-[var(--gray-5)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]',
        )}
      >
        <LuBraces className="h-3.5 w-3.5" strokeWidth={2} />
      </button>

      {open && (
        <UpstreamDataPicker
          upstream={upstream}
          variables={variables}
          expectedType={expectedType}
          onPick={insertToken}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function containsExpression(value: string): boolean {
  if (!value || value.indexOf('{{') === -1) return false;
  // Only treat node-output references as "expression-mode" — bare
  // `{{varName}}` is the existing simple-template style and shouldn't change
  // the input's appearance.
  return isNodeOutputToken(value);
}
