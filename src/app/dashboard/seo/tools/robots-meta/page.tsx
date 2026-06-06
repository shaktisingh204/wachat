'use client';

import { Button, Label, Switch, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, cn } from '@/components/sabcrm/20ui/compat';
import { useMemo, useState } from 'react';

import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function RobotsMetaPage() {
  const [flags, setFlags] = useState({
    index: true,
    follow: true,
    noarchive: false,
    nosnippet: false,
    noimageindex: false,
  });

  const [maxSnippet, setMaxSnippet] = useState<string>('');
  const [maxVideoPreview, setMaxVideoPreview] = useState<string>('');
  const [maxImagePreview, setMaxImagePreview] = useState<string>('unspecified');

  const toggle = (k: keyof typeof flags) => setFlags((f) => ({ ...f, [k]: !f[k] }));

  const content = useMemo(() => {
    const parts: string[] = [];
    parts.push(flags.index ? 'index' : 'noindex');
    parts.push(flags.follow ? 'follow' : 'nofollow');
    if (flags.noarchive) parts.push('noarchive');
    if (flags.nosnippet) parts.push('nosnippet');
    if (flags.noimageindex) parts.push('noimageindex');
    
    if (maxSnippet) parts.push(`max-snippet:${maxSnippet}`);
    if (maxVideoPreview) parts.push(`max-video-preview:${maxVideoPreview}`);
    if (maxImagePreview && maxImagePreview !== 'unspecified') {
      parts.push(`max-image-preview:${maxImagePreview}`);
    }

    return parts.join(', ');
  }, [flags, maxSnippet, maxVideoPreview, maxImagePreview]);

  const output = `<meta name="robots" content="${content}" />`;

  return (
    <ToolShell title="Robots Meta Tag Generator" description="Generate a robots meta tag with your crawl preferences.">
      <div className="space-y-8">
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Basic Directives</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {(Object.keys(flags) as (keyof typeof flags)[]).map((k) => (
              <div key={k} className="flex items-center gap-2">
                <Switch checked={flags[k]} onCheckedChange={() => toggle(k)} />
                <Label className="capitalize cursor-pointer" onClick={() => toggle(k)}>{k}</Label>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-medium">Advanced Directives</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>Max Snippet</Label>
              <Input 
                type="number" 
                placeholder="-1 for no limit" 
                value={maxSnippet} 
                onChange={(e) => setMaxSnippet(e.target.value)} 
              />
              <p className="text-xs text-[var(--st-text-secondary)]">Maximum text-length, in characters, of a snippet.</p>
            </div>

            <div className="space-y-2">
              <Label>Max Video Preview</Label>
              <Input 
                type="number" 
                placeholder="-1 for no limit" 
                value={maxVideoPreview} 
                onChange={(e) => setMaxVideoPreview(e.target.value)} 
              />
              <p className="text-xs text-[var(--st-text-secondary)]">Maximum number of seconds for a video snippet.</p>
            </div>

            <div className="space-y-2">
              <Label>Max Image Preview</Label>
              <Select value={maxImagePreview} onValueChange={setMaxImagePreview}>
                <SelectTrigger>
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unspecified">Unspecified</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-[var(--st-text-secondary)]">Maximum size of an image preview.</p>
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-4 border-t">
          <Label>Generated Meta Tag</Label>
          <div className="font-mono text-sm bg-[var(--st-bg-muted)] p-4 rounded-md break-all">{output}</div>
          <Button onClick={() => navigator.clipboard.writeText(output)} className="mt-2">Copy Tag</Button>
        </div>
      </div>
    </ToolShell>
  );
}
