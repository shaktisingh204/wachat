'use client';
import { cn } from '@/lib/utils';
import { VariableTag } from './VariableTag';

type Props = {
  /** Raw text that may contain `{{variableName}}` references. */
  text: string;
  className?: string;
  /** Maximum total characters to show before truncating (default: 80). */
  maxLength?: number;
};

/**
 * Renders a string that may contain `{{variableName}}` interpolations.
 * Variable references are split out and rendered as orange `<VariableTag>` chips;
 * plain text segments are rendered as-is.
 */
export function WithVariableContent({ text, className, maxLength = 80 }: Props) {
  const truncated = text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
  const parts = splitWithVariables(truncated);

  return (
    <p className={cn('flex flex-wrap items-center gap-x-0.5 gap-y-0.5 leading-snug', className)}>
      {parts.map((part, i) =>
        part.type === 'variable' ? (
          <VariableTag key={i} variableName={part.value} />
        ) : (
          <span key={i}>{part.value}</span>
        ),
      )}
    </p>
  );
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

type Part = { type: 'text' | 'variable'; value: string };

/** Split `"Hello {{name}}, you have {{count}} messages"` into typed segments. */
function splitWithVariables(text: string): Part[] {
  const parts: Part[] = [];
  // Match {{anything}} — non-greedy so adjacent variables work correctly
  const regex = /\{\{([^}]+)\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'variable', value: match[1].trim() });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return parts;
}
