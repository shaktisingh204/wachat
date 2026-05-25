'use client';

import { Button, Input, Textarea, cn } from '@/components/zoruui';
import { ZoruDynamicSelector } from '@/components/zoruui';
import { useMemo, useState, useRef } from 'react';
import { Download, Upload, AlertCircle } from 'lucide-react';
import { ToolShell } from '@/components/seo-tools/tool-shell';

const LANGUAGES = [
  { id: 'x-default', label: 'x-default (Default)' },
  { id: 'af', label: 'Afrikaans (af)' },
  { id: 'sq', label: 'Albanian (sq)' },
  { id: 'am', label: 'Amharic (am)' },
  { id: 'ar', label: 'Arabic (ar)' },
  { id: 'hy', label: 'Armenian (hy)' },
  { id: 'az', label: 'Azerbaijani (az)' },
  { id: 'eu', label: 'Basque (eu)' },
  { id: 'be', label: 'Belarusian (be)' },
  { id: 'bn', label: 'Bengali (bn)' },
  { id: 'bs', label: 'Bosnian (bs)' },
  { id: 'bg', label: 'Bulgarian (bg)' },
  { id: 'ca', label: 'Catalan (ca)' },
  { id: 'zh', label: 'Chinese (zh)' },
  { id: 'zh-cn', label: 'Chinese - Simplified (zh-cn)' },
  { id: 'zh-tw', label: 'Chinese - Traditional (zh-tw)' },
  { id: 'hr', label: 'Croatian (hr)' },
  { id: 'cs', label: 'Czech (cs)' },
  { id: 'da', label: 'Danish (da)' },
  { id: 'nl', label: 'Dutch (nl)' },
  { id: 'nl-be', label: 'Dutch - Belgium (nl-be)' },
  { id: 'en', label: 'English (en)' },
  { id: 'en-us', label: 'English - US (en-us)' },
  { id: 'en-gb', label: 'English - UK (en-gb)' },
  { id: 'en-au', label: 'English - Australia (en-au)' },
  { id: 'en-ca', label: 'English - Canada (en-ca)' },
  { id: 'en-ie', label: 'English - Ireland (en-ie)' },
  { id: 'en-nz', label: 'English - New Zealand (en-nz)' },
  { id: 'en-za', label: 'English - South Africa (en-za)' },
  { id: 'et', label: 'Estonian (et)' },
  { id: 'fi', label: 'Finnish (fi)' },
  { id: 'fr', label: 'French (fr)' },
  { id: 'fr-fr', label: 'French - France (fr-fr)' },
  { id: 'fr-ca', label: 'French - Canada (fr-ca)' },
  { id: 'fr-ch', label: 'French - Switzerland (fr-ch)' },
  { id: 'gl', label: 'Galician (gl)' },
  { id: 'ka', label: 'Georgian (ka)' },
  { id: 'de', label: 'German (de)' },
  { id: 'de-de', label: 'German - Germany (de-de)' },
  { id: 'de-at', label: 'German - Austria (de-at)' },
  { id: 'de-ch', label: 'German - Switzerland (de-ch)' },
  { id: 'el', label: 'Greek (el)' },
  { id: 'gu', label: 'Gujarati (gu)' },
  { id: 'he', label: 'Hebrew (he)' },
  { id: 'hi', label: 'Hindi (hi)' },
  { id: 'hu', label: 'Hungarian (hu)' },
  { id: 'is', label: 'Icelandic (is)' },
  { id: 'id', label: 'Indonesian (id)' },
  { id: 'it', label: 'Italian (it)' },
  { id: 'it-it', label: 'Italian - Italy (it-it)' },
  { id: 'it-ch', label: 'Italian - Switzerland (it-ch)' },
  { id: 'ja', label: 'Japanese (ja)' },
  { id: 'kn', label: 'Kannada (kn)' },
  { id: 'ko', label: 'Korean (ko)' },
  { id: 'lv', label: 'Latvian (lv)' },
  { id: 'lt', label: 'Lithuanian (lt)' },
  { id: 'mk', label: 'Macedonian (mk)' },
  { id: 'ms', label: 'Malay (ms)' },
  { id: 'ml', label: 'Malayalam (ml)' },
  { id: 'mr', label: 'Marathi (mr)' },
  { id: 'no', label: 'Norwegian (no)' },
  { id: 'fa', label: 'Persian (fa)' },
  { id: 'pl', label: 'Polish (pl)' },
  { id: 'pt', label: 'Portuguese (pt)' },
  { id: 'pt-br', label: 'Portuguese - Brazil (pt-br)' },
  { id: 'pt-pt', label: 'Portuguese - Portugal (pt-pt)' },
  { id: 'ro', label: 'Romanian (ro)' },
  { id: 'ru', label: 'Russian (ru)' },
  { id: 'sr', label: 'Serbian (sr)' },
  { id: 'sk', label: 'Slovak (sk)' },
  { id: 'sl', label: 'Slovenian (sl)' },
  { id: 'es', label: 'Spanish (es)' },
  { id: 'es-es', label: 'Spanish - Spain (es-es)' },
  { id: 'es-mx', label: 'Spanish - Mexico (es-mx)' },
  { id: 'es-ar', label: 'Spanish - Argentina (es-ar)' },
  { id: 'sw', label: 'Swahili (sw)' },
  { id: 'sv', label: 'Swedish (sv)' },
  { id: 'ta', label: 'Tamil (ta)' },
  { id: 'te', label: 'Telugu (te)' },
  { id: 'th', label: 'Thai (th)' },
  { id: 'tr', label: 'Turkish (tr)' },
  { id: 'uk', label: 'Ukrainian (uk)' },
  { id: 'ur', label: 'Urdu (ur)' },
  { id: 'vi', label: 'Vietnamese (vi)' },
  { id: 'cy', label: 'Welsh (cy)' }
];

