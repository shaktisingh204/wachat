'use client';

import { Textarea } from '@/components/zoruui';
import { useState, useEffect, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';

import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function HtmlFormatterPage() {
  const [text, setText] = useState('');
  const [out, setOut] = useState('');
  const [error, setError] = useState('');
  const [isFormatting, setIsFormatting] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('./formatter.worker.ts', import.meta.url));
    workerRef.current.onmessage = (e) => {
      setIsFormatting(false);
      if (e.data.error) {
        setError(e.data.error);
      } else {
        setError('');
        setOut(e.data.result);
      }
    };
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const formatText = useDebouncedCallback((input: string) => {
    if (!input.trim()) {
      setOut('');
      setError('');
      setIsFormatting(false);
      return;
    }
    setIsFormatting(true);
    workerRef.current?.postMessage({ text: input });
  }, 300);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    formatText(val);
  };

  return (
    <ToolShell title="HTML Formatter" description="Pretty-print minified or messy HTML.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold">Input HTML</label>
          <Textarea 
            value={text} 
            onChange={handleChange} 
            className="min-h-[400px] font-mono text-xs" 
            placeholder="Paste HTML…" 
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold">
            Formatted Output
            {isFormatting && <span className="ml-2 text-muted-foreground text-xs">(Formatting...)</span>}
          </label>
          {error ? (
            <div className="min-h-[400px] rounded-md border border-destructive bg-destructive/10 p-4 text-xs font-mono text-destructive overflow-auto whitespace-pre-wrap">
              {error}
            </div>
          ) : (
            <Textarea 
              readOnly 
              value={out} 
              className="min-h-[400px] font-mono text-xs bg-muted/30" 
              placeholder="Formatted HTML will appear here..."
            />
          )}
        </div>
      </div>
    </ToolShell>
  );
}
