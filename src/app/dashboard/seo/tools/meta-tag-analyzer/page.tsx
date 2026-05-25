'use client';

import { Button, Input, Card, ZoruCardContent, cn, Badge } from '@/components/zoruui';
import { useState } from 'react';

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl, parseHtml, type ParsedHtml } from '@/lib/seo-tools/api-client';

function getValidationBadge(type: 'title' | 'description', text: string = '') {
  const len = text.length;
  if (type === 'title') {
    if (len === 0) return <Badge variant="danger">Missing</Badge>;
    if (len < 30) return <Badge variant="warning">{len} chars - Too short</Badge>;
    if (len > 60) return <Badge variant="warning">{len} chars - Too long</Badge>;
    return <Badge variant="success">{len} chars - Good</Badge>;
  }
  if (type === 'description') {
    if (len === 0) return <Badge variant="danger">Missing</Badge>;
    if (len < 120) return <Badge variant="warning">{len} chars - Too short</Badge>;
    if (len > 160) return <Badge variant="warning">{len} chars - Too long</Badge>;
    return <Badge variant="success">{len} chars - Good</Badge>;
  }
  return null;
}

export default function MetaTagAnalyzerPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState<ParsedHtml | null>(null);
  const [error, setError] = useState('');

  const run = async () => {
    if (!url) return;
    setLoading(true); setError(''); setParsed(null);
    try {
      let fetchUrl = url;
      if (!fetchUrl.startsWith('http://') && !fetchUrl.startsWith('https://')) {
        fetchUrl = 'https://' + fetchUrl;
      }
      const r = await apiFetchUrl(fetchUrl);
      if (r.error) setError(r.error);
      else setParsed(parseHtml(r.body));
    } catch (e: any) {
      setError(e.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const rows: [string, string, React.ReactNode][] = parsed
    ? [
        ['Title', parsed.title, getValidationBadge('title', parsed.title)],
        ['Description', parsed.metaDescription, getValidationBadge('description', parsed.metaDescription)],
        ['Canonical', parsed.canonical, null],
        ['Robots', parsed.robots, null],
        ['Viewport', parsed.viewport, null],
        ['Lang', parsed.lang, null],
        ['Charset', parsed.charset, null],
      ]
    : [];

  let domain = '';
  try {
    domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
  } catch {
    domain = url;
  }

  const ogImage = parsed?.openGraph?.['og:image'];
  const ogTitle = parsed?.openGraph?.['og:title'] || parsed?.title;
  const ogDesc = parsed?.openGraph?.['og:description'] || parsed?.metaDescription;

  const twImage = parsed?.twitter?.['twitter:image'] || parsed?.twitter?.['twitter:image:src'] || ogImage;
  const twTitle = parsed?.twitter?.['twitter:title'] || ogTitle;
  const twDesc = parsed?.twitter?.['twitter:description'] || ogDesc;

  return (
    <ToolShell title="Meta Tag Analyzer" description="Inspect meta tags, Open Graph, and Twitter cards of any URL.">
      <div className="flex gap-2">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" onKeyDown={(e) => e.key === 'Enter' && run()} />
        <Button onClick={run} disabled={loading}>{loading ? 'Loading…' : 'Analyze'}</Button>
      </div>
      {error && <Card className="border-red-500"><ZoruCardContent className="p-4 text-red-600 text-sm">{error}</ZoruCardContent></Card>}
      
      {parsed && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div className="flex flex-col gap-6">
            <Card>
              <ZoruCardContent className="p-4">
                <div className="font-semibold text-sm mb-4">Meta Tags</div>
                <table className="w-full text-sm">
                  <tbody>
                    {rows.map(([k, v, badge]) => (
                      <tr key={k as string} className="border-t">
                        <td className="py-3 font-semibold w-32 align-top">{k as string}</td>
                        <td className="py-3">
                          <div className="flex flex-col gap-1.5 items-start">
                            {badge && <div>{badge}</div>}
                            <span className="break-all">{v || <span className="text-muted-foreground">—</span>}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ZoruCardContent>
            </Card>

            {(Object.keys(parsed.openGraph).length > 0 || Object.keys(parsed.twitter).length > 0) && (
              <Card>
                <ZoruCardContent className="p-4">
                  <div className="font-semibold text-sm mb-4">Social Tags</div>
                  
                  {Object.keys(parsed.openGraph).length > 0 && (
                    <div className="mb-6">
                      <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Open Graph</div>
                      {Object.entries(parsed.openGraph).map(([k, v]) => (
                        <div key={k} className="text-xs border-t py-2 break-all">
                          <span className="font-mono text-muted-foreground mr-2">{k}:</span>
                          <span>{v as string}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {Object.keys(parsed.twitter).length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Twitter</div>
                      {Object.entries(parsed.twitter).map(([k, v]) => (
                        <div key={k} className="text-xs border-t py-2 break-all">
                          <span className="font-mono text-muted-foreground mr-2">{k}:</span>
                          <span>{v as string}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </ZoruCardContent>
              </Card>
            )}
          </div>

          <div className="flex flex-col gap-6">
            <Card>
              <ZoruCardContent className="p-4">
                <div className="font-semibold text-sm mb-4">Google SERP Preview</div>
                <div className="p-4 bg-white dark:bg-[#202124] rounded-lg border max-w-2xl shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs overflow-hidden border">
                      <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt="favicon" className="w-4 h-4" onError={(e) => e.currentTarget.style.display = 'none'} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[14px] text-[#202124] dark:text-[#dadce0] truncate leading-tight">{domain}</span>
                      <span className="text-[12px] text-[#4d5156] dark:text-[#bdc1c6] truncate leading-tight">{url}</span>
                    </div>
                  </div>
                  <div className="text-[20px] text-[#1a0dab] dark:text-[#8ab4f8] hover:underline cursor-pointer truncate mb-1" style={{ fontFamily: 'arial, sans-serif' }}>
                    {parsed.title || 'No Title'}
                  </div>
                  <div className="text-[14px] text-[#4d5156] dark:text-[#bdc1c6] line-clamp-2" style={{ fontFamily: 'arial, sans-serif' }}>
                    {parsed.metaDescription || 'No description provided.'}
                  </div>
                </div>
              </ZoruCardContent>
            </Card>

            <Card>
              <ZoruCardContent className="p-4">
                <div className="font-semibold text-sm mb-4">Twitter / X Card Preview</div>
                <div className="max-w-[500px] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-black font-sans hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer transition-colors">
                  {twImage ? (
                    <div className="w-full aspect-[1.91/1] bg-slate-100 dark:bg-slate-800 border-b dark:border-slate-800 relative">
                      <img src={twImage} alt="Twitter Card Image" className="absolute inset-0 w-full h-full object-cover" onError={(e) => e.currentTarget.style.display = 'none'} />
                    </div>
                  ) : (
                    <div className="w-full aspect-[1.91/1] bg-slate-100 dark:bg-slate-800 border-b dark:border-slate-800 flex items-center justify-center text-slate-400">
                      No Image Provided
                    </div>
                  )}
                  <div className="p-3">
                    <div className="text-[13px] text-[#536471] dark:text-[#71767b] mb-0.5 truncate">{domain}</div>
                    <div className="text-[15px] font-semibold text-[#0f1419] dark:text-[#e7e9ea] truncate">{twTitle || 'No Title'}</div>
                    <div className="text-[15px] text-[#536471] dark:text-[#71767b] line-clamp-2 mt-0.5 leading-snug">{twDesc || 'No description provided.'}</div>
                  </div>
                </div>
              </ZoruCardContent>
            </Card>

            <Card>
              <ZoruCardContent className="p-4">
                <div className="font-semibold text-sm mb-4">Facebook / LinkedIn Card Preview</div>
                <div className="max-w-[500px] border bg-[#f0f2f5] dark:bg-[#242526] font-sans hover:opacity-95 cursor-pointer shadow-sm">
                  {ogImage ? (
                    <div className="w-full aspect-[1.91/1] bg-slate-200 dark:bg-slate-700 relative">
                      <img src={ogImage} alt="Open Graph Image" className="absolute inset-0 w-full h-full object-cover" onError={(e) => e.currentTarget.style.display = 'none'} />
                    </div>
                  ) : (
                    <div className="w-full aspect-[1.91/1] bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400">
                      No Image Provided
                    </div>
                  )}
                  <div className="p-3 bg-[#f0f2f5] dark:bg-[#242526] border-t dark:border-slate-700">
                    <div className="text-[12px] uppercase text-[#606770] dark:text-[#b0b3b8] mb-1 truncate tracking-wide">{domain}</div>
                    <div className="text-[16px] font-semibold text-[#1d2129] dark:text-[#e4e6eb] truncate mb-1 leading-snug">{ogTitle || 'No Title'}</div>
                    <div className="text-[14px] text-[#606770] dark:text-[#b0b3b8] line-clamp-2 leading-snug">{ogDesc || 'No description provided.'}</div>
                  </div>
                </div>
              </ZoruCardContent>
            </Card>
          </div>
        </div>
      )}
    </ToolShell>
  );
}
