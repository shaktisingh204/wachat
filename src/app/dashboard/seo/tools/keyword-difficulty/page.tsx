'use client';

import { 
  Button, 
  Input, 
  Card, 
  ZoruCardContent, 
  Alert, 
  ZoruAlertTitle, 
  ZoruAlertDescription,
  Skeleton,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
} from '@/components/sabcrm/20ui/compat';
import { useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { InfoIcon, Search, ExternalLink, Activity } from 'lucide-react';

import { analyzeKeywordDifficultyAction } from './actions';

interface SearchResult {
  title: string;
  url: string;
  domainAuthority: number;
}

interface KDResult {
  score: number;
  results: SearchResult[];
}

type Tone = "green" | "amber" | "red" | "obsidian";

function label(score: number): { text: string; color: string; tone: Tone } {
  if (score < 30) return { text: 'Easy', color: 'text-zoru-ink', tone: 'green' };
  if (score < 55) return { text: 'Moderate', color: 'text-zoru-ink', tone: 'amber' };
  if (score < 80) return { text: 'Hard', color: 'text-zoru-ink', tone: 'red' };
  return { text: 'Very Hard', color: 'text-zoru-ink', tone: 'red' };
}

function getBarColor(score: number): string {
  if (score < 30) return 'bg-zoru-success';
  if (score < 55) return 'bg-zoru-warning';
  return 'bg-zoru-danger';
}

export default function KeywordDifficultyPage() {
  const [kw, setKw] = useState('');
  const [result, setResult] = useState<KDResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    const s = kw.trim();
    if (!s || loading) return;
    
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const data = await analyzeKeywordDifficultyAction(s);
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch search results.');
    } finally {
      setLoading(false);
    }
  };

  const l = result !== null ? label(result.score) : null;

  return (
    <ToolShell title="Keyword Difficulty" description="Estimate how hard it will be to rank for a keyword based on top 10 search results.">
      <Alert variant="info" className="mb-6">
        <InfoIcon className="h-4 w-4" />
        <ZoruAlertTitle>Heuristic DA Estimation</ZoruAlertTitle>
        <ZoruAlertDescription>
          This tool fetches real Search Engine Results Page (SERP) competitors via DuckDuckGo. However, the Domain Authority (DA) values are estimated using a heuristic algorithm since live indexing APIs are not integrated in this demo environment.
        </ZoruAlertDescription>
      </Alert>

      <div className="flex gap-2">
        <Input
          value={kw}
          onChange={(e) => setKw(e.target.value)}
          placeholder="Enter a keyword (e.g., 'React hooks')"
          onKeyDown={(e) => e.key === 'Enter' && run()}
          className="max-w-md"
        />
        <Button onClick={run} disabled={loading || !kw.trim()}>
          {loading ? (
            <Activity className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Search className="h-4 w-4 mr-2" />
          )}
          Analyze SERP
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mt-6">
          <ZoruAlertTitle>Error</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </Alert>
      )}

      {loading && (
        <Card className="mt-6">
          <ZoruCardContent className="p-6 space-y-6">
            <div className="space-y-4">
              <Skeleton className="h-12 w-48" />
              <Skeleton className="h-4 w-full" />
            </div>
            <div className="space-y-2 mt-8">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </ZoruCardContent>
        </Card>
      )}

      {result !== null && l && (
        <div className="mt-6 space-y-6">
          <Card>
            <ZoruCardContent className="p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-zoru-ink">Keyword Difficulty</h3>
                  <p className="text-sm text-zoru-ink-muted mt-1">
                    Based on the average Domain Authority of the top 10 ranking pages.
                  </p>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-end">
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold">{result.score}</span>
                      <span className="text-sm text-zoru-ink-muted">/ 100</span>
                    </div>
                  </div>
                  <Badge tone={l.tone} className="text-sm px-3 py-1">
                    {l.text}
                  </Badge>
                </div>
              </div>
              
              <div className="w-full h-3 bg-zoru-surface-2 rounded-full overflow-hidden mt-6 relative">
                <div 
                  className={`h-full transition-all duration-1000 ease-out absolute top-0 left-0 ${getBarColor(result.score)}`}
                  style={{ width: `${result.score}%` }} 
                />
              </div>
            </ZoruCardContent>
          </Card>

          <Card>
            <ZoruCardContent className="p-0">
              <div className="p-6 pb-2">
                <h3 className="text-lg font-semibold text-zoru-ink">Top 10 Search Results</h3>
                <p className="text-sm text-zoru-ink-muted mt-1">
                  Simulated SERP analysis for "{kw.trim()}"
                </p>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">Rank</TableHead>
                    <TableHead>Page Title & URL</TableHead>
                    <TableHead className="text-right">Domain Authority</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.results.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="text-center font-medium text-zoru-ink-muted">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-zoru-ink line-clamp-1">{item.title}</span>
                          <a 
                            href="#" 
                            onClick={(e) => e.preventDefault()}
                            className="text-xs text-zoru-ink-muted hover:text-zoru-ink hover:underline flex items-center gap-1 line-clamp-1"
                          >
                            {item.url}
                            <ExternalLink className="h-3 w-3 inline-block opacity-50" />
                          </a>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge tone={item.domainAuthority > 70 ? "red" : item.domainAuthority > 40 ? "amber" : "green"}>
                          {item.domainAuthority} DA
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ZoruCardContent>
          </Card>
        </div>
      )}
    </ToolShell>
  );
}
