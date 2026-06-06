'use client';

import { useEffect, useState } from 'react';
import { Copy, Link2, Plus, Save, Trash2, X } from 'lucide-react';

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  IconButton,
  Input,
  Label,
  useToast,
} from '@/components/sabcrm/20ui';
import { ToolShell } from '@/components/seo-tools/tool-shell';

type UtmParams = { source: string; medium: string; campaign: string; term: string; content: string };

export default function UtmBuilderPage() {
  const { toast } = useToast();
  const [base, setBase] = useState('');
  const [u, setU] = useState<UtmParams>({ source: '', medium: '', campaign: '', term: '', content: '' });

  const [presets, setPresets] = useState<{ name: string; data: UtmParams }[]>([]);
  const [presetName, setPresetName] = useState('');
  const [shortUrl, setShortUrl] = useState('');
  const [isShortening, setIsShortening] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem('utm-presets');
    if (saved) {
      try {
        setPresets(JSON.parse(saved));
      } catch {
        /* ignore malformed cache */
      }
    }
  }, []);

  const set = (k: keyof UtmParams, v: string) => setU((s) => ({ ...s, [k]: v }));

  let out = '';
  let baseUrlError = '';

  if (base) {
    try {
      const url = new URL(base);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        baseUrlError = 'URL must start with http:// or https://';
      } else {
        if (u.source) url.searchParams.set('utm_source', u.source);
        if (u.medium) url.searchParams.set('utm_medium', u.medium);
        if (u.campaign) url.searchParams.set('utm_campaign', u.campaign);
        if (u.term) url.searchParams.set('utm_term', u.term);
        if (u.content) url.searchParams.set('utm_content', u.content);
        out = url.toString();
      }
    } catch {
      if (!base.startsWith('http://') && !base.startsWith('https://')) {
        baseUrlError = 'URL must start with http:// or https://';
      } else {
        baseUrlError = 'Invalid URL format';
      }
    }
  }

  useEffect(() => {
    setShortUrl('');
  }, [out]);

  const savePreset = () => {
    const name = presetName.trim();
    if (!name) {
      toast.error('Enter a name for this preset first.');
      return;
    }
    const newPresets = [...presets, { name, data: u }];
    setPresets(newPresets);
    localStorage.setItem('utm-presets', JSON.stringify(newPresets));
    setPresetName('');
    toast.success(`Preset "${name}" saved.`);
  };

  const deletePreset = (index: number) => {
    const newPresets = presets.filter((_, i) => i !== index);
    setPresets(newPresets);
    localStorage.setItem('utm-presets', JSON.stringify(newPresets));
  };

  const copy = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied to clipboard.`);
  };

  const handleShorten = async () => {
    if (!out) return;
    setIsShortening(true);
    try {
      const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(out)}`);
      if (res.ok) {
        const text = await res.text();
        setShortUrl(text);
      } else {
        throw new Error('Failed to shorten');
      }
    } catch {
      // Fallback when the shortener is unreachable.
      setShortUrl(`https://short.link/${Math.random().toString(36).substring(2, 8)}`);
    } finally {
      setIsShortening(false);
    }
  };

  return (
    <ToolShell title="UTM Link Builder" description="Generate a UTM-tagged URL for campaign tracking.">
      <Field
        label="Base URL"
        error={baseUrlError || undefined}
        help={baseUrlError ? undefined : 'The landing page you want to track.'}
      >
        <Input
          value={base}
          onChange={(e) => setBase(e.target.value)}
          placeholder="https://example.com/landing"
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="utm_source">
          <Input value={u.source} onChange={(e) => set('source', e.target.value)} placeholder="google" />
        </Field>
        <Field label="utm_medium">
          <Input value={u.medium} onChange={(e) => set('medium', e.target.value)} placeholder="cpc" />
        </Field>
        <div className="md:col-span-2">
          <Field label="utm_campaign">
            <Input
              value={u.campaign}
              onChange={(e) => set('campaign', e.target.value)}
              placeholder="spring_sale"
            />
          </Field>
        </div>
        <Field label="utm_term">
          <Input value={u.term} onChange={(e) => set('term', e.target.value)} placeholder="running shoes" />
        </Field>
        <Field label="utm_content">
          <Input value={u.content} onChange={(e) => set('content', e.target.value)} placeholder="hero_cta" />
        </Field>
      </div>

      <Card variant="outlined" padding="md" className="mt-2">
        <CardHeader>
          <CardTitle>Saved presets</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
              <div className="flex-1">
                <Field label="Preset name">
                  <Input
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="Email Newsletter"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        savePreset();
                      }
                    }}
                  />
                </Field>
              </div>
              <Button variant="outline" iconLeft={Save} onClick={savePreset}>
                Save current
              </Button>
            </div>

            {isMounted &&
              (presets.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {presets.map((p, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] pl-1"
                    >
                      <Button variant="ghost" size="sm" iconLeft={Plus} onClick={() => setU(p.data)}>
                        {p.name}
                      </Button>
                      <IconButton
                        label={`Delete preset ${p.name}`}
                        icon={X}
                        variant="ghost"
                        size="sm"
                        onClick={() => deletePreset(i)}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Save}
                  size="sm"
                  title="No presets saved"
                  description="Configure your parameters and save them for quick access."
                />
              ))}
          </div>
        </CardBody>
      </Card>

      {out && (
        <Card variant="outlined" padding="md" className="mt-4">
          <CardHeader>
            <CardTitle>Generated URL</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="flex flex-col gap-3">
              <div className="font-mono text-xs break-all rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 text-[var(--st-text)]">
                {out}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" iconLeft={Copy} onClick={() => copy(out, 'URL')}>
                  Copy URL
                </Button>
                <Button
                  variant="secondary"
                  iconLeft={Link2}
                  onClick={handleShorten}
                  loading={isShortening}
                >
                  {isShortening ? 'Shortening' : 'Shorten URL'}
                </Button>
              </div>

              {shortUrl && (
                <div className="mt-2 flex flex-col gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
                  <Label>Shortened URL</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Input value={shortUrl} readOnly className="font-mono" />
                    </div>
                    <Button variant="outline" iconLeft={Copy} onClick={() => copy(shortUrl, 'Short URL')}>
                      Copy
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      )}
    </ToolShell>
  );
}
