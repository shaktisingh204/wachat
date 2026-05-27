'use client';

import { Card, ZoruCardContent, Progress, Button, cn } from '@/components/zoruui';
import { useState, useRef } from 'react';
import { Upload, FileText, Loader2 } from 'lucide-react';

import { ToolShell } from '@/components/seo-tools/tool-shell';

const LOG_RE = /^(\S+) \S+ \S+ \[([^\]]+)\] "([A-Z]+) ([^"]+) HTTP\/\d\.\d" (\d+) \d+ "([^"]*)" "([^"]*)"/;

export default function LogAnalyzerPage() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [results, setResults] = useState<{
    total: number;
    bots: number;
    topIps: [string, number][];
    topPaths: [string, number][];
    topUAs: [string, number][];
  } | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

    const processChunk = async () => {
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
        topUAs: sort(uaCounts)
      });
      setLoading(false);
    };

    processChunk();
  };

  return (
    <ToolShell title="Server Log Analyzer" description="Parse massive NCSA/Combined access logs locally and find top IPs, paths, and bots.">
      <Card className="mb-6 border-dashed">
        <ZoruCardContent className="flex flex-col items-center justify-center p-8 text-center">
          <div className="rounded-full bg-zoru-surface-2 p-3 mb-4">
            <Upload className="h-6 w-6 text-zoru-ink-muted" />
          </div>
          <h3 className="text-sm font-medium mb-1">Upload Access Log</h3>
          <p className="text-xs text-zoru-ink-muted mb-4 max-w-sm">
            Select a massive NCSA/Combined log file. The file is processed locally in chunks to prevent freezing your browser.
          </p>
          
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".log,.txt,text/*"
            onChange={handleFileUpload}
            disabled={loading}
          />
          <Button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={loading}
            variant={loading ? "outline" : "default"}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Select Log File"
            )}
          </Button>
          
          {fileName && !loading && (
            <div className="mt-4 flex items-center gap-2 text-xs text-zoru-ink bg-zoru-surface-2 px-3 py-1.5 rounded-full">
              <FileText className="h-3 w-3" />
              <span>{fileName}</span>
            </div>
          )}
        </ZoruCardContent>
      </Card>

      {loading && (
        <div className="space-y-2 mb-6">
          <div className="flex justify-between text-xs font-medium">
            <span>Analyzing {fileName}...</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} />
        </div>
      )}

      {results && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            <Card><ZoruCardContent className="p-4"><div className="text-2xl font-bold">{results.total.toLocaleString()}</div><div className="text-xs text-zoru-ink-muted">Lines parsed</div></ZoruCardContent></Card>
            <Card><ZoruCardContent className="p-4"><div className="text-2xl font-bold">{results.bots.toLocaleString()}</div><div className="text-xs text-zoru-ink-muted">Bot hits</div></ZoruCardContent></Card>
            <Card><ZoruCardContent className="p-4"><div className="text-2xl font-bold">{results.topIps.length.toLocaleString()}</div><div className="text-xs text-zoru-ink-muted">Unique IPs (top)</div></ZoruCardContent></Card>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[['Top IPs', results.topIps], ['Top paths', results.topPaths], ['Top user agents', results.topUAs]].map(([title, list]) => (
              <Card key={title as string}><ZoruCardContent className="p-4">
                <div className="font-semibold text-sm mb-2">{title as string}</div>
                {(list as any[]).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs border-t py-1.5 gap-2">
                    <span className="font-mono truncate max-w-full" title={k}>{k}</span>
                    <span className="font-medium shrink-0">{v.toLocaleString()}</span>
                  </div>
                ))}
              </ZoruCardContent></Card>
            ))}
          </div>
        </>
      )}
    </ToolShell>
  );
}
