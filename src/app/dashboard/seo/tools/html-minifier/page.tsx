'use client';

import { Textarea, Checkbox, Label, Button } from '@/components/sabcrm/20ui/compat';
import { useState, useEffect } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { minifyHtml } from './actions';
import { Loader2, Copy, Check } from 'lucide-react';

export default function HtmlMinifierPage() {
  const [text, setText] = useState('');
  const [minifiedText, setMinifiedText] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [options, setOptions] = useState({
    collapseWhitespace: true,
    removeComments: true,
    minifyJS: true,
    minifyCSS: true,
    removeAttributeQuotes: false,
    removeEmptyAttributes: false,
    keepClosingSlash: true,
    collapseBooleanAttributes: false,
    decodeEntities: false,
    minifyURLs: false,
    removeRedundantAttributes: false,
    removeScriptTypeAttributes: false,
    removeStyleLinkTypeAttributes: false,
    useShortDoctype: false,
  });

  useEffect(() => {
    if (!text) {
      setMinifiedText('');
      return;
    }

    setIsPending(true);
    const timeout = setTimeout(async () => {
      try {
        const minified = await minifyHtml(text, options);
        setMinifiedText(minified);
      } catch (error) {
        console.error('Minification failed:', error);
      } finally {
        setIsPending(false);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [text, options]);

  const handleCopy = async () => {
    if (!minifiedText) return;
    await navigator.clipboard.writeText(minifiedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const savedPercent = text.length ? ((1 - minifiedText.length / text.length) * 100).toFixed(1) : '0.0';

  return (
    <ToolShell title="HTML Minifier" description="Safely minify HTML, inline CSS, and JavaScript without breaking formatting.">
      <div className="grid gap-6">
        <Textarea 
          value={text} 
          onChange={(e) => setText(e.target.value)} 
          className="min-h-[200px] font-mono text-xs resize-y" 
          placeholder="Paste HTML here…" 
        />
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 border rounded-xl bg-[var(--st-bg-muted)]/10">
          {Object.entries(options).map(([key, value]) => (
            <div key={key} className="flex items-center space-x-2">
              <Checkbox 
                id={key} 
                checked={value} 
                onCheckedChange={(checked) => setOptions(prev => ({ ...prev, [key]: checked === true }))} 
              />
              <Label htmlFor={key} className="text-sm font-medium leading-none cursor-pointer">
                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
              </Label>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-[var(--st-text-secondary)]">
            <div className="flex items-center min-w-[100px]">
              {isPending ? (
                <span className="flex items-center text-[var(--st-text)]"><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Minifying...</span>
              ) : (
                <span>Processed</span>
              )}
            </div>
            <div>
              {text.length} → {minifiedText.length} bytes 
              {text.length > 0 && ` (${savedPercent}% saved)`}
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleCopy}
            disabled={!minifiedText}
            className="h-8"
          >
            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>

        <Textarea 
          readOnly 
          value={minifiedText} 
          className="min-h-[200px] font-mono text-xs resize-y bg-[var(--st-bg-muted)]/20" 
          placeholder="Minified HTML will appear here..."
        />
      </div>
    </ToolShell>
  );
}
