'use client';

import {
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useZoruToast,
  Badge,
} from '@/components/sabcrm/20ui/compat';
import { useState } from 'react';

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { Download, RefreshCw } from 'lucide-react';

const PREFIXES = ['how to', 'what is', 'why is', 'when does', 'where is', 'can i', 'should i'];

interface QuestionData {
  question: string;
  group: string;
  volume: number;
}

function getGroup(q: string) {
  const lower = q.toLowerCase();
  if (lower.startsWith('how')) return 'How';
  if (lower.startsWith('what')) return 'What';
  if (lower.startsWith('why')) return 'Why';
  if (lower.startsWith('when')) return 'When';
  if (lower.startsWith('where')) return 'Where';
  if (lower.startsWith('can')) return 'Can';
  if (lower.startsWith('should')) return 'Should';
  return 'Other';
}

function getMockVolume(q: string) {
  let hash = 0;
  for (let i = 0; i < q.length; i++) {
    hash = q.charCodeAt(i) + ((hash << 5) - hash);
  }
  const val = Math.abs(hash) % 5000;
  return Math.max(10, Math.floor(val / 10) * 10);
}

export default function PeopleAlsoAskPage() {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<QuestionData[]>([]);
  const { toast } = useZoruToast();

  const run = async () => {
    if (!q.trim()) return;
    setLoading(true);
    setResults([]);
    const out = new Set<string>();
    
    let errorCount = 0;

    await Promise.all(PREFIXES.map(async (p) => {
      let success = false;
      let retries = 2;
      
      while (!success && retries >= 0) {
        try {
          const res = await fetch('/api/seo-tools/autocomplete', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ q: `${p} ${q}` }),
          });
          if (!res.ok) throw new Error(`API returned ${res.status}`);
          const data = await res.json();
          (data.suggestions || []).forEach((s: string) => out.add(s));
          success = true;
        } catch (err) {
          retries--;
          if (retries < 0) {
            errorCount++;
          } else {
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      }
    }));
    
    if (errorCount > 0) {
      toast({
        title: "Partial Failure",
        description: `Failed to fetch questions for ${errorCount} prefix(es) after retries.`,
        variant: "destructive"
      });
    } else if (out.size > 0) {
      toast({
        title: "Success",
        description: `Found ${out.size} questions.`,
        variant: "default"
      });
    } else {
      toast({
        title: "No Results",
        description: `Could not find any questions for this seed.`,
        variant: "default"
      });
    }

    const formattedResults: QuestionData[] = Array.from(out).map(s => ({
      question: s,
      group: getGroup(s),
      volume: getMockVolume(s)
    })).sort((a, b) => b.volume - a.volume);

    setResults(formattedResults);
    setLoading(false);
  };

  const exportCsv = () => {
    const headers = ['Question', 'Intent/Group', 'Est. Volume'];
    const rows = results.map(r => [
      `"${r.question.replace(/"/g, '""')}"`,
      `"${r.group}"`,
      r.volume
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(',') + '\n' 
      + rows.map(e => e.join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `people_also_ask_${q.trim()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <ToolShell title="People Also Ask" description="Question-based autocomplete variants for your seed.">
      <div className="flex gap-2 mb-6">
        <Input 
          value={q} 
          onChange={(e) => setQ(e.target.value)} 
          placeholder="e.g. seo" 
          onKeyDown={(e) => e.key === 'Enter' && run()} 
        />
        <Button onClick={run} disabled={loading} className="w-40">
          {loading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null}
          {loading ? 'Loading…' : 'Get questions'}
        </Button>
      </div>
      
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-zoru-ink">Results ({results.length})</h3>
            <Button onClick={exportCsv} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
          <div className="border border-zoru-line rounded-lg overflow-hidden bg-zoru-surface">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60%]">Question</TableHead>
                  <TableHead>Intent</TableHead>
                  <TableHead className="text-right">Est. Volume</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-zoru-ink">{r.question}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{r.group}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-zoru-ink-muted">{r.volume.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </ToolShell>
  );
}
