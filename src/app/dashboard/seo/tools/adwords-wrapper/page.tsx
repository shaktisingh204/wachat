'use client';

import {
  Button,
  Field,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';
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
      <Field label="Match type">
        <Select value={mt} onValueChange={(v) => setMt(v as MatchType)}>
          <SelectTrigger aria-label="Match type">
            <SelectValue placeholder="Pick a match type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="broad">Broad</SelectItem>
            <SelectItem value="phrase">"Phrase"</SelectItem>
            <SelectItem value="exact">[Exact]</SelectItem>
            <SelectItem value="modified">+modified +broad</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Keywords">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-[180px] font-mono text-xs"
          placeholder="One keyword per line"
        />
      </Field>
      <div className="relative">
        <Field label="Output">
          <Textarea
            readOnly
            value={out}
            className="min-h-[180px] font-mono text-xs"
            placeholder="Output will appear here."
          />
        </Field>
        <div className="absolute top-9 right-2 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="bg-[var(--st-bg)]"
            onClick={handleCopy}
            disabled={!out}
            iconLeft={copied ? Check : Copy}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-[var(--st-bg)]"
            onClick={handleDownloadCSV}
            disabled={!out}
            iconLeft={Download}
          >
            Export CSV
          </Button>
        </div>
      </div>
    </ToolShell>
  );
}
