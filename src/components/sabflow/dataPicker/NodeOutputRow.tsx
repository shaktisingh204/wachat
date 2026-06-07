'use client';

import type { NodeOutputField, NodeOutputFieldType } from '@/lib/sabflow/nodeOutputs';
import { Badge, Button, cn } from '@/components/sabcrm/20ui';

const TYPE_LABELS: Record<NodeOutputFieldType, string> = {
  string: 'Str',
  number: 'Num',
  boolean: 'Bool',
  object: 'Obj',
  array: 'Arr',
  date: 'Date',
  binary: 'Bin',
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
 * A single field row inside the picker. Click inserts the token. Hover or
 * keyboard focus highlights the row. Type chip on the left, observed example on
 * the right.
 */
export function NodeOutputRow({ field, focused, castHint, onInsert, onFocus }: Props) {
  const typeLabel = TYPE_LABELS[field.type] ?? TYPE_LABELS.string;

  return (
    <div
      role="option"
      aria-selected={focused}
      onMouseEnter={onFocus}
      onClick={() => onInsert(field)}
      className={cn(
        'group flex cursor-pointer items-center gap-2 rounded-[var(--st-radius-sm)] px-2 py-1.5',
        focused ? 'bg-[var(--st-active)]' : 'hover:bg-[var(--st-hover)]',
      )}
    >
      <Badge
        tone="neutral"
        kind="soft"
        className="shrink-0 uppercase tracking-wide"
      >
        {typeLabel}
      </Badge>
      <div className="flex flex-1 flex-col min-w-0 leading-tight">
        <span className="truncate text-[12.5px] font-medium text-[var(--st-text)]">
          {field.label}
        </span>
        <span className="truncate font-mono text-[10.5px] text-[var(--st-text-tertiary)]">
          {field.key}
        </span>
      </div>
      {field.example !== undefined && (
        <span
          title={String(field.example)}
          className="hidden max-w-[120px] truncate font-mono text-[10.5px] text-[var(--st-text-secondary)] md:inline"
        >
          {formatExample(field.example)}
        </span>
      )}
      {castHint && (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onInsert(field, castHint);
          }}
          title={`Insert and cast to ${castHint}`}
          className="shrink-0 font-mono"
        >
          .to{castHint === 'number' ? 'Number' : 'String'}()
        </Button>
      )}
    </div>
  );
}

function formatExample(value: unknown): string {
  if (typeof value === 'string') return value.length > 24 ? `${value.slice(0, 24)}...` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    const json = JSON.stringify(value);
    return json.length > 24 ? `${json.slice(0, 24)}...` : json;
  } catch {
    return '';
  }
}
