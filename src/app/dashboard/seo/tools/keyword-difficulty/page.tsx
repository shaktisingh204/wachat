'use client';

import {
  Button,
  Input,
  Field,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Alert,
  AlertTitle,
  AlertDescription,
  Skeleton,
  Progress,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Badge,
  type BadgeTone,
  type ProgressTone,
} from '@/components/sabcrm/20ui';
import { useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { Search, ExternalLink } from 'lucide-react';

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

function label(score: number): { text: string; tone: BadgeTone } {
  if (score < 30) return { text: 'Easy', tone: 'success' };
  if (score < 55) return { text: 'Moderate', tone: 'warning' };
  if (score < 80) return { text: 'Hard', tone: 'danger' };
  return { text: 'Very Hard', tone: 'danger' };
}

function barTone(score: number): ProgressTone {
  if (score < 30) return 'success';
  if (score < 55) return 'warning';
  return 'danger';
}

function daTone(da: number): BadgeTone {
  if (da > 70) return 'danger';
  if (da > 40) return 'warning';
  return 'success';
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
    <ToolShell
      title="Keyword Difficulty"
      description="Estimate how hard it will be to rank for a keyword based on top 10 search results."
    >
      <Alert variant="info" className="mb-6">
        <AlertTitle>Heuristic DA Estimation</AlertTitle>
        <AlertDescription>
          This tool fetches real Search Engine Results Page (SERP) competitors via DuckDuckGo. However, the Domain
          Authority (DA) values are estimated using a heuristic algorithm since live indexing APIs are not integrated in
          this demo environment.
        </AlertDescription>
      </Alert>

      <div className="flex flex-col sm:flex-row sm:items-end gap-2">
        <Field label="Keyword" className="w-full max-w-md">
          <Input
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            placeholder="Enter a keyword (e.g., 'React hooks')"
            onKeyDown={(e) => e.key === 'Enter' && run()}
            iconLeft={Search}
          />
        </Field>
        <Button
          variant="primary"
          onClick={run}
          disabled={!kw.trim()}
          loading={loading}
          iconLeft={Search}
        >
          Analyze SERP
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <Card className="mt-6" padding="lg">
          <div className="space-y-6">
            <div className="space-y-4">
              <Skeleton height={48} width={192} />
              <Skeleton height={16} width="100%" />
            </div>
            <div className="space-y-2 mt-8">
              <Skeleton height={40} width="100%" />
              <Skeleton height={40} width="100%" />
              <Skeleton height={40} width="100%" />
              <Skeleton height={40} width="100%" />
              <Skeleton height={40} width="100%" />
            </div>
          </div>
        </Card>
      )}

      {result !== null && l && (
        <div className="mt-6 space-y-6">
          <Card padding="lg">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-[var(--st-text)]">Keyword Difficulty</h3>
                <p className="text-sm text-[var(--st-text-secondary)] mt-1">
                  Based on the average Domain Authority of the top 10 ranking pages.
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-[var(--st-text)]">{result.score}</span>
                  <span className="text-sm text-[var(--st-text-secondary)]">/ 100</span>
                </div>
                <Badge tone={l.tone} className="text-sm px-3 py-1">
                  {l.text}
                </Badge>
              </div>
            </div>

            <Progress
              value={result.score}
              tone={barTone(result.score)}
              label={`Keyword difficulty: ${result.score} out of 100`}
              className="mt-6"
            />
          </Card>

          <Card padding="none">
            <CardHeader>
              <CardTitle>Top 10 Search Results</CardTitle>
              <CardDescription>Simulated SERP analysis for &quot;{kw.trim()}&quot;</CardDescription>
            </CardHeader>

            <CardBody className="p-0">
              <Table>
                <THead>
                  <Tr>
                    <Th align="center" width={48}>
                      Rank
                    </Th>
                    <Th>Page Title &amp; URL</Th>
                    <Th align="right">Domain Authority</Th>
                  </Tr>
                </THead>
                <TBody>
                  {result.results.map((item, index) => (
                    <Tr key={index}>
                      <Td align="center" className="font-medium text-[var(--st-text-secondary)]">
                        {index + 1}
                      </Td>
                      <Td>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-[var(--st-text)] line-clamp-1">{item.title}</span>
                          <span className="text-xs text-[var(--st-text-secondary)] flex items-center gap-1 line-clamp-1">
                            {item.url}
                            <ExternalLink className="h-3 w-3 inline-block opacity-50" aria-hidden="true" />
                          </span>
                        </div>
                      </Td>
                      <Td align="right">
                        <Badge tone={daTone(item.domainAuthority)}>{item.domainAuthority} DA</Badge>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </CardBody>
          </Card>
        </div>
      )}
    </ToolShell>
  );
}
