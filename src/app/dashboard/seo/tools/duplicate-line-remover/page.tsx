'use client';

import { Button, Textarea, Input, Checkbox, Card } from '@/components/zoruui';
import { useState } from 'react';
import { Copy, Download, Link, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl } from '@/lib/seo-tools/api-client';

export default function DuplicateLineRemoverPage() {
  const [text, setText] = useState('');
  const [result, setResult] = useState('');
  
  // Options
  const [caseInsensitive, setCaseInsensitive] = useState(false);
  const [trimLines, setTrimLines] = useState(true);
  const [removeEmpty, setRemoveEmpty] = useState(true);

  // URL Fetching
  const [url, setUrl] = useState('');
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');

  const run = () => {
    const lines = text.split(/\r?\n/);
    const seen = new Set<string>();
    const out: string[] = [];
    
    for (const rawLine of lines) {
      let processLine = rawLine;
      if (trimLines) {
        processLine = processLine.trim();
      }
      
      if (removeEmpty && processLine === '') {
        continue;
      }
      
      const compareLine = caseInsensitive ? processLine.toLowerCase() : processLine;
      
      if (!seen.has(compareLine)) {
        seen.add(compareLine);
        // keep original case for output if caseInsensitive is true? Yes, usually users want original case preserved for the first occurrence.
        out.push(processLine);
      }
    }
    
    setResult(out.join('\n'));
  };

  const removed = text.split(/\r?\n/).length - (result ? result.split(/\r?\n/).length : text.split(/\r?\n/).length);

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    toast.success('Copied to clipboard!');
  };

  const handleExportCSV = () => {
    if (!result) return;
    const lines = result.split(/\r?\n/);
    const csvContent = lines.map(line => `"${line.replace(/"/g, '""')}"`).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'unique-lines.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exported to CSV');
  };

  const handleFetchUrl = async () => {
    if (!url) {
      toast.error('Please enter a URL');
      return;
    }
    setFetching(true);
    setError('');
    try {
      const res = await apiFetchUrl(url);
      if (res.error) {
        setError(res.error);
        toast.error('Failed to fetch URL');
      } else {
        // Strip HTML if it's HTML, or just load text
        // If content type is HTML, maybe we just load raw HTML since they might want to dedup lines in HTML?
        // Let's just load the raw body.
        setText(res.body);
        toast.success('Loaded text from URL');
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching URL');
      toast.error('Failed to fetch URL');
    } finally {
      setFetching(false);
    }
  };

  return (
    <ToolShell title="Duplicate Line Remover" description="Remove duplicate lines while preserving order.">
      
      <div className="flex flex-col md:flex-row gap-2 mb-6">
        <div className="flex-1 relative">
          <Input 
            type="url" 
            placeholder="https://example.com/list.txt" 
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="pl-9"
          />
          <Link className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        </div>
        <Button onClick={handleFetchUrl} disabled={fetching || !url}>
          {fetching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Fetch from URL
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md mb-6 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-3 space-y-4">
          <Textarea 
            value={text} 
            onChange={(e) => setText(e.target.value)} 
            placeholder="Paste lines here…" 
            className="min-h-[300px] font-mono text-sm" 
          />
          <div className="flex gap-2">
            <Button onClick={run}>Remove duplicates</Button>
            <Button variant="ghost" onClick={() => { setText(''); setResult(''); setError(''); }}>Clear</Button>
          </div>

          {result && (
            <div className="space-y-2 mt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">
                  Results <span className="text-muted-foreground font-normal ml-2">({result.split(/\r?\n/).length} lines, removed {removed})</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleCopy} className="gap-2">
                    <Copy className="w-4 h-4" />
                    Copy
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleExportCSV} className="gap-2">
                    <Download className="w-4 h-4" />
                    Export CSV
                  </Button>
                </div>
              </div>
              <Textarea readOnly value={result} className="min-h-[300px] font-mono text-sm" />
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Card className="p-4 space-y-4 bg-muted/50">
            <h3 className="font-semibold text-sm">Options</h3>
            
            <div className="space-y-3">
              <label className="flex items-center space-x-2 cursor-pointer">
                <Checkbox 
                  checked={caseInsensitive} 
                  onCheckedChange={(c) => setCaseInsensitive(c === true)} 
                />
                <span className="text-sm">Case Insensitive</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <Checkbox 
                  checked={trimLines} 
                  onCheckedChange={(c) => setTrimLines(c === true)} 
                />
                <span className="text-sm">Trim Whitespace</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <Checkbox 
                  checked={removeEmpty} 
                  onCheckedChange={(c) => setRemoveEmpty(c === true)} 
                />
                <span className="text-sm">Remove Empty Lines</span>
              </label>
            </div>
          </Card>
        </div>
      </div>
    </ToolShell>
  );
}
