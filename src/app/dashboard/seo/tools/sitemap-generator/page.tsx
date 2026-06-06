'use client';

import {
  Button,
  Input,
  Textarea,
  Field,
  Alert,
  AlertTitle,
  AlertDescription,
  Card,
  CardBody,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';
import { SabFileToFileButton } from '@/components/sabfiles';
import { useMemo, useState } from 'react';
import Papa from 'papaparse';
import { Upload, Download } from 'lucide-react';
import { ToolShell } from '@/components/seo-tools/tool-shell';

const CHANGEFREQ_OPTIONS = [
  'always',
  'hourly',
  'daily',
  'weekly',
  'monthly',
  'yearly',
  'never',
] as const;

export default function SitemapGeneratorPage() {
  const [inputText, setInputText] = useState(
    'loc,changefreq,priority,image,video\nhttps://example.com/,weekly,1.0,,\nhttps://example.com/about,monthly,0.8,https://example.com/img.jpg,https://example.com/video.mp4'
  );
  const [globalPriority, setGlobalPriority] = useState('0.8');
  const [globalChangefreq, setGlobalChangefreq] = useState('weekly');

  const xml = useMemo(() => {
    // Determine if it's CSV by looking for commas in the first few lines
    const firstLine = inputText.split('\n')[0] || '';
    const isCsv = firstLine.includes(',');

    let parsedEntries: any[] = [];

    if (isCsv) {
      const parsed = Papa.parse(inputText, { header: true, skipEmptyLines: true });
      parsedEntries = parsed.data;
    } else {
      // Just a list of URLs
      parsedEntries = inputText
        .split(/\r?\n/)
        .map((u) => u.trim())
        .filter(Boolean)
        .map((loc) => ({ loc }));
    }

    const validEntries = parsedEntries.filter((e) => e.loc || e.url);
    const hasImage = validEntries.some((e) => e.image || e.image_loc);
    const hasVideo = validEntries.some((e) => e.video || e.video_loc);

    const lines = ['<?xml version="1.0" encoding="UTF-8"?>'];
    let urlsetAttrs = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"';
    if (hasImage) urlsetAttrs += ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"';
    if (hasVideo) urlsetAttrs += ' xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"';

    lines.push(`<urlset ${urlsetAttrs}>`);

    for (const e of validEntries) {
      const loc = e.loc || e.url;
      if (!loc) continue;

      lines.push('  <url>');
      lines.push(`    <loc>${loc}</loc>`);
      lines.push(`    <changefreq>${e.changefreq || globalChangefreq}</changefreq>`);
      lines.push(`    <priority>${e.priority || globalPriority}</priority>`);

      const image = e.image || e.image_loc;
      if (image) {
        lines.push(`    <image:image>`);
        lines.push(`      <image:loc>${image}</image:loc>`);
        lines.push(`    </image:image>`);
      }

      const video = e.video || e.video_loc;
      if (video) {
        lines.push(`    <video:video>`);
        lines.push(`      <video:content_loc>${video}</video:content_loc>`);
        lines.push(`    </video:video>`);
      }
      lines.push('  </url>');
    }
    lines.push('</urlset>');
    return lines.join('\n');
  }, [inputText, globalPriority, globalChangefreq]);

  const handleDownload = () => {
    const blob = new Blob([xml], { type: 'application/xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sitemap.xml';
    a.click();
  };

  const handleFilePicked = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        setInputText(text);
      }
    };
    reader.readAsText(file);
  };

  return (
    <ToolShell title="XML Sitemap Generator" description="Generate a sitemap.xml with image and video support.">
      <Alert tone="info" className="mb-6">
        <AlertTitle>Manual Builder</AlertTitle>
        <AlertDescription>
          This tool does not crawl your website. You must provide the URLs manually or import them via a CSV file.
          <br />
          You can paste a simple list of URLs (one per line) or a CSV with headers:{' '}
          <code className="bg-[var(--st-bg-secondary)] px-1.5 py-0.5 rounded-[var(--st-radius)] border border-[var(--st-border)] text-xs">
            loc, changefreq, priority, image, video
          </code>
          .
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg text-[var(--st-text)]">Input Data</h3>
            <SabFileToFileButton
              accept="all"
              variant="outline"
              onPickFile={(file) => handleFilePicked(file)}
            >
              <Upload className="w-4 h-4 mr-2" aria-hidden="true" />
              Upload CSV
            </SabFileToFileButton>
          </div>

          <Textarea
            aria-label="Input data: URLs or CSV rows"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="h-[500px] font-mono text-xs whitespace-pre text-nowrap overflow-auto"
            placeholder="https://example.com/&#10;https://example.com/about"
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg text-[var(--st-text)]">Output XML</h3>
            <Button size="sm" iconLeft={Download} onClick={handleDownload}>
              Download XML
            </Button>
          </div>

          <Card padding="md">
            <CardBody className="flex gap-4">
              <Field label="Fallback Priority" className="flex-1">
                <Input
                  inputSize="sm"
                  value={globalPriority}
                  onChange={(e) => setGlobalPriority(e.target.value)}
                  placeholder="priority"
                />
              </Field>
              <Field label="Fallback Changefreq" className="flex-1">
                <Select value={globalChangefreq} onValueChange={setGlobalChangefreq}>
                  <SelectTrigger aria-label="Fallback changefreq">
                    <SelectValue placeholder="Select changefreq" />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANGEFREQ_OPTIONS.map((freq) => (
                      <SelectItem key={freq} value={freq}>
                        {freq}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </CardBody>
          </Card>

          <Textarea
            readOnly
            aria-label="Generated sitemap XML output"
            value={xml}
            className="h-[415px] font-mono text-xs whitespace-pre text-nowrap overflow-auto"
          />
        </div>
      </div>
    </ToolShell>
  );
}
