'use client';

import { Textarea } from '@/components/zoruui';
import { useEffect, useRef, useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function JsMinifierPage() {
  const [text, setText] = useState('');
  const [minified, setMinified] = useState('');
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const nextId = useRef(0);

  useEffect(() => {
    workerRef.current = new Worker(new URL('./worker.ts', import.meta.url));
    workerRef.current.onmessage = (e: MessageEvent) => {
      const { success, result, error } = e.data;
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
    if (!text.trim()) {
      setMinified('');
      setError(null);
      return;
    }
    
    // Send to worker
    const id = nextId.current++;
    workerRef.current?.postMessage({ id, code: text });
  }, [text]);

  return (
    <ToolShell title="JS Minifier" description="Advanced JavaScript minifier using Terser (preserves strings and regex).">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[200px] font-mono text-xs" placeholder="Paste JS…" />
      <div className="text-sm text-muted-foreground my-2">
        {error ? <span className="text-destructive">Error: {error}</span> : `${text.length} → ${minified.length} bytes`}
      </div>
      <Textarea readOnly value={minified} className="min-h-[200px] font-mono text-xs" placeholder="Minified code will appear here..." />
    </ToolShell>
  );
}
