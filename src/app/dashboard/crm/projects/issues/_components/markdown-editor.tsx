'use client';

import * as React from 'react';
import { marked } from 'marked';
import { Textarea } from '@/components/zoruui';

interface MarkdownEditorProps {
  id?: string;
  name?: string;
  value?: string;
  onChange?: (value: string) => void;
  defaultValue?: string;
  placeholder?: string;
  rows?: number;
}

export function MarkdownEditor({
  id,
  name,
  value: controlledValue,
  onChange,
  defaultValue = '',
  placeholder,
  rows = 5,
}: MarkdownEditorProps) {
  const [mode, setMode] = React.useState<'write' | 'preview'>('write');
  const [internalValue, setInternalValue] = React.useState(defaultValue);

  const value = controlledValue !== undefined ? controlledValue : internalValue;
  
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    if (controlledValue === undefined) {
      setInternalValue(newVal);
    }
    onChange?.(newVal);
  };

  return (
    <div className="rounded-md border border-zoru-line bg-zoru-surface">
      <div className="flex items-center gap-2 border-b border-zoru-line px-2 py-1">
        <button
          type="button"
          onClick={() => setMode('write')}
          className={`px-3 py-1 text-[12px] font-medium rounded-md transition ${
            mode === 'write' ? 'bg-zoru-surface-2 text-zoru-ink' : 'text-zoru-ink-muted hover:text-zoru-ink'
          }`}
        >
          Write
        </button>
        <button
          type="button"
          onClick={() => setMode('preview')}
          className={`px-3 py-1 text-[12px] font-medium rounded-md transition ${
            mode === 'preview' ? 'bg-zoru-surface-2 text-zoru-ink' : 'text-zoru-ink-muted hover:text-zoru-ink'
          }`}
        >
          Preview
        </button>
      </div>
      <div className="p-2">
        {mode === 'write' ? (
          <Textarea
            id={id}
            name={name}
            value={value}
            onChange={handleChange}
            rows={rows}
            placeholder={placeholder}
            className="border-0 bg-transparent focus-visible:ring-0 p-0 resize-y min-h-[120px]"
          />
        ) : (
          <div
            className="prose prose-sm dark:prose-invert min-h-[120px] px-3 py-2 text-[13.5px] text-zoru-ink"
            dangerouslySetInnerHTML={{ __html: value ? marked.parse(value) as string : '<span class="text-zoru-ink-muted italic">Nothing to preview</span>' }}
          />
        )}
        {mode === 'preview' && (
          <input type="hidden" name={name} value={value} />
        )}
      </div>
    </div>
  );
}
