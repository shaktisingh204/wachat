'use client';

import { Button, Input, Textarea, cn } from '@/components/sabcrm/20ui/compat';
import { useMemo, useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { AlertCircle, Copy, Download, Link2 } from 'lucide-react';

export default function QueryBuilderPage() {
  const [bases, setBases] = useState('');
  const [rows, setRows] = useState<{ k: string; v: string }[]>([{ k: '', v: '' }]);

  const { results, errors } = useMemo(() => {
    const lines = bases.split('\n').map(l => l.trim()).filter(Boolean);
    const results: string[] = [];
    const errors: string[] = [];
    
    if (lines.length === 0) return { results, errors };

    for (let i = 0; i < lines.length; i++) {
      const base = lines[i];
      try {
        const url = new URL(base);
        for (const r of rows) {
            if (r.k) {
                url.searchParams.set(r.k, r.v);
            }
        }
        results.push(url.toString());
      } catch (err) {
        errors.push(`Line ${i + 1}: Invalid URL "${base}" (make sure it includes http:// or https://)`);
      }
    }
    return { results, errors };
  }, [bases, rows]);

  const handleExtract = () => {
    const lines = bases.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    
    let anyExtracted = false;
    let newRows = rows.filter(r => r.k !== '' || r.v !== '');
    
    const newLines = lines.map(line => {
      try {
        const url = new URL(line);
        let extractedFromThis = false;
        url.searchParams.forEach((value, key) => {
           newRows.push({ k: key, v: value });
           extractedFromThis = true;
        });
        if (extractedFromThis || url.searchParams.toString() !== '') {
            anyExtracted = true;
        }
        url.search = '';
        return url.toString();
      } catch (e) {
        return line; // Leave invalid URLs alone
      }
    });

    if (anyExtracted) {
        if (newRows.length === 0) newRows.push({ k: '', v: '' });
        setRows(newRows);
        setBases(newLines.join('\n'));
    }
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(results.join('\n'));
  };

  const handleExport = () => {
    const blob = new Blob([results.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'urls.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ToolShell title="Query String Builder" description="Build URL query strings from key/value pairs. Supports batch processing and parsing existing parameters.">
      <div className="space-y-6">
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Base URLs (One per line)</label>
                <Button variant="outline" size="sm" onClick={handleExtract} title="Extract parameters from the base URLs into the table">
                    <Link2 className="w-4 h-4 mr-2" />
                    Decode / Extract Params
                </Button>
            </div>
            <Textarea 
                value={bases} 
                onChange={(e) => setBases(e.target.value)} 
                placeholder="https://example.com/page&#10;https://example.com/another-page" 
                rows={4}
            />
            {errors.length > 0 && (
                <div className="bg-[var(--st-text)]/10 text-[var(--st-text)] text-sm p-3 rounded-md space-y-1">
                    <div className="font-semibold flex items-center gap-1"><AlertCircle className="w-4 h-4"/> Validation Errors:</div>
                    <ul className="list-disc pl-5">
                        {errors.map((err, i) => (
                            <li key={i}>{err}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium">Query Parameters</label>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="flex gap-2">
                <Input value={r.k} onChange={(e) => setRows((rs) => rs.map((rr, j) => j === i ? { ...rr, k: e.target.value } : rr))} placeholder="Key (e.g. utm_source)" />
                <Input value={r.v} onChange={(e) => setRows((rs) => rs.map((rr, j) => j === i ? { ...rr, v: e.target.value } : rr))} placeholder="Value (e.g. google)" />
                <Button variant="ghost" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>×</Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setRows((r) => [...r, { k: '', v: '' }])}>+ Add param</Button>
          </div>
        </div>
        
        {results.length > 0 && (
            <div className="space-y-2 pt-4 border-t">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Generated URLs ({results.length})</label>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleCopyAll}>
                            <Copy className="w-4 h-4 mr-2" />
                            Copy All
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleExport}>
                            <Download className="w-4 h-4 mr-2" />
                            Export
                        </Button>
                    </div>
                </div>
                <div className="font-mono text-xs bg-[var(--st-bg-muted)] p-3 rounded overflow-x-auto whitespace-pre">
                    {results.join('\n')}
                </div>
            </div>
        )}
      </div>
    </ToolShell>
  );
}
