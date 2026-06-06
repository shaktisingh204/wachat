'use client';

import { Button, Input, Card, ZoruCardContent, cn } from '@/components/sabcrm/20ui/compat';
import { cn as _zoruCn, useState } from 'react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiDnsLookup } from '@/lib/seo-tools/api-client';

export default function UrlToIpPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      const host = new URL(/^https?:\/\//.test(url) ? url : `http://${url}`).hostname;
      
      const r = await apiDnsLookup(host);
      if (r.error) { setError(r.error); return; }
      
      const records = r.records || {};
      
      const hasA = Array.isArray(records.A) && records.A.length > 0;
      const hasAAAA = Array.isArray(records.AAAA) && records.AAAA.length > 0;
      const hasCNAME = Array.isArray(records.CNAME) && records.CNAME.length > 0;
      
      // Fallback: If no A/AAAA records but we have a CNAME, resolve the CNAME target
      if (!hasA && !hasAAAA && hasCNAME) {
        const cnameTarget = records.CNAME[0];
        
        try {
          const fallbackA = await apiDnsLookup(cnameTarget, 'A');
          if (!fallbackA.error && Array.isArray(fallbackA.records?.A)) {
            records.A = fallbackA.records.A;
          }
        } catch (e) {}

        try {
          const fallbackAAAA = await apiDnsLookup(cnameTarget, 'AAAA');
          if (!fallbackAAAA.error && Array.isArray(fallbackAAAA.records?.AAAA)) {
            records.AAAA = fallbackAAAA.records.AAAA;
          }
        } catch (e) {}
      }
      
      setResult({ host, records });
    } catch (e: any) {
      setError(e?.message || 'invalid url');
    } finally { setLoading(false); }
  };

  const renderSection = (title: string, data: any, type: string) => {
    if (!data || data.error) return null;
    if (Array.isArray(data) && data.length === 0) return null;
    
    return (
      <div className="mt-4 first:mt-0">
        <div className="text-sm font-semibold mb-2">{title}</div>
        <ul className="font-mono text-xs space-y-1 bg-[var(--st-bg-muted)]/50 p-3 rounded-md">
          {Array.isArray(data) ? data.map((item, i) => {
            if (type === 'MX' && item.exchange) {
              return <li key={i} className="border-t py-1.5 first:border-0 border-muted/80">{item.priority} {item.exchange}</li>;
            }
            if (type === 'SOA' && typeof item === 'object') {
              return (
                <li key={i} className="border-t py-1.5 first:border-0 border-muted/80">
                  {Object.entries(item).map(([k, v]) => `${k}: ${v}`).join(', ')}
                </li>
              );
            }
            const val = Array.isArray(item) ? item.join(' ') : (typeof item === 'object' ? JSON.stringify(item) : item);
            return (
              <li key={i} className="border-t py-1.5 first:border-0 border-muted/80 break-all">
                {val}
              </li>
            );
          }) : (
            <li className="border-t py-1.5 first:border-0 border-muted/80 break-all">
              {type === 'SOA' && typeof data === 'object' 
                ? Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(', ') 
                : (typeof data === 'object' ? JSON.stringify(data) : data)}
            </li>
          )}
        </ul>
      </div>
    );
  };

  return (
    <ToolShell title="IP & DNS Lookup (Server Location)" description="Resolve a URL or hostname to its IP addresses and check DNS records. Combines URL to IP and Server Location functionality.">
      <div className="flex gap-2">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="example.com or https://example.com" />
        <Button onClick={run} disabled={loading}>{loading ? 'Looking up…' : 'Resolve'}</Button>
      </div>
      
      {error && (
        <Card className="border-[var(--st-border)] mt-4">
          <ZoruCardContent className="p-4 text-[var(--st-text)] text-sm">
            {error}
          </ZoruCardContent>
        </Card>
      )}
      
      {result && (
        <Card className="mt-4">
          <ZoruCardContent className="p-4">
            <div className="text-sm font-semibold mb-4 border-b pb-2">
              Results for: <span className="font-normal">{result.host}</span>
            </div>
            
            {renderSection('IPv4 Addresses (A)', result.records.A, 'A')}
            {renderSection('IPv6 Addresses (AAAA)', result.records.AAAA, 'AAAA')}
            {renderSection('CNAME Records', result.records.CNAME, 'CNAME')}
            {renderSection('MX Records (Mail)', result.records.MX, 'MX')}
            {renderSection('TXT Records', result.records.TXT, 'TXT')}
            {renderSection('NS Records (Nameservers)', result.records.NS, 'NS')}
            {renderSection('SOA Record', result.records.SOA, 'SOA')}
            
            {(Array.isArray(result.records.A) && result.records.A.length > 0) && (
              <div className="text-xs text-[var(--st-text-secondary)] pt-4 mt-4 border-t border-muted">
                Note: GeoIP location requires an offline MaxMind database or paid API, which is not included in this local-only mode. The IPs shown above indicate the precise server addresses.
              </div>
            )}
          </ZoruCardContent>
        </Card>
      )}
    </ToolShell>
  );
}
