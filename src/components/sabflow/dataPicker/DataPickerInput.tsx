'use client';

/**
 * DataPickerInput, a drop-in replacement for the bare input / textarea used
 * throughout BlockSettingsPanel, now on the 20ui design system.
 *
 * Behaviour:
 *  - Built on 20ui Input / Textarea so it inherits the system focus ring + motion.
 *  - Adds a small braces IconButton that opens an UpstreamDataPicker popover.
 *  - Typing "/" inside the field opens the same popover at the cursor.
 *  - When the picker emits a token, it is spliced into the current cursor
 *    position so users can mix literals and variables in one field.
 *  - When the value contains node-output tokens the control switches to a
 *    monospace face so the panel reader knows this is no longer a static literal.
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
import { Braces } from 'lucide-react';
import { IconButton, Input, Textarea, cn } from '@/components/sabcrm/20ui';
import { useDataPicker } from './DataPickerProvider';
import { UpstreamDataPicker } from './UpstreamDataPicker';
import { isNodeOutputToken } from '@/lib/sabflow/nodeOutputs';
import type { Variable } from '@/lib/sabflow/types';

type CommonProps = {
  value: string;
  onChange: (next: string) => void;
  variables?: Variable[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Picker hint, surfaces type-coercion suggestions for non-string fields. */
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

/** Reserve room on the right edge for the overlaid braces trigger. */
const triggerSpace = 'pr-9';

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
      // If the user typed "/" to open the picker, strip that trailing slash
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
          /* ignore, old browsers */
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
      // Open picker. Don't preventDefault so the slash still appears in the
      // input. `insertToken` will strip it when a field is picked.
      setOpen(true);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
    }
  };

  const exprClass = hasExpression ? 'font-mono text-[12px]' : undefined;

  return (
    <div ref={wrapperRef} className="relative">
      {multiline ? (
        <Textarea
          id={fieldId}
          ref={inputRef as React.MutableRefObject<HTMLTextAreaElement>}
          value={value}
          rows={rows ?? 3}
          onChange={handleChange}
          onKeyDown={handleKey}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(triggerSpace, exprClass, className)}
        />
      ) : (
        <Input
          id={fieldId}
          ref={inputRef as React.MutableRefObject<HTMLInputElement>}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKey}
          placeholder={placeholder}
          disabled={disabled}
          inputMode={inputMode}
          className={cn(triggerSpace, exprClass, className)}
        />
      )}

      <IconButton
        icon={Braces}
        label="Pick from previous node output"
        variant="ghost"
        size="sm"
        aria-pressed={open}
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
        className={cn(
          'absolute right-1.5 top-1.5',
          open && 'bg-[var(--st-bg-muted)] text-[var(--st-text)]',
        )}
      />

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
  // Only treat node-output references as "expression-mode". A bare
  // {{varName}} is the existing simple-template style and shouldn't change
  // the input's appearance.
  return isNodeOutputToken(value);
}
