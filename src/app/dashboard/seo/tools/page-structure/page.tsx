'use client';

import { Button, Input, Card, ZoruCardContent, cn } from '@/components/zoruui';
import { useState } from 'react';
import { AlertTriangle, ChevronRight, Hash } from 'lucide-react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl, parseHtml, type ParsedHtml } from '@/lib/seo-tools/api-client';

interface OrderedHeading {
  level: number;
  text: string;
}

export default function PageStructurePage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [p, setP] = useState<ParsedHtml | null>(null);
  const [orderedHeadings, setOrderedHeadings] = useState<OrderedHeading[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState('');

  const run = async () => {
    if (!url) return;
    setLoading(true);
    setError('');
    setP(null);
    setOrderedHeadings(null);
    setWarnings([]);

    try {
      const r = await apiFetchUrl(url);
      if (r.error) {
        setError(r.error);
        return;
      }
      if (!r.body || r.body.trim() === '') {
        setError('Received empty HTML body.');
        return;
      }

      const parsed = parseHtml(r.body);
      setP(parsed);

      // Extract ordered headings
      const hMatch = Array.from(r.body.matchAll(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi));
      const oh = hMatch.map((m) => ({
        level: parseInt(m[1][1], 10),
        text: m[2].replace(/<[^>]+>/g, '').trim(),
      })).filter((h) => h.text.length > 0);

      setOrderedHeadings(oh);

      // Check for skips and H1 rules
      const newWarnings: string[] = [];
      if (parsed.h1.length === 0) {
        newWarnings.push('Page has no H1 tag. Recommended exactly 1.');
      } else if (parsed.h1.length > 1) {
        newWarnings.push(`Page has ${parsed.h1.length} H1 tags. Recommended exactly 1.`);
      }

      let prevLevel = 0;
      oh.forEach((h) => {
        if (prevLevel > 0 && h.level > prevLevel + 1) {
          newWarnings.push(`Skipped heading level from H${prevLevel} to H${h.level} ("${h.text}").`);
        }
        prevLevel = h.level;
      });

      setWarnings(newWarnings);
    } catch (e) {
      console.error(e);
      setError('An error occurred while analyzing the page structure. ' + String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolShell title="Page Structure Analyzer" description="Analyze the H1–H6 heading hierarchy of a page.">
      <div className="flex gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <Button onClick={run} disabled={loading || !url}>
          {loading ? 'Analyzing…' : 'Analyze'}
        </Button>
      </div>

      {error && (
        <Card className="border-red-500 bg-red-50/50">
          <ZoruCardContent className="p-4 text-red-600 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </ZoruCardContent>
        </Card>
      )}

      {p && orderedHeadings && (
        <div className="space-y-6">
          {warnings.length > 0 && (
            <Card className="border-amber-400 bg-amber-50/30">
              <ZoruCardContent className="p-4">
                <h3 className="text-sm font-bold text-amber-800 flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  Structure Warnings ({warnings.length})
                </h3>
                <ul className="list-disc pl-5 space-y-1">
                  {warnings.map((w, i) => (
                    <li key={i} className="text-xs text-amber-900">{w}</li>
                  ))}
                </ul>
              </ZoruCardContent>
            </Card>
          )}

          <Card>
            <ZoruCardContent className="p-0">
              <div className="p-4 border-b bg-muted/20">
                <h3 className="text-sm font-semibold">Heading Tree</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Total headings: {orderedHeadings.length}
                </p>
              </div>
              <div className="p-4 overflow-x-auto">
                {orderedHeadings.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No headings found on this page.</p>
                ) : (
                  <div className="space-y-1 min-w-[300px]">
                    {orderedHeadings.map((h, i) => {
                      const ml = (h.level - 1) * 1.5; // margin-left multiplier
                      return (
                        <div
                          key={i}
                          className="flex items-start gap-2 text-sm group py-0.5"
                          style={{ marginLeft: `${ml}rem` }}
                        >
                          <span
                            className={cn(
                              "font-mono text-[10px] px-1.5 py-0.5 rounded shrink-0 mt-0.5",
                              h.level === 1 && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                              h.level === 2 && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                              h.level === 3 && "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
                              h.level === 4 && "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
                              h.level >= 5 && "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                            )}
                          >
                            H{h.level}
                          </span>
                          <span className="text-foreground leading-tight py-0.5 whitespace-pre-wrap break-words">{h.text}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </ZoruCardContent>
          </Card>
        </div>
      )}
    </ToolShell>
  );
}
