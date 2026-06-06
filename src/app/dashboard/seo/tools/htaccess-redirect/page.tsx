'use client';

import {
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Field,
  Input,
  Textarea,
  Checkbox,
  RadioGroup,
  Radio,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';
import { Plus, X } from 'lucide-react';
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
          <Card variant="outlined" padding="none">
            <CardHeader>
              <CardTitle>Predefined Snippets</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4 text-sm">
              <div>
                <Field label="Domain & Protocol Redirect">
                  <Select value={domainRedirect} onValueChange={(v) => setDomainRedirect(v as typeof domainRedirect)}>
                    <SelectTrigger aria-label="Domain and protocol redirect">
                      <SelectValue placeholder="Select a redirect" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="https">Force HTTPS (Keep WWW/Non-WWW)</SelectItem>
                      <SelectItem value="www">Force WWW (Keep HTTP/HTTPS)</SelectItem>
                      <SelectItem value="non-www">Force Non-WWW (Keep HTTP/HTTPS)</SelectItem>
                      <SelectItem value="https-www">Force HTTPS + WWW</SelectItem>
                      <SelectItem value="https-non-www">Force HTTPS + Non-WWW</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="pt-3 border-t border-[var(--st-border)]">
                <div className="mb-2 text-[10px] uppercase text-[var(--st-text-secondary)] font-semibold">Performance & Security</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Checkbox label="Enable Gzip" checked={enableGzip} onChange={e => setEnableGzip(e.target.checked)} />
                  <Checkbox label="Browser Caching" checked={enableBrowserCache} onChange={e => setEnableBrowserCache(e.target.checked)} />
                  <Checkbox label="Block Bad Bots" checked={blockBadBots} onChange={e => setBlockBadBots(e.target.checked)} />
                  <Checkbox label="Disable XML-RPC" checked={disableXmlRpc} onChange={e => setDisableXmlRpc(e.target.checked)} />
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--st-border)]">
                <div className="mb-2 text-[10px] uppercase text-[var(--st-text-secondary)] font-semibold">File & Directory Security</div>
                <div className="flex flex-col gap-2">
                  <Checkbox label="Redirect index.php to Root (/)" checked={redirectIndex} onChange={e => setRedirectIndex(e.target.checked)} />
                  <Checkbox label="Prevent Directory Listing" checked={preventDirListing} onChange={e => setPreventDirListing(e.target.checked)} />
                  <Checkbox label="Prevent Image Hotlinking" checked={preventHotlinking} onChange={e => setPreventHotlinking(e.target.checked)} />
                  {preventHotlinking && (
                    <div className="pl-6 mt-1">
                      <Field label="Allowed Domains (comma separated)">
                        <Input value={allowedDomains} onChange={e => setAllowedDomains(e.target.value)} placeholder="e.g. example.com, mydomain.com" inputSize="sm" />
                      </Field>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--st-border)]">
                <Field label="Trailing Slash Handling">
                  <RadioGroup value={trailingSlash} onValueChange={(v) => setTrailingSlash(v as typeof trailingSlash)} orientation="horizontal" aria-label="Trailing slash handling">
                    <Radio value="none" label="None" />
                    <Radio value="add" label="Force Slash (/)" />
                    <Radio value="remove" label="Remove Slash" />
                  </RadioGroup>
                </Field>
              </div>

              <div className="pt-3 border-t border-[var(--st-border)]">
                <Field label="Custom 404 Error Document (Path)">
                  <Input value={errorDocument404} onChange={e => setErrorDocument404(e.target.value)} placeholder="e.g. /404.html" inputSize="sm" />
                </Field>
              </div>

              <div className="pt-3 border-t border-[var(--st-border)]">
                <Field label="Block IP Addresses (comma separated)">
                  <Input value={blockedIps} onChange={e => setBlockedIps(e.target.value)} placeholder="e.g. 192.168.1.1, 10.0.0.1" inputSize="sm" />
                </Field>
              </div>
            </CardBody>
          </Card>

          <Card variant="outlined" padding="none">
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Custom Redirect Rules</CardTitle>
              <Button variant="outline" size="sm" iconLeft={Plus} onClick={() => setRows((r) => [...r, { from: '', fromMatchType: 'exact', query: '', queryMatchType: 'exact', to: '', type: '301', queryHandling: 'ignore' }])}>Add Rule</Button>
            </CardHeader>
            <CardBody className="space-y-4">
              {rows.map((r, i) => (
                <div key={i} className="flex flex-col gap-3 p-3 border border-[var(--st-border)] rounded-[var(--st-radius)] relative bg-[var(--st-bg-secondary)]">
                  <div className="absolute -top-2 -right-2">
                    <IconButton
                      label="Remove rule"
                      icon={X}
                      variant="outline"
                      size="sm"
                      className="h-6 w-6 rounded-full bg-[var(--st-bg-secondary)]"
                      onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                    />
                  </div>

                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-6">
                      <Field label="From Path">
                        <Input value={r.from} onChange={(e) => updateRow(i, { from: e.target.value })} placeholder="/old-path" inputSize="sm" />
                      </Field>
                    </div>
                    <div className="col-span-3">
                      <Field label="Path Match">
                        <Select value={r.fromMatchType} onValueChange={(v) => updateRow(i, { fromMatchType: v as RedirectRule['fromMatchType'] })}>
                          <SelectTrigger aria-label="Path match type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="exact">Exact</SelectItem>
                            <SelectItem value="startsWith">Starts</SelectItem>
                            <SelectItem value="regex">Regex</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <div className="col-span-3">
                      <Field label="Redirect">
                        <Select value={r.type} onValueChange={(v) => updateRow(i, { type: v })}>
                          <SelectTrigger aria-label="Redirect type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="301">301 (Perm)</SelectItem>
                            <SelectItem value="302">302 (Temp)</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-6">
                      <Field label="Query String (Optional)">
                        <Input value={r.query} onChange={(e) => updateRow(i, { query: e.target.value })} placeholder="id=123" inputSize="sm" />
                      </Field>
                    </div>
                    <div className="col-span-3">
                      <Field label="Query Match">
                        <Select value={r.queryMatchType} onValueChange={(v) => updateRow(i, { queryMatchType: v as RedirectRule['queryMatchType'] })}>
                          <SelectTrigger aria-label="Query match type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="exact">Exact</SelectItem>
                            <SelectItem value="contains">Contains</SelectItem>
                            <SelectItem value="regex">Regex</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <div className="col-span-3">
                      <Field label="Query Action">
                        <Select value={r.queryHandling} onValueChange={(v) => updateRow(i, { queryHandling: v as RedirectRule['queryHandling'] })}>
                          <SelectTrigger aria-label="Query action">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ignore">Default</SelectItem>
                            <SelectItem value="append">Append (QSA)</SelectItem>
                            <SelectItem value="discard">Discard (QSD)</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-12">
                      <Field label="To Destination">
                        <Input value={r.to} onChange={(e) => updateRow(i, { to: e.target.value })} placeholder="https://example.com/new-path" inputSize="sm" />
                      </Field>
                    </div>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>

        <Card variant="outlined" padding="none">
          <CardHeader>
            <CardTitle>Generated .htaccess</CardTitle>
          </CardHeader>
          <CardBody>
            <Field label="Output" className="h-full">
              <Textarea readOnly value={out} className="h-full min-h-[400px] font-mono text-xs whitespace-pre" />
            </Field>
          </CardBody>
        </Card>
      </div>

    </ToolShell>
  );
}
