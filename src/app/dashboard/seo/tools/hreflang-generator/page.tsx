'use client';

import { useMemo, useState } from 'react';
import { Download, X, Copy } from 'lucide-react';
import {
  Button,
  IconButton,
  Input,
  Textarea,
  Field,
  Combobox,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  useToast,
  type ComboboxOption,
} from '@/components/sabcrm/20ui';
import { SabFileToFileButton } from '@/components/sabfiles';
import { ToolShell } from '@/components/seo-tools/tool-shell';

const LANGUAGES: ComboboxOption[] = [
  { value: 'x-default', label: 'x-default (Default)' },
  { value: 'af', label: 'Afrikaans (af)' },
  { value: 'sq', label: 'Albanian (sq)' },
  { value: 'am', label: 'Amharic (am)' },
  { value: 'ar', label: 'Arabic (ar)' },
  { value: 'hy', label: 'Armenian (hy)' },
  { value: 'az', label: 'Azerbaijani (az)' },
  { value: 'eu', label: 'Basque (eu)' },
  { value: 'be', label: 'Belarusian (be)' },
  { value: 'bn', label: 'Bengali (bn)' },
  { value: 'bs', label: 'Bosnian (bs)' },
  { value: 'bg', label: 'Bulgarian (bg)' },
  { value: 'ca', label: 'Catalan (ca)' },
  { value: 'zh', label: 'Chinese (zh)' },
  { value: 'zh-cn', label: 'Chinese - Simplified (zh-cn)' },
  { value: 'zh-tw', label: 'Chinese - Traditional (zh-tw)' },
  { value: 'hr', label: 'Croatian (hr)' },
  { value: 'cs', label: 'Czech (cs)' },
  { value: 'da', label: 'Danish (da)' },
  { value: 'nl', label: 'Dutch (nl)' },
  { value: 'nl-be', label: 'Dutch - Belgium (nl-be)' },
  { value: 'en', label: 'English (en)' },
  { value: 'en-us', label: 'English - US (en-us)' },
  { value: 'en-gb', label: 'English - UK (en-gb)' },
  { value: 'en-au', label: 'English - Australia (en-au)' },
  { value: 'en-ca', label: 'English - Canada (en-ca)' },
  { value: 'en-ie', label: 'English - Ireland (en-ie)' },
  { value: 'en-nz', label: 'English - New Zealand (en-nz)' },
  { value: 'en-za', label: 'English - South Africa (en-za)' },
  { value: 'et', label: 'Estonian (et)' },
  { value: 'fi', label: 'Finnish (fi)' },
  { value: 'fr', label: 'French (fr)' },
  { value: 'fr-fr', label: 'French - France (fr-fr)' },
  { value: 'fr-ca', label: 'French - Canada (fr-ca)' },
  { value: 'fr-ch', label: 'French - Switzerland (fr-ch)' },
  { value: 'gl', label: 'Galician (gl)' },
  { value: 'ka', label: 'Georgian (ka)' },
  { value: 'de', label: 'German (de)' },
  { value: 'de-de', label: 'German - Germany (de-de)' },
  { value: 'de-at', label: 'German - Austria (de-at)' },
  { value: 'de-ch', label: 'German - Switzerland (de-ch)' },
  { value: 'el', label: 'Greek (el)' },
  { value: 'gu', label: 'Gujarati (gu)' },
  { value: 'he', label: 'Hebrew (he)' },
  { value: 'hi', label: 'Hindi (hi)' },
  { value: 'hu', label: 'Hungarian (hu)' },
  { value: 'is', label: 'Icelandic (is)' },
  { value: 'id', label: 'Indonesian (id)' },
  { value: 'it', label: 'Italian (it)' },
  { value: 'it-it', label: 'Italian - Italy (it-it)' },
  { value: 'it-ch', label: 'Italian - Switzerland (it-ch)' },
  { value: 'ja', label: 'Japanese (ja)' },
  { value: 'kn', label: 'Kannada (kn)' },
  { value: 'ko', label: 'Korean (ko)' },
  { value: 'lv', label: 'Latvian (lv)' },
  { value: 'lt', label: 'Lithuanian (lt)' },
  { value: 'mk', label: 'Macedonian (mk)' },
  { value: 'ms', label: 'Malay (ms)' },
  { value: 'ml', label: 'Malayalam (ml)' },
  { value: 'mr', label: 'Marathi (mr)' },
  { value: 'no', label: 'Norwegian (no)' },
  { value: 'fa', label: 'Persian (fa)' },
  { value: 'pl', label: 'Polish (pl)' },
  { value: 'pt', label: 'Portuguese (pt)' },
  { value: 'pt-br', label: 'Portuguese - Brazil (pt-br)' },
  { value: 'pt-pt', label: 'Portuguese - Portugal (pt-pt)' },
  { value: 'ro', label: 'Romanian (ro)' },
  { value: 'ru', label: 'Russian (ru)' },
  { value: 'sr', label: 'Serbian (sr)' },
  { value: 'sk', label: 'Slovak (sk)' },
  { value: 'sl', label: 'Slovenian (sl)' },
  { value: 'es', label: 'Spanish (es)' },
  { value: 'es-es', label: 'Spanish - Spain (es-es)' },
  { value: 'es-mx', label: 'Spanish - Mexico (es-mx)' },
  { value: 'es-ar', label: 'Spanish - Argentina (es-ar)' },
  { value: 'sw', label: 'Swahili (sw)' },
  { value: 'sv', label: 'Swedish (sv)' },
  { value: 'ta', label: 'Tamil (ta)' },
  { value: 'te', label: 'Telugu (te)' },
  { value: 'th', label: 'Thai (th)' },
  { value: 'tr', label: 'Turkish (tr)' },
  { value: 'uk', label: 'Ukrainian (uk)' },
  { value: 'ur', label: 'Urdu (ur)' },
  { value: 'vi', label: 'Vietnamese (vi)' },
  { value: 'cy', label: 'Welsh (cy)' },
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
  const { toast } = useToast();
  const [rows, setRows] = useState([
    { lang: 'x-default', url: '' },
    { lang: 'en', url: '' },
  ]);

  const add = () => setRows((r) => [...r, { lang: '', url: '' }]);
  const remove = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));
  const update = (i: number, k: 'lang' | 'url', v: string) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)));

  const out = useMemo(
    () =>
      rows
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

  const importFromFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split('\n').map((l) => l.trim()).filter((l) => l);
      if (lines.length === 0) {
        toast.error('That file has no rows to import.');
        return;
      }
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
            url: lines[i].substring(commaIndex + 1).trim(),
          });
        }
      }
      if (newRows.length > 0) {
        setRows(newRows);
        toast.success(`Imported ${newRows.length} locales from CSV.`);
      } else {
        toast.error('Could not find any lang,url rows in that file.');
      }
    };
    reader.readAsText(file);
  };

  const searchLocales = async (query: string): Promise<ComboboxOption[]> => {
    const lowerQuery = query.toLowerCase();
    return LANGUAGES.filter(
      (l) =>
        l.value.toLowerCase().includes(lowerQuery) ||
        (l.label ?? '').toLowerCase().includes(lowerQuery),
    );
  };

  const copyCode = () => {
    if (!out) return;
    navigator.clipboard.writeText(out);
    toast.success('Hreflang tags copied to clipboard.');
  };

  return (
    <ToolShell
      title="Hreflang Tag Generator"
      description="Generate hreflang alternate links for multilingual pages."
    >
      <div className="flex flex-wrap gap-2 justify-end mb-4">
        <SabFileToFileButton
          accept="document"
          variant="outline"
          onPickFile={(file) => importFromFile(file)}
          onError={() => toast.error('Could not load that file. Please try again.')}
        >
          Import CSV
        </SabFileToFileButton>
        <Button variant="outline" iconLeft={Download} onClick={exportCSV}>
          Export CSV
        </Button>
      </div>

      <div className="space-y-4">
        {rows.map((r, i) => {
          const langInvalid = r.lang !== '' && !isValidHreflang(r.lang);
          const urlInvalid = r.url !== '' && !isValidUrl(r.url);

          return (
            <div
              key={i}
              className="flex flex-col md:flex-row gap-4 items-start p-3 md:p-0 border border-[var(--st-border)] md:border-transparent rounded-[var(--st-radius)] md:rounded-none bg-[var(--st-bg-secondary)] md:bg-transparent"
            >
              <div className="w-full md:w-64">
                <Field
                  label="Language / Region"
                  error={langInvalid ? 'Invalid language code format.' : undefined}
                >
                  <Combobox
                    aria-label="Language or region locale"
                    invalid={langInvalid}
                    value={r.lang}
                    onChange={(value) => update(i, 'lang', value)}
                    onSearch={searchLocales}
                    allowCustom
                    placeholder="Select locale or enter custom"
                  />
                </Field>
              </div>
              <div className="flex-1 w-full">
                <Field
                  label="URL"
                  error={urlInvalid ? 'Invalid URL (must include http:// or https://).' : undefined}
                >
                  <Input
                    className="w-full"
                    invalid={urlInvalid}
                    value={r.url}
                    onChange={(e) => update(i, 'url', e.target.value)}
                    placeholder="https://example.com/en"
                  />
                </Field>
              </div>
              <div className="flex shrink-0 md:pt-[26px] w-full md:w-auto justify-end">
                <IconButton label="Remove language" icon={X} onClick={() => remove(i)} />
              </div>
            </div>
          );
        })}
        <Button variant="outline" onClick={add}>
          + Add language
        </Button>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Generated Output</CardTitle>
        </CardHeader>
        <CardBody>
          <Field label="Hreflang tags">
            <Textarea
              readOnly
              value={out}
              className="min-h-[200px] font-mono text-xs"
              placeholder={
                rows.some((r) => r.lang && r.url)
                  ? 'Fix errors to see valid output.'
                  : 'Enter locales and URLs above to generate hreflang tags.'
              }
            />
          </Field>
          <Button disabled={!out} iconLeft={Copy} onClick={copyCode} className="mt-4">
            Copy Code
          </Button>
        </CardBody>
      </Card>
    </ToolShell>
  );
}
