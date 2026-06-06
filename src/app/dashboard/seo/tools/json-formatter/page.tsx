'use client';

import { useState, useRef, useMemo } from 'react';
import { Button, Textarea, Alert, SegmentedControl } from '@/components/sabcrm/20ui';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { JsonTreeView } from '@/components/sabflow/inspector/JsonTreeView';
import { Upload, Download, Code, FileJson, ListTree } from 'lucide-react';

function getPosFromLineCol(text: string, line: number, col: number) {
  const lines = text.split('\n');
  let currentPos = 0;
  for (let i = 0; i < line - 1; i++) {
    if (i < lines.length) {
      currentPos += lines[i].length + 1;
    }
  }
  return currentPos + col - 1;
}

function parseJsonError(e: unknown, text: string) {
  const msg = e instanceof Error ? e.message : 'Invalid JSON';
  let line, col, pos;

  const v8Pos = msg.match(/at position (\d+)/);
  if (v8Pos) pos = parseInt(v8Pos[1], 10);

  const v8LineCol = msg.match(/\(line (\d+) column (\d+)\)/);
  const ffLineCol = msg.match(/line (\d+) column (\d+)/);

  if (v8LineCol) {
    line = parseInt(v8LineCol[1], 10);
    col = parseInt(v8LineCol[2], 10);
  } else if (ffLineCol) {
    line = parseInt(ffLineCol[1], 10);
    col = parseInt(ffLineCol[2], 10);
  }

  if (pos === undefined && line !== undefined && col !== undefined) {
    pos = getPosFromLineCol(text, line, col);
  }

  return { message: msg, pos };
}

function JsonHighlighter({ jsonString }: { jsonString: string }) {
  const highlighted = useMemo(() => {
    if (!jsonString) return '';
    const sanitized = jsonString.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return sanitized.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        let cls = 'text-[var(--st-text)] dark:text-[var(--st-text-secondary)]';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'text-[var(--st-text)] dark:text-[var(--st-text-secondary)] font-medium';
            } else {
                cls = 'text-[var(--st-text)] dark:text-[var(--st-text-secondary)]';
            }
        } else if (/true|false/.test(match)) {
            cls = 'text-[var(--st-text)]';
        } else if (/null/.test(match)) {
            cls = 'text-[var(--st-text)] italic';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
  }, [jsonString]);

  return (
    <pre
      className="p-4 bg-[var(--st-bg-secondary)] rounded-[var(--st-radius)] font-mono text-xs overflow-auto min-h-[300px] max-h-[600px] border border-[var(--st-border)]"
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  );
}

type ViewMode = 'raw' | 'highlighted' | 'tree';

const VIEW_ITEMS = [
  { value: 'raw' as const, label: 'Raw', icon: Code },
  { value: 'highlighted' as const, label: 'Highlighted', icon: FileJson },
  { value: 'tree' as const, label: 'Tree Viewer', icon: ListTree },
];

export default function JsonFormatterPage() {
  const [text, setText] = useState('');
  const [error, setError] = useState<{ message: string; pos?: number } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('raw');
  const [parsedData, setParsedData] = useState<unknown>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const processJson = (action: 'format' | 'minify' | 'validate' = 'validate', currentText = text) => {
    setError(null);
    try {
      const parsed = JSON.parse(currentText);
      setParsedData(parsed);
      if (action === 'format') {
        setText(JSON.stringify(parsed, null, 2));
      } else if (action === 'minify') {
        setText(JSON.stringify(parsed));
      }
      return true;
    } catch (e: unknown) {
      setError(parseJsonError(e, currentText));
      return false;
    }
  };

  const format = () => processJson('format');
  const minify = () => processJson('minify');

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setText(content);
      if (!processJson('validate', content)) {
        setViewMode('raw');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownload = () => {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'formatted.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleViewChange = (mode: ViewMode) => {
    if (mode === 'tree' || mode === 'highlighted') {
      if (!processJson('validate')) return;
    }
    setViewMode(mode);
  };

  return (
    <ToolShell title="JSON Formatter" description="Format, minify, and visualize JSON with validation.">
      <div className="flex flex-col sm:flex-row gap-4 mb-4 justify-between items-start sm:items-center">
        <SegmentedControl<ViewMode>
          items={VIEW_ITEMS}
          value={viewMode}
          onChange={handleViewChange}
          aria-label="JSON view mode"
        />

        <div className="flex gap-2">
          <input
            type="file"
            accept=".json,application/json"
            className="hidden"
            ref={fileInputRef}
            onChange={handleUpload}
          />
          <Button variant="outline" size="sm" iconLeft={Upload} onClick={() => fileInputRef.current?.click()}>
            Upload
          </Button>
          <Button variant="outline" size="sm" iconLeft={Download} onClick={handleDownload} disabled={!text}>
            Download
          </Button>
        </div>
      </div>

      <div className="mb-4">
        {viewMode === 'raw' && (
          <Textarea
            value={text}
            onChange={(e) => {
               setText(e.target.value);
               if (error) setError(null);
            }}
            className="min-h-[300px] font-mono text-xs"
            placeholder='{"hello": "world"}'
            aria-label="JSON input"
          />
        )}
        {viewMode === 'highlighted' && (
          <JsonHighlighter jsonString={text} />
        )}
        {viewMode === 'tree' && (
          <div className="min-h-[300px] max-h-[600px] overflow-auto border border-[var(--st-border)] rounded-[var(--st-radius)] bg-[var(--st-bg)] p-4">
            <JsonTreeView data={parsedData} />
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        <Button variant="primary" onClick={format}>Format</Button>
        <Button variant="outline" onClick={minify}>Minify</Button>
      </div>

      {error && (
        <Alert tone="danger" title={error.message}>
          {error.pos !== undefined && text && (
            <pre className="mt-1 text-xs font-mono text-[var(--st-text)] bg-[var(--st-bg-secondary)] p-2 rounded-[var(--st-radius)] overflow-x-auto whitespace-pre-wrap break-words">
              {Math.max(0, error.pos - 40) > 0 && '...'}
              {text.slice(Math.max(0, error.pos - 40), error.pos)}
              <span className="bg-[var(--st-danger)] text-[var(--st-text-inverted)] font-bold px-1 rounded-[var(--st-radius)] shadow-sm">
                {text[error.pos] === '\n' ? '↵' : text[error.pos] === ' ' ? '␣' : (text[error.pos] || 'EOF')}
              </span>
              {text.slice(error.pos + 1, Math.min(text.length, error.pos + 40))}
              {Math.min(text.length, error.pos + 40) < text.length && '...'}
            </pre>
          )}
        </Alert>
      )}
    </ToolShell>
  );
}
