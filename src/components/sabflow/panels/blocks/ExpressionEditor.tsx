'use client';

import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { expressionAutocomplete, VariableOption } from '@/lib/sabflow/editor/autocomplete';
import { inputClass } from './shared/primitives';
import { cn } from '@/lib/utils';

type Props = {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
  variables?: VariableOption[];
};

export function ExpressionEditor({
  value,
  onChange,
  placeholder,
  minHeight = '40px',
  className,
  variables = [],
}: Props) {
  const extensions = useMemo(() => {
    const ext = [
      EditorView.theme({
        '&': {
          fontSize: '13px',
          fontFamily: 'var(--font-mono), monospace',
          backgroundColor: 'transparent',
        },
        '.cm-content': {
          padding: '6px 8px',
        },
        '&.cm-focused': {
          outline: 'none',
        },
        '.cm-tooltip-autocomplete': {
          fontFamily: 'var(--font-sans), sans-serif',
        },
      }),
    ];

    if (variables.length > 0) {
      ext.push(expressionAutocomplete(variables));
    }

    return ext;
  }, [variables]);

  return (
    <div className={cn(inputClass, 'p-0 overflow-hidden', className)}>
      <CodeMirror
        value={value}
        height="100%"
        minHeight={minHeight}
        onChange={onChange}
        extensions={extensions}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
        }}
        placeholder={placeholder}
      />
    </div>
  );
}
