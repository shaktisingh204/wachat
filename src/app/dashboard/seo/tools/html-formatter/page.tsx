'use client';

import { Textarea } from '@/components/sabcrm/20ui';
import { FileUploadCard } from '@/components/sabcrm/20ui';
import { Button } from '@/components/sabcrm/20ui';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { Copy, Check } from 'lucide-react';

import { ToolShell } from '@/components/seo-tools/tool-shell';

function SyntaxHighlightedHtml({ html }: { html: string }) {
  const elements = useMemo(() => {
    if (!html) return null;
    const tokenized = html.split(/(<[^>]+>)/g);
    
    return tokenized.map((token, i) => {
      if (i % 2 === 0) {
        return <span key={i} className="text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">{token}</span>;
      }
      
      if (token.startsWith('<!--')) {
        return <span key={i} className="text-[var(--st-text)] italic">{token}</span>;
      }
      
      const match = token.match(/^(<\/?)([a-zA-Z0-9:-]+)(.*?)(\/?>)$/s);
      if (!match) {
        return <span key={i} className="text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">{token}</span>;
      }
      
      const [, prefix, tagName, rest, suffix] = match;
      
      const restParts = rest.split(/([a-zA-Z0-9-]+=['"][^'"]*['"])/g);
      
      return (
        <span key={i}>
          <span className="text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">{prefix}{tagName}</span>
          {restParts.map((rp, j) => {
            const m = rp.match(/^([a-zA-Z0-9-]+)(=)(['"][^'"]*['"])$/);
            if (m) {
              return (
                <span key={j}>
                  <span className="text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">{m[1]}</span>
                  <span className="text-[var(--st-text)]">{m[2]}</span>
                  <span className="text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">{m[3]}</span>
                </span>
              );
            }
            return <span key={j} className="text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">{rp}</span>;
          })}
          <span className="text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">{suffix}</span>
        </span>
      );
    });
  }, [html]);

  return <div className="whitespace-pre-wrap font-mono text-xs w-full h-full text-left">{elements}</div>;
}

export default function HtmlFormatterPage() {
  const [text, setText] = useState('');
  const [out, setOut] = useState('');
  const [error, setError] = useState('');
  const [isFormatting, setIsFormatting] = useState(false);
  const [copied, setCopied] = useState(false);
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

  const handleFilesSelected = (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setText(content);
      formatText(content);
    };
    reader.readAsText(file);
  };

  const copyToClipboard = async () => {
    if (!out) return;
    try {
      await navigator.clipboard.writeText(out);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <ToolShell title="HTML Formatter" description="Pretty-print minified or messy HTML.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold">Input HTML</label>
          <FileUploadCard
            accept=".html,.htm,.txt"
            multiple={false}
            onFilesSelected={handleFilesSelected}
            hint="Upload an HTML file to format"
          />
          <Textarea 
            value={text} 
            onChange={handleChange} 
            className="min-h-[400px] font-mono text-xs mt-2" 
            placeholder="Or paste HTML here…" 
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold">
              Formatted Output
              {isFormatting && <span className="ml-2 text-[var(--st-text-secondary)] text-xs">(Formatting...)</span>}
            </label>
            {out && !error && (
              <Button
                variant="outline"
                size="sm"
                onClick={copyToClipboard}
                className="h-7 text-xs px-2"
              >
                {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            )}
          </div>
          {error ? (
            <div className="min-h-[400px] rounded-md border border-destructive bg-[var(--st-text)]/10 p-4 text-xs font-mono text-[var(--st-text)] overflow-auto whitespace-pre-wrap">
              {error}
            </div>
          ) : (
            <div className="min-h-[400px] rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)]/30 p-3 overflow-auto relative">
              {out ? (
                <SyntaxHighlightedHtml html={out} />
              ) : (
                <div className="text-xs text-[var(--st-text-secondary)]">Formatted HTML will appear here...</div>
              )}
            </div>
          )}
        </div>
      </div>
    </ToolShell>
  );
}
