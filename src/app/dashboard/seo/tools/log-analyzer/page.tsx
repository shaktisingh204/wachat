'use client';

import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  StatCard,
  Progress,
  Button,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
} from '@/components/sabcrm/20ui';
import { SabFileToFileButton } from '@/components/sabfiles';
import { useState } from 'react';
import { Upload, FileText, Loader2, Network, FileSearch, Bot } from 'lucide-react';

import { ToolShell } from '@/components/seo-tools/tool-shell';

const LOG_RE = /^(\S+) \S+ \S+ \[([^\]]+)\] "([A-Z]+) ([^"]+) HTTP\/\d\.\d" (\d+) \d+ "([^"]*)" "([^"]*)"/;

export default function LogAnalyzerPage() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [results, setResults] = useState<{
    total: number;
    bots: number;
    topIps: [string, number][];
    topPaths: [string, number][];
    topUAs: [string, number][];
  } | null>(null);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setLoading(true);
    setProgress(0);
    setResults(null);

    const ipCounts = new Map<string, number>();
    const pathCounts = new Map<string, number>();
    const uaCounts = new Map<string, number>();
    let total = 0, bots = 0;

    // 2MB chunks for FileReader processing
    const CHUNK_SIZE = 1024 * 1024 * 2;
    let offset = 0;
    let leftover = '';

    const processLines = (lines: string[]) => {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        const m = line.match(LOG_RE);
        if (!m) continue;
        total++;
        ipCounts.set(m[1], (ipCounts.get(m[1]) || 0) + 1);
        pathCounts.set(m[4], (pathCounts.get(m[4]) || 0) + 1);
        uaCounts.set(m[7], (uaCounts.get(m[7]) || 0) + 1);
        if (/googlebot|bingbot|yandex|baiduspider|duckduckbot|facebot/i.test(m[7])) bots++;
      }
    };

    const readChunk = (blob: Blob): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = (e) => reject(e);
        reader.readAsText(blob);
      });
    };

    while (offset < file.size) {
      const slice = file.slice(offset, offset + CHUNK_SIZE);
      const text = await readChunk(slice);

      const lines = (leftover + text).split(/\r?\n/);
      leftover = lines.pop() || '';

      processLines(lines);
      offset += CHUNK_SIZE;

      setProgress(Math.min(100, Math.round((offset / file.size) * 100)));

      // Yield to render loop to prevent UI freezing
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    if (leftover) {
      processLines([leftover]);
    }

    const sort = (m: Map<string, number>) => Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15);
    setResults({
      total,
      bots,
      topIps: sort(ipCounts),
      topPaths: sort(pathCounts),
      topUAs: sort(uaCounts),
    });
    setLoading(false);
  };

  const lists: { title: string; icon: typeof Network; rows: [string, number][] }[] = [
    { title: 'Top IPs', icon: Network, rows: results?.topIps ?? [] },
    { title: 'Top paths', icon: FileSearch, rows: results?.topPaths ?? [] },
    { title: 'Top user agents', icon: Bot, rows: results?.topUAs ?? [] },
  ];

  return (
    <ToolShell title="Server Log Analyzer" description="Parse massive NCSA/Combined access logs locally and find top IPs, paths, and bots.">
      <Card variant="outlined" className="mb-6 border-dashed">
        <CardBody className="flex flex-col items-center justify-center p-8 text-center">
          <div className="mb-4 rounded-full bg-[var(--st-bg-muted)] p-3">
            <Upload className="h-6 w-6 text-[var(--st-text-secondary)]" aria-hidden="true" />
          </div>
          <h3 className="mb-1 text-sm font-medium text-[var(--st-text)]">Upload Access Log</h3>
          <p className="mb-4 max-w-sm text-xs text-[var(--st-text-secondary)]">
            Pick an NCSA/Combined log file from your SabFiles library. The file is processed locally in chunks to prevent freezing your browser.
          </p>

          {loading ? (
            <Button variant="outline" disabled iconLeft={Loader2}>
              Processing...
            </Button>
          ) : (
            <SabFileToFileButton
              accept="all"
              variant="default"
              title="Pick a log file"
              onPickFile={(file) => handleFile(file)}
            >
              Select Log File
            </SabFileToFileButton>
          )}

          {fileName && !loading && (
            <div className="mt-4 flex items-center gap-2 rounded-full bg-[var(--st-bg-muted)] px-3 py-1.5 text-xs text-[var(--st-text)]">
              <FileText className="h-3 w-3" aria-hidden="true" />
              <span>{fileName}</span>
            </div>
          )}
        </CardBody>
      </Card>

      {loading && (
        <div className="mb-6 space-y-2">
          <div className="flex justify-between text-xs font-medium text-[var(--st-text)]">
            <span>Analyzing {fileName}...</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} aria-label="Log analysis progress" />
        </div>
      )}

      {results && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatCard label="Lines parsed" value={results.total.toLocaleString()} icon={FileSearch} />
            <StatCard label="Bot hits" value={results.bots.toLocaleString()} icon={Bot} />
            <StatCard label="Unique IPs (top)" value={results.topIps.length.toLocaleString()} icon={Network} />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {lists.map(({ title, icon: Icon, rows }) => (
              <Card key={title} variant="outlined" padding="none">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Icon className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                    {title}
                  </CardTitle>
                </CardHeader>
                <CardBody>
                  <Table density="compact">
                    <THead>
                      <Tr>
                        <Th>Value</Th>
                        <Th align="right">Hits</Th>
                      </Tr>
                    </THead>
                    <TBody>
                      {rows.map(([k, v]) => (
                        <Tr key={k}>
                          <Td truncate>
                            <span className="font-mono" title={k}>{k}</span>
                          </Td>
                          <Td align="right">
                            <span className="font-medium">{v.toLocaleString()}</span>
                          </Td>
                        </Tr>
                      ))}
                    </TBody>
                  </Table>
                </CardBody>
              </Card>
            ))}
          </div>
        </>
      )}
    </ToolShell>
  );
}
