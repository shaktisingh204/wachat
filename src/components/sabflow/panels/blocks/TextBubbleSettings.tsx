'use client';

import { useCallback, useMemo, useRef } from 'react';
import type { Block, Variable } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import {
  MessageSquare,
  Bold,
  Italic,
  Braces,
  ChevronDown,
} from 'lucide-react';
import {
  Button,
  IconButton,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/sabcrm/20ui';
import { VariableAutocompleteInput } from './shared/VariableAutocompleteInput';

/* ── Variable highlight renderer ────────────────────────────── */
/**
 * Renders a text string with `{{variableName}}` tokens highlighted.
 * Used as a read-only overlay below the editor.
 */
function HighlightedText({ text }: { text: string }) {
  const parts = text.split(/({{[^}]*}})/g);
  return (
    <>
      {parts.map((part, i) =>
        /^{{.*}}$/.test(part) ? (
          <span key={i} className="font-medium text-[var(--st-accent)]">
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
  if (variables.length === 0) {
    return (
      <Button
        variant="secondary"
        size="sm"
        iconLeft={Braces}
        disabled
        title="No variables defined in this flow"
      >
        Variable
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" iconLeft={Braces} iconRight={ChevronDown}>
          Variable
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[160px]">
        {variables.map((varName) => (
          <DropdownMenuItem
            key={varName}
            onSelect={() => onSelect(varName)}
            className="font-mono"
          >
            {`{{${varName}}}`}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
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
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)]">
          <MessageSquare className="h-4 w-4 text-[var(--st-accent)]" aria-hidden="true" />
        </div>
        <span className="text-[13px] font-semibold text-[var(--st-text)]">
          Text Bubble
        </span>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11.5px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
          Message
        </label>

        {/* Toolbar */}
        <div className="flex items-center gap-1 rounded-t-[var(--st-radius)] border border-b-0 border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 py-1.5">
          <IconButton
            label="Bold (wraps selection with **)"
            icon={Bold}
            variant="ghost"
            size="sm"
            onMouseDown={(e) => {
              e.preventDefault();
              wrapSelection('**', '**');
            }}
          />
          <IconButton
            label="Italic (wraps selection with _)"
            icon={Italic}
            variant="ghost"
            size="sm"
            onMouseDown={(e) => {
              e.preventDefault();
              wrapSelection('_', '_');
            }}
          />

          <div className="mx-1 h-4 w-px bg-[var(--st-border)]" aria-hidden="true" />

          <VariablePicker variables={variables} onSelect={insertVariable} />
        </div>

        {/* Textarea with highlighted preview below */}
        <VariableAutocompleteInput
          type="textarea"
          value={content}
          onChange={updateContent}
          variables={variableObjects}
          placeholder="Type your message... Use {{variable}} to insert variables"
          rows={5}
          spellCheck={false}
          aria-label="Message content"
          className="min-h-[100px] rounded-t-none"
          inputRef={(node) => {
            textareaRef.current = node as HTMLTextAreaElement | null;
          }}
        />

        {/* Live variable highlight preview */}
        {content && (
          <div className="whitespace-pre-wrap break-words rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 text-[13px] leading-relaxed text-[var(--st-text)]">
            <HighlightedText text={content} />
          </div>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-[var(--st-text-tertiary)]">
        Use{' '}
        <code className="rounded bg-[var(--st-bg-secondary)] px-1 font-mono text-[var(--st-accent)]">
          {'{{variableName}}'}
        </code>{' '}
        to insert dynamic values collected earlier in the flow.
      </p>
    </div>
  );
}
