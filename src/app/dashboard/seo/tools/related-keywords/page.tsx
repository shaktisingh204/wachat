'use client';

import { Button, Input, Card, ZoruCardContent, Badge, cn, Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/zoruui';
import { cn as _zoruCn, useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { fetchRelatedKeywords, RelatedKeywordIdea } from './actions';
import { Search } from 'lucide-react';

void _zoruCn;

export default function RelatedKeywordsPage() {
  const [seed, setSeed] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<RelatedKeywordIdea[]>([]);

  const run = async () => {
    const s = seed.trim().toLowerCase();
    if (!s) return;
    setLoading(true);
    try {
      const data = await fetchRelatedKeywords(s);
      setResults(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Group by intent
  const grouped = results.reduce((acc, curr) => {
    if (!acc[curr.intent]) acc[curr.intent] = [];
    acc[curr.intent].push(curr);
    return acc;
  }, {} as Record<string, RelatedKeywordIdea[]>);

  const intentColors = {
    informational: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    navigational: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    commercial: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    transactional: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
  } as Record<string, string>;

  return (
    <ToolShell title="Related Keywords" description="Find related keyword ideas based on a seed term. Real search volumes and CPC are fetched and grouped by search intent.">
      <div className="flex gap-2">
        <Input
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          placeholder="Enter seed keyword (e.g., 'crm software')"
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <Button onClick={run} disabled={loading || !seed.trim()}>
          {loading ? 'Searching...' : (
            <>
              <Search className="w-4 h-4 mr-2" />
              Find Related
            </>
          )}
        </Button>
      </div>

      {results.length > 0 && (
        <div className="flex flex-col gap-6 mt-4">
          {Object.entries(grouped).map(([intent, keywords]) => (
            <Card key={intent} className="overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/40 flex items-center justify-between">
                <h3 className="font-semibold capitalize flex items-center gap-2">
                  {intent} Intent
                  <Badge variant="outline" className={cn("ml-2 capitalize", intentColors[intent])}>
                    {keywords.length} keywords
                  </Badge>
                </h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keyword</TableHead>
                    <TableHead className="text-right">Volume</TableHead>
                    <TableHead className="text-right">CPC</TableHead>
                    <TableHead className="text-right">Competition</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keywords.map((k) => (
                    <TableRow key={k.term}>
                      <TableCell className="font-medium">{k.term}</TableCell>
                      <TableCell className="text-right">{k.volume.toLocaleString()}</TableCell>
                      <TableCell className="text-right">${k.cpc.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-muted-foreground">
                            {k.competition > 0.7 ? 'High' : k.competition > 0.3 ? 'Medium' : 'Low'}
                          </span>
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full",
                                k.competition > 0.7 ? "bg-red-500" : k.competition > 0.3 ? "bg-amber-500" : "bg-green-500"
                              )}
                              style={{ width: `${k.competition * 100}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ))}
        </div>
      )}
    </ToolShell>
  );
}
