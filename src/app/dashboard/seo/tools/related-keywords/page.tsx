'use client';

import { useState } from 'react';
import {
  Button,
  Input,
  Field,
  Card,
  CardHeader,
  CardTitle,
  Badge,
  EmptyState,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { fetchRelatedKeywords, RelatedKeywordIdea } from './actions';
import { Search } from 'lucide-react';

const INTENT_TONE: Record<string, BadgeTone> = {
  informational: 'info',
  navigational: 'neutral',
  commercial: 'accent',
  transactional: 'success',
};

function competitionTone(competition: number): BadgeTone {
  if (competition > 0.7) return 'danger';
  if (competition > 0.3) return 'warning';
  return 'success';
}

function competitionLabel(competition: number): string {
  if (competition > 0.7) return 'High';
  if (competition > 0.3) return 'Medium';
  return 'Low';
}

function competitionBarColor(competition: number): string {
  if (competition > 0.7) return 'var(--st-danger)';
  if (competition > 0.3) return 'var(--st-warn)';
  return 'var(--st-status-ok)';
}

export default function RelatedKeywordsPage() {
  const [seed, setSeed] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<RelatedKeywordIdea[]>([]);

  const run = async () => {
    const s = seed.trim().toLowerCase();
    if (!s) return;
    setLoading(true);
    try {
      const data = await fetchRelatedKeywords(s);
      setResults(data);
      setSearched(true);
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

  return (
    <ToolShell
      title="Related Keywords"
      description="Find related keyword ideas based on a seed term. Real search volumes and CPC are fetched and grouped by search intent."
    >
      <div className="flex gap-2 items-end">
        <Field label="Seed keyword" className="flex-1">
          <Input
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="Enter seed keyword (e.g. crm software)"
            iconLeft={Search}
            onKeyDown={(e) => e.key === 'Enter' && run()}
          />
        </Field>
        <Button
          variant="primary"
          onClick={run}
          disabled={loading || !seed.trim()}
          loading={loading}
          iconLeft={Search}
        >
          {loading ? 'Searching...' : 'Find Related'}
        </Button>
      </div>

      {results.length > 0 && (
        <div className="flex flex-col gap-6 mt-4">
          {Object.entries(grouped).map(([intent, keywords]) => (
            <Card key={intent} padding="none" className="overflow-hidden">
              <CardHeader className="flex items-center justify-between">
                <CardTitle className="capitalize flex items-center gap-2">
                  {intent} Intent
                  <Badge tone={INTENT_TONE[intent] ?? 'neutral'}>
                    {keywords.length} keywords
                  </Badge>
                </CardTitle>
              </CardHeader>
              <Table>
                <THead>
                  <Tr>
                    <Th>Keyword</Th>
                    <Th align="right">Volume</Th>
                    <Th align="right">CPC</Th>
                    <Th align="right">Competition</Th>
                  </Tr>
                </THead>
                <TBody>
                  {keywords.map((k) => (
                    <Tr key={k.term}>
                      <Td className="font-medium">{k.term}</Td>
                      <Td align="right">{k.volume.toLocaleString()}</Td>
                      <Td align="right">${k.cpc.toFixed(2)}</Td>
                      <Td align="right">
                        <div className="flex items-center justify-end gap-2">
                          <Badge tone={competitionTone(k.competition)} kind="soft">
                            {competitionLabel(k.competition)}
                          </Badge>
                          <div className="w-16 h-2 bg-[var(--st-bg-secondary)] rounded-[var(--st-radius)] overflow-hidden">
                            <div
                              className="h-full rounded-[var(--st-radius)]"
                              style={{
                                width: `${k.competition * 100}%`,
                                background: competitionBarColor(k.competition),
                              }}
                            />
                          </div>
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </Card>
          ))}
        </div>
      )}

      {searched && results.length === 0 && !loading && (
        <div className="mt-4">
          <EmptyState
            icon={Search}
            title="No related keywords found"
            description="Try a broader or different seed term to surface more keyword ideas."
          />
        </div>
      )}
    </ToolShell>
  );
}
