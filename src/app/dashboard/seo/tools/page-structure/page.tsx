'use client';

import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Input,
} from '@/components/sabcrm/20ui';
import { useState } from 'react';
import { AlertTriangle, Hash } from 'lucide-react';
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
    <ToolShell title="Page Structure Analyzer" description="Analyze the H1 to H6 heading hierarchy of a page.">
      <div className="flex items-end gap-2">
        <Field label="Page URL" className="flex-1">
          <Input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            onKeyDown={(e) => e.key === 'Enter' && run()}
          />
        </Field>
        <Button variant="primary" onClick={run} disabled={!url} loading={loading}>
          {loading ? 'Analyzing' : 'Analyze'}
        </Button>
      </div>

      {error && (
        <Alert tone="danger" title="Could not analyze page">
          {error}
        </Alert>
      )}

      {p && orderedHeadings && (
        <div className="space-y-6">
          {warnings.length > 0 && (
            <Alert tone="warning" icon={AlertTriangle} title={`Structure warnings (${warnings.length})`}>
              <ul className="list-disc pl-5 space-y-1">
                {warnings.map((w, i) => (
                  <li key={i} className="text-xs">{w}</li>
                ))}
              </ul>
            </Alert>
          )}

          <Card padding="none">
            <CardHeader>
              <CardTitle>Heading Tree</CardTitle>
              <CardDescription>Total headings: {orderedHeadings.length}</CardDescription>
            </CardHeader>
            <CardBody className="overflow-x-auto">
              {orderedHeadings.length === 0 ? (
                <EmptyState
                  icon={Hash}
                  title="No headings found"
                  description="This page does not contain any H1 to H6 heading tags."
                />
              ) : (
                <div className="space-y-1 min-w-[300px]">
                  {orderedHeadings.map((h, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 text-sm py-0.5"
                      style={{ marginLeft: `${(h.level - 1) * 1.5}rem` }}
                    >
                      <Badge
                        tone={h.level === 1 ? 'accent' : 'neutral'}
                        className="font-mono shrink-0 mt-0.5"
                      >
                        H{h.level}
                      </Badge>
                      <span className="text-[var(--st-text)] leading-tight py-0.5 whitespace-pre-wrap break-words">
                        {h.text}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </ToolShell>
  );
}
