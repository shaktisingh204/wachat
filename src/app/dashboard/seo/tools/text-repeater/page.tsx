'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function TextRepeaterPage() {
  const [text, setText] = useState('');
  const [count, setCount] = useState(5);
  const [separator, setSeparator] = useState('\\n');
  const sep = separator.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
  const output = useMemo(() => (count > 0 ? Array.from({ length: count }, () => text).join(sep) : ''), [text, count, sep]);

  return (
    <ToolShell title="Text Repeater" description="Repeat text a given number of times with a separator.">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Text to repeat…" className="min-h-[120px]" />
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label>Repeat</Label>
          <Input type="number" min={1} max={10000} value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} className="w-24" />
        </div>
        <div className="space-y-1">
          <Label>Separator (use \n, \t)</Label>
          <Input value={separator} onChange={(e) => setSeparator(e.target.value)} className="w-32" />
        </div>
      </div>
      <Textarea readOnly value={output} className="min-h-[220px] font-mono text-xs" />
    </ToolShell>
  );
}
