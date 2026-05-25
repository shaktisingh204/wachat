'use client';

import { Input, Label, Textarea, Switch, Button } from '@/components/zoruui';
import { useMemo, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function TextRepeaterPage() {
  const [text, setText] = useState('');
  const [count, setCount] = useState(5);
  const [separator, setSeparator] = useState('\\n');
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const [addLineNumbers, setAddLineNumbers] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const sep = separator.replace(/\\n/g, '\n').replace(/\\t/g, '\t');

  const output = useMemo(() => {
    if (count <= 0) return '';
    return Array.from({ length: count }, (_, i) => {
      const num = i + 1;
      const currentPrefix = prefix.replace(/{n}/g, num.toString());
      const currentSuffix = suffix.replace(/{n}/g, num.toString());
      const lineNumStr = addLineNumbers ? `${num}. ` : '';
      return `${lineNumStr}${currentPrefix}${text}${currentSuffix}`;
    }).join(sep);
  }, [text, count, sep, prefix, suffix, addLineNumbers]);

  const handleCopy = () => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <ToolShell title="Text Repeater" description="Repeat text a given number of times with a separator.">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Text to repeat…" className="min-h-[120px]" />
      
      <div className="flex flex-wrap items-end gap-4 py-2">
        <div className="space-y-1">
          <Label>Repeat</Label>
          <Input type="number" min={1} max={10000} value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} className="w-24" />
        </div>
        <div className="space-y-1">
          <Label>Separator (\n, \t)</Label>
          <Input value={separator} onChange={(e) => setSeparator(e.target.value)} className="w-24" />
        </div>
        <div className="space-y-1">
          <Label>Prefix (use {'{n}'} for num)</Label>
          <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="e.g. Item {n}: " className="w-48" />
        </div>
        <div className="space-y-1">
          <Label>Suffix (use {'{n}'} for num)</Label>
          <Input value={suffix} onChange={(e) => setSuffix(e.target.value)} placeholder="e.g. <br>" className="w-48" />
        </div>
        <div className="flex items-center space-x-2 pb-2">
          <Switch id="line-numbers" checked={addLineNumbers} onCheckedChange={setAddLineNumbers} />
          <Label htmlFor="line-numbers" className="cursor-pointer">Add Line Numbers</Label>
        </div>
      </div>
      
      <div className="relative">
        <Button
          variant="outline"
          size="icon"
          className="absolute top-2 right-2 z-10 h-8 w-8 bg-zoru-surface/80 backdrop-blur"
          onClick={handleCopy}
          title="Copy output"
        >
          {isCopied ? <Check className="h-4 w-4 text-zoru-success" /> : <Copy className="h-4 w-4" />}
        </Button>
        <Textarea readOnly value={output} className="min-h-[220px] font-mono text-xs pr-12" placeholder="Output will appear here..." />
      </div>
    </ToolShell>
  );
}
