'use client';

import { Button, Input, Textarea, cn } from '@/components/zoruui';
import { ZoruDynamicSelector } from '@/components/zoruui';
import { useMemo, useState, useRef } from 'react';
import { Download, Upload } from 'lucide-react';
import { ToolShell } from '@/components/seo-tools/tool-shell';

const LANGUAGES = [
  { id: 'x-default', label: 'x-default (Default)' },
  { id: 'en', label: 'English (en)' },
  { id: 'en-us', label: 'English - US (en-us)' },
  { id: 'en-gb', label: 'English - UK (en-gb)' },
  { id: 'en-ca', label: 'English - Canada (en-ca)' },
  { id: 'en-au', label: 'English - Australia (en-au)' },
  { id: 'es', label: 'Spanish (es)' },
  { id: 'es-es', label: 'Spanish - Spain (es-es)' },
  { id: 'es-mx', label: 'Spanish - Mexico (es-mx)' },
  { id: 'fr', label: 'French (fr)' },
  { id: 'fr-fr', label: 'French - France (fr-fr)' },
  { id: 'fr-ca', label: 'French - Canada (fr-ca)' },
  { id: 'de', label: 'German (de)' },
  { id: 'de-de', label: 'German - Germany (de-de)' },
  { id: 'de-at', label: 'German - Austria (de-at)' },
  { id: 'de-ch', label: 'German - Switzerland (de-ch)' },
  { id: 'it', label: 'Italian (it)' },
  { id: 'it-it', label: 'Italian - Italy (it-it)' },
  { id: 'pt', label: 'Portuguese (pt)' },
  { id: 'pt-br', label: 'Portuguese - Brazil (pt-br)' },
  { id: 'pt-pt', label: 'Portuguese - Portugal (pt-pt)' },
  { id: 'nl', label: 'Dutch (nl)' },
  { id: 'nl-nl', label: 'Dutch - Netherlands (nl-nl)' },
  { id: 'nl-be', label: 'Dutch - Belgium (nl-be)' },
  { id: 'ru', label: 'Russian (ru)' },
  { id: 'ja', label: 'Japanese (ja)' },
  { id: 'zh-cn', label: 'Chinese - Simplified (zh-cn)' },
  { id: 'zh-tw', label: 'Chinese - Traditional (zh-tw)' },
  { id: 'ko', label: 'Korean (ko)' },
  { id: 'ar', label: 'Arabic (ar)' },
  { id: 'hi', label: 'Hindi (hi)' },
  { id: 'tr', label: 'Turkish (tr)' },
  { id: 'pl', label: 'Polish (pl)' },
  { id: 'sv', label: 'Swedish (sv)' },
  { id: 'da', label: 'Danish (da)' },
  { id: 'fi', label: 'Finnish (fi)' },
  { id: 'no', label: 'Norwegian (no)' },
  { id: 'cs', label: 'Czech (cs)' },
  { id: 'el', label: 'Greek (el)' },
  { id: 'hu', label: 'Hungarian (hu)' },
  { id: 'ro', label: 'Romanian (ro)' },
  { id: 'sk', label: 'Slovak (sk)' },
  { id: 'uk', label: 'Ukrainian (uk)' },
  { id: 'vi', label: 'Vietnamese (vi)' },
  { id: 'th', label: 'Thai (th)' },
  { id: 'id', label: 'Indonesian (id)' },
  { id: 'ms', label: 'Malay (ms)' },
  { id: 'bn', label: 'Bengali (bn)' }
];

export default function HreflangGeneratorPage() {
  const [rows, setRows] = useState([{ lang: 'en', url: '' }]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const add = () => setRows((r) => [...r, { lang: '', url: '' }]);
  const remove = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));
  const update = (i: number, k: 'lang' | 'url', v: string) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)));

  const out = useMemo(
    () => rows.filter((r) => r.lang && r.url).map((r) => `<link rel="alternate" hreflang="${r.lang}" href="${r.url}" />`).join('\n'),
    [rows],
  );

  const exportCSV = () => {
    const header = 'lang,url\n';
    const csv = rows.map(r => `${r.lang},${r.url}`).join('\n');
    const blob = new Blob([header + csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hreflang.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      const newRows = [];
      let start = 0;
      if (lines[0].toLowerCase().includes('lang')) {
        start = 1;
      }
      for (let i = start; i < lines.length; i++) {
        const commaIndex = lines[i].indexOf(',');
        if (commaIndex > -1) {
          newRows.push({
            lang: lines[i].substring(0, commaIndex).trim(),
            url: lines[i].substring(commaIndex + 1).trim()
          });
        }
      }
      if (newRows.length > 0) {
        setRows(newRows);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const fetchOptions = async (query: string) => {
    const lowerQuery = query.toLowerCase();
    return LANGUAGES.filter(l => l.id.toLowerCase().includes(lowerQuery) || l.label.toLowerCase().includes(lowerQuery));
  };

  return (
    <ToolShell title="Hreflang Tag Generator" description="Generate hreflang alternate links for multilingual pages.">
      <div className="flex gap-2 justify-end mb-4">
        <input 
          type="file" 
          accept=".csv" 
          className="hidden" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
        />
        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
          <Upload className="w-4 h-4 mr-2" />
          Import CSV
        </Button>
        <Button variant="outline" onClick={exportCSV}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex gap-2 font-medium text-sm text-zoru-ink px-1">
          <div className="w-48">Language / Region</div>
          <div className="flex-1">URL</div>
          <div className="w-10"></div>
        </div>
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2 items-center">
            <div className="w-48">
              <ZoruDynamicSelector
                value={r.lang}
                onChange={(id) => update(i, 'lang', id)}
                fetchOptions={fetchOptions}
                placeholder="Select locale"
                selectedLabel={LANGUAGES.find(l => l.id === r.lang)?.label || r.lang}
                onCreate={async (label) => {
                  return { id: label.toLowerCase().trim(), label };
                }}
              />
            </div>
            <Input 
              className="flex-1" 
              value={r.url} 
              onChange={(e) => update(i, 'url', e.target.value)} 
              placeholder="https://example.com/en" 
            />
            <Button variant="ghost" onClick={() => remove(i)}>×</Button>
          </div>
        ))}
        <Button variant="outline" onClick={add}>+ Add language</Button>
      </div>
      <Textarea readOnly value={out} className="min-h-[200px] font-mono text-xs mt-6" />
      <Button onClick={() => navigator.clipboard.writeText(out)} className="mt-2">Copy Code</Button>
    </ToolShell>
  );
}
