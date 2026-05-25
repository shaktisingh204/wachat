'use client';

import {
  Button,
  Input,
  Card,
  ZoruCardContent,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/zoruui';
import { useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface KeywordResult {
  keyword: string;
  volume: number;
  cpc: string;
  competition: number;
}

export default function QuestionKeywordsPage() {
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
      <div className="flex gap-2">
        <Input
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          placeholder="Enter seed keyword"
          onKeyDown={(e) => e.key === 'Enter' && run()}
          disabled={loading}
        />
        <Button onClick={run} disabled={loading || !seed.trim()}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Generate Questions
        </Button>
      </div>

      {results.length > 0 && (
        <Card className="mt-6">
          <ZoruCardContent className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium">Found {results.length} Results</h3>
              <Button variant="outline" size="sm" onClick={exportToCsv}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
            
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keyword</TableHead>
                    <TableHead className="text-right">Volume</TableHead>
                    <TableHead className="text-right">CPC ($)</TableHead>
                    <TableHead className="text-right">Competition</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r) => (
                    <TableRow key={r.keyword}>
                      <TableCell className="font-medium">{r.keyword}</TableCell>
                      <TableCell className="text-right">{r.volume.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{r.cpc}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary" 
                              style={{ width: `${r.competition}%` }} 
                            />
                          </div>
                          <span className="text-xs w-6 text-muted-foreground">{r.competition}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ZoruCardContent>
        </Card>
      )}
    </ToolShell>
  );
}
