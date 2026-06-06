'use client';

import {
  Button,
  Card,
  Field,
  Input,
  Textarea,
  Switch,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  useToast,
  cn,
} from '@/components/sabcrm/20ui';
import { Copy, Globe } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function MetaTagGeneratorPage() {
  const { toast } = useToast();
  const [fields, setFields] = useState({
    title: '', description: '', keywords: '', author: '', robots: 'index, follow',
    ogTitle: '', ogDescription: '', ogImage: '', ogUrl: '', twitterCard: 'summary_large_image',
  });
  const [enableOg, setEnableOg] = useState(false);
  const [enableTwitter, setEnableTwitter] = useState(false);

  const update = (k: string, v: string) => setFields((f) => ({ ...f, [k]: v }));

  const output = useMemo(() => {
    const lines: string[] = [];
    if (fields.title) lines.push(`<title>${fields.title}</title>`);
    if (fields.description) lines.push(`<meta name="description" content="${fields.description}" />`);
    if (fields.keywords) lines.push(`<meta name="keywords" content="${fields.keywords}" />`);
    if (fields.author) lines.push(`<meta name="author" content="${fields.author}" />`);
    if (fields.robots) lines.push(`<meta name="robots" content="${fields.robots}" />`);

    if (enableOg) {
      if (fields.ogTitle || fields.title) lines.push(`<meta property="og:title" content="${fields.ogTitle || fields.title}" />`);
      if (fields.ogDescription || fields.description) lines.push(`<meta property="og:description" content="${fields.ogDescription || fields.description}" />`);
      if (fields.ogImage) lines.push(`<meta property="og:image" content="${fields.ogImage}" />`);
      if (fields.ogUrl) lines.push(`<meta property="og:url" content="${fields.ogUrl}" />`);
      lines.push(`<meta property="og:type" content="website" />`);
    }

    if (enableTwitter) {
      lines.push(`<meta name="twitter:card" content="${fields.twitterCard || 'summary_large_image'}" />`);
      if (fields.ogTitle || fields.title) lines.push(`<meta name="twitter:title" content="${fields.ogTitle || fields.title}" />`);
      if (fields.ogDescription || fields.description) lines.push(`<meta name="twitter:description" content="${fields.ogDescription || fields.description}" />`);
      if (fields.ogImage) lines.push(`<meta name="twitter:image" content="${fields.ogImage}" />`);
    }

    return lines.join('\n');
  }, [fields, enableOg, enableTwitter]);

  const getCounterColor = (current: number, optimal: number, max: number) => {
    if (current === 0) return 'text-[var(--st-text-tertiary)]';
    if (current <= optimal) return 'text-[var(--st-status-ok)]';
    if (current <= max) return 'text-[var(--st-warn)] font-medium';
    return 'text-[var(--st-danger)] font-semibold';
  };

  const copyToClipboard = async () => {
    if (!output) {
      toast.info('Add some fields first, then copy the generated tags.');
      return;
    }
    try {
      await navigator.clipboard.writeText(output);
      toast.success('Meta tags copied to clipboard.');
    } catch {
      toast.error('Could not copy to clipboard.');
    }
  };

  const getHostname = (url: string) => {
    if (!url) return 'example.com';
    try {
      return new URL(url.includes('http') ? url : `https://${url}`).hostname;
    } catch {
      return url;
    }
  };

  const counterLabel = (text: string, current: number, optimal: number, max: number) => (
    <span className="flex justify-between items-center gap-2">
      <span>{text}</span>
      <span className={cn('text-xs tabular-nums transition-colors', getCounterColor(current, optimal, max))}>
        {current}/{max}
      </span>
    </span>
  );

  return (
    <ToolShell title="Meta Tag Generator" description="Generate meta title, description and Open Graph tags with SEO length guidelines.">
      {/* Google SERP Preview */}
      <Card variant="outlined" padding="lg" className="mb-8 flex flex-col gap-2">
        <h3 className="text-sm font-medium text-[var(--st-text-secondary)] mb-4 uppercase tracking-wider">
          Google Search Preview
        </h3>
        <div className="flex flex-col max-w-[600px]">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-7 h-7 bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-full flex items-center justify-center overflow-hidden shrink-0">
              <Globe className="w-4 h-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-[14px] text-[var(--st-text)] leading-tight truncate">
                {getHostname(fields.ogUrl)}
              </span>
              <span className="text-[12px] text-[var(--st-text-tertiary)] leading-tight truncate">
                {fields.ogUrl || 'https://www.example.com'}
              </span>
            </div>
          </div>
          <div className="text-[20px] text-[var(--st-accent)] hover:underline cursor-pointer truncate leading-normal pt-1 pb-1">
            {fields.title || 'Standard SEO Title - Replace with your own'}
          </div>
          <div className="text-[14px] text-[var(--st-text-secondary)] mt-[3px] line-clamp-2 leading-[1.58]">
            {fields.description || 'A compelling description of your page for search results. This should summarize the content accurately and encourage clicks.'}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        <Field label={counterLabel('Title', fields.title.length, 50, 60)}>
          <Input value={fields.title} onChange={(e) => update('title', e.target.value)} placeholder="Standard SEO title..." />
        </Field>

        <Field label="Author">
          <Input value={fields.author} onChange={(e) => update('author', e.target.value)} placeholder="e.g. John Doe" />
        </Field>

        <div className="md:col-span-2">
          <Field label={counterLabel('Description', fields.description.length, 120, 160)}>
            <Textarea
              value={fields.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="A compelling description of your page for search results..."
              rows={3}
            />
          </Field>
        </div>

        <Field label="Keywords (comma separated)">
          <Input value={fields.keywords} onChange={(e) => update('keywords', e.target.value)} placeholder="seo, tools, generator" />
        </Field>

        <Field label="Robots">
          <Input value={fields.robots} onChange={(e) => update('robots', e.target.value)} placeholder="index, follow" />
        </Field>

        {/* Toggles */}
        <div className="md:col-span-2 flex flex-col sm:flex-row gap-6 py-4 border-t border-b border-[var(--st-border)] mt-4">
          <Switch
            checked={enableOg}
            onCheckedChange={setEnableOg}
            label="Include Open Graph tags"
          />
          <Switch
            checked={enableTwitter}
            onCheckedChange={setEnableTwitter}
            label="Include Twitter Card tags"
          />
        </div>

        {enableOg && (
          <>
            <Field label={counterLabel('OG Title', (fields.ogTitle || fields.title).length, 60, 95)}>
              <Input value={fields.ogTitle} onChange={(e) => update('ogTitle', e.target.value)} placeholder={fields.title || 'Open Graph Title...'} />
            </Field>

            <Field label={counterLabel('OG Description', (fields.ogDescription || fields.description).length, 160, 200)}>
              <Input value={fields.ogDescription} onChange={(e) => update('ogDescription', e.target.value)} placeholder={fields.description || 'Open Graph Description...'} />
            </Field>

            <Field label="OG Image URL">
              <Input value={fields.ogImage} onChange={(e) => update('ogImage', e.target.value)} placeholder="https://example.com/image.jpg" />
            </Field>

            <Field label="OG URL">
              <Input value={fields.ogUrl} onChange={(e) => update('ogUrl', e.target.value)} placeholder="https://example.com/page" />
            </Field>
          </>
        )}

        {enableTwitter && (
          <div className="md:col-span-2">
            <Field label="Twitter Card Type">
              <Select value={fields.twitterCard} onValueChange={(v) => update('twitterCard', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a card type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="summary">Summary</SelectItem>
                  <SelectItem value="summary_large_image">Summary Large Image</SelectItem>
                  <SelectItem value="app">App</SelectItem>
                  <SelectItem value="player">Player</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-[var(--st-text)]">Generated Meta Tags</h3>
          <Button onClick={copyToClipboard} variant="secondary" size="sm" iconLeft={Copy}>
            Copy Tags
          </Button>
        </div>
        <Textarea
          readOnly
          value={output}
          aria-label="Generated meta tags"
          className="min-h-[240px] font-mono text-xs"
        />
      </div>
    </ToolShell>
  );
}
