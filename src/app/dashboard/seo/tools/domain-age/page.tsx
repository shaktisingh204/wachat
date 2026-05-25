'use client';

import React, { Component, ErrorInfo, ReactNode, useState } from 'react';
import { Button, Input, Card, ZoruCardContent } from '@/components/zoruui';
import { Copy, Download, AlertCircle, RefreshCw } from 'lucide-react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiWhois, apiFetchUrl } from '@/lib/seo-tools/api-client';

class LocalErrorBoundary extends Component<{ children?: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children?: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Domain Age Error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <Card className="border-red-500 m-4">
          <ZoruCardContent className="p-4 text-red-600">
            <div className="flex items-center gap-2 font-bold mb-2">
              <AlertCircle className="w-5 h-5" />
              <p>Something went wrong</p>
            </div>
            <p className="text-sm">{this.state.error?.message || 'An unexpected error occurred.'}</p>
            <Button variant="outline" className="mt-4 border-red-500 text-red-600" onClick={() => this.setState({ hasError: false, error: null })}>
              Try again
            </Button>
          </ZoruCardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}

function DomainAgeContent() {
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<{ domain: string; created: string; age: string; registrar: string; expires: string; raw?: string } | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const cleanDomain = (input: string) => {
    try {
      const url = new URL(input.startsWith('http') ? input : `http://${input}`);
      return url.hostname.replace(/^www\./, '');
    } catch {
      return input.trim().replace(/^www\./, '');
    }
  };

  const run = async () => {
    const cleaned = cleanDomain(domain);
    if (!cleaned) {
      setError('Please enter a valid domain name.');
      return;
    }
    
    setLoading(true); 
    setError(''); 
    setInfo(null);
    setCopied(false);
    
    try {
      const r = await apiWhois(cleaned);
      let p = r.parsed || {};
      let raw = r.raw || '';
      
      let created = p['creation date'] || p['created'] || p['registered'] || '';
      let registrar = p['registrar'] || '';
      let expires = p['registry expiry date'] || p['expires'] || p['expiration date'] || '';
      
      // Fallback to Wayback Machine using apiFetchUrl proxy to avoid CORS
      if (!created || r.error) {
        try {
          const wbRes = await apiFetchUrl(`https://archive.org/wayback/available?url=${cleaned}`);
          if (wbRes.body) {
            const data = JSON.parse(wbRes.body);
            const ts = data?.archived_snapshots?.closest?.timestamp;
            if (ts && ts.length >= 8) {
              created = `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)} (Wayback Machine)`;
              if (!registrar) registrar = 'Archive.org Estimate';
              if (r.error && !raw) {
                raw = `WHOIS failed or no date found. Fallback to Wayback Machine.\nFirst seen: ${created}`;
              }
            }
          }
        } catch (err) {
          console.error('Wayback fallback failed', err);
        }
      }
      
      if (!created && r.error) {
        setError(r.error); 
        setLoading(false);
        return; 
      }
      
      let age = '—';
      if (created) {
        const dateStr = created.split(' ')[0]; // Extract just the date part if it has " (Wayback Machine)"
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          const years = (Date.now() - d.getTime()) / (365 * 86400000);
          age = `${years.toFixed(1)} years`;
        }
      }
      setInfo({ domain: r.domain || cleaned, created, age, registrar, expires, raw });
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching domain age.');
    } finally { 
      setLoading(false); 
    }
  };

  const handleCopy = () => {
    if (!info) return;
    const text = `Domain: ${info.domain}\nAge: ${info.age}\nCreated: ${info.created || '—'}\nExpires: ${info.expires || '—'}\nRegistrar: ${info.registrar || '—'}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportCSV = () => {
    if (!info) return;
    const header = 'Domain,Age,Created,Expires,Registrar\n';
    const row = `"${info.domain}","${info.age}","${info.created}","${info.expires}","${info.registrar}"\n`;
    const blob = new Blob([header + row], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `domain-age-${info.domain}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <ToolShell title="Domain Age Checker" description="Check when a domain was first registered and analyze its WHOIS data.">
      <div className="flex flex-col md:flex-row gap-2 mb-6">
        <Input 
          className="flex-1"
          value={domain} 
          onChange={(e) => setDomain(e.target.value)} 
          onKeyDown={(e) => e.key === 'Enter' && !loading && run()}
          placeholder="example.com or https://example.com" 
        />
        <Button onClick={run} disabled={loading || !domain.trim()} className="min-w-[120px]">
          {loading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null}
          {loading ? 'Checking…' : 'Check Age'}
        </Button>
      </div>

      {error && (
        <Card className="border-red-500 mb-6">
          <ZoruCardContent className="p-4 text-red-600 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <p>{error}</p>
          </ZoruCardContent>
        </Card>
      )}

      {info && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Results for {info.domain}</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="w-4 h-4 mr-2" />
                {copied ? 'Copied!' : 'Copy'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <ZoruCardContent className="p-4 flex flex-col justify-center items-center text-center h-full min-h-[120px] bg-primary/5">
                <div className="text-sm text-muted-foreground mb-1">Domain Age</div>
                <div className="text-3xl font-bold text-primary">{info.age}</div>
              </ZoruCardContent>
            </Card>
            
            <Card>
              <ZoruCardContent className="p-4 space-y-3">
                <div className="grid grid-cols-3 gap-2 border-b pb-2">
                  <span className="font-semibold text-muted-foreground col-span-1">Created:</span>
                  <span className="col-span-2 text-right">{info.created || '—'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 border-b pb-2">
                  <span className="font-semibold text-muted-foreground col-span-1">Expires:</span>
                  <span className="col-span-2 text-right">{info.expires || '—'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-semibold text-muted-foreground col-span-1">Registrar:</span>
                  <span className="col-span-2 text-right truncate" title={info.registrar}>{info.registrar || '—'}</span>
                </div>
              </ZoruCardContent>
            </Card>
          </div>
          
          {info.raw && (
            <Card className="mt-6">
              <ZoruCardContent className="p-4 relative">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">Raw WHOIS Data</h4>
                  <Button variant="ghost" size="sm" onClick={() => {
                    navigator.clipboard.writeText(info.raw!);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Raw
                  </Button>
                </div>
                <div className="bg-muted p-4 rounded-md overflow-x-auto text-xs font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {info.raw}
                </div>
              </ZoruCardContent>
            </Card>
          )}
        </div>
      )}
    </ToolShell>
  );
}

export default function DomainAgePage() {
  return (
    <LocalErrorBoundary>
      <DomainAgeContent />
    </LocalErrorBoundary>
  );
}
