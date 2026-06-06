'use client';

import { Button, Input, Textarea, cn } from '@/components/sabcrm/20ui/compat';
import { useMemo, useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';

interface RedirectRule {
  from: string;
  fromMatchType: 'exact' | 'startsWith' | 'regex';
  query: string;
  queryMatchType: 'exact' | 'contains' | 'regex';
  to: string;
  type: string;
  queryHandling: 'ignore' | 'append' | 'discard';
}

export default function HtaccessRedirectPage() {
  const [rows, setRows] = useState<RedirectRule[]>([{ 
    from: '/old-path', 
    fromMatchType: 'exact',
    query: '', 
    queryMatchType: 'exact',
    to: '/new-path', 
    type: '301', 
    queryHandling: 'ignore' 
  }]);

  const [domainRedirect, setDomainRedirect] = useState<'none' | 'https' | 'www' | 'non-www' | 'https-www' | 'https-non-www'>('none');
  const [trailingSlash, setTrailingSlash] = useState<'none' | 'add' | 'remove'>('none');
  const [redirectIndex, setRedirectIndex] = useState(false);
  const [preventDirListing, setPreventDirListing] = useState(false);
  const [preventHotlinking, setPreventHotlinking] = useState(false);
  const [allowedDomains, setAllowedDomains] = useState('');
  const [errorDocument404, setErrorDocument404] = useState('');
  const [blockedIps, setBlockedIps] = useState('');
  const [enableGzip, setEnableGzip] = useState(false);
  const [enableBrowserCache, setEnableBrowserCache] = useState(false);
  const [blockBadBots, setBlockBadBots] = useState(false);
  const [disableXmlRpc, setDisableXmlRpc] = useState(false);

  const out = useMemo(() => {
    const lines = ['<IfModule mod_rewrite.c>', 'RewriteEngine On'];
    
    if (domainRedirect === 'https') {
      lines.push('\n# Force HTTPS');
      lines.push('RewriteCond %{HTTPS} off');
      lines.push('RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,NE,R=301]');
    } else if (domainRedirect === 'www') {
      lines.push('\n# Force WWW');
      lines.push('RewriteCond %{HTTP_HOST} !^www\\. [NC]');
      lines.push('RewriteCond %{HTTP_HOST} ^(.+)$ [NC]');
      lines.push('RewriteRule ^(.*)$ %{REQUEST_SCHEME}://www.%1%{REQUEST_URI} [L,NE,R=301]');
    } else if (domainRedirect === 'non-www') {
      lines.push('\n# Force Non-WWW');
      lines.push('RewriteCond %{HTTP_HOST} ^www\\.(.+)$ [NC]');
      lines.push('RewriteRule ^(.*)$ %{REQUEST_SCHEME}://%1%{REQUEST_URI} [L,NE,R=301]');
    } else if (domainRedirect === 'https-www') {
      lines.push('\n# Force HTTPS and WWW');
      lines.push('RewriteCond %{HTTPS} off [OR]');
      lines.push('RewriteCond %{HTTP_HOST} !^www\\. [NC]');
      lines.push('RewriteCond %{HTTP_HOST} ^(?:www\\.)?(.+)$ [NC]');
      lines.push('RewriteRule ^(.*)$ https://www.%1%{REQUEST_URI} [L,NE,R=301]');
    } else if (domainRedirect === 'https-non-www') {
      lines.push('\n# Force HTTPS and Non-WWW');
      lines.push('RewriteCond %{HTTPS} off [OR]');
      lines.push('RewriteCond %{HTTP_HOST} ^www\\. [NC]');
      lines.push('RewriteCond %{HTTP_HOST} ^(?:www\\.)?(.+)$ [NC]');
      lines.push('RewriteRule ^(.*)$ https://%1%{REQUEST_URI} [L,NE,R=301]');
    }

    if (trailingSlash === 'add') {
      lines.push('\n# Force Trailing Slash');
      lines.push('RewriteCond %{REQUEST_FILENAME} !-f');
      lines.push('RewriteRule ^(.*[^/])$ /$1/ [L,R=301]');
    } else if (trailingSlash === 'remove') {
      lines.push('\n# Remove Trailing Slash');
      lines.push('RewriteCond %{REQUEST_FILENAME} !-d');
      lines.push('RewriteRule ^(.*)/$ /$1 [L,R=301]');
    }

    if (redirectIndex) {
      lines.push('\n# Redirect index.php to Root');
      lines.push('RewriteCond %{THE_REQUEST} ^[A-Z]{3,9}\\ /index\\.php\\ HTTP/');
      lines.push('RewriteRule ^index\\.php$ / [L,R=301]');
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

    if (enableGzip) {
      lines.push('\n# Enable Gzip compression');
      lines.push('<IfModule mod_deflate.c>');
      lines.push('  AddOutputFilterByType DEFLATE text/plain text/html text/xml text/css application/xml application/xhtml+xml application/rss+xml application/javascript application/x-javascript');
      lines.push('</IfModule>');
    }

    if (enableBrowserCache) {
      lines.push('\n# Enable Browser Caching');
      lines.push('<IfModule mod_expires.c>');
      lines.push('  ExpiresActive On');
      lines.push('  ExpiresByType image/jpg "access plus 1 year"');
      lines.push('  ExpiresByType image/jpeg "access plus 1 year"');
      lines.push('  ExpiresByType image/gif "access plus 1 year"');
      lines.push('  ExpiresByType image/png "access plus 1 year"');
      lines.push('  ExpiresByType image/webp "access plus 1 year"');
      lines.push('  ExpiresByType text/css "access plus 1 month"');
      lines.push('  ExpiresByType application/javascript "access plus 1 month"');
      lines.push('  ExpiresByType image/x-icon "access plus 1 year"');
      lines.push('  ExpiresDefault "access plus 2 days"');
      lines.push('</IfModule>');
    }

    if (blockBadBots) {
      lines.push('\n# Block Bad Bots');
      lines.push('RewriteCond %{HTTP_USER_AGENT} ^.*(AhrefsBot|Baiduspider|BLEXBot|DotBot|SemrushBot|MJ12bot|YandexBot).*$ [NC]');
      lines.push('RewriteRule .* - [F,L]');
    }

    if (disableXmlRpc) {
      lines.push('\n# Disable WordPress XML-RPC');
      lines.push('<Files xmlrpc.php>');
      lines.push('  Require all denied');
      lines.push('</Files>');
    }

    if (errorDocument404.trim()) {
      lines.push('\n# Custom 404 Error Document');
      lines.push(`ErrorDocument 404 ${errorDocument404}`);
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
        
        let fromUrlRaw = r.from.trim();
        let queryPart = r.query.trim();
        let queryMatch = r.queryMatchType;

        if (fromUrlRaw.startsWith('http://') || fromUrlRaw.startsWith('https://')) {
           try {
              const urlObj = new URL(fromUrlRaw);
              fromUrlRaw = urlObj.pathname + urlObj.search;
           } catch(e) {}
        }

        let fromPathRaw = fromUrlRaw.replace(/^\//, ''); 

        if (fromPathRaw.includes('?')) {
          const parts = fromPathRaw.split('?');
          fromPathRaw = parts[0];
          if (!queryPart) {
             queryPart = parts.slice(1).join('?');
             queryMatch = 'exact';
          }
        }

        let fromPath = fromPathRaw;
        
        if (r.fromMatchType === 'exact') {
           fromPath = `^${fromPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;
        } else if (r.fromMatchType === 'startsWith') {
           fromPath = `^${fromPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`;
        } else {
           fromPath = fromPath || '.*';
        }

        if (queryPart) {
          let queryPattern = queryPart;
          if (queryMatch === 'exact') {
            queryPattern = `^${queryPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;
          } else if (queryMatch === 'contains') {
            queryPattern = queryPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          }
          lines.push(`RewriteCond %{QUERY_STRING} ${queryPattern} [NC]`);
        }

        let toPath = r.to;
        let flags = [`R=${r.type}`, 'L'];
        
        if (r.queryHandling === 'append') {
          flags.push('QSA');
        } else if (r.queryHandling === 'discard') {
          flags.push('QSD');
        }
        
        lines.push(`RewriteRule ${fromPath} ${toPath} [${flags.join(',')}]`);
      }
    }

    lines.push('</IfModule>');
    return lines.join('\n');
  }, [rows, domainRedirect, trailingSlash, redirectIndex, preventDirListing, preventHotlinking, allowedDomains, errorDocument404, blockedIps, enableGzip, enableBrowserCache, blockBadBots, disableXmlRpc]);

  const updateRow = (index: number, updates: Partial<RedirectRule>) => {
    setRows(rs => rs.map((rr, j) => j === index ? { ...rr, ...updates } : rr));
  };

  return (
    <ToolShell title=".htaccess Redirect Generator" description="Generate Apache .htaccess rewrite redirects.">
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold mb-2">Predefined Snippets</h3>
            <div className="space-y-4 text-sm bg-zoru-surface-2/20 p-4 border rounded-md">
              <div className="mb-2">
                <div className="mb-2 text-[10px] uppercase text-zoru-ink-muted font-semibold">Domain & Protocol Redirect</div>
                <select 
                  className="border rounded h-8 w-full px-2 bg-zoru-surface text-sm"
                  value={domainRedirect}
                  onChange={(e) => setDomainRedirect(e.target.value as any)}
                >
                  <option value="none">None</option>
                  <option value="https">Force HTTPS (Keep WWW/Non-WWW)</option>
                  <option value="www">Force WWW (Keep HTTP/HTTPS)</option>
                  <option value="non-www">Force Non-WWW (Keep HTTP/HTTPS)</option>
                  <option value="https-www">Force HTTPS + WWW</option>
                  <option value="https-non-www">Force HTTPS + Non-WWW</option>
                </select>
              </div>

              <div className="pt-3 border-t">
                <div className="mb-2 text-[10px] uppercase text-zoru-ink-muted font-semibold">Performance & Security</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={enableGzip} onChange={e => setEnableGzip(e.target.checked)} className="rounded" />
                    Enable Gzip
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={enableBrowserCache} onChange={e => setEnableBrowserCache(e.target.checked)} className="rounded" />
                    Browser Caching
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={blockBadBots} onChange={e => setBlockBadBots(e.target.checked)} className="rounded" />
                    Block Bad Bots
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={disableXmlRpc} onChange={e => setDisableXmlRpc(e.target.checked)} className="rounded" />
                    Disable XML-RPC
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t">
                <div className="mb-2 text-[10px] uppercase text-zoru-ink-muted font-semibold">File & Directory Security</div>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input type="checkbox" checked={redirectIndex} onChange={e => setRedirectIndex(e.target.checked)} className="rounded" />
                  Redirect index.php to Root (/)
                </label>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input type="checkbox" checked={preventDirListing} onChange={e => setPreventDirListing(e.target.checked)} className="rounded" />
                  Prevent Directory Listing
                </label>
                <div className="pt-1">
                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                    <input type="checkbox" checked={preventHotlinking} onChange={e => setPreventHotlinking(e.target.checked)} className="rounded" />
                    Prevent Image Hotlinking
                  </label>
                  {preventHotlinking && (
                    <div className="pl-6 mt-1 mb-2">
                      <div className="mb-1 text-[10px] uppercase text-zoru-ink-muted font-semibold">Allowed Domains (comma separated)</div>
                      <Input value={allowedDomains} onChange={e => setAllowedDomains(e.target.value)} placeholder="e.g. example.com, mydomain.com" className="h-8 text-sm bg-zoru-surface" />
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t">
                <div className="mb-2 text-[10px] uppercase text-zoru-ink-muted font-semibold">Trailing Slash Handling</div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="slash" checked={trailingSlash === 'none'} onChange={() => setTrailingSlash('none')} /> None
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="slash" checked={trailingSlash === 'add'} onChange={() => setTrailingSlash('add')} /> Force Slash (/)
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="slash" checked={trailingSlash === 'remove'} onChange={() => setTrailingSlash('remove')} /> Remove Slash
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t">
                <div className="mb-1 text-[10px] uppercase text-zoru-ink-muted font-semibold">Custom 404 Error Document (Path)</div>
                <Input value={errorDocument404} onChange={e => setErrorDocument404(e.target.value)} placeholder="e.g. /404.html" className="h-8 text-sm bg-zoru-surface" />
              </div>

              <div className="pt-3 border-t">
                <div className="mb-1 text-[10px] uppercase text-zoru-ink-muted font-semibold">Block IP Addresses (comma separated)</div>
                <Input value={blockedIps} onChange={e => setBlockedIps(e.target.value)} placeholder="e.g. 192.168.1.1, 10.0.0.1" className="h-8 text-sm bg-zoru-surface" />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Custom Redirect Rules</h3>
              <Button variant="outline" size="sm" onClick={() => setRows((r) => [...r, { from: '', fromMatchType: 'exact', query: '', queryMatchType: 'exact', to: '', type: '301', queryHandling: 'ignore' }])}>+ Add Rule</Button>
            </div>
            <div className="space-y-4">
              {rows.map((r, i) => (
                <div key={i} className="flex flex-col gap-3 p-3 border rounded-md relative bg-zoru-surface-2/10">
                  <Button variant="ghost" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-zoru-surface border shadow-sm text-zoru-ink-muted hover:text-zoru-ink" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>×</Button>
                  
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-6">
                      <label className="text-[10px] uppercase text-zoru-ink-muted font-semibold">From Path</label>
                      <Input value={r.from} onChange={(e) => updateRow(i, { from: e.target.value })} placeholder="/old-path" className="h-8 text-sm bg-zoru-surface" />
                    </div>
                    <div className="col-span-3">
                      <label className="text-[10px] uppercase text-zoru-ink-muted font-semibold">Path Match</label>
                      <select className="border rounded h-8 w-full px-2 bg-zoru-surface text-sm" value={r.fromMatchType} onChange={(e) => updateRow(i, { fromMatchType: e.target.value as any })}>
                        <option value="exact">Exact</option>
                        <option value="startsWith">Starts</option>
                        <option value="regex">Regex</option>
                      </select>
                    </div>
                    <div className="col-span-3">
                      <label className="text-[10px] uppercase text-zoru-ink-muted font-semibold">Redirect</label>
                      <select className="border rounded h-8 w-full px-2 bg-zoru-surface text-sm" value={r.type} onChange={(e) => updateRow(i, { type: e.target.value })}>
                        <option value="301">301 (Perm)</option>
                        <option value="302">302 (Temp)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-6">
                      <label className="text-[10px] uppercase text-zoru-ink-muted font-semibold">Query String (Optional)</label>
                      <Input value={r.query} onChange={(e) => updateRow(i, { query: e.target.value })} placeholder="id=123" className="h-8 text-sm bg-zoru-surface" />
                    </div>
                    <div className="col-span-3">
                      <label className="text-[10px] uppercase text-zoru-ink-muted font-semibold">Query Match</label>
                      <select className="border rounded h-8 w-full px-2 bg-zoru-surface text-sm" value={r.queryMatchType} onChange={(e) => updateRow(i, { queryMatchType: e.target.value as any })}>
                        <option value="exact">Exact</option>
                        <option value="contains">Contains</option>
                        <option value="regex">Regex</option>
                      </select>
                    </div>
                    <div className="col-span-3">
                      <label className="text-[10px] uppercase text-zoru-ink-muted font-semibold">Query Action</label>
                      <select className="border rounded h-8 w-full px-2 bg-zoru-surface text-sm" value={r.queryHandling} onChange={(e) => updateRow(i, { queryHandling: e.target.value as any })}>
                        <option value="ignore">Default</option>
                        <option value="append">Append (QSA)</option>
                        <option value="discard">Discard (QSD)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-12">
                      <label className="text-[10px] uppercase text-zoru-ink-muted font-semibold">To Destination</label>
                      <Input value={r.to} onChange={(e) => updateRow(i, { to: e.target.value })} placeholder="https://example.com/new-path" className="h-8 text-sm bg-zoru-surface" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2">Generated .htaccess</h3>
          <Textarea readOnly value={out} className="h-full min-h-[400px] font-mono text-xs whitespace-pre bg-zoru-surface-2/5" />
        </div>
      </div>

    </ToolShell>
  );
}
