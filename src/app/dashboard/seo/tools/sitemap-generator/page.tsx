'use client';

import { Button, Input, Textarea, Alert, ZoruAlertTitle, ZoruAlertDescription, Label } from '@/components/zoruui';
import { useMemo, useState, useRef } from 'react';
import Papa from 'papaparse';
import { Info, Upload, Download } from 'lucide-react';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function SitemapGeneratorPage() {
  const [inputText, setInputText] = useState(
    'loc,changefreq,priority,image,video\nhttps://example.com/,weekly,1.0,,\nhttps://example.com/about,monthly,0.8,https://example.com/img.jpg,https://example.com/video.mp4'
  );
  const [globalPriority, setGlobalPriority] = useState('0.8');
  const [globalChangefreq, setGlobalChangefreq] = useState('weekly');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      parsedEntries = inputText.split(/\r?\n/).map((u) => u.trim()).filter(Boolean).map(loc => ({ loc }));
    }

    const validEntries = parsedEntries.filter(e => e.loc || e.url);
    const hasImage = validEntries.some(e => e.image || e.image_loc);
    const hasVideo = validEntries.some(e => e.video || e.video_loc);

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        setInputText(text);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <ToolShell title="XML Sitemap Generator" description="Generate a sitemap.xml with image and video support.">
      <Alert variant="info" className="mb-6">
        <Info className="w-4 h-4" />
        <ZoruAlertTitle>Manual Builder</ZoruAlertTitle>
        <ZoruAlertDescription>
          This tool does not crawl your website. You must provide the URLs manually or import them via a CSV file.
          <br/>You can paste a simple list of URLs (one per line) or a CSV with headers: <code className="bg-zoru-surface px-1.5 py-0.5 rounded-md border text-xs">loc, changefreq, priority, image, video</code>.
        </ZoruAlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Input Data</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" />
                Upload CSV
              </Button>
              <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
            </div>
          </div>
          
          <Textarea 
            value={inputText} 
            onChange={(e) => setInputText(e.target.value)} 
            className="h-[500px] font-mono text-xs whitespace-pre text-nowrap overflow-auto" 
            placeholder="https://example.com/&#10;https://example.com/about" 
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Output XML</h3>
            <Button size="sm" onClick={handleDownload}>
               <Download className="w-4 h-4 mr-2" />
               Download XML
            </Button>
          </div>
          
          <div className="flex gap-4 p-4 bg-zoru-surface-2 rounded-lg border">
            <div className="space-y-1 flex-1">
              <Label className="text-xs">Fallback Priority</Label>
              <Input value={globalPriority} onChange={(e) => setGlobalPriority(e.target.value)} className="h-8 text-sm bg-zoru-surface" placeholder="priority" />
            </div>
            <div className="space-y-1 flex-1">
              <Label className="text-xs">Fallback Changefreq</Label>
              <select className="border rounded h-8 px-2 bg-zoru-surface w-full text-sm" value={globalChangefreq} onChange={(e) => setGlobalChangefreq(e.target.value)}>
                <option>always</option><option>hourly</option><option>daily</option><option>weekly</option><option>monthly</option><option>yearly</option><option>never</option>
              </select>
            </div>
          </div>

          <Textarea readOnly value={xml} className="h-[415px] font-mono text-xs whitespace-pre text-nowrap overflow-auto" />
        </div>
      </div>
    </ToolShell>
  );
}
