'use client';

import { Button, Input, Textarea, cn } from '@/components/zoruui';
import { useMemo, useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';

interface RedirectRule {
  from: string;
  fromMatchType: 'exact' | 'startsWith' | 'regex';
  query: string;
  queryMatchType: 'exact' | 'contains' | 'regex';
  to: string;
  type: string;
  appendQuery: boolean;
}

export default function HtaccessRedirectPage() {
  const [rows, setRows] = useState<RedirectRule[]>([{ 
    from: '/old-path', 
    fromMatchType: 'exact',
    query: '', 
    queryMatchType: 'exact',
    to: '/new-path', 
    type: '301', 
    appendQuery: false 
  }]);

  const [forceHttps, setForceHttps] = useState(false);
  const [wwwHandling, setWwwHandling] = useState<'none' | 'add' | 'remove'>('none');
  const [preventDirListing, setPreventDirListing] = useState(false);
  const [preventHotlinking, setPreventHotlinking] = useState(false);
  const [allowedDomains, setAllowedDomains] = useState('');
  const [blockedIps, setBlockedIps] = useState('');

  const out = useMemo(() => {
    const lines = ['<IfModule mod_rewrite.c>', 'RewriteEngine On'];
    
    if (forceHttps) {
      lines.push('\n# Force HTTPS');
      lines.push('RewriteCond %{HTTPS} off');
      lines.push('RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]');
    }

    if (wwwHandling === 'add') {
      lines.push('\n# Add WWW');
      lines.push('RewriteCond %{HTTP_HOST} !^www\\. [NC]');
      lines.push('RewriteRule ^(.*)$ %{REQUEST_SCHEME}://www.%{HTTP_HOST}%{REQUEST_URI} [L,R=301]');
    } else if (wwwHandling === 'remove') {
      lines.push('\n# Remove WWW');
      lines.push('RewriteCond %{HTTP_HOST} ^www\\.(.*)$ [NC]');
      lines.push('RewriteRule ^(.*)$ %{REQUEST_SCHEME}://%1/$1 [L,R=301]');
    }

    if (preventDirListing) {
      lines.push('\n# Prevent Directory Listing');
      lines.push('Options -Indexes');
    }

    if (preventHotlinking) {
      lines.push('\n# Prevent Image Hotlinking');
      lines.push('RewriteCond %{HTTP_REFERER} !^$');
      if (allowedDomains.trim()) {
        const domains = allowedDomains.split(/[\s,]+/).filter(Boolean);
        domains.forEach(domain => {
           const escaped = domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
           lines.push(`RewriteCond %{HTTP_REFERER} !^https?://(www\\.)?${escaped} [NC]`);
        });
      }
      lines.push('RewriteRule \\.(gif|jpg|jpeg|png|webp|svg)$ - [F,NC]');
    }

    if (blockedIps.trim()) {
      lines.push('\n# Block IPs');
      lines.push('<RequireAll>');
      lines.push('  Require all granted');
      const ips = blockedIps.split(/[\s,]+/).filter(Boolean);
      ips.forEach(ip => {
        lines.push(`  Require not ip ${ip}`);
      });
      lines.push('</RequireAll>');
    }

    if (rows.some(r => r.from && r.to)) {
      lines.push('\n# Custom Redirects');
      for (const r of rows) {
        if (!r.from || !r.to) continue;
        
        let fromPath = r.from.replace(/^\//, ''); // Apache RewriteRule matches without leading slash usually in .htaccess
        
        if (r.fromMatchType === 'exact') {
           fromPath = `^${fromPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;
        } else if (r.fromMatchType === 'startsWith') {
           fromPath = `^${fromPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`;
        } else {
           fromPath = fromPath || '.*';
        }

        if (r.query) {
          let queryPattern = r.query;
          if (r.queryMatchType === 'exact') {
            queryPattern = `^${queryPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;
          } else if (r.queryMatchType === 'contains') {
            queryPattern = queryPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          }
          lines.push(`RewriteCond %{QUERY_STRING} ${queryPattern} [NC]`);
        }

        let toPath = r.to;
        let flags = [`R=${r.type}`, 'L'];
        
        if (r.appendQuery) {
          flags.push('QSA');
        } else {
          // If we want to discard the old query string, Apache requires appending a ? to the destination
          if (!toPath.includes('?')) {
            toPath += '?';
          }
        }
        
        lines.push(`RewriteRule ${fromPath} ${toPath} [${flags.join(',')}]`);
      }
    }

    lines.push('</IfModule>');
    return lines.join('\n');
  }, [rows, forceHttps, wwwHandling, preventDirListing, preventHotlinking, allowedDomains, blockedIps]);

  const updateRow = (index: number, updates: Partial<RedirectRule>) => {
    setRows(rs => rs.map((rr, j) => j === index ? { ...rr, ...updates } : rr));
  };

  return (
    <ToolShell title=".htaccess Redirect Generator" description="Generate Apache .htaccess rewrite redirects.">
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold mb-2">Predefined Snippets</h3>
            <div className="space-y-4 text-sm bg-muted/20 p-4 border rounded-md">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={forceHttps} onChange={e => setForceHttps(e.target.checked)} className="rounded" />
                Force HTTPS
              </label>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={preventDirListing} onChange={e => setPreventDirListing(e.target.checked)} className="rounded" />
                Prevent Directory Listing
              </label>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input type="checkbox" checked={preventHotlinking} onChange={e => setPreventHotlinking(e.target.checked)} className="rounded" />
                  Prevent Image Hotlinking
                </label>
                {preventHotlinking && (
                  <div className="pl-6 mt-1">
                    <div className="mb-1 text-[10px] uppercase text-muted-foreground font-semibold">Allowed Domains (comma separated)</div>
                    <Input value={allowedDomains} onChange={e => setAllowedDomains(e.target.value)} placeholder="e.g. example.com, mydomain.com" className="h-8 text-sm bg-background" />
                  </div>
                )}
              </div>
              
              <div className="pt-3 border-t">
                <div className="mb-2 text-[10px] uppercase text-muted-foreground font-semibold">WWW Handling</div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="www" checked={wwwHandling === 'none'} onChange={() => setWwwHandling('none')} /> None
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="www" checked={wwwHandling === 'add'} onChange={() => setWwwHandling('add')} /> Add WWW
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="www" checked={wwwHandling === 'remove'} onChange={() => setWwwHandling('remove')} /> Remove WWW
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t">
                <div className="mb-1 text-[10px] uppercase text-muted-foreground font-semibold">Block IP Addresses (comma separated)</div>
                <Input value={blockedIps} onChange={e => setBlockedIps(e.target.value)} placeholder="e.g. 192.168.1.1, 10.0.0.1" className="h-8 text-sm bg-background" />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Custom Redirect Rules</h3>
              <Button variant="outline" size="sm" onClick={() => setRows((r) => [...r, { from: '', fromMatchType: 'exact', query: '', queryMatchType: 'exact', to: '', type: '301', appendQuery: false }])}>+ Add Rule</Button>
            </div>
            <div className="space-y-4">
              {rows.map((r, i) => (
                <div key={i} className="flex flex-col gap-3 p-3 border rounded-md relative bg-muted/10">
                  <Button variant="ghost" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background border shadow-sm text-muted-foreground hover:text-destructive" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>×</Button>
                  
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-6">
                      <label className="text-[10px] uppercase text-muted-foreground font-semibold">From Path</label>
                      <Input value={r.from} onChange={(e) => updateRow(i, { from: e.target.value })} placeholder="/old-path" className="h-8 text-sm bg-background" />
                    </div>
                    <div className="col-span-3">
                      <label className="text-[10px] uppercase text-muted-foreground font-semibold">Path Match</label>
                      <select className="border rounded h-8 w-full px-2 bg-background text-sm" value={r.fromMatchType} onChange={(e) => updateRow(i, { fromMatchType: e.target.value as any })}>
                        <option value="exact">Exact</option>
                        <option value="startsWith">Starts</option>
                        <option value="regex">Regex</option>
                      </select>
                    </div>
                    <div className="col-span-3">
                      <label className="text-[10px] uppercase text-muted-foreground font-semibold">Redirect</label>
                      <select className="border rounded h-8 w-full px-2 bg-background text-sm" value={r.type} onChange={(e) => updateRow(i, { type: e.target.value })}>
                        <option value="301">301 (Perm)</option>
                        <option value="302">302 (Temp)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-6">
                      <label className="text-[10px] uppercase text-muted-foreground font-semibold">Query String (Optional)</label>
                      <Input value={r.query} onChange={(e) => updateRow(i, { query: e.target.value })} placeholder="id=123" className="h-8 text-sm bg-background" />
                    </div>
                    <div className="col-span-3">
                      <label className="text-[10px] uppercase text-muted-foreground font-semibold">Query Match</label>
                      <select className="border rounded h-8 w-full px-2 bg-background text-sm" value={r.queryMatchType} onChange={(e) => updateRow(i, { queryMatchType: e.target.value as any })}>
                        <option value="exact">Exact</option>
                        <option value="contains">Contains</option>
                        <option value="regex">Regex</option>
                      </select>
                    </div>
                    <div className="col-span-3 flex items-end pb-1">
                      <label className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground font-semibold cursor-pointer">
                        <input type="checkbox" checked={r.appendQuery} onChange={(e) => updateRow(i, { appendQuery: e.target.checked })} className="rounded" /> Keep Query
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-12">
                      <label className="text-[10px] uppercase text-muted-foreground font-semibold">To Destination</label>
                      <Input value={r.to} onChange={(e) => updateRow(i, { to: e.target.value })} placeholder="https://example.com/new-path" className="h-8 text-sm bg-background" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2">Generated .htaccess</h3>
          <Textarea readOnly value={out} className="h-full min-h-[400px] font-mono text-xs whitespace-pre bg-muted/5" />
        </div>
      </div>

    </ToolShell>
  );
}
