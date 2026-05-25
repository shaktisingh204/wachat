'use client';

import { Button, Input, Label, Textarea, ZoruDynamicSelector, ZoruToaster, useZoruToast } from '@/components/zoruui';
import { useMemo, useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { Plus, Trash, Upload, Loader2, Download } from 'lucide-react';
import { fetchRobotsTxt } from './actions';

type RuleGroup = {
  id: string;
  ua: string;
  disallow: string;
  allow: string;
  crawlDelay: string;
};

const BOT_OPTIONS = [
  { id: '*', label: 'All Bots (*)' },
  { id: 'Googlebot', label: 'Googlebot' },
  { id: 'Googlebot-Image', label: 'Googlebot-Image' },
  { id: 'Googlebot-News', label: 'Googlebot-News' },
  { id: 'Bingbot', label: 'Bingbot' },
  { id: 'Yandex', label: 'Yandex' },
  { id: 'DuckDuckBot', label: 'DuckDuckBot' },
  { id: 'Baiduspider', label: 'Baiduspider' },
  { id: 'Slurp', label: 'Slurp' },
  { id: 'Applebot', label: 'Applebot' },
  { id: 'AhrefsBot', label: 'AhrefsBot' },
  { id: 'SemrushBot', label: 'SemrushBot' },
  { id: 'MJ12bot', label: 'MJ12bot' },
  { id: 'Rogerbot', label: 'Rogerbot' }
];

export default function RobotsTxtGeneratorPage() {
  const [groups, setGroups] = useState<RuleGroup[]>([{
    id: '1',
    ua: '*',
    disallow: '/admin\n/private',
    allow: '',
    crawlDelay: ''
  }]);
  const [sitemap, setSitemap] = useState('');
  
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const { toast } = useZoruToast();

  const addGroup = () => {
    setGroups([...groups, { id: Math.random().toString(36).substring(7), ua: '*', disallow: '', allow: '', crawlDelay: '' }]);
  };

  const updateGroup = (id: string, key: keyof RuleGroup, val: string) => {
    setGroups(groups.map(g => g.id === id ? { ...g, [key]: val } : g));
  };

  const removeGroup = (id: string) => {
    setGroups(groups.filter(g => g.id !== id));
  };

  const handleImport = async () => {
    if (!importUrl) {
      toast({ title: 'Error', description: 'Please enter a URL.', variant: 'destructive' });
      return;
    }
    setImporting(true);
    try {
      const res = await fetchRobotsTxt(importUrl);
      if (!res.success) {
        toast({ title: 'Import Failed', description: res.error, variant: 'destructive' });
        return;
      }
      parseRobotsTxt(res.text);
      toast({ title: 'Success', description: 'robots.txt imported successfully.' });
      setImportUrl('');
    } catch (e: any) {
      toast({ title: 'Import Failed', description: e.message, variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const parseRobotsTxt = (text: string) => {
    const lines = text.split(/\r?\n/);
    
    type ParsedGroup = { uas: string[], disallow: string[], allow: string[], crawlDelay: string };
    const parsedGroups: ParsedGroup[] = [];
    let currentGroup: ParsedGroup | null = null;
    let parsedSitemap = '';
    
    for (let line of lines) {
      line = line.split('#')[0].trim();
      if (!line) continue;
      
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.substring(0, colonIdx).trim().toLowerCase();
      const val = line.substring(colonIdx + 1).trim();
      
      if (key === 'sitemap') {
        parsedSitemap = val;
      } else if (key === 'user-agent') {
        if (currentGroup && (currentGroup.allow.length || currentGroup.disallow.length || currentGroup.crawlDelay)) {
          parsedGroups.push(currentGroup);
          currentGroup = null;
        }
        if (!currentGroup) {
          currentGroup = { uas: [val], disallow: [], allow: [], crawlDelay: '' };
        } else {
          currentGroup.uas.push(val);
        }
      } else if (key === 'disallow') {
        if (currentGroup) currentGroup.disallow.push(val);
      } else if (key === 'allow') {
        if (currentGroup) currentGroup.allow.push(val);
      } else if (key === 'crawl-delay') {
        if (currentGroup) currentGroup.crawlDelay = val;
      }
    }
    if (currentGroup) parsedGroups.push(currentGroup);
    
    const newGroups: RuleGroup[] = [];
    for (const pg of parsedGroups) {
      for (const ua of pg.uas) {
        newGroups.push({
          id: Math.random().toString(36).substring(7),
          ua: ua,
          disallow: pg.disallow.join('\n'),
          allow: pg.allow.join('\n'),
          crawlDelay: pg.crawlDelay
        });
      }
    }
    
    if (newGroups.length > 0) {
      setGroups(newGroups);
    }
    if (parsedSitemap) {
      setSitemap(parsedSitemap);
    }
  };

  const out = useMemo(() => {
    const lines: string[] = [];
    for (const g of groups) {
      lines.push(`User-agent: ${g.ua || '*'}`);
      if (g.crawlDelay) lines.push(`Crawl-delay: ${g.crawlDelay}`);
      for (const d of g.disallow.split(/\r?\n/).filter(Boolean)) lines.push(`Disallow: ${d}`);
      for (const a of g.allow.split(/\r?\n/).filter(Boolean)) lines.push(`Allow: ${a}`);
      lines.push('');
    }
    if (sitemap) lines.push(`Sitemap: ${sitemap}`);
    return lines.join('\n').trim();
  }, [groups, sitemap]);

  const download = () => {
    const blob = new Blob([out], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'robots.txt';
    a.click();
  };

  return (
    <ToolShell title="Robots.txt Generator" description="Generate and manage your robots.txt file with specific bot targeting.">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-3 items-end p-4 border rounded-[var(--zoru-radius)] bg-zoru-surface-1">
          <div className="flex-1 space-y-1 w-full">
            <Label>Import Existing (URL)</Label>
            <Input 
              placeholder="https://example.com/robots.txt" 
              value={importUrl} 
              onChange={(e) => setImportUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleImport()}
            />
          </div>
          <Button onClick={handleImport} disabled={importing} className="w-full sm:w-auto">
            {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Import
          </Button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Rule Groups</h3>
          </div>
          {groups.map((g, i) => {
            const selectedOpt = BOT_OPTIONS.find(b => b.id === g.ua);
            return (
              <div key={g.id} className="p-4 border border-zoru-line rounded-[var(--zoru-radius)] space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-zoru-line">
                  <h4 className="font-medium text-sm text-zoru-ink-muted">Group {i + 1}</h4>
                  {groups.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeGroup(g.id)} className="h-8 px-2 text-zoru-danger-ink hover:text-zoru-danger-ink hover:bg-zoru-danger-bg">
                      <Trash className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>User-agent</Label>
                    <ZoruDynamicSelector
                      value={g.ua}
                      selectedLabel={selectedOpt ? selectedOpt.label : g.ua}
                      onChange={(id) => updateGroup(g.id, 'ua', id)}
                      fetchOptions={async (q) => {
                        const lower = q.toLowerCase();
                        return BOT_OPTIONS.filter(b => b.label.toLowerCase().includes(lower) || b.id.toLowerCase().includes(lower));
                      }}
                      onCreate={async (q) => ({ id: q, label: q })}
                      placeholder="Select or type a bot..."
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Crawl-delay (seconds)</Label>
                    <Input type="number" min="0" value={g.crawlDelay} onChange={(e) => updateGroup(g.id, 'crawlDelay', e.target.value)} placeholder="e.g. 10" />
                  </div>
                  <div className="space-y-1">
                    <Label>Disallow (one per line)</Label>
                    <Textarea value={g.disallow} onChange={(e) => updateGroup(g.id, 'disallow', e.target.value)} className="min-h-[100px] font-mono text-xs" placeholder="/admin&#10;/private" />
                  </div>
                  <div className="space-y-1">
                    <Label>Allow (one per line)</Label>
                    <Textarea value={g.allow} onChange={(e) => updateGroup(g.id, 'allow', e.target.value)} className="min-h-[100px] font-mono text-xs" placeholder="/public&#10;/assets" />
                  </div>
                </div>
              </div>
            );
          })}
          <Button variant="outline" onClick={addGroup} block>
            <Plus className="w-4 h-4 mr-2" /> Add Rule Group
          </Button>
        </div>

        <div className="space-y-1 pt-4">
          <Label>Sitemap URL (Global)</Label>
          <Input value={sitemap} onChange={(e) => setSitemap(e.target.value)} placeholder="https://example.com/sitemap.xml" />
        </div>

        <div className="space-y-2 pt-6">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Preview</Label>
            <Button onClick={download} size="sm">
              <Download className="w-4 h-4 mr-2" /> Download
            </Button>
          </div>
          <Textarea readOnly value={out} className="min-h-[200px] font-mono text-sm bg-zoru-surface-1" />
        </div>
      </div>
      <ZoruToaster />
    </ToolShell>
  );
}
