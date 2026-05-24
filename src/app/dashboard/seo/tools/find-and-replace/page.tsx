'use client';

import { Input, Label, Textarea, Switch, Button, cn } from '@/components/zoruui';
import { cn as _zoruCn, useState, useEffect } from 'react';
import { Copy, Check, AlertCircle } from 'lucide-react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function FindAndReplacePage() {
  const [text, setText] = useState('');
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [regex, setRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);

  const [debouncedText, setDebouncedText] = useState('');
  const [debouncedFind, setDebouncedFind] = useState('');
  const [debouncedReplace, setDebouncedReplace] = useState('');
  const [debouncedRegex, setDebouncedRegex] = useState(false);
  const [debouncedCaseSensitive, setDebouncedCaseSensitive] = useState(false);

  const [output, setOutput] = useState('');
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedText(text);
      setDebouncedFind(find);
      setDebouncedReplace(replace);
      setDebouncedRegex(regex);
      setDebouncedCaseSensitive(caseSensitive);
    }, 300);
    return () => clearTimeout(timer);
  }, [text, find, replace, regex, caseSensitive]);

  useEffect(() => {
    if (!debouncedFind) {
      setOutput(debouncedText);
      setCount(0);
      setError(null);
      return;
    }
    try {
      const flags = debouncedCaseSensitive ? 'g' : 'gi';
      const re = debouncedRegex 
        ? new RegExp(debouncedFind, flags) 
        : new RegExp(debouncedFind.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
      const matches = debouncedText.match(re);
      setOutput(debouncedText.replace(re, debouncedReplace));
      setCount(matches ? matches.length : 0);
      setError(null);
    } catch (err: any) {
      setOutput(debouncedText);
      setCount(0);
      setError(err.message || 'Invalid regular expression');
    }
  }, [debouncedText, debouncedFind, debouncedReplace, debouncedRegex, debouncedCaseSensitive]);

  const handleCopy = () => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ToolShell title="Find and Replace" description="Find and replace text in bulk with optional regex.">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste text…" className="min-h-[220px]" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Find</Label>
          <Input value={find} onChange={(e) => setFind(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Replace with</Label>
          <Input value={replace} onChange={(e) => setReplace(e.target.value)} />
        </div>
      </div>
      
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 dark:bg-red-950/50 p-3 rounded-md">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2"><Switch checked={regex} onCheckedChange={setRegex} /><Label>Regex</Label></div>
        <div className="flex items-center gap-2"><Switch checked={caseSensitive} onCheckedChange={setCaseSensitive} /><Label>Case sensitive</Label></div>
        <div className="text-sm text-muted-foreground">{count} match(es)</div>
      </div>
      
      <div className="flex items-center justify-between mt-4">
        <div className="text-sm font-semibold">Output</div>
        <Button variant="outline" size="sm" onClick={handleCopy} disabled={!output}>
          {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>
      <Textarea readOnly value={output} className="min-h-[220px]" />
    </ToolShell>
  );
}
