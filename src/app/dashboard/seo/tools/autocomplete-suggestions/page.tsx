'use client';

import { Button, Input, Card, ZoruCardContent } from '@/components/zoruui';
import { useState } from 'react';
import { Download, Copy, Check } from 'lucide-react';
import { apiFetchUrl } from '@/lib/seo-tools/api-client';

import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function AutocompleteSuggestionsPage() {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const run = async () => {
    if (!q.trim()) return;
    setLoading(true); 
    setError(''); 
    setCopied(false);
    try {
      // Proxy request via apiFetchUrl to bypass CORS and get direct Google Suggest response
      const targetUrl = `http://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(q.trim())}`;
      const r = await apiFetchUrl(targetUrl);
      
      if (r.error) {
        setError(r.error);
        return;
      }

      // Expected JSON format: ["search term", ["suggestion1", "suggestion2", ...]]
      let data;
      try {
        data = JSON.parse(r.body);
      } catch (parseErr) {
        setError('Failed to parse suggestions from Google.');
        return;
      }

      if (Array.isArray(data) && data.length > 1 && Array.isArray(data[1])) {
        setResults(data[1]);
      } else {
        setResults([]);
      }
    } catch (e: any) {
      setError(e?.message || 'failed');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = () => {
    if (results.length === 0) return;
    const csvContent = "data:text/csv;charset=utf-8,Suggestion\n" + results.map(r => `"${r.replace(/"/g, '""')}"`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `autocomplete-suggestions-${q.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'keyword'}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleCopyAll = () => {
    if (results.length === 0) return;
    navigator.clipboard.writeText(results.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ToolShell title="Autocomplete Suggestions" description="Google autocomplete for your seed keyword.">
      <div className="flex gap-2">
        <Input 
          value={q} 
          onChange={(e) => setQ(e.target.value)} 
          placeholder="e.g. seo tools" 
          onKeyDown={(e) => e.key === 'Enter' && run()} 
        />
        <Button onClick={run} disabled={loading}>
          {loading ? 'Loading…' : 'Suggest'}
        </Button>
      </div>
      {error && (
        <Card className="border-zoru-line">
          <ZoruCardContent className="p-4 text-zoru-ink text-sm">
            {error}
          </ZoruCardContent>
        </Card>
      )}
      {results.length > 0 && (
        <Card>
          <div className="flex justify-between items-center p-4 border-b">
            <h3 className="font-medium text-sm">Results ({results.length})</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopyAll}>
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? 'Copied' : 'Copy All'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCsv}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
          <ZoruCardContent className="p-4 space-y-1">
            {results.map((s, i) => (
              <div key={i} className="text-sm border-b last:border-0 py-2">
                {s}
              </div>
            ))}
          </ZoruCardContent>
        </Card>
      )}
    </ToolShell>
  );
}
