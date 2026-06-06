'use client';

import { Button, Textarea, Card, ZoruCardContent, cn } from '@/components/sabcrm/20ui/compat';
import { cn as _zoruCn, useState, useRef, useMemo } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { JsonTreeView } from '@/components/sabflow/inspector/JsonTreeView';
import { LuUpload, LuDownload, LuCode, LuFileJson, LuListTree } from 'react-icons/lu';

void _zoruCn;

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
        let cls = 'text-zoru-ink dark:text-zoru-ink-muted';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'text-zoru-ink dark:text-zoru-ink-muted font-medium';
            } else {
                cls = 'text-zoru-ink dark:text-zoru-ink-muted';
            }
        } else if (/true|false/.test(match)) {
            cls = 'text-zoru-ink';
        } else if (/null/.test(match)) {
            cls = 'text-zoru-ink italic';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
  }, [jsonString]);

  return (
    <pre 
      className="p-4 bg-[var(--gray-2)] rounded-md font-mono text-xs overflow-auto min-h-[300px] max-h-[600px] border border-zoru-line"
      dangerouslySetInnerHTML={{ __html: highlighted }} 
    />
  );
}

export default function JsonFormatterPage() {
  const [text, setText] = useState('');
  const [error, setError] = useState<{ message: string; pos?: number } | null>(null);
  const [viewMode, setViewMode] = useState<'raw' | 'highlighted' | 'tree'>('raw');
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

  const handleViewChange = (mode: 'raw' | 'highlighted' | 'tree') => {
    if (mode === 'tree' || mode === 'highlighted') {
      if (!processJson('validate')) return;
    }
    setViewMode(mode);
  };

  return (
    <ToolShell title="JSON Formatter" description="Format, minify, and visualize JSON with validation.">
      <div className="flex flex-col sm:flex-row gap-4 mb-4 justify-between items-start sm:items-center">
        <div className="flex gap-1 bg-zoru-surface-2 dark:bg-zoru-ink p-1 rounded-lg">
          <Button 
            variant={viewMode === 'raw' ? 'default' : 'ghost'} 
            size="sm" 
            onClick={() => handleViewChange('raw')}
          >
            <LuCode className="w-4 h-4 mr-2" /> Raw
          </Button>
          <Button 
            variant={viewMode === 'highlighted' ? 'default' : 'ghost'} 
            size="sm" 
            onClick={() => handleViewChange('highlighted')}
          >
            <LuFileJson className="w-4 h-4 mr-2" /> Highlighted
          </Button>
          <Button 
            variant={viewMode === 'tree' ? 'default' : 'ghost'} 
            size="sm" 
            onClick={() => handleViewChange('tree')}
          >
            <LuListTree className="w-4 h-4 mr-2" /> Tree Viewer
          </Button>
        </div>

        <div className="flex gap-2">
          <input 
            type="file" 
            accept=".json,application/json" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleUpload} 
          />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <LuUpload className="w-4 h-4 mr-2" /> Upload
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={!text}>
            <LuDownload className="w-4 h-4 mr-2" /> Download
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
          />
        )}
        {viewMode === 'highlighted' && (
          <JsonHighlighter jsonString={text} />
        )}
        {viewMode === 'tree' && (
          <div className="min-h-[300px] max-h-[600px] overflow-auto border border-zoru-line rounded-md bg-[var(--gray-1)] p-4">
            <JsonTreeView data={parsedData} />
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        <Button onClick={format}>Format</Button>
        <Button variant="outline" onClick={minify}>Minify</Button>
      </div>

      {error && (
        <Card className="border-zoru-line overflow-hidden">
          <ZoruCardContent className="p-4 bg-zoru-surface-2/50">
            <p className="text-zoru-ink font-semibold mb-2">{error.message}</p>
            {error.pos !== undefined && text && (
              <pre className="text-xs font-mono text-zoru-ink bg-zoru-surface-2 p-2 rounded overflow-x-auto whitespace-pre-wrap break-words">
                {Math.max(0, error.pos - 40) > 0 && '...'}
                {text.slice(Math.max(0, error.pos - 40), error.pos)}
                <span className="bg-zoru-ink text-white font-bold px-1 rounded shadow-sm">
                  {text[error.pos] === '\n' ? '↵' : text[error.pos] === ' ' ? '␣' : (text[error.pos] || 'EOF')}
                </span>
                {text.slice(error.pos + 1, Math.min(text.length, error.pos + 40))}
                {Math.min(text.length, error.pos + 40) < text.length && '...'}
              </pre>
            )}
          </ZoruCardContent>
        </Card>
      )}
    </ToolShell>
  );
}
