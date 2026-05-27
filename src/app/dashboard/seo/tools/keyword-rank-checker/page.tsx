'use client';

import { Button, Input, Card, ZoruCardContent, cn } from '@/components/zoruui';
import { cn as _zoruCn, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { checkKeywordRankAction } from './action';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function KeywordRankCheckerPage() {
  const [keyword, setKeyword] = useState('');
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ 
    rank: number; 
    keyword: string; 
    domain: string;
    url?: string;
    message?: string;
    serpResults?: { rank: number; url: string; title: string; snippet?: string }[];
  } | null>(null);

  const run = async () => {
    if (!keyword || !domain) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await checkKeywordRankAction(keyword, domain);
      if (res.error) {
        setError(res.error);
      } else {
        setResult({ 
          rank: res.rank, 
          keyword, 
          domain, 
          url: res.url, 
          message: res.message,
          serpResults: res.serpResults
        });
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolShell title="Keyword Rank Checker" description="Check true keyword ranking for a domain using a SERP API.">
      <Card className="border-zoru-line bg-zoru-surface-2 dark:bg-zoru-ink/30">
        <ZoruCardContent className="p-3 text-xs">
          Rank data requires a SERP API provider (DataForSEO, SerpApi, or ScaleSERP). Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD, SERPAPI_KEY, or SCALESERP_KEY environment variables. If no keys are provided, it will fallback to scraping a free SERP provider.
        </ZoruCardContent>
      </Card>
      
      {error && (
        <Card className="border-zoru-line bg-zoru-surface-2 dark:bg-zoru-ink/30 text-zoru-ink dark:text-white">
          <ZoruCardContent className="p-3 text-sm">
            {error}
          </ZoruCardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Input 
          value={keyword} 
          onChange={(e) => setKeyword(e.target.value)} 
          placeholder="Keyword (e.g. sabnode crm)" 
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <Input 
          value={domain} 
          onChange={(e) => setDomain(e.target.value)} 
          placeholder="Domain (e.g. sabnode.com)" 
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
      </div>
      <Button onClick={run} disabled={loading || !keyword || !domain}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {loading ? 'Checking...' : 'Check rank'}
      </Button>
      
      {result && (
        <div className="space-y-4">
          <Card>
            <ZoruCardContent className="p-6 text-center">
              {result.rank > 0 ? (
                <>
                  <div className="text-5xl font-bold text-zoru-ink dark:text-zoru-ink-muted">
                    #{result.rank}
                  </div>
                  <div className="text-sm text-zoru-ink-muted mt-2">
                    {result.keyword} → {result.domain}
                  </div>
                  {result.url && (
                    <div className="text-xs text-zoru-ink-muted mt-4 truncate px-4">
                      <a href={result.url} target="_blank" rel="noopener noreferrer" className="hover:underline text-zoru-ink">
                        {result.url}
                      </a>
                    </div>
                  )}

                </>
              ) : (
                <>
                  <div className="text-3xl font-semibold text-zoru-ink-muted">
                    Not found in results
                  </div>
                  <div className="text-sm text-zoru-ink-muted mt-2">
                    {result.keyword} → {result.domain}
                  </div>
                </>
              )}
            </ZoruCardContent>
          </Card>
          
          {result.serpResults && result.serpResults.length > 0 && (
            <Card>
              <div className="p-4 border-b">
                <h3 className="font-semibold text-lg">Top SERP Results</h3>
              </div>
              <ZoruCardContent className="p-0">
                <div className="divide-y">
                  {result.serpResults.map((item, idx) => (
                    <div 
                      key={idx} 
                      className={cn(
                        "p-4 hover:bg-zoru-surface-2/50 transition-colors",
                        item.url.includes(result.domain) && "bg-zoru-surface-2/50 dark:bg-zoru-ink/20"
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <div className="text-lg font-bold text-zoru-ink-muted w-8 text-center shrink-0">
                          {item.rank}
                        </div>
                        <div className="min-w-0 flex-1">
                          <a 
                            href={item.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-base font-medium text-zoru-ink dark:text-zoru-ink-muted hover:underline line-clamp-1"
                          >
                            {item.title}
                          </a>
                          <div className="text-xs text-zoru-ink dark:text-zoru-ink mt-1 truncate">
                            {item.url}
                          </div>
                          {item.snippet && (
                            <p className="text-sm text-zoru-ink-muted mt-1 line-clamp-2">
                              {item.snippet}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ZoruCardContent>
            </Card>
          )}
        </div>
      )}
    </ToolShell>
  );
}