function isValidUrl(url: string) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function isValidHreflang(lang: string) {
  if (lang.toLowerCase() === 'x-default') return true;
  return /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,4})?(-[a-zA-Z0-9]{2,8})?$/.test(lang);
}

export default function HreflangGeneratorPage() {
  const [rows, setRows] = useState([{ lang: 'x-default', url: '' }, { lang: 'en', url: '' }]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const add = () => setRows((r) => [...r, { lang: '', url: '' }]);
  const remove = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));
  const update = (i: number, k: 'lang' | 'url', v: string) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)));

  const out = useMemo(
    () => rows
      .filter((r) => r.lang && r.url && isValidUrl(r.url) && isValidHreflang(r.lang))
      .map((r) => `<link rel="alternate" hreflang="${r.lang}" href="${r.url}" />`)
      .join('\n'),
    [rows],
  );

  const exportCSV = () => {
    const header = 'lang,url\n';
    const csv = rows
      .filter((r) => r.lang || r.url)
      .map((r) => `${r.lang},${r.url}`)
      .join('\n');
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
    return LANGUAGES.filter(
      (l) => l.id.toLowerCase().includes(lowerQuery) || l.label.toLowerCase().includes(lowerQuery)
    );
  };

  return (
    <ToolShell title="Hreflang Tag Generator" description="Generate hreflang alternate links for multilingual pages.">
      <div className="flex flex-wrap gap-2 justify-end mb-4">
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

      <div className="space-y-4">
        <div className="hidden md:flex gap-4 font-medium text-sm text-zoru-ink px-1">
          <div className="w-64">Language / Region</div>
          <div className="flex-1">URL</div>
          <div className="w-10"></div>
        </div>
        {rows.map((r, i) => {
          const langInvalid = r.lang !== '' && !isValidHreflang(r.lang);
          const urlInvalid = r.url !== '' && !isValidUrl(r.url);
          
          return (
            <div key={i} className="flex flex-col md:flex-row gap-4 items-start md:items-center p-3 md:p-0 border border-zoru-line md:border-transparent rounded-[var(--zoru-radius)] md:rounded-none bg-zoru-surface-2 md:bg-transparent">
              <div className="w-full md:w-64 flex flex-col gap-1">
                <div className="md:hidden text-xs font-medium text-zoru-ink-muted px-1">Language / Region</div>
                <ZoruDynamicSelector
                  className={cn(langInvalid && "border-zoru-danger")}
                  value={r.lang}
                  onChange={(id) => update(i, 'lang', id)}
                  fetchOptions={fetchOptions}
                  placeholder="Select locale or enter custom"
                  selectedLabel={LANGUAGES.find(l => l.id === r.lang)?.label || r.lang}
                  onCreate={async (label) => {
                    return { id: label.toLowerCase().trim(), label };
                  }}
                />
                {langInvalid && (
                  <div className="flex items-center text-zoru-danger text-xs mt-1 px-1">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Invalid language code format
                  </div>
                )}
              </div>
              <div className="flex-1 w-full flex flex-col gap-1">
                <div className="md:hidden text-xs font-medium text-zoru-ink-muted px-1">URL</div>
                <div className="flex gap-2">
                  <Input 
                    className="flex-1" 
                    invalid={urlInvalid}
                    value={r.url} 
                    onChange={(e) => update(i, 'url', e.target.value)} 
                    placeholder="https://example.com/en" 
                  />
                  <Button variant="ghost" onClick={() => remove(i)} className="md:hidden self-start text-zoru-danger">Remove</Button>
                </div>
                {urlInvalid && (
                  <div className="flex items-center text-zoru-danger text-xs mt-1 px-1">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Invalid URL (must include http:// or https://)
                  </div>
                )}
              </div>
              <Button variant="ghost" onClick={() => remove(i)} className="hidden md:flex shrink-0">×</Button>
            </div>
          );
        })}
        <Button variant="outline" onClick={add}>+ Add language</Button>
      </div>

      <div className="mt-8">
        <h3 className="text-sm font-medium text-zoru-ink mb-2">Generated Output</h3>
        <Textarea 
          readOnly 
          value={out} 
          className="min-h-[200px] font-mono text-xs" 
          placeholder={rows.some(r => r.lang && r.url) ? "Fix errors to see valid output." : "Enter locales and URLs above to generate hreflang tags."}
        />
        <Button 
          disabled={!out} 
          onClick={() => {
            if (out) navigator.clipboard.writeText(out);
          }} 
          className="mt-4"
        >
          Copy Code
        </Button>
      </div>
    </ToolShell>
  );
}
