'use client';

import type { NodeOutputField, NodeOutputFieldType } from '@/lib/sabflow/nodeOutputs';
import { cn } from '@/lib/utils';

const TYPE_STYLES: Record<NodeOutputFieldType, { bg: string; text: string; label: string }> = {
  string:  { bg: 'bg-blue-50 dark:bg-blue-950/40',    text: 'text-blue-600 dark:text-blue-400',     label: 'Str' },
  number:  { bg: 'bg-violet-50 dark:bg-violet-950/40', text: 'text-violet-600 dark:text-violet-400', label: 'Num' },
  boolean: { bg: 'bg-green-50 dark:bg-green-950/40',  text: 'text-green-600 dark:text-green-400',   label: 'Bool' },
  object:  { bg: 'bg-amber-50 dark:bg-amber-950/40',  text: 'text-amber-600 dark:text-amber-400',   label: 'Obj' },
  array:   { bg: 'bg-pink-50 dark:bg-pink-950/40',    text: 'text-pink-600 dark:text-pink-400',     label: 'Arr' },
  date:    { bg: 'bg-cyan-50 dark:bg-cyan-950/40',    text: 'text-cyan-600 dark:text-cyan-400',     label: 'Date' },
  binary:  { bg: 'bg-slate-100 dark:bg-slate-900/40', text: 'text-slate-600 dark:text-slate-400',   label: 'Bin' },
};

type Props = {
  field: NodeOutputField;
  focused: boolean;
  /**
   * Optional cast suggestion to surface alongside the field (e.g. "as number").
   * When present and clicked, inserts a wrapped token.
   */
  castHint?: 'number' | 'string';
  onInsert: (field: NodeOutputField, cast?: 'number' | 'string') => void;
  onFocus: () => void;
};

/**
 * A single field row inside the picker.  Click → insert token.  Hover or
 * keyboard focus → highlight.  Type chip on the left, observed example on
 * the right.
 */
export function NodeOutputRow({ field, focused, castHint, onInsert, onFocus }: Props) {
  const style = TYPE_STYLES[field.type] ?? TYPE_STYLES.string;

  return (
    <div
      role="option"
      aria-selected={focused}
      onMouseEnter={onFocus}
      onClick={() => onInsert(field)}
      className={cn(
        'group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5',
        focused ? 'bg-[#f76808]/10' : 'hover:bg-[var(--gray-3)]',
      )}
    >
      <span
        className={cn(
          'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
          style.bg,
          style.text,
        )}
      >
        {style.label}
      </span>
      <div className="flex flex-1 flex-col min-w-0 leading-tight">
        <span className="truncate text-[12.5px] font-medium text-[var(--gray-12)]">
          {field.label}
        </span>
        <span className="truncate font-mono text-[10.5px] text-[var(--gray-9)]">
          {field.key}
        </span>
      </div>
      {field.example !== undefined && (
        <span
          title={String(field.example)}
          className="hidden max-w-[120px] truncate font-mono text-[10.5px] text-[var(--gray-10)] md:inline"
        >
          {formatExample(field.example)}
        </span>
      )}
      {castHint && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onInsert(field, castHint);
          }}
          title={`Insert and cast to ${castHint}`}
          className="shrink-0 rounded border border-[var(--gray-5)] bg-[var(--gray-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--gray-11)] hover:border-[#f76808] hover:text-[#f76808]"
        >
          .to{castHint === 'number' ? 'Number' : 'String'}()
        </button>
      )}
    </div>
  );
}

function formatExample(value: unknown): string {
  if (typeof value === 'string') return value.length > 24 ? `${value.slice(0, 24)}…` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    const json = JSON.stringify(value);
    return json.length > 24 ? `${json.slice(0, 24)}…` : json;
  } catch {
    return '';
  }
}
