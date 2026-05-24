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
    mocked?: boolean;
    message?: string;
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
          mocked: res.mocked, 
          message: res.message 
        });
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolShell title="Keyword Rank Checker" description="Check keyword ranking for a domain. (Requires SERP API for production data.)">
      <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
        <ZoruCardContent className="p-3 text-xs">
          Production rank data requires a SERP API provider (DataForSEO or SerpApi). Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD, or SERPAPI_KEY environment variables.
        </ZoruCardContent>
      </Card>
      
      {error && (
        <Card className="border-red-300 bg-red-50 dark:bg-red-950/30 text-red-900 dark:text-red-200">
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
        <Card>
          <ZoruCardContent className="p-6 text-center">
            {result.rank > 0 ? (
              <>
                <div className="text-5xl font-bold text-green-600 dark:text-green-400">
                  #{result.rank}
                </div>
                <div className="text-sm text-muted-foreground mt-2">
                  {result.keyword} → {result.domain}
                </div>
                {result.url && (
                  <div className="text-xs text-muted-foreground mt-4 truncate px-4">
                    <a href={result.url} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-500">
                      {result.url}
                    </a>
                  </div>
                )}
                {result.mocked && (
                  <div className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-medium">
                    {result.message}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="text-3xl font-semibold text-muted-foreground">
                  Not found in top 100
                </div>
                <div className="text-sm text-muted-foreground mt-2">
                  {result.keyword} → {result.domain}
                </div>
                {result.mocked && (
                  <div className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-medium">
                    {result.message}
                  </div>
                )}
              </>
            )}
          </ZoruCardContent>
        </Card>
      )}
    </ToolShell>
  );
}
