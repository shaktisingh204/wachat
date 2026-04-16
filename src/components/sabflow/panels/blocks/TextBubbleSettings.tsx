'use client';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { Block, Variable } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import {
  LuMessageSquare,
  LuBold,
  LuItalic,
  LuBraces,
  LuChevronDown,
} from 'react-icons/lu';
import { VariableAutocompleteInput } from './shared/VariableAutocompleteInput';

/* ── Shared primitives ──────────────────────────────────────── */
const inputClass =
  'w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] text-[var(--gray-12)] placeholder:text-[var(--gray-8)] outline-none focus:border-[#f76808] transition-colors';

/* ── Variable highlight renderer ────────────────────────────── */
/**
 * Renders a text string with `{{variableName}}` tokens highlighted in orange.
 * Used as a read-only overlay — the real textarea sits on top.
 */
function HighlightedText({ text }: { text: string }) {
  const parts = text.split(/({{[^}]*}})/g);
  return (
    <>
      {parts.map((part, i) =>
        /^{{.*}}$/.test(part) ? (
          <span key={i} className="text-[#f76808] font-medium">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

/* ── Variable picker dropdown ───────────────────────────────── */
type VariablePickerProps = {
  variables: string[];
  onSelect: (varName: string) => void;
};

function VariablePicker({ variables, onSelect }: VariablePickerProps) {
  const [open, setOpen] = useState(false);

  if (variables.length === 0) {
    return (
      <button
        type="button"
        title="No variables defined in this flow"
        disabled
        className="flex items-center gap-1 rounded-md border border-[var(--gray-5)] bg-[var(--gray-2)] px-2 py-1 text-[12px] text-[var(--gray-8)] cursor-not-allowed"
      >
        <LuBraces className="h-3.5 w-3.5" strokeWidth={1.8} />
        Variable
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-md border border-[var(--gray-5)] bg-[var(--gray-2)] px-2 py-1 text-[12px] text-[var(--gray-11)] hover:border-[#f76808] hover:text-[#f76808] transition-colors"
      >
        <LuBraces className="h-3.5 w-3.5" strokeWidth={1.8} />
        Variable
        <LuChevronDown className="h-3 w-3" strokeWidth={2} />
      </button>

      {open && (
        <>
          {/* Click-away backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <ul
            role="listbox"
            className="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] shadow-lg overflow-hidden"
          >
            {variables.map((varName) => (
              <li
                key={varName}
                role="option"
                aria-selected={false}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(varName);
                  setOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-2 text-[12px] font-mono cursor-pointer text-[var(--gray-11)] hover:bg-[var(--gray-4)] hover:text-[#f76808] transition-colors"
              >
                {`{{${varName}}}`}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────── */
type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  /** Known variable names (without braces) for the picker */
  variables?: string[];
  className?: string;
};

export function TextBubbleSettings({
  block,
  onBlockChange,
  variables = [],
  className,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const options = block.options ?? {};
  const content = String(options.content ?? '');

  /* Adapt the legacy string[] `variables` prop to the Variable[] shape that
     VariableAutocompleteInput expects. */
  const variableObjects = useMemo<Variable[]>(
    () => variables.map((name) => ({ id: name, name })),
    [variables],
  );

  const updateContent = useCallback(
    (newContent: string) => {
      onBlockChange({ ...block, options: { ...options, content: newContent } });
    },
    [block, options, onBlockChange],
  );

  /* ── Toolbar actions ─────────────────────────────────────── */
  const wrapSelection = useCallback(
    (prefix: string, suffix: string) => {
      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const selected = content.slice(start, end);
      const newContent =
        content.slice(0, start) + prefix + selected + suffix + content.slice(end);
      updateContent(newContent);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + prefix.length, end + prefix.length);
      });
    },
    [content, updateContent],
  );

  const insertVariable = useCallback(
    (varName: string) => {
      const el = textareaRef.current;
      const cursor = el?.selectionStart ?? content.length;
      const newContent =
        content.slice(0, cursor) + `{{${varName}}}` + content.slice(cursor);
      updateContent(newContent);
      requestAnimationFrame(() => {
        el?.focus();
        const pos = cursor + varName.length + 4;
        el?.setSelectionRange(pos, pos);
      });
    },
    [content, updateContent],
  );

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f76808]/10">
          <LuMessageSquare className="h-4 w-4 text-[#f76808]" strokeWidth={1.8} />
        </div>
        <span className="text-[13px] font-semibold text-[var(--gray-12)]">
          Text Bubble
        </span>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
          Message
        </label>

        {/* Toolbar */}
        <div className="flex items-center gap-1 rounded-t-lg border border-b-0 border-[var(--gray-5)] bg-[var(--gray-3)] px-2 py-1.5">
          <button
            type="button"
            title="Bold (wraps selection with **)"
            onMouseDown={(e) => {
              e.preventDefault();
              wrapSelection('**', '**');
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-[var(--gray-9)] hover:bg-[var(--gray-5)] hover:text-[var(--gray-12)] transition-colors"
          >
            <LuBold className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
          <button
            type="button"
            title="Italic (wraps selection with _)"
            onMouseDown={(e) => {
              e.preventDefault();
              wrapSelection('_', '_');
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-[var(--gray-9)] hover:bg-[var(--gray-5)] hover:text-[var(--gray-12)] transition-colors"
          >
            <LuItalic className="h-3.5 w-3.5" strokeWidth={2} />
          </button>

          <div className="mx-1 h-4 w-px bg-[var(--gray-5)]" />

          <VariablePicker variables={variables} onSelect={insertVariable} />
        </div>

        {/* Textarea with highlighted preview below */}
        <VariableAutocompleteInput
          type="textarea"
          value={content}
          onChange={updateContent}
          variables={variableObjects}
          placeholder="Type your message… Use {{variable}} to insert variables"
          rows={5}
          spellCheck={false}
          aria-label="Message content"
          className="rounded-t-none min-h-[100px]"
          inputRef={(node) => {
            textareaRef.current = node as HTMLTextAreaElement | null;
          }}
        />

        {/* Live variable highlight preview */}
        {content && (
          <div className="rounded-lg border border-[var(--gray-4)] bg-[var(--gray-2)] px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words">
            <HighlightedText text={content} />
          </div>
        )}
      </div>

      <p className="text-[11px] text-[var(--gray-8)] leading-relaxed">
        Use{' '}
        <code className="font-mono bg-[var(--gray-3)] px-1 rounded text-[#f76808]">
          {'{{variableName}}'}
        </code>{' '}
        to insert dynamic values collected earlier in the flow.
      </p>
    </div>
  );
}
