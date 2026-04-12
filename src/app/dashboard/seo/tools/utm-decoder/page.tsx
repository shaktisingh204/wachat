'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ToolShell } from '@/components/seo-tools/tool-shell';

type Parsed = {
  valid: boolean;
  error?: string;
  base?: string;
  utm: { key: string; value: string }[];
  other: { key: string; value: string }[];
};

export default function UtmDecoderPage() {
  const [url, setUrl] = useState(
    'https://example.com/?utm_source=newsletter&utm_medium=email&utm_campaign=spring_sale&utm_term=shoes&utm_content=cta1',
  );

  const parsed = useMemo<Parsed>(() => {
    const trimmed = (url || '').trim();
    if (!trimmed) return { valid: false, error: 'Enter a URL to decode.', utm: [], other: [] };
    try {
      const u = new URL(trimmed);
      const params = new URLSearchParams(u.search);
      const utm: { key: string; value: string }[] = [];
      const other: { key: string; value: string }[] = [];
      params.forEach((value, key) => {
        if (key.toLowerCase().startsWith('utm_')) {
          utm.push({ key, value });
        } else {
          other.push({ key, value });
        }
      });
      return {
        valid: true,
        base: `${u.origin}${u.pathname}`,
        utm,
        other,
      };
    } catch {
      return { valid: false, error: 'Not a valid URL.', utm: [], other: [] };
    }
  }, [url]);

  return (
    <ToolShell
      title="UTM Decoder"
      description="Paste a URL to extract and inspect its UTM tracking parameters."
    >
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label htmlFor="utm-url">URL</Label>
          <Input
            id="utm-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/?utm_source=..."
          />
        </CardContent>
      </Card>

      {!parsed.valid ? (
        <p className="text-sm text-muted-foreground">{parsed.error}</p>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Base URL</div>
              <div className="font-mono text-sm break-all">{parsed.base}</div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Label>UTM parameters ({parsed.utm.length})</Label>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parameter</TableHead>
                      <TableHead>Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.utm.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-sm text-muted-foreground">
                          No UTM parameters found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      parsed.utm.map((p) => (
                        <TableRow key={p.key}>
                          <TableCell className="font-mono text-xs">{p.key}</TableCell>
                          <TableCell className="font-mono text-xs">{p.value}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {parsed.other.length > 0 && (
            <div className="space-y-2">
              <Label>Other query parameters ({parsed.other.length})</Label>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Parameter</TableHead>
                        <TableHead>Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsed.other.map((p) => (
                        <TableRow key={p.key}>
                          <TableCell className="font-mono text-xs">{p.key}</TableCell>
                          <TableCell className="font-mono text-xs">{p.value}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </ToolShell>
  );
}
