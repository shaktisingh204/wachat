'use client';

import {
  Button,
  Input,
  Field,
  Card,
  CardBody,
  Table,
  THead,
  Tr,
  Th,
  TBody,
  Td,
  useToast,
} from '@/components/sabcrm/20ui';
import { useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { Download } from 'lucide-react';

interface KeywordResult {
  keyword: string;
  volume: number;
  cpc: string;
  competition: number;
}

export default function QuestionKeywordsPage() {
  const { toast } = useToast();
  const [seed, setSeed] = useState('');
  const [results, setResults] = useState<KeywordResult[]>([]);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    const s = seed.trim().toLowerCase();
    if (!s) return;

    setLoading(true);
    setResults([]);

    try {
      const res = await fetch('/api/seo-tools/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed: s }),
      });

      if (!res.ok) throw new Error('Failed to fetch questions');

      const data = await res.json();
      if (data.results) {
        setResults(data.results);
      }

      toast.success(`Found ${data.results?.length || 0} questions`);
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const exportToCsv = () => {
    if (results.length === 0) return;
    const headers = ['Keyword', 'Search Volume', 'CPC ($)', 'Competition'];
    const csvContent = [
      headers.join(','),
      ...results.map((r) =>
        [
          `"${r.keyword.replace(/"/g, '""')}"`,
          r.volume,
          r.cpc,
          r.competition,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${seed.trim()}_questions.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Exported to CSV');
  };

  return (
    <ToolShell title="Question Keywords" description="Generate real question-style keyword variants and their metrics from a seed term.">
      <div className="flex items-end gap-2">
        <Field label="Seed keyword" className="flex-1">
          <Input
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="Enter seed keyword"
            onKeyDown={(e) => e.key === 'Enter' && run()}
            disabled={loading}
          />
        </Field>
        <Button
          variant="primary"
          onClick={run}
          loading={loading}
          disabled={loading || !seed.trim()}
        >
          Generate Questions
        </Button>
      </div>

      {results.length > 0 && (
        <Card className="mt-6">
          <CardBody className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium text-[var(--st-text)]">Found {results.length} Results</h3>
              <Button variant="outline" size="sm" iconLeft={Download} onClick={exportToCsv}>
                Export CSV
              </Button>
            </div>

            <div className="border border-[var(--st-border)] rounded-[var(--st-radius)]">
              <Table>
                <THead>
                  <Tr>
                    <Th>Keyword</Th>
                    <Th align="right">Volume</Th>
                    <Th align="right">CPC ($)</Th>
                    <Th align="right">Competition</Th>
                  </Tr>
                </THead>
                <TBody>
                  {results.map((r) => (
                    <Tr key={r.keyword}>
                      <Td className="font-medium">{r.keyword}</Td>
                      <Td align="right">{r.volume.toLocaleString()}</Td>
                      <Td align="right">{r.cpc}</Td>
                      <Td align="right">
                        <div className="flex items-center justify-end gap-2">
                          <div
                            className="w-16 h-2 bg-[var(--st-bg-muted)] rounded-full overflow-hidden"
                            role="meter"
                            aria-valuenow={r.competition}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`Competition ${r.competition} out of 100`}
                          >
                            <div
                              className="h-full bg-[var(--st-text)]"
                              style={{ width: `${r.competition}%` }}
                            />
                          </div>
                          <span className="text-xs w-6 text-[var(--st-text-secondary)]">{r.competition}</span>
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>
          </CardBody>
        </Card>
      )}
    </ToolShell>
  );
}
