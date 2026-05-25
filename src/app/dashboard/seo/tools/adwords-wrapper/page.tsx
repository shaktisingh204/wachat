'use client';

import { Button, Label, Textarea } from '@/components/zoruui';
import { Copy, Check, Download } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ToolShell } from '@/components/seo-tools/tool-shell';

type MatchType = 'broad' | 'phrase' | 'exact' | 'modified';

export default function AdwordsWrapperPage() {
  const [text, setText] = useState('');
  const [mt, setMt] = useState<MatchType>('phrase');
  const [copied, setCopied] = useState(false);

  const out = useMemo(() => {
    return text.split(/\r?\n/).filter(Boolean).map((kw) => {
      switch (mt) {
        case 'phrase': return `"${kw}"`;
        case 'exact': return `[${kw}]`;
        case 'modified': return kw.split(' ').map((w) => `+${w}`).join(' ');
        default: return kw;
      }
    }).join('\n');
  }, [text, mt]);

  const handleCopy = async () => {
    if (!out) return;
    try {
      await navigator.clipboard.writeText(out);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleDownloadCSV = () => {
    if (!out) return;
    try {
      const lines = out.split(/\r?\n/).filter(Boolean);
      const csvContent = "Keyword\n" + lines.map(l => `"${l.replace(/"/g, '""')}"`).join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'adwords_keywords.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export CSV', err);
    }
  };

  return (
    <ToolShell title="AdWords Keyword Wrapper" description="Wrap a list of keywords with Google Ads match type syntax.">
      <div className="space-y-1">
        <Label>Match type</Label>
        <select className="border border-zoru-line rounded-[var(--zoru-radius)] h-9 px-2 bg-zoru-bg text-zoru-ink text-sm" value={mt} onChange={(e) => setMt(e.target.value as MatchType)}>
          <option value="broad">Broad</option>
          <option value="phrase">"Phrase"</option>
          <option value="exact">[Exact]</option>
          <option value="modified">+modified +broad</option>
        </select>
      </div>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[180px] font-mono text-xs" placeholder="One keyword per line…" />
      <div className="relative">
        <Textarea readOnly value={out} className="min-h-[180px] font-mono text-xs" placeholder="Output will appear here..." />
        <div className="absolute top-2 right-2 flex gap-2">
          <Button 
            variant="outline"
            size="sm"
            className="bg-zoru-bg"
            onClick={handleCopy}
            disabled={!out}
            leading={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button 
            variant="outline"
            size="sm"
            className="bg-zoru-bg"
            onClick={handleDownloadCSV}
            disabled={!out}
            leading={<Download className="w-4 h-4" />}
          >
            Export CSV
          </Button>
        </div>
      </div>
    </ToolShell>
  );
}
