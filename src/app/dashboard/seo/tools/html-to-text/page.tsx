'use client';

import { Textarea, Switch, Label } from '@/components/zoruui';
import { useMemo, useState } from 'react';

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { htmlToText } from '@/lib/seo-tools/text-utils';

export default function HtmlToTextPage() {
  const [html, setHtml] = useState('');
  
  // Options state
  const [preserveNewlines, setPreserveNewlines] = useState(true);
  const [ignoreHiddenElements, setIgnoreHiddenElements] = useState(true);
  const [decodeEntities, setDecodeEntities] = useState(true);

  const text = useMemo(() => {
    return htmlToText(html, { preserveNewlines, ignoreHiddenElements, decodeEntities });
  }, [html, preserveNewlines, ignoreHiddenElements, decodeEntities]);

  return (
    <ToolShell title="HTML to Text" description="Strip HTML tags and get plain text.">
      <Textarea value={html} onChange={(e) => setHtml(e.target.value)} placeholder="Paste HTML…" className="min-h-[220px] font-mono text-xs" />
      
      <div className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:gap-6 border-b border-zoru-line-light">
        <div className="flex items-center space-x-2">
          <Switch id="preserve-newlines" checked={preserveNewlines} onCheckedChange={setPreserveNewlines} />
          <Label htmlFor="preserve-newlines">Preserve Newlines</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Switch id="ignore-hidden" checked={ignoreHiddenElements} onCheckedChange={setIgnoreHiddenElements} />
          <Label htmlFor="ignore-hidden">Ignore Hidden Elements</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Switch id="decode-entities" checked={decodeEntities} onCheckedChange={setDecodeEntities} />
          <Label htmlFor="decode-entities">Decode Entities</Label>
        </div>
      </div>

      <div className="text-sm font-semibold mt-4">Output text</div>
      <Textarea readOnly value={text} className="min-h-[220px]" />
    </ToolShell>
  );
}
