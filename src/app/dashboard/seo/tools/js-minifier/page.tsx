'use client';

import { Textarea, Switch } from '@/components/sabcrm/20ui/compat';
import { useEffect, useRef, useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function JsMinifierPage() {
  const [text, setText] = useState('');
  const [minified, setMinified] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mangle, setMangle] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const nextId = useRef(0);
  const latestProcessedId = useRef(-1);

  useEffect(() => {
    workerRef.current = new Worker(new URL('./worker.ts', import.meta.url));
    workerRef.current.onmessage = (e: MessageEvent) => {
      const { id, success, result, error } = e.data;
      if (id <= latestProcessedId.current) return;
      latestProcessedId.current = id;
      if (success) {
        setMinified(result || '');
        setError(null);
      } else {
        setError(error);
      }
    };
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  useEffect(() => {
    const id = nextId.current++;
    
    if (!text.trim()) {
      setMinified('');
      setError(null);
      latestProcessedId.current = id;
      return;
    }
    
    // Send to worker
    workerRef.current?.postMessage({ id, code: text, mangle });
  }, [text, mangle]);

  return (
    <ToolShell title="JS Minifier" description="Advanced JavaScript minifier using Terser (preserves strings and regex).">
      <div className="flex items-center gap-2 mb-4">
        <Switch checked={mangle} onCheckedChange={setMangle} id="mangle" />
        <label htmlFor="mangle" className="text-sm font-medium">
          Uglify JS (Variable renaming)
        </label>
      </div>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[200px] font-mono text-xs" placeholder="Paste JS…" />
      <div className="text-sm text-[var(--st-text-secondary)] my-2">
        {error ? <span className="text-[var(--st-text)]">Error: {error}</span> : `${text.length} → ${minified.length} bytes`}
      </div>
      <Textarea readOnly value={minified} className="min-h-[200px] font-mono text-xs" placeholder="Minified code will appear here..." />
    </ToolShell>
  );
}
