'use client';

import { Button, Textarea, Card, CardBody, Table, THead, Tr, Th, TBody, Td } from '@/components/sabcrm/20ui';
import { useState } from 'react';
import { Copy, Download, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl, parseHtml } from '@/lib/seo-tools/api-client';
import { useToast } from '@/components/sabcrm/20ui';

export default function DescriptionCheckerPage() {
  const [urlsInput, setUrlsInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ url: string; desc: string | null; error?: string }[]>([]);
  const { toast } = useToast();

  const run = async () => {
    const urls = urlsInput.split('\n').map(u => u.trim()).filter(Boolean);
    if (urls.length === 0) return;

    setLoading(true);
    setResults([]);

    const newResults: typeof results = [];

    // Process sequentially to not overload proxy or browser
    for (const url of urls) {
      try {
        let fetchUrl = url;
        if (!/^https?:\/\//i.test(fetchUrl)) fetchUrl = 'https://' + fetchUrl;
        
        const r = await apiFetchUrl(fetchUrl);
        if (r.error) {
          newResults.push({ url: fetchUrl, desc: null, error: r.error });
        } else {
          try {
            const parsed = parseHtml(r.body || '');
            newResults.push({ url: fetchUrl, desc: parsed.metaDescription || null });
          } catch (parseErr: any) {
            newResults.push({ url: fetchUrl, desc: null, error: 'Failed to parse HTML' });
          }
        }
      } catch (err: any) {
        newResults.push({ url, desc: null, error: err.message || 'Network error' });
      }
      setResults([...newResults]); // update progressively
    }

    setLoading(false);
  };

  const copyToClipboard = () => {
    const text = results.map(r => `${r.url}\t${r.desc || ''}\t${r.error || ''}`).join('\n');
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard!' });
  };

  const exportCSV = () => {
    const header = ['URL', 'Description', 'Length', 'Status', 'Error'];
    const rows = results.map(r => {
      const len = r.desc?.length || 0;
      const status = r.error ? 'Error' : r.desc === null ? 'Missing' : len < 120 ? 'Too short' : len > 160 ? 'Too long' : 'OK';
      return [
        r.url,
        r.desc || '',
        r.desc ? len.toString() : '',
        status,
        r.error || ''
      ].map(field => `"${field.replace(/"/g, '""')}"`).join(',');
    });
    
    const csvContent = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'description-checker.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <ToolShell title="Meta Description Checker" description="Check the meta description length for multiple URLs (120–160 chars recommended).">
      <div className="space-y-4">
        <div className="flex flex-col gap-2">
          <Textarea 
            value={urlsInput} 
            onChange={(e) => setUrlsInput(e.target.value)} 
            placeholder="Enter URLs (one per line)&#10;https://example.com&#10;https://example.org" 
            className="min-h-[120px]"
            disabled={loading}
          />
          <Button onClick={run} disabled={loading || !urlsInput.trim()} className="w-fit">
            {loading ? 'Checking...' : 'Check URLs'}
          </Button>
        </div>

        {results.length > 0 && (
          <Card>
            <CardBody className="p-0">
              <div className="flex justify-end gap-2 p-4 border-b">
                <Button variant="outline" size="sm" onClick={copyToClipboard}>
                  <Copy className="w-4 h-4 mr-2" /> Copy
                </Button>
                <Button variant="outline" size="sm" onClick={exportCSV}>
                  <Download className="w-4 h-4 mr-2" /> Export CSV
                </Button>
              </div>
              <Table>
                <THead>
                  <Tr>
                    <Th>URL</Th>
                    <Th>Description</Th>
                    <Th className="w-[100px]">Length</Th>
                    <Th className="w-[120px]">Status</Th>
                  </Tr>
                </THead>
                <TBody>
                  {results.map((r, i) => {
                    const len = r.desc?.length || 0;
                    const isOk = len >= 120 && len <= 160;
                    const isMissing = r.desc === null && !r.error;
                    const isTooShort = len > 0 && len < 120;
                    const isTooLong = len > 160;
                    
                    return (
                      <Tr key={i}>
                        <Td className="font-medium max-w-[200px] truncate" title={r.url}>
                          {r.url}
                        </Td>
                        <Td>
                          {r.error ? (
                            <span className="text-[var(--st-text)] text-sm">{r.error}</span>
                          ) : r.desc ? (
                            <span className="text-sm">{r.desc}</span>
                          ) : (
                            <span className="text-[var(--st-text-secondary)] italic text-sm">No description found</span>
                          )}
                        </Td>
                        <Td>
                          {r.desc ? len : '-'}
                        </Td>
                        <Td>
                          {r.error ? (
                            <div className="flex items-center text-[var(--st-text)] text-xs gap-1">
                              <AlertTriangle className="w-3 h-3" /> Error
                            </div>
                          ) : isMissing ? (
                            <div className="flex items-center text-[var(--st-text)] text-xs gap-1">
                              <XCircle className="w-3 h-3" /> Missing
                            </div>
                          ) : isOk ? (
                            <div className="flex items-center text-[var(--st-text)] text-xs gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Good
                            </div>
                          ) : (
                            <div className="flex items-center text-[var(--st-text)] text-xs gap-1">
                              <AlertTriangle className="w-3 h-3" /> {isTooShort ? 'Too short' : 'Too long'}
                            </div>
                          )}
                        </Td>
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            </CardBody>
          </Card>
        )}
      </div>
    </ToolShell>
  );
}
