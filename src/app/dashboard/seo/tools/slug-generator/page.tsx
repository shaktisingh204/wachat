'use client';

import { 
  Button, 
  Textarea, 
  Card, 
  ZoruCardContent, 
  Label, 
  useZoruToast,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@/components/sabcrm/20ui/compat';
import { useMemo, useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';

type CasingOption = 'lowercase' | 'titlecase' | 'camelcase';
type SeparatorOption = '-' | '_';

function generateSlug(text: string, casing: CasingOption, separator: SeparatorOption): string {
  if (!text) return '';
  const processed = text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim();
  
  if (casing === 'camelcase') {
    return processed
      .replace(/[^a-zA-Z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join('');
  }
  
  let words = processed
    .replace(/[^\w\s-]/g, '')
    .split(/[\s-]+/)
    .filter(Boolean);
    
  if (casing === 'lowercase') {
    words = words.map(w => w.toLowerCase());
  } else if (casing === 'titlecase') {
    words = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }
  
  return words.join(separator);
}

export default function SlugGeneratorPage() {
  const [input, setInput] = useState('');
  const [casing, setCasing] = useState<CasingOption>('lowercase');
  const [separator, setSeparator] = useState<SeparatorOption>('-');
  const { toast } = useZoruToast();
  
  const slug = useMemo(() => generateSlug(input, casing, separator), [input, casing, separator]);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!slug) return;
    try {
      await navigator.clipboard.writeText(slug);
      setCopied(true);
      toast({ title: 'Copied', description: 'Slug copied to clipboard.', variant: 'default' });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: 'Copy failed', description: 'Could not copy to clipboard.', variant: 'destructive' });
    }
  };

  return (
    <ToolShell title="Slug Generator" description="Convert any title or phrase into a URL-safe slug.">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <Label>Text</Label>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter a title or sentence…"
            className="min-h-[120px]"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label>Casing</Label>
            <Select value={casing} onValueChange={(val) => setCasing(val as CasingOption)}>
              <SelectTrigger>
                <SelectValue placeholder="Select Casing" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lowercase">Lowercase</SelectItem>
                <SelectItem value="titlecase">Title Case</SelectItem>
                <SelectItem value="camelcase">camelCase</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex flex-col gap-2">
            <Label>Separator</Label>
            <Select value={separator} onValueChange={(val) => setSeparator(val as SeparatorOption)} disabled={casing === 'camelcase'}>
              <SelectTrigger>
                <SelectValue placeholder="Select Separator" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="-">Hyphen (-)</SelectItem>
                <SelectItem value="_">Underscore (_)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {slug && (
        <Card className="mt-5">
          <ZoruCardContent className="p-4 space-y-3">
            <Label>Generated slug</Label>
            <div className="font-mono text-lg break-all">{slug}</div>
            <Button variant="outline" onClick={copy}>
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </ZoruCardContent>
        </Card>
      )}
    </ToolShell>
  );
}
